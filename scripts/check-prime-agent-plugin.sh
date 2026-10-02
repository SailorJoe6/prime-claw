#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=prime-agent-plugin-target.sh
source "$repo_root/scripts/prime-agent-plugin-target.sh"
select_prime_agent_plugin_target "$@"
source_root="$repo_root/src/prime-agent-plugin"
files=(
  extensions/goal-heartbeat-work-control.ts
  extensions/handoff-chain.ts
  extensions/reviewed-plan.ts
  extension-support/conversation-oversight.ts
  extension-support/episode-close.ts
  extension-support/handoff-prompts.ts
  extension-support/prep-chain.ts
  extension-support/reviewed-plan-support.ts
  extension-support/spec-episode.ts
)

status=0
obsolete_files=(
  "extensions/goal-blocker-control.ts:stale obsolete goal blocker control extension"
  "extension-support/episode-finalization.ts:stale obsolete episode finalization support file"
)
for entry in "${obsolete_files[@]}"; do
  relative="${entry%%:*}"
  diagnostic="${entry#*:}"
  obsolete_file="$destination_root/$relative"
  if [[ -e "$obsolete_file" || -L "$obsolete_file" ]]; then
    printf '%s: %s
' "$diagnostic" "$obsolete_file" >&2
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

kernel_source="$source_root/APPEND_SYSTEM.md"
oversee_skill="$repo_root/.ralph/skills/oversee-episode/SKILL.md"
if [[ ! -s "$oversee_skill" ]]; then
  printf 'missing or empty canonical oversight package: %s\n' "$oversee_skill" >&2
  status=1
fi
if ! python3 "$repo_root/scripts/manage-prime-agent-append-system.py" check "$kernel_source" "$destination_root/APPEND_SYSTEM.md"; then
  status=1
fi

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi
printf 'prime-claw plugin source is inert and selected copy is current: %s\n' "$destination_root"
printf 'target mode: %s\n' "$plugin_target_mode"
