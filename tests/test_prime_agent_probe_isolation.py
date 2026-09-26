"""Regression coverage for native Prime Agent probe config isolation."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


REPO = Path(__file__).resolve().parents[1]
RUN_PROBE = REPO / "scripts" / "run-prime-agent-probe.sh"


class PrimeAgentProbeIsolationTests(unittest.TestCase):
    def test_probe_cannot_mutate_user_config_and_uses_isolated_sessions(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-probe-test-") as tmp:
            home = Path(tmp) / "home"
            user_config = home / ".prime" / "agent"
            user_config.mkdir(parents=True)
            user_settings = user_config / "settings.json"
            user_settings.write_text('{"compaction":{"enabled":true}}\n')

            child = """
import json, os
from pathlib import Path
config = Path(os.environ["PRIME_AGENT_CODING_AGENT_DIR"])
sessions = Path(os.environ["PRIME_AGENT_SESSION_DIR"])
(config / "settings.json").write_text('{"compaction":{"enabled":false}}\\n')
print(json.dumps({"config": str(config), "sessions": str(sessions)}))
"""
            env = os.environ.copy()
            env["HOME"] = str(home)
            # The guard must replace inherited values rather than trusting callers.
            env["PRIME_AGENT_CODING_AGENT_DIR"] = str(user_config)
            result = subprocess.run(
                [str(RUN_PROBE), sys.executable, "-c", child],
                cwd=REPO,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            paths = json.loads(result.stdout)
            self.assertNotEqual(Path(paths["config"]), user_config)
            self.assertNotEqual(Path(paths["sessions"]), user_config / "sessions")
            self.assertEqual(
                json.loads(user_settings.read_text()),
                {"compaction": {"enabled": True}},
            )
            self.assertFalse(Path(paths["config"]).exists())
            self.assertFalse(Path(paths["sessions"]).exists())

    def test_retained_root_is_private_and_isolates_daemon_state(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-retained-probe-test-") as tmp:
            temp_root = Path(tmp)
            user_home = temp_root / "user-home"
            user_config = user_home / ".prime" / "agent"
            user_config.mkdir(parents=True)
            user_settings = user_config / "settings.json"
            user_settings.write_text('{"compaction":{"enabled":true}}\n')
            child = """
import json, os
from pathlib import Path
root = Path(os.environ["PRIME_CLAW_PROBE_ROOT"])
config = Path(os.environ["PRIME_AGENT_CODING_AGENT_DIR"])
sessions = Path(os.environ["PRIME_AGENT_SESSION_DIR"])
(config / "settings.json").write_text('{"compaction":{"enabled":false}}\\n')
print(json.dumps({"root": str(root), "config": str(config), "sessions": str(sessions),
                  "home": os.environ["HOME"], "tmpdir": os.environ["TMPDIR"],
                  "inherited": sorted(k for k in os.environ if k.startswith("PRIME_AGENT_INTERNAL_")
                                      or k in ("OPENAI_API_KEY", "ANTHROPIC_API_KEY", "NODE_OPTIONS"))}))
"""
            env = os.environ.copy()
            env["HOME"] = str(user_home)
            env["TMPDIR"] = str(temp_root)
            env["PRIME_AGENT_CODING_AGENT_DIR"] = str(user_config)
            env["PRIME_AGENT_SESSION_DIR"] = str(user_home / "sessions")
            env["PRIME_AGENT_INTERNAL_DAEMON_WORKER"] = "1"
            env["PRIME_AGENT_INTERNAL_DAEMON_SUPERVISOR_SOCKET"] = "/tmp/forbidden-live-socket"
            env["OPENAI_API_KEY"] = "fake-test-key"
            env["NODE_OPTIONS"] = "--no-warnings"
            result = subprocess.run(
                [str(RUN_PROBE), "--retain-root", sys.executable, "-c", child],
                cwd=REPO,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            paths = json.loads(result.stdout)
            self.assertEqual(paths["inherited"], [])
            root = Path(paths["root"])
            self.assertEqual(root.parent, temp_root.resolve())
            self.assertEqual(root.stat().st_mode & 0o777, 0o700)
            for key, expected in (("config", "config"), ("sessions", "sessions"),
                                  ("home", "home"), ("tmpdir", "tmp")):
                path = Path(paths[key])
                self.assertEqual(path, root / expected)
                self.assertTrue(path.is_dir())
                self.assertEqual(path.stat().st_mode & 0o777, 0o700)
            self.assertIn(str(root), result.stderr)
            self.assertEqual(json.loads(user_settings.read_text()),
                             {"compaction": {"enabled": True}})
            self.assertEqual(json.loads((root / "config" / "settings.json").read_text()),
                             {"compaction": {"enabled": False}})

    def test_retained_probe_failure_keeps_root_for_inspection(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-retained-failure-") as tmp:
            env = os.environ.copy()
            env["TMPDIR"] = tmp
            child = 'import os; print(os.environ["PRIME_CLAW_PROBE_ROOT"]); raise SystemExit(23)'
            result = subprocess.run(
                [str(RUN_PROBE), "--retain-root", sys.executable, "-c", child],
                cwd=REPO,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 23, result.stdout + result.stderr)
            root = Path(result.stdout.strip())
            self.assertTrue(root.is_dir())
            self.assertIn(str(root), result.stderr)
            self.assertTrue((root / "config").is_dir())
            self.assertTrue((root / "sessions").is_dir())

    def test_probe_exit_status_is_preserved(self) -> None:
        result = subprocess.run(
            [str(RUN_PROBE), sys.executable, "-c", "raise SystemExit(23)"],
            cwd=REPO,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertEqual(result.returncode, 23, result.stdout + result.stderr)


if __name__ == "__main__":
    unittest.main()
