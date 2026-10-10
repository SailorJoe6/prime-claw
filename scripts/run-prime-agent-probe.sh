#!/bin/sh
# Run native Prime Agent probes without exposing the operator's persistent config.
set -eu

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/run-prime-agent-probe.sh <prime-agent command> [args ...]" >&2
  exit 64
fi

probe_root="$(mktemp -d "${TMPDIR:-/tmp}/prime-claw-prime-agent-probe.XXXXXX")"
probe_command="$1"
probe_tmp="$probe_root/tmp"
probe_registry="$probe_root/supervisor-owners"
shutdown_status=0
shutdown_result=""
is_prime_agent_probe() {
  case "$(basename "$probe_command")" in
    prime-agent*) return 0 ;;
    *) return 1 ;;
  esac
}
container_probe_daemon_running() {
  for cmdline in /proc/[0-9]*/cmdline; do
    command=$(tr '\000' ' ' 2>/dev/null <"$cmdline" || true)
    case "$command" in
      *"$probe_tmp"*) return 0 ;;
    esac
  done
  return 1
}
wait_for_container_daemon_exit() {
  attempts=0
  while container_probe_daemon_running; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 100 ]; then
      echo "error: isolated Prime Agent daemon did not stop before probe cleanup" >&2
      echo "isolated shutdown status: $shutdown_status" >&2
      [ -z "$shutdown_result" ] || echo "isolated shutdown response: $shutdown_result" >&2
      for cmdline in /proc/[0-9]*/cmdline; do
        command=$(tr '\000' ' ' 2>/dev/null <"$cmdline" || true)
        case "$command" in
          *"$probe_tmp"*) echo "remaining isolated process: ${cmdline#/proc/}: $command" >&2 ;;
        esac
      done
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
  if [ -f /.dockerenv ] && is_prime_agent_probe; then
    shutdown_status=0
    shutdown_result=$(TMPDIR="$probe_tmp" \
      PRIME_AGENT_CODING_AGENT_DIR="$probe_root/config" \
      PRIME_AGENT_SESSION_DIR="$probe_root/sessions" \
      PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_REGISTRY_DIR="$probe_registry" \
      "$probe_command" shutdown --force --json 2>&1) || shutdown_status=$?
    wait_for_container_daemon_exit
  fi
  rm -rf -- "$probe_root"
}
trap cleanup EXIT HUP INT TERM

mkdir -p "$probe_root/config" "$probe_root/sessions" "$probe_tmp"
chmod 700 "$probe_root" "$probe_root/config" "$probe_root/sessions" "$probe_tmp"

# --session-dir only redirects conversation artifacts. Prime Agent settings use
# PRIME_AGENT_CODING_AGENT_DIR. Native Prime Agent probes also get a unique
# TMPDIR and supervisor registry. Prime Agent derives its default socket from
# TMPDIR, so its supported public shutdown command remains fully isolated.
if is_prime_agent_probe; then
  shift
  TMPDIR="$probe_tmp" \
  PRIME_AGENT_CODING_AGENT_DIR="$probe_root/config" \
  PRIME_AGENT_SESSION_DIR="$probe_root/sessions" \
  PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_REGISTRY_DIR="$probe_registry" \
    "$probe_command" "$@"
else
  PRIME_AGENT_CODING_AGENT_DIR="$probe_root/config" \
  PRIME_AGENT_SESSION_DIR="$probe_root/sessions" \
    "$@"
fi
