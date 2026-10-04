from __future__ import annotations

import copy
import json
import os
from pathlib import Path
import signal
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
    safe = ip.safe_container_boundary(raw, expected_id=CID1, image_id=IMAGE1,
        run_id=RUN1, name=name, repository_source=snapshot, result_source=share)
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
            ip.safe_container_boundary(changed, expected_id=CID1, image_id=IMAGE1,
                run_id=RUN1, name=name, repository_source=snapshot, result_source=share)


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
    prep_binding = provenance.owned_directory_binding(prep)
    state = integration_driver._not_needed()
    monkeypatch.setattr(integration_driver, "_run", lambda argv, **kwargs: _result(rc=0))
    lock = ip.load_lock(REPO / "config/test-artifacts.lock.json")
    with pytest.raises(integration_driver.DriverError):
        integration_driver._prepare_context(
            context, tier, prep, prep_binding, RUN1, "linux/arm64", lock,
            str(tmp_path / "missing-mirror"), state)
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
    assert integration_driver._recover_image(tier, RUN1, tag) == ("owned", IMAGE1)
    assert integration_driver._recover_container(tier, RUN1, name, IMAGE1) == (
        "owned", CID1, IMAGE1)
    image_row["Config"]["Labels"]["org.prime-claw.test.run"] = RUN2
    assert integration_driver._recover_image(tier, RUN1, tag) == ("unknown", "")
    image_row["Config"]["Labels"]["org.prime-claw.test.run"] = RUN1
    image_row["RepoDigests"] = ["example.invalid/other@" + IMAGE2]
    assert integration_driver._recover_image(tier, RUN1, tag) == ("unknown", "")
    image_row["RepoDigests"] = []
    image_row["RepoTags"] = [tag, "prime-claw-test-integration:extra"]
    assert integration_driver._recover_image(tier, RUN1, tag) == ("unknown", "")
    image_row["RepoTags"] = [tag]
    container_row["Image"] = IMAGE2
    assert integration_driver._recover_container(tier, RUN1, name, IMAGE1)[0] == "unknown"
    (tier / "image.iid").write_text("malformed\n")
    before = len(calls)
    assert integration_driver._recover_image(tier, RUN1, tag) == ("unknown", "")
    assert len(calls) == before


def test_exact_name_and_tag_recovery_classifies_only_allowlisted_absence(tmp_path, monkeypatch):
    from scripts.testing import integration_driver
    tier = tmp_path / "tier"; tier.mkdir()
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
    assert integration_driver._recover_image(tier, RUN1, tag) == ("absent", "")
    assert integration_driver._recover_container(tier, RUN1, name, "")[0] == "absent"
    monkeypatch.setattr(integration_driver, "_run", lambda argv, **kwargs:
        _result(rc=1, stdout="[]\n", stderr="daemon unavailable\n"))
    assert integration_driver._recover_image(tier, RUN1, tag)[0] == "unknown"
    assert integration_driver._recover_container(tier, RUN1, name, "")[0] == "unknown"


def _recording_driver_run(monkeypatch, tmp_path, *, container_remove_rc=0,
                          image_remove_rc=0, partial=None,
                          directory_remove_fail=None,
                          preparation_receipt_fail=False,
                          real_run_wrapper=False):
    from scripts.testing import integration_driver
    lock = ip.load_lock(REPO / "config/test-artifacts.lock.json")
    repository = _passed(RUN1, IMAGE1, CID1, "a")["repository"]
    state = {"share": None, "run_id": None, "image": None,
             "container": None, "tag": None}
    calls = []
    original_remove = integration_driver.p.remove_owned_directory
    def remove_directory(path, binding, **kwargs):
        candidate = Path(path)
        if (directory_remove_fail == "snapshot" and candidate.parent.name == ".workspaces"):
            raise provenance.ProvenanceError("injected snapshot removal refusal")
        if directory_remove_fail == candidate.name:
            raise provenance.ProvenanceError("injected directory removal refusal")
        return original_remove(path, binding, **kwargs)
    monkeypatch.setattr(integration_driver.p, "remove_owned_directory", remove_directory)
    original_write = integration_driver.p.write_sanitized_json
    def write_json(owned, relative, value):
        if preparation_receipt_fail and str(relative) == "preparation.json":
            raise provenance.ProvenanceError("injected preparation receipt failure")
        return original_write(owned, relative, value)
    monkeypatch.setattr(integration_driver.p, "write_sanitized_json", write_json)
    monkeypatch.setattr(integration_driver, "_platform", lambda: "linux/arm64")
    monkeypatch.setattr(integration_driver.p, "repository_identity", lambda repo: repository)
    def stage(repo, destination):
        Path(destination).parent.mkdir(parents=True, exist_ok=True)
        Path(destination).mkdir(mode=0o700)
        (Path(destination) / "captured.txt").write_text("snapshot\n")
        return repository
    monkeypatch.setattr(integration_driver.p, "stage_repository_snapshot", stage)
    def prepare(context, tier, prep, prep_binding, run_id, platform, lock_value,
                mirror, teardown_state):
        teardown_state.clear(); teardown_state.update(
            integration_driver._remove_owned(prep, prep_binding, tier))
        return "2" * 64, "1" * 64
    monkeypatch.setattr(integration_driver, "_prepare_context", prepare)
    def build(context, run_id, platform, lock_value, input_hash, tag,
              dockerfile_hash, rebuild):
        (context.parent / "image.iid").write_text(IMAGE1 + "\n")
        image = _passed(run_id, IMAGE1, CID1, "a")["image"]
        image["informational_tag"] = tag; image["repo_tags"] = [tag]
        image["base_image_digest"] = lock_value["base_image"]["platforms"][platform]
        state["run_id"] = run_id; state["image"] = image; state["tag"] = tag
        if partial == "build":
            raise integration_driver.DriverError("injected post-build failure")
        return image, IMAGE1
    monkeypatch.setattr(integration_driver, "_build_image", build)
    def create(tier, snapshot, share, run_id, image_id, name):
        (tier / "container.cid").write_text(CID1 + "\n")
        container = _passed(run_id, image_id, CID1, "a")["container"]
        state["share"] = share; state["container"] = container
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
                       "Config": {"Labels": {"org.prime-claw.test.contract": ip.CONTRACT,
                                              "org.prime-claw.test.run": state["run_id"]}}}
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
    results = tmp_path / "results"
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
    assert integration_supervisor._close_evidence((root, binding), True) is True
    manifest, _ = ip.load_verified_manifest(manifest_path)
    assert manifest["status"] == "failed"
    assert manifest["run"]["failure_codes"] == ["publication-invalidated"]
