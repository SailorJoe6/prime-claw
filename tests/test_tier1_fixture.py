"""Tier-0 pure/mock/static coverage for the tier-1 session fixture."""
from __future__ import annotations

import hashlib, json, os, signal, subprocess, tempfile, textwrap, time, unittest
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


def source_builder_receipt(state="unknown", clean=False, remove_outcome=None):
    remove = (remove_outcome if remove_outcome is not None else
              "clean" if state in {"absent", "present"} else "ordinary_nonzero")
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

    def test_nonzero_remove_stays_nonclean_when_inspect_proves_absent(self):
        responses=[cp([],rc=1,err="No such container"),cp([],rc=1,err="No such container")]
        with mock.patch.object(conftest,"_host_command",side_effect=responses), \
                self.assertRaises(conftest.TeardownError) as ctx:
            conftest._remove_session_container(CID)
        self.assertEqual(ctx.exception.result.state,"absent")
        self.assertEqual(ctx.exception.result.remove_outcome,"ordinary_nonzero")
        self.assertFalse(ctx.exception.result.clean)
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
                    source_builder_receipt(
                        state=state,
                        clean=scenario == "clean",
                        remove_outcome=("ordinary_nonzero"
                                        if scenario == "ordinary_nonzero" else None)))
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

    def test_public_fixture_retains_share_for_ordinary_nonzero_builder_removal(self):
        temporary, tier = self._run_failed_builder("ordinary_nonzero")
        with temporary:
            self.assertTrue((tier / "share").is_dir())

    def test_public_fixture_deletes_share_after_clean_builder_and_no_runtime(self):
        temporary, tier = self._run_failed_builder("clean")
        with temporary:
            self.assertFalse((tier / "share").exists())

class _FakeItem:
    def __init__(self, fixturenames): self.fixturenames=fixturenames; self.markers=[]; self.name="fake_item"
    def add_marker(self, marker): self.markers.append(marker)
    def get_closest_marker(self, name):
        return next((m for m in reversed(self.markers) if getattr(m,"name",None)==name),None)

class TestCollectionPolicy(unittest.TestCase):
    def _names(self, fixtures, expression="", markers=(), run_lifecycle=False):
        item = _FakeItem(fixtures)
        for marker in markers:
            item.add_marker(getattr(conftest.pytest.mark, marker))
        cfg = SimpleNamespace(option=SimpleNamespace(
            markexpr=expression, run_lifecycle=run_lifecycle))
        conftest.pytest_collection_modifyitems(cfg, [item])
        return [marker.name for marker in item.markers]

    def test_default_fixture_user_is_marked_and_skipped(self):
        names = self._names(["tier1_container"])
        self.assertIn("container", names)
        self.assertIn("skip", names)

    def test_unmarked_tier0_is_untouched(self):
        self.assertEqual(self._names([]), [])

    def test_exact_container_selection_admits_tier1(self):
        names = self._names(["tier1_container"], "container")
        self.assertIn("container", names)
        self.assertNotIn("skip", names)

    def test_arbitrary_marker_expressions_cannot_admit_tier1(self):
        for expression in ("foo", "not sandbox", "container or foo",
                           "container and foo", "(container)"):
            with self.subTest(expression=expression):
                self.assertIn("skip", self._names(
                    ["tier1_container"], expression))

    def test_integration_and_deprecated_sandbox_markers_are_never_host_admitted(self):
        for marker in ("integration", "sandbox"):
            with self.subTest(marker=marker):
                self.assertIn("skip", self._names([], marker, (marker,)))

