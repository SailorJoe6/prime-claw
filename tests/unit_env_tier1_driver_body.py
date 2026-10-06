"""Unit-env body: recording-fake coverage for the tier-1 launcher/driver."""
from __future__ import annotations

from unit_env_entry import require_unit_env
require_unit_env()

import concurrent.futures, json, os, re, shutil, signal, subprocess, sys, tempfile, time, unittest
from pathlib import Path
from scripts.testing import provenance, bounded
REPO=Path(__file__).resolve().parent.parent
DRIVER=REPO/"scripts/test-tier1.sh"; ENV_EXAMPLE=REPO/".env.example"
IMAGE_ID="sha256:"+"a"*64; CID="c"*64; EXT="/root/.prime/agent/extensions"

def _validator_source():
    m=re.search(r"<<'PYEOF' \|\| true\n(.*?)\nPYEOF",DRIVER.read_text(),re.S)
    if not m: raise AssertionError("probe validator heredoc not found")
    return m.group(1)
def _cmd(name,path): return {"name":name,"sourceInfo":{"path":path}}
GOOD_COMMANDS=[_cmd("handoff",EXT+"/handoff.ts"),_cmd("plan",EXT+"/plan.ts"),_cmd("implement-spec",EXT+"/plan.ts")]
def _reply(commands=None,success=True):
    return json.dumps({"id":"loader","type":"response","command":"get_commands","success":success,"data":{"commands":GOOD_COMMANDS if commands is None else commands}})

