#!/usr/bin/env bash
# test-tier1.sh — dumb host-side driver for the prime-claw tier-1 test suite.
#
# Scope (see .ralph/plans/EXECUTION_PLAN.md): build the slim tier-1 image
# (cached), start ONE ephemeral container, install prime-agent per .env,
# apply + check the plugin INSIDE the container against the container's own
# ~/.prime/agent, destroy the container. No cleverness, no growing harness.
# Slice 3 adds the actual suite execution on top of this contract.
#
# Install selection (.env at the repo root, gitignored; see .env.example).
# Set EXACTLY ONE selector — the driver fails fast on neither/both:
#   PRIME_AGENT_PINNED=<version>   vendor installer (install.sh) at an exact
#                                  released version — the same mechanism
#                                  bin/prime-claw uses (prime-agent is not on
#                                  the public npm registry; releases are
#                                  served from the vendor's download base)
#   PRIME_AGENT_SOURCE=<abs path>  local fork checkout; the host runs the
#                                  fork's release:pack and the tarball set is
#                                  staged into the container via file: URLs
#
# .env format: plain KEY=value lines, no inline comments. Tests may point
# TIER1_ENV_FILE at another env file; default is <repo>/.env.
#
# Usage:
#   scripts/test-tier1.sh           build image, install prime-agent per
#                                   .env, apply + check plugin in-container
#   scripts/test-tier1.sh --rebuild build without cache, then the same
#   scripts/test-tier1.sh --smoke   toolchain smoke only (no .env needed,
#                                   no prime-agent install)
#   scripts/test-tier1.sh --probe   after apply/check, run a container-side
#                                   RPC probe (get_commands) against the
#                                   container's installed plugin
#   scripts/test-tier1.sh --dry-run print the planned steps, run none
#   scripts/test-tier1.sh --help    show this help
#
# Network policy: image build and the in-container prime-agent install step
# use the network; nothing else does.
#
# Exit status: 0 only if every step succeeds; non-zero on any failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="prime-claw-test-tier1"
DOCKERFILE="docker/test.Dockerfile"
ENV_FILE="${TIER1_ENV_FILE:-$REPO_ROOT/.env}"
# release:pack refuses --out-dir outside the fork's own (gitignored)
# packages/coding-agent/release tree; stage in a named subdirectory of it.
STAGE_SUBDIR="packages/coding-agent/release/tier1"

usage() {
    sed -n '2,35p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

die() { echo "error: $*" >&2; exit 1; }

NO_CACHE=0
DRY_RUN=0
SMOKE=0
PROBE=0
for arg in "$@"; do
    case "$arg" in
        --help|-h) usage; exit 0 ;;
        --rebuild) NO_CACHE=1 ;;
        --dry-run) DRY_RUN=1 ;;
        --smoke) SMOKE=1 ;;
        --probe) PROBE=1 ;;
        *) usage >&2; die "unknown argument: $arg" ;;
    esac
done

# Filesystem check only — safe on informational paths (--help/--dry-run).
# Docker CLI and daemon checks live on the real-execution path below so that
# --help and --dry-run never contact Docker at all.
[ -f "$REPO_ROOT/$DOCKERFILE" ] || die "missing $DOCKERFILE"

