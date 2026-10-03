"""Tier-0 tests for run-owned, sanitized tier-1 provenance evidence."""
from __future__ import annotations

import concurrent.futures
import json
import os
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
            root = Path(td)
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
            target = Path(td) / "manifest.json"
            provenance.atomic_write_manifest(target, _manifest())
            self.assertEqual(target.stat().st_mode & 0o777, 0o600)
            with self.assertRaisesRegex(provenance.ProvenanceError, "overwrite"):
                provenance.atomic_write_manifest(target, _manifest())

    def test_atomic_write_does_not_replace_existing_manifest_on_invalid_input(self):
        with tempfile.TemporaryDirectory() as td:
            target = Path(td) / "manifest.json"
            target.write_text("old\n")
            bad = _manifest()
            bad["schema_version"] = 999
            with self.assertRaises(provenance.ProvenanceError):
                provenance.atomic_write_manifest(target, bad)
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
            root = Path(td)
            (root / "setup.log").write_text("safe setup evidence\n")
            files = provenance.evidence_inventory(root)
            manifest = _manifest(files)
            provenance.verify_evidence(root, manifest)
            (root / "setup.log").write_text("tampered\n")
            with self.assertRaisesRegex(provenance.ProvenanceError, "hash mismatch"):
                provenance.verify_evidence(root, manifest)
            (root / "setup.log").write_text("safe setup evidence\n")
            (root / "stale.log").write_text("stale\n")
            with self.assertRaisesRegex(provenance.ProvenanceError, "inventory mismatch"):
                provenance.verify_evidence(root, manifest)

    def test_inventory_rejects_unsanitized_text_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            for value in ("Authorization: Bearer abcdefghijklmnop\n",
                          "endpoint=http://10.0.4.225:3133/mcp\n",
                          "path=/Users/alice/private\n",
                          "PRIME_API_KEY=not-a-real-secret\n"):
                (root / "bad.log").write_text(value)
                with self.assertRaisesRegex(provenance.ProvenanceError, "sanitized"):
                    provenance.evidence_inventory(root)

    def test_scratch_share_is_not_durable_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            root=Path(td); (root/"share").mkdir(); (root/"share"/"scratch.txt").write_text("scratch")
            (root/"setup.log").write_text("phase=ok\n")
            self.assertEqual([r["path"] for r in provenance.evidence_inventory(root)], ["setup.log"])

    def test_inventory_rejects_symlink_evidence(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            target = root / "target"
            target.write_text("x")
            (root / "link").symlink_to(target)
            with self.assertRaisesRegex(provenance.ProvenanceError, "symlink"):
                provenance.evidence_inventory(root)

    def test_repository_identity_changes_for_dirty_content_without_leaking_it(self):
        with tempfile.TemporaryDirectory() as td:
            repo = Path(td)
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
            root = Path(td) / "repo"; root.mkdir()
            subprocess.run(["git", "init", "-q", str(root)], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.email", "test@example.invalid"], check=True)
            subprocess.run(["git", "-C", str(root), "config", "user.name", "Test"], check=True)
            (root / ".gitignore").write_text(".env\n.test-results/\n")
            script = root / "run.sh"; script.write_text("#!/bin/sh\n"); script.chmod(0o755)
            (root / ".env").write_text("TOKEN=private\n")
            subprocess.run(["git", "-C", str(root), "add", ".gitignore", "run.sh"], check=True)
            subprocess.run(["git", "-C", str(root), "commit", "-qm", "base"], check=True)
            before = provenance.repository_identity(root)
            snapshot = Path(td) / "snapshot"
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
            root = Path(td)
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

    def test_ancestor_symlink_never_reads_or_copies_outside_root(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
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
            root = Path(td)
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
            base = Path(td)
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
            base = Path(td)
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
                with self.assertRaisesRegex(provenance.ProvenanceError,
                                            "root changed"):
                    provenance.stage_repository_snapshot(repo, snapshot)
            self.assertFalse((outside_destination / "input.txt").exists())
            self.assertEqual((moved_snapshot / "input.txt").read_text(), "inside\n")

    def test_regular_mode_swap_binds_identity_to_opened_inode(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
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
            root = Path(td)
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

    def test_safe_relative_leaf_symlink_is_preserved(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            repo = self._repo(root)
            (repo / "target.txt").write_text("safe\n")
            (repo / "link.txt").symlink_to("target.txt")
            subprocess.run(["git", "-C", str(repo), "add", "target.txt", "link.txt"],
                           check=True)
            subprocess.run(["git", "-C", str(repo), "commit", "-qm", "base"],
                           check=True)
            snapshot = root / "snapshot"
            provenance.stage_repository_snapshot(repo, snapshot)
            self.assertTrue((snapshot / "link.txt").is_symlink())
            self.assertEqual(os.readlink(snapshot / "link.txt"), "target.txt")


class TestEvidenceCaptureBoundary(unittest.TestCase):
    def test_unknown_encoding_directory_link_and_fifo_fail_closed(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            bad = root / "bad.log"
            bad.write_bytes(b"TOKEN=synthetic-marker\xff")
            with self.assertRaisesRegex(provenance.ProvenanceError, "encoding"):
                provenance.evidence_inventory(root)
            bad.unlink()
            real = root / "real"
            real.mkdir()
            (root / "dir-link").symlink_to(real, target_is_directory=True)
            with self.assertRaisesRegex(provenance.ProvenanceError, "symlink"):
                provenance.evidence_inventory(root)
            (root / "dir-link").unlink()
            if hasattr(os, "mkfifo"):
                os.mkfifo(root / "fifo")
                with self.assertRaisesRegex(provenance.ProvenanceError, "regular"):
                    provenance.evidence_inventory(root)

    def test_image_metadata_is_allow_listed_before_durable_write(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
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
            provenance.write_sanitized_json(path, safe)
            self.assertNotIn("private.local", path.read_text())
            unsafe = dict(raw, RepoDigests=[
                "private.local/team/image@sha256:" + "f" * 64],
                PrivateEndpoint="10.0.4.225")
            sanitized = provenance.image_identity(unsafe, **kwargs)
            private = root / "sanitized.json"
            provenance.write_sanitized_json(private, sanitized)
            written = private.read_text()
            self.assertEqual(sanitized["repo_digests"], [])
            self.assertNotIn("private.local", written)
            self.assertNotIn("10.0.4.225", written)


if __name__ == "__main__":
    unittest.main()