class DriverHarness:
    def __init__(self,tmp:Path):
        tmp = tmp.resolve()
        self.tmp=tmp
        self.repo=tmp/"repo"
        for relative in ("scripts/test-tier1.sh",
                         "scripts/build-prime-agent-test-release.sh",
                         "scripts/testing/__init__.py",
                         "scripts/testing/bounded.py", "scripts/testing/provenance.py",
                         "scripts/testing/source_builder.py",
                         "scripts/testing/source_builder_payload.py",
                         "scripts/testing/tier1_supervisor.py",
                         "docker/test.Dockerfile",
                         "docker/test-prime-agent-builder.Dockerfile"):
            source=REPO/relative; target=self.repo/relative
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(source,target)
        self.driver=self.repo/"scripts/test-tier1.sh"
        dockerfile=self.repo/"docker/test.Dockerfile"
        self.dockerfile_sha=provenance.sha256_file(dockerfile)
        expected_context=tmp/"expected-build-context"; expected_context.mkdir()
        shutil.copy2(dockerfile,expected_context/"Dockerfile")
        self.build_input_sha=provenance.hash_declared_inputs(expected_context,["Dockerfile"])
        self.bin=tmp/"bin"; self.bin.mkdir(); self.log=tmp/"docker.args"; self.state=tmp/"state"
        python_wrapper=self.bin/"python3"
        python_wrapper.write_text("""#!/bin/sh
real_python=""" + repr(sys.executable) + """
if [ "$1" = - ] && [ "${FAKE_FAST_PYTHON:-0}" = 1 ]; then
  if [ "${2:-}" = TIER1_PROBE_DEADLINE ]; then
    cat >/dev/null
    exit 0
  fi
  a=${2:-0}; b=${3:-0}; c=${4:-0}; cat >/dev/null
  awk -v a="$a" -v b="$b" -v c="$c" 'BEGIN { print a+b+c }'
  exit 0
fi
if [ "$1" = -m ] && [ "$2" = scripts.testing.source_builder ] && [ -n "${FAKE_SOURCE_BUILDER:-}" ]; then
  shift 2
  exec "$real_python" "$FAKE_SOURCE_BUILDER" "$@"
fi
if [ "$1" = -m ] && [ "$2" = scripts.testing.provenance ] && [ "${FAKE_USE_REAL_PROVENANCE:-0}" != 1 ]; then
  shift 2
  command=$1; shift
  case "$command" in
    allocate)
      root=$1; tier=$2; mkdir -p "$root"
      run=20261003T000000Z-$$-00000000
      while ! mkdir "$root/$run" 2>/dev/null; do run=20261003T000000Z-$$-00000001; done
      mkdir "$root/$run/$tier"
      binding=$(stat -c '%d:%i:16384' "$root/$run/$tier")
      printf '%s\t%s\t%s\n' "$run" "$root/$run/$tier" "$binding" ;;
    snapshot)
      repo=$1; dest=$2; mkdir -p "$dest/docker"
      cp -R "$repo/scripts" "$dest/scripts"
      cp "$repo/docker/test.Dockerfile" "$dest/docker/test.Dockerfile"
      cp "$repo/docker/test-prime-agent-builder.Dockerfile" "$dest/docker/test-prime-agent-builder.Dockerfile"
      printf '%s\n' '{"content_hash_contract":"framed-sha256-v2","content_sha256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","dirty":false,"entry_count":1,"head":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","status_sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}' ;;
    directory-binding)
      stat -c '%d:%i:16384' "$1" ;;
    remove-owned-directory) rm -rf -- "$1" ;;
    write-json) root=$1; relative=$3; cat > "$root/$relative" ;;
    build-input) printf '%s\t%s\n' "$FAKE_DOCKERFILE_SHA" "$FAKE_BUILD_INPUT_SHA" ;;
    capture-image)
      if [ "${FAKE_REAL_CAPTURE_IMAGE:-0}" = 1 ]; then
        exec "$real_python" -m scripts.testing.provenance capture-image "$@"
      fi
      root=$1; binding=$2; relative=$3; path=$root/$relative; expected=$4; dockerfile=$5; dhash=$6; ihash=$7; tag=$8; started=$9; shift 9; finished=$1
      cat >/dev/null
      printf '{"architecture":"arm64","build_finished_at":"%s","build_started_at":"%s","declared_input_hash_contract":"framed-sha256-v2","declared_input_sha256":"%s","dockerfile":"%s","dockerfile_sha256":"%s","id":"%s","informational_tag":"%s","os":"linux","repo_digests":[]}\n' "$finished" "$started" "$ihash" "$dockerfile" "$dhash" "$expected" "$tag" > "$path" ;;
    parse-version) awk '{print $NF}' ;;
    capture-artifact)
      if [ "${FAKE_REAL_CAPTURE_ARTIFACT:-0}" = 1 ]; then
        exec "$real_python" -m scripts.testing.provenance capture-artifact "$@"
      fi
      root=$1; binding=$2; relative=$3; version=$4; path=$root/$relative; IFS=' ' read -r digest rest
      printf '%s' "$digest" | grep -Eq '^[0-9a-f]{64}$' || exit 1
      printf '{"executable_sha256":"%s","kind":"vendor-binary","version":"%s"}\n' "$digest" "$version" > "$path" ;;
    invalidate-green-manifest) command "$real_python" -m scripts.testing.provenance invalidate-green-manifest "$@" ;;
    *) exec "$real_python" -m scripts.testing.provenance "$command" "$@" ;;
  esac
  exit $?
fi
if [ "$1" = -c ] && [ -n "${FAKE_PUBLICATION_READY:-}" ]; then
  case "$2" in
    *atomic_write_manifest*)
      if mkdir "$FAKE_PUBLICATION_READY.once" 2>/dev/null; then
        : > "$FAKE_PUBLICATION_READY"
        trap '' TERM
        sleep 30
      fi ;;
  esac
fi
if [ "$1" = -m ] && [ "$2" = scripts.testing.bounded ]; then
  shift 2
  timeout_value= kill_grace= status_file= output_policy=passthrough
  while [ "$1" != -- ]; do
    case "$1" in
      --timeout) timeout_value=$2 ;;
      --kill-grace) kill_grace=$2 ;;
      --status-file) status_file=$2 ;;
      --output-policy) output_policy=$2 ;;
    esac
    shift 2
  done
  shift
  mode=${FAKE_USE_REAL_BOUNDED:-0}
  hang_target=0
  if [ "$mode" = hangs ] && [ "${1:-}" = docker ]; then
    joined="$*"
    case "${2:-}" in
      build) [ -z "${FAKE_HANG_BUILD:-}" ] || hang_target=1 ;;
      image) [ -z "${FAKE_HANG_IMAGE_INSPECT:-}" ] || hang_target=1 ;;
      run) [ -z "${FAKE_HANG_RUN:-}" ] || hang_target=1 ;;
      network) [ -z "${FAKE_HANG_DISCONNECT:-}" ] || hang_target=1 ;;
      inspect)
        if [ "${3:-}" = --format ]; then
          [ -z "${FAKE_HANG_NETWORK_INSPECT:-}" ] || hang_target=1
        else [ -z "${FAKE_HANG_FINAL_INSPECT:-}" ] || hang_target=1; fi ;;
      rm) [ -z "${FAKE_HANG_RM:-}" ] || hang_target=1 ;;
      exec)
        case "$joined" in *install.sh*) [ -z "${FAKE_HANG_INSTALL:-}" ] || hang_target=1 ;; esac
        case "$joined" in *apply-prime-agent-plugin.sh*) [ -z "${FAKE_HANG_APPLY:-}" ] || hang_target=1 ;; esac
        case "$joined" in *check-prime-agent-plugin.sh*) [ -z "${FAKE_HANG_CHECK:-}" ] || hang_target=1 ;; esac
        case "$joined" in *get_commands*) [ -z "${FAKE_HANG_PROBE:-}" ] || hang_target=1 ;; esac ;;
    esac
  fi
  if [ "$output_policy" != passthrough ] && [ "$hang_target" = 0 ] \
     && { [ "$mode" = fast ] || [ "$mode" = hangs ]; }; then
    rc=0; safe_output=
    case "$output_policy:$1:${2:-}" in
      image-inspect:docker:image)
        if [ -n "${FAKE_IMAGE_INSPECT_FAIL:-}" ]; then rc=4
        else
          safe_output='[{"Architecture":"arm64","Id":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","Os":"linux","RepoDigests":[]}]'
        fi ;;
      network-list:docker:inspect|network-state:docker:inspect)
        count=$(cat "$FAKE_DOCKER_STATE.count" 2>/dev/null || printf '0')
        count=$((count+1)); printf '%s\n' "$count" > "$FAKE_DOCKER_STATE.count"
        if [ "${FAKE_NETWORK_INSPECT_FAIL_AT:-}" = "$count" ]; then rc=5
        elif [ "$output_policy" = network-list ]; then
          [ ! -f "$FAKE_DOCKER_STATE.network" ] || safe_output=bridge
        elif [ -f "$FAKE_DOCKER_STATE.network" ]; then safe_output=present
        else safe_output=absent; fi ;;
      status:docker:rm)
        rm -f "$FAKE_DOCKER_STATE.present"
        [ -z "${FAKE_RM_FAIL:-}" ] || rc=1
        safe_output=$(printf '{"outcome":"exited","returncode":%s,"signal":null}' "$rc") ;;
      container-presence:docker:inspect)
        if [ -f "$FAKE_DOCKER_STATE.present" ]; then state_value=present; rc=0
        elif [ -n "${FAKE_INSPECT_UNKNOWN:-}" ]; then state_value=unknown; rc=1
        else state_value=absent; rc=1; fi
        safe_output=$(printf '{"outcome":"exited","returncode":%s,"signal":null,"state":"%s"}' "$rc" "$state_value") ;;
    esac
    printf '{"outcome":"exited","returncode":%s,"signal":null}\n' "$rc" > "$status_file"
    [ -z "$safe_output" ] || printf '%s\n' "$safe_output"
    exit "$rc"
  fi
  if [ "$mode" = 1 ] || [ "$hang_target" = 1 ] \
     || [ "$output_policy" != passthrough ] \
     || { [ "$mode" = cleanup ] && [ "${1:-}" = docker ] && [ "${2:-}" = rm ]; } \
     || { [ "$mode" = exec ] && [ "${1:-}" = docker ] && [ "${2:-}" = exec ]; } \
     || { [ "$mode" = signals ] && [ "${1:-}" = docker ] \
          && { [ "${2:-}" = exec ] || [ "${2:-}" = rm ]; }; } \
     || { [ "$mode" = publication ] && [ "${1:-}" = python3 ] \
          && [ "${2:-}" = -c ]; }; then
    exec "$real_python" -m scripts.testing.bounded --timeout "$timeout_value" --kill-grace "$kill_grace" --status-file "$status_file" --output-policy "$output_policy" -- "$@"
  fi
  set +e
  if [ "${1:-}" = docker ] && [ -n "${FAKE_DOCKER_IMPL:-}" ]; then
    shift
    . "$FAKE_DOCKER_IMPL"
    rc=$?
  else
    "$@"
    rc=$?
  fi
  set -e
  printf '{"outcome":"exited","returncode":%s,"signal":null}\n' "$rc" > "$status_file"
  exit "$rc"
fi
exec "$real_python" "$@"
""")
        python_wrapper.chmod(0o755)
        function_impl=python_wrapper.read_text().split("\n",1)[1]
        function_impl=re.sub(
            r'^(\s*)exec "\$real_python"(.*)$',
            r'\1command "$real_python"\2; return $?',
            function_impl, flags=re.MULTILINE)
        function_impl=re.sub(r"\bexit\b","return",function_impl)
        function_impl=function_impl.replace('exec "$@"','command "$@"; return $?')
        self.python_function="() {\n"+function_impl+"\n}"
        docker=self.bin/"docker"
        docker.write_text(r"""#!/bin/sh
set -eu
log=$FAKE_DOCKER_LOG
state=$FAKE_DOCKER_STATE
{
  for arg in "$@"; do printf '%s\037' "$arg"; done
  printf '\n'
} >> "$log"
cmd=${1:-}; [ "$#" -eq 0 ] || shift
hang() {
  flag=$1
  eval "value=\${$flag:-}"
  if [ -n "$value" ]; then trap '' TERM; sleep 30; fi
}
find_after() {
  wanted=$1; shift; previous=
  for arg in "$@"; do
    if [ "$previous" = "$wanted" ]; then printf '%s' "$arg"; return; fi
    previous=$arg
  done
  return 1
}
image=${FAKE_IMAGE_ID:-sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa}
cid=${FAKE_CID:-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc}
case "$cmd" in
  info) exit 0 ;;
  build)
    hang FAKE_HANG_BUILD
    [ -z "${FAKE_BUILD_FAIL:-}" ] || exit 9
    iid=$(find_after --iidfile "$@")
    printf '%s\n' "$image" > "$iid"
    exit 0 ;;
  image)
    [ "${1:-}" = inspect ] || exit 2
    hang FAKE_HANG_IMAGE_INSPECT
    [ -z "${FAKE_IMAGE_INSPECT_FAIL:-}" ] || { printf '%s\n' 'image inspect denied' >&2; exit 4; }
    if [ -n "${FAKE_UNSAFE_MANIFEST:-}" ]; then
      printf '%s\n' '[{"Id":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","RepoDigests":["http://10.0.4.225/private"],"Os":"linux","Architecture":"arm64"}]'
    else
      printf '%s\n' '[{"Id":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","RepoDigests":[],"Os":"linux","Architecture":"arm64"}]'
    fi
    exit 0 ;;
  run)
    [ -z "${FAKE_RUN_FAIL_NO_CID:-}" ] || { printf '%s\n' 'run denied' >&2; exit 8; }
    cidfile=$(find_after --cidfile "$@")
    printf '%s\n' "$cid" > "$cidfile"
    : > "$state.present"; : > "$state.network"; printf '0\n' > "$state.count"
    hang FAKE_HANG_RUN
    [ -z "${FAKE_RUN_FAIL_AFTER_CID:-}" ] || exit 8
    exit 0 ;;
  network)
    [ "${1:-}" = disconnect ] || exit 2
    hang FAKE_HANG_DISCONNECT
    [ -z "${FAKE_DISCONNECT_FAIL:-}" ] || { printf '%s\n' 'disconnect denied' >&2; exit 6; }
    [ -n "${FAKE_NETWORK_STUCK:-}" ] || rm -f "$state.network"
    exit 0 ;;
  exec)
    joined="$*"
    if [ -n "${FAKE_SIGNAL_READY_EXEC:-}" ]; then
      case "$joined" in *'node --version'*) : > "$FAKE_SIGNAL_READY_EXEC"; trap '' TERM; sleep 30 ;; esac
    fi
    case "$joined" in *install.sh*) hang FAKE_HANG_INSTALL ;; esac
    case "$joined" in *apply-prime-agent-plugin.sh*) hang FAKE_HANG_APPLY ;; esac
    case "$joined" in *check-prime-agent-plugin.sh*) hang FAKE_HANG_CHECK ;; esac
    case "$joined" in *get_commands*) hang FAKE_HANG_PROBE ;; esac
    if [ -n "${FAKE_INSTALL_FAIL:-}" ]; then case "$joined" in *install.sh*) exit 7 ;; esac; fi
    case "$joined" in *'prime-agent --version'*) printf '%s\n' "${FAKE_PA_VERSION:-0.9.8}" ;; esac
    case "$joined" in *sha256sum*)
      if [ -n "${FAKE_TRICK_HASH:-}" ]; then
        printf 'ab'; printf '%062d' 0 | tr 0 x; printf '  /root/.local/bin/prime-agent\n'
      elif [ -n "${FAKE_BAD_HASH:-}" ]; then printf '%s\n' 'bad  /root/.local/bin/prime-agent'
      else printf '%064d  /root/.local/bin/prime-agent\n' 0 | tr 0 f; fi ;;
    esac
    if [ -n "${FAKE_APPLY_FAIL:-}" ]; then case "$joined" in *apply-prime-agent-plugin.sh*) exit 7 ;; esac; fi
    if [ -n "${FAKE_CHECK_FAIL:-}" ]; then case "$joined" in *check-prime-agent-plugin.sh*) exit 7 ;; esac; fi
    if [ -n "${FAKE_PROBE_FAIL:-}" ]; then case "$joined" in *get_commands*) exit 7 ;; esac; fi
    if [ -n "${FAKE_SMOKE_FAIL:-}" ]; then case "$joined" in *'node --version'*) exit 9 ;; esac; fi
    if [ -n "${FAKE_UNSAFE_LOG:-}" ]; then case "$joined" in *'node --version'*) printf '%s\n' 'Authorization: Bearer abcdefghijklmnop' ;; esac; fi
    exit 0 ;;
  rm)
    rm -f "$state.present"
    hang FAKE_HANG_RM
    [ -z "${FAKE_RM_FAIL:-}" ] || exit 1
    if [ -n "${FAKE_SIGNAL_READY_RM:-}" ]; then
      : > "$FAKE_SIGNAL_READY_RM"; trap '' TERM; sleep 30
    fi
    if [ -n "${FAKE_RM_SELF_SIGNAL:-}" ]; then kill -"$FAKE_RM_SELF_SIGNAL" "$$"; sleep .1; fi
    if [ -n "${FAKE_RM_SIGNAL:-}" ]; then kill -"$FAKE_RM_SIGNAL" "$PPID"; sleep .1; fi
    exit 0 ;;
  inspect)
    if [ "${1:-}" = --format ]; then
      hang FAKE_HANG_NETWORK_INSPECT
      count=$(cat "$state.count" 2>/dev/null || printf '0')
      count=$((count+1)); printf '%s\n' "$count" > "$state.count"
      if [ "${FAKE_NETWORK_INSPECT_FAIL_AT:-}" = "$count" ]; then printf '%s\n' 'daemon unavailable' >&2; exit 5; fi
      template=${2:-}
      case "$template" in *json*) if [ -f "$state.network" ]; then printf '%s\n' '{"bridge":{}}'; else printf '%s\n' '{}'; fi ;;
        *) [ ! -f "$state.network" ] || printf '%s\n' bridge ;;
      esac
      exit 0
    fi
    hang FAKE_HANG_FINAL_INSPECT
    if [ -f "$state.present" ]; then printf '%s\n' '[{}]'; exit 0; fi
    if [ -n "${FAKE_INSPECT_UNKNOWN:-}" ]; then printf '%s\n' 'Cannot connect to the Docker daemon' >&2; exit 1; fi
    printf 'Error: No such container: %s\n' "$cid" >&2; exit 1 ;;
esac
exit 2
""")
        docker_impl=self.bin/"docker.impl"
        implementation=re.sub(r"\bexit\b","return",docker.read_text())
        implementation=implementation.replace("#!/bin/sh\nset -eu\n","set -u\n",1)
        docker_impl.write_text(implementation)
        docker.write_text('#!/bin/sh\n. "$FAKE_DOCKER_IMPL"\n')
        docker.chmod(0o755)
        self.docker_impl=docker_impl
        fake_builder=tmp/"fake-source-builder.py"
        fake_builder.write_text(r'''#!/usr/bin/env python3
import argparse, os, sys
from pathlib import Path
parser=argparse.ArgumentParser()
parser.add_argument("--source",required=True); parser.add_argument("--workspace",required=True)
parser.add_argument("--tier-dir",required=True); parser.add_argument("--tier-binding",required=True)
parser.add_argument("--share",required=True); parser.add_argument("--share-binding",required=True)
parser.add_argument("--image-timeout"); parser.add_argument("--build-timeout")
args=parser.parse_args()
sys.path.insert(0,args.workspace)
from scripts.testing import provenance as p
scenario=os.environ.get("FAKE_SOURCE_BUILDER_SCENARIO","missing")
share=Path(args.share); release=share/"source-release"; release.mkdir(parents=True)
(release/"sentinel").write_text("builder-evidence")
if scenario == "missing": raise SystemExit(1)
with p.open_owned_directory(Path(args.tier_dir),args.tier_binding) as owned:
    if scenario == "invalid":
        p.write_sanitized_json(owned,"source-build.json",{"status":"failed"})
    else:
        source=p.repository_source_manifest(Path(args.source))
        inventory=p.checkout_inventory(Path(args.source))
        state=scenario if scenario in {"present","unknown"} else "absent"
        clean=scenario == "clean"
        receipt={
            "schema_version":1,"status":"failed",
            "started_at":"2026-10-04T00:00:00Z","finished_at":"2026-10-04T00:00:01Z",
            "failure_codes":["builder-failed"],"source":source["identity"],
            "source_rules":{"include":source["include_rule"],"exclude":source["exclude_rule"]},
            "checkout_inventory_before":inventory,"checkout_inventory_after":inventory,
            "builder_image":{"id":"sha256:"+"a"*64,"repo_digests":[],
                "dockerfile":"docker/test-prime-agent-builder.Dockerfile",
                "dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,
                "declared_input_hash_contract":"framed-sha256-v2",
                "informational_tag":"prime-claw-test-prime-agent-builder:eeeeeeeeeeee",
                "os":"linux","architecture":"arm64",
                "build_started_at":"2026-10-04T00:00:00Z",
                "build_finished_at":"2026-10-04T00:00:01Z"},
            "builder_teardown":{"container_id":"c"*64,"state":state,
                "remove_outcome":("ordinary_nonzero" if scenario == "ordinary_nonzero" else
                    "clean" if state in {"absent","present"} else "ordinary_nonzero"),
                "inspect_outcome":"ordinary_nonzero" if state in {"absent","unknown"} else "clean",
                "clean":clean,"verified_at":"2026-10-04T00:00:01Z"},
            "release":None,
        }
        p.write_sanitized_json(owned,"source-build.json",receipt)
raise SystemExit(1)
''')
        fake_builder.chmod(0o755)
        self.fake_source_builder=fake_builder
    def init_git(self):
        subprocess.run(["git","init","-q",str(self.repo)],check=True)
        subprocess.run(["git","-C",str(self.repo),"config","user.email","test@example.invalid"],check=True)
        subprocess.run(["git","-C",str(self.repo),"config","user.name","Test"],check=True)
        subprocess.run(["git","-C",str(self.repo),"add","."],check=True)
        subprocess.run(["git","-C",str(self.repo),"commit","-qm","fixture"],check=True)

    def env(self,env_file=None,**extra):
        env=dict(os.environ); env.update({"PATH":os.pathsep.join([str(self.bin),"/usr/bin","/bin"]),"FAKE_DOCKER_LOG":str(self.log),"FAKE_DOCKER_STATE":str(self.state),"TIER1_RESULTS_ROOT":str(self.tmp/"results"),"FAKE_FAST_PYTHON":"1","FAKE_DOCKERFILE_SHA":self.dockerfile_sha,"FAKE_BUILD_INPUT_SHA":self.build_input_sha,"FAKE_DOCKER_IMPL":str(self.docker_impl),"FAKE_SOURCE_BUILDER":str(self.fake_source_builder),
            "BASH_FUNC_python3%%":self.python_function,
            "PRIME_CLAW_TIER1_INNER":"1"})
        if env_file is not None: env["TIER1_ENV_FILE"]=str(env_file)
        env.update(extra); return env
    def run(self,*args,env,cwd=None): return subprocess.run([str(self.driver),*args],capture_output=True,text=True,timeout=90,env=env,cwd=cwd or self.repo)
    def calls(self):
        if not self.log.exists(): return []
        return [[arg for arg in line.split("\x1f") if arg]
                for line in self.log.read_text().splitlines()]

