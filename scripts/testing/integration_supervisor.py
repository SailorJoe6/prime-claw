#!/usr/bin/env python3
"""Own integration-launcher signals through terminal evidence closure."""
from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[2]
if str(REPO) not in sys.path:
    sys.path.insert(0, str(REPO))
from scripts.testing import provenance as p

WATCHED = tuple(sig for sig in (
    signal.SIGTERM, signal.SIGINT, signal.SIGHUP) if sig is not None)


def _load_status(root: p.DirectoryAuthority) -> tuple[Path, str, str] | None:
    try:
        row = json.loads(p.read_owned_regular_text(
            root, "status.json", max_bytes=4096))
    except (FileNotFoundError, UnicodeError, json.JSONDecodeError,
            p.ProvenanceError):
        return None
    if (not isinstance(row, dict)
            or set(row) != {"tier_dir", "binding", "nonce"}
            or not isinstance(row.get("tier_dir"), str)
            or not isinstance(row.get("binding"), str)
            or not isinstance(row.get("nonce"), str)
            or len(row["nonce"]) != 64
            or any(char not in "0123456789abcdef" for char in row["nonce"])):
        return None
    tier = Path(row["tier_dir"])
    return (tier, row["binding"], row["nonce"]) if tier.is_absolute() else None


def _retain_and_acknowledge(
    status_root: p.DirectoryAuthority,
    status: tuple[Path, str, str],
) -> tuple[p.DirectoryAuthority, p.RetainedDirectory] | None:
    tier, binding, nonce = status
    authority = None
    retained = None
    try:
        authority = p.open_directory_authority(tier, binding)
        retained = p.retain_directory_authority(authority)
        p.write_sanitized_json(
            status_root, "ack.json", {"nonce": nonce})
        return authority, retained
    except Exception:
        if retained is not None:
            retained.close()
        if authority is not None:
            authority.close()
        return None


def _close_evidence(owned: p.RetainedDirectory | p.OwnedDirectory | None,
                    failed: bool) -> bool:
    if owned is None:
        return False
    repo = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo))
    from scripts.testing import integration_provenance as ip
    try:
        manifest = p.read_sanitized_json(owned, "manifest.json")
        ip.validate_manifest(manifest)
        if failed and manifest["status"] == "passed":
            current = p.ObjectBinding.from_stat(os.stat(
                "manifest.json", dir_fd=owned.fd,
                follow_symlinks=False))
            replacement = copy.deepcopy(manifest)
            replacement["status"] = "failed"
            replacement["run"]["status"] = "failed"
            replacement["run"]["failure_codes"] = [
                "publication-invalidated"]
            try:
                ip.publish_manifest(
                    owned, replacement, expected_existing=current)
            except Exception:
                p.invalidate_green_manifest(owned, expected=current)
                return False
            manifest = p.read_sanitized_json(owned, "manifest.json")
        ip.validate_manifest(manifest)
        ip.verify_evidence(owned, manifest)
        return manifest["status"] == ("failed" if failed else "passed")
    except Exception:
        return False


def _owned_pending(sigpending, prior_mask) -> int | None:
    caller_blocked = set(prior_mask or ())
    pending = set(sigpending())
    return next((int(sig) for sig in WATCHED
                 if sig not in caller_blocked and sig in pending), None)


