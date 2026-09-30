"""Tier-0 regression coverage for slice-2 driver behavior: install selection.

Covers .env.example completeness, exactly-one-selector fail-fast behavior,
the slice-2 container contract (read-only repo mount, in-container
apply/check, tarball staging for source mode), and the --probe surface.

Behavioral tests use a recording docker substitute on a controlled PATH and
TIER1_ENV_FILE pointing at temp env files; they never contact real Docker
and never run the fork's release:pack (source-mode real runs are covered by
the acceptance evidence run, not by tier-0 tests).
"""

from __future__ import annotations

import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DRIVER = REPO / "scripts" / "test-tier1.sh"
ENV_EXAMPLE = REPO / ".env.example"
GITIGNORE = REPO / ".gitignore"


class TestEnvExample(unittest.TestCase):
    def test_env_example_documents_both_selectors_and_exactly_one(self):
        text = ENV_EXAMPLE.read_text()
        self.assertIn("PRIME_AGENT_PINNED", text)
        self.assertIn("PRIME_AGENT_SOURCE", text)
        self.assertRegex(text, re.compile(r"exactly one", re.I))

    def test_env_is_gitignored(self):
        lines = [l.strip() for l in GITIGNORE.read_text().splitlines()]
        self.assertIn(".env", lines, ".env must be gitignored")


class TestDriverSlice2Statics(unittest.TestCase):
    def test_container_contract(self):
        text = DRIVER.read_text()
        self.assertIn("/workspace:ro", text)  # repo bind-mounted read-only
        self.assertIn("apply-prime-agent-plugin.sh", text)
        self.assertIn("check-prime-agent-plugin.sh", text)
        self.assertIn("file:///stage", text)  # tarball staging base URL
        self.assertIn("pack-prime-agent-release.mjs", text)

    def test_probe_surface(self):
        text = DRIVER.read_text()
        self.assertIn("--probe", text)
        self.assertIn("get_commands", text)
        # The probe gets a hard deadline (slice-1 hang lesson).
        self.assertRegex(text, r"timeout \d+ prime-agent --mode rpc")

    def test_env_file_override_hook(self):
        self.assertIn("TIER1_ENV_FILE", DRIVER.read_text())


