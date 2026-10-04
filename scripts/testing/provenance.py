#!/usr/bin/env python3
"""Sanitized, atomic provenance evidence for disposable test runs.

This module is deliberately stdlib-only. It records identities and hashes, not
source content, credentials, endpoint values, or operator-local paths.
"""
from __future__ import annotations

import ctypes
import errno
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import secrets
import sys
import shutil
import stat
import subprocess
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Iterable

SCHEMA_VERSION = 2
COMMAND_CONTRACT_VERSION = "tier1-v2"
MAX_EVIDENCE_BYTES = 16 * 1024 * 1024
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


@dataclass(frozen=True)
class ObjectBinding:
    dev: int
    ino: int
    mode_type: int

    @classmethod
    def from_stat(cls, value: os.stat_result) -> "ObjectBinding":
        return cls(value.st_dev, value.st_ino, stat.S_IFMT(value.st_mode))

    @classmethod
    def decode(cls, raw: str) -> "ObjectBinding":
        if not re.fullmatch(r"[0-9]+:[0-9]+:[0-9]+", raw):
            raise ProvenanceError("invalid object binding")
        return cls(*(int(part) for part in raw.split(":")))

    def encode(self) -> str:
        return f"{self.dev}:{self.ino}:{self.mode_type}"


@dataclass
class OwnedDirectory:
    path: Path                 # diagnostic only; descendants use fd
    fd: int
    binding: ObjectBinding
    parent_fd: int | None = None
    name: str | None = None

    def close(self) -> None:
        if self.fd >= 0:
            os.close(self.fd)
            self.fd = -1
        if self.parent_fd is not None and self.parent_fd >= 0:
            os.close(self.parent_fd)
            self.parent_fd = None

    def __enter__(self) -> "OwnedDirectory":
        return self

    def __exit__(self, *_args: object) -> None:
        self.close()


def open_owned_directory(
    path: Path | str,
    binding: str | ObjectBinding,
    *,
    retain_parent: bool = False,
) -> OwnedDirectory:
    """Open every path component without following links and prove binding."""
    root = Path(os.path.abspath(path))
    expected = ObjectBinding.decode(binding) if isinstance(binding, str) else binding
    parent_fd = None
    fd = None
    try:
        if retain_parent:
            fd, parent_fd, name = _open_root_fd(root, retain_parent=True)
        else:
            fd = _open_root_fd(root)
            name = root.name or None
        observed = ObjectBinding.from_stat(os.fstat(fd))
        if observed != expected or observed.mode_type != stat.S_IFDIR:
            raise ProvenanceError("owned directory binding changed; refusing access")
        return OwnedDirectory(root, fd, expected, parent_fd, name)
    except BaseException:
        if fd is not None:
            os.close(fd)
        if parent_fd is not None:
            os.close(parent_fd)
        raise


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
            r"prime-claw-test-(?:tier1|prime-agent-builder):[0-9a-f]{12}",
            image["informational_tag"]):
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
            or not re.fullmatch(
                r"prime-claw-test-(?:tier1|prime-agent-builder):[0-9a-f]{12}",
                informational_tag)):
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


def artifact_identity(version: str, raw: bytes | str) -> dict[str, str]:
    """Validate one sha256sum observation before constructing safe metadata."""
    try:
        text = raw.decode("utf-8", "strict") if isinstance(raw, bytes) else raw
    except UnicodeDecodeError as exc:
        raise ProvenanceError("installed artifact observation has unknown encoding") from exc
    observed_version = parse_prime_agent_version(version)
    lines = text.splitlines()
    if len(lines) != 1:
        raise ProvenanceError("installed artifact observation is invalid")
    match = re.fullmatch(r"([0-9a-f]{64})[ \t]+\*?[^\r\n]+", lines[0])
    if match is None:
        raise ProvenanceError("installed artifact observation is invalid")
    safe = {"kind": "vendor-binary", "version": observed_version,
            "executable_sha256": match.group(1)}
    _assert_sanitized(safe)
    return safe


def _rename_with_flags(
    source_fd: int, source: str, target_fd: int, target: str, flag: int,
) -> None:
    """Use the platform atomic rename primitive; never emulate it."""
    libc = ctypes.CDLL(None, use_errno=True)
    source_b = os.fsencode(source)
    target_b = os.fsencode(target)
    try:
        if sys.platform.startswith("linux"):
            call = libc.renameat2
            call.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int,
                             ctypes.c_char_p, ctypes.c_uint]
        elif sys.platform == "darwin":
            call = libc.renameatx_np
            call.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int,
                             ctypes.c_char_p, ctypes.c_uint]
        else:
            raise ProvenanceError("atomic rename flags are unavailable")
    except AttributeError as exc:
        raise ProvenanceError("atomic rename flags are unavailable") from exc
    call.restype = ctypes.c_int
    if call(source_fd, source_b, target_fd, target_b, flag) != 0:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code), target)


def _rename_noreplace(source_fd: int, source: str,
                      target_fd: int, target: str) -> None:
    # Linux RENAME_NOREPLACE=1; Darwin RENAME_EXCL=4.
    _rename_with_flags(source_fd, source, target_fd, target,
                       1 if sys.platform.startswith("linux") else 4)


def _rename_exchange(source_fd: int, source: str,
                     target_fd: int, target: str) -> None:
    # Linux RENAME_EXCHANGE and Darwin RENAME_SWAP are both 2.
    _rename_with_flags(source_fd, source, target_fd, target, 2)


def _write_all(fd: int, payload: bytes) -> None:
    view = memoryview(payload)
    while view:
        written = os.write(fd, view)
        if written <= 0:
            raise ProvenanceError("short evidence write")
        view = view[written:]


def _read_fd_bytes(fd: int, *, label: str) -> bytes:
    os.lseek(fd, 0, os.SEEK_SET)
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = os.read(fd, min(1024 * 1024, MAX_EVIDENCE_BYTES + 1 - total))
        if not chunk:
            break
        chunks.append(chunk)
        total += len(chunk)
        if total > MAX_EVIDENCE_BYTES:
            raise ProvenanceError(f"{label} is too large")
    return b"".join(chunks)


def _publication_directory_fd(root: OwnedDirectory) -> int:
    created = None
    try:
        os.mkdir(".publication", 0o700, dir_fd=root.fd)
        created = ObjectBinding.from_stat(os.stat(
            ".publication", dir_fd=root.fd, follow_symlinks=False))
        os.fsync(root.fd)
    except FileExistsError:
        pass
    try:
        fd = os.open(
            ".publication",
            os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
            | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
            dir_fd=root.fd,
        )
    except OSError as exc:
        raise ProvenanceError("publication namespace is unsafe") from exc
    observed = os.fstat(fd)
    if created is not None and ObjectBinding.from_stat(observed) != created:
        os.close(fd)
        raise ProvenanceError("publication namespace changed while opened")
    if not stat.S_ISDIR(observed.st_mode) or stat.S_IMODE(observed.st_mode) & 0o077:
        os.close(fd)
        raise ProvenanceError("publication namespace is not private")
    return fd


def _stage_owned_bytes(root: OwnedDirectory, payload: bytes) -> tuple[int, str, ObjectBinding]:
    publication_fd = _publication_directory_fd(root)
    stage = f"stage-{secrets.token_hex(16)}"
    stage_fd = None
    try:
        stage_fd = os.open(
            stage,
            os.O_RDWR | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_CLOEXEC", 0),
            0o600,
            dir_fd=publication_fd,
        )
        _write_all(stage_fd, payload)
        os.fsync(stage_fd)
        binding = ObjectBinding.from_stat(os.fstat(stage_fd))
        if binding.mode_type != stat.S_IFREG:
            raise ProvenanceError("staged evidence is not a regular file")
        return publication_fd, stage, binding
    except BaseException:
        os.close(publication_fd)
        raise
    finally:
        if stage_fd is not None:
            os.close(stage_fd)


def _verify_published_bytes(parent_fd: int, name: str,
                            binding: ObjectBinding, payload: bytes) -> None:
    fd = None
    try:
        fd = os.open(
            name,
            os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_CLOEXEC", 0),
            dir_fd=parent_fd,
        )
        observed = ObjectBinding.from_stat(os.fstat(fd))
        if observed != binding or observed.mode_type != stat.S_IFREG:
            raise ProvenanceError("published evidence binding changed")
        if _read_fd_bytes(fd, label="published evidence") != payload:
            raise ProvenanceError("published evidence bytes changed")
    except OSError as exc:
        raise ProvenanceError("published evidence is unsafe or unavailable") from exc
    finally:
        if fd is not None:
            os.close(fd)


