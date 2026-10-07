from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
from pathlib import Path
import subprocess
import sys
import tarfile
from types import SimpleNamespace

import pytest

from scripts.testing import bounded
from scripts.testing import integration_driver as driver
from scripts.testing import integration_provenance as ip
from scripts.testing.gbrain_property_contract import digest as normalized_digest, dry_payload, source_payload

REPO = Path(__file__).resolve().parents[1]
RUN_ID = "20261006T040000Z-1234-a1b2c3d4"
IMAGE_ID = "sha256:" + "1" * 64
CONTAINER_ID = "2" * 64
TAG = "prime-claw-test-integration:" + "3" * 12


def _result(argv, *, rc=0, stdout="", stderr="", outcome="exited"):
    return bounded.BoundedResult(
        args=list(argv), returncode=rc, stdout=stdout, stderr=stderr,
        outcome=outcome)


def _repository():
    return {"head": "9" * 40, "dirty": False,
            "content_sha256": "8" * 64, "selected_file_count": 9}


def _lock():
    return ip.load_lock(REPO / "config/test-artifacts.lock.json")


def _image_row(run_id=RUN_ID, tag=TAG):
    return {
        "Id": IMAGE_ID, "Os": "linux", "Architecture": "arm64",
        "RepoTags": [tag], "RepoDigests": [],
        "Config": {"Labels": {
            "org.prime-claw.test.contract": ip.CONTRACT,
            "org.prime-claw.test.run": run_id,
        }},
    }


def _container_row(run_id=RUN_ID, name=None):
    name = name or "prime-claw-integration-" + run_id.lower()
    return {
        "Id": CONTAINER_ID, "Image": IMAGE_ID, "Name": "/" + name,
        "Config": {
            "User": "tester",
            "Labels": {
                "org.prime-claw.test.contract": ip.CONTRACT,
                "org.prime-claw.test.run": run_id,
            },
            "Env": [
                "PATH=/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin",
                "HOME=/home/tester", "LANG=C.UTF-8",
                "PRIME_CLAW_INTEGRATION_CONTAINER=1",
                "PRIME_CLAW_INTEGRATION_ATTESTATION=" + "a" * 64,
                "PRIME_CLAW_INTEGRATION_RUN_ID=" + run_id,
            ],
            "ExposedPorts": None,
        },
        "HostConfig": {
            "NetworkMode": "none", "Privileged": False,
            "PidMode": "", "IpcMode": "private", "Binds": None,
            "VolumesFrom": None, "PortBindings": None,
        },
        "Mounts": [],
    }


def _snapshot(commit="a" * 40):
    tables = dict(zip(("config", "gbrain_cycle_locks", "pages", "sources"),
                      ("c" * 64, "d" * 64, "e" * 64, "f" * 64), strict=True))
    return {
        "schema_sha256": "1" * 64,
        "schema_object_count": 100,
        "migration_version": "149",
        "source_bookmark": {"id": "fixture", "last_commit": commit},
        "sequence_sha256": "2" * 64,
        "sequence_count": 5,
        "table_hashes": tables,
        "table_row_counts": {name: 0 for name in tables},
        "rows_sha256": "3" * 64,
        "failure_ledger_sha256": "4" * 64,
        "failure_ledger_lock": {"exists": False, "sha256": "5" * 64},
        "persistent_locks": {"cycle_rows_sha256": tables["gbrain_cycle_locks"],
                             "advisory_lock_count": 0},
        "post_exit_fixture_sessions": 0,
        "config_sha256": "6" * 64,
        "config_raw_sha256": "7" * 64,
        "config_semantics_sha256": "b" * 64,
        "worktree": {"head": commit, "status_sha256": "8" * 64,
                     "tree_sha256": "9" * 64},
        "bare_refs_sha256": "a" * 64,
    }


def _stack(seed):
    return {
        "database_id": seed * 64, "pgdata_id": "b" * 64,
        "gbrain_home_id": "c" * 64, "database_name_sha256": "d" * 64,
        "gbrain_version": "gbrain 0.50.0.0",
        "postgres_version": "16.15", "postgres_version_num": "160015",
        "pgvector_version": "0.6.0",
    }


