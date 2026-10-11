#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=prime-agent-plugin-target.sh
source "$repo_root/scripts/prime-agent-plugin-target.sh"
select_prime_agent_plugin_target "$@"
source_root="$repo_root/src/prime-agent-plugin"
delivery_manager="$repo_root/scripts/manage-prime-agent-delivery.py"
status=0
if ! python3 "$delivery_manager" check "$source_root" "$destination_root" \
  --user-root "$user_agents_root"; then
  status=1
fi

cleanup_args=(check-absent --plugin-root "$destination_root")
if [[ "$plugin_target_mode" == "user-global" || "$plugin_target_mode" == "sandbox-home" ]]; then
  cleanup_args+=(--coding-agent-root "${PRIME_AGENT_CODING_AGENT_DIR:-$HOME/.prime/agent}")
fi
if ! python3 "$repo_root/scripts/cleanup-retired-prime-agent-expert-review.py" "${cleanup_args[@]}"; then
  status=1
fi

legacy_append_source="$source_root/APPEND_SYSTEM.md"
role_kernel_source="$(python3 "$delivery_manager" selected-context-source "$source_root")"
role_protocol_source="$(python3 "$delivery_manager" role-protocol-source "$source_root")"
if ! python3 "$repo_root/scripts/manage-prime-agent-role-protocol.py" check \
  "$role_protocol_source" "$role_kernel_source" \
  "$legacy_append_source" "$destination_root"; then
  status=1
fi

for forbidden in \
  "$repo_root/.prime/agent/extensions" \
  "$repo_root/.prime/agent/extensions-bak" \
  "$repo_root/.prime/agent/extension-support"; do
  if [[ -e "$forbidden" ]]; then
    printf 'project-local plugin source is not inert: %s\n' "$forbidden" >&2
    status=1
  fi
done

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi
printf 'prime-claw plugin source is inert and selected copy is current: %s\n' "$destination_root"
printf 'target mode: %s\n' "$plugin_target_mode"
