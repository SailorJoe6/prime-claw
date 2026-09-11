#!/usr/bin/env bash
# apply-phase1-providers.sh — create + attach the OpenShell provider(s) that
# carry the operator's host-instance credentials into the prime-claw Phase 1
# sandbox. Mutating. Idempotent.
#
# Proves: R-U1-6 setup (the GATE track), R-X-5 (no secrets in the repo),
#         R-X-7 (configurable: parameterized, not hardcoded to one operator).
#
# What it does (D12/D13/D14):
#   * GATE track: the host instance is gateway-fronted — all inference goes to
#     one AI Gateway (default ai-gateway.zende.sk, paths /anthropic /v1
#     /bedrock) sharing ONE gateway API key. This script creates ONE OpenShell
#     provider carrying that key, with an endpoint profile for the gateway, and
#     attaches it to the sandbox. The default model anthropic.kimi-k3 routes to
#     the gateway's /anthropic path.
#   * The gateway key is read from the operator's host config
#     (~/.prime/agent/auth.json) at apply time and is NEVER written to the repo,
#     logs, or any tracked file.
#
# Configurability (R-X-7 / D14): another operator points their sandbox at the
# same gateway with their OWN key, or at a different gateway, by setting the
# env vars below — no code edits. A different auth shape (e.g. openai-codex
# OAuth) is a separate, optional provider (D13) and is out of scope here.
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")/.." rev-parse --show-toplevel)"
OPENSHELL_BIN="${OPENSHELL_BIN:-openshell}"
SANDBOX_NAME="${PRIME_CLAW_SANDBOX_NAME:-prime-claw}"

# --- Parameterized config (R-X-7). Non-secret; may be overridden per operator. ---
GATEWAY_HOST="${PRIME_CLAW_AI_GATEWAY_HOST:-ai-gateway.zende.sk}"
GATEWAY_PORT="${PRIME_CLAW_AI_GATEWAY_PORT:-443}"
PROVIDER_NAME="${PRIME_CLAW_AI_GATEWAY_PROVIDER:-prime-claw-ai-gateway}"
PROFILE_ID="${PRIME_CLAW_AI_GATEWAY_PROFILE:-zd-ai-gateway}"
# Where the gateway key is read from (the operator's host prime-agent instance).
HOST_AUTH_JSON="${PRIME_CLAW_HOST_AUTH_JSON:-$HOME/.prime/agent/auth.json}"
HOST_AUTH_PROVIDER="${PRIME_CLAW_HOST_AUTH_PROVIDER:-anthropic}"
PROFILE_FILE="$(mktemp -t zd-ai-gateway-profile.XXXXXX.yaml)"
trap 'rm -f "$PROFILE_FILE"' EXIT

DRY_RUN=0
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; shift; fi
[[ $# -eq 0 ]] || { printf 'Usage: scripts/apply-phase1-providers.sh [--dry-run]
' >&2; exit 2; }

command -v "$OPENSHELL_BIN" >/dev/null 2>&1 || { printf 'error: openshell CLI not found
' >&2; exit 1; }

if ((DRY_RUN)); then
  printf 'dry_run: import endpoint profile %s (endpoint %s:%s rest, x-api-key)
' "$PROFILE_ID" "$GATEWAY_HOST" "$GATEWAY_PORT"
  printf 'dry_run: create provider %s (key read from %s [%s], never committed)
' "$PROVIDER_NAME" "$HOST_AUTH_JSON" "$HOST_AUTH_PROVIDER"
  printf 'dry_run: attach provider %s to sandbox %s
' "$PROVIDER_NAME" "$SANDBOX_NAME"
  printf 'host_credential_access: read-only at apply time; values never written to repo/logs
'
  exit 0
fi

# --- Endpoint profile for the gateway (generic credential name api_key, x-api-key header). ---
cat >"$PROFILE_FILE" <<YAML
id: ${PROFILE_ID}
display_name: AI Gateway (prime-claw)
description: Internal AI gateway fronting inference (shared API key, x-api-key header)
category: inference
credentials:
- name: api_key
  description: Shared AI Gateway API key
  env_vars:
  - AI_GATEWAY_API_KEY
  required: true
  auth_style: header
  header_name: x-api-key
  query_param: ''
endpoints:
- host: ${GATEWAY_HOST}
  port: ${GATEWAY_PORT}
  protocol: rest
  access: read-write
  enforcement: enforce
binaries: []
inference_capable: true
discovery:
  credentials:
  - api_key
YAML

"$OPENSHELL_BIN" provider profile lint --file "$PROFILE_FILE" >/dev/null
"$OPENSHELL_BIN" provider profile import --file "$PROFILE_FILE" >/dev/null

# --- Read the gateway key from the host config (in-process only; never echoed). ---
[[ -f "$HOST_AUTH_JSON" ]] || { printf 'error: host auth config not found: %s
' "$HOST_AUTH_JSON" >&2; exit 1; }
GATEWAY_KEY="$(/usr/bin/python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(d[sys.argv[2]]["key"])' "$HOST_AUTH_JSON" "$HOST_AUTH_PROVIDER")"
[[ -n "$GATEWAY_KEY" ]] || { printf 'error: no key for provider %q in %s
' "$HOST_AUTH_PROVIDER" "$HOST_AUTH_JSON" >&2; exit 1; }

# --- Create the provider (idempotent: skip if it already exists). ---
if "$OPENSHELL_BIN" provider get "$PROVIDER_NAME" >/dev/null 2>&1; then
  printf 'provider %q already exists; refreshing credential
' "$PROVIDER_NAME"
  "$OPENSHELL_BIN" provider update "$PROVIDER_NAME" --credential "api_key=${GATEWAY_KEY}" >/dev/null
else
  "$OPENSHELL_BIN" provider create --name "$PROVIDER_NAME" --type "$PROFILE_ID"     --credential "api_key=${GATEWAY_KEY}" >/dev/null
fi
unset GATEWAY_KEY

# --- Attach to the sandbox (idempotent). ---
if "$OPENSHELL_BIN" sandbox provider list "$SANDBOX_NAME" 2>/dev/null | grep -q "$PROVIDER_NAME"; then
  printf 'provider %q already attached to %q
' "$PROVIDER_NAME" "$SANDBOX_NAME"
else
  "$OPENSHELL_BIN" sandbox provider attach "$SANDBOX_NAME" "$PROVIDER_NAME" >/dev/null
fi

printf 'apply-phase1-providers: done (provider=%s -> %s:%s on sandbox %s)
'   "$PROVIDER_NAME" "$GATEWAY_HOST" "$GATEWAY_PORT" "$SANDBOX_NAME"