def _dry_property(suffix, seed):
    commit = ("a" if suffix == "a" else "b") * 40
    snapshot = _snapshot(commit)
    return {
        "schema_version": 1, "contract": "gbrain-dry-run-v1",
        "run_id": RUN_ID, "property_run_id": f"dry-run-{suffix}",
        "fixture_manifest_sha256": ip._expected_asset_hashes()["fixtures/brain-properties/manifest.json"],
        "delta_commit": commit, "command": ip.DRY_COMMAND,
        "outcome": "exited", "exit_code": 0, "stdout": "dry run", "stderr": "",
        "stdout_sha256": "1" * 64, "stderr_sha256": "2" * 64,
        "snapshot_before": snapshot, "snapshot_after": copy.deepcopy(snapshot),
        "logical_mutation": False,
        "normalized_result_sha256": normalized_digest(dry_payload(
            command=ip.DRY_COMMAND, exit_code=0, logical_mutation=False, snapshot=snapshot)),
        "stack": _stack(seed), "postgres_stopped": True,
    }


def _source_property(suffix, seed):
    commit = ("c" if suffix == "a" else "d") * 40
    records = [
        {"path": "people/ada-example.md", "slug": "people/ada-example", "state": "superseded", "representation": "tombstone", "reason": "renamed"},
        {"path": "people/ada-renamed.md", "slug": "people/ada-renamed", "state": "live", "representation": "row"},
        {"path": "projects/meridian.md", "slug": "projects/meridian", "state": "live", "representation": "row"},
        {"path": "concepts/quartz.md", "slug": "concepts/quartz", "state": "live", "representation": "row"},
        {"path": "archive/retired.md", "slug": "archive/retired", "state": "deleted", "representation": "tombstone"},
        {"path": "broken/frontmatter.md", "slug": "broken/frontmatter", "state": "excluded", "representation": "absent", "reason": "invalid-yaml-frontmatter"},
    ]
    rows = [
        {"path": "people/ada-example.md", "slug": "people/ada-example", "deleted": True, "title": "Ada Example"},
        {"path": "people/ada-renamed.md", "slug": "people/ada-renamed", "deleted": False, "title": "Ada Renamed"},
        {"path": "projects/meridian.md", "slug": "projects/meridian", "deleted": False, "title": "Meridian Fixture"},
        {"path": "concepts/quartz.md", "slug": "concepts/quartz", "deleted": False, "title": "Quartz Fixture"},
        {"path": "archive/retired.md", "slug": "archive/retired", "deleted": True, "title": "Retired Fixture"},
    ]
    accounting = {"records": records, "database_rows": rows,
                  "path_count": 6, "row_count": 5, "exclusion_count": 2}
    malformed = {
        "path": "broken/frontmatter.md", "slug": "broken/frontmatter",
        "reason": "invalid-yaml-frontmatter", "commit": "e" * 40,
        "command": ip.SOURCE_COMMAND, "outcome": "exited", "exit_code": 0,
        "stdout": "BLOCKED", "stderr": "", "bookmark_before": commit,
        "bookmark_after": commit, "rows_before_sha256": "6" * 64,
        "rows_after_sha256": "6" * 64, "failure_ledger_sha256": "7" * 64,
        "stdout_sha256": "8" * 64, "stderr_sha256": "9" * 64,
    }
    return {
        "schema_version": 1, "contract": "gbrain-source-coverage-v1",
        "run_id": RUN_ID, "property_run_id": f"source-coverage-{suffix}",
        "fixture_manifest_sha256": ip._expected_asset_hashes()["fixtures/brain-properties/manifest.json"],
        "delta_commit": commit, "command": ip.SOURCE_COMMAND,
        "outcome": "exited", "exit_code": 0, "stdout": "synced", "stderr": "",
        "stdout_sha256": "4" * 64, "stderr_sha256": "5" * 64,
        "accounting": accounting,
        "logical_snapshot": _snapshot(commit),
        "malformed_frontmatter": malformed,
        "normalized_result_sha256": normalized_digest(source_payload(
            command=ip.SOURCE_COMMAND, accounting=accounting, malformed=malformed)),
        "stack": _stack(seed), "postgres_stopped": True,
    }


