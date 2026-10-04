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

def build_image(tier, snapshot):
    binding = conftest.provenance.owned_directory_binding(tier)
    with conftest.provenance.open_owned_directory(tier, binding) as owned:
        return conftest._build_tier1_image(owned, tier, snapshot)


def source_builder_receipt(state="unknown", clean=False):
    remove = "clean" if state in {"absent", "present"} else "ordinary_nonzero"
    inspect = "ordinary_nonzero" if state in {"absent", "unknown"} else "clean"
    inventory = {
        "content_sha256": "1" * 64, "entry_count": 1,
        "kind_counts": {"file": 1},
        "content_hash_contract": "framed-sha256-checkout-v1",
    }
    source = {
        "head": "b" * 40, "dirty": True, "status_sha256": "a" * 64,
        "content_sha256": "c" * 64, "entry_count": 1,
        "content_hash_contract": "framed-sha256-v2",
    }
    return {
        "schema_version": 1, "status": "failed",
        "started_at": "2026-10-04T00:00:00Z",
        "finished_at": "2026-10-04T00:00:01Z",
        "failure_codes": ["builder-failed"], "source": source,
        "source_rules": {
            "include": "git-cached-plus-nonignored-untracked-v1",
            "exclude": "git-standard-ignored-and-dotgit-v1",
        },
        "checkout_inventory_before": inventory,
        "checkout_inventory_after": inventory,
        "builder_image": {
            "id": IMAGE_ID, "repo_digests": [],
            "dockerfile": "docker/test-prime-agent-builder.Dockerfile",
            "dockerfile_sha256": "d" * 64,
            "declared_input_sha256": "e" * 64,
            "declared_input_hash_contract": "framed-sha256-v2",
            "informational_tag": "prime-claw-test-prime-agent-builder:eeeeeeeeeeee",
            "os": "linux", "architecture": "arm64",
            "build_started_at": "2026-10-04T00:00:00Z",
            "build_finished_at": "2026-10-04T00:00:01Z",
        },
        "builder_teardown": {
            "container_id": CID, "state": state,
            "remove_outcome": remove, "inspect_outcome": inspect,
            "clean": clean, "verified_at": "2026-10-04T00:00:01Z",
        },
        "release": None,
    }


class TestSelectionFailClose(unittest.TestCase):
    def test_source_selector_is_lexically_validated_without_checkout_stat(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve(); source=tmp/"private-source"; source.mkdir(); (source/"sentinel").write_text("keep")
            envf=tmp/"source.env"; envf.write_text(f"PRIME_AGENT_SOURCE={source}\n")
            with mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}), mock.patch.object(Path,"is_dir",side_effect=AssertionError("checkout stat")):
                mode, selected = conftest._load_install_selection()
            self.assertEqual((mode,selected),("source",str(source))); self.assertEqual((source/"sentinel").read_text(),"keep")
    def test_pinned_selector_returns_value(self):
        with tempfile.TemporaryDirectory() as td:
            envf=Path(td).resolve()/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            with mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}): self.assertEqual(conftest._load_install_selection(),("pinned","0.9.8"))
    def test_both_and_neither_rejected(self):
        for text in ("PRIME_AGENT_PINNED=\nPRIME_AGENT_SOURCE=\n","PRIME_AGENT_PINNED=0.9.8\nPRIME_AGENT_SOURCE=/x\n"):
            with tempfile.TemporaryDirectory() as td:
                envf=Path(td).resolve()/"x.env"; envf.write_text(text)
                with mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}), self.assertRaises(RuntimeError): conftest._load_install_selection()

    def test_malicious_pinned_values_fail_before_docker(self):
        for value in ("0.9.8;uname", "0.9.8'", "0.9.8-beta", "0.9.8\nEVIL=1"):
            with tempfile.TemporaryDirectory() as td:
                envf=Path(td).resolve()/"bad.env"; envf.write_text("PRIME_AGENT_PINNED="+value+"\n")
                with mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}), mock.patch.object(conftest,"_host_command",side_effect=AssertionError("docker contacted")):
                    with self.assertRaisesRegex(RuntimeError,"exact semantic version|unsupported keys"):
                        conftest._load_install_selection()

