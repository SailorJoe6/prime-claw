#!/bin/sh
# Run native Prime Agent probes without exposing the operator's persistent config.
set -eu

retain_root=false
if [ "${1:-}" = "--retain-root" ]; then
  retain_root=true
  shift
fi
if [ "$#" -eq 0 ]; then
  echo "usage: scripts/run-prime-agent-probe.sh [--retain-root] <prime-agent command> [args ...]" >&2
  exit 64
fi

probe_root="$(mktemp -d "${TMPDIR:-/tmp}/prime-claw-prime-agent-probe.XXXXXX")"
probe_root="$(cd "$probe_root" && pwd -P)"
cleanup() {
  if [ "$retain_root" = false ]; then
    rm -rf -- "$probe_root"
  fi
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$probe_root/config" "$probe_root/sessions"
chmod 700 "$probe_root" "$probe_root/config" "$probe_root/sessions"

# --session-dir only redirects conversation artifacts. Prime Agent settings use
# PRIME_AGENT_CODING_AGENT_DIR, so isolate both stores for every probe.
# Retained mode also isolates HOME and TMPDIR (the daemon socket namespace).
# It never deletes the root: a detached daemon's teardown must be proved first.
if [ "$retain_root" = true ]; then
  mkdir -p "$probe_root/home" "$probe_root/tmp"
  chmod 700 "$probe_root/home" "$probe_root/tmp"
  printf 'Retained isolated Prime Agent probe root: %s\n' "$probe_root" >&2
  # A daemon probe must not inherit the caller's worker role, supervisor socket,
  # provider credentials, or other Prime Agent internal routing variables.
  env -i \
    PATH="${PATH:-/usr/bin:/bin}" LANG="${LANG:-C}" \
    HOME="$probe_root/home" TMPDIR="$probe_root/tmp" \
    PRIME_CLAW_PROBE_ROOT="$probe_root" \
    PRIME_AGENT_CODING_AGENT_DIR="$probe_root/config" \
    PRIME_AGENT_SESSION_DIR="$probe_root/sessions" \
    "$@"
else
  PRIME_CLAW_PROBE_ROOT="$probe_root" \
  PRIME_AGENT_CODING_AGENT_DIR="$probe_root/config" \
  PRIME_AGENT_SESSION_DIR="$probe_root/sessions" \
    "$@"
fi