class TestDriverSelectorBehavior(unittest.TestCase):
    """Fail-fast and plan behavior for install selection.

    The recording docker substitute logs full args ("$*"), one line per
    invocation, so tests can assert both the invocation sequence and the
    content of the container run command. All tests set TIER1_ENV_FILE to a
    temp file, so a real .env in the repo root is never read.
    """

    def _env(self, env_file, *path_dirs):
        env = dict(os.environ)
        env["PATH"] = os.pathsep.join(
            [str(d) for d in path_dirs] + ["/usr/bin", "/bin"])
        env["TIER1_ENV_FILE"] = str(env_file)
        return env

    def _make_fake_docker(self, tmp_path, *, info_rc=0, build_rc=0, run_rc=0):
        record = tmp_path / "docker-invocations.log"
        script = tmp_path / "docker"
        script.write_text(
            "#!/usr/bin/env bash\n"
            f'echo "$*" >> "{record}"\n'
            'case "$1" in\n'
            f"  info) exit {info_rc} ;;\n"
            f"  build) exit {build_rc} ;;\n"
            f'  run) echo "fake-container-output"; exit {run_rc} ;;\n'
            "  *) exit 0 ;;\n"
            "esac\n"
        )
        script.chmod(0o755)
        return record

    def _make_fake_fork(self, tmp_path):
        """Minimal fork checkout shape the driver validates against."""
        fork = tmp_path / "fork"
        (fork / "scripts").mkdir(parents=True)
        pack = fork / "scripts" / "pack-prime-agent-release.mjs"
        # Marker: if the driver ever EXECUTES the pack script outside a real
        # source-mode run, the marker appears and the test fails.
        pack.write_text(
            "#!/usr/bin/env node\n"
            f'require("node:fs").writeFileSync({str(tmp_path / "pack-executed")!r}, "x");\n'
        )
        pkg = fork / "packages" / "coding-agent"
        pkg.mkdir(parents=True)
        (pkg / "package.json").write_text(
            '{ "name": "@earendil-works/pi-coding-agent", "version": "0.9.8" }\n'
        )
        return fork

    def _run(self, *args, env):
        return subprocess.run(
            [str(DRIVER), *args], capture_output=True, text=True,
            timeout=30, env=env,
        )

    def test_missing_env_file_fails_fast(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp)
            env = self._env(tmp / "absent.env", tmp)
            out = self._run("--dry-run", env=env)
            self.assertNotEqual(out.returncode, 0)
            self.assertIn("missing env file", out.stderr)
            self.assertFalse(record.exists(), "fail-fast must precede docker")

    def test_neither_selector_fails_fast(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp)
            env_file = tmp / "neither.env"
            env_file.write_text("PRIME_AGENT_PINNED=\n# PRIME_AGENT_SOURCE=\n")
            out = self._run("--dry-run", env=self._env(env_file, tmp))
            self.assertNotEqual(out.returncode, 0)
            self.assertIn("exactly one", out.stderr)
            self.assertFalse(record.exists(), "fail-fast must precede docker")

    def test_both_selectors_fail_fast(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp)
            env_file = tmp / "both.env"
            env_file.write_text(
                "PRIME_AGENT_PINNED=0.9.3\nPRIME_AGENT_SOURCE=/tmp/x\n")
            out = self._run("--dry-run", env=self._env(env_file, tmp))
            self.assertNotEqual(out.returncode, 0)
            self.assertIn("exactly one", out.stderr)
            self.assertFalse(record.exists(), "fail-fast must precede docker")

    def test_source_must_be_an_existing_checkout(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp)
            env_file = tmp / "bad.env"
            env_file.write_text("PRIME_AGENT_SOURCE=/no/such/dir\n")
            out = self._run("--dry-run", env=self._env(env_file, tmp))
            self.assertNotEqual(out.returncode, 0)
            self.assertIn("PRIME_AGENT_SOURCE", out.stderr)
            self.assertFalse(record.exists(), "fail-fast must precede docker")

    def test_pinned_dry_run_plans_vendor_installer(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp, info_rc=1, build_rc=1, run_rc=1)
            env_file = tmp / "pinned.env"
            env_file.write_text("PRIME_AGENT_PINNED=0.9.3\n")
            out = self._run("--dry-run", env=self._env(env_file, tmp))
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn("dry-run: docker build", out.stdout)
            self.assertIn("dry-run: docker run --rm", out.stdout)
            self.assertIn("PRIME_AGENT_VERSION=0.9.3", out.stdout)
            self.assertIn("install.sh", out.stdout)
            self.assertIn(":/workspace:ro", out.stdout)
            self.assertFalse(
                record.exists(), "--dry-run must never invoke docker")

    def test_source_dry_run_plans_release_pack_and_staging(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp, info_rc=1, build_rc=1, run_rc=1)
            fork = self._make_fake_fork(tmp)
            env_file = tmp / "source.env"
            env_file.write_text(f"PRIME_AGENT_SOURCE={fork}\n")
            out = self._run("--dry-run", env=self._env(env_file, tmp))
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn("pack-prime-agent-release.mjs", out.stdout)
            self.assertIn("file:///stage", out.stdout)
            self.assertIn("/stage/releases/v0.9.8:ro", out.stdout)
            self.assertFalse(
                record.exists(), "--dry-run must never invoke docker")
            self.assertFalse(
                (tmp / "pack-executed").exists(),
                "--dry-run must never execute the fork's release:pack")

    def test_pinned_real_run_invokes_info_build_run_once(self):
        # Positive control: the real pinned path contacts docker exactly as
        # info -> build -> run, and the container run command carries the
        # slice-2 contract (read-only repo mount, vendor-installer pinned
        # install, in-container apply + check).
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp)
            env_file = tmp / "pinned.env"
            env_file.write_text("PRIME_AGENT_PINNED=0.9.3\n")
            out = self._run(env=self._env(env_file, tmp))
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn("OK", out.stdout)
            invocations = record.read_text().splitlines()
            self.assertEqual(
                [line.split()[0] for line in invocations],
                ["info", "build", "run"])
            run_line = invocations[2]
            self.assertIn(":/workspace:ro", run_line)
            self.assertIn("PRIME_AGENT_VERSION='0.9.3'", run_line)
            self.assertIn("install.sh", run_line)
            self.assertIn("apply-prime-agent-plugin.sh", run_line)
            self.assertIn("check-prime-agent-plugin.sh", run_line)

    def test_smoke_mode_skips_env_validation(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            env = self._env(tmp / "absent.env", tmp)
            out = self._run("--dry-run", "--smoke", env=env)
            self.assertEqual(out.returncode, 0, out.stderr)


if __name__ == "__main__":
    unittest.main()
