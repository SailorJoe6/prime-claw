#!/usr/bin/env bash
# check-phase1-spawn.sh — non-mutating readiness gate for Slice 5.
# Exit 0 = prime-agent installed + spawn-target git project present in-sandbox.
set -euo pipefail

SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
SPAWN_PROJECT_DIR="${PRIME_CLAW_SPAWN_PROJECT_DIR:-/sandbox/episode-target}"

fail=0
note() { printf '%s=%s\n' "$1" "$2"; }

out="$("$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 120 --no-tty -- bash -lc '
  export PATH=/sandbox/.npm-global/bin:$PATH
  echo "pa=$(command -v prime-agent >/dev/null 2>&1 && echo present || echo MISSING)"
  echo "gitproj=$([ -d "'"$SPAWN_PROJECT_DIR"'/.git" ] && echo present || echo MISSING)"
  echo "commit=$(git -C "'"$SPAWN_PROJECT_DIR"'" rev-parse --short HEAD 2>/dev/null || echo none)"
' 2>/dev/null)" || { note sandbox_exec failed; exit 1; }

while IFS= read -r line; do note "${line%%=*}" "${line#*=}"; done <<<"$out"

echo "$out" | grep -q "^pa=present$" || fail=1
echo "$out" | grep -q "^gitproj=present$" || fail=1
exit "$fail"
