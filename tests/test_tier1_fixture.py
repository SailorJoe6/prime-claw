"""Tier-0 behavioral coverage for the tier-1 session fixture (tests/conftest.py).

The FINAL EXPERT gate on c53972f found two fixture failure-path defects:

- B1: fixture source staging suppressed stale-output removal failures
  (shutil.rmtree(ignore_errors=True) where the driver fails closed).
- B2: session-container teardown was unverified — a leaked container could
  not fail the gate, and share evidence could be deleted under it.

These tests exercise the ACTUAL fixture code paths
(conftest._remove_dist_tree, conftest._stage_fork_release,
conftest._remove_session_container, conftest._finalize_session) using
recording npm/node/docker substitutes on a controlled PATH. They never
contact real Docker and never run a real fork build; real runs are covered
by the acceptance evidence note.
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))
import conftest  # noqa: E402  (the shipped fixture module under test)

REPO = Path(__file__).resolve().parent.parent
CONFTEST_SRC = Path(conftest.__file__).read_text()
DIST_DIRS = ("packages/coding-agent", "packages/agent",
             "packages/ai", "packages/tui")


def _make_fake_npm(tmp: Path, *, build_rc: int = 0) -> Path:
    """Fake npm: `npm run build` regenerates dist markers from src WITHOUT
    cleaning dist first (like the real tsgo build) — a planted stale file
    survives the build unless the fixture removes dist itself."""
    record = tmp / "npm-invocations.log"
    script = tmp / "npm"
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


def _make_fake_node(tmp: Path, *, pack_rc: int = 0) -> Path:
    """Fake node: models release:pack's copy-existing-dist behavior — wipes
    --out-dir, then packs the CURRENT dist marker into the tarball, so tests
    see exactly which compiled output a run packaged."""
    record = tmp / "node-invocations.log"
    script = tmp / "node"
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


def _make_fake_fork(tmp: Path, *, marker: str = "MARKER-A",
                    with_dist: bool = True) -> Path:
    """Minimal fork checkout shape, with planted stale dist leftovers."""
    fork = tmp / "fork"
    (fork / "scripts").mkdir(parents=True)
    (fork / "scripts" / "pack-prime-agent-release.mjs").write_text(
        "// fake pack entry point — the fake node shim intercepts it\n")
    (fork / "src").mkdir()
    (fork / "src" / "marker.txt").write_text(marker)
    if with_dist:
        for p in DIST_DIRS:
            dist = fork / p / "dist"
            dist.mkdir(parents=True, exist_ok=True)
            (dist / "marker.txt").write_text("STALE-OLD")
            (dist / "stale-output.js").write_text("stale")
    return fork


def _path_override(tmp: Path):
    return mock.patch.dict(
        os.environ, {"PATH": os.pathsep.join([str(tmp), "/usr/bin", "/bin"])})


class TestRemoveDistTree(unittest.TestCase):
    """B1: fail-closed removal semantics for one pack-consumed dist tree."""

    def test_absent_tree_is_fine(self):
        with tempfile.TemporaryDirectory() as td:
            conftest._remove_dist_tree(Path(td) / "nope")  # must not raise

    def test_plain_file_is_unlinked(self):
        with tempfile.TemporaryDirectory() as td:
            f = Path(td) / "dist"
            f.write_text("x")
            conftest._remove_dist_tree(f)
            self.assertFalse(f.exists())

    def test_symlink_is_unlinked_and_target_preserved(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            real = tmp / "real-dist"
            real.mkdir()
            (real / "keep.js").write_text("keep")
            link = tmp / "dist"
            link.symlink_to(real, target_is_directory=True)
            conftest._remove_dist_tree(link)
            self.assertFalse(link.exists() or link.is_symlink())
            self.assertTrue((real / "keep.js").exists(),
                            "a symlink must be unlinked, never recursed")

    def test_permission_denied_raises_instead_of_suppressing(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            dist = tmp / "dist"
            retired = dist / "retired-module"
            retired.mkdir(parents=True)
            (retired / "deleted-source.js").write_text("obsolete")
            retired.chmod(0o555)
            try:
                with self.assertRaises(RuntimeError) as ctx:
                    conftest._remove_dist_tree(dist)
            finally:
                retired.chmod(0o755)  # let TemporaryDirectory clean up
            self.assertIn("cannot remove stale build output",
                          str(ctx.exception))
            self.assertTrue((retired / "deleted-source.js").exists(),
                            "denied cleanup must leave the tree untouched")


class TestStageForkRelease(unittest.TestCase):
    """B1: the fixture's source staging is fail-closed and always fresh."""

    def _run_staging(self, fork: Path, tmp: Path):
        with _path_override(tmp):
            return conftest._stage_fork_release(str(fork))

    def test_stale_outputs_removed_and_current_source_packed(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            npm_log = _make_fake_npm(tmp)
            node_log = _make_fake_node(tmp)
            fork = _make_fake_fork(tmp, marker="MARKER-A", with_dist=True)
            version, artifacts = self._run_staging(fork, tmp)
            self.assertEqual(version, "0.9.8")
            self.assertEqual(
                artifacts,
                fork / "packages/coding-agent/release/tier1/artifacts")
            self.assertEqual(npm_log.read_text().strip(), "run build")
            self.assertIn("pack-prime-agent-release.mjs",
                          node_log.read_text())
            for p in DIST_DIRS:
                dist = fork / p / "dist"
                self.assertFalse((dist / "stale-output.js").exists(),
                                 f"stale {p} output must be removed")
                self.assertEqual((dist / "marker.txt").read_text(),
                                 "MARKER-A")
            self.assertEqual(
                (artifacts / "prime-agent-0.9.8.tgz").read_text(),
                "MARKER-A", "the packed artifact must be the fresh build")

    def test_replay_after_source_change_packs_changed_implementation(self):
        """Source change WITHOUT a version change: the next staging packs
        the changed implementation (the B1 replay acceptance)."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_npm(tmp)
            _make_fake_node(tmp)
            fork = _make_fake_fork(tmp, marker="MARKER-A", with_dist=True)
            version1, artifacts = self._run_staging(fork, tmp)
            tarball = artifacts / "prime-agent-0.9.8.tgz"
            self.assertEqual(tarball.read_text(), "MARKER-A")
            (fork / "src" / "marker.txt").write_text("MARKER-B")
            version2, _ = self._run_staging(fork, tmp)
            self.assertEqual((version1, version2), ("0.9.8", "0.9.8"))
            self.assertEqual(tarball.read_text(), "MARKER-B",
                             "staging after a source change must pack the "
                             "changed implementation, not a stale replay")

    def test_cleanup_denial_stops_before_build_and_pack(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            npm_log = _make_fake_npm(tmp)
            node_log = _make_fake_node(tmp)
            fork = _make_fake_fork(tmp, with_dist=True)
            retired = fork / "packages/agent/dist/retired-module"
            retired.mkdir()
            victim = retired / "deleted-source.js"
            victim.write_text("obsolete")
            retired.chmod(0o555)
            try:
                with self.assertRaises(RuntimeError) as ctx:
                    self._run_staging(fork, tmp)
            finally:
                retired.chmod(0o755)
            self.assertIn("cannot remove stale build output",
                          str(ctx.exception))
            self.assertFalse(npm_log.exists(),
                             "cleanup failure must stop BEFORE npm build")
            self.assertFalse(node_log.exists(),
                             "cleanup failure must stop BEFORE release:pack")
            self.assertTrue(victim.exists(),
                            "denied cleanup leaves the stale tree untouched")
            self.assertFalse(
                (fork / "packages/coding-agent/release/tier1").exists(),
                "no staging artifacts may appear after a cleanup failure")

    def test_build_failure_fails_closed_before_pack(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            npm_log = _make_fake_npm(tmp, build_rc=1)
            node_log = _make_fake_node(tmp)
            fork = _make_fake_fork(tmp, with_dist=True)
            with self.assertRaises(subprocess.CalledProcessError):
                self._run_staging(fork, tmp)
            self.assertEqual(npm_log.read_text().strip(), "run build")
            self.assertFalse(node_log.exists(),
                             "build failure must stop before release:pack")

    def test_pack_failure_fails_closed_without_fallback_artifacts(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            npm_log = _make_fake_npm(tmp)
            _make_fake_node(tmp, pack_rc=1)
            fork = _make_fake_fork(tmp, with_dist=True)
            with self.assertRaises(subprocess.CalledProcessError):
                self._run_staging(fork, tmp)
            self.assertTrue(npm_log.exists(), "build runs before pack")
            self.assertFalse(
                (fork / "packages/coding-agent/release/tier1"
                 "/artifacts/prime-agent-0.9.8.tgz").exists(),
                "a failed pack leaves no fallback tarball")

    def test_missing_dist_trees_are_a_valid_positive_case(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_npm(tmp)
            _make_fake_node(tmp)
            fork = _make_fake_fork(tmp, marker="MARKER-A", with_dist=False)
            version, artifacts = self._run_staging(fork, tmp)
            self.assertEqual(version, "0.9.8")
            self.assertEqual(
                (artifacts / "prime-agent-0.9.8.tgz").read_text(),
                "MARKER-A")


def _make_fake_docker(tmp: Path, *, rm_rc: int = 0, inspect_rc: int = 1,
                      rm_sleep: int = 0, rm_stderr: str = "") -> Path:
    """Recording docker substitute: rm/inspect behavior is programmable;
    every invocation is logged, one full argv per line."""
    record = tmp / "docker-invocations.log"
    script = tmp / "docker"
    stderr_line = f'echo "{rm_stderr}" >&2\n      ' if rm_stderr else ""
    script.write_text(
        "#!/usr/bin/env bash\n"
        f'echo "$*" >> "{record}"\n'
        'case "$1" in\n'
        f"  rm) sleep {rm_sleep}\n"
        f"      {stderr_line}exit {rm_rc} ;;\n"
        f"  inspect) exit {inspect_rc} ;;\n"
        "  *) exit 0 ;;\n"
        "esac\n"
    )
    script.chmod(0o755)
    return record


def _make_share(tmp: Path) -> Path:
    share = tmp / "share"
    (share / "evidence").mkdir(parents=True)
    (share / "evidence" / "setup.log").write_text("setup log")
    return share


class TestSessionTeardown(unittest.TestCase):
    """B2: container teardown is verified, bounded, and part of the gate."""

    CID = "abc123def456"

    def _finalize(self, container_id, share: Path, tmp: Path, *,
                  in_flight=None, keep_share: str = ""):
        env = {"PATH": os.pathsep.join([str(tmp), "/usr/bin", "/bin"]),
               "TIER1_KEEP_SHARE": keep_share}
        with mock.patch.dict(os.environ, env):
            return conftest._finalize_session(container_id, share, in_flight)

    def test_positive_teardown_verifies_absence_and_removes_share(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = _make_fake_docker(tmp, rm_rc=0, inspect_rc=1)
            share = _make_share(tmp)
            self._finalize(self.CID, share, tmp)
            self.assertFalse(share.exists(),
                             "share is removed once absence is verified")
            self.assertEqual(record.read_text().splitlines(),
                             [f"rm -f {self.CID}", f"inspect {self.CID}"],
                             "teardown = one forced removal + one absence "
                             "verification, in that order")

    def test_removal_failure_fails_gate_with_identity_and_diagnostics(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(tmp, rm_rc=1, inspect_rc=0,
                              rm_stderr="Error: daemon said no")
            share = _make_share(tmp)
            with self.assertRaises(RuntimeError) as ctx:
                self._finalize(self.CID, share, tmp)
            msg = str(ctx.exception)
            self.assertIn("TEARDOWN FAILED", msg)
            self.assertIn(self.CID, msg, "exact container identity required")
            self.assertIn("exited 1", msg)
            self.assertIn("daemon said no", msg, "diagnostics retained")
            self.assertTrue((share / "evidence/setup.log").exists(),
                            "share evidence must NOT be deleted while the "
                            "container may still own it")

    def test_unverified_absence_after_successful_rm_fails_gate(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(tmp, rm_rc=0, inspect_rc=0)
            share = _make_share(tmp)
            with self.assertRaises(RuntimeError) as ctx:
                self._finalize(self.CID, share, tmp)
            self.assertIn("TEARDOWN FAILED", str(ctx.exception))
            self.assertTrue(share.exists())

    def test_removal_timeout_fails_closed_with_diagnostics(self):
        """A removal timeout ALWAYS fails the gate — even when a later
        inspect verifies absence — because a hung docker CLI is itself a
        teardown anomaly. The message records the verified-absence nuance."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = _make_fake_docker(tmp, rm_sleep=2, inspect_rc=1)
            with _path_override(tmp):
                with self.assertRaises(RuntimeError) as ctx:
                    conftest._remove_session_container(self.CID,
                                                       rm_timeout=0.5)
            msg = str(ctx.exception)
            self.assertIn("timed out", msg)
            self.assertIn(self.CID, msg)
            self.assertIn("absent=True", msg,
                          "the verified-absence nuance is retained in the "
                          "diagnostics even though the timeout fails closed")
            self.assertTrue(record.exists(),
                            "the bounded single removal attempt is recorded")

    def test_idempotent_already_absent_is_success(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = _make_fake_docker(
                tmp, rm_rc=1, inspect_rc=1,
                rm_stderr=f"Error: No such container: {self.CID}")
            share = _make_share(tmp)
            self._finalize(self.CID, share, tmp)  # must not raise
            self.assertFalse(share.exists())
            self.assertEqual(record.read_text().splitlines(),
                             [f"rm -f {self.CID}", f"inspect {self.CID}"],
                             "already-absent is OK only because absence is "
                             "positively established")

    def test_unpublished_container_never_touches_docker(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = _make_fake_docker(tmp)
            share = _make_share(tmp)
            self._finalize(None, share, tmp)
            self.assertFalse(share.exists())
            self.assertFalse(record.exists(),
                             "no docker call when no container was published")

    def test_setup_failure_plus_teardown_failure_preserves_both(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(tmp, rm_rc=1, inspect_rc=0,
                              rm_stderr="boom")
            share = _make_share(tmp)
            original = ValueError("container setup failed")
            # Must NOT raise: the in-flight setup failure stays primary.
            self._finalize(self.CID, share, tmp, in_flight=original)
            self.assertEqual(str(original), "container setup failed")
            notes = getattr(original, "__notes__", [])
            self.assertTrue(
                any("teardown also failed" in n and self.CID in n
                    for n in notes),
                "the teardown failure must be attached to the original "
                f"failure as a note; got notes={notes!r}")
            self.assertTrue(share.exists())

    def test_keep_share_env_preserves_share_on_success(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(tmp, rm_rc=0, inspect_rc=1)
            share = _make_share(tmp)
            self._finalize(self.CID, share, tmp, keep_share="1")
            self.assertTrue(share.exists())

    def test_teardown_never_targets_other_containers(self):
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            record = _make_fake_docker(tmp, rm_rc=0, inspect_rc=1)
            share = _make_share(tmp)
            self._finalize(self.CID, share, tmp)
            lines = record.read_text().splitlines()
            self.assertTrue(lines)
            for line in lines:
                self.assertIn(self.CID, line,
                              "every docker invocation must be scoped to "
                              "the one captured container ID")
                self.assertNotIn("prune", line)
                self.assertNotIn("--all", line)


class _FakeItem:
    """Minimal pytest Item stand-in for the collection-policy hook."""

    def __init__(self, fixturenames):
        self.fixturenames = fixturenames
        self.markers = []

    def add_marker(self, marker):
        self.markers.append(marker)

    def get_closest_marker(self, name):
        for m in reversed(self.markers):
            if getattr(m, "name", None) == name:
                return m
        return None


class TestDryRunEquivalent(unittest.TestCase):
    """The fixture-level dry-run-equivalent: a default `pytest tests/ -q`
    invocation makes no build/pack/docker call, ever."""

    def test_default_invocation_skips_container_tests_at_collection(self):
        item = _FakeItem(["tier1_container"])
        cfg = SimpleNamespace(option=SimpleNamespace(markexpr=""))
        conftest.pytest_collection_modifyitems(cfg, [item])
        names = [m.name for m in item.markers]
        self.assertIn("container", names)
        self.assertIn("skip", names,
                      "without an explicit -m, fixture users are skipped "
                      "at collection — the fixture (and its build/pack/"
                      "docker calls) never runs")

    def test_unmarked_tier0_test_is_untouched(self):
        item = _FakeItem([])
        cfg = SimpleNamespace(option=SimpleNamespace(markexpr=""))
        conftest.pytest_collection_modifyitems(cfg, [item])
        self.assertEqual(item.markers, [])

    def test_explicit_mark_selection_does_not_skip(self):
        item = _FakeItem(["tier1_container"])
        cfg = SimpleNamespace(option=SimpleNamespace(markexpr="container"))
        conftest.pytest_collection_modifyitems(cfg, [item])
        names = [m.name for m in item.markers]
        self.assertIn("container", names)
        self.assertNotIn("skip", names)

    def test_docker_skip_guards_precede_source_staging(self):
        """On a docker-less host the fixture skips before any staging."""
        body = CONFTEST_SRC[CONFTEST_SRC.index("def tier1_container"):]
        self.assertLess(body.index('shutil.which("docker")'),
                        body.index("_stage_fork_release(value)"))
        self.assertLess(body.index('["docker", "info"]'),
                        body.index("_stage_fork_release(value)"))
        self.assertEqual(CONFTEST_SRC.count("_stage_fork_release(value)"), 1,
                         "source staging has exactly one call site: the "
                         "guarded fixture body")


class TestFixtureStatics(unittest.TestCase):
    """Static guards pinning the repaired fixture contract."""

    def test_fail_closed_staging_replaces_ignore_errors(self):
        self.assertNotIn(
            'shutil.rmtree(src / pkg / "dist", ignore_errors=True)',
            CONFTEST_SRC)
        self.assertIn("def _remove_dist_tree", CONFTEST_SRC)
        self.assertIn('_remove_dist_tree(src / pkg / "dist")', CONFTEST_SRC)

    def test_driver_still_fails_closed(self):
        """The driver contract the fixture mirrors is unchanged."""
        driver = (REPO / "scripts/test-tier1.sh").read_text()
        self.assertIn('rm -rf "${SOURCE:?}/$p/dist"', driver)

    def test_session_container_name_is_unique_per_run(self):
        """A later run never collides with (inherits) a failed run's
        leftover container: the name carries pid AND epoch."""
        self.assertIn(
            'f"prime-claw-tier1-session-{os.getpid()}-{int(time.time())}"',
            CONFTEST_SRC)

    def test_teardown_has_no_docker_wide_operations(self):
        self.assertNotIn("prune", CONFTEST_SRC)
        self.assertNotIn('"--all"', CONFTEST_SRC)


if __name__ == "__main__":
    unittest.main()
