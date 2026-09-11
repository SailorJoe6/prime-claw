#!/usr/bin/env bash
# apply-phase1-sandbox.sh — create (or converge) the prime-claw Phase 1
# OpenShell sandbox. Mutating. Idempotent: if the sandbox already exists,
# refreshes the policy to the committed baseline instead of recreating.
#
# Proves: R-U1-1 (fresh dedicated sandbox, built directly on OpenShell),
#         R-U1-2 (versions captured by the companion validator),
#         R-U1-5 baseline (deny-by-default policy from policies/phase1-sandbox.yaml)
#
# NemoClaw is reference architecture only; nothing here depends on it.
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"
SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
POLICY_FILE="${PRIME_CLAW_POLICY_FILE:-$REPO_ROOT/policies/phase1-sandbox.yaml}"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=1
  shift
fi
[[ $# -eq 0 ]] || {
  printf 'Usage: scripts/apply-phase1-sandbox.sh [--dry-run]\n' >&2
  exit 2
}

[[ -f "$POLICY_FILE" ]] || {
  printf 'error: policy file not found: %s\n' "$POLICY_FILE" >&2
  exit 1
}
command -v "$OPENSHELL_BIN" >/dev/null 2>&1 || {
  printf 'error: openshell CLI not found (set OPENSHELL_BIN)\n' >&2
  exit 1
}

if ((DRY_RUN)); then
  printf 'dry_run: would create OpenShell sandbox %q if absent (image: community base, no NemoClaw recipe)\n' "$SANDBOX_NAME"
  printf 'dry_run: would apply policy %s (deny-by-default egress + egress-canary allow)\n' "$POLICY_FILE"
  printf 'dry_run: labels: project=prime-claw phase=1\n'
  printf 'host_credential_access: prohibited\n'
  printf 'nemoclaw_recipe_use: prohibited\n'
  exit 0
fi

if "$OPENSHELL_BIN" sandbox get "$SANDBOX_NAME" >/dev/null 2>&1; then
  printf 'sandbox %q already exists; converging policy (no recreate)\n' "$SANDBOX_NAME"
else
  "$OPENSHELL_BIN" sandbox create \
    --name "$SANDBOX_NAME" \
    --policy "$POLICY_FILE" \
    --label project=prime-claw \
    --label phase=1 \
    --detach
fi

# Converge the live policy to the committed baseline (dynamic field:
# hot-reloadable on a running sandbox).
"$OPENSHELL_BIN" policy set "$SANDBOX_NAME" --policy "$POLICY_FILE" --wait

printf 'apply-phase1-sandbox: done (sandbox=%s)\n' "$SANDBOX_NAME"
