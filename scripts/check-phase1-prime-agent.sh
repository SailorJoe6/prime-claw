#!/usr/bin/env bash
# check-phase1-prime-agent.sh — non-mutating readiness gate for Slice 2.
# Exit 0 = prime-agent installed, on PATH, correct version, kernel python present.
set -euo pipefail

SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
PRIME_AGENT_VERSION="${PRIME_AGENT_VERSION:-0.9.3}"

fail=0
note() { printf '%s=%s\n' "$1" "$2"; }

out="$("$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 120 --no-tty -- bash -lc '
  export PATH=/sandbox/.npm-global/bin:$PATH
  echo "pa_path=$(command -v prime-agent || echo MISSING)"
  echo "pa_version=$(prime-agent --version 2>&1 | grep -E '^[0-9]+\\.[0-9]+\\.[0-9]+' | head -1 || true)"
  echo "kernel_python=$([ -x /sandbox/.prime/agent/kernel-venv/bin/python ] && echo present || echo MISSING)"
  echo "onload=$([ -f /sandbox/.prime-claw/npm-onload.js ] && echo present || echo MISSING)"
' 2>/dev/null)" || { note sandbox_exec failed; exit 1; }

while IFS= read -r line; do note "${line%%=*}" "${line#*=}"; done <<<"$out"

echo "$out" | grep -q "^pa_version=$PRIME_AGENT_VERSION$" || fail=1
echo "$out" | grep -q "^kernel_python=present$" || fail=1
echo "$out" | grep -q "^onload=present$" || fail=1
exit "$fail"
