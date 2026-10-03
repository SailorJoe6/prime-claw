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
        self.tmp=tmp; self.bin=tmp/"bin"; self.bin.mkdir(); self.log=tmp/"docker.jsonl"; self.state=tmp/"state.json"
        docker=self.bin/"docker"
        docker.write_text(r"""#!/usr/bin/env python3
import json,os,pathlib,signal,sys,time
args=sys.argv[1:]; log=pathlib.Path(os.environ["FAKE_DOCKER_LOG"])
with log.open("a") as fh: fh.write(json.dumps(args)+"\n")
state_path=pathlib.Path(os.environ["FAKE_DOCKER_STATE"])
try: state=json.loads(state_path.read_text())
except Exception: state={"present":False,"network":False}
def save(): state_path.write_text(json.dumps(state))
def hang(flag):
    if os.environ.get(flag):
        signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(30)
image="sha256:"+"a"*64; cid=os.environ.get("FAKE_CID","c"*64)
if args[0]=="info": sys.exit(0)
if args[0]=="build":
    hang("FAKE_HANG_BUILD")
    if os.environ.get("FAKE_BUILD_FAIL"): sys.exit(9)
    pathlib.Path(args[args.index("--iidfile")+1]).write_text(image+"\n"); sys.exit(0)
if args[:2]==["image","inspect"]:
    hang("FAKE_HANG_IMAGE_INSPECT")
    digests=["http://10.0.4.225/private"] if os.environ.get("FAKE_UNSAFE_MANIFEST") else []
    print(json.dumps([{"Id":image,"RepoDigests":digests,"Os":"linux","Architecture":"arm64"}])); sys.exit(0)
if args[0]=="run":
    pathlib.Path(args[args.index("--cidfile")+1]).write_text(cid+"\n")
    state={"present":True,"network":True,"network_inspects":0}; save(); hang("FAKE_HANG_RUN"); sys.exit(8 if os.environ.get("FAKE_RUN_FAIL_AFTER_CID") else 0)
if args[0]=="network" and args[1]=="disconnect":
    hang("FAKE_HANG_DISCONNECT")
    if os.environ.get("FAKE_DISCONNECT_FAIL"): print("disconnect denied",file=sys.stderr); sys.exit(6)
    if not os.environ.get("FAKE_NETWORK_STUCK"): state["network"]=False; save()
    sys.exit(0)
if args[0]=="exec":
    joined=" ".join(args)
    if "install.sh" in joined: hang("FAKE_HANG_INSTALL")
    if "apply-prime-agent-plugin.sh" in joined: hang("FAKE_HANG_APPLY")
    if "check-prime-agent-plugin.sh" in joined: hang("FAKE_HANG_CHECK")
    if "get_commands" in joined: hang("FAKE_HANG_PROBE")
    if os.environ.get("FAKE_INSTALL_FAIL") and "install.sh" in joined: sys.exit(7)
    if "prime-agent --version" in joined: print(os.environ.get("FAKE_PA_VERSION","0.9.8"))
    if "sha256sum" in joined: print(("bad" if os.environ.get("FAKE_BAD_HASH") else "f"*64)+"  /root/.local/bin/prime-agent")
    if os.environ.get("FAKE_APPLY_FAIL") and "apply-prime-agent-plugin.sh" in joined: sys.exit(7)
    if os.environ.get("FAKE_UNSAFE_LOG") and "node --version" in joined: print("Authorization: Bearer abcdefghijklmnop")
    sys.exit(0)
if args[0]=="rm": state["present"]=False; save(); sys.exit(0)
if args[0]=="inspect":
    if "--format" in args:
        hang("FAKE_HANG_NETWORK_INSPECT")
        state["network_inspects"]=state.get("network_inspects",0)+1; save()
        if os.environ.get("FAKE_NETWORK_INSPECT_FAIL_AT")==str(state["network_inspects"]):
            print("daemon unavailable",file=sys.stderr); sys.exit(5)
        template=args[args.index("--format")+1]
        if "json" in template: print('{"bridge":{}}' if state.get("network") else '{}')
        elif state.get("network"): print("bridge")
        sys.exit(0)
    if state.get("present"): print("[{}]"); sys.exit(0)
    if os.environ.get("FAKE_INSPECT_UNKNOWN"):
        print("Cannot connect to the Docker daemon",file=sys.stderr); sys.exit(1)
    print("Error: No such container: "+cid,file=sys.stderr); sys.exit(1)
sys.exit(2)
""")
        docker.chmod(0o755)
    def env(self,env_file=None,**extra):
        env=dict(os.environ); env.update({"PATH":os.pathsep.join([str(self.bin),"/usr/bin","/bin"]),"FAKE_DOCKER_LOG":str(self.log),"FAKE_DOCKER_STATE":str(self.state),"TIER1_RESULTS_ROOT":str(self.tmp/"results")})
        if env_file is not None: env["TIER1_ENV_FILE"]=str(env_file)
        env.update(extra); return env
    def run(self,*args,env,cwd=REPO): return subprocess.run([str(DRIVER),*args],capture_output=True,text=True,timeout=90,env=env,cwd=cwd)
    def calls(self): return [] if not self.log.exists() else [json.loads(x) for x in self.log.read_text().splitlines()]

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
    def test_pinned_run_launches_iid_then_disconnects_before_offline_steps(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run("--probe",env=h.env(envf)); self.assertEqual(out.returncode,0,out.stdout+out.stderr)
            calls=h.calls(); verbs=[c[0] for c in calls]; run=next(c for c in calls if c[0]=="run")
            self.assertEqual(verbs[0],"info"); self.assertIn(IMAGE_ID,run); self.assertNotIn("prime-claw-test-tier1:latest",run)
            di=next(i for i,c in enumerate(calls) if c[:2]==["network","disconnect"])
            for needle in ("apply-prime-agent-plugin.sh","check-prime-agent-plugin.sh","get_commands"):
                self.assertLess(di,next(i for i,c in enumerate(calls) if needle in " ".join(c)))
            self.assertEqual(verbs[-2:],["rm","inspect"])
            manifests=list((tmp/"results").glob("*/tier1/manifest.json")); self.assertEqual(len(manifests),1)
            manifest=json.loads(manifests[0].read_text()); provenance.validate_manifest(manifest); provenance.verify_evidence(manifests[0].parent,manifest)
            self.assertEqual(manifest["image"]["id"],IMAGE_ID); self.assertTrue(manifest["network"]["verified_absent"]); self.assertEqual(manifest["teardown"]["state"],"absent")
    def test_network_still_attached_blocks_apply_and_tears_down(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run(env=h.env(envf,FAKE_NETWORK_STUCK="1")); self.assertNotEqual(out.returncode,0)
            joined=[" ".join(c) for c in h.calls()]; self.assertFalse(any("apply-prime-agent-plugin.sh" in c for c in joined)); self.assertIn("still has an attached network",out.stderr); self.assertIn("rm",[c[0] for c in h.calls()])
    def test_run_failure_after_cidfile_still_removes_captured_container(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run(env=h.env(envf,FAKE_RUN_FAIL_AFTER_CID="1")); self.assertNotEqual(out.returncode,0)
            self.assertEqual(next(c for c in h.calls() if c[0]=="rm")[-1],CID)
    def test_teardown_unknown_fails_and_manifest_records_unknown(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run(env=h.env(envf,FAKE_INSPECT_UNKNOWN="1")); self.assertNotEqual(out.returncode,0)
            manifest=json.loads(next((tmp/"results").glob("*/tier1/manifest.json")).read_text()); self.assertEqual(manifest["teardown"]["state"],"unknown"); self.assertEqual(manifest["run"]["status"],"failed")

    def test_build_failure_stops_before_container(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run(env=h.env(envf,FAKE_BUILD_FAIL="1"))
            self.assertNotEqual(out.returncode,0); self.assertNotIn("run",[c[0] for c in h.calls()]); self.assertNotIn("driver: OK",out.stdout)
    def test_installed_version_mismatch_blocks_apply_and_tears_down(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run(env=h.env(envf,FAKE_PA_VERSION="0.9.7"))
            self.assertNotEqual(out.returncode,0); joined=[" ".join(c) for c in h.calls()]
            self.assertFalse(any("apply-prime-agent-plugin.sh" in c for c in joined)); self.assertIn("rm",[c[0] for c in h.calls()])
    def test_probe_deadline_overrides_reach_offline_probe(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run("--probe",env=h.env(envf,TIER1_PROBE_DEADLINE="7",TIER1_PROBE_KILL_GRACE="2"))
            self.assertEqual(out.returncode,0,out.stderr); probe=next(" ".join(c) for c in h.calls() if "get_commands" in " ".join(c))
            self.assertIn("timeout --kill-after=2 7 prime-agent --mode rpc",probe)

    def test_driver_is_cwd_independent_through_lifecycle_and_teardown(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); outside=tmp/"outside"; outside.mkdir(); h,envf=self._pinned(tmp); out=h.run(env=h.env(envf),cwd=outside)
            self.assertEqual(out.returncode,0,out.stdout+out.stderr); verbs=[c[0] for c in h.calls()]; self.assertEqual(verbs[-2:],["rm","inspect"]); self.assertIn("driver: OK",out.stdout)
            manifest=json.loads(next((tmp/"results").glob("*/tier1/manifest.json")).read_text()); provenance.validate_manifest(manifest); self.assertEqual(manifest["teardown"]["state"],"absent")

    def test_invalid_cidfile_never_reaches_destructive_teardown(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h,envf=self._pinned(tmp); out=h.run(env=h.env(envf,FAKE_CID="operator-container"))
            self.assertNotEqual(out.returncode,0); self.assertNotIn("rm",[c[0] for c in h.calls()]); self.assertNotIn("driver: OK",out.stdout)
            manifest=json.loads(next((tmp/"results").glob("*/tier1/manifest.json")).read_text()); self.assertEqual(manifest["teardown"]["state"],"unknown")
    def test_partial_failures_publish_failed_manifest_and_no_ok(self):
        cases=({"FAKE_INSTALL_FAIL":"1"},{"FAKE_NETWORK_INSPECT_FAIL_AT":"1"},{"FAKE_NETWORK_INSPECT_FAIL_AT":"2"},{"FAKE_DISCONNECT_FAIL":"1"},{"FAKE_BAD_HASH":"1"},{"FAKE_APPLY_FAIL":"1"})
        for flags in cases:
            with self.subTest(flags=flags), tempfile.TemporaryDirectory() as td:
                tmp=Path(td); h,envf=self._pinned(tmp); out=h.run(env=h.env(envf,**flags)); self.assertNotEqual(out.returncode,0); self.assertNotIn("driver: OK",out.stdout)
                path=next((tmp/"results").glob("*/tier1/manifest.json")); manifest=json.loads(path.read_text()); provenance.validate_manifest(manifest); self.assertEqual(manifest["run"]["status"],"failed"); self.assertEqual(manifest["prime_agent"]["requested_version"],"0.9.8")
    def test_manifest_redaction_failure_prevents_ok(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); h=DriverHarness(tmp); out=h.run("--smoke",env=h.env(None,FAKE_UNSAFE_MANIFEST="1")); self.assertNotEqual(out.returncode,0); self.assertNotIn("driver: OK",out.stdout); self.assertEqual(list((tmp/"results").glob("*/tier1/manifest.json")),[])

class TestBoundedExternalWaits(unittest.TestCase):
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

    def test_deadline_controls_fail_closed_before_docker(self):
        for key,value in (("TIER1_PROBE_DEADLINE","0"),("TIER1_PROBE_KILL_GRACE","bad;uname"),("TIER1_DOCKER_TIMEOUT","999999")):
            with self.subTest(key=key), tempfile.TemporaryDirectory() as td:
                tmp=Path(td); h=DriverHarness(tmp); out=h.run("--smoke",env=h.env(None,**{key:value})); self.assertNotEqual(out.returncode,0); self.assertIn("bounded",out.stderr); self.assertFalse(h.log.exists())

    def test_each_external_phase_timeout_is_bounded_and_tears_down_owned_cid(self):
        cases=(
            ("FAKE_HANG_BUILD",False,()),
            ("FAKE_HANG_IMAGE_INSPECT",False,()),
            ("FAKE_HANG_RUN",True,()),
            ("FAKE_HANG_INSTALL",True,()),
            ("FAKE_HANG_NETWORK_INSPECT",True,()),
            ("FAKE_HANG_DISCONNECT",True,()),
            ("FAKE_HANG_APPLY",True,()),
            ("FAKE_HANG_CHECK",True,()),
            ("FAKE_HANG_PROBE",True,("--probe",)),
        )
        budgets={"TIER1_DOCKER_TIMEOUT":"1","TIER1_BUILD_TIMEOUT":"1","TIER1_INSTALL_TIMEOUT":"1","TIER1_CHECK_TIMEOUT":"1","TIER1_PROBE_DEADLINE":"1","TIER1_PROBE_KILL_GRACE":"1","TIER1_DOCKER_KILL_GRACE":"1"}
        for flag,has_cid,args in cases:
            with self.subTest(flag=flag), tempfile.TemporaryDirectory() as td:
                tmp=Path(td); h=DriverHarness(tmp); envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n"); started=time.monotonic(); out=h.run(*args,env=h.env(envf,**budgets,**{flag:"1"})); elapsed=time.monotonic()-started
                self.assertNotEqual(out.returncode,0); self.assertLess(elapsed,15); self.assertNotIn("driver: OK",out.stdout)
                verbs=[c[0] for c in h.calls()]
                if has_cid:
                    self.assertIn("rm",verbs); self.assertIn("inspect",verbs)
                manifest=json.loads(next((tmp/"results").glob("*/tier1/manifest.json")).read_text()); provenance.validate_manifest(manifest); self.assertEqual(manifest["run"]["status"],"failed")

class TestDriverStatics(unittest.TestCase):
    def test_contract_is_exact_image_offline_and_no_host_source_mutation(self):
        text=DRIVER.read_text(); self.assertIn('--iidfile "$IIDFILE"',text); self.assertIn('--cidfile "$CIDFILE"',text); self.assertIn('"$IMAGE_ID" sleep infinity',text)
        self.assertNotIn("npm run build",text); self.assertNotIn("pack-prime-agent-release.mjs",text); self.assertNotIn("docker run --rm",text); self.assertNotIn("-e HOME=",text)
        self.assertGreaterEqual(text.count("PRIME_AGENT_PLUGIN_ROOT=$CONTAINER_PLUGIN_ROOT"),2)
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

class TestProbeValidatorGranular(TestProbeValidator):
    def test_missing_reply_rejected(self): self.assertNotEqual(self.check("").returncode,0)
    def test_malformed_json_rejected(self): self.assertNotEqual(self.check("not-json\n").returncode,0)
    def test_success_false_rejected(self): self.assertNotEqual(self.check(_reply(success=False)+"\n").returncode,0)
    def test_empty_command_list_rejected(self): self.assertNotEqual(self.check(_reply([])+"\n").returncode,0)
    def test_partial_command_list_rejected(self): self.assertNotEqual(self.check(_reply(GOOD_COMMANDS[:2])+"\n").returncode,0)
    def test_wrong_source_path_rejected(self): self.assertNotEqual(self.check(_reply([_cmd("handoff","/host/x.ts")]+GOOD_COMMANDS[1:])+"\n").returncode,0)
    def test_duplicate_replies_rejected(self): self.assertNotEqual(self.check(_reply()+"\n"+_reply()+"\n").returncode,0)
    def test_reply_id_mismatch_rejected(self):
        row=json.loads(_reply()); row["id"]="other"; self.assertNotEqual(self.check(json.dumps(row)+"\n").returncode,0)
    def test_extra_unknown_commands_accepted(self): self.assertEqual(self.check(_reply(GOOD_COMMANDS+[_cmd("other",EXT+"/other.ts")])+"\n").returncode,0)

if __name__=="__main__": unittest.main()