# --- Install selection (skipped in --smoke mode) ---------------------------
# Conservative parse: plain KEY=value lines only; the file is never sourced.
read_selector() {
    [ -f "$ENV_FILE" ] || return 0
    sed -n "s/^$1=//p" "$ENV_FILE" | tail -1 \
        | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

PINNED=""
SOURCE=""
if [ "$SMOKE" -eq 0 ]; then
    [ -f "$ENV_FILE" ] || die "missing env file: $ENV_FILE (cp .env.example .env and set exactly one selector)"
    PINNED="$(read_selector PRIME_AGENT_PINNED)"
    SOURCE="$(read_selector PRIME_AGENT_SOURCE)"
    if [ -n "$PINNED" ] && [ -n "$SOURCE" ]; then
        die "both PRIME_AGENT_PINNED and PRIME_AGENT_SOURCE are set in $ENV_FILE — set exactly one"
    fi
    if [ -z "$PINNED" ] && [ -z "$SOURCE" ]; then
        die "neither PRIME_AGENT_PINNED nor PRIME_AGENT_SOURCE is set in $ENV_FILE — set exactly one (see .env.example)"
    fi
    if [ -n "$SOURCE" ]; then
        case "$SOURCE" in
            /*) ;;
            *) die "PRIME_AGENT_SOURCE must be an absolute path: $SOURCE" ;;
        esac
        [ -d "$SOURCE" ] || die "PRIME_AGENT_SOURCE is not a directory: $SOURCE"
        [ -f "$SOURCE/scripts/pack-prime-agent-release.mjs" ] \
            || die "PRIME_AGENT_SOURCE lacks scripts/pack-prime-agent-release.mjs: $SOURCE"
    fi
fi

BUILD_ARGS=()
if [ "$NO_CACHE" -eq 1 ]; then
    BUILD_ARGS+=(--no-cache)
fi

# Smoke command (slice-1 contract): report the toolchain only.
SMOKE_CMD='node --version && python3 --version && pytest --version'

echo "tier-1 driver: image=$IMAGE dockerfile=$DOCKERFILE"
if [ "$SMOKE" -eq 1 ]; then
    echo "tier-1 driver: mode=smoke"
elif [ -n "$PINNED" ]; then
    echo "tier-1 driver: mode=pinned PRIME_AGENT_VERSION=$PINNED via vendor installer (env: $ENV_FILE)"
else
    echo "tier-1 driver: mode=source fork=$SOURCE (env: $ENV_FILE)"
fi
if [ "$PROBE" -eq 1 ]; then
    echo "tier-1 driver: container RPC probe enabled (--probe)"
fi
echo "tier-1 driver: build (no_cache=$NO_CACHE)"

if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: docker build ${BUILD_ARGS[*]:-} -f $DOCKERFILE -t $IMAGE ."
    if [ "$SMOKE" -eq 1 ]; then
        echo "dry-run: docker run --rm $IMAGE bash -lc '$SMOKE_CMD'"
    elif [ -n "$SOURCE" ]; then
        PLAN_VERSION="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' \
            "$SOURCE/packages/coding-agent/package.json" | head -1)"
        echo "dry-run: stage fork release: build dist if missing, then node $SOURCE/scripts/pack-prime-agent-release.mjs --base-url file:///stage --out-dir $SOURCE/$STAGE_SUBDIR"
        echo "dry-run: docker run --rm -v $REPO_ROOT:/workspace:ro -v $SOURCE/$STAGE_SUBDIR/artifacts:/stage/releases/v$PLAN_VERSION:ro $IMAGE bash -lc '<npm install -g staged tarball> && prime-agent --version && apply && check'"
    else
        echo "dry-run: docker run --rm -v $REPO_ROOT:/workspace:ro $IMAGE bash -lc '<PRIME_AGENT_VERSION=$PINNED curl install.sh | sh> && prime-agent --version && apply && check'"
    fi
    exit 0
fi

# Readiness checks — real execution path only. Informational paths
# (--help/--dry-run) have already exited above and never reach Docker.
command -v docker >/dev/null 2>&1 || die "docker not found on PATH"
docker info >/dev/null 2>&1 || die "docker daemon is not reachable"

# ${BUILD_ARGS[@]+...} guard: bash 3.2 (macOS default) treats expanding an
# empty array under set -u as an unbound-variable error.
docker build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} -f "$REPO_ROOT/$DOCKERFILE" -t "$IMAGE" "$REPO_ROOT"

if [ "$SMOKE" -eq 1 ]; then
    echo "tier-1 driver: smoke run (ephemeral container, --rm destroys it)"
    docker run --rm "$IMAGE" bash -lc "$SMOKE_CMD"
    echo "tier-1 driver: OK — image built, smoke passed, container destroyed"
    exit 0
fi

MOUNTS=(-v "$REPO_ROOT:/workspace:ro")
if [ -n "$SOURCE" ]; then
    # Stage the fork release on the host: build dist if missing, then pack.
    MISSING_DIST=0
    for p in packages/coding-agent packages/agent packages/ai packages/tui; do
        [ -d "$SOURCE/$p/dist" ] || MISSING_DIST=1
    done
    if [ "$MISSING_DIST" -eq 1 ]; then
        echo "tier-1 driver: building fork dist (npm run build in $SOURCE)"
        (cd "$SOURCE" && npm run build)
    fi
    echo "tier-1 driver: release:pack -> $SOURCE/$STAGE_SUBDIR"
    node "$SOURCE/scripts/pack-prime-agent-release.mjs" \
        --base-url file:///stage --out-dir "$SOURCE/$STAGE_SUBDIR"
    TARBALL="$(ls "$SOURCE/$STAGE_SUBDIR/artifacts/"prime-agent-*.tgz \
        | grep -v -E 'prime-agent-(ai|core|tui)-' | head -1 || true)"
    [ -n "$TARBALL" ] || die "release:pack produced no prime-agent tarball in $SOURCE/$STAGE_SUBDIR/artifacts"
    PA_VERSION="$(basename "$TARBALL" .tgz)"
    PA_VERSION="${PA_VERSION#prime-agent-}"
    echo "tier-1 driver: staged fork release v$PA_VERSION"
    MOUNTS+=(-v "$SOURCE/$STAGE_SUBDIR/artifacts:/stage/releases/v$PA_VERSION:ro")
    INSTALL="npm install -g /stage/releases/v$PA_VERSION/prime-agent-$PA_VERSION.tgz"
else
    INSTALL="export PRIME_AGENT_VERSION='$PINNED' PRIME_AGENT_INSTALLER_PLAIN=1 PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL=0; curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh"
fi

CONTAINER_CMD="set -euo pipefail; $INSTALL && prime-agent --version && /workspace/scripts/apply-prime-agent-plugin.sh && /workspace/scripts/check-prime-agent-plugin.sh"
if [ "$PROBE" -eq 1 ]; then
    # Container-side RPC probe: load the container's real installed
    # extensions (no --no-extensions) and ask for the native command list.
    # timeout(1) gives the probe a hard deadline.
    CONTAINER_CMD="$CONTAINER_CMD && mkdir -p /tmp/tier1-probe && printf '%s\n' '{\"id\":\"loader\",\"type\":\"get_commands\"}' | timeout 60 prime-agent --mode rpc --offline --no-session --no-skills --no-prompt-templates --no-context-files --cwd /tmp/tier1-probe"
fi

echo "tier-1 driver: container run (ephemeral, --rm): install prime-agent, apply + check plugin"
docker run --rm ${MOUNTS[@]+"${MOUNTS[@]}"} "$IMAGE" bash -lc "$CONTAINER_CMD"

echo "tier-1 driver: OK — image built, prime-agent installed, plugin applied + checked, container destroyed"
