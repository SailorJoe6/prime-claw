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


def _bind_file_anchors(module, common: Path, target: Path, files: list[dict]):
    anchor_dir = common / "prime-claw/future-file-anchors"
    anchor_dir.mkdir(parents=True, exist_ok=True)
    parent_identity = _fd_identity(module, anchor_dir, True)
    for item in files:
        anchor = anchor_dir / f"test-{item['name']}"
        os.link(target / item["name"], anchor)
        item.update({
            "anchor_path": f"prime-claw/future-file-anchors/{anchor.name}",
            "anchor_parent_identity": parent_identity,
            "anchor_identity": _fd_identity(module, anchor),
        })


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
        _bind_file_anchors(module, common, target, files)
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
        _bind_file_anchors(module, common, target, files)
        evidence = b"tree\n"; evidence_path = indexes / "disp.index"; evidence_path.write_bytes(evidence)
        data = {"repo":str(repo),"common_dir":str(common),"target_path":".ralph/plans/future/candidate","directory_identity":_fd_identity(module,target,True),"files":files,"consumed_name":"disp.json","tombstone_text":"{\"manifest\":true}\n","tree_evidence_name":"disp.index","tree_evidence_retired_name":"retired-tree.index","tree_evidence_sha256":hashlib.sha256(evidence).hexdigest(),"tree_evidence_identity":_fd_identity(module,evidence_path)}
        original = module.retire_anchored_file; calls = 0
        def interrupt(target_fd, quarantine_fd, common_fd, item):
            nonlocal calls
            calls += 1
            if calls == 2: raise OSError("injected partial retirement")
            return original(target_fd, quarantine_fd, common_fd, item)
        module.retire_anchored_file = interrupt
        try:
            try: module.remove_bundle(data)
            except OSError as error: assert "injected partial" in str(error)
            else: raise AssertionError("partial retirement unexpectedly completed")
        finally: module.retire_anchored_file = original
        assert (consumed / "disp.json").exists() and not (target / "SPECIFICATION.md").exists()
        resumed = module.remove_bundle(data)
        assert resumed["retirement_complete"] is True and resumed["consumed_created"] is False
        assert all(not (target / name).exists() for name in contents)
        assert not evidence_path.exists()


def test_astra_17_late_directory_substitution_is_restored_to_public_name():
    module = _load_fs_helper("specification_episode_fs_restore")
    with tempfile.TemporaryDirectory(prefix="prime-claw-product-restore-") as raw_root:
        root = Path(raw_root).resolve(); repo = root / "repo"; common = repo / ".git"
        target = repo / ".ralph/plans/future/candidate"; consumed = common / "prime-claw/future-ownership-consumed"; indexes = common / "prime-claw/indexes"
        for directory in (target, consumed, indexes): directory.mkdir(parents=True, exist_ok=True)
        contents = {"SPECIFICATION.md": "# Spec\n", "REQUIREMENTS.md": "# Requirements\n", "DECISIONS.md": "# Decisions\n"}
        files = []
        for name, content in contents.items():
            path = target / name; path.write_text(content)
            files.append({"name": name, "content": content, "identity": _fd_identity(module, path), "retired_name": f"retired-{name}"})
        _bind_file_anchors(module, common, target, files)
        index_bytes = b"evidence\n"; (indexes / "disp.index").write_bytes(index_bytes)
        original_rename = module.rename_exclusive_between; injected = False
        def substitute_at_retirement(source_fd, source, target_fd, destination):
            nonlocal injected
            if not injected and source == "SPECIFICATION.md":
                injected = True
                os.rename(source, "SPECIFICATION.md-owned", src_dir_fd=source_fd, dst_dir_fd=source_fd)
                os.mkdir(source, dir_fd=source_fd)
                directory_fd = os.open(source, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0), dir_fd=source_fd)
                child_fd = os.open("UNOWNED.txt", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=directory_fd)
                os.write(child_fd, b"unowned\n"); os.close(child_fd); os.close(directory_fd)
            return original_rename(source_fd, source, target_fd, destination)
        module.rename_exclusive_between = substitute_at_retirement
        try:
            try:
                module.remove_bundle({"repo": str(repo), "common_dir": str(common), "target_path": ".ralph/plans/future/candidate", "directory_identity": _fd_identity(module, target, True), "files": files, "consumed_name": "disp.json", "tombstone_text": "{}\n", "tree_evidence_name": "disp.index", "tree_evidence_retired_name": "retired-tree.index", "tree_evidence_sha256": hashlib.sha256(index_bytes).hexdigest(), "tree_evidence_identity": _fd_identity(module, indexes / "disp.index")})
            except (RuntimeError, IsADirectoryError) as error:
                assert "regular file" in str(error) or "protected allocation" in str(error) or "directory" in str(error)
            else: raise AssertionError("directory substitution unexpectedly retired")
        finally: module.rename_exclusive_between = original_rename
        assert injected
        assert (target / "SPECIFICATION.md/UNOWNED.txt").read_bytes() == b"unowned\n"
        assert (target / "SPECIFICATION.md-owned").read_text() == contents["SPECIFICATION.md"]


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
            except RuntimeError as error: assert "occupied" in str(error) or "no-clobber" in str(error)
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