def _body(lock=None, repository=None, run_id=RUN_ID):
    lock = lock or _lock()
    repository = repository or _repository()
    dry = [_dry_property("a", "1"), _dry_property("b", "2")]
    source = [_source_property("a", "3"), _source_property("b", "4")]
    property_rows = dry + source
    return {
        "schema_version": 1,
        "contract": ip.BODY_CONTRACT,
        "run_id": run_id,
        "started_at": "2026-10-06T04:00:00Z",
        "finished_at": "2026-10-06T04:01:00Z",
        "attestation_sha256": "7" * 64,
        "platform": "linux/arm64",
        "non_root": True,
        "uid": 10001,
        "source_baked": True,
        "repository": repository,
        "external_tcp_refused": True,
        "environment_names_sha256": "6" * 64,
        "artifact_lock_sha256": hashlib.sha256(
            (ip.canonical_json(lock) + "\n").encode()).hexdigest(),
        "base_image_digest": lock["base_image"]["platforms"]["linux/arm64"],
        "gbrain": {
            **lock["gbrain"],
            "executable_version": lock["gbrain"]["package_version"],
            "executable_sha256": "5" * 64,
        },
        "bun": {
            "version": lock["bun"]["version"],
            "artifact_sha256": lock["bun"]["platforms"]["linux/arm64"]["sha256"],
        },
        "asset_sha256s": ip._expected_asset_hashes(),
        "fixtures": {
            "corpus_manifest_sha256": "1" * 64,
            "whole_source_inventory_sha256": "2" * 64,
            "property_manifest_sha256": ip._expected_asset_hashes()["fixtures/brain-properties/manifest.json"],
            "database_id": "f" * 64,
            "pgdata_id": "4" * 64,
            "gbrain_home_id": "5" * 64,
            "property_database_ids": [row["stack"]["database_id"] for row in property_rows],
            "property_run_ids": [row["property_run_id"] for row in property_rows],
            "bare_remote_id": "6" * 64,
            "worktree_commit": "a" * 40,
            "bare_refs_sha256": "7" * 64,
            "roundtrip_inventory_sha256": "8" * 64,
        },
        "postgresql": {
            "postgres_version": "16.15",
            "postgres_version_num": "160015",
            "pgvector_version": "0.6.0",
            "extension_inventory_sha256": "9" * 64,
            "migration_version": "149",
            "schema_inventory_sha256": "a" * 64,
            "schema_table_count": 69,
            "migration_inventory_sha256": "b" * 64,
            "config_sha256": "c" * 64,
        },
        "properties": {"dry_run": dry, "source_coverage": source},
    }


def _args(tmp_path, **changes):
    values = {"rebuild": False, "dry_run": False,
              "results_root": str(tmp_path), "gbrain_mirror": None}
    values.update(changes)
    return argparse.Namespace(**values)


def test_artifact_lock_accepts_exact_supported_pins():
    lock = _lock()
    assert lock["gbrain"] == {
        "origin": "https://github.com/garrytan/gbrain.git",
        "commit": "a6be012a3bcfac42e279630aedec5cda4a450e29",
        "tree": "68bed6c798259e641172b9c4b277fc524b06f3f2",
        "archive_sha256": "78ef4b78fbe2cb1de32862c45a244c0f0b8c20ec468a21c5ecffbba50d53ca1e",
        "package_version": "0.50.0.0",
    }
    assert set(lock["bun"]["platforms"]) == ip.SUPPORTED_PLATFORMS
    assert set(lock["base_image"]["platforms"]) == ip.SUPPORTED_PLATFORMS


@pytest.mark.parametrize("field", ["commit", "tree", "archive_sha256"])
def test_artifact_lock_rejects_bad_gbrain_pin(field):
    lock = json.loads((REPO / "config/test-artifacts.lock.json").read_text())
    lock["gbrain"][field] = "bad"
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.validate_lock(lock)


