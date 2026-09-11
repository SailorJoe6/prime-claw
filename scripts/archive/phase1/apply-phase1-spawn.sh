#!/usr/bin/env bash
# apply-phase1-spawn.sh — create the in-sandbox episode spawn target (R-U3-1).
# Mutating. Idempotent.
#
# A git project the sandboxed prime-agent can open as an episode working
# directory. Created as a plain committed folder under /sandbox (the OpenShell
# --upload path filters .git via gitignore, so a pre-committed folder must be
# created in-sandbox rather than uploaded). git is present in the base image.
set -euo pipefail

SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
SPAWN_PROJECT_DIR="${PRIME_CLAW_SPAWN_PROJECT_DIR:-/sandbox/episode-target}"
DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi
[[ $# -eq 0 ]] || { printf 'Usage: scripts/apply-phase1-spawn.sh [--dry-run]\n' >&2; exit 2; }

if ((DRY_RUN)); then
  printf 'dry_run: create git project at %s (git init + one commit) inside %s\n' "$SPAWN_PROJECT_DIR" "$SANDBOX_NAME"
  printf 'host_credential_access: prohibited\n'
  exit 0
fi

"$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 120 --no-tty -- bash -lc '
  set -e
  DIR="'"$SPAWN_PROJECT_DIR"'"
  if [ -d "$DIR/.git" ]; then echo "spawn project already present at $DIR"; exit 0; fi
  mkdir -p "$DIR"
  cd "$DIR"
  git init -q
  git config user.email "prime-claw-spike@local"
  git config user.name "prime-claw spike"
  printf "# Episode Target\n\nSpawn/reap spike project (R-U3-1).\n" > README.md
  printf "print(\"episode-target alive\")\n" > main.py
  git add -A
  git commit -qm "episode target init"
  echo "created: $(git -C "$DIR" rev-parse --short HEAD) $(git -C "$DIR" log -1 --pretty=%s)"
'

printf 'apply-phase1-spawn: done (project=%s)\n' "$SPAWN_PROJECT_DIR"
