"""Acceptance bridge for specification commands and future-incubation automation."""

import hashlib
import importlib.util
import json
import os
import re
from pathlib import Path
import shutil
import subprocess
import tempfile


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / ".prime" / "agent" / "extensions" / "specification-episodes.ts"
NODE_SUITE = REPO / "tests" / "specification_episodes_extension.test.mjs"
ASTRA_SUITE = REPO / "tests" / "specification_episodes_astra_regressions.test.mjs"


def _load_fs_helper(name: str):
    helper = REPO / ".prime" / "agent" / "helpers" / "specification-episode-fs.py"
    spec = importlib.util.spec_from_file_location(name, helper)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _fd_identity(module, path: Path, directory: bool = False):
    flags = os.O_RDONLY | (getattr(os, "O_DIRECTORY", 0) if directory else 0)
    fd = os.open(path, flags)
    try:
        return module.identity_fd(fd)
    finally:
        os.close(fd)


def test_directory_creation_rejects_a_post_publication_replacement():
    module = _load_fs_helper("specification_episode_fs")
    with tempfile.TemporaryDirectory(prefix="prime-claw-directory-creation-") as raw_root:
        root = Path(raw_root).resolve()
        original_rename = module.rename_exclusive

        def replace_after_publication(parent_fd, source, target):
            original_rename(parent_fd, source, target)
            os.rename(target, "moved-created-object", src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
            os.mkdir(target, 0o700, dir_fd=parent_fd)

        module.rename_exclusive = replace_after_publication
        try:
            try:
                module.create_product_directory(str(root), "target")
            except RuntimeError as error:
                assert "incarnation changed" in str(error)
            else:
                raise AssertionError("post-publication replacement was adopted")
        finally:
            module.rename_exclusive = original_rename
        assert (root / "moved-created-object").is_dir()
        assert (root / "target").is_dir()


def test_astra_10_product_retirement_has_no_final_unlink_and_preserves_objects():
    module = _load_fs_helper("specification_episode_fs_product")
    with tempfile.TemporaryDirectory(prefix="prime-claw-product-removal-") as raw_root:
        root = Path(raw_root).resolve()
        repo = root / "repo"
        common = repo / ".git"
        target = repo / ".ralph/plans/future/candidate"
        consumed = common / "prime-claw/future-ownership-consumed"
        indexes = common / "prime-claw/indexes"
        for directory in (target, consumed, indexes):
            directory.mkdir(parents=True, exist_ok=True)
        contents = {"SPECIFICATION.md": "# Spec\n", "REQUIREMENTS.md": "# Requirements\n", "DECISIONS.md": "# Decisions\n"}
        files = []
        original_inodes = {}
        for name, content in contents.items():
            path = target / name
            path.write_text(content)
            original_inodes[name] = path.stat().st_ino
            files.append({"name": name, "content": content, "identity": _fd_identity(module, path), "retired_name": f"retired-{name}"})
        index_bytes = b"construction evidence\n"
        tree_evidence_name = "disp-test.index"
        (indexes / tree_evidence_name).write_bytes(index_bytes)
        original_unlink = module.os.unlink
        module.os.unlink = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("retirement must not unlink"))
        try:
            result = module.remove_bundle({
                "repo": str(repo), "common_dir": str(common),
                "target_path": ".ralph/plans/future/candidate",
                "directory_identity": _fd_identity(module, target, True), "files": files,
                "consumed_name": "disp-test.json", "tombstone_text": '{"consumed":true}\n',
                "tree_evidence_name": tree_evidence_name, "tree_evidence_retired_name": "retired-tree.index", "tree_evidence_sha256": hashlib.sha256(index_bytes).hexdigest(),
                "tree_evidence_identity": _fd_identity(module, indexes / tree_evidence_name),
            })
        finally:
            module.os.unlink = original_unlink
        assert list(target.iterdir()) == []
        quarantine = common / "prime-claw/quarantine"
        retained = list(quarantine.iterdir())
        assert len(result["preserved_quarantines"]) == 4
        for name, inode in original_inodes.items():
            assert any(path.stat().st_ino == inode and path.read_text() == contents[name] for path in retained)
        assert (consumed / "disp-test.json").exists()


