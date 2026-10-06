from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import signal
import shutil
import stat
import subprocess
import sys
from types import SimpleNamespace

import pytest

from scripts.testing import integration_provenance as ip
from scripts.testing import provenance

REPO = Path(__file__).resolve().parents[1]
RUN1 = "20261004T190000Z-1234-aaaaaaaa"
RUN2 = "20261004T190001Z-1235-bbbbbbbb"
SHA = "a" * 64
IMAGE1 = "sha256:" + "1" * 64
IMAGE2 = "sha256:" + "2" * 64
CID1 = "3" * 64
CID2 = "4" * 64


def _result(*, rc: int, stdout: str = "", stderr: str = "", outcome: str = "exited"):
    return SimpleNamespace(returncode=rc, stdout=stdout, stderr=stderr, outcome=outcome)


def _teardown():
    return {"state": "absent", "verified_at": "2026-10-04T19:01:00Z",
            "remove_outcome": "not_needed", "inspect_outcome": "not_needed",
            "clean": True}


def _passed(run_id: str, image_id: str, container_id: str, salt: str):
    fixture = {
        "corpus_manifest_sha256": "b" * 64,
        "whole_source_inventory_sha256": "c" * 64,
        "database_id": __import__("hashlib").sha256((salt + "database").encode()).hexdigest(),
        "pgdata_id": __import__("hashlib").sha256((salt + "pgdata").encode()).hexdigest(),
        "gbrain_home_id": __import__("hashlib").sha256((salt + "home").encode()).hexdigest(),
        "bare_remote_id": __import__("hashlib").sha256((salt + "remote").encode()).hexdigest(),
        "worktree_commit": salt * 40,
        "bare_refs_sha256": __import__("hashlib").sha256((salt + "refs").encode()).hexdigest(),
        "roundtrip_inventory_sha256": "c" * 64,
    }
    tag = "prime-claw-test-integration:" + "3" * 12
    image = {
        "id": image_id, "repo_tags": [tag], "repo_digests": [],
        "base_image_digest": "sha256:" + "4" * 64,
        "dockerfile": "docker/test-integration.Dockerfile",
        "dockerfile_sha256": "1" * 64, "declared_input_sha256": "2" * 64,
        "declared_input_hash_contract": "framed-sha256-v2",
        "informational_tag": tag,
        "platform": "linux/arm64", "build_started_at": "2026-10-04T19:00:00Z",
        "build_finished_at": "2026-10-04T19:00:10Z", "ownership_verified": True,
    }
    container = {
        "id": container_id, "image_id": image_id, "name_sha256": "4" * 64,
        "network_mode": "none", "ports_absent": True, "privileged": False,
        "environment_allowlisted": True, "provider_environment_absent": True,
        "mounts": [
            {"destination": "/results", "read_write": True, "type": "bind"},
            {"destination": "/workspace", "read_write": False, "type": "bind"},
        ], "ownership_verified": True,
    }
    postgres = {
        "postgres_version": "16.15", "postgres_version_num": "160015",
        "pgvector_version": "0.6.0", "extension_inventory_sha256": "5" * 64,
        "migration_version": "149", "schema_inventory_sha256": "6" * 64,
        "schema_table_count": 69, "migration_inventory_sha256": "7" * 64,
        "config_sha256": "8" * 64,
    }
    return {
        "schema_version": provenance.SCHEMA_VERSION,
        "command_contract_version": ip.CONTRACT,
        "status": "passed",
        "run": {"id": run_id, "tier": "integration", "mode": "gbrain-postgres",
                "started_at": "2026-10-04T19:00:00Z", "finished_at": "2026-10-04T19:01:00Z",
                "status": "passed", "failure_codes": []},
        "repository": {"head": "9" * 40, "dirty": False,
                       "status_sha256": "8" * 64, "content_sha256": "7" * 64,
                       "entry_count": 1, "content_hash_contract": "framed-sha256-v2"},
        "platform": "linux/arm64", "artifact_lock_sha256": "6" * 64,
        "gbrain": {"origin": "https://github.com/garrytan/gbrain.git",
                   "commit": "8" * 40, "tree": "7" * 40,
                   "archive_sha256": "6" * 64, "package_version": "0.50.0.0",
                   "executable_sha256": "5" * 64, "executable_version": "0.50.0.0"},
        "image": image, "container": container,
        "network": {"mode": "none", "verified_absent": True,
                    "verified_at": "2026-10-04T19:00:30Z", "external_tcp_refused": True},
        "fixtures": fixture, "postgresql": postgres,
        "teardown": {"preparation": _teardown(),
                     "container": _teardown(), "image": _teardown(),
                     "context": _teardown(), "snapshot": _teardown(),
                     "share": _teardown(), "clean": True},
        "evidence": {"files": []},
    }


def test_artifact_lock_is_complete_and_exact():
    lock = ip.load_lock(REPO / "config/test-artifacts.lock.json")
    assert lock["gbrain"]["commit"] == "a6be012a3bcfac42e279630aedec5cda4a450e29"
    assert lock["gbrain"]["archive_sha256"] == "78ef4b78fbe2cb1de32862c45a244c0f0b8c20ec468a21c5ecffbba50d53ca1e"
    assert set(lock["bun"]["platforms"]) == ip.SUPPORTED_PLATFORMS
    assert set(lock["base_image"]["platforms"]) == ip.SUPPORTED_PLATFORMS


def test_artifact_lock_rejects_wrong_or_missing_platform_hash():
    lock = json.loads((REPO / "config/test-artifacts.lock.json").read_text())
    del lock["bun"]["platforms"]["linux/amd64"]["sha256"]
    with pytest.raises(provenance.ProvenanceError):
        ip.validate_lock(lock)


def test_exact_absence_allows_only_exact_identity_diagnostic():
    missing = _result(rc=1, stdout="[]\n", stderr=f"error: no such object: {CID1}\n")
    assert ip.exact_absence(missing, CID1, kind="container") == "absent"
    daemon = _result(rc=1, stdout="[]\n", stderr="error during connect: daemon unavailable\n")
    assert ip.exact_absence(daemon, CID1, kind="container") == "unknown"
    wrong = _result(rc=1, stdout="[]\n", stderr=f"error: no such object: {CID2}\n")
    assert ip.exact_absence(wrong, CID1, kind="container") == "unknown"


def test_ordinary_nonzero_remove_stays_nonclean_after_proved_absence():
    remove = _result(rc=1, stderr="remove failed\n")
    inspect = _result(rc=1, stdout="[]\n", stderr=f"error: no such object: {CID1}\n")
    row = ip.teardown_record(remove, inspect, CID1, kind="container",
                             verified_at="2026-10-04T19:00:00Z")
    assert row == {"state": "absent", "verified_at": "2026-10-04T19:00:00Z",
                   "remove_outcome": "ordinary_nonzero",
                   "inspect_outcome": "ordinary_nonzero", "clean": False}


def test_container_boundary_rejects_mount_port_env_and_identity_drift(tmp_path):
    snapshot = tmp_path / "snapshot"; snapshot.mkdir()
    share = tmp_path / "share"; share.mkdir()
    name = "prime-claw-integration-" + RUN1.lower()
    raw = {
        "Id": CID1, "Image": IMAGE1, "Name": "/" + name,
        "Config": {"User": "tester", "Labels": {
            "org.prime-claw.test.contract": ip.CONTRACT,
            "org.prime-claw.test.run": RUN1},
            "Env": ["PATH=/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin",
                    "HOME=/home/tester", "LANG=C.UTF-8"], "ExposedPorts": None},
        "HostConfig": {"NetworkMode": "none", "Privileged": False,
                       "PortBindings": None, "PidMode": "", "IpcMode": "private"},
        "State": {"Running": True},
        "Mounts": [
            {"Destination": "/workspace", "Source": str(snapshot), "RW": False, "Type": "bind"},
            {"Destination": "/results", "Source": str(share), "RW": True, "Type": "bind"},
        ],
    }
    snapshot_authority = provenance.open_directory_authority(
        snapshot, provenance.owned_directory_binding(snapshot))
    share_authority = provenance.open_directory_authority(
        share, provenance.owned_directory_binding(share))
    safe = ip.safe_container_boundary(
        raw, expected_id=CID1, image_id=IMAGE1, run_id=RUN1, name=name,
        repository_authority=snapshot_authority,
        result_authority=share_authority)
    assert safe["network_mode"] == "none"
    provenance._assert_sanitized(safe)
    for mutate in ("env", "duplicate_env", "port", "mount", "extra_mount",
                   "missing_mount", "duplicate_mount", "label", "image", "network",
                   "stopped", "privileged", "id", "name", "row_namespace"):
        changed = copy.deepcopy(raw)
        if mutate == "env": changed["Config"]["Env"].append("OPENAI_API_KEY=not-a-key")
        elif mutate == "duplicate_env": changed["Config"]["Env"].append("HOME=/other")
        elif mutate == "port": changed["HostConfig"]["PortBindings"] = {"5432/tcp": [{}]}
        elif mutate == "mount": changed["Mounts"][0]["RW"] = True
        elif mutate == "extra_mount": changed["Mounts"].append({"Destination": "/extra", "Source": str(tmp_path), "RW": False, "Type": "bind"})
        elif mutate == "missing_mount": changed["Mounts"].pop()
        elif mutate == "duplicate_mount": changed["Mounts"][1] = copy.deepcopy(changed["Mounts"][0])
        elif mutate == "label": changed["Config"]["Labels"]["org.prime-claw.test.run"] = RUN2
        elif mutate == "image": changed["Image"] = IMAGE2
        elif mutate == "network": changed["HostConfig"]["NetworkMode"] = "bridge"
        elif mutate == "stopped": changed["State"]["Running"] = False
        elif mutate == "privileged": changed["HostConfig"]["Privileged"] = True
        elif mutate == "id": changed["Id"] = CID2
        elif mutate == "name": changed["Name"] = "/other"
        else: changed["HostConfig"]["PidMode"] = "host"
        with pytest.raises(provenance.ProvenanceError):
            ip.safe_container_boundary(
                changed, expected_id=CID1, image_id=IMAGE1,
                run_id=RUN1, name=name,
                repository_authority=snapshot_authority,
                result_authority=share_authority)
    snapshot_authority.close()
    share_authority.close()


def test_two_run_comparator_requires_disjoint_owned_state_and_stable_inputs():
    first = _passed(RUN1, IMAGE1, CID1, "a")
    second = _passed(RUN2, IMAGE2, CID2, "b")
    ip.compare_passed(first, second)
    for key in ("database_id", "pgdata_id", "gbrain_home_id", "bare_remote_id",
                "worktree_commit", "bare_refs_sha256"):
        reused = copy.deepcopy(second)
        reused["fixtures"][key] = first["fixtures"][key]
        with pytest.raises(provenance.ProvenanceError):
            ip.compare_passed(first, reused)
    mutations = [
        ("fixtures", "corpus_manifest_sha256", "0" * 64),
        (None, "repository", {**second["repository"], "dirty": True}),
        (None, "platform", "linux/amd64"),
        (None, "artifact_lock_sha256", "0" * 64),
        ("image", "dockerfile_sha256", "0" * 64),
        ("gbrain", "executable_sha256", "0" * 64),
        ("postgresql", "schema_inventory_sha256", "0" * 64),
    ]
    for section, key, value in mutations:
        drift = copy.deepcopy(second)
        if section is None: drift[key] = value
        else: drift[section][key] = value
        with pytest.raises(provenance.ProvenanceError):
            ip.compare_passed(first, drift)


def test_integration_body_is_explicit_and_not_default_pytest_module():
    body = REPO / "tests/integration/environment_body.py"
    assert body.name != "test_environment_body.py"
    text = body.read_text()
    assert "pytest.mark.integration" in text
    assert "integration attestation mismatch" in text
    assert "repository mount is not read-only" in text


def test_integration_dockerfile_is_plain_locked_nonroot_runtime():
    text = (REPO / "docker/test-integration.Dockerfile").read_text()
    assert "FROM ${BASE_IMAGE}" in text
    lock = ip.load_lock(REPO / "config/test-artifacts.lock.json")
    assert lock["base_image"]["index_digest"] in text
    assert "postgreSQL" not in text
    assert "postgresql-16-pgvector" in text
    assert "USER tester" in text
    assert "COPY --from=builder /tmp/gbrain /usr/local/bin/gbrain" in text
    assert "OpenShell" not in text


def test_integration_driver_dry_run_contacts_no_docker(monkeypatch, capsys):
    from scripts.testing import integration_driver
    monkeypatch.setattr(integration_driver, "_platform", lambda: (_ for _ in ()).throw(AssertionError("Docker contacted")))
    args = SimpleNamespace(dry_run=True, results_root=None, gbrain_mirror=None, rebuild=False)
    assert integration_driver.run(args) == 0
    assert "--network none" in capsys.readouterr().out


def test_driver_recovery_uses_exact_recording_fake_identity(monkeypatch):
    from scripts.testing import integration_driver
    labels = {"org.prime-claw.test.contract": ip.CONTRACT,
              "org.prime-claw.test.run": RUN1}
    container_row = {"Id": CID1, "Image": IMAGE1,
                     "Name": "/prime-claw-integration-" + RUN1.lower(),
                     "Config": {"Labels": labels}}
    calls = []
    def fake_run(argv, **kwargs):
        calls.append(argv)
        return _result(rc=0, stdout=json.dumps([container_row]) + "\n")
    monkeypatch.setattr(integration_driver, "_run", fake_run)
    assert integration_driver._ownership_state(
        "container", CID1, RUN1, expected_image=IMAGE1) == "owned"
    assert calls == [["docker", "inspect", CID1]]
    container_row["Config"]["Labels"]["org.prime-claw.test.run"] = RUN2
    assert integration_driver._ownership_state(
        "container", CID1, RUN1, expected_image=IMAGE1) == "unknown"


