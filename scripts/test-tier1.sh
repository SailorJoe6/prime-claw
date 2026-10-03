#!/usr/bin/env bash
# test-tier1.sh — isolated host launcher for the prime-claw tier-1 suite.
#
# Pinned mode installs Prime Agent while the run-owned container is online,
# disconnects every captured network, verifies the network set is empty, and
# only then runs version/artifact capture, plugin apply/check, and the optional
# RPC probe. Source mode is intentionally disabled until Slice 2 supplies a
# disposable builder. Every real run records sanitized provenance below
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
    # Slice 1 safety boundary: do not stat, echo, build, clean, pack, or mount
    # the selected checkout. Slice 2 replaces this stop with an isolated builder.
    if [ -n "$SOURCE" ]; then
        die "PRIME_AGENT_SOURCE is disabled until isolated source builder Slice 2 (prime-claw-5v7.1) lands; use PRIME_AGENT_PINNED"
    fi
    if ! [[ "$PINNED" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
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

validate_deadline() {
    local name="$1" value="$2" max="$3"
    [[ "$value" =~ ^[1-9][0-9]*$ ]] \
        || die "$name must be a bounded positive integer"
    [ "$value" -le "$max" ] \
        || die "$name exceeds the bounded supported maximum"
}
validate_deadline TIER1_PROBE_DEADLINE "$PROBE_DEADLINE" 900
validate_deadline TIER1_PROBE_KILL_GRACE "$PROBE_KILL_GRACE" 60
validate_deadline TIER1_DOCKER_KILL_GRACE "$DOCKER_KILL_GRACE" 60
validate_deadline TIER1_DOCKER_TIMEOUT "$DOCKER_TIMEOUT" 1800
validate_deadline TIER1_BUILD_TIMEOUT "$BUILD_TIMEOUT" 3600
validate_deadline TIER1_INSTALL_TIMEOUT "$INSTALL_TIMEOUT" 1800
validate_deadline TIER1_CHECK_TIMEOUT "$CHECK_TIMEOUT" 1800
PROBE_OUTER_TIMEOUT=$((PROBE_DEADLINE + PROBE_KILL_GRACE + DOCKER_TIMEOUT))

bounded() {
    local timeout="$1"; shift
    (cd "$REPO_ROOT" && python3 -m scripts.testing.bounded --timeout "$timeout" \
        --kill-grace "$DOCKER_KILL_GRACE" -- "$@")
}

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

BUILD_INPUT_HASH="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance hash-inputs "$REPO_ROOT" "$DOCKERFILE")"
IMAGE_TAG="prime-claw-test-tier1:${BUILD_INPUT_HASH:0:12}"
echo "tier-1 driver: dockerfile=$DOCKERFILE tag=$IMAGE_TAG"
if [ "$SMOKE" -eq 1 ]; then
    echo "tier-1 driver: mode=smoke"
else
    echo "tier-1 driver: mode=pinned PRIME_AGENT_VERSION=$PINNED"
fi
if [ "$PROBE" -eq 1 ]; then echo "tier-1 driver: offline RPC probe enabled"; fi

if [ "$DRY_RUN" -eq 1 ]; then
    echo "dry-run: allocate .test-results/<run-id>/tier1"
    echo "dry-run: docker build --iidfile <run>/tier1/image.iid -f <run>/tier1/build-context/Dockerfile -t $IMAGE_TAG <run>/tier1/build-context"
    echo "dry-run: docker run -d --cidfile <run>/tier1/container.cid <captured-image-id> sleep infinity"
    if [ "$SMOKE" -eq 0 ]; then
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

IFS=$'\t' read -r RUN_ID TIER_DIR <<EOF
$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance allocate "$RESULTS_ROOT" tier1)
EOF
RUN_STARTED="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance now)"
MODE=pinned
[ "$SMOKE" -eq 1 ] && MODE=smoke
WORKSPACE_SNAPSHOT="$RESULTS_ROOT/.workspaces/$RUN_ID"
(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance snapshot \
    "$REPO_ROOT" "$WORKSPACE_SNAPSHOT") > "$TIER_DIR/repository.json"
BUILD_CONTEXT="$TIER_DIR/build-context"
mkdir -p "$BUILD_CONTEXT"
cp "$REPO_ROOT/$DOCKERFILE" "$BUILD_CONTEXT/Dockerfile"
DOCKERFILE_HASH="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance hash-file "$REPO_ROOT/$DOCKERFILE")"
IIDFILE="$TIER_DIR/image.iid"
CIDFILE="$TIER_DIR/container.cid"
SETUP_LOG="$TIER_DIR/setup.log"
: > "$SETUP_LOG"
phase() { printf 'phase=%s\n' "$1" >>"$SETUP_LOG"; }
phase run-allocated
IMAGE_META="$TIER_DIR/image.json"
NETWORK_TMP="$TIER_DIR/.networks.tmp"
NETWORK_TIME=""
BUILD_STARTED=""
BUILD_FINISHED=""
CONTAINER_ID=""
RUN_ATTEMPTED=0
TEARDOWN_STATE=absent
TEARDOWN_VERIFIED=""
RUN_STATUS=failed

finalize_manifest() {
    [ -n "$TEARDOWN_VERIFIED" ] || return 1
    FINISHED="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance now)"
    cd "$REPO_ROOT"
    python3 - "$TIER_DIR" "$RUN_ID" "$RUN_STARTED" "$FINISHED" "$RUN_STATUS" \
      "$MODE" "$PINNED" "$BUILD_STARTED" "$BUILD_FINISHED" "$DOCKERFILE_HASH" \
      "$BUILD_INPUT_HASH" "$IMAGE_TAG" "$NETWORK_TIME" "$TEARDOWN_STATE" \
      "$TEARDOWN_VERIFIED" <<'PYMANIFEST'
import json, sys
from pathlib import Path
from scripts.testing import provenance as p
(tier_s, run_id, started, finished, status, mode, requested,
 build_started, build_finished, dockerfile_hash, input_hash, tag,
 network_time, teardown_state, teardown_time) = sys.argv[1:]
tier = Path(tier_s)
repo = json.loads((tier / "repository.json").read_text())
image_path = tier / "image.json"
image_meta = (json.loads(image_path.read_text())
              if image_path.is_file() and image_path.stat().st_size else None)
prime = None
package_path = tier / "installed-artifact.json"
if mode == "pinned":
    artifact = None
    installed_version = None
    if package_path.is_file() and package_path.stat().st_size:
        artifact = json.loads(package_path.read_text())
        installed_version = artifact["version"]
    prime = {"mode": "pinned", "requested_version": requested,
             "installed_version": installed_version, "artifact": artifact}
image = None
if image_meta is not None:
    image = {"id": image_meta["Id"],
             "repo_digests": image_meta.get("RepoDigests") or [],
             "dockerfile": "docker/test.Dockerfile",
             "dockerfile_sha256": dockerfile_hash,
             "declared_input_sha256": input_hash,
             "informational_tag": tag,
             "os": image_meta["Os"], "architecture": image_meta["Architecture"],
             "build_started_at": build_started,
             "build_finished_at": build_finished}
manifest = {
    "schema_version": p.SCHEMA_VERSION,
    "command_contract_version": p.COMMAND_CONTRACT_VERSION,
    "run": {"id": run_id, "tier": "tier1", "mode": mode,
             "started_at": started, "finished_at": finished, "status": status},
    "repository": repo,
    "prime_agent": prime,
    "image": image,
    "network": {"disconnected_at": network_time or None,
                "verified_absent": bool(network_time)},
    "teardown": {"state": teardown_state, "verified_at": teardown_time},
    "evidence": {"files": []},
}
manifest["evidence"]["files"] = p.evidence_inventory(tier)
p.atomic_write_manifest(tier / "manifest.json", manifest)
p.verify_evidence(tier, manifest)
PYMANIFEST
}

cleanup() {
    original_rc=$?
    trap - EXIT INT TERM
    set +e
    rm -f "$NETWORK_TMP"
    cleanup_rc=0
    if [ -z "$CONTAINER_ID" ] && [ -s "$CIDFILE" ]; then
        raw_cid="$(cat "$CIDFILE")"
        if [[ "$raw_cid" =~ ^[0-9a-f]{64}$ ]]; then
            CONTAINER_ID="$raw_cid"
        else
            cleanup_rc=1
            TEARDOWN_STATE=unknown
            printf 'teardown refused invalid cidfile identity\n' >>"$SETUP_LOG"
        fi
    fi
    if [ -z "$CONTAINER_ID" ] && [ "$RUN_ATTEMPTED" -eq 1 ]; then
        cleanup_rc=1
        TEARDOWN_STATE=unknown
    fi
    if [ -n "$CONTAINER_ID" ]; then
        TEARDOWN_JSON="$(cd "$REPO_ROOT" && python3 - "$CONTAINER_ID" "$DOCKER_KILL_GRACE" <<'PYTEARDOWN'
import json, sys
from scripts.testing.bounded import TIMEOUT_EXIT, run_completed
cid, grace = sys.argv[1], float(sys.argv[2])
fatal = None
try:
    rm = run_completed(["docker", "rm", "-f", cid], capture_output=True,
                       text=True, timeout=60, kill_grace=grace)
    rm_rc = rm.returncode
    if rm_rc == TIMEOUT_EXIT:
        fatal = "timeout"
except OSError:
    fatal, rm_rc = "launch-error", None
try:
    inspected = run_completed(["docker", "inspect", cid],
                              capture_output=True, text=True,
                              timeout=15, kill_grace=grace)
    blob = ((inspected.stdout or "") + "\n" +
            (inspected.stderr or "")).lower()
    if inspected.returncode == 0:
        state = "present"
    elif inspected.returncode == TIMEOUT_EXIT:
        state = "unknown"
    elif "no such container" in blob or "no such object" in blob:
        state = "absent"
    else:
        state = "unknown"
except OSError:
    state = "unknown"
ok = fatal is None and state == "absent"
print(json.dumps({"state": state, "ok": ok, "rm_rc": rm_rc,
                  "fatal": fatal}, sort_keys=True))
raise SystemExit(0 if ok else 1)
PYTEARDOWN
)"
        cleanup_rc=$?
        TEARDOWN_STATE="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["state"])' "$TEARDOWN_JSON")"
        printf 'teardown %s\n' "$TEARDOWN_JSON" >>"$SETUP_LOG"
    fi
    TEARDOWN_VERIFIED="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance now)"
    if [ "$TEARDOWN_STATE" = absent ] && [ -d "$WORKSPACE_SNAPSHOT" ]; then
        python3 - "$WORKSPACE_SNAPSHOT" <<'PYCLEAN'
import shutil, sys
shutil.rmtree(sys.argv[1])
PYCLEAN
        [ $? -eq 0 ] || cleanup_rc=1
    elif [ -d "$WORKSPACE_SNAPSHOT" ]; then
        printf 'workspace snapshot preserved because teardown is %s\n' "$TEARDOWN_STATE" >>"$SETUP_LOG"
    fi
    if [ "$original_rc" -eq 0 ] && [ "$cleanup_rc" -eq 0 ]; then RUN_STATUS=passed; fi
    finalize_manifest >/dev/null 2>&1
    manifest_rc=$?
    if [ "$manifest_rc" -ne 0 ]; then
        cleanup_rc=1
        phase manifest-failed
    fi
    if [ "$original_rc" -eq 0 ] && [ "$cleanup_rc" -eq 0 ]; then
        echo "tier-1 driver: OK — immutable image launched, network absent, checks passed, teardown verified, manifest published"
    fi
    echo "tier-1 driver: evidence=$TIER_DIR"
    final_rc=$original_rc
    [ "$final_rc" -ne 0 ] || final_rc=$cleanup_rc
    exit "$final_rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

BUILD_ARGS=()
if [ "$NO_CACHE" -eq 1 ]; then BUILD_ARGS+=(--no-cache); fi
BUILD_STARTED="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance now)"
phase image-build-started
bounded "$BUILD_TIMEOUT" docker build ${BUILD_ARGS[@]+"${BUILD_ARGS[@]}"} --iidfile "$IIDFILE" \
    -f "$BUILD_CONTEXT/Dockerfile" -t "$IMAGE_TAG" "$BUILD_CONTEXT" \
    >/dev/null 2>&1
BUILD_FINISHED="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance now)"
phase image-built
[ -s "$IIDFILE" ] || die "docker build did not publish the run-owned iidfile"
IMAGE_ID="$(cat "$IIDFILE")"
case "$IMAGE_ID" in sha256:[0-9a-f][0-9a-f]*) ;; *) die "invalid image ID in iidfile" ;; esac
[ "${#IMAGE_ID}" -eq 71 ] || die "invalid image ID length in iidfile"
bounded "$DOCKER_TIMEOUT" docker image inspect "$IMAGE_ID" | python3 -c \
 'import json,sys; x=json.load(sys.stdin)[0]; print(json.dumps({k:x.get(k) for k in ("Id","RepoDigests","Os","Architecture")},sort_keys=True))' \
 > "$IMAGE_META"
