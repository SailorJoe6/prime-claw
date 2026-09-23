"""Regression coverage for inert plugin source and explicit global installation."""

import fcntl
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "src" / "prime-agent-plugin"
APPLY = REPO / "scripts" / "apply-prime-agent-plugin.sh"
CHECK = REPO / "scripts" / "check-prime-agent-plugin.sh"
MANAGER = REPO / "scripts" / "manage-prime-agent-append-system.py"
FILES = (
    "extensions/handoff-chain.ts",
    "extensions/reviewed-plan.ts",
    "extension-support/conversation-oversight.ts",
    "extension-support/episode-finalization.ts",
    "extension-support/handoff-prompts.ts",
    "extension-support/reviewed-plan-support.ts",
    "extension-support/spec-episode.ts",
)


class PrimeAgentPluginInstallTests(unittest.TestCase):
    def run_script(self, script: Path, destination: Path) -> subprocess.CompletedProcess[str]:
        env = os.environ.copy()
        env["PRIME_AGENT_PLUGIN_ROOT"] = str(destination)
        return subprocess.run(
            [str(script)],
            cwd=REPO,
            env=env,
            text=True,
            capture_output=True,
            check=False,
        )

    def test_source_is_outside_project_extension_discovery(self) -> None:
        self.assertTrue((SOURCE / "extensions").is_dir())
        self.assertFalse((REPO / ".prime" / "agent" / "extensions").exists())
        self.assertFalse((REPO / ".prime" / "agent" / "extensions-bak").exists())
        self.assertFalse((REPO / ".prime" / "agent" / "extension-support").exists())

    def test_apply_copies_the_complete_allowlist_and_check_accepts_it(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-install-") as tmp:
            destination = Path(tmp) / "agent"
            destination.mkdir(parents=True)
            (destination / "APPEND_SYSTEM.md").write_text("unrelated user append\n")
            applied = self.run_script(APPLY, destination)
            self.assertEqual(applied.returncode, 0, applied.stdout + applied.stderr)
            for relative in FILES:
                self.assertEqual(
                    (destination / relative).read_bytes(),
                    (SOURCE / relative).read_bytes(),
                    relative,
                )
            append = (destination / "APPEND_SYSTEM.md").read_text()
            self.assertIn("unrelated user append", append)
            self.assertEqual(append.count("PRIME_CLAW_CONVERSATION_IDENTITY_V1"), 1)
            checked = self.run_script(CHECK, destination)
            self.assertEqual(checked.returncode, 0, checked.stdout + checked.stderr)

    def test_check_rejects_a_stale_global_file(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-stale-") as tmp:
            destination = Path(tmp) / "agent"
            applied = self.run_script(APPLY, destination)
            self.assertEqual(applied.returncode, 0, applied.stdout + applied.stderr)
            stale = destination / FILES[0]
            stale.write_text("stale generation\n")
            checked = self.run_script(CHECK, destination)
            self.assertNotEqual(checked.returncode, 0)
            self.assertIn("stale installed plugin file", checked.stderr)

    def test_check_rejects_missing_or_stale_identity_block(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-kernel-") as tmp:
            destination = Path(tmp) / "agent"
            applied = self.run_script(APPLY, destination)
            self.assertEqual(applied.returncode, 0, applied.stdout + applied.stderr)
            append = destination / "APPEND_SYSTEM.md"
            append.write_text("unrelated only\n")
            checked = self.run_script(CHECK, destination)
            self.assertNotEqual(checked.returncode, 0)
            self.assertIn("missing managed identity block", checked.stderr)

    def test_apply_rejects_duplicate_managed_blocks_before_copying(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-duplicate-") as tmp:
            destination = Path(tmp) / "agent"
            destination.mkdir(parents=True)
            block = (SOURCE / "APPEND_SYSTEM.md").read_text()
            (destination / "APPEND_SYSTEM.md").write_text(block + "\n" + block)
            applied = self.run_script(APPLY, destination)
            self.assertNotEqual(applied.returncode, 0)
            self.assertIn("duplicate prime-claw identity blocks", applied.stderr)
            self.assertFalse((destination / FILES[0]).exists())

    def run_manager(self, mode: str, destination: Path) -> subprocess.CompletedProcess[bytes]:
        return subprocess.run(
            [sys.executable, str(MANAGER), mode, str(SOURCE / "APPEND_SYSTEM.md"), str(destination)],
            cwd=REPO,
            capture_output=True,
            check=False,
        )

    def test_managed_append_is_byte_stable_and_preserves_unmanaged_bytes_and_mode(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-bytes-") as tmp:
            destination = Path(tmp) / "APPEND_SYSTEM.md"
            sentinel = b"prefix\x00\xff  \n"
            destination.write_bytes(sentinel)
            destination.chmod(0o640)
            first = self.run_manager("apply", destination)
            self.assertEqual(first.returncode, 0, first.stderr.decode(errors="replace"))
            installed = destination.read_bytes()
            self.assertTrue(installed.startswith(sentinel))
            self.assertEqual(destination.stat().st_mode & 0o777, 0o640)
            second = self.run_manager("apply", destination)
            self.assertEqual(second.returncode, 0, second.stderr.decode(errors="replace"))
            self.assertEqual(destination.read_bytes(), installed)
            checked = self.run_manager("check", destination)
            self.assertEqual(checked.returncode, 0, checked.stderr.decode(errors="replace"))
            self.assertEqual(list(destination.parent.glob(".*.tmp")), [])

    def test_manager_rejects_every_malformed_marker_shape_without_mutation(self) -> None:
        source_block = (SOURCE / "APPEND_SYSTEM.md").read_bytes().strip()
        start = b"<!-- prime-claw:conversation-identity:start -->"
        end = b"<!-- prime-claw:conversation-identity:end -->"
        malformed = {
            "start-only": b"sentinel\n" + start,
            "end-only": b"sentinel\n" + end,
            "reversed": b"sentinel\n" + end + b"\n" + start,
            "duplicate": source_block + b"\n" + source_block,
            "overlap": start + b"\n" + start + b"\n" + end + b"\n" + end,
        }
        for label, original in malformed.items():
            with self.subTest(label=label), tempfile.TemporaryDirectory(prefix="prime-claw-plugin-malformed-") as tmp:
                destination = Path(tmp) / "APPEND_SYSTEM.md"
                destination.write_bytes(original)
                applied = self.run_manager("apply", destination)
                self.assertNotEqual(applied.returncode, 0)
                self.assertEqual(destination.read_bytes(), original)

    def test_manager_rejects_destination_symlink_without_mutating_target(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-symlink-") as tmp:
            root = Path(tmp)
            target = root / "target.md"
            sentinel = b"do not modify\n"
            target.write_bytes(sentinel)
            destination = root / "APPEND_SYSTEM.md"
            destination.symlink_to(target)
            applied = self.run_manager("apply", destination)
            self.assertNotEqual(applied.returncode, 0)
            self.assertIn(b"destination symlink", applied.stderr)
            self.assertTrue(destination.is_symlink())
            self.assertEqual(target.read_bytes(), sentinel)

    def test_manager_rejects_symlink_parent_without_creating_destination(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-parent-symlink-") as tmp:
            root = Path(tmp)
            real_parent = root / "real-agent"
            real_parent.mkdir()
            linked_parent = root / "linked-agent"
            linked_parent.symlink_to(real_parent, target_is_directory=True)
            destination = linked_parent / "APPEND_SYSTEM.md"
            applied = self.run_manager("apply", destination)
            self.assertNotEqual(applied.returncode, 0)
            self.assertIn(b"parent symlink", applied.stderr)
            self.assertFalse((real_parent / "APPEND_SYSTEM.md").exists())

    def test_concurrent_apply_serializes_before_read_and_preserves_sentinel(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-plugin-concurrent-") as tmp:
            root = Path(tmp)
            destination = root / "APPEND_SYSTEM.md"
            destination.write_bytes(b"initial\n")
            lock_path = root / ".prime-claw-append-system.lock"
            with lock_path.open("a+b") as lock:
                fcntl.flock(lock.fileno(), fcntl.LOCK_EX)
                command = [
                    sys.executable,
                    str(MANAGER),
                    "apply",
                    str(SOURCE / "APPEND_SYSTEM.md"),
                    str(destination),
                ]
                processes = [subprocess.Popen(command, cwd=REPO, stdout=subprocess.PIPE, stderr=subprocess.PIPE) for _ in range(4)]
                sentinel = b"initial\nadded-while-contenders-wait\n"
                destination.write_bytes(sentinel)
                fcntl.flock(lock.fileno(), fcntl.LOCK_UN)
            results = [process.communicate(timeout=10) + (process.returncode,) for process in processes]
            self.assertTrue(all(returncode == 0 for _, _, returncode in results), results)
            installed = destination.read_bytes()
            self.assertTrue(installed.startswith(sentinel))
            self.assertEqual(installed.count(b"PRIME_CLAW_CONVERSATION_IDENTITY_V1"), 1)
            checked = self.run_manager("check", destination)
            self.assertEqual(checked.returncode, 0, checked.stderr.decode(errors="replace"))


if __name__ == "__main__":
    unittest.main()
