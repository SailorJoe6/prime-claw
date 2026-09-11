#!/usr/bin/env python3
"""validate-phase1-prime-agent.py — acceptance proof for Slice 2.

Proves:
  R-U1-3  the prime-agent daemon installs and runs healthily in-sandbox
          (starts, reports status, persists across separate exec calls)
  R-U1-4  a session's persistent Python REPL holds state across turns
          (drive ReplKernelManager directly: set a var in one execute,
          read it in a second — the same proof the daemon relies on)

Writes docs/derisk/evidence/phase1-prime-agent-<utc>.json. Exit 0 = proven.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SANDBOX_NAME = os.environ.get("PRIME_CLAW_SANDBOX_NAME", "prime-claw")
OPENSHELL_BIN = os.environ.get("OPENSHELL_BIN", "openshell")
EVIDENCE_DIR = REPO_ROOT / "docs" / "derisk" / "evidence"
PKG = "/sandbox/.npm-global/lib/node_modules/prime-agent"

# Node snippet driving the real persistent-REPL manager across two turns.
# Staged to a file in-sandbox (base64) so newlines/quoting survive the
# exec boundary; `node -e` mangles multi-line module source.
REPL_PROOF_JS = (
    'import { ReplKernelManager } from "' + PKG + '/dist/core/kernel/repl-manager.js";\n'
    'const k = new ReplKernelManager({ sessionId: "phase1-repl-proof", cwd: "/sandbox" });\n'
    "await k.start();\n"
    'await k.execute("pc_marker = 40 + 1");\n'
    'const r2 = await k.execute("pc_marker + 1");\n'
    'console.log("REPL_STATE_VALUE=" + (r2.result ?? "").trim());\n'
    "await k.shutdown?.();\n"
)

# Shell snippet: start the daemon if needed, report its socket.
DAEMON_PROOF_SH = (
    "export PATH=/sandbox/.npm-global/bin:$PATH\n"
    'export NODE_OPTIONS="--require /sandbox/.prime-claw/npm-onload.js"\n'
    'if ! prime-agent status 2>/dev/null | grep -q "daemon.sock"; then\n'
    "  nohup prime-agent --mode daemon --offline >/sandbox/.prime-claw/daemon.log 2>&1 &\n"
    "  sleep 6\n"
    "fi\n"
    'echo "DAEMON_SOCK=$(ls /tmp/prime-agent-*/daemon.sock 2>/dev/null | head -1)"\n'
)


def sandbox_exec(script: str, timeout: int = 300) -> subprocess.CompletedProcess:
    return subprocess.run(
        [OPENSHELL_BIN, "sandbox", "exec", "-n", SANDBOX_NAME,
         "--timeout", str(timeout), "--no-tty", "--", "bash", "-lc", script],
        capture_output=True, text=True, timeout=timeout + 30,
    )


def main() -> int:
    evidence: dict = {
        "spike": "phase1-prime-agent",
        "sandbox": SANDBOX_NAME,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "requirements": ["R-U1-3", "R-U1-4"],
    }
    failures: list[str] = []

    # 0. Readiness gate.
    gate = subprocess.run(["bash", str(REPO_ROOT / "scripts" / "check-phase1-prime-agent.sh")],
                          capture_output=True, text=True)
    evidence["check_gate"] = {"exit": gate.returncode, "output": gate.stdout.strip()}
    print(gate.stdout, end="")
    if gate.returncode != 0:
        print("validate-phase1-prime-agent: FAIL (readiness gate not green)")
        return 1

    # 1. R-U1-3: daemon health + cross-exec persistence.
    d1 = sandbox_exec(DAEMON_PROOF_SH, timeout=120)
    sock = re.search(r"DAEMON_SOCK=(\S+)", d1.stdout)
    evidence["daemon_first_probe"] = {"exit": d1.returncode, "socket": sock.group(1) if sock else None}
    print(f"daemon_socket={sock.group(1) if sock else 'MISSING'}")
    if not sock:
        failures.append("daemon socket not found after start")

    # Second, separate exec call: the daemon must still be alive (persistence).
    d2 = sandbox_exec(
        "export PATH=/sandbox/.npm-global/bin:$PATH; "
        "prime-agent status 2>/dev/null | grep -q daemon.sock && echo DAEMON_ALIVE=yes || echo DAEMON_ALIVE=no",
        timeout=60,
    )
    alive = "DAEMON_ALIVE=yes" in d2.stdout
    evidence["daemon_second_probe_alive"] = alive
    print(f"daemon_persists_across_exec={alive}")
    if not alive:
        failures.append("daemon did not persist across separate exec calls")

    # 2. R-U1-4: persistent REPL holds state across two turns.
    import base64
    b64 = base64.b64encode(REPL_PROOF_JS.encode()).decode()
    repl = sandbox_exec(
        'export NODE_OPTIONS="--require /sandbox/.prime-claw/npm-onload.js"; '
        f"echo {b64} | base64 -d > /tmp/repl-proof.mjs; node /tmp/repl-proof.mjs",
        timeout=300,
    )
    m = re.search(r"REPL_STATE_VALUE=(\S+)", repl.stdout)
    val = m.group(1) if m else None
    evidence["repl_state_proof"] = {
        "exit": repl.returncode,
        "set_expression": "pc_marker = 40 + 1",
        "read_expression": "pc_marker + 1",
        "read_result": val,
    }
    print(f"repl_state_across_turns={val}")
    if val != "42":
        failures.append(f"persistent REPL did not hold state (got {val!r}, want '42')")

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    artifact = EVIDENCE_DIR / f"phase1-prime-agent-{stamp}.json"
    evidence["result"] = "PASS" if not failures else "FAIL"
    evidence["failures"] = failures
    artifact.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(f"evidence={artifact.relative_to(REPO_ROOT)}")

    if failures:
        print("validate-phase1-prime-agent: FAIL")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("validate-phase1-prime-agent: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
