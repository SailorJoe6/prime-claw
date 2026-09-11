#!/usr/bin/env bash
# apply-phase1-prime-agent.sh — install prime-agent and bootstrap its Python
# kernel inside the prime-claw Phase 1 sandbox. Mutating. Idempotent.
#
# Install channel (documented in policies/phase1-sandbox.yaml):
#   install.sh + release tarball      -> /usr/bin/curl   (app.primeintellect.ai + R2 bucket)
#   npm runtime deps of the package   -> /usr/bin/node   (registry.npmjs.org + R2 bucket)
#   kernel bootstrap (uv + py3.11)    -> /usr/local/bin/uv, /usr/bin/curl
#                                        (astral.sh, github, pypi, files.pythonhosted.org)
#
# Two in-sandbox constraints discovered and handled here:
#   * npm global prefix defaults to root-owned /usr -> we set NPM_CONFIG_PREFIX
#     to the user-writable /sandbox/.npm-global.
#   * the OpenShell L7 proxy socket-resets URLs whose path contains %2F (npm's
#     canonical scoped-package form). scripts/lib/npm-onload.js decodes %2F -> /
#     and is injected via NODE_OPTIONS for the install legs.
#
# Proves: R-U1-3 (daemon installs + runs healthily in-sandbox),
#         R-U1-4 prerequisite (kernel bootstrap for the persistent REPL)
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"
SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
POLICY_FILE="${PRIME_CLAW_POLICY_FILE:-$REPO_ROOT/policies/phase1-sandbox.yaml}"
# Pin to the operator host instance's version (D11: same instance).
PRIME_AGENT_VERSION="${PRIME_AGENT_VERSION:-0.9.3}"
DRY_RUN=0

if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi
[[ $# -eq 0 ]] || { printf 'Usage: scripts/apply-phase1-prime-agent.sh [--dry-run]\n' >&2; exit 2; }

if ((DRY_RUN)); then
  printf 'dry_run: converge policy from %s (prime-agent install + kernel bootstrap channels)\n' "$POLICY_FILE"
  printf 'dry_run: install prime-agent@%s via the documented installer (npm prefix /sandbox/.npm-global)\n' "$PRIME_AGENT_VERSION"
  printf 'dry_run: inject scripts/lib/npm-onload.js via NODE_OPTIONS (%%2F proxy workaround)\n'
  printf 'dry_run: bootstrap the Python kernel (uv + Python 3.11 + prime-agent-runtime)\n'
  printf 'host_credential_access: prohibited\n'
  exit 0
fi

# 1. Converge policy so the install + bootstrap channels exist.
"$OPENSHELL_BIN" policy set "$SANDBOX_NAME" --policy "$POLICY_FILE" --wait

# 2. Stage the npm onload workaround in-sandbox (content-addressed copy from the repo).
ONLOAD_B64="$(base64 < "$REPO_ROOT/scripts/lib/npm-onload.js")"
"$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 60 --no-tty -- bash -lc "
  mkdir -p /sandbox/.prime-claw
  echo $ONLOAD_B64 | base64 -d > /sandbox/.prime-claw/npm-onload.js
"

# 3. Install prime-agent (skip when the pinned version is already present).
"$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 1800 --no-tty -- bash -lc '
  set -e
  export PATH=/sandbox/.npm-global/bin:$PATH
  installed_v="$(prime-agent --version 2>&1 | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | head -1)"
  if command -v prime-agent >/dev/null 2>&1 && [ "$installed_v" = "'"$PRIME_AGENT_VERSION"'" ]; then
    echo "prime-agent '"$PRIME_AGENT_VERSION"' already installed; skipping"
  else
    export NODE_OPTIONS="--require /sandbox/.prime-claw/npm-onload.js"
    export NPM_CONFIG_PREFIX=/sandbox/.npm-global
    export PRIME_AGENT_VERSION="'"$PRIME_AGENT_VERSION"'"
    export PRIME_AGENT_INSTALLER_PLAIN=1
    export PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL=0
    curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh
  fi
  prime-agent --version 2>&1 | grep -E '^[0-9]+\.[0-9]+\.[0-9]+' | head -1
'

# 4. Bootstrap the persistent Python kernel (uv + Python 3.11 + runtime). Idempotent.
"$OPENSHELL_BIN" sandbox exec -n "$SANDBOX_NAME" --timeout 1200 --no-tty -- bash -lc '
  export PATH=/sandbox/.npm-global/bin:$PATH
  export NODE_OPTIONS="--require /sandbox/.prime-claw/npm-onload.js"
  export PRIME_AGENT_INSTALL_UV=1
  node --input-type=module -e "
    import { ensureKernelPython } from \"/sandbox/.npm-global/lib/node_modules/prime-agent/dist/core/kernel/bootstrap.js\";
    console.log(\"kernel_python=\" + (await ensureKernelPython()));
  "
'

printf 'apply-phase1-prime-agent: done (sandbox=%s version=%s)\n' "$SANDBOX_NAME" "$PRIME_AGENT_VERSION"
