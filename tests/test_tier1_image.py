"""Tier-0 regression coverage for the tier-1 slim test image and its driver.

Static checks (no Docker required): the Dockerfile must exist and stay
slim (no Postgres/pgvector/gbrain/OpenShell policy machinery), and the driver
script must be executable with a --help/--dry-run surface. Behavioral tests
exercise the driver's --smoke mode (slice-1 contract: build + toolchain
smoke, no .env needed); slice-2 install-selection coverage lives in
tests/test_tier1_driver.py. Live build/smoke evidence is produced by
scripts/test-tier1.sh itself and recorded under docs/evidence/.
"""

from __future__ import annotations

import os
import re
import stat
import subprocess
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOCKERFILE = REPO / "docker" / "test.Dockerfile"
DRIVER = REPO / "scripts" / "test-tier1.sh"


class TestTier1Dockerfile(unittest.TestCase):
    def test_dockerfile_exists(self):
        self.assertTrue(DOCKERFILE.is_file(), "docker/test.Dockerfile missing")

    def test_dockerfile_base_is_ubuntu_2404(self):
        text = DOCKERFILE.read_text()
        from_lines = [l for l in text.splitlines() if l.startswith("FROM ")]
        self.assertEqual(len(from_lines), 1, "tier-1 image must be single-stage")
        self.assertIn("ubuntu:24.04", from_lines[0])

    def test_dockerfile_has_required_toolchain(self):
        text = DOCKERFILE.read_text()
        for needle in ("nodejs", "python3", "python3-pytest"):
            self.assertIn(needle, text, f"missing toolchain piece: {needle}")
        # Node >= 22.8 prerequisite must be enforced (build-time assertion).
        self.assertRegex(text, r"node --version")

    def test_dockerfile_exposes_native_installer_public_bin(self):
        text = DOCKERFILE.read_text()
        self.assertIn('ENV PATH="/root/.local/bin:${PATH}"', text)

    def test_dockerfile_stays_slim(self):
        # Instructions only — comments explain the deferral decision and
        # legitimately name what the image excludes.
        instructions = "\n".join(
            l for l in DOCKERFILE.read_text().splitlines()
            if l.strip() and not l.strip().startswith("#")
        ).lower()
        for banned in ("postgres", "pgvector", "gbrain", "openshell", "bun"):
            self.assertIsNone(
                re.search(rf"\b{re.escape(banned)}\b", instructions),
                f"tier-1 image must not contain {banned!r}")


