#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source_root="$repo_root/src/prime-agent-plugin"
destination_root="${PRIME_AGENT_PLUGIN_ROOT:-${HOME:?HOME must be set}/.prime/agent}"
files=(
  extensions/handoff-chain.ts
  extensions/reviewed-plan.ts
  extension-support/conversation-oversight.ts
  extension-support/episode-finalization.ts
  extension-support/handoff-prompts.ts
  extension-support/reviewed-plan-support.ts
  extension-support/spec-episode.ts
)

status=0
if [[ -e "$destination_root/extensions/project-conversation.ts" ]]; then
  printf 'stale redundant project-conversation entry point: %s\n' "$destination_root/extensions/project-conversation.ts" >&2
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
  elif [[ ! -f "$installed_file" ]]; then
    printf 'missing installed plugin file: %s
' "$installed_file" >&2
    status=1
  elif ! cmp -s "$source_file" "$installed_file"; then
    printf 'stale installed plugin file: %s
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
printf 'prime-claw plugin source is inert and global copy is current: %s
' "$destination_root"