def _publish_owned_bytes(root: OwnedDirectory, relative: str | Path,
                         payload: bytes) -> ObjectBinding:
    """Atomically publish one new file without replacing any target."""
    parent_fd, name = _open_created_parent_fd(root.fd, relative)
    publication_fd = None
    try:
        publication_fd, stage, binding = _stage_owned_bytes(root, payload)
        try:
            _rename_noreplace(publication_fd, stage, parent_fd, name)
        except FileExistsError as exc:
            raise ProvenanceError(f"refusing to overwrite evidence: {name}") from exc
        _verify_published_bytes(parent_fd, name, binding, payload)
        os.fsync(parent_fd)
        os.fsync(root.fd)
        return binding
    except OSError as exc:
        if exc.errno == errno.EEXIST:
            raise ProvenanceError(f"refusing to overwrite evidence: {name}") from exc
        raise ProvenanceError("atomic evidence publication failed") from exc
    finally:
        if publication_fd is not None:
            os.close(publication_fd)
        os.close(parent_fd)


def write_sanitized_json(root: OwnedDirectory, relative: str | Path,
                         value: Any) -> ObjectBinding:
    """Validate and create one sanitized JSON file below a live capability."""
    _assert_sanitized(value)
    _verify_owned_public_name(root)
    published = _publish_owned_bytes(
        root, relative, canonical_json(value).encode("utf-8"))
    _verify_owned_public_name(root)
    return published


def replace_sanitized_json(
    root: OwnedDirectory,
    relative: str | Path,
    value: Any,
    *,
    expected_existing: ObjectBinding,
) -> ObjectBinding:
    """Atomically replace one exact owned JSON object with a non-green record."""
    _assert_sanitized(value)
    if not isinstance(value, dict) or value.get("status") != "failed":
        raise ProvenanceError("sanitized JSON replacement must be non-green")
    payload = canonical_json(value).encode("utf-8")
    published, displaced = _exchange_public_entry_bytes(root, relative, payload)
    if displaced != expected_existing:
        raise ProvenanceError(
            "sanitized JSON target changed; failed replacement published")
    return published


def invalidate_sanitized_json(
    root: OwnedDirectory,
    relative: str | Path,
    *,
    reason: str,
) -> ObjectBinding | None:
    """Atomically displace any public entry with a minimal failed record."""
    if not re.fullmatch(r"[a-z][a-z0-9-]{1,63}", reason):
        raise ProvenanceError("invalid sanitized JSON invalidation reason")
    payload = canonical_json({
        "invalidated": True,
        "reason": reason,
        "status": "failed",
    }).encode("utf-8")
    try:
        published, _displaced = _exchange_public_entry_bytes(
            root, relative, payload)
        return published
    except ProvenanceError as exc:
        cause = exc.__cause__
        if isinstance(cause, OSError) and cause.errno == errno.ENOENT:
            return None
        raise


def read_sanitized_json(root: OwnedDirectory, relative: str | Path) -> Any:
    parent_fd, name = _open_parent_fd(root, relative)
    try:
        raw = _read_evidence_file(parent_fd, name, str(PurePosixPath(relative)))
    finally:
        os.close(parent_fd)
    try:
        value = json.loads(raw.decode("utf-8", "strict"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProvenanceError("sanitized JSON is unreadable") from exc
    _assert_sanitized(value)
    return value


def _directory_open_flags() -> int:
    return (os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
            | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0))


def _verify_owned_public_name(root: OwnedDirectory) -> None:
    check_fd = None
    try:
        if root.parent_fd is not None and root.name is not None:
            check_fd = os.open(
                root.name, _directory_open_flags(), dir_fd=root.parent_fd)
        else:
            check_fd = _open_root_fd(root.path)
        if ObjectBinding.from_stat(os.fstat(check_fd)) != root.binding:
            raise ProvenanceError("owned directory public binding changed")
    except (OSError, ProvenanceError) as exc:
        if (isinstance(exc, ProvenanceError)
                and str(exc) == "owned directory public binding changed"):
            raise
        raise ProvenanceError("owned directory public binding changed") from exc
    finally:
        if check_fd is not None:
            os.close(check_fd)


def _create_owned_directory_child(
    parent: OwnedDirectory, name: str, *, mode: int = 0o700,
) -> OwnedDirectory:
    if not name or name in {".", ".."} or "/" in name:
        raise ProvenanceError("invalid owned directory name")
    stage = f".prime-claw-directory-{secrets.token_hex(16)}"
    fd = None
    try:
        os.mkdir(stage, mode, dir_fd=parent.fd)
        created = ObjectBinding.from_stat(os.stat(
            stage, dir_fd=parent.fd, follow_symlinks=False))
        fd = os.open(stage, _directory_open_flags(), dir_fd=parent.fd)
        binding = ObjectBinding.from_stat(os.fstat(fd))
        if binding != created:
            raise ProvenanceError(
                "owned directory changed while it was opened")
        _rename_noreplace(parent.fd, stage, parent.fd, name)
        owned = OwnedDirectory(
            parent.path / name, fd, binding, os.dup(parent.fd), name)
        fd = None
        try:
            _verify_owned_public_name(parent)
            _verify_owned_public_name(owned)
            os.fsync(parent.fd)
            return owned
        except BaseException:
            owned.close()
            raise
    except OSError as exc:
        raise ProvenanceError("owned directory publication failed") from exc
    finally:
        if fd is not None:
            os.close(fd)


def _open_or_create_results_root(path: Path | str) -> OwnedDirectory:
    """Bind an existing root or publish one exact newly-created directory."""
    root = Path(os.path.abspath(path))
    if root == Path("/"):
        fd = _open_root_fd(root)
        binding = ObjectBinding.from_stat(os.fstat(fd))
        return OwnedDirectory(root, fd, binding)
    parent_fd = None
    parent_parent_fd = None
    try:
        parent_fd, parent_parent_fd, parent_name = _open_root_fd(
            root.parent, retain_parent=True)
        parent_binding = ObjectBinding.from_stat(os.fstat(parent_fd))
        parent = OwnedDirectory(
            root.parent, parent_fd, parent_binding,
            parent_parent_fd, parent_name)
        parent_fd = None
        parent_parent_fd = None
        with parent:
            _verify_owned_public_name(parent)
            try:
                fd = os.open(root.name, _directory_open_flags(), dir_fd=parent.fd)
            except FileNotFoundError:
                return _create_owned_directory_child(
                    parent, root.name, mode=0o755)
            binding = ObjectBinding.from_stat(os.fstat(fd))
            owned = OwnedDirectory(
                root, fd, binding, os.dup(parent.fd), root.name)
            try:
                _verify_owned_public_name(parent)
                _verify_owned_public_name(owned)
            except BaseException:
                owned.close()
                raise
            return owned
    except OSError as exc:
        raise ProvenanceError("results root is unsafe or unavailable") from exc
    finally:
        if parent_fd is not None:
            os.close(parent_fd)
        if parent_parent_fd is not None:
            os.close(parent_parent_fd)


def allocate_run_tree(results_root: Path | str, tier: str) -> tuple[str, Path, str]:
    """Allocate run/tier descendants below one retained results-root fd."""
    if not re.fullmatch(r"[a-z][a-z0-9-]*", tier):
        raise ProvenanceError(f"invalid tier name: {tier!r}")
    with _open_or_create_results_root(results_root) as root:
        for _ in range(32):
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            run_id = f"{stamp}-{os.getpid()}-{secrets.token_hex(4)}"
            try:
                os.mkdir(run_id, 0o755, dir_fd=root.fd)
            except FileExistsError:
                continue
            run_fd = None
            tier_fd = None
            try:
                run_fd = os.open(run_id, _directory_open_flags(), dir_fd=root.fd)
                run_binding = ObjectBinding.from_stat(os.fstat(run_fd))
                os.mkdir(tier, 0o755, dir_fd=run_fd)
                tier_fd = os.open(tier, _directory_open_flags(), dir_fd=run_fd)
                tier_binding = ObjectBinding.from_stat(os.fstat(tier_fd))
                if tier_binding.mode_type != stat.S_IFDIR:
                    raise ProvenanceError("allocated tier root is not a directory")
                _verify_owned_public_name(root)
                public_run = ObjectBinding.from_stat(os.stat(
                    run_id, dir_fd=root.fd, follow_symlinks=False))
                public_tier = ObjectBinding.from_stat(os.stat(
                    tier, dir_fd=run_fd, follow_symlinks=False))
                if public_run != run_binding or public_tier != tier_binding:
                    raise ProvenanceError("allocated run tree binding changed")
                tier_dir = root.path / run_id / tier
                return run_id, tier_dir, tier_binding.encode()
            finally:
                if tier_fd is not None:
                    os.close(tier_fd)
                if run_fd is not None:
                    os.close(run_fd)
    raise ProvenanceError("could not allocate a unique run directory")


def _relative_file(root: Path, relative: str | Path) -> Path:
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts or rel == Path("."):
        raise ProvenanceError(f"path must stay below the declared root: {relative}")
    return root / rel


def _open_root_fd(
    root: Path, *, retain_parent: bool = False,
) -> int | tuple[int, int | None, str | None]:
    """Open an absolute directory one component at a time without symlinks."""
    absolute = Path(os.path.abspath(root))
    flags = (os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
             | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0))
    fd = None
    parent_fd = None
    try:
        fd = os.open("/", flags)
        parts = absolute.parts[1:]
        if not parts:
            if retain_parent:
                return fd, None, None
            return fd
        for index, part in enumerate(parts):
            next_fd = os.open(part, flags, dir_fd=fd)
            if retain_parent and index == len(parts) - 1:
                parent_fd = fd
            else:
                os.close(fd)
            fd = next_fd
        if not stat.S_ISDIR(os.fstat(fd).st_mode):
            raise ProvenanceError("declared root is not a directory")
        if retain_parent:
            return fd, parent_fd, parts[-1]
        return fd
    except (OSError, ProvenanceError) as exc:
        if fd is not None:
            os.close(fd)
        if parent_fd is not None and parent_fd != fd:
            os.close(parent_fd)
        if isinstance(exc, ProvenanceError):
            raise
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