def test_astra_19_postpublication_lock_failure_reconciles_exact_guard():
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
            try: module.acquire_lock(str(root), "prime-claw/locks/project.lock", json.dumps({"token":"owned","pid":os.getpid()})+"\n")
            except OSError as error: assert "injected post-publication" in str(error)
            else: raise AssertionError("post-publication failure unexpectedly succeeded")
        finally: module.os.fsync = real_fsync
        owner_text = json.dumps({"token":"owned","pid":os.getpid()})+"\n"; owner_sha = hashlib.sha256(owner_text.encode()).hexdigest()
        reconciled = module.reconcile_lock(str(root), "prime-claw/locks/project.lock", "owned", owner_sha)
        assert reconciled["exists"] is True and reconciled["complete"] is False
        guard_rel = "prime-claw/locks/project.lock.guard"; qid = _fd_identity(module, root / "prime-claw/quarantine", True) if (root / "prime-claw/quarantine").exists() else None
        module.remove_control(str(root), guard_rel, owner_sha, reconciled["guard_identity"], None, None, qid, "failed-lock-guard-test")
        assert not (locks / "project.lock").exists() and not (locks / "project.lock.guard").exists()


def test_astra_19_failure_opening_published_lock_reconciles_exact_lock_and_guard():
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
            try: module.acquire_lock(str(root), "prime-claw/locks/project.lock", json.dumps({"token":"owned","pid":os.getpid()})+"\n")
            except OSError as error: assert "published lock open" in str(error)
            else: raise AssertionError("published-open failure unexpectedly succeeded")
        finally: module.os.open = real_open
        assert injected and (locks / "project.lock").exists()
        owner_text = json.dumps({"token":"owned","pid":os.getpid()})+"\n"; owner_sha = hashlib.sha256(owner_text.encode()).hexdigest()
        reconciled = module.reconcile_lock(str(root), "prime-claw/locks/project.lock", "owned", owner_sha)
        module.remove_lock(str(root), "prime-claw/locks/project.lock", "owned", reconciled["lock_identity"], reconciled["owner_identity"], reconciled["guard_identity"], owner_sha, reconciled["broker_socket"], reconciled["authority_socket"])
        assert not (locks / "project.lock").exists()


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


def test_astra_17_hardlink_dirty_write_is_restored_to_public_name():
    module = _load_fs_helper("specification_episode_fs_dirty_restore")
    with tempfile.TemporaryDirectory(prefix="prime-claw-dirty-restore-") as raw_root:
        root = Path(raw_root).resolve(); repo = root / "repo"; common = repo / ".git"
        target = repo / ".ralph/plans/future/candidate"; consumed = common / "prime-claw/future-ownership-consumed"; indexes = common / "prime-claw/indexes"
        for directory in (target, consumed, indexes): directory.mkdir(parents=True, exist_ok=True)
        contents = {"SPECIFICATION.md": "# Spec\n", "REQUIREMENTS.md": "# Requirements\n", "DECISIONS.md": "# Decisions\n"}
        files = []
        for name, content in contents.items():
            path = target / name; path.write_text(content)
            files.append({"name": name, "content": content, "identity": _fd_identity(module, path), "retired_name": f"retired-{name}"})
        _bind_file_anchors(module, common, target, files)
        alias = root / "outside-alias"; os.link(target / "SPECIFICATION.md", alias)
        evidence = b"tree\n"; (indexes / "disp.index").write_bytes(evidence)
        original_rename = module.rename_exclusive_between; injected = False
        def dirty_at_retirement(source_fd, source, target_fd, destination):
            nonlocal injected
            if not injected and source == "SPECIFICATION.md":
                injected = True; alias.write_text("DIRTY CONCURRENT WORK\n")
            return original_rename(source_fd, source, target_fd, destination)
        module.rename_exclusive_between = dirty_at_retirement
        try:
            try:
                module.remove_bundle({"repo": str(repo), "common_dir": str(common), "target_path": ".ralph/plans/future/candidate", "directory_identity": _fd_identity(module, target, True), "files": files, "consumed_name": "disp.json", "tombstone_text": "{}\n", "tree_evidence_name": "disp.index", "tree_evidence_retired_name": "retired-tree.index", "tree_evidence_sha256": hashlib.sha256(evidence).hexdigest(), "tree_evidence_identity": _fd_identity(module, indexes / "disp.index")})
            except RuntimeError as error: assert "content changed" in str(error)
            else: raise AssertionError("dirty hardlink content unexpectedly retired")
        finally: module.rename_exclusive_between = original_rename
        assert injected and (target / "SPECIFICATION.md").read_text() == "DIRTY CONCURRENT WORK\n"
        assert alias.read_text() == "DIRTY CONCURRENT WORK\n"


