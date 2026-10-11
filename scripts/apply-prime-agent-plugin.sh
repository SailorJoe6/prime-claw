#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=prime-agent-plugin-target.sh
source "$repo_root/scripts/prime-agent-plugin-target.sh"
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
    *)
      prime_agent_plugin_target_usage
      printf 'error: unknown argument: %s\n' "$1" >&2
      exit 64
      ;;
  esac
done
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
python3 "$repo_root/scripts/manage-prime-agent-role-protocol.py" apply \
  "$role_kernel_source" "$destination_root"
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
