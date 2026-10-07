#!/usr/bin/env python3
"""Small validators for the trusted-host Slice-3 Docker integration test."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from typing import Any

from scripts.testing.gbrain_property_contract import (
    digest as normalized_digest, dry_payload, source_payload)

CONTRACT = "integration-v3"
BODY_CONTRACT = "integration-body-v3"
SUPPORTED_PLATFORMS = {"linux/arm64", "linux/amd64"}
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_IMAGE = re.compile(r"^sha256:[0-9a-f]{64}$")
_CID = re.compile(r"^[0-9a-f]{64}$")
_RUN_ID = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[0-9]+-[0-9a-f]{8}$")


class IntegrationEvidenceError(ValueError):
    pass


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"))


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _mapping(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise IntegrationEvidenceError(f"{label} must be an object")
    return value


def _string(value: Any, label: str) -> str:
    if not isinstance(value, str) or not value:
        raise IntegrationEvidenceError(f"{label} must be a non-empty string")
    return value


def _sha(value: Any, label: str) -> str:
    if not isinstance(value, str) or not _SHA256.fullmatch(value):
        raise IntegrationEvidenceError(f"{label} must be a SHA-256")
    return value


def load_lock(path: Path | str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise IntegrationEvidenceError("artifact lock is unavailable") from exc
    return validate_lock(value)


def load_lock_bytes(payload: bytes) -> dict[str, Any]:
    try:
        value = json.loads(payload.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise IntegrationEvidenceError("artifact lock is invalid") from exc
    return validate_lock(value)


def validate_lock(value: Any) -> dict[str, Any]:
    lock = _mapping(value, "artifact lock")
    if lock.get("schema_version") != 1:
        raise IntegrationEvidenceError("unsupported artifact lock")
    gbrain = _mapping(lock.get("gbrain"), "gbrain lock")
    if not re.fullmatch(r"[0-9a-f]{40}", str(gbrain.get("commit", ""))):
        raise IntegrationEvidenceError("invalid gbrain commit")
    if not re.fullmatch(r"[0-9a-f]{40}", str(gbrain.get("tree", ""))):
        raise IntegrationEvidenceError("invalid gbrain tree")
    _sha(gbrain.get("archive_sha256"), "gbrain archive")
    _string(gbrain.get("origin"), "gbrain origin")
    _string(gbrain.get("package_version"), "gbrain package version")
    bun = _mapping(lock.get("bun"), "Bun lock")
    _string(bun.get("version"), "Bun version")
    base = _mapping(lock.get("base_image"), "base image lock")
    _string(base.get("reference"), "base image reference")
    if not _IMAGE.fullmatch(str(base.get("index_digest", ""))):
        raise IntegrationEvidenceError("invalid base image index digest")
    for platform in SUPPORTED_PLATFORMS:
        bun_row = _mapping(_mapping(bun.get("platforms"), "Bun platforms").get(platform),
                           f"Bun {platform}")
        for key in ("artifact", "archive_directory", "compile_target"):
            _string(bun_row.get(key), f"Bun {platform} {key}")
        _sha(bun_row.get("sha256"), f"Bun {platform} artifact")
        digest = _mapping(base.get("platforms"), "base platforms").get(platform)
        if not isinstance(digest, str) or not _IMAGE.fullmatch(digest):
            raise IntegrationEvidenceError(f"invalid base digest for {platform}")
    return lock


def validate_image(raw: Any, *, image_id: str, run_id: str,
                   platform: str, tag: str) -> dict[str, Any]:
    row = _mapping(raw, "image inspect row")
    if row.get("Id") != image_id or not _IMAGE.fullmatch(image_id):
        raise IntegrationEvidenceError("image identity mismatched iidfile")
    expected_arch = platform.split("/", 1)[1]
    if row.get("Os") != "linux" or row.get("Architecture") != expected_arch:
        raise IntegrationEvidenceError("image platform mismatched")
    config = _mapping(row.get("Config"), "image Config")
    labels = _mapping(config.get("Labels"), "image labels")
    if (labels.get("org.prime-claw.test.contract") != CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id):
        raise IntegrationEvidenceError("image labels mismatched")
    tags = row.get("RepoTags")
    if not isinstance(tags, list) or tag not in tags:
        raise IntegrationEvidenceError("image tag mismatched")
    return {"id": image_id, "tag": tag, "platform": platform,
            "labels_verified": True}


def validate_container(raw: Any, *, container_id: str, image_id: str,
                       run_id: str, name: str) -> dict[str, Any]:
    row = _mapping(raw, "container inspect row")
    if row.get("Id") != container_id or not _CID.fullmatch(container_id):
        raise IntegrationEvidenceError("container identity mismatched cidfile")
    if row.get("Image") != image_id or row.get("Name") != "/" + name:
        raise IntegrationEvidenceError("container image/name mismatched")
    config = _mapping(row.get("Config"), "container Config")
    host = _mapping(row.get("HostConfig"), "container HostConfig")
    labels = _mapping(config.get("Labels"), "container labels")
    if (labels.get("org.prime-claw.test.contract") != CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id):
        raise IntegrationEvidenceError("container labels mismatched")
    if config.get("User") not in ("tester", "10001"):
        raise IntegrationEvidenceError("container must run as tester")
    if host.get("NetworkMode") != "none" or host.get("Privileged") is not False:
        raise IntegrationEvidenceError("container network/privilege boundary mismatched")
    if host.get("PidMode") not in (None, "") or host.get("IpcMode") not in (None, "", "private"):
        raise IntegrationEvidenceError("container host namespaces are forbidden")
    if host.get("Binds") not in (None, []) or host.get("VolumesFrom") not in (None, []):
        raise IntegrationEvidenceError("integration container must have no host binds")
    mounts = row.get("Mounts")
    if mounts not in (None, []):
        raise IntegrationEvidenceError("integration container must have no host mounts")
    if (host.get("PortBindings") not in (None, {})
            or config.get("ExposedPorts") not in (None, {})):
        raise IntegrationEvidenceError("integration container must publish no ports")
    env_rows = config.get("Env")
    if not isinstance(env_rows, list):
        raise IntegrationEvidenceError("container environment is unavailable")
    allowed = {"PATH", "HOME", "LANG", "PRIME_CLAW_INTEGRATION_ATTESTATION",
               "PRIME_CLAW_INTEGRATION_RUN_ID", "PRIME_CLAW_INTEGRATION_CONTAINER"}
    env = {entry.split("=", 1)[0]: entry.split("=", 1)[1]
           for entry in env_rows if isinstance(entry, str) and "=" in entry}
    if set(env) != allowed or len(env_rows) != len(allowed):
        raise IntegrationEvidenceError("container environment is not allow-listed")
    if env["PRIME_CLAW_INTEGRATION_CONTAINER"] != "1":
        raise IntegrationEvidenceError("container entry marker is invalid")
    return {"id": container_id, "image_id": image_id, "name": name,
            "network_mode": "none", "non_root": True,
            "host_mounts_absent": True, "ports_absent": True,
            "labels_verified": True}


DRY_COMMAND = ["gbrain", "sync", "--source", "fixture", "--dry-run",
               "--no-pull", "--no-embed", "--yes"]
SOURCE_COMMAND = ["gbrain", "sync", "--source", "fixture", "--no-pull",
                  "--no-embed", "--no-extract", "--yes"]


def _expected_asset_hashes() -> dict[str, str]:
    repo = Path(__file__).resolve().parents[2]
    roots = [
        (repo / "tests/integration/environment_body.py", "environment_body.py"),
        (repo / "tests/integration/gbrain_property_support.py", "gbrain_property_support.py"),
        (repo / "tests/integration/gbrain_dry_run_body.py", "gbrain_dry_run_body.py"),
        (repo / "tests/integration/gbrain_source_coverage_body.py", "gbrain_source_coverage_body.py"),
        (repo / "scripts/testing/gbrain_property_contract.py", "gbrain_property_contract.py"),
    ]
    rows = {relative: sha256_bytes(path.read_bytes()) for path, relative in roots}
    for source_name in ("brain-source", "brain-properties"):
        root = repo / "tests/fixtures" / source_name
        for path in sorted(value for value in root.rglob("*") if value.is_file()):
            rows[f"fixtures/{source_name}/{path.relative_to(root).as_posix()}"] = sha256_bytes(path.read_bytes())
    return rows


def _validate_snapshot(value: Any, label: str) -> dict[str, Any]:
    row = _mapping(value, label)
    required = {
        "schema_sha256", "schema_object_count", "migration_version",
        "source_bookmark", "sequence_sha256", "sequence_count",
        "table_hashes", "table_row_counts", "rows_sha256",
        "failure_ledger_sha256", "failure_ledger_lock", "persistent_locks",
        "post_exit_fixture_sessions", "config_sha256", "config_raw_sha256", "config_semantics_sha256", "worktree",
        "bare_refs_sha256",
    }
    if set(row) != required:
        raise IntegrationEvidenceError(f"{label} dimensions mismatched")
    for key in ("schema_sha256", "sequence_sha256", "rows_sha256", "failure_ledger_sha256",
                "config_sha256", "config_raw_sha256", "config_semantics_sha256", "bare_refs_sha256"):
        _sha(row.get(key), f"{label} {key}")
    if row.get("migration_version") != "149":
        raise IntegrationEvidenceError(f"{label} migration version mismatched")
    bookmark = _mapping(row.get("source_bookmark"), f"{label} source bookmark")
    if bookmark.get("id") != "fixture" or not re.fullmatch(r"[0-9a-f]{40}", str(bookmark.get("last_commit", ""))):
        raise IntegrationEvidenceError(f"{label} source bookmark invalid")
    if not isinstance(row.get("sequence_count"), int) or row["sequence_count"] < 1:
        raise IntegrationEvidenceError(f"{label} sequence inventory invalid")
    table_hashes = _mapping(row.get("table_hashes"), f"{label} table hashes")
    table_counts = _mapping(row.get("table_row_counts"), f"{label} table counts")
    if set(table_hashes) != set(table_counts) or not {"pages", "sources", "config", "gbrain_cycle_locks"}.issubset(table_hashes):
        raise IntegrationEvidenceError(f"{label} table inventory mismatched")
    for table, digest in table_hashes.items():
        _string(table, f"{label} table")
        _sha(digest, f"{label} table {table}")
        if not isinstance(table_counts[table], int) or table_counts[table] < 0:
            raise IntegrationEvidenceError(f"{label} table count invalid")
    locks = _mapping(row.get("persistent_locks"), f"{label} locks")
    _sha(locks.get("cycle_rows_sha256"), f"{label} cycle locks")
    if locks.get("advisory_lock_count") != 0 or row.get("post_exit_fixture_sessions") != 0:
        raise IntegrationEvidenceError(f"{label} retained lock or session")
    ledger_lock = _mapping(row.get("failure_ledger_lock"), f"{label} failure ledger lock")
    if not isinstance(ledger_lock.get("exists"), bool):
        raise IntegrationEvidenceError(f"{label} failure ledger lock state invalid")
    _sha(ledger_lock.get("sha256"), f"{label} failure ledger lock")
    worktree = _mapping(row.get("worktree"), f"{label} worktree")
    if not re.fullmatch(r"[0-9a-f]{40}", str(worktree.get("head", ""))):
        raise IntegrationEvidenceError(f"{label} worktree head invalid")
    _sha(worktree.get("status_sha256"), f"{label} worktree status")
    _sha(worktree.get("tree_sha256"), f"{label} worktree tree")
    return row


def _validate_stack(value: Any, label: str) -> dict[str, Any]:
    stack = _mapping(value, label)
    for key in ("database_id", "pgdata_id", "gbrain_home_id", "database_name_sha256"):
        _sha(stack.get(key), f"{label} {key}")
    if stack.get("gbrain_version") != "gbrain 0.50.0.0":
        raise IntegrationEvidenceError(f"{label} gbrain version mismatched")
    if not str(stack.get("postgres_version_num", "")).startswith("16"):
        raise IntegrationEvidenceError(f"{label} PostgreSQL version mismatched")
    _string(stack.get("pgvector_version"), f"{label} pgvector version")
    return stack


def validate_dry_property(value: Any, *, run_id: str, expected_id: str) -> dict[str, Any]:
    row = _mapping(value, "dry-run property")
    if (row.get("schema_version") != 1 or row.get("contract") != "gbrain-dry-run-v1"
            or row.get("run_id") != run_id or row.get("property_run_id") != expected_id):
        raise IntegrationEvidenceError("dry-run property identity mismatched")
    if (row.get("command") != DRY_COMMAND or row.get("outcome") != "exited"
            or row.get("exit_code") != 0 or not isinstance(row.get("stdout"), str)
            or not isinstance(row.get("stderr"), str)):
        raise IntegrationEvidenceError("dry-run command or exit mismatched")
    before = _validate_snapshot(row.get("snapshot_before"), "dry-run before")
    after = _validate_snapshot(row.get("snapshot_after"), "dry-run after")
    if before != after or row.get("logical_mutation") is not False:
        raise IntegrationEvidenceError("dry-run logical state mutated")
    for key in ("fixture_manifest_sha256", "stdout_sha256", "stderr_sha256",
                "normalized_result_sha256"):
        _sha(row.get(key), f"dry-run {key}")
    if not re.fullmatch(r"[0-9a-f]{40}", str(row.get("delta_commit", ""))):
        raise IntegrationEvidenceError("dry-run delta commit invalid")
    if row.get("postgres_stopped") is not True:
        raise IntegrationEvidenceError("dry-run PostgreSQL cleanup missing")
    _validate_stack(row.get("stack"), "dry-run stack")
    expected_normalized = normalized_digest(dry_payload(
        command=row["command"], exit_code=row["exit_code"],
        logical_mutation=row["logical_mutation"], snapshot=before))
    if row.get("normalized_result_sha256") != expected_normalized:
        raise IntegrationEvidenceError("dry-run normalized result mismatched")
    return row


def _load_property_manifest() -> dict[str, Any]:
    path = Path(__file__).resolve().parents[2] / "tests/fixtures/brain-properties/manifest.json"
    try:
        return _mapping(json.loads(path.read_text()), "property fixture manifest")
    except (OSError, json.JSONDecodeError) as exc:
        raise IntegrationEvidenceError("property fixture manifest unavailable") from exc


def validate_source_property(value: Any, *, run_id: str, expected_id: str) -> dict[str, Any]:
    row = _mapping(value, "source property")
    if (row.get("schema_version") != 1 or row.get("contract") != "gbrain-source-coverage-v1"
            or row.get("run_id") != run_id or row.get("property_run_id") != expected_id):
        raise IntegrationEvidenceError("source property identity mismatched")
    if (row.get("command") != SOURCE_COMMAND or row.get("outcome") != "exited"
            or row.get("exit_code") != 0 or not isinstance(row.get("stdout"), str)
            or not isinstance(row.get("stderr"), str)):
        raise IntegrationEvidenceError("source property command or exit mismatched")
    for key in ("fixture_manifest_sha256", "stdout_sha256", "stderr_sha256",
                "normalized_result_sha256"):
        _sha(row.get(key), f"source property {key}")
    _validate_snapshot(row.get("logical_snapshot"), "source logical snapshot")
    accounting = _mapping(row.get("accounting"), "source accounting")
    records = accounting.get("records")
    database_rows = accounting.get("database_rows")
    if not isinstance(records, list) or not isinstance(database_rows, list):
        raise IntegrationEvidenceError("source accounting rows invalid")
    if accounting.get("path_count") != len(records) or accounting.get("row_count") != len(database_rows):
        raise IntegrationEvidenceError("source accounting counts mismatched")
    pairs = [(r.get("path"), r.get("slug")) for r in records if isinstance(r, dict)]
    record_paths = [pair[0] for pair in pairs]
    record_slugs = [pair[1] for pair in pairs]
    if (len(pairs) != len(records) or len(set(pairs)) != len(pairs)
            or len(set(record_paths)) != len(record_paths)
            or len(set(record_slugs)) != len(record_slugs)):
        raise IntegrationEvidenceError("source accounting path/slug duplication")
    states = {r.get("state") for r in records}
    if not {"live", "deleted", "superseded", "excluded"}.issubset(states):
        raise IntegrationEvidenceError("source accounting states incomplete")
    for record in records:
        expected_representation = {"live": "row", "deleted": "tombstone",
                                   "excluded": "absent"}.get(record.get("state"))
        if expected_representation and record.get("representation") != expected_representation:
            raise IntegrationEvidenceError("source accounting representation mismatched")
        if (record.get("state") == "superseded"
                and record.get("representation") not in {"absent", "tombstone"}):
            raise IntegrationEvidenceError("superseded accounting representation mismatched")
    row_slugs = [r.get("slug") for r in database_rows if isinstance(r, dict)]
    expected_row_slugs = [r.get("slug") for r in records
                          if r.get("representation") in {"row", "tombstone"}]
    if sorted(row_slugs) != sorted(expected_row_slugs) or len(row_slugs) != len(set(row_slugs)):
        raise IntegrationEvidenceError("source accounting database parity mismatched")
    delta_commit = row.get("delta_commit")
    if (not re.fullmatch(r"[0-9a-f]{40}", str(delta_commit or ""))
            or row["logical_snapshot"]["source_bookmark"].get("last_commit") != delta_commit):
        raise IntegrationEvidenceError("source coverage bookmark mismatched delta commit")
    malformed = _mapping(row.get("malformed_frontmatter"), "malformed frontmatter")
    if (malformed.get("reason") != "invalid-yaml-frontmatter"
            or malformed.get("command") != SOURCE_COMMAND
            or malformed.get("outcome") != "exited"
            or not isinstance(malformed.get("exit_code"), int)
            or not isinstance(malformed.get("stdout"), str)
            or not isinstance(malformed.get("stderr"), str)
            or malformed.get("bookmark_before") != malformed.get("bookmark_after")
            or malformed.get("bookmark_before") != delta_commit
            or malformed.get("rows_before_sha256") != malformed.get("rows_after_sha256")):
        raise IntegrationEvidenceError("malformed frontmatter exclusion mismatched")
    for key in ("rows_before_sha256", "rows_after_sha256", "failure_ledger_sha256",
                "stdout_sha256", "stderr_sha256"):
        _sha(malformed.get(key), f"malformed frontmatter {key}")
    expected_manifest = _load_property_manifest()
    expected_records = [{key: item[key] for key in ("path", "slug", "state", "reason") if key in item}
                        for item in expected_manifest["accounting"]]
    actual_records = [{key: item[key] for key in ("path", "slug", "state", "reason") if key in item}
                      for item in records]
    if actual_records != expected_records:
        raise IntegrationEvidenceError("source accounting fixture manifest mismatched")
    if row.get("postgres_stopped") is not True:
        raise IntegrationEvidenceError("source property PostgreSQL cleanup missing")
    _validate_stack(row.get("stack"), "source property stack")
    expected_normalized = normalized_digest(source_payload(
        command=row["command"], accounting=accounting, malformed=malformed))
    if row.get("normalized_result_sha256") != expected_normalized:
        raise IntegrationEvidenceError("source normalized result mismatched")
    return row


def validate_properties(value: Any, *, run_id: str) -> dict[str, list[dict[str, Any]]]:
    props = _mapping(value, "body properties")
    if set(props) != {"dry_run", "source_coverage"}:
        raise IntegrationEvidenceError("body property groups mismatched")
    dry_raw, source_raw = props["dry_run"], props["source_coverage"]
    if not isinstance(dry_raw, list) or len(dry_raw) != 2 or not isinstance(source_raw, list) or len(source_raw) != 2:
        raise IntegrationEvidenceError("body property repetitions mismatched")
    dry = [validate_dry_property(row, run_id=run_id, expected_id=f"dry-run-{suffix}")
           for row, suffix in zip(dry_raw, ("a", "b"), strict=True)]
    source = [validate_source_property(row, run_id=run_id, expected_id=f"source-coverage-{suffix}")
              for row, suffix in zip(source_raw, ("a", "b"), strict=True)]
    if dry[0]["normalized_result_sha256"] != dry[1]["normalized_result_sha256"]:
        raise IntegrationEvidenceError("dry-run repetitions differ")
    if source[0]["normalized_result_sha256"] != source[1]["normalized_result_sha256"]:
        raise IntegrationEvidenceError("source repetitions differ")
    rows = dry + source
    db_ids = [row["stack"]["database_id"] for row in rows]
    property_ids = [row["property_run_id"] for row in rows]
    if len(set(db_ids)) != 4 or len(set(property_ids)) != 4:
        raise IntegrationEvidenceError("property database/run identities are not disjoint")
    return {"dry_run": dry, "source_coverage": source}


def validate_body(value: Any, lock: dict[str, Any], *, run_id: str,
                  platform: str, repository: dict[str, Any]) -> dict[str, Any]:
    body = _mapping(value, "body receipt")
    if body.get("schema_version") != 1 or body.get("contract") != BODY_CONTRACT:
        raise IntegrationEvidenceError("unsupported body receipt")
    if body.get("run_id") != run_id or not _RUN_ID.fullmatch(run_id):
        raise IntegrationEvidenceError("body run identity mismatched")
    if body.get("platform") != platform:
        raise IntegrationEvidenceError("body platform mismatched")
    if body.get("non_root") is not True or body.get("uid") in (None, 0):
        raise IntegrationEvidenceError("body did not run nonroot")
    if body.get("source_baked") is not True or body.get("external_tcp_refused") is not True:
        raise IntegrationEvidenceError("body isolation proof failed")
    if body.get("repository") != repository:
        raise IntegrationEvidenceError("body repository identity mismatched")
    expected_lock_sha = sha256_bytes((canonical_json(lock) + "\n").encode())
    if body.get("artifact_lock_sha256") != expected_lock_sha:
        raise IntegrationEvidenceError("body artifact lock mismatched")
    if body.get("base_image_digest") != lock["base_image"]["platforms"][platform]:
        raise IntegrationEvidenceError("body base image mismatched")
    gbrain = _mapping(body.get("gbrain"), "body gbrain")
    for key in ("commit", "tree", "archive_sha256", "package_version"):
        if gbrain.get(key) != lock["gbrain"][key]:
            raise IntegrationEvidenceError(f"body gbrain {key} mismatched")
    if gbrain.get("executable_version") != lock["gbrain"]["package_version"]:
        raise IntegrationEvidenceError("body gbrain executable version mismatched")
    _sha(gbrain.get("executable_sha256"), "gbrain executable")
    bun = _mapping(body.get("bun"), "body Bun")
    expected_bun = lock["bun"]["platforms"][platform]
    if (bun.get("version") != lock["bun"]["version"]
            or bun.get("artifact_sha256") != expected_bun["sha256"]):
        raise IntegrationEvidenceError("body Bun identity mismatched")
    assets = _mapping(body.get("asset_sha256s"), "body asset hashes")
    if assets != _expected_asset_hashes():
        raise IntegrationEvidenceError("body asset inventory mismatched")
    properties = validate_properties(body.get("properties"), run_id=run_id)
    postgres = _mapping(body.get("postgresql"), "body PostgreSQL")
    if not str(postgres.get("postgres_version_num", "")).startswith("16"):
        raise IntegrationEvidenceError("PostgreSQL major version mismatched")
    _string(postgres.get("pgvector_version"), "pgvector version")
    if postgres.get("migration_version") != "149":
        raise IntegrationEvidenceError("gbrain migration version mismatched")
    fixtures = _mapping(body.get("fixtures"), "body fixtures")
    for key in ("corpus_manifest_sha256", "whole_source_inventory_sha256",
                "property_manifest_sha256", "database_id", "pgdata_id", "gbrain_home_id", "bare_remote_id",
                "bare_refs_sha256", "roundtrip_inventory_sha256"):
        _sha(fixtures.get(key), f"fixture {key}")
    if not re.fullmatch(r"[0-9a-f]{40}", str(fixtures.get("worktree_commit", ""))):
        raise IntegrationEvidenceError("fixture worktree commit is invalid")
    expected_property_manifest = _expected_asset_hashes()["fixtures/brain-properties/manifest.json"]
    if fixtures.get("property_manifest_sha256") != expected_property_manifest:
        raise IntegrationEvidenceError("property fixture manifest mismatched")
    property_rows = properties["dry_run"] + properties["source_coverage"]
    expected_db_ids = [row["stack"]["database_id"] for row in property_rows]
    expected_run_ids = [row["property_run_id"] for row in property_rows]
    if (fixtures.get("property_database_ids") != expected_db_ids
            or fixtures.get("property_run_ids") != expected_run_ids
            or fixtures.get("database_id") in expected_db_ids):
        raise IntegrationEvidenceError("body property identity summary mismatched")
    return body


def validate_manifest(value: Any) -> dict[str, Any]:
    manifest = _mapping(value, "manifest")
    if manifest.get("schema_version") != 1 or manifest.get("contract") != CONTRACT:
        raise IntegrationEvidenceError("unsupported integration manifest")
    if manifest.get("status") not in ("passed", "failed"):
        raise IntegrationEvidenceError("invalid integration status")
    run = _mapping(manifest.get("run"), "manifest run")
    if not _RUN_ID.fullmatch(str(run.get("id", ""))):
        raise IntegrationEvidenceError("invalid integration run id")
    repository = _mapping(manifest.get("repository"), "manifest repository")
    if not re.fullmatch(r"[0-9a-f]{40,64}", str(repository.get("head", ""))):
        raise IntegrationEvidenceError("invalid repository head")
    _sha(repository.get("content_sha256"), "repository content")
    platform = manifest.get("platform")
    if platform not in SUPPORTED_PLATFORMS:
        if not (manifest["status"] == "failed" and platform == "unknown"):
            raise IntegrationEvidenceError("unsupported manifest platform")
    cleanup = _mapping(manifest.get("cleanup"), "manifest cleanup")
    for key in ("container_removed", "image_removed", "context_removed"):
        if not isinstance(cleanup.get(key), bool):
            raise IntegrationEvidenceError(f"cleanup {key} must be boolean")
    if manifest["status"] == "passed":
        if not isinstance(manifest.get("body"), dict):
            raise IntegrationEvidenceError("passed manifest lacks body receipt")
        if not all(cleanup[key] for key in (
                "container_removed", "image_removed", "context_removed")):
            raise IntegrationEvidenceError("passed manifest has incomplete cleanup")
        if run.get("failure_codes") != []:
            raise IntegrationEvidenceError("passed manifest has failure codes")
        lock_path = Path(__file__).resolve().parents[2] / "config/test-artifacts.lock.json"
        lock = load_lock(lock_path)
        expected_lock_sha = sha256_bytes((canonical_json(lock) + "\n").encode())
        if manifest.get("artifact_lock_sha256") != expected_lock_sha:
            raise IntegrationEvidenceError("manifest artifact lock mismatched")
        validate_body(manifest["body"], lock, run_id=run["id"],
                      platform=platform, repository=repository)
    return manifest


def load_manifest(path: Path | str) -> dict[str, Any]:
    try:
        value = json.loads(Path(path).read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise IntegrationEvidenceError("manifest is unavailable") from exc
    return validate_manifest(value)


def _main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest")
    args = parser.parse_args(argv)
    manifest = load_manifest(args.manifest)
    print(json.dumps({"status": manifest["status"],
                      "run_id": manifest["run"]["id"]}, sort_keys=True))
    return 0 if manifest["status"] == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(_main())