class TestSelectorFailClose(unittest.TestCase):
    def test_neither_and_both_fail_before_docker(self):
        values=("PRIME_AGENT_PINNED=\nPRIME_AGENT_SOURCE=\n",
                "PRIME_AGENT_PINNED=0.9.8\nPRIME_AGENT_SOURCE=/private\n")
        def check(text):
            with tempfile.TemporaryDirectory() as td:
                tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp); envf=tmp/"x.env"; envf.write_text(text)
                out=h.run("--dry-run",env=h.env(envf))
                self.assertNotEqual(out.returncode,0); self.assertFalse(h.log.exists())
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            list(pool.map(check,values))
    def test_source_dry_run_describes_builder_without_checkout_or_docker_contact(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp); source=tmp/"sentinel-source"; source.mkdir(); sentinel=source/"must-stay"; sentinel.write_text("unchanged")
            envf=tmp/"source.env"; envf.write_text(f"PRIME_AGENT_SOURCE={source}\n"); out=h.run("--dry-run",env=h.env(envf))
            self.assertEqual(out.returncode,0,out.stderr); self.assertIn("disposable source builder",out.stdout); self.assertNotIn(str(source),out.stdout+out.stderr)
            self.assertEqual(sentinel.read_text(),"unchanged"); self.assertFalse(h.log.exists())

    def test_malicious_pinned_versions_fail_before_docker(self):
        values=("0.9.8'; touch /tmp/pwned; echo '", "0.9.8;uname", "0.9.8-beta", "0.9.8\nEVIL=1")
        def check(value):
            with tempfile.TemporaryDirectory() as td:
                tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp); envf=tmp/"bad.env"
                envf.write_text("PRIME_AGENT_PINNED="+value+"\n")
                out=h.run(env=h.env(envf)); self.assertNotEqual(out.returncode,0)
                self.assertRegex(out.stderr,r"exact semantic version|unsupported keys")
                self.assertFalse(h.log.exists())
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(check,values))

