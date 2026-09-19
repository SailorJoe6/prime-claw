"""Native macOS/Linux identity and restart coverage for R-WE-81."""
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

REPO = Path(__file__).resolve().parents[1]
HELPER = REPO / ".prime/agent/helpers/specification-episode-fs.py"


def call(request, ok=True):
    result = subprocess.run([sys.executable, str(HELPER)], input=json.dumps(request), text=True, capture_output=True)
    payload = json.loads(result.stdout)
    if ok:
        assert result.returncode == 0, result.stdout + result.stderr
        assert payload["ok"] is True
    else:
        assert result.returncode != 0
        assert payload["ok"] is False
    return payload


def fixture(root: Path):
    repo = root / "repo"; common = repo / ".git"
    (repo / ".ralph/plans/future").mkdir(parents=True)
    for child in ["future-ownership-consumed", "future-file-anchors", "indexes", "quarantine"]:
        (common / "prime-claw" / child).mkdir(parents=True, exist_ok=True)
    return repo, common


def test_native_identity_survives_create_restart_and_retirement():
    with tempfile.TemporaryDirectory(prefix="prime-claw-native-identity-") as raw:
        root = Path(raw).resolve(); repo, common = fixture(root)
        preflight = call({"operation": "platform-preflight", "repo": str(repo), "common_dir": str(common)})
        identity = preflight["repo_identity"]
        assert identity["version"] == 2
        assert identity["platform"] in {"darwin", "linux"}
        assert identity["birthtime_ns"].isdigit()
        if identity["platform"] == "linux": assert identity["mount_id"].isdigit()
        target_rel = ".ralph/plans/future/candidate"
        directory = call({"operation": "create-directory", "repo": str(repo), "path": target_rel})["identity"]
        contents = {"SPECIFICATION.md": "# Spec\n", "REQUIREMENTS.md": "# Requirements\n", "DECISIONS.md": "# Decisions\n"}
        files = []
        anchor_parent = common / "prime-claw/future-file-anchors"
        anchor_parent_identity = call({"operation": "directory-identity", "path": str(anchor_parent)})["identity"]
        for name, content in contents.items():
            anchor_rel = f"prime-claw/future-file-anchors/disp.{name}"
            created = call({
                "operation": "create-file", "repo": str(repo), "common_dir": str(common),
                "common_identity": preflight["common_identity"], "path": f"{target_rel}/{name}",
                "content": content, "directory_identity": directory, "anchor_path": anchor_rel,
                "anchor_parent_identity": anchor_parent_identity,
            })
            files.append({
                "name": name, "content": content, "identity": created["identity"],
                "anchor_path": anchor_rel, "anchor_parent_identity": anchor_parent_identity,
                "anchor_identity": created["anchor_identity"], "retired_name": f"retired-{name}",
            })
        # New helper processes validate the protected allocations and retirement.
        snapshot = call({"operation": "snapshot-bundle", "repo": str(repo), "common_dir": str(common), "common_identity": preflight["common_identity"], "target_path": target_rel, "directory_identity": directory, "files": files})
        assert snapshot["directory_identity"] == directory
        evidence = b"tree evidence\n"; evidence_path = common / "prime-claw/indexes/disp.index"; evidence_path.write_bytes(evidence)
        evidence_read = call({"operation": "read-file", "root": str(common), "path": "prime-claw/indexes/disp.index"})
        removed = call({"operation": "remove-bundle", "repo": str(repo), "common_dir": str(common), "target_path": target_rel, "directory_identity": directory, "files": files, "consumed_name": "disp.json", "tombstone_text": "{}\n", "tree_evidence_name": "disp.index", "tree_evidence_retired_name": "retired-tree.index", "tree_evidence_sha256": hashlib.sha256(evidence).hexdigest(), "tree_evidence_identity": evidence_read["identity"]})
        assert removed["directory_retained"] is True
        assert list((repo / target_rel).iterdir()) == []
        assert len(removed["preserved_quarantines"]) == 4


