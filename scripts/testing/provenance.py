#!/usr/bin/env python3
"""Sanitized, atomic provenance evidence for disposable test runs.

This module is deliberately stdlib-only. It records identities and hashes, not
source content, credentials, endpoint values, or operator-local paths.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import shutil
import stat
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Any, Iterable

SCHEMA_VERSION = 2
COMMAND_CONTRACT_VERSION = "tier1-v2"
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



_OBSERVED_SEMVER_RE = re.compile(
    r"(?<![0-9A-Za-z.-])([0-9]+\.[0-9]+\.[0-9]+"
    r"(?:-[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?"
    r"(?:\+[0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?)(?![0-9A-Za-z.-])")
_SAFE_PLATFORM_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,63}$")


def parse_prime_agent_version(output: str) -> str:
    """Return one exact observed SemVer without normalizing prereleases."""
    matches = _OBSERVED_SEMVER_RE.findall(output)
    if len(matches) != 1:
        raise ProvenanceError("installed Prime Agent version is missing or ambiguous")
    return matches[0]


def _validate_image_fields(image: dict[str, Any]) -> None:
    dockerfile = image.get("dockerfile")
    if not isinstance(dockerfile, str):
        raise ProvenanceError("invalid image.dockerfile")
    pure = PurePosixPath(dockerfile)
    if (not dockerfile or dockerfile.startswith("/") or "\\" in dockerfile
            or pure == PurePosixPath(".") or ".." in pure.parts
            or pure.as_posix() != dockerfile):
        raise ProvenanceError("invalid image.dockerfile")
    if not isinstance(image.get("informational_tag"), str) or not re.fullmatch(
            r"prime-claw-test-tier1:[0-9a-f]{12}", image["informational_tag"]):
        raise ProvenanceError("invalid image.informational_tag")
    for field in ("os", "architecture"):
        value = image.get(field)
        if (not isinstance(value, str)
                or not re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,63}", value)):
            raise ProvenanceError(f"invalid image.{field}")


def image_identity(raw: dict[str, Any], *, expected_id: str,
                   dockerfile: str, dockerfile_sha256: str,
                   declared_input_sha256: str, informational_tag: str,
                   build_started_at: str, build_finished_at: str) -> dict[str, Any]:
    """Validate allow-listed inspect fields before any durable write.

    Repository digests are intentionally not retained: a local test build is
    identified by its iidfile ID, while registry names can reveal private
    endpoints or repository identity.
    """
    if not isinstance(raw, dict) or raw.get("Id") != expected_id:
        raise ProvenanceError("image inspect identity mismatched iidfile")
    if not _IMAGE_ID_RE.fullmatch(expected_id):
        raise ProvenanceError("invalid image ID")
    os_name = raw.get("Os")
    architecture = raw.get("Architecture")
    if (not isinstance(os_name, str) or not _SAFE_PLATFORM_RE.fullmatch(os_name)
            or not isinstance(architecture, str)
            or not _SAFE_PLATFORM_RE.fullmatch(architecture)):
        raise ProvenanceError("image inspect omitted or invalid platform identity")
    if (Path(dockerfile).is_absolute() or ".." in Path(dockerfile).parts
            or not _SHA256_RE.fullmatch(dockerfile_sha256)
            or not _SHA256_RE.fullmatch(declared_input_sha256)
            or not re.fullmatch(r"prime-claw-test-tier1:[0-9a-f]{12}", informational_tag)):
        raise ProvenanceError("invalid captured image build identity")
    _utc_timestamp(build_started_at, "image.build_started_at")
    _utc_timestamp(build_finished_at, "image.build_finished_at")
    safe = {
        "id": expected_id,
        "repo_digests": [],
        "dockerfile": dockerfile,
        "dockerfile_sha256": dockerfile_sha256,
        "declared_input_sha256": declared_input_sha256,
        "declared_input_hash_contract": "framed-sha256-v2",
        "informational_tag": informational_tag,
        "os": os_name,
        "architecture": architecture,
        "build_started_at": build_started_at,
        "build_finished_at": build_finished_at,
    }
    _validate_image_fields(safe)
    _assert_sanitized(safe)
    return safe


def write_sanitized_json(path: Path | str, value: Any) -> None:
    """Validate a bounded JSON value before writing it durably."""
    _assert_sanitized(value)
    target = Path(path)
    if target.exists() or target.is_symlink():
        raise ProvenanceError(f"refusing to overwrite evidence: {target.name}")
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = canonical_json(value)
    with target.open("x", encoding="utf-8") as fh:
        fh.write(payload)
        fh.flush()
        os.fsync(fh.fileno())

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
    return root / rel


def _open_root_fd(root: Path) -> int:
    flags = (os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
             | getattr(os, "O_NOFOLLOW", 0))
    try:
        fd = os.open(root, flags)
        if not stat.S_ISDIR(os.fstat(fd).st_mode):
            raise ProvenanceError("declared root is not a directory")
        return fd
    except OSError as exc:
        raise ProvenanceError("declared root is unsafe or unavailable") from exc


def _assert_root_binding(root: Path, root_fd: int) -> None:
    """Require the path to still name the directory held by root_fd."""
    try:
        check_fd = _open_root_fd(root)
    except ProvenanceError as exc:
        raise ProvenanceError("declared root changed during capture") from exc
    try:
        expected = os.fstat(root_fd)
        observed = os.fstat(check_fd)
        if (expected.st_dev, expected.st_ino) != (observed.st_dev, observed.st_ino):
            raise ProvenanceError("declared root changed during capture")
    finally:
        os.close(check_fd)


def _open_parent_fd(root: Path, relative: str | Path,
                    *, root_fd: int | None = None) -> tuple[int, str]:
    """Traverse descendants from one retained root fd without following links."""
    rel = Path(relative)
    _relative_file(root, rel)
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    nofollow = getattr(os, "O_NOFOLLOW", 0)
    fd = _open_root_fd(root) if root_fd is None else os.dup(root_fd)
    try:
        for part in rel.parts[:-1]:
            next_fd = os.open(part, flags | nofollow, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd, rel.parts[-1]
    except BaseException:
        os.close(fd)
        raise


def _open_created_parent_fd(root_fd: int, relative: str | Path) -> tuple[int, str]:
    """Create/traverse an owned destination below one retained root fd."""
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts or rel == Path("."):
        raise ProvenanceError(f"destination path escapes capture root: {relative}")
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    nofollow = getattr(os, "O_NOFOLLOW", 0)
    fd = os.dup(root_fd)
    try:
        for part in rel.parts[:-1]:
            try:
                os.mkdir(part, 0o700, dir_fd=fd)
            except FileExistsError:
                pass
            next_fd = os.open(part, flags | nofollow, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        return fd, rel.parts[-1]
    except BaseException:
        os.close(fd)
        raise


def _regular_digest(root: Path, relative: str,
                    destination: Path | None = None, *,
                    root_fd: int | None = None,
                    destination_root_fd: int | None = None) -> tuple[str, int]:
    """Hash/copy one file from retained source/destination directory fds."""
    if destination is not None and destination_root_fd is not None:
        raise ProvenanceError("ambiguous capture destination")
    try:
        parent_fd, name = _open_parent_fd(root, relative, root_fd=root_fd)
    except OSError as exc:
        raise ProvenanceError(f"input path is unsafe or unavailable: {relative}") from exc
    source_fd = None
    output_fd = None
    output = None
    destination_parent_fd = None
    try:
        before = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        if not stat.S_ISREG(before.st_mode):
            raise ProvenanceError(f"input is not a regular file: {relative}")
        source_fd = os.open(
            name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=parent_fd)
        opened = os.fstat(source_fd)
        if (before.st_dev, before.st_ino, before.st_mode) != (
                opened.st_dev, opened.st_ino, opened.st_mode):
            raise ProvenanceError(f"input changed while it was opened: {relative}")
        if destination_root_fd is not None:
            destination_parent_fd, destination_name = _open_created_parent_fd(
                destination_root_fd, relative)
            output_fd = os.open(
                destination_name,
                os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0),
                0o600, dir_fd=destination_parent_fd)
        elif destination is not None:
            destination.parent.mkdir(parents=True, exist_ok=True)
            output = destination.open("xb")
        digest = hashlib.sha256()
        while True:
            chunk = os.read(source_fd, 1024 * 1024)
            if not chunk:
                break
            digest.update(chunk)
            if output_fd is not None:
                view = memoryview(chunk)
                while view:
                    written = os.write(output_fd, view)
                    view = view[written:]
            elif output is not None:
                output.write(chunk)
        after = os.fstat(source_fd)
        stable = (opened.st_dev, opened.st_ino, opened.st_mode,
                  opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns)
        observed = (after.st_dev, after.st_ino, after.st_mode,
                    after.st_size, after.st_mtime_ns, after.st_ctime_ns)
        if observed != stable:
            raise ProvenanceError(f"input changed while it was read: {relative}")
        captured_mode = stat.S_IMODE(opened.st_mode)
        if output_fd is not None:
            os.fchmod(output_fd, captured_mode)
            os.fsync(output_fd)
        elif output is not None:
            output.flush()
            output.close()
            output = None
            destination.chmod(captured_mode)
        return digest.hexdigest(), captured_mode
    except OSError as exc:
        raise ProvenanceError(f"input path is unsafe or unavailable: {relative}") from exc
    finally:
        if output is not None:
            output.close()
        if output_fd is not None:
            os.close(output_fd)
        if destination_parent_fd is not None:
            os.close(destination_parent_fd)
        if source_fd is not None:
            os.close(source_fd)
        os.close(parent_fd)


def _safe_link_target(root: Path, relative: str, *,
                      root_fd: int | None = None) -> str:
    try:
        parent_fd, name = _open_parent_fd(root, relative, root_fd=root_fd)
    except OSError as exc:
        raise ProvenanceError(f"repository link path is unsafe: {relative}") from exc
    try:
        before = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        if not stat.S_ISLNK(before.st_mode):
            raise ProvenanceError(f"repository input changed type: {relative}")
        target = os.readlink(name, dir_fd=parent_fd)
        after = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        if (before.st_dev, before.st_ino, before.st_mode,
                before.st_mtime_ns, before.st_ctime_ns) != (
                after.st_dev, after.st_ino, after.st_mode,
                after.st_mtime_ns, after.st_ctime_ns):
            raise ProvenanceError(f"repository link changed while read: {relative}")
    except OSError as exc:
        raise ProvenanceError(f"repository link is unsafe or unavailable: {relative}") from exc
    finally:
        os.close(parent_fd)
    if os.path.isabs(target):
        raise ProvenanceError("repository symlink has an absolute target")
    combined = os.path.normpath(os.path.join(os.path.dirname(relative), target))
    if combined == ".." or combined.startswith("../"):
        raise ProvenanceError("repository symlink escapes the checkout")
    return target

def _framed_hash(records: Iterable[dict[str, Any]], *, domain: str) -> str:
    """Hash canonical records with a domain and explicit byte lengths."""
    digest = hashlib.sha256()
    digest.update(("prime-claw:" + domain + "\0").encode("ascii"))
    for record in records:
        payload = canonical_json(record).encode("utf-8")
        digest.update(len(payload).to_bytes(8, "big"))
        digest.update(payload)
    return digest.hexdigest()


def hash_declared_inputs(root: Path | str, relative_paths: Iterable[str]) -> str:
    """Hash an explicit inventory from one no-follow anchored root fd."""
    root_path = Path(os.path.abspath(root))
    paths = sorted(set(relative_paths))
    if not paths:
        raise ProvenanceError("declared input inventory is empty")
    root_fd = _open_root_fd(root_path)
    try:
        records = []
        for relative in paths:
            _relative_file(root_path, relative)
            digest, captured_mode = _regular_digest(
                root_path, relative, root_fd=root_fd)
            records.append({"path": Path(relative).as_posix(), "kind": "file",
                            "mode": captured_mode,
                            "content_sha256": digest})
        _assert_root_binding(root_path, root_fd)
        return _framed_hash(records, domain="declared-inputs-v2")
    finally:
        os.close(root_fd)

def _git(repo: Path, *args: str) -> bytes:
    try:
        out = subprocess.run(
            ["git", "-C", str(repo), *args], check=True,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ProvenanceError(f"cannot establish repository identity: git {' '.join(args)}") from exc
    return out.stdout


def _repository_head_status(root: Path) -> tuple[str, bytes]:
    head = _git(root, "rev-parse", "HEAD").decode("ascii").strip()
    if not re.fullmatch(r"[0-9a-f]{40,64}", head):
        raise ProvenanceError("git returned an invalid HEAD identity")
    status_bytes = _git(root, "status", "--porcelain=v1", "-z",
                        "--untracked-files=all")
    return head, status_bytes


def _repository_paths(root: Path) -> list[str]:
    raw = _git(root, "ls-files", "-z", "--cached", "--others",
               "--exclude-standard")
    return [part.decode("utf-8", "surrogateescape")
            for part in sorted(set(item for item in raw.split(b"\0") if item))]


def _repository_entries(root: Path, root_fd: int) -> list[tuple[str, str, int]]:
    entries = []
    for rel in _repository_paths(root):
        _relative_file(root, rel)
        try:
            parent_fd, name = _open_parent_fd(root, rel, root_fd=root_fd)
            try:
                st = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
            finally:
                os.close(parent_fd)
        except FileNotFoundError:
            entries.append((rel, "missing", 0))
            continue
        except OSError as exc:
            raise ProvenanceError(
                f"repository input path is unsafe or unavailable: {rel}") from exc
        mode = stat.S_IMODE(st.st_mode)
        if stat.S_ISLNK(st.st_mode):
            _safe_link_target(root, rel, root_fd=root_fd)
            kind = "symlink"
        elif stat.S_ISREG(st.st_mode):
            kind = "file"
        else:
            raise ProvenanceError(
                "repository input is not a regular file or symlink")
        entries.append((rel, kind, mode))
    return entries


def _repository_records(root: Path, root_fd: int,
                        entries: list[tuple[str, str, int]], *,
                        destination_root_fd: int | None = None
                        ) -> list[dict[str, Any]]:
    records = []
    for rel, kind, mode in entries:
        record: dict[str, Any] = {"path": rel, "kind": kind, "mode": mode}
        if kind == "missing":
            record["content_sha256"] = None
        elif kind == "symlink":
            link_target = _safe_link_target(root, rel, root_fd=root_fd)
            record["target"] = link_target
            if destination_root_fd is not None:
                parent_fd, name = _open_created_parent_fd(destination_root_fd, rel)
                try:
                    os.symlink(link_target, name, dir_fd=parent_fd)
                finally:
                    os.close(parent_fd)
        else:
            digest, captured_mode = _regular_digest(
                root, rel, root_fd=root_fd,
                destination_root_fd=destination_root_fd)
            record["content_sha256"] = digest
            record["mode"] = captured_mode
        records.append(record)
    return records


def _validate_captured_links(records: list[dict[str, Any]]) -> None:
    """Resolve recorded link chains lexically without reopening destination paths."""
    links = {record["path"]: record["target"] for record in records
             if record["kind"] == "symlink"}
    limit = len(links) + 1
    for original in links:
        pending = original.split("/")
        resolved: list[str] = []
        followed = 0
        while pending:
            part = pending.pop(0)
            if part in ("", "."):
                continue
            if part == "..":
                if not resolved:
                    raise ProvenanceError(
                        "repository symlink chain escapes the captured snapshot")
                resolved.pop()
                continue
            resolved.append(part)
            candidate = "/".join(resolved)
            if candidate in links:
                followed += 1
                if followed > limit:
                    raise ProvenanceError("repository symlink chain contains a cycle")
                resolved.pop()
                target_parts = links[candidate].split("/")
                pending = target_parts + pending
        # Direct targets were already checked; this final guard documents the
        # invariant for chains that consume multiple parent components.
        if not resolved:
            continue

def _identity(head: str, status_bytes: bytes,
              records: list[dict[str, Any]]) -> dict[str, Any]:
    return {"head": head, "dirty": bool(status_bytes),
            "status_sha256": sha256_bytes(status_bytes),
            "content_sha256": _framed_hash(records, domain="repository-v2"),
            "entry_count": len(records),
            "content_hash_contract": "framed-sha256-v2"}


def repository_identity(repo: Path | str) -> dict[str, Any]:
    """Hash exact inputs through one retained no-follow repository root fd."""
    root = Path(os.path.abspath(repo))
    root_fd = _open_root_fd(root)
    try:
        head, status_bytes = _repository_head_status(root)
        _assert_root_binding(root, root_fd)
        entries = _repository_entries(root, root_fd)
        records = _repository_records(root, root_fd, entries)
        _assert_root_binding(root, root_fd)
        return _identity(head, status_bytes, records)
    finally:
        os.close(root_fd)


def stage_repository_snapshot(repo: Path | str,
                              destination: Path | str) -> dict[str, Any]:
    """Capture repository inputs through retained source/destination root fds."""
    root = Path(os.path.abspath(repo))
    dest = Path(os.path.abspath(destination))
    if dest.exists() or dest.is_symlink():
        raise ProvenanceError("repository snapshot destination already exists")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.mkdir(mode=0o700)
    root_fd = None
    destination_root_fd = None
    try:
        root_fd = _open_root_fd(root)
        destination_root_fd = _open_root_fd(dest)
        head, status_bytes = _repository_head_status(root)
        _assert_root_binding(root, root_fd)
        entries = _repository_entries(root, root_fd)
        records = _repository_records(
            root, root_fd, entries, destination_root_fd=destination_root_fd)
        captured = _identity(head, status_bytes, records)
        _validate_captured_links(records)
        _assert_root_binding(root, root_fd)
        _assert_root_binding(dest, destination_root_fd)
        # HEAD/status/path inventory must stay stable across capture. File bytes
        # and modes are bound to the opened fds and destination writes remain
        # below the retained snapshot fd.
        after_head, after_status = _repository_head_status(root)
        _assert_root_binding(root, root_fd)
        if (after_head != head or after_status != status_bytes
                or _repository_paths(root) != [rel for rel, _kind, _mode in entries]):
            raise ProvenanceError(
                "repository changed while the run-owned snapshot was staged")
        _assert_root_binding(root, root_fd)
        _assert_root_binding(dest, destination_root_fd)
        return captured
    except BaseException:
        shutil.rmtree(dest, ignore_errors=True)
        raise
    finally:
        if destination_root_fd is not None:
            os.close(destination_root_fd)
        if root_fd is not None:
            os.close(root_fd)

def evidence_inventory(
    root: Path | str, *, exclude: Iterable[str] = ("manifest.json",),
    exclude_prefixes: Iterable[str] = ("share/",),
) -> list[dict[str, str]]:
    root_path = Path(root)
    if root_path.is_symlink():
        raise ProvenanceError("evidence root must not be a symlink")
    root = root_path.resolve()
    excluded = set(exclude)
    prefixes = tuple(exclude_prefixes)
    rows: list[dict[str, str]] = []
    if not root.is_dir():
        raise ProvenanceError(f"evidence root is not a directory: {root}")
    for path in sorted(root.rglob("*")):
        rel = path.relative_to(root).as_posix()
        if rel in excluded or any(rel.startswith(prefix) for prefix in prefixes):
            continue
        if path.is_symlink():
            raise ProvenanceError(f"evidence must not contain a symlink: {rel}")
        if path.is_dir():
            continue
        try:
            mode = path.lstat().st_mode
        except OSError as exc:
            raise ProvenanceError(f"evidence entry is unavailable: {rel}") from exc
        if not stat.S_ISREG(mode):
            raise ProvenanceError(f"evidence is not a regular file: {rel}")
        try:
            raw = path.read_bytes()
            text = raw.decode("utf-8", "strict")
        except UnicodeDecodeError as exc:
            raise ProvenanceError(
                f"evidence text has an unknown encoding: {rel}") from exc
        _assert_sanitized(text, f"evidence:{rel}")
        rows.append({"path": rel, "sha256": sha256_bytes(raw)})
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
    unknown = sorted(value.keys() - required)
    if missing or unknown:
        details = []
        if missing:
            details.append(f"missing keys: {', '.join(missing)}")
        if unknown:
            details.append(f"unknown keys: {', '.join(unknown)}")
        raise ProvenanceError(f"{where} " + "; ".join(details))


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
    _require_keys(run, {"id", "tier", "mode", "started_at", "finished_at",
                        "status", "failure_codes"}, "run")
    if (run["tier"] != "tier1" or run["mode"] not in {"pinned", "smoke"}
            or run["status"] not in {"passed", "failed"}):
        raise ProvenanceError("invalid run tier/mode/status")
    if not re.fullmatch(r"[0-9]{8}T[0-9]{6}Z-[0-9]+-[0-9a-f]{8}", str(run["id"])):
        raise ProvenanceError("invalid run.id")
    if (not isinstance(run["failure_codes"], list)
            or any(not isinstance(code, str)
                   or not re.fullmatch(r"[a-z][a-z0-9-]{1,63}", code)
                   for code in run["failure_codes"])
            or len(set(run["failure_codes"])) != len(run["failure_codes"])):
        raise ProvenanceError("invalid run.failure_codes")
    if ((run["status"] == "passed" and run["failure_codes"])
            or (run["status"] == "failed" and not run["failure_codes"])):
        raise ProvenanceError("run status and failure_codes disagree")
    run_started = _utc_timestamp(run["started_at"], "run.started_at")
    run_finished = _utc_timestamp(run["finished_at"], "run.finished_at")
    if run_finished < run_started:
        raise ProvenanceError("run.finished_at precedes run.started_at")
    _require_keys(repo, {"head", "dirty", "status_sha256",
                         "content_sha256", "entry_count",
                         "content_hash_contract"}, "repository")
    if (not re.fullmatch(r"[0-9a-f]{40,64}", str(repo["head"]))
            or not isinstance(repo["dirty"], bool)
            or not _SHA256_RE.fullmatch(str(repo["status_sha256"]))
            or not _SHA256_RE.fullmatch(str(repo["content_sha256"]))
            or isinstance(repo["entry_count"], bool)
            or not isinstance(repo["entry_count"], int)
            or repo["entry_count"] < 0
            or repo["content_hash_contract"] != "framed-sha256-v2"):
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
            try:
                observed = parse_prime_agent_version(str(installed))
            except ProvenanceError as exc:
                raise ProvenanceError("installed Prime Agent version is invalid") from exc
            if observed != installed:
                raise ProvenanceError("installed Prime Agent version is invalid")
            if (not isinstance(artifact, dict)
                    or set(artifact) != {"kind", "version", "executable_sha256"}
                    or artifact.get("kind") != "vendor-binary"
                    or artifact.get("version") != installed
                    or not _SHA256_RE.fullmatch(str(artifact.get("executable_sha256", "")))):
                raise ProvenanceError("prime_agent.artifact identity is invalid")
            if run["status"] == "passed" and installed != requested:
                raise ProvenanceError(
                    "passed run requested and installed versions differ")
    if image is None:
        if run["status"] != "failed":
            raise ProvenanceError("passed manifests require image identity")
    else:
        if not isinstance(image, dict):
            raise ProvenanceError("image must be null or an object")
        _require_keys(image, {"id", "repo_digests", "dockerfile", "dockerfile_sha256",
                              "declared_input_sha256", "declared_input_hash_contract",
                              "informational_tag", "os", "architecture",
                              "build_started_at", "build_finished_at"}, "image")
        if not _IMAGE_ID_RE.fullmatch(str(image["id"])):
            raise ProvenanceError("invalid image.id")
        if image["repo_digests"] != []:
            raise ProvenanceError("image.repo_digests must be an empty safe list")
        _validate_image_fields(image)
        if image["declared_input_hash_contract"] != "framed-sha256-v2":
            raise ProvenanceError("invalid image declared-input hash contract")
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
    _require_keys(teardown, {"state", "verified_at", "remove_outcome",
                             "inspect_outcome", "clean"}, "teardown")
    if teardown["state"] not in {"absent", "unknown", "present"}:
        raise ProvenanceError("invalid teardown.state")
    outcomes = {"clean", "ordinary_nonzero", "timed_out", "interrupted",
                "launch_error", "reap_timeout", "not_needed", "not_run",
                "identity_refused"}
    if (teardown["remove_outcome"] not in outcomes
            or teardown["inspect_outcome"] not in outcomes
            or not isinstance(teardown["clean"], bool)):
        raise ProvenanceError("invalid teardown command accounting")
    if teardown["clean"] and teardown["state"] != "absent":
        raise ProvenanceError("clean teardown requires absence")
    if teardown["clean"] and (
            teardown["remove_outcome"] not in {"clean", "ordinary_nonzero", "not_needed"}
            or teardown["inspect_outcome"] not in {"ordinary_nonzero", "not_needed"}):
        raise ProvenanceError("clean teardown contradicts command outcomes")
    _utc_timestamp(teardown["verified_at"], "teardown.verified_at")
    if run["status"] == "passed":
        if image is None or not network["verified_absent"]:
            raise ProvenanceError("passed runs require image and offline identity")
        if teardown["state"] != "absent" or not teardown["clean"]:
            raise ProvenanceError("passed runs require clean verified absent teardown")
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
    build_input = sub.add_parser("build-input")
    build_input.add_argument("root")
    build_input.add_argument("path")
    capture_image = sub.add_parser("capture-image")
    capture_image.add_argument("path")
    capture_image.add_argument("expected_id")
    capture_image.add_argument("dockerfile")
    capture_image.add_argument("dockerfile_sha256")
    capture_image.add_argument("declared_input_sha256")
    capture_image.add_argument("informational_tag")
    capture_image.add_argument("build_started_at")
    capture_image.add_argument("build_finished_at")
    parse_version = sub.add_parser("parse-version")
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
    elif args.command == "build-input":
        root = Path(args.root)
        print(sha256_file(root / args.path) + "\t" +
              hash_declared_inputs(root, [args.path]))
    elif args.command == "capture-image":
        try:
            rows = json.load(__import__("sys").stdin)
            if not isinstance(rows, list) or len(rows) != 1:
                raise ProvenanceError("image inspect must return exactly one row")
            safe = image_identity(
                rows[0], expected_id=args.expected_id,
                dockerfile=args.dockerfile,
                dockerfile_sha256=args.dockerfile_sha256,
                declared_input_sha256=args.declared_input_sha256,
                informational_tag=args.informational_tag,
                build_started_at=args.build_started_at,
                build_finished_at=args.build_finished_at)
            write_sanitized_json(args.path, safe)
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError) as exc:
            raise ProvenanceError("invalid image inspect encoding or JSON") from exc
    elif args.command == "parse-version":
        print(parse_prime_agent_version(__import__("sys").stdin.read()))
    elif args.command == "now":
        print(utc_now())
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
