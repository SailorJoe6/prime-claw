"""Tier-0 behavioral coverage for the Slice-1 tier-1 session fixture."""
from __future__ import annotations
import json, os, signal, subprocess, tempfile, textwrap, time, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import conftest

IMAGE_ID="sha256:"+"a"*64; CID="c"*64

def cp(args,rc=0,out="",err="",outcome="exited",signum=None):
    return SimpleNamespace(args=args,returncode=rc,stdout=out,stderr=err,
                           outcome=outcome,signal=signum)

class TestSelectionFailClose(unittest.TestCase):
    def test_source_selector_never_stats_or_echoes_checkout(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); source=tmp/"private-source"; source.mkdir(); (source/"sentinel").write_text("keep")
            envf=tmp/"source.env"; envf.write_text(f"PRIME_AGENT_SOURCE={source}\n")
            with mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}), mock.patch.object(Path,"is_dir",side_effect=AssertionError("checkout stat")):
                with self.assertRaisesRegex(RuntimeError,"isolated source builder Slice 2") as ctx: conftest._load_install_selection()
            self.assertNotIn(str(source),str(ctx.exception)); self.assertEqual((source/"sentinel").read_text(),"keep")
    def test_pinned_selector_returns_value(self):
        with tempfile.TemporaryDirectory() as td:
            envf=Path(td)/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            with mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}): self.assertEqual(conftest._load_install_selection(),("pinned","0.9.8"))
    def test_both_and_neither_rejected(self):
        for text in ("PRIME_AGENT_PINNED=\nPRIME_AGENT_SOURCE=\n","PRIME_AGENT_PINNED=0.9.8\nPRIME_AGENT_SOURCE=/x\n"):
            with tempfile.TemporaryDirectory() as td:
                envf=Path(td)/"x.env"; envf.write_text(text)
                with mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}), self.assertRaises(RuntimeError): conftest._load_install_selection()

    def test_malicious_pinned_values_fail_before_docker(self):
        for value in ("0.9.8;uname", "0.9.8'", "0.9.8-beta", "0.9.8\nEVIL=1"):
            with tempfile.TemporaryDirectory() as td:
                envf=Path(td)/"bad.env"; envf.write_text("PRIME_AGENT_PINNED="+value+"\n")
                with mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}), mock.patch.object(conftest,"_host_command",side_effect=AssertionError("docker contacted")):
                    with self.assertRaisesRegex(RuntimeError,"exact semantic version|unsupported keys"):
                        conftest._load_install_selection()