class TestSourceBuilderOwnership(unittest.TestCase):
    def _run(self, scenario):
        temporary=tempfile.TemporaryDirectory(); tmp=Path(temporary.name).resolve()
        h=DriverHarness(tmp); h.init_git()
        envf=tmp/"source.env"; envf.write_text(f"PRIME_AGENT_SOURCE={h.repo}\n")
        unrelated=tmp/"unrelated"; unrelated.write_text("keep")
        out=h.run(env=h.env(envf,FAKE_SOURCE_BUILDER_SCENARIO=scenario))
        self.assertNotEqual(out.returncode,0,out.stdout+out.stderr)
        self.assertEqual(unrelated.read_text(),"keep")
        self.assertFalse(any(call and call[0]=="run" for call in h.calls()))
        tier=next((tmp/"results").glob("*/tier1"))
        manifests=list(tier.glob("manifest.json"))
        if manifests:
            self.assertNotEqual(json.loads(manifests[0].read_text())["run"]["status"],"passed")
        return temporary,tier,out

    def test_public_driver_retains_share_for_uncertain_builder_receipts(self):
        for scenario in ("present","unknown","missing","invalid"):
            with self.subTest(scenario=scenario):
                temporary,tier,out=self._run(scenario)
                with temporary:
                    share=tier/"share"
                    self.assertTrue(share.is_dir(),out.stdout+out.stderr)
                    self.assertEqual((share/"source-release"/"sentinel").read_text(),
                                     "builder-evidence")
                    rendered=out.stdout+out.stderr+"".join(
                        path.read_text(errors="replace") for path in tier.rglob("*")
                        if path.is_file())
                    self.assertNotIn("synthetic-secret",rendered)

    def test_public_driver_retains_share_for_ordinary_nonzero_builder_removal(self):
        temporary,tier,out=self._run("ordinary_nonzero")
        with temporary:
            self.assertTrue((tier/"share").is_dir(),out.stdout+out.stderr)

    def test_public_driver_deletes_share_after_clean_builder_and_no_runtime(self):
        temporary,tier,_out=self._run("clean")
        with temporary:
            self.assertFalse((tier/"share").exists())


class TestInformationalAndSelectorEdges(unittest.TestCase):
    def test_missing_env_fails_before_docker(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp); out=h.run(env=h.env(tmp/"absent.env"))
            self.assertNotEqual(out.returncode,0); self.assertIn("missing env file",out.stderr); self.assertFalse(h.log.exists())
    def test_smoke_skips_env_selection(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp); out=h.run("--smoke","--dry-run",env=h.env(tmp/"absent.env"))
            self.assertEqual(out.returncode,0,out.stderr); self.assertFalse(h.log.exists())

