#!/bin/bash
# test-all.sh — prime-claw dumb tier sequencer (slice 3, prime-claw-blw.3).
#
# tier 0 -> tier 1 -> (tier 2 only with --with-sandbox); fail-fast; prints a
# tier summary. Logs land in the gitignored .test-results/ directory.
# Deliberately dumb: no retries, no parallelism, no selection logic beyond
# the pytest markers (tests/conftest.py owns the tier policy; pytest.ini
# registers the markers).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

WITH_SANDBOX=0
case "${1:-}" in
    "") ;;
    --with-sandbox) WITH_SANDBOX=1 ;;
    -h|--help)
        echo "usage: scripts/test-all.sh [--with-sandbox]"
        echo "  runs tier 0 + tier 1; tier 2 (OpenShell sandbox) only with --with-sandbox"
        exit 0
        ;;
    *)
        echo "test-all: unknown argument: $1" >&2
        echo "usage: scripts/test-all.sh [--with-sandbox]" >&2
        exit 64
        ;;
esac

PY="${TEST_ALL_PYTHON:-python3}"
command -v "$PY" >/dev/null 2>&1 || { echo "test-all: $PY not found on PATH" >&2; exit 1; }
"$PY" -m pytest --version >/dev/null 2>&1 || { echo "test-all: $PY -m pytest not available" >&2; exit 1; }

RUN_DIR=".test-results/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$RUN_DIR"

SUMMARY=""
FAILED=""

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
    FAILED="$name"
    return "$rc"
}

# Tier 0 — host, no environment. Plain pytest is the tier-0 default:
# tests/conftest.py skips container/sandbox tests without an explicit -m.
run_tier "tier0" "$PY" -m pytest tests/ -q || {
    printf "test-all: FAILED at tier0\ntier summary:\n%s" "$SUMMARY"
    exit 1
}

# Tier 1 — slim container. Preflight the two things the session fixture
# needs, for a clear fail-fast message instead of per-test fixture errors.
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
run_tier "tier1" "$PY" -m pytest tests/ -q -m container || {
    printf "test-all: FAILED at tier1\ntier summary:\n%s" "$SUMMARY"
    exit 1
}

# Tier 2 — host-orchestrated OpenShell sandbox tests, only on explicit request.
if [ "$WITH_SANDBOX" -eq 1 ]; then
    run_tier "tier2" "$PY" -m pytest tests/ -q -m sandbox || {
        printf "test-all: FAILED at tier2\ntier summary:\n%s" "$SUMMARY"
        exit 1
    }
else
    echo "test-all: tier2 skipped (pass --with-sandbox to include)"
fi

printf "test-all: OK\ntier summary:\n%s" "$SUMMARY"
echo "test-all: logs in $RUN_DIR"