def test_driver_recovery_classifies_exact_absence_without_removal(monkeypatch):
    from scripts.testing import integration_driver
    monkeypatch.setattr(integration_driver, "_run", lambda argv, **kwargs:
        _result(rc=1, stdout="[]\n", stderr=f"error: no such object: {CID1}\n"))
    assert integration_driver._ownership_state("container", CID1, RUN1) == "absent"


def test_manifest_validator_rejects_boundary_and_lineage_tampering():
    manifest = _passed(RUN1, IMAGE1, CID1, "a")
    mutations = []
    changed = copy.deepcopy(manifest); changed["container"]["mounts"][0]["read_write"] = False; mutations.append(changed)
    changed = copy.deepcopy(manifest); changed["image"]["id"] = IMAGE2; mutations.append(changed)
    changed = copy.deepcopy(manifest); changed["gbrain"]["origin"] = "https://example.invalid/gbrain"; mutations.append(changed)
    changed = copy.deepcopy(manifest); changed["postgresql"]["migration_version"] = "148"; mutations.append(changed)
    changed = copy.deepcopy(manifest); changed["teardown"]["image"]["clean"] = False; mutations.append(changed)
    for value in mutations:
        with pytest.raises(provenance.ProvenanceError):
            ip.validate_manifest(value)


def test_integration_manifest_cross_binds_lock_repository_image_boundary_and_body(tmp_path):
    lock = ip.load_lock(REPO / "config/test-artifacts.lock.json")
    manifest = _passed(RUN1, IMAGE1, CID1, "a")
    manifest["gbrain"].update(lock["gbrain"])
    manifest["artifact_lock_sha256"] = __import__("hashlib").sha256(
        provenance.canonical_json(lock).encode()).hexdigest()
    manifest["image"]["base_image_digest"] = lock["base_image"]["platforms"][manifest["platform"]]
    root = tmp_path / "evidence"; root.mkdir(mode=0o700)
    binding = provenance.owned_directory_binding(root)
    attestation = __import__("hashlib").sha256(
        f"{manifest['run']['id']}:{manifest['container']['id']}:{manifest['image']['id']}".encode()).hexdigest()
    body = {
        "schema_version": 1, "contract": ip.BODY_CONTRACT,
        "run_id": manifest["run"]["id"],
        "started_at": "2026-10-04T19:00:20Z",
        "finished_at": "2026-10-04T19:00:40Z",
        "attestation_sha256": __import__("hashlib").sha256(attestation.encode()).hexdigest(),
        "platform": manifest["platform"], "non_root": True, "uid": 10001,
        "repository_read_only": True, "external_tcp_refused": True,
        "environment_names_sha256": "4" * 64,
        "artifact_lock_sha256": manifest["artifact_lock_sha256"],
        "base_image_digest": manifest["image"]["base_image_digest"],
        "gbrain": manifest["gbrain"],
        "bun": {"version": lock["bun"]["version"],
                "artifact_sha256": lock["bun"]["platforms"][manifest["platform"]]["sha256"]},
        "fixtures": manifest["fixtures"], "postgresql": manifest["postgresql"],
    }
    for mutate in ("run_id", "attestation_sha256", "base_image_digest", "bun",
                   "external_tcp_refused", "repository_read_only", "non_root"):
        changed = copy.deepcopy(body)
        if mutate == "run_id": changed[mutate] = RUN2
        elif mutate == "attestation_sha256": changed[mutate] = "0" * 64
        elif mutate == "base_image_digest": changed[mutate] = IMAGE2
        elif mutate == "bun": changed[mutate]["artifact_sha256"] = "0" * 64
        else: changed[mutate] = False
        with pytest.raises(provenance.ProvenanceError):
            ip.validate_body(changed, lock, run_id=manifest["run"]["id"],
                             platform=manifest["platform"], attestation=attestation)
    with provenance.open_owned_directory(root, binding) as owned:
        provenance.write_sanitized_json(owned, "artifact-lock.json", lock)
        provenance.write_sanitized_json(owned, "repository.json", manifest["repository"])
        provenance.write_sanitized_json(owned, "preparation.json", manifest["teardown"]["preparation"])
        provenance.write_sanitized_json(owned, "image.json", manifest["image"])
        provenance.write_sanitized_json(owned, "boundary.json", manifest["container"])
        provenance.write_sanitized_json(owned, "body.json", body)
        manifest["evidence"]["files"] = ip.evidence_inventory(owned)
        ip.publish_manifest(owned, manifest)
        ip.verify_evidence(owned, manifest)


def test_failed_preparation_removes_its_owned_temporary_repository(tmp_path, monkeypatch):
    from scripts.testing import integration_driver
    tier = tmp_path / "tier"; tier.mkdir(mode=0o700)
    context = tier / "build-context"; context.mkdir(mode=0o700)
    prep = tier / "preparation"; prep.mkdir(mode=0o700)
    snapshot = tier / "snapshot"; snapshot.mkdir(mode=0o700)
    tier_authority = provenance.open_directory_authority(
        tier, provenance.owned_directory_binding(tier))
    context_authority = provenance.open_directory_authority(
        context, provenance.owned_directory_binding(context))
    prep_authority = provenance.open_directory_authority(
        prep, provenance.owned_directory_binding(prep))
    snapshot_authority = provenance.open_directory_authority(
        snapshot, provenance.owned_directory_binding(snapshot))
    state = integration_driver._not_needed()
    monkeypatch.setattr(integration_driver, "_run", lambda argv, **kwargs: _result(rc=0))
    lock = ip.load_lock(REPO / "config/test-artifacts.lock.json")
    with pytest.raises(integration_driver.DriverError):
        integration_driver._prepare_context(
            context_authority, tier_authority, prep_authority,
            snapshot_authority, (), RUN1, "linux/arm64", lock,
            (REPO / integration_driver.LOCK_PATH).read_bytes(),
            (REPO / integration_driver.DOCKERFILE).read_bytes(),
            str(tmp_path / "missing-mirror"), state)
    context_authority.close(); prep_authority.close()
    snapshot_authority.close(); tier_authority.close()
    assert state["clean"] is True
    assert state["state"] == "absent"
    assert not (tier / "preparation").exists()


def test_post_publication_verification_cannot_leave_green_manifest(tmp_path, monkeypatch):
    manifest = _passed(RUN1, IMAGE1, CID1, "a")
    root = tmp_path / "evidence"; root.mkdir(mode=0o700)
    binding = provenance.owned_directory_binding(root)
    calls = 0
    def racing_verify(owned, value):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise provenance.ProvenanceError("simulated post-write evidence race")
    monkeypatch.setattr(ip, "verify_evidence", racing_verify)
    with provenance.open_owned_directory(root, binding) as owned:
        with pytest.raises(provenance.ProvenanceError):
            ip.publish_manifest(owned, manifest)
    public = json.loads((root / "manifest.json").read_text())
    assert public["status"] == "failed"
    assert public.get("invalidated") is True


def test_image_identity_binds_exact_tag_digest_and_locked_base():
    tag = "prime-claw-test-integration:" + "a" * 12
    base = "sha256:" + "b" * 64
    raw = {"Id": IMAGE1, "Os": "linux", "Architecture": "arm64",
           "RepoTags": [tag],
           "RepoDigests": ["docker.io/library/prime-claw-test-integration@" + IMAGE2],
           "Config": {"Labels": {"org.prime-claw.test.contract": ip.CONTRACT,
                                  "org.prime-claw.test.run": RUN1}}}
    safe = ip.safe_image_identity(
        raw, expected_id=IMAGE1, run_id=RUN1, platform="linux/arm64",
        base_image_digest=base, dockerfile_sha256="c" * 64,
        input_sha256="d" * 64, tag=tag,
        started_at="2026-10-04T19:00:00Z",
        finished_at="2026-10-04T19:00:10Z")
    assert safe["repo_tags"] == [tag]
    assert safe["repo_digests"] == [IMAGE2]
    assert safe["base_image_digest"] == base
    for key, value in (("RepoTags", []), ("RepoTags", [tag, "other:x"]),
                       ("RepoDigests", ["example.invalid/x@" + IMAGE2])):
        changed = copy.deepcopy(raw); changed[key] = value
        with pytest.raises(provenance.ProvenanceError):
            ip.safe_image_identity(
                changed, expected_id=IMAGE1, run_id=RUN1, platform="linux/arm64",
                base_image_digest=base, dockerfile_sha256="c" * 64,
                input_sha256="d" * 64, tag=tag,
                started_at="2026-10-04T19:00:00Z",
                finished_at="2026-10-04T19:00:10Z")
    with pytest.raises(provenance.ProvenanceError):
        ip.safe_image_identity(
            raw, expected_id=IMAGE1, run_id=RUN1, platform="linux/arm64",
            base_image_digest="sha256:bad", dockerfile_sha256="c" * 64,
            input_sha256="d" * 64, tag=tag,
            started_at="2026-10-04T19:00:00Z",
            finished_at="2026-10-04T19:00:10Z")


def test_plain_pytest_does_not_collect_explicit_integration_body(tmp_path):
    marker = tmp_path / "tool-called"
    bin_dir = tmp_path / "bin"; bin_dir.mkdir()
    for name in ("docker", "gbrain", "psql", "git"):
        tool = bin_dir / name
        tool.write_text(f"#!/bin/sh\necho called >> {marker}\nexit 99\n")
        tool.chmod(0o755)
    env = dict(os.environ)
    env["PATH"] = str(bin_dir) + os.pathsep + env.get("PATH", "")
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "--collect-only", "-q", "tests/integration"],
        cwd=REPO, env=env, text=True, capture_output=True, timeout=60)
    assert result.returncode in {0, 5}
    assert "environment_body.py::" not in result.stdout
    assert not marker.exists()


def test_direct_host_invocation_fails_before_side_effects_with_launcher_guidance(tmp_path):
    marker = tmp_path / "tool-called"
    bin_dir = tmp_path / "bin"; bin_dir.mkdir()
    for name in ("docker", "gbrain", "psql", "git", "initdb", "pg_ctl"):
        tool = bin_dir / name
        tool.write_text(f"#!/bin/sh\necho called >> {marker}\nexit 99\n")
        tool.chmod(0o755)
    attestation = "a" * 64
    env = {"PATH": str(bin_dir), "HOME": str(tmp_path), "LANG": "C.UTF-8",
           "PRIME_CLAW_INTEGRATION_ATTESTATION": attestation,
           "PRIME_CLAW_INTEGRATION_RUN_ID": RUN1}
    result = subprocess.run(
        [sys.executable, str(REPO / "tests/integration/environment_body.py"),
         "--attestation", attestation, "--run-id", RUN1],
        cwd=tmp_path, env=env, text=True, capture_output=True, timeout=30)
    assert result.returncode == 1
    assert "scripts/test-integration.sh" in result.stderr
    assert not marker.exists()
    assert sorted(path.name for path in tmp_path.iterdir()) == ["bin"]


def test_exact_name_and_tag_recovery_adopts_only_fully_owned_rows(tmp_path, monkeypatch):
    from scripts.testing import integration_driver
    tier = tmp_path / "tier"; tier.mkdir()
    tier_authority = provenance.open_directory_authority(
        tier, provenance.owned_directory_binding(tier))
    tag = "prime-claw-test-integration:" + "a" * 12
    name = "prime-claw-integration-" + RUN1.lower()
    image_row = {"Id": IMAGE1, "RepoTags": [tag],
                 "RepoDigests": ["docker.io/library/prime-claw-test-integration@" + IMAGE2],
                 "Config": {"Labels": {"org.prime-claw.test.contract": ip.CONTRACT,
                                        "org.prime-claw.test.run": RUN1}}}
    container_row = {"Id": CID1, "Image": IMAGE1, "Name": "/" + name,
                     "Config": {"Labels": {"org.prime-claw.test.contract": ip.CONTRACT,
                                            "org.prime-claw.test.run": RUN1}}}
    calls = []
    def fake_run(argv, **kwargs):
        calls.append(argv)
        row = image_row if argv[:3] == ["docker", "image", "inspect"] else container_row
        return _result(rc=0, stdout=json.dumps([row]) + "\n")
    monkeypatch.setattr(integration_driver, "_run", fake_run)
    assert integration_driver._recover_image(tier_authority, RUN1, tag) == ("owned", IMAGE1)
    assert integration_driver._recover_container(tier_authority, RUN1, name, IMAGE1) == (
        "owned", CID1, IMAGE1)
    image_row["Config"]["Labels"]["org.prime-claw.test.run"] = RUN2
    assert integration_driver._recover_image(tier_authority, RUN1, tag) == ("unknown", "")
    image_row["Config"]["Labels"]["org.prime-claw.test.run"] = RUN1
    image_row["RepoDigests"] = ["example.invalid/other@" + IMAGE2]
    assert integration_driver._recover_image(tier_authority, RUN1, tag) == ("unknown", "")
    image_row["RepoDigests"] = []
    image_row["RepoTags"] = [tag, "prime-claw-test-integration:extra"]
    assert integration_driver._recover_image(tier_authority, RUN1, tag) == ("unknown", "")
    image_row["RepoTags"] = [tag]
    container_row["Image"] = IMAGE2
    assert integration_driver._recover_container(tier_authority, RUN1, name, IMAGE1)[0] == "unknown"
    (tier / "image.iid").write_text("malformed\n")
    before = len(calls)
    assert integration_driver._recover_image(tier_authority, RUN1, tag) == ("unknown", "")
    assert len(calls) == before


def test_exact_name_and_tag_recovery_classifies_only_allowlisted_absence(tmp_path, monkeypatch):
    from scripts.testing import integration_driver
    tier = tmp_path / "tier"; tier.mkdir()
    tier_authority = provenance.open_directory_authority(
        tier, provenance.owned_directory_binding(tier))
    tag = "prime-claw-test-integration:" + "a" * 12
    name = "prime-claw-integration-" + RUN1.lower()
    def absent(argv, **kwargs):
        selector = argv[-1]
        if argv[:3] == ["docker", "image", "inspect"]:
            return _result(rc=1, stdout="[]\n",
                           stderr=f"Error response from daemon: No such image: {selector}\n")
        return _result(rc=1, stdout="[]\n",
                       stderr=f"Error response from daemon: No such container: {selector}\n")
    monkeypatch.setattr(integration_driver, "_run", absent)
    assert integration_driver._recover_image(tier_authority, RUN1, tag) == ("absent", "")
    assert integration_driver._recover_container(tier_authority, RUN1, name, "")[0] == "absent"
    monkeypatch.setattr(integration_driver, "_run", lambda argv, **kwargs:
        _result(rc=1, stdout="[]\n", stderr="daemon unavailable\n"))
    assert integration_driver._recover_image(tier_authority, RUN1, tag)[0] == "unknown"
    assert integration_driver._recover_container(tier_authority, RUN1, name, "")[0] == "unknown"


