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


def test_platform_preflight_reuses_one_bounded_capability_allocation():
    spec = importlib.util.spec_from_file_location("specification_episode_fs_bounded_probe", HELPER); assert spec and spec.loader
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory() as temp:
        repo = Path(temp).resolve()/"repo"; common=repo/".git"; q=common/"prime-claw/quarantine"; a=common/"prime-claw/future-file-anchors"
        (repo/".ralph/plans/future").mkdir(parents=True); q.mkdir(parents=True); a.mkdir(parents=True)
        for _ in range(3): module.platform_preflight(str(repo),str(common),".ralph/plans/future/x",True,str(q),str(a))
        assert list(q.iterdir()) == []
        assert list(a.iterdir()) == []
        assert not any(p.name.startswith(".prime-claw-preflight-") for p in (repo/".ralph/plans/future").iterdir())
