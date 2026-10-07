#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=prime-agent-plugin-target.sh
source "$repo_root/scripts/prime-agent-plugin-target.sh"
select_prime_agent_plugin_target "$@"
source_root="$repo_root/src/prime-agent-plugin"
files=(
  extensions/handoff-chain.ts
  extensions/reviewed-plan.ts
  extension-support/conversation-guide-metadata.ts
  extension-support/conversation-oversight.ts
  extension-support/episode-close.ts
  extension-support/handoff-prompts.ts
  extension-support/prep-chain.ts
  extension-support/reviewed-plan-support.ts
  extension-support/role-kernel.generated.ts
  extension-support/spec-episode.ts
)

for relative in "${files[@]}"; do
  if [[ ! -f "$source_root/$relative" ]]; then
    printf 'missing plugin source: %s
' "$source_root/$relative" >&2
    exit 1
  fi
done

managed_skill_relative="skills/prime-claw-oversee-episode/SKILL.md"
managed_skill_source="$source_root/$managed_skill_relative"
if [[ ! -s "$managed_skill_source" ]]; then
  printf 'missing or empty managed Conversation skill source: %s
' "$managed_skill_source" >&2
  exit 1
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
  if [[ ! -f "$source_root/$relative" || -L "$source_root/$relative" ]]; then
    printf 'missing or unsafe managed EXPERT skill source: %s
' "$source_root/$relative" >&2
    exit 1
  fi
done

legacy_append_source="$source_root/APPEND_SYSTEM.md"
role_kernel_source="$source_root/ROLE_KERNEL.md"
role_protocol_source="$source_root/role-protocol.json"
role_kernel_generated="$source_root/extension-support/role-kernel.generated.ts"
for source_file in "$legacy_append_source" "$role_kernel_source" "$role_protocol_source" "$role_kernel_generated"; do
  if [[ ! -s "$source_file" ]]; then
    printf 'missing or empty role-protocol source: %s\n' "$source_file" >&2
    exit 1
  fi
done
python3 "$repo_root/scripts/generate-prime-agent-role-kernel.py" check \
  "$role_kernel_source" "$role_kernel_generated"
python3 "$repo_root/scripts/check-prime-agent-expert-runtime.py" \
  "$expert_skill_source"
# Reject symlinked or non-directory managed roots before inspecting leaf paths.
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
      exit 1
    fi
  fi
done

# Reject every unsafe managed TypeScript destination before the first delete or copy.
obsolete_files=(
  extensions/goal-heartbeat-work-control.ts
  extensions/goal-blocker-control.ts
  extension-support/episode-finalization.ts
)
managed_destinations=("${files[@]}" "$managed_skill_relative" "${expert_skill_files[@]}" extensions/project-conversation.ts "${obsolete_files[@]}")
for relative in "${managed_destinations[@]}"; do
  destination="$destination_root/$relative"
  if [[ -e "$destination" || -L "$destination" ]]; then
    if [[ ! -f "$destination" || -L "$destination" ]]; then
      printf 'unsafe managed plugin destination (expected absent or regular file): %s\n' "$destination" >&2
      exit 1
    fi
  fi
done

managed_skill_dir="$destination_root/skills/prime-claw-oversee-episode"
if [[ -d "$managed_skill_dir" ]]; then
  unexpected_entry="$(find "$managed_skill_dir" -mindepth 1 -maxdepth 1 ! -name SKILL.md -print -quit)"
  if [[ -n "$unexpected_entry" ]]; then
    printf 'unexpected entry in managed Conversation skill directory: %s
' "$unexpected_entry" >&2
    exit 1
  fi
fi
expert_skill_dir="$destination_root/$expert_skill_root_relative"
expert_src_dir="$expert_skill_dir/src"
expert_package_dir="$expert_src_dir/prime_claw_official_expert_review"
if [[ -d "$expert_skill_dir" ]]; then
  unexpected_entry="$(find "$expert_skill_dir" -mindepth 1 -maxdepth 1 ! -name SKILL.md ! -name pyproject.toml ! -name src -print -quit)"
  if [[ -n "$unexpected_entry" ]]; then
    printf 'unexpected entry in managed EXPERT skill directory: %s
' "$unexpected_entry" >&2
    exit 1
  fi
fi
if [[ -d "$expert_src_dir" ]]; then
  unexpected_entry="$(find "$expert_src_dir" -mindepth 1 -maxdepth 1 ! -name prime_claw_official_expert_review -print -quit)"
  if [[ -n "$unexpected_entry" ]]; then
    printf 'unexpected entry in managed EXPERT source directory: %s
' "$unexpected_entry" >&2
    exit 1
  fi
fi
if [[ -d "$expert_package_dir" ]]; then
  unexpected_entry="$(find "$expert_package_dir" -mindepth 1 -maxdepth 1 ! -name __init__.py ! -name reviewer.md -print -quit)"
  if [[ -n "$unexpected_entry" ]]; then
    printf 'unexpected entry in managed EXPERT package directory: %s
' "$unexpected_entry" >&2
    exit 1
  fi
fi

mkdir -p "$destination_root/extensions" "$destination_root/extension-support" "$managed_skill_dir" "$expert_package_dir"
python3 "$repo_root/scripts/manage-prime-agent-role-protocol.py" apply \
  "$role_protocol_source" "$role_kernel_source" "$legacy_append_source" "$destination_root"
rm -f "$destination_root/extensions/project-conversation.ts"
for relative in "${obsolete_files[@]}"; do
  rm -f "$destination_root/$relative"
done
for relative in "${files[@]}"; do
  install -m 0644 "$source_root/$relative" "$destination_root/$relative"
done
install -m 0644 "$managed_skill_source" "$destination_root/$managed_skill_relative"
for relative in "${expert_skill_files[@]}"; do
  install -m 0644 "$source_root/$relative" "$destination_root/$relative"
done
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
