"""Tier-0 coverage for the Slice-1 exact-image/offline tier-1 driver."""
from __future__ import annotations
import json, os, re, signal, subprocess, sys, tempfile, time, unittest
from pathlib import Path
from scripts.testing import provenance
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
        self.tmp=tmp; self.bin=tmp/"bin"; self.bin.mkdir(); self.log=tmp/"docker.args"; self.state=tmp/"state"
        python_wrapper=self.bin/"python3"
        python_wrapper.write_text("""#!/bin/sh
real_python=""" + repr(sys.executable) + """
if [ "$1" = -m ] && [ "$2" = scripts.testing.bounded ]; then
  shift 2
  timeout_value= kill_grace=
  while [ "$1" != -- ]; do
    case "$1" in --timeout) timeout_value=$2 ;; --kill-grace) kill_grace=$2 ;; esac
    shift 2
  done
  shift
  mode=${FAKE_USE_REAL_BOUNDED:-0}
  if [ "$mode" = 1 ] \
     || { [ "$mode" = cleanup ] && [ "${1:-}" = docker ] && [ "${2:-}" = rm ]; } \
     || { [ "$mode" = exec ] && [ "${1:-}" = docker ] && [ "${2:-}" = exec ]; } \
     || { [ "$mode" = signals ] && [ "${1:-}" = docker ] \
          && { [ "${2:-}" = exec ] || [ "${2:-}" = rm ]; }; }; then
    exec "$real_python" -m scripts.testing.bounded --timeout "$timeout_value" --kill-grace "$kill_grace" -- "$@"
  fi
  exec "$@"
fi
exec "$real_python" "$@"
""")
        python_wrapper.chmod(0o755)
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
image=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
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
    if [ -n "${FAKE_UNSAFE_MANIFEST:-}" ]; then
      printf '%s\n' '[{"Id":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","RepoDigests":["http://10.0.4.225/private"],"Os":"linux","Architecture":"arm64"}]'
    else
      printf '%s\n' '[{"Id":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","RepoDigests":[],"Os":"linux","Architecture":"arm64"}]'
    fi
    exit 0 ;;
  run)
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
      if [ -n "${FAKE_BAD_HASH:-}" ]; then printf '%s\n' 'bad  /root/.local/bin/prime-agent'
      else printf '%064d  /root/.local/bin/prime-agent\n' 0 | tr 0 f; fi ;;
    esac
    if [ -n "${FAKE_APPLY_FAIL:-}" ]; then case "$joined" in *apply-prime-agent-plugin.sh*) exit 7 ;; esac; fi
    if [ -n "${FAKE_SMOKE_FAIL:-}" ]; then case "$joined" in *'node --version'*) exit 9 ;; esac; fi
    if [ -n "${FAKE_UNSAFE_LOG:-}" ]; then case "$joined" in *'node --version'*) printf '%s\n' 'Authorization: Bearer abcdefghijklmnop' ;; esac; fi
    exit 0 ;;
  rm)
    rm -f "$state.present"
    if [ -n "${FAKE_SIGNAL_READY_RM:-}" ]; then
      : > "$FAKE_SIGNAL_READY_RM"; trap '' TERM; sleep 30
    fi
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
    if [ -f "$state.present" ]; then printf '%s\n' '[{}]'; exit 0; fi
    if [ -n "${FAKE_INSPECT_UNKNOWN:-}" ]; then printf '%s\n' 'Cannot connect to the Docker daemon' >&2; exit 1; fi
    printf 'Error: No such container: %s\n' "$cid" >&2; exit 1 ;;