def test_astra_10_partial_retirement_resumes_from_exact_consumed_manifest():
    module = _load_fs_helper("specification_episode_fs_resume")
    with tempfile.TemporaryDirectory(prefix="prime-claw-product-resume-") as raw_root:
        root = Path(raw_root).resolve(); repo = root / "repo"; common = repo / ".git"
        target = repo / ".ralph/plans/future/candidate"; consumed = common / "prime-claw/future-ownership-consumed"; indexes = common / "prime-claw/indexes"
        for directory in (target, consumed, indexes): directory.mkdir(parents=True, exist_ok=True)
        contents = {"SPECIFICATION.md":"# Spec\n", "REQUIREMENTS.md":"# Req\n", "DECISIONS.md":"# Dec\n"}
        files = []
        for name, content in contents.items():
            path = target / name; path.write_text(content)
            files.append({"name":name,"content":content,"identity":_fd_identity(module,path),"retired_name":f"retired-{name}"})
        evidence = b"tree\n"; evidence_path = indexes / "disp.index"; evidence_path.write_bytes(evidence)
        data = {"repo":str(repo),"common_dir":str(common),"target_path":".ralph/plans/future/candidate","directory_identity":_fd_identity(module,target,True),"files":files,"consumed_name":"disp.json","tombstone_text":"{\"manifest\":true}\n","tree_evidence_name":"disp.index","tree_evidence_retired_name":"retired-tree.index","tree_evidence_sha256":hashlib.sha256(evidence).hexdigest(),"tree_evidence_identity":_fd_identity(module,evidence_path)}
        original = module.preserve_entry_named; calls = 0
        def interrupt(source_fd, name, quarantine_fd, destination):
            nonlocal calls
            calls += 1
            if calls == 2: raise OSError("injected partial retirement")
            return original(source_fd,name,quarantine_fd,destination)
        module.preserve_entry_named = interrupt
        try:
            try: module.remove_bundle(data)
            except OSError as error: assert "injected partial" in str(error)
            else: raise AssertionError("partial retirement unexpectedly completed")
        finally: module.preserve_entry_named = original
        assert (consumed / "disp.json").exists() and not (target / "SPECIFICATION.md").exists()
        resumed = module.remove_bundle(data)
        assert resumed["retirement_complete"] is True and resumed["consumed_created"] is False
        assert all(not (target / name).exists() for name in contents)
        assert not evidence_path.exists()


def test_astra_10_product_restore_is_atomic_no_clobber():
    module = _load_fs_helper("specification_episode_fs_restore")
    with tempfile.TemporaryDirectory(prefix="prime-claw-product-restore-") as raw_root:
        root = Path(raw_root).resolve()
        repo = root / "repo"; common = repo / ".git"; target = repo / ".ralph/plans/future/candidate"
        consumed = common / "prime-claw/future-ownership-consumed"; indexes = common / "prime-claw/indexes"
        for directory in (target, consumed, indexes): directory.mkdir(parents=True, exist_ok=True)
        contents = {"SPECIFICATION.md": "# Spec\n", "REQUIREMENTS.md": "# Requirements\n", "DECISIONS.md": "# Decisions\n"}
        files = []
        for name, content in contents.items():
            path = target / name; path.write_text(content)
            files.append({"name": name, "content": content, "identity": _fd_identity(module, path), "retired_name": f"retired-{name}"})
        index_bytes = b"evidence\n"; (indexes / "disp.index").write_bytes(index_bytes)
        original_preserve = module.preserve_entry_named
        injected = False
        def replace_after_retire(source_fd, source, quarantine_fd, destination):
            nonlocal injected
            retired = original_preserve(source_fd, source, quarantine_fd, destination)
            if not injected and source == "SPECIFICATION.md":
                injected = True
                os.rename(retired, f"{retired}-owned", src_dir_fd=quarantine_fd, dst_dir_fd=quarantine_fd)
                qfd = os.open(retired, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=quarantine_fd)
                os.write(qfd, b"replacement in quarantine\n"); os.close(qfd)
                dfd = os.open(source, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=source_fd)
                os.write(dfd, b"concurrent destination\n"); os.close(dfd)
            return retired
        module.preserve_entry_named = replace_after_retire
        try:
            try:
                module.remove_bundle({
                    "repo": str(repo), "common_dir": str(common), "target_path": ".ralph/plans/future/candidate",
                    "directory_identity": _fd_identity(module, target, True), "files": files,
                    "consumed_name": "disp.json", "tombstone_text": "{}\n", "tree_evidence_name": "disp.index",
                    "tree_evidence_retired_name": "retired-tree.index", "tree_evidence_sha256": hashlib.sha256(index_bytes).hexdigest(),
                    "tree_evidence_identity": _fd_identity(module, indexes / "disp.index"),
                })
            except RuntimeError as error:
                assert "identity mismatch" in str(error)
            else:
                raise AssertionError("retirement mismatch unexpectedly succeeded")
        finally:
            module.preserve_entry_named = original_preserve
        assert injected
        assert (target / "SPECIFICATION.md").read_bytes() == b"concurrent destination\n"
        quarantine = common / "prime-claw/quarantine"
        assert any(path.read_bytes() == b"replacement in quarantine\n" for path in quarantine.iterdir() if path.is_file())
        assert any(path.read_text() == contents["SPECIFICATION.md"] for path in quarantine.iterdir() if path.is_file())