def test_native_identity_rejects_same_byte_replacement_after_restart():
    with tempfile.TemporaryDirectory(prefix="prime-claw-native-replacement-") as raw:
        root = Path(raw).resolve(); repo, common = fixture(root)
        preflight = call({"operation": "platform-preflight", "repo": str(repo), "common_dir": str(common)})
        target_rel = ".ralph/plans/future/candidate"
        directory = call({"operation": "create-directory", "repo": str(repo), "path": target_rel})["identity"]
        content = "# Spec\n"; anchor_rel = "prime-claw/future-file-anchors/disp.SPECIFICATION.md"
        anchor_parent_identity = call({"operation": "directory-identity", "path": str(common / "prime-claw/future-file-anchors")})["identity"]
        created = call({"operation": "create-file", "repo": str(repo), "common_dir": str(common), "common_identity": preflight["common_identity"], "path": f"{target_rel}/SPECIFICATION.md", "content": content, "directory_identity": directory, "anchor_path": anchor_rel, "anchor_parent_identity": anchor_parent_identity})
        target = repo / target_rel; original = target / "SPECIFICATION.md"
        original.rename(root / "owned-original")
        original.write_text(content)
        failed = call({"operation": "snapshot-bundle", "repo": str(repo), "common_dir": str(common), "common_identity": preflight["common_identity"], "target_path": target_rel, "directory_identity": directory, "files": [{"name": "SPECIFICATION.md", "content": content, "identity": created["identity"], "anchor_path": anchor_rel, "anchor_parent_identity": anchor_parent_identity, "anchor_identity": created["anchor_identity"]}]}, ok=False)
        assert "protected allocation" in failed["error"] or "identity changed" in failed["error"]



def test_linux_anchor_prevents_recycled_allocation_authority_across_fresh_helpers():
    if not sys.platform.startswith("linux"):
        import pytest
        pytest.skip("native Linux allocation-reuse coverage")
    with tempfile.TemporaryDirectory(prefix="prime-claw-native-reuse-") as raw:
        root = Path(raw).resolve(); repo, common = fixture(root)
        preflight = call({"operation": "platform-preflight", "repo": str(repo), "common_dir": str(common), "target_path": ".ralph/plans/future/candidate", "quarantine_dir": str(common / "prime-claw/quarantine"), "anchor_dir": str(common / "prime-claw/future-file-anchors"), "require_retirement": True})
        target_rel = ".ralph/plans/future/candidate"
        directory = call({"operation": "create-directory", "repo": str(repo), "path": target_rel})["identity"]
        anchor_rel = "prime-claw/future-file-anchors/reuse.SPECIFICATION.md"
        anchor_parent_identity = call({"operation": "directory-identity", "path": str(common / "prime-claw/future-file-anchors")})["identity"]
        content = "# Spec\n"
        created = call({"operation": "create-file", "repo": str(repo), "common_dir": str(common), "common_identity": preflight["common_identity"], "path": f"{target_rel}/SPECIFICATION.md", "content": content, "directory_identity": directory, "anchor_path": anchor_rel, "anchor_parent_identity": anchor_parent_identity})
        public = repo / target_rel / "SPECIFICATION.md"
        public.unlink()
        collisions = []
        for _ in range(512):
            public.write_text(content)
            observed = call({"operation": "read-file", "root": str(repo), "path": f"{target_rel}/SPECIFICATION.md"})["identity"]
            if observed == created["identity"]: collisions.append(observed)
            public.unlink()
        assert collisions == [], "a live protected anchor must prevent allocation identity reuse"
        public.write_text(content)
        failed = call({"operation": "snapshot-bundle", "repo": str(repo), "common_dir": str(common), "common_identity": preflight["common_identity"], "target_path": target_rel, "directory_identity": directory, "files": [{"name": "SPECIFICATION.md", "content": content, "identity": created["identity"], "anchor_path": anchor_rel, "anchor_parent_identity": anchor_parent_identity, "anchor_identity": created["anchor_identity"]}]}, ok=False)
        assert "protected allocation" in failed["error"]

def test_native_control_replace_exchanges_and_retains_prior_incarnation():
    with tempfile.TemporaryDirectory(prefix="prime-claw-native-control-replace-") as raw:
        root = Path(raw).resolve(); repo, common = fixture(root)
        control = common / "prime-claw/state"; control.mkdir()
        rel = "prime-claw/state/record.json"
        call({"operation":"replace-json","root":str(common),"path":rel,"text":"{\"version\":1}\n","expected_identity":None})
        before = call({"operation":"read-file","root":str(common),"path":rel})
        call({"operation":"replace-json","root":str(common),"path":rel,"text":"{\"version\":2}\n","expected_identity":before["identity"]})
        after = call({"operation":"read-file","root":str(common),"path":rel})
        assert after["text"] == '{"version":2}\n' and after["identity"] != before["identity"]
        retained = list((common / "prime-claw/quarantine").iterdir())
        assert any(path.is_file() and path.read_text() == '{"version":1}\n' for path in retained)


