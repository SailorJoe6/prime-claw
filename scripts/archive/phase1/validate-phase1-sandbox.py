#!/usr/bin/env python3
"""validate-phase1-sandbox.py — acceptance proof for the prime-claw Phase 1
OpenShell sandbox.

Proves:
  R-U1-1  a fresh, dedicated OpenShell sandbox exists for prime-agent
          (built directly on OpenShell; no NemoClaw recipe involved)
  R-U1-2  the toolchain versions are captured as evidence
  R-U1-5  deny-by-default egress: a policy-allowed destination succeeds AND
          undeclared destinations are refused by the in-sandbox proxy

Writes an evidence artifact to docs/derisk/evidence/phase1-sandbox-<utc>.json
and prints `key=value` summary lines. Exit 0 = acceptance proven.
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

# Probe contract. The allowed host is the policy canary; the denied hosts are
# deliberately meaningful (a model API and a package index) so the proof shows
# real dependencies are refused until explicitly declared.
ALLOWED_URL = "https://example.com/"
DENIED_URLS = ["https://api.anthropic.com/", "https://pypi.org/"]
CURL = "/usr/bin/curl"  # must match policies/phase1-sandbox.yaml egress_canary binary


def run(cmd: list[str], timeout: int = 120) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)


def sandbox_exec(script: str, timeout: int = 120) -> subprocess.CompletedProcess:
    return run(
        [OPENSHELL_BIN, "sandbox", "exec", "-n", SANDBOX_NAME,
         "--timeout", str(timeout), "--no-tty", "--", "bash", "-lc", script],
        timeout=timeout + 30,
    )


def curl_probe(url: str) -> dict:
    """One egress probe. Returns exit code, HTTP code, and stderr tail."""
    marker = "PC_HTTP_CODE"
    cp = sandbox_exec(
        f"{CURL} -sS -o /dev/null -w '{marker}=%{{http_code}}' --max-time 20 {url}; "
        f"echo PC_CURL_EXIT=$?"
    )
    out, err = cp.stdout, cp.stderr
    http = re.search(rf"{marker}=(\d+)", out)
    curl_exit = re.search(r"PC_CURL_EXIT=(\d+)", out)
    return {
        "url": url,
        "curl_exit": int(curl_exit.group(1)) if curl_exit else None,
        "http_code": http.group(1) if http else None,
        "stderr_tail": err.strip().splitlines()[-1] if err.strip() else "",
    }


def main() -> int:
    evidence: dict = {
        "spike": "phase1-sandbox",
        "sandbox": SANDBOX_NAME,
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "requirements": ["R-U1-1", "R-U1-2", "R-U1-5"],
    }
    failures: list[str] = []

    # 0. Readiness gate must pass first.
    gate = run(["bash", str(REPO_ROOT / "scripts" / "check-phase1-sandbox.sh")])
    evidence["check_gate"] = {"exit": gate.returncode, "output": gate.stdout.strip()}
    if gate.returncode != 0:
        print(gate.stdout, end="")
        print("validate-phase1-sandbox: FAIL (readiness gate not green)")
        return 1
    print(gate.stdout, end="")

    # 1. R-U1-2: toolchain versions as evidence.
    cli = run([OPENSHELL_BIN, "--version"])
    status = run([OPENSHELL_BIN, "status"])
    ansi = re.compile(r"\x1b\[[0-9;]*m")
    clean_status = ansi.sub("", status.stdout)
    gw_version = None
    m = re.search(r"Version:\s*(\S+)", clean_status)
    if m:
        gw_version = m.group(1)
    info = run([OPENSHELL_BIN, "sandbox", "get", SANDBOX_NAME, "-o", "json"])
    sandbox_meta = json.loads(info.stdout)
    evidence["versions"] = {
        "openshell_cli": cli.stdout.strip(),
        "openshell_gateway": gw_version,
        "sandbox_id": sandbox_meta["id"],
        "sandbox_created_at": sandbox_meta["created_at"],
        "sandbox_image": "ghcr.io/nvidia/openshell-community/sandboxes/base:latest",
        "policy_version": sandbox_meta.get("current_policy_version"),
    }
    print(f"openshell_cli={evidence['versions']['openshell_cli']}")
    print(f"openshell_gateway={gw_version}")
    if not gw_version:
        failures.append("gateway version not captured")

    # 2. R-U1-5: allowed egress succeeds.
    allowed = curl_probe(ALLOWED_URL)
    evidence["egress_allowed"] = allowed
    print(f"egress_allowed={allowed['url']} http={allowed['http_code']} curl_exit={allowed['curl_exit']}")
    if allowed["curl_exit"] != 0 or allowed["http_code"] != "200":
        failures.append(f"allowed egress failed: {allowed}")

    # 3. R-U1-5: undeclared egress is refused by the proxy (fail-closed).
    denied_results = []
    for url in DENIED_URLS:
        probe = curl_probe(url)
        denied_results.append(probe)
        print(f"egress_denied={probe['url']} http={probe['http_code']} "
              f"curl_exit={probe['curl_exit']} detail={probe['stderr_tail']!r}")
        refused = (
            probe["curl_exit"] not in (0, None)
            and probe["http_code"] == "000"
            and "403" in probe["stderr_tail"]
        )
        if not refused:
            failures.append(f"denied egress NOT refused as expected: {probe}")
    evidence["egress_denied"] = denied_results

    # Write the evidence artifact (committed; re-runs produce new files).
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    artifact = EVIDENCE_DIR / f"phase1-sandbox-{stamp}.json"
    evidence["result"] = "PASS" if not failures else "FAIL"
    evidence["failures"] = failures
    artifact.write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
    print(f"evidence={artifact.relative_to(REPO_ROOT)}")

    if failures:
        print("validate-phase1-sandbox: FAIL")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("validate-phase1-sandbox: PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())
