"""Native macOS/Linux identity and restart coverage for R-WE-81."""
import hashlib
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
    for child in ["future-ownership-consumed", "indexes", "quarantine"]:
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
        for name, content in contents.items():
            created = call({"operation": "create-file", "repo": str(repo), "path": f"{target_rel}/{name}", "content": content, "directory_identity": directory})
            files.append({"name": name, "content": content, "identity": created["identity"], "retired_name": f"retired-{name}"})
        # A new helper process proves restart/continuation identity.
        snapshot = call({"operation": "snapshot-bundle", "repo": str(repo), "target_path": target_rel, "directory_identity": directory, "files": files})
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
        call({"operation": "platform-preflight", "repo": str(repo), "common_dir": str(common)})
        target_rel = ".ralph/plans/future/candidate"
        directory = call({"operation": "create-directory", "repo": str(repo), "path": target_rel})["identity"]
        content = "# Spec\n"
        created = call({"operation": "create-file", "repo": str(repo), "path": f"{target_rel}/SPECIFICATION.md", "content": content, "directory_identity": directory})
        target = repo / target_rel; original = target / "SPECIFICATION.md"
        original.rename(root / "owned-original")
        original.write_text(content)
        failed = call({"operation": "snapshot-bundle", "repo": str(repo), "target_path": target_rel, "directory_identity": directory, "files": [{"name": "SPECIFICATION.md", "content": content, "identity": created["identity"]}]}, ok=False)
        assert "entry set changed" in failed["error"] or "identity changed" in failed["error"]


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
