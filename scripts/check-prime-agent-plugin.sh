#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=prime-agent-plugin-target.sh
source "$repo_root/scripts/prime-agent-plugin-target.sh"
select_prime_agent_plugin_target "$@"
source_root="$repo_root/src/prime-agent-plugin"
files=(
  extensions/goal-continuation-nudge.ts
  extensions/handoff-chain.ts
  extensions/reviewed-plan.ts
  extension-support/conversation-guide-metadata.ts
  extension-support/conversation-oversight.ts
  extension-support/episode-close.ts
  extension-support/expert-review-reservation.ts
  extension-support/handoff-prompts.ts
  extension-support/prep-chain.ts
  extension-support/reviewed-plan-support.ts
  extension-support/role-kernel.generated.ts
  extension-support/spec-episode.ts
)

status=0
managed_directories=(
  "$destination_root"
  "$destination_root/extensions"
  "$destination_root/extension-support"
  "$destination_root/skills"
  "$destination_root/skills/prime-claw-oversee-episode"
  "$destination_root/skills/prime-claw-official-expert-review"
  "$destination_root/skills/prime-claw-official-expert-review/src"
  "$destination_root/skills/prime-claw-official-expert-review/src/prime_claw_official_expert_review"
  "$destination_root/.prime-claw"
)
for directory in "${managed_directories[@]}"; do
  if [[ -e "$directory" || -L "$directory" ]]; then
    if [[ ! -d "$directory" || -L "$directory" ]]; then
      printf 'unsafe managed plugin directory (expected absent or real directory): %s\n' "$directory" >&2
      status=1
    fi
  fi
done

obsolete_files=(
  "extensions/goal-heartbeat-work-control.ts:stale retired goal heartbeat work-control extension"
  "extensions/goal-blocker-control.ts:stale obsolete goal blocker control extension"
  "extension-support/episode-finalization.ts:stale obsolete episode finalization support file"
)
for entry in "${obsolete_files[@]}"; do
  relative="${entry%%:*}"
  diagnostic="${entry#*:}"
  obsolete_file="$destination_root/$relative"
  if [[ -e "$obsolete_file" || -L "$obsolete_file" ]]; then
    if [[ ! -f "$obsolete_file" || -L "$obsolete_file" ]]; then
      printf 'unsafe managed plugin destination (expected absent or regular file): %s\n' "$obsolete_file" >&2
    else
      printf '%s: %s\n' "$diagnostic" "$obsolete_file" >&2
    fi
    status=1
  fi
done

stale_entry="$destination_root/extensions/project-conversation.ts"
if [[ -e "$stale_entry" || -L "$stale_entry" ]]; then
  if [[ ! -f "$stale_entry" || -L "$stale_entry" ]]; then
    printf 'unsafe managed plugin destination (expected absent or regular file): %s\n' "$stale_entry" >&2
  else
    printf 'stale redundant project-conversation entry point: %s\n' "$stale_entry" >&2
  fi
  status=1
fi
for forbidden in   "$repo_root/.prime/agent/extensions"   "$repo_root/.prime/agent/extensions-bak"   "$repo_root/.prime/agent/extension-support"; do
  if [[ -e "$forbidden" ]]; then
    printf 'project-local plugin source is not inert: %s
' "$forbidden" >&2
    status=1
  fi
done

for relative in "${files[@]}"; do
  source_file="$source_root/$relative"
  installed_file="$destination_root/$relative"
  if [[ ! -f "$source_file" ]]; then
    printf 'missing plugin source: %s
' "$source_file" >&2
    status=1
  elif [[ -e "$installed_file" || -L "$installed_file" ]]; then
    if [[ ! -f "$installed_file" || -L "$installed_file" ]]; then
      printf 'unsafe managed plugin destination (expected absent or regular file): %s
' "$installed_file" >&2
      status=1
    elif ! cmp -s "$source_file" "$installed_file"; then
      printf 'stale installed plugin file: %s
' "$installed_file" >&2
      status=1
    fi
  else
    printf 'missing installed plugin file: %s
' "$installed_file" >&2
    status=1
  fi
done

managed_skill_relative="skills/prime-claw-oversee-episode/SKILL.md"
managed_skill_source="$source_root/$managed_skill_relative"
managed_skill_installed="$destination_root/$managed_skill_relative"
if [[ ! -s "$managed_skill_source" ]]; then
  printf 'missing or empty managed Conversation skill source: %s
' "$managed_skill_source" >&2
  status=1
fi
if [[ -e "$managed_skill_installed" || -L "$managed_skill_installed" ]]; then
  if [[ ! -f "$managed_skill_installed" || -L "$managed_skill_installed" ]]; then
    printf 'unsafe managed Conversation skill destination: %s
' "$managed_skill_installed" >&2
    status=1
  elif ! cmp -s "$managed_skill_source" "$managed_skill_installed"; then
    printf 'stale installed managed Conversation skill: %s
' "$managed_skill_installed" >&2
    status=1
  fi
else
  printf 'missing installed managed Conversation skill: %s
' "$managed_skill_installed" >&2
  status=1
fi

expert_skill_root_relative="skills/prime-claw-official-expert-review"
expert_skill_source="$source_root/$expert_skill_root_relative"
expert_skill_files=(
  "$expert_skill_root_relative/SKILL.md"
  "$expert_skill_root_relative/pyproject.toml"
  "$expert_skill_root_relative/src/prime_claw_official_expert_review/__init__.py"
  "$expert_skill_root_relative/src/prime_claw_official_expert_review/reviewer.md"
)
for relative in "${expert_skill_files[@]}"; do
  source_file="$source_root/$relative"
  installed_file="$destination_root/$relative"
  if [[ ! -f "$source_file" || -L "$source_file" ]]; then
    printf 'missing or unsafe managed EXPERT skill source: %s
' "$source_file" >&2
    status=1
  elif [[ -e "$installed_file" || -L "$installed_file" ]]; then
    if [[ ! -f "$installed_file" || -L "$installed_file" ]]; then
      printf 'unsafe managed EXPERT skill destination: %s
' "$installed_file" >&2
      status=1
    elif ! cmp -s "$source_file" "$installed_file"; then
      printf 'stale installed managed EXPERT skill file: %s
' "$installed_file" >&2
      status=1
    fi
  else
    printf 'missing installed managed EXPERT skill file: %s
' "$installed_file" >&2
    status=1
  fi
done
if ! python3 "$repo_root/scripts/check-prime-agent-expert-runtime.py" \
  "$expert_skill_source"; then
  status=1
fi

legacy_append_source="$source_root/APPEND_SYSTEM.md"
role_kernel_source="$source_root/ROLE_KERNEL.md"
role_protocol_source="$source_root/role-protocol.json"
role_kernel_generated="$source_root/extension-support/role-kernel.generated.ts"
if ! python3 "$repo_root/scripts/generate-prime-agent-role-kernel.py" check \
  "$role_kernel_source" "$role_kernel_generated"; then
  status=1
fi
if ! python3 "$repo_root/scripts/manage-prime-agent-role-protocol.py" check \
  "$role_protocol_source" "$role_kernel_source" "$legacy_append_source" "$destination_root"; then
  status=1
fi

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi
printf 'prime-claw plugin source is inert and selected copy is current: %s\n' "$destination_root"
printf 'target mode: %s\n' "$plugin_target_mode"