class TestExactImageBuild(unittest.TestCase):
    def test_build_uses_fresh_context_iidfile_and_inspects_exact_id(self):
        with tempfile.TemporaryDirectory() as td:
            tier=Path(td)/"tier1"; tier.mkdir(); snapshot=Path(td)/"snapshot"; (snapshot/"docker").mkdir(parents=True); (snapshot/"docker/test.Dockerfile").write_text("FROM scratch\n"); calls=[]
            def run(args,**kw):
                calls.append(args)
                if args[:2]==["docker","build"]:
                    Path(args[args.index("--iidfile")+1]).write_text(IMAGE_ID+"\n"); return cp(args)
                if args[:3]==["docker","image","inspect"]:
                    return cp(args,out=json.dumps([{"Id":IMAGE_ID,"RepoDigests":[],"Os":"linux","Architecture":"arm64"}]))
                raise AssertionError(args)
            with mock.patch.object(conftest,"_host_command",side_effect=run): image=conftest._build_tier1_image(tier,snapshot)
            build=calls[0]; self.assertIn("--iidfile",build); self.assertEqual(build[-1],str(tier/"build-context")); self.assertNotEqual(build[-1],str(conftest.REPO))
            self.assertEqual(calls[1][-1],IMAGE_ID); self.assertEqual(image["id"],IMAGE_ID); self.assertTrue((tier/"image.json").is_file())
    def test_iid_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            tier=Path(td)/"tier1"; tier.mkdir(); snapshot=Path(td)/"snapshot"; (snapshot/"docker").mkdir(parents=True); (snapshot/"docker/test.Dockerfile").write_text("FROM scratch\n")
            def run(args,**kw):
                if args[:2]==["docker","build"]: Path(args[args.index("--iidfile")+1]).write_text(IMAGE_ID+"\n"); return cp(args)
                return cp(args,out=json.dumps([{"Id":"sha256:"+"b"*64,"Os":"linux","Architecture":"arm64"}]))
            with mock.patch.object(conftest,"_host_command",side_effect=run), self.assertRaisesRegex(conftest.provenance.ProvenanceError,"mismatched"): conftest._build_tier1_image(tier,snapshot)

    def test_missing_iidfile_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            tier=Path(td)/"tier1"; tier.mkdir(); snapshot=Path(td)/"snapshot"; (snapshot/"docker").mkdir(parents=True); (snapshot/"docker/test.Dockerfile").write_text("FROM scratch\n")
            with mock.patch.object(conftest,"_host_command",return_value=cp([])), self.assertRaisesRegex(RuntimeError,"iidfile"):
                conftest._build_tier1_image(tier,snapshot)

    def test_build_hashes_the_captured_context_not_mutable_live_input(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); tier=root/"tier1"; tier.mkdir()
            snapshot=root/"snapshot"; (snapshot/"docker").mkdir(parents=True)
            captured=snapshot/"docker/test.Dockerfile"; captured.write_bytes(b"FROM captured\n")
            live=root/"live"; (live/"docker").mkdir(parents=True)
            (live/"docker/test.Dockerfile").write_bytes(b"FROM changed-live\n")
            def host(args,**kw):
                if args[:2]==["docker","build"]:
                    self.assertEqual(Path(args[args.index("-f")+1]).read_bytes(),b"FROM captured\n")
                    Path(args[args.index("--iidfile")+1]).write_text(IMAGE_ID+"\n")
                    return cp(args)
                return cp(args,out=json.dumps([{"Id":IMAGE_ID,"RepoDigests":[],"Os":"linux","Architecture":"arm64"}]))
            with mock.patch.object(conftest,"REPO",live), mock.patch.object(conftest,"_host_command",side_effect=host):
                image=conftest._build_tier1_image(tier,snapshot)
            context=tier/"build-context"
            self.assertEqual(image["dockerfile_sha256"],conftest.provenance.sha256_file(context/"Dockerfile"))
            self.assertEqual(image["declared_input_sha256"],conftest.provenance.hash_declared_inputs(context,["Dockerfile"]))

    def test_unsafe_image_metadata_is_discarded_before_image_json_write(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); tier=root/"tier1"; tier.mkdir()
            snapshot=root/"snapshot"; (snapshot/"docker").mkdir(parents=True)
            (snapshot/"docker/test.Dockerfile").write_text("FROM scratch\n")
            def host(args,**kw):
                if args[:2]==["docker","build"]:
                    Path(args[args.index("--iidfile")+1]).write_text(IMAGE_ID+"\n")
                    return cp(args)
                return cp(args,out=json.dumps([{"Id":IMAGE_ID,"RepoDigests":["private.local/team/image"],"Private":"10.0.4.225","Os":"linux","Architecture":"arm64"}]))
            with mock.patch.object(conftest,"_host_command",side_effect=host):
                image=conftest._build_tier1_image(tier,snapshot)
            self.assertEqual(image["repo_digests"],[])
            self.assertTrue((tier/"image.json").is_file())
            for path in tier.rglob("*"):
                if path.is_file():
                    content=path.read_bytes()
                    self.assertNotIn(b"private.local",content)
                    self.assertNotIn(b"10.0.4.225",content)

class TestInstalledPackageIdentity(unittest.TestCase):
    def test_records_version_and_executable_hash(self):
        class FakeContainer:
            def __init__(self): self.calls=[]
            def run(self, *args, **kwargs):
                self.calls.append(args)
                if args[:2] == ("prime-agent", "--version"):
                    return cp(args,out="prime-agent 0.9.8\n")
                return cp(args,out="f"*64+"  /root/.local/bin/prime-agent\n")
        fake=FakeContainer(); package=conftest._installed_package_identity(fake)
        self.assertEqual(package,{"kind":"vendor-binary","version":"0.9.8","executable_sha256":"f"*64})
        self.assertEqual(len(fake.calls),2)

    def test_invalid_executable_hash_is_rejected(self):
        class FakeContainer:
            def run(self,*args,**kwargs):
                if args[:2] == ("prime-agent","--version"): return cp(args,out="0.9.8\n")
                return cp(args,out="not-a-hash\n")
        with self.assertRaisesRegex(RuntimeError,"executable hash"):
            conftest._installed_package_identity(FakeContainer())

