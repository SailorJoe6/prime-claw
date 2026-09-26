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

if [ "$retain_root" = true ]; then
  # Keep the native worker socket below macOS's 104-byte AF_UNIX path field.
  # The private root is still canonicalized before it becomes TMPDIR.
  probe_root="$(mktemp -d /tmp/pcp.XXXXXX)"
else
  probe_root="$(mktemp -d "${TMPDIR:-/tmp}/prime-claw-prime-agent-probe.XXXXXX")"
fi
cleanup() {
  if [ "$retain_root" = false ]; then
    rm -rf -- "$probe_root"
  fi
}
trap cleanup EXIT HUP INT TERM

if ! physical_root="$(cd "$probe_root" && pwd -P)"; then
  echo "Could not canonicalize isolated probe root: $probe_root" >&2
  exit 65
fi
probe_root="$physical_root"
if [ "$retain_root" = true ]; then
  printf 'Retained isolated Prime Agent probe root: %s\n' "$probe_root" >&2
fi

mkdir -p "$probe_root/config" "$probe_root/sessions"
chmod 700 "$probe_root" "$probe_root/config" "$probe_root/sessions"

# --session-dir only redirects conversation artifacts. Prime Agent settings use
# PRIME_AGENT_CODING_AGENT_DIR, so isolate both stores for every probe.
# Retained mode also isolates HOME and TMPDIR (the daemon socket namespace).
# It never deletes the root: a detached daemon's teardown must be proved first.
if [ "$retain_root" = true ]; then
  mkdir -p "$probe_root/home" "$probe_root/tmp"
  chmod 700 "$probe_root/home" "$probe_root/tmp"
  # v0.9.6 uses this TMPDIR for both daemon.sock and the longer worker socket.
  # Count encoded bytes after canonicalization and reserve one NUL in sun_path[104].
  # A later fixture must separately check any custom --daemon-socket it chooses.
  socket_dir="$probe_root/tmp/prime-agent-$(id -u)"
  supervisor_socket="$socket_dir/daemon.sock"
  worker_socket="$socket_dir/worker-xxxxxxxxxxxx-xxxxxxxxxxxx.sock"
  supervisor_bytes="$(LC_ALL=C printf '%s' "$supervisor_socket" | LC_ALL=C wc -c | tr -d '[:space:]')"
  worker_bytes="$(LC_ALL=C printf '%s' "$worker_socket" | LC_ALL=C wc -c | tr -d '[:space:]')"
  if [ "$supervisor_bytes" -gt 103 ] || [ "$worker_bytes" -gt 103 ]; then
    echo "Retained probe root exceeds the 103-byte Unix socket pathname budget" >&2
    exit 65
  fi
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
