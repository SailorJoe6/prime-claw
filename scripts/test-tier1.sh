#!/usr/bin/env bash
# test-tier1.sh — isolated host launcher for the prime-claw tier-1 suite.
#
# Pinned mode installs Prime Agent while the run-owned container is online,
# disconnects every captured network, verifies the network set is empty, and
# only then runs version/artifact capture, plugin apply/check, and the optional
# RPC probe. Source mode builds only inside a disposable container from a
# read-only selected checkout and exports validated release artifacts to the
# fresh run-owned share. Every real run records sanitized provenance below
# .test-results/<run-id>/tier1 and launches the image by its iidfile identity.
#
# Usage:
#   scripts/test-tier1.sh           pinned install + offline apply/check
#   scripts/test-tier1.sh --rebuild build without cache
#   scripts/test-tier1.sh --smoke   offline toolchain smoke (no .env needed)
#   scripts/test-tier1.sh --probe   pinned run plus offline RPC command probe
#   scripts/test-tier1.sh --dry-run print the plan and contact no Docker daemon
#   scripts/test-tier1.sh --help    show this help

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ "${PRIME_CLAW_TIER1_INNER:-0}" != 1 ]; then
    exec python3 "$REPO_ROOT/scripts/testing/tier1_supervisor.py"         "${BASH_SOURCE[0]}" "$@"
fi
DOCKERFILE="docker/test.Dockerfile"
ENV_FILE="${TIER1_ENV_FILE:-$REPO_ROOT/.env}"
RESULTS_ROOT="${TIER1_RESULTS_ROOT:-$REPO_ROOT/.test-results}"
CONTAINER_PLUGIN_ROOT=/root/.prime/agent
NO_CACHE=0
DRY_RUN=0
SMOKE=0
PROBE=0

usage() { sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; }
die() { echo "error: $*" >&2; exit 1; }

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
[ -f "$REPO_ROOT/$DOCKERFILE" ] || die "missing $DOCKERFILE"

