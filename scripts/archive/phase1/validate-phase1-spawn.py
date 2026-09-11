#!/usr/bin/env python3
"""validate-phase1-spawn.py — acceptance proof for Slice 5 (U3).

  R-U3-1 (GATE) a git project exists in-sandbox as a committed folder.
  R-U3-2 (GATE) a prime-agent session is spawned with CWD scoped to the project
      and reaped cleanly: (i) CLI one-shot `--cwd` reads a project sentinel via a
      tool (deterministic cwd proof); (ii) the daemon create RPC with
      config.cwd=<project> returns a session whose reported cwd is the project,
      and kill reaps it (no longer listed).
  R-U3-3 (NICE) agent-driven spawn = same daemon create/kill channel as rlm();
      the RLM race is documented per D6. Non-blocking.

Model access uses the Slice-3 bridge (ANTHROPIC_API_KEY=$api_key + models.json
baseUrl -> AI Gateway); no credential material on disk (R-X-5).
Writes docs/derisk/evidence/phase1-spawn-<utc>.json. Exit 0 = all GATE pass.
"""
import base64, json, os, subprocess, sys, time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SANDBOX_NAME = os.environ.get("PRIME_CLAW_SANDBOX_NAME", "prime-claw")
OPENSHELL_BIN = os.environ.get("OPENSHELL_BIN", "openshell")
SPAWN_PROJECT_DIR = os.environ.get("PRIME_CLAW_SPAWN_PROJECT_DIR", "/sandbox/episode-target")
MODEL = os.environ.get("PRIME_CLAW_MODEL", "anthropic.kimi-k3")
EVIDENCE_DIR = REPO_ROOT / "docs" / "derisk" / "evidence"

PRELUDE = ("export HOME=/sandbox PATH=/sandbox/.npm-global/bin:$PATH\n"
         + "export NODE_OPTIONS=\"--require /sandbox/.prime-claw/npm-onload.js\"\n"
         + "export ANTHROPIC_API_KEY=\"$api_key\"\n")
DAEMON_START = ("prime-agent status >/dev/null 2>&1 || (nohup prime-agent --mode daemon --offline "
                ">/sandbox/.prime-claw/daemon.log 2>&1 & sleep 6)\n")

RPC_JS = 'import { DaemonClient } from "/sandbox/.npm-global/lib/node_modules/prime-agent/dist/modes/daemon/daemon-client.js";\nconst sock = process.argv[2], proj = process.argv[3], model = process.argv[4], name = process.argv[5];\nconst client = new DaemonClient(sock);\nlet sid;\ntry {\n  await client.connect();\n  const created = await client.request({ type: "create", name, config: { cwd: proj, model, noSession: true } });\n  if (!created || created.success === false) { console.log("RPC_ERR=" + (created && created.error)); } else {\n    sid = (created.data && created.data.activeSessionId) || created.activeSessionId;\n    console.log("CREATED_ID=" + sid);\n    const st = await client.request({ type: "get_state", activeSessionId: sid });\n    const cwd = (st && st.data && st.data.cwd) || st.cwd;\n    console.log("CWD=" + cwd);\n    const kl = await client.request({ type: "kill", activeSessionId: sid });\n    console.log("KILL_OK=" + (kl && kl.success !== false));\n    const lst = await client.request({ type: "list" });\n    console.log("STILL_LISTED=" + JSON.stringify(lst).includes(sid));\n  }\n} catch (e) { console.log("RPC_ERR=" + ((e && e.message) || e)); }\nfinally { try { if (sid) await client.request({ type: "kill", activeSessionId: sid }); } catch (e2) {} if (client.close) client.close(); }\n'

def sx(script, timeout=120):
    b64 = base64.b64encode(script.encode()).decode()
    return subprocess.run([OPENSHELL_BIN, "sandbox", "exec", "-n", SANDBOX_NAME,
        "--timeout", str(timeout), "--no-tty", "--", "bash", "-lc",
        "echo " + b64 + " | base64 -d | bash -l"], capture_output=True, text=True, timeout=timeout + 30)

def kv(out, key):
    for line in out.splitlines():
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip()
    return None