def test_astra_10_control_restore_is_atomic_no_clobber():
    module = _load_fs_helper("specification_episode_fs_control")
    with tempfile.TemporaryDirectory(prefix="prime-claw-control-removal-") as raw_root:
        root = Path(raw_root).resolve(); control = root / "control"; control.mkdir()
        leaf = control / "state.json"; original = b'{"owned":true}\n'; leaf.write_bytes(original)
        original_preserve = module.preserve_entry
        injected = False
        def replace_after_retire(source_fd, source, quarantine_fd, prefix):
            nonlocal injected
            retired = original_preserve(source_fd, source, quarantine_fd, prefix)
            if source == "state.json":
                injected = True
                os.rename(retired, f"{retired}-owned", src_dir_fd=quarantine_fd, dst_dir_fd=quarantine_fd)
                qfd = os.open(retired, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=quarantine_fd); os.write(qfd, b"replacement\n"); os.close(qfd)
                dfd = os.open(source, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=source_fd); os.write(dfd, b"concurrent destination\n"); os.close(dfd)
            return retired
        module.preserve_entry = replace_after_retire
        try:
            try: module.remove_control(str(root), "control/state.json", hashlib.sha256(original).hexdigest(), _fd_identity(module, leaf))
            except RuntimeError as error: assert "no-clobber" in str(error)
            else: raise AssertionError("control mismatch unexpectedly succeeded")
        finally: module.preserve_entry = original_preserve
        assert injected and leaf.read_bytes() == b"concurrent destination\n"
        quarantine = root / "prime-claw/quarantine"
        assert any(path.read_bytes() == original for path in quarantine.iterdir() if path.is_file())
        assert any(path.read_bytes() == b"replacement\n" for path in quarantine.iterdir() if path.is_file())


def test_astra_10_control_replace_exchanges_and_retains_prior_object_without_unlink():
    module = _load_fs_helper("specification_episode_fs_control_replace")
    with tempfile.TemporaryDirectory(prefix="prime-claw-control-replace-") as raw_root:
        root = Path(raw_root).resolve(); control = root / "control"; control.mkdir()
        leaf = control / "state.json"; leaf.write_text('{"old":true}\n')
        old_inode = leaf.stat().st_ino
        original_unlink = module.os.unlink
        module.os.unlink = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("replace must not unlink"))
        try:
            result = module.durable_json(str(root), "control/state.json", '{"new":true}\n', False, _fd_identity(module, leaf))
        finally:
            module.os.unlink = original_unlink
        assert result["created"] is True
        assert leaf.read_text() == '{"new":true}\n'
        quarantine = root / "prime-claw/quarantine"
        retained = [path for path in quarantine.iterdir() if path.is_file() and path.stat().st_ino == old_inode]
        assert len(retained) == 1 and retained[0].read_text() == '{"old":true}\n'