def test_build_context_bakes_only_public_body_fixture_and_locked_inputs(tmp_path, monkeypatch):
    lock = _lock()
    package = json.dumps({"version": lock["gbrain"]["package_version"]}).encode()
    archive_io = io.BytesIO()
    with tarfile.open(fileobj=archive_io, mode="w") as handle:
        info = tarfile.TarInfo("package.json")
        info.size = len(package)
        handle.addfile(info, io.BytesIO(package))
    monkeypatch.setattr(driver, "_gbrain_archive",
                        lambda *args, **kwargs: archive_io.getvalue())
    monkeypatch.setattr(driver, "_bun_archive",
                        lambda *args, **kwargs: b"bun")
    context = tmp_path / "context"
    digest = driver.prepare_build_context(
        context, tmp_path / "scratch", lock=lock, platform="linux/arm64",
        run_id=RUN_ID, repository=_repository(), mirror=None)
    assert len(digest) == 64
    assert (context / "assets/environment_body.py").read_bytes() == (
        REPO / "tests/integration/environment_body.py").read_bytes()
    copied = sorted(path.relative_to(context / "assets/fixtures/brain-source").as_posix()
                    for path in (context / "assets/fixtures/brain-source").rglob("*")
                    if path.is_file())
    expected = sorted(path.relative_to(REPO / "tests/fixtures/brain-source").as_posix()
                      for path in (REPO / "tests/fixtures/brain-source").rglob("*")
                      if path.is_file())
    assert copied == expected
    for body_name in ("gbrain_property_support.py", "gbrain_dry_run_body.py",
                      "gbrain_source_coverage_body.py"):
        assert (context / "assets" / body_name).read_bytes() == (
            REPO / "tests/integration" / body_name).read_bytes()
    property_copied = sorted(
        path.relative_to(context / "assets/fixtures/brain-properties").as_posix()
        for path in (context / "assets/fixtures/brain-properties").rglob("*")
        if path.is_file())
    property_expected = sorted(
        path.relative_to(REPO / "tests/fixtures/brain-properties").as_posix()
        for path in (REPO / "tests/fixtures/brain-properties").rglob("*")
        if path.is_file())
    assert property_copied == property_expected
    embedded_build = json.loads((context / "integration-build.json").read_text())
    assert embedded_build["assets"] == ip._expected_asset_hashes()
    assert not any(path.name.startswith(".env") for path in context.rglob("*"))


def test_integration_image_bakes_assets_and_runs_nonroot():
    text = (REPO / "docker/test-integration.Dockerfile").read_text()
    assert "COPY assets/ /opt/prime-claw-test/assets/" in text
    assert "USER tester" in text
    assert "chown -R tester:tester /home/tester" in text
    assert 'org.prime-claw.test.contract="integration-v3"' in text
    assert "--mount" not in text


def test_container_boundary_is_offline_unprivileged_and_mount_free():
    boundary = ip.validate_container(
        _container_row(), container_id=CONTAINER_ID, image_id=IMAGE_ID,
        run_id=RUN_ID, name="prime-claw-integration-" + RUN_ID.lower())
    assert boundary["network_mode"] == "none"
    assert boundary["host_mounts_absent"] is True
    assert boundary["ports_absent"] is True
    for mutation in ("mount", "port", "privileged", "user", "env"):
        row = _container_row()
        if mutation == "mount":
            row["Mounts"] = [{"Type": "bind", "Source": "/tmp", "Destination": "/workspace"}]
        elif mutation == "port":
            row["HostConfig"]["PortBindings"] = {"5432/tcp": [{"HostPort": "5432"}]}
        elif mutation == "privileged":
            row["HostConfig"]["Privileged"] = True
        elif mutation == "user":
            row["Config"]["User"] = "root"
        else:
            row["Config"]["Env"].append("AWS_SECRET_ACCESS_KEY=bad")
        with pytest.raises(ip.IntegrationEvidenceError):
            ip.validate_container(
                row, container_id=CONTAINER_ID, image_id=IMAGE_ID,
                run_id=RUN_ID, name="prime-claw-integration-" + RUN_ID.lower())


def test_container_boundary_requires_exact_body_entry_marker():
    row = _container_row()
    row["Config"]["Env"] = [
        "PRIME_CLAW_INTEGRATION_CONTAINER=0" if value.startswith(
            "PRIME_CLAW_INTEGRATION_CONTAINER=") else value
        for value in row["Config"]["Env"]
    ]
    with pytest.raises(ip.IntegrationEvidenceError, match="entry marker"):
        ip.validate_container(
            row, container_id=CONTAINER_ID, image_id=IMAGE_ID,
            run_id=RUN_ID, name="prime-claw-integration-" + RUN_ID.lower())