def main():
    evidence = {"spike": "phase1-spawn", "sandbox": SANDBOX_NAME,
                "spawn_project_dir": SPAWN_PROJECT_DIR, "model": MODEL,
                "captured_at": datetime.now(timezone.utc).isoformat(),
                "requirements": ["R-U3-1", "R-U3-2", "R-U3-3"], "results": {}}
    failures = []
    gate = subprocess.run(["bash", str(REPO_ROOT / "scripts" / "check-phase1-spawn.sh")], capture_output=True, text=True)
    print(gate.stdout, end="")
    evidence["check_gate"] = {"exit": gate.returncode}
    if gate.returncode != 0:
        print("validate-phase1-spawn: FAIL (readiness gate not green)"); return 1

    r1 = sx("git -C " + SPAWN_PROJECT_DIR + " rev-parse --short HEAD", timeout=60)
    commit = r1.stdout.strip().splitlines()[-1] if r1.stdout.strip() else ""
    ok1 = r1.returncode == 0 and bool(commit)
    evidence["results"]["R-U3-1"] = {"pass": ok1, "commit": commit}
    print("[%s] R-U3-1 git project in-sandbox (commit %s)" % ("PASS" if ok1 else "FAIL", commit))
    if not ok1: failures.append("R-U3-1")

    sentinel = "CWDTOKEN857"
    cli = sx(PRELUDE
        + "printf '%s\\n' " + sentinel + " > " + SPAWN_PROJECT_DIR + "/.cwd_sentinel\n"
        + "rm -f /sandbox/.cwd_sentinel\n"
        + "timeout 120 prime-agent -p --model " + MODEL + " --cwd " + SPAWN_PROJECT_DIR + " "
        + "\"Use your file or shell tool to read the file named .cwd_sentinel (relative path) and reply with ONLY the token it contains.\" "
        + "2>&1 | grep -viE 'undici|trace-warn'\n", timeout=180)
    saw = sentinel in cli.stdout
    evidence["results"]["R-U3-2 cli_cwd"] = {"sentinel": sentinel, "token_seen": saw, "output_tail": cli.stdout.strip()[-200:], "pass": saw}
    print("[%s] R-U3-2 CLI session CWD-scoped (agent read project sentinel via tool: %s)" % ("PASS" if saw else "FAIL", saw))
    if not saw: failures.append("R-U3-2 cli")

    rpc_b64 = base64.b64encode(RPC_JS.encode()).decode()
    rpc_name = "u3-episode-" + datetime.now(timezone.utc).strftime("%H%M%S")
    sid = cwd = None; kill_ok = False; still = True; rpc = None
    for _attempt in range(4):
        rpc = sx(PRELUDE + DAEMON_START
            + "echo " + rpc_b64 + " | base64 -d > /tmp/spawn_rpc.mjs\n"
            + "for i in 1 2 3 4 5; do SOCK=$(ls /tmp/prime-agent-*/daemon.sock 2>/dev/null | head -1); [ -n \"$SOCK\" ] && break; sleep 2; done\n"
            + "node /tmp/spawn_rpc.mjs \"$SOCK\" " + SPAWN_PROJECT_DIR + " " + MODEL + " " + rpc_name + " 2>&1 | "
            + "grep -viE 'undici|trace-warn' | grep -E 'CREATED_ID|CWD=|KILL_OK|STILL_LISTED|RPC_ERR'\n", timeout=120)
        sid = kv(rpc.stdout, "CREATED_ID"); cwd = kv(rpc.stdout, "CWD")
        if sid and sid != "undefined": break
        time.sleep(3)
    kill_ok = kv(rpc.stdout, "KILL_OK") == "true"; still = kv(rpc.stdout, "STILL_LISTED") == "true"
    ok_daemon = bool(sid) and sid != "undefined" and cwd == SPAWN_PROJECT_DIR and kill_ok and not still
    evidence["results"]["R-U3-2 daemon"] = {"session_id": sid, "cwd": cwd, "kill_ok": kill_ok, "still_listed": still, "pass": ok_daemon, "err": kv(rpc.stdout, "RPC_ERR")}
    print("[%s] R-U3-2 daemon spawn/reap (id=%s cwd=%s kill_ok=%s reaped=%s)" % ("PASS" if ok_daemon else "FAIL", sid, cwd, kill_ok, not still))
    if not ok_daemon: failures.append("R-U3-2 daemon")

    evidence["results"]["R-U3-3"] = {"pass": True, "blocking": False, "observation": (
        "Agent-driven spawn uses the same daemon create/kill channel proven in R-U3-2(ii): the host rlm() "
        "publishes a child session via the daemon and reaps via kill. The RLM automatic-preparation admission race "
        "is documented in AGENTS.md Safe Spawn Protocol + openclaw-setup docs/prime-agent-rlm-preparation-race.md. "
        "Per D6 the two-message workaround is exercised only if the race manifests; this spike proves the "
        "spawn/reap channel; in-sandbox agent-driven (rlm) episode spawn is deferred to Phase 4 (episode loop).")}
    print("[NICE] R-U3-3 agent-driven spawn documented (non-blocking; see docs/derisk/U3.md)")

    evidence["verdict"] = "GO" if not failures else "NO-GO"
    evidence["failures"] = failures
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    out = EVIDENCE_DIR / ("phase1-spawn-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ") + ".json")
    out.write_text(json.dumps(evidence, indent=2) + "\n")
    print("evidence -> " + out.name)
    print("== U3 verdict: %s ==" % evidence["verdict"])
    return 0 if not failures else 1

if __name__ == "__main__":
    sys.exit(main())
