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
    --user-global)
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
files=(
  extensions/goal-continuation-nudge.ts
  extensions/handoff-chain.ts
  extensions/project-initialization.ts
  extensions/reviewed-plan.ts
  asset-inventory.json
  ROLE_KERNEL.md
  extension-support/project-initialization.ts
  extension-support/template-review.ts
  extension-support/episode-ownership.ts
  extension-support/conversation-oversight.ts
  extension-support/episode-close.ts
  skills/project-templates/blocked.md
  skills/project-templates/design.md
  skills/project-templates/execute.md
  skills/project-templates/prepare.md
  skills/project-templates/spec-it-out.md
  workflows/handoff.md
  workflows/implement-prep.md
  workflows/implement-spec.md
  workflows/plan-prep.md
  workflows/plan-spec.md
  extension-support/handoff-prompts.ts
  extension-support/prep-chain.ts
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

managed_skill_relative="skills/prime-claw-oversee-episode/SKILL.md"
managed_skill_source="$source_root/$managed_skill_relative"
if [[ ! -s "$managed_skill_source" ]]; then
  printf 'missing or empty managed Conversation skill source: %s
' "$managed_skill_source" >&2
  exit 1
fi

expert_skill_relative="skills/prime-claw-expert-review/SKILL.md"
expert_skill_source="$source_root/$expert_skill_relative"
if [[ ! -f "$expert_skill_source" || -L "$expert_skill_source" ]]; then
  printf 'missing or unsafe managed EXPERT skill source: %s
' "$expert_skill_source" >&2
  exit 1
fi

legacy_append_source="$source_root/APPEND_SYSTEM.md"
role_kernel_source="$source_root/ROLE_KERNEL.md"
role_protocol_source="$source_root/role-protocol.json"
for source_file in "$role_kernel_source" "$role_protocol_source"; do
  if [[ ! -s "$source_file" ]]; then
    printf 'missing or empty role-protocol source: %s\n' "$source_file" >&2
    exit 1
  fi
done
# Reject symlinked or non-directory managed roots before inspecting leaf paths.
managed_directories=(
  "$destination_root"
  "$destination_root/extensions"
  "$destination_root/extension-support"
  "$destination_root/skills"
  "$destination_root/skills/goals-and-heartbeats"
  "$destination_root/skills/project-templates"
  "$destination_root/workflows"
  "$destination_root/skills/prime-claw-oversee-episode"
  "$destination_root/skills/prime-claw-expert-review"
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

# Project template sources are deliberately non-discoverable. Never tolerate a
# global SKILL.md copy that could shadow project customization.
for name in blocked design execute prepare spec-it-out; do
  collision="$destination_root/skills/$name"
  if [[ -e "$collision" || -L "$collision" ]]; then
    printf 'unexpected global project-template skill collision: %s\n' "$collision" >&2
    exit 1
  fi
done

# Reject every unsafe managed TypeScript destination before the first delete or copy.
obsolete_files=(
  extensions/goal-heartbeat-work-control.ts
  extensions/goal-blocker-control.ts
  extension-support/conversation-guide-metadata.ts
  extension-support/episode-finalization.ts
  extension-support/expert-review-reservation.ts
  extension-support/role-kernel.generated.ts
)
managed_destinations=("${files[@]}" "$managed_skill_relative" "$expert_skill_relative" extensions/project-conversation.ts "${obsolete_files[@]}")
for relative in "${managed_destinations[@]}"; do
  destination="$destination_root/$relative"
  if [[ -e "$destination" || -L "$destination" ]]; then
    if [[ ! -f "$destination" || -L "$destination" ]]; then
      printf 'unsafe managed plugin destination (expected absent or regular file): %s\n' "$destination" >&2
      exit 1
    fi
  fi
done

python3 "$repo_root/scripts/manage-prime-agent-global-assets.py" preflight   "$source_root" "$destination_root" --action "$global_drift_action"

managed_skill_dir="$destination_root/skills/prime-claw-oversee-episode"
expert_skill_dir="$destination_root/skills/prime-claw-expert-review"
cleanup_args=(validate --plugin-root "$destination_root")
if [[ "$plugin_target_mode" == "user-global" ]]; then
  cleanup_args+=(--coding-agent-root "${PRIME_AGENT_CODING_AGENT_DIR:-$HOME/.prime/agent}")
fi
python3 "$repo_root/scripts/cleanup-retired-prime-agent-expert-review.py" "${cleanup_args[@]}"

mkdir -p "$destination_root/extensions" "$destination_root/extension-support"   "$destination_root/skills/goals-and-heartbeats" "$destination_root/skills/project-templates"   "$destination_root/workflows" "$managed_skill_dir" "$expert_skill_dir"
role_apply_args=(
  apply "$role_protocol_source" "$role_kernel_source" "$legacy_append_source" "$destination_root"
)
if [[ -n "$role_receipt" ]]; then
  role_apply_args+=(--receipt "$role_receipt")
fi
python3 "$repo_root/scripts/manage-prime-agent-role-protocol.py" "${role_apply_args[@]}"
cleanup_args[0]=remove
python3 "$repo_root/scripts/cleanup-retired-prime-agent-expert-review.py" "${cleanup_args[@]}"
rm -f "$destination_root/extensions/project-conversation.ts"
for relative in "${obsolete_files[@]}"; do
  rm -f "$destination_root/$relative"
done
for relative in "${files[@]}"; do
  install -m 0644 "$source_root/$relative" "$destination_root/$relative"
done
python3 "$repo_root/scripts/manage-prime-agent-global-assets.py" apply   "$source_root" "$destination_root" --action "$global_drift_action"
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