def test_body_receipt_validates_real_stack_versions_and_repository_identity():
    lock = _lock()
    body = ip.validate_body(
        _body(lock), lock, run_id=RUN_ID, platform="linux/arm64",
        repository=_repository())
    assert body["postgresql"]["postgres_version_num"].startswith("16")
    assert body["gbrain"]["executable_version"] == "0.50.0.0"
    changed = _body(lock)
    changed["repository"] = {**_repository(), "head": "0" * 40}
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.validate_body(changed, lock, run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())


def test_body_is_not_collected_or_runnable_as_a_host_test():
    body = REPO / "tests/integration/environment_body.py"
    assert not body.name.startswith("test_")
    assert "import pytest" not in body.read_text()
    result = subprocess.run(
        [sys.executable, str(body), "--attestation", "a" * 64,
         "--run-id", RUN_ID], cwd=REPO, text=True,
        capture_output=True, timeout=10)
    assert result.returncode != 0
    assert "container entry marker is missing" in result.stderr
    assert "integration body PASS" not in result.stdout


def test_launcher_supplies_the_container_only_entry_marker():
    source = (REPO / "scripts/testing/integration_driver.py").read_text()
    assert "PRIME_CLAW_INTEGRATION_CONTAINER=1" in source


def _install_recording_run(monkeypatch, tmp_path, *, failure=None):
    lock = _lock()
    repository = _repository()
    commands = []
    name = "prime-claw-integration-" + RUN_ID.lower()

    monkeypatch.setattr(driver, "_run_id", lambda: RUN_ID)
    monkeypatch.setattr(driver, "repository_identity", lambda: repository)
    monkeypatch.setattr(driver, "_platform", lambda: "linux/arm64")
    monkeypatch.setattr(driver.ip, "load_lock", lambda path: lock)
    def prepare(context, scratch, **kwargs):
        context.mkdir()
        return "3" * 64
    monkeypatch.setattr(driver, "prepare_build_context", prepare)

    def fake_run(argv, *, timeout, text=True):
        commands.append(list(argv))
        if argv[:2] == ["docker", "build"]:
            Path(argv[argv.index("--iidfile") + 1]).write_text(IMAGE_ID + "\n")
            if failure == "build":
                return _result(argv, rc=1)
        elif argv[:3] == ["docker", "image", "inspect"]:
            return _result(argv, stdout=json.dumps([_image_row()]))
        elif argv[:2] == ["docker", "create"]:
            Path(argv[argv.index("--cidfile") + 1]).write_text(CONTAINER_ID + "\n")
            if failure == "create":
                return _result(argv, rc=1)
        elif argv[:2] == ["docker", "inspect"]:
            return _result(argv, stdout=json.dumps([_container_row(name=name)]))
        elif argv[:2] == ["docker", "exec"] and failure in ("exec", "timeout", "interrupt"):
            if failure == "timeout":
                return _result(argv, rc=124, outcome="timed_out")
            if failure == "interrupt":
                return _result(argv, rc=130, outcome="interrupted")
            return _result(argv, rc=1)
        elif argv[:2] == ["docker", "cp"]:
            if failure == "copy":
                return _result(argv, rc=1)
            destination = Path(argv[-1])
            if failure == "malformed":
                destination.write_text("not json\n")
            else:
                destination.write_text(json.dumps(_body(lock, repository)) + "\n")
        return _result(argv)

    monkeypatch.setattr(driver, "_run", fake_run)
    return commands


def test_recording_driver_success_stops_copies_then_cleans_exact_ids(tmp_path, monkeypatch):
    commands = _install_recording_run(monkeypatch, tmp_path)
    assert driver.run(_args(tmp_path)) == 0
    manifest_path = next(tmp_path.glob("*/integration/manifest.json"))
    manifest = ip.load_manifest(manifest_path)
    assert manifest["status"] == "passed"
    create = next(row for row in commands if row[:2] == ["docker", "create"])
    assert "--network" in create and create[create.index("--network") + 1] == "none"
    assert "--mount" not in create and "-v" not in create and "-p" not in create
    stop_index = next(i for i, row in enumerate(commands) if row[:2] == ["docker", "stop"])
    cp_index = next(i for i, row in enumerate(commands) if row[:2] == ["docker", "cp"])
    rm_index = next(i for i, row in enumerate(commands) if row[:3] == ["docker", "rm", "-f"])
    assert stop_index < cp_index < rm_index
    assert manifest["cleanup"] == {
        "container_removed": True, "image_removed": True,
        "context_removed": True,
    }


