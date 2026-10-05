#!/usr/bin/env python3
"""Strict provenance and boundary validators for the disposable integration tier."""
from __future__ import annotations

from datetime import datetime
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
from typing import Any

from scripts.testing import provenance as p

CONTRACT = "integration-v1"
BODY_CONTRACT = "integration-body-v1"
SUPPORTED_PLATFORMS = {"linux/amd64", "linux/arm64"}
_SHA = re.compile(r"^[0-9a-f]{64}$")
_CID = re.compile(r"^[0-9a-f]{64}$")
_IMAGE_ID = re.compile(r"^sha256:[0-9a-f]{64}$")
_RUN_ID = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[0-9]+-[0-9a-f]{8}$")
_VERSION4 = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$")
_UTC = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")


def _keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != expected:
        raise p.ProvenanceError(f"invalid {label} shape")
    return value


def _sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or not _SHA.fullmatch(value):
        raise p.ProvenanceError(f"invalid {label}")
    return value


def _utc(value: Any, label: str) -> datetime:
    if not isinstance(value, str) or not _UTC.fullmatch(value):
        raise p.ProvenanceError(f"invalid {label}")
    return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ")


def validate_lock(value: Any) -> dict[str, Any]:
    root = _keys(value, {"schema_version", "gbrain", "bun", "base_image"}, "artifact lock")
    if root["schema_version"] != 1:
        raise p.ProvenanceError("unsupported artifact lock schema")
    gbrain = _keys(root["gbrain"], {"origin", "commit", "tree", "archive_sha256", "package_version"}, "gbrain lock")
    if gbrain["origin"] != "https://github.com/garrytan/gbrain.git":
        raise p.ProvenanceError("unexpected gbrain origin")
    if not isinstance(gbrain["commit"], str) or not re.fullmatch(r"[0-9a-f]{40}", gbrain["commit"]):
        raise p.ProvenanceError("invalid gbrain commit")
    if not isinstance(gbrain["tree"], str) or not re.fullmatch(r"[0-9a-f]{40}", gbrain["tree"]):
        raise p.ProvenanceError("invalid gbrain tree")
    _sha(gbrain["archive_sha256"], "gbrain archive hash")
    if not _VERSION4.fullmatch(str(gbrain["package_version"])):
        raise p.ProvenanceError("invalid gbrain package version")
    bun = _keys(root["bun"], {"version", "platforms"}, "bun lock")
    if bun["version"] != "1.3.11" or not isinstance(bun["platforms"], dict) or set(bun["platforms"]) != SUPPORTED_PLATFORMS:
        raise p.ProvenanceError("invalid Bun lock")
    for platform, row in bun["platforms"].items():
        row = _keys(row, {"artifact", "archive_directory", "compile_target", "sha256"}, f"Bun {platform}")
        if not all(isinstance(row[key], str) and re.fullmatch(r"[A-Za-z0-9._-]+", row[key]) for key in ("artifact", "archive_directory", "compile_target")):
            raise p.ProvenanceError("invalid Bun artifact identity")
        _sha(row["sha256"], "Bun artifact hash")
    base = _keys(root["base_image"], {"reference", "index_digest", "platforms"}, "base image lock")
    if base["reference"] != "ubuntu:24.04" or not _IMAGE_ID.fullmatch(str(base["index_digest"])):
        raise p.ProvenanceError("invalid base image lock")
    if not isinstance(base["platforms"], dict) or set(base["platforms"]) != SUPPORTED_PLATFORMS:
        raise p.ProvenanceError("invalid base platform lock")
    for digest in base["platforms"].values():
        if not _IMAGE_ID.fullmatch(str(digest)):
            raise p.ProvenanceError("invalid base platform digest")
    return root


