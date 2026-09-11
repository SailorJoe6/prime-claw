#!/usr/bin/env bash
# apply-phase1-brain.sh — build the prime-claw brain-stack sandbox image and
# stand the brain stack up inside the sandbox. Mutating. Idempotent.
#
# Approach (D15): the brain stack is baked into a custom OpenShell sandbox
# IMAGE at docker-build time (as root), not installed into the running
# container. The sandbox runs as the unprivileged `sandbox` user, which OWNS
# its Postgres: PGDATA lives in /sandbox (read-write), and the agent runs
# initdb / pg_ctl / psql itself with no root or sudo.
#
# Proves: R-U2-2 (brain repo folder in-sandbox via --upload), R-U2-3 (Postgres
#         16 + pgvector running in-sandbox, owned by the agent), and is the
#         prerequisite for R-U2-1 (gbrain CLI) and R-U2-4 (gbrain serves from
#         in-sandbox PG).
#
# Steps:
#   1. Stage the gbrain build context from the operator's local zbrain checkout
#      into docker/phase1-brain/gbrain/ (gbrain is not published; it is built
#      from source with Bun).
#   2. docker build the image (tag prime-claw-brain:<version>).
#   3. Recreate the OpenShell sandbox --from that image.
#   4. --upload the operator's brain repo folder to /sandbox/brain.
#   5. initdb (if needed) + start Postgres 16 as the sandbox user.
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"
POLICY_FILE="${PRIME_CLAW_POLICY_FILE:-$REPO_ROOT/policies/phase1-sandbox.yaml}"
ZBRAIN_SRC="${PRIME_CLAW_ZBRAIN_SRC:-$HOME/zbrain}"
HOST_BRAIN_DIR="${PRIME_CLAW_HOST_BRAIN_DIR:-$HOME/gitlab_local/brain}"
IMAGE_TAG="${PRIME_CLAW_BRAIN_IMAGE:-prime-claw-brain:0.1.0}"
PGDATA="${PRIME_CLAW_PGDATA:-/sandbox/pgdata}"
PGPORT="${PRIME_CLAW_PGPORT:-5433}"
SB_BRAIN_DIR="${PRIME_CLAW_SB_BRAIN_DIR:-/sandbox/brain}"

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi
[[ $# -eq 0 ]] || { printf 'Usage: scripts/apply-phase1-brain.sh [--dry-run]\n' >&2; exit 2; }
command -v "$OPENSHELL_BIN" >/dev/null 2>&1 || { printf 'error: openshell CLI not found\n' >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { printf 'error: docker not found\n' >&2; exit 1; }

if ((DRY_RUN)); then
  printf 'dry_run: stage gbrain build context from %s\n' "$ZBRAIN_SRC"
  printf 'dry_run: docker build -f docker/phase1-brain.Dockerfile -t %s docker\n' "$IMAGE_TAG"
  printf 'dry_run: recreate sandbox %s --from %s (preserve policy %s)\n' "$SANDBOX_NAME" "$IMAGE_TAG" "$POLICY_FILE"
  printf 'dry_run: upload brain repo %s -> %s\n' "$HOST_BRAIN_DIR" "$SB_BRAIN_DIR"
  printf 'dry_run: initdb + pg_ctl start Postgres 16 as user sandbox (PGDATA=%s port=%s)\n' "$PGDATA" "$PGPORT"
  printf 'host_credential_access: prohibited\n'
  exit 0
fi

printf '[1/5] staging gbrain build context from %s ...\n' "$ZBRAIN_SRC"
[[ -f "$ZBRAIN_SRC/package.json" && -d "$ZBRAIN_SRC/src" ]] \
  || { printf 'error: zbrain checkout not found at %s (set PRIME_CLAW_ZBRAIN_SRC)\n' "$ZBRAIN_SRC" >&2; exit 1; }
ctx="$REPO_ROOT/docker/phase1-brain/gbrain"
rm -rf "$ctx"; mkdir -p "$ctx"
cp "$ZBRAIN_SRC"/{package.json,bun.lock,tsconfig.json} "$ctx/"
cp -R "$ZBRAIN_SRC/src" "$ctx/src"
[[ -d "$ZBRAIN_SRC/admin/dist" ]] && cp -R "$ZBRAIN_SRC/admin" "$ctx/admin" || mkdir -p "$ctx/admin/dist"
[[ -d "$ZBRAIN_SRC/skills" ]] && cp -R "$ZBRAIN_SRC/skills" "$ctx/skills" || mkdir -p "$ctx/skills"
# gbrain's src embeds templates/bootstrap/* at compile time, but the zbrain fork
# deleted templates/ (commit a68893077) while src/core/bootstrap/assets.ts still
# imports it (an upstream break -- see docs/derisk/U2.md). Restore the pinned
# templates from git history into the build context so the binary compiles.
if [[ -d "$ZBRAIN_SRC/templates" ]]; then
  cp -R "$ZBRAIN_SRC/templates" "$ctx/templates"
else
  git -C "$ZBRAIN_SRC" archive d337920c1 templates | tar -x -C "$ctx"
fi

printf '[2/5] building image %s ...\n' "$IMAGE_TAG"
docker build -f "$REPO_ROOT/docker/phase1-brain.Dockerfile" -t "$IMAGE_TAG" "$REPO_ROOT/docker"

printf '[3/5] recreating sandbox %s from %s ...\n' "$SANDBOX_NAME" "$IMAGE_TAG"
# Delete + recreate so the sandbox runs the new image. The gateway preserves the
# sandbox record/policy; we re-assert the policy below. (Do NOT docker restart —
# that wedges the phase at Error; delete+recreate is the supported path.)
"$OPENSHELL_BIN" sandbox delete "$SANDBOX_NAME" >/dev/null 2>&1 || true
create_args=(sandbox create --name "$SANDBOX_NAME" --from "$IMAGE_TAG" --no-tty --detach)
[[ -f "$POLICY_FILE" ]] && create_args+=(--policy "$POLICY_FILE")
if [[ -d "$HOST_BRAIN_DIR" ]]; then
  create_args+=(--upload "$HOST_BRAIN_DIR:$SB_BRAIN_DIR")
else
  printf 'note: host brain dir %s not found; skipping upload (set PRIME_CLAW_HOST_BRAIN_DIR)\n' "$HOST_BRAIN_DIR"
fi
"$OPENSHELL_BIN" "${create_args[@]}" >/dev/null
# Re-assert the policy to be safe (recreate may reset to the given policy already).
[[ -f "$POLICY_FILE" ]] && "$OPENSHELL_BIN" policy set "$SANDBOX_NAME" --policy "$POLICY_FILE" --wait >/dev/null

sx() { # run a bash snippet in-sandbox via base64 (robust against quoting)
  local b64
  b64="$(printf '%s' "$1" | base64)"
  "$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 300 --no-tty -- \
    bash -c "echo $b64 | base64 -d | bash"
}

printf '[4/5] verifying brain repo folder ...\n'
sx "export HOME=/sandbox; ls -la $SB_BRAIN_DIR 2>/dev/null | head -3 || echo 'brain folder not present'"

printf '[5/5] initdb + start Postgres 16 (user sandbox, port %s) ...\n' "$PGPORT"
PGU="${POSTGRES_USER:-gbrain}"; PGD="${POSTGRES_DB:-gbrain}"
sx "export HOME=/sandbox PATH=/usr/lib/postgresql/16/bin:\$PATH
set -e
mkdir -p $PGDATA && chmod 700 $PGDATA
if [ ! -s $PGDATA/PG_VERSION ]; then
  initdb -D $PGDATA -U $PGU --auth=trust >/dev/null
fi
# Socket in /sandbox: OpenShell makes /var read-only, so /var/run/postgresql is
# not writable at runtime. /sandbox is the sandbox-owned read-write path.
pg_ctl -D $PGDATA -l /sandbox/pg.log -w start \
  -o '-c listen_addresses=localhost -p $PGPORT -c unix_socket_directories=/sandbox' \
  || pg_ctl -D $PGDATA status
psql -h localhost -p $PGPORT -U $PGU -d postgres -tc 'select version();' | head -1
createdb -h localhost -p $PGPORT -U $PGU $PGD 2>/dev/null || true
psql -h localhost -p $PGPORT -U $PGU -d $PGD -tc 'CREATE EXTENSION IF NOT EXISTS vector;' \
  | head -1"

printf 'apply-phase1-brain: done (sandbox=%s image=%s PGDATA=%s brain=%s)\n' \
  "$SANDBOX_NAME" "$IMAGE_TAG" "$PGDATA" "$SB_BRAIN_DIR"