class TestExactImageBuild(unittest.TestCase):
    def test_build_uses_fresh_context_iidfile_and_inspects_exact_id(self):
        with tempfile.TemporaryDirectory() as td:
            tier=Path(td).resolve()/"tier1"; tier.mkdir(); snapshot=Path(td).resolve()/"snapshot"; (snapshot/"docker").mkdir(parents=True); (snapshot/"docker/test.Dockerfile").write_text("FROM scratch\n"); calls=[]
            def run(args,**kw):
                calls.append(args)
                if args[:2]==["docker","build"]:
                    Path(args[args.index("--iidfile")+1]).write_text(IMAGE_ID+"\n"); return cp(args)
                if args[:3]==["docker","image","inspect"]:
                    return cp(args,out=json.dumps([{"Id":IMAGE_ID,"RepoDigests":[],"Os":"linux","Architecture":"arm64"}]))
                raise AssertionError(args)
            with mock.patch.object(conftest,"_host_command",side_effect=run): image=build_image(tier, snapshot)
            build=calls[0]; self.assertIn("--iidfile",build); self.assertEqual(build[-1],str(tier/"build-context")); self.assertNotEqual(build[-1],str(conftest.REPO))
            self.assertEqual(calls[1][-1],IMAGE_ID); self.assertEqual(image["id"],IMAGE_ID); self.assertTrue((tier/"image.json").is_file())
    def test_iid_mismatch_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            tier=Path(td).resolve()/"tier1"; tier.mkdir(); snapshot=Path(td).resolve()/"snapshot"; (snapshot/"docker").mkdir(parents=True); (snapshot/"docker/test.Dockerfile").write_text("FROM scratch\n")
            def run(args,**kw):
                if args[:2]==["docker","build"]: Path(args[args.index("--iidfile")+1]).write_text(IMAGE_ID+"\n"); return cp(args)
                return cp(args,out=json.dumps([{"Id":"sha256:"+"b"*64,"Os":"linux","Architecture":"arm64"}]))
            with mock.patch.object(conftest,"_host_command",side_effect=run), self.assertRaisesRegex(conftest.provenance.ProvenanceError,"mismatched"): build_image(tier, snapshot)

    def test_missing_iidfile_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            tier=Path(td).resolve()/"tier1"; tier.mkdir(); snapshot=Path(td).resolve()/"snapshot"; (snapshot/"docker").mkdir(parents=True); (snapshot/"docker/test.Dockerfile").write_text("FROM scratch\n")
            with mock.patch.object(conftest,"_host_command",return_value=cp([])), self.assertRaisesRegex(RuntimeError,"iidfile"):
                build_image(tier, snapshot)

    def test_build_hashes_the_captured_context_not_mutable_live_input(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td).resolve(); tier=root/"tier1"; tier.mkdir()
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
                image=build_image(tier, snapshot)
            context=tier/"build-context"
            self.assertEqual(image["dockerfile_sha256"],conftest.provenance.sha256_file(context/"Dockerfile"))
            self.assertEqual(image["declared_input_sha256"],conftest.provenance.hash_declared_inputs(context,["Dockerfile"]))

    def test_unsafe_image_metadata_is_discarded_before_image_json_write(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td).resolve(); tier=root/"tier1"; tier.mkdir()
            snapshot=root/"snapshot"; (snapshot/"docker").mkdir(parents=True)
            (snapshot/"docker/test.Dockerfile").write_text("FROM scratch\n")
            def host(args,**kw):
                if args[:2]==["docker","build"]:
                    Path(args[args.index("--iidfile")+1]).write_text(IMAGE_ID+"\n")
                    return cp(args)
                return cp(args,out=json.dumps([{"Id":IMAGE_ID,"RepoDigests":["private.local/team/image"],"Private":"10.0.4.225","Os":"linux","Architecture":"arm64"}]))
            with mock.patch.object(conftest,"_host_command",side_effect=host):
                image=build_image(tier, snapshot)
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

    def test_source_reads_installed_package_metadata_without_launching_cli(self):
        class FakeContainer:
            mode="source"
            def __init__(self): self.calls=[]
            def run(self,*args,**kwargs):
                self.calls.append(args)
                if args[:2] == ("node","-e"): return cp(args,out="0.9.8")
                return cp(args,out="f"*64+"  /usr/local/bin/prime-agent\n")
        fake=FakeContainer(); package=conftest._installed_package_identity(fake)
        self.assertEqual(package["version"],"0.9.8")
        self.assertEqual(fake.calls[0][:2],("node","-e"))
        self.assertNotIn(("prime-agent","--version"),fake.calls)

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
            share=Path(td).resolve()/"share"; share.mkdir(); (share/"evidence").write_text("x")
            result=conftest.TeardownResult("unknown","timed_out","ordinary_nonzero",False)
            err=conftest.TeardownError(result,"boom")
            with mock.patch.object(conftest,"_remove_session_container",side_effect=err), self.assertRaises(conftest.TeardownError): conftest._finalize_session(CID,share)
            self.assertTrue(share.exists())
    def test_in_flight_failure_keeps_primary_and_adds_note(self):
        with tempfile.TemporaryDirectory() as td:
            share=Path(td).resolve()/"share"; share.mkdir(); original=ValueError("body failed")
            result=conftest.TeardownResult("unknown","timed_out","ordinary_nonzero",False)
            err=conftest.TeardownError(result,"teardown failed")
            with mock.patch.object(conftest,"_remove_session_container",side_effect=err): state=conftest._finalize_session(CID,share,original)
            self.assertEqual(state.state,"unknown"); self.assertFalse(state.clean); self.assertTrue(any("teardown also failed" in n for n in original.__notes__))

    def test_nonzero_remove_is_idempotent_when_inspect_proves_absent(self):
        responses=[cp([],rc=1,err="No such container"),cp([],rc=1,err="No such container")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses): conftest._remove_session_container(CID)
    def test_keep_share_preserves_successful_debug_artifacts(self):
        with tempfile.TemporaryDirectory() as td:
            share=Path(td).resolve()/"share"; share.mkdir()
            clean=conftest.TeardownResult("absent","clean","ordinary_nonzero",True)
            with mock.patch.object(conftest,"_remove_session_container",return_value=clean), mock.patch.dict(os.environ,{"TIER1_KEEP_SHARE":"1"}):
                self.assertTrue(conftest._finalize_session(CID,share).clean)
            self.assertTrue(share.exists())

    def test_unpublished_container_never_calls_docker(self):
        with tempfile.TemporaryDirectory() as td:
            share=Path(td).resolve()/"share"; share.mkdir()
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


    def test_target_signal_death_stays_typed_even_when_absence_is_proven(self):
        responses=[cp([],rc=-signal.SIGKILL,outcome="signaled",signum=signal.SIGKILL),
                   cp([],rc=1,err="Error: No such container: "+CID)]
        with mock.patch.object(conftest,"_host_command",side_effect=responses),              self.assertRaises(conftest.TeardownError) as ctx:
            conftest._remove_session_container(CID)
        self.assertEqual(ctx.exception.result.state,"absent")
        self.assertEqual(ctx.exception.result.remove_outcome,"signaled")
        self.assertFalse(ctx.exception.result.clean)

    def test_teardown_diagnostics_redact_arbitrary_output_and_non_utf8(self):
        secret="Authorization: Bearer synthetic-secret-value"
        responses=[cp([],rc=1,out=secret.encode()+b"\xff",err=secret.encode()),
                   cp([],rc=1,out=secret.encode(),err=b"daemon \xff unavailable")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses),              self.assertRaises(conftest.TeardownError) as ctx:
            conftest._remove_session_container(CID)
        rendered=str(ctx.exception)+ctx.exception.result.diagnostics
        self.assertNotIn(secret,rendered)
        self.assertIn("remove_outcome=ordinary_nonzero",rendered)
        self.assertIn("state=unknown",rendered)

    def test_cleanup_command_interruption_is_deferred_for_fixture_redelivery(self):
        interrupted=cp([],rc=143,outcome="interrupted",signum=signal.SIGTERM)
        conftest._DEFERRED_SIGNAL=None
        with mock.patch.object(conftest.bounded_command,"run_completed",return_value=interrupted):
            result=conftest._host_command(["docker","rm","-f",CID],timeout=1,
                                         propagate_signal=False)
        self.assertEqual(result.outcome,"interrupted")
        self.assertEqual(conftest._DEFERRED_SIGNAL,signal.SIGTERM)

