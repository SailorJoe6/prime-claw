"""Tier-0 tests for run-owned, sanitized tier-1 provenance evidence."""
from __future__ import annotations

import concurrent.futures
import json
import os
import re
import socket
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from scripts.testing import provenance


ZERO_ID = "sha256:" + "a" * 64


def _manifest(evidence=None):
    return {
        "schema_version": provenance.SCHEMA_VERSION,
        "command_contract_version": provenance.COMMAND_CONTRACT_VERSION,
        "run": {
            "id": "20261002T230000Z-123-a1b2c3d4",
            "tier": "tier1",
            "mode": "pinned",
            "started_at": "2026-10-02T23:00:00Z",
            "finished_at": "2026-10-02T23:01:00Z",
            "status": "passed",
            "failure_codes": [],
        },
        "repository": {
            "head": "b" * 40,
            "dirty": False,
            "status_sha256": "a" * 64,
            "content_sha256": "c" * 64,
            "entry_count": 1,
            "content_hash_contract": "framed-sha256-v2",
        },
        "prime_agent": {
            "mode": "pinned",
            "requested_version": "0.9.8",
            "installed_version": "0.9.8",
            "artifact": {"kind": "vendor-binary", "version": "0.9.8", "executable_sha256": "f" * 64},
        },
        "image": {
            "id": ZERO_ID,
            "repo_digests": [],
            "dockerfile": "docker/test.Dockerfile",
            "dockerfile_sha256": "d" * 64,
            "declared_input_sha256": "e" * 64,
            "declared_input_hash_contract": "framed-sha256-v2",
            "informational_tag": "prime-claw-test-tier1:e" + "e" * 11,
            "os": "linux",
            "architecture": "arm64",
            "build_started_at": "2026-10-02T23:00:01Z",
            "build_finished_at": "2026-10-02T23:00:30Z",
        },
        "network": {
            "disconnected_at": "2026-10-02T23:00:45Z",
            "verified_absent": True,
        },
        "teardown": {"state": "absent", "verified_at": "2026-10-02T23:01:00Z",
                     "remove_outcome": "clean",
                     "inspect_outcome": "ordinary_nonzero", "clean": True},
        "evidence": {"files": evidence or []},
    }


