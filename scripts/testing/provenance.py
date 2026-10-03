#!/usr/bin/env python3
"""Sanitized, atomic provenance evidence for disposable test runs.

This module is deliberately stdlib-only. It records identities and hashes, not
source content, credentials, endpoint values, or operator-local paths.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Any, Iterable

SCHEMA_VERSION = 1
COMMAND_CONTRACT_VERSION = "tier1-v1"
_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_IMAGE_ID_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
_SEMVER_RE = re.compile(r"^[0-9]+\.[0-9]+\.[0-9]+$")
_UTC_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
_FORBIDDEN_KEYS = re.compile(
    r"(^|[_-])(token|secret|password|authorization|cookie|credential)([_-]|$)",
    re.IGNORECASE,
)
_FORBIDDEN_VALUES = (
    re.compile(r"\bBearer\s+\S+", re.IGNORECASE),
    re.compile(r"\b(?:sk-[A-Za-z0-9_-]{12,}|xox[baprs]-[A-Za-z0-9-]+|gh[pousr]_[A-Za-z0-9]+)"),
    re.compile(r"[A-Za-z][A-Za-z0-9+.-]*://[^/\s:@]+:[^/\s@]+@"),
    re.compile(r"(?:^|\s|=)(?:[A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|API_KEY))=\S+", re.IGNORECASE),
    re.compile(r"(?:https?|wss?)://(?:localhost|127\.[0-9.]+|10\.[0-9.]+|192\.168\.[0-9.]+|172\.(?:1[6-9]|2[0-9]|3[01])\.[0-9.]+|[^/\s]+\.local)(?:[:/]|$)", re.IGNORECASE),
    re.compile(r"(?:/Users/|/home/|[A-Za-z]:\\Users\\)"),
)


class ProvenanceError(ValueError):
    """The evidence is incomplete, unsafe, stale, or malformed."""


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True) + "\n"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path | str) -> str:
    path = Path(path)
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def allocate_run_tree(results_root: Path | str, tier: str) -> tuple[str, Path]:
    """Atomically allocate `.test-results/<run-id>/<tier>/`.

    The random token and exclusive mkdir make concurrent processes safe. The
    returned run id contains no host/user identity.
    """
    if not re.fullmatch(r"[a-z][a-z0-9-]*", tier):
        raise ProvenanceError(f"invalid tier name: {tier!r}")
    root = Path(results_root)
    root.mkdir(parents=True, exist_ok=True)
    for _ in range(32):
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        run_id = f"{stamp}-{os.getpid()}-{secrets.token_hex(4)}"
        run_root = root / run_id
        try:
            run_root.mkdir(mode=0o755)
        except FileExistsError:
            continue
        tier_dir = run_root / tier
        tier_dir.mkdir(mode=0o755)
        return run_id, tier_dir
    raise ProvenanceError("could not allocate a unique run directory")


def _relative_file(root: Path, relative: str | Path) -> Path:
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts or rel == Path("."):
        raise ProvenanceError(f"path must stay below the declared root: {relative}")
    path = root / rel
    try:
        path.relative_to(root)
    except ValueError as exc:
        raise ProvenanceError(f"path escapes declared root: {relative}") from exc
    return path


def hash_declared_inputs(root: Path | str, relative_paths: Iterable[str]) -> str:
    """Hash an explicit sorted file inventory including names and modes."""
    root = Path(root).resolve()
    digest = hashlib.sha256()
    paths = sorted(set(relative_paths))
    if not paths:
        raise ProvenanceError("declared input inventory is empty")
    for relative in paths:
        path = _relative_file(root, relative)
        try:
            st = path.lstat()
        except OSError as exc:
            raise ProvenanceError(f"declared input unavailable: {relative}") from exc
        if path.is_symlink() or not path.is_file():
            raise ProvenanceError(f"declared input is not a regular file: {relative}")
        digest.update(relative.encode("utf-8") + b"\0")
        digest.update(oct(st.st_mode & 0o777).encode("ascii") + b"\0")
        with path.open("rb") as fh:
            for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def _git(repo: Path, *args: str) -> bytes:
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), *args], check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ProvenanceError(f"cannot establish repository identity: git {' '.join(args)}") from exc
    return out.stdout


def _repository_entries(root: Path) -> list[tuple[str, Path, str, int]]:
    raw = _git(root, "ls-files", "-z", "--cached", "--others",
               "--exclude-standard")
    entries = []
    for rel_raw in sorted(set(part for part in raw.split(b"\0") if part)):
        rel = rel_raw.decode("utf-8", "surrogateescape")
        path = _relative_file(root, rel)
        try:
            st = path.lstat()
        except FileNotFoundError:
            entries.append((rel, path, "missing", 0))
            continue
        except OSError as exc:
            raise ProvenanceError("cannot inspect repository input") from exc
        mode = st.st_mode & 0o777
        if path.is_symlink():
            target = os.readlink(path)
            if os.path.isabs(target):
                raise ProvenanceError("repository symlink has an absolute target")
            resolved = (path.parent / target).resolve(strict=False)
            try:
                resolved.relative_to(root)
            except ValueError as exc:
                raise ProvenanceError("repository symlink escapes the checkout") from exc
            kind = "symlink"
        elif path.is_file():
            kind = "file"
        else:
            raise ProvenanceError("repository input is not a regular file or symlink")
        entries.append((rel, path, kind, mode))
    return entries


def _hash_repository_entries(entries: list[tuple[str, Path, str, int]]) -> str:
    digest = hashlib.sha256()
    for rel, path, kind, mode in entries:
        digest.update(rel.encode("utf-8", "surrogateescape") + b"\0")
        digest.update(kind.encode("ascii") + b"\0")
        digest.update(oct(mode).encode("ascii") + b"\0")
        if kind == "missing":
            continue
        if kind == "symlink":
            digest.update(os.readlink(path).encode("utf-8", "surrogateescape"))
        else:
            with path.open("rb") as fh:
                for chunk in iter(lambda: fh.read(1024 * 1024), b""):
                    digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def repository_identity(repo: Path | str) -> dict[str, Any]:
    """Hash the exact sanitized inventory that may be mounted for tier 1."""
    root = Path(repo).resolve()
    head = _git(root, "rev-parse", "HEAD").decode("ascii").strip()
    if not re.fullmatch(r"[0-9a-f]{40,64}", head):
        raise ProvenanceError("git returned an invalid HEAD identity")
    status = _git(root, "status", "--porcelain=v1", "-z",
                  "--untracked-files=all")
    entries = _repository_entries(root)
    return {"head": head, "dirty": bool(status),
            "status_sha256": sha256_bytes(status),
            "content_sha256": _hash_repository_entries(entries),
            "entry_count": len(entries)}


def stage_repository_snapshot(repo: Path | str,
                              destination: Path | str) -> dict[str, Any]:
    """Copy only tracked/nonignored inputs into one fresh run-owned snapshot."""
    root = Path(repo).resolve()
    dest = Path(destination)
    if dest.exists() or dest.is_symlink():
        raise ProvenanceError("repository snapshot destination already exists")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.mkdir(mode=0o700)
    try:
        identity = repository_identity(root)
        entries = _repository_entries(root)
        snapshot_entries = []
        for rel, source, kind, mode in entries:
            target = dest / rel
            if kind == "missing":
                snapshot_entries.append((rel, target, kind, mode))
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            if kind == "symlink":
                target.symlink_to(os.readlink(source))
            else:
                shutil.copyfile(source, target, follow_symlinks=False)
                target.chmod(mode)
            snapshot_entries.append((rel, target, kind, mode))
        if (_hash_repository_entries(snapshot_entries)
                != identity["content_sha256"]
                or repository_identity(root) != identity):
            raise ProvenanceError(
                "repository changed while the run-owned snapshot was staged")
        return identity
    except BaseException:
        shutil.rmtree(dest, ignore_errors=True)
        raise


def evidence_inventory(
    root: Path | str, *, exclude: Iterable[str] = ("manifest.json",),
    exclude_prefixes: Iterable[str] = ("share/",),
) -> list[dict[str, str]]:
    root = Path(root).resolve()
    excluded = set(exclude)
    prefixes = tuple(exclude_prefixes)
    rows: list[dict[str, str]] = []
    if not root.is_dir():
        raise ProvenanceError(f"evidence root is not a directory: {root}")
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root).as_posix()
        if rel in excluded or any(rel.startswith(prefix) for prefix in prefixes):
            continue
        if path.is_dir():
            continue
        if path.is_symlink():
            raise ProvenanceError(f"evidence must not contain a symlink: {rel}")
        if not path.is_file():
            raise ProvenanceError(f"evidence is not a regular file: {rel}")
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = None
        if text is not None:
            _assert_sanitized(text, f"evidence:{rel}")
        rows.append({"path": rel, "sha256": sha256_file(path)})
    return rows


def verify_evidence(root: Path | str, manifest: dict[str, Any]) -> None:
    validate_manifest(manifest)
    root = Path(root).resolve()
    expected = manifest["evidence"]["files"]
    actual = evidence_inventory(root)
    expected_paths = {row["path"] for row in expected}
    actual_paths = {row["path"] for row in actual}
    if expected_paths != actual_paths:
        missing = sorted(expected_paths - actual_paths)
        extra = sorted(actual_paths - expected_paths)
        raise ProvenanceError(
            f"evidence inventory mismatch: missing={missing!r} extra={extra!r}")
    actual_by_path = {row["path"]: row["sha256"] for row in actual}
    for row in expected:
        if actual_by_path[row["path"]] != row["sha256"]:
            raise ProvenanceError(f"evidence hash mismatch: {row['path']}")


def _require_keys(value: dict[str, Any], required: set[str], where: str) -> None:
    missing = sorted(required - value.keys())
    if missing:
        raise ProvenanceError(f"{where} missing keys: {', '.join(missing)}")


def _assert_sanitized(value: Any, path: str = "manifest") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if not isinstance(key, str) or _FORBIDDEN_KEYS.search(key):
                raise ProvenanceError(f"manifest is not sanitized: forbidden key at {path}")
            _assert_sanitized(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _assert_sanitized(child, f"{path}[{index}]")
    elif isinstance(value, str):
        if any(pattern.search(value) for pattern in _FORBIDDEN_VALUES):
            raise ProvenanceError(f"manifest is not sanitized: forbidden value at {path}")


def _utc_timestamp(value: Any, path: str) -> datetime:
    text = str(value)
    if not _UTC_RE.fullmatch(text):
        raise ProvenanceError(f"invalid {path}")
    try:
        return datetime.strptime(text, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=timezone.utc)
    except ValueError as exc:
        raise ProvenanceError(f"invalid {path}") from exc


def validate_manifest(manifest: dict[str, Any]) -> None:
    if not isinstance(manifest, dict):
        raise ProvenanceError("manifest must be an object")
    _assert_sanitized(manifest)
    _require_keys(manifest, {
        "schema_version", "command_contract_version", "run", "repository",
        "prime_agent", "image", "network", "teardown", "evidence",
    }, "manifest")
    if manifest["schema_version"] != SCHEMA_VERSION:
        raise ProvenanceError(f"unsupported schema_version: {manifest['schema_version']!r}")
    if manifest["command_contract_version"] != COMMAND_CONTRACT_VERSION:
        raise ProvenanceError("unsupported command_contract_version")
    run = manifest["run"]
    repo = manifest["repository"]
    prime = manifest["prime_agent"]
    image = manifest["image"]
    network = manifest["network"]
    teardown = manifest["teardown"]
    evidence = manifest["evidence"]
    for name, value in (("run", run), ("repository", repo),
                        ("network", network), ("teardown", teardown),
                        ("evidence", evidence)):
        if not isinstance(value, dict):
            raise ProvenanceError(f"{name} must be an object")
    _require_keys(run, {"id", "tier", "mode", "started_at", "finished_at", "status"}, "run")
    if (run["tier"] != "tier1" or run["mode"] not in {"pinned", "smoke"}
            or run["status"] not in {"passed", "failed"}):
        raise ProvenanceError("invalid run tier/mode/status")
    if not re.fullmatch(r"[0-9]{8}T[0-9]{6}Z-[0-9]+-[0-9a-f]{8}", str(run["id"])):
        raise ProvenanceError("invalid run.id")
    run_started = _utc_timestamp(run["started_at"], "run.started_at")
    run_finished = _utc_timestamp(run["finished_at"], "run.finished_at")
    if run_finished < run_started:
        raise ProvenanceError("run.finished_at precedes run.started_at")
    _require_keys(repo, {"head", "dirty", "status_sha256",
                         "content_sha256", "entry_count"}, "repository")
    if (not re.fullmatch(r"[0-9a-f]{40,64}", str(repo["head"]))
            or not isinstance(repo["dirty"], bool)
            or not _SHA256_RE.fullmatch(str(repo["status_sha256"]))
            or not _SHA256_RE.fullmatch(str(repo["content_sha256"]))
            or isinstance(repo["entry_count"], bool)
            or not isinstance(repo["entry_count"], int)
            or repo["entry_count"] < 0):
        raise ProvenanceError("invalid repository identity")
    if run["mode"] == "smoke":
        if prime is not None:
            raise ProvenanceError("smoke manifests require prime_agent=null")
    else:
        if not isinstance(prime, dict):
            raise ProvenanceError(
                "pinned manifests require requested selector provenance")
        _require_keys(prime, {"mode", "requested_version", "installed_version", "artifact"}, "prime_agent")
        requested = prime["requested_version"]
        installed = prime["installed_version"]
        artifact = prime["artifact"]
        if prime["mode"] != "pinned" or not _SEMVER_RE.fullmatch(str(requested)):
            raise ProvenanceError("invalid pinned Prime Agent selector")
        if installed is None:
            if artifact is not None or run["status"] != "failed":
                raise ProvenanceError("unavailable installed identity is valid only for failed runs")
        else:
            if (not _SEMVER_RE.fullmatch(str(installed))
                    or installed != requested):
                raise ProvenanceError("requested and installed Prime Agent versions differ")
            if (not isinstance(artifact, dict)
                    or set(artifact) != {"kind", "version", "executable_sha256"}
                    or artifact.get("kind") != "vendor-binary"
                    or artifact.get("version") != installed
                    or not _SHA256_RE.fullmatch(str(artifact.get("executable_sha256", "")))):
                raise ProvenanceError("prime_agent.artifact identity is invalid")
    if image is None:
        if run["status"] != "failed":
            raise ProvenanceError("passed manifests require image identity")
    else:
        if not isinstance(image, dict):
            raise ProvenanceError("image must be null or an object")
        _require_keys(image, {"id", "repo_digests", "dockerfile", "dockerfile_sha256",
                              "declared_input_sha256", "informational_tag", "os",
                              "architecture", "build_started_at", "build_finished_at"}, "image")
        if not _IMAGE_ID_RE.fullmatch(str(image["id"])):
            raise ProvenanceError("invalid image.id")
        if not isinstance(image["repo_digests"], list):
            raise ProvenanceError("image.repo_digests must be a list")
        for key in ("dockerfile_sha256", "declared_input_sha256"):
            if not _SHA256_RE.fullmatch(str(image[key])):
                raise ProvenanceError(f"invalid image.{key}")
        build_started = _utc_timestamp(
            image["build_started_at"], "image.build_started_at")
        build_finished = _utc_timestamp(
            image["build_finished_at"], "image.build_finished_at")
        if build_finished < build_started:
            raise ProvenanceError("image build finish precedes start")
    _require_keys(network, {"disconnected_at", "verified_absent"}, "network")
    if not isinstance(network["verified_absent"], bool):
        raise ProvenanceError("network.verified_absent must be boolean")
    if network["verified_absent"]:
        _utc_timestamp(network["disconnected_at"], "network.disconnected_at")
    elif run["status"] != "failed" or network["disconnected_at"] is not None:
        raise ProvenanceError("network absence was not verified")
    _require_keys(teardown, {"state", "verified_at"}, "teardown")
    if teardown["state"] not in {"absent", "unknown", "present"}:
        raise ProvenanceError("invalid teardown.state")
    _utc_timestamp(teardown["verified_at"], "teardown.verified_at")
    if run["status"] == "passed":
        if image is None or not network["verified_absent"]:
            raise ProvenanceError("passed runs require image and offline identity")
        if teardown["state"] != "absent":
            raise ProvenanceError("passed runs require verified absent teardown")
        if run["mode"] == "pinned" and (
                prime["installed_version"] is None or prime["artifact"] is None):
            raise ProvenanceError("passed pinned runs require installed artifact identity")
    _require_keys(evidence, {"files"}, "evidence")
    if not isinstance(evidence["files"], list):
        raise ProvenanceError("evidence.files must be a list")
    seen = set()
    for row in evidence["files"]:
        if not isinstance(row, dict) or set(row) != {"path", "sha256"}:
            raise ProvenanceError("invalid evidence file row")
        if row["path"] in seen or Path(row["path"]).is_absolute() or ".." in Path(row["path"]).parts:
            raise ProvenanceError("invalid or duplicate evidence path")
        seen.add(row["path"])
        if not _SHA256_RE.fullmatch(str(row["sha256"])):
            raise ProvenanceError("invalid evidence sha256")


def atomic_write_manifest(path: Path | str, manifest: dict[str, Any]) -> None:
    validate_manifest(manifest)
    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() or target.is_symlink():
        raise ProvenanceError(f"refusing to overwrite existing manifest: {target.name}")
    payload = canonical_json(manifest).encode("utf-8")
    fd, tmp_name = tempfile.mkstemp(prefix=f".{target.name}.", suffix=".tmp",
                                    dir=target.parent)
    tmp = Path(tmp_name)
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(payload)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, target)
        try:
            dir_fd = os.open(target.parent, os.O_RDONLY)
        except OSError:
            return
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    finally:
        try:
            tmp.unlink()
        except FileNotFoundError:
            pass


def _main() -> int:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    allocate = sub.add_parser("allocate")
    allocate.add_argument("results_root")
    allocate.add_argument("tier")
    repo = sub.add_parser("repository")
    repo.add_argument("repo")
    snapshot = sub.add_parser("snapshot")
    snapshot.add_argument("repo")
    snapshot.add_argument("destination")
    hash_inputs = sub.add_parser("hash-inputs")
    hash_inputs.add_argument("root")
    hash_inputs.add_argument("paths", nargs="+")
    hash_file = sub.add_parser("hash-file")
    hash_file.add_argument("path")
    now = sub.add_parser("now")
    args = parser.parse_args()
    if args.command == "allocate":
        run_id, tier_dir = allocate_run_tree(args.results_root, args.tier)
        print(run_id + "\t" + str(tier_dir.resolve()))
    elif args.command == "repository":
        print(canonical_json(repository_identity(args.repo)), end="")
    elif args.command == "snapshot":
        print(canonical_json(stage_repository_snapshot(
            args.repo, args.destination)), end="")
    elif args.command == "hash-inputs":
        print(hash_declared_inputs(args.root, args.paths))
    elif args.command == "hash-file":
        print(sha256_file(args.path))
    elif args.command == "now":
        print(utc_now())
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
