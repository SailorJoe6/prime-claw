#!/usr/bin/env bash
# test-tier1.sh — dumb host-side driver for the prime-claw tier-1 test suite.
#
# Scope (see .ralph/plans/EXECUTION_PLAN.md): build the slim tier-1 image
# (cached), start ONE ephemeral container, install prime-agent per .env,
# apply + check the plugin INSIDE the container against the explicitly selected
# /root/.prime/agent, destroy the container. No cleverness, no growing harness.
# Slice 3 adds the actual suite execution on top of this contract.
#
# Install selection (.env at the repo root, gitignored; see .env.example).
# Set EXACTLY ONE selector — the driver fails fast on neither/both:
#   PRIME_AGENT_PINNED=<version>   vendor installer (install.sh) at an exact
#                                  released version — the same mechanism
#                                  bin/prime-claw uses (prime-agent is not on
#                                  the public npm registry; releases are
#                                  served from the vendor's download base)
#   PRIME_AGENT_SOURCE=<abs path>  local fork checkout; every real run
#                                  rebuilds the fork's dist FRESH (the fork
#                                  build does not clean dist, so the four
#                                  pack-consumed dist dirs are removed
#                                  first), runs the fork's release:pack, and
#                                  stages the tarball set into the container
#                                  via file: URLs. Freshness is never
#                                  inferred from version equality, directory
#                                  existence, or --rebuild.
#
# .env format: plain KEY=value lines, no inline comments. Tests may point
# TIER1_ENV_FILE at another env file; default is <repo>/.env.
#
# Probe deadline (seconds): TIER1_PROBE_DEADLINE (default 60) bounds the
# probe; TIER1_PROBE_KILL_GRACE (default 5) is the TERM->KILL escalation
# grace. Tests scale these down; do not use them to weaken real runs.
#
# Usage:
#   scripts/test-tier1.sh           build image, install prime-agent per
#                                   .env, apply + check plugin in-container
#   scripts/test-tier1.sh --rebuild build without cache, then the same
#   scripts/test-tier1.sh --smoke   toolchain smoke only (no .env needed,
#                                   no prime-agent install)
#   scripts/test-tier1.sh --probe   after apply/check, run a container-side
#                                   RPC probe (get_commands) that PROVES the
#                                   plugin loaded: the matching reply is
#                                   validated semantically (handoff, plan,
#                                   implement-spec, each exactly once, from
#                                   the container's installed extension
#                                   paths) under a hard deadline
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
# Explicit target inside the ephemeral container. This is the container user's
# real discovery root, but the Docker filesystem boundary keeps host HOME and
# the operator's user-global generation out of reach.
CONTAINER_PLUGIN_ROOT=/root/.prime/agent

