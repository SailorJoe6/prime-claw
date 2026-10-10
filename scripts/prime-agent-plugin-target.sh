#!/usr/bin/env bash
# Shared fail-closed target selection for prime-claw plugin apply/check.
# Source this file, then call select_prime_agent_plugin_target "$@".

prime_agent_plugin_target_usage() {
  printf 'usage: %s [--user-global]\n' "${0##*/}" >&2
  printf '  development/test (owned bridge fixture required; prefer Tier 1): PRIME_AGENT_PLUGIN_ROOT=/explicit/isolated/root %s\n' "${0##*/}" >&2
  printf '  authorized Gate B coordinator on accepted primary main only: %s --user-global\n' "${0##*/}" >&2
}

_prime_claw_canonical_path() {
  python3 - "$1" <<'PY'
import os
import sys
print(os.path.realpath(os.path.abspath(sys.argv[1])))
PY
}

select_prime_agent_plugin_target() {
  if [[ "$#" -gt 1 ]]; then
    prime_agent_plugin_target_usage
    return 64
  fi

  local requested="${1:-}"
  local explicit_root="${PRIME_AGENT_PLUGIN_ROOT:-}"
  local user_root
  user_root="${HOME:?HOME must be set}/.prime/agent"

  if [[ -n "$requested" && "$requested" != "--user-global" ]]; then
    prime_agent_plugin_target_usage
    printf 'error: unknown argument: %s\n' "$requested" >&2
    return 64
  fi

  if [[ "$requested" == "--user-global" ]]; then
    if [[ -n "$explicit_root" ]]; then
      printf 'error: --user-global cannot be combined with PRIME_AGENT_PLUGIN_ROOT\n' >&2
      return 64
    fi
    local git_dir git_common branch
    if ! git_dir="$(git -C "$repo_root" rev-parse --path-format=absolute --git-dir 2>/dev/null)" \
      || ! git_common="$(git -C "$repo_root" rev-parse --path-format=absolute --git-common-dir 2>/dev/null)"; then
      printf 'error: --user-global requires a primary Git checkout on main\n' >&2
      return 1
    fi
    git_dir="$(_prime_claw_canonical_path "$git_dir")"
    git_common="$(_prime_claw_canonical_path "$git_common")"
    if [[ "$git_dir" != "$git_common" ]]; then
      printf 'error: --user-global is refused from a linked Git worktree; use Docker Tier 1 or an isolated PRIME_AGENT_PLUGIN_ROOT with owned bridge state\n' >&2
      return 1
    fi
    if ! branch="$(git -C "$repo_root" symbolic-ref --quiet --short HEAD 2>/dev/null)" \
      || [[ "$branch" != "main" ]]; then
      printf 'error: --user-global requires the primary checkout on branch main; use Docker Tier 1 or an isolated PRIME_AGENT_PLUGIN_ROOT with owned bridge state\n' >&2
      return 1
    fi
    destination_root="$user_root"
    user_agents_root="${PRIME_CLAW_USER_AGENTS_ROOT:-$HOME/.agents}"
    plugin_target_mode="user-global"
    return 0
  fi

  if [[ -z "$explicit_root" ]]; then
    printf 'error: explicit PRIME_AGENT_PLUGIN_ROOT or --user-global required; use Docker tier 1 for plugin development and tests\n' >&2
    return 64
  fi
  destination_root="$explicit_root"
  # Explicit roots use a contained user-scope fixture by default so candidate
  # validation cannot mutate the caller's real ~/.agents tree. Sandboxed callers
  # may override this with an equally isolated PRIME_CLAW_USER_AGENTS_ROOT.
  user_agents_root="${PRIME_CLAW_USER_AGENTS_ROOT:-$destination_root/.agents}"
  plugin_target_mode="explicit-root"

  # On a host, spelling the user-global destination as an explicit root must
  # not bypass the conspicuous activation flag. Tier 1 intentionally targets
  # the container's own user-global directory; /.dockerenv proves that the
  # shared host generation is outside this filesystem boundary.
  local canonical_destination canonical_user
  canonical_destination="$(_prime_claw_canonical_path "$destination_root")"
  canonical_user="$(_prime_claw_canonical_path "$user_root")"
  if [[ "$canonical_destination" == "$canonical_user" && ! -f /.dockerenv ]]; then
    printf 'error: PRIME_AGENT_PLUGIN_ROOT resolves to the user-global destination; use the authorized Gate B coordinator from primary main, or Docker Tier 1 for testing\n' >&2
    return 1
  fi
}