class TestPinnedLifecycle(unittest.TestCase):
    def _pinned(self,tmp):
        h=DriverHarness(tmp); envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n"); return h,envf
    def test_dry_run_is_docker_free_and_describes_exact_lifecycle(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h,envf=self._pinned(tmp); out=h.run("--dry-run","--probe",env=h.env(envf))
            self.assertEqual(out.returncode,0,out.stderr); self.assertFalse(h.log.exists())
            for n in ("--iidfile","--cidfile","captured-image-id","disconnect","manifest.json"): self.assertIn(n,out.stdout)
    def test_smoke_failure_publishes_failed_manifest_then_fresh_pinned_replay_passes(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); outside=tmp/"outside"; outside.mkdir(); h,envf=self._pinned(tmp)
            failed=h.run("--smoke",env=h.env(None,FAKE_SMOKE_FAIL="1"))
            self.assertNotEqual(failed.returncode,0); self.assertNotIn("driver: OK",failed.stdout)
            failed_path=next((tmp/"results").glob("*/tier1/manifest.json"))
            failed_bytes=failed_path.read_bytes(); failed_manifest=json.loads(failed_bytes)
            provenance.validate_manifest(failed_manifest)
            self.assertEqual(failed_manifest["run"]["status"],"failed")
            self.assertIsNone(failed_manifest["prime_agent"])

            call_offset=len(h.calls())
            passed=h.run("--probe",env=h.env(envf,TIER1_PROBE_DEADLINE="7",TIER1_PROBE_KILL_GRACE="2"),cwd=outside)
            self.assertEqual(passed.returncode,0,passed.stdout+passed.stderr)
            calls=h.calls()[call_offset:]; verbs=[c[0] for c in calls]
            run=next(c for c in calls if c[0]=="run")
            self.assertEqual(verbs[0],"info"); self.assertIn(IMAGE_ID,run); self.assertNotIn("prime-claw-test-tier1:latest",run)
            di=next(i for i,c in enumerate(calls) if c[:2]==["network","disconnect"])
            for needle in ("apply-prime-agent-plugin.sh","check-prime-agent-plugin.sh","get_commands"):
                self.assertLess(di,next(i for i,c in enumerate(calls) if needle in " ".join(c)))
            self.assertEqual(verbs[-2:],["rm","inspect"])
            probe=next(" ".join(c) for c in calls if "get_commands" in " ".join(c))
            self.assertIn("timeout --kill-after=2 7 prime-agent --mode rpc",probe)

            manifests=list((tmp/"results").glob("*/tier1/manifest.json"))
            self.assertEqual(len(manifests),2); self.assertEqual(failed_path.read_bytes(),failed_bytes)
            passed_path=next(path for path in manifests if path != failed_path)
            manifest=json.loads(passed_path.read_text())
            provenance.validate_manifest(manifest)
            binding = provenance.owned_directory_binding(passed_path.parent)
            with provenance.open_owned_directory(passed_path.parent, binding) as owned:
                provenance.verify_evidence(owned, manifest)
            self.assertEqual(sorted(json.loads(path.read_text())["run"]["status"] for path in manifests),["failed","passed"])
            self.assertEqual(manifest["image"]["id"],IMAGE_ID); self.assertTrue(manifest["network"]["verified_absent"]); self.assertEqual(manifest["teardown"]["state"],"absent")
            mounts=[run[i+1] for i,value in enumerate(run[:-1]) if value=="-v"]
            self.assertEqual(len(mounts),2); self.assertTrue(mounts[0].endswith(":/workspace:ro"))
            scratch_source,scratch_target=mounts[1].split(":",1)
            self.assertTrue(scratch_source.endswith("/tier1/share")); self.assertEqual(scratch_target,"/test-results")
            tier_dir=passed_path.parent; self.assertNotEqual(Path(scratch_source),tier_dir)
            self.assertEqual(manifest["image"]["dockerfile_sha256"],provenance.sha256_file(tier_dir/"build-context/Dockerfile"))
            self.assertEqual(manifest["image"]["declared_input_sha256"],provenance.hash_declared_inputs(tier_dir/"build-context",["Dockerfile"]))

    def test_launcher_sigterm_after_cid_then_during_cleanup_is_prompt_and_never_green(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp)
            exec_ready=tmp/"exec.ready"; cleanup_ready=tmp/"cleanup.ready"
            env=h.env(None,FAKE_USE_REAL_BOUNDED="signals",
                      PRIME_CLAW_TIER1_INNER="0",
                      TIER1_DOCKER_KILL_GRACE="0.2",
                      FAKE_SIGNAL_READY_EXEC=str(exec_ready),
                      FAKE_SIGNAL_READY_RM=str(cleanup_ready))
            proc=subprocess.Popen([str(DRIVER),"--smoke"],cwd=REPO,env=env,
                stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)

            def await_checkpoint(path):
                deadline=time.monotonic()+8
                while time.monotonic()<deadline and not path.exists() and proc.poll() is None:
                    time.sleep(.01)
                if not path.exists():
                    if proc.poll() is None: proc.kill()
                    stdout,stderr=proc.communicate(timeout=3)
                    self.fail(f"launcher missed {path.name}: {stdout} {stderr}")

            await_checkpoint(exec_ready)
            started=time.monotonic(); os.kill(proc.pid,signal.SIGTERM)
            await_checkpoint(cleanup_ready)
            os.kill(proc.pid,signal.SIGTERM)
            stdout,stderr=proc.communicate(timeout=6)
            # Scheduler contention from the parallel producer matrix can delay
            # process reaping; the contract is still bounded far below the 30s target.
            self.assertLess(time.monotonic()-started,6)
            self.assertEqual(proc.returncode,128+signal.SIGTERM,(stdout,stderr))
            self.assertNotIn("driver: OK",stdout)
            manifest_path=next((tmp/"results").glob("*/tier1/manifest.json"))
            manifest=json.loads(manifest_path.read_text())
            provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"],"failed")
            self.assertIn("interrupted",manifest["run"]["failure_codes"])
            self.assertEqual(manifest["teardown"]["state"],"absent")
            self.assertFalse(manifest["teardown"]["clean"])
            self.assertEqual(manifest["teardown"]["remove_outcome"],"interrupted")


    def test_signal_during_manifest_publication_never_leaves_green_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp); ready=tmp/"publication.ready"
            env=h.env(None,FAKE_USE_REAL_BOUNDED="publication",
                      PRIME_CLAW_TIER1_INNER="0",
                      FAKE_PUBLICATION_READY=str(ready),
                      TIER1_DOCKER_KILL_GRACE="0.2")
            proc=subprocess.Popen([str(h.driver),"--smoke"],cwd=h.repo,env=env,
                stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
            deadline=time.monotonic()+30
            while time.monotonic()<deadline and not ready.exists() and proc.poll() is None:
                time.sleep(.01)
            self.assertTrue(ready.exists(),proc.communicate(timeout=2) if proc.poll() is not None else None)
            os.kill(proc.pid,signal.SIGTERM)
            stdout,stderr=proc.communicate(timeout=8)
            self.assertEqual(proc.returncode,128+signal.SIGTERM,(stdout,stderr))
            self.assertNotIn("driver: OK",stdout)
            path=next((tmp/"results").glob("*/tier1/manifest.json"))
            manifest=json.loads(path.read_text()); provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"],"failed")
            self.assertIn("interrupted",manifest["run"]["failure_codes"])

    def test_supervisor_closure_signal_is_typed_and_redelivered(self):
        code = r'''
import json, os, signal, sys
from scripts.testing import tier1_supervisor as supervisor
signum = int(sys.argv[1])
seen = []
def prior(received, _frame):
    seen.append(received)
signal.signal(signum, prior)
previous = {sig: signal.getsignal(sig) for sig in supervisor.WATCHED}
prior_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
calls = []
def close(_status, failed):
    calls.append(failed)
    if len(calls) == 1:
        os.kill(os.getpid(), signum)
    return True
supervisor._close_evidence = close
rc = supervisor.supervise('/usr/bin/true', [])
restored_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
print(json.dumps({
    'calls': calls,
    'handlers_restored': all(signal.getsignal(sig) == handler
                             for sig, handler in previous.items()),
    'mask_restored': restored_mask == prior_mask,
    'rc': rc,
    'seen': seen,
}))
'''
        watched = tuple(sig for sig in
                        (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
                        if sig is not None)
        for signum in watched:
            with self.subTest(signal=signal.Signals(signum).name):
                out = subprocess.run(
                    [sys.executable, "-c", code, str(int(signum))], cwd=REPO,
                    capture_output=True, text=True, timeout=10)
                self.assertEqual(out.returncode, 0, out.stderr)
                row = json.loads(out.stdout)
                self.assertEqual(row["calls"], [False, True])
                self.assertEqual(row["rc"], 128 + signum)
                self.assertEqual(row["seen"], [signum])
                self.assertTrue(row["handlers_restored"])
                self.assertTrue(row["mask_restored"])

    def test_supervisor_preserves_caller_blocked_pending_signal(self):
        code = r'''
import json, os, signal
from scripts.testing import tier1_supervisor as supervisor
signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})
os.kill(os.getpid(), signal.SIGTERM)
rc = supervisor.supervise('/usr/bin/true', [])
print(json.dumps({
    'pending': signal.SIGTERM in signal.sigpending(),
    'rc': rc,
    'still_blocked': signal.SIGTERM in signal.pthread_sigmask(
        signal.SIG_BLOCK, []),
}))
'''
        out = subprocess.run(
            [sys.executable, "-c", code], cwd=REPO,
            capture_output=True, text=True, timeout=10)
        self.assertEqual(out.returncode, 0, out.stderr)
        row = json.loads(out.stdout)
        self.assertEqual(row, {"pending": True, "rc": 0,
                               "still_blocked": True})

    def test_public_supervisor_closure_signal_invalidates_green_then_replays(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td).resolve(); h = DriverHarness(tmp)
            supervisor_path = h.repo / "scripts/testing/tier1_supervisor.py"
            source = supervisor_path.read_text()
            marker = "def _close_evidence(status: tuple[Path, str] | None, failed: bool) -> bool:\n"
            injection = marker + r'''    if os.environ.get("FAKE_SUPERVISOR_CLOSE_SIGNAL") == "1":
        os.environ["FAKE_SUPERVISOR_CLOSE_SIGNAL"] = "sent"
        os.kill(os.getpid(), signal.SIGTERM)
'''
            self.assertIn(marker, source)
            supervisor_path.write_text(source.replace(marker, injection, 1))
            env = h.env(None, PRIME_CLAW_TIER1_INNER="0",
                        FAKE_SUPERVISOR_CLOSE_SIGNAL="1")
            out = subprocess.run(
                ["/bin/sh", "-c", 'trap "" TERM; exec "$1" "$2"',
                 "supervised-tier1", str(h.driver), "--smoke"],
                cwd=h.repo, env=env, capture_output=True, text=True, timeout=20)
            self.assertEqual(out.returncode, 128 + signal.SIGTERM,
                             (out.stdout, out.stderr))
            self.assertNotIn("driver: OK", out.stdout)
            manifests = list((tmp / "results").glob("*/tier1/manifest.json"))
            self.assertEqual(len(manifests), 1)
            manifest = json.loads(manifests[0].read_text())
            provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"], "failed")
            self.assertIn("publication-invalidated",
                          manifest["run"]["failure_codes"])
            self.assertEqual(manifest["teardown"]["state"], "absent")

            replay = h.run("--smoke", env=h.env(
                None, PRIME_CLAW_TIER1_INNER="0"))
            self.assertEqual(replay.returncode, 0,
                             (replay.stdout, replay.stderr))
            replay_manifests = list(
                (tmp / "results").glob("*/tier1/manifest.json"))
            self.assertEqual(len(replay_manifests), 2)
            statuses = sorted(json.loads(path.read_text())["run"]["status"]
                              for path in replay_manifests)
            self.assertEqual(statuses, ["failed", "passed"])

    def test_target_signal_death_cannot_green_cleanup(self):
        for signal_name in ("KILL","TERM","INT"):
            with self.subTest(signal=signal_name), tempfile.TemporaryDirectory() as td:
                tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp)
                out=h.run("--smoke",env=h.env(None,
                    FAKE_USE_REAL_BOUNDED="cleanup",
                    FAKE_RM_SELF_SIGNAL=signal_name,
                    TIER1_DOCKER_KILL_GRACE="0.2"))
                self.assertNotEqual(out.returncode,0)
                self.assertNotIn("driver: OK",out.stdout)
                path=next((tmp/"results").glob("*/tier1/manifest.json"))
                manifest=json.loads(path.read_text()); provenance.validate_manifest(manifest)
                self.assertEqual(manifest["run"]["status"],"failed")
                self.assertEqual(manifest["teardown"]["state"],"absent")
                self.assertEqual(manifest["teardown"]["remove_outcome"],"signaled")
                self.assertFalse(manifest["teardown"]["clean"])

    def test_rm_ordinary_nonzero_with_proven_absence_is_nonclean(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp)
            out=h.run("--smoke",env=h.env(None,
                FAKE_USE_REAL_BOUNDED="fast", FAKE_RM_FAIL="1"))
            self.assertNotEqual(out.returncode,0,out.stdout+out.stderr)
            path=next((tmp/"results").glob("*/tier1/manifest.json"))
            manifest=json.loads(path.read_text()); provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"],"failed")
            self.assertEqual(manifest["teardown"]["state"],"absent")
            self.assertEqual(manifest["teardown"]["remove_outcome"],"ordinary_nonzero")
            self.assertFalse(manifest["teardown"]["clean"])
            self.assertTrue((path.parent/"share").is_dir())

    def _exercise_matrix_row(self, harness, matrix_root, label, extra, args=()):
        tmp=matrix_root/label; tmp.mkdir(); envf=tmp/"pinned.env"
        envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
        controls={"FAKE_USE_REAL_BOUNDED":"fast", **extra}
        env=harness.env(envf,**controls)
        env.update({"FAKE_DOCKER_LOG":str(tmp/"docker.args"),
                    "FAKE_DOCKER_STATE":str(tmp/"state"),
                    "TIER1_RESULTS_ROOT":str(tmp/"results")})
        started=time.monotonic(); out=harness.run(*args,env=env)
        self.assertLess(time.monotonic()-started,30,label)
        self.assertNotEqual(out.returncode,0,(label,out.stdout,out.stderr))
        self.assertNotIn("driver: OK",out.stdout)
        manifests=list((tmp/"results").glob("*/tier1/manifest.json"))
        self.assertEqual(len(manifests),1,(label,out.stdout,out.stderr))
        manifest=json.loads(manifests[0].read_text()); provenance.validate_manifest(manifest)
        self.assertEqual(manifest["run"]["status"],"failed")
        return label

    def test_standalone_ordinary_failure_contract_matrix(self):
        failures=(
            ("build", {"FAKE_BUILD_FAIL":"1"}),
            ("image-inspect", {"FAKE_IMAGE_INSPECT_FAIL":"1"}),
            ("run-no-cid", {"FAKE_RUN_FAIL_NO_CID":"1"}),
            ("run-after-cid", {"FAKE_RUN_FAIL_AFTER_CID":"1"}),
            ("invalid-cid", {"FAKE_CID":"not-a-valid-cid"}),
            ("install", {"FAKE_INSTALL_FAIL":"1"}),
            ("network-initial", {"FAKE_NETWORK_INSPECT_FAIL_AT":"1"}),
            ("disconnect", {"FAKE_DISCONNECT_FAIL":"1"}),
            ("network-attached", {"FAKE_NETWORK_STUCK":"1"}),
            ("network-final", {"FAKE_NETWORK_INSPECT_FAIL_AT":"2"}),
            ("apply", {"FAKE_APPLY_FAIL":"1"}),
            ("check", {"FAKE_CHECK_FAIL":"1"}),
            ("probe", {"FAKE_PROBE_FAIL":"1"}, ("--probe",)),
            ("version", {"FAKE_PA_VERSION":"0.9.7"}),
            ("teardown-unknown", {"FAKE_INSPECT_UNKNOWN":"1"}),
        )
        with tempfile.TemporaryDirectory() as td:
            root=Path(td).resolve(); harness=DriverHarness(root/"harness")
            def exercise(row):
                label,extra,*tail=row
                return self._exercise_matrix_row(
                    harness,root,label,extra,tail[0] if tail else ())
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                self.assertEqual(set(pool.map(exercise,failures)),
                                 {row[0] for row in failures})

    def test_standalone_deadline_contract_matrix_is_sequential(self):
        rows=(
            ("timeout-build","FAKE_HANG_BUILD",()),
            ("timeout-image-inspect","FAKE_HANG_IMAGE_INSPECT",()),
            ("timeout-run","FAKE_HANG_RUN",()),
            ("timeout-install","FAKE_HANG_INSTALL",()),
            ("timeout-network-inspect","FAKE_HANG_NETWORK_INSPECT",()),
            ("timeout-disconnect","FAKE_HANG_DISCONNECT",()),
            ("timeout-apply","FAKE_HANG_APPLY",()),
            ("timeout-check","FAKE_HANG_CHECK",()),
            ("timeout-probe","FAKE_HANG_PROBE",("--probe",)),
            ("timeout-rm","FAKE_HANG_RM",()),
            ("timeout-final-inspect","FAKE_HANG_FINAL_INSPECT",()),
        )
        with tempfile.TemporaryDirectory() as td:
            root=Path(td).resolve(); harness=DriverHarness(root/"harness")
            for label,flag,args in rows:
                with self.subTest(phase=label):
                    controls={"FAKE_USE_REAL_BOUNDED":"hangs",flag:"1",
                        "TIER1_DOCKER_KILL_GRACE":"0.10","TIER1_DOCKER_TIMEOUT":"0.30",
                        "TIER1_BUILD_TIMEOUT":"0.30","TIER1_INSTALL_TIMEOUT":"0.30",
                        "TIER1_CHECK_TIMEOUT":"0.30","TIER1_PROBE_DEADLINE":"0.20",
                        "TIER1_PROBE_KILL_GRACE":"0.10",
                        "TIER1_REMOVE_TIMEOUT":"0.30",
                        "TIER1_FINAL_INSPECT_TIMEOUT":"0.30"}
                    self._exercise_matrix_row(harness,root,label,controls,args)

    def test_private_image_metadata_is_filtered_before_any_named_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp)
            marker=b"http://10.0.4.225/private"
            out=h.run("--smoke",env=h.env(None,FAKE_UNSAFE_MANIFEST="1",
                FAKE_REAL_CAPTURE_IMAGE="1"))
            self.assertEqual(out.returncode,0,out.stdout+out.stderr)
            tier=next((tmp/"results").glob("*/tier1"))
            named=b"".join(path.read_bytes() for path in tier.rglob("*") if path.is_file())
            self.assertNotIn(marker,named)
            self.assertFalse(any("image-inspect" in path.name for path in tier.rglob("*")))

    def test_malformed_full_length_iid_is_refused_before_inspect_or_run(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp)
            malformed="sha256:"+"a"*63+"x"
            out=h.run("--smoke",env=h.env(None,FAKE_IMAGE_ID=malformed))
            self.assertNotEqual(out.returncode,0); self.assertNotIn("driver: OK",out.stdout)
            calls=h.calls(); self.assertFalse(any(c[:2]==["image","inspect"] for c in calls))
            self.assertFalse(any(c and c[0]=="run" for c in calls))

    def test_malformed_artifact_is_never_written_before_failed_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp); envf=tmp/"pinned.env"
            envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            out=h.run(env=h.env(envf,FAKE_TRICK_HASH="1",FAKE_REAL_CAPTURE_ARTIFACT="1"))
            self.assertNotEqual(out.returncode,0); self.assertNotIn("driver: OK",out.stdout)
            tier=next((tmp/"results").glob("*/tier1"))
            self.assertFalse((tier/"installed-artifact.json").exists())
            all_bytes=b"".join(p.read_bytes() for p in tier.rglob("*") if p.is_file())
            self.assertNotIn(b"ab"+b"x"*62,all_bytes)
            manifest=json.loads((tier/"manifest.json").read_text())
            provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"],"failed")