def _open_path_parent_fd(root: Path, relative: str | Path,
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


def _open_parent_fd(root: OwnedDirectory, relative: str | Path) -> tuple[int, str]:
    """Traverse descendants only from a retained owned-directory capability."""
    rel = Path(relative)
    if rel.is_absolute() or ".." in rel.parts or rel == Path("."):
        raise ProvenanceError(f"path must stay below the declared root: {relative}")
    flags = (os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
             | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0))
    fd = os.dup(root.fd)
    try:
        for part in rel.parts[:-1]:
            next_fd = os.open(part, flags, dir_fd=fd)
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
        parent_fd, name = _open_path_parent_fd(root, relative, root_fd=root_fd)
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
        # O_NONBLOCK closes the check/open FIFO race: a regular-to-FIFO swap
        # cannot wait for a writer before the opened-inode type check runs.
        source_fd = os.open(
            name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_NONBLOCK", 0), dir_fd=parent_fd)
        opened = os.fstat(source_fd)
        if not stat.S_ISREG(opened.st_mode):
            raise ProvenanceError(f"input is not a regular file: {relative}")
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
        parent_fd, name = _open_path_parent_fd(root, relative, root_fd=root_fd)
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

def _git(root_fd: int, *args: str) -> bytes:
    """Run Git from the retained repository directory, never its public alias."""
    shim = (
        "import os,sys; "
        "fd=int(sys.argv[1]); os.fchdir(fd); "
        "os.execvp('git',['git',*sys.argv[2:]])"
    )
    try:
        git_env = os.environ.copy()
        git_env["GIT_OPTIONAL_LOCKS"] = "0"
        out = subprocess.run(
            [sys.executable, "-c", shim, str(root_fd), *args],
            check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            timeout=60, pass_fds=(root_fd,), cwd="/", env=git_env,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise ProvenanceError(
            f"cannot establish repository identity: git {' '.join(args)}") from exc
    return out.stdout


def _repository_head_status(root_fd: int) -> tuple[str, bytes]:
    head = _git(root_fd, "rev-parse", "HEAD").decode("ascii").strip()
    if not re.fullmatch(r"[0-9a-f]{40,64}", head):
        raise ProvenanceError("git returned an invalid HEAD identity")
    status_bytes = _git(root_fd, "status", "--porcelain=v1", "-z",
                        "--untracked-files=all")
    return head, status_bytes


def _repository_paths(root_fd: int) -> list[str]:
    raw = _git(root_fd, "ls-files", "-z", "--cached", "--others",
               "--exclude-standard")
    return [part.decode("utf-8", "surrogateescape")
            for part in sorted(set(item for item in raw.split(b"\0") if item))]


def _repository_entries(root: Path, root_fd: int) -> list[tuple[str, str, int]]:
    entries = []
    for rel in _repository_paths(root_fd):
        _relative_file(root, rel)
        try:
            parent_fd, name = _open_path_parent_fd(root, rel, root_fd=root_fd)
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
    return repository_source_manifest(repo)["identity"]


def repository_source_manifest(repo: Path | str) -> dict[str, Any]:
    """Describe the exact tracked/non-ignored source set without copying it.

    The caller may mount the checkout read-only and use ``records`` to copy and
    re-verify only build-relevant inputs inside a disposable builder. Generated
    dependency/build caches remain excluded by Git's normal ignore contract.
    """
    root = Path(os.path.abspath(repo))
    root_fd = _open_root_fd(root)
    try:
        head, status_bytes = _repository_head_status(root_fd)
        _assert_root_binding(root, root_fd)
        entries = _repository_entries(root, root_fd)
        records = _repository_records(root, root_fd, entries)
        _validate_captured_links(records)
        _assert_root_binding(root, root_fd)
        after_head, after_status = _repository_head_status(root_fd)
        after_paths = _repository_paths(root_fd)
        if (after_head != head or after_status != status_bytes
                or after_paths != [rel for rel, _kind, _mode in entries]):
            raise ProvenanceError(
                "repository changed while source manifest was captured")
        return {
            "schema_version": 1,
            "identity": _identity(head, status_bytes, records),
            "include_rule": "git-cached-plus-nonignored-untracked-v1",
            "exclude_rule": "git-standard-ignored-and-dotgit-v1",
            "records": records,
        }
    finally:
        os.close(root_fd)


def checkout_inventory(repo: Path | str) -> dict[str, Any]:
    """Hash the complete checkout tree without following links.

    Unlike ``repository_source_manifest``, this includes ignored dependency and
    build output trees. Only a framed hash and aggregate counts are returned, so
    private source paths and link targets never enter durable evidence.
    """
    root = Path(os.path.abspath(repo))
    root_fd = _open_root_fd(root)
    records: list[dict[str, Any]] = []
    counts: dict[str, int] = {}
    directory_flags = _directory_open_flags()

    def visit(directory_fd: int, prefix: str) -> None:
        try:
            names = sorted(os.listdir(directory_fd), key=os.fsencode)
        except OSError as exc:
            raise ProvenanceError("checkout inventory cannot list directory") from exc
        for name in names:
            if name in {".", ".."} or "/" in name or "\0" in name:
                raise ProvenanceError("checkout inventory found unsafe entry name")
            relative = f"{prefix}/{name}" if prefix else name
            try:
                before = os.stat(name, dir_fd=directory_fd,
                                 follow_symlinks=False)
            except OSError as exc:
                raise ProvenanceError(
                    "checkout inventory entry is unavailable") from exc
            mode = stat.S_IMODE(before.st_mode)
            if stat.S_ISDIR(before.st_mode):
                kind = "directory"
                record = {"path": relative, "kind": kind, "mode": mode}
                child_fd = None
                try:
                    child_fd = os.open(name, directory_flags,
                                       dir_fd=directory_fd)
                    opened = os.fstat(child_fd)
                    if ObjectBinding.from_stat(opened) != ObjectBinding.from_stat(before):
                        raise ProvenanceError(
                            "checkout directory changed while opened")
                    records.append(record)
                    counts[kind] = counts.get(kind, 0) + 1
                    visit(child_fd, relative)
                    after = os.fstat(child_fd)
                    if ObjectBinding.from_stat(after) != ObjectBinding.from_stat(opened):
                        raise ProvenanceError(
                            "checkout directory changed while inventoried")
                finally:
                    if child_fd is not None:
                        os.close(child_fd)
            elif stat.S_ISREG(before.st_mode):
                kind = "file"
                digest, captured_mode = _regular_digest(
                    root, relative, root_fd=root_fd)
                records.append({"path": relative, "kind": kind,
                                "mode": captured_mode,
                                "content_sha256": digest})
                counts[kind] = counts.get(kind, 0) + 1
            elif stat.S_ISLNK(before.st_mode):
                kind = "symlink"
                try:
                    target = os.readlink(name, dir_fd=directory_fd)
                    after = os.stat(name, dir_fd=directory_fd,
                                    follow_symlinks=False)
                except OSError as exc:
                    raise ProvenanceError(
                        "checkout link changed while inventoried") from exc
                if ObjectBinding.from_stat(after) != ObjectBinding.from_stat(before):
                    raise ProvenanceError(
                        "checkout link changed while inventoried")
                records.append({
                    "path": relative, "kind": kind, "mode": mode,
                    "target_sha256": sha256_bytes(os.fsencode(target)),
                })
                counts[kind] = counts.get(kind, 0) + 1
            else:
                kind = "special"
                records.append({
                    "path": relative, "kind": kind, "mode": mode,
                    "type": stat.S_IFMT(before.st_mode),
                    "device": int(before.st_rdev),
                })
                counts[kind] = counts.get(kind, 0) + 1

    try:
        root_stat = os.fstat(root_fd)
        records.append({"path": ".", "kind": "directory",
                        "mode": stat.S_IMODE(root_stat.st_mode)})
        counts["directory"] = 1
        visit(root_fd, "")
        _assert_root_binding(root, root_fd)
        if stat.S_IMODE(os.fstat(root_fd).st_mode) != stat.S_IMODE(root_stat.st_mode):
            raise ProvenanceError("checkout root mode changed while inventoried")
        return {
            "content_sha256": _framed_hash(
                records, domain="checkout-inventory-v1"),
            "entry_count": len(records),
            "kind_counts": dict(sorted(counts.items())),
            "content_hash_contract": "framed-sha256-checkout-v1",
        }
    finally:
        os.close(root_fd)


def _clear_owned_directory_fd(directory_fd: int) -> None:
    """Remove descendants only after exact entries enter private delete names."""
    directory_flags = (os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
                       | getattr(os, "O_NOFOLLOW", 0))
    for name in os.listdir(directory_fd):
        before = ObjectBinding.from_stat(os.stat(
            name, dir_fd=directory_fd, follow_symlinks=False))
        detached = ".prime-claw-delete-" + secrets.token_hex(16)
        _rename_noreplace(directory_fd, name, directory_fd, detached)
        moved = ObjectBinding.from_stat(os.stat(
            detached, dir_fd=directory_fd, follow_symlinks=False))
        if moved != before:
            raise ProvenanceError(
                "owned snapshot entry changed during rollback")
        if moved.mode_type == stat.S_IFDIR:
            child_fd = os.open(detached, directory_flags, dir_fd=directory_fd)
            try:
                opened = ObjectBinding.from_stat(os.fstat(child_fd))
                if opened != moved:
                    raise ProvenanceError(
                        "owned snapshot entry changed during rollback")
                _clear_owned_directory_fd(child_fd)
                after = ObjectBinding.from_stat(os.stat(
                    detached, dir_fd=directory_fd, follow_symlinks=False))
                if opened != after:
                    raise ProvenanceError(
                        "owned snapshot entry changed during rollback")
                os.rmdir(detached, dir_fd=directory_fd)
            finally:
                os.close(child_fd)
        else:
            after = ObjectBinding.from_stat(os.stat(
                detached, dir_fd=directory_fd, follow_symlinks=False))
            if after != moved:
                raise ProvenanceError(
                    "owned snapshot entry changed during rollback")
            os.unlink(detached, dir_fd=directory_fd)


def _binding_for_stat(value: os.stat_result) -> str:
    return ObjectBinding.from_stat(value).encode()


def _detach_and_remove_owned(
    path: Path,
    expected: ObjectBinding,
    *,
    quarantine_parent: Path,
    quarantine_binding: ObjectBinding | None = None,
) -> None:
    """Detach the public name, prove the held root, then clear in quarantine."""
    root = Path(os.path.abspath(path))
    quarantine_root = Path(os.path.abspath(quarantine_parent))
    try:
        common = Path(os.path.commonpath([root, quarantine_root]))
    except ValueError as exc:
        raise ProvenanceError("cleanup quarantine is on an incompatible root") from exc
    if common == root:
        raise ProvenanceError("cleanup quarantine must not be inside removed tree")
    with open_owned_directory(root, expected, retain_parent=True) as owned:
        if owned.parent_fd is None or owned.name is None:
            raise ProvenanceError("refusing to remove a filesystem root")
        if quarantine_binding is None:
            quarantine_parent_fd = _open_root_fd(quarantine_root)
        else:
            with open_owned_directory(
                    quarantine_root, quarantine_binding) as quarantine_owned:
                quarantine_parent_fd = os.dup(quarantine_owned.fd)
        quarantine_fd = None
        detached_fd = None
        quarantine_name = f".prime-claw-quarantine-{secrets.token_hex(16)}"
        quarantine_binding = None
        try:
            os.mkdir(quarantine_name, 0o700, dir_fd=quarantine_parent_fd)
            created_quarantine = ObjectBinding.from_stat(os.stat(
                quarantine_name, dir_fd=quarantine_parent_fd,
                follow_symlinks=False))
            quarantine_fd = os.open(
                quarantine_name,
                os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
                | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
                dir_fd=quarantine_parent_fd,
            )
            quarantine_stat = os.fstat(quarantine_fd)
            quarantine_binding = ObjectBinding.from_stat(quarantine_stat)
            if quarantine_binding != created_quarantine:
                raise ProvenanceError(
                    "cleanup quarantine changed while it was opened")
            if (quarantine_binding.mode_type != stat.S_IFDIR
                    or stat.S_IMODE(quarantine_stat.st_mode) & 0o077):
                raise ProvenanceError("cleanup quarantine is not private")
            detached_name = f"owned-{secrets.token_hex(16)}"
            _rename_noreplace(
                owned.parent_fd, owned.name, quarantine_fd, detached_name)
            try:
                detached_fd = os.open(
                    detached_name,
                    os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
                    | getattr(os, "O_NOFOLLOW", 0) | getattr(os, "O_CLOEXEC", 0),
                    dir_fd=quarantine_fd,
                )
            except OSError as exc:
                raise ProvenanceError(
                    "cleanup detached a non-directory replacement; preserved in quarantine") from exc
            if ObjectBinding.from_stat(os.fstat(detached_fd)) != expected:
                raise ProvenanceError(
                    "cleanup detached a replacement; preserved in quarantine")
            # Descendant removal is permitted only after this exact root is
            # detached below the fresh private quarantine directory.
            _clear_owned_directory_fd(detached_fd)
            after = os.stat(detached_name, dir_fd=quarantine_fd,
                            follow_symlinks=False)
            if ObjectBinding.from_stat(after) != expected:
                raise ProvenanceError("quarantined directory changed during cleanup")
            os.rmdir(detached_name, dir_fd=quarantine_fd)
            os.fsync(quarantine_fd)
            os.close(quarantine_fd)
            quarantine_fd = None
            current = os.stat(
                quarantine_name, dir_fd=quarantine_parent_fd,
                follow_symlinks=False)
            if ObjectBinding.from_stat(current) != quarantine_binding:
                raise ProvenanceError("cleanup quarantine binding changed")
            os.rmdir(quarantine_name, dir_fd=quarantine_parent_fd)
            os.fsync(quarantine_parent_fd)
        except OSError as exc:
            raise ProvenanceError("owned-directory quarantine cleanup failed") from exc
        finally:
            for fd in (detached_fd, quarantine_fd, quarantine_parent_fd):
                if fd is not None:
                    os.close(fd)


def _rollback_owned_snapshot(
    destination: Path,
    destination_fd: int,
    *,
    parent_binding: ObjectBinding | None = None,
) -> bool:
    """Rollback only while the destination parent remains the held authority."""
    try:
        if parent_binding is not None:
            with open_owned_directory(destination.parent, parent_binding) as parent:
                _verify_owned_public_name(parent)
        expected = ObjectBinding.from_stat(os.fstat(destination_fd))
        _detach_and_remove_owned(
            destination, expected, quarantine_parent=destination.parent,
            quarantine_binding=parent_binding)
        return True
    except (OSError, ProvenanceError):
        return False


def owned_directory_binding(path: Path | str) -> str:
    """Return a non-secret device/inode/type capability for one directory."""
    root = Path(os.path.abspath(path))
    fd = _open_root_fd(root)
    try:
        _assert_root_binding(root, fd)
        binding = ObjectBinding.from_stat(os.fstat(fd))
        if binding.mode_type != stat.S_IFDIR:
            raise ProvenanceError("owned object is not a directory")
        return binding.encode()
    finally:
        os.close(fd)


def remove_owned_directory(
    path: Path | str,
    binding: str,
    *,
    quarantine_parent: Path | str,
    quarantine_binding: str | ObjectBinding | None = None,
) -> None:
    """Detach, prove, then remove only the captured directory capability."""
    expected = ObjectBinding.decode(binding)
    if expected.mode_type != stat.S_IFDIR:
        raise ProvenanceError("owned-directory binding is not a directory")
    quarantine_expected = (ObjectBinding.decode(quarantine_binding)
                           if isinstance(quarantine_binding, str)
                           else quarantine_binding)
    _detach_and_remove_owned(
        Path(path), expected, quarantine_parent=Path(quarantine_parent),
        quarantine_binding=quarantine_expected)


def stage_repository_snapshot(repo: Path | str,
                              destination: Path | str) -> dict[str, Any]:
    """Capture repository inputs into an atomically published owned tree."""
    root = Path(os.path.abspath(repo))
    dest = Path(os.path.abspath(destination))
    root_fd = None
    destination_parent = None
    destination_owned = None
    try:
        root_fd = _open_root_fd(root)
        destination_parent = _open_or_create_results_root(dest.parent)
        _verify_owned_public_name(destination_parent)
        try:
            os.stat(dest.name, dir_fd=destination_parent.fd,
                    follow_symlinks=False)
        except FileNotFoundError:
            pass
        else:
            raise ProvenanceError(
                "repository snapshot destination already exists")
        destination_owned = _create_owned_directory_child(
            destination_parent, dest.name, mode=0o700)
        destination_root_fd = destination_owned.fd
        _verify_owned_public_name(destination_parent)
        _verify_owned_public_name(destination_owned)
        head, status_bytes = _repository_head_status(root_fd)
        _assert_root_binding(root, root_fd)
        entries = _repository_entries(root, root_fd)
        records = _repository_records(
            root, root_fd, entries,
            destination_root_fd=destination_root_fd)
        captured = _identity(head, status_bytes, records)
        _validate_captured_links(records)
        _assert_root_binding(root, root_fd)
        _verify_owned_public_name(destination_parent)
        _verify_owned_public_name(destination_owned)
        # HEAD/status/path inventory must stay stable across capture. File bytes
        # and modes are bound to the opened fds and destination writes remain
        # below the retained snapshot fd.
        after_head, after_status = _repository_head_status(root_fd)
        _assert_root_binding(root, root_fd)
        if (after_head != head or after_status != status_bytes
                or _repository_paths(root_fd) != [rel for rel, _kind, _mode in entries]):
            raise ProvenanceError(
                "repository changed while the run-owned snapshot was staged")
        _assert_root_binding(root, root_fd)
        _verify_owned_public_name(destination_parent)
        _verify_owned_public_name(destination_owned)
        return captured
    except BaseException:
        if destination_owned is not None:
            _rollback_owned_snapshot(
                dest, destination_owned.fd,
                parent_binding=(destination_parent.binding
                                if destination_parent is not None else None))
        raise
    finally:
        if destination_owned is not None:
            destination_owned.close()
        if destination_parent is not None:
            destination_parent.close()
        if root_fd is not None:
            os.close(root_fd)


def _read_evidence_file(parent_fd: int, name: str, relative: str) -> bytes:
    """Read one retained regular inode without following or blocking on swaps."""
    try:
        before = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        fd = os.open(
            name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
            | getattr(os, "O_NONBLOCK", 0), dir_fd=parent_fd)
    except FileNotFoundError:
        raise
    except OSError as exc:
        raise ProvenanceError(f"evidence entry is unavailable: {relative}") from exc
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode):
            raise ProvenanceError(f"evidence is not a regular file: {relative}")
        if (before.st_dev, before.st_ino, before.st_mode) != (
                opened.st_dev, opened.st_ino, opened.st_mode):
            raise ProvenanceError(f"evidence changed while it was opened: {relative}")
        chunks = []
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        after = os.fstat(fd)
        stable = (opened.st_dev, opened.st_ino, opened.st_mode,
                  opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns)
        observed = (after.st_dev, after.st_ino, after.st_mode,
                    after.st_size, after.st_mtime_ns, after.st_ctime_ns)
        if observed != stable:
            raise ProvenanceError(f"evidence changed while it was read: {relative}")
        return b"".join(chunks)
    finally:
        os.close(fd)


def _evidence_rows(directory_fd: int, *, prefix: str,
                   excluded: set[str], excluded_prefixes: tuple[str, ...]
                   ) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    directory_flags = (os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
                       | getattr(os, "O_NOFOLLOW", 0))
    for name in sorted(os.listdir(directory_fd)):
        relative = f"{prefix}/{name}" if prefix else name
        if (relative in excluded
                or any(relative == item.removesuffix("/")
                       or relative.startswith(item)
                       for item in excluded_prefixes)):
            continue
        try:
            before = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
        except OSError as exc:
            raise ProvenanceError(
                f"evidence entry is unavailable: {relative}") from exc
        if stat.S_ISLNK(before.st_mode):
            raise ProvenanceError(f"evidence must not contain a symlink: {relative}")
        if stat.S_ISDIR(before.st_mode):
            try:
                child_fd = os.open(name, directory_flags, dir_fd=directory_fd)
            except OSError as exc:
                raise ProvenanceError(
                    f"evidence directory is unsafe or unavailable: {relative}") from exc
            try:
                opened = os.fstat(child_fd)
                if (before.st_dev, before.st_ino) != (opened.st_dev, opened.st_ino):
                    raise ProvenanceError(
                        f"evidence directory changed while it was opened: {relative}")
                rows.extend(_evidence_rows(
                    child_fd, prefix=relative, excluded=excluded,
                    excluded_prefixes=excluded_prefixes))
                after = os.stat(name, dir_fd=directory_fd, follow_symlinks=False)
                if (opened.st_dev, opened.st_ino) != (after.st_dev, after.st_ino):
                    raise ProvenanceError(
                        f"evidence directory changed while it was read: {relative}")
            finally:
                os.close(child_fd)
            continue
        if not stat.S_ISREG(before.st_mode):
            raise ProvenanceError(f"evidence is not a regular file: {relative}")
        raw = _read_evidence_file(directory_fd, name, relative)
        try:
            text = raw.decode("utf-8", "strict")
        except UnicodeDecodeError as exc:
            raise ProvenanceError(
                f"evidence text has an unknown encoding: {relative}") from exc
        _assert_sanitized(text, f"evidence:{relative}")
        rows.append({"path": relative, "sha256": sha256_bytes(raw)})
    return rows


def evidence_inventory(
    root: OwnedDirectory, *,
    exclude: Iterable[str] = ("manifest.json",),
    exclude_prefixes: Iterable[str] = ("share/", ".publication/"),
) -> list[dict[str, str]]:
    _verify_owned_public_name(root)
    rows = _evidence_rows(
        root.fd, prefix="", excluded=set(exclude),
        excluded_prefixes=tuple(exclude_prefixes))
    _verify_owned_public_name(root)
    if ObjectBinding.from_stat(os.fstat(root.fd)) != root.binding:
        raise ProvenanceError("evidence root changed while it was read")
    return rows


def verify_evidence(root: OwnedDirectory, manifest: dict[str, Any]) -> None:
    validate_manifest(manifest)
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


def _validate_repository_shape(value: Any, where: str) -> None:
    if not isinstance(value, dict):
        raise ProvenanceError(f"{where} must be an object")
    _require_keys(value, {"head", "dirty", "status_sha256",
                          "content_sha256", "entry_count",
                          "content_hash_contract"}, where)
    if (not re.fullmatch(r"[0-9a-f]{40,64}", str(value["head"]))
            or not isinstance(value["dirty"], bool)
            or not _SHA256_RE.fullmatch(str(value["status_sha256"]))
            or not _SHA256_RE.fullmatch(str(value["content_sha256"]))
            or isinstance(value["entry_count"], bool)
            or not isinstance(value["entry_count"], int)
            or value["entry_count"] < 0
            or value["content_hash_contract"] != "framed-sha256-v2"):
        raise ProvenanceError(f"invalid {where}")


def _validate_checkout_inventory(value: Any, where: str) -> None:
    if not isinstance(value, dict):
        raise ProvenanceError(f"{where} must be an object")
    _require_keys(value, {"content_sha256", "entry_count", "kind_counts",
                          "content_hash_contract"}, where)
    counts = value["kind_counts"]
    if (not _SHA256_RE.fullmatch(str(value["content_sha256"]))
            or isinstance(value["entry_count"], bool)
            or not isinstance(value["entry_count"], int)
            or value["entry_count"] < 0
            or not isinstance(counts, dict)
            or any(kind not in {"directory", "file", "symlink", "special"}
                   or isinstance(count, bool) or not isinstance(count, int)
                   or count < 0 for kind, count in counts.items())
            or sum(counts.values()) != value["entry_count"]
            or value["content_hash_contract"] != "framed-sha256-checkout-v1"):
        raise ProvenanceError(f"invalid {where}")


def _validate_source_release(value: Any) -> None:
    if not isinstance(value, dict):
        raise ProvenanceError("prime_agent.staged_release must be an object")
    _require_keys(value, {"schema_version", "source", "source_rules",
                          "package_version", "pack_command_sha256", "artifact",
                          "output_inventory", "output_inventory_sha256"},
                  "prime_agent.staged_release")
    if value["schema_version"] != 1:
        raise ProvenanceError("invalid source release schema")
    _validate_repository_shape(value["source"], "prime_agent.staged_release.source")
    rules = value["source_rules"]
    if (not isinstance(rules, dict)
            or rules != {"include": "git-cached-plus-nonignored-untracked-v1",
                         "exclude": "git-standard-ignored-and-dotgit-v1"}):
        raise ProvenanceError("invalid source release rules")
    if (not _SEMVER_RE.fullmatch(str(value["package_version"]))
            or not _SHA256_RE.fullmatch(str(value["pack_command_sha256"]))
            or not _SHA256_RE.fullmatch(str(value["output_inventory_sha256"]))):
        raise ProvenanceError("invalid source release identity")
    records = value["output_inventory"]
    if not isinstance(records, list) or not records:
        raise ProvenanceError("source release inventory is empty")
    previous = None
    for record in records:
        if not isinstance(record, dict):
            raise ProvenanceError("invalid source release record")
        _require_keys(record, {"path", "kind", "mode", "size",
                               "content_sha256"}, "source release record")
        path = record["path"]
        if (not isinstance(path, str) or not path.startswith("artifacts/")
                or path.startswith("/") or "/../" in f"/{path}/"
                or previous is not None and path <= previous
                or record["kind"] != "file" or record["mode"] != 0o644
                or isinstance(record["size"], bool)
                or not isinstance(record["size"], int) or record["size"] < 0
                or not _SHA256_RE.fullmatch(str(record["content_sha256"]))):
            raise ProvenanceError("invalid source release record")
        previous = path
    version = value["package_version"]
    expected_tarballs = {
        f"prime-agent-{version}.tgz",
        f"prime-agent-ai-{version}.tgz",
        f"prime-agent-core-{version}.tgz",
        f"prime-agent-tui-{version}.tgz",
    }
    expected_paths = {
        *(f"artifacts/{name}" for name in expected_tarballs),
        "artifacts/SHA256SUMS", "artifacts/stable", "artifacts/latest.json",
    }
    if {record["path"] for record in records} != expected_paths:
        raise ProvenanceError("source release output set is not exact")
    calculated_inventory = _framed_hash(
        records, domain="source-builder-output-v1")
    if calculated_inventory != value["output_inventory_sha256"]:
        raise ProvenanceError("source release inventory hash mismatch")
    expected_main = f"artifacts/prime-agent-{version}.tgz"
    matches = [record for record in records if record["path"] == expected_main]
    if len(matches) != 1 or value["artifact"] != matches[0]:
        raise ProvenanceError("source release primary artifact is invalid")


def _validate_source_builder_teardown(value: Any, where: str) -> bool:
    """Validate typed builder ownership and return positive release truth."""
    if not isinstance(value, dict):
        raise ProvenanceError(f"{where} must be an object")
    _require_keys(value, {"container_id", "state", "remove_outcome",
                          "inspect_outcome", "clean", "verified_at"}, where)
    if not isinstance(value["verified_at"], str):
        raise ProvenanceError(f"invalid {where} time")
    _utc_timestamp(value["verified_at"], f"{where} time")
    container_id = value["container_id"]
    if (container_id is not None
            and (not isinstance(container_id, str)
                 or not re.fullmatch(r"[0-9a-f]{64}", container_id))):
        raise ProvenanceError(f"invalid {where} container identity")
    remove_outcomes = {
        "clean", "ordinary_nonzero", "not_needed", "identity_refused",
        "cleanup_failed", "interrupted", "signaled", "timed_out",
        "launch_error", "reap_timeout",
    }
    inspect_outcomes = {
        "clean", "ordinary_nonzero", "not_needed", "not_run",
        "cleanup_failed", "interrupted", "signaled", "timed_out",
        "launch_error", "reap_timeout",
    }
    if (not isinstance(value["state"], str)
            or value["state"] not in {"absent", "present", "unknown"}
            or not isinstance(value["remove_outcome"], str)
            or value["remove_outcome"] not in remove_outcomes
            or not isinstance(value["inspect_outcome"], str)
            or value["inspect_outcome"] not in inspect_outcomes
            or not isinstance(value["clean"], bool)):
        raise ProvenanceError(f"invalid {where} outcome")
    exact_cid = container_id is not None
    positively_released = (
        exact_cid and value["state"] == "absent" and value["clean"]
        and value["remove_outcome"] == "clean"
        and value["inspect_outcome"] == "ordinary_nonzero")
    if value["clean"] != positively_released:
        raise ProvenanceError(f"{where} clean flag is contradictory")
    return positively_released


def _validate_source_builder(value: Any) -> None:
    if not isinstance(value, dict):
        raise ProvenanceError("prime_agent.builder must be an object")
    _require_keys(value, {"image", "teardown", "checkout_inventory_before",
                          "checkout_inventory_after"}, "prime_agent.builder")
    image = value["image"]
    if not isinstance(image, dict):
        raise ProvenanceError("source builder image is unavailable")
    _require_keys(image, {"id", "repo_digests", "dockerfile",
                          "dockerfile_sha256", "declared_input_sha256",
                          "declared_input_hash_contract", "informational_tag",
                          "os", "architecture", "build_started_at",
                          "build_finished_at"}, "prime_agent.builder.image")
    if (not _IMAGE_ID_RE.fullmatch(str(image["id"]))
            or image["repo_digests"] != []
            or image["dockerfile"] != "docker/test-prime-agent-builder.Dockerfile"
            or image["declared_input_hash_contract"] != "framed-sha256-v2"
            or not _SHA256_RE.fullmatch(str(image["dockerfile_sha256"]))
            or not _SHA256_RE.fullmatch(str(image["declared_input_sha256"]))):
        raise ProvenanceError("invalid source builder image")
    _validate_image_fields(image)
    _utc_timestamp(image["build_started_at"], "source builder image start")
    _utc_timestamp(image["build_finished_at"], "source builder image finish")
    teardown = value["teardown"]
    if not _validate_source_builder_teardown(
            teardown, "prime_agent.builder.teardown"):
        raise ProvenanceError("source builder teardown is not clean")
    before = value["checkout_inventory_before"]
    after = value["checkout_inventory_after"]
    _validate_checkout_inventory(before, "source builder checkout before")
    _validate_checkout_inventory(after, "source builder checkout after")
    if before != after:
        raise ProvenanceError("source builder changed the selected checkout")


def source_builder_share_teardown(value: Any) -> dict[str, Any]:
    """Validate a source-build receipt and return its share-owner teardown.

    Consumers use this before deleting the writable export share. Only a
    complete receipt with one exact builder CID and positively clean absence
    can release ownership; every malformed or contradictory receipt fails
    closed without exposing raw Docker diagnostics.
    """
    _assert_sanitized(value, "source-build")
    if not isinstance(value, dict):
        raise ProvenanceError("source-build receipt must be an object")
    _require_keys(value, {
        "schema_version", "status", "started_at", "finished_at",
        "failure_codes", "source", "source_rules",
        "checkout_inventory_before", "checkout_inventory_after",
        "builder_image", "builder_teardown", "release",
    }, "source-build receipt")
    if (not isinstance(value["schema_version"], int)
            or isinstance(value["schema_version"], bool)
            or value["schema_version"] != 1
            or not isinstance(value["status"], str)
            or value["status"] not in {"passed", "failed"}):
        raise ProvenanceError("invalid source-build receipt status")
    _utc_timestamp(value["started_at"], "source-build start")
    _utc_timestamp(value["finished_at"], "source-build finish")
    failure_codes = value["failure_codes"]
    if (not isinstance(failure_codes, list)
            or any(not isinstance(code, str) or not code
                   for code in failure_codes)
            or len(failure_codes) != len(set(failure_codes))
            or (value["status"] == "passed") != (not failure_codes)):
        raise ProvenanceError("invalid source-build failure codes")

    source = value["source"]
    if source is not None:
        _validate_repository_shape(source, "source-build source")
    rules = value["source_rules"]
    expected_rules = {
        "include": "git-cached-plus-nonignored-untracked-v1",
        "exclude": "git-standard-ignored-and-dotgit-v1",
    }
    if rules is not None and rules != expected_rules:
        raise ProvenanceError("invalid source-build source rules")
    for key in ("checkout_inventory_before", "checkout_inventory_after"):
        if value[key] is not None:
            _validate_checkout_inventory(value[key], f"source-build {key}")

    release = value["release"]
    if release is not None:
        _validate_source_release(release)
        if source is None or release["source"] != source:
            raise ProvenanceError("source-build release lineage mismatch")

    teardown = value["builder_teardown"]
    positively_released = _validate_source_builder_teardown(
        teardown, "source-build teardown")
    if positively_released:
        _validate_source_builder({
            "image": value["builder_image"], "teardown": teardown,
            "checkout_inventory_before": value["checkout_inventory_before"],
            "checkout_inventory_after": value["checkout_inventory_after"],
        })
    if value["status"] == "passed":
        if (source is None or rules != expected_rules or release is None
                or value["builder_image"] is None
                or value["checkout_inventory_before"] is None
                or value["checkout_inventory_after"] is None
                or value["checkout_inventory_before"]
                    != value["checkout_inventory_after"]
                or not positively_released):
            raise ProvenanceError("passed source-build receipt is incomplete")
    return dict(teardown)


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
    if (run["tier"] != "tier1"
            or not isinstance(run["mode"], str)
            or run["mode"] not in {"pinned", "source", "smoke"}
            or not isinstance(run["status"], str)
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
    _validate_repository_shape(repo, "repository")
    if run["mode"] == "smoke":
        if prime is not None:
            raise ProvenanceError("smoke manifests require prime_agent=null")
    else:
        if not isinstance(prime, dict):
            raise ProvenanceError(
                "non-smoke manifests require requested selector provenance")
        installed = prime.get("installed_version")
        artifact = prime.get("artifact")
        if installed is None:
            if artifact is not None or run["status"] != "failed":
                raise ProvenanceError(
                    "unavailable installed identity is valid only for failed runs")
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
        if run["mode"] == "pinned":
            _require_keys(prime, {"mode", "requested_version", "installed_version",
                                  "artifact"}, "prime_agent")
            requested = prime["requested_version"]
            if prime["mode"] != "pinned" or not _SEMVER_RE.fullmatch(str(requested)):
                raise ProvenanceError("invalid pinned Prime Agent selector")
            if run["status"] == "passed" and installed != requested:
                raise ProvenanceError(
                    "passed run requested and installed versions differ")
        else:
            _require_keys(prime, {"mode", "requested_version", "installed_version",
                                  "artifact", "source", "source_rules",
                                  "staged_release", "builder"}, "prime_agent")
            if prime["mode"] != "source":
                raise ProvenanceError("invalid source Prime Agent selector")
            builder = prime["builder"]
            if builder is not None:
                if not isinstance(builder, dict) or "teardown" not in builder:
                    raise ProvenanceError("source builder evidence is invalid")
                _validate_source_builder_teardown(
                    builder["teardown"], "prime_agent.builder.teardown")
            if run["status"] == "passed":
                requested = prime["requested_version"]
                if not _SEMVER_RE.fullmatch(str(requested)) or installed != requested:
                    raise ProvenanceError("source requested and installed versions differ")
                _validate_repository_shape(prime["source"], "prime_agent.source")
                rules = prime["source_rules"]
                if rules != {"include": "git-cached-plus-nonignored-untracked-v1",
                             "exclude": "git-standard-ignored-and-dotgit-v1"}:
                    raise ProvenanceError("invalid source rules")
                _validate_source_release(prime["staged_release"])
                if (prime["staged_release"]["source"] != prime["source"]
                        or prime["staged_release"]["source_rules"] != rules
                        or prime["staged_release"]["package_version"] != requested):
                    raise ProvenanceError("source release lineage disagrees")
                _validate_source_builder(prime["builder"])

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
    if (not isinstance(teardown["state"], str)
            or teardown["state"] not in {"absent", "unknown", "present"}):
        raise ProvenanceError("invalid teardown.state")
    outcomes = {"clean", "ordinary_nonzero", "signaled", "timed_out", "interrupted",
                "launch_error", "reap_timeout", "not_needed", "not_run",
                "identity_refused"}
    if (not isinstance(teardown["remove_outcome"], str)
            or teardown["remove_outcome"] not in outcomes
            or not isinstance(teardown["inspect_outcome"], str)
            or teardown["inspect_outcome"] not in outcomes
            or not isinstance(teardown["clean"], bool)):
        raise ProvenanceError("invalid teardown command accounting")
    if teardown["clean"] and teardown["state"] != "absent":
        raise ProvenanceError("clean teardown requires absence")
    if teardown["clean"] and (
            teardown["remove_outcome"] not in {"clean", "not_needed"}
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
        if (not isinstance(row["path"], str)
                or row["path"] in seen
                or Path(row["path"]).is_absolute()
                or ".." in Path(row["path"]).parts):
            raise ProvenanceError("invalid or duplicate evidence path")
        seen.add(row["path"])
        if not _SHA256_RE.fullmatch(str(row["sha256"])):
            raise ProvenanceError("invalid evidence sha256")


def _open_manifest_fd(parent_fd: int, name: str, *, writable: bool) -> int:
    flags = ((os.O_RDWR if writable else os.O_RDONLY)
             | getattr(os, "O_NOFOLLOW", 0)
             | getattr(os, "O_NONBLOCK", 0) | getattr(os, "O_CLOEXEC", 0))
    try:
        fd = os.open(name, flags, dir_fd=parent_fd)
    except OSError as exc:
        raise ProvenanceError("published manifest is unsafe or unavailable") from exc
    if not stat.S_ISREG(os.fstat(fd).st_mode):
        os.close(fd)
        raise ProvenanceError("published manifest is not a regular file")
    return fd


def _decoded_manifest_fd(fd: int) -> dict[str, Any]:
    raw = _read_fd_bytes(fd, label="published manifest")
    try:
        value = json.loads(raw.decode("utf-8", "strict"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ProvenanceError("published manifest is unreadable") from exc
    if not isinstance(value, dict):
        raise ProvenanceError("published manifest is not an object")
    _assert_sanitized(value)
    return value


def _neutralize_manifest_fd(fd: int) -> None:
    payload = canonical_json({
        "invalidated": True,
        "reason": "replaced-by-failed-manifest",
    }).encode("utf-8")
    os.ftruncate(fd, 0)
    os.lseek(fd, 0, os.SEEK_SET)
    _write_all(fd, payload)
    os.fsync(fd)


def _exchange_manifest_bytes(
    root: OwnedDirectory,
    relative: str | Path,
    payload: bytes,
    expected: ObjectBinding,
) -> tuple[ObjectBinding, bool]:
    """Install failed bytes atomically and preserve every displaced object."""
    parent_fd, name = _open_parent_fd(root, relative)
    target_fd = None
    publication_fd = None
    mismatch = False
    try:
        target_fd = _open_manifest_fd(parent_fd, name, writable=True)
        opened = ObjectBinding.from_stat(os.fstat(target_fd))
        mismatch = opened != expected
        if not mismatch:
            # The expected object must itself be a valid sanitized manifest.
            validate_manifest(_decoded_manifest_fd(target_fd))
        publication_fd, stage, staged = _stage_owned_bytes(root, payload)
        _rename_exchange(publication_fd, stage, parent_fd, name)
        _verify_published_bytes(parent_fd, name, staged, payload)
        try:
            displaced = ObjectBinding.from_stat(os.stat(
                stage, dir_fd=publication_fd, follow_symlinks=False))
        except OSError as exc:
            raise ProvenanceError("displaced manifest was not preserved") from exc
        if displaced != opened:
            mismatch = True
        # Only the exact expected inode may be neutralized. A raced replacement
        # remains byte-identical under .publication/ for diagnosis.
        if opened == expected:
            _neutralize_manifest_fd(target_fd)
        os.fsync(publication_fd)
        os.fsync(parent_fd)
        os.fsync(root.fd)
        return staged, mismatch
    except OSError as exc:
        raise ProvenanceError("atomic manifest exchange failed") from exc
    finally:
        if publication_fd is not None:
            os.close(publication_fd)
        if target_fd is not None:
            os.close(target_fd)
        os.close(parent_fd)


def atomic_write_manifest(
    root: OwnedDirectory,
    manifest: dict[str, Any],
    *,
    expected_existing: ObjectBinding | None = None,
) -> ObjectBinding:
    """Publish a new manifest or atomically exchange an expected green one."""
    validate_manifest(manifest)
    payload = canonical_json(manifest).encode("utf-8")
    if expected_existing is None:
        verify_evidence(root, manifest)
        published = _publish_owned_bytes(root, "manifest.json", payload)
        _verify_owned_public_name(root)
        return published
    if manifest["run"]["status"] != "failed":
        raise ProvenanceError("manifest replacement must be non-green")
    # Close the green-publication window first. Evidence verification after the
    # exchange can fail truthfully, but can no longer leave a passed manifest.
    published, mismatch = _exchange_manifest_bytes(
        root, "manifest.json", payload, expected_existing)
    try:
        verify_evidence(root, manifest)
    except ProvenanceError as exc:
        raise ProvenanceError(
            "failed manifest published but evidence verification failed") from exc
    if mismatch:
        raise ProvenanceError(
            "manifest target changed; failed replacement published and object preserved")
    return published


def _exchange_public_entry_bytes(
    root: OwnedDirectory,
    relative: str | Path,
    payload: bytes,
) -> tuple[ObjectBinding, ObjectBinding]:
    """Exchange any existing public entry for a regular non-green record."""
    parent_fd, name = _open_parent_fd(root, relative)
    publication_fd = None
    try:
        publication_fd, stage, staged = _stage_owned_bytes(root, payload)
        _rename_exchange(publication_fd, stage, parent_fd, name)
        _verify_published_bytes(parent_fd, name, staged, payload)
        displaced = ObjectBinding.from_stat(os.stat(
            stage, dir_fd=publication_fd, follow_symlinks=False))
        os.fsync(publication_fd)
        os.fsync(parent_fd)
        os.fsync(root.fd)
        _verify_owned_public_name(root)
        return staged, displaced
    except OSError as exc:
        raise ProvenanceError("atomic public-entry invalidation failed") from exc
    finally:
        if publication_fd is not None:
            os.close(publication_fd)
        os.close(parent_fd)


def invalidate_green_manifest(
    root: OwnedDirectory,
    *,
    expected: ObjectBinding | None,
) -> ObjectBinding | None:
    """Atomically replace any public green/unsafe entry with non-green JSON."""
    minimal_payload = canonical_json({
        "invalidated": True,
        "reason": "unsafe-public-manifest",
        "status": "failed",
    }).encode("utf-8")
    parent_fd, name = _open_parent_fd(root, "manifest.json")
    manifest_fd = None
    try:
        try:
            manifest_fd = _open_manifest_fd(parent_fd, name, writable=True)
        except ProvenanceError:
            try:
                os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
            except FileNotFoundError:
                return None
            # A symlink/directory/FIFO/socket cannot be trusted as a manifest,
            # but it can be atomically displaced without opening or deleting it.
            os.close(parent_fd)
            parent_fd = -1
            published, displaced = _exchange_public_entry_bytes(
                root, "manifest.json", minimal_payload)
            if expected is not None and displaced != expected:
                raise ProvenanceError(
                    "unsafe manifest entry invalidated; expected binding changed")
            return published
        observed = ObjectBinding.from_stat(os.fstat(manifest_fd))
        try:
            current = _decoded_manifest_fd(manifest_fd)
            validate_manifest(current)
        except ProvenanceError:
            published, displaced = _exchange_public_entry_bytes(
                root, "manifest.json", minimal_payload)
            if expected is not None and observed == expected:
                _neutralize_manifest_fd(manifest_fd)
            if expected is not None and displaced != expected:
                raise ProvenanceError(
                    "unsafe manifest entry invalidated; expected binding changed")
            return published
        if current["run"]["status"] != "passed":
            return observed
    finally:
        if manifest_fd is not None:
            os.close(manifest_fd)
        if parent_fd >= 0:
            os.close(parent_fd)
    invalidated = json.loads(canonical_json(current))
    invalidated["run"]["status"] = "failed"
    codes = list(invalidated["run"]["failure_codes"])
    if "publication-invalidated" not in codes:
        codes.append("publication-invalidated")
    invalidated["run"]["failure_codes"] = codes
    intended = expected if expected is not None else observed
    return atomic_write_manifest(
        root, invalidated, expected_existing=intended)


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
    binding = sub.add_parser("directory-binding")
    binding.add_argument("path")
    remove_owned = sub.add_parser("remove-owned-directory")
    remove_owned.add_argument("path")
    remove_owned.add_argument("binding")
    remove_owned.add_argument("--quarantine-parent", required=True)
    remove_owned.add_argument("--quarantine-binding")
    hash_inputs = sub.add_parser("hash-inputs")
    hash_inputs.add_argument("root")
    hash_inputs.add_argument("paths", nargs="+")
    hash_file = sub.add_parser("hash-file")
    hash_file.add_argument("path")
    build_input = sub.add_parser("build-input")
    build_input.add_argument("root")
    build_input.add_argument("path")
    write_json = sub.add_parser("write-json")
    write_json.add_argument("root")
    write_json.add_argument("binding")
    write_json.add_argument("relative")
    capture_image = sub.add_parser("capture-image")
    capture_image.add_argument("root")
    capture_image.add_argument("binding")
    capture_image.add_argument("relative")
    capture_image.add_argument("expected_id")
    capture_image.add_argument("dockerfile")
    capture_image.add_argument("dockerfile_sha256")
    capture_image.add_argument("declared_input_sha256")
    capture_image.add_argument("informational_tag")
    capture_image.add_argument("build_started_at")
    capture_image.add_argument("build_finished_at")
    capture_artifact = sub.add_parser("capture-artifact")
    capture_artifact.add_argument("root")
    capture_artifact.add_argument("binding")
    capture_artifact.add_argument("relative")
    capture_artifact.add_argument("version")
    invalidate_manifest = sub.add_parser("invalidate-green-manifest")
    invalidate_manifest.add_argument("root")
    invalidate_manifest.add_argument("binding")
    invalidate_manifest.add_argument("relative", nargs="?", default="manifest.json")
    invalidate_manifest.add_argument("--expected")
    parse_version = sub.add_parser("parse-version")
    now = sub.add_parser("now")
    args = parser.parse_args()
    if args.command == "allocate":
        run_id, tier_dir, tier_binding = allocate_run_tree(
            args.results_root, args.tier)
        # Allocation returned an absolute lexical path whose public binding
        # was checked. Re-resolving here could follow a later alias swap.
        print(run_id + "\t" + str(tier_dir) + "\t" + tier_binding)
    elif args.command == "repository":
        print(canonical_json(repository_identity(args.repo)), end="")
    elif args.command == "snapshot":
        print(canonical_json(stage_repository_snapshot(
            args.repo, args.destination)), end="")
    elif args.command == "directory-binding":
        print(owned_directory_binding(args.path))
    elif args.command == "remove-owned-directory":
        remove_owned_directory(
            args.path, args.binding, quarantine_parent=args.quarantine_parent,
            quarantine_binding=args.quarantine_binding)
    elif args.command == "hash-inputs":
        print(hash_declared_inputs(args.root, args.paths))
    elif args.command == "hash-file":
        print(sha256_file(args.path))
    elif args.command == "build-input":
        root = Path(args.root)
        print(sha256_file(root / args.path) + "\t" +
              hash_declared_inputs(root, [args.path]))
    elif args.command == "write-json":
        try:
            value = json.load(__import__("sys").stdin)
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ProvenanceError("invalid sanitized JSON input") from exc
        with open_owned_directory(args.root, args.binding) as owned:
            write_sanitized_json(owned, args.relative, value)
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
            with open_owned_directory(args.root, args.binding) as owned:
                write_sanitized_json(owned, args.relative, safe)
        except (UnicodeDecodeError, json.JSONDecodeError, TypeError) as exc:
            raise ProvenanceError("invalid image inspect encoding or JSON") from exc
    elif args.command == "capture-artifact":
        raw = __import__("sys").stdin.buffer.read()
        with open_owned_directory(args.root, args.binding) as owned:
            write_sanitized_json(
                owned, args.relative, artifact_identity(args.version, raw))
    elif args.command == "invalidate-green-manifest":
        with open_owned_directory(args.root, args.binding) as owned:
            expected = (ObjectBinding.decode(args.expected)
                        if args.expected is not None else None)
            invalidated = invalidate_green_manifest(owned, expected=expected)
            if invalidated is not None:
                print(invalidated.encode())
    elif args.command == "parse-version":
        print(parse_prime_agent_version(__import__("sys").stdin.read()))
    elif args.command == "now":
        print(utc_now())
    return 0


if __name__ == "__main__":
    raise SystemExit(_main())