class TestNetworkBoundary(unittest.TestCase):
    def test_disconnects_every_captured_network_then_verifies_empty(self):
        calls=[]; responses=[cp([],out='{"bridge":{},"owned":{}}\n'),cp([]),cp([]),cp([],out='{}\n')]
        def run(args,**kw): calls.append(args); return responses.pop(0)
        with mock.patch.object(conftest,"_host_command",side_effect=run): when=conftest._disconnect_container_networks(CID)
        self.assertTrue(when.endswith("Z")); self.assertEqual([c[:3] for c in calls[1:3]],[["docker","network","disconnect"],["docker","network","disconnect"]]); self.assertEqual(calls[-1][1],"inspect")
    def test_network_still_attached_fails_before_tests(self):
        responses=[cp([],out='{"bridge":{}}\n'),cp([]),cp([],out='{"bridge":{}}\n')]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), self.assertRaisesRegex(RuntimeError,"still has an attached network"): conftest._disconnect_container_networks(CID)
    def test_inspect_error_is_unknown_and_fails(self):
        with mock.patch.object(conftest,"_host_command",return_value=cp([],rc=1,err="daemon unavailable")), self.assertRaisesRegex(RuntimeError,"unknown"): conftest._disconnect_container_networks(CID)

    def test_disconnect_failure_fails_closed(self):
        responses=[cp([],out='{"bridge":{}}\n'),cp([],rc=1,err="denied")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), self.assertRaisesRegex(RuntimeError,"disconnect failed"):
            conftest._disconnect_container_networks(CID)

class TestSessionTeardown(unittest.TestCase):
    def test_absent_after_remove_is_success(self):
        responses=[cp([],out=CID),cp([],rc=1,err="Error: No such container: "+CID)]
        with mock.patch.object(conftest,"_host_command",side_effect=responses): conftest._remove_session_container(CID)
    def test_present_after_remove_fails_with_identity(self):
        responses=[cp([]),cp([],out="[{}]")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), self.assertRaises(conftest.TeardownError) as ctx: conftest._remove_session_container(CID)
        self.assertEqual(ctx.exception.state,"present"); self.assertIn(CID,str(ctx.exception))
    def test_unknown_inspect_fails(self):
        responses=[cp([]),cp([],rc=1,err="Cannot connect to daemon")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), self.assertRaises(conftest.TeardownError) as ctx: conftest._remove_session_container(CID)
        self.assertEqual(ctx.exception.state,"unknown")
    def test_timeout_fails_even_if_later_absent(self):
        responses=[cp([],rc=124,outcome="timed_out"),cp([],rc=1,err="No such container")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), self.assertRaises(conftest.TeardownError): conftest._remove_session_container(CID,rm_timeout=.1)
    def test_finalizer_preserves_share_when_absence_unknown(self):
        with tempfile.TemporaryDirectory() as td:
            share=Path(td)/"share"; share.mkdir(); (share/"evidence").write_text("x")
            result=conftest.TeardownResult("unknown","timed_out","ordinary_nonzero",False)
            err=conftest.TeardownError(result,"boom")
            with mock.patch.object(conftest,"_remove_session_container",side_effect=err), self.assertRaises(conftest.TeardownError): conftest._finalize_session(CID,share)
            self.assertTrue(share.exists())
    def test_in_flight_failure_keeps_primary_and_adds_note(self):
        with tempfile.TemporaryDirectory() as td:
            share=Path(td)/"share"; share.mkdir(); original=ValueError("body failed")
            result=conftest.TeardownResult("unknown","timed_out","ordinary_nonzero",False)
            err=conftest.TeardownError(result,"teardown failed")
            with mock.patch.object(conftest,"_remove_session_container",side_effect=err): state=conftest._finalize_session(CID,share,original)
            self.assertEqual(state.state,"unknown"); self.assertFalse(state.clean); self.assertTrue(any("teardown also failed" in n for n in original.__notes__))

    def test_nonzero_remove_is_idempotent_when_inspect_proves_absent(self):
        responses=[cp([],rc=1,err="No such container"),cp([],rc=1,err="No such container")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses): conftest._remove_session_container(CID)
    def test_keep_share_preserves_successful_debug_artifacts(self):
        with tempfile.TemporaryDirectory() as td:
            share=Path(td)/"share"; share.mkdir()
            clean=conftest.TeardownResult("absent","clean","ordinary_nonzero",True)
            with mock.patch.object(conftest,"_remove_session_container",return_value=clean), mock.patch.dict(os.environ,{"TIER1_KEEP_SHARE":"1"}):
                self.assertTrue(conftest._finalize_session(CID,share).clean)
            self.assertTrue(share.exists())

    def test_unpublished_container_never_calls_docker(self):
        with tempfile.TemporaryDirectory() as td:
            share=Path(td)/"share"; share.mkdir()
            with mock.patch.object(conftest,"_host_command",side_effect=AssertionError("docker called")):
                self.assertTrue(conftest._finalize_session(None,share).clean)
            self.assertFalse(share.exists())
    def test_inspect_timeout_is_unknown(self):
        responses=[cp([]),cp([],rc=124,outcome="timed_out")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), self.assertRaises(conftest.TeardownError) as ctx:
            conftest._remove_session_container(CID,inspect_timeout=.1)
        self.assertEqual(ctx.exception.state,"unknown")
    def test_docker_cli_launch_error_is_unknown(self):
        responses=[cp([],rc=127,outcome="launch_error"),
                   cp([],rc=127,outcome="launch_error")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), self.assertRaises(conftest.TeardownError) as ctx:
            conftest._remove_session_container(CID)
        self.assertEqual(ctx.exception.state,"unknown")
    def test_remove_failure_plus_inspect_unknown_fails(self):
        responses=[cp([],rc=1,err="rm denied"),cp([],rc=1,err="daemon unavailable")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), self.assertRaises(conftest.TeardownError) as ctx:
            conftest._remove_session_container(CID)
        self.assertEqual(ctx.exception.state,"unknown"); self.assertEqual(ctx.exception.result.remove_outcome,"ordinary_nonzero")

    def test_cleanup_command_interruption_is_deferred_for_fixture_redelivery(self):
        interrupted=cp([],rc=143,outcome="interrupted",signum=signal.SIGTERM)
        conftest._DEFERRED_SIGNAL=None
        with mock.patch.object(conftest.bounded_command,"run_completed",return_value=interrupted):
            result=conftest._host_command(["docker","rm","-f",CID],timeout=1,
                                         propagate_signal=False)
        self.assertEqual(result.outcome,"interrupted")
        self.assertEqual(conftest._DEFERRED_SIGNAL,signal.SIGTERM)

