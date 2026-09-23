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

for relative in "${files[@]}"; do
  if [[ ! -f "$source_root/$relative" ]]; then
    printf 'missing plugin source: %s
' "$source_root/$relative" >&2
    exit 1
  fi
done

kernel_source="$source_root/APPEND_SYSTEM.md"
oversee_skill="$repo_root/.ralph/skills/oversee-episode/SKILL.md"
if [[ ! -s "$kernel_source" ]]; then
  printf 'missing or empty identity kernel: %s\n' "$kernel_source" >&2
  exit 1
fi
if [[ ! -s "$oversee_skill" ]]; then
  printf 'missing or empty canonical oversight package: %s\n' "$oversee_skill" >&2
  exit 1
fi
python3 "$repo_root/scripts/manage-prime-agent-append-system.py" validate "$kernel_source" "$destination_root/APPEND_SYSTEM.md"

# Reject every unsafe managed TypeScript destination before the first delete or copy.
managed_destinations=("${files[@]}" extensions/project-conversation.ts)
for relative in "${managed_destinations[@]}"; do
  destination="$destination_root/$relative"
  if [[ -e "$destination" || -L "$destination" ]]; then
    if [[ ! -f "$destination" || -L "$destination" ]]; then
      printf 'unsafe managed plugin destination (expected absent or regular file): %s\n' "$destination" >&2
      exit 1
    fi
  fi
done

mkdir -p "$destination_root/extensions" "$destination_root/extension-support"
rm -f "$destination_root/extensions/project-conversation.ts"
for relative in "${files[@]}"; do
  install -m 0644 "$source_root/$relative" "$destination_root/$relative"
done
python3 "$repo_root/scripts/manage-prime-agent-append-system.py" apply "$kernel_source" "$destination_root/APPEND_SYSTEM.md"

# Installation is sequential, not an atomic generation swap. The required final
# check detects any incomplete or mixed generation before apply reports success.
"$repo_root/scripts/check-prime-agent-plugin.sh"

printf 'prime-claw plugin applied: %s
' "$destination_root"
printf 'restart Prime Agent before treating this generation as active
'