def test_linux_without_statx_birthtime_is_rejected_before_mutation():
    import importlib.util
    import os
    spec = importlib.util.spec_from_file_location("specification_episode_fs_no_btime", HELPER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    class FakeLibc:
        def statx(self, fd, path, flags, mask, result):
            result._obj.mask = 0x100 | 0x1000
            result._obj.ino = os.fstat(fd).st_ino
            result._obj.mnt_id = 1
            return 0
    with tempfile.TemporaryDirectory(prefix="prime-claw-no-btime-") as raw:
        root = Path(raw).resolve(); repo, common = fixture(root)
        original_platform = module.sys.platform; original_cdll = module.ctypes.CDLL
        module.sys.platform = "linux"; module.ctypes.CDLL = lambda *args, **kwargs: FakeLibc()
        try:
            try: module.platform_preflight(str(repo), str(common))
            except RuntimeError as error: assert "birth time" in str(error)
            else: raise AssertionError("filesystem without statx birth time was accepted")
        finally:
            module.sys.platform = original_platform; module.ctypes.CDLL = original_cdll
        assert not (repo / ".ralph/plans/future/candidate").exists()
        assert not (common / "prime-claw/disposition-requests").exists()


def test_linux_cross_mount_retirement_topology_rejects_before_mutation():
    if not sys.platform.startswith("linux") or not Path("/dev/shm").is_dir():
        import pytest; pytest.skip("native Linux two-mount coverage")
    import os
    with tempfile.TemporaryDirectory(prefix="prime-claw-topology-repo-") as repo_raw, tempfile.TemporaryDirectory(prefix="prime-claw-topology-common-", dir="/dev/shm") as common_raw:
        repo = Path(repo_raw).resolve(); common = Path(common_raw).resolve()
        (repo / ".ralph/plans/future").mkdir(parents=True)
        repo_id = call({"operation": "directory-identity", "path": str(repo)})["identity"]
        common_id = call({"operation": "directory-identity", "path": str(common)})["identity"]
        if repo_id.get("mount_id") == common_id.get("mount_id"):
            import pytest; pytest.skip("fixture roots do not expose distinct mount IDs")
        quarantine = common / "prime-claw/quarantine"; anchors = common / "prime-claw/future-file-anchors"
        quarantine.mkdir(parents=True); anchors.mkdir(parents=True)
        failed = call({"operation": "platform-preflight", "repo": str(repo), "common_dir": str(common), "target_path": ".ralph/plans/future/candidate", "quarantine_dir": str(quarantine), "anchor_dir": str(anchors), "require_retirement": True}, ok=False)
        assert "not on one mount" in failed["error"]
        assert not (repo / ".ralph/plans/future/candidate").exists()
        assert list(quarantine.iterdir()) == [] and list(anchors.iterdir()) == []


def test_platform_preflight_rejects_filesystem_without_exclusive_rename_capability():
    spec = importlib.util.spec_from_file_location("specification_episode_fs_no_rename_capability", HELPER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp).resolve(); repo = root / "repo"; common = repo / ".git"; quarantine = common / "prime-claw/quarantine"; anchors = common / "prime-claw/future-file-anchors"
        (repo / ".ralph/plans/future").mkdir(parents=True); quarantine.mkdir(parents=True); anchors.mkdir(parents=True)
        real = module.rename_exclusive_between
        module.rename_exclusive_between = lambda *args, **kwargs: (_ for _ in ()).throw(RuntimeError("filesystem rejects exclusive rename"))
        try:
            try: module.platform_preflight(str(repo),str(common),".ralph/plans/future/x",True,str(quarantine),str(anchors))
            except RuntimeError as error: assert "filesystem rejects exclusive rename" in str(error)
            else: raise AssertionError("filesystem without exclusive rename was accepted")
        finally: module.rename_exclusive_between = real
        assert not (repo / ".ralph/plans/future/x").exists()


def test_platform_preflight_retains_one_bounded_capability_allocation_per_call():
    spec = importlib.util.spec_from_file_location("specification_episode_fs_bounded_probe", HELPER); assert spec and spec.loader
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory() as temp:
        repo = Path(temp).resolve()/"repo"; common=repo/".git"; q=common/"prime-claw/quarantine"; a=common/"prime-claw/future-file-anchors"; target=repo/".ralph/plans/future"
        target.mkdir(parents=True); q.mkdir(parents=True); a.mkdir(parents=True)
        results = [module.platform_preflight(str(repo),str(common),".ralph/plans/future/x",True,str(q),str(a)) for _ in range(3)]
        assert len(list(q.iterdir())) == 3
        assert len(list(a.iterdir())) == 3
        assert not any(p.name.startswith((".prime-claw-preflight-", "capability-probe-")) for p in target.iterdir())
        assert len({result["retained_probes"]["retired"] for result in results}) == 3
        assert len({result["retained_probes"]["anchor"] for result in results}) == 3
        assert {result["retained_probes"]["target_directory"] for result in results} == {None}


RETIREMENT_WORKER = REPO / "tests/helpers/specification_episode_retirement_worker.py"


def retirement_worker(request):
    payload = {"helper": str(HELPER), **request}
    return subprocess.run(
        [sys.executable, str(RETIREMENT_WORKER)],
        input=json.dumps(payload), text=True, capture_output=True,
    )


def persisted_barrier_trace(path: Path):
    return path.read_text().splitlines() if path.exists() else []


def product_retirement_fixture(root: Path):
    repo, common = fixture(root)
    target = repo / ".ralph/plans/future/candidate"
    target.mkdir()
    anchors = common / "prime-claw/future-file-anchors"
    quarantine = common / "prime-claw/quarantine"
    directory = call({"operation": "directory-identity", "path": str(target)})["identity"]
    anchor_parent_identity = call({"operation": "directory-identity", "path": str(anchors)})["identity"]
    content = "owned-content"
    created = call({
        "operation": "create-file", "repo": str(repo), "common_dir": str(common),
        "path": ".ralph/plans/future/candidate/SPECIFICATION.md", "content": content,
        "directory_identity": directory, "anchor_path": "prime-claw/future-file-anchors/spec",
        "anchor_parent_identity": anchor_parent_identity,
    })
    item = {
        "name": "SPECIFICATION.md", "content": content, "identity": created["identity"],
        "anchor_identity": created["anchor_identity"],
        "anchor_path": "prime-claw/future-file-anchors/spec",
        "anchor_parent_identity": anchor_parent_identity, "retired_name": "retired-spec",
    }
    base = {
        "kind": "product", "target": str(target), "quarantine": str(quarantine),
        "common": str(common), "item": item, "public_name": "SPECIFICATION.md",
        "retired_name": "retired-spec",
    }
    return target, quarantine, anchors, base


def test_product_retirement_reconciles_every_uncertain_post_rename_edge_in_fresh_process():
    for replacement in ("directory", "dirty-hardlink"):
        for fault_point in ("barrier-1", "barrier-2", "pre-validation"):
            with tempfile.TemporaryDirectory(prefix="prime-claw-retirement-restart-") as raw:
                target, quarantine, anchors, base = product_retirement_fixture(Path(raw).resolve())
                trace_path = Path(raw) / "retirement.trace"
                crashed = retirement_worker({
                    **base, "replacement": replacement, "substitute_before_rename": True,
                    "fault_point": fault_point, "trace_path": str(trace_path),
                })
                assert crashed.returncode in {71, 72, 73}, crashed.stdout + crashed.stderr
                expected_trace = ["public"] if fault_point == "barrier-1" else ["public", "quarantine"]
                assert persisted_barrier_trace(trace_path) == expected_trace
                assert not (target / "SPECIFICATION.md").exists()
                assert (quarantine / "retired-spec").exists()

                resumed = retirement_worker(base)
                assert resumed.returncode == 1, resumed.stdout + resumed.stderr
                detail = json.loads(resumed.stdout)
                assert "restored to public" in detail["error"]
                assert detail["barrier_trace"] == ["quarantine", "public"]
                assert (target / "SPECIFICATION.md").exists()
                assert not (quarantine / "retired-spec").exists()
                if replacement == "directory":
                    assert (target / "SPECIFICATION.md/sentinel").read_text() == "unowned-directory"
                    assert (target / "owned-original").read_text() == "owned-content"
                else:
                    assert (target / "SPECIFICATION.md").read_text() == "unowned-dirty"
                    assert (target / "dirty-link").read_text() == "unowned-dirty"
                    assert (anchors / "spec").read_text() == "unowned-dirty"

                replay = retirement_worker(base)
                assert replay.returncode == 1, replay.stdout + replay.stderr
                assert "public entry" in json.loads(replay.stdout)["error"]
                assert not (quarantine / "retired-spec").exists()


def test_product_restoration_barrier_crash_is_safe_on_next_fresh_process():
    for replacement in ("directory", "dirty-hardlink"):
        for fault_point, exit_code in (("barrier-1", 71), ("barrier-2", 72)):
            with tempfile.TemporaryDirectory(prefix="prime-claw-restoration-restart-") as raw:
                target, quarantine, _, base = product_retirement_fixture(Path(raw).resolve())
                crashed = retirement_worker({
                    **base, "replacement": replacement, "substitute_before_rename": True,
                    "fault_point": "barrier-1",
                })
                assert crashed.returncode == 71
                trace_path = Path(raw) / "restoration.trace"
                restore_crashed = retirement_worker({
                    **base, "fault_stage": "restore", "fault_point": fault_point,
                    "trace_path": str(trace_path),
                })
                assert restore_crashed.returncode == exit_code, restore_crashed.stdout + restore_crashed.stderr
                expected_trace = ["quarantine"] if fault_point == "barrier-1" else ["quarantine", "public"]
                assert persisted_barrier_trace(trace_path) == expected_trace
                assert (target / "SPECIFICATION.md").exists()
                assert not (quarantine / "retired-spec").exists()
                replay = retirement_worker(base)
                assert replay.returncode == 1
                replay_detail = json.loads(replay.stdout)
                assert "public entry" in replay_detail["error"]
                assert replay_detail["barrier_trace"] == ["quarantine", "public"]


def test_product_retirement_conflict_preserves_and_reports_both_exact_locations():
    with tempfile.TemporaryDirectory(prefix="prime-claw-retirement-conflict-") as raw:
        target, quarantine, _, base = product_retirement_fixture(Path(raw).resolve())
        crashed = retirement_worker({
            **base, "replacement": "directory", "substitute_before_rename": True,
            "fault_point": "barrier-1",
        })
        assert crashed.returncode == 71
        (target / "SPECIFICATION.md").write_text("late-public")
        resumed = retirement_worker(base)
        assert resumed.returncode == 1
        error = json.loads(resumed.stdout)["error"]
        assert "preserved public SPECIFICATION.md and quarantine retired-spec" in error
        assert (target / "SPECIFICATION.md").read_text() == "late-public"
        assert (quarantine / "retired-spec/sentinel").read_text() == "unowned-directory"


def control_retirement_fixture(root: Path):
    control = root / "prime-claw/state"; quarantine = root / "prime-claw/quarantine"
    control.mkdir(parents=True); quarantine.mkdir(parents=True)
    rel = "prime-claw/state/blocker.json"; text = '{"blocked":true}\n'
    call({"operation": "replace-json", "root": str(root), "path": rel, "text": text, "expected_identity": None})
    observed = call({"operation": "read-file", "root": str(root), "path": rel})
    base = {
        "kind": "control", "root": str(root), "rel": rel,
        "sha256": hashlib.sha256(text.encode()).hexdigest(), "identity": observed["identity"],
        "public_name": "blocker.json", "retired_name": "retired-blocker",
    }
    return control, quarantine, base


def test_control_retirement_reconciles_uncertain_barrier_in_fresh_process():
    for replacement in ("directory", "dirty-hardlink"):
        for fault_point, exit_code in (("barrier-1", 71), ("barrier-2", 72), ("pre-validation", 73)):
            with tempfile.TemporaryDirectory(prefix="prime-claw-control-retirement-") as raw:
                control, quarantine, base = control_retirement_fixture(Path(raw).resolve())
                trace_path = Path(raw) / "retirement.trace"
                crashed = retirement_worker({
                    **base, "replacement": replacement, "substitute_before_rename": True,
                    "fault_point": fault_point, "trace_path": str(trace_path),
                })
                assert crashed.returncode == exit_code, crashed.stdout + crashed.stderr
                expected_trace = ["public"] if fault_point == "barrier-1" else ["public", "quarantine"]
                assert persisted_barrier_trace(trace_path) == expected_trace
                assert not (control / "blocker.json").exists()
                assert (quarantine / "retired-blocker").exists()
                resumed = retirement_worker(base)
                assert resumed.returncode == 1, resumed.stdout + resumed.stderr
                resumed_detail = json.loads(resumed.stdout)
                assert "restored to public" in resumed_detail["error"]
                assert resumed_detail["barrier_trace"] == ["quarantine", "public"]
                if replacement == "directory":
                    assert (control / "blocker.json/sentinel").read_text() == "unowned-directory"
                else:
                    assert (control / "blocker.json").read_text() == "unowned-dirty"
                    assert (control / "dirty-link").read_text() == "unowned-dirty"
                assert not (quarantine / "retired-blocker").exists()
                replay = retirement_worker(base)
                assert replay.returncode == 1
                replay_detail = json.loads(replay.stdout)
                assert "public control state" in replay_detail["error"]
                assert replay_detail["barrier_trace"] == ["quarantine", "public"]


def test_control_restoration_barriers_resume_in_order_for_all_replacements():
    for replacement in ("directory", "dirty-hardlink"):
        for fault_point, exit_code in (("barrier-1", 71), ("barrier-2", 72)):
            with tempfile.TemporaryDirectory(prefix="prime-claw-control-restore-") as raw:
                control, quarantine, base = control_retirement_fixture(Path(raw).resolve())
                assert retirement_worker({
                    **base, "replacement": replacement, "substitute_before_rename": True,
                    "fault_point": "barrier-1",
                }).returncode == 71
                trace_path = Path(raw) / "restoration.trace"
                restore_crashed = retirement_worker({
                    **base, "fault_stage": "restore", "fault_point": fault_point,
                    "trace_path": str(trace_path),
                })
                assert restore_crashed.returncode == exit_code
                expected_trace = ["quarantine"] if fault_point == "barrier-1" else ["quarantine", "public"]
                assert persisted_barrier_trace(trace_path) == expected_trace
                assert (control / "blocker.json").exists() and not (quarantine / "retired-blocker").exists()
                replay = retirement_worker(base)
                assert replay.returncode == 1
                assert json.loads(replay.stdout)["barrier_trace"] == ["quarantine", "public"]


def test_control_exact_retirement_preserves_new_canonical_record_after_response_loss():
    with tempfile.TemporaryDirectory(prefix="prime-claw-control-response-loss-") as raw:
        control, quarantine, base = control_retirement_fixture(Path(raw).resolve())
        crashed = retirement_worker({**base, "fault_point": "barrier-1"})
        assert crashed.returncode == 71
        (control / "blocker.json").write_text("new canonical blocker\n")
        resumed = retirement_worker(base)
        assert resumed.returncode == 0, resumed.stdout + resumed.stderr
        detail = json.loads(resumed.stdout)
        assert detail["result"]["canonical_replacement"] == "prime-claw/state/blocker.json"
        assert detail["barrier_trace"] == ["public", "quarantine"]
        assert (control / "blocker.json").read_text() == "new canonical blocker\n"
        assert (quarantine / "retired-blocker").read_text() == '{"blocked":true}\n'


def test_exact_owned_retirement_completes_from_fresh_process_after_barrier_crash():
    for fault_point, exit_code in (("barrier-1", 71), ("barrier-2", 72), ("pre-validation", 73)):
        with tempfile.TemporaryDirectory(prefix="prime-claw-owned-retirement-restart-") as raw:
            target, quarantine, _, base = product_retirement_fixture(Path(raw).resolve())
            crashed = retirement_worker({**base, "fault_point": fault_point})
            assert crashed.returncode == exit_code, crashed.stdout + crashed.stderr
            assert not (target / "SPECIFICATION.md").exists()
            assert (quarantine / "retired-spec").read_text() == "owned-content"
            resumed = retirement_worker(base)
            assert resumed.returncode == 0, resumed.stdout + resumed.stderr
            result = json.loads(resumed.stdout)
            assert result["ok"] is True and result["result"] == "retired-spec"
            assert result["barrier_trace"] == ["public", "quarantine"]
            assert not (target / "SPECIFICATION.md").exists()
            assert (quarantine / "retired-spec").read_text() == "owned-content"


def evidence_retirement_fixture(root: Path):
    source = root / "indexes"; quarantine = root / "quarantine"
    source.mkdir(); quarantine.mkdir()
    public = source / "tree.index"; content = b"tree-evidence\n"; public.write_bytes(content)
    observed = call({"operation": "read-file", "root": str(root), "path": "indexes/tree.index"})
    base = {
        "kind": "evidence", "source": str(source), "quarantine": str(quarantine),
        "public_name": "tree.index", "retired_name": "retired-tree.index",
        "identity": observed["identity"], "sha256": hashlib.sha256(content).hexdigest(),
    }
    return source, quarantine, base


def test_tree_evidence_retirement_reconciles_all_uncertain_edges_in_fresh_process():
    for replacement in ("directory", "dirty-hardlink"):
        for fault_point, exit_code in (("barrier-1", 71), ("barrier-2", 72), ("pre-validation", 73)):
            with tempfile.TemporaryDirectory(prefix="prime-claw-evidence-retirement-") as raw:
                source, quarantine, base = evidence_retirement_fixture(Path(raw).resolve())
                trace_path = Path(raw) / "retirement.trace"
                crashed = retirement_worker({
                    **base, "replacement": replacement, "substitute_before_rename": True,
                    "fault_point": fault_point, "trace_path": str(trace_path),
                })
                assert crashed.returncode == exit_code, crashed.stdout + crashed.stderr
                expected_trace = ["public"] if fault_point == "barrier-1" else ["public", "quarantine"]
                assert persisted_barrier_trace(trace_path) == expected_trace
                assert not (source / "tree.index").exists()
                assert (quarantine / "retired-tree.index").exists()
                resumed = retirement_worker(base)
                assert resumed.returncode == 1, resumed.stdout + resumed.stderr
                detail = json.loads(resumed.stdout)
                assert "restored to public" in detail["error"]
                assert detail["barrier_trace"] == ["quarantine", "public"]
                assert (source / "tree.index").exists()
                assert not (quarantine / "retired-tree.index").exists()


def test_tree_evidence_restoration_barriers_resume_in_source_destination_order():
    for replacement in ("directory", "dirty-hardlink"):
        for fault_point, exit_code in (("barrier-1", 71), ("barrier-2", 72)):
            with tempfile.TemporaryDirectory(prefix="prime-claw-evidence-restore-") as raw:
                source, quarantine, base = evidence_retirement_fixture(Path(raw).resolve())
                assert retirement_worker({
                    **base, "replacement": replacement, "substitute_before_rename": True,
                    "fault_point": "barrier-1",
                }).returncode == 71
                trace_path = Path(raw) / "restoration.trace"
                restore_crashed = retirement_worker({
                    **base, "fault_stage": "restore", "fault_point": fault_point,
                    "trace_path": str(trace_path),
                })
                assert restore_crashed.returncode == exit_code
                expected_trace = ["quarantine"] if fault_point == "barrier-1" else ["quarantine", "public"]
                assert persisted_barrier_trace(trace_path) == expected_trace
                assert (source / "tree.index").exists() and not (quarantine / "retired-tree.index").exists()
                replay = retirement_worker(base)
                assert replay.returncode == 1
                assert json.loads(replay.stdout)["barrier_trace"] == ["quarantine", "public"]



def test_control_and_tree_invalid_retirement_conflicts_preserve_both_locations():
    with tempfile.TemporaryDirectory(prefix="prime-claw-control-conflict-") as raw:
        control, quarantine, base = control_retirement_fixture(Path(raw).resolve())
        assert retirement_worker({
            **base, "replacement": "directory", "substitute_before_rename": True,
            "fault_point": "barrier-1",
        }).returncode == 71
        (control / "blocker.json").write_text("late-control")
        resumed = retirement_worker(base)
        assert resumed.returncode == 1
        assert "conflict preserved public" in json.loads(resumed.stdout)["error"]
        assert (control / "blocker.json").read_text() == "late-control"
        assert (quarantine / "retired-blocker/sentinel").read_text() == "unowned-directory"

    with tempfile.TemporaryDirectory(prefix="prime-claw-evidence-conflict-") as raw:
        source, quarantine, base = evidence_retirement_fixture(Path(raw).resolve())
        assert retirement_worker({
            **base, "replacement": "directory", "substitute_before_rename": True,
            "fault_point": "barrier-1",
        }).returncode == 71
        (source / "tree.index").write_text("late-evidence")
        resumed = retirement_worker(base)
        assert resumed.returncode == 1
        assert "conflict preserved public" in json.loads(resumed.stdout)["error"]
        assert (source / "tree.index").read_text() == "late-evidence"
        assert (quarantine / "retired-tree.index/sentinel").read_text() == "unowned-directory"
