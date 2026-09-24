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