class TestTier1Driver(unittest.TestCase):
    def test_driver_exists_and_is_executable(self):
        self.assertTrue(DRIVER.is_file(), "scripts/test-tier1.sh missing")
        mode = DRIVER.stat().st_mode
        self.assertTrue(mode & stat.S_IXUSR, "scripts/test-tier1.sh not executable")

    def test_driver_help(self):
        out = subprocess.run(
            [str(DRIVER), "--help"], capture_output=True, text=True, timeout=30
        )
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn("--dry-run", out.stdout)
        self.assertIn("--rebuild", out.stdout)

    def test_driver_dry_run_prints_plan_without_running(self):
        out = subprocess.run(
            [str(DRIVER), "--dry-run", "--smoke"],
            capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn("dry-run: docker build", out.stdout)
        self.assertIn("dry-run: docker run --rm", out.stdout)

    def test_driver_rejects_unknown_argument(self):
        out = subprocess.run(
            [str(DRIVER), "--bogus"], capture_output=True, text=True, timeout=30
        )
        self.assertNotEqual(out.returncode, 0)

    def test_driver_is_ephemeral(self):
        # One ephemeral container per run: the driver must use --rm and must
        # not name/keep containers around.
        text = DRIVER.read_text()
        self.assertIn("docker run --rm", text)
        self.assertNotRegex(text, re.compile(r"docker run (?!.*--rm)"))


class TestTier1DriverNegativeEnvironments(unittest.TestCase):
    """Informational paths must never contact Docker; real runs must fail fast.

    Each test builds a controlled PATH: a directory holding a recording/failing
    ``docker`` substitute (or no docker at all), plus /usr/bin:/bin for the
    basic utilities the driver needs (bash, sed, dirname). These tests prove
    behavior with Docker absent and with an unreachable daemon; they require
    no Docker themselves.
    """

    def _env(self, *path_dirs):
        env = dict(os.environ)
        env["PATH"] = os.pathsep.join(
            [str(d) for d in path_dirs] + ["/usr/bin", "/bin"])
        return env

    def _make_fake_docker(self, tmp_path, *, info_rc=0, build_rc=0, run_rc=0):
        """Create a docker substitute that records every invocation."""
        record = tmp_path / "docker-invocations.log"
        script = tmp_path / "docker"
        script.write_text(
            "#!/usr/bin/env bash\n"
            f'echo "$1" >> "{record}"\n'
            'case "$1" in\n'
            f"  info) exit {info_rc} ;;\n"
            f"  build) exit {build_rc} ;;\n"
            f'  run) echo "fake-smoke-output"; exit {run_rc} ;;\n'
            "  *) exit 0 ;;\n"
            "esac\n"
        )
        script.chmod(0o755)
        return record

    def _run_driver(self, *args, env):
        return subprocess.run(
            [str(DRIVER), *args], capture_output=True, text=True,
            timeout=30, env=env,
        )

    def test_help_never_invokes_docker(self):
        with __import__("tempfile").TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp, info_rc=1, build_rc=1, run_rc=1)
            out = self._run_driver("--help", env=self._env(tmp))
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn("--dry-run", out.stdout)
            self.assertFalse(
                record.exists(),
                "--help must not invoke docker; invocations recorded: "
                + (record.read_text() if record.exists() else ""),
            )

    def test_dry_run_never_invokes_docker(self):
        with __import__("tempfile").TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp, info_rc=1, build_rc=1, run_rc=1)
            out = self._run_driver("--dry-run", "--smoke", env=self._env(tmp))
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn("dry-run: docker build", out.stdout)
            self.assertFalse(
                record.exists(),
                "--dry-run must not invoke docker; invocations recorded: "
                + (record.read_text() if record.exists() else ""),
            )

    def test_informational_paths_work_with_docker_absent(self):
        with __import__("tempfile").TemporaryDirectory() as td:
            env = self._env(td)  # empty dir: no docker on PATH at all
            import shutil
            if shutil.which("docker", path=env["PATH"]):
                self.skipTest("docker unexpectedly present in minimal PATH")
            for args in (("--help",), ("--dry-run", "--smoke")):
                out = self._run_driver(*args, env=env)
                self.assertEqual(
                    out.returncode, 0,
                    f"{args} must work with docker absent: {out.stderr}",
                )

    def test_real_run_fails_fast_without_docker_cli(self):
        with __import__("tempfile").TemporaryDirectory() as td:
            env = self._env(td)
            import shutil
            if shutil.which("docker", path=env["PATH"]):
                self.skipTest("docker unexpectedly present in minimal PATH")
            out = self._run_driver("--smoke", env=env)
            self.assertNotEqual(out.returncode, 0)
            self.assertIn("docker not found", out.stderr)
            self.assertNotIn("OK", out.stdout)

    def test_real_run_fails_fast_with_unreachable_daemon(self):
        with __import__("tempfile").TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp, info_rc=1)
            out = self._run_driver("--smoke", env=self._env(tmp))
            self.assertNotEqual(out.returncode, 0)
            self.assertIn("daemon", out.stderr)
            self.assertNotIn("OK", out.stdout)
            self.assertEqual(
                record.read_text().split(), ["info"],
                "driver must stop at the daemon check and never build",
            )

    def test_real_run_fails_when_build_fails(self):
        with __import__("tempfile").TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp, build_rc=1)
            out = self._run_driver("--smoke", env=self._env(tmp))
            self.assertNotEqual(out.returncode, 0)
            self.assertNotIn("OK", out.stdout)
            self.assertEqual(record.read_text().split(), ["info", "build"])

    def test_real_run_fails_when_smoke_fails(self):
        with __import__("tempfile").TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp, run_rc=1)
            out = self._run_driver("--smoke", env=self._env(tmp))
            self.assertNotEqual(out.returncode, 0)
            self.assertNotIn("OK", out.stdout)
            self.assertEqual(record.read_text().split(), ["info", "build", "run"])

    def test_real_run_prints_ok_only_when_every_step_succeeds(self):
        # Positive control: proves the recording substitute actually exercises
        # the real execution path (info -> build -> run) and that OK is
        # printed only in that case.
        with __import__("tempfile").TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp)
            out = self._run_driver("--smoke", env=self._env(tmp))
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn("OK", out.stdout)
            self.assertEqual(record.read_text().split(), ["info", "build", "run"])


if __name__ == "__main__":
    unittest.main()