def _recording_driver_run(monkeypatch, tmp_path, *, container_remove_rc=0,
                          image_remove_rc=0, partial=None,
                          directory_remove_fail=None,
                          preparation_receipt_fail=False,
                          malformed_container_labels=False,
                          recovery_exception=False,
                          real_run_wrapper=False,
                          snapshot_attack=None):
    from scripts.testing import integration_driver
    lock = ip.load_lock(REPO / "config/test-artifacts.lock.json")
    repository = _passed(RUN1, IMAGE1, CID1, "a")["repository"]
    state = {"share": None, "run_id": None, "image": None,
             "container": None, "tag": None}
    calls = []
    original_remove = integration_driver.p.remove_directory_authority
    def remove_directory(root, **kwargs):
        candidate = root.path
        if (directory_remove_fail == "snapshot" and candidate.parent.name == ".workspaces"):
            raise provenance.ProvenanceError("injected snapshot removal refusal")
        if directory_remove_fail == candidate.name:
            raise provenance.ProvenanceError("injected directory removal refusal")
        return original_remove(root, **kwargs)
    monkeypatch.setattr(integration_driver.p, "remove_directory_authority", remove_directory)
    original_write = integration_driver.p.write_sanitized_json
    def write_json(owned, relative, value):
        if preparation_receipt_fail and str(relative) == "preparation.json":
            raise provenance.ProvenanceError("injected preparation receipt failure")
        return original_write(owned, relative, value)
    monkeypatch.setattr(integration_driver.p, "write_sanitized_json", write_json)
    monkeypatch.setattr(integration_driver, "_platform", lambda: "linux/arm64")
    monkeypatch.setattr(integration_driver.p, "repository_identity", lambda repo: repository)
    def capture(repo, destination):
        destination = Path(destination)
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.mkdir(mode=0o700)
        (destination / "captured.txt").write_text("snapshot\n")
        authority = provenance.open_directory_authority(
            destination, provenance.owned_directory_binding(destination))
        state["snapshot"] = destination
        if snapshot_attack == "root":
            hidden = destination.with_name(destination.name + "-owned")
            destination.rename(hidden)
            destination.mkdir(mode=0o700)
            (destination / "replacement-sentinel").write_text("preserve\n")
            state["snapshot_hidden"] = hidden
        elif snapshot_attack == "ancestor":
            parent = destination.parent
            hidden_parent = parent.with_name(parent.name + "-owned")
            parent.rename(hidden_parent)
            parent.mkdir(mode=0o700)
            (hidden_parent / destination.name).rename(destination)
            (parent / "replacement-ancestor-sentinel").write_text("preserve\n")
            state["snapshot_hidden_parent"] = hidden_parent
        return provenance.RepositorySnapshotCapture(
            repository, authority, ({
                "path": "captured.txt", "kind": "file", "mode": 0o644,
                "content_sha256": provenance.sha256_bytes(b"snapshot\n"),
                "captured_binding": provenance.ObjectBinding.from_stat(
                    os.stat("captured.txt", dir_fd=authority.fd,
                            follow_symlinks=False)).encode(),
            },))
    monkeypatch.setattr(
        integration_driver.p, "capture_repository_snapshot", capture)
    def snapshot_inputs(snapshot, records):
        provenance.verify_directory_authority(snapshot)
        return (
            (REPO / integration_driver.DOCKERFILE).read_bytes(),
            (REPO / integration_driver.LOCK_PATH).read_bytes(), lock)
    monkeypatch.setattr(
        integration_driver, "_read_snapshot_inputs", snapshot_inputs)
    def prepare(context, tier, prep, snapshot, snapshot_records,
                run_id, platform, lock_value, lock_bytes, dockerfile_bytes,
                mirror, teardown_state):
        teardown_state.clear(); teardown_state.update(
            integration_driver._remove_owned(prep, tier))
        return "2" * 64, "1" * 64
    monkeypatch.setattr(integration_driver, "_prepare_context", prepare)
    def build(tier, context, run_id, platform, lock_value, input_hash, tag,
              dockerfile_hash, rebuild):
        (tier.path / "image.iid").write_text(IMAGE1 + "\n")
        image = _passed(run_id, IMAGE1, CID1, "a")["image"]
        image["informational_tag"] = tag; image["repo_tags"] = [tag]
        image["base_image_digest"] = lock_value["base_image"]["platforms"][platform]
        state["run_id"] = run_id; state["image"] = image; state["tag"] = tag
        if partial == "build":
            raise integration_driver.DriverError("injected post-build failure")
        return image, IMAGE1
    monkeypatch.setattr(integration_driver, "_build_image", build)
    def create(tier, snapshot, share, run_id, image_id, name):
        (tier.path / "container.cid").write_text(CID1 + "\n")
        container = _passed(run_id, image_id, CID1, "a")["container"]
        state["share"] = share.path; state["container"] = container
        if partial == "create":
            raise integration_driver.DriverError("injected post-create failure")
        return container, CID1, name
    monkeypatch.setattr(integration_driver, "_create_container", create)
    monkeypatch.setattr(integration_driver, "_verify_container",
                        lambda *args, **kwargs: state["container"])
    def body_receipt(attestation):
        fixture = _passed(state["run_id"], IMAGE1, CID1, "a")["fixtures"]
        pg = _passed(state["run_id"], IMAGE1, CID1, "a")["postgresql"]
        now = provenance.utc_now()
        return {
            "schema_version": 1, "contract": ip.BODY_CONTRACT,
            "run_id": state["run_id"], "started_at": now, "finished_at": now,
            "attestation_sha256": __import__("hashlib").sha256(attestation.encode()).hexdigest(),
            "platform": "linux/arm64", "non_root": True, "uid": 10001,
            "repository_read_only": True, "external_tcp_refused": True,
            "environment_names_sha256": "4" * 64,
            "artifact_lock_sha256": __import__("hashlib").sha256(
                provenance.canonical_json(lock).encode()).hexdigest(),
            "base_image_digest": lock["base_image"]["platforms"]["linux/arm64"],
            "gbrain": {**lock["gbrain"], "executable_sha256": "5" * 64,
                       "executable_version": lock["gbrain"]["package_version"]},
            "bun": {"version": lock["bun"]["version"],
                    "artifact_sha256": lock["bun"]["platforms"]["linux/arm64"]["sha256"]},
            "fixtures": fixture, "postgresql": pg,
        }
    def fake_run(argv, **kwargs):
        calls.append(list(argv))
        if argv[:2] == ["docker", "exec"]:
            if partial == "signal":
                integration_driver._ACTIVE_SIGNALS.first = signal.SIGTERM
                raise integration_driver.LifecycleInterrupted(signal.SIGTERM)
            token = next(item.split("=", 1)[1] for item in argv
                         if isinstance(item, str) and item.startswith("PRIME_CLAW_INTEGRATION_ATTESTATION="))
            (state["share"] / "body.json").write_text(
                provenance.canonical_json(body_receipt(token)))
            return _result(rc=0)
        if argv[:3] == ["docker", "rm", "-f"]:
            return _result(rc=container_remove_rc)
        if argv[:3] == ["docker", "image", "rm"]:
            return _result(rc=image_remove_rc)
        if argv[:2] == ["docker", "inspect"]:
            if partial == "create" and not any(call[:3] == ["docker", "rm", "-f"] for call in calls[:-1]):
                row = {"Id": CID1, "Image": IMAGE1,
                       "Name": "/prime-claw-integration-" + state["run_id"].lower(),
                       "Config": {"Labels": (None if malformed_container_labels else {
                           "org.prime-claw.test.contract": ip.CONTRACT,
                           "org.prime-claw.test.run": state["run_id"]})}}
                return _result(rc=0, stdout=json.dumps([row]) + "\n")
            return _result(rc=1, stdout="[]\n",
                           stderr=f"error: no such object: {argv[-1]}\n")
        if argv[:3] == ["docker", "image", "inspect"]:
            if partial == "build" and not any(call[:3] == ["docker", "image", "rm"] for call in calls[:-1]):
                row = {"Id": IMAGE1, "RepoTags": [state["tag"]],
                       "RepoDigests": ["docker.io/library/prime-claw-test-integration@" + IMAGE2],
                       "Config": {"Labels": {
                           "org.prime-claw.test.contract": ip.CONTRACT,
                           "org.prime-claw.test.run": state["run_id"]}}}
                return _result(rc=0, stdout=json.dumps([row]) + "\n")
            return _result(rc=1, stdout="[]\n",
                           stderr=f"Error response from daemon: No such image: {argv[-1]}\n")
        raise AssertionError(f"unexpected recording-fake command: {argv}")
    if real_run_wrapper:
        monkeypatch.setattr(integration_driver.bounded, "run_completed",
                            lambda argv, **kwargs: fake_run(list(argv)))
    else:
        monkeypatch.setattr(integration_driver, "_run", fake_run)
    if recovery_exception:
        monkeypatch.setattr(
            integration_driver, "_recover_container",
            lambda *args, **kwargs: (_ for _ in ()).throw(
                RuntimeError("injected recovery exception")))
    results = tmp_path / "results"
    status_root = tmp_path / "status"
    status_root.mkdir(mode=0o700)
    status_binding = provenance.owned_directory_binding(status_root)
    monkeypatch.setenv("PRIME_CLAW_INTEGRATION_STATUS_ROOT", str(status_root))
    monkeypatch.setenv("PRIME_CLAW_INTEGRATION_STATUS_BINDING", status_binding)
    monkeypatch.setattr(integration_driver, "_await_supervisor_ack",
                        lambda status, nonce: None)
    watched = (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
    prior_handlers = {sig: signal.getsignal(sig) for sig in watched}
    prior_mask = signal.pthread_sigmask(signal.SIG_BLOCK, [])
    try:
        rc = integration_driver.run(SimpleNamespace(
            dry_run=False, rebuild=False, results_root=str(results), gbrain_mirror=None))
    finally:
        for sig, handler in prior_handlers.items():
            signal.signal(sig, handler)
        signal.pthread_sigmask(signal.SIG_SETMASK, prior_mask)
        integration_driver._ACTIVE_SIGNALS = None
    candidate_path = status_root / "candidate.json"
    if candidate_path.exists():
        status = json.loads((status_root / "status.json").read_text())
        status_authority = provenance.open_directory_authority(
            status_root, status_binding)
        try:
            candidate = provenance.read_sanitized_json(
                status_authority, "candidate.json",
                max_bytes=ip.MANIFEST_MAX_BYTES)
        finally:
            status_authority.close()
        if rc != 0 and candidate["status"] == "passed":
            candidate = copy.deepcopy(candidate)
            candidate["status"] = "failed"
            candidate["run"]["status"] = "failed"
            candidate["run"]["failure_codes"] = [
                "supervisor-terminal-failed"]
        tier_path = Path(status["tier_dir"])
        tier_authority = provenance.open_directory_authority(
            tier_path, status["binding"])
        try:
            retained = ip.publish_final_manifest(tier_authority, candidate)
            retained.close()
        finally:
            tier_authority.close()
    manifest_paths = list(results.rglob("manifest.json"))
    return rc, (manifest_paths[0] if manifest_paths else None), calls, state


def test_public_driver_recording_fake_closes_only_exact_ids_and_publishes_green(tmp_path, monkeypatch):
    rc, manifest_path, calls, state = _recording_driver_run(monkeypatch, tmp_path)
    assert rc == 0
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "passed"
    assert ["docker", "rm", "-f", CID1] in calls
    assert ["docker", "image", "rm", "-f", IMAGE1] in calls
    assert not state["share"].exists()
    assert not (manifest_path.parents[2] / ".workspaces" / state["run_id"]).exists()
    assert all("prune" not in row and "--all" not in row for call in calls for row in call)


@pytest.mark.parametrize("kind", ["container", "image"])
def test_public_driver_recording_fake_retains_or_fails_closed_on_remove_error(
        tmp_path, monkeypatch, kind):
    rc, manifest_path, calls, state = _recording_driver_run(
        monkeypatch, tmp_path,
        container_remove_rc=1 if kind == "container" else 0,
        image_remove_rc=1 if kind == "image" else 0)
    assert rc == 1
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["teardown"][kind]["remove_outcome"] == "ordinary_nonzero"
    assert manifest["teardown"][kind]["clean"] is False
    if kind == "container":
        assert state["share"].exists()
        assert manifest["teardown"]["share"]["clean"] is False
    else:
        assert not state["share"].exists()


@pytest.mark.parametrize("partial", ["build", "create"])
def test_public_driver_recovers_partial_docker_success_by_exact_captured_id(
        tmp_path, monkeypatch, partial):
    rc, manifest_path, calls, state = _recording_driver_run(
        monkeypatch, tmp_path, partial=partial)
    assert rc == 1
    assert manifest_path is not None
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert ["docker", "image", "rm", "-f", IMAGE1] in calls
    if partial == "create":
        assert ["docker", "rm", "-f", CID1] in calls
    assert manifest["teardown"]["image"]["clean"] is True
    assert manifest["teardown"]["container"]["clean"] is True


@pytest.mark.parametrize("directory", ["snapshot", "share", "build-context"])
def test_public_driver_records_directory_cleanup_refusal_and_never_goes_green(
        tmp_path, monkeypatch, directory):
    rc, manifest_path, calls, state = _recording_driver_run(
        monkeypatch, tmp_path, directory_remove_fail=directory)
    assert rc == 1
    assert manifest_path is not None
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    key = "context" if directory == "build-context" else directory
    assert manifest["teardown"][key]["clean"] is False
    assert "cleanup-failed" in manifest["run"]["failure_codes"]


def test_public_driver_preparation_receipt_failure_leaves_no_green_manifest(
        tmp_path, monkeypatch):
    rc, manifest_path, calls, state = _recording_driver_run(
        monkeypatch, tmp_path, preparation_receipt_fail=True)
    assert rc == 1
    if manifest_path is not None:
        assert json.loads(manifest_path.read_text()).get("status") != "passed"


def test_public_driver_signal_during_runtime_still_closes_exact_ids(tmp_path, monkeypatch):
    rc, manifest_path, calls, state = _recording_driver_run(
        monkeypatch, tmp_path, partial="signal", real_run_wrapper=True)
    assert rc == 128 + signal.SIGTERM
    assert manifest_path is not None
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["run"]["failure_codes"] == ["interrupted"]
    assert ["docker", "rm", "-f", CID1] in calls
    assert ["docker", "image", "rm", "-f", IMAGE1] in calls
    assert not state["share"].exists()


def test_lifecycle_signal_owner_converts_python_and_bounded_phase_signals(tmp_path):
    script = tmp_path / "signal_probe.py"
    script.write_text("""
import os, signal, sys, threading
from scripts.testing import integration_driver as d
signal.pthread_sigmask(signal.SIG_UNBLOCK, [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
owner = d.LifecycleSignals(); d._ACTIVE_SIGNALS = owner; owner.enable()
os.kill(os.getpid(), signal.SIGTERM)
try:
    owner.checkpoint()
except d.LifecycleInterrupted as exc:
    assert exc.signum == signal.SIGTERM
else:
    raise AssertionError('python-phase signal was not typed')
owner.freeze()
print('python-phase-ok')
""")
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    first = subprocess.run([sys.executable, str(script)], cwd=REPO, env=env,
                           text=True, capture_output=True, timeout=30)
    assert first.returncode == 0, first.stderr
    assert "python-phase-ok" in first.stdout

    script.write_text("""
import os, signal, sys, threading
from scripts.testing import integration_driver as d
signal.pthread_sigmask(signal.SIG_UNBLOCK, [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
owner = d.LifecycleSignals(); d._ACTIVE_SIGNALS = owner; owner.enable()
timer = threading.Timer(0.2, lambda: os.kill(os.getpid(), signal.SIGTERM)); timer.start()
try:
    d._run([sys.executable, '-c', 'import time; time.sleep(30)'], timeout=10)
except d.LifecycleInterrupted as exc:
    assert exc.signum == signal.SIGTERM
else:
    raise AssertionError('bounded-phase signal was not typed')
finally:
    timer.cancel(); owner.freeze()
print('bounded-phase-ok')
""")
    second = subprocess.run([sys.executable, str(script)], cwd=REPO, env=env,
                            text=True, capture_output=True, timeout=30)
    assert second.returncode == 0, second.stderr
    assert "bounded-phase-ok" in second.stdout


def test_verified_loader_rejects_same_directory_and_semantic_body_tampering(
        tmp_path, monkeypatch):
    rc, manifest_path, calls, state = _recording_driver_run(monkeypatch, tmp_path)
    assert rc == 0 and manifest_path is not None
    ip.load_verified_manifest(manifest_path)
    with pytest.raises(provenance.ProvenanceError):
        ip._main(["compare-runs", str(manifest_path), str(manifest_path)])
    root = manifest_path.parent
    manifest = json.loads(manifest_path.read_text())
    body_path = root / "body.json"
    body = json.loads(body_path.read_text())
    body["attestation_sha256"] = "0" * 64
    body_path.write_text(provenance.canonical_json(body))
    binding = provenance.owned_directory_binding(root)
    with provenance.open_owned_directory(root, binding) as owned:
        manifest["evidence"]["files"] = ip.evidence_inventory(owned)
    manifest_path.write_text(provenance.canonical_json(manifest))
    with pytest.raises(provenance.ProvenanceError):
        ip.load_verified_manifest(manifest_path)


def test_supervisor_terminal_closure_replaces_green_integration_manifest(
        tmp_path, monkeypatch):
    from scripts.testing import integration_supervisor
    rc, manifest_path, calls, state = _recording_driver_run(monkeypatch, tmp_path)
    assert rc == 0 and manifest_path is not None
    root = manifest_path.parent
    binding = provenance.owned_directory_binding(root)
    with provenance.open_owned_directory(root, binding) as owned:
        assert integration_supervisor._close_evidence(owned, True) is True
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["run"]["failure_codes"] == ["publication-invalidated"]


@pytest.mark.parametrize(
    "leaf_kind", ["fifo", "directory", "symlink", "oversized"])
def test_owned_control_reader_rejects_special_files_without_blocking(tmp_path, leaf_kind):
    root = tmp_path / "owned"; root.mkdir()
    if leaf_kind == "fifo":
        os.mkfifo(root / "container.cid")
    elif leaf_kind == "directory":
        (root / "container.cid").mkdir()
    elif leaf_kind == "symlink":
        target = tmp_path / "target"; target.write_text("3" * 64)
        (root / "container.cid").symlink_to(target)
    else:
        (root / "container.cid").write_text("3" * 300)
    authority = provenance.open_directory_authority(
        root, provenance.owned_directory_binding(root))
    try:
        with pytest.raises(provenance.ProvenanceError):
            provenance.read_owned_regular_text(
                authority, "container.cid", max_bytes=256)
        from scripts.testing import integration_driver
        assert integration_driver._capture_file(
            authority, "container.cid", __import__("re").compile(r"[0-9a-f]{64}")) == (
                "unknown", "")
    finally:
        authority.close()


def test_directory_authority_rejects_republished_leaf_below_replaced_ancestor(tmp_path):
    public = tmp_path / "public"
    leaf = public / "tier"
    leaf.mkdir(parents=True)
    (leaf / "container.cid").write_text(CID1)
    binding = provenance.owned_directory_binding(leaf)
    authority = provenance.open_directory_authority(leaf, binding)
    original_parent = tmp_path / "original-parent"
    public.rename(original_parent)
    public.mkdir()
    (original_parent / "tier").rename(public / "tier")
    assert provenance.owned_directory_binding(public / "tier") == binding
    try:
        with pytest.raises(provenance.ProvenanceError,
                           match="public edge changed"):
            provenance.verify_directory_authority(authority)
        from scripts.testing import integration_driver
        assert integration_driver._capture_file(
            authority, "container.cid", __import__("re").compile(r"[0-9a-f]{64}")) == (
                "unknown", "")
    finally:
        authority.close()


def test_container_boundary_rejects_replaced_mount_ancestor_even_for_same_leaf_inode(tmp_path):
    snapshot_parent = tmp_path / "snapshot-parent"
    snapshot = snapshot_parent / "snapshot"; snapshot.mkdir(parents=True)
    share = tmp_path / "share"; share.mkdir()
    snapshot_authority = provenance.open_directory_authority(
        snapshot, provenance.owned_directory_binding(snapshot))
    share_authority = provenance.open_directory_authority(
        share, provenance.owned_directory_binding(share))
    moved = tmp_path / "snapshot-parent-original"
    snapshot_parent.rename(moved)
    snapshot_parent.mkdir()
    (moved / "snapshot").rename(snapshot)
    name = "prime-claw-integration-" + RUN1.lower()
    raw = {
        "Id": CID1, "Image": IMAGE1, "Name": "/" + name,
        "Config": {"User": "tester", "Labels": {
            "org.prime-claw.test.contract": ip.CONTRACT,
            "org.prime-claw.test.run": RUN1},
            "Env": ["PATH=/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin",
                    "HOME=/home/tester", "LANG=C.UTF-8"], "ExposedPorts": None},
        "HostConfig": {"NetworkMode": "none", "Privileged": False,
                       "PortBindings": None, "PidMode": "", "IpcMode": "private"},
        "State": {"Running": True},
        "Mounts": [
            {"Destination": "/workspace", "Source": str(snapshot),
             "RW": False, "Type": "bind"},
            {"Destination": "/results", "Source": str(share),
             "RW": True, "Type": "bind"},
        ],
    }
    try:
        with pytest.raises(provenance.ProvenanceError):
            ip.safe_container_boundary(
                raw, expected_id=CID1, image_id=IMAGE1,
                run_id=RUN1, name=name,
                repository_authority=snapshot_authority,
                result_authority=share_authority)
    finally:
        snapshot_authority.close(); share_authority.close()


@pytest.mark.parametrize("bad", [
    {}, [], [None], [{}, {}], ["row"],
    [{"Config": None}], [{"Config": []}],
    [{"Config": {}}], [{"Config": {"Labels": None}}],
    [{"Config": {"Labels": []}}],
])
def test_recovery_inspect_shapes_normalize_to_typed_unknown(bad):
    from scripts.testing import integration_driver
    result = _result(rc=0, stdout=json.dumps(bad) + "\n")
    assert integration_driver._recovery_inspect_row(
        result, CID1, kind="container") == ("unknown", None, None)


def test_public_partial_create_malformed_labels_preserves_mounts_and_cleans_image(
        tmp_path, monkeypatch):
    rc, manifest_path, calls, state = _recording_driver_run(
        monkeypatch, tmp_path, partial="create",
        malformed_container_labels=True)
    assert rc == 1 and manifest_path is not None
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["teardown"]["container"]["state"] == "unknown"
    assert manifest["teardown"]["container"]["clean"] is False
    assert ["docker", "rm", "-f", CID1] not in calls
    assert ["docker", "image", "rm", "-f", IMAGE1] in calls
    assert manifest["teardown"]["image"]["clean"] is True
    assert state["share"].exists()
    assert "cleanup-failed" in manifest["run"]["failure_codes"]


def test_public_finalizer_recovery_exception_does_not_skip_image_or_failed_publication(
        tmp_path, monkeypatch):
    rc, manifest_path, calls, state = _recording_driver_run(
        monkeypatch, tmp_path, partial="create", recovery_exception=True)
    assert rc == 1 and manifest_path is not None
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["teardown"]["container"]["state"] == "unknown"
    assert ["docker", "image", "rm", "-f", IMAGE1] in calls
    assert state["share"].exists()


@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
@pytest.mark.parametrize("phase", ["before", "during", "cleanup", "restoration"])
@pytest.mark.parametrize("preexisting", [False, True])
def test_lifecycle_signal_owner_preserves_caller_pending_mask_and_handlers(
        tmp_path, sig, phase, preexisting):
    script = tmp_path / "signal_ownership.py"
    script.write_text(r'''
import os, signal, sys
from scripts.testing import integration_driver as d
sig = signal.Signals(int(sys.argv[1])); phase = sys.argv[2]
preexisting = sys.argv[3] == "true"
def sentinel(signum, frame): pass
old_handler = signal.getsignal(sig)
signal.signal(sig, sentinel)
old_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {sig})
expected_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
if preexisting:
    os.kill(os.getpid(), sig)
if phase == "before":
    os.kill(os.getpid(), sig)
owner = d.LifecycleSignals(); owner.enable()
assert sig not in owner.owned
if phase == "during":
    os.kill(os.getpid(), sig)
owner.checkpoint()
assert owner.first is None
owner.freeze()
if phase == "cleanup":
    os.kill(os.getpid(), sig)
if phase == "restoration":
    original_mask = owner.sigmask; sent = False
    def masked(how, mask):
        global sent
        if not sent and how == signal.SIG_SETMASK:
            sent = True
            os.kill(os.getpid(), sig)
        return original_mask(how, mask)
    owner.sigmask = masked
owner.restore()
assert owner.first is None
assert signal.getsignal(sig) is sentinel
assert signal.pthread_sigmask(signal.SIG_BLOCK, set()) == expected_mask
assert sig in signal.sigpending()
assert signal.sigwait({sig}) == sig
signal.signal(sig, old_handler)
signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)
print("ok")
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    result = subprocess.run(
        [sys.executable, str(script), str(int(sig)), phase,
         "true" if preexisting else "false"],
        cwd=REPO, env=env, text=True, capture_output=True, timeout=10)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "ok"


@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
def test_supervisor_real_signal_at_final_unmask_never_leaves_green(
        tmp_path, monkeypatch, sig):
    seed = tmp_path / "seed"; seed.mkdir()
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, seed)
    assert rc == 0 and manifest_path is not None
    copy_root = tmp_path / f"signal-{int(sig)}"
    shutil.copytree(manifest_path.parent, copy_root)
    copied_manifest = copy_root / "manifest.json"
    (copy_root / ip.MANIFEST_BINDING_NAME).write_text(
        provenance.canonical_json({
            "schema_version": 1,
            "contract": ip.MANIFEST_BINDING_CONTRACT,
            "binding": provenance.ObjectBinding.from_stat(
                os.lstat(copied_manifest)).encode(),
        }))
    ip.load_verified_manifest(copied_manifest)
    (copy_root / ".publication").chmod(0o755)
    binding = provenance.owned_directory_binding(copy_root)
    probe = tmp_path / f"restore-{int(sig)}.py"
    probe.write_text(r'''
import os, signal, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from scripts.testing import integration_supervisor as s
root = Path(sys.argv[2]); binding = sys.argv[3]; injected = int(sys.argv[4])
signal.pthread_sigmask(signal.SIG_UNBLOCK, s.WATCHED)
original_mask = signal.pthread_sigmask; original_close = s._close_evidence
phase = {"closed": False, "sent": False}
def close(status, failed):
    okay = original_close(status, failed)
    phase["closed"] = True
    return okay
def masked(how, mask):
    if phase["closed"] and not phase["sent"] and how == signal.SIG_SETMASK:
        phase["sent"] = True
        os.kill(os.getpid(), injected)
    return original_mask(how, mask)
s._load_status = lambda _root: (root, binding, "a" * 64)
s._close_evidence = close
signal.pthread_sigmask = masked
raise SystemExit(s.supervise("/usr/bin/true", []))
''')
    result = subprocess.run(
        [sys.executable, str(probe), str(REPO), str(copy_root),
         binding, str(int(sig))], cwd=REPO, text=True,
        capture_output=True, timeout=10)
    assert result.returncode != 0
    raw = json.loads((copy_root / "manifest.json").read_text())
    assert raw.get("status") != "passed"


def test_supervisor_namespace_failure_neutralizes_exact_green_manifest(
        tmp_path, monkeypatch):
    from scripts.testing import integration_supervisor
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, tmp_path)
    assert rc == 0 and manifest_path is not None
    root = manifest_path.parent
    binding = provenance.owned_directory_binding(root)
    original = provenance.ObjectBinding.from_stat(os.lstat(manifest_path))
    (root / ".publication").chmod(0o755)
    with provenance.open_owned_directory(root, binding) as owned:
        assert integration_supervisor._close_evidence(owned, True) is True
    assert provenance.ObjectBinding.from_stat(os.lstat(manifest_path)) == original
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["run"]["failure_codes"] == ["publication-invalidated"]


def test_supervisor_status_reader_rejects_fifo_without_blocking(tmp_path):
    from scripts.testing import integration_supervisor
    root = tmp_path / "status"; root.mkdir()
    os.mkfifo(root / "status.json")
    authority = provenance.open_directory_authority(
        root, provenance.owned_directory_binding(root))
    try:
        assert integration_supervisor._load_status(authority) is None
    finally:
        authority.close()


@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
def test_lifecycle_signal_owner_captures_signal_at_final_unmask(
        tmp_path, sig):
    script = tmp_path / "lifecycle_unmask.py"
    script.write_text(r'''
import os, signal, sys
from scripts.testing import integration_driver as d
sig = signal.Signals(int(sys.argv[1])); seen = []
def sentinel(signum, frame): seen.append(signum)
old_handler = signal.getsignal(sig)
signal.signal(sig, sentinel)
old_mask = signal.pthread_sigmask(signal.SIG_UNBLOCK, {sig})
expected_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
owner = d.LifecycleSignals(); owner.enable()
original_mask = owner.sigmask
phase = {"sent": False}
def masked(how, mask):
    if not phase["sent"] and how == signal.SIG_SETMASK:
        phase["sent"] = True
        os.kill(os.getpid(), sig)
    return original_mask(how, mask)
owner.sigmask = masked
owner.restore()
assert owner.first == sig
assert seen == []
assert signal.getsignal(sig) is sentinel
assert signal.pthread_sigmask(signal.SIG_BLOCK, set()) == expected_mask
signal.signal(sig, old_handler)
signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)
print("ok")
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    result = subprocess.run(
        [sys.executable, str(script), str(int(sig))],
        cwd=REPO, env=env, text=True, capture_output=True, timeout=10)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "ok"


def test_supervisor_restores_caller_state_when_status_setup_raises(monkeypatch):
    from scripts.testing import integration_supervisor
    watched = integration_supervisor.WATCHED
    before_handlers = {sig: signal.getsignal(sig) for sig in watched}
    before_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
    monkeypatch.setattr(
        integration_supervisor.tempfile, "mkdtemp",
        lambda **kwargs: (_ for _ in ()).throw(RuntimeError("injected setup failure")))
    with pytest.raises(RuntimeError, match="injected setup failure"):
        integration_supervisor.supervise("/usr/bin/true", [])
    assert {sig: signal.getsignal(sig) for sig in watched} == before_handlers
    assert signal.pthread_sigmask(signal.SIG_BLOCK, set()) == before_mask


@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
def test_public_driver_early_failure_restores_caller_pending_state(tmp_path, sig):
    script = tmp_path / "early_driver_failure.py"
    script.write_text(r'''
import os, signal, sys
from types import SimpleNamespace
from scripts.testing import integration_driver as d
sig = signal.Signals(int(sys.argv[1]))
def sentinel(signum, frame): pass
old_handler = signal.getsignal(sig)
signal.signal(sig, sentinel)
old_mask = signal.pthread_sigmask(signal.SIG_BLOCK, {sig})
expected_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
os.kill(os.getpid(), sig)
d._platform = lambda: (_ for _ in ()).throw(d.DriverError("early"))
try:
    d.run(SimpleNamespace(dry_run=False, rebuild=False, results_root=None,
                          gbrain_mirror=None))
except d.DriverError as exc:
    assert str(exc) == "early"
else:
    raise AssertionError("early failure did not propagate")
assert signal.getsignal(sig) is sentinel
assert signal.pthread_sigmask(signal.SIG_BLOCK, set()) == expected_mask
assert sig in signal.sigpending()
assert signal.sigwait({sig}) == sig
signal.signal(sig, old_handler)
signal.pthread_sigmask(signal.SIG_SETMASK, old_mask)
print("ok")
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    result = subprocess.run(
        [sys.executable, str(script), str(int(sig))], cwd=REPO, env=env,
        text=True, capture_output=True, timeout=10)
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "ok"


def test_supervisor_restores_caller_state_when_popen_raises(monkeypatch):
    from scripts.testing import integration_supervisor
    watched = integration_supervisor.WATCHED
    before_handlers = {sig: signal.getsignal(sig) for sig in watched}
    before_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
    monkeypatch.setattr(
        integration_supervisor.subprocess, "Popen",
        lambda *args, **kwargs: (_ for _ in ()).throw(
            OSError("injected launch failure")))
    with pytest.raises(OSError, match="injected launch failure"):
        integration_supervisor.supervise("/usr/bin/true", [])
    assert {sig: signal.getsignal(sig) for sig in watched} == before_handlers
    assert signal.pthread_sigmask(signal.SIG_BLOCK, set()) == before_mask



def test_supervisor_restores_after_partial_handler_install_failure(monkeypatch):
    from scripts.testing import integration_supervisor
    watched = integration_supervisor.WATCHED
    before_handlers = {sig: signal.getsignal(sig) for sig in watched}
    before_mask = signal.pthread_sigmask(signal.SIG_BLOCK, set())
    original_signal = signal.signal
    calls = {"count": 0, "raised": False}
    def install(sig, handler):
        calls["count"] += 1
        if calls["count"] == 2 and not calls["raised"]:
            calls["raised"] = True
            raise OSError("injected partial handler install")
        return original_signal(sig, handler)
    monkeypatch.setattr(integration_supervisor.signal, "signal", install)
    with pytest.raises(OSError, match="partial handler install"):
        integration_supervisor.supervise("/usr/bin/true", [])
    assert {sig: signal.getsignal(sig) for sig in watched} == before_handlers
    assert signal.pthread_sigmask(signal.SIG_BLOCK, set()) == before_mask



def test_supervisor_status_ipc_accepts_bounded_local_path_without_evidence_sanitizing(tmp_path):
    from scripts.testing import integration_supervisor
    tier = tmp_path / "tier"; tier.mkdir()
    tier_binding = provenance.owned_directory_binding(tier)
    root = tmp_path / "status"; root.mkdir()
    authority = provenance.open_directory_authority(
        root, provenance.owned_directory_binding(root))
    try:
        provenance.write_owned_regular_bytes(
            authority, "status.json",
            provenance.canonical_json({
                "tier_dir": str(tier), "binding": tier_binding,
                "nonce": "a" * 64,
            }).encode("utf-8"))
        assert integration_supervisor._load_status(authority) == (
            tier, tier_binding, "a" * 64)
    finally:
        authority.close()


@pytest.mark.parametrize("producer", ["build", "create"])
@pytest.mark.parametrize("leaf_kind", ["fifo", "directory", "symlink", "oversized"])
def test_real_producer_rejects_unsafe_iid_cid_without_followup_docker(
        tmp_path, monkeypatch, producer, leaf_kind):
    from scripts.testing import integration_driver as d
    roots = {}
    authorities = []
    for name in ("tier", "context", "snapshot", "share"):
        path = tmp_path / name; path.mkdir()
        roots[name] = path
        authorities.append(provenance.open_directory_authority(
            path, provenance.owned_directory_binding(path)))
    tier, context, snapshot, share = authorities
    calls = []
    def fake_run(argv, **kwargs):
        calls.append(list(argv))
        relative = "image.iid" if producer == "build" else "container.cid"
        leaf = roots["tier"] / relative
        identity = IMAGE1 if producer == "build" else CID1
        if leaf_kind == "fifo":
            os.mkfifo(leaf)
        elif leaf_kind == "directory":
            leaf.mkdir()
        elif leaf_kind == "symlink":
            target = tmp_path / (relative + ".target")
            target.write_text(identity)
            leaf.symlink_to(target)
        else:
            leaf.write_text(identity * 8)
        return _result(rc=0)
    monkeypatch.setattr(d, "_run", fake_run)
    try:
        with pytest.raises(d.DriverError, match="safely published"):
            if producer == "build":
                lock = json.loads((REPO / "config/test-artifacts.lock.json").read_text())
                d._build_image(
                    tier, context, RUN1, "linux/arm64", lock, SHA,
                    "prime-claw-test-integration:test", SHA, False)
            else:
                d._create_container(
                    tier, snapshot, share, RUN1, IMAGE1,
                    "prime-claw-integration-" + RUN1.lower())
        assert len(calls) == 1
        expected = ["docker", "build"] if producer == "build" else ["docker", "create"]
        assert calls[0][:2] == expected
    finally:
        for authority in authorities:
            authority.close()


@pytest.mark.parametrize("producer", ["build", "create"])
def test_real_producer_rejects_replaced_tier_root_before_consuming_identity(
        tmp_path, monkeypatch, producer):
    from scripts.testing import integration_driver as d
    roots = {}
    authorities = []
    for name in ("tier", "context", "snapshot", "share"):
        path = tmp_path / name; path.mkdir()
        roots[name] = path
        authorities.append(provenance.open_directory_authority(
            path, provenance.owned_directory_binding(path)))
    tier, context, snapshot, share = authorities
    detached = tmp_path / "tier.detached"
    attacker = tmp_path / "attacker"; attacker.mkdir()
    calls = []
    def fake_run(argv, **kwargs):
        calls.append(list(argv))
        roots["tier"].rename(detached)
        roots["tier"].symlink_to(attacker, target_is_directory=True)
        relative = "image.iid" if producer == "build" else "container.cid"
        (attacker / relative).write_text(IMAGE1 if producer == "build" else CID1)
        return _result(rc=0)
    monkeypatch.setattr(d, "_run", fake_run)
    try:
        with pytest.raises(provenance.ProvenanceError):
            if producer == "build":
                lock = json.loads((REPO / "config/test-artifacts.lock.json").read_text())
                d._build_image(
                    tier, context, RUN1, "linux/arm64", lock, SHA,
                    "prime-claw-test-integration:test", SHA, False)
            else:
                d._create_container(
                    tier, snapshot, share, RUN1, IMAGE1,
                    "prime-claw-integration-" + RUN1.lower())
        assert len(calls) == 1
    finally:
        for authority in authorities:
            authority.close()
        if roots["tier"].is_symlink():
            roots["tier"].unlink()
        shutil.rmtree(detached, ignore_errors=True)
        shutil.rmtree(attacker, ignore_errors=True)


def test_supervisor_missing_status_is_non_green(capsys):
    from scripts.testing import integration_supervisor
    assert integration_supervisor.supervise("/usr/bin/true", []) == 1
    assert "manifest verified" not in capsys.readouterr().out


@pytest.mark.parametrize("kind", ["malformed", "fifo", "symlink", "oversized"])
def test_supervisor_unsafe_status_is_non_green(tmp_path, capsys, kind):
    from scripts.testing import integration_supervisor
    child = tmp_path / "status_child.py"
    child.write_text(r'''
import os, pathlib, sys
root = pathlib.Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
kind = sys.argv[1]
status = root / "status.json"
if kind == "malformed": status.write_text("{}")
elif kind == "fifo": os.mkfifo(status)
elif kind == "symlink":
    target = root / "target"; target.write_text("{}")
    status.symlink_to(target)
elif kind == "oversized": status.write_bytes(b"x" * 5000)
''')
    rc = integration_supervisor.supervise(
        sys.executable, [str(child.resolve()), kind])
    assert rc == 1
    assert "manifest verified" not in capsys.readouterr().out


def test_supervisor_replaced_status_root_is_non_green(tmp_path, capsys):
    from scripts.testing import integration_supervisor
    child = tmp_path / "status_swap_child.py"
    record = tmp_path / "swap-record.json"
    child.write_text(r'''
import json, os, pathlib, sys
root = pathlib.Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
detached = root.with_name(root.name + ".detached")
attacker = root.with_name(root.name + ".attacker")
root.rename(detached); attacker.mkdir(); root.symlink_to(attacker, target_is_directory=True)
(attacker / "status.json").write_text(json.dumps({"tier_dir": "/tmp/fake", "binding": "1:2:3:4"}))
pathlib.Path(sys.argv[1]).write_text(json.dumps({"root": str(root), "detached": str(detached), "attacker": str(attacker)}))
''')
    try:
        rc = integration_supervisor.supervise(
            sys.executable, [str(child.resolve()), str(record.resolve())])
        assert rc == 1
        assert "manifest verified" not in capsys.readouterr().out
    finally:
        if record.exists():
            row = json.loads(record.read_text())
            root = Path(row["root"])
            if root.is_symlink(): root.unlink()
            shutil.rmtree(row["detached"], ignore_errors=True)
            shutil.rmtree(row["attacker"], ignore_errors=True)


def test_supervisor_dry_run_is_explicit_and_does_not_claim_manifest(capsys):
    from scripts.testing import integration_supervisor
    launcher = REPO / "scripts/test-integration.sh"
    assert integration_supervisor.supervise(str(launcher), ["--dry-run"]) == 0
    output = capsys.readouterr().out
    assert "dry-run contract verified" in output
    assert "manifest verified" not in output
    assert integration_supervisor.supervise("/usr/bin/true", ["--dry-run"]) == 1
    assert "manifest verified" not in capsys.readouterr().out



def test_supervisor_replaced_status_ancestor_is_non_green(
        tmp_path, monkeypatch, capsys):
    from scripts.testing import integration_supervisor
    public = tmp_path / "public"
    status = public / "parent" / "status"
    status.mkdir(parents=True)
    detached = tmp_path / "public.detached"
    child = tmp_path / "status_ancestor_swap_child.py"
    child.write_text(r'''
import json, os, pathlib
root = pathlib.Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
public = root.parent.parent
moved = public.with_name(public.name + ".detached")
public.rename(moved)
(public / "parent" / "status").mkdir(parents=True)
(public / "parent" / "status" / "status.json").write_text(
    json.dumps({"tier_dir": "/tmp/fake", "binding": "1:2:3:4"}))
''')
    monkeypatch.setattr(
        integration_supervisor.tempfile, "mkdtemp",
        lambda **kwargs: str(status))
    try:
        rc = integration_supervisor.supervise(
            sys.executable, [str(child.resolve())])
        assert rc == 1
        assert "manifest verified" not in capsys.readouterr().out
    finally:
        shutil.rmtree(public, ignore_errors=True)
        shutil.rmtree(detached, ignore_errors=True)



def _seeded_green_status_case(
        tmp_path, monkeypatch, *, kind, child_rc=0, signum=0,
        fixed_status_path=None):
    from scripts.testing import integration_supervisor
    seed = tmp_path / "seed"
    seed.mkdir()
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, seed)
    assert rc == 0 and manifest_path is not None
    tier = manifest_path.parent
    binding = provenance.owned_directory_binding(tier)
    child = tmp_path / "green_status_child.py"
    record = tmp_path / "green-status-record.json"
    child.write_text(r'''
import json, os, pathlib, signal, sys, time
sys.path.insert(0, sys.argv[7])
from scripts.testing import provenance as p
status_path = pathlib.Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
status_binding = os.environ["PRIME_CLAW_INTEGRATION_STATUS_BINDING"]
tier = pathlib.Path(sys.argv[1]); binding = sys.argv[2]
kind = sys.argv[3]; child_rc = int(sys.argv[4]); signum = int(sys.argv[5])
record = pathlib.Path(sys.argv[6]); nonce = "b" * 64
with p.open_directory_authority(status_path, status_binding) as status:
    p.write_owned_regular_bytes(status, "status.json", p.canonical_json({
        "tier_dir": str(tier), "binding": binding, "nonce": nonce,
    }).encode("utf-8"))
    deadline = time.monotonic() + 5
    while True:
        try:
            ack = json.loads(p.read_owned_regular_text(status, "ack.json", max_bytes=1024))
            assert ack == {"nonce": nonce}; break
        except FileNotFoundError:
            if time.monotonic() >= deadline: raise
            time.sleep(0.01)
record_row = {"root": str(status_path)}
record.write_text(json.dumps(record_row))
leaf = status_path / "status.json"
if kind == "missing": leaf.unlink()
elif kind == "malformed": leaf.write_text("{}")
elif kind == "fifo": leaf.unlink(); os.mkfifo(leaf)
elif kind == "symlink":
    leaf.unlink(); target = status_path / "bad-target"; target.write_text("{}")
    leaf.symlink_to(target)
elif kind == "oversized": leaf.write_bytes(b"x" * 5000)
elif kind == "root":
    detached = status_path.with_name(status_path.name + ".detached")
    attacker = status_path.with_name(status_path.name + ".attacker")
    status_path.rename(detached); attacker.mkdir()
    status_path.symlink_to(attacker, target_is_directory=True)
    record_row.update({"detached": str(detached), "attacker": str(attacker)})
    record.write_text(json.dumps(record_row))
elif kind == "tier-root":
    detached = tier.with_name(tier.name + ".detached")
    attacker = tier.with_name(tier.name + ".attacker")
    tier.rename(detached); attacker.mkdir()
    tier.symlink_to(attacker, target_is_directory=True)
    record_row.update({"tier_public": str(tier),
        "tier_detached": str(detached), "tier_attacker": str(attacker),
        "actual_manifest": str(detached / "manifest.json")})
    record.write_text(json.dumps(record_row))
elif kind == "tier-ancestor":
    ancestor = tier.parent
    detached = ancestor.with_name(ancestor.name + ".detached")
    ancestor.rename(detached); ancestor.mkdir(); (ancestor / tier.name).mkdir()
    record_row.update({"tier_public_ancestor": str(ancestor),
        "tier_detached_ancestor": str(detached),
        "actual_manifest": str(detached / tier.name / "manifest.json")})
    record.write_text(json.dumps(record_row))
if signum:
    os.kill(os.getppid(), signum)
    time.sleep(1)
raise SystemExit(child_rc)
''')
    if fixed_status_path is not None:
        monkeypatch.setattr(
            integration_supervisor.tempfile, "mkdtemp",
            lambda **kwargs: str(fixed_status_path))
    try:
        public_rc = integration_supervisor.supervise(
            sys.executable,
            [str(child.resolve()), str(tier), binding, kind,
             str(child_rc), str(signum), str(record.resolve()), str(REPO)])
    finally:
        row = json.loads(record.read_text()) if record.exists() else {}
        if row:
            root = Path(row["root"])
            if root.is_symlink(): root.unlink()
            for key in ("detached", "attacker"):
                if key in row: shutil.rmtree(row[key], ignore_errors=True)
    actual_manifest = Path(row.get("actual_manifest", str(manifest_path)))
    return public_rc, actual_manifest, row


@pytest.mark.parametrize(
    "kind", ["missing", "malformed", "fifo", "symlink", "oversized", "root"])
@pytest.mark.parametrize("child_rc", [0, 7])
def test_supervisor_retained_tier_invalidates_green_after_status_corruption(
        tmp_path, monkeypatch, kind, child_rc):
    public_rc, manifest_path, _row = _seeded_green_status_case(
        tmp_path, monkeypatch, kind=kind, child_rc=child_rc)
    assert public_rc != 0
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["run"]["failure_codes"] == ["publication-invalidated"]


@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
def test_supervisor_retained_tier_invalidates_green_after_status_loss_and_late_signal(
        tmp_path, monkeypatch, sig):
    public_rc, manifest_path, _row = _seeded_green_status_case(
        tmp_path, monkeypatch, kind="missing", signum=int(sig))
    assert public_rc == 128 + sig
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["run"]["failure_codes"] == ["publication-invalidated"]


def test_supervisor_retained_tier_invalidates_green_after_status_ancestor_swap(
        tmp_path, monkeypatch):
    from scripts.testing import integration_supervisor
    public = tmp_path / "status-public"
    status = public / "parent" / "status"
    status.mkdir(parents=True)
    detached = tmp_path / "status-public.detached"
    seed = tmp_path / "seed"; seed.mkdir()
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, seed)
    assert rc == 0 and manifest_path is not None
    tier = manifest_path.parent
    binding = provenance.owned_directory_binding(tier)
    child = tmp_path / "green_ancestor_child.py"
    child.write_text(r'''
import json, os, pathlib, sys, time
sys.path.insert(0, sys.argv[3])
from scripts.testing import provenance as p
root = pathlib.Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
with p.open_directory_authority(root, os.environ["PRIME_CLAW_INTEGRATION_STATUS_BINDING"]) as status:
    nonce = "c" * 64
    p.write_owned_regular_bytes(status, "status.json", p.canonical_json({
        "tier_dir": sys.argv[1], "binding": sys.argv[2], "nonce": nonce,
    }).encode("utf-8"))
    deadline = time.monotonic() + 5
    while True:
        try:
            assert json.loads(p.read_owned_regular_text(status, "ack.json", max_bytes=1024)) == {"nonce": nonce}
            break
        except FileNotFoundError:
            if time.monotonic() >= deadline: raise
            time.sleep(0.01)
public = root.parent.parent
moved = public.with_name(public.name + ".detached")
public.rename(moved)
(public / "parent" / "status").mkdir(parents=True)
(public / "parent" / "status" / "status.json").write_text("{}")
''')
    monkeypatch.setattr(
        integration_supervisor.tempfile, "mkdtemp", lambda **kwargs: str(status))
    try:
        public_rc = integration_supervisor.supervise(
            sys.executable, [str(child.resolve()), str(tier), binding, str(REPO)])
        assert public_rc != 0
        manifest, _ = ip.load_verified_manifest(manifest_path)
        assert manifest["status"] == "failed"
    finally:
        shutil.rmtree(public, ignore_errors=True)
        shutil.rmtree(detached, ignore_errors=True)



def _cleanup_seeded_tier_swap(row):
    if "tier_public" in row:
        public = Path(row["tier_public"])
        if public.is_symlink(): public.unlink()
        shutil.rmtree(row["tier_attacker"], ignore_errors=True)
        shutil.rmtree(row["tier_detached"], ignore_errors=True)
    if "tier_public_ancestor" in row:
        shutil.rmtree(row["tier_public_ancestor"], ignore_errors=True)
        shutil.rmtree(row["tier_detached_ancestor"], ignore_errors=True)


@pytest.mark.parametrize("kind", ["tier-root", "tier-ancestor"])
@pytest.mark.parametrize("child_rc", [0, 7])
def test_supervisor_fd_only_tier_invalidates_green_after_tier_alias_swap(
        tmp_path, monkeypatch, kind, child_rc):
    public_rc, manifest_path, row = _seeded_green_status_case(
        tmp_path, monkeypatch, kind=kind, child_rc=child_rc)
    try:
        assert public_rc != 0
        manifest, _ = ip.load_verified_manifest(manifest_path)
        assert manifest["status"] == "failed"
        assert manifest["run"]["failure_codes"] == ["publication-invalidated"]
    finally:
        _cleanup_seeded_tier_swap(row)


@pytest.mark.parametrize("kind", ["tier-root", "tier-ancestor"])
@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
def test_supervisor_fd_only_tier_invalidates_green_after_tier_swap_and_late_signal(
        tmp_path, monkeypatch, kind, sig):
    public_rc, manifest_path, row = _seeded_green_status_case(
        tmp_path, monkeypatch, kind=kind, signum=int(sig))
    try:
        assert public_rc == 128 + sig
        manifest, _ = ip.load_verified_manifest(manifest_path)
        assert manifest["status"] == "failed"
        assert manifest["run"]["failure_codes"] == ["publication-invalidated"]
    finally:
        _cleanup_seeded_tier_swap(row)


@pytest.mark.parametrize("kind", ["missing", "partial", "malformed", "wrong"])
def test_driver_supervisor_ack_is_bounded_and_exact(tmp_path, kind):
    from scripts.testing import integration_driver
    root = tmp_path / "status"; root.mkdir()
    authority = provenance.open_directory_authority(
        root, provenance.owned_directory_binding(root))
    nonce = "d" * 64
    try:
        if kind == "partial":
            provenance.write_owned_regular_bytes(authority, "ack.json", b"{")
        elif kind == "malformed":
            provenance.write_owned_regular_bytes(
                authority, "ack.json", b'{"nonce":1}')
        elif kind == "wrong":
            provenance.write_sanitized_json(
                authority, "ack.json", {"nonce": "e" * 64})
        if kind == "missing":
            with pytest.raises(integration_driver.DriverError, match="timed out"):
                integration_driver._await_supervisor_ack(
                    authority, nonce, timeout=0.01)
        else:
            with pytest.raises(integration_driver.DriverError,
                               match="unsafe|mismatched"):
                integration_driver._await_supervisor_ack(
                    authority, nonce, timeout=0.01)
    finally:
        authority.close()


def test_driver_supervisor_ack_accepts_atomically_published_nonce(tmp_path):
    from scripts.testing import integration_driver
    root = tmp_path / "status"; root.mkdir()
    authority = provenance.open_directory_authority(
        root, provenance.owned_directory_binding(root))
    nonce = "f" * 64
    try:
        provenance.write_sanitized_json(
            authority, "ack.json", {"nonce": nonce})
        integration_driver._await_supervisor_ack(
            authority, nonce, timeout=0.01)
    finally:
        authority.close()


@pytest.mark.parametrize("attack", ["root", "ancestor"])
def test_public_driver_refuses_snapshot_root_or_ancestor_republication(
        tmp_path, monkeypatch, attack):
    rc, manifest_path, calls, state = _recording_driver_run(
        monkeypatch, tmp_path, snapshot_attack=attack)
    assert rc == 1
    assert not any(call[:2] == ["docker", "build"] for call in calls)
    if manifest_path is not None:
        manifest, _ = ip.load_verified_manifest(manifest_path)
        assert manifest["status"] == "failed"
        assert manifest["teardown"]["snapshot"]["clean"] is False
    if attack == "root":
        assert (state["snapshot"] / "replacement-sentinel").read_text() == "preserve\n"
        assert (state["snapshot_hidden"] / "captured.txt").read_text() == "snapshot\n"
    else:
        assert (state["snapshot"].parent / "replacement-ancestor-sentinel").read_text() == "preserve\n"
        assert (state["snapshot"] / "captured.txt").read_text() == "snapshot\n"
        assert state["snapshot_hidden_parent"].is_dir()


def _minimal_snapshot_input_repository(root):
    from scripts.testing import integration_driver
    (root / "docker").mkdir(parents=True)
    (root / "config").mkdir(parents=True)
    docker_bytes = (REPO / integration_driver.DOCKERFILE).read_bytes()
    lock_bytes = (REPO / integration_driver.LOCK_PATH).read_bytes()
    (root / integration_driver.DOCKERFILE).write_bytes(docker_bytes)
    (root / integration_driver.LOCK_PATH).write_bytes(lock_bytes)
    subprocess.run(["git", "init", "-q", str(root)], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.email",
                    "slice3@example.invalid"], check=True)
    subprocess.run(["git", "-C", str(root), "config", "user.name",
                    "Slice 3 fixture"], check=True)
    subprocess.run(["git", "-C", str(root), "add", "."], check=True)
    subprocess.run(["git", "-C", str(root), "commit", "-qm", "fixture"],
                   check=True)
    return docker_bytes, lock_bytes


@pytest.mark.parametrize("attack", ["root", "ancestor"])
def test_real_capture_authority_rejects_post_return_republication(
        tmp_path, attack):
    from scripts.testing import integration_driver
    live = tmp_path / "live"
    docker_bytes, lock_bytes = _minimal_snapshot_input_repository(live)
    destination = tmp_path / "workspaces" / "run"
    capture = provenance.capture_repository_snapshot(live, destination)
    quarantine_path = tmp_path / "quarantine"; quarantine_path.mkdir()
    quarantine = provenance.open_directory_authority(
        quarantine_path, provenance.owned_directory_binding(quarantine_path))
    try:
        if attack == "root":
            hidden = destination.with_name("run-original")
            destination.rename(hidden)
            destination.mkdir()
            (destination / "replacement-sentinel").write_text("preserve\n")
        else:
            parent = destination.parent
            hidden_parent = parent.with_name("workspaces-original")
            parent.rename(hidden_parent)
            parent.mkdir()
            (hidden_parent / destination.name).rename(destination)
            (parent / "replacement-ancestor-sentinel").write_text(
                "preserve\n")
        with pytest.raises(provenance.ProvenanceError,
                           match="public binding changed"):
            integration_driver._read_snapshot_inputs(
                capture.authority, capture.records)
        with pytest.raises(provenance.ProvenanceError,
                           match="public binding changed"):
            provenance.remove_directory_authority(
                capture.authority, quarantine=quarantine)
        if attack == "root":
            assert (destination / "replacement-sentinel").read_text() == "preserve\n"
            exact = hidden
        else:
            assert (destination.parent / "replacement-ancestor-sentinel").read_text() == "preserve\n"
            exact = destination
        assert (exact / integration_driver.DOCKERFILE).read_bytes() == docker_bytes
        assert (exact / integration_driver.LOCK_PATH).read_bytes() == lock_bytes
    finally:
        capture.authority.close(); quarantine.close()


@pytest.mark.parametrize("live_kind", ["mutated", "symlink", "fifo"])
def test_snapshot_input_reader_ignores_later_live_input_replacement(
        tmp_path, live_kind):
    if live_kind == "fifo" and not hasattr(os, "mkfifo"):
        pytest.skip("requires FIFO support")
    from scripts.testing import integration_driver
    live = tmp_path / "live"
    docker_bytes, lock_bytes = _minimal_snapshot_input_repository(live)
    snapshot = tmp_path / "snapshot"
    capture = provenance.capture_repository_snapshot(live, snapshot)
    live_docker = live / integration_driver.DOCKERFILE
    live_lock = live / integration_driver.LOCK_PATH
    if live_kind == "mutated":
        live_docker.write_text("changed live dockerfile\n")
        live_lock.write_text("{}\n")
    elif live_kind == "symlink":
        outside = tmp_path / "outside"
        outside.write_text("outside\n")
        live_docker.unlink(); live_docker.symlink_to(outside)
        live_lock.unlink(); live_lock.symlink_to(outside)
    else:
        live_docker.unlink(); os.mkfifo(live_docker)
        live_lock.unlink(); os.mkfifo(live_lock)
    try:
        observed_docker, observed_lock, observed = (
            integration_driver._read_snapshot_inputs(
                capture.authority, capture.records))
    finally:
        capture.authority.close()
    assert observed_docker == docker_bytes
    assert observed_lock == lock_bytes
    assert observed == ip.load_lock_bytes(lock_bytes)


def test_retained_manifest_neutralization_never_modifies_raced_replacement(
        tmp_path, monkeypatch):
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, tmp_path)
    assert rc == 0 and manifest_path is not None
    root = manifest_path.parent
    manifest, _ = ip.load_verified_manifest(manifest_path)
    binding = provenance.owned_directory_binding(root)
    authority = provenance.open_directory_authority(root, binding)
    lease = None
    try:
        lease = provenance.retain_owned_regular_file(
            authority, "manifest.json", max_bytes=ip.MANIFEST_MAX_BYTES,
            writable=True)
        retained_public = tmp_path / "retained-public.json"
        (root / "manifest.json").rename(retained_public)
        replacement = root / "manifest.json"
        replacement_bytes = provenance.canonical_json(manifest).encode()
        replacement.write_bytes(replacement_bytes)
        with pytest.raises(provenance.ProvenanceError,
                           match="public integration manifest binding changed"):
            ip.verify_final_publication(authority, lease, manifest)
        failed = copy.deepcopy(manifest)
        failed["status"] = "failed"
        failed["run"]["status"] = "failed"
        failed["run"]["failure_codes"] = ["publication-invalidated"]
        ip.overwrite_retained_manifest_failed(lease, failed)
        assert replacement.read_bytes() == replacement_bytes
        assert json.loads(replacement.read_text())["status"] == "passed"
        with pytest.raises(provenance.ProvenanceError,
                           match="binding mismatched"):
            ip.load_verified_manifest(replacement)
        retained = json.loads(provenance.read_retained_regular_bytes(lease))
        assert retained["status"] == "failed"
        assert retained["run"]["failure_codes"] == [
            "publication-invalidated"]
    finally:
        if lease is not None:
            lease.close()
        authority.close()


@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
@pytest.mark.parametrize("handler_mode", ["return", "ignore", "default", "raise"])
def test_final_owner_covers_child_handler_restoration_slots(
        tmp_path, monkeypatch, sig, handler_mode):
    seed = tmp_path / "seed"; seed.mkdir()
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, seed)
    assert rc == 0 and manifest_path is not None
    candidate, _ = ip.load_verified_manifest(manifest_path)
    candidate_path = tmp_path / "candidate.json"
    candidate_path.write_text(provenance.canonical_json(candidate))
    tier = manifest_path.parent
    tier_binding = provenance.owned_directory_binding(tier)
    manifest_path.unlink()
    (tier / ip.MANIFEST_BINDING_NAME).unlink()

    child = tmp_path / "restoring_child.py"
    child.write_text(r'''
import json, os, signal, sys, time
from pathlib import Path
from scripts.testing import provenance as p
from scripts.testing import integration_driver as d
status_path = Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
status_binding = os.environ["PRIME_CLAW_INTEGRATION_STATUS_BINDING"]
tier = Path(sys.argv[1]); tier_binding = sys.argv[2]
candidate_path = Path(sys.argv[3]); mode = sys.argv[4]
target = signal.Signals(int(sys.argv[5])); nonce = "d" * 64
def returns(signum, frame): pass
def raises(signum, frame): raise RuntimeError("injected prior handler")
prior = {"return": returns, "ignore": signal.SIG_IGN,
         "default": signal.SIG_DFL, "raise": raises}[mode]
signal.signal(target, prior)
owner = d.LifecycleSignals(); owner.enable()
status = p.open_directory_authority(status_path, status_binding)
p.write_owned_regular_bytes(status, "status.json", p.canonical_json({
    "tier_dir": str(tier), "binding": tier_binding, "nonce": nonce,
}).encode(), mode=0o600)
deadline = time.monotonic() + 5
while True:
    try:
        ack = json.loads(p.read_owned_regular_text(
            status, "ack.json", max_bytes=1024))
    except FileNotFoundError:
        if time.monotonic() >= deadline: raise
        time.sleep(0.01); continue
    if ack == {"nonce": nonce}: break
    raise RuntimeError("bad acknowledgement")
p.write_sanitized_json(status, "candidate.json",
                       json.loads(candidate_path.read_text()))
status.close()
owner.freeze()
owner.retain_to_process_exit()
os.kill(os.getpid(), target)
raise AssertionError("owned terminal handler returned")
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    result = subprocess.run([
        sys.executable, str(REPO / "scripts/testing/integration_supervisor.py"),
        sys.executable, str(child), str(tier), tier_binding,
        str(candidate_path), handler_mode, str(int(sig)),
    ], cwd=REPO, env=env, text=True, capture_output=True, timeout=10)
    assert result.returncode == 128 + int(sig), result.stderr
    final, _ = ip.load_verified_manifest(tier / "manifest.json")
    assert final["status"] == "failed"
    assert final["run"]["failure_codes"] == [
        "supervisor-terminal-failed"]
    assert "integration driver: OK" not in result.stdout
    assert "PASS" not in result.stdout


@pytest.mark.parametrize("namespace_kind", ["permission", "type", "alias"])
def test_exact_manifest_neutralization_ignores_broken_publication_namespace(
        tmp_path, monkeypatch, namespace_kind):
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, tmp_path)
    assert rc == 0 and manifest_path is not None
    root = manifest_path.parent
    authority = provenance.open_directory_authority(
        root, provenance.owned_directory_binding(root))
    lease = provenance.retain_owned_regular_file(
        authority, "manifest.json", max_bytes=ip.MANIFEST_MAX_BYTES,
        writable=True)
    publication = root / ".publication"
    saved = root / "publication-saved"
    try:
        if namespace_kind == "permission":
            publication.chmod(0o755)
        elif namespace_kind == "type":
            publication.rename(saved)
            publication.write_text("replacement-file\n")
        else:
            publication.rename(saved)
            publication.symlink_to(saved, target_is_directory=True)
        ip.neutralize_retained_manifest(
            lease, reason="publication-invalidated")
        exact = json.loads(provenance.read_retained_regular_bytes(lease))
        assert exact == {"invalidated": True,
                         "reason": "publication-invalidated",
                         "status": "failed"}
        if namespace_kind == "permission":
            assert stat.S_IMODE(publication.stat().st_mode) == 0o755
        elif namespace_kind == "type":
            assert publication.read_text() == "replacement-file\n"
        else:
            assert publication.is_symlink()
    finally:
        lease.close(); authority.close()


def test_initial_final_publication_preexchange_failure_never_exposes_green(
        tmp_path, monkeypatch):
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, tmp_path)
    assert rc == 0 and manifest_path is not None
    candidate, _ = ip.load_verified_manifest(manifest_path)
    root = manifest_path.parent
    manifest_path.unlink()
    (root / ip.MANIFEST_BINDING_NAME).unlink()
    authority = provenance.open_directory_authority(
        root, provenance.owned_directory_binding(root))
    real_exchange = provenance._rename_noreplace
    def fail_manifest(source_fd, source, target_fd, target):
        if target == "manifest.json":
            raise provenance.ProvenanceError("injected pre-exchange failure")
        return real_exchange(source_fd, source, target_fd, target)
    try:
        monkeypatch.setattr(provenance, "_rename_noreplace", fail_manifest)
        with pytest.raises(provenance.ProvenanceError,
                           match="pre-exchange"):
            ip.publish_final_manifest(authority, candidate)
    finally:
        authority.close()
    assert not manifest_path.exists()


