"""Regression coverage for inert plugin source and explicit global installation."""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "src" / "prime-agent-plugin"
APPLY = REPO / "scripts" / "apply-prime-agent-plugin.sh"
CHECK = REPO / "scripts" / "check-prime-agent-plugin.sh"
FILES = (
    "extensions/handoff-chain.ts",
    "extensions/project-conversation.ts",
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


if __name__ == "__main__":
    unittest.main()
