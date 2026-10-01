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
import time
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

    def test_dangling_symlink_is_unlinked(self):
        """A symlink whose target is gone is still unlinked, never followed."""
        with tempfile.TemporaryDirectory() as td:
            link = Path(td) / "dist"
            link.symlink_to(Path(td) / "gone", target_is_directory=True)
            conftest._remove_dist_tree(link)
            self.assertFalse(link.is_symlink() or link.exists())

    def test_inaccessible_parent_raises_instead_of_silent_skip(self):
        """Unsearchable parent: lstat raises PermissionError -> fail closed.

        On Python 3.14 the Path.is_* predicates SUPPRESS this OSError into
        three False results, which the old code misread as absence; lstat
        preserves it and the tree is left untouched.
        """
        with tempfile.TemporaryDirectory() as td:
            box = Path(td) / "box"
            dist = box / "dist"
            dist.mkdir(parents=True)
            (dist / "stale.js").write_text("stale")
            box.chmod(0o444)  # readable, NOT searchable: children unstatable
            try:
                with self.assertRaises(RuntimeError) as ctx:
                    conftest._remove_dist_tree(dist)
            finally:
                box.chmod(0o755)  # let TemporaryDirectory clean up
            self.assertIn("cannot inspect stale build output",
                          str(ctx.exception))
            self.assertTrue((dist / "stale.js").exists(),
                            "an uninspectable tree must be left untouched")

    def test_injected_metadata_permissionerror_raises(self):
        """An lstat PermissionError (not just an rmtree error) fails closed."""
        with tempfile.TemporaryDirectory() as td:
            target = Path(td) / "dist"
            target.mkdir()
            real_lstat = Path.lstat

            def poisoned(self, *a, **k):
                if self == target:
                    raise PermissionError(13, "Permission denied", str(self))
                return real_lstat(self, *a, **k)

            with mock.patch.object(Path, "lstat", poisoned):
                with self.assertRaises(RuntimeError) as ctx:
                    conftest._remove_dist_tree(target)
            self.assertIn("cannot inspect", str(ctx.exception))
            self.assertTrue(target.exists(), "nothing was removed")

    def test_injected_metadata_eio_raises(self):
        """An lstat EIO fails closed the same way (I/O error, not absent)."""
        with tempfile.TemporaryDirectory() as td:
            target = Path(td) / "dist"
            target.mkdir()
            real_lstat = Path.lstat

            def poisoned(self, *a, **k):
                if self == target:
                    raise OSError(5, "Input/output error", str(self))
                return real_lstat(self, *a, **k)

            with mock.patch.object(Path, "lstat", poisoned):
                with self.assertRaises(RuntimeError) as ctx:
                    conftest._remove_dist_tree(target)
            self.assertIn("cannot inspect", str(ctx.exception))
            self.assertTrue(target.exists(), "nothing was removed")

    def test_fifo_is_rejected_not_treated_as_absent(self):
        """A FIFO at a pack-consumed path is an anomaly: reject, don't build."""
        with tempfile.TemporaryDirectory() as td:
            fifo = Path(td) / "dist"
            os.mkfifo(fifo)
            with self.assertRaises(RuntimeError) as ctx:
                conftest._remove_dist_tree(fifo)
            self.assertIn("special filesystem object", str(ctx.exception))
            self.assertTrue(fifo.exists(),
                            "a rejected special object is left in place")


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

    def test_inaccessible_dist_parent_fails_before_npm_and_node(self):
        """Unsearchable packages/agent: staging raises BEFORE any npm/node
        call — the lstat detects what the is_* predicates suppressed."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = _make_fake_fork(tmp, with_dist=True)
            npm_log = _make_fake_npm(tmp)
            node_log = _make_fake_node(tmp)
            blocked = fork / "packages" / "agent"
            blocked.chmod(0o444)  # readable, NOT searchable
            try:
                with self.assertRaises(RuntimeError) as ctx:
                    self._run_staging(fork, tmp)
            finally:
                blocked.chmod(0o755)
            self.assertIn("cannot inspect", str(ctx.exception))
            self.assertFalse(npm_log.exists(),
                             "metadata failure must stop before npm build")
            self.assertFalse(node_log.exists(),
                             "metadata failure must stop before release:pack")
            self.assertTrue((blocked / "dist" / "stale-output.js").exists(),
                            "the uninspectable tree is untouched")

    def test_injected_metadata_error_fails_before_npm_and_node(self):
        """Injected EIO on one dist path (host Python 3.14 lstat) fails
        staging before any npm/node call."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = _make_fake_fork(tmp, with_dist=True)
            npm_log = _make_fake_npm(tmp)
            node_log = _make_fake_node(tmp)
            target = fork / "packages" / "coding-agent" / "dist"
            real_lstat = Path.lstat

            def poisoned(self, *a, **k):
                if self == target:
                    raise OSError(5, "Input/output error", str(self))
                return real_lstat(self, *a, **k)

            with mock.patch.object(Path, "lstat", poisoned):
                with self.assertRaises(RuntimeError) as ctx:
                    self._run_staging(fork, tmp)
            self.assertIn("cannot inspect", str(ctx.exception))
            self.assertFalse(npm_log.exists())
            self.assertFalse(node_log.exists())

    def test_fifo_at_dist_path_rejected_before_build(self):
        """A FIFO where a dist tree should be is rejected before any
        npm/node call — never silently skipped, never recursed into."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = _make_fake_fork(tmp, with_dist=False)
            npm_log = _make_fake_npm(tmp)
            node_log = _make_fake_node(tmp)
            fifo_parent = fork / "packages" / "agent"
            fifo_parent.mkdir(parents=True)
            os.mkfifo(fifo_parent / "dist")
            with self.assertRaises(RuntimeError) as ctx:
                self._run_staging(fork, tmp)
            self.assertIn("special filesystem object", str(ctx.exception))
            self.assertFalse(npm_log.exists())
            self.assertFalse(node_log.exists())
            self.assertTrue((fifo_parent / "dist").exists(),
                            "the rejected special object is left in place")

    def test_recover_and_restage_after_denied_cleanup(self):
        """Denied cleanup fails staging; after access is restored, staging
        succeeds: the failed attempt accepted no artifact, and the replay
        removes the obsolete output."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = _make_fake_fork(tmp, marker="MARKER-B", with_dist=True)
            _make_fake_npm(tmp)
            _make_fake_node(tmp)
            blocked = fork / "packages" / "agent"
            blocked.chmod(0o444)
            try:
                with self.assertRaises(RuntimeError):
                    self._run_staging(fork, tmp)
            finally:
                blocked.chmod(0o755)
            out_dir = fork / "packages" / "coding-agent" / "release" / "tier1"
            self.assertFalse(out_dir.exists(),
                             "the denied attempt must accept no artifact")
            version, _ = self._run_staging(fork, tmp)
            self.assertEqual(version, "0.9.8")
            for p in DIST_DIRS:
                dist = fork / p / "dist"
                self.assertFalse((dist / "stale-output.js").exists(),
                                 f"replay must remove obsolete {p} output")
                self.assertEqual((dist / "marker.txt").read_text(),
                                 "MARKER-B",
                                 "replay packs the current source")


