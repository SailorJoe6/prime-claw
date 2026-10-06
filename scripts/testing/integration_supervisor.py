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
from scripts.testing import integration_provenance as ip
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


def _load_candidate(root: p.DirectoryAuthority) -> dict[str, object] | None:
    try:
        candidate = p.read_sanitized_json(
            root, "candidate.json", max_bytes=ip.MANIFEST_MAX_BYTES)
        return ip.validate_manifest(candidate)
    except (FileNotFoundError, p.ProvenanceError):
        return None


def _failed_manifest(
    manifest: dict[str, object], *, code: str,
) -> dict[str, object]:
    failed = copy.deepcopy(manifest)
    failed["status"] = "failed"
    failed["run"]["status"] = "failed"
    codes = list(failed["run"]["failure_codes"])
    if code not in codes:
        codes.append(code)
    failed["run"]["failure_codes"] = codes
    return ip.validate_manifest(failed)


def _neutralize_retained(
    retained: p.RetainedRegularFile | None,
    manifest: dict[str, object] | None,
    *,
    code: str,
) -> bool:
    if retained is None:
        return False
    try:
        if manifest is not None:
            failed = _failed_manifest(manifest, code=code)
            ip.overwrite_retained_manifest_failed(retained, failed)
        else:
            ip.neutralize_retained_manifest(retained, reason=code)
        return True
    except BaseException:
        try:
            ip.neutralize_retained_manifest(
                retained, reason="terminal-closure-failed")
        except BaseException:
            return False
        return True


def _close_evidence(owned: p.RetainedDirectory | p.OwnedDirectory | None,
                    failed: bool) -> bool:
    """Compatibility closure using only one retained exact manifest inode."""
    if owned is None:
        return False
    retained = None
    manifest = None
    try:
        retained = p.retain_owned_regular_file(
            owned, "manifest.json", max_bytes=ip.MANIFEST_MAX_BYTES,
            writable=True)
        manifest = ip.read_retained_manifest(retained)
        if failed and manifest["status"] == "passed":
            if not _neutralize_retained(
                    retained, manifest, code="publication-invalidated"):
                return False
            manifest = ip.read_retained_manifest(retained)
        ip.verify_evidence(owned, manifest)
        return manifest["status"] == ("failed" if failed else "passed")
    except Exception:
        if manifest is not None and manifest.get("status") == "passed":
            _neutralize_retained(
                retained, manifest, code="terminal-closure-failed")
        return False
    finally:
        if retained is not None:
            retained.close()


def _owned_pending(sigpending, prior_mask) -> int | None:
    caller_blocked = set(prior_mask or ())
    pending = set(sigpending())
    return next((int(sig) for sig in WATCHED
                 if sig not in caller_blocked and sig in pending), None)


