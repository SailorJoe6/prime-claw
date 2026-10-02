"""Tier-0 regression coverage for slice-2 driver behavior: install selection,
fresh-artifact packing (B1), probe reply validation (B2), and the hard probe
deadline (B3).

Covers .env.example completeness, exactly-one-selector fail-fast behavior,
the slice-2 container contract (read-only repo mount, in-container
apply/check, tarball staging for source mode), the source-mode fresh-build
contract, and the --probe surface.

Behavioral tests use recording docker/node/npm substitutes on a controlled
PATH and TIER1_ENV_FILE pointing at temp env files; they never contact real
Docker and never execute the real fork build or pack (real runs are covered
by the acceptance evidence note, not by tier-0 tests).

The probe validator is embedded in the driver as a heredoc (it runs inside
the container). The tests extract that exact heredoc and exercise it with
the host python3 against fixtures, so the tested code is the shipped code.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DRIVER = REPO / "scripts" / "test-tier1.sh"
ENV_EXAMPLE = REPO / ".env.example"
GITIGNORE = REPO / ".gitignore"

EXT = "/root/.prime/agent/extensions"


def _validator_source():
    m = re.search(r"<<'PYEOF' \|\| true\n(.*?)\nPYEOF",
                  DRIVER.read_text(), re.S)
    if not m:
        raise AssertionError("probe validator heredoc not found in driver")
    return m.group(1)


def _cmd(name, path):
    return {"name": name, "description": "...", "source": "extension",
            "sourceInfo": {"path": path, "source": "auto", "scope": "user",
                           "origin": "top-level", "baseDir": "/root/.prime/agent"}}


GOOD_COMMANDS = [
    _cmd("handoff", EXT + "/handoff-chain.ts"),
    _cmd("plan", EXT + "/reviewed-plan.ts"),
    _cmd("implement-spec", EXT + "/reviewed-plan.ts"),
]


def _reply(commands=None, success=True):
    return json.dumps({
        "id": "loader", "type": "response", "command": "get_commands",
        "success": success,
        "data": {"commands": GOOD_COMMANDS if commands is None else commands},
    })


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

    def test_source_mode_fresh_build_contract(self):
        """B1: freshness is a fresh build, never a cache-validity guess."""
        text = DRIVER.read_text()
        self.assertNotIn("MISSING_DIST", text,
                         "directory existence must not gate the build")
        self.assertIn('rm -rf "${SOURCE:?}/$p/dist"', text,
                      "pack-consumed dist dirs must be removed before build")
        # Real-execution order: fresh build -> pack -> container run.
        tail = text[text.index("docker info"):]
        self.assertLess(tail.index("npm run build"),
                        tail.index("pack-prime-agent-release.mjs"))
        self.assertLess(tail.index("pack-prime-agent-release.mjs"),
                        tail.index("docker run --rm ${MOUNTS"))

    def test_probe_surface(self):
        """B2/B3: validated reply under a hard, kill-escalating deadline."""
        text = DRIVER.read_text()
        self.assertIn("--probe", text)
        self.assertIn("get_commands", text)
        # Hard deadline: TERM escalates to KILL after a fixed grace.
        self.assertIn("timeout --kill-after=$PROBE_KILL_GRACE "
                      "$PROBE_DEADLINE prime-agent --mode rpc", text)
        self.assertIn('TIER1_PROBE_DEADLINE', text)
        self.assertIn('TIER1_PROBE_KILL_GRACE', text)
        # Output goes to files, never a pipe the driver could block on.
        self.assertIn("> /tmp/tier1-probe/probe.jsonl", text)
        self.assertIn("2> /tmp/tier1-probe/probe.err", text)
        # Semantic validation of the captured reply happens in-container.
        self.assertIn("<<'PYEOF'", text)
        self.assertIn("base64 -d > /tmp/tier1-probe/validate.py", text)
        self.assertIn("python3 /tmp/tier1-probe/validate.py "
                      "/tmp/tier1-probe/probe.jsonl", text)

    def test_env_file_override_hook(self):
        self.assertIn("TIER1_ENV_FILE", DRIVER.read_text())


class _FakeEnvMixin:
    """Recording docker/node/npm substitutes on a controlled PATH."""

    def _env(self, env_file, *path_dirs, extra=None):
        env = dict(os.environ)
        env["PATH"] = os.pathsep.join(
            [str(d) for d in path_dirs] + ["/usr/bin", "/bin"])
        env["TIER1_ENV_FILE"] = str(env_file)
        if extra:
            env.update(extra)
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

    def _make_fake_npm(self, tmp_path, *, build_rc=0):
        """Fake npm: 'npm run build' regenerates dist markers from src.

        Like the real fork build (tsgo), it does NOT clean dist first — a
        stale file planted in dist survives the build unless the DRIVER
        removes dist. That asymmetry is what the B1 tests assert on.
        """
        record = tmp_path / "npm-invocations.log"
        script = tmp_path / "npm"
        script.write_text(
            "#!/usr/bin/env bash\n"
            f'echo "$*" >> "{record}"\n'
            'if [ "$1" = "run" ] && [ "$2" = "build" ]; then\n'
            "  for p in packages/coding-agent packages/agent packages/ai packages/tui; do\n"
            '    mkdir -p "$p/dist"\n'
            '    cp src/marker.txt "$p/dist/marker.txt" || exit 1\n'
            "  done\n"
            f"  exit {build_rc}\n"
            "fi\n"
            "exit 0\n"
        )
        script.chmod(0o755)
        return record

    def _make_fake_node(self, tmp_path, *, pack_rc=0):
        """Fake node: models release:pack's copy-existing-dist behavior.

        Wipes the --out-dir (like the real packer's rmSync), then packs the
        CURRENT dist marker into the tarball, so tests can see exactly which
        compiled output a run packaged.
        """
        record = tmp_path / "node-invocations.log"
        script = tmp_path / "node"
        script.write_text(
            "#!/usr/bin/env bash\n"
            f'echo "$*" >> "{record}"\n'
            'out=""; prev=""\n'
            'for a in "$@"; do\n'
            '  if [ "$prev" = "--out-dir" ]; then out="$a"; fi\n'
            '  prev="$a"\n'
            "done\n"
            'if [ -n "$out" ]; then\n'
            f"  [ {pack_rc} -eq 0 ] || exit {pack_rc}\n"
            '  rm -rf "$out"\n'
            '  mkdir -p "$out/artifacts"\n'
            '  cp "$(dirname "$out")/../dist/marker.txt" "$out/artifacts/prime-agent-0.9.8.tgz"\n'
            "fi\n"
            "exit 0\n"
        )
        script.chmod(0o755)
        return record

    def _make_fake_fork(self, tmp_path, *, marker="MARKER-A", with_dist=True):
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
        (fork / "src").mkdir()
        (fork / "src" / "marker.txt").write_text(marker)
        if with_dist:
            for p in ("packages/coding-agent", "packages/agent",
                      "packages/ai", "packages/tui"):
                dist = fork / p / "dist"
                dist.mkdir(parents=True, exist_ok=True)
                # Stale leftovers from a previous build: an old marker and a
                # removed/renamed output that a fresh build would NOT write.
                (dist / "marker.txt").write_text("STALE-OLD")
                (dist / "stale-output.js").write_text("stale")
        return fork

    def _run(self, *args, env):
        return subprocess.run(
            [str(DRIVER), *args], capture_output=True, text=True,
            timeout=30, env=env,
        )


class TestDriverSelectorBehavior(_FakeEnvMixin, unittest.TestCase):
    """Fail-fast and plan behavior for install selection.

    The recording docker substitute logs full args ("$*"), one line per
    invocation, so tests can assert both the invocation sequence and the
    content of the container run command. All tests set TIER1_ENV_FILE to a
    temp file, so a real .env in the repo root is never read.
    """

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

    def test_source_dry_run_plans_fresh_build_pack_and_staging(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = self._make_fake_docker(tmp, info_rc=1, build_rc=1, run_rc=1)
            npm_log = self._make_fake_npm(tmp)
            node_log = self._make_fake_node(tmp)
            fork = self._make_fake_fork(tmp)
            env_file = tmp / "source.env"
            env_file.write_text(f"PRIME_AGENT_SOURCE={fork}\n")
            out = self._run("--dry-run", "--probe",
                            env=self._env(env_file, tmp))
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn("pack-prime-agent-release.mjs", out.stdout)
            self.assertIn("file:///stage", out.stdout)
            self.assertIn("/stage/releases/v0.9.8:ro", out.stdout)
            self.assertIn("npm run build", out.stdout)  # plans a FRESH build
            self.assertIn("dry-run: container RPC probe", out.stdout)
            # Informational path: no build, no pack, no docker — B1 rule.
            self.assertFalse(
                record.exists(), "--dry-run must never invoke docker")
            self.assertFalse(
                npm_log.exists(), "--dry-run must never run the fork build")
            self.assertFalse(
                node_log.exists(), "--dry-run must never execute release:pack")
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


class TestSourceModeFreshness(_FakeEnvMixin, unittest.TestCase):
    """B1: every real source-mode run packs FRESH artifacts."""

    def _source_run(self, tmp, **fake_kw):
        npm_log = self._make_fake_npm(tmp, build_rc=fake_kw.get("build_rc", 0))
        node_log = self._make_fake_node(tmp, pack_rc=fake_kw.get("pack_rc", 0))
        docker_log = self._make_fake_docker(tmp)
        env_file = tmp / "source.env"
        fork = fake_kw["fork"]
        env_file.write_text(f"PRIME_AGENT_SOURCE={fork}\n")
        out = self._run(env=self._env(env_file, tmp))
        return out, npm_log, node_log, docker_log

    def test_real_run_builds_fresh_and_packs_current_source(self):
        """All dist dirs present (stale), source at marker A: the run must
        still rebuild, remove stale outputs, and pack marker A."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = self._make_fake_fork(tmp, marker="MARKER-A", with_dist=True)
            out, npm_log, node_log, docker_log = self._source_run(
                tmp, fork=fork)
            self.assertEqual(out.returncode, 0, out.stderr)
            self.assertIn("OK", out.stdout)
            # Fresh build happened even though every dist dir existed.
            self.assertEqual(npm_log.read_text().strip(), "run build")
            # Invocation order on the host: npm build -> node pack.
            self.assertIn("pack-prime-agent-release.mjs",
                          node_log.read_text())
            # Stale outputs removed by the driver; fresh marker installed.
            for p in ("packages/coding-agent", "packages/agent",
                      "packages/ai", "packages/tui"):
                dist = fork / p / "dist"
                self.assertFalse((dist / "stale-output.js").exists(),
                                 f"driver must remove stale {p} outputs")
                self.assertEqual((dist / "marker.txt").read_text(),
                                 "MARKER-A")
            # The packed artifact carries the CURRENT marker, not the stale
            # one (fake pack models the real copy-existing-dist behavior).
            tarball = (fork / "packages/coding-agent/release/tier1"
                       "/artifacts/prime-agent-0.9.8.tgz")
            self.assertEqual(tarball.read_text(), "MARKER-A")
            invocations = docker_log.read_text().splitlines()
            self.assertEqual([l.split()[0] for l in invocations],
                             ["info", "build", "run"])
            run_line = invocations[2]
            self.assertIn(":/workspace:ro", run_line)
            self.assertIn("/stage/releases/v0.9.8:ro", run_line)
            self.assertIn("npm install -g "
                          "/stage/releases/v0.9.8/prime-agent-0.9.8.tgz",
                          run_line)

    def test_replay_after_source_change_packages_changed_implementation(self):
        """Change source WITHOUT changing the version: the next run must
        package the changed implementation (the B1 replay acceptance)."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = self._make_fake_fork(tmp, marker="MARKER-A", with_dist=True)
            out1, _, _, _ = self._source_run(tmp, fork=fork)
            self.assertEqual(out1.returncode, 0, out1.stderr)
            tarball = (fork / "packages/coding-agent/release/tier1"
                       "/artifacts/prime-agent-0.9.8.tgz")
            self.assertEqual(tarball.read_text(), "MARKER-A")
            # Same version, changed source.
            (fork / "src" / "marker.txt").write_text("MARKER-B")
            out2, npm_log, _, _ = self._source_run(tmp, fork=fork)
            self.assertEqual(out2.returncode, 0, out2.stderr)
            self.assertEqual(npm_log.read_text().strip().splitlines(),
                             ["run build", "run build"],
                             "second run must build fresh again")
            self.assertEqual(tarball.read_text(), "MARKER-B",
                             "run after a source change must pack the "
                             "changed implementation, not a stale replay")

    def test_build_failure_stops_before_pack_and_container(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = self._make_fake_fork(tmp, with_dist=True)
            out, _, node_log, docker_log = self._source_run(
                tmp, fork=fork, build_rc=1)
            self.assertNotEqual(out.returncode, 0)
            self.assertNotIn("OK", out.stdout)
            self.assertFalse(node_log.exists(),
                             "build failure must stop before release:pack")
            # Fail-fast ladder: only the readiness probe ran — no image
            # build, no container run.
            self.assertEqual(
                [l.split()[0] for l in docker_log.read_text().splitlines()],
                ["info"])

    def test_pack_failure_stops_before_container_install(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = self._make_fake_fork(tmp, with_dist=True)
            out, npm_log, _, docker_log = self._source_run(
                tmp, fork=fork, pack_rc=1)
            self.assertNotEqual(out.returncode, 0)
            self.assertNotIn("OK", out.stdout)
            self.assertTrue(npm_log.exists(), "build runs before pack")
            # Fail-fast ladder: only the readiness probe ran — no image
            # build, no container run, no fallback to previous artifacts.
            invocations = docker_log.read_text().splitlines()
            self.assertEqual([l.split()[0] for l in invocations], ["info"])

    def test_unsearchable_dist_parent_fails_closed_before_pack(self):
        """B1-R driver edge: an unsearchable dist PARENT (packages/agent
        not searchable). On this host rm -rf exits 0 WITHOUT removing the
        tree (detection defers to npm build, which fails on the
        permission denial); on hosts where rm -rf reports the error,
        set -e stops even earlier. Either way the driver fails closed
        BEFORE pack/image-build/container — this test asserts that
        contract without pinning which step detects it."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = self._make_fake_fork(tmp, with_dist=True)
            blocked = fork / "packages" / "agent"
            blocked.chmod(0o444)  # readable, NOT searchable
            try:
                out, _, node_log, docker_log = self._source_run(
                    tmp, fork=fork)
            finally:
                blocked.chmod(0o755)
            self.assertNotEqual(out.returncode, 0,
                                f"driver must fail closed; stdout={out.stdout!r}")
            self.assertNotIn("OK", out.stdout)
            self.assertFalse(node_log.exists(),
                             "must fail before release:pack")
            self.assertEqual(
                [l.split()[0] for l in docker_log.read_text().splitlines()],
                ["info"], "no image build, no container run")
            self.assertTrue(
                (blocked / "dist" / "stale-output.js").exists(),
                "the unremovable stale tree survives — nothing packed it")


class TestProbeDeadline(_FakeEnvMixin, unittest.TestCase):
    """B3: the generated container command carries a hard, scaled deadline."""

    def _pinned_probe_run(self, tmp, extra_env=None):
        record = self._make_fake_docker(tmp)
        env_file = tmp / "pinned.env"
        env_file.write_text("PRIME_AGENT_PINNED=0.9.3\n")
        out = self._run("--probe",
                        env=self._env(env_file, tmp, extra=extra_env))
        self.assertEqual(out.returncode, 0, out.stderr)
        invocations = record.read_text().splitlines()
        return [l for l in invocations if l.startswith("run")][0]

    def test_probe_command_defaults(self):
        with tempfile.TemporaryDirectory() as td:
            run_line = self._pinned_probe_run(Path(td))
            self.assertIn("--kill-after=5 60 prime-agent --mode rpc",
                          run_line)

    def test_probe_command_scales_via_env(self):
        with tempfile.TemporaryDirectory() as td:
            run_line = self._pinned_probe_run(
                Path(td),
                extra_env={"TIER1_PROBE_DEADLINE": "7",
                           "TIER1_PROBE_KILL_GRACE": "2"})
            self.assertIn("--kill-after=2 7 prime-agent --mode rpc",
                          run_line)

    def test_probe_command_contract(self):
        with tempfile.TemporaryDirectory() as td:
            run_line = self._pinned_probe_run(Path(td))
            # Output to files (no blocking pipe reads by the driver).
            self.assertIn("> /tmp/tier1-probe/probe.jsonl", run_line)
            self.assertIn("2> /tmp/tier1-probe/probe.err", run_line)
            # Probe failure aborts the container command before validation
            # and before any OK.
            self.assertIn("tier-1 probe FAILED", run_line)
            self.assertIn("exit 1", run_line)
            self.assertIn("base64 -d > /tmp/tier1-probe/validate.py",
                          run_line)
            self.assertIn("python3 /tmp/tier1-probe/validate.py "
                          "/tmp/tier1-probe/probe.jsonl", run_line)


class TestProbeValidator(unittest.TestCase):
    """B2: the exact validator embedded in the driver, exercised on the
    host against fixtures (it is stdlib-only by contract)."""

    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self.tmp = Path(self._td.name)
        self.validator = self.tmp / "validate.py"
        self.validator.write_text(_validator_source())

    def tearDown(self):
        self._td.cleanup()

    def _validate(self, fixture_text):
        fixture = self.tmp / "fixture.jsonl"
        fixture.write_text(fixture_text)
        return subprocess.run(
            [sys.executable, str(self.validator), str(fixture)],
            capture_output=True, text=True, timeout=15)

    def assertAccepted(self, fixture_text):
        out = self._validate(fixture_text)
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertIn("probe validation OK", out.stdout)

    def assertRejected(self, fixture_text, needle):
        out = self._validate(fixture_text)
        self.assertNotEqual(out.returncode, 0)
        self.assertIn("probe validation FAILED", out.stderr)
        self.assertIn(needle, out.stderr)
        self.assertNotIn("probe validation OK", out.stdout)

    def test_valid_reply_accepted(self):
        self.assertAccepted(_reply() + "\n")

    def test_unrelated_async_events_are_skipped_not_accepted(self):
        events = ('{"type":"event","name":"session_start"}\n'
                  + _reply() + "\n"
                  + '{"type":"event","name":"idle"}\n')
        self.assertAccepted(events)
        # The events ALONE must never satisfy the probe.
        self.assertRejected('{"type":"event","name":"session_start"}\n',
                            "no matching get_commands reply")

    def test_missing_reply_rejected(self):
        self.assertRejected("", "no matching get_commands reply")

    def test_malformed_json_rejected(self):
        self.assertRejected("not json\n", "malformed JSON on line 1")

    def test_success_false_rejected(self):
        self.assertRejected(_reply(success=False) + "\n",
                            "success is not true")

    def test_empty_command_list_rejected(self):
        self.assertRejected(_reply(commands=[]) + "\n", "present 0 times")

    def test_partial_command_list_rejected(self):
        self.assertRejected(_reply(commands=GOOD_COMMANDS[:2]) + "\n",
                            "implement-spec")

    def test_duplicate_command_rejected(self):
        dup = GOOD_COMMANDS + [dict(GOOD_COMMANDS[0])]
        self.assertRejected(_reply(commands=dup) + "\n", "present 2 times")

    def test_wrong_source_path_rejected(self):
        bad = [dict(GOOD_COMMANDS[0])] + GOOD_COMMANDS[1:]
        bad[0]["sourceInfo"] = dict(GOOD_COMMANDS[0]["sourceInfo"])
        bad[0]["sourceInfo"]["path"] = (
            "/Users/jlanders/.prime/agent/extensions/handoff-chain.ts")
        self.assertRejected(_reply(commands=bad) + "\n",
                            "not sourced from container extensions")

    def test_duplicate_replies_rejected(self):
        self.assertRejected(_reply() + "\n" + _reply() + "\n",
                            "duplicate get_commands replies")

    def test_reply_id_mismatch_rejected(self):
        obj = json.loads(_reply())
        obj["id"] = "other"
        self.assertRejected(json.dumps(obj) + "\n",
                            "no matching get_commands reply")

    def test_extra_unknown_commands_do_not_false_fail(self):
        extra = GOOD_COMMANDS + [_cmd("other-cmd", EXT + "/other.ts")]
        self.assertAccepted(_reply(commands=extra) + "\n")


if __name__ == "__main__":
    unittest.main()
