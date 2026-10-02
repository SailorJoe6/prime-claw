#!/usr/bin/env python3
"""In-container runner for the SIGTERM-orphan reconciliation scenario.

Ports tests/test_prime_agent_plugin_install.py::
test_sigterm_orphan_is_reconciled_on_retry_without_deleting_live_writer_temp
to run entirely inside the tier-1 container: the scenario needs
os.pipe + pass_fds + signal.pause choreography against a helper subprocess,
which cannot cross a docker exec boundary. Everything (including the
assertions) happens here against container-local paths; the host-side
pytest test asserts on this script's exit code and JSON verdict.

Scenario (identical to the original test):
  1. destination starts with sentinel bytes;
  2. a helper process runs the append-system manager with os.replace
     monkeypatched to signal readiness over the inherited pipe and then
     pause — it is SIGTERMed mid-transaction, leaving exactly one orphan
     temp file and the destination untouched;
  3. decoys are created: a live-writer temp owned by THIS (live) process
     and a near-match name that is not an exact transaction pattern;
  4. a retry apply reconciles the orphan, preserves both decoys, and
     installs exactly one identity block.

usage: sigterm_orphan_probe.py <manager.py> <source APPEND_SYSTEM.md> <workdir>
Prints a JSON verdict on success; exits 1 with a message on any failure.
"""

import importlib.util
import json
import os
from pathlib import Path
import select
import signal
import subprocess
import sys
import textwrap


def fail(message):
    print("sigterm-orphan probe FAILED: " + message, file=sys.stderr)
    sys.exit(1)


def main() -> int:
    if len(sys.argv) != 4:
        fail("usage: sigterm_orphan_probe.py <manager.py> <source.md> <workdir>")
    manager = sys.argv[1]
    source = sys.argv[2]
    root = Path(sys.argv[3])
    root.mkdir(parents=True, exist_ok=True)
    destination = root / "APPEND_SYSTEM.md"
    destination.write_bytes(b"sentinel before interrupted apply\n")

    read_fd, write_fd = os.pipe()
    helper = textwrap.dedent(
        f"""        import importlib.util
        import os
        import signal
        import sys

        spec = importlib.util.spec_from_file_location("append_manager", {manager!r})
        manager = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(manager)
        ready_fd = {write_fd}

        def stop_before_replace(*args, **kwargs):
            os.write(ready_fd, b"1")
            signal.pause()

        manager.os.replace = stop_before_replace
        sys.argv = [
            str(manager.__file__),
            "apply",
            {source!r},
            {str(destination)!r},
        ]
        raise SystemExit(manager.main())
        """
    )
    process = subprocess.Popen(
        [sys.executable, "-c", helper],
        pass_fds=(write_fd,),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    os.close(write_fd)
    try:
        ready, _, _ = select.select([read_fd], [], [], 10)
        if not ready:
            process.kill()
            fail("helper did not signal readiness within 10s")
        if os.read(read_fd, 1) != b"1":
            fail("helper readiness byte mismatch")
    finally:
        os.close(read_fd)

    orphan_pattern = f".APPEND_SYSTEM.md.prime-claw-{process.pid}-*.tmp"
    orphans = list(root.glob(orphan_pattern))
    if len(orphans) != 1:
        process.kill()
        fail(f"expected exactly 1 orphan temp, found {len(orphans)}")
    live_temp = root / f".APPEND_SYSTEM.md.prime-claw-{os.getpid()}-0123456789abcdef.tmp"
    live_temp.write_bytes(b"owned by live test process")
    near_match = root / ".APPEND_SYSTEM.md.prime-claw-999999-not-hex.tmp"
    near_match.write_bytes(b"not an exact transaction pattern")

    process.send_signal(signal.SIGTERM)
    stdout, stderr = process.communicate(timeout=10)
    if process.returncode != -signal.SIGTERM:
        fail(f"helper returncode {process.returncode}, expected -SIGTERM: {stdout} {stderr}")
    if destination.read_bytes() != b"sentinel before interrupted apply\n":
        fail("destination mutated by interrupted apply")

    retried = subprocess.run(
        [sys.executable, manager, "apply", source, str(destination)],
        capture_output=True,
    )
    if retried.returncode != 0:
        fail("retry apply failed: " + retried.stderr.decode(errors="replace"))
    if orphans[0].exists():
        fail("orphan temp not reconciled on retry")
    if not live_temp.exists():
        fail("live-writer decoy deleted by retry")
    if not near_match.exists():
        fail("near-match decoy deleted by retry")
    blocks = destination.read_bytes().count(b"PRIME_CLAW_CONVERSATION_IDENTITY_V1")
    if blocks != 1:
        fail(f"destination has {blocks} identity blocks, expected 1")

    print(json.dumps({"ok": True, "orphan_reconciled": True,
                      "decoys_preserved": True}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