esac
exit 2
""")
        docker.chmod(0o755)
    def env(self,env_file=None,**extra):
        env=dict(os.environ); env.update({"PATH":os.pathsep.join([str(self.bin),"/usr/bin","/bin"]),"FAKE_DOCKER_LOG":str(self.log),"FAKE_DOCKER_STATE":str(self.state),"TIER1_RESULTS_ROOT":str(self.tmp/"results")})
        if env_file is not None: env["TIER1_ENV_FILE"]=str(env_file)
        env.update(extra); return env
    def run(self,*args,env,cwd=REPO): return subprocess.run([str(DRIVER),*args],capture_output=True,text=True,timeout=90,env=env,cwd=cwd)
    def calls(self):
        if not self.log.exists(): return []
        return [[arg for arg in line.split("\x1f") if arg]
                for line in self.log.read_text().splitlines()]

class TestSelectorFailClose(unittest.TestCase):
    def test_neither_and_both_fail_before_docker(self):
        for text in ("PRIME_AGENT_PINNED=\nPRIME_AGENT_SOURCE=\n","PRIME_AGENT_PINNED=0.9.8\nPRIME_AGENT_SOURCE=/private\n"):
            with tempfile.TemporaryDirectory() as td:
                tmp=Path(td); h=DriverHarness(tmp); envf=tmp/"x.env"; envf.write_text(text); out=h.run("--dry-run",env=h.env(envf))
                self.assertNotEqual(out.returncode,0); self.assertFalse(h.log.exists())
    def test_source_fails_before_checkout_or_docker_without_path_echo(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h=DriverHarness(tmp); source=tmp/"sentinel-source"; source.mkdir(); sentinel=source/"must-stay"; sentinel.write_text("unchanged")
            envf=tmp/"source.env"; envf.write_text(f"PRIME_AGENT_SOURCE={source}\n"); out=h.run(env=h.env(envf))
            self.assertNotEqual(out.returncode,0); self.assertIn("isolated source builder Slice 2",out.stderr); self.assertNotIn(str(source),out.stdout+out.stderr)
            self.assertEqual(sentinel.read_text(),"unchanged"); self.assertFalse(h.log.exists())

    def test_malicious_pinned_versions_fail_before_docker(self):
        for value in ("0.9.8'; touch /tmp/pwned; echo '", "0.9.8;uname", "0.9.8-beta", "0.9.8\nEVIL=1"):
            with tempfile.TemporaryDirectory() as td:
                tmp=Path(td); h=DriverHarness(tmp); envf=tmp/"bad.env"; envf.write_text("PRIME_AGENT_PINNED="+value+"\n")
                out=h.run(env=h.env(envf)); self.assertNotEqual(out.returncode,0); self.assertRegex(out.stderr,r"exact semantic version|unsupported keys"); self.assertFalse(h.log.exists())

class TestInformationalAndSelectorEdges(unittest.TestCase):
    def test_missing_env_fails_before_docker(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h=DriverHarness(tmp); out=h.run(env=h.env(tmp/"absent.env"))
            self.assertNotEqual(out.returncode,0); self.assertIn("missing env file",out.stderr); self.assertFalse(h.log.exists())
    def test_smoke_skips_env_selection(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h=DriverHarness(tmp); out=h.run("--smoke","--dry-run",env=h.env(tmp/"absent.env"))
            self.assertEqual(out.returncode,0,out.stderr); self.assertFalse(h.log.exists())
    def test_env_is_gitignored_and_documents_exactly_one(self):
        self.assertIn(".env",[x.strip() for x in (REPO/".gitignore").read_text().splitlines()])
        self.assertRegex(ENV_EXAMPLE.read_text(),re.compile(r"exactly one",re.I))

class TestPinnedLifecycle(unittest.TestCase):
    def _pinned(self,tmp):
        h=DriverHarness(tmp); envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n"); return h,envf
    def test_dry_run_is_docker_free_and_describes_exact_lifecycle(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run("--dry-run","--probe",env=h.env(envf))
            self.assertEqual(out.returncode,0,out.stderr); self.assertFalse(h.log.exists())
            for n in ("--iidfile","--cidfile","captured-image-id","disconnect","manifest.json"): self.assertIn(n,out.stdout)
    def test_smoke_failure_publishes_failed_manifest_then_fresh_pinned_replay_passes(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); outside=tmp/"outside"; outside.mkdir(); h,envf=self._pinned(tmp)
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
            provenance.validate_manifest(manifest); provenance.verify_evidence(passed_path.parent,manifest)
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
            tmp=Path(td); h=DriverHarness(tmp)
            exec_ready=tmp/"exec.ready"; cleanup_ready=tmp/"cleanup.ready"
            env=h.env(None,FAKE_USE_REAL_BOUNDED="signals",
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
            self.assertLess(time.monotonic()-started,4)
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

class TestBoundedExternalWaits(unittest.TestCase):
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
            root=Path(td); child=root/"controller.py"; child.write_text(child_source)
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
            sleeper=Path(td)/"sleeper.py"; sleeper.write_text("import signal,time\nsignal.signal(signal.SIGTERM,signal.SIG_IGN)\ntime.sleep(30)\n")
            started=time.monotonic(); out=subprocess.run([sys.executable,"-m","scripts.testing.bounded","--timeout","0.2","--kill-grace","0.2","--",sys.executable,str(sleeper)],capture_output=True,text=True,cwd=REPO)
            self.assertEqual(out.returncode,124); self.assertLess(time.monotonic()-started,2); self.assertIn("timed out",out.stderr)

    def test_runner_forwards_sigterm_and_kills_ignoring_process_group(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); child_pid=tmp/"child.pid"; grand_pid=tmp/"grand.pid"; child=tmp/"tree.py"
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
            tmp=Path(td); pidfile=tmp/"detached.pid"; leader=tmp/"leader.py"
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
            tmp=Path(td); pidfile=tmp/"child.pid"; leader=tmp/"leader.py"
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
        for key,value in (("TIER1_PROBE_DEADLINE","0"),("TIER1_PROBE_KILL_GRACE","bad;uname"),("TIER1_DOCKER_TIMEOUT","999999")):
            with self.subTest(key=key), tempfile.TemporaryDirectory() as td:
                tmp=Path(td); h=DriverHarness(tmp); out=h.run("--smoke",env=h.env(None,**{key:value})); self.assertNotEqual(out.returncode,0); self.assertIn("bounded",out.stderr); self.assertFalse(h.log.exists())

class TestDriverStatics(unittest.TestCase):
    def test_contract_is_exact_image_offline_and_no_host_source_mutation(self):
        text=DRIVER.read_text(); self.assertIn('--iidfile "$IIDFILE"',text); self.assertIn('--cidfile "$CIDFILE"',text); self.assertIn('"$IMAGE_ID" sleep infinity',text)
        self.assertNotIn("npm run build",text); self.assertNotIn("pack-prime-agent-release.mjs",text); self.assertNotIn("docker run --rm",text); self.assertNotIn("-e HOME=",text)
        self.assertGreaterEqual(text.count("PRIME_AGENT_PLUGIN_ROOT=$CONTAINER_PLUGIN_ROOT"),2)
        for command in ("docker build", "docker image inspect", "docker run -d",
                        "docker network disconnect", "docker exec"):
            self.assertRegex(text, rf"bounded [^\n]*{re.escape(command)}")
        self.assertRegex(text, r'bounded 60 docker rm -f "\$CONTAINER_ID"')
        self.assertRegex(text, r'bounded 15 docker inspect "\$CONTAINER_ID"')
    def test_env_example_has_both_selectors(self):
        text=ENV_EXAMPLE.read_text(); self.assertIn("PRIME_AGENT_PINNED",text); self.assertIn("PRIME_AGENT_SOURCE",text)

class TestProbeValidator(unittest.TestCase):
    def setUp(self): self.td=tempfile.TemporaryDirectory(); self.tmp=Path(self.td.name); self.validator=self.tmp/"validate.py"; self.validator.write_text(_validator_source())
    def tearDown(self): self.td.cleanup()
    def check(self,text):
        f=self.tmp/"reply.jsonl"; f.write_text(text); return subprocess.run([sys.executable,str(self.validator),str(f)],capture_output=True,text=True)
    def test_valid_reply(self): self.assertEqual(self.check(_reply()+"\n").returncode,0)
    def test_invalid_replies(self):
        cases=("", "not-json\n", _reply()+"\n"+_reply()+"\n",
               _reply([_cmd("handoff","/host/x.ts")]+GOOD_COMMANDS[1:])+"\n",
               _reply([],success=True)+"\n", _reply(success=False)+"\n")
        for case in cases: self.assertNotEqual(self.check(case).returncode,0)
    def test_async_events_are_ignored_but_cannot_satisfy_probe(self):
        event='{"type":"event","name":"session_start"}\n'
        self.assertEqual(self.check(event+_reply()+"\n").returncode,0)
        self.assertNotEqual(self.check(event).returncode,0)
    def test_duplicate_required_command_rejected(self):
        self.assertNotEqual(self.check(_reply(GOOD_COMMANDS+[GOOD_COMMANDS[0]])+"\n").returncode,0)


if __name__=="__main__": unittest.main()