class TestSourceBuilderShareOwnership(unittest.TestCase):
    def _run_failed_builder(self, scenario):
        temporary = tempfile.TemporaryDirectory()
        root = Path(temporary.name).resolve()
        results = root / "results"
        source = root / "source"; source.mkdir()
        envf = root / "source.env"
        envf.write_text(f"PRIME_AGENT_SOURCE={source}\n")
        unrelated = root / "unrelated"; unrelated.write_text("keep")
        repository = {
            "head": "b" * 40, "dirty": False,
            "status_sha256": "a" * 64, "content_sha256": "c" * 64,
            "entry_count": 1, "content_hash_contract": "framed-sha256-v2",
        }

        def stage(_repo, destination):
            Path(destination).mkdir(parents=True)
            return repository

        def failed_builder(_source, tier_cap, _tier_dir, _tier_binding,
                           share, _share_binding, _snapshot):
            (share / "source-release").mkdir()
            (share / "source-release" / "sentinel").write_text("builder-evidence")
            if scenario == "invalid":
                conftest.provenance.write_sanitized_json(
                    tier_cap, "source-build.json", {"status": "failed"})
            elif scenario != "missing":
                state = scenario if scenario in {"present", "unknown"} else "absent"
                conftest.provenance.write_sanitized_json(
                    tier_cap, "source-build.json",
                    source_builder_receipt(state=state, clean=scenario == "clean"))
            raise RuntimeError("controlled source builder failure")

        def host(args, **_kwargs):
            if args == ["docker", "info"]:
                return cp(args)
            raise AssertionError(f"runtime Docker must not start: {args}")

        patches = [
            mock.patch.dict(os.environ, {"TIER1_ENV_FILE": str(envf)}),
            mock.patch.object(conftest, "RESULTS", results),
            mock.patch.object(conftest.shutil, "which", return_value="/fake/docker"),
            mock.patch.object(conftest, "_host_command", side_effect=host),
            mock.patch.object(conftest.provenance, "stage_repository_snapshot",
                              side_effect=stage),
            mock.patch.object(conftest, "_build_source_release",
                              side_effect=failed_builder),
            mock.patch.object(conftest, "_build_tier1_image",
                              side_effect=AssertionError("runtime image built")),
        ]
        for patcher in patches:
            patcher.start()
        try:
            generator = conftest.tier1_container.__wrapped__(SimpleNamespace())
            with self.assertRaisesRegex(RuntimeError, "controlled source builder"):
                next(generator)
        finally:
            for patcher in reversed(patches):
                patcher.stop()
        tier = next(results.glob("*/tier1"))
        manifests = list(tier.glob("manifest.json"))
        if manifests:
            self.assertEqual(json.loads(manifests[0].read_text())["run"]["status"],
                             "failed")
        self.assertEqual(unrelated.read_text(), "keep")
        return temporary, tier

    def test_public_fixture_retains_share_for_uncertain_builder_receipts(self):
        for scenario in ("present", "unknown", "missing", "invalid"):
            with self.subTest(scenario=scenario):
                temporary, tier = self._run_failed_builder(scenario)
                with temporary:
                    share = tier / "share"
                    self.assertTrue(share.is_dir())
                    self.assertEqual(
                        (share / "source-release" / "sentinel").read_text(),
                        "builder-evidence")

    def test_public_fixture_deletes_share_after_clean_builder_and_no_runtime(self):
        temporary, tier = self._run_failed_builder("clean")
        with temporary:
            self.assertFalse((tier / "share").exists())