@pytest.mark.parametrize("failure", ["exec", "timeout", "interrupt", "copy", "malformed"])
def test_ordinary_body_copy_timeout_and_interrupt_failures_are_red_and_cleanup(
        tmp_path, monkeypatch, failure):
    commands = _install_recording_run(
        monkeypatch, tmp_path, failure=failure)
    assert driver.run(_args(tmp_path)) != 0
    manifest = json.loads(next(tmp_path.glob("*/integration/manifest.json")).read_text())
    assert manifest["status"] == "failed"
    assert "integration PASS" not in " ".join(manifest["run"]["failure_codes"])
    assert any(row[:3] == ["docker", "rm", "-f"] for row in commands)
    assert any(row[:3] == ["docker", "image", "rm"] for row in commands)


def test_cleanup_refuses_wrong_labels_and_never_deletes(tmp_path, monkeypatch):
    commands = []
    def fake_run(argv, *, timeout, text=True):
        commands.append(list(argv))
        if argv[:2] == ["docker", "inspect"]:
            row = _container_row()
            row["Config"]["Labels"]["org.prime-claw.test.run"] = "other"
            return _result(argv, stdout=json.dumps([row]))
        return _result(argv)
    monkeypatch.setattr(driver, "_run", fake_run)
    assert driver._remove_owned("container", CONTAINER_ID, RUN_ID) is False
    assert not any(row[:3] == ["docker", "rm", "-f"] for row in commands)


def test_cleanup_attempts_image_after_container_removal_failure(monkeypatch):
    commands = []
    def fake_run(argv, *, timeout, text=True):
        commands.append(list(argv))
        if argv[:2] == ["docker", "inspect"]:
            return _result(argv, stdout=json.dumps([_container_row()]))
        if argv[:3] == ["docker", "image", "inspect"]:
            return _result(argv, stdout=json.dumps([_image_row()]))
        if argv[:3] == ["docker", "rm", "-f"]:
            return _result(argv, rc=1)
        return _result(argv)
    monkeypatch.setattr(driver, "_run", fake_run)
    assert driver._remove_owned("container", CONTAINER_ID, RUN_ID) is False
    assert driver._remove_owned("image", IMAGE_ID, RUN_ID) is True
    assert any(row[:3] == ["docker", "image", "rm"] for row in commands)


@pytest.mark.parametrize("failure", ["build", "create"])
def test_partial_build_and_create_are_red_and_use_label_checked_recovery(
        tmp_path, monkeypatch, failure):
    commands = _install_recording_run(monkeypatch, tmp_path, failure=failure)
    assert driver.run(_args(tmp_path)) != 0
    manifest = json.loads(next(tmp_path.glob("*/integration/manifest.json")).read_text())
    assert manifest["status"] == "failed"
    assert any(row[:3] == ["docker", "image", "inspect"] for row in commands)


def test_dry_run_describes_mount_free_container_without_docker(tmp_path, monkeypatch, capsys):
    lock = _lock()
    monkeypatch.setattr(driver, "_run_id", lambda: RUN_ID)
    monkeypatch.setattr(driver, "repository_identity", _repository)
    monkeypatch.setattr(driver.ip, "load_lock", lambda path: lock)
    def forbidden(*args, **kwargs):
        raise AssertionError("dry run must not invoke Docker")
    monkeypatch.setattr(driver, "_run", forbidden)
    assert driver.run(_args(tmp_path, dry_run=True)) == 0
    value = json.loads(capsys.readouterr().out)
    assert value["runtime"] == {
        "network": "none", "mounts": [], "non_root": True,
        "result_transport": "docker cp",
    }