def _make_fake_docker(tmp: Path, *, rm_rc: int = 0, inspect_rc: int = 1,
                      rm_sleep: int = 0, rm_stderr: str = "",
                      inspect_sleep: int = 0,
                      inspect_stderr: str | None = None) -> Path:
    """Recording docker substitute: rm/inspect behavior is programmable;
    every invocation is logged, one full argv per line.

    inspect_stderr: when inspect_rc != 0 and inspect_stderr is None, the
    fake emits docker's genuine positive-absence evidence ("No such
    container") — real rc=1 absence output. Pass an explicit string (e.g.
    a daemon connection or permission error) to model an UNKNOWN
    inspection, or "" for unrecognised output (also UNKNOWN)."""
    record = tmp / "docker-invocations.log"
    script = tmp / "docker"
    if inspect_stderr is None and inspect_rc != 0:
        inspect_stderr = 'Error: No such container: $2'
    inspect_line = (f'echo "{inspect_stderr}" >&2\n      '
                    if inspect_stderr else "")
    stderr_line = f'echo "{rm_stderr}" >&2\n      ' if rm_stderr else ""
    script.write_text(
        "#!/usr/bin/env bash\n"
        f'echo "$*" >> "{record}"\n'
        'case "$1" in\n'
        f"  rm) sleep {rm_sleep}\n"
        f"      {stderr_line}exit {rm_rc} ;;\n"
        f"  inspect) sleep {inspect_sleep}\n"
        f"      {inspect_line}exit {inspect_rc} ;;\n"
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
            self.assertIn("state=absent", msg,
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

    def test_inspect_daemon_error_is_unknown_and_fails_gate(self):
        """rm succeeded but inspect hit a daemon/connection error: a bare
        nonzero inspect exit is UNKNOWN, not absence — fail + keep share."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(
                tmp, rm_rc=0, inspect_rc=1,
                inspect_stderr="Error response from daemon: Cannot connect "
                               "to the Docker daemon")
            share = _make_share(tmp)
            with self.assertRaises(RuntimeError) as ctx:
                self._finalize(self.CID, share, tmp)
            msg = str(ctx.exception)
            self.assertIn("TEARDOWN FAILED", msg)
            self.assertIn("state=unknown", msg)
            self.assertIn("Cannot connect to the Docker daemon", msg,
                          "inspect diagnostics must be preserved")
            self.assertTrue((share / "evidence/setup.log").exists(),
                            "share retained while absence is unknown")

    def test_inspect_permission_error_is_unknown_and_fails_gate(self):
        """Docker socket permission failure on inspect: UNKNOWN -> gate
        fails, share retained."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(
                tmp, rm_rc=0, inspect_rc=1,
                inspect_stderr="permission denied while trying to connect")
            share = _make_share(tmp)
            with self.assertRaises(RuntimeError) as ctx:
                self._finalize(self.CID, share, tmp)
            self.assertIn("state=unknown", str(ctx.exception))
            self.assertTrue(share.exists())

    def test_inspect_unrecognised_output_is_unknown(self):
        """rc=1 with NO output is not proof of absence either."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(tmp, rm_rc=0, inspect_rc=1, inspect_stderr="")
            share = _make_share(tmp)
            with self.assertRaises(RuntimeError) as ctx:
                self._finalize(self.CID, share, tmp)
            self.assertIn("state=unknown", str(ctx.exception))
            self.assertTrue(share.exists())

    def test_removal_failure_plus_inspect_daemon_error_fails_closed(self):
        """Removal failure AND inspect daemon failure: pytest goes red and
        the share is preserved — no silent bypass via rc!=0."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(
                tmp, rm_rc=1, rm_stderr="Error: daemon said no",
                inspect_rc=1,
                inspect_stderr="Error response from daemon: EOF")
            share = _make_share(tmp)
            with self.assertRaises(RuntimeError) as ctx:
                self._finalize(self.CID, share, tmp)
            msg = str(ctx.exception)
            self.assertIn("exited 1", msg)
            self.assertIn("state=unknown", msg)
            self.assertIn("daemon said no", msg)
            self.assertTrue((share / "evidence/setup.log").exists())

    def test_inspect_timeout_fails_closed_boundedly(self):
        """A hung inspect is UNKNOWN and fails the gate; the bounded
        timeout keeps the whole call near its deadline."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            _make_fake_docker(tmp, rm_rc=0, inspect_sleep=2)
            env = {"PATH": os.pathsep.join([str(tmp), "/usr/bin", "/bin"])}
            started = time.monotonic()
            with mock.patch.dict(os.environ, env):
                with self.assertRaises(RuntimeError) as ctx:
                    conftest._remove_session_container(
                        self.CID, rm_timeout=15, inspect_timeout=0.5)
            self.assertLess(time.monotonic() - started, 10,
                            "inspect timeout must stay bounded")
            msg = str(ctx.exception)
            self.assertIn("TEARDOWN FAILED", msg)
            self.assertIn("state=unknown", msg)
            self.assertIn("timed out", msg)

    def test_docker_cli_launch_failure_fails_closed(self):
        """No docker executable at all: rm launch failure is fatal, inspect
        launch failure is UNKNOWN — fail closed and keep the share."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)  # no docker script on this controlled PATH
            share = _make_share(tmp)
            with self.assertRaises(RuntimeError) as ctx:
                self._finalize(self.CID, share, tmp)
            msg = str(ctx.exception)
            self.assertIn("could not run", msg)
            self.assertIn("state=unknown", msg)
            self.assertTrue(share.exists())


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


