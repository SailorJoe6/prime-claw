"""Hermetic Slice-2 coverage for disposable Prime Agent source builds."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import stat
import subprocess
import tempfile
from types import SimpleNamespace
import unittest
from unittest import mock

from scripts.testing import provenance
from scripts.testing import source_builder
from scripts.testing import source_builder_payload as payload

IMAGE = "sha256:" + "a" * 64
CID = "c" * 64


def _git(repo: Path, *args: str) -> None:
    subprocess.run(["git", "-C", str(repo), *args], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                   env={**os.environ, "GIT_OPTIONAL_LOCKS": "0"})


def _source_repo(root: Path) -> Path:
    repo = root / "source"
    repo.mkdir()
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "test@example.invalid")
    _git(repo, "config", "user.name", "Test")
    (repo / ".gitignore").write_text(
        "node_modules/\npackages/*/dist/\npackages/coding-agent/release/\n")
    (repo / "package.json").write_text(json.dumps({"name": "prime-agent",
                                                    "version": "0.9.8"}))
    (repo / "package-lock.json").write_text(
        json.dumps({"name": "prime-agent", "version": "0.9.8",
                    "lockfileVersion": 3, "requires": True, "packages": {}}))
    (repo / "marker.txt").write_text("marker-a")
    scripts = repo / "scripts"
    scripts.mkdir()
    (scripts / "pack-prime-agent-release.mjs").write_text("// fixture")
    os.symlink("marker.txt", repo / "marker-link")
    _git(repo, "add", ".")
    _git(repo, "commit", "-qm", "fixture")
    stale = repo / "packages/coding-agent/dist"
    stale.mkdir(parents=True)
    (stale / "stale.js").write_text("stale")
    release = repo / "packages/coding-agent/release/tier1"
    release.mkdir(parents=True)
    (release / "stale.tgz").write_bytes(b"stale")
    node_modules = repo / "node_modules/pkg"
    node_modules.mkdir(parents=True)
    (node_modules / "cache.js").write_text("cache")
    return repo


def _write_release(output: Path, source_identity: dict, marker: bytes = b"marker-a") -> dict:
    artifacts = output / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    version = "0.9.8"
    tar_names = [
        f"prime-agent-{version}.tgz", f"prime-agent-ai-{version}.tgz",
        f"prime-agent-core-{version}.tgz", f"prime-agent-tui-{version}.tgz",
    ]
    tar_hashes = {}
    for name in tar_names:
        data = name.encode() + b":" + marker
        (artifacts / name).write_bytes(data)
        (artifacts / name).chmod(0o644)
        tar_hashes[name] = hashlib.sha256(data).hexdigest()
    sums = "".join(f"{tar_hashes[name]}  {name}\n" for name in tar_names)
    (artifacts / "SHA256SUMS").write_text(sums)
    (artifacts / "stable").write_text("v0.9.8\n")
    (artifacts / "latest.json").write_text('{"version":"0.9.8"}\n')
    for name in ("SHA256SUMS", "stable", "latest.json"):
        (artifacts / name).chmod(0o644)
    records = []
    for path in sorted(artifacts.iterdir(), key=lambda item: item.name):
        records.append({"path": f"artifacts/{path.name}", "kind": "file",
                        "mode": 0o644, "size": path.stat().st_size,
                        "content_sha256": hashlib.sha256(path.read_bytes()).hexdigest()})
    main = next(row for row in records
                if row["path"] == "artifacts/prime-agent-0.9.8.tgz")
    value = {
        "schema_version": 1, "source": source_identity,
        "source_rules": {
            "include": "git-cached-plus-nonignored-untracked-v1",
            "exclude": "git-standard-ignored-and-dotgit-v1",
        },
        "package_version": version, "pack_command_sha256": "d" * 64,
        "artifact": main, "output_inventory": records,
        "output_inventory_sha256": provenance._framed_hash(
            records, domain="source-builder-output-v1"),
    }
    (output / "builder-output.json").write_text(
        json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n")
    return value


class TestSourceIdentityAndInventory(unittest.TestCase):
    def test_selected_source_and_complete_inventory_have_distinct_contracts(self):
        with tempfile.TemporaryDirectory() as td:
            repo = _source_repo(Path(td).resolve())
            selected_a = provenance.repository_source_manifest(repo)
            inventory_a = provenance.checkout_inventory(repo)
            text = json.dumps(selected_a)
            self.assertNotIn(str(repo), text)
            paths = {row["path"] for row in selected_a["records"]}
            self.assertIn("marker.txt", paths)
            self.assertIn("marker-link", paths)
            link = next(row for row in selected_a["records"]
                        if row["path"] == "marker-link")
            self.assertEqual(link["mode"], 0o777)
            self.assertNotIn("packages/coding-agent/dist/stale.js", paths)
            (repo / "packages/coding-agent/dist/stale.js").write_text("changed")
            selected_b = provenance.repository_source_manifest(repo)
            inventory_b = provenance.checkout_inventory(repo)
            self.assertEqual(selected_a["identity"], selected_b["identity"])
            self.assertNotEqual(inventory_a, inventory_b)

    def test_dirty_and_untracked_inputs_change_selected_content_identity(self):
        with tempfile.TemporaryDirectory() as td:
            repo = _source_repo(Path(td).resolve())
            clean = provenance.repository_source_manifest(repo)
            (repo / "marker.txt").write_text("marker-b")
            (repo / "new-source.ts").write_text("export const value = 2;\n")
            dirty = provenance.repository_source_manifest(repo)
            self.assertTrue(dirty["identity"]["dirty"])
            self.assertNotEqual(clean["identity"]["content_sha256"],
                                dirty["identity"]["content_sha256"])
            self.assertIn("new-source.ts", {row["path"] for row in dirty["records"]})


class TestBuilderPayload(unittest.TestCase):
    def test_dirty_input_changes_export_and_never_mutates_stale_source_outputs(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve()
            repo = _source_repo(base)
            before = provenance.checkout_inventory(repo)

            def fake_run(argv, cwd, env):
                if any(item.endswith("pack-prime-agent-release.mjs") for item in argv):
                    out = cwd / "packages/coding-agent/release/tier1/artifacts"
                    out.mkdir(parents=True)
                    marker = (cwd / "marker.txt").read_bytes()
                    names = ["prime-agent-0.9.8.tgz", "prime-agent-ai-0.9.8.tgz",
                             "prime-agent-core-0.9.8.tgz", "prime-agent-tui-0.9.8.tgz"]
                    hashes = {}
                    for name in names:
                        data = name.encode() + b":" + marker
                        (out / name).write_bytes(data)
                        hashes[name] = hashlib.sha256(data).hexdigest()
                    (out / "SHA256SUMS").write_text(
                        "".join(f"{hashes[name]}  {name}\n" for name in names))
                    (out / "stable").write_text("v0.9.8\n")
                    (out / "latest.json").write_text('{"version":"0.9.8"}\n')

            manifest_a = provenance.repository_source_manifest(repo)
            manifest_path = base / "manifest-a.json"
            manifest_path.write_text(json.dumps(manifest_a))
            output_a = base / "output-a"; output_a.mkdir()
            with mock.patch.object(payload, "_run", fake_run):
                result_a = payload.build(repo, manifest_path, output_a, base / "work-a")
            (repo / "marker.txt").write_text("marker-b")
            manifest_b = provenance.repository_source_manifest(repo)
            manifest_b_path = base / "manifest-b.json"
            manifest_b_path.write_text(json.dumps(manifest_b))
            output_b = base / "output-b"; output_b.mkdir()
            with mock.patch.object(payload, "_run", fake_run):
                result_b = payload.build(repo, manifest_b_path, output_b, base / "work-b")
            self.assertNotEqual(result_a["source"]["content_sha256"],
                                result_b["source"]["content_sha256"])
            self.assertNotEqual(result_a["artifact"]["content_sha256"],
                                result_b["artifact"]["content_sha256"])
            expected_after = provenance.checkout_inventory(repo)
            self.assertNotEqual(before, expected_after)  # only the intentional dirty edit
            self.assertEqual((repo / "packages/coding-agent/dist/stale.js").read_text(),
                             "stale")
            self.assertEqual((repo / "packages/coding-agent/release/tier1/stale.tgz").read_bytes(),
                             b"stale")

    def test_build_and_pack_failure_leave_checkout_inventory_identical(self):
        with tempfile.TemporaryDirectory() as td:
            base = Path(td).resolve(); repo = _source_repo(base)
            manifest = provenance.repository_source_manifest(repo)
            manifest_path = base / "manifest.json"
            manifest_path.write_text(json.dumps(manifest))
            before = provenance.checkout_inventory(repo)
            for index, failing_command in enumerate(("build", "pack")):
                output = base / f"output-{index}"; output.mkdir()
                def fail(argv, cwd, env, target=failing_command):
                    if (target == "build" and argv[:3] == ["npm", "run", "build"]) \
                            or (target == "pack" and any(item.endswith("pack-prime-agent-release.mjs") for item in argv)):
                        raise payload.BuildError("injected")
                with mock.patch.object(payload, "_run", fail):
                    with self.assertRaises(payload.BuildError):
                        payload.build(repo, manifest_path, output,
                                      base / f"work-{index}")
                self.assertEqual(before, provenance.checkout_inventory(repo))


class TestHostBuilderLifecycle(unittest.TestCase):
    def _run(self, *, builder_exit: int = 0,
             inspect_outcome: str = "exited", inspect_rc: int = 1,
             inspect_stdout: str | bytes = "",
             inspect_stderr: str | bytes = f"Error: No such object: {CID}",
             remove_outcome: str = "exited", remove_rc: int = 0,
             signal_during_validation: bool = False,
             signal_after_publication: bool = False,
             fail_after_publication: bool = False,
             fail_failed_replacement: bool = False):
        temporary = tempfile.TemporaryDirectory()
        base = Path(temporary.name).resolve()
        repo = _source_repo(base)
        workspace = base / "workspace"
        (workspace / "docker").mkdir(parents=True)
        (workspace / "scripts/testing").mkdir(parents=True)
        shutil.copy2(Path("docker/test-prime-agent-builder.Dockerfile"),
                     workspace / "docker/test-prime-agent-builder.Dockerfile")
        shutil.copy2(Path("scripts/testing/source_builder_payload.py"),
                     workspace / "scripts/testing/source_builder_payload.py")
        _run_id, tier, tier_binding = provenance.allocate_run_tree(base / "results", "tier1")
        share = tier / "share"; share.mkdir(mode=0o700)
        share_binding = provenance.owned_directory_binding(share)
        calls = []

        def fake_run(argv, *, timeout, policy="capture"):
            calls.append(list(argv))
            if argv[1] == "build":
                iidfile = Path(argv[argv.index("--iidfile") + 1])
                iidfile.write_text(IMAGE + "\n")
                return SimpleNamespace(outcome="exited", returncode=0, stdout="", stderr="")
            if argv[1:3] == ["image", "inspect"]:
                raw = [{"Id": IMAGE, "RepoDigests": [],
                        "Os": "linux", "Architecture": "arm64"}]
                return SimpleNamespace(outcome="exited", returncode=0,
                                       stdout=json.dumps(raw), stderr="")
            if argv[1] == "run":
                cidfile = Path(argv[argv.index("--cidfile") + 1])
                cidfile.write_text(CID + "\n")
                return SimpleNamespace(outcome="exited", returncode=0, stdout="", stderr="")
            if argv[1:3] == ["inspect", "--format"]:
                mounts = [
                    {"Type": "bind", "Destination": "/source", "RW": False},
                    {"Type": "bind", "Destination": "/input/source-manifest.json", "RW": False},
                    {"Type": "bind", "Destination": "/output", "RW": True},
                ]
                return SimpleNamespace(outcome="exited", returncode=0,
                                       stdout=json.dumps(mounts), stderr="")
            if argv[1] == "wait":
                if builder_exit == 0:
                    manifest = json.loads((tier / "source-manifest.json").read_text())
                    _write_release(share / "source-release", manifest["identity"])
                return SimpleNamespace(outcome="exited", returncode=0,
                                       stdout=str(builder_exit) + "\n", stderr="")
            if argv[1:3] == ["rm", "-f"]:
                return SimpleNamespace(outcome=remove_outcome,
                                       returncode=remove_rc,
                                       stdout="", stderr="")
            if argv[1] == "inspect":
                return SimpleNamespace(outcome=inspect_outcome,
                                       returncode=inspect_rc,
                                       stdout=inspect_stdout,
                                       stderr=inspect_stderr)
            raise AssertionError(argv)

        args = argparse.Namespace(
            source=str(repo), workspace=str(workspace), tier_dir=str(tier),
            tier_binding=tier_binding, share=str(share),
            share_binding=share_binding, image_timeout=60.0, build_timeout=60.0)
        original_validate = source_builder._validate_release
        def validate_with_optional_signal(*validate_args, **validate_kwargs):
            if signal_during_validation:
                handler = signal.getsignal(signal.SIGTERM)
                handler(signal.SIGTERM, None)
            return original_validate(*validate_args, **validate_kwargs)
        original_write = provenance.write_sanitized_json
        def write_with_optional_signal(root, relative, value):
            binding = original_write(root, relative, value)
            if str(relative) == "source-build.json":
                if signal_after_publication:
                    handler = signal.getsignal(signal.SIGTERM)
                    handler(signal.SIGTERM, None)
                if fail_after_publication:
                    raise OSError("injected post-publication verification failure")
            return binding
        replacement_patch = (
            mock.patch.object(
                provenance, "replace_sanitized_json",
                side_effect=provenance.ProvenanceError(
                    "injected pre-exchange replacement failure"))
            if fail_failed_replacement else mock.patch.object(
                provenance, "replace_sanitized_json",
                wraps=provenance.replace_sanitized_json))
        with (mock.patch.object(source_builder, "_run", fake_run),
              mock.patch.object(source_builder, "_validate_release",
                                side_effect=validate_with_optional_signal),
              mock.patch.object(provenance, "write_sanitized_json",
                                side_effect=write_with_optional_signal),
              replacement_patch):
            rc = source_builder.execute(args)
        receipt = json.loads((tier / "source-build.json").read_text())
        return temporary, repo, tier, calls, receipt, rc

    def test_exact_iid_cid_read_only_mount_and_clean_teardown(self):
        temporary, repo, _tier, calls, receipt, rc = self._run()
        with temporary:
            self.assertEqual(rc, 0)
            self.assertEqual(receipt["status"], "passed")
            self.assertEqual(receipt["checkout_inventory_before"],
                             receipt["checkout_inventory_after"])
            run = next(call for call in calls if call[1] == "run")
            joined = "\n".join(run)
            self.assertIn(f"src={repo},dst=/source,readonly", joined)
            self.assertNotIn("docker.sock", joined)
            self.assertNotIn(str(Path.home()), joined)
            self.assertEqual(run[-1], IMAGE)
            self.assertIn(["docker", "rm", "-f", CID], calls)
            self.assertIn(["docker", "inspect", CID], calls)

    def test_builder_absence_requires_exact_allowlisted_diagnostic(self):
        for diagnostic, stdout in (
                (f"Error: No such object: {CID}", ""),
                (f"error: no such object: {CID}", "[]\n"),
                (f"Error response from daemon: No such container: {CID}", "")):
            with self.subTest(diagnostic=diagnostic, stdout=stdout):
                temporary, _repo, _tier, calls, receipt, rc = self._run(
                    inspect_stdout=stdout, inspect_stderr=diagnostic)
                with temporary:
                    self.assertEqual(rc, 0)
                    self.assertEqual(receipt["status"], "passed")
                    self.assertEqual(receipt["builder_teardown"]["state"], "absent")
                    self.assertTrue(receipt["builder_teardown"]["clean"])
                    self.assertEqual(
                        [call for call in calls if call[1] in {"rm", "inspect"}
                         and call[:3] != ["docker", "inspect", "--format"]][-2:],
                        [["docker", "rm", "-f", CID],
                         ["docker", "inspect", CID]])

    def test_unknown_builder_inspection_never_greens_or_leaks_diagnostics(self):
        cases = (
            ("daemon", "exited", 1, "", "Cannot connect to the Docker daemon", "unknown", "ordinary_nonzero"),
            ("permission", "exited", 1, "", "permission denied", "unknown", "ordinary_nonzero"),
            ("unrecognized", "exited", 1, "", "absent", "unknown", "ordinary_nonzero"),
            ("non_utf8", "exited", 1, b"", b"\xffno such object: " + CID.encode(), "unknown", "ordinary_nonzero"),
            ("timed_out", "timed_out", 124, "", "", "unknown", "timed_out"),
            ("signaled", "signaled", -15, "", "", "unknown", "signaled"),
            ("launch_error", "launch_error", 127, "", "", "unknown", "launch_error"),
            ("present", "exited", 0, "[{}]", "", "present", "clean"),
        )
        for name, outcome, rc_value, stdout, stderr, state, inspect_result in cases:
            with self.subTest(case=name):
                temporary, _repo, _tier, calls, receipt, rc = self._run(
                    inspect_outcome=outcome, inspect_rc=rc_value,
                    inspect_stdout=stdout, inspect_stderr=stderr)
                with temporary:
                    self.assertNotEqual(rc, 0)
                    self.assertEqual(receipt["status"], "failed")
                    self.assertIn("teardown-failed", receipt["failure_codes"])
                    teardown = receipt["builder_teardown"]
                    self.assertEqual(teardown["state"], state)
                    self.assertEqual(teardown["inspect_outcome"], inspect_result)
                    self.assertFalse(teardown["clean"])
                    serialized = json.dumps(receipt, sort_keys=True)
                    self.assertNotIn("Cannot connect", serialized)
                    self.assertNotIn("permission denied", serialized)
                    teardown_calls = [call for call in calls
                                      if call[:3] == ["docker", "rm", "-f"]
                                      or call[:2] == ["docker", "inspect"]
                                      and call[:3] != ["docker", "inspect", "--format"]]
                    self.assertEqual(teardown_calls[-2:], [
                        ["docker", "rm", "-f", CID],
                        ["docker", "inspect", CID]])

    def test_remove_failure_stays_nonclean_even_when_inspect_proves_absence(self):
        cases = (("exited", 1, "ordinary_nonzero"),
                 ("timed_out", 124, "timed_out"),
                 ("signaled", -15, "signaled"))
        for outcome, rc_value, expected in cases:
            with self.subTest(outcome=outcome):
                temporary, _repo, _tier, _calls, receipt, rc = self._run(
                    remove_outcome=outcome, remove_rc=rc_value)
                with temporary:
                    self.assertNotEqual(rc, 0)
                    teardown = receipt["builder_teardown"]
                    self.assertEqual(teardown["state"], "absent")
                    self.assertEqual(teardown["remove_outcome"], expected)
                    self.assertFalse(teardown["clean"])
                    self.assertEqual(receipt["status"], "failed")

    def test_nonzero_builder_cannot_green_or_skip_exact_cleanup(self):
        temporary, _repo, _tier, calls, receipt, rc = self._run(builder_exit=9)
        with temporary:
            self.assertNotEqual(rc, 0)
            self.assertEqual(receipt["status"], "failed")
            self.assertIn("builder-failed", receipt["failure_codes"])
            self.assertEqual(receipt["checkout_inventory_before"],
                             receipt["checkout_inventory_after"])
            self.assertIn(["docker", "rm", "-f", CID], calls)
            self.assertIn(["docker", "inspect", CID], calls)

    def test_signal_during_validation_publishes_failed_interrupted_receipt(self):
        temporary, _repo, _tier, calls, receipt, rc = self._run(
            signal_during_validation=True)
        with temporary:
            self.assertEqual(rc, 128 + signal.SIGTERM)
            self.assertEqual(receipt["status"], "failed")
            self.assertIn("interrupted", receipt["failure_codes"])
            self.assertIn(["docker", "rm", "-f", CID], calls)
            self.assertIn(["docker", "inspect", CID], calls)

    def test_post_rename_publication_failure_cannot_leave_green_receipt(self):
        temporary, _repo, tier, _calls, receipt, rc = self._run(
            fail_after_publication=True)
        with temporary:
            self.assertEqual(rc, 1)
            self.assertEqual(receipt["status"], "failed")
            self.assertIn("publication-failed", receipt["failure_codes"])
            preserved = [json.loads(path.read_text())
                         for path in (tier / ".publication").glob("*")]
            self.assertTrue(any(item.get("status") == "passed"
                                for item in preserved))

    def test_failed_late_replacement_still_invalidates_public_green(self):
        temporary, _repo, tier, _calls, receipt, rc = self._run(
            signal_after_publication=True, fail_failed_replacement=True)
        with temporary:
            self.assertEqual(rc, 128 + signal.SIGTERM)
            self.assertEqual(receipt["status"], "failed")
            self.assertEqual(receipt["reason"], "publication-failed")
            preserved = [json.loads(path.read_text())
                         for path in (tier / ".publication").glob("*")]
            self.assertTrue(any(item.get("status") == "passed"
                                for item in preserved))

    def test_signal_after_green_publication_atomically_replaces_with_failed(self):
        temporary, _repo, tier, _calls, receipt, rc = self._run(
            signal_after_publication=True)
        with temporary:
            self.assertEqual(rc, 128 + signal.SIGTERM)
            self.assertEqual(receipt["status"], "failed")
            self.assertIn("interrupted", receipt["failure_codes"])
            preserved = list((tier / ".publication").glob("*"))
            self.assertTrue(preserved)
            self.assertNotEqual((tier / "source-build.json").read_bytes(),
                                preserved[-1].read_bytes())

    def test_tampered_or_extra_release_output_is_rejected(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td).resolve(); output = root / "output"; output.mkdir()
            source = {"head": "b" * 40, "dirty": False,
                      "status_sha256": "a" * 64, "content_sha256": "c" * 64,
                      "entry_count": 1, "content_hash_contract": "framed-sha256-v2"}
            manifest = _write_release(output, source)
            source_builder._validate_release(output, manifest)
            (output / "artifacts/prime-agent-0.9.8.tgz").write_bytes(b"tampered")
            with self.assertRaises(source_builder.BuilderError):
                source_builder._validate_release(output, manifest)
            (output / "artifacts/prime-agent-0.9.8.tgz").write_bytes(
                b"prime-agent-0.9.8.tgz:marker-a")
            (output / "artifacts/extra.tgz").write_bytes(b"extra")
            with self.assertRaises(source_builder.BuilderError):
                source_builder._validate_release(output, manifest)

        with tempfile.TemporaryDirectory() as td:
            output = Path(td).resolve() / "output"; output.mkdir()
            manifest = _write_release(output, source)
            nested = output / "artifacts/sub/stable"
            nested.parent.mkdir()
            nested.write_text("v0.9.8\n")
            nested.chmod(0o644)
            nested_record = {
                "path": "artifacts/sub/stable", "kind": "file", "mode": 0o644,
                "size": nested.stat().st_size,
                "content_sha256": hashlib.sha256(nested.read_bytes()).hexdigest(),
            }
            manifest["output_inventory"].append(nested_record)
            manifest["output_inventory"].sort(key=lambda row: row["path"])
            manifest["output_inventory_sha256"] = provenance._framed_hash(
                manifest["output_inventory"], domain="source-builder-output-v1")
            with self.assertRaises(source_builder.BuilderError):
                source_builder._validate_release(output, manifest)


class TestSourceManifestSchema(unittest.TestCase):
    def _manifest(self):
        source = {"head": "b" * 40, "dirty": True,
                  "status_sha256": "a" * 64, "content_sha256": "c" * 64,
                  "entry_count": 2, "content_hash_contract": "framed-sha256-v2"}
        with tempfile.TemporaryDirectory() as td:
            output = Path(td).resolve() / "output"; output.mkdir()
            release = _write_release(output, source)
        inventory = {"content_sha256": "1" * 64, "entry_count": 3,
                     "kind_counts": {"directory": 1, "file": 2},
                     "content_hash_contract": "framed-sha256-checkout-v1"}
        runtime_image = {"id": IMAGE, "repo_digests": [],
                         "dockerfile": "docker/test.Dockerfile",
                         "dockerfile_sha256": "2" * 64,
                         "declared_input_sha256": "3" * 64,
                         "declared_input_hash_contract": "framed-sha256-v2",
                         "informational_tag": "prime-claw-test-tier1:" + "3" * 12,
                         "os": "linux", "architecture": "arm64",
                         "build_started_at": "2026-10-03T20:00:00Z",
                         "build_finished_at": "2026-10-03T20:01:00Z"}
        builder_image = dict(runtime_image,
                             dockerfile="docker/test-prime-agent-builder.Dockerfile",
                             informational_tag="prime-claw-test-prime-agent-builder:" + "4" * 12)
        return {
            "schema_version": provenance.SCHEMA_VERSION,
            "command_contract_version": provenance.COMMAND_CONTRACT_VERSION,
            "run": {"id": "20261003T200000Z-123-a1b2c3d4", "tier": "tier1",
                    "mode": "source", "started_at": "2026-10-03T20:00:00Z",
                    "finished_at": "2026-10-03T20:02:00Z", "status": "passed",
                    "failure_codes": []},
            "repository": {"head": "d" * 40, "dirty": False,
                           "status_sha256": "5" * 64,
                           "content_sha256": "6" * 64, "entry_count": 1,
                           "content_hash_contract": "framed-sha256-v2"},
            "prime_agent": {"mode": "source", "requested_version": "0.9.8",
                            "installed_version": "0.9.8",
                            "artifact": {"kind": "vendor-binary", "version": "0.9.8",
                                         "executable_sha256": "7" * 64},
                            "source": source,
                            "source_rules": release["source_rules"],
                            "staged_release": release,
                            "builder": {"image": builder_image,
                                        "teardown": {"container_id": CID,
                                                     "state": "absent",
                                                     "remove_outcome": "clean",
                                                     "inspect_outcome": "ordinary_nonzero",
                                                     "clean": True,
                                                     "verified_at": "2026-10-03T20:01:30Z"},
                                        "checkout_inventory_before": inventory,
                                        "checkout_inventory_after": dict(inventory)}},
            "image": runtime_image,
            "network": {"disconnected_at": "2026-10-03T20:01:40Z",
                        "verified_absent": True},
            "teardown": {"state": "absent", "verified_at": "2026-10-03T20:02:00Z",
                         "remove_outcome": "clean", "inspect_outcome": "ordinary_nonzero",
                         "clean": True},
            "evidence": {"files": []},
        }

    def test_complete_source_lineage_is_accepted(self):
        provenance.validate_manifest(self._manifest())

    def _receipt(self):
        manifest = self._manifest()
        builder = manifest["prime_agent"]["builder"]
        return {
            "schema_version": 1, "status": "passed",
            "started_at": "2026-10-03T20:00:00Z",
            "finished_at": "2026-10-03T20:02:00Z",
            "failure_codes": [],
            "source": manifest["prime_agent"]["source"],
            "source_rules": manifest["prime_agent"]["source_rules"],
            "checkout_inventory_before": builder["checkout_inventory_before"],
            "checkout_inventory_after": builder["checkout_inventory_after"],
            "builder_image": builder["image"],
            "builder_teardown": builder["teardown"],
            "release": manifest["prime_agent"]["staged_release"],
        }

    def test_ordinary_nonzero_removal_never_releases_builder_ownership(self):
        receipt = self._receipt()
        receipt["builder_teardown"]["remove_outcome"] = "ordinary_nonzero"
        with self.assertRaises(provenance.ProvenanceError):
            provenance.source_builder_share_teardown(receipt)

        receipt["status"] = "failed"
        receipt["failure_codes"] = ["teardown-failed"]
        receipt["builder_teardown"]["clean"] = False
        teardown = provenance.source_builder_share_teardown(receipt)
        self.assertEqual(teardown["state"], "absent")
        self.assertEqual(teardown["remove_outcome"], "ordinary_nonzero")
        self.assertFalse(teardown["clean"])

        manifest = self._manifest()
        manifest["prime_agent"]["builder"]["teardown"]["remove_outcome"] = \
            "ordinary_nonzero"
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)

        manifest["run"]["status"] = "failed"
        manifest["run"]["failure_codes"] = ["controlled-failure"]
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)
        manifest["prime_agent"]["builder"]["teardown"]["clean"] = False
        provenance.validate_manifest(manifest)

    def test_unhashable_receipt_and_manifest_fields_are_typed_rejections(self):
        receipt_mutations = (
            ("status",),
            ("builder_teardown", "container_id"),
            ("builder_teardown", "state"),
            ("builder_teardown", "remove_outcome"),
            ("builder_teardown", "inspect_outcome"),
            ("builder_teardown", "verified_at"),
        )
        for path in receipt_mutations:
            with self.subTest(receipt=path):
                receipt = self._receipt()
                target = receipt
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = []
                with self.assertRaises(provenance.ProvenanceError):
                    provenance.source_builder_share_teardown(receipt)

        manifest_mutations = (
            ("run", "mode"), ("run", "status"),
            ("prime_agent", "builder", "teardown", "container_id"),
            ("prime_agent", "builder", "teardown", "state"),
            ("prime_agent", "builder", "teardown", "remove_outcome"),
            ("prime_agent", "builder", "teardown", "inspect_outcome"),
            ("prime_agent", "builder", "teardown", "verified_at"),
            ("teardown", "state"), ("teardown", "remove_outcome"),
            ("teardown", "inspect_outcome"),
        )
        for path in manifest_mutations:
            with self.subTest(manifest=path):
                manifest = self._manifest()
                target = manifest
                for key in path[:-1]:
                    target = target[key]
                target[path[-1]] = []
                with self.assertRaises(provenance.ProvenanceError):
                    provenance.validate_manifest(manifest)

        manifest = self._manifest()
        manifest["evidence"]["files"] = [{"path": [], "sha256": "a" * 64}]
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)

    def test_changed_checkout_or_release_lineage_is_rejected(self):
        manifest = self._manifest()
        manifest["prime_agent"]["builder"]["checkout_inventory_after"]["content_sha256"] = "8" * 64
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)
        manifest = self._manifest()
        manifest["prime_agent"]["staged_release"]["source"] = dict(
            manifest["prime_agent"]["staged_release"]["source"])
        manifest["prime_agent"]["staged_release"]["source"]["content_sha256"] = "9" * 64
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)

    def test_source_release_requires_exact_paths_and_inventory_hash(self):
        manifest = self._manifest()
        release = manifest["prime_agent"]["staged_release"]
        release["output_inventory"].append({
            "path": "artifacts/sub/stable", "kind": "file", "mode": 0o644,
            "size": 7, "content_sha256": "8" * 64,
        })
        release["output_inventory"].sort(key=lambda record: record["path"])
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)
        release["output_inventory_sha256"] = provenance._framed_hash(
            release["output_inventory"], domain="source-builder-output-v1")
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)

    def test_private_path_and_unclean_builder_teardown_are_rejected(self):
        manifest = self._manifest()
        manifest["prime_agent"]["builder"]["teardown"]["state"] = "present"
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)
        manifest = self._manifest()
        manifest["prime_agent"]["source_rules"]["include"] = "/Users/private/source"
        with self.assertRaises(provenance.ProvenanceError):
            provenance.validate_manifest(manifest)


class TestConsumerStaticContract(unittest.TestCase):
    def test_both_consumers_use_only_the_canonical_builder(self):
        driver = Path("scripts/test-tier1.sh").read_text()
        fixture = Path("tests/conftest.py").read_text()
        self.assertEqual(driver.count("build-prime-agent-test-release.sh"), 1)
        self.assertEqual(fixture.count("build-prime-agent-test-release.sh"), 1)
        for text in (driver, fixture):
            self.assertNotIn("npm run build", text)
            self.assertNotIn("pack-prime-agent-release.mjs", text)
        self.assertNotIn("$SOURCE/packages", driver)
        self.assertNotIn("source / \"packages\"", fixture)


if __name__ == "__main__":
    unittest.main()
