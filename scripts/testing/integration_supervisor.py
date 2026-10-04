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

WATCHED = tuple(sig for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP) if sig is not None)


def _load_status(path: Path) -> tuple[Path, str] | None:
    try:
        row = json.loads(path.read_text())
    except (OSError, UnicodeError, json.JSONDecodeError):
        return None
    if not isinstance(row, dict) or not isinstance(row.get("tier_dir"), str) or not isinstance(row.get("binding"), str):
        return None
    tier = Path(row["tier_dir"])
    return (tier, row["binding"]) if tier.is_absolute() else None


def _close_evidence(status: tuple[Path, str] | None, failed: bool) -> bool:
    if status is None:
        return not failed
    tier, binding = status
    repo = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo))
    from scripts.testing import integration_provenance as ip
    from scripts.testing import provenance as p
    try:
        with p.open_owned_directory(tier, binding) as owned:
            manifest = p.read_sanitized_json(owned, "manifest.json")
            ip.validate_manifest(manifest)
            if failed and manifest["status"] == "passed":
                current = p.ObjectBinding.from_stat(os.stat(
                    "manifest.json", dir_fd=owned.fd, follow_symlinks=False))
                replacement = copy.deepcopy(manifest)
                replacement["status"] = "failed"
                replacement["run"]["status"] = "failed"
                replacement["run"]["failure_codes"] = ["publication-invalidated"]
                ip.publish_manifest(owned, replacement, expected_existing=current)
                manifest = p.read_sanitized_json(owned, "manifest.json")
            ip.validate_manifest(manifest)
            ip.verify_evidence(owned, manifest)
            return manifest["status"] == ("failed" if failed else "passed")
    except (OSError, FileNotFoundError, p.ProvenanceError):
        return False


def supervise(script: str, argv: list[str]) -> int:
    sigmask = getattr(signal, "pthread_sigmask", None)
    sigpending = getattr(signal, "sigpending", None)
    if sigmask is None or sigpending is None:
        print("error: atomic integration signal boundary is unavailable", file=sys.stderr)
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
    fd, raw = tempfile.mkstemp(prefix="prime-claw-integration-status.")
    os.fchmod(fd, 0o600); os.close(fd)
    status_path = Path(raw)
    env = dict(os.environ)
    env["PRIME_CLAW_INTEGRATION_INNER"] = "1"
    env["PRIME_CLAW_INTEGRATION_STATUS"] = str(status_path)
    rc = 1; terminal_mask = None
    try:
        restore = (
            "import os,signal,sys; signal.pthread_sigmask(signal.SIG_SETMASK, "
            "{signal.Signals(int(x)) for x in sys.argv[1].split(',') if x}); "
            "os.execv(sys.argv[2], sys.argv[2:])")
        encoded = ",".join(str(int(sig)) for sig in sorted(prior_mask or (), key=int))
        process = subprocess.Popen(
            [sys.executable, "-c", restore, encoded, script, *argv],
            env=env, start_new_session=True)
        sigmask(signal.SIG_SETMASK, prior_mask)
        rc = process.wait()
        terminal_mask = sigmask(signal.SIG_BLOCK, WATCHED)
        observed = received[0] if received else None
        status = _load_status(status_path)
        failed = observed is not None or rc != 0
        evidence_ok = _close_evidence(status, failed)
        caller_blocked = set(prior_mask or ())
        closure_signal = next((int(sig) for sig in WATCHED if sig not in caller_blocked and sig in sigpending()), None)
        if observed is None and closure_signal is not None:
            observed = closure_signal
            if not failed:
                evidence_ok = _close_evidence(status, True) and evidence_ok
                failed = True
        if not evidence_ok:
            rc = rc or 1
        for sig, handler in previous.items():
            signal.signal(sig, handler)
        if observed is not None:
            rc = 128 + observed
        sigmask(signal.SIG_SETMASK, terminal_mask); terminal_mask = None
        if rc == 0 and evidence_ok:
            print("integration driver: OK — exact image, offline assertions, teardown, and manifest verified")
        return rc
    finally:
        if process is not None and process.poll() is None:
            try: os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError: pass
            try: process.wait(timeout=1)
            except subprocess.TimeoutExpired:
                try: os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError: pass
                process.wait()
        if terminal_mask is not None:
            for sig, handler in previous.items(): signal.signal(sig, handler)
            sigmask(signal.SIG_SETMASK, terminal_mask)
        status_path.unlink(missing_ok=True)


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    return supervise(args[0], args[1:]) if args else 2


if __name__ == "__main__":
    raise SystemExit(main())
