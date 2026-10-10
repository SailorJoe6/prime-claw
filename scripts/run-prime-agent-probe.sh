#!/bin/sh
# Run native Prime Agent probes without exposing the operator's persistent config.
set -eu

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/run-prime-agent-probe.sh <prime-agent command> [args ...]" >&2
  exit 64
fi

probe_root="$(mktemp -d "${TMPDIR:-/tmp}/prime-claw-prime-agent-probe.XXXXXX")"
probe_command="$1"
wait_for_container_daemon_exit() {
  attempts=0
  while ps -eo args= | grep -E -- '--mode(=| )daemon' | grep -v grep >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 100 ]; then
      echo "error: isolated Prime Agent daemon did not stop before probe cleanup" >&2
      return 1
    fi
    sleep 0.1
  done
}
cleanup() {
  # Prime Agent v0.9.8 RPC/text probes can start a detached supervisor. In the
  # disposable Docker boundary, stop that exact isolated generation before
  # removing its config/registry files; otherwise later probes see a stale
  # generation or a compromised registry guard. Never stop a host daemon.
  if [ -f /.dockerenv ]; then
    PRIME_AGENT_CODING_AGENT_DIR="$probe_root/config" \
    PRIME_AGENT_SESSION_DIR="$probe_root/sessions" \
      "$probe_command" shutdown --force --json >/dev/null 2>&1 || true
    wait_for_container_daemon_exit
  fi
  rm -rf -- "$probe_root"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$probe_root/config" "$probe_root/sessions"
chmod 700 "$probe_root" "$probe_root/config" "$probe_root/sessions"

# Container test suites reuse one disposable runtime. Quiesce any supervisor
# from an earlier probe and wait for its process to exit before starting this
# isolated generation. The host path never performs this action.
if [ -f /.dockerenv ]; then
  "$probe_command" shutdown --force --json >/dev/null 2>&1 || true
  wait_for_container_daemon_exit
fi

# --session-dir only redirects conversation artifacts. Prime Agent settings use
# PRIME_AGENT_CODING_AGENT_DIR, so isolate both stores for every probe.
PRIME_AGENT_CODING_AGENT_DIR="$probe_root/config" \
PRIME_AGENT_SESSION_DIR="$probe_root/sessions" \
  "$@"