class TestFixtureEndToEnd(unittest.TestCase):
    def _assert_valid_partial_cid_is_recovered(self, *, timeout):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve(); results=tmp/"results"; envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n"); calls=[]
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
            tmp=Path(td).resolve(); results=tmp/"results"; envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
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
            tmp=Path(td).resolve(); results=tmp/"results"; envf=tmp/"pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n"); events=[]
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
                root=Path(td).resolve(); child=root/"child.py"; child.write_text(child_source)
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

    @unittest.skipUnless(hasattr(signal, "pthread_sigmask")
                         and hasattr(signal, "sigpending"),
                         "requires POSIX pending-signal inspection")
    def test_fixture_terminal_boundary_matrix(self):
        controller = r'''
import json, os, signal, sys, tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
sys.path.insert(0, sys.argv[1])
sys.path.insert(0, str(Path(sys.argv[1]) / 'tests'))
import conftest
checkpoint = sys.argv[2]
injected_signal = int(sys.argv[3])
root = Path(sys.argv[4]).resolve()
results = root / 'results'
envf = root / 'pinned.env'
envf.write_text('PRIME_AGENT_PINNED=0.9.8\n')
watched = (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
seen = []
def prior(signum, _frame):
    seen.append(int(signum))
    if checkpoint == 'prior_raises':
        raise RuntimeError('injected prior handler failure')
for signum in watched:
    signal.signal(signum, prior)
if checkpoint == 'caller_pending':
    signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGTERM})
    os.kill(os.getpid(), signal.SIGTERM)
entry_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
image = {
    'id': 'sha256:' + 'a' * 64, 'repo_digests': [],
    'dockerfile': 'docker/test.Dockerfile',
    'dockerfile_sha256': 'd' * 64,
    'declared_input_sha256': 'e' * 64,
    'declared_input_hash_contract': 'framed-sha256-v2',
    'informational_tag': 'prime-claw-test-tier1:eeeeeeeeeeee',
    'os': 'linux', 'architecture': 'arm64',
    'build_started_at': '2026-10-02T00:00:00Z',
    'build_finished_at': '2026-10-02T00:00:01Z',
}
repository = {
    'head': 'b' * 40, 'dirty': False, 'status_sha256': 'a' * 64,
    'content_sha256': 'c' * 64, 'entry_count': 1,
    'content_hash_contract': 'framed-sha256-v2',
}
artifact = {
    'kind': 'vendor-binary', 'version': '0.9.8',
    'executable_sha256': 'f' * 64,
}
def cp(args, rc=0, out='', err='', outcome='exited', signum=None):
    return SimpleNamespace(args=args, returncode=rc, stdout=out, stderr=err,
                           outcome=outcome, signal=signum)
def stage(_repo, dest):
    Path(dest).mkdir(parents=True)
    return repository
def host(args, **_kwargs):
    if args == ['docker', 'info']:
        return cp(args)
    if args[:3] == ['docker', 'run', '-d']:
        Path(args[args.index('--cidfile') + 1]).write_text('c' * 64 + '\n')
        return cp(args)
    raise AssertionError(args)
def container_run(self, *args, **_kwargs):
    return cp(args)
clean = conftest.TeardownResult('absent', 'clean', 'ordinary_nonzero', True)
real_kill = os.kill
kill_calls = 0
def fixture_kill(pid, signum):
    global kill_calls
    kill_calls += 1
    if checkpoint == 'redelivery_failure' and kill_calls == 2:
        raise OSError('injected redelivery failure')
    return real_kill(pid, signum)
def finalize(*_args, **_kwargs):
    if checkpoint == 'redelivery_failure':
        os.kill(os.getpid(), injected_signal)
    return clean
real_open = conftest.provenance.open_owned_directory
opened = []
open_failed = False
def open_owned(path, binding, **kwargs):
    global open_failed
    if checkpoint == 'capability_open_failure' and Path(path).name == 'tier1' and not open_failed:
        open_failed = True
        raise conftest.provenance.ProvenanceError('injected capability open failure')
    cap = real_open(path, binding, **kwargs)
    if Path(path).name == 'tier1':
        opened.append(cap)
    return cap
real_inventory = conftest.provenance.evidence_inventory
real_atomic = conftest.provenance.atomic_write_manifest
real_verify = conftest.provenance.verify_evidence
injected = False
def inject_once():
    global injected
    if not injected:
        injected = True
        os.kill(os.getpid(), injected_signal)
def inventory(*args, **kwargs):
    if checkpoint in ('inventory', 'prior_raises'):
        inject_once()
    return real_inventory(*args, **kwargs)
def atomic(*args, **kwargs):
    global injected
    if checkpoint == 'atomic':
        inject_once()
    result = real_atomic(*args, **kwargs)
    if checkpoint == 'publication_failure' and not injected:
        injected = True
        raise RuntimeError('injected post-publication failure')
    return result
def verify(*args, **kwargs):
    result = real_verify(*args, **kwargs)
    if checkpoint == 'verify':
        inject_once()
    return result
real_signal = conftest.signal.signal
real_sigpending = conftest.signal.sigpending
real_sigmask = conftest.signal.pthread_sigmask
signal_calls = 0
sigpending_calls = 0
sigmask_calls = 0
def fixture_sigpending():
    global sigpending_calls
    sigpending_calls += 1
    fail_at = {
        'sigpending_publication_failure': 2,
        'sigpending_before_restore_failure': 6,
        'sigpending_after_restore_failure': 7,
    }.get(checkpoint)
    if fail_at is not None and sigpending_calls == fail_at:
        raise RuntimeError('injected terminal pending inspection failure')
    return real_sigpending()
def fixture_sigmask(how, mask):
    global sigmask_calls
    sigmask_calls += 1
    if checkpoint == 'initial_block_failure' and sigmask_calls == 2:
        raise RuntimeError('injected initial block failure')
    return real_sigmask(how, mask)
def fixture_signal(signum, handler):
    global signal_calls
    signal_calls += 1
    if checkpoint == 'handler_install_failure' and signal_calls == 2:
        raise RuntimeError('injected handler install failure')
    if checkpoint == 'restoration' and signal_calls == len(watched) + 1:
        inject_once()
    return real_signal(signum, handler)
patches = [
    mock.patch.dict(os.environ, {'TIER1_ENV_FILE': str(envf)}),
    mock.patch.object(conftest, 'RESULTS', results),
    mock.patch.object(conftest.shutil, 'which', return_value='/fake/docker'),
    mock.patch.object(conftest, '_host_command', side_effect=host),
    mock.patch.object(conftest, '_build_tier1_image', return_value=image),
    mock.patch.object(conftest, '_disconnect_container_networks',
                      return_value='2026-10-02T00:00:02Z'),
    mock.patch.object(conftest, '_installed_package_identity',
                      return_value=artifact),
    mock.patch.object(conftest.Tier1Container, 'run', new=container_run),
    mock.patch.object(conftest, '_finalize_session', side_effect=finalize),
    mock.patch.object(conftest.os, 'kill', side_effect=fixture_kill),
    mock.patch.object(conftest.provenance, 'stage_repository_snapshot',
                      side_effect=stage),
    mock.patch.object(conftest.provenance, 'open_owned_directory',
                      side_effect=open_owned),
    mock.patch.object(conftest.provenance, 'evidence_inventory',
                      side_effect=inventory),
    mock.patch.object(conftest.provenance, 'atomic_write_manifest',
                      side_effect=atomic),
    mock.patch.object(conftest.provenance, 'verify_evidence',
                      side_effect=verify),
    mock.patch.object(conftest.signal, 'signal', side_effect=fixture_signal),
    mock.patch.object(conftest.signal, 'sigpending',
                      side_effect=fixture_sigpending),
    mock.patch.object(conftest.signal, 'pthread_sigmask',
                      side_effect=fixture_sigmask),
]
for patcher in patches:
    patcher.start()
error = None
try:
    generator = conftest.tier1_container.__wrapped__(SimpleNamespace())
    next(generator)
    next(generator)
except StopIteration:
    pass
except BaseException as exc:
    error = type(exc).__name__
finally:
    for patcher in reversed(patches):
        patcher.stop()
manifest_paths = list(results.glob('*/tier1/manifest.json'))
manifest = json.loads(manifest_paths[0].read_text()) if manifest_paths else None
restored_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
print(json.dumps({
    'capability_closed': all(cap.fd == -1 for cap in opened),
    'error': error,
    'handlers_restored': all(signal.getsignal(sig) is prior for sig in watched),
    'manifest_codes': [] if manifest is None else manifest.get('run', {}).get('failure_codes', []),
    'manifest_status': None if manifest is None else manifest.get('run', {}).get('status', manifest.get('status')),
    'mask_restored': restored_mask == entry_mask,
    'pending': sorted(map(int, signal.sigpending() & set(watched))),
    'seen': seen,
}))
'''
        signal_checkpoints = ("inventory", "atomic", "verify", "restoration")
        for checkpoint in signal_checkpoints:
            for injected_signal in (signal.SIGTERM, signal.SIGINT,
                                    signal.SIGHUP):
                with self.subTest(checkpoint=checkpoint,
                                  signal=signal.Signals(injected_signal).name), \
                        tempfile.TemporaryDirectory() as td:
                    completed = subprocess.run(
                        [sys.executable, "-c", controller,
                         str(Path(__file__).resolve().parent.parent), checkpoint,
                         str(int(injected_signal)), td],
                        capture_output=True, text=True, timeout=10)
                    self.assertEqual(completed.returncode, 0,
                                     completed.stdout + completed.stderr)
                    row = json.loads(completed.stdout.splitlines()[-1])
                    self.assertEqual(row["error"], "_FixtureInterrupted")
                    self.assertTrue(row["capability_closed"])
                    self.assertTrue(row["handlers_restored"])
                    self.assertTrue(row["mask_restored"])
                    self.assertEqual(row["seen"], [injected_signal])
                    self.assertEqual(row["pending"], [])
                    self.assertEqual(row["manifest_status"], "failed")
                    self.assertIn("interrupted", row["manifest_codes"])

        for checkpoint, expected_error in (
            ("publication_failure", "RuntimeError"),
            ("prior_raises", "RuntimeError"),
            ("redelivery_failure", "OSError"),
            ("handler_install_failure", "RuntimeError"),
            ("initial_block_failure", "RuntimeError"),
            ("sigpending_publication_failure", "RuntimeError"),
            ("sigpending_before_restore_failure", "RuntimeError"),
            ("sigpending_after_restore_failure", "RuntimeError"),
            ("capability_open_failure", "ProvenanceError"),
        ):
            with self.subTest(checkpoint=checkpoint), \
                    tempfile.TemporaryDirectory() as td:
                completed = subprocess.run(
                    [sys.executable, "-c", controller,
                     str(Path(__file__).resolve().parent.parent), checkpoint,
                     str(int(signal.SIGTERM)), td],
                    capture_output=True, text=True, timeout=10)
                self.assertEqual(completed.returncode, 0,
                                 completed.stdout + completed.stderr)
                row = json.loads(completed.stdout.splitlines()[-1])
                self.assertEqual(row["error"], expected_error)
                self.assertTrue(row["capability_closed"])
                self.assertTrue(row["handlers_restored"])
                self.assertTrue(row["mask_restored"])
                self.assertNotEqual(row["manifest_status"], "passed")
                if checkpoint == "prior_raises":
                    self.assertEqual(row["seen"], [signal.SIGTERM])
                    self.assertEqual(row["manifest_status"], "failed")
                if checkpoint in (
                    "sigpending_before_restore_failure",
                    "sigpending_after_restore_failure",
                ):
                    self.assertEqual(row["manifest_status"], "failed")
                    self.assertIn(
                        "signal-inspection-failed", row["manifest_codes"])
                if checkpoint == "sigpending_publication_failure":
                    self.assertIsNone(row["manifest_status"])

        with self.subTest(checkpoint="caller_pending"), \
                tempfile.TemporaryDirectory() as td:
            completed = subprocess.run(
                [sys.executable, "-c", controller,
                 str(Path(__file__).resolve().parent.parent), "caller_pending",
                 str(int(signal.SIGTERM)), td],
                capture_output=True, text=True, timeout=10)
            self.assertEqual(completed.returncode, 0,
                             completed.stdout + completed.stderr)
            row = json.loads(completed.stdout.splitlines()[-1])
            self.assertIsNone(row["error"])
            self.assertTrue(row["capability_closed"])
            self.assertTrue(row["handlers_restored"])
            self.assertTrue(row["mask_restored"])
            self.assertEqual(row["seen"], [])
            self.assertEqual(row["pending"], [signal.SIGTERM])
            self.assertEqual(row["manifest_status"], "passed")

    def test_signal_during_fixture_publication_never_leaves_green_manifest(self):
        with tempfile.TemporaryDirectory() as td:
            tmp=Path(td).resolve(); results=tmp/"results"; envf=tmp/"pinned.env"
            envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            image={"id":IMAGE_ID,"repo_digests":[],"dockerfile":"docker/test.Dockerfile","dockerfile_sha256":"d"*64,"declared_input_sha256":"e"*64,"declared_input_hash_contract":"framed-sha256-v2","informational_tag":"prime-claw-test-tier1:eeeeeeeeeeee","os":"linux","architecture":"arm64","build_started_at":"2026-10-02T00:00:00Z","build_finished_at":"2026-10-02T00:00:01Z"}
            repository={"head":"b"*40,"dirty":False,"status_sha256":"a"*64,"content_sha256":"c"*64,"entry_count":1,"content_hash_contract":"framed-sha256-v2"}
            artifact={"kind":"vendor-binary","version":"0.9.8","executable_sha256":"f"*64}
            def stage(_repo,dest): Path(dest).mkdir(parents=True); return repository
            def host(args,**kw):
                if args==["docker","info"]: return cp(args)
                if args[:3]==["docker","run","-d"]:
                    Path(args[args.index("--cidfile")+1]).write_text(CID+"\n"); return cp(args)
                raise AssertionError(args)
            def container_run(self,*args,**kw): return cp(args)
            clean=conftest.TeardownResult("absent","clean","ordinary_nonzero",True)
            real_inventory=conftest.provenance.evidence_inventory; injected=False; kill_calls=0
            def inventory(*args,**kwargs):
                nonlocal injected
                if not injected:
                    injected=True; conftest.os.kill(os.getpid(),signal.SIGTERM)
                return real_inventory(*args,**kwargs)
            def fake_kill(_pid,signum):
                nonlocal kill_calls
                kill_calls+=1
                if kill_calls==1:
                    handler=signal.getsignal(signum); handler(signum,None)
            previous={sig:signal.getsignal(sig) for sig in (signal.SIGTERM,signal.SIGINT,signal.SIGHUP)}
            patches=[mock.patch.dict(os.environ,{"TIER1_ENV_FILE":str(envf)}),mock.patch.object(conftest,"RESULTS",results),mock.patch.object(conftest.shutil,"which",return_value="/fake/docker"),mock.patch.object(conftest,"_host_command",side_effect=host),mock.patch.object(conftest,"_build_tier1_image",return_value=image),mock.patch.object(conftest,"_disconnect_container_networks",return_value="2026-10-02T00:00:02Z"),mock.patch.object(conftest,"_installed_package_identity",return_value=artifact),mock.patch.object(conftest.Tier1Container,"run",new=container_run),mock.patch.object(conftest,"_finalize_session",return_value=clean),mock.patch.object(conftest.provenance,"stage_repository_snapshot",side_effect=stage),mock.patch.object(conftest.provenance,"evidence_inventory",side_effect=inventory),mock.patch.object(conftest.os,"kill",side_effect=fake_kill)]
            for patcher in patches: patcher.start()
            try:
                gen=conftest.tier1_container.__wrapped__(SimpleNamespace()); next(gen)
                with self.assertRaises(conftest._FixtureInterrupted): next(gen)
            finally:
                for patcher in reversed(patches): patcher.stop()
            manifest=json.loads(next(results.glob("*/tier1/manifest.json")).read_text())
            conftest.provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"],"failed")
            self.assertIn("interrupted",manifest["run"]["failure_codes"])
            self.assertEqual({sig:signal.getsignal(sig) for sig in previous},previous)

    def test_failed_version_mismatch_retains_exact_observed_identity(self):
        for observed in ("0.9.7", "0.9.8-beta.1"):
            with self.subTest(observed=observed), tempfile.TemporaryDirectory() as td:
                tmp=Path(td).resolve(); results=tmp/"results"; envf=tmp/"pinned.env"
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
            tmp=Path(td).resolve(); results=tmp/"results"; envf=tmp/"pinned.env"
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