python3 - "$IMAGE_META" "$IMAGE_ID" <<'PYIMAGE'
import json, re, sys
m=json.load(open(sys.argv[1])); expected=sys.argv[2]
if m.get("Id") != expected or not re.fullmatch(r"sha256:[0-9a-f]{64}", expected):
    raise SystemExit("image inspect identity did not match iidfile")
if not m.get("Os") or not m.get("Architecture"):
    raise SystemExit("image inspect omitted platform identity")
PYIMAGE

NAME="prime-claw-tier1-${RUN_ID//[^a-zA-Z0-9_.-]/-}"
MOUNTS=(-v "$WORKSPACE_SNAPSHOT:/workspace:ro" -v "$TIER_DIR:/test-results")
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
fi

# Capture only the exact run-owned container's networks. Names are needed for
# disconnect but are removed before evidence inventory to avoid host identity.
bounded "$DOCKER_TIMEOUT" docker inspect --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}}{{"\n"}}{{end}}' \
    "$CONTAINER_ID" > "$NETWORK_TMP"
while IFS= read -r network; do
    [ -z "$network" ] || bounded "$DOCKER_TIMEOUT" docker network disconnect "$network" "$CONTAINER_ID" \
        >/dev/null 2>&1
done < "$NETWORK_TMP"
NETWORK_JSON="$(bounded "$DOCKER_TIMEOUT" docker inspect --format '{{json .NetworkSettings.Networks}}' \
    "$CONTAINER_ID")"