def test_astra_18_foreign_consumption_manifest_is_rejected_before_retirement():
    module = _load_fs_helper("specification_episode_fs_manifest_swap")
    with tempfile.TemporaryDirectory(prefix="prime-claw-manifest-swap-") as raw_root:
        root = Path(raw_root).resolve(); repo = root / "repo"; common = repo / ".git"
        target = repo / ".ralph/plans/future/candidate"; consumed = common / "prime-claw/future-ownership-consumed"; indexes = common / "prime-claw/indexes"
        for directory in (target, consumed, indexes): directory.mkdir(parents=True, exist_ok=True)
        files = []
        for name in ["SPECIFICATION.md", "REQUIREMENTS.md", "DECISIONS.md"]:
            path = target / name; path.write_text(name + "\n")
            files.append({"name": name, "content": path.read_text(), "identity": _fd_identity(module, path), "retired_name": f"retired-{name}"})
        _bind_file_anchors(module, common, target, files)
        evidence = b"tree\n"; (indexes / "disp.index").write_bytes(evidence)
        original_link = module.os.link; injected = False
        def replace_staging(src, dst, *args, **kwargs):
            nonlocal injected
            if dst == "disp.json" and not injected:
                injected = True; source_fd = kwargs["src_dir_fd"]
                os.rename(src, "saved-approved-manifest", src_dir_fd=source_fd, dst_dir_fd=source_fd)
                fd = os.open(src, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=source_fd)
                os.write(fd, b'{"manifest":"FOREIGN"}\n'); os.close(fd)
            return original_link(src, dst, *args, **kwargs)
        module.os.link = replace_staging
        try:
            try:
                module.remove_bundle({"repo": str(repo), "common_dir": str(common), "target_path": ".ralph/plans/future/candidate", "directory_identity": _fd_identity(module, target, True), "files": files, "consumed_name": "disp.json", "tombstone_text": '{"manifest":"approved"}\n', "tree_evidence_name": "disp.index", "tree_evidence_retired_name": "retired-tree.index", "tree_evidence_sha256": hashlib.sha256(evidence).hexdigest(), "tree_evidence_identity": _fd_identity(module, indexes / "disp.index")})
            except RuntimeError as error: assert "staged allocation" in str(error) or "manifest changed" in str(error)
            else: raise AssertionError("foreign manifest unexpectedly authorized retirement")
        finally: module.os.link = original_link
        assert injected and sorted(path.name for path in target.iterdir()) == sorted(item["name"] for item in files)


def test_astra_20_strict_json_rejects_duplicate_and_escaped_keys_recursively():
    module = _load_fs_helper("specification_episode_fs_strict_json")
    for raw in ['{"version":2,"version":1}', '{"commit":{"oid":"good","o\\u0069d":"bad"}}', '{"a":{"x":1,"x":2}}']:
        try: module.strict_json(raw)
        except RuntimeError as error: assert "duplicate decoded JSON key" in str(error)
        else: raise AssertionError(f"duplicate JSON accepted: {raw}")
    assert module.strict_json('{"a":{"x":1}}') == {"a": {"x": 1}}


