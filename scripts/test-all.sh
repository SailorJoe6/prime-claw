#!/bin/bash
# test-all.sh — complete, fail-fast prime-claw test sequencer.
#
# Runs tier 0 (host-safe unit/static), tier 1 (Docker plugin/runtime), then
# tier 2 (Docker PostgreSQL/gbrain integration). Exact --with-lifecycle opt-in
# adds the one registered host observer after all three tiers pass.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

WITH_LIFECYCLE=0
if [ "$#" -gt 1 ]; then
    echo "test-all: expected zero arguments or exactly --with-lifecycle" >&2
    echo "usage: scripts/test-all.sh [--with-lifecycle]" >&2
    exit 64
fi
case "${1:-}" in
    "") ;;
    -h|--help)
        echo "usage: scripts/test-all.sh [--with-lifecycle]"
        echo "  default: tiers 0, 1, and 2 sequentially"
        echo "  --with-lifecycle: add the one registered host observer after tier 2"
        exit 0
        ;;
    --with-lifecycle)
        WITH_LIFECYCLE=1
        ;;
    --with-sandbox)
        echo "test-all: --with-sandbox is retired; use explicit --with-lifecycle" >&2
        exit 64
        ;;
    *)
        echo "test-all: unknown argument: $1" >&2
        echo "usage: scripts/test-all.sh [--with-lifecycle]" >&2
        exit 64
        ;;
esac

PY="${TEST_ALL_PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || { echo "test-all: $PY not found on PATH" >&2; exit 1; }
env -u PYTEST_ADDOPTS -u PRIME_CLAW_LIFECYCLE_SEQUENCER \
    "$PY" -m pytest --version >/dev/null 2>&1 || {
    echo "test-all: $PY -m pytest not available" >&2
    exit 1
}

RUN_DIR=".test-results/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$RUN_DIR"

SUMMARY=""

run_tier() {
    name="$1"; shift
    log="$RUN_DIR/$name.log"
    echo "test-all: running $name (log: $log)"
    start=$SECONDS
    "$@" >"$log" 2>&1
    rc=$?
    elapsed=$((SECONDS - start))
    if [ "$rc" -eq 0 ]; then
        line="$name: PASS (${elapsed}s)"
        SUMMARY="${SUMMARY}  ${line}
"
        echo "test-all: $line"
        return 0
    fi
    line="$name: FAIL (rc=$rc, ${elapsed}s; log: $log)"
    SUMMARY="${SUMMARY}  ${line}
"
    echo "test-all: $line" >&2
    echo "test-all: last 40 lines of $log:" >&2
    tail -40 "$log" >&2
    return "$rc"
}

# Tier 0: plain pytest. Collection policy skips every environment tier.
run_tier "tier0" env -u PYTEST_ADDOPTS -u PRIME_CLAW_LIFECYCLE_SEQUENCER \
    "$PY" -m pytest tests/ -q || {
    printf "test-all: FAILED at tier0\ntier summary:\n%s" "$SUMMARY"
    exit 1
}

# Tier 1: exact supported marker selection and a reachable Docker daemon.
if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
    echo "test-all: tier 1 requires a reachable Docker daemon" >&2
    printf "tier summary:\n%s" "$SUMMARY"
    exit 1
fi
if [ -z "${TIER1_ENV_FILE:-}" ] && [ ! -f .env ]; then
    echo "test-all: tier 1 needs .env (cp .env.example .env and set exactly one selector)" >&2
    printf "tier summary:\n%s" "$SUMMARY"
    exit 1
fi
run_tier "tier1" env -u PYTEST_ADDOPTS -u PRIME_CLAW_LIFECYCLE_SEQUENCER \
    "$PY" -m pytest tests/ -q -m container || {
    printf "test-all: FAILED at tier1\ntier summary:\n%s" "$SUMMARY"
    exit 1
}

# Tier 2: the real stack runs only through the Docker integration launcher.
run_tier "tier2" env -u PYTEST_ADDOPTS -u PRIME_CLAW_LIFECYCLE_SEQUENCER \
    "$REPO_ROOT/scripts/test-integration.sh" || {
    printf "test-all: FAILED at tier2\ntier summary:\n%s" "$SUMMARY"
    exit 1
}

# Lifecycle: exact one-shot host observer, admitted only after all tiers pass.
if [ "$WITH_LIFECYCLE" -eq 1 ]; then
    run_tier "lifecycle" env -u PYTEST_ADDOPTS \
        PRIME_CLAW_LIFECYCLE_SEQUENCER=1 \
        LIFECYCLE_RESULTS_ROOT="$REPO_ROOT/$RUN_DIR/lifecycle-evidence" \
        "$PY" -m pytest \
        "tests/test_lifecycle_destroy.py::test_destroy_only_generated_target" \
        -q --run-lifecycle || {
        printf "test-all: FAILED at lifecycle\ntier summary:\n%s" "$SUMMARY"
        exit 1
    }
fi

printf "test-all: OK\ntier summary:\n%s" "$SUMMARY"
echo "test-all: logs in $RUN_DIR"