def _session_fixture_fn():
    """The raw generator function behind the shipped session fixture.

    pytest 9 wraps the fixture function in a FixtureFunctionDefinition;
    reaching through _fixture_function (or __wrapped__) lets negative
    tests drive the ACTUAL fixture setup/yield/finalize flow instead of
    a re-implemented copy.
    """
    for attr in ("_fixture_function", "__wrapped__"):
        fn = getattr(conftest.tier1_container, attr, None)
        if callable(fn):
            return fn
    raise AssertionError("cannot reach the tier1_container generator")


def _make_fake_session_docker(tmp: Path, *, build_rc: int = 0,
                              exec_rc: int = 0,
                              rm_rc: int = 0, rm_sleep: int = 0,
                              rm_stderr: str = "",
                              inspect_rc: int = 1,
                              inspect_stderr: str | None = None,
                              inspect_sleep: int = 0) -> Path:
    """Recording docker substitute for FULL session-fixture drives.

    Handles the complete fixture conversation — info / build / run -d
    (prints a unique cid per invocation from a counter file) / exec
    (install+apply+check succeed) / rm / inspect — each with programmable
    rc, stderr, and sleep. Every invocation is logged, one full argv per
    line. Re-running this helper on the same tmp REPROGRAMS the behavior
    while preserving the counter and the log, so a test can model a
    failed run followed by a clean run.
    """
    if inspect_stderr is None and inspect_rc != 0:
        inspect_stderr = 'Error: No such container: $2'
    inspect_line = (f'echo "{inspect_stderr}" >&2\n      '
                    if inspect_stderr else "")
    rm_line = f'echo "{rm_stderr}" >&2\n      ' if rm_stderr else ""
    counter = tmp / "docker-cid-counter"
    record = tmp / "docker-invocations.log"
    script = tmp / "docker"
    script.write_text(
        "#!/usr/bin/env bash\n"
        f'echo "$*" >> "{record}"\n'
        'case "$1" in\n'
        "  info) exit 0 ;;\n"
        f"  build) exit {build_rc} ;;\n"
        f'  run) n=1; [ -f "{counter}" ] && n=$(( $(cat "{counter}") + 1 ))\n'
        f'       echo "$n" > "{counter}"; echo "cid-$n" ;;\n'
        f"  exec) echo '0.9.3 applied checked'; exit {exec_rc} ;;\n"
        f"  rm) sleep {rm_sleep}\n"
        f"      {rm_line}exit {rm_rc} ;;\n"
        f"  inspect) sleep {inspect_sleep}\n"
        f"      {inspect_line}exit {inspect_rc} ;;\n"
        "  *) exit 0 ;;\n"
        "esac\n"
    )
    script.chmod(0o755)
    return record