class TestRunAllocation(unittest.TestCase):
    def test_concurrent_allocations_are_unique_and_tier_scoped(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            def allocate(_):
                return provenance.allocate_run_tree(root, "tier1")
            with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
                allocated = list(pool.map(allocate, range(40)))
            run_ids = [row[0] for row in allocated]
            tier_dirs = [row[1] for row in allocated]
            self.assertEqual(len(set(run_ids)), 40)
            self.assertEqual(len(set(tier_dirs)), 40)
            self.assertTrue(all(p.parent.parent == root and p.name == "tier1"
                                for p in tier_dirs))

    def test_results_root_swap_refuses_without_allocating_in_replacement(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            results = base / "results"
            original = base / "original-results"
            results.mkdir()
            (results / "original-sentinel").write_text("original")
            real_mkdir = provenance.os.mkdir
            fired = False

            def swap_at_run_mkdir(path, mode=0o777, *, dir_fd=None):
                nonlocal fired
                if (not fired and dir_fd is not None
                        and re.fullmatch(
                            r"[0-9]{8}T[0-9]{6}Z-[0-9]+-[0-9a-f]{8}",
                            os.fspath(path))):
                    fired = True
                    results.rename(original)
                    real_mkdir(results, 0o755)
                    (results / "replacement-sentinel").write_text("replacement")
                return real_mkdir(path, mode, dir_fd=dir_fd)

            with mock.patch.object(provenance.os, "mkdir", swap_at_run_mkdir):
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "public binding changed"):
                    provenance.allocate_run_tree(results, "tier1")
            self.assertTrue(fired)
            self.assertEqual(
                (original / "original-sentinel").read_text(), "original")
            self.assertEqual(
                (results / "replacement-sentinel").read_text(), "replacement")
            self.assertEqual(
                [p.name for p in results.iterdir()], ["replacement-sentinel"])


class TestManifestValidation(unittest.TestCase):
    def test_valid_pinned_manifest_round_trips_canonically(self):
        manifest = _manifest()
        provenance.validate_manifest(manifest)
        encoded = provenance.canonical_json(manifest)
        self.assertEqual(encoded, provenance.canonical_json(json.loads(encoded)))
        self.assertTrue(encoded.endswith("\n"))

    def test_smoke_manifest_requires_no_prime_agent_identity(self):
        manifest = _manifest()
        manifest["run"]["mode"] = "smoke"
        manifest["prime_agent"] = None
        provenance.validate_manifest(manifest)

    def test_failed_partial_manifest_records_evidence_without_false_identity(self):
        manifest = _manifest()
        manifest["run"]["status"] = "failed"
        manifest["run"]["failure_codes"] = ["incomplete-identity"]
        manifest["prime_agent"] = {
            "mode": "pinned", "requested_version": "0.9.8",
            "installed_version": None, "artifact": None,
        }
        manifest["image"] = None
        manifest["network"] = {"disconnected_at": None, "verified_absent": False}
        provenance.validate_manifest(manifest)
        manifest["run"]["status"] = "passed"
        manifest["run"]["failure_codes"] = []
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)

    def test_wrong_schema_version_is_rejected(self):
        manifest = _manifest()
        manifest["schema_version"] += 1
        with self.assertRaisesRegex(provenance.ProvenanceError, "schema_version"):
            provenance.validate_manifest(manifest)

    def test_missing_or_source_selector_is_rejected_in_slice1(self):
        missing = _manifest()
        missing["prime_agent"]["requested_version"] = ""
        with self.assertRaisesRegex(provenance.ProvenanceError, "selector"):
            provenance.validate_manifest(missing)
        source = _manifest()
        source["prime_agent"]["mode"] = "source"
        with self.assertRaisesRegex(provenance.ProvenanceError, "pinned"):
            provenance.validate_manifest(source)

    def test_redaction_rejects_secret_key_secret_value_and_host_home(self):
        for mutate in (
            lambda m: m.update({"token": "not-even-a-real-token"}),
            lambda m: m["run"].update({"note": "Bearer abcdefghijklmnop"}),
            lambda m: m["run"].update({"path": "/Users/alice/private/repo"}),
        ):
            manifest = _manifest()
            mutate(manifest)
            with self.assertRaisesRegex(provenance.ProvenanceError, "sanitized"):
                provenance.validate_manifest(manifest)

    def test_tampered_installed_identity_is_rejected(self):
        manifest = _manifest()
        manifest["prime_agent"]["installed_version"] = "0.9.7"
        manifest["prime_agent"]["artifact"]["version"] = "0.9.7"
        with self.assertRaisesRegex(provenance.ProvenanceError, "versions differ"):
            provenance.validate_manifest(manifest)
        manifest = _manifest()
        manifest["prime_agent"]["artifact"]["executable_sha256"] = "bad"
        with self.assertRaisesRegex(provenance.ProvenanceError, "artifact identity"):
            provenance.validate_manifest(manifest)

    def test_failed_manifest_retains_exact_mismatched_or_prerelease_version(self):
        for observed in ("0.9.7", "0.9.8-beta.1"):
            with self.subTest(observed=observed):
                manifest = _manifest()
                manifest["run"].update(
                    status="failed", failure_codes=["installed-version-mismatch"])
                manifest["prime_agent"]["installed_version"] = observed
                manifest["prime_agent"]["artifact"]["version"] = observed
                provenance.validate_manifest(manifest)

    def test_success_claims_require_absent_teardown_and_complete_identity(self):
        for mutate in (
            lambda m: m["teardown"].update({"state":"present"}),
            lambda m: m["teardown"].update({"state":"unknown"}),
            lambda m: m["network"].update({"verified_absent":False,"disconnected_at":None}),
            lambda m: m["prime_agent"].update({"installed_version":None,"artifact":None}),
        ):
            manifest=_manifest(); mutate(manifest)
            with self.assertRaises(provenance.ProvenanceError): provenance.validate_manifest(manifest)

    def test_timestamp_and_semver_tampering_is_rejected(self):
        mutations=(
            lambda m: m["run"].update({"finished_at":"not-a-time"}),
            lambda m: m["network"].update({"disconnected_at":"2026-99-99T00:00:00Z"}),
            lambda m: m["teardown"].update({"verified_at":None}),
            lambda m: m["image"].update({"build_finished_at":"2026-10-02"}),
            lambda m: m["prime_agent"].update({"requested_version":"0.9.8-beta","installed_version":"0.9.8-beta"}),
        )
        for mutate in mutations:
            manifest=_manifest(); mutate(manifest)
            with self.assertRaises(provenance.ProvenanceError): provenance.validate_manifest(manifest)

    def test_atomic_write_is_mode_0600_and_refuses_stale_target(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); target = root / "manifest.json"
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                provenance.atomic_write_manifest(owned, _manifest())
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)
                with self.assertRaisesRegex(provenance.ProvenanceError, "overwrite"):
                    provenance.atomic_write_manifest(owned, _manifest())

    def test_atomic_write_does_not_replace_existing_manifest_on_invalid_input(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); target = root / "manifest.json"
            binding = provenance.owned_directory_binding(root)
            target.write_text("old\n")
            bad = _manifest()
            bad["schema_version"] = 999
            with provenance.open_owned_directory(root, binding) as owned:
                with self.assertRaises(provenance.ProvenanceError):
                    provenance.atomic_write_manifest(owned, bad)
            self.assertEqual(target.read_text(), "old\n")
            self.assertEqual(list(target.parent.glob(".manifest.json.*.tmp")), [])


    def test_unknown_keys_and_impossible_image_fields_are_rejected(self):
        mutations = (
            lambda item: item.__setitem__("unexpected", True),
            lambda item: item["run"].__setitem__("unexpected", True),
            lambda item: item["image"].__setitem__("dockerfile", "../Dockerfile"),
            lambda item: item["image"].__setitem__("dockerfile", "./docker/test.Dockerfile"),
            lambda item: item["image"].__setitem__("informational_tag", "private/repo:latest"),
            lambda item: item["image"].__setitem__("os", 7),
            lambda item: item["image"].__setitem__("architecture", "arm64 private"),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                manifest = _manifest()
                mutate(manifest)
                with self.assertRaises(provenance.ProvenanceError):
                    provenance.validate_manifest(manifest)


class TestHashes(unittest.TestCase):
    def test_evidence_inventory_detects_stale_or_tampered_file(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            (root / "setup.log").write_text("safe setup evidence\n")
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                files = provenance.evidence_inventory(owned)
                manifest = _manifest(files)
                provenance.verify_evidence(owned, manifest)
                (root / "setup.log").write_text("tampered\n")
                with self.assertRaisesRegex(provenance.ProvenanceError, "hash mismatch"):
                    provenance.verify_evidence(owned, manifest)
                (root / "setup.log").write_text("safe setup evidence\n")
                (root / "stale.log").write_text("stale\n")
                with self.assertRaisesRegex(provenance.ProvenanceError, "inventory mismatch"):
                    provenance.verify_evidence(owned, manifest)

    def test_inventory_rejects_unsanitized_text_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            for value in ("Authorization: Bearer abcdefghijklmnop\n",
                          "endpoint=http://10.0.4.225:3133/mcp\n",
                          "path=/Users/alice/private\n",
                          "PRIME_API_KEY=not-a-real-secret\n"):
                (root / "bad.log").write_text(value)
                with provenance.open_owned_directory(
                        root, provenance.owned_directory_binding(root)) as owned:
                    with self.assertRaisesRegex(provenance.ProvenanceError, "sanitized"):
                        provenance.evidence_inventory(owned)

    def test_scratch_share_is_not_durable_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td).resolve(); (root/"share").mkdir(); (root/"share"/"scratch.txt").write_text("scratch")
            (root/"setup.log").write_text("phase=ok\n")
            with provenance.open_owned_directory(
                    root, provenance.owned_directory_binding(root)) as owned:
                self.assertEqual(
                    [r["path"] for r in provenance.evidence_inventory(owned)],
                    ["setup.log"])

    def test_inventory_rejects_symlink_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            target = root / "target"
            target.write_text("x")
            (root / "link").symlink_to(target)
            with provenance.open_owned_directory(
                    root, provenance.owned_directory_binding(root)) as owned:
                with self.assertRaisesRegex(provenance.ProvenanceError, "symlink"):
                    provenance.evidence_inventory(owned)

    def test_repository_identity_changes_for_dirty_content_without_leaking_it(self):
        with tempfile.TemporaryDirectory() as td:
            repo = Path(td).resolve()
            subprocess.run(["git", "init", "-q", str(repo)], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"], check=True)
            tracked = repo / "tracked.txt"
            tracked.write_text("one\n")
            subprocess.run(["git", "-C", str(repo), "add", "tracked.txt"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
            clean = provenance.repository_identity(repo)
            tracked.write_text("PRIVATE-CONTENT-SHOULD-NOT-LEAK\n")
            dirty = provenance.repository_identity(repo)
            self.assertFalse(clean["dirty"])
            self.assertTrue(dirty["dirty"])
            self.assertNotEqual(clean["content_sha256"], dirty["content_sha256"])
            self.assertNotIn("PRIVATE", json.dumps(dirty))

    def test_snapshot_matches_identity_and_excludes_ignored_private_files(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve() / "repo"; root.mkdir()
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
            (root / ".gitignore").write_text(".env\n.test-results/\n")
            script = root / "run.sh"; script.write_text("#!/bin/sh\n"); script.chmod(0o755)
            (root / ".env").write_text("TOKEN=private\n")
            subprocess.run(["git", "-C", str(root), "add", ".gitignore", "run.sh"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "base"], check=True)
            before = provenance.repository_identity(root)
            snapshot = Path(td).resolve() / "snapshot"
            staged = provenance.stage_repository_snapshot(root, snapshot)
            self.assertEqual(staged, before)
            self.assertTrue((snapshot / "run.sh").is_file())
            self.assertEqual((snapshot / "run.sh").stat().st_mode & 0o777, 0o755)
            self.assertFalse((snapshot / ".env").exists())
            script.chmod(0o644)
            after = provenance.repository_identity(root)
            self.assertNotEqual(before["content_sha256"], after["content_sha256"])

    def test_declared_input_hash_rejects_missing_and_path_escape(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            (root / "Dockerfile").write_text("FROM scratch\n")
            self.assertRegex(provenance.hash_declared_inputs(root, ["Dockerfile"]), r"^[0-9a-f]{64}$")
            with self.assertRaises(provenance.ProvenanceError):
                provenance.hash_declared_inputs(root, ["missing"])
            with self.assertRaises(provenance.ProvenanceError):
                provenance.hash_declared_inputs(root, ["../escape"])


class TestSecureCaptureRegressions(unittest.TestCase):
    def _repo(self, root: Path) -> Path:
        repo = root / "repo"
        repo.mkdir()
        subprocess.run(["git", "init", "-q", str(repo)], check=True)
        subprocess.run(["git", "-C", str(repo), "config", "user.email",
                        "test@example.invalid"], check=True)
        subprocess.run(["git", "-C", str(repo), "config", "user.name", "Test"],
                       check=True)
        return repo

    def test_git_reads_remain_on_retained_root_after_public_swap(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            repo = self._repo(base)
            (repo / "original.txt").write_text("original\n")
            subprocess.run(["git", "-C", str(repo), "add", "original.txt"],
                           check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "original"],
                           check=True)
            original_head = subprocess.check_output(
                ["git", "-C", str(repo), "rev-parse", "HEAD"], text=True).strip()
            replacement = base / "replacement"
            replacement.mkdir()
            subprocess.run(["git", "init", "-q", str(replacement)], check=True)
            subprocess.run(["git", "-C", str(replacement), "config", "user.email",
                            "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", str(replacement), "config", "user.name",
                            "Test"], check=True)
            (replacement / "replacement.txt").write_text("replacement\n")
            subprocess.run(["git", "-C", str(replacement), "add", "replacement.txt"],
                           check=True)
            subprocess.run(["git", "-C", str(replacement), "commit", "-qm", "replacement"],
                           check=True)
            replacement_head = subprocess.check_output(
                ["git", "-C", str(replacement), "rev-parse", "HEAD"],
                text=True).strip()
            hidden = base / "original-hidden"
            real_git = provenance._git
            observed = []
            fired = False

            def swap_then_git(root_fd, *args):
                nonlocal fired
                if not fired:
                    fired = True
                    repo.rename(hidden)
                    replacement.rename(repo)
                output = real_git(root_fd, *args)
                observed.append((args, output))
                return output

            with mock.patch.object(provenance, "_git", swap_then_git):
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "root changed"):
                    provenance.repository_identity(repo)
            self.assertTrue(fired)
            head_output = next(value for args, value in observed
                               if args[:2] == ("rev-parse", "HEAD"))
            self.assertEqual(head_output.decode().strip(), original_head)
            self.assertNotEqual(original_head, replacement_head)
            self.assertNotIn(b"replacement.txt", b"".join(v for _, v in observed))

    def test_git_paths_remain_on_retained_root_after_late_public_swap(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            repo = self._repo(base)
            (repo / "original.txt").write_text("original\n")
            subprocess.run(["git", "-C", str(repo), "add", "original.txt"],
                           check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "original"],
                           check=True)
            replacement = base / "replacement"
            replacement.mkdir()
            subprocess.run(["git", "init", "-q", str(replacement)], check=True)
            (replacement / "replacement.txt").write_text("replacement\n")
            hidden = base / "original-hidden"
            real_paths = provenance._repository_paths
            observed_paths = []
            fired = False

            def swap_then_paths(root_fd):
                nonlocal fired
                if not fired:
                    fired = True
                    repo.rename(hidden)
                    replacement.rename(repo)
                paths = real_paths(root_fd)
                observed_paths.extend(paths)
                return paths

            with mock.patch.object(provenance, "_repository_paths", swap_then_paths):
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "root changed"):
                    provenance.repository_identity(repo)
            self.assertTrue(fired)
            self.assertIn("original.txt", observed_paths)
            self.assertNotIn("replacement.txt", observed_paths)

    def test_snapshot_destination_parent_swap_refuses_replacement_tree(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            repo = self._repo(base)
            (repo / "input.txt").write_text("inside\n")
            subprocess.run(["git", "-C", str(repo), "add", "input.txt"],
                           check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"],
                           check=True)
            parent = base / "snapshots"
            original_parent = base / "original-snapshots"
            parent.mkdir()
            (parent / "original-sentinel").write_text("original")
            destination = parent / "run"
            real_mkdir = provenance.os.mkdir
            fired = False

            def swap_at_destination_stage(path, mode=0o777, *, dir_fd=None):
                nonlocal fired
                if (not fired and dir_fd is not None
                        and os.fspath(path).startswith(".prime-claw-directory-")):
                    fired = True
                    parent.rename(original_parent)
                    real_mkdir(parent, 0o755)
                    (parent / "replacement-sentinel").write_text("replacement")
                return real_mkdir(path, mode, dir_fd=dir_fd)

            with mock.patch.object(provenance.os, "mkdir", swap_at_destination_stage):
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "public binding changed"):
                    provenance.stage_repository_snapshot(repo, destination)
            self.assertTrue(fired)
            self.assertEqual(
                (original_parent / "original-sentinel").read_text(), "original")
            self.assertEqual(
                (parent / "replacement-sentinel").read_text(), "replacement")
            self.assertFalse((parent / "run").exists())

    def test_ancestor_symlink_never_reads_or_copies_outside_root(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            repo = self._repo(root)
            alias = repo / "alias"
            alias.mkdir()
            (alias / "input.txt").write_text("inside\n")
            subprocess.run(["git", "-C", str(repo), "add", "alias/input.txt"],
                           check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"],
                           check=True)
            outside = root / "outside"
            outside.mkdir()
            sentinel = outside / "input.txt"
            sentinel.write_text("synthetic-outside-sentinel\n")
            (alias / "input.txt").unlink()
            alias.rmdir()
            alias.symlink_to(outside, target_is_directory=True)
            with self.assertRaises(provenance.ProvenanceError):
                provenance.repository_identity(repo)
            snapshot = root / "snapshot"
            with self.assertRaises(provenance.ProvenanceError):
                provenance.stage_repository_snapshot(repo, snapshot)
            self.assertFalse(snapshot.exists())
            with self.assertRaises(provenance.ProvenanceError):
                provenance.hash_declared_inputs(repo, ["alias/input.txt"])
            self.assertEqual(sentinel.read_text(), "synthetic-outside-sentinel\n")

    def test_ancestor_swap_between_enumeration_and_copy_fails_closed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            repo = self._repo(root)
            directory = repo / "alias"
            directory.mkdir()
            (directory / "input.txt").write_text("inside\n")
            subprocess.run(["git", "-C", str(repo), "add", "alias/input.txt"],
                           check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"],
                           check=True)
            outside = root / "outside"
            outside.mkdir()
            sentinel = outside / "input.txt"
            sentinel.write_text("outside\n")
            original = provenance._regular_digest
            swapped = False

            def swap_then_read(repo_root, relative, destination=None, **kwargs):
                nonlocal swapped
                if relative == "alias/input.txt" and not swapped:
                    swapped = True
                    (directory / "input.txt").unlink()
                    directory.rmdir()
                    directory.symlink_to(outside, target_is_directory=True)
                return original(repo_root, relative, destination, **kwargs)

            snapshot = root / "snapshot"
            with mock.patch.object(provenance, "_regular_digest", swap_then_read):
                with self.assertRaises(provenance.ProvenanceError):
                    provenance.stage_repository_snapshot(repo, snapshot)
            self.assertFalse(snapshot.exists())
            self.assertEqual(sentinel.read_text(), "outside\n")
            directory.unlink()
            directory.mkdir()
            (directory / "input.txt").write_text("inside\n")
            replay = provenance.stage_repository_snapshot(repo, snapshot)
            self.assertEqual(replay["content_hash_contract"], "framed-sha256-v2")

    def test_declared_input_root_swap_never_reads_replacement_tree(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            root = base / "declared"
            root.mkdir(); (root / "input.txt").write_text("inside\n")
            moved = base / "declared-moved"
            outside = base / "outside"
            outside.mkdir(); sentinel = outside / "input.txt"
            sentinel.write_text("outside-sentinel\n")
            original = provenance._regular_digest
            swapped = False

            def swap_root(repo_root, relative, destination=None, **kwargs):
                nonlocal swapped
                if not swapped:
                    swapped = True
                    root.rename(moved)
                    root.symlink_to(outside, target_is_directory=True)
                return original(repo_root, relative, destination, **kwargs)

            with mock.patch.object(provenance, "_regular_digest", swap_root):
                with self.assertRaisesRegex(provenance.ProvenanceError,
                                            "root changed"):
                    provenance.hash_declared_inputs(root, ["input.txt"])
            self.assertEqual(sentinel.read_text(), "outside-sentinel\n")

    def test_repository_and_destination_root_swaps_never_escape_anchors(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            repo = self._repo(base)
            (repo / "input.txt").write_text("inside\n")
            subprocess.run(["git", "-C", str(repo), "add", "input.txt"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
            outside = base / "outside"
            outside.mkdir(); sentinel = outside / "input.txt"
            sentinel.write_text("outside-sentinel\n")
            moved_repo = base / "repo-moved"
            original_records = provenance._repository_records

            def swap_repo(repo_root, root_fd, entries, **kwargs):
                repo.rename(moved_repo)
                repo.symlink_to(outside, target_is_directory=True)
                return original_records(repo_root, root_fd, entries, **kwargs)

            snapshot = base / "snapshot"
            with mock.patch.object(provenance, "_repository_records", swap_repo):
                with self.assertRaisesRegex(provenance.ProvenanceError,
                                            "root changed"):
                    provenance.stage_repository_snapshot(repo, snapshot)
            self.assertEqual(sentinel.read_text(), "outside-sentinel\n")
            self.assertFalse(snapshot.exists())
            repo.unlink(); moved_repo.rename(repo)

            outside_destination = base / "outside-destination"
            outside_destination.mkdir()
            moved_snapshot = base / "snapshot-moved"
            original_digest = provenance._regular_digest
            swapped = False

            def swap_destination(repo_root, relative, destination=None, **kwargs):
                nonlocal swapped
                if not swapped and kwargs.get("destination_root_fd") is not None:
                    swapped = True
                    snapshot.rename(moved_snapshot)
                    snapshot.symlink_to(outside_destination, target_is_directory=True)
                return original_digest(repo_root, relative, destination, **kwargs)

            with mock.patch.object(provenance, "_regular_digest", swap_destination):
                with self.assertRaisesRegex(
                        provenance.ProvenanceError,
                        "root changed|public binding changed"):
                    provenance.stage_repository_snapshot(repo, snapshot)
            self.assertFalse((outside_destination / "input.txt").exists())
            self.assertEqual((moved_snapshot / "input.txt").read_text(), "inside\n")


    def test_snapshot_real_directory_replacement_is_never_deleted(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            repo = self._repo(base)
            (repo / "input.txt").write_text("inside\n")
            subprocess.run(["git", "-C", str(repo), "add", "input.txt"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
            snapshot = base / "snapshot"
            moved_snapshot = base / "snapshot-owned-moved"
            replacement = base / "replacement"
            replacement.mkdir()
            sentinel = replacement / "sentinel.txt"
            sentinel.write_text("replacement-must-survive\n")
            original_records = provenance._repository_records

            def replace_after_capture(root, root_fd, entries, **kwargs):
                records = original_records(root, root_fd, entries, **kwargs)
                snapshot.rename(moved_snapshot)
                replacement.rename(snapshot)
                return records

            with mock.patch.object(provenance, "_repository_records",
                                   replace_after_capture):
                with self.assertRaisesRegex(
                        provenance.ProvenanceError,
                        "root changed|public binding changed"):
                    provenance.stage_repository_snapshot(repo, snapshot)
            self.assertEqual((snapshot / "sentinel.txt").read_text(),
                             "replacement-must-survive\n")
            self.assertEqual((moved_snapshot / "input.txt").read_text(), "inside\n")
            replay = provenance.stage_repository_snapshot(repo, base / "fresh-snapshot")
            self.assertEqual(replay["content_hash_contract"], "framed-sha256-v2")

    def test_regular_mode_swap_binds_identity_to_opened_inode(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            repo = self._repo(root)
            (repo / ".gitignore").write_text(".ignored\n")
            subprocess.run(["git", "-C", str(repo), "add", ".gitignore"], check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"], check=True)
            source = repo / "scratch.txt"
            source.write_text("captured\n")
            source.chmod(0o644)
            original = provenance._regular_digest
            swapped = False

            def chmod_then_read(repo_root, relative, destination=None, **kwargs):
                nonlocal swapped
                if relative == "scratch.txt" and not swapped:
                    swapped = True
                    source.chmod(0o600)
                return original(repo_root, relative, destination, **kwargs)

            snapshot = root / "snapshot"
            with mock.patch.object(provenance, "_regular_digest", chmod_then_read):
                identity = provenance.stage_repository_snapshot(repo, snapshot)
            self.assertEqual(stat.S_IMODE((snapshot / "scratch.txt").stat().st_mode),
                             0o600)
            self.assertEqual(identity["content_sha256"],
                             provenance.repository_identity(repo)["content_sha256"])

    def test_framed_hash_distinguishes_old_nul_boundary_collision(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            a = root / "a.txt"
            b = root / "b.txt"
            boundary = b"\0b.txt\0file\0" + b"0o644\0"
            a.write_bytes(b"A")
            b.write_bytes(b"B" + boundary + b"C")
            first = provenance.hash_declared_inputs(root, ["a.txt", "b.txt"])
            a.write_bytes(b"A" + boundary + b"B")
            b.write_bytes(b"C")
            second = provenance.hash_declared_inputs(root, ["b.txt", "a.txt"])
            self.assertNotEqual(first, second)
            self.assertEqual(
                second,
                provenance.hash_declared_inputs(root, ["a.txt", "b.txt"]))

    def test_safe_relative_leaf_symlink_is_preserved_across_umask_modes(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            repo = self._repo(root)
            (repo / "target.txt").write_text("safe\n")
            prior = os.umask(0o022)
            try:
                (repo / "link.txt").symlink_to("target.txt")
            finally:
                os.umask(prior)
            subprocess.run(["git", "-C", str(repo), "add", "target.txt", "link.txt"],
                           check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"],
                           check=True)
            manifest = provenance.repository_source_manifest(repo)
            link_record = next(row for row in manifest["records"]
                               if row["path"] == "link.txt")
            self.assertEqual(link_record["mode"], 0o777)
            snapshot = root / "snapshot"
            prior = os.umask(0o077)
            try:
                provenance.stage_repository_snapshot(repo, snapshot)
            finally:
                os.umask(prior)
            self.assertTrue((snapshot / "link.txt").is_symlink())
            self.assertEqual(os.readlink(snapshot / "link.txt"), "target.txt")


class TestEvidenceCaptureBoundary(unittest.TestCase):
    def test_unknown_encoding_directory_link_and_fifo_fail_closed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            bad = root / "bad.log"
            bad.write_bytes(b"TOKEN=synthetic-marker\xff")
            with provenance.open_owned_directory(
                    root, provenance.owned_directory_binding(root)) as owned:
                with self.assertRaisesRegex(provenance.ProvenanceError, "encoding"):
                    provenance.evidence_inventory(owned)
                bad.unlink()
                real = root / "real"
                real.mkdir()
                (root / "dir-link").symlink_to(real, target_is_directory=True)
                with self.assertRaisesRegex(provenance.ProvenanceError, "symlink"):
                    provenance.evidence_inventory(owned)
                (root / "dir-link").unlink()
                if hasattr(os, "mkfifo"):
                    os.mkfifo(root / "fifo")
                    with self.assertRaisesRegex(provenance.ProvenanceError, "regular"):
                        provenance.evidence_inventory(owned)


    def test_evidence_leaf_swap_never_hashes_outside_bytes(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            root = base / "evidence"
            root.mkdir()
            leaf = root / "setup.log"
            leaf.write_text("inside\n")
            outside = base / "outside.log"
            outside.write_text("Authorization: Bearer synthetic-outside-marker\n")
            original_open = provenance.os.open
            swapped = False

            def swap_before_open(path, flags, *args, **kwargs):
                nonlocal swapped
                if (path == "setup.log" and kwargs.get("dir_fd") is not None
                        and not swapped
                        and flags & getattr(os, "O_NONBLOCK", 0)):
                    swapped = True
                    leaf.unlink()
                    leaf.symlink_to(outside)
                return original_open(path, flags, *args, **kwargs)

            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                with mock.patch.object(provenance.os, "open", swap_before_open):
                    with self.assertRaises(provenance.ProvenanceError):
                        provenance.evidence_inventory(owned)
            self.assertEqual(outside.read_text(),
                             "Authorization: Bearer synthetic-outside-marker\n")

    def test_inventory_and_verifier_both_reject_symlink_root(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            real = base / "real"
            real.mkdir()
            alias = base / "alias"
            alias.symlink_to(real, target_is_directory=True)
            with self.assertRaisesRegex(provenance.ProvenanceError, "unsafe|symlink"):
                provenance.owned_directory_binding(alias)
            with self.assertRaises(provenance.ProvenanceError):
                provenance.open_owned_directory(
                    alias, provenance.ObjectBinding(1, 1, stat.S_IFDIR))

    @unittest.skipUnless(hasattr(os, "mkfifo"), "requires FIFO support")
    def test_regular_to_fifo_swap_is_nonblocking(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            leaf = root / "input.txt"
            leaf.write_text("inside\n")
            script = r"""
import os, sys
from pathlib import Path
from unittest import mock
from scripts.testing import provenance
root = Path(sys.argv[1]); leaf = root / "input.txt"
real_open = provenance.os.open
changed = False
def swap(path, flags, *args, **kwargs):
    global changed
    if path == "input.txt" and kwargs.get("dir_fd") is not None and not changed and flags & getattr(os, "O_NONBLOCK", 0):
        changed = True; leaf.unlink(); os.mkfifo(leaf)
    return real_open(path, flags, *args, **kwargs)
with mock.patch.object(provenance.os, "open", swap):
    try:
        provenance.hash_declared_inputs(root, ["input.txt"])
    except provenance.ProvenanceError:
        raise SystemExit(0)
raise SystemExit(2)
"""
            completed = subprocess.run(
                [__import__("sys").executable, "-c", script, str(root)],
                cwd=Path(__file__).resolve().parents[1], timeout=2,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_image_metadata_is_allow_listed_before_durable_write(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            kwargs = dict(
                expected_id=ZERO_ID, dockerfile="docker/test.Dockerfile",
                dockerfile_sha256="d" * 64,
                declared_input_sha256="e" * 64,
                informational_tag="prime-claw-test-tier1:" + "e" * 12,
                build_started_at="2026-10-02T23:00:01Z",
                build_finished_at="2026-10-02T23:00:30Z")
            raw = {"Id": ZERO_ID, "RepoDigests": [],
                   "Os": "linux", "Architecture": "arm64"}
            safe = provenance.image_identity(raw, **kwargs)
            self.assertEqual(safe["repo_digests"], [])
            path = root / "image.json"
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                provenance.write_sanitized_json(owned, "image.json", safe)
            self.assertNotIn("private.local", path.read_text())
            unsafe = dict(raw, RepoDigests=[
                "private.local/team/image@sha256:" + "f" * 64],
                PrivateEndpoint="10.0.4.225")
            sanitized = provenance.image_identity(unsafe, **kwargs)
            private = root / "sanitized.json"
            with provenance.open_owned_directory(root, binding) as owned:
                provenance.write_sanitized_json(owned, "sanitized.json", sanitized)
            written = private.read_text()
            self.assertEqual(sanitized["repo_digests"], [])
            self.assertNotIn("private.local", written)
            self.assertNotIn("10.0.4.225", written)


class TestOwnedCapabilityAndManifestExchange(unittest.TestCase):
    @staticmethod
    def _failed_manifest():
        manifest = _manifest()
        manifest["run"]["status"] = "failed"
        manifest["run"]["failure_codes"] = ["publication-invalidated"]
        return manifest

    def test_componentwise_capability_rejects_ancestor_and_final_replacement(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            parent = base / "parent"
            root = parent / "owned"
            root.mkdir(parents=True)
            binding = provenance.owned_directory_binding(root)
            alias = base / "alias"
            alias.symlink_to(parent, target_is_directory=True)
            with self.assertRaises(provenance.ProvenanceError):
                provenance.open_owned_directory(alias / "owned", binding)
            hidden = parent / "hidden"
            root.rename(hidden)
            root.mkdir()
            with self.assertRaisesRegex(provenance.ProvenanceError, "binding changed"):
                provenance.open_owned_directory(root, binding)
            self.assertTrue(hidden.is_dir())

    def test_capability_write_ignores_later_public_alias_swap(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            root = base / "owned"
            outside = base / "outside"
            root.mkdir(); outside.mkdir()
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                hidden = base / "hidden"
                root.rename(hidden)
                root.symlink_to(outside, target_is_directory=True)
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "public binding changed"):
                    provenance.write_sanitized_json(
                        owned, "safe.json", {"status": "safe"})
            self.assertFalse((hidden / "safe.json").exists())
            self.assertFalse((outside / "safe.json").exists())

    def test_sanitized_write_preserves_every_existing_target_type_and_race(self):
        kinds = ["regular", "symlink", "directory"]
        if hasattr(os, "mkfifo"):
            kinds.append("fifo")
        for kind in kinds:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as td:
                base = Path(td).resolve(); root = base / "owned"; root.mkdir()
                target = root / "value.json"; outside = base / "outside"
                outside.write_text("outside-sentinel\n")
                if kind == "regular": target.write_text("regular-sentinel\n")
                elif kind == "symlink": target.symlink_to(outside)
                elif kind == "directory": target.mkdir()
                else: os.mkfifo(target)
                binding = provenance.owned_directory_binding(root)
                with provenance.open_owned_directory(root, binding) as owned:
                    with self.assertRaisesRegex(provenance.ProvenanceError, "overwrite"):
                        provenance.write_sanitized_json(
                            owned, "value.json", {"safe": True})
                self.assertEqual(outside.read_text(), "outside-sentinel\n")
                if kind == "regular":
                    self.assertEqual(target.read_text(), "regular-sentinel\n")
                elif kind == "symlink": self.assertTrue(target.is_symlink())
                elif kind == "directory": self.assertTrue(target.is_dir())
                else: self.assertTrue(stat.S_ISFIFO(target.lstat().st_mode))

        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); target = root / "value.json"
            binding = provenance.owned_directory_binding(root)
            real = provenance._rename_noreplace
            fired = False
            def race(source_fd, source, target_fd, name):
                nonlocal fired
                if not fired:
                    fired = True
                    target.write_text("raced-sentinel\n")
                return real(source_fd, source, target_fd, name)
            with provenance.open_owned_directory(root, binding) as owned:
                with mock.patch.object(provenance, "_rename_noreplace", race):
                    with self.assertRaisesRegex(provenance.ProvenanceError, "overwrite"):
                        provenance.write_sanitized_json(
                            owned, "value.json", {"safe": True})
            self.assertEqual(target.read_text(), "raced-sentinel\n")

    def test_cleanup_detaches_exact_root_and_preserves_raced_replacement(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve(); quarantine = base / "quarantine"
            root = base / "owned"; quarantine.mkdir(); root.mkdir()
            (root / "nested").mkdir(); (root / "nested" / "file").write_text("x")
            binding = provenance.owned_directory_binding(root)
            provenance.remove_owned_directory(
                root, binding, quarantine_parent=quarantine)
            self.assertFalse(root.exists())
            self.assertEqual(list(quarantine.iterdir()), [])

        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve(); quarantine = base / "quarantine"
            root = base / "owned"; hidden = base / "original"
            quarantine.mkdir(); root.mkdir(); (root / "original").write_text("kept")
            binding = provenance.owned_directory_binding(root)
            real = provenance._rename_noreplace
            fired = False
            def replace_before_detach(source_fd, source, target_fd, target):
                nonlocal fired
                if not fired:
                    fired = True
                    root.rename(hidden)
                    root.mkdir()
                    (root / "replacement-sentinel").write_text("replacement")
                return real(source_fd, source, target_fd, target)
            with mock.patch.object(
                    provenance, "_rename_noreplace", replace_before_detach):
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "replacement"):
                    provenance.remove_owned_directory(
                        root, binding, quarantine_parent=quarantine)
            self.assertEqual((hidden / "original").read_text(), "kept")
            preserved = list(quarantine.rglob("replacement-sentinel"))
            self.assertEqual(len(preserved), 1)
            self.assertEqual(preserved[0].read_text(), "replacement")

    def test_manifest_exchange_publishes_failed_and_neutralizes_exact_green(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); target = root / "manifest.json"
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                green = provenance.atomic_write_manifest(owned, _manifest())
                failed = provenance.atomic_write_manifest(
                    owned, self._failed_manifest(), expected_existing=green)
                self.assertEqual(
                    provenance.ObjectBinding.from_stat(target.stat()), failed)
                public = json.loads(target.read_text())
                self.assertEqual(public["run"]["status"], "failed")
                displaced = list((root / ".publication").iterdir())
                self.assertEqual(len(displaced), 1)
                self.assertTrue(json.loads(displaced[0].read_text())["invalidated"])

    def test_manifest_exchange_race_never_leaves_green_public(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); target = root / "manifest.json"
            binding = provenance.owned_directory_binding(root)
            replacement_text = provenance.canonical_json(_manifest())
            with provenance.open_owned_directory(root, binding) as owned:
                green = provenance.atomic_write_manifest(owned, _manifest())
                real = provenance._rename_exchange
                fired = False
                def race(source_fd, source, target_fd, name):
                    nonlocal fired
                    if not fired:
                        fired = True
                        target.unlink()
                        target.write_text(replacement_text)
                    return real(source_fd, source, target_fd, name)
                with mock.patch.object(provenance, "_rename_exchange", race):
                    with self.assertRaisesRegex(provenance.ProvenanceError, "changed"):
                        provenance.atomic_write_manifest(
                            owned, self._failed_manifest(),
                            expected_existing=green)
                self.assertEqual(json.loads(target.read_text())["run"]["status"],
                                 "failed")
                preserved = [p.read_text() for p in (root / ".publication").iterdir()]
                self.assertIn(replacement_text, preserved)

    def test_invalidation_with_stale_expected_still_replaces_green(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); target = root / "manifest.json"
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                green = provenance.atomic_write_manifest(owned, _manifest())
                target.unlink()
                target.write_text(provenance.canonical_json(_manifest()))
                with self.assertRaisesRegex(provenance.ProvenanceError, "changed"):
                    provenance.invalidate_green_manifest(
                        owned, expected=green)
                self.assertEqual(json.loads(target.read_text())["run"]["status"],
                                 "failed")


    def test_invalidation_closes_green_before_reporting_evidence_drift(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            evidence = root / "setup.log"
            evidence.write_text("phase=complete\n")
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                manifest = _manifest(provenance.evidence_inventory(owned))
                green = provenance.atomic_write_manifest(owned, manifest)
                evidence.write_text("phase=tampered\n")
                with self.assertRaisesRegex(
                        provenance.ProvenanceError,
                        "failed manifest published but evidence verification failed"):
                    provenance.invalidate_green_manifest(
                        owned, expected=green)
                public = json.loads((root / "manifest.json").read_text())
                self.assertEqual(public["run"]["status"], "failed")
                self.assertIn("publication-invalidated",
                              public["run"]["failure_codes"])

    def test_inventory_refuses_after_public_alias_swap_without_outside_read(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve(); root = base / "owned"
            hidden = base / "hidden"; outside = base / "outside"
            root.mkdir(); outside.mkdir()
            (root / "setup.log").write_text("inside\n")
            marker = outside / "outside.log"
            marker.write_text("Authorization: Bearer synthetic-outside-marker\n")
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                root.rename(hidden)
                root.symlink_to(outside, target_is_directory=True)
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "public binding changed"):
                    provenance.evidence_inventory(owned)
            self.assertEqual(
                marker.read_text(),
                "Authorization: Bearer synthetic-outside-marker\n")

    def test_quarantine_open_replacement_is_preserved_and_refused(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve(); root = base / "owned"
            quarantine = base / "quarantine"
            root.mkdir(); quarantine.mkdir(); (root / "file").write_text("owned")
            root_binding = provenance.owned_directory_binding(root)
            quarantine_binding = provenance.owned_directory_binding(quarantine)
            real_open = provenance.os.open
            fired = False

            def replace_quarantine_before_open(path, flags, *args, **kwargs):
                nonlocal fired
                name = os.fspath(path)
                if (not fired and kwargs.get("dir_fd") is not None
                        and name.startswith(".prime-claw-quarantine-")):
                    fired = True
                    created = quarantine / name
                    saved = quarantine / (name + "-created")
                    created.rename(saved)
                    created.mkdir()
                    (created / "replacement-sentinel").write_text("replacement")
                return real_open(path, flags, *args, **kwargs)

            with mock.patch.object(provenance.os, "open",
                                   replace_quarantine_before_open):
                with self.assertRaisesRegex(
                        provenance.ProvenanceError,
                        "quarantine changed while it was opened"):
                    provenance.remove_owned_directory(
                        root, root_binding, quarantine_parent=quarantine,
                        quarantine_binding=quarantine_binding)
            self.assertTrue(fired)
            self.assertEqual((root / "file").read_text(), "owned")
            self.assertEqual(
                len(list(quarantine.rglob("replacement-sentinel"))), 1)

    def test_cleanup_leaf_matrix_runs_only_after_private_detach(self):
        kinds = ["regular", "symlink", "fifo", "socket"]
        for kind in kinds:
            if kind == "fifo" and not hasattr(os, "mkfifo"):
                continue
            if kind == "socket" and not hasattr(socket, "AF_UNIX"):
                continue
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as td:
                base = Path(td).resolve(); root = base / "owned"
                quarantine = base / "quarantine"
                root.mkdir(); quarantine.mkdir()
                leaf = root / "leaf"
                sock = None
                if kind == "regular": leaf.write_text("owned")
                elif kind == "symlink": leaf.symlink_to("missing")
                elif kind == "fifo": os.mkfifo(leaf)
                else:
                    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                    sock.bind(str(leaf)); sock.close(); sock = None
                binding = provenance.owned_directory_binding(root)
                quarantine_binding = provenance.owned_directory_binding(quarantine)
                public_parent_fd = None
                real_rename = provenance._rename_noreplace
                real_unlink = provenance.os.unlink

                def capture_parent(source_fd, source, target_fd, target):
                    nonlocal public_parent_fd
                    if public_parent_fd is None:
                        public_parent_fd = source_fd
                    return real_rename(source_fd, source, target_fd, target)

                def refuse_public_unlink(path, *args, **kwargs):
                    self.assertNotEqual(kwargs.get("dir_fd"), public_parent_fd)
                    return real_unlink(path, *args, **kwargs)

                with mock.patch.object(provenance, "_rename_noreplace",
                                       capture_parent), mock.patch.object(
                                           provenance.os, "unlink",
                                           refuse_public_unlink):
                    provenance.remove_owned_directory(
                        root, binding, quarantine_parent=quarantine,
                        quarantine_binding=quarantine_binding)
                self.assertFalse(root.exists())

    def test_initial_manifest_target_matrix_preserves_refusals_and_replays(self):
        kinds = ["regular", "symlink", "directory"]
        if hasattr(os, "mkfifo"):
            kinds.append("fifo")
        for kind in kinds:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as td:
                base = Path(td).resolve(); root = base / "owned"; root.mkdir()
                target = root / "manifest.json"
                outside = base / "outside"; outside.write_text("outside")
                if kind == "regular": target.write_text("regular")
                elif kind == "symlink": target.symlink_to(outside)
                elif kind == "directory": target.mkdir()
                else: os.mkfifo(target)
                binding = provenance.owned_directory_binding(root)
                with provenance.open_owned_directory(root, binding) as owned:
                    with self.assertRaisesRegex(
                            provenance.ProvenanceError, "overwrite"):
                        provenance.atomic_write_manifest(owned, _manifest())
                self.assertEqual(outside.read_text(), "outside")
                if kind == "regular": target.unlink()
                elif kind == "symlink": target.unlink()
                elif kind == "directory": target.rmdir()
                else: target.unlink()
                fresh = base / "fresh"
                fresh.mkdir()
                fresh_binding = provenance.owned_directory_binding(fresh)
                with provenance.open_owned_directory(
                        fresh, fresh_binding) as fresh_owned:
                    provenance.atomic_write_manifest(fresh_owned, _manifest())
                self.assertEqual(
                    json.loads((fresh / "manifest.json").read_text())["run"]["status"],
                    "passed")


    def test_invalidation_exchanges_unsafe_public_entry_matrix(self):
        kinds = ["symlink", "directory"]
        if hasattr(os, "mkfifo"):
            kinds.append("fifo")
        if hasattr(socket, "AF_UNIX"):
            kinds.append("socket")
        for kind in kinds:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as td:
                base = Path(td).resolve(); root = base / "owned"; root.mkdir()
                binding = provenance.owned_directory_binding(root)
                with provenance.open_owned_directory(root, binding) as owned:
                    green = provenance.atomic_write_manifest(owned, _manifest())
                    retained_green = base / "retained-green.json"
                    (root / "manifest.json").rename(retained_green)
                    public = root / "manifest.json"
                    sock = None
                    if kind == "symlink":
                        public.symlink_to(retained_green)
                    elif kind == "directory":
                        public.mkdir(); (public / "sentinel").write_text("preserve")
                    elif kind == "fifo":
                        os.mkfifo(public)
                    else:
                        sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                        sock.bind(str(public)); sock.close(); sock = None
                    with self.assertRaisesRegex(
                            provenance.ProvenanceError,
                            "expected binding changed"):
                        provenance.invalidate_green_manifest(
                            owned, expected=green)
                    replacement = json.loads(public.read_text())
                    self.assertEqual(replacement["status"], "failed")
                    self.assertTrue(replacement["invalidated"])
                    self.assertEqual(
                        json.loads(retained_green.read_text())["run"]["status"],
                        "passed")
                    preserved = list((root / ".publication").iterdir())
                    self.assertTrue(any(p.name != public.name for p in preserved))
                fresh = base / "fresh"; fresh.mkdir()
                fresh_binding = provenance.owned_directory_binding(fresh)
                with provenance.open_owned_directory(fresh, fresh_binding) as owned:
                    provenance.atomic_write_manifest(owned, _manifest())
                self.assertEqual(
                    json.loads((fresh / "manifest.json").read_text())["run"]["status"],
                    "passed")

    def test_allocate_cli_prints_retained_lexical_path_without_resolve(self):
        tier_dir = Path("/private/retained/results/run/tier1")
        with mock.patch.object(
                provenance, "allocate_run_tree",
                return_value=("run-id", tier_dir, "binding")), mock.patch.object(
                    Path, "resolve",
                    side_effect=AssertionError("post-allocation resolve")), mock.patch.object(
                        provenance.sys, "argv",
                        ["provenance", "allocate", "/results", "tier1"]), mock.patch(
                            "builtins.print") as printed:
            provenance._main()
        printed.assert_called_once_with(
            "run-id\t/private/retained/results/run/tier1\tbinding")


    def test_snapshot_rollback_leaf_matrix_uses_exact_private_detach(self):
        kinds = ["regular", "symlink", "directory"]
        if hasattr(os, "mkfifo"):
            kinds.append("fifo")
        if hasattr(socket, "AF_UNIX"):
            kinds.append("socket")
        for kind in kinds:
            with self.subTest(kind=kind), tempfile.TemporaryDirectory() as td:
                parent = Path(td).resolve(); destination = parent / "snapshot"
                destination.mkdir(); leaf = destination / "leaf"
                if kind == "regular": leaf.write_text("owned")
                elif kind == "symlink": leaf.symlink_to("missing")
                elif kind == "directory":
                    leaf.mkdir(); (leaf / "nested").write_text("owned")
                elif kind == "fifo": os.mkfifo(leaf)
                else:
                    sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
                    sock.bind(str(leaf)); sock.close()
                destination_fd = os.open(
                    destination, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
                try:
                    parent_binding = provenance.ObjectBinding.decode(
                        provenance.owned_directory_binding(parent))
                    self.assertTrue(provenance._rollback_owned_snapshot(
                        destination, destination_fd,
                        parent_binding=parent_binding))
                finally:
                    os.close(destination_fd)
                self.assertFalse(destination.exists())

    def test_nested_post_detach_replacement_is_preserved_and_refused(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve(); root = base / "owned"
            quarantine = base / "quarantine"; root.mkdir(); quarantine.mkdir()
            nested = root / "nested"; nested.mkdir()
            (nested / "original").write_text("original")
            binding = provenance.owned_directory_binding(root)
            quarantine_binding = provenance.owned_directory_binding(quarantine)
            real_rename = provenance._rename_noreplace
            fired = False

            def replace_nested(source_fd, source, target_fd, target):
                nonlocal fired
                if not fired and source == "nested":
                    fired = True
                    os.rename("nested", "nested-original", src_dir_fd=source_fd,
                              dst_dir_fd=source_fd)
                    os.mkdir("nested", dir_fd=source_fd)
                    fd = os.open("nested/replacement", os.O_WRONLY | os.O_CREAT,
                                 0o600, dir_fd=source_fd)
                    os.write(fd, b"replacement"); os.close(fd)
                return real_rename(source_fd, source, target_fd, target)

            with mock.patch.object(provenance, "_rename_noreplace",
                                   replace_nested):
                with self.assertRaises(provenance.ProvenanceError):
                    provenance.remove_owned_directory(
                        root, binding, quarantine_parent=quarantine,
                        quarantine_binding=quarantine_binding)
            self.assertTrue(fired)
            self.assertFalse(root.exists())
            self.assertEqual(
                len(list(quarantine.rglob("replacement"))), 1)
            self.assertEqual(
                len(list(quarantine.rglob("original"))), 1)


    def test_evidence_inventory_enforces_aggregate_file_and_byte_budgets(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            (root / "one.log").write_bytes(b"1234")
            (root / "two.log").write_bytes(b"5678")
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "file-count limit"):
                    provenance.evidence_inventory(
                        owned, max_files=1, max_total_bytes=100)
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "byte limit"):
                    provenance.evidence_inventory(
                        owned, max_files=10, max_file_bytes=10,
                        max_total_bytes=7)

    def test_bounded_regular_reader_rejects_oversize_before_reading(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); leaf = root / "large.json"
            leaf.write_bytes(b"x" * 1024)
            binding = provenance.owned_directory_binding(root)
            reads = []
            real_read = provenance.os.read
            def counted(fd, size):
                reads.append(size)
                return real_read(fd, size)
            with provenance.open_owned_directory(root, binding) as owned:
                with mock.patch.object(provenance.os, "read", counted):
                    with self.assertRaisesRegex(
                            provenance.ProvenanceError, "too large"):
                        provenance.read_owned_regular_bytes(
                            owned, "large.json", max_bytes=32)
            self.assertEqual(reads, [])

    def test_bounded_regular_reader_rejects_append_during_read(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); leaf = root / "receipt.json"
            leaf.write_bytes(b"inside")
            binding = provenance.owned_directory_binding(root)
            real_read = provenance.os.read
            fired = False
            def append_after_read(fd, size):
                nonlocal fired
                data = real_read(fd, size)
                if data and not fired:
                    fired = True
                    with leaf.open("ab") as stream:
                        stream.write(b"-raced")
                        stream.flush(); os.fsync(stream.fileno())
                return data
            with provenance.open_owned_directory(root, binding) as owned:
                with mock.patch.object(
                        provenance.os, "read", append_after_read):
                    with self.assertRaisesRegex(
                            provenance.ProvenanceError, "changed while it was read"):
                        provenance.read_owned_regular_bytes(
                            owned, "receipt.json", max_bytes=128)
            self.assertTrue(fired)


    def test_evidence_inventory_bounds_directory_entries_before_sorting(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            for name in ("one", "two", "three"):
                (root / name).mkdir()
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "entry-count limit"):
                    provenance.evidence_inventory(
                        owned, max_files=10, max_entries=2)

    def test_evidence_inventory_bounds_empty_directory_depth(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); current = root
            for name in ("one", "two", "three", "four"):
                current = current / name; current.mkdir()
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "depth limit"):
                    provenance.evidence_inventory(
                        owned, max_files=10, max_entries=10, max_depth=2)

    def test_evidence_inventory_applies_path_specific_budget_on_reread(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve()
            (root / "container.cid").write_bytes(b"x" * 257)
            binding = provenance.owned_directory_binding(root)
            with provenance.open_owned_directory(root, binding) as owned:
                with self.assertRaisesRegex(
                        provenance.ProvenanceError, "too large"):
                    provenance.evidence_inventory(
                        owned, path_limits={"container.cid": 256})


if __name__ == "__main__":
    unittest.main()