class TestFixtureStatics(unittest.TestCase):
    def test_no_source_build_mutators_and_no_shared_setup_log(self):
        text=Path(conftest.__file__).read_text(); self.assertNotIn("_stage_fork_release",text); self.assertNotIn("npm run build",text); self.assertNotIn("tier1-session-setup.log",text); self.assertIn("--iidfile",text); self.assertIn("--cidfile",text)
    def test_explicit_plugin_root_no_host_home_and_no_broad_teardown(self):
        text=Path(conftest.__file__).read_text(); body=text[text.index("def tier1_container"):]; self.assertIn('"PRIME_AGENT_PLUGIN_ROOT": CONTAINER_PLUGIN_ROOT',body); self.assertNotIn('os.environ.get("HOME")',body); self.assertNotIn('env=os.environ',body); self.assertNotIn("prune",text); self.assertNotIn('"--all"',text)


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
    def test_public_fixture_retains_share_for_ordinary_nonzero_runtime_removal(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td).resolve(); results = tmp / "results"
            envf = tmp / "pinned.env"; envf.write_text("PRIME_AGENT_PINNED=0.9.8\n")
            calls = []
            image = {
                "id": IMAGE_ID, "repo_digests": [],
                "dockerfile": "docker/test.Dockerfile",
                "dockerfile_sha256": "d" * 64,
                "declared_input_sha256": "e" * 64,
                "declared_input_hash_contract": "framed-sha256-v2",
                "informational_tag": "prime-claw-test-tier1:eeeeeeeeeeee",
                "os": "linux", "architecture": "arm64",
                "build_started_at": "2026-10-04T00:00:00Z",
                "build_finished_at": "2026-10-04T00:00:01Z",
            }
            repository = {
                "head": "b" * 40, "dirty": False,
                "status_sha256": "a" * 64, "content_sha256": "c" * 64,
                "entry_count": 1, "content_hash_contract": "framed-sha256-v2",
            }
            artifact = {"kind": "vendor-binary", "version": "0.9.8",
                        "executable_sha256": "f" * 64}

            def stage(_repo, dest):
                Path(dest).mkdir(parents=True)
                return repository

            def host(args, **_kwargs):
                calls.append(args)
                if args == ["docker", "info"]:
                    return cp(args)
                if args[:3] == ["docker", "run", "-d"]:
                    Path(args[args.index("--cidfile") + 1]).write_text(CID + "\n")
                    return cp(args)
                if args == ["docker", "rm", "-f", CID]:
                    return cp(args, rc=1, err="removal denied")
                if args == ["docker", "inspect", CID]:
                    return cp(args, rc=1,
                              err="Error: No such container: " + CID)
                raise AssertionError(args)

            def container_run(self, *args, **_kwargs):
                return cp(args)

            patches = [
                mock.patch.dict(os.environ, {"TIER1_ENV_FILE": str(envf)}),
                mock.patch.object(conftest, "RESULTS", results),
                mock.patch.object(conftest.shutil, "which", return_value="/fake/docker"),
                mock.patch.object(conftest, "_host_command", side_effect=host),
                mock.patch.object(conftest, "_build_tier1_image", return_value=image),
                mock.patch.object(conftest, "_disconnect_container_networks",
                                  return_value="2026-10-04T00:00:02Z"),
                mock.patch.object(conftest, "_installed_package_identity",
                                  return_value=artifact),
                mock.patch.object(conftest.Tier1Container, "run", new=container_run),
                mock.patch.object(conftest.provenance, "stage_repository_snapshot",
                                  side_effect=stage),
            ]
            for patcher in patches:
                patcher.start()
            try:
                generator = conftest.tier1_container.__wrapped__(SimpleNamespace())
                self.assertEqual(next(generator).id, CID)
                with self.assertRaises(conftest.TeardownError):
                    next(generator)
            finally:
                for patcher in reversed(patches):
                    patcher.stop()

            self.assertIn(["docker", "rm", "-f", CID], calls)
            self.assertIn(["docker", "inspect", CID], calls)
            tier = next(results.glob("*/tier1"))
            self.assertTrue((tier / "share").is_dir())
            manifest = json.loads((tier / "manifest.json").read_text())
            conftest.provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"], "failed")
            self.assertEqual(manifest["teardown"]["state"], "absent")
            self.assertEqual(manifest["teardown"]["remove_outcome"],
                             "ordinary_nonzero")
            self.assertFalse(manifest["teardown"]["clean"])
    def test_malformed_final_source_receipt_cannot_bypass_cleanup_or_publication(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td).resolve(); results = tmp / "results"
            source = tmp / "source"; source.mkdir()
            envf = tmp / "source.env"
            envf.write_text(f"PRIME_AGENT_SOURCE={source}\n")
            calls = []
            image = {
                "id": IMAGE_ID, "repo_digests": [],
                "dockerfile": "docker/test.Dockerfile",
                "dockerfile_sha256": "d" * 64,
                "declared_input_sha256": "e" * 64,
                "declared_input_hash_contract": "framed-sha256-v2",
                "informational_tag": "prime-claw-test-tier1:eeeeeeeeeeee",
                "os": "linux", "architecture": "arm64",
                "build_started_at": "2026-10-04T00:00:00Z",
                "build_finished_at": "2026-10-04T00:00:01Z",
            }
            repository = {
                "head": "b" * 40, "dirty": False,
                "status_sha256": "a" * 64, "content_sha256": "c" * 64,
                "entry_count": 1, "content_hash_contract": "framed-sha256-v2",
            }
            artifact = {"kind": "vendor-binary", "version": "0.9.8",
                        "executable_sha256": "f" * 64}

            def stage(_repo, dest):
                Path(dest).mkdir(parents=True)
                return repository

            def build_source(_source, tier_cap, _tier_dir, _tier_binding,
                             share, _share_binding, _snapshot):
                artifacts = share / "source-release" / "artifacts"
                artifacts.mkdir(parents=True)
                tar_names = [
                    "prime-agent-0.9.8.tgz", "prime-agent-ai-0.9.8.tgz",
                    "prime-agent-core-0.9.8.tgz", "prime-agent-tui-0.9.8.tgz",
                ]
                tar_hashes = {}
                for name in tar_names:
                    data = name.encode()
                    (artifacts / name).write_bytes(data)
                    tar_hashes[name] = hashlib.sha256(data).hexdigest()
                (artifacts / "SHA256SUMS").write_text("".join(
                    f"{tar_hashes[name]}  {name}\n" for name in tar_names))
                (artifacts / "stable").write_text("v0.9.8\n")
                (artifacts / "latest.json").write_text('{"version":"0.9.8"}\n')
                rows = []
                for path in sorted(artifacts.iterdir(), key=lambda item: item.name):
                    path.chmod(0o644)
                    rows.append({
                        "path": f"artifacts/{path.name}", "kind": "file",
                        "mode": 0o644, "size": path.stat().st_size,
                        "content_sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                    })
                receipt = source_builder_receipt(state="absent", clean=True)
                receipt["status"] = "passed"
                receipt["failure_codes"] = []
                receipt["release"] = {
                    "schema_version": 1, "source": receipt["source"],
                    "source_rules": receipt["source_rules"],
                    "package_version": "0.9.8",
                    "pack_command_sha256": "9" * 64,
                    "artifact": next(row for row in rows if row["path"] ==
                                     "artifacts/prime-agent-0.9.8.tgz"),
                    "output_inventory": rows,
                    "output_inventory_sha256": conftest.provenance._framed_hash(
                        rows, domain="source-builder-output-v1"),
                }
                conftest.provenance.write_sanitized_json(
                    tier_cap, "source-build.json", receipt)
                return receipt

            def host(args, **_kwargs):
                calls.append(args)
                if args == ["docker", "info"]:
                    return cp(args)
                if args[:3] == ["docker", "run", "-d"]:
                    Path(args[args.index("--cidfile") + 1]).write_text(CID + "\n")
                    return cp(args)
                if args == ["docker", "rm", "-f", CID]:
                    return cp(args)
                if args == ["docker", "inspect", CID]:
                    return cp(args, rc=1,
                              err="Error: No such container: " + CID)
                raise AssertionError(args)

            def container_run(self, *args, **_kwargs):
                return cp(args)

            real_atomic = conftest.provenance.atomic_write_manifest
            with mock.patch.dict(os.environ, {"TIER1_ENV_FILE": str(envf)}), \
                    mock.patch.object(conftest, "RESULTS", results), \
                    mock.patch.object(conftest.shutil, "which", return_value="/fake/docker"), \
                    mock.patch.object(conftest, "_host_command", side_effect=host), \
                    mock.patch.object(conftest.provenance, "stage_repository_snapshot",
                                      side_effect=stage), \
                    mock.patch.object(conftest, "_build_source_release",
                                      side_effect=build_source), \
                    mock.patch.object(conftest, "_build_tier1_image", return_value=image), \
                    mock.patch.object(conftest, "_disconnect_container_networks",
                                      return_value="2026-10-04T00:00:02Z"), \
                    mock.patch.object(conftest, "_installed_package_identity",
                                      return_value=artifact), \
                    mock.patch.object(conftest.Tier1Container, "run", new=container_run), \
                    mock.patch.object(conftest.provenance, "atomic_write_manifest",
                                      wraps=real_atomic) as atomic:
                generator = conftest.tier1_container.__wrapped__(SimpleNamespace())
                container = next(generator)
                self.assertEqual(container.id, CID)
                tier = next(results.glob("*/tier1"))
                receipt_path = tier / "source-build.json"
                terminal_receipt = json.loads(receipt_path.read_text())
                terminal_receipt["status"] = []
                receipt_path.write_text(json.dumps(terminal_receipt) + "\n")
                with self.assertRaisesRegex(
                        RuntimeError, "terminal source builder receipt is invalid"):
                    next(generator)

            self.assertIn(["docker", "rm", "-f", CID], calls)
            self.assertIn(["docker", "inspect", CID], calls)
            self.assertGreaterEqual(atomic.call_count, 1)
            tier = next(results.glob("*/tier1"))
            self.assertTrue((tier / "share").is_dir())
            manifest = json.loads((tier / "manifest.json").read_text())
            conftest.provenance.validate_manifest(manifest)
            self.assertEqual(manifest["run"]["status"], "failed")
            self.assertIn("builder-receipt-invalid",
                          manifest["run"]["failure_codes"])
            self.assertIn("builder-teardown-command-failed",
                          manifest["run"]["failure_codes"])
            terminal_builder = manifest["prime_agent"]["builder"]["teardown"]
            self.assertEqual(terminal_builder["state"], "unknown")
            self.assertEqual(terminal_builder["remove_outcome"],
                             "identity_refused")
            self.assertFalse(terminal_builder["clean"])
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
