#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
source_root="$repo_root/src/prime-agent-plugin"
destination_root="${PRIME_AGENT_PLUGIN_ROOT:-${HOME:?HOME must be set}/.prime/agent}"
files=(
  extensions/handoff-chain.ts
  extensions/reviewed-plan.ts
  extension-support/conversation-oversight.ts
  extension-support/episode-close.ts
  extension-support/handoff-prompts.ts
  extension-support/reviewed-plan-support.ts
  extension-support/spec-episode.ts
)

status=0
managed_directories=(
  "$destination_root"
  "$destination_root/extensions"
  "$destination_root/extension-support"
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

kernel_source="$source_root/APPEND_SYSTEM.md"
if ! python3 "$repo_root/scripts/manage-prime-agent-append-system.py" check "$kernel_source" "$destination_root/APPEND_SYSTEM.md"; then
  status=1
fi

if [[ "$status" -ne 0 ]]; then
  exit "$status"
fi
printf 'prime-claw plugin source is inert and global copy is current: %s
' "$destination_root"