class TestBoundedExternalWaits(unittest.TestCase):
    @unittest.skipUnless(hasattr(signal, "pthread_sigmask"),
                         "requires POSIX signal masks")
    def test_terminal_restoration_is_blocked_for_every_typed_outcome(self):
        controller = r'''
import json, os, signal, sys, tempfile
from pathlib import Path
from scripts.testing import bounded
case = sys.argv[1]
injected_signal = int(sys.argv[2])
watched = bounded.signal.SIGTERM, bounded.signal.SIGINT, bounded.signal.SIGHUP
seen = []
def prior(signum, _frame):
    seen.append(int(signum))
for signum in watched:
    signal.signal(signum, prior)
prior_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
real_signal = bounded.signal.signal
calls = 0
def inject_on_first_restore(signum, handler):
    global calls
    calls += 1
    if calls == len(watched) + 1:
        os.kill(os.getpid(), injected_signal)
    return real_signal(signum, handler)
bounded.signal.signal = inject_on_first_restore
error = None
result = None
try:
    if case == 'ordinary':
        argv = ['/usr/bin/true']
        timeout = 2
    elif case == 'timeout':
        argv = [sys.executable, '-c', 'import time; time.sleep(30)']
        timeout = .1
    elif case == 'launch_error':
        root = Path(tempfile.mkdtemp())
        target = root / 'invalid-executable'
        target.write_bytes(b'not an executable format\n')
        target.chmod(0o755)
        argv = [str(target)]
        timeout = 2
    elif case == 'target_death':
        argv = [sys.executable, '-c',
                'import os,signal; os.kill(os.getpid(),signal.SIGKILL)']
        timeout = 2
    result = bounded.run_completed(
        argv, timeout=timeout, kill_grace=.1, reap_grace=.1,
        capture_output=True, text=True)
except BaseException as exc:
    error = type(exc).__name__
finally:
    bounded.signal.signal = real_signal
restored_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
print(json.dumps({
    'error': error,
    'handlers_restored': all(signal.getsignal(sig) is prior for sig in watched),
    'mask_restored': restored_mask == prior_mask,
    'outcome': None if result is None else result.outcome,
    'returncode': None if result is None else result.returncode,
    'seen': seen,
    'signal': None if result is None else result.signal,
}))
'''
        expected = {
            "ordinary": ("exited", 0, None),
            "timeout": ("timed_out", bounded.TIMEOUT_EXIT, None),
            "launch_error": ("launch_error", 127, None),
            "target_death": ("signaled", -signal.SIGKILL, signal.SIGKILL),
        }
        for case, (outcome, returncode, target_signal) in expected.items():
            for injected_signal in (signal.SIGTERM, signal.SIGINT,
                                    signal.SIGHUP):
                with self.subTest(case=case,
                                  signal=signal.Signals(injected_signal).name):
                    completed = subprocess.run(
                        [sys.executable, "-c", controller, case,
                         str(int(injected_signal))],
                        cwd=REPO, capture_output=True, text=True, timeout=5)
                    self.assertEqual(completed.returncode, 0,
                                     completed.stdout + completed.stderr)
                    row = json.loads(completed.stdout)
                    self.assertIsNone(row["error"])
                    self.assertTrue(row["handlers_restored"])
                    self.assertTrue(row["mask_restored"])
                    self.assertEqual(row["seen"], [injected_signal])
                    self.assertEqual(
                        (row["outcome"], row["returncode"], row["signal"]),
                        (outcome, returncode, target_signal))

    @unittest.skipUnless(hasattr(signal, "pthread_sigmask")
                         and hasattr(signal, "sigpending"),
                         "requires POSIX pending-signal inspection")
    def test_terminal_restoration_preserves_caller_owned_pending_signals(self):
        controller = r'''
import json, os, signal, sys, tempfile
from pathlib import Path
from scripts.testing import bounded
case = sys.argv[1]
seen = []
def prior(signum, _frame):
    seen.append(int(signum))
for signum in bounded.WATCHED if hasattr(bounded, 'WATCHED') else (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
    signal.signal(signum, prior)
signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})
os.kill(os.getpid(), signal.SIGTERM)
prior_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
if case == 'ordinary':
    argv = ['/usr/bin/true']; timeout = 2
elif case == 'timeout':
    argv = [sys.executable, '-c', 'import time; time.sleep(30)']; timeout = .1
elif case == 'launch_error':
    root = Path(tempfile.mkdtemp()); target = root / 'invalid-executable'
    target.write_bytes(b'not an executable format\n'); target.chmod(0o755)
    argv = [str(target)]; timeout = 2
else:
    argv = [sys.executable, '-c',
            'import os,signal; os.kill(os.getpid(),signal.SIGKILL)']
    timeout = 2
result = bounded.run_completed(
    argv, timeout=timeout, kill_grace=.1, reap_grace=.1,
    capture_output=True, text=True)
restored_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
print(json.dumps({
    'handlers_restored': all(signal.getsignal(sig) is prior for sig in
        (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)),
    'mask_restored': restored_mask == prior_mask,
    'pending': signal.SIGTERM in signal.sigpending(),
    'seen': seen,
    'outcome': result.outcome,
    'returncode': result.returncode,
    'signal': result.signal,
}))
'''
        expected = {
            "ordinary": ("exited", 0, None),
            "timeout": ("timed_out", bounded.TIMEOUT_EXIT, None),
            "launch_error": ("launch_error", 127, None),
            "target_death": ("signaled", -signal.SIGKILL, signal.SIGKILL),
        }
        for case, outcome in expected.items():
            with self.subTest(case=case):
                completed = subprocess.run(
                    [sys.executable, "-c", controller, case], cwd=REPO,
                    capture_output=True, text=True, timeout=5)
                self.assertEqual(completed.returncode, 0,
                                 completed.stdout + completed.stderr)
                row = json.loads(completed.stdout)
                self.assertTrue(row["handlers_restored"])
                self.assertTrue(row["mask_restored"])
                self.assertTrue(row["pending"])
                self.assertEqual(row["seen"], [])
                self.assertEqual(
                    (row["outcome"], row["returncode"], row["signal"]),
                    outcome)

    def test_output_policies_never_emit_raw_diagnostics_and_preserve_target_status(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td).resolve()
            def invoke(name, policy, source):
                status=root/(name+".json")
                result=subprocess.run(
                    [sys.executable,"-m","scripts.testing.bounded",
                     "--timeout","2","--kill-grace",".2",
                     "--status-file",str(status),"--output-policy",policy,
                     "--",sys.executable,"-c",source], cwd=REPO,
                    capture_output=True, timeout=4)
                return result,json.loads(status.read_text())
            image,status=invoke(
                "image","image-inspect",
                "import os;os.write(1,b'[{' + b'\"Id\":\"sha256:' + b'a'*64 + b'\",\"Os\":\"linux\",\"Architecture\":\"arm64\",\"RepoDigests\":[],\"Private\":\"RAW_SECRET\"}]');os.write(2,b'RAW_SECRET')")
            self.assertEqual(image.returncode,0)
            self.assertNotIn(b"RAW_SECRET",image.stdout+image.stderr)
            self.assertNotIn("Private",json.loads(image.stdout)[0])
            self.assertEqual(status["outcome"],"exited")
            invalid,status=invoke(
                "network","network-list",
                "import os;os.write(1,b'bridge\\xff\\n');os.write(2,b'RAW_SECRET')")
            self.assertEqual(invalid.returncode,65)
            self.assertEqual(invalid.stdout+invalid.stderr,b"")
            self.assertEqual(status,{"outcome":"exited","returncode":0,"signal":None})
            presence,status=invoke(
                "presence","container-presence",
                "import os,sys;os.write(2,b'No such container: RAW_SECRET');sys.exit(1)")
            self.assertEqual(presence.returncode,1)
            self.assertNotIn(b"RAW_SECRET",presence.stdout+presence.stderr)
            self.assertEqual(json.loads(presence.stdout)["state"],"absent")
            self.assertEqual(status["outcome"],"exited")

    def test_child_restores_intended_mask_and_receives_graceful_term(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); mask=tmp/"mask.json"; marker=tmp/"term.marker"
            child=tmp/"mask_child.py"
            child.write_text(
                "import json,os,signal,sys,time\n"
                "mask=signal.pthread_sigmask(signal.SIG_BLOCK,set())\n"
                "open(sys.argv[1],'w').write(json.dumps(sorted(map(int,mask))))\n"
                "def stop(*_): open(sys.argv[2],'w').write('term'); raise SystemExit(0)\n"
                "signal.signal(signal.SIGTERM,stop); time.sleep(30)\n")
            result=bounded.run_completed([sys.executable,str(child),str(mask),str(marker)],
                timeout=.3,kill_grace=.5,reap_grace=.5,capture_output=True,text=True)
            self.assertEqual((result.outcome,result.returncode),("timed_out",124))
            self.assertTrue(marker.exists())
            blocked=set(json.loads(mask.read_text()))
            original=set(map(int,signal.pthread_sigmask(signal.SIG_BLOCK,set())))
            self.assertEqual(blocked,original)

    def test_exec_failure_after_preflight_stays_typed_launch_error(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td).resolve(); target=root/"invalid-executable"; status=root/"status.json"
            target.write_bytes(b"not an executable format\n"); target.chmod(0o755)
            result=bounded.run_completed([str(target)],timeout=2,kill_grace=.2,
                                         capture_output=True,text=True)
            self.assertEqual(result.outcome,"launch_error")
            self.assertEqual(result.returncode,127)
            cli=subprocess.run([sys.executable,"-m","scripts.testing.bounded",
                                "--timeout","2","--kill-grace",".2",
                                "--status-file",str(status),"--",str(target)],
                               cwd=REPO,capture_output=True,text=True,timeout=4)
            self.assertEqual(cli.returncode,127)
            self.assertEqual(json.loads(status.read_text()),
                             {"outcome":"launch_error","returncode":127,
                              "signal":None})

    def test_cli_status_distinguishes_exit_137_from_sigkill(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve()
            rows=[]
            for name,code in (("exit","import sys;sys.exit(137)"),
                              ("signal","import os,signal;os.kill(os.getpid(),signal.SIGKILL)")):
                status=tmp/(name+".json")
                out=subprocess.run([sys.executable,"-m","scripts.testing.bounded",
                    "--timeout","2","--kill-grace",".2","--status-file",str(status),
                    "--",sys.executable,"-c",code],cwd=REPO)
                rows.append((out.returncode,json.loads(status.read_text())))
            self.assertEqual(rows[0][1]["outcome"],"exited")
            self.assertEqual(rows[1][1]["outcome"],"signaled")
            self.assertEqual(rows[1][1]["signal"],signal.SIGKILL)
            self.assertEqual(rows[0][0],rows[1][0])

    def test_post_spawn_signal_is_forwarded_without_orphan_window(self):
        child_source = r"""
import json, os, signal, sys
from pathlib import Path
sys.path.insert(0, sys.argv[2])
from scripts.testing import bounded
pidfile = Path(sys.argv[1])
real_popen = bounded.subprocess.Popen

def spawn_then_signal(*args, **kwargs):
    process = real_popen(*args, **kwargs)
    pidfile.write_text(str(process.pid))
    os.kill(os.getpid(), signal.SIGTERM)
    return process

bounded.subprocess.Popen = spawn_then_signal
result = bounded.run_completed(
    [sys.executable, "-c", "import time; time.sleep(30)"],
    timeout=5, kill_grace=.2, reap_grace=.2,
    capture_output=True, text=True)
print(json.dumps({"returncode": result.returncode,
                  "outcome": result.outcome,
                  "signal": result.signal}))
"""
        with tempfile.TemporaryDirectory() as td:
            root=Path(td).resolve(); child=root/"controller.py"; child.write_text(child_source)
            pidfile=root/"target.pid"
            completed=subprocess.run(
                [sys.executable,str(child),str(pidfile),str(REPO)],cwd=REPO,
                capture_output=True,text=True,timeout=6)
            target=int(pidfile.read_text()) if pidfile.exists() else None
            try:
                self.assertEqual(completed.returncode,0,
                                 completed.stdout+completed.stderr)
                result=json.loads(completed.stdout)
                self.assertEqual(result,
                    {"returncode":128+signal.SIGTERM,
                     "outcome":"interrupted","signal":signal.SIGTERM})
                with self.assertRaises(ProcessLookupError):
                    os.killpg(target,0)
            finally:
                if target is not None:
                    try: os.killpg(target,signal.SIGKILL)
                    except ProcessLookupError: pass

    def test_runner_escalates_term_to_kill_with_bounded_latency(self):
        with tempfile.TemporaryDirectory() as td:
            sleeper=Path(td).resolve()/"sleeper.py"; sleeper.write_text("import signal,time\nsignal.signal(signal.SIGTERM,signal.SIG_IGN)\ntime.sleep(30)\n")
            started=time.monotonic(); out=subprocess.run([sys.executable,"-m","scripts.testing.bounded","--timeout","0.2","--kill-grace","0.2","--",sys.executable,str(sleeper)],capture_output=True,text=True,cwd=REPO)
            self.assertEqual(out.returncode,124); self.assertLess(time.monotonic()-started,2); self.assertIn("timed out",out.stderr)

    def test_runner_forwards_sigterm_and_kills_ignoring_process_group(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); child_pid=tmp/"child.pid"; grand_pid=tmp/"grand.pid"; child=tmp/"tree.py"
            grand_code="import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)"
            child.write_text("import pathlib,signal,subprocess,sys,time\n"+"signal.signal(signal.SIGTERM,signal.SIG_IGN)\n"+f"g=subprocess.Popen([sys.executable,'-c',{grand_code!r}])\n"+f"pathlib.Path({str(child_pid)!r}).write_text(str(__import__('os').getpid()))\n"+f"pathlib.Path({str(grand_pid)!r}).write_text(str(g.pid))\n"+"time.sleep(60)\n")
            runner=subprocess.Popen([sys.executable,"-m","scripts.testing.bounded","--timeout","60","--kill-grace","0.3","--",sys.executable,str(child)],cwd=REPO)
            states=[]
            try:
                deadline=time.monotonic()+3
                while time.monotonic()<deadline and not (child_pid.exists() and grand_pid.exists()): time.sleep(.02)
                self.assertTrue(child_pid.exists() and grand_pid.exists()); pids=[int(child_pid.read_text()),int(grand_pid.read_text())]
                os.kill(runner.pid,signal.SIGTERM); self.assertEqual(runner.wait(timeout=3),143)
                deadline=time.monotonic()+3
                while time.monotonic()<deadline:
                    states=[subprocess.run(["ps","-o","stat=","-p",str(pid)],capture_output=True,text=True).stdout.strip() for pid in pids]
                    if all(not state or state.startswith("Z") for state in states): break
                    time.sleep(.02)
                self.assertTrue(all(not state or state.startswith("Z") for state in states),states)
            finally:
                if runner.poll() is None: runner.kill(); runner.wait()

    def test_detached_child_holding_captured_streams_cannot_extend_deadline(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); pidfile=tmp/"detached.pid"; leader=tmp/"leader.py"
            child_code="import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)"
            leader.write_text(
                "import pathlib,subprocess,sys,time\n"
                f"p=subprocess.Popen([sys.executable,'-c',{child_code!r}],start_new_session=True,stdout=sys.stdout,stderr=sys.stderr)\n"
                f"pathlib.Path({str(pidfile)!r}).write_text(str(p.pid))\n"
                "time.sleep(60)\n")
            started=time.monotonic()
            out=subprocess.run([sys.executable,"-m","scripts.testing.bounded",
                                "--timeout","0.15","--kill-grace","0.10","--",
                                sys.executable,str(leader)],capture_output=True,text=True,cwd=REPO,timeout=3)
            elapsed=time.monotonic()-started
            self.assertEqual(out.returncode,124); self.assertLess(elapsed,1.5)
            self.assertTrue(pidfile.exists())
            pid=int(pidfile.read_text())
            try: os.kill(pid,signal.SIGKILL)
            except ProcessLookupError: pass

    def test_leader_exit_on_term_does_not_spare_same_group_child(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve().resolve(); pidfile=tmp/"child.pid"; leader=tmp/"leader.py"
            child_code="import signal,time; signal.signal(signal.SIGTERM,signal.SIG_IGN); time.sleep(60)"
            leader.write_text(
                "import pathlib,subprocess,sys,time\n"
                f"p=subprocess.Popen([sys.executable,'-c',{child_code!r}])\n"
                f"pathlib.Path({str(pidfile)!r}).write_text(str(p.pid))\n"
                "time.sleep(60)\n")
            out=subprocess.run([sys.executable,"-m","scripts.testing.bounded",
                                "--timeout","0.15","--kill-grace","0.10","--",
                                sys.executable,str(leader)],capture_output=True,text=True,cwd=REPO,timeout=3)
            self.assertEqual(out.returncode,124); self.assertTrue(pidfile.exists())
            pid=int(pidfile.read_text())
            deadline=time.monotonic()+1
            while time.monotonic()<deadline:
                state=subprocess.run(["ps","-o","stat=","-p",str(pid)],capture_output=True,text=True).stdout.strip()
                if not state or state.startswith("Z"): break
                time.sleep(.02)
            self.assertTrue(not state or state.startswith("Z"),state)

    def test_deadline_controls_fail_closed_before_docker(self):
        values=(("TIER1_PROBE_DEADLINE","0"),("TIER1_PROBE_KILL_GRACE","bad;uname"),("TIER1_DOCKER_TIMEOUT","999999"))
        def check(row):
            key,value=row
            with tempfile.TemporaryDirectory() as td:
                tmp=Path(td).resolve().resolve(); h=DriverHarness(tmp)
                out=h.run("--smoke",env=h.env(None,FAKE_FAST_PYTHON="0",**{key:value}))
                self.assertNotEqual(out.returncode,0); self.assertIn("bounded",out.stderr)
                self.assertFalse(h.log.exists())
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(check,values))



if __name__=="__main__": unittest.main()