def test_final_owner_closes_candidate_on_child_restoration_exception(
        tmp_path, monkeypatch):
    seed = tmp_path / "seed"; seed.mkdir()
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, seed)
    assert rc == 0 and manifest_path is not None
    candidate, _ = ip.load_verified_manifest(manifest_path)
    candidate_path = tmp_path / "candidate.json"
    candidate_path.write_text(provenance.canonical_json(candidate))
    tier = manifest_path.parent
    tier_binding = provenance.owned_directory_binding(tier)
    manifest_path.unlink()
    (tier / ip.MANIFEST_BINDING_NAME).unlink()
    child = tmp_path / "restoration_error_child.py"
    child.write_text(r'''
import json, os, sys, time
from pathlib import Path
from scripts.testing import provenance as p
status_path = Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
status = p.open_directory_authority(
    status_path, os.environ["PRIME_CLAW_INTEGRATION_STATUS_BINDING"])
nonce = "e" * 64
p.write_owned_regular_bytes(status, "status.json", p.canonical_json({
    "tier_dir": sys.argv[1], "binding": sys.argv[2], "nonce": nonce,
}).encode(), mode=0o600)
deadline = time.monotonic() + 5
while True:
    try:
        ack = json.loads(p.read_owned_regular_text(
            status, "ack.json", max_bytes=1024))
    except FileNotFoundError:
        if time.monotonic() >= deadline: raise
        time.sleep(0.01); continue
    if ack == {"nonce": nonce}: break
p.write_sanitized_json(status, "candidate.json",
                       json.loads(Path(sys.argv[3]).read_text()))
raise RuntimeError("injected child restoration exception")
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    result = subprocess.run([
        sys.executable, str(REPO / "scripts/testing/integration_supervisor.py"),
        sys.executable, str(child), str(tier), tier_binding,
        str(candidate_path),
    ], cwd=REPO, env=env, text=True, capture_output=True, timeout=10)
    assert result.returncode != 0
    final, _ = ip.load_verified_manifest(manifest_path)
    assert final["status"] == "failed"
    assert final["run"]["failure_codes"] == [
        "supervisor-terminal-failed"]
    assert "PASS" not in result.stdout
    assert "integration driver: OK" not in result.stdout


@pytest.mark.parametrize("candidate_kind", ["fifo", "symlink", "oversized"])
def test_public_finalizer_rejects_unsafe_candidate_with_deadline(
        tmp_path, monkeypatch, candidate_kind):
    seed = tmp_path / "seed"; seed.mkdir()
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, seed)
    assert rc == 0 and manifest_path is not None
    candidate, _ = ip.load_verified_manifest(manifest_path)
    candidate_source = tmp_path / "candidate-source.json"
    candidate_source.write_text(provenance.canonical_json(candidate))
    tier = manifest_path.parent
    tier_binding = provenance.owned_directory_binding(tier)
    manifest_path.unlink()
    (tier / ip.MANIFEST_BINDING_NAME).unlink()
    child = tmp_path / "unsafe_candidate_child.py"
    child.write_text(r'''
import json, os, sys, time
from pathlib import Path
from scripts.testing import integration_provenance as ip
from scripts.testing import provenance as p
root = Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
status = p.open_directory_authority(
    root, os.environ["PRIME_CLAW_INTEGRATION_STATUS_BINDING"])
nonce = "f" * 64
p.write_owned_regular_bytes(status, "status.json", p.canonical_json({
    "tier_dir": sys.argv[1], "binding": sys.argv[2], "nonce": nonce,
}).encode(), mode=0o600)
deadline = time.monotonic() + 5
while True:
    try:
        if json.loads(p.read_owned_regular_text(
                status, "ack.json", max_bytes=1024)) == {"nonce": nonce}:
            break
    except FileNotFoundError:
        if time.monotonic() >= deadline: raise
        time.sleep(0.01)
kind = sys.argv[4]; leaf = root / "candidate.json"
if kind == "fifo":
    os.mkfifo(leaf)
elif kind == "symlink":
    target = root / "candidate-target.json"
    target.write_text(Path(sys.argv[3]).read_text())
    leaf.symlink_to(target)
else:
    p.write_owned_regular_bytes(
        status, "candidate.json", b"x" * (ip.MANIFEST_MAX_BYTES + 1),
        mode=0o600)
status.close()
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    result = subprocess.run([
        sys.executable, str(REPO / "scripts/testing/integration_supervisor.py"),
        sys.executable, str(child), str(tier), tier_binding,
        str(candidate_source), candidate_kind,
    ], cwd=REPO, env=env, text=True, capture_output=True, timeout=10)
    assert result.returncode != 0
    assert not manifest_path.exists()
    assert "PASS" not in result.stdout
    assert "integration driver: OK" not in result.stdout


@pytest.mark.parametrize("evidence_kind", ["fifo", "oversized"])
def test_public_finalizer_rejects_unsafe_body_reread_with_deadline(
        tmp_path, monkeypatch, evidence_kind):
    seed = tmp_path / "seed"; seed.mkdir()
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, seed)
    assert rc == 0 and manifest_path is not None
    candidate, _ = ip.load_verified_manifest(manifest_path)
    candidate_source = tmp_path / "candidate-source.json"
    candidate_source.write_text(provenance.canonical_json(candidate))
    tier = manifest_path.parent
    tier_binding = provenance.owned_directory_binding(tier)
    manifest_path.unlink()
    (tier / ip.MANIFEST_BINDING_NAME).unlink()
    body = tier / "body.json"
    body.unlink()
    if evidence_kind == "fifo":
        os.mkfifo(body)
    else:
        body.write_bytes(b"x" * (provenance.MAX_EVIDENCE_BYTES + 1))
    child = tmp_path / "candidate_child.py"
    child.write_text(r'''
import json, os, sys, time
from pathlib import Path
from scripts.testing import provenance as p
root = Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
status = p.open_directory_authority(
    root, os.environ["PRIME_CLAW_INTEGRATION_STATUS_BINDING"])
nonce = "9" * 64
p.write_owned_regular_bytes(status, "status.json", p.canonical_json({
    "tier_dir": sys.argv[1], "binding": sys.argv[2], "nonce": nonce,
}).encode(), mode=0o600)
deadline = time.monotonic() + 5
while True:
    try:
        if json.loads(p.read_owned_regular_text(
                status, "ack.json", max_bytes=1024)) == {"nonce": nonce}:
            break
    except FileNotFoundError:
        if time.monotonic() >= deadline: raise
        time.sleep(0.01)
p.write_sanitized_json(status, "candidate.json",
                       json.loads(Path(sys.argv[3]).read_text()))
status.close()
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    result = subprocess.run([
        sys.executable, str(REPO / "scripts/testing/integration_supervisor.py"),
        sys.executable, str(child), str(tier), tier_binding,
        str(candidate_source),
    ], cwd=REPO, env=env, text=True, capture_output=True, timeout=10)
    assert result.returncode != 0
    assert not manifest_path.exists()
    assert "PASS" not in result.stdout



def test_capture_transfer_rejects_same_parent_leaf_republished_under_new_ancestor(
        tmp_path, monkeypatch):
    live = tmp_path / "live-transfer"
    _minimal_snapshot_input_repository(live)
    public = tmp_path / "public"
    destination = public / "workspaces" / "run"
    original_child = provenance.create_directory_authority_child
    fired = False
    def republish(parent, name, *, mode=0o700):
        nonlocal fired
        if not fired and parent.path == destination.parent:
            fired = True
            hidden = tmp_path / "public-original"
            public.rename(hidden)
            public.mkdir()
            (hidden / "workspaces").rename(public / "workspaces")
        return original_child(parent, name, mode=mode)
    monkeypatch.setattr(
        provenance, "create_directory_authority_child", republish)
    with pytest.raises(provenance.ProvenanceError,
                       match="public binding changed"):
        provenance.capture_repository_snapshot(live, destination)
    assert fired
    assert (public / "workspaces").is_dir()
    assert not destination.exists()


@pytest.mark.parametrize(
    "relative", ["docker/test-integration.Dockerfile",
                 "config/test-artifacts.lock.json"])
def test_capture_bound_inputs_reject_snapshot_regular_inode_replacement(
        tmp_path, relative):
    from scripts.testing import integration_driver
    live = tmp_path / "live-captured-file"
    _minimal_snapshot_input_repository(live)
    destination = tmp_path / "captured-file-snapshot"
    capture = provenance.capture_repository_snapshot(live, destination)
    leaf = destination / relative
    retained = tmp_path / (leaf.name + "-captured-original")
    leaf.rename(retained)
    leaf.write_bytes(b"replacement-regular-file\n")
    try:
        with pytest.raises(provenance.ProvenanceError,
                           match="captured repository content changed"):
            integration_driver._read_snapshot_inputs(
                capture.authority, capture.records)
        assert retained.read_bytes() != leaf.read_bytes()
    finally:
        capture.authority.close()


@pytest.mark.parametrize(
    "relative", ["docker/test-integration.Dockerfile",
                 "config/test-artifacts.lock.json"])
def test_capture_bound_input_read_rejects_transient_replace_and_restore(
        tmp_path, monkeypatch, relative):
    from scripts.testing import integration_driver
    live = tmp_path / "live-transient-captured-file"
    _minimal_snapshot_input_repository(live)
    destination = tmp_path / "transient-captured-file-snapshot"
    capture = provenance.capture_repository_snapshot(live, destination)
    leaf = destination / relative
    original_bytes = leaf.read_bytes()
    retained_path = tmp_path / (leaf.name + "-exact-original")
    original_retain = provenance.retain_owned_regular_file
    fired = False
    def transient_retain(root, requested, **kwargs):
        nonlocal fired
        if Path(requested).as_posix() != relative or fired:
            return original_retain(root, requested, **kwargs)
        fired = True
        leaf.rename(retained_path)
        leaf.write_bytes(b"FROM scratch\n" if relative.endswith("Dockerfile")
                         else b'{"transient":true}\n')
        try:
            return original_retain(root, requested, **kwargs)
        finally:
            leaf.unlink()
            retained_path.rename(leaf)
    monkeypatch.setattr(
        integration_driver.p, "retain_owned_regular_file", transient_retain)
    try:
        with pytest.raises(provenance.ProvenanceError,
                           match="captured repository binding changed"):
            integration_driver._read_snapshot_inputs(
                capture.authority, capture.records)
        assert fired
        assert leaf.read_bytes() == original_bytes
    finally:
        capture.close()


@pytest.mark.parametrize(
    "relative", ["docker/test-integration.Dockerfile",
                 "config/test-artifacts.lock.json"])
def test_capture_bound_inputs_reject_byte_identical_inode_replacement(
        tmp_path, relative):
    from scripts.testing import integration_driver
    live = tmp_path / "live-identical-captured-file"
    _minimal_snapshot_input_repository(live)
    destination = tmp_path / "identical-captured-file-snapshot"
    capture = provenance.capture_repository_snapshot(live, destination)
    leaf = destination / relative
    payload = leaf.read_bytes(); mode = stat.S_IMODE(leaf.stat().st_mode)
    retained_path = tmp_path / (leaf.name + "-old-inode")
    leaf.rename(retained_path)
    leaf.write_bytes(payload); leaf.chmod(mode)
    try:
        with pytest.raises(provenance.ProvenanceError,
                           match="captured repository binding changed"):
            integration_driver._read_snapshot_inputs(
                capture.authority, capture.records)
        assert leaf.read_bytes() == retained_path.read_bytes()
        assert os.lstat(leaf).st_ino != os.lstat(retained_path).st_ino
    finally:
        capture.close()


@pytest.mark.parametrize(
    "relative,size", [
        ("image.iid", ip.CONTROL_MAX_BYTES + 1),
        ("container.cid", ip.CONTROL_MAX_BYTES + 1),
        ("body.json", ip.BODY_MAX_BYTES + 1),
    ])
def test_integration_inventory_reapplies_path_specific_read_budget(
        tmp_path, monkeypatch, relative, size):
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, tmp_path)
    assert rc == 0 and manifest_path is not None
    root = manifest_path.parent
    leaf = root / relative
    leaf.write_bytes(b"x" * size)
    authority = provenance.open_directory_authority(
        root, provenance.owned_directory_binding(root))
    try:
        with pytest.raises(provenance.ProvenanceError, match="too large"):
            ip.evidence_inventory(authority)
    finally:
        authority.close()


def test_final_owner_revalidates_evidence_after_terminal_unmask(
        tmp_path, monkeypatch):
    seed = tmp_path / "seed-late-evidence"; seed.mkdir()
    rc, manifest_path, _calls, _state = _recording_driver_run(
        monkeypatch, seed)
    assert rc == 0 and manifest_path is not None
    candidate, _ = ip.load_verified_manifest(manifest_path)
    candidate_path = tmp_path / "late-candidate.json"
    candidate_path.write_text(provenance.canonical_json(candidate))
    tier = manifest_path.parent
    tier_binding = provenance.owned_directory_binding(tier)
    manifest_path.unlink()
    (tier / ip.MANIFEST_BINDING_NAME).unlink()
    child = tmp_path / "late_candidate_child.py"
    child.write_text(r'''
import json, os, sys, time
from pathlib import Path
from scripts.testing import provenance as p
root = Path(os.environ["PRIME_CLAW_INTEGRATION_STATUS_ROOT"])
status = p.open_directory_authority(
    root, os.environ["PRIME_CLAW_INTEGRATION_STATUS_BINDING"])
nonce = "7" * 64
p.write_owned_regular_bytes(status, "status.json", p.canonical_json({
    "tier_dir": sys.argv[1], "binding": sys.argv[2], "nonce": nonce,
}).encode(), mode=0o600)
deadline = time.monotonic() + 5
while True:
    try:
        if json.loads(p.read_owned_regular_text(
                status, "ack.json", max_bytes=1024)) == {"nonce": nonce}:
            break
    except FileNotFoundError:
        if time.monotonic() >= deadline: raise
        time.sleep(0.01)
p.write_sanitized_json(status, "candidate.json",
                       json.loads(Path(sys.argv[3]).read_text()))
status.close()
''')
    probe = tmp_path / "late_evidence_probe.py"
    probe.write_text(r'''
import os, signal, sys
from pathlib import Path
from scripts.testing import integration_supervisor as s
tier = Path(sys.argv[1]); child = sys.argv[2]
original = signal.pthread_sigmask; mutated = False
def masked(how, mask):
    global mutated
    if (not mutated and how == signal.SIG_SETMASK
            and (tier / "manifest.json").exists()):
        mutated = True
        with (tier / "body.json").open("ab") as stream:
            stream.write(b"late-mutation")
            stream.flush(); os.fsync(stream.fileno())
    return original(how, mask)
s.signal.pthread_sigmask = masked
s.supervise(sys.executable, [child, *sys.argv[3:]], final_owner=True)
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    result = subprocess.run([
        sys.executable, str(probe), str(tier), str(child),
        str(tier), tier_binding, str(candidate_path),
    ], cwd=REPO, env=env, text=True, capture_output=True, timeout=10)
    assert result.returncode != 0, result.stdout + result.stderr
    raw = json.loads(manifest_path.read_text())
    assert raw["status"] == "failed"
    with pytest.raises(provenance.ProvenanceError):
        ip.load_verified_manifest(manifest_path)
    assert "PASS" not in result.stdout


@pytest.mark.parametrize("sig", [signal.SIGTERM, signal.SIGINT, signal.SIGHUP])
@pytest.mark.parametrize("handler_mode", ["return", "ignore", "default", "raise"])
def test_supervised_driver_retains_owned_handler_through_process_exit(
        tmp_path, sig, handler_mode):
    script = tmp_path / "supervised_driver_exit.py"
    marker = tmp_path / "ready"
    script.write_text(r'''
import os, signal, sys, time
from pathlib import Path
from types import SimpleNamespace
from scripts.testing import integration_driver as d
target = signal.Signals(int(sys.argv[1])); mode = sys.argv[2]
def returns(signum, frame): pass
def raises(signum, frame): raise RuntimeError("prior handler must not run")
prior = {"return": returns, "ignore": signal.SIG_IGN,
         "default": signal.SIG_DFL, "raise": raises}[mode]
signal.signal(target, prior)
os.environ["PRIME_CLAW_INTEGRATION_INNER"] = "1"
d._run_owned = lambda args, owner: 0
rc = d.run(SimpleNamespace(dry_run=False))
Path(sys.argv[3]).write_text(str(rc))
time.sleep(5)
raise SystemExit(rc)
''')
    env = dict(os.environ); env["PYTHONPATH"] = str(REPO)
    process = subprocess.Popen(
        [sys.executable, str(script), str(int(sig)), handler_mode, str(marker)],
        cwd=REPO, env=env, text=True, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE)
    try:
        deadline = __import__("time").monotonic() + 5
        while True:
            try:
                if marker.read_text() == "0":
                    break
            except FileNotFoundError:
                pass
            if process.poll() is not None:
                stdout, stderr = process.communicate()
                pytest.fail(f"child exited before terminal handoff: {stdout} {stderr}")
            if __import__("time").monotonic() >= deadline:
                pytest.fail("supervised driver handoff timed out")
            __import__("time").sleep(0.01)
        os.kill(process.pid, sig)
        stdout, stderr = process.communicate(timeout=5)
    finally:
        if process.poll() is None:
            process.kill(); process.wait()
    assert process.returncode == 128 + int(sig), stdout + stderr
    assert marker.read_text() == "0"