def test_astra_24_namespace_operations_fsync_both_published_namespaces():
    module = _load_fs_helper("specification_episode_fs_durability")
    with tempfile.TemporaryDirectory(prefix="prime-claw-fsync-") as raw_root:
        root = Path(raw_root).resolve(); repo = root / "repo"; common = repo / ".git"
        (repo / ".ralph/plans/future").mkdir(parents=True); anchors = common / "prime-claw/future-file-anchors"; anchors.mkdir(parents=True); (common / "prime-claw/quarantine").mkdir()
        calls = []; real_fsync = module.os.fsync
        def traced(fd):
            st = os.fstat(fd); calls.append((st.st_dev, st.st_ino, stat.S_ISDIR(st.st_mode))); return real_fsync(fd)
        import stat
        module.os.fsync = traced
        try:
            directory = module.create_product_directory(str(repo), ".ralph/plans/future/candidate")["identity"]
            common_identity = _fd_identity(module, common, True); anchor_parent_identity = _fd_identity(module, anchors, True)
            module.create_product_file({"repo": str(repo), "common_dir": str(common), "common_identity": common_identity, "path": ".ralph/plans/future/candidate/SPECIFICATION.md", "content": "x", "directory_identity": directory, "anchor_path": "prime-claw/future-file-anchors/fsync", "anchor_parent_identity": anchor_parent_identity})
        finally: module.os.fsync = real_fsync
        dir_keys = {(p.stat().st_dev, p.stat().st_ino) for p in [repo / ".ralph/plans/future", repo / ".ralph/plans/future/candidate", anchors]}
        synced_dirs = {(dev, ino) for dev, ino, is_dir in calls if is_dir}
        assert dir_keys <= synced_dirs


def test_astra_19_bound_quarantine_replacement_is_not_adopted():
    module = _load_fs_helper("specification_episode_fs_quarantine_bound")
    with tempfile.TemporaryDirectory(prefix="prime-claw-quarantine-bound-") as raw_root:
        root = Path(raw_root).resolve(); control = root / "control"; control.mkdir(); quarantine = root / "prime-claw/quarantine"; quarantine.mkdir(parents=True)
        leaf = control / "state.json"; leaf.write_text("old")
        expected_leaf = _fd_identity(module, leaf); expected_quarantine = _fd_identity(module, quarantine, True)
        saved = root / "saved-quarantine"; quarantine.rename(saved); quarantine.mkdir()
        try: module.durable_json(str(root), "control/state.json", "new", False, expected_leaf, None, None, expected_quarantine)
        except RuntimeError as error: assert "quarantine directory incarnation changed" in str(error)
        else: raise AssertionError("replacement quarantine was adopted")
        assert leaf.read_text() == "old" and list(quarantine.iterdir()) == []


def test_astra_22_control_retirement_reconciles_lost_response_without_touching_replacement():
    module = _load_fs_helper("specification_episode_fs_control_reconcile")
    with tempfile.TemporaryDirectory(prefix="prime-claw-control-reconcile-") as raw_root:
        root = Path(raw_root).resolve(); control = root / "control"; control.mkdir(); quarantine = root / "prime-claw/quarantine"; quarantine.mkdir(parents=True)
        leaf = control / "blocker.json"; original = b'{"owned":true}\n'; leaf.write_bytes(original)
        identity = _fd_identity(module, leaf); digest = hashlib.sha256(original).hexdigest(); qid = _fd_identity(module, quarantine, True); destination = "control-approved-outcome"
        first = module.remove_control(str(root), "control/blocker.json", digest, identity, None, None, qid, destination)
        assert first["removed"] is True and not leaf.exists()
        second = module.remove_control(str(root), "control/blocker.json", digest, identity, None, None, qid, destination)
        assert second["removed"] is True and second["reconciled"] is True
        leaf.write_text("replacement")
        third = module.remove_control(str(root), "control/blocker.json", digest, identity, None, None, qid, destination)
        assert third["reconciled"] is True
        assert leaf.read_text() == "replacement" and (quarantine / destination).read_bytes() == original


def test_astra_22_completed_control_retirement_ignores_new_canonical_replacement():
    import hashlib, json, os, tempfile
    with tempfile.TemporaryDirectory() as temp:
        root = os.path.realpath(temp); state = os.path.join(root,"prime-claw","state"); quarantine = os.path.join(root,"prime-claw","quarantine")
        os.makedirs(state); os.makedirs(quarantine)
        target = os.path.join(state,"blocker.json"); approved = b'{"version":1,"disposition_id":"approved"}'
        with open(target,"wb") as f: f.write(approved)
        helper = _load_fs_helper("specification_episode_fs_control_replacement_response"); identity = _fd_identity(helper, Path(target)); root_id = _fd_identity(helper, Path(root), True); parent_id = _fd_identity(helper, Path(state), True); quarantine_id = _fd_identity(helper, Path(quarantine), True)
        kwargs = dict(root=root, rel="prime-claw/state/blocker.json", expected_sha256=hashlib.sha256(approved).hexdigest(), expected_identity=identity, root_identity=root_id, parent_identity=parent_id, quarantine_identity=quarantine_id, retired_name="retired-approved")
        first = helper.remove_control(**kwargs); assert first["removed"]
        replacement = b'{"version":1,"disposition_id":"replacement"}'
        with open(target,"wb") as f: f.write(replacement)
        second = helper.remove_control(**kwargs)
        assert second["reconciled"] is True
        assert open(target,"rb").read() == replacement
        assert open(os.path.join(quarantine,"retired-approved"),"rb").read() == approved