[ "$NETWORK_JSON" = "{}" ] || die "container still has an attached network; refusing offline steps"
rm -f "$NETWORK_TMP"
NETWORK_TIME="$(cd "$REPO_ROOT" && python3 -m scripts.testing.provenance now)"
printf '{"verified_absent":true}\n' > "$TIER_DIR/network.json"
phase network-absent

if [ "$MODE" = smoke ]; then
    bounded "$CHECK_TIMEOUT" docker exec "$CONTAINER_ID" bash -lc "$SMOKE_CMD" >/dev/null 2>&1
    phase smoke-passed
else
    VERSION_OUTPUT="$(bounded "$DOCKER_TIMEOUT" docker exec "$CONTAINER_ID" prime-agent --version 2>/dev/null)"
    INSTALLED_VERSION="$(python3 -c 'import re,sys; m=re.search(r"[0-9]+(?:\.[0-9]+)+",sys.argv[1]); print(m.group(0) if m else "")' "$VERSION_OUTPUT")"
    [ "$INSTALLED_VERSION" = "$PINNED" ] || die "installed Prime Agent version does not match requested pinned version"
    EXECUTABLE_SHA="$(bounded "$DOCKER_TIMEOUT" docker exec "$CONTAINER_ID" bash -lc 'sha256sum "$(command -v prime-agent)"' 2>/dev/null | awk '{print $1}')"
    case "$EXECUTABLE_SHA" in [0-9a-f][0-9a-f]*) ;; *) die "installed Prime Agent executable hash is invalid" ;; esac
    [ "${#EXECUTABLE_SHA}" -eq 64 ] || die "installed Prime Agent executable hash is invalid"
    python3 - "$TIER_DIR/installed-artifact.json" "$INSTALLED_VERSION" "$EXECUTABLE_SHA" <<'PYPACKAGE'
import json, sys
path, version, digest = sys.argv[1:]
with open(path, "w", encoding="utf-8") as fh:
    json.dump({"kind": "vendor-binary", "version": version,
               "executable_sha256": digest}, fh,
              sort_keys=True, separators=(",", ":"))
    fh.write("\n")
PYPACKAGE
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