class TestSessionFixtureEndToEnd(unittest.TestCase):
    """Drive the ACTUAL tier1_container generator through failure paths.

    These tests instantiate the shipped session fixture (reached through
    the fixture wrapper, not a copy) so poisoned staging, setup failure,
    teardown failure, and cross-run isolation are proven through the real
    setup/yield/finalize flow — with recording fakes for docker/npm/node
    (no daemon, no image, no network).
    """

    PINNED_ENV = "PRIME_AGENT_PINNED=0.9.3\n"

    def _begin(self, tmp, env_text, *, docker_kw=None, pid=None,
               epoch=None, with_build_fakes=False):
        """Patch RESULTS/env/PATH (+ run identity) and start one drive of
        the real session-fixture generator. Returns (gen, record, results).
        """
        record = _make_fake_session_docker(tmp, **(docker_kw or {}))
        if with_build_fakes:
            _make_fake_npm(tmp)
            _make_fake_node(tmp)
        results = tmp / "results"
        env_file = tmp / "tier1.env"
        env_file.write_text(env_text)
        env = {"PATH": os.pathsep.join([str(tmp), "/usr/bin", "/bin"]),
               "TIER1_ENV_FILE": str(env_file)}
        patchers = [mock.patch.dict(os.environ, env),
                    mock.patch.object(conftest, "RESULTS", results)]
        if pid is not None:
            patchers.append(mock.patch.object(os, "getpid",
                                              return_value=pid))
        if epoch is not None:
            patchers.append(mock.patch.object(time, "time",
                                              return_value=epoch))
        for patcher in patchers:
            patcher.start()
            self.addCleanup(patcher.stop)
        return _session_fixture_fn()(None), record, results

    def test_source_mode_poisoned_dist_tree_stops_before_publication(self):
        """The WHOLE fixture stops before publication: an uninspectable
        dist tree raises during staging — docker never builds or runs a
        container, npm/node never run."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            fork = _make_fake_fork(tmp, with_dist=True)
            blocked = fork / "packages" / "agent"
            blocked.chmod(0o444)
            gen, record, results = self._begin(
                tmp, f"PRIME_AGENT_SOURCE={fork}\n", with_build_fakes=True)
            try:
                with self.assertRaises(RuntimeError) as ctx:
                    next(gen)
            finally:
                blocked.chmod(0o755)
                gen.close()
            self.assertIn("cannot inspect", str(ctx.exception))
            invocations = (record.read_text().splitlines()
                           if record.exists() else [])
            self.assertEqual([l.split()[0] for l in invocations], ["info"],
                             "readiness probe only — no build, no run, "
                             "nothing published")
            self.assertFalse((tmp / "npm-invocations.log").exists())
            self.assertFalse((tmp / "node-invocations.log").exists())
            self.assertFalse(list(results.glob("share-*")),
                             "nothing published -> share released")

    def test_setup_failure_after_publication_cleans_only_captured_id(self):
        """In-container setup fails AFTER docker run: teardown removes and
        verifies exactly the captured container — nothing else."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            gen, record, results = self._begin(
                tmp, self.PINNED_ENV, docker_kw={"exec_rc": 1})
            with self.assertRaises(RuntimeError) as ctx:
                next(gen)
            self.assertIn("container setup failed", str(ctx.exception))
            invocations = record.read_text().splitlines()
            self.assertEqual([l.split()[0] for l in invocations],
                             ["info", "build", "run", "exec",
                              "rm", "inspect"])
            self.assertEqual(invocations[4], "rm -f cid-1")
            self.assertEqual(invocations[5], "inspect cid-1",
                             "teardown verifies only the captured ID")
            self.assertFalse(list(results.glob("share-*")),
                             "verified teardown releases the share")

    def test_teardown_failure_after_clean_body_fails_through_fixture(self):
        """Clean test body, failed teardown: the RuntimeError surfaces
        from fixture finalization — this is what turns the gate red."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            gen, record, results = self._begin(
                tmp, self.PINNED_ENV,
                docker_kw={"rm_rc": 1, "rm_stderr": "daemon said no",
                           "inspect_rc": 0})
            container = next(gen)
            self.assertEqual(container.id, "cid-1")
            with self.assertRaises(RuntimeError) as ctx:
                next(gen)  # resume past the yield: teardown runs here
            msg = str(ctx.exception)
            self.assertIn("TEARDOWN FAILED", msg)
            self.assertIn("cid-1", msg)
            self.assertIn("state=present", msg)
            self.assertEqual(len(list(results.glob("share-*"))), 1,
                             "share evidence retained while the container "
                             "may still own it")

    def test_body_plus_teardown_failure_preserve_both_through_fixture(self):
        """A test-body failure thrown INTO the fixture stays primary; the
        teardown failure is attached as a note — both surface."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            gen, record, results = self._begin(
                tmp, self.PINNED_ENV,
                docker_kw={"rm_rc": 1, "rm_stderr": "daemon said no",
                           "inspect_rc": 0})
            next(gen)
            with self.assertRaises(ValueError) as ctx:
                gen.throw(ValueError("test body failed"))
            notes = getattr(ctx.exception, "__notes__", [])
            self.assertTrue(
                any("teardown also failed" in n and "cid-1" in n
                    for n in notes),
                f"teardown failure must ride along as a note: {notes!r}")
            self.assertTrue(list(results.glob("share-*")),
                            "share retained while teardown is unverified")

    def test_failed_run_leaves_no_inheritance_for_the_next_run(self):
        """BEHAVIORAL uniqueness/no-inheritance proof (replaces the old
        source-string assertion): run 1's teardown fails and its container
        leaks; run 2 — a new 'process' (patched pid/epoch) — gets a
        DIFFERENT container name and ID, never targets the leaked ID, and
        does not delete run 1's still-owned share."""
        with tempfile.TemporaryDirectory() as td:
            tmp = Path(td)
            # --- run 1: teardown fails, cid-1 leaks -------------------
            gen1, record, results = self._begin(
                tmp, self.PINNED_ENV,
                docker_kw={"rm_rc": 1, "rm_stderr": "daemon said no",
                           "inspect_rc": 0},
                pid=4242, epoch=1_000_000)
            container1 = next(gen1)
            self.assertEqual(container1.id, "cid-1")
            with self.assertRaises(RuntimeError) as ctx1:
                gen1.throw(RuntimeError("run 1 body failed"))
            self.assertIn("teardown also failed",
                          "".join(getattr(ctx1.exception, "__notes__", [])))
            run1_lines = record.read_text().splitlines()
            run1_run = [l for l in run1_lines if l.startswith("run ")][0]
            self.assertIn("prime-claw-tier1-session-4242-1000000", run1_run)
            share1 = results / "share-4242"
            self.assertTrue(share1.exists(),
                            "run 1's share is retained — its container "
                            "still owns it")
            # --- run 2: a later process, clean teardown ---------------
            gen2, _, _ = self._begin(tmp, self.PINNED_ENV,
                                     pid=4343, epoch=1_000_061)
            container2 = next(gen2)
            self.assertNotEqual(container1.id, container2.id,
                                "each run captures a distinct container")
            self.assertEqual(container2.id, "cid-2")
            with self.assertRaises(StopIteration):
                next(gen2)  # clean teardown
            run2_lines = record.read_text().splitlines()[len(run1_lines):]
            run2_run = [l for l in run2_lines if l.startswith("run ")][0]
            self.assertIn("prime-claw-tier1-session-4343-1000061", run2_run)
            for line in run2_lines:
                self.assertNotIn("cid-1", line,
                                 "run 2 never targets the leaked container")
            self.assertTrue(share1.exists(),
                            "run 2 does not delete run 1's still-owned "
                            "share")
            self.assertFalse((results / "share-4343").exists(),
                             "run 2 cleans its own share after verified "
                             "teardown")


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

    def test_teardown_has_no_docker_wide_operations(self):
        self.assertNotIn("prune", CONFTEST_SRC)
        self.assertNotIn('"--all"', CONFTEST_SRC)


if __name__ == "__main__":
    unittest.main()