def test_astra_19_broker_exclusion_survives_lock_path_displacement():
    import json, os, tempfile
    module = _load_fs_helper("specification_episode_fs_broker_exclusion")
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp).resolve(); locks = root / "prime-claw/locks"; (root / "prime-claw/quarantine").mkdir(parents=True); locks.mkdir(exist_ok=True)
        owner = json.dumps({"token":"owner","pid":os.getpid()},separators=(",",":")) + "\n"
        acquired = module.acquire_lock(str(root), "prime-claw/locks/project.lock", owner)
        assert acquired["created"] is True
        lock = locks / "project.lock"; guard = locks / "project.lock.guard"; moved = root / "moved-lock"; moved_guard = root / "moved-guard"
        os.rename(lock,moved); os.rename(guard,moved_guard)
        contender = module.acquire_lock(str(root), "prime-claw/locks/project.lock", json.dumps({"token":"contender","pid":os.getpid()})+"\n")
        assert contender["created"] is False
        os.rename(moved,lock); os.rename(moved_guard,guard)
        module.remove_lock(str(root), "prime-claw/locks/project.lock", "owner", acquired["lock_identity"], acquired["owner_identity"], acquired["guard_identity"], acquired["owner_sha256"], acquired["broker_socket"], acquired["authority_socket"])


def test_astra_19_broker_releases_kernel_authority_when_owner_process_dies():
    import fcntl, time, sys
    with tempfile.TemporaryDirectory() as temp:
        root = Path(temp).resolve(); (root / "prime-claw/locks").mkdir(parents=True); (root / "prime-claw/quarantine").mkdir(parents=True)
        script = f'''import importlib.util,json,os
s=importlib.util.spec_from_file_location("broker_owner",{str((REPO / ".prime/agent/helpers/specification-episode-fs.py"))!r});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
a=m.acquire_lock({str(root)!r},"prime-claw/locks/project.lock",json.dumps({{"token":"dead-owner","pid":os.getpid()}})+"\\n")
print(a["broker_socket"],flush=True)
os._exit(0)'''
        result = subprocess.run([sys.executable,"-c",script],text=True,capture_output=True,check=True)
        socket_path = result.stdout.strip(); assert socket_path
        for _ in range(30):
            if not os.path.exists(socket_path): break
            time.sleep(0.1)
        assert not os.path.exists(socket_path), "broker survived its owner process"
        fd = os.open(root,os.O_RDONLY)
        try: fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); fcntl.flock(fd,fcntl.LOCK_UN)
        finally: os.close(fd)
        assert (root / "prime-claw/locks/project.lock").exists(), "ambiguous visible evidence was destructively cleaned"


def test_astra_19_replicated_authority_survives_one_supervisor_loss():
    with tempfile.TemporaryDirectory() as temp:
        root=Path(temp).resolve(); (root/"prime-claw/locks").mkdir(parents=True); (root/"prime-claw/quarantine").mkdir(parents=True)
        module=_load_fs_helper("specification_episode_fs_replicated_authority"); owner=json.dumps({"token":"replicated","pid":os.getpid()})+"\n"
        acquired=module.acquire_lock(str(root),"prime-claw/locks/project.lock",owner)
        assert module.broker_request(acquired["broker_socket"],"replicated","release")
        module.validate_lock(str(root),"prime-claw/locks/project.lock","replicated",acquired["lock_identity"],acquired["owner_identity"],acquired["guard_identity"],acquired["owner_sha256"],acquired["broker_socket"],acquired["authority_socket"])
        contender=module.acquire_lock(str(root),"prime-claw/locks/other.lock",json.dumps({"token":"other","pid":os.getpid()})+"\n"); assert contender["created"] is False
        module.remove_lock(str(root),"prime-claw/locks/project.lock","replicated",acquired["lock_identity"],acquired["owner_identity"],acquired["guard_identity"],acquired["owner_sha256"],acquired["broker_socket"],acquired["authority_socket"])