class TestFixtureEndToEnd(unittest.TestCase):
    def _assert_valid_partial_cid_is_recovered(self, *, timeout):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); results=tmp/"results"; envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n"); calls=[]
            image={"id":IMAGE_ID,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
            repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
            def stage(repo,dest): Path(dest).mkdir(parents=True); return repository
            def host_run(args,**kw):
                calls.append(args)
                if args==["docker","info"]: return cp(args)
                if args[:3]==["docker","run","-d"]:
                    Path(args[args.index("--cidfile")+1]).write_text(CID+"\n")
                    if timeout: raise subprocess.TimeoutExpired(args,30)
                    return cp(args,rc=9,err="launch client failed")
                if args[:3]==["docker","rm","-f"]: return cp(args)
                if args[:2]==["docker","inspect"]: return cp(args,rc=1,err="Error: No such container: "+CID)
                raise AssertionError(args)
            patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host_run),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage)]
            for p in patches: p.start()
            try:
                gen=conftest.tier1_container.__wrapped__(SimpleNamespace())
                with self.assertRaises(subprocess.TimeoutExpired if timeout else RuntimeError): next(gen)
            finally:
                for p in reversed(patches): p.stop()
            self.assertIn(["docker","rm","-f",CID],calls); self.assertIn(["docker","inspect",CID],calls)
            manifest=json.loads(next(results.glob("*/tier1/manifest.json")).read_text()); self.assertEqual(manifest["teardown"]["state"],"absent"); self.assertEqual(manifest["run"]["status"],"failed"); self.assertEqual(manifest["prime_agent"]["requested_version"],"0.9.8")

    def test_nonzero_run_after_valid_cid_recovers_and_tears_down_exact_id(self): self._assert_valid_partial_cid_is_recovered(timeout=False)
    def test_timeout_after_valid_cid_recovers_and_tears_down_exact_id(self): self._assert_valid_partial_cid_is_recovered(timeout=True)
    def test_invalid_cidfile_never_reaches_fixture_teardown(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); results=tmp/"results"; envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            image={"id":IMAGE_ID,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
            repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
            def stage(repo,dest): Path(dest).mkdir(parents=True); return repository
            def host_run(args,**kw):
                if args==["docker","info"]: return cp(args)
                if args[:3]==["docker","run","-d"]:
                    Path(args[args.index("--cidfile")+1]).write_text("operator-container\n"); return cp(args)
                raise AssertionError(args)
            finalizer=mock.Mock(side_effect=AssertionError("must not teardown untrusted identity"))
            patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host_run),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest,"_finalize_session",finalizer),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage)]
            for p in patches: p.start()
            try:
                gen=conftest.tier1_container.__wrapped__(SimpleNamespace())
                with self.assertRaisesRegex(RuntimeError,"invalid or missing captured"):
                    next(gen)
            finally:
                for p in reversed(patches): p.stop()
            finalizer.assert_not_called()
            manifest=json.loads(next(results.glob("*/tier1/manifest.json")).read_text()); self.assertEqual(manifest["run"]["status"],"failed"); self.assertEqual(manifest["teardown"]["state"],"unknown")

    def test_install_disconnect_identity_apply_check_then_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); results=tmp/"results"; envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n"); events=[]
            image={"id":IMAGE_ID,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
            def host_run(args,**kw):
                if args==["docker","info"]: return cp(args)
                if args[:3]==["docker","run","-d"]:
                    Path(args[args.index("--cidfile")+1]).write_text(CID+"\n"); events.append("run"); return cp(args)
                raise AssertionError(args)
            def container_run(self,*args,**kw):
                joined=" ".join(map(str,args))
                if "install.sh" in joined: events.append("install")
                elif "apply-prime" in joined: events.append("apply")
                elif "check-prime" in joined: events.append("check")
                return cp(args)
            def disconnect(cid): events.append("disconnect"); return "2026-10-02T00:00:02Z"
            def package(container): events.append("identity"); return {"kind":"vendor-binary","version":"0.9.8","executable_sha256":"f"*64}
            repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
            def stage(repo,dest): Path(dest).mkdir(parents=True); return repository
            patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host_run),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest,"_disconnect_container_networks",side_effect=disconnect),mock.patch.object(conftest,"_installed_package_identity",side_effect=package),mock.patch.object(conftest.Tier1Container,"run",new=container_run),mock.patch.object(conftest,"_finalize_session",return_value=conftest.TeardownResult("absent","clean","ordinary_nonzero",True)),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage)]
            for p in patches: p.start()
            try:
                gen=conftest.tier1_container.__wrapped__(SimpleNamespace()); container=next(gen); self.assertEqual(container.id,CID); self.assertEqual(events,["run","install","disconnect","identity","apply","check"])
                with self.assertRaises(StopIteration): next(gen)
            finally:
                for p in reversed(patches): p.stop()
            manifest_path=next(results.glob("*/tier1/manifest.json")); manifest=json.loads(manifest_path.read_text()); conftest.provenance.validate_manifest(manifest); self.assertEqual(manifest["teardown"]["state"],"absent")

    def test_sigterm_after_cid_during_exec_and_cleanup_publishes_failed_evidence(self):
        child_source=textwrap.dedent(r'''
            import json, os, signal, sys, time
            from pathlib import Path
            from types import SimpleNamespace
            from unittest import mock
            sys.path.insert(0, sys.argv[1])
            sys.path.insert(0, str(Path(sys.argv[1]) / "tests"))
            import conftest
            root=Path(sys.argv[2]); checkpoint=sys.argv[3]
            results=root/"results"; ready=root/"ready"; calls=root/"calls.log"
            envf=root/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            image={"id":"sha256:"+"a"*64,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
            repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
            cid="c"*64
            def cp(args,rc=0,out="",err="",outcome="exited",signum=None):
                return SimpleNamespace(args=args,returncode=rc,stdout=out,stderr=err,outcome=outcome,signal=signum)
            def stage(_repo,dest): Path(dest).mkdir(parents=True); return repository
            def host(args,**kw):
                with calls.open("a") as fh: fh.write(json.dumps(args)+"\n")
                if args==["docker","info"]: return cp(args)
                if args[:3]==["docker","run","-d"]:
                    Path(args[args.index("--cidfile")+1]).write_text(cid+"\n")
                    if checkpoint=="run": ready.write_text("ready"); time.sleep(60)
                    return cp(args)
                if args[:3]==["docker","rm","-f"]:
                    if checkpoint=="cleanup":
                        ready.write_text("ready"); os.kill(os.getpid(),signal.SIGTERM)
                        return cp(args,rc=143,outcome="interrupted",signum=signal.SIGTERM)
                    return cp(args)
                if args[:2]==["docker","inspect"]:
                    return cp(args,rc=1,err="Error: No such container: "+cid)
                raise AssertionError(args)
            def container_run(self,*args,**kw):
                joined=" ".join(map(str,args))
                if "install.sh" in joined:
                    if checkpoint=="exec": ready.write_text("ready"); time.sleep(60)
                    if checkpoint=="cleanup": return cp(args,rc=9)
                return cp(args)
            artifact={"kind":"vendor-binary","version":"0.9.8","executable_sha256":"f"*64}
            patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest,"_disconnect_container_networks",return_value="2026-10-02T00:00:02Z"),mock.patch.object(conftest,"_installed_package_identity",return_value=artifact),mock.patch.object(conftest.Tier1Container,"run",new=container_run),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage)]
            for patcher in patches: patcher.start()
            try:
                gen=conftest.tier1_container.__wrapped__(SimpleNamespace())
                next(gen)
            finally:
                for patcher in reversed(patches): patcher.stop()
        ''')
        for checkpoint in ("run","exec","cleanup"):
            with self.subTest(checkpoint=checkpoint), tempfile.TemporaryDirectory() as td:
                root=Path(td); child=root/"child.py"; child.write_text(child_source)
                proc=subprocess.Popen([sys.executable,str(child),str(Path(__file__).resolve().parent.parent),str(root),checkpoint],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
                deadline=time.monotonic()+5
                while time.monotonic()<deadline and not (root/"ready").exists() and proc.poll() is None:
                    time.sleep(.01)
                if not (root/"ready").exists():
                    if proc.poll() is None: proc.kill()
                    stdout,stderr=proc.communicate(timeout=3)
                    self.fail(f"{checkpoint}: child failed before checkpoint: {stdout} {stderr}")
                if checkpoint!="cleanup": os.kill(proc.pid,signal.SIGTERM)
                self.assertEqual(proc.wait(timeout=10),-signal.SIGTERM)
                manifest_path=next((root/"results").glob("*/tier1/manifest.json"))
                manifest=json.loads(manifest_path.read_text())
                conftest.provenance.validate_manifest(manifest)
                self.assertEqual(manifest["run"]["status"],"failed")
                self.assertIn("interrupted",manifest["run"]["failure_codes"])
                calls=[json.loads(line) for line in (root/"calls.log").read_text().splitlines()]
                self.assertEqual(next(call for call in calls if call[:3]==["docker","rm","-f"])[-1],CID)

    def test_failed_version_mismatch_retains_exact_observed_identity(self):
        for observed in ("0.9.7", "0.9.8-beta.1"):
            with self.subTest(observed=observed), tempfile.TemporaryDirectory() as td:
                tmp=Path(td); results=tmp/"results"; envf=tmp/"pinned.env"
                envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
                image={"id":IMAGE_ID,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
                repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
                def stage(repo,dest): Path(dest).mkdir(parents=True); return repository
                def host(args,**kw):
                    if args==["docker","info"]: return cp(args)
                    if args[:3]==["docker","run","-d"]:
                        Path(args[args.index("--cidfile")+1]).write_text(CID+"\n")
                        return cp(args)
                    raise AssertionError(args)
                def container_run(self,*args,**kw): return cp(args)
                artifact={"kind":"vendor-binary","version":observed,
                          "executable_sha256":"f"*64}
                clean=conftest.TeardownResult("absent","clean","ordinary_nonzero",True)
                patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest,"_disconnect_container_networks",return_value="2026-10-02T00:00:02Z"),mock.patch.object(conftest,"_installed_package_identity",return_value=artifact),mock.patch.object(conftest.Tier1Container,"run",new=container_run),mock.patch.object(conftest,"_finalize_session",return_value=clean),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage)]
                for patcher in patches: patcher.start()
                try:
                    gen=conftest.tier1_container.__wrapped__(SimpleNamespace())
                    with self.assertRaisesRegex(RuntimeError,"does not match"):
                        next(gen)
                finally:
                    for patcher in reversed(patches): patcher.stop()
                manifest=json.loads(next(results.glob("*/tier1/manifest.json")).read_text())
                conftest.provenance.validate_manifest(manifest)
                self.assertEqual(manifest["run"]["status"],"failed")
                self.assertEqual(manifest["prime_agent"]["installed_version"],observed)
                self.assertIn("installed-version-mismatch",manifest["run"]["failure_codes"])

    def test_finalizer_timeout_plus_absence_publishes_failed_not_passed(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td); results=tmp/"results"; envf=tmp/"pinned.env"
            envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            image={"id":IMAGE_ID,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
            repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
            def stage(repo,dest): Path(dest).mkdir(parents=True); return repository
            def host(args,**kw):
                if args==["docker","info"]: return cp(args)
                if args[:3]==["docker","run","-d"]:
                    Path(args[args.index("--cidfile")+1]).write_text(CID+"\n")
                    return cp(args)
                raise AssertionError(args)
            def container_run(self,*args,**kw): return cp(args)
            artifact={"kind":"vendor-binary","version":"0.9.8","executable_sha256":"f"*64}
            bad=conftest.TeardownResult("absent","timed_out","ordinary_nonzero",False)
            teardown_error=conftest.TeardownError(bad,"synthetic teardown timeout")
            patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest,"_disconnect_container_networks",return_value="2026-10-02T00:00:02Z"),mock.patch.object(conftest,"_installed_package_identity",return_value=artifact),mock.patch.object(conftest.Tier1Container,"run",new=container_run),mock.patch.object(conftest,"_finalize_session",side_effect=teardown_error),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage)]
            for patcher in patches: patcher.start()
            try:
                gen=conftest.tier1_container.__wrapped__(SimpleNamespace())
                next(gen)
                with self.assertRaises(conftest.TeardownError): next(gen)
            finally:
                for patcher in reversed(patches): patcher.stop()
            manifest=json.loads(next(results.glob("*/tier1/manifest.json")).read_text())
            conftest.provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"],"failed")
            self.assertEqual(manifest["teardown"]["state"],"absent")
            self.assertFalse(manifest["teardown"]["clean"])
            self.assertEqual(manifest["teardown"]["remove_outcome"],"timed_out")

