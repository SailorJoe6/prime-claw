from __future__ import annotations

import argparse
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


def _body(lock=None, repository=None, run_id=RUN_ID):
    lock = lock or _lock()
    repository = repository or _repository()
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
        "fixtures": {
            "corpus_manifest_sha256": "1" * 64,
            "whole_source_inventory_sha256": "2" * 64,
            "database_id": "3" * 64,
            "pgdata_id": "4" * 64,
            "gbrain_home_id": "5" * 64,
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
    assert not any(path.name.startswith(".env") for path in context.rglob("*"))


def test_integration_image_bakes_assets_and_runs_nonroot():
    text = (REPO / "docker/test-integration.Dockerfile").read_text()
    assert "COPY assets/ /opt/prime-claw-test/assets/" in text
    assert "USER tester" in text
    assert "chown -R tester:tester /home/tester" in text
    assert 'org.prime-claw.test.contract="integration-v2"' in text
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
    result = subprocess.run(
        [sys.executable, str(body), "--attestation", "a" * 64,
         "--run-id", RUN_ID], cwd=REPO, text=True,
        capture_output=True, timeout=10)
    assert result.returncode != 0
    assert "integration body PASS" not in result.stdout


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
        "artifact_lock_sha256": "1" * 64,
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
