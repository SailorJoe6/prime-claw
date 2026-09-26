"""Regression coverage for native Prime Agent probe config isolation."""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import uuid


REPO = Path(__file__).resolve().parents[1]
RUN_PROBE = REPO / "scripts" / "run-prime-agent-probe.sh"


class PrimeAgentProbeIsolationTests(unittest.TestCase):
    def retained_root(self, result: subprocess.CompletedProcess[str]) -> Path:
        prefix = "Retained isolated Prime Agent probe root: "
        roots = [line.removeprefix(prefix) for line in result.stderr.splitlines()
                 if line.startswith(prefix)]
        self.assertEqual(len(roots), 1, result.stderr)
        root = Path(roots[0])
        self.assertEqual(root.parent, Path("/tmp").resolve())
        self.assertTrue(root.name.startswith("pcp."))
        self.assertFalse(root.is_symlink())
        self.assertEqual(root.stat().st_uid, os.getuid())
        self.assertEqual(root.stat().st_mode & 0o777, 0o700)
        # These tests invoke Python only; no native daemon can outlive this child.
        self.addCleanup(shutil.rmtree, root)
        return root

    def assert_socket_budget(self, root: Path) -> None:
        socket_dir = root / "tmp" / f"prime-agent-{os.getuid()}"
        supervisor = socket_dir / "daemon.sock"
        worker = socket_dir / ("worker-" + "x" * 12 + "-" + "y" * 12 + ".sock")
        for path in (supervisor, worker):
            self.assertLessEqual(len(os.fsencode(str(path))), 103, str(path))

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
            root = self.retained_root(result)
            self.assertEqual(Path(paths["root"]), root)
            self.assert_socket_budget(root)
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
            root = self.retained_root(result)
            self.assertEqual(Path(result.stdout.strip()), root)
            self.assert_socket_budget(root)
            self.assertTrue((root / "config").is_dir())
            self.assertTrue((root / "sessions").is_dir())

    def test_retained_root_fits_after_long_multibyte_tmpdir_and_replays(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-long-tmp-test-") as tmp:
            long_tmp = Path(tmp) / ("é" * 70)
            long_tmp.mkdir()
            env = os.environ.copy()
            env["TMPDIR"] = str(long_tmp)
            roots = []
            for _ in range(2):
                result = subprocess.run(
                    [str(RUN_PROBE), "--retain-root", sys.executable, "-c",
                     'import os; print(os.environ["PRIME_CLAW_PROBE_ROOT"])'],
                    cwd=REPO,
                    env=env,
                    text=True,
                    capture_output=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
                root = self.retained_root(result)
                self.assertEqual(Path(result.stdout.strip()), root)
                self.assert_socket_budget(root)
                self.assertNotEqual(root.parent, long_tmp)
                roots.append(root)
            self.assertEqual(len(set(roots)), 2)
            ordinary = subprocess.run(
                [str(RUN_PROBE), sys.executable, "-c",
                 'import os; print(os.environ["PRIME_CLAW_PROBE_ROOT"])'],
                cwd=REPO,
                env=env,
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(ordinary.returncode, 0, ordinary.stdout + ordinary.stderr)
            self.assertFalse(Path(ordinary.stdout.strip()).exists())
            for root in roots:
                self.assertTrue(root.is_dir())

    def test_retained_root_rejects_multibyte_overflow_before_command(self) -> None:
        with tempfile.TemporaryDirectory(prefix="prime-claw-fake-mktemp-") as tmp:
            fake_bin = Path(tmp) / "bin"
            fake_bin.mkdir()
            fake_mktemp = fake_bin / "mktemp"
            fake_mktemp.write_text(
                '#!/bin/sh\nmkdir -p "$FAKE_PROBE_ROOT"\nchmod 700 "$FAKE_PROBE_ROOT"\n'
                'printf "%s\\n" "$FAKE_PROBE_ROOT"\n'
            )
            fake_mktemp.chmod(0o755)
            fake_root = Path("/tmp").resolve() / ("é" * 20 + "-" + uuid.uuid4().hex[:6])
            worker = fake_root / "tmp" / f"prime-agent-{os.getuid()}" / (
                "worker-" + "x" * 12 + "-" + "y" * 12 + ".sock"
            )
            self.assertLessEqual(len(str(worker)), 103)
            self.assertGreater(len(os.fsencode(str(worker))), 103)
            marker = Path(tmp) / "command-ran"
            env = os.environ.copy()
            env["PATH"] = str(fake_bin) + os.pathsep + env.get("PATH", "/usr/bin:/bin")
            env["FAKE_PROBE_ROOT"] = str(fake_root)
            try:
                result = subprocess.run(
                    [str(RUN_PROBE), "--retain-root", sys.executable, "-c",
                     'import sys; from pathlib import Path; Path(sys.argv[1]).write_text("ran")', str(marker)],
                    cwd=REPO,
                    env=env,
                    text=True,
                    capture_output=True,
                    check=False,
                )
                self.assertEqual(result.returncode, 65, result.stdout + result.stderr)
                self.assertIn(str(fake_root), result.stderr)
                self.assertIn("103-byte Unix socket pathname budget", result.stderr)
                self.assertFalse(marker.exists())
                self.assertTrue(fake_root.is_dir())
            finally:
                if (fake_root.is_dir() and not fake_root.is_symlink()
                        and fake_root.parent == Path("/tmp").resolve()
                        and fake_root.name.startswith("é" * 20 + "-")):
                    shutil.rmtree(fake_root)

    def test_retained_command_not_found_preserves_root(self) -> None:
        result = subprocess.run(
            [str(RUN_PROBE), "--retain-root", "/definitely-not-a-command/prime-agent"],
            cwd=REPO,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(result.returncode, 0)
        root = self.retained_root(result)
        self.assert_socket_budget(root)
        self.assertTrue((root / "tmp").is_dir())

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