def test_manifest_cli_validates_simple_receipt(tmp_path, capsys):
    value = {
        "schema_version": 1, "contract": ip.CONTRACT, "status": "passed",
        "run": {"id": RUN_ID, "started_at": "2026-10-06T04:00:00Z",
                "finished_at": "2026-10-06T04:01:00Z", "failure_codes": []},
        "repository": _repository(), "platform": "linux/arm64",
        "artifact_lock_sha256": hashlib.sha256(
            (ip.canonical_json(_lock()) + "\n").encode()).hexdigest(),
        "image": {"id": IMAGE_ID}, "container": {"id": CONTAINER_ID},
        "body": _body(),
        "cleanup": {"container_removed": True, "image_removed": True,
                    "context_removed": True},
    }
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(value))
    assert ip._main([str(path)]) == 0
    assert '"status": "passed"' in capsys.readouterr().out


def test_launcher_bypasses_removed_supervisor_and_comparator_is_absent():
    launcher = (REPO / "scripts/test-integration.sh").read_text()
    assert "integration_supervisor" not in launcher
    assert "integration_driver" in launcher
    assert not (REPO / "scripts/testing/integration_supervisor.py").exists()
    assert "compare-runs" not in (REPO / "scripts/testing/integration_provenance.py").read_text()
    assert "manifest.binding" not in (REPO / "scripts/testing/integration_provenance.py").read_text()


@pytest.mark.parametrize("dimension", [
    "schema", "migration", "rows", "failure_ledger", "bookmark", "locks",
    "sessions", "config", "worktree", "refs", "sequences",
])
def test_dry_run_snapshot_rejects_each_named_drift(dimension):
    body = _body()
    before = body["properties"]["dry_run"][0]["snapshot_before"]
    if dimension == "schema": before["schema_sha256"] = "0" * 64
    elif dimension == "migration": before["migration_version"] = "148"
    elif dimension == "rows": before["rows_sha256"] = "0" * 64
    elif dimension == "failure_ledger": before["failure_ledger_sha256"] = "0" * 64
    elif dimension == "bookmark": before["source_bookmark"]["last_commit"] = "0" * 40
    elif dimension == "locks": before["persistent_locks"]["advisory_lock_count"] = 1
    elif dimension == "sessions": before["post_exit_fixture_sessions"] = 1
    elif dimension == "config": before["config_raw_sha256"] = "0" * 64
    elif dimension == "worktree": before["worktree"]["head"] = "0" * 40
    elif dimension == "refs": before["bare_refs_sha256"] = "0" * 64
    else: before["sequence_sha256"] = "0" * 64
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())


@pytest.mark.parametrize("field,value", [
    ("command", ["gbrain", "sync"]), ("exit_code", 1), ("outcome", "timeout"),
])
def test_dry_run_result_requires_exact_command_and_zero_exit(field, value):
    body = _body()
    body["properties"]["dry_run"][0][field] = value
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())


@pytest.mark.parametrize("mutation", ["missing", "duplicate_path", "duplicate_slug", "unexpected_row"])
def test_source_accounting_rejects_incomplete_duplicate_or_unexpected_state(mutation):
    body = _body()
    prop = body["properties"]["source_coverage"][0]
    if mutation == "missing":
        prop["accounting"]["records"].pop()
    elif mutation == "duplicate_path":
        prop["accounting"]["records"][1]["path"] = prop["accounting"]["records"][2]["path"]
    elif mutation == "duplicate_slug":
        prop["accounting"]["records"][1]["slug"] = prop["accounting"]["records"][2]["slug"]
    else:
        prop["accounting"]["database_rows"].append(
            {"path": "unexpected.md", "slug": "unexpected", "deleted": False, "title": "Unexpected"})
        prop["accounting"]["row_count"] += 1
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())


def test_malformed_frontmatter_requires_unchanged_bookmark_rows_and_named_reason():
    for field, value in (("bookmark_after", "0" * 40),
                         ("rows_after_sha256", "0" * 64),
                         ("reason", "silent")):
        body = _body()
        body["properties"]["source_coverage"][0]["malformed_frontmatter"][field] = value
        with pytest.raises(ip.IntegrationEvidenceError):
            ip.validate_body(body, _lock(), run_id=RUN_ID,
                             platform="linux/arm64", repository=_repository())


def test_repeatability_requires_disjoint_database_identities_and_equal_results():
    body = _body()
    body["properties"]["dry_run"][1]["stack"]["database_id"] = (
        body["properties"]["dry_run"][0]["stack"]["database_id"])
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())
    body = _body()
    body["properties"]["source_coverage"][1]["normalized_result_sha256"] = "0" * 64
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())


