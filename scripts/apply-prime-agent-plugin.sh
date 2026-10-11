#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=prime-agent-plugin-target.sh
source "$repo_root/scripts/prime-agent-plugin-target.sh"
role_receipt=""
global_drift_action="preserve"
target_args=()
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --user-global|--sandbox-home)
      target_args+=("$1")
      shift
      ;;
    --global-drift-action)
      if [[ "$#" -lt 2 || ! "$2" =~ ^(preserve|backup-reset|accept-override)$ ]]; then
        printf 'error: --global-drift-action requires preserve, backup-reset, or accept-override
' >&2
        exit 64
      fi
      global_drift_action="$2"
      shift 2
      ;;
    --role-receipt)
      if [[ "$#" -lt 2 || -z "$2" ]]; then
        printf 'error: --role-receipt requires an absolute private receipt path\n' >&2
        exit 64
      fi
      role_receipt="$2"
      shift 2
      ;;
    *)
      prime_agent_plugin_target_usage
      printf 'error: unknown argument: %s\n' "$1" >&2
      exit 64
      ;;
  esac
done
if [[ -n "$role_receipt" && "$role_receipt" != /* ]]; then
  printf 'error: --role-receipt requires an absolute private receipt path\n' >&2
  exit 64
fi
if [[ "${#target_args[@]}" -gt 0 ]]; then
  select_prime_agent_plugin_target "${target_args[@]}"
else
  select_prime_agent_plugin_target
fi
source_root="$repo_root/src/prime-agent-plugin"
delivery_manager="$repo_root/scripts/manage-prime-agent-delivery.py"
for root in "$destination_root" "$user_agents_root"; do
  if [[ -e "$root" || -L "$root" ]]; then
    if [[ ! -d "$root" || -L "$root" ]]; then
      printf 'error: unsafe managed root (expected absent or real directory): %s\n' "$root" >&2
      exit 1
    fi
  fi
done
mkdir -p "$destination_root" "$user_agents_root"
python3 "$delivery_manager" preflight "$source_root" "$destination_root" \
  --user-root "$user_agents_root" --action "$global_drift_action"

role_kernel_source="$(python3 "$delivery_manager" selected-context-source "$source_root")"
role_protocol_source="$(python3 "$delivery_manager" role-protocol-source "$source_root")"
cleanup_args=(validate --plugin-root "$destination_root")
if [[ "$plugin_target_mode" == "user-global" || "$plugin_target_mode" == "sandbox-home" ]]; then
  cleanup_args+=(--coding-agent-root "${PRIME_AGENT_CODING_AGENT_DIR:-$HOME/.prime/agent}")
fi
python3 "$repo_root/scripts/cleanup-retired-prime-agent-expert-review.py" "${cleanup_args[@]}"
role_apply_args=(
  apply "$role_protocol_source" "$role_kernel_source"
  "$source_root/APPEND_SYSTEM.md" "$destination_root"
)
if [[ -n "$role_receipt" ]]; then
  role_apply_args+=(--receipt "$role_receipt")
fi
if [[ "$plugin_target_mode" == "sandbox-home" ]]; then
  role_apply_args+=(--allow-fresh-final)
fi
python3 "$repo_root/scripts/manage-prime-agent-role-protocol.py" "${role_apply_args[@]}"
cleanup_args[0]=remove
python3 "$repo_root/scripts/cleanup-retired-prime-agent-expert-review.py" "${cleanup_args[@]}"
python3 "$delivery_manager" apply "$source_root" "$destination_root" \
  --user-root "$user_agents_root" --action "$global_drift_action"

# Installation is sequential, not an atomic generation swap. The required final
# check detects any incomplete or mixed generation before apply reports success.
if [[ "$plugin_target_mode" == "user-global" || "$plugin_target_mode" == "sandbox-home" ]]; then
  "$repo_root/scripts/check-prime-agent-plugin.sh" "--${plugin_target_mode}"
else
  PRIME_AGENT_PLUGIN_ROOT="$destination_root" \
    "$repo_root/scripts/check-prime-agent-plugin.sh"
fi

printf 'prime-claw plugin applied: %s\n' "$destination_root"
printf 'target mode: %s\n' "$plugin_target_mode"
printf 'restart Prime Agent before treating this generation as active\n'