usage() {
    sed -n '2,53p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
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

# Probe deadline (B3 repair). GNU timeout without --foreground runs the
# probe in its own process group and signals the WHOLE group, so
# TERM-ignoring children AND their descendants are covered;
# --kill-after escalates TERM to KILL after a fixed grace. The probe
# therefore terminates within deadline + grace no matter what the probe
# tree does. Tests scale both values down via the environment.
PROBE_DEADLINE="${TIER1_PROBE_DEADLINE:-60}"
PROBE_KILL_GRACE="${TIER1_PROBE_KILL_GRACE:-5}"

# Probe reply validator (B2 repair). Runs INSIDE the container (python3 is
# in the image) against the captured probe stdout; the tests extract this
# heredoc and exercise it against fixtures, so keep it stdlib-only and
# between the PYEOF markers. Contract:
#   - every non-empty stdout line must be a JSON object (malformed => fail)
#   - exactly one object may match id=loader, type=response,
#     command=get_commands (missing or duplicated => fail); unrelated
#     asynchronous JSONL events are skipped, never accepted as the reply
#   - success must be true; data.commands must be a list containing
#     handoff, plan, implement-spec each EXACTLY ONCE, every one sourced
#     from the container's installed extension paths
read -r -d '' PROBE_VALIDATOR <<'PYEOF' || true
import json
import sys

REQUIRED = ("handoff", "plan", "implement-spec")
EXT_PREFIX = "/root/.prime/agent/extensions/"


def die(msg):
    print("tier-1 probe validation FAILED: " + msg, file=sys.stderr)
    sys.exit(1)


if len(sys.argv) != 2:
    die("usage: validate.py <probe.jsonl>")

replies = []
with open(sys.argv[1], "r", encoding="utf-8", errors="replace") as fh:
    for lineno, raw in enumerate(fh, 1):
        line = raw.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            die("malformed JSON on line " + str(lineno))
        if not isinstance(obj, dict):
            continue
        if (obj.get("id") == "loader" and obj.get("type") == "response"
                and obj.get("command") == "get_commands"):
            replies.append(obj)

if not replies:
    die("no matching get_commands reply (id=loader)")
if len(replies) > 1:
    die("duplicate get_commands replies: " + str(len(replies)))
reply = replies[0]
if reply.get("success") is not True:
    die("reply success is not true: " + repr(reply.get("success")))
data = reply.get("data")
commands = data.get("commands") if isinstance(data, dict) else None
if not isinstance(commands, list):
    die("reply data.commands missing or not a list")
by_name = {}
for cmd in commands:
    if isinstance(cmd, dict) and isinstance(cmd.get("name"), str):
        by_name.setdefault(cmd["name"], []).append(cmd)
for name in REQUIRED:
    entries = by_name.get(name, [])
    if len(entries) != 1:
        die("command " + repr(name) + " present " + str(len(entries))
            + " times (expected exactly 1)")
    info = entries[0].get("sourceInfo")
    path = info.get("path") if isinstance(info, dict) else None
    if not (isinstance(path, str) and path.startswith(EXT_PREFIX)
            and path.endswith(".ts")):
        die("command " + repr(name)
            + " not sourced from container extensions: " + repr(path))
print("tier-1 probe validation OK: handoff, plan, implement-spec each "
      "registered exactly once from " + EXT_PREFIX)
PYEOF

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
        echo "dry-run: stage fork release: remove the four pack-consumed dist dirs, npm run build (fresh, unconditional), then node $SOURCE/scripts/pack-prime-agent-release.mjs --base-url file:///stage --out-dir $SOURCE/$STAGE_SUBDIR"
        echo "dry-run: docker run --rm -v $REPO_ROOT:/workspace:ro -v $SOURCE/$STAGE_SUBDIR/artifacts:/stage/releases/v$PLAN_VERSION:ro $IMAGE bash -lc '<npm install -g staged tarball> && prime-agent --version && apply && check'"
    else
        echo "dry-run: docker run --rm -v $REPO_ROOT:/workspace:ro $IMAGE bash -lc '<PRIME_AGENT_VERSION=$PINNED curl install.sh | sh> && prime-agent --version && apply && check'"
    fi
    if [ "$PROBE" -eq 1 ]; then
        echo "dry-run: container RPC probe (get_commands) under hard deadline ${PROBE_DEADLINE}s + ${PROBE_KILL_GRACE}s kill grace; reply semantically validated (handoff, plan, implement-spec from /root/.prime/agent/extensions/)"
    fi
    exit 0
fi

# Readiness checks — real execution path only. Informational paths
# (--help/--dry-run) have already exited above and never reach Docker.
command -v docker >/dev/null 2>&1 || die "docker not found on PATH"
docker info >/dev/null 2>&1 || die "docker daemon is not reachable"

MOUNTS=(-v "$REPO_ROOT:/workspace:ro")
if [ -n "$SOURCE" ]; then
    # Stage the fork release on the host from FRESH artifacts (B1 repair).
    # Every real source-mode run rebuilds: the fork build (tsgo + asset
    # copies) does NOT clean dist, so removed/renamed source outputs would
    # linger — remove the four pack-consumed dist dirs first. Freshness is
    # never inferred from version equality, directory existence, or
    # --rebuild. set -e fails closed: a build or pack failure stops here,
    # before any container install, with no OK and no fallback to previous
    # artifacts (release:pack wipes its out-dir before writing).
    echo "tier-1 driver: fresh fork build (rm dist dirs; npm run build in $SOURCE)"
    for p in packages/coding-agent packages/agent packages/ai packages/tui; do
        rm -rf "${SOURCE:?}/$p/dist"
    done
    (cd "$SOURCE" && npm run build)
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

# Staging (source mode) has already succeeded or failed above, so a fork
# build/pack failure never reaches the image build or the container run.

# ${BUILD_ARGS[@]+...} guard: bash 3.2 (macOS default) treats expanding an
# empty array under set -u as an unbound-variable error.
docker build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} -f "$REPO_ROOT/$DOCKERFILE" -t "$IMAGE" "$REPO_ROOT"