def test_astra_10_control_replace_detects_raced_incarnation_and_preserves_all_objects():
    module = _load_fs_helper("specification_episode_fs_control_replace_race")
    with tempfile.TemporaryDirectory(prefix="prime-claw-control-replace-race-") as raw_root:
        root = Path(raw_root).resolve(); control = root / "control"; control.mkdir()
        leaf = control / "state.json"; leaf.write_text('{"old":true}\n')
        expected = _fd_identity(module, leaf); original_exchange = module.rename_exchange; injected = False
        def replace_before_exchange(parent_fd, left, right):
            nonlocal injected
            injected = True
            os.rename(right, "saved-original.json", src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
            fd = os.open(right, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=parent_fd)
            os.write(fd, b'{"replacement":true}\n'); os.close(fd)
            return original_exchange(parent_fd, left, right)
        module.rename_exchange = replace_before_exchange
        try:
            try: module.durable_json(str(root), "control/state.json", '{"new":true}\n', False, expected)
            except RuntimeError as error: assert "incarnation changed" in str(error)
            else: raise AssertionError("raced control replacement unexpectedly succeeded")
        finally: module.rename_exchange = original_exchange
        assert injected and (control / "saved-original.json").read_text() == '{"old":true}\n'
        all_bytes = [path.read_bytes() for path in control.iterdir() if path.is_file()]
        assert b'{"new":true}\n' in all_bytes and b'{"replacement":true}\n' in all_bytes


def test_astra_11_postpublication_lock_failure_retires_exact_canonical_lock():
    module = _load_fs_helper("specification_episode_fs_lock_postpublish")
    with tempfile.TemporaryDirectory(prefix="prime-claw-lock-postpublish-") as raw_root:
        root = Path(raw_root).resolve(); locks = root / "prime-claw/locks"; locks.mkdir(parents=True)
        real_fsync = module.os.fsync; calls = 0
        def fail_parent_fsync(fd):
            nonlocal calls
            calls += 1
            if calls == 3: raise OSError("injected post-publication fsync failure")
            return real_fsync(fd)
        module.os.fsync = fail_parent_fsync
        try:
            try: module.acquire_lock(str(root), "prime-claw/locks/project.lock", '{"token":"owned"}\n')
            except OSError as error: assert "injected post-publication" in str(error)
            else: raise AssertionError("post-publication failure unexpectedly succeeded")
        finally: module.os.fsync = real_fsync
        assert not (locks / "project.lock").exists()
        quarantine = root / "prime-claw/quarantine"
        retained = [path for path in quarantine.iterdir() if path.is_dir()]
        assert len(retained) == 1 and (retained[0] / "owner.json").read_text() == '{"token":"owned"}\n'


def test_astra_11_failure_opening_published_lock_still_retires_it():
    module = _load_fs_helper("specification_episode_fs_lock_open_failure")
    with tempfile.TemporaryDirectory(prefix="prime-claw-lock-open-failure-") as raw_root:
        root = Path(raw_root).resolve(); locks = root / "prime-claw/locks"; locks.mkdir(parents=True)
        real_open = module.os.open; injected = False
        def fail_first_published_open(path, flags, *args, **kwargs):
            nonlocal injected
            if path == "project.lock" and not injected:
                injected = True; raise OSError("injected published lock open failure")
            return real_open(path, flags, *args, **kwargs)
        module.os.open = fail_first_published_open
        try:
            try: module.acquire_lock(str(root), "prime-claw/locks/project.lock", '{"token":"owned"}\n')
            except OSError as error: assert "published lock open" in str(error)
            else: raise AssertionError("published-open failure unexpectedly succeeded")
        finally: module.os.open = real_open
        assert injected and not (locks / "project.lock").exists()
        retained = [path for path in (root / "prime-claw/quarantine").iterdir() if path.is_dir()]
        assert len(retained) == 1 and (retained[0] / "owner.json").read_text() == '{"token":"owned"}\n'


def test_astra_11_control_mkdir_stays_bound_to_held_parent():
    module = _load_fs_helper("specification_episode_fs_control_mkdir")
    with tempfile.TemporaryDirectory(prefix="prime-claw-control-mkdir-") as raw_root:
        root = Path(raw_root).resolve(); control = root / "prime-claw"; outside = root / "outside"; saved = root / "saved-control"
        control.mkdir(); outside.mkdir()
        original_mkdir = module.os.mkdir
        injected = False
        def swap_parent_before_child(path, mode=0o777, *, dir_fd=None):
            nonlocal injected
            if path == "indexes" and not injected:
                injected = True
                os.rename(control, saved)
                os.symlink(outside, control, target_is_directory=True)
            return original_mkdir(path, mode, dir_fd=dir_fd)
        module.os.mkdir = swap_parent_before_child
        try:
            result = module.ensure_directory(str(root), "prime-claw/indexes")
        finally:
            module.os.mkdir = original_mkdir
        assert injected and result["identity"]["version"] == 2
        assert (saved / "indexes").is_dir()
        assert not (outside / "indexes").exists()


def test_specification_episodes_node_suite():
    node = shutil.which("node")
    assert node, "Node.js is required because prime-agent itself requires Node >=22.8"
    result = subprocess.run(
        [node, "--experimental-strip-types", "--test", str(NODE_SUITE)],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_specification_episodes_astra_regressions():
    node = shutil.which("node")
    assert node, "Node.js is required because prime-agent itself requires Node >=22.8"
    result = subprocess.run(
        [node, "--experimental-strip-types", "--test", str(ASTRA_SUITE)],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_prime_agent_rpc_loads_native_commands():
    prime_agent = shutil.which("prime-agent")
    assert prime_agent, "prime-agent is a documented developer prerequisite"
    request = json.dumps({"id": "loader", "type": "get_commands"}) + "\n"
    with tempfile.TemporaryDirectory(prefix="prime-claw-specification-loader-") as cwd:
        result = subprocess.run(
            [
                prime_agent,
                "--mode", "rpc",
                "--offline",
                "--no-session",
                "--no-skills",
                "--no-prompt-templates",
                "--no-context-files",
                "--no-extensions",
                "--cwd", cwd,
                "-e", str(EXTENSION),
            ],
            cwd=REPO,
            input=request,
            text=True,
            capture_output=True,
            timeout=30,
            check=False,
        )
    assert result.returncode == 0, result.stdout + result.stderr
    response = json.loads(result.stdout.strip().splitlines()[-1])
    assert response["success"] is True
    commands = {
        command["name"]: command for command in response["data"]["commands"]
        if command["name"] in {"design", "spec-it-out"}
    }
    assert set(commands) == {"design", "spec-it-out"}
    assert all(Path(command["sourceInfo"]["path"]).resolve() == EXTENSION.resolve() for command in commands.values())


def test_canonical_skills_define_interview_then_explicit_bridge():
    for name in ("design", "spec-it-out"):
        skill = (REPO / ".ralph" / "skills" / name / "SKILL.md").read_text()
        assert re.search(r"one\s+at\s+a\s+time", skill)
        assert "all material" in skill
        assert "future" in skill
        assert "episode" in skill
        assert "<operator-specification-context>" in skill
        assert "never\nselects a workflow, file, disposition, or host action" in skill
        assert "spec_disposition" in skill
        assert "exactly once" in skill
        assert "Do not run Git" in skill


def test_slice1_requirements_are_traced_without_overclaiming_later_mutations():
    inventory = json.loads((REPO / "config" / "requirements-inventory.json").read_text())
    entries = {item["id"]: item for item in inventory["requirements"]}
    expected = {"R-WE-5", "R-WE-7", "R-WE-8", "R-WE-9", "R-WE-34"}
    assert expected <= entries.keys()
    assert "partially proven" in entries["R-WE-34"]["status"]
    for requirement_id in expected:
        referenced = entries[requirement_id]["proven_by"]
        assert all((REPO / path).exists() for paths in referenced.values() for path in paths)



def test_slice2_future_requirements_are_traced():
    inventory = json.loads((REPO / "config" / "requirements-inventory.json").read_text())
    entries = {item["id"]: item for item in inventory["requirements"]}
    expected = {
        "R-WE-1", "R-WE-2", "R-WE-10", "R-WE-11", "R-WE-12",
        "R-WE-31", "R-WE-32", "R-WE-33", "R-WE-35", "R-WE-36",
        "R-WE-69", "R-WE-70", "R-WE-71", "R-WE-72", "R-WE-73",
        "R-WE-74", "R-WE-75", "R-WE-76", "R-WE-77", "R-WE-78",
        "R-WE-79", "R-WE-80", "R-WE-81", "R-WE-82", "R-WE-83", "R-WE-84",
    }
    assert expected <= entries.keys()
    assert entries["R-WE-10"]["status"].startswith("proven")
    for requirement_id in {
        "R-WE-35", "R-WE-36", "R-WE-69", "R-WE-70", "R-WE-71", "R-WE-72",
        "R-WE-73", "R-WE-74", "R-WE-75", "R-WE-76", "R-WE-77", "R-WE-78",
        "R-WE-79", "R-WE-80", "R-WE-81", "R-WE-82", "R-WE-83", "R-WE-84",
    }:
        assert not entries[requirement_id]["status"].startswith(("blocked", "reopened"))
    for requirement_id in expected:
        referenced = entries[requirement_id]["proven_by"]
        assert all((REPO / path).exists() for paths in referenced.values() for path in paths)

def test_legacy_skill_aliases_remain_until_both_real_dispositions_are_proven():
    # R-WE-6 is intentionally Slice 4. Future mutation is proven in Slice 2,
    # but removing aliases before the episode path exists would strand operators.
    assert (REPO / ".agents" / "skills" / "design").exists()
    assert (REPO / ".agents" / "skills" / "spec-it-out").exists()
