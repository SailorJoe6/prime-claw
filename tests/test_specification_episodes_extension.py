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


def test_directory_creation_receipt_cannot_adopt_a_post_publication_replacement():
    helper = REPO / ".prime" / "agent" / "helpers" / "specification-episode-fs.py"
    spec = importlib.util.spec_from_file_location("specification_episode_fs", helper)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    with tempfile.TemporaryDirectory(prefix="prime-claw-directory-creation-") as root:
        original_rename = module.rename_exclusive

        def replace_after_publication(parent_fd, source, target):
            original_rename(parent_fd, source, target)
            os.rename(target, "moved-created-object", src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
            os.mkdir(target, 0o700, dir_fd=parent_fd)

        module.rename_exclusive = replace_after_publication
        receipt = module.create_product_directory(root, "target")
        created = os.stat(Path(root) / "moved-created-object", follow_symlinks=False)
        replacement = os.stat(Path(root) / "target", follow_symlinks=False)

        assert receipt["identity"]["inode"] == str(created.st_ino)
        assert receipt["identity"]["inode"] != str(replacement.st_ino)


def test_owned_file_removal_restores_a_late_same_name_replacement():
    helper = REPO / ".prime" / "agent" / "helpers" / "specification-episode-fs.py"
    spec = importlib.util.spec_from_file_location("specification_episode_fs_product", helper)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    with tempfile.TemporaryDirectory(prefix="prime-claw-product-removal-") as root:
        repo = Path(root) / "repo"
        common = repo / ".git"
        target = repo / ".ralph/plans/future/candidate"
        consumed = common / "prime-claw/future-ownership-consumed"
        indexes = common / "prime-claw/indexes"
        for directory in (target, consumed, indexes):
            directory.mkdir(parents=True, exist_ok=True)
        contents = {
            "SPECIFICATION.md": "# Spec\n",
            "REQUIREMENTS.md": "# Requirements\n",
            "DECISIONS.md": "# Decisions\n",
        }
        files = []
        for name, content in contents.items():
            path = target / name
            path.write_text(content)
            files.append({"name": name, "content": content, "identity": module.identity(path.stat())})
        index_bytes = b"construction evidence\n"
        index_name = "disp-test.index"
        (indexes / index_name).write_bytes(index_bytes)
        directory_identity = module.identity(target.stat())
        original_inode = (target / "SPECIFICATION.md").stat().st_ino
        original_rename = module.os.rename
        injected = False

        def replace_at_quarantine(source, destination, *, src_dir_fd=None, dst_dir_fd=None):
            nonlocal injected
            if not injected and source == "SPECIFICATION.md" and str(destination).startswith(".prime-claw-file-"):
                injected = True
                original_rename(source, "moved-owned.md", src_dir_fd=src_dir_fd, dst_dir_fd=dst_dir_fd)
                fd = os.open(source, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=src_dir_fd)
                try:
                    os.write(fd, contents[source].encode())
                finally:
                    os.close(fd)
            return original_rename(source, destination, src_dir_fd=src_dir_fd, dst_dir_fd=dst_dir_fd)

        module.os.rename = replace_at_quarantine
        try:
            try:
                module.remove_bundle({
                    "repo": str(repo),
                    "common_dir": str(common),
                    "target_path": ".ralph/plans/future/candidate",
                    "directory_identity": directory_identity,
                    "files": files,
                    "consumed_name": "disp-test.json",
                    "tombstone_text": '{"consumed":true}\n',
                    "index_name": index_name,
                    "index_sha256": hashlib.sha256(index_bytes).hexdigest(),
                })
            except RuntimeError as error:
                assert "identity mismatch" in str(error)
            else:
                raise AssertionError("late product replacement was accepted for deletion")
        finally:
            module.os.rename = original_rename

        replacement = target / "SPECIFICATION.md"
        assert injected
        assert replacement.exists()
        assert replacement.stat().st_ino != original_inode
        assert replacement.read_text() == contents["SPECIFICATION.md"]
        assert not any(path.name.startswith(".prime-claw-file-") for path in target.iterdir())
        assert (consumed / "disp-test.json").exists()


def test_control_removal_never_deletes_or_overwrites_a_late_replacement():
    helper = REPO / ".prime" / "agent" / "helpers" / "specification-episode-fs.py"
    spec = importlib.util.spec_from_file_location("specification_episode_fs_control", helper)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)

    with tempfile.TemporaryDirectory(prefix="prime-claw-control-removal-") as root:
        control = Path(root) / "control"
        control.mkdir()
        leaf = control / "state.json"
        original = b'{"owned":true}\n'
        replacement = b'{"replacement":true}\n'
        leaf.write_bytes(original)
        original_rename = module.os.rename
        injected = False

        def replace_at_quarantine(source, target, *, src_dir_fd=None, dst_dir_fd=None):
            nonlocal injected
            if not injected and source == "state.json" and str(target).startswith(".prime-claw-remove-"):
                injected = True
                original_rename(source, "moved-owned.json", src_dir_fd=src_dir_fd, dst_dir_fd=dst_dir_fd)
                fd = os.open(source, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=src_dir_fd)
                try:
                    os.write(fd, replacement)
                finally:
                    os.close(fd)
            return original_rename(source, target, src_dir_fd=src_dir_fd, dst_dir_fd=dst_dir_fd)

        module.os.rename = replace_at_quarantine
        try:
            try:
                module.remove_control(root, "control/state.json", hashlib.sha256(original).hexdigest())
            except RuntimeError as error:
                assert "hash changed" in str(error)
            else:
                raise AssertionError("late replacement was accepted for deletion")
        finally:
            module.os.rename = original_rename

        assert injected
        assert leaf.read_bytes() == replacement
        assert not any(path.name.startswith(".prime-claw-remove-") for path in control.iterdir())


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
    }
    assert expected <= entries.keys()
    assert entries["R-WE-10"]["status"].startswith("proven")
    for requirement_id in {
        "R-WE-35", "R-WE-36", "R-WE-69", "R-WE-70", "R-WE-71", "R-WE-72",
        "R-WE-73", "R-WE-74", "R-WE-75", "R-WE-76", "R-WE-77", "R-WE-78",
    }:
        assert entries[requirement_id]["status"].startswith("proven")
    for requirement_id in expected:
        referenced = entries[requirement_id]["proven_by"]
        assert all((REPO / path).exists() for paths in referenced.values() for path in paths)

def test_legacy_skill_aliases_remain_until_both_real_dispositions_are_proven():
    # R-WE-6 is intentionally Slice 4. Future mutation is proven in Slice 2,
    # but removing aliases before the episode path exists would strand operators.
    assert (REPO / ".agents" / "skills" / "design").exists()
    assert (REPO / ".agents" / "skills" / "spec-it-out").exists()