if [ "$SMOKE" -eq 1 ]; then
    echo "tier-1 driver: smoke run (ephemeral container, --rm destroys it)"
    docker run --rm "$IMAGE" bash -lc "$SMOKE_CMD"
    echo "tier-1 driver: OK — image built, smoke passed, container destroyed"
    exit 0
fi

CONTAINER_CMD="set -euo pipefail; $INSTALL && prime-agent --version && PRIME_AGENT_PLUGIN_ROOT=$CONTAINER_PLUGIN_ROOT /workspace/scripts/apply-prime-agent-plugin.sh && PRIME_AGENT_PLUGIN_ROOT=$CONTAINER_PLUGIN_ROOT /workspace/scripts/check-prime-agent-plugin.sh"
if [ "$PROBE" -eq 1 ]; then
    # Container-side RPC probe: load the container's real installed
    # extensions (no --no-extensions) and ask for the native command list.
    # B3: hard deadline — GNU timeout without --foreground signals the
    # probe's WHOLE process group, and --kill-after escalates TERM to KILL
    # after a fixed grace, so a TERM-ignoring probe tree terminates within
    # deadline + grace and the container command exits nonzero. Probe
    # stdout/stderr go to FILES, never to a pipe the driver reads, so a
    # surviving descendant holding output open cannot block us (slice-1
    # pipe-deadlock lesson); the ephemeral --rm container teardown reaps
    # anything left. B2: the captured reply is then validated semantically
    # by the embedded python3 validator (file input, no pipe reads).
    PROBE_VALIDATOR_B64="$(printf '%s' "$PROBE_VALIDATOR" | base64)"
    PROBE_STEP="mkdir -p /tmp/tier1-probe"
    PROBE_STEP="$PROBE_STEP; set +e"
    PROBE_STEP="$PROBE_STEP; printf '%s\n' '{\"id\":\"loader\",\"type\":\"get_commands\"}' | timeout --kill-after=$PROBE_KILL_GRACE $PROBE_DEADLINE prime-agent --mode rpc --offline --no-session --no-skills --no-prompt-templates --no-context-files --cwd /tmp/tier1-probe > /tmp/tier1-probe/probe.jsonl 2> /tmp/tier1-probe/probe.err"
    PROBE_STEP="$PROBE_STEP; probe_rc=\$?"
    PROBE_STEP="$PROBE_STEP; set -e"
    PROBE_STEP="$PROBE_STEP; if [ \"\$probe_rc\" -ne 0 ]; then echo \"tier-1 probe FAILED (exit \$probe_rc; deadline ${PROBE_DEADLINE}s + kill grace ${PROBE_KILL_GRACE}s)\"; tail -c 2000 /tmp/tier1-probe/probe.err || true; exit 1; fi"
    PROBE_STEP="$PROBE_STEP; printf '%s' '$PROBE_VALIDATOR_B64' | base64 -d > /tmp/tier1-probe/validate.py"
    PROBE_STEP="$PROBE_STEP; python3 /tmp/tier1-probe/validate.py /tmp/tier1-probe/probe.jsonl"
    CONTAINER_CMD="$CONTAINER_CMD && $PROBE_STEP"
fi

echo "tier-1 driver: container run (ephemeral, --rm): install prime-agent, apply + check plugin"
docker run --rm ${MOUNTS[@]+"${MOUNTS[@]}"} "$IMAGE" bash -lc "$CONTAINER_CMD"

echo "tier-1 driver: OK — image built, prime-agent installed, plugin applied + checked, container destroyed"
