#!/usr/bin/env python3
"""In-container runner for the concurrent-apply serialization scenario.

Ports tests/test_prime_agent_plugin_install.py::
test_concurrent_apply_serializes_before_read_and_preserves_sentinel
to run entirely inside the tier-1 container: the scenario holds an
fcntl.flock on the manager's lock file while four manager processes race,
which must share one kernel's lock state — all processes therefore run
here, against container-local paths (no virtiofs lock semantics involved).

Scenario (identical to the original test): hold the exclusive lock, spawn
four concurrent applies, mutate the destination while contenders wait,
release; every contender must succeed, the installed content must start
with the mutated sentinel, exactly one identity block lands, and check
passes afterwards.

usage: concurrent_apply_probe.py <manager.py> <source APPEND_SYSTEM.md> <workdir>
Prints a JSON verdict on success; exits 1 with a message on any failure.
"""

import fcntl
import json
from pathlib import Path
import subprocess
import sys


def fail(message):
    print("concurrent-apply probe FAILED: " + message, file=sys.stderr)
    sys.exit(1)


def main() -> int:
    if len(sys.argv) != 4:
        fail("usage: concurrent_apply_probe.py <manager.py> <source.md> <workdir>")
    manager = sys.argv[1]
    source = sys.argv[2]
    root = Path(sys.argv[3])
    root.mkdir(parents=True, exist_ok=True)
    destination = root / "APPEND_SYSTEM.md"
    destination.write_bytes(b"initial\n")
    lock_path = root / ".prime-claw-append-system.lock"

    with lock_path.open("a+b") as lock:
        fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
        processes = [
            subprocess.Popen(
                [sys.executable, manager, "apply", source, str(destination)],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            for _ in range(4)
        ]
        sentinel = b"initial\nadded-while-contenders-wait\n"
        destination.write_bytes(sentinel)
        fcntl.flock(lock.fileno(), fcntl.LOCK_UN)

    results = [process.communicate(timeout=30) + (process.returncode,) for process in processes]
    if not all(returncode == 0 for _, _, returncode in results):
        fail(f"not all contenders succeeded: {results}")
    installed = destination.read_bytes()
    if not installed.startswith(sentinel):
        fail("installed content does not start with the sentinel")
    blocks = installed.count(b"PRIME_CLAW_CONVERSATION_IDENTITY_V1")
    if blocks != 1:
        fail(f"destination has {blocks} identity blocks, expected 1")
    checked = subprocess.run(
        [sys.executable, manager, "check", source, str(destination)],
        capture_output=True,
    )
    if checked.returncode != 0:
        fail("check failed after concurrent apply: " + checked.stderr.decode(errors="replace"))

    print(json.dumps({"ok": True, "contenders": len(processes)}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
