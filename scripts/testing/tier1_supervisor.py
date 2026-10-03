#!/usr/bin/env python3
"""Own public tier-1 launcher signals through terminal evidence closure."""
from __future__ import annotations

import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile

WATCHED = tuple(sig for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
                if sig is not None)


def _load_owned_status(path: Path) -> tuple[Path, str] | None:
    try:
        raw = path.read_text(encoding="utf-8")
        row = json.loads(raw)
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    tier = row.get("tier_dir") if isinstance(row, dict) else None
    binding = row.get("binding") if isinstance(row, dict) else None
    if not isinstance(tier, str) or not isinstance(binding, str):
        return None
    candidate = Path(tier)
    if not candidate.is_absolute() or not binding:
        return None
    return candidate, binding


def _close_evidence(status: tuple[Path, str] | None, failed: bool) -> bool:
    if status is None:
        return not failed
    tier, binding = status
    repo = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo))
    from scripts.testing import provenance
    try:
        try:
            with provenance.open_owned_directory(tier, binding) as owned:
                if failed:
                    provenance.invalidate_green_manifest(owned, expected=None)
                manifest = provenance.read_sanitized_json(
                    owned, "manifest.json")
                provenance.validate_manifest(manifest)
                provenance.verify_evidence(owned, manifest)
        except FileNotFoundError:
            return failed
        except provenance.ProvenanceError:
            return False
        return manifest.get("run", {}).get("status") == ("failed" if failed else "passed")
    except BaseException:
        return False


def supervise(script: str, argv: list[str]) -> int:
    sigmask = getattr(signal, "pthread_sigmask", None)
    sigpending = getattr(signal, "sigpending", None)
    if sigmask is None or sigpending is None:
        print("error: atomic tier-1 signal boundary is unavailable", file=sys.stderr)
        return 1
    previous = {sig: signal.getsignal(sig) for sig in WATCHED}
    prior_mask = sigmask(signal.SIG_BLOCK, WATCHED)
    received: list[int] = []
    process: subprocess.Popen[bytes] | None = None

    def forward(signum, _frame):
        if not received:
            received.append(signum)
        if process is not None and process.poll() is None:
            try:
                os.killpg(process.pid, signum)
            except ProcessLookupError:
                pass

    for sig in WATCHED:
        signal.signal(sig, forward)
    fd, raw_status = tempfile.mkstemp(prefix="prime-claw-tier1-status.")
    os.fchmod(fd, 0o600)
    os.close(fd)
    status_path = Path(raw_status)
    env = dict(os.environ)
    env["PRIME_CLAW_TIER1_INNER"] = "1"
    env["PRIME_CLAW_TIER1_STATUS"] = str(status_path)
    rc = 1
    terminal_mask = None
    try:
        restore_code = (
            "import os,signal,sys; "
            "signal.pthread_sigmask(signal.SIG_SETMASK, "
            "{signal.Signals(int(x)) for x in sys.argv[1].split(',') if x}); "
            "os.execv(sys.argv[2], sys.argv[2:])")
        encoded_mask = ",".join(str(int(sig)) for sig in sorted(
            prior_mask or (), key=int))
        process = subprocess.Popen(
            [sys.executable, "-c", restore_code, encoded_mask,
             script, *argv], env=env, start_new_session=True)
        sigmask(signal.SIG_SETMASK, prior_mask)
        rc = process.wait()
        terminal_mask = sigmask(signal.SIG_BLOCK, WATCHED)
        producer_signal = received[0] if received else None
        status = _load_owned_status(status_path)
        failed = producer_signal is not None or rc != 0
        evidence_ok = _close_evidence(status, failed)

        # Watched signals remain blocked through evidence closure. A signal
        # accepted there is pending rather than delivered to ``forward``; fold
        # it into terminal truth and close evidence again as failed before the
        # handler/mask boundary. Signals accepted after this snapshot belong to
        # the restored caller.
        caller_blocked = set(prior_mask or ())
        closure_signal = next(
            (int(sig) for sig in WATCHED
             if sig not in caller_blocked and sig in sigpending()), None)
        if producer_signal is None and closure_signal is not None:
            producer_signal = closure_signal
            if not failed:
                evidence_ok = _close_evidence(status, True) and evidence_ok
                failed = True
        if not evidence_ok:
            rc = rc or 1
        for sig, handler in previous.items():
            signal.signal(sig, handler)
        if producer_signal is not None:
            rc = 128 + producer_signal
        sigmask(signal.SIG_SETMASK, terminal_mask)
        terminal_mask = None
        if rc == 0 and status is not None and evidence_ok:
            print("tier-1 driver: OK — immutable image launched, network absent, "
                  "checks passed, teardown verified, manifest published")
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
        if terminal_mask is not None:
            for sig, handler in previous.items():
                signal.signal(sig, handler)
            sigmask(signal.SIG_SETMASK, terminal_mask)
        try:
            status_path.unlink()
        except FileNotFoundError:
            pass


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    if not args:
        return 2
    return supervise(args[0], args[1:])


if __name__ == "__main__":
    raise SystemExit(main())