def supervise(
    script: str,
    argv: list[str],
    *,
    final_owner: bool = False,
) -> int:
    """Run one provisional driver; only final_owner may expose green evidence."""
    requested_dry_run = "--dry-run" in argv
    expected_launcher = REPO / "scripts/test-integration.sh"
    dry_run = (requested_dry_run
               and Path(os.path.realpath(script)) == expected_launcher)
    sigmask = getattr(signal, "pthread_sigmask", None)
    sigpending = getattr(signal, "sigpending", None)
    if sigmask is None or sigpending is None:
        print("error: atomic integration signal boundary is unavailable",
              file=sys.stderr)
        if final_owner:
            os._exit(1)
        return 1

    prior_mask = sigmask(signal.SIG_BLOCK, WATCHED)
    owned = tuple(sig for sig in WATCHED if sig not in set(prior_mask or ()))
    previous = {sig: signal.getsignal(sig) for sig in owned}
    received: list[int] = []
    process: subprocess.Popen[bytes] | None = None
    handlers_installed = False
    ownership_open = True
    status_path: Path | None = None
    status_parent: p.DirectoryAuthority | None = None
    status_root: p.DirectoryAuthority | None = None
    status_record: tuple[Path, str, str] | None = None
    tier_authority: p.DirectoryAuthority | None = None
    retained_tier: p.RetainedDirectory | None = None
    manifest_lease: p.RetainedRegularFile | None = None
    published_manifest: dict[str, object] | None = None
    terminal_exit = False
    result = 1
    pending_error: BaseException | None = None

    def poison(code: str) -> bool:
        nonlocal published_manifest
        if manifest_lease is None:
            return False
        was_green = (published_manifest is not None
                     and published_manifest.get("status") == "passed")
        okay = _neutralize_retained(
            manifest_lease, published_manifest, code=code)
        if okay and was_green and published_manifest is not None:
            try:
                published_manifest = _failed_manifest(
                    published_manifest, code=code)
            except Exception:
                published_manifest = None
        return okay

    def forward(signum, _frame):
        if signal.Signals(signum) not in owned:
            return
        if ownership_open and not received:
            received.append(signum)
        if process is not None and process.poll() is None:
            try:
                os.killpg(process.pid, signum)
            except ProcessLookupError:
                pass
        if (manifest_lease is not None and published_manifest is not None
                and published_manifest.get("status") == "passed"):
            poison("publication-invalidated")
        if terminal_exit:
            try:
                sys.stdout.flush(); sys.stderr.flush()
            finally:
                os._exit(128 + signum)

    try:
        handlers_installed = True
        for sig in owned:
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
            while retained_tier is None:
                status = _load_status(status_root)
                if status is not None:
                    retained = _retain_and_acknowledge(status_root, status)
                    if retained is not None:
                        tier_authority, retained_tier = retained
                        status_record = status
                        break
                try:
                    rc = process.wait(timeout=0.02)
                    break
                except subprocess.TimeoutExpired:
                    pass
            if retained_tier is not None:
                rc = process.wait()

        terminal_mask = sigmask(signal.SIG_BLOCK, owned)
        observed = received[0] if received else None
        closure_signal = _owned_pending(sigpending, prior_mask)
        if observed is None and closure_signal is not None:
            observed = closure_signal

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

        candidate = None if dry_run else _load_candidate(status_root)
        candidate_ok = False
        if candidate is not None and retained_tier is not None:
            try:
                ip.verify_evidence(retained_tier, candidate)
                candidate_ok = True
            except p.ProvenanceError:
                candidate_ok = False
        failed = (observed is not None or rc != 0
                  or not status_intact or not tier_intact
                  or (not dry_run and (not candidate_ok
                                       or candidate["status"] != "passed")))
        evidence_ok = dry_run and not failed

        if not dry_run and candidate_ok and retained_tier is not None:
            final_manifest = candidate
            if failed and candidate["status"] == "passed":
                final_manifest = _failed_manifest(
                    candidate, code="supervisor-terminal-failed")
            try:
                manifest_lease = ip.publish_final_manifest(
                    retained_tier, final_manifest)
                published_manifest = final_manifest
                evidence_ok = final_manifest["status"] == (
                    "failed" if failed else "passed")
            except Exception:
                failed = True
                evidence_ok = False
        elif not dry_run and retained_tier is not None:
            # Compatibility for a pre-provisional failed child: close an exact
            # already-public manifest, but never authorize success from it.
            failed = True
            evidence_ok = _close_evidence(retained_tier, True)

        # The final owner remains installed across this unmask. Any signal at
        # the transition is recorded and exact-fd neutralization is immediate.
        sigmask(signal.SIG_SETMASK, terminal_mask)
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
        post_candidate_intact = dry_run
        if not dry_run and candidate is not None:
            post_candidate_intact = _load_candidate(status_root) == candidate
        post_publication_intact = dry_run or published_manifest is None
        if (manifest_lease is not None and retained_tier is not None
                and published_manifest is not None):
            try:
                ip.verify_final_publication(
                    retained_tier, manifest_lease, published_manifest)
                post_publication_intact = True
            except (OSError, ValueError, p.ProvenanceError):
                post_publication_intact = False

        if (observed is not None or not post_status_intact
                or not post_tier_intact or not post_candidate_intact
                or not post_publication_intact):
            failed = True
            if published_manifest is not None and published_manifest.get("status") == "passed":
                evidence_ok = poison("publication-invalidated") and evidence_ok
        if failed or not evidence_ok:
            result = rc or 1
        else:
            result = 0
        if observed is not None:
            result = 128 + observed

        if not final_owner:
            # A state-transparent callable sits below a final owner. It may
            # return dry-run success, but it must never expose authoritative
            # green evidence across its own handler restoration.
            if (manifest_lease is not None and published_manifest is not None
                    and published_manifest.get("status") == "passed"):
                poison("library-owner-ended")
                result = result or 1
            transfer_mask = sigmask(signal.SIG_BLOCK, owned)
            pending_transfer = _owned_pending(sigpending, prior_mask)
            if pending_transfer is not None:
                poison("publication-invalidated")
                result = 128 + pending_transfer
            restore_error = None
            for sig, handler in previous.items():
                try:
                    signal.signal(sig, handler)
                except BaseException as exc:
                    if restore_error is None:
                        restore_error = exc
            handlers_installed = False
            ownership_open = False
            try:
                sigmask(signal.SIG_SETMASK, transfer_mask)
            except BaseException as exc:
                if restore_error is None:
                    restore_error = exc
            if restore_error is not None:
                poison("handler-restoration-failed")
                raise restore_error
            if result == 0 and dry_run:
                print("integration driver: OK — dry-run contract verified; "
                      "no manifest was created")
    except BaseException as exc:
        poison("terminal-closure-failed")
        result = 1
        pending_error = exc
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

        if not final_owner:
            try:
                current = sigmask(signal.SIG_BLOCK, owned)
                pending_transfer = _owned_pending(sigpending, prior_mask)
                if pending_transfer is not None:
                    poison("publication-invalidated")
                    result = 128 + pending_transfer
                if handlers_installed:
                    for sig, handler in previous.items():
                        try:
                            signal.signal(sig, handler)
                        except BaseException as exc:
                            poison("handler-restoration-failed")
                            if pending_error is None:
                                pending_error = exc
                    handlers_installed = False
                ownership_open = False
                try:
                    sigmask(signal.SIG_SETMASK, prior_mask)
                except BaseException as exc:
                    poison("handler-restoration-failed")
                    if pending_error is None:
                        pending_error = exc
            except BaseException as exc:
                poison("handler-restoration-failed")
                if pending_error is None:
                    pending_error = exc

        if retained_tier is not None and not final_owner:
            retained_tier.close()
        if tier_authority is not None and not final_owner:
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
        if manifest_lease is not None and not final_owner:
            manifest_lease.close()

    if final_owner:
        # Close the last check-to-exit race. Signals arriving while this set is
        # blocked are still owned; the final unmask either records them here or
        # invokes `forward` with terminal_exit already true.
        try:
            exit_mask = sigmask(signal.SIG_BLOCK, owned)
            if (result == 0 and manifest_lease is not None
                    and tier_authority is not None
                    and published_manifest is not None):
                try:
                    p.verify_directory_authority(tier_authority)
                    ip.verify_final_publication(
                        tier_authority, manifest_lease, published_manifest)
                except (OSError, ValueError, p.ProvenanceError):
                    poison("terminal-publication-drift")
                    result = 1
            final_pending = _owned_pending(sigpending, prior_mask)
            if final_pending is not None and not received:
                received.append(final_pending)
            if received:
                if (published_manifest is not None
                        and published_manifest.get("status") == "passed"):
                    poison("publication-invalidated")
                result = 128 + received[0]
            terminal_exit = True
            sigmask(signal.SIG_SETMASK, exit_mask)
        except BaseException:
            poison("terminal-exit-failed")
            result = 1
            terminal_exit = True
        try:
            sys.stdout.flush(); sys.stderr.flush()
        finally:
            os._exit(result)
    if pending_error is not None:
        raise pending_error
    return result


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        return 2
    supervise(args[0], args[1:], final_owner=True)
    return 1


if __name__ == "__main__":
    main()
