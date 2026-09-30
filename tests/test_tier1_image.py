"""Tier-0 regression coverage for the tier-1 slim test image and its driver.

Static checks only (no Docker required): the Dockerfile must exist and stay
slim (no Postgres/pgvector/gbrain/OpenShell policy machinery), and the driver
script must be executable with a --help/--dry-run surface. Live build/smoke
evidence is produced by scripts/test-tier1.sh itself and recorded under
docs/evidence/ per the execution plan.
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
            [str(DRIVER), "--dry-run"], capture_output=True, text=True, timeout=30
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


if __name__ == "__main__":
    unittest.main()
