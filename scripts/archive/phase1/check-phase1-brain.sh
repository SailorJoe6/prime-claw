#!/usr/bin/env bash
# check-phase1-brain.sh -- readiness gate for the in-sandbox brain stack.
# Read-only. Exit 0 when Postgres 16 is up (owned by the sandbox user) with
# pgvector enabled, the gbrain CLI is present, and the brain repo folder is
# present; non-zero otherwise.
set -euo pipefail

OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"
SB_BRAIN_DIR="${PRIME_CLAW_SB_BRAIN_DIR:-/sandbox/brain}"
PGDATA="${PRIME_CLAW_PGDATA:-/sandbox/pgdata}"
PGPORT="${PRIME_CLAW_PGPORT:-5433}"
PGU="${POSTGRES_USER:-gbrain}"; PGD="${POSTGRES_DB:-gbrain}"

command -v "$OPENSHELL_BIN" >/dev/null 2>&1 || { printf 'error: openshell CLI not found\n' >&2; exit 1; }

b64="$(printf '%s' "
export HOME=/sandbox PATH=/usr/lib/postgresql/16/bin:\$PATH
fail=0
echo '-- gbrain CLI --'
command -v gbrain >/dev/null && gbrain --version 2>&1 | head -1 || { echo 'gbrain MISSING'; fail=1; }
echo '-- postgres (owned by \$(whoami)) --'
if pg_ctl -D $PGDATA status >/dev/null 2>&1; then
  psql -h localhost -p $PGPORT -U $PGU -d postgres -tc 'select version();' | head -1
else
  echo 'postgres NOT running'; fail=1
fi
echo '-- pgvector --'
psql -h localhost -p $PGPORT -U $PGU -d $PGD -tc \"SELECT 'vector '||extversion FROM pg_extension WHERE extname='vector';\" 2>/dev/null | grep -q vector \
  && echo 'pgvector enabled' || { echo 'pgvector NOT enabled'; fail=1; }
echo '-- brain repo folder --'
[[ -d $SB_BRAIN_DIR ]] && echo \"brain folder present: $SB_BRAIN_DIR (\$(ls -1 $SB_BRAIN_DIR | wc -l) entries)\" \
  || { echo \"brain folder MISSING: $SB_BRAIN_DIR\"; fail=1; }
exit \$fail
" | base64)"

"$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 60 --no-tty -- \
  bash -c "echo $b64 | base64 -d | bash"