def test_property_receipt_requires_exact_asset_inventory():
    body = _body()
    body["asset_sha256s"].pop("gbrain_dry_run_body.py")
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())


@pytest.mark.parametrize("name", ["gbrain_dry_run_body.py", "gbrain_source_coverage_body.py"])
def test_property_bodies_are_noncollectable_and_refuse_direct_host_entry(name):
    body = REPO / "tests/integration" / name
    assert not body.name.startswith("test_")
    result = subprocess.run(
        [sys.executable, str(body), "--attestation", "a" * 64,
         "--run-id", RUN_ID, "--property-id",
         "dry-run-a" if "dry_run" in name else "source-coverage-a"],
        cwd=REPO, text=True, capture_output=True, timeout=10)
    assert result.returncode != 0
    assert "container entry marker is missing" in result.stderr


def _passed_manifest():
    lock = _lock()
    return {
        "schema_version": 1, "contract": ip.CONTRACT, "status": "passed",
        "run": {"id": RUN_ID, "started_at": "2026-10-06T04:00:00Z",
                "finished_at": "2026-10-06T04:01:00Z", "failure_codes": []},
        "repository": _repository(), "platform": "linux/arm64",
        "artifact_lock_sha256": hashlib.sha256(
            (ip.canonical_json(lock) + "\n").encode()).hexdigest(),
        "image": {"id": IMAGE_ID}, "container": {"id": CONTAINER_ID},
        "body": _body(lock=lock),
        "cleanup": {"container_removed": True, "image_removed": True,
                    "context_removed": True},
    }

@pytest.mark.parametrize("mutate", [
    lambda m: m["body"]["properties"]["dry_run"][0].update(command=["false"]),
    lambda m: m["body"]["asset_sha256s"].pop("gbrain_property_support.py"),
    lambda m: m["body"]["properties"]["dry_run"][1]["stack"].update(
        database_id=m["body"]["properties"]["dry_run"][0]["stack"]["database_id"]),
    lambda m: m["body"]["properties"]["dry_run"][0]["snapshot_after"].update(
        migration_version="148"),
    lambda m: m["body"]["properties"]["source_coverage"][0]["accounting"].update(
        path_count=999),
])
def test_load_manifest_rejects_tampered_passed_body(tmp_path, mutate):
    manifest = _passed_manifest()
    mutate(manifest)
    path = tmp_path / "manifest.json"
    path.write_text(json.dumps(manifest))
    with pytest.raises(ip.IntegrationEvidenceError):
        ip.load_manifest(path)

@pytest.mark.parametrize("group", ["dry_run", "source_coverage"])
def test_property_validator_recomputes_normalized_digest(group):
    body = _body()
    body["properties"][group][0]["normalized_result_sha256"] = "f" * 64
    with pytest.raises(ip.IntegrationEvidenceError, match="normalized result"):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())

def test_source_accounting_is_bound_to_canonical_fixture_manifest():
    body = _body()
    row = body["properties"]["source_coverage"][0]
    row["accounting"]["records"][0].update(path="evil.md", slug="evil")
    row["accounting"]["database_rows"][0].update(path="evil.md", slug="evil")
    row["normalized_result_sha256"] = normalized_digest(source_payload(
        command=row["command"], accounting=row["accounting"],
        malformed=row["malformed_frontmatter"]))
    with pytest.raises(ip.IntegrationEvidenceError, match="fixture manifest"):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())

def test_source_accounting_rejects_stale_canonical_manifest(monkeypatch):
    body = _body()
    stale = ip._load_property_manifest()
    stale["accounting"] = stale["accounting"][:-1]
    monkeypatch.setattr(ip, "_load_property_manifest", lambda: stale)
    with pytest.raises(ip.IntegrationEvidenceError, match="fixture manifest"):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())

def test_ab_logical_difference_cannot_hide_behind_claimed_hashes():
    body = _body()
    body["properties"]["dry_run"][1]["snapshot_before"]["table_row_counts"]["pages"] = 1
    body["properties"]["dry_run"][1]["snapshot_after"]["table_row_counts"]["pages"] = 1
    with pytest.raises(ip.IntegrationEvidenceError, match="normalized result"):
        ip.validate_body(body, _lock(), run_id=RUN_ID,
                         platform="linux/arm64", repository=_repository())
