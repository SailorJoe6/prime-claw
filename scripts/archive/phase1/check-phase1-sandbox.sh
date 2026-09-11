#!/usr/bin/env bash
# check-phase1-sandbox.sh — non-mutating readiness gate for the prime-claw
# Phase 1 sandbox. Exit 0 = ready. Prints one `key=value` line per check.
#
# Covers readiness for R-U1-1 (sandbox exists and is Ready) and R-U1-5
# prerequisites (committed policy is the live policy; canary binary present).
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"
SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
POLICY_FILE="${PRIME_CLAW_POLICY_FILE:-$REPO_ROOT/policies/phase1-sandbox.yaml}"

fail=0
note() { printf '%s=%s\n' "$1" "$2"; }

# 1. Sandbox exists and is Ready.
sandbox_json="$("$OPENSHELL_BIN" sandbox get "$SANDBOX_NAME" -o json 2>/dev/null)" || {
  note sandbox_exists no
  exit 1
}
note sandbox_exists yes
phase="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["phase"])' <<<"$sandbox_json")"
note sandbox_phase "$phase"
[[ "$phase" == "Ready" ]] || fail=1

# 2. Labels mark this as the dedicated prime-claw Phase 1 sandbox.
python3 -c 'import json,sys; l=json.loads(sys.argv[1]).get("labels",{}); assert l.get("project")=="prime-claw" and l.get("phase")=="1", l' "$sandbox_json" || fail=1
note labels ok

# 3. Live policy matches the committed baseline (egress + filesystem sections).
live_policy_file="$(mktemp)"
trap 'rm -f "$live_policy_file"' EXIT
"$OPENSHELL_BIN" sandbox get "$SANDBOX_NAME" --policy-only >"$live_policy_file" 2>/dev/null
python3 - "$POLICY_FILE" "$live_policy_file" <<'PY' || fail=1
import sys, yaml
committed = yaml.safe_load(open(sys.argv[1], encoding="utf-8"))
live = yaml.safe_load(open(sys.argv[2], encoding="utf-8"))
for key in ("filesystem_policy", "network_policies"):
    want = committed.get(key)
    got = live.get(key)
    assert got == want, f"{key}: live != committed\nwant={want!r}\ngot={got!r}"
PY
note policy_converged yes

# 4. Canary binary exists in-sandbox at the policy-declared path.
canary_path="$(python3 -c 'import yaml,sys; p=yaml.safe_load(open(sys.argv[1])); print(p["network_policies"]["egress_canary"]["binaries"][0]["path"])' "$POLICY_FILE")"
if "$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 30 --no-tty -- test -x "$canary_path" 2>/dev/null; then
  note canary_binary "$canary_path"
else
  note canary_binary "MISSING:$canary_path"
  fail=1
fi

exit "$fail"
