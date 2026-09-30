#!/usr/bin/env bash
# test-tier1.sh — dumb host-side driver for the prime-claw tier-1 test suite.
#
# Scope (see .ralph/plans/EXECUTION_PLAN.md, Slice 1-3): build the slim
# tier-1 image (cached), start ONE ephemeral container, run the suite inside
# it, collect results, destroy the container. No cleverness, no growing
# harness. Slice 1 delivers build + smoke only; later slices add the
# prime-agent install (.env-selected) and the actual suite execution.
#
# Usage:
#   scripts/test-tier1.sh           build image (cached), run smoke, destroy
#   scripts/test-tier1.sh --rebuild build without cache, run smoke, destroy
#   scripts/test-tier1.sh --dry-run print the planned docker commands, run none
#   scripts/test-tier1.sh --help    show this help
#
# Exit status: 0 only if every step succeeds; non-zero on any failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="prime-claw-test-tier1"
DOCKERFILE="docker/test.Dockerfile"

usage() {
    sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

die() { echo "error: $*" >&2; exit 1; }

NO_CACHE=0
DRY_RUN=0
for arg in "$@"; do
    case "$arg" in
        --help|-h) usage; exit 0 ;;
        --rebuild) NO_CACHE=1 ;;
        --dry-run) DRY_RUN=1 ;;
        *) usage >&2; die "unknown argument: $arg" ;;
    esac
done

command -v docker >/dev/null 2>&1 || die "docker not found on PATH"
docker info >/dev/null 2>&1 || die "docker daemon is not reachable"
[ -f "$REPO_ROOT/$DOCKERFILE" ] || die "missing $DOCKERFILE"

BUILD_ARGS=()
if [ "$NO_CACHE" -eq 1 ]; then
    BUILD_ARGS+=(--no-cache)
fi

# Smoke command: report the toolchain the tier-1 suite depends on. Later
# slices replace this with the prime-agent install + real suite entrypoint.
SMOKE_CMD='node --version && python3 --version && pytest --version'

echo "tier-1 driver: image=$IMAGE dockerfile=$DOCKERFILE"
echo "tier-1 driver: build (no_cache=$NO_CACHE)"
if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: docker build ${BUILD_ARGS[*]:-} -f $DOCKERFILE -t $IMAGE ."
    echo "dry-run: docker run --rm $IMAGE bash -lc '$SMOKE_CMD'"
    exit 0
fi

# ${BUILD_ARGS[@]+...} guard: bash 3.2 (macOS default) treats expanding an
# empty array under set -u as an unbound-variable error.
docker build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} -f "$REPO_ROOT/$DOCKERFILE" -t "$IMAGE" "$REPO_ROOT"

echo "tier-1 driver: smoke run (ephemeral container, --rm destroys it)"
docker run --rm "$IMAGE" bash -lc "$SMOKE_CMD"

echo "tier-1 driver: OK — image built, smoke passed, container destroyed"