read_selector() {
    [ -f "$ENV_FILE" ] || return 0
    sed -n "s/^$1=//p" "$ENV_FILE" | tail -1 \
        | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

PINNED=""
SOURCE=""
if [ "$SMOKE" -eq 0 ]; then
    [ -f "$ENV_FILE" ] || die "missing env file: $ENV_FILE (set exactly one selector)"
    if grep -Ev '^(#.*|[[:space:]]*|PRIME_AGENT_PINNED=.*|PRIME_AGENT_SOURCE=.*)$' "$ENV_FILE" >/dev/null; then
        die "env file contains unsupported keys or malformed lines"
    fi
    [ "$(grep -c '^PRIME_AGENT_PINNED=' "$ENV_FILE" || true)" -le 1 ] \
        || die "env file repeats PRIME_AGENT_PINNED"
    [ "$(grep -c '^PRIME_AGENT_SOURCE=' "$ENV_FILE" || true)" -le 1 ] \
        || die "env file repeats PRIME_AGENT_SOURCE"
    PINNED="$(read_selector PRIME_AGENT_PINNED)"
    SOURCE="$(read_selector PRIME_AGENT_SOURCE)"
    if [ -n "$PINNED" ] && [ -n "$SOURCE" ]; then
        die "both PRIME_AGENT_PINNED and PRIME_AGENT_SOURCE are set — set exactly one"
    fi
    if [ -z "$PINNED" ] && [ -z "$SOURCE" ]; then
        die "neither PRIME_AGENT_PINNED nor PRIME_AGENT_SOURCE is set — set exactly one"
    fi
    if [ -n "$SOURCE" ]; then
        case "$SOURCE" in
            /*) ;;
            *) die "PRIME_AGENT_SOURCE must be an absolute path" ;;
        esac
        case "$SOURCE" in
            *','*|*$'\n'*|*$'\r'*) die "PRIME_AGENT_SOURCE contains unsupported path bytes" ;;
        esac
    elif ! [[ "$PINNED" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        die "PRIME_AGENT_PINNED must be an exact semantic version"
    fi
fi

PROBE_DEADLINE="${TIER1_PROBE_DEADLINE:-60}"
PROBE_KILL_GRACE="${TIER1_PROBE_KILL_GRACE:-5}"
DOCKER_KILL_GRACE="${TIER1_DOCKER_KILL_GRACE:-5}"
DOCKER_TIMEOUT="${TIER1_DOCKER_TIMEOUT:-60}"
BUILD_TIMEOUT="${TIER1_BUILD_TIMEOUT:-1200}"
INSTALL_TIMEOUT="${TIER1_INSTALL_TIMEOUT:-300}"
CHECK_TIMEOUT="${TIER1_CHECK_TIMEOUT:-180}"
SOURCE_BUILDER_TIMEOUT="${TIER1_SOURCE_BUILDER_TIMEOUT:-600}"
PUBLICATION_TIMEOUT="${TIER1_PUBLICATION_TIMEOUT:-60}"
REMOVE_TIMEOUT="${TIER1_REMOVE_TIMEOUT:-60}"
FINAL_INSPECT_TIMEOUT="${TIER1_FINAL_INSPECT_TIMEOUT:-15}"

python3 - \
  TIER1_PROBE_DEADLINE "$PROBE_DEADLINE" 900 \
  TIER1_PROBE_KILL_GRACE "$PROBE_KILL_GRACE" 60 \
  TIER1_DOCKER_KILL_GRACE "$DOCKER_KILL_GRACE" 60 \
  TIER1_DOCKER_TIMEOUT "$DOCKER_TIMEOUT" 1800 \
  TIER1_BUILD_TIMEOUT "$BUILD_TIMEOUT" 3600 \
  TIER1_INSTALL_TIMEOUT "$INSTALL_TIMEOUT" 1800 \
  TIER1_CHECK_TIMEOUT "$CHECK_TIMEOUT" 1800 \
  TIER1_SOURCE_BUILDER_TIMEOUT "$SOURCE_BUILDER_TIMEOUT" 600 \
  TIER1_PUBLICATION_TIMEOUT "$PUBLICATION_TIMEOUT" 180 \
  TIER1_REMOVE_TIMEOUT "$REMOVE_TIMEOUT" 180 \
  TIER1_FINAL_INSPECT_TIMEOUT "$FINAL_INSPECT_TIMEOUT" 180 <<'PYDEADLINES' \
  || die "deadline must be a bounded positive number within the supported maximum"
from decimal import Decimal, InvalidOperation
import sys
for index in range(1, len(sys.argv), 3):
    name, raw, maximum = sys.argv[index:index + 3]
    try:
        value = Decimal(raw)
    except InvalidOperation:
        print(f"invalid bounded deadline: {name}", file=sys.stderr)
        raise SystemExit(1)
    if not value.is_finite() or value <= 0 or value > Decimal(maximum):
        print(f"invalid bounded deadline: {name}", file=sys.stderr)
        raise SystemExit(1)
PYDEADLINES
PROBE_OUTER_TIMEOUT="$(python3 - "$PROBE_DEADLINE" "$PROBE_KILL_GRACE" "$DOCKER_TIMEOUT" <<'PYTOTAL'
from decimal import Decimal
import sys
print(sum(map(Decimal, sys.argv[1:])))
PYTOTAL
)"

BOUNDED_PID=""
PENDING_SIGNAL_NUM=""
LAST_SIGNAL_NUM=""
SIGNAL_COUNT=0
LAST_BOUNDED_OUTCOME=not_run
LAST_BOUNDED_SIGNAL=""

record_signal() {
    local number="$1"
    [ -n "$PENDING_SIGNAL_NUM" ] || PENDING_SIGNAL_NUM="$number"
    LAST_SIGNAL_NUM="$number"
    SIGNAL_COUNT=$((SIGNAL_COUNT + 1))
}

forward_bounded_signal() {
    local number="$1"
    if [ -n "$BOUNDED_PID" ]; then
        kill -"$number" "$BOUNDED_PID" 2>/dev/null || true
    fi
}

on_signal() {
    local number="$1"
    record_signal "$number"
    if [ -n "$BOUNDED_PID" ]; then
        forward_bounded_signal "$number"
        return
    fi
    exit $((128 + number))
}

on_cleanup_signal() {
    local number="$1"
    record_signal "$number"
    forward_bounded_signal "$number"
}

bounded() {
    local timeout="$1" before rc pid status_file parsed; shift
    before="$SIGNAL_COUNT"
    status_file="$(mktemp "${TMPDIR:-/tmp}/prime-claw-bounded-status.XXXXXX")" \
        || return 127
    rm -f "$status_file"
    local bounded_kill_grace="${BOUNDED_KILL_GRACE_OVERRIDE:-$DOCKER_KILL_GRACE}"
    (cd "$REPO_ROOT" && exec python3 -m scripts.testing.bounded \
        --timeout "$timeout" --kill-grace "$bounded_kill_grace" \
        --status-file "$status_file" \
        --output-policy "${BOUNDED_OUTPUT_POLICY:-passthrough}" -- "$@") &
    pid=$!
    BOUNDED_PID="$pid"
    while :; do
        if wait "$pid"; then rc=0; else rc=$?; fi
        kill -0 "$pid" 2>/dev/null || break
    done
    BOUNDED_PID=""
    LAST_BOUNDED_OUTCOME=launch_error
    LAST_BOUNDED_SIGNAL=""
    if [ -s "$status_file" ]; then
        parsed="$(cat "$status_file")"
        if printf '%s\n' "$parsed" | grep -Eq '^\{"outcome":"(exited|signaled|timed_out|interrupted|launch_error|reap_timeout)","returncode":-?[0-9]+,"signal":(null|[0-9]+)\}$'; then
            outcome_field="${parsed#*\"outcome\":\"}"
            LAST_BOUNDED_OUTCOME="${outcome_field%%\"*}"
            signal_field="${parsed##*\"signal\":}"
            signal_field="${signal_field%\}}"
            [ "$signal_field" = null ] || LAST_BOUNDED_SIGNAL="$signal_field"
        fi
    fi
    rm -f "$status_file"
    if [ "$SIGNAL_COUNT" -ne "$before" ]; then
        LAST_BOUNDED_OUTCOME=interrupted
        LAST_BOUNDED_SIGNAL="$LAST_SIGNAL_NUM"
        return $((128 + LAST_SIGNAL_NUM))
    fi
    return "$rc"
}
now_utc() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

SMOKE_CMD='node --version && python3 --version && pytest --version'

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

BUILD_INPUT_HASH=""
IMAGE_TAG="prime-claw-test-tier1:<captured>"
echo "tier-1 driver: dockerfile=$DOCKERFILE tag=$IMAGE_TAG"
if [ "$SMOKE" -eq 1 ]; then
    echo "tier-1 driver: mode=smoke"
elif [ -n "$SOURCE" ]; then
    echo "tier-1 driver: mode=source selected checkout=<redacted>"
else
    echo "tier-1 driver: mode=pinned PRIME_AGENT_VERSION=$PINNED"
fi
if [ "$PROBE" -eq 1 ]; then echo "tier-1 driver: offline RPC probe enabled"; fi

if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: allocate .test-results/<run-id>/tier1"
    echo "dry-run: docker build --iidfile <run>/tier1/image.iid -f <run>/tier1/build-context/Dockerfile -t $IMAGE_TAG <run>/tier1/build-context"
    echo "dry-run: docker run -d --cidfile <run>/tier1/container.cid <captured-image-id> sleep infinity"
    if [ -n "$SOURCE" ]; then
        echo "dry-run: disposable source builder mounts <selected-source>:ro and exports a validated release"
        echo "dry-run: online local-tarball install; runtime network absence precedes product actions"
    elif [ "$SMOKE" -eq 0 ]; then
        echo "dry-run: online vendor install for PRIME_AGENT_VERSION=$PINNED"
    fi
    echo "dry-run: disconnect captured networks; verify empty network set"
    if [ "$SMOKE" -eq 1 ]; then
        echo "dry-run: offline toolchain smoke"
    else
        echo "dry-run: offline version/artifact identity, apply, check${PROBE:+, probe}"
    fi
    echo "dry-run: remove captured container ID; require verified absence; write manifest.json"
    exit 0
fi

command -v docker >/dev/null 2>&1 || die "docker not found on PATH"
bounded "$DOCKER_TIMEOUT" docker info >/dev/null 2>&1 \
    || die "docker daemon is not reachable within the bounded deadline"

IFS=$'\t' read -r RUN_ID TIER_DIR TIER_BINDING <<EOF
$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance allocate "$RESULTS_ROOT" tier1)
EOF
RUN_STARTED="$(now_utc)"
if [ -n "${PRIME_CLAW_TIER1_STATUS:-}" ]; then
    status_tmp="${PRIME_CLAW_TIER1_STATUS}.inner.$$"
    umask 077
    python3 -c 'import json,sys; print(json.dumps({"tier_dir":sys.argv[1],"binding":sys.argv[2]},sort_keys=True,separators=(",",":")))'         "$TIER_DIR" "$TIER_BINDING" >"$status_tmp"
    mv -f "$status_tmp" "$PRIME_CLAW_TIER1_STATUS"
fi
MODE=pinned
[ "$SMOKE" -eq 1 ] && MODE=smoke
[ -n "$SOURCE" ] && MODE=source
WORKSPACE_SNAPSHOT="$RESULTS_ROOT/.workspaces/$RUN_ID"
(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance snapshot \
    "$REPO_ROOT" "$WORKSPACE_SNAPSHOT") | \
    (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance write-json \
        "$TIER_DIR" "$TIER_BINDING" repository.json)
WORKSPACE_BINDING="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance \
    directory-binding "$WORKSPACE_SNAPSHOT")"
BUILD_CONTEXT="$TIER_DIR/build-context"
mkdir -p "$BUILD_CONTEXT"
cp "$WORKSPACE_SNAPSHOT/$DOCKERFILE" "$BUILD_CONTEXT/Dockerfile"
IFS=$'\t' read -r DOCKERFILE_HASH BUILD_INPUT_HASH <<EOF
$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance build-input "$BUILD_CONTEXT" Dockerfile)
EOF
IMAGE_TAG="prime-claw-test-tier1:${BUILD_INPUT_HASH:0:12}"
echo "tier-1 driver: captured-tag=$IMAGE_TAG"
IIDFILE="$TIER_DIR/image.iid"
CIDFILE="$TIER_DIR/container.cid"
SETUP_LOG="$TIER_DIR/setup.log"
SHARE="$TIER_DIR/share"
mkdir -m 700 "$SHARE"
SHARE_BINDING="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance \
    directory-binding "$SHARE")"
: > "$SETUP_LOG"
phase() { printf 'phase=%s\n' "$1" >>"$SETUP_LOG"; }
phase run-allocated
IMAGE_META="$TIER_DIR/image.json"
NETWORK_TIME=""
BUILD_STARTED=""
BUILD_FINISHED=""
CONTAINER_ID=""
RUN_ATTEMPTED=0
TEARDOWN_STATE=absent
TEARDOWN_REMOVE_OUTCOME=not_needed
TEARDOWN_INSPECT_OUTCOME=not_needed
TEARDOWN_CLEAN=1
TEARDOWN_VERIFIED=""
BUILDER_TEARDOWN_STATE=absent
BUILDER_TEARDOWN_REMOVE_OUTCOME=not_needed
BUILDER_TEARDOWN_INSPECT_OUTCOME=not_needed
BUILDER_TEARDOWN_CLEAN=1
if [ "$MODE" = source ]; then
    BUILDER_TEARDOWN_STATE=unknown
    BUILDER_TEARDOWN_REMOVE_OUTCOME=identity_refused
    BUILDER_TEARDOWN_INSPECT_OUTCOME=not_run
    BUILDER_TEARDOWN_CLEAN=0
fi
RUN_STATUS=failed
FAILURE_CODES="primary-command-failed"
MANIFEST_BINDING=""

read -r -d '' MANIFEST_PUBLISHER <<'PYMANIFEST' || true
import json, sys
from pathlib import Path
from scripts.testing import provenance as p
(tier_s, tier_binding, run_id, started, finished, status, mode, requested,
 build_started, build_finished, dockerfile_hash, input_hash, tag,
 network_time, teardown_state, teardown_time, remove_outcome,
 inspect_outcome, teardown_clean, failure_codes_raw, expected_raw) = sys.argv[1:]
failure_codes = [code for code in failure_codes_raw.split(",") if code]
tier = Path(tier_s)
with p.open_owned_directory(tier, tier_binding) as owned:
    repo = p.read_sanitized_json(owned, "repository.json")
    try:
        image_meta = p.read_sanitized_json(owned, "image.json")
    except FileNotFoundError:
        image_meta = None
    prime = None
    artifact = None
    installed_version = None
    if mode in {"pinned", "source"}:
        try:
            artifact = p.read_sanitized_json(owned, "installed-artifact.json")
            installed_version = artifact["version"]
        except FileNotFoundError:
            pass
        if mode == "pinned":
            prime = {"mode": "pinned", "requested_version": requested,
                     "installed_version": installed_version, "artifact": artifact}
        else:
            try:
                source_build = p.read_sanitized_json(owned, "source-build.json")
            except FileNotFoundError:
                source_build = None
            release = source_build.get("release") if isinstance(source_build, dict) else None
            requested_source = (release.get("package_version")
                                if isinstance(release, dict) else None)
            prime = {
                "mode": "source", "requested_version": requested_source,
                "installed_version": installed_version, "artifact": artifact,
                "source": (source_build.get("source")
                           if isinstance(source_build, dict) else None),
                "source_rules": (source_build.get("source_rules")
                                 if isinstance(source_build, dict) else None),
                "staged_release": release,
                "builder": ({
                    "image": source_build.get("builder_image"),
                    "teardown": source_build.get("builder_teardown"),
                    "checkout_inventory_before": source_build.get("checkout_inventory_before"),
                    "checkout_inventory_after": source_build.get("checkout_inventory_after"),
                } if isinstance(source_build, dict) else None),
            }
    image = image_meta
    manifest = {
        "schema_version": p.SCHEMA_VERSION,
        "command_contract_version": p.COMMAND_CONTRACT_VERSION,
        "run": {"id": run_id, "tier": "tier1", "mode": mode,
                 "started_at": started, "finished_at": finished, "status": status,
                 "failure_codes": failure_codes},
        "repository": repo,
        "prime_agent": prime,
        "image": image,
        "network": {"disconnected_at": network_time or None,
                    "verified_absent": bool(network_time)},
        "teardown": {"state": teardown_state, "verified_at": teardown_time,
                     "remove_outcome": remove_outcome,
                     "inspect_outcome": inspect_outcome,
                     "clean": teardown_clean == "1"},
        "evidence": {"files": []},
    }
    manifest["evidence"]["files"] = p.evidence_inventory(owned)
    expected = p.ObjectBinding.decode(expected_raw) if expected_raw else None
    published = p.atomic_write_manifest(
        owned, manifest, expected_existing=expected)
    p.verify_evidence(owned, manifest)
    print(published.encode())
PYMANIFEST

finalize_manifest() {
    [ -n "$TEARDOWN_VERIFIED" ] || return 1
    FINISHED="$(now_utc)"
    cd "$REPO_ROOT"
    bounded "$PUBLICATION_TIMEOUT" python3 -c "$MANIFEST_PUBLISHER" \
      "$TIER_DIR" "$TIER_BINDING" "$RUN_ID" "$RUN_STARTED" "$FINISHED" "$RUN_STATUS" \
      "$MODE" "$PINNED" "$BUILD_STARTED" "$BUILD_FINISHED" "$DOCKERFILE_HASH" \
      "$BUILD_INPUT_HASH" "$IMAGE_TAG" "$NETWORK_TIME" "$TEARDOWN_STATE" \
      "$TEARDOWN_VERIFIED" "$TEARDOWN_REMOVE_OUTCOME" \
      "$TEARDOWN_INSPECT_OUTCOME" "$TEARDOWN_CLEAN" "$FAILURE_CODES" \
      "$MANIFEST_BINDING"
}

capture_builder_receipt() {
    [ "$MODE" = source ] || return 0
    local row
    row="$(cd "$REPO_ROOT" && python3 -c '
from pathlib import Path
from scripts.testing import provenance as p
import sys
with p.open_owned_directory(Path(sys.argv[1]), sys.argv[2]) as owned:
    value = p.read_sanitized_json(owned, "source-build.json")
    teardown = p.source_builder_share_teardown(value)
release = value.get("release")
version = release.get("package_version", "-") if isinstance(release, dict) else "-"
sums = [record for record in release.get("output_inventory", [])
        if record.get("path") == "artifacts/SHA256SUMS"] if isinstance(release, dict) else []
sums_sha = sums[0]["content_sha256"] if len(sums) == 1 else "-"
print("|".join((value["status"], version, sums_sha,
                teardown["state"], teardown["remove_outcome"],
                teardown["inspect_outcome"], "1" if teardown["clean"] else "0")))
' "$TIER_DIR" "$TIER_BINDING" 2>/dev/null)" || return 1
    IFS='|' read -r BUILDER_STATUS PA_VERSION SOURCE_SUMS_SHA \
        BUILDER_TEARDOWN_STATE BUILDER_TEARDOWN_REMOVE_OUTCOME \
        BUILDER_TEARDOWN_INSPECT_OUTCOME BUILDER_TEARDOWN_CLEAN <<<"$row"
    [ -n "$BUILDER_STATUS" ] && [ -n "$BUILDER_TEARDOWN_STATE" ]
}

cleanup() {
    original_rc=$?
    trap - EXIT
    trap 'on_cleanup_signal 2' INT
    trap 'on_cleanup_signal 15' TERM
    trap 'on_cleanup_signal 1' HUP
    set +e
    cleanup_rc=0
    if [ "$MODE" = source ]; then
        BUILDER_STATUS=unknown
        BUILDER_TEARDOWN_STATE=unknown
        BUILDER_TEARDOWN_REMOVE_OUTCOME=identity_refused
        BUILDER_TEARDOWN_INSPECT_OUTCOME=not_run
        BUILDER_TEARDOWN_CLEAN=0
        capture_builder_receipt || cleanup_rc=1
    fi
    if [ -z "$CONTAINER_ID" ] && [ -s "$CIDFILE" ]; then
        raw_cid="$(cat "$CIDFILE")"
        if [[ "$raw_cid" =~ ^[0-9a-f]{64}$ ]]; then
            CONTAINER_ID="$raw_cid"
        else
            cleanup_rc=1
            TEARDOWN_STATE=unknown
            TEARDOWN_REMOVE_OUTCOME=identity_refused
            TEARDOWN_INSPECT_OUTCOME=not_run
            TEARDOWN_CLEAN=0
            printf 'teardown refused invalid cidfile identity\n' >>"$SETUP_LOG"
        fi
    fi
    if [ -z "$CONTAINER_ID" ] && [ "$RUN_ATTEMPTED" -eq 1 ]; then
        cleanup_rc=1
        TEARDOWN_STATE=unknown
        TEARDOWN_REMOVE_OUTCOME=identity_refused
        TEARDOWN_INSPECT_OUTCOME=not_run
        TEARDOWN_CLEAN=0
    fi
    if [ -n "$CONTAINER_ID" ]; then
        remove_status="$(BOUNDED_OUTPUT_POLICY=status bounded "$REMOVE_TIMEOUT" \
            docker rm -f "$CONTAINER_ID")"
        remove_rc=$?
        remove_bounded_outcome=launch_error
        outcome_re='"outcome":"([a-z_]+)"'
        if [[ "$remove_status" =~ $outcome_re ]]; then
            remove_bounded_outcome="${BASH_REMATCH[1]}"
        fi
        case "$remove_bounded_outcome" in
            exited) [ "$remove_rc" -eq 0 ] && TEARDOWN_REMOVE_OUTCOME=clean \
                || TEARDOWN_REMOVE_OUTCOME=ordinary_nonzero ;;
            signaled) TEARDOWN_REMOVE_OUTCOME=signaled ;;
            timed_out|interrupted|launch_error|reap_timeout)
                TEARDOWN_REMOVE_OUTCOME="$remove_bounded_outcome" ;;
            *) TEARDOWN_REMOVE_OUTCOME=launch_error ;;
        esac
        inspect_status="$(BOUNDED_OUTPUT_POLICY=container-presence bounded "$FINAL_INSPECT_TIMEOUT" \
            docker inspect "$CONTAINER_ID")"
        inspect_rc=$?
        inspect_bounded_outcome=launch_error
        inspect_state=unknown
        if [[ "$inspect_status" =~ $outcome_re ]]; then
            inspect_bounded_outcome="${BASH_REMATCH[1]}"
        fi
        state_re='"state":"([a-z_]+)"'
        if [[ "$inspect_status" =~ $state_re ]]; then
            inspect_state="${BASH_REMATCH[1]}"
        fi
        case "$inspect_bounded_outcome" in
            exited)
                if [ "$inspect_state" = present ]; then
                    TEARDOWN_STATE=present
                    TEARDOWN_INSPECT_OUTCOME=clean
                elif [ "$inspect_state" = absent ]; then
                    TEARDOWN_STATE=absent
                    TEARDOWN_INSPECT_OUTCOME=ordinary_nonzero
                else
                    TEARDOWN_STATE=unknown
                    TEARDOWN_INSPECT_OUTCOME=ordinary_nonzero
                fi
                ;;
            signaled)
                TEARDOWN_STATE=unknown
                TEARDOWN_INSPECT_OUTCOME=signaled
                ;;
            timed_out|interrupted|launch_error|reap_timeout)
                TEARDOWN_STATE=unknown
                TEARDOWN_INSPECT_OUTCOME="$inspect_bounded_outcome"
                ;;
            *)
                TEARDOWN_STATE=unknown
                TEARDOWN_INSPECT_OUTCOME=launch_error
                ;;
        esac
        if [ "$TEARDOWN_STATE" = absent ] && \
           [ "$TEARDOWN_REMOVE_OUTCOME" = clean ] && \
           [ "$TEARDOWN_INSPECT_OUTCOME" = ordinary_nonzero ]; then
            TEARDOWN_CLEAN=1
        else
            TEARDOWN_CLEAN=0
            cleanup_rc=1
        fi
        printf 'teardown state=%s remove=%s inspect=%s clean=%s\n' \
          "$TEARDOWN_STATE" "$TEARDOWN_REMOVE_OUTCOME" \
          "$TEARDOWN_INSPECT_OUTCOME" "$TEARDOWN_CLEAN" >>"$SETUP_LOG"
    fi
    TEARDOWN_VERIFIED="$(now_utc)"
    runtime_released=0
    builder_released=1
    if [ "$TEARDOWN_CLEAN" -eq 1 ] && [ "$TEARDOWN_STATE" = absent ]; then
        runtime_released=1
        (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance \
            remove-owned-directory "$WORKSPACE_SNAPSHOT" "$WORKSPACE_BINDING" \
            --quarantine-parent "$TIER_DIR" \
            --quarantine-binding "$TIER_BINDING") \
            || cleanup_rc=1
    else
        printf 'repository snapshot preserved because runtime teardown is %s/%s
' \
            "$TEARDOWN_STATE" "$TEARDOWN_REMOVE_OUTCOME" >>"$SETUP_LOG"
    fi
    if [ "$MODE" = source ] && \
       { [ "$BUILDER_TEARDOWN_CLEAN" -ne 1 ] || \
         [ "$BUILDER_TEARDOWN_STATE" != absent ]; }; then
        builder_released=0
        cleanup_rc=1
    fi
    if [ "$runtime_released" -eq 1 ] && [ "$builder_released" -eq 1 ]; then
        (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance \
            remove-owned-directory "$SHARE" "$SHARE_BINDING" \
            --quarantine-parent "$TIER_DIR" \
            --quarantine-binding "$TIER_BINDING") \
            || cleanup_rc=1
    else
        printf 'writable share preserved because runtime=%s/%s builder=%s/%s
' \
            "$TEARDOWN_STATE" "$TEARDOWN_CLEAN" \
            "$BUILDER_TEARDOWN_STATE" "$BUILDER_TEARDOWN_CLEAN" >>"$SETUP_LOG"
    fi
    if [ "$original_rc" -eq 0 ] && [ "$cleanup_rc" -eq 0 ] && \
       [ "$runtime_released" -eq 1 ] && [ "$builder_released" -eq 1 ] && \
       [ -z "$PENDING_SIGNAL_NUM" ]; then
        RUN_STATUS=passed
        FAILURE_CODES=""
    else
        FAILURE_CODES=""
        [ "$original_rc" -eq 0 ] || FAILURE_CODES=primary-command-failed
        if [ -n "$PENDING_SIGNAL_NUM" ]; then
            [ -z "$FAILURE_CODES" ] || FAILURE_CODES="$FAILURE_CODES,"
            FAILURE_CODES="${FAILURE_CODES}interrupted"
        fi
        if [ "$cleanup_rc" -ne 0 ]; then
            [ -z "$FAILURE_CODES" ] || FAILURE_CODES="$FAILURE_CODES,"
            FAILURE_CODES="${FAILURE_CODES}teardown-command-failed"
        fi
        if [ "$TEARDOWN_STATE" != absent ]; then
            [ -z "$FAILURE_CODES" ] || FAILURE_CODES="$FAILURE_CODES,"
            FAILURE_CODES="${FAILURE_CODES}teardown-not-absent"
        fi
        if [ "$MODE" = source ] && [ "$BUILDER_TEARDOWN_CLEAN" -ne 1 ]; then
            [ -z "$FAILURE_CODES" ] || FAILURE_CODES="$FAILURE_CODES,"
            FAILURE_CODES="${FAILURE_CODES}builder-teardown-command-failed"
        fi
        if [ "$MODE" = source ] && [ "$BUILDER_TEARDOWN_STATE" != absent ]; then
            [ -z "$FAILURE_CODES" ] || FAILURE_CODES="$FAILURE_CODES,"
            FAILURE_CODES="${FAILURE_CODES}builder-teardown-not-absent"
        fi
        [ -n "$FAILURE_CODES" ] || FAILURE_CODES=incomplete-identity
    fi
    MANIFEST_BINDING="$(finalize_manifest 2>/dev/null)"
    manifest_rc=$?
    if [ "$manifest_rc" -ne 0 ] || [ -n "$PENDING_SIGNAL_NUM" ]; then
        cleanup_rc=1
        phase manifest-failed
        RUN_STATUS=failed
        case ",$FAILURE_CODES," in
            *,interrupted,*) ;;
            *)
                if [ -n "$PENDING_SIGNAL_NUM" ]; then
                    [ -z "$FAILURE_CODES" ] || FAILURE_CODES="$FAILURE_CODES,"
                    FAILURE_CODES="${FAILURE_CODES}interrupted"
                fi ;;
        esac
        if [ "$manifest_rc" -ne 0 ]; then
            case ",$FAILURE_CODES," in
                *,publication-failed,*) ;;
                *) [ -z "$FAILURE_CODES" ] || FAILURE_CODES="$FAILURE_CODES,";
                   FAILURE_CODES="${FAILURE_CODES}publication-failed" ;;
            esac
        fi
        # If initial publication did not return its binding, neutralize any
        # public green manifest first and retain the failed binding for repair.
        if [ "$manifest_rc" -ne 0 ]; then
            invalidate_args=(invalidate-green-manifest "$TIER_DIR" \
                "$TIER_BINDING" manifest.json)
            [ -z "$MANIFEST_BINDING" ] || \
                invalidate_args+=(--expected "$MANIFEST_BINDING")
            invalidated_binding="$(cd "$REPO_ROOT" && \
                python3 -m scripts.testing.provenance \
                "${invalidate_args[@]}" 2>/dev/null)" || true
            [ -z "$invalidated_binding" ] || \
                MANIFEST_BINDING="$invalidated_binding"
        fi
        MANIFEST_BINDING="$(finalize_manifest 2>/dev/null)"
        repair_rc=$?
        if [ "$repair_rc" -ne 0 ]; then
            invalidate_args=(invalidate-green-manifest "$TIER_DIR" \
                "$TIER_BINDING" manifest.json)
            [ -z "$MANIFEST_BINDING" ] || \
                invalidate_args+=(--expected "$MANIFEST_BINDING")
            (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance \
                "${invalidate_args[@]}") >/dev/null 2>&1 || true
        fi
    fi
    final_rc=$original_rc
    [ "$final_rc" -ne 0 ] || final_rc=$cleanup_rc
    if [ -n "$PENDING_SIGNAL_NUM" ]; then
        final_rc=$((128 + PENDING_SIGNAL_NUM))
    fi
    # This is the terminal commit boundary. Signals accepted before it are
    # reflected in failed evidence; later signals belong to restored defaults.
    trap - INT TERM HUP
    echo "tier-1 driver: evidence=$TIER_DIR"
    exit "$final_rc"
}
trap cleanup EXIT
trap 'on_signal 2' INT
trap 'on_signal 15' TERM
trap 'on_signal 1' HUP

PA_VERSION="$PINNED"
if [ "$MODE" = source ]; then
    phase source-builder-started
    BOUNDED_KILL_GRACE_OVERRIDE=120 bounded "$SOURCE_BUILDER_TIMEOUT" \
        "$WORKSPACE_SNAPSHOT/scripts/build-prime-agent-test-release.sh" \
        --source "$SOURCE" --workspace "$WORKSPACE_SNAPSHOT" \
        --tier-dir "$TIER_DIR" --tier-binding "$TIER_BINDING" \
        --share "$SHARE" --share-binding "$SHARE_BINDING" \
        --image-timeout "$SOURCE_BUILDER_TIMEOUT" \
        --build-timeout "$SOURCE_BUILDER_TIMEOUT" >/dev/null 2>&1
    capture_builder_receipt \
        || die "validated source builder receipt is unavailable"
    [ "$BUILDER_STATUS" = passed ] && \
       [ "$BUILDER_TEARDOWN_STATE" = absent ] && \
       [ "$BUILDER_TEARDOWN_CLEAN" -eq 1 ] \
        || die "validated source builder ownership is not released"
    [[ "$PA_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+([+-][0-9A-Za-z.-]+)?$ ]] \
        || die "validated source builder version is invalid"
    [[ "$SOURCE_SUMS_SHA" =~ ^[0-9a-f]{64}$ ]] \
        || die "validated source release inventory is invalid"
    phase source-builder-passed
fi

BUILD_ARGS=()
if [ "$NO_CACHE" -eq 1 ]; then BUILD_ARGS+=(--no-cache); fi
BUILD_STARTED="$(now_utc)"
phase image-build-started
bounded "$BUILD_TIMEOUT" docker build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} --iidfile "$IIDFILE" \
    -f "$BUILD_CONTEXT/Dockerfile" -t "$IMAGE_TAG" "$BUILD_CONTEXT" \
    >/dev/null 2>&1
BUILD_FINISHED="$(now_utc)"
phase image-built
[ -s "$IIDFILE" ] || die "docker build did not publish the run-owned iidfile"
IMAGE_ID="$(cat "$IIDFILE")"
[[ "$IMAGE_ID" =~ ^sha256:[0-9a-f]{64}$ ]] || die "invalid image ID in iidfile"
BOUNDED_OUTPUT_POLICY=image-inspect bounded "$DOCKER_TIMEOUT" \
    docker image inspect "$IMAGE_ID" | \
    (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance capture-image \
        "$TIER_DIR" "$TIER_BINDING" image.json "$IMAGE_ID" "$DOCKERFILE" "$DOCKERFILE_HASH" \
        "$BUILD_INPUT_HASH" "$IMAGE_TAG" "$BUILD_STARTED" "$BUILD_FINISHED")

NAME="prime-claw-tier1-${RUN_ID//[^a-zA-Z0-9_.-]/-}"
MOUNTS=(-v "$WORKSPACE_SNAPSHOT:/workspace:ro" -v "$SHARE:/test-results")
if [ "$MODE" = source ]; then
    MOUNTS+=(-v "$SHARE/source-release/artifacts:/stage/releases/v$PA_VERSION:ro")
fi
RUN_ATTEMPTED=1
bounded "$DOCKER_TIMEOUT" docker run -d --name "$NAME" --cidfile "$CIDFILE" \
    ${MOUNTS[@]+"${MOUNTS[@]}"} "$IMAGE_ID" sleep infinity \
    >/dev/null 2>&1
[ -s "$CIDFILE" ] || die "docker run did not publish the run-owned cidfile"
raw_cid="$(cat "$CIDFILE")"
[[ "$raw_cid" =~ ^[0-9a-f]{64}$ ]] || die "invalid container ID in cidfile"
CONTAINER_ID="$raw_cid"
phase container-started

if [ "$MODE" = pinned ]; then
    INSTALL='curl -fsSL https://app.primeintellect.ai/prime-agent/install.sh | sh'
    bounded "$INSTALL_TIMEOUT" docker exec -e "PRIME_AGENT_VERSION=$PINNED" \
        -e PRIME_AGENT_INSTALLER_PLAIN=1 \
        -e PRIME_AGENT_BOOTSTRAP_KERNEL_ON_INSTALL=0 \
        "$CONTAINER_ID" bash -lc "set -euo pipefail; $INSTALL" \
        >/dev/null 2>&1
    phase prime-agent-installed
elif [ "$MODE" = source ]; then
    bounded "$INSTALL_TIMEOUT" docker exec "$CONTAINER_ID" bash -lc \
        "set -euo pipefail; cd /stage/releases/v$PA_VERSION; printf '%s  SHA256SUMS\n' '$SOURCE_SUMS_SHA' | sha256sum -c - >/dev/null; sha256sum -c SHA256SUMS >/dev/null; npm install -g ./prime-agent-$PA_VERSION.tgz" \
        >/dev/null 2>&1
    phase prime-agent-source-installed
fi

# Capture only the exact run-owned container's networks. Names are needed for
# disconnect but are removed before evidence inventory to avoid host identity.
NETWORK_NAMES="$(BOUNDED_OUTPUT_POLICY=network-list bounded \
    "$DOCKER_TIMEOUT" docker inspect --format \
    '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' \
    "$CONTAINER_ID")"
while IFS= read -r network; do
    [ -z "$network" ] || bounded "$DOCKER_TIMEOUT" \
        docker network disconnect "$network" "$CONTAINER_ID" >/dev/null 2>&1
done < <(printf '%s\n' "$NETWORK_NAMES")
unset NETWORK_NAMES
NETWORK_STATE="$(BOUNDED_OUTPUT_POLICY=network-state bounded \
    "$DOCKER_TIMEOUT" docker inspect --format \
    '{{json .NetworkSettings.Networks}}' "$CONTAINER_ID")"
[ "$NETWORK_STATE" = absent ] || \
    die "container still has an attached network; refusing offline steps"
unset NETWORK_STATE
NETWORK_TIME="$(now_utc)"
printf '{"verified_absent":true}\n' | \
    (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance write-json \
        "$TIER_DIR" "$TIER_BINDING" network.json)
phase network-absent

if [ "$MODE" = smoke ]; then
    bounded "$CHECK_TIMEOUT" docker exec "$CONTAINER_ID" bash -lc "$SMOKE_CMD" >/dev/null 2>&1
    phase smoke-passed
else
    if [ "$MODE" = source ]; then
        VERSION_COMMAND='const{execFileSync}=require("child_process");const r=execFileSync("npm",["root","-g"],{encoding:"utf8"}).trim();const p=require(r+"/prime-agent/package.json");process.stdout.write(String(p.version))'
        INSTALLED_VERSION="$(bounded "$DOCKER_TIMEOUT" docker exec "$CONTAINER_ID" \
            node -e "$VERSION_COMMAND" 2>/dev/null | \
            (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance parse-version))"
    else
        INSTALLED_VERSION="$(bounded "$DOCKER_TIMEOUT" docker exec "$CONTAINER_ID" \
            prime-agent --version 2>/dev/null | \
            (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance parse-version))"
    fi
    bounded "$DOCKER_TIMEOUT" docker exec "$CONTAINER_ID" bash -lc \
        'sha256sum "$(command -v prime-agent)"' 2>/dev/null | \
        (cd "$REPO_ROOT" && python3 -m scripts.testing.provenance capture-artifact \
            "$TIER_DIR" "$TIER_BINDING" installed-artifact.json "$INSTALLED_VERSION")
    [ "$INSTALLED_VERSION" = "$PA_VERSION" ] || die "installed Prime Agent version does not match validated requested version"
    bounded "$CHECK_TIMEOUT" docker exec -e "PRIME_AGENT_PLUGIN_ROOT=$CONTAINER_PLUGIN_ROOT" "$CONTAINER_ID" \
      /workspace/scripts/apply-prime-agent-plugin.sh >/dev/null 2>&1
    phase plugin-applied
    bounded "$CHECK_TIMEOUT" docker exec -e "PRIME_AGENT_PLUGIN_ROOT=$CONTAINER_PLUGIN_ROOT" "$CONTAINER_ID" \
      /workspace/scripts/check-prime-agent-plugin.sh >/dev/null 2>&1
    phase plugin-checked
    if [ "$PROBE" -eq 1 ]; then
        PROBE_VALIDATOR_B64="$(printf '%s' "$PROBE_VALIDATOR" | base64)"
        PROBE_STEP="mkdir -p /tmp/tier1-probe; set +e; printf '%s\n' '{\"id\":\"loader\",\"type\":\"get_commands\"}' | timeout --kill-after=$PROBE_KILL_GRACE $PROBE_DEADLINE prime-agent --mode rpc --offline --no-session --no-skills --no-prompt-templates --no-context-files --cwd /tmp/tier1-probe > /tmp/tier1-probe/probe.jsonl 2> /tmp/tier1-probe/probe.err; probe_rc=\$?; set -e; if [ \"\$probe_rc\" -ne 0 ]; then tail -c 2000 /tmp/tier1-probe/probe.err || true; exit 1; fi; printf '%s' '$PROBE_VALIDATOR_B64' | base64 -d > /tmp/tier1-probe/validate.py; python3 /tmp/tier1-probe/validate.py /tmp/tier1-probe/probe.jsonl"
        bounded "$PROBE_OUTER_TIMEOUT" docker exec "$CONTAINER_ID" bash -lc "$PROBE_STEP" >/dev/null 2>&1
        phase probe-passed
    fi
fi

echo "tier-1 driver: checks complete — teardown and manifest publication pending"