class _FakeItem:
    def __init__(self, fixturenames): self.fixturenames=fixturenames; self.markers=[]
    def add_marker(self, marker): self.markers.append(marker)
    def get_closest_marker(self, name):
        return next((m for m in reversed(self.markers) if getattr(m,"name",None)==name),None)

class TestCollectionPolicy(unittest.TestCase):
    def test_default_fixture_user_is_marked_and_skipped(self):
        item=_FakeItem(["tier1_container"]); cfg=SimpleNamespace(option=SimpleNamespace(markexpr="")); conftest.pytest_collection_modifyitems(cfg,[item]); names=[m.name for m in item.markers]; self.assertIn("container",names); self.assertIn("skip",names)
    def test_unmarked_tier0_is_untouched(self):
        item=_FakeItem([]); cfg=SimpleNamespace(option=SimpleNamespace(markexpr="")); conftest.pytest_collection_modifyitems(cfg,[item]); self.assertEqual(item.markers,[])
    def test_explicit_mark_selection_does_not_skip(self):
        item=_FakeItem(["tier1_container"]); cfg=SimpleNamespace(option=SimpleNamespace(markexpr="container")); conftest.pytest_collection_modifyitems(cfg,[item]); names=[m.name for m in item.markers]; self.assertIn("container",names); self.assertNotIn("skip",names)

class TestFixtureStatics(unittest.TestCase):
    def test_no_source_build_mutators_and_no_shared_setup_log(self):
        text=Path(conftest.__file__).read_text(); self.assertNotIn("_stage_fork_release",text); self.assertNotIn("npm run build",text); self.assertNotIn("tier1-session-setup.log",text); self.assertIn("--iidfile",text); self.assertIn("--cidfile",text)
    def test_explicit_plugin_root_no_host_home_and_no_broad_teardown(self):
        text=Path(conftest.__file__).read_text(); body=text[text.index("def tier1_container"):]; self.assertIn('"PRIME_AGENT_PLUGIN_ROOT": CONTAINER_PLUGIN_ROOT',body); self.assertNotIn('os.environ.get("HOME")',body); self.assertNotIn('env=os.environ',body); self.assertNotIn("prune",text); self.assertNotIn('"--all"',text)

if __name__=="__main__": unittest.main()
