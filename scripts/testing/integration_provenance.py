#!/usr/bin/env python3
"""Small validators for the trusted-host Slice-3 Docker integration test."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from typing import Any

CONTRACT = "integration-v2"
BODY_CONTRACT = "integration-body-v2"
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
    postgres = _mapping(body.get("postgresql"), "body PostgreSQL")
    if not str(postgres.get("postgres_version_num", "")).startswith("16"):
        raise IntegrationEvidenceError("PostgreSQL major version mismatched")
    _string(postgres.get("pgvector_version"), "pgvector version")
    if postgres.get("migration_version") != "149":
        raise IntegrationEvidenceError("gbrain migration version mismatched")
    fixtures = _mapping(body.get("fixtures"), "body fixtures")
    for key in ("corpus_manifest_sha256", "whole_source_inventory_sha256",
                "database_id", "pgdata_id", "gbrain_home_id", "bare_remote_id",
                "bare_refs_sha256", "roundtrip_inventory_sha256"):
        _sha(fixtures.get(key), f"fixture {key}")
    if not re.fullmatch(r"[0-9a-f]{40}", str(fixtures.get("worktree_commit", ""))):
        raise IntegrationEvidenceError("fixture worktree commit is invalid")
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
