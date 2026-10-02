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
obsolete_files=(
  extensions/goal-blocker-control.ts
  extension-support/episode-finalization.ts
)
managed_destinations=("${files[@]}" extensions/project-conversation.ts "${obsolete_files[@]}")
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
for relative in "${obsolete_files[@]}"; do
  rm -f "$destination_root/$relative"
done
for relative in "${files[@]}"; do
  install -m 0644 "$source_root/$relative" "$destination_root/$relative"
done
python3 "$repo_root/scripts/manage-prime-agent-append-system.py" apply "$kernel_source" "$destination_root/APPEND_SYSTEM.md"

# Installation is sequential, not an atomic generation swap. The required final
# check detects any incomplete or mixed generation before apply reports success,
# using the same explicit target semantics selected above.
if [[ "$plugin_target_mode" == "user-global" ]]; then
  "$repo_root/scripts/check-prime-agent-plugin.sh" --user-global
else
  PRIME_AGENT_PLUGIN_ROOT="$destination_root" \
    "$repo_root/scripts/check-prime-agent-plugin.sh"
fi

printf 'prime-claw plugin applied: %s\n' "$destination_root"
printf 'target mode: %s\n' "$plugin_target_mode"
printf 'restart Prime Agent before treating this generation as active\n'
