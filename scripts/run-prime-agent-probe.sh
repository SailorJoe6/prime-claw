#!/bin/sh
# Run native Prime Agent probes without exposing the operator's persistent config.
set -eu

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/run-prime-agent-probe.sh <prime-agent command> [args ...]" >&2
  exit 64
fi

probe_root="$(mktemp -d "${TMPDIR:-/tmp}/prime-claw-prime-agent-probe.XXXXXX")"
cleanup() {
  rm -rf -- "$probe_root"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$probe_root/config" "$probe_root/sessions"
chmod 700 "$probe_root" "$probe_root/config" "$probe_root/sessions"

# --session-dir only redirects conversation artifacts. Prime Agent settings use
# PRIME_AGENT_CODING_AGENT_DIR, so isolate both stores for every probe.
PRIME_AGENT_CODING_AGENT_DIR="$probe_root/config" \
PRIME_AGENT_SESSION_DIR="$probe_root/sessions" \
  "$@"