def load_lock(path: Path | str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise p.ProvenanceError("artifact lock is unreadable") from exc
    return validate_lock(value)


def validate_body(value: Any, lock: dict[str, Any], *, run_id: str,
                  platform: str, attestation: str) -> dict[str, Any]:
    body = _keys(value, {
        "schema_version", "contract", "run_id", "started_at", "finished_at",
        "attestation_sha256", "platform", "non_root", "uid",
        "repository_read_only", "external_tcp_refused",
        "environment_names_sha256", "artifact_lock_sha256", "base_image_digest",
        "gbrain", "bun",
        "fixtures", "postgresql",
    }, "integration body")
    if (body["schema_version"] != 1 or body["contract"] != BODY_CONTRACT
            or body["run_id"] != run_id or body["platform"] != platform
            or body["attestation_sha256"] != hashlib.sha256(attestation.encode()).hexdigest()
            or body["non_root"] is not True or not isinstance(body["uid"], int)
            or body["uid"] <= 0 or body["repository_read_only"] is not True
            or body["external_tcp_refused"] is not True):
        raise p.ProvenanceError("integration body boundary failed")
    if _utc(body["finished_at"], "body.finished_at") < _utc(body["started_at"], "body.started_at"):
        raise p.ProvenanceError("integration body timestamps are reversed")
    for key in ("environment_names_sha256", "artifact_lock_sha256"):
        _sha(body[key], f"body.{key}")
    expected_lock_sha = hashlib.sha256(p.canonical_json(lock).encode()).hexdigest()
    if body["artifact_lock_sha256"] != expected_lock_sha:
        raise p.ProvenanceError("body artifact lock hash mismatched")
    if body["base_image_digest"] != lock["base_image"]["platforms"][platform]:
        raise p.ProvenanceError("body base-image digest mismatched")
    g = _keys(body["gbrain"], {
        "origin", "commit", "tree", "archive_sha256", "package_version",
        "executable_sha256", "executable_version",
    }, "body gbrain")
    if {key: g[key] for key in ("origin", "commit", "tree", "archive_sha256", "package_version")} != lock["gbrain"]:
        raise p.ProvenanceError("body gbrain lineage mismatched")
    if g["executable_version"] != lock["gbrain"]["package_version"]:
        raise p.ProvenanceError("body gbrain version mismatched")
    _sha(g["executable_sha256"], "gbrain executable hash")
    bun = _keys(body["bun"], {"version", "artifact_sha256"}, "body Bun")
    if bun != {"version": lock["bun"]["version"], "artifact_sha256": lock["bun"]["platforms"][platform]["sha256"]}:
        raise p.ProvenanceError("body Bun identity mismatched")
    fixtures = _keys(body["fixtures"], {
        "corpus_manifest_sha256", "whole_source_inventory_sha256", "database_id",
        "pgdata_id", "gbrain_home_id", "bare_remote_id", "worktree_commit",
        "bare_refs_sha256", "roundtrip_inventory_sha256",
    }, "body fixtures")
    for key, item in fixtures.items():
        if key == "worktree_commit":
            if not isinstance(item, str) or not re.fullmatch(r"[0-9a-f]{40}", item):
                raise p.ProvenanceError("invalid fixture worktree commit")
        else:
            _sha(item, f"fixture.{key}")
    if len({fixtures[key] for key in ("database_id", "pgdata_id", "gbrain_home_id", "bare_remote_id")}) != 4:
        raise p.ProvenanceError("fixture ownership identities overlap")
    pg = _keys(body["postgresql"], {
        "postgres_version", "postgres_version_num", "pgvector_version",
        "extension_inventory_sha256", "migration_version",
        "schema_inventory_sha256", "schema_table_count",
        "migration_inventory_sha256", "config_sha256",
    }, "body PostgreSQL")
    if (not isinstance(pg["postgres_version"], str)
            or not re.fullmatch(r"16(?:\.[0-9]+)+(?: \([^)]*\))?", pg["postgres_version"])
            or not isinstance(pg["postgres_version_num"], str)
            or not re.fullmatch(r"16[0-9]{4}", pg["postgres_version_num"])
            or not isinstance(pg["pgvector_version"], str)
            or not re.fullmatch(r"[0-9]+\.[0-9]+(?:\.[0-9]+)?", pg["pgvector_version"])
            or pg["migration_version"] != "149"
            or not isinstance(pg["schema_table_count"], int)
            or pg["schema_table_count"] < 10):
        raise p.ProvenanceError("PostgreSQL/pgvector readiness is invalid")
    for key in ("extension_inventory_sha256", "schema_inventory_sha256", "migration_inventory_sha256", "config_sha256"):
        _sha(pg[key], f"postgresql.{key}")
    return body


def safe_local_image_references(raw: Any, expected_tag: str) -> list[str]:
    if not isinstance(raw, dict) or raw.get("RepoTags") != [expected_tag]:
        raise p.ProvenanceError("image tag lineage mismatched")
    raw_digests = raw.get("RepoDigests")
    if not isinstance(raw_digests, list):
        raise p.ProvenanceError("image digest lineage is invalid")
    normalized: list[str] = []
    digest_pattern = re.compile(
        r"(?:docker\.io/library/)?prime-claw-test-integration@(sha256:[0-9a-f]{64})")
    for value in raw_digests:
        match = digest_pattern.fullmatch(value) if isinstance(value, str) else None
        if match is None or match.group(1) in normalized:
            raise p.ProvenanceError("image repository digest lineage mismatched")
        normalized.append(match.group(1))
    return sorted(normalized)


def safe_image_identity(raw: Any, *, expected_id: str, run_id: str,
                        platform: str, base_image_digest: str,
                        dockerfile_sha256: str, input_sha256: str, tag: str,
                        started_at: str, finished_at: str) -> dict[str, Any]:
    if not isinstance(raw, dict) or raw.get("Id") != expected_id or not _IMAGE_ID.fullmatch(expected_id):
        raise p.ProvenanceError("image inspect identity mismatched iidfile")
    os_name, arch = raw.get("Os"), raw.get("Architecture")
    expected_arch = platform.split("/", 1)[1]
    if os_name != "linux" or arch != expected_arch:
        raise p.ProvenanceError("image platform mismatched selected platform")
    labels = raw.get("Config", {}).get("Labels") if isinstance(raw.get("Config"), dict) else None
    if not isinstance(labels, dict) or labels.get("org.prime-claw.test.contract") != CONTRACT or labels.get("org.prime-claw.test.run") != run_id:
        raise p.ProvenanceError("image ownership labels mismatched")
    for value, label in ((dockerfile_sha256, "Dockerfile hash"), (input_sha256, "build input hash")):
        _sha(value, label)
    if not re.fullmatch(r"prime-claw-test-integration:[0-9a-f]{12}", tag):
        raise p.ProvenanceError("invalid integration image tag")
    repo_digests = safe_local_image_references(raw, tag)
    if not isinstance(base_image_digest, str) or not _IMAGE_ID.fullmatch(base_image_digest):
        raise p.ProvenanceError("invalid locked base-image digest")
    _utc(started_at, "image.build_started_at"); _utc(finished_at, "image.build_finished_at")
    return {
        "id": expected_id, "repo_tags": [tag], "repo_digests": repo_digests,
        "base_image_digest": base_image_digest,
        "dockerfile": "docker/test-integration.Dockerfile",
        "dockerfile_sha256": dockerfile_sha256,
        "declared_input_sha256": input_sha256,
        "declared_input_hash_contract": "framed-sha256-v2",
        "informational_tag": tag, "platform": platform,
        "build_started_at": started_at, "build_finished_at": finished_at,
        "ownership_verified": True,
    }


def safe_container_boundary(raw: Any, *, expected_id: str, image_id: str,
                            run_id: str, name: str,
                            repository_authority: p.DirectoryAuthority,
                            result_authority: p.DirectoryAuthority) -> dict[str, Any]:
    if not isinstance(raw, dict) or raw.get("Id") != expected_id or not _CID.fullmatch(expected_id):
        raise p.ProvenanceError("container inspect identity mismatched cidfile")
    if raw.get("Image") != image_id or raw.get("Name") != "/" + name:
        raise p.ProvenanceError("container image/name identity mismatched")
    config = raw.get("Config"); host = raw.get("HostConfig"); state = raw.get("State")
    if not all(isinstance(x, dict) for x in (config, host, state)) or state.get("Running") is not True:
        raise p.ProvenanceError("container is not running")
    labels = config.get("Labels")
    if not isinstance(labels, dict) or labels.get("org.prime-claw.test.contract") != CONTRACT or labels.get("org.prime-claw.test.run") != run_id:
        raise p.ProvenanceError("container ownership labels mismatched")
    if config.get("User") != "tester" or host.get("NetworkMode") != "none" or host.get("Privileged") is not False:
        raise p.ProvenanceError("container privilege/network boundary drifted")
    if (host.get("PortBindings") not in (None, {}) or config.get("ExposedPorts") not in (None, {})
            or host.get("PidMode") not in (None, "") or host.get("IpcMode") not in (None, "", "private")):
        raise p.ProvenanceError("container ports or namespace boundary drifted")
    env_rows = config.get("Env")
    expected_env = {
        "PATH": "/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin",
        "HOME": "/home/tester", "LANG": "C.UTF-8",
    }
    if not isinstance(env_rows, list):
        raise p.ProvenanceError("container environment is invalid")
    observed_env = {}
    for row in env_rows:
        if not isinstance(row, str) or "=" not in row:
            raise p.ProvenanceError("container environment is invalid")
        key, value = row.split("=", 1)
        if key in observed_env:
            raise p.ProvenanceError("container environment repeats a key")
        observed_env[key] = value
    if observed_env != expected_env or any(re.search(r"TOKEN|SECRET|PASSWORD|COOKIE|CREDENTIAL|API_KEY", key, re.I) for key in observed_env):
        raise p.ProvenanceError("container environment is not allow-listed")
    mounts = raw.get("Mounts")
    p.verify_directory_authority(repository_authority)
    p.verify_directory_authority(result_authority)
    expected = {
        "/workspace": (Path(os.path.abspath(repository_authority.path)), False, "bind"),
        "/results": (Path(os.path.abspath(result_authority.path)), True, "bind"),
    }
    if not isinstance(mounts, list) or len(mounts) != 2:
        raise p.ProvenanceError("container mount set drifted")
    safe_mounts = []
    seen_destinations: set[str] = set()
    for mount in mounts:
        if not isinstance(mount, dict) or mount.get("Destination") not in expected:
            raise p.ProvenanceError("container mount set drifted")
        if mount["Destination"] in seen_destinations:
            raise p.ProvenanceError("container mount set repeats a destination")
        seen_destinations.add(mount["Destination"])
        source, rw, kind = expected[mount["Destination"]]
        observed_source = mount.get("Source")
        if (not isinstance(observed_source, str)
                or not Path(observed_source).is_absolute()
                or Path(os.path.abspath(observed_source)) != source
                or mount.get("RW") is not rw or mount.get("Type") != kind):
            raise p.ProvenanceError("container mount set drifted")
        safe_mounts.append({"destination": mount["Destination"], "read_write": rw, "type": kind})
    if seen_destinations != set(expected):
        raise p.ProvenanceError("container mount set is incomplete")
    return {
        "id": expected_id,
        "image_id": image_id,
        "name_sha256": hashlib.sha256(name.encode()).hexdigest(),
        "network_mode": "none", "ports_absent": True,
        "privileged": False, "environment_allowlisted": True,
        "provider_environment_absent": True,
        "mounts": sorted(safe_mounts, key=lambda row: row["destination"]),
        "ownership_verified": True,
    }


def command_outcome(result: Any) -> str:
    outcome = getattr(result, "outcome", "launch_error")
    rc = getattr(result, "returncode", 127)
    if outcome == "exited":
        return "clean" if rc == 0 else "ordinary_nonzero"
    if outcome in {"signaled", "timed_out", "interrupted", "launch_error", "reap_timeout"}:
        return outcome
    return "launch_error"


def exact_absence(result: Any, identity: str, *, kind: str) -> str:
    if getattr(result, "outcome", None) != "exited":
        return "unknown"
    if getattr(result, "returncode", None) == 0:
        try:
            rows = json.loads(result.stdout or "")
        except (TypeError, json.JSONDecodeError):
            return "unknown"
        key = "Id"
        return "present" if isinstance(rows, list) and len(rows) == 1 and isinstance(rows[0], dict) and rows[0].get(key) == identity else "unknown"
    stdout = result.stdout if isinstance(result.stdout, str) else ""
    stderr = result.stderr if isinstance(result.stderr, str) else ""
    if kind == "container":
        allowed = {f"error: no such object: {identity}\n", f"Error: No such object: {identity}\n", f"Error response from daemon: No such container: {identity}\n"}
    elif kind == "image":
        allowed = {f"Error response from daemon: No such image: {identity}\n", f"Error: No such object: {identity}\n", f"error: no such object: {identity}\n"}
    else:
        raise ValueError("unknown Docker object kind")
    return "absent" if stdout in {"", "[]\n"} and stderr in allowed else "unknown"


def teardown_record(remove_result: Any, inspect_result: Any, identity: str,
                    *, kind: str, verified_at: str) -> dict[str, Any]:
    remove = command_outcome(remove_result)
    state = exact_absence(inspect_result, identity, kind=kind)
    inspect = command_outcome(inspect_result)
    clean = remove == "clean" and inspect == "ordinary_nonzero" and state == "absent"
    return {"state": state, "verified_at": verified_at,
            "remove_outcome": remove, "inspect_outcome": inspect, "clean": clean}


def _validate_teardown(row: Any, label: str) -> dict[str, Any]:
    row = _keys(row, {"state", "verified_at", "remove_outcome", "inspect_outcome", "clean"}, label)
    outcomes = {"clean", "ordinary_nonzero", "signaled", "timed_out", "interrupted", "launch_error", "reap_timeout", "not_needed", "not_run", "identity_refused"}
    if row["state"] not in {"absent", "present", "unknown"} or row["remove_outcome"] not in outcomes or row["inspect_outcome"] not in outcomes or not isinstance(row["clean"], bool):
        raise p.ProvenanceError(f"invalid {label}")
    _utc(row["verified_at"], f"{label}.verified_at")
    if row["clean"] and (row["state"] != "absent" or row["remove_outcome"] not in {"clean", "not_needed"} or row["inspect_outcome"] not in {"ordinary_nonzero", "not_needed"}):
        raise p.ProvenanceError(f"contradictory {label}")
    return row


def _validate_repository(value: Any) -> dict[str, Any]:
    row = _keys(value, {"head", "dirty", "status_sha256", "content_sha256",
                        "entry_count", "content_hash_contract"}, "integration repository")
    if (not isinstance(row["head"], str) or not re.fullmatch(r"[0-9a-f]{40}", row["head"])
            or not isinstance(row["dirty"], bool)
            or not isinstance(row["entry_count"], int) or isinstance(row["entry_count"], bool)
            or row["entry_count"] < 0 or row["content_hash_contract"] != "framed-sha256-v2"):
        raise p.ProvenanceError("invalid integration repository identity")
    _sha(row["status_sha256"], "repository status hash")
    _sha(row["content_sha256"], "repository content hash")
    return row


def _validate_gbrain(value: Any) -> dict[str, Any]:
    row = _keys(value, {"origin", "commit", "tree", "archive_sha256",
                        "package_version", "executable_sha256", "executable_version"},
                "integration gbrain")
    if (row["origin"] != "https://github.com/garrytan/gbrain.git"
            or not isinstance(row["commit"], str) or not re.fullmatch(r"[0-9a-f]{40}", row["commit"])
            or not isinstance(row["tree"], str) or not re.fullmatch(r"[0-9a-f]{40}", row["tree"])
            or not _VERSION4.fullmatch(str(row["package_version"]))
            or row["executable_version"] != row["package_version"]):
        raise p.ProvenanceError("invalid integration gbrain identity")
    _sha(row["archive_sha256"], "gbrain archive hash")
    _sha(row["executable_sha256"], "gbrain executable hash")
    return row


def _validate_image(value: Any, platform: str) -> dict[str, Any]:
    row = _keys(value, {"id", "repo_tags", "repo_digests", "base_image_digest",
                        "dockerfile", "dockerfile_sha256", "declared_input_sha256",
                        "declared_input_hash_contract", "informational_tag", "platform",
                        "build_started_at", "build_finished_at", "ownership_verified"},
                "integration image")
    if (not _IMAGE_ID.fullmatch(str(row["id"]))
            or not isinstance(row["repo_digests"], list)
            or len(set(row["repo_digests"])) != len(row["repo_digests"])
            or any(not _IMAGE_ID.fullmatch(str(item)) for item in row["repo_digests"])
            or row["repo_tags"] != [row["informational_tag"]]
            or row["dockerfile"] != "docker/test-integration.Dockerfile"
            or row["declared_input_hash_contract"] != "framed-sha256-v2"
            or not isinstance(row["informational_tag"], str)
            or not re.fullmatch(r"prime-claw-test-integration:[0-9a-f]{12}", row["informational_tag"])
            or row["platform"] != platform or row["ownership_verified"] is not True):
        raise p.ProvenanceError("invalid integration image identity")
    _sha(row["dockerfile_sha256"], "image Dockerfile hash")
    _sha(row["declared_input_sha256"], "image build-input hash")
    if not _IMAGE_ID.fullmatch(str(row["base_image_digest"])):
        raise p.ProvenanceError("invalid image base digest")
    if _utc(row["build_finished_at"], "image.build_finished_at") < _utc(row["build_started_at"], "image.build_started_at"):
        raise p.ProvenanceError("image build timestamps are reversed")
    return row


def _validate_container(value: Any, image: dict[str, Any]) -> dict[str, Any]:
    row = _keys(value, {"id", "image_id", "name_sha256", "network_mode",
                        "ports_absent", "privileged", "environment_allowlisted",
                        "provider_environment_absent", "mounts", "ownership_verified"},
                "integration container")
    if (not _CID.fullmatch(str(row["id"])) or row["image_id"] != image["id"]
            or row["network_mode"] != "none" or row["ports_absent"] is not True
            or row["privileged"] is not False or row["environment_allowlisted"] is not True
            or row["provider_environment_absent"] is not True
            or row["ownership_verified"] is not True):
        raise p.ProvenanceError("invalid integration container boundary")
    _sha(row["name_sha256"], "container name hash")
    expected = [
        {"destination": "/results", "read_write": True, "type": "bind"},
        {"destination": "/workspace", "read_write": False, "type": "bind"},
    ]
    if row["mounts"] != expected:
        raise p.ProvenanceError("invalid integration container mounts")
    return row


def _validate_fixtures(value: Any) -> dict[str, Any]:
    row = _keys(value, {"corpus_manifest_sha256", "whole_source_inventory_sha256",
                        "database_id", "pgdata_id", "gbrain_home_id", "bare_remote_id",
                        "worktree_commit", "bare_refs_sha256", "roundtrip_inventory_sha256"},
                "integration fixtures")
    for key, item in row.items():
        if key == "worktree_commit":
            if not isinstance(item, str) or not re.fullmatch(r"[0-9a-f]{40}", item):
                raise p.ProvenanceError("invalid fixture worktree commit")
        else:
            _sha(item, f"fixture.{key}")
    if len({row[key] for key in ("database_id", "pgdata_id", "gbrain_home_id", "bare_remote_id")}) != 4:
        raise p.ProvenanceError("fixture ownership identities overlap")
    if row["roundtrip_inventory_sha256"] != row["whole_source_inventory_sha256"]:
        raise p.ProvenanceError("fixture Git round trip inventory drifted")
    return row


def _validate_postgresql(value: Any) -> dict[str, Any]:
    row = _keys(value, {"postgres_version", "postgres_version_num", "pgvector_version",
                        "extension_inventory_sha256", "migration_version",
                        "schema_inventory_sha256", "schema_table_count",
                        "migration_inventory_sha256", "config_sha256"},
                "integration PostgreSQL")
    if (not isinstance(row["postgres_version"], str) or not row["postgres_version"].startswith("16.")
            or not isinstance(row["postgres_version_num"], str) or not re.fullmatch(r"16[0-9]{4}", row["postgres_version_num"])
            or not isinstance(row["pgvector_version"], str) or not re.fullmatch(r"[0-9]+\.[0-9]+(?:\.[0-9]+)?", row["pgvector_version"])
            or row["migration_version"] != "149"
            or not isinstance(row["schema_table_count"], int) or isinstance(row["schema_table_count"], bool)
            or row["schema_table_count"] < 10):
        raise p.ProvenanceError("invalid integration PostgreSQL readiness")
    for key in ("extension_inventory_sha256", "schema_inventory_sha256",
                "migration_inventory_sha256", "config_sha256"):
        _sha(row[key], f"postgresql.{key}")
    return row


def validate_manifest(value: Any) -> dict[str, Any]:
    root = _keys(value, {"schema_version", "command_contract_version", "status", "run", "repository", "platform", "artifact_lock_sha256", "gbrain", "image", "container", "network", "fixtures", "postgresql", "teardown", "evidence"}, "integration manifest")
    if root["schema_version"] != p.SCHEMA_VERSION or root["command_contract_version"] != CONTRACT or root["status"] not in {"passed", "failed"}:
        raise p.ProvenanceError("invalid integration manifest identity")
    run = _keys(root["run"], {"id", "tier", "mode", "started_at", "finished_at", "status", "failure_codes"}, "integration run")
    if (not isinstance(run["id"], str) or not _RUN_ID.fullmatch(run["id"])
            or run["tier"] != "integration" or run["mode"] != "gbrain-postgres"
            or run["status"] != root["status"]):
        raise p.ProvenanceError("invalid integration run identity")
    if _utc(run["finished_at"], "run.finished_at") < _utc(run["started_at"], "run.started_at"):
        raise p.ProvenanceError("integration run timestamps are reversed")
    codes = run["failure_codes"]
    if not isinstance(codes, list) or any(not isinstance(code, str) or not re.fullmatch(r"[a-z][a-z0-9-]{1,63}", code) for code in codes) or len(codes) != len(set(codes)):
        raise p.ProvenanceError("invalid integration failure codes")
    if (root["status"] == "passed") == bool(codes):
        raise p.ProvenanceError("integration status and failure codes disagree")
    if root["platform"] not in SUPPORTED_PLATFORMS:
        raise p.ProvenanceError("invalid integration platform")
    _sha(root["artifact_lock_sha256"], "artifact lock hash")
    _validate_repository(root["repository"])
    if root["image"] is not None:
        _validate_image(root["image"], root["platform"])
    if root["container"] is not None:
        if root["image"] is None:
            raise p.ProvenanceError("container identity requires image identity")
        _validate_container(root["container"], root["image"])
    if root["gbrain"] is not None:
        _validate_gbrain(root["gbrain"])
    if root["fixtures"] is not None:
        _validate_fixtures(root["fixtures"])
    if root["postgresql"] is not None:
        _validate_postgresql(root["postgresql"])
    if root["network"] is not None:
        network = _keys(root["network"], {"mode", "verified_absent", "verified_at", "external_tcp_refused"}, "integration network")
        if (network["mode"] != "none" or not isinstance(network["verified_absent"], bool)
                or not isinstance(network["external_tcp_refused"], bool)):
            raise p.ProvenanceError("invalid integration network boundary")
        _utc(network["verified_at"], "network.verified_at")
    body_fields = (root["gbrain"], root["fixtures"], root["postgresql"])
    if any(item is not None for item in body_fields) and any(item is None for item in body_fields):
        raise p.ProvenanceError("integration body evidence is partial")
    teardown_keys = ("preparation", "container", "image", "context", "snapshot", "share")
    teardown = _keys(root["teardown"], {*teardown_keys, "clean"}, "integration teardown")
    for key in teardown_keys:
        _validate_teardown(teardown[key], f"teardown.{key}")
    if not isinstance(teardown["clean"], bool) or teardown["clean"] != all(
            teardown[key]["clean"] for key in teardown_keys):
        raise p.ProvenanceError("integration aggregate teardown is invalid")
    evidence = _keys(root["evidence"], {"files"}, "integration evidence")
    if not isinstance(evidence["files"], list):
        raise p.ProvenanceError("integration evidence inventory is invalid")
    seen = set()
    for row in evidence["files"]:
        if not isinstance(row, dict) or set(row) != {"path", "sha256"} or not isinstance(row["path"], str) or row["path"] in seen or Path(row["path"]).is_absolute() or ".." in PurePosixPath(row["path"]).parts:
            raise p.ProvenanceError("invalid integration evidence row")
        seen.add(row["path"]); _sha(row["sha256"], "integration evidence hash")
    if root["status"] == "passed":
        if any(root[key] is None for key in ("gbrain", "image", "container", "fixtures", "postgresql")):
            raise p.ProvenanceError("passed integration manifest is incomplete")
        network = root["network"]
        if network is None or network["mode"] != "none" or network["verified_absent"] is not True or network["external_tcp_refused"] is not True:
            raise p.ProvenanceError("passed integration network boundary is invalid")
        _utc(network["verified_at"], "network.verified_at")
        if not teardown["clean"]:
            raise p.ProvenanceError("passed integration requires clean teardown")
    return root


def evidence_inventory(owned: p.OwnedDirectory) -> list[dict[str, str]]:
    return p.evidence_inventory(
        owned,
        exclude=("manifest.json",),
        exclude_prefixes=("share/", "build-context/", "preparation/", ".publication/"),
    )


def verify_evidence(owned: p.OwnedDirectory, manifest: dict[str, Any]) -> None:
    validate_manifest(manifest)
    expected = manifest["evidence"]["files"]
    actual = evidence_inventory(owned)
    if expected != actual:
        raise p.ProvenanceError("integration evidence inventory/hash mismatch")
    by_path = {row["path"]: row["sha256"] for row in actual}
    required = {"artifact-lock.json", "repository.json", "preparation.json"}
    if manifest["status"] == "passed":
        required.update({"image.json", "boundary.json", "body.json"})
    if not required.issubset(by_path):
        raise p.ProvenanceError("integration evidence is missing a mandatory receipt")
    if by_path.get("artifact-lock.json") != manifest["artifact_lock_sha256"]:
        raise p.ProvenanceError("artifact lock evidence is not cross-bound")
    lock = validate_lock(p.read_sanitized_json(owned, "artifact-lock.json"))
    if manifest["image"] is not None:
        if manifest["image"]["base_image_digest"] != lock["base_image"]["platforms"][manifest["platform"]]:
            raise p.ProvenanceError("manifest base-image digest disagrees with lock")
    if manifest["gbrain"] is not None:
        locked = {key: manifest["gbrain"][key] for key in
                  ("origin", "commit", "tree", "archive_sha256", "package_version")}
        if locked != lock["gbrain"]:
            raise p.ProvenanceError("manifest gbrain lineage disagrees with lock")
    repository = p.read_sanitized_json(owned, "repository.json")
    if repository != manifest["repository"]:
        raise p.ProvenanceError("repository evidence is not cross-bound")
    preparation = p.read_sanitized_json(owned, "preparation.json")
    if preparation != manifest["teardown"]["preparation"]:
        raise p.ProvenanceError("preparation teardown evidence is not cross-bound")
    if manifest["image"] is not None:
        if p.read_sanitized_json(owned, "image.json") != manifest["image"]:
            raise p.ProvenanceError("image evidence is not cross-bound")
    if manifest["container"] is not None:
        if p.read_sanitized_json(owned, "boundary.json") != manifest["container"]:
            raise p.ProvenanceError("container evidence is not cross-bound")
    if manifest["gbrain"] is not None:
        body_raw = p.read_sanitized_json(owned, "body.json")
        attestation = hashlib.sha256(
            f"{manifest['run']['id']}:{manifest['container']['id']}:{manifest['image']['id']}".encode()
        ).hexdigest()
        body = validate_body(body_raw, lock, run_id=manifest["run"]["id"],
                             platform=manifest["platform"], attestation=attestation)
        if (body["artifact_lock_sha256"] != manifest["artifact_lock_sha256"]
                or body["base_image_digest"] != manifest["image"]["base_image_digest"]
                or body["gbrain"] != manifest["gbrain"]
                or body["fixtures"] != manifest["fixtures"]
                or body["postgresql"] != manifest["postgresql"]
                or body["external_tcp_refused"] != manifest["network"]["external_tcp_refused"]
                or body["repository_read_only"] is not True
                or body["non_root"] is not True):
            raise p.ProvenanceError("body evidence is not cross-bound")
        run_started = _utc(manifest["run"]["started_at"], "run.started_at")
        run_finished = _utc(manifest["run"]["finished_at"], "run.finished_at")
        if not (run_started <= _utc(body["started_at"], "body.started_at")
                <= _utc(body["finished_at"], "body.finished_at") <= run_finished):
            raise p.ProvenanceError("body evidence timestamps escape the run interval")


def publish_manifest(owned: p.OwnedDirectory, manifest: dict[str, Any], *, expected_existing: p.ObjectBinding | None = None) -> p.ObjectBinding:
    validate_manifest(manifest)
    if expected_existing is None:
        verify_evidence(owned, manifest)
        binding = p.write_sanitized_json(owned, "manifest.json", manifest)
        try:
            verify_evidence(owned, manifest)
        except p.ProvenanceError:
            # Never leave a green public record when post-write verification
            # loses its evidence race. The shared primitive exchanges this
            # exact object for minimal failed JSON before returning the error.
            p.invalidate_green_manifest(owned, expected=binding)
            raise
    else:
        if manifest["status"] != "failed":
            raise p.ProvenanceError("integration replacement must be failed")
        binding = p.replace_sanitized_json(owned, "manifest.json", manifest, expected_existing=expected_existing)
        verify_evidence(owned, manifest)
    return binding


def load_verified_manifest(path: Path | str) -> tuple[dict[str, Any], str]:
    candidate = Path(path).resolve()
    if candidate.name != "manifest.json":
        raise p.ProvenanceError("integration manifest path must end in manifest.json")
    binding = p.owned_directory_binding(candidate.parent)
    with p.open_owned_directory(candidate.parent, binding) as owned:
        manifest = p.read_sanitized_json(owned, "manifest.json")
        validate_manifest(manifest)
        verify_evidence(owned, manifest)
    return manifest, binding


def compare_passed(first: dict[str, Any], second: dict[str, Any]) -> None:
    validate_manifest(first); validate_manifest(second)
    if first["status"] != "passed" or second["status"] != "passed":
        raise p.ProvenanceError("two-run comparison requires passed manifests")
    if first["run"]["id"] == second["run"]["id"]:
        raise p.ProvenanceError("run identity was reused")
    if first["image"]["id"] == second["image"]["id"] or first["container"]["id"] == second["container"]["id"]:
        raise p.ProvenanceError("image/container identity was reused")
    disjoint = ("database_id", "pgdata_id", "gbrain_home_id", "bare_remote_id",
                "worktree_commit", "bare_refs_sha256")
    if any(first["fixtures"][key] == second["fixtures"][key] for key in disjoint):
        raise p.ProvenanceError("fixture identity was reused")
    stable_top = ("repository", "platform", "artifact_lock_sha256")
    if any(first[key] != second[key] for key in stable_top):
        raise p.ProvenanceError("repository/platform/artifact-lock identity drifted")
    stable_image = ("base_image_digest", "dockerfile", "dockerfile_sha256",
                    "declared_input_hash_contract")
    if any(first["image"][key] != second["image"][key] for key in stable_image):
        raise p.ProvenanceError("stable image input identity drifted")
    stable_fixture = ("corpus_manifest_sha256", "whole_source_inventory_sha256",
                      "roundtrip_inventory_sha256")
    if any(first["fixtures"][key] != second["fixtures"][key] for key in stable_fixture):
        raise p.ProvenanceError("locked fixture identity drifted")
    if first["gbrain"] != second["gbrain"]:
        raise p.ProvenanceError("locked gbrain identity drifted")
    stable_pg = ("postgres_version", "postgres_version_num", "pgvector_version",
                 "extension_inventory_sha256", "migration_version",
                 "schema_inventory_sha256", "schema_table_count",
                 "migration_inventory_sha256")
    if any(first["postgresql"][key] != second["postgresql"][key] for key in stable_pg):
        raise p.ProvenanceError("PostgreSQL/schema identity drifted")


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    val = sub.add_parser("validate-manifest"); val.add_argument("path")
    comp = sub.add_parser("compare-runs"); comp.add_argument("first"); comp.add_argument("second")
    args = parser.parse_args(argv)
    if args.command == "validate-manifest":
        load_verified_manifest(args.path)
    else:
        first, first_binding = load_verified_manifest(args.first)
        second, second_binding = load_verified_manifest(args.second)
        if (Path(args.first).resolve().parent == Path(args.second).resolve().parent
                or first_binding == second_binding):
            raise p.ProvenanceError("two-run comparison requires disjoint evidence directories")
        compare_passed(first, second)
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