def supervise(script: str, argv: list[str]) -> int:
    requested_dry_run = "--dry-run" in argv
    expected_launcher = REPO / "scripts/test-integration.sh"
    dry_run = (requested_dry_run
               and Path(os.path.realpath(script)) == expected_launcher)
    sigmask = getattr(signal, "pthread_sigmask", None)
    sigpending = getattr(signal, "sigpending", None)
    if sigmask is None or sigpending is None:
        print("error: atomic integration signal boundary is unavailable",
              file=sys.stderr)
        return 1
    previous = {sig: signal.getsignal(sig) for sig in WATCHED}
    prior_mask = sigmask(signal.SIG_BLOCK, WATCHED)
    received: list[int] = []
    process: subprocess.Popen[bytes] | None = None
    handlers_installed = False
    mask_restored = False
    ownership_open = True
    status_path: Path | None = None
    status_parent: p.DirectoryAuthority | None = None
    status_root: p.DirectoryAuthority | None = None
    status_record: tuple[Path, str, str] | None = None
    tier_authority: p.DirectoryAuthority | None = None
    retained_tier: p.RetainedDirectory | None = None

    def dispatch_previous(signum, frame):
        handler = previous[signal.Signals(signum)]
        if handler == signal.SIG_IGN:
            return
        if handler == signal.SIG_DFL:
            signal.signal(signum, signal.SIG_DFL)
            signal.raise_signal(signum)
            return
        handler(signum, frame)

    def forward(signum, frame):
        nonlocal ownership_open
        if not ownership_open:
            dispatch_previous(signum, frame)
            return
        if not received:
            received.append(signum)
        if process is not None and process.poll() is None:
            try:
                os.killpg(process.pid, signum)
            except ProcessLookupError:
                pass

    try:
        # Mark first so a partial installation failure still restores every
        # exact caller handler in the outer finalizer.
        handlers_installed = True
        for sig in WATCHED:
            signal.signal(sig, forward)

        status_path = Path(os.path.realpath(tempfile.mkdtemp(
            prefix="prime-claw-integration-status.")))
        status_parent_binding = p.owned_directory_binding(status_path.parent)
        status_binding = p.owned_directory_binding(status_path)
        status_parent = p.open_directory_authority(
            status_path.parent, status_parent_binding)
        status_root = p.open_directory_authority(status_path, status_binding)
        env = dict(os.environ)
        env["PRIME_CLAW_INTEGRATION_INNER"] = "1"
        env["PRIME_CLAW_INTEGRATION_STATUS_ROOT"] = str(status_root.path)
        env["PRIME_CLAW_INTEGRATION_STATUS_BINDING"] = status_root.binding.encode()

        restore = (
            "import os,signal,sys; signal.pthread_sigmask(signal.SIG_SETMASK, "
            "{signal.Signals(int(x)) for x in sys.argv[1].split(',') if x}); "
            "os.execv(sys.argv[2], sys.argv[2:])")
        encoded = ",".join(str(int(sig)) for sig in sorted(
            prior_mask or (), key=int))
        process = subprocess.Popen(
            [sys.executable, "-c", restore, encoded, script, *argv],
            env=env, start_new_session=True)
        sigmask(signal.SIG_SETMASK, prior_mask)

        if dry_run:
            rc = process.wait()
        else:
            # A real driver cannot proceed to green publication until the
            # supervisor has retained the exact tier inode and acknowledged
            # the nonce through the bounded status authority.
            while retained_tier is None:
                candidate = _load_status(status_root)
                if candidate is not None:
                    retained = _retain_and_acknowledge(status_root, candidate)
                    if retained is not None:
                        tier_authority, retained_tier = retained
                        status_record = candidate
                        break
                try:
                    rc = process.wait(timeout=0.02)
                    break
                except subprocess.TimeoutExpired:
                    pass
            if retained_tier is not None:
                rc = process.wait()

        terminal_mask = sigmask(signal.SIG_BLOCK, WATCHED)
        observed = received[0] if received else None
        terminal_status = _load_status(status_root)
        status_intact = (terminal_status is None if dry_run
                         else status_record is not None
                         and terminal_status == status_record)
        tier_intact = dry_run
        if tier_authority is not None:
            try:
                p.verify_directory_authority(tier_authority)
                tier_intact = True
            except p.ProvenanceError:
                tier_intact = False
        closure_signal = _owned_pending(sigpending, prior_mask)
        if observed is None and closure_signal is not None:
            observed = closure_signal
        failed = (observed is not None or rc != 0
                  or not status_intact or not tier_intact)
        # Dry-run deliberately creates no run/evidence tree. Every real run
        # requires the retained tier capability and verified terminal manifest.
        evidence_ok = ((not failed and terminal_status is None) if dry_run
                       else _close_evidence(retained_tier, failed))

        # Keep forwarding handlers installed across the only terminal unmask.
        # A signal pending or injected at this edge is delivered to `forward`
        # before SIG_SETMASK returns, while evidence authority is still live.
        sigmask(signal.SIG_SETMASK, terminal_mask)
        mask_restored = True
        ownership_open = False
        post_unmask = received[0] if received else None
        if observed is None and post_unmask is not None:
            observed = post_unmask
        post_status = _load_status(status_root)
        post_status_intact = (post_status is None if dry_run
                              else status_record is not None
                              and post_status == status_record)
        post_tier_intact = dry_run
        if tier_authority is not None:
            try:
                p.verify_directory_authority(tier_authority)
                post_tier_intact = True
            except p.ProvenanceError:
                post_tier_intact = False
        if (observed is not None or not post_status_intact
                or not post_tier_intact) and not failed:
            failed = True
            evidence_ok = _close_evidence(retained_tier, True) and evidence_ok
        if failed or not evidence_ok:
            rc = rc or 1
        if observed is not None:
            rc = 128 + observed

        # The caller mask is now the ownership cutoff. Until each handler is
        # restored, `forward` delegates new caller-owned signals exactly.
        for sig, handler in previous.items():
            signal.signal(sig, handler)
        handlers_installed = False
        if rc == 0 and evidence_ok:
            if dry_run:
                print("integration driver: OK — dry-run contract verified; "
                      "no manifest was created")
            else:
                print("integration driver: OK — exact image, offline assertions, "
                      "teardown, and manifest verified")
        return rc
    finally:
        if process is not None and process.poll() is None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait()
        if not mask_restored:
            try:
                # On every early exceptional exit, keep forwarding handlers
                # active across restoration of the exact caller mask.
                sigmask(signal.SIG_SETMASK, prior_mask)
            finally:
                mask_restored = True
                ownership_open = False
        if handlers_installed:
            for sig, handler in previous.items():
                try:
                    signal.signal(sig, handler)
                except BaseException:
                    pass
        if retained_tier is not None:
            retained_tier.close()
        if tier_authority is not None:
            tier_authority.close()
        if status_root is not None and status_parent is not None:
            try:
                p.remove_directory_authority(
                    status_root, quarantine=status_parent)
            except (OSError, p.ProvenanceError):
                pass
        if status_root is not None:
            status_root.close()
        if status_parent is not None:
            status_parent.close()


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    return supervise(args[0], args[1:]) if args else 2


if __name__ == "__main__":
    raise SystemExit(main())
