#!/usr/bin/env python3
"""Install and recover Prime Claw's bridge role protocol safely.

All destination and receipt operations are descriptor-bound beneath no-follow
opened directory authorities.  Apply and restore use a durable transaction
journal so every recognized interruption can be completed or rolled back
without guessing about external changes.
"""

from __future__ import annotations

import argparse
import base64
import binascii
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat
import sys
from typing import Any

CONTEXT_CANDIDATES = ("AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD")
KERNEL_START = b"<!-- prime-claw:role-kernel:start -->"
KERNEL_END = b"<!-- prime-claw:role-kernel:end -->"
LEGACY_START = b"<!-- prime-claw:conversation-identity:start -->"
LEGACY_END = b"<!-- prime-claw:conversation-identity:end -->"
STATE_DIR = ".prime-claw"
STATE_NAME = "role-protocol-state.json"
TX_NAME = "role-protocol-transaction.json"
LOCK_NAME = ".prime-claw-role-protocol.lock"
TEMP_TAG = "prime-claw-role-protocol"
SCHEMA_VERSION = 2
MANAGED_KINDS = ("context", "append", "manifest")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def decode(value: str) -> bytes:
    if not isinstance(value, str):
        raise ValueError("encoded bytes are not a string")
    try:
        return base64.b64decode(value.encode("ascii"), validate=True)
    except (UnicodeError, ValueError, binascii.Error) as error:
        raise ValueError("encoded bytes are not valid base64") from error


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode("utf-8")


def fault(label: str) -> None:
    """Deterministic test-only fault seam; inert unless explicitly selected."""
    requested = os.environ.get("PRIME_CLAW_ROLE_PROTOCOL_FAULT")
    if not requested:
        return
    action = "error"
    selected = requested
    if "=" in requested:
        selected, action = requested.rsplit("=", 1)
    if selected != label:
        return
    if action == "exit":
        os._exit(86)
    raise OSError(f"injected role-protocol fault: {label}")


def managed_range(data: bytes, start: bytes, end: bytes, description: str) -> tuple[int, int] | None:
    tokens: list[tuple[int, bytes]] = []
    offset = 0
    while True:
        found = [(pos, token) for token in (start, end) if (pos := data.find(token, offset)) >= 0]
        if not found:
            break
        position, token = min(found, key=lambda item: item[0])
        tokens.append((position, token))
        offset = position + len(token)
    if not tokens:
        return None
    starts = sum(token == start for _, token in tokens)
    ends = sum(token == end for _, token in tokens)
    if len(tokens) != 2:
        if starts > 1 or ends > 1:
            raise ValueError(f"{description} has duplicate managed markers")
        raise ValueError(f"{description} has incomplete managed markers")
    (start_at, first), (end_at, second) = tokens
    if first != start or second != end:
        raise ValueError(f"{description} has reversed managed markers")
    return start_at, end_at + len(end)


def load_block(path: Path, start: bytes, end: bytes, description: str) -> bytes:
    data = path.read_bytes()
    block = data[:-1] if data.endswith(b"\n") and not data.endswith(b"\r\n") else data
    selected = managed_range(block, start, end, description)
    if selected != (0, len(block)):
        raise ValueError(f"{description} is not exactly one complete managed block: {path}")
    return block


def newline_style(data: bytes) -> bytes:
    if b"\r\n" in data and data.replace(b"\r\n", b"").find(b"\n") < 0:
        return b"\r\n"
    return b"\n"


def patch_block(
    data: bytes,
    block: bytes,
    start: bytes,
    end: bytes,
    description: str,
    *,
    required_existing: bytes | None = None,
) -> tuple[bytes, bytes, bytes]:
    selected = managed_range(data, start, end, description)
    if selected is not None:
        current = data[selected[0] : selected[1]]
        if required_existing is not None and current != required_existing:
            raise ValueError(f"{description} does not match the accepted predecessor block")
        return data[: selected[0]] + block + data[selected[1] :], b"", b""
    newline = newline_style(data)
    had_final = data.endswith((b"\n", b"\r"))
    prefix = b"" if not data or had_final else newline
    suffix = b"" if not had_final else newline
    return data + prefix + block + suffix, prefix, suffix


def validate_config(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text())
    if value != {"schemaVersion": 1, "generation": "bridge"}:
        raise ValueError("role protocol generation config must select bridge schemaVersion 1")
    return value


def _open_dir_chain(path: Path) -> tuple[int, str]:
    absolute = os.path.abspath(os.fspath(path))
    if not os.path.isabs(absolute):
        raise ValueError(f"directory path is not absolute: {path}")
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(os.sep, flags)
    try:
        for component in Path(absolute).parts[1:]:
            if component in ("", ".", ".."):
                raise ValueError(f"unsafe directory component in {path}")
            next_fd = os.open(component, flags, dir_fd=fd)
            os.close(fd)
            fd = next_fd
        info = os.fstat(fd)
        if not stat.S_ISDIR(info.st_mode):
            raise ValueError(f"not a directory: {path}")
        return fd, absolute
    except Exception:
        os.close(fd)
        raise


def _identity(info: os.stat_result) -> tuple[int, int]:
    return info.st_dev, info.st_ino


def missing_snapshot() -> dict[str, Any]:
    return {"exists": False}


def _file_snapshot(fd: int, data: bytes | None = None) -> dict[str, Any]:
    info = os.fstat(fd)
    if not stat.S_ISREG(info.st_mode):
        raise ValueError("managed object is not a regular file")
    if data is None:
        chunks: list[bytes] = []
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        data = b"".join(chunks)
    return {
        "exists": True,
        "type": "regular",
        "bytesBase64": encode(data),
        "sha256": digest(data),
        "mode": stat.S_IMODE(info.st_mode),
        "uid": info.st_uid,
        "gid": info.st_gid,
        "device": info.st_dev,
        "inode": info.st_ino,
    }


def validate_snapshot(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or not isinstance(value.get("exists"), bool):
        raise ValueError(f"{label} snapshot is malformed")
    if not value["exists"]:
        if set(value) != {"exists"}:
            raise ValueError(f"{label} missing snapshot has unexpected fields")
        return value
    required = {"exists", "type", "bytesBase64", "sha256", "mode", "uid", "gid", "device", "inode"}
    if set(value) != required or value.get("type") != "regular":
        raise ValueError(f"{label} regular snapshot fields are malformed")
    for key in ("mode", "uid", "gid", "device", "inode"):
        if type(value.get(key)) is not int or value[key] < 0:
            raise ValueError(f"{label} snapshot {key} is invalid")
    if value["mode"] > 0o7777:
        raise ValueError(f"{label} snapshot mode is invalid")
    data = decode(value["bytesBase64"])
    if not isinstance(value.get("sha256"), str) or len(value["sha256"]) != 64 or digest(data) != value["sha256"]:
        raise ValueError(f"{label} snapshot digest does not match bytes")
    return value


def same_snapshot(actual: dict[str, Any], expected: dict[str, Any], *, identity: bool = True) -> bool:
    if actual.get("exists") != expected.get("exists"):
        return False
    if not actual.get("exists"):
        return True
    keys = ("type", "sha256", "mode", "uid", "gid")
    if identity:
        keys += ("device", "inode")
    return all(actual.get(key) == expected.get(key) for key in keys)


class DirBoundary:
    """An opened no-follow directory authority with descriptor-relative leaves."""

    def __init__(self, path: Path, fd: int | None = None):
        if fd is None:
            self.fd, self.path = _open_dir_chain(path)
        else:
            self.fd = fd
            self.path = os.path.abspath(os.fspath(path))
        self.info = os.fstat(self.fd)
        self.guard = None

    def close(self) -> None:
        if self.fd >= 0:
            os.close(self.fd)
            self.fd = -1

    def assert_path_identity(self) -> None:
        fd, _ = _open_dir_chain(Path(self.path))
        try:
            if _identity(os.fstat(fd)) != _identity(self.info):
                raise ValueError(f"directory identity changed: {self.path}")
        finally:
            os.close(fd)

    def _actual_leaf(self, name: str) -> str:
        if not name or "/" in name or name in (".", ".."):
            raise ValueError(f"unsafe managed leaf name: {name!r}")
        entries = os.listdir(self.fd)
        if name in entries:
            return name
        aliases = [entry for entry in entries if entry.casefold() == name.casefold()]
        if len(aliases) > 1:
            raise ValueError(f"ambiguous case-folded managed leaf: {name}")
        return aliases[0] if aliases else name

    def lstat(self, name: str, *, case_alias: bool = False) -> os.stat_result | None:
        actual_name = self._actual_leaf(name) if case_alias else name
        if not name or "/" in name or name in (".", ".."):
            raise ValueError(f"unsafe managed leaf name: {name!r}")
        try:
            return os.stat(actual_name, dir_fd=self.fd, follow_symlinks=False)
        except FileNotFoundError:
            return None

    def snapshot(self, name: str, label: str, *, require_readable: bool = False, case_alias: bool = False) -> dict[str, Any]:
        actual_name = self._actual_leaf(name) if case_alias else name
        info = self.lstat(name, case_alias=case_alias)
        if info is None:
            return missing_snapshot()
        if not stat.S_ISREG(info.st_mode):
            raise ValueError(f"{label} is not a regular no-follow file: {self.path}/{name}")
        if require_readable and stat.S_IMODE(info.st_mode) & 0o444 == 0:
            raise ValueError(f"{label} is unreadable: {self.path}/{name}")
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(actual_name, flags, dir_fd=self.fd)
        try:
            opened = os.fstat(fd)
            if _identity(opened) != _identity(info):
                raise ValueError(f"{label} changed identity while opening")
            return _file_snapshot(fd)
        finally:
            os.close(fd)

    def stage(self, target: str, data: bytes, mode: int, uid: int, gid: int, label: str) -> dict[str, Any]:
        self.assert_path_identity()
        if self.guard is not None:
            self.guard()
        temp = f".{target}.{TEMP_TAG}-{os.getpid()}-{secrets.token_hex(8)}.tmp"
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(temp, flags, 0o600, dir_fd=self.fd)
        try:
            view = memoryview(data)
            while view:
                written = os.write(fd, view)
                view = view[written:]
            try:
                os.fchown(fd, uid, gid)
            except PermissionError as error:
                current = os.fstat(fd)
                if (current.st_uid, current.st_gid) != (uid, gid):
                    raise error
            os.fchmod(fd, mode)
            fault(f"{label}:before-file-fsync")
            os.fsync(fd)
            fault(f"{label}:after-file-fsync")
            snap = _file_snapshot(fd, data)
        except Exception:
            try:
                if self.guard is not None:
                    self.guard()
                os.unlink(temp, dir_fd=self.fd)
            except (OSError, ValueError):
                pass
            raise
        finally:
            os.close(fd)
        return {"name": temp, "snapshot": snap}

    def publish(self, staged: dict[str, Any], target: str, expected: dict[str, Any], label: str) -> dict[str, Any]:
        self.assert_path_identity()
        if self.guard is not None:
            self.guard()
        actual = self.snapshot(target, label)
        if not same_snapshot(actual, expected, identity=True):
            raise ValueError(f"concurrent change detected before replacing {label}")
        temp_actual = self.snapshot(staged["name"], f"{label} staged temp")
        if not same_snapshot(temp_actual, staged["snapshot"], identity=True):
            raise ValueError(f"staged temp changed before replacing {label}")
        fault(f"{label}:before-replace")
        self.assert_path_identity()
        if self.guard is not None:
            self.guard()
        actual = self.snapshot(target, label)
        if not same_snapshot(actual, expected, identity=True):
            raise ValueError(f"concurrent change detected at commit for {label}")
        target_leaf = target
        os.replace(staged["name"], target_leaf, src_dir_fd=self.fd, dst_dir_fd=self.fd)
        fault(f"{label}:after-replace")
        if self.guard is not None:
            self.guard()
        fault(f"{label}:before-directory-fsync")
        if self.guard is not None:
            self.guard()
        os.fsync(self.fd)
        fault(f"{label}:after-directory-fsync")
        if self.guard is not None:
            self.guard()
        result = self.snapshot(target, label)
        if not same_snapshot(result, staged["snapshot"], identity=True):
            raise ValueError(f"published {label} does not match staged identity")
        return result

    def unlink_exact(self, name: str, expected: dict[str, Any], label: str) -> None:
        self.assert_path_identity()
        if self.guard is not None:
            self.guard()
        actual = self.snapshot(name, label)
        if not same_snapshot(actual, expected, identity=True):
            raise ValueError(f"concurrent change detected before removing {label}")
        fault(f"{label}:before-unlink")
        self.assert_path_identity()
        if self.guard is not None:
            self.guard()
        actual = self.snapshot(name, label)
        if not same_snapshot(actual, expected, identity=True):
            raise ValueError(f"concurrent change detected at removal commit for {label}")
        os.unlink(name, dir_fd=self.fd)
        fault(f"{label}:after-unlink")
        if self.guard is not None:
            self.guard()
        fault(f"{label}:before-directory-fsync")
        if self.guard is not None:
            self.guard()
        os.fsync(self.fd)
        fault(f"{label}:after-directory-fsync")
        if self.guard is not None:
            self.guard()

    def cleanup_staged(self, staged: dict[str, Any] | None) -> None:
        if not staged:
            return
        try:
            self.assert_path_identity()
            if self.guard is not None:
                self.guard()
            actual = self.snapshot(staged["name"], "staged temp")
            if same_snapshot(actual, staged["snapshot"], identity=True):
                if self.guard is not None:
                    self.guard()
                os.unlink(staged["name"], dir_fd=self.fd)
                if self.guard is not None:
                    self.guard()
                os.fsync(self.fd)
        except (FileNotFoundError, ValueError):
            pass


class ManagedRoot:
    def __init__(self, path: Path):
        self.root = DirBoundary(path)
        self.path = Path(self.root.path)
        self.state: DirBoundary | None = None
        self.lock_fd: int | None = None
        self.root.guard = self.assert_identity

    def close(self) -> None:
        if self.state is not None:
            self.state.close()
        self.root.close()

    def assert_identity(self) -> None:
        self.root.assert_path_identity()
        if self.state is not None:
            self.state.assert_path_identity()
        if self.lock_fd is not None:
            info = self.root.lstat(LOCK_NAME)
            if info is None or not stat.S_ISREG(info.st_mode):
                raise ValueError("role protocol lock pathname is missing or unsafe")
            if _identity(info) != _identity(os.fstat(self.lock_fd)):
                raise ValueError("role protocol lock pathname no longer names the flocked inode")

    def open_state(self, *, create: bool) -> DirBoundary | None:
        if self.state is not None:
            return self.state
        info = self.root.lstat(STATE_DIR)
        if info is None:
            if not create:
                return None
            self.assert_identity()
            os.mkdir(STATE_DIR, 0o700, dir_fd=self.root.fd)
            self.assert_identity()
            os.fsync(self.root.fd)
            info = self.root.lstat(STATE_DIR)
        if info is None or not stat.S_ISDIR(info.st_mode):
            raise ValueError(f"role protocol state directory is missing or unsafe: {self.path / STATE_DIR}")
        flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(STATE_DIR, flags, dir_fd=self.root.fd)
        opened = os.fstat(fd)
        if _identity(opened) != _identity(info):
            os.close(fd)
            raise ValueError("role protocol state directory changed identity while opening")
        self.state = DirBoundary(self.path / STATE_DIR, fd)
        self.state.guard = self.assert_identity
        return self.state

    def boundary(self, relative: str, *, create_state: bool = False) -> tuple[DirBoundary, str]:
        parts = Path(relative).parts
        if len(parts) == 1 and parts[0] not in ("", ".", ".."):
            return self.root, parts[0]
        if len(parts) == 2 and parts[0] == STATE_DIR and parts[1] not in ("", ".", ".."):
            state_dir = self.open_state(create=create_state)
            if state_dir is None:
                raise FileNotFoundError(relative)
            return state_dir, parts[1]
        raise ValueError(f"unsafe or unmanaged relative path: {relative}")

    def snapshot(self, relative: str, label: str, *, require_readable: bool = False) -> dict[str, Any]:
        try:
            boundary, name = self.boundary(relative)
        except FileNotFoundError:
            return missing_snapshot()
        return boundary.snapshot(name, label, require_readable=require_readable)


def create_destination_directory(path: Path) -> None:
    absolute = Path(os.path.abspath(os.fspath(path)))
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(os.sep, flags)
    try:
        for component in absolute.parts[1:]:
            try:
                info = os.stat(component, dir_fd=fd, follow_symlinks=False)
            except FileNotFoundError:
                os.mkdir(component, 0o700, dir_fd=fd)
                os.fsync(fd)
                info = os.stat(component, dir_fd=fd, follow_symlinks=False)
            if not stat.S_ISDIR(info.st_mode):
                raise ValueError(f"destination component is not a no-follow directory: {component}")
            next_fd = os.open(component, flags, dir_fd=fd)
            if _identity(os.fstat(next_fd)) != _identity(info):
                os.close(next_fd)
                raise ValueError(f"destination component changed identity: {component}")
            os.close(fd)
            fd = next_fd
    finally:
        os.close(fd)


def validate_receipt_path_before_root_creation(receipt_path: Path, root: Path) -> None:
    absolute_receipt = Path(os.path.abspath(os.fspath(receipt_path)))
    absolute_root = Path(os.path.abspath(os.fspath(root)))
    if absolute_receipt.parts[: len(absolute_root.parts)] == absolute_root.parts:
        raise ValueError("role protocol receipt must be retained outside the managed destination")
    boundary = DirBoundary(absolute_receipt.parent)
    try:
        if boundary.lstat(absolute_receipt.name) is not None:
            raise ValueError("existing receipt cannot be rebound before the destination exists")
        boundary.assert_path_identity()
    finally:
        boundary.close()


def destination_binding(tree: ManagedRoot) -> dict[str, Any]:
    info = tree.root.info
    return {"path": tree.root.path, "device": info.st_dev, "inode": info.st_ino}


def validate_destination(value: Any, tree: ManagedRoot, label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {"path", "device", "inode"}:
        raise ValueError(f"{label} destination binding is malformed")
    if value["path"] != tree.root.path or not all(isinstance(value[k], int) for k in ("device", "inode")):
        raise ValueError(f"{label} destination does not match")
    if (value["device"], value["inode"]) != _identity(tree.root.info):
        raise ValueError(f"{label} destination identity does not match")
    return value


def source_meta(snapshot_value: dict[str, Any], *, default_mode: int) -> tuple[int, int, int]:
    if snapshot_value["exists"]:
        return snapshot_value["mode"], snapshot_value["uid"], snapshot_value["gid"]
    return default_mode, os.getuid(), os.getgid()


def read_bytes(snapshot_value: dict[str, Any]) -> bytes:
    return decode(snapshot_value["bytesBase64"]) if snapshot_value["exists"] else b""


def inspect_candidates(tree: ManagedRoot) -> tuple[str, dict[str, dict[str, Any]]]:
    found: dict[str, dict[str, Any]] = {}
    exact_entries = set(os.listdir(tree.root.fd))
    for name in CONTEXT_CANDIDATES:
        if name not in exact_entries:
            found[name] = missing_snapshot()
        else:
            found[name] = tree.root.snapshot(name, f"global context candidate {name}", require_readable=True)
    selected = next((name for name in CONTEXT_CANDIDATES if found[name]["exists"]), "AGENTS.md")
    return selected, found


def revalidate_candidates(tree: ManagedRoot, expected: dict[str, dict[str, Any]]) -> None:
    tree.assert_identity()
    selected, current = inspect_candidates(tree)
    expected_selected = next((name for name in CONTEXT_CANDIDATES if expected[name]["exists"]), "AGENTS.md")
    if selected != expected_selected:
        raise ValueError(f"selected global context changed concurrently: expected={expected_selected} current={selected}")
    for name in CONTEXT_CANDIDATES:
        if not same_snapshot(current[name], expected[name], identity=True):
            raise ValueError(f"global context candidate changed concurrently: {name}")


def manifest_value(
    selected: str,
    installer_created: bool,
    kernel: bytes,
    legacy: bytes,
    context_prefix: bytes,
    context_suffix: bytes,
    append_prefix: bytes,
    append_suffix: bytes,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "generation": "bridge",
        "selectedContext": {
            "path": selected,
            "installerCreated": installer_created,
            "blockSha256": digest(kernel),
            "prefixSeparatorBase64": encode(context_prefix),
            "suffixSeparatorBase64": encode(context_suffix),
        },
        "legacyAppend": {
            "path": "APPEND_SYSTEM.md",
            "blockSha256": digest(legacy),
            "prefixSeparatorBase64": encode(append_prefix),
            "suffixSeparatorBase64": encode(append_suffix),
        },
    }


def validate_manifest(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or value.get("schemaVersion") != 1 or value.get("generation") != "bridge":
        raise ValueError("role protocol ownership manifest is malformed or unsupported")
    context = value.get("selectedContext")
    legacy = value.get("legacyAppend")
    for entry, label in ((context, "selectedContext"), (legacy, "legacyAppend")):
        if not isinstance(entry, dict):
            raise ValueError(f"role protocol ownership manifest lacks {label}")
        for key in ("path", "blockSha256", "prefixSeparatorBase64", "suffixSeparatorBase64"):
            if not isinstance(entry.get(key), str):
                raise ValueError(f"role protocol ownership manifest {label}.{key} is invalid")
            if key.endswith("Base64"):
                decode(entry[key])
    if context.get("path") not in CONTEXT_CANDIDATES or not isinstance(context.get("installerCreated"), bool):
        raise ValueError("role protocol ownership manifest selected context is invalid")
    if legacy.get("path") != "APPEND_SYSTEM.md":
        raise ValueError("role protocol ownership manifest legacy path is invalid")
    return value


def parse_manifest_snapshot(snap: dict[str, Any]) -> dict[str, Any] | None:
    if not snap["exists"]:
        return None
    if snap["mode"] != 0o600:
        raise ValueError("role protocol ownership manifest must be mode 0600")
    try:
        return validate_manifest(json.loads(read_bytes(snap).decode("utf-8")))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ValueError("role protocol ownership manifest is malformed") from error


def separators_match(data: bytes, selected: tuple[int, int], record: dict[str, Any], description: str) -> None:
    prefix = decode(record["prefixSeparatorBase64"])
    suffix = decode(record["suffixSeparatorBase64"])
    before = data[: selected[0]]
    after = data[selected[1] :]
    if prefix and not before.endswith(prefix):
        raise ValueError(f"{description} prefix separator drift")
    if suffix and not after.startswith(suffix):
        raise ValueError(f"{description} suffix separator drift")


def prepare_apply(tree: ManagedRoot, kernel: bytes, legacy: bytes) -> dict[str, Any]:
    selected, candidates = inspect_candidates(tree)
    manifest_snap = tree.snapshot(f"{STATE_DIR}/{STATE_NAME}", "role protocol ownership manifest")
    manifest = parse_manifest_snapshot(manifest_snap)
    if manifest is not None and manifest["selectedContext"]["path"] != selected:
        raise ValueError(f"selected global context drift: manifest={manifest['selectedContext']['path']} current={selected}")
    selected_snap = candidates[selected]
    for name, snap in candidates.items():
        if not snap["exists"]:
            continue
        found = managed_range(read_bytes(snap), KERNEL_START, KERNEL_END, f"global context candidate {name}")
        if name != selected and found is not None:
            # Case-insensitive aliases may resolve to the same inode.
            if not (selected_snap["exists"] and _snapshot_identity_equal(snap, selected_snap)):
                raise ValueError(f"unselected global context candidate contains a latent role kernel: {name}")
    selected_old = read_bytes(selected_snap)
    context_range = managed_range(selected_old, KERNEL_START, KERNEL_END, "selected global context")
    if manifest is None and context_range is not None:
        raise ValueError("selected global context contains an unowned role-kernel block")
    if manifest is not None:
        if context_range is None or selected_old[context_range[0] : context_range[1]] != kernel:
            raise ValueError("owned selected global context block is missing or stale")
        separators_match(selected_old, context_range, manifest["selectedContext"], "selected global context")
    selected_new, context_prefix, context_suffix = patch_block(
        selected_old, kernel, KERNEL_START, KERNEL_END, "selected global context"
    )

    append_snap = tree.root.snapshot("APPEND_SYSTEM.md", "legacy APPEND destination", require_readable=True)
    append_old = read_bytes(append_snap)
    append_range = managed_range(append_old, LEGACY_START, LEGACY_END, "legacy APPEND destination")
    if manifest is None:
        required = legacy if append_range is not None else None
    else:
        record = manifest["legacyAppend"]
        if append_range is None or digest(append_old[append_range[0] : append_range[1]]) != record["blockSha256"]:
            raise ValueError("owned legacy APPEND block is missing or stale")
        separators_match(append_old, append_range, record, "legacy APPEND")
        required = append_old[append_range[0] : append_range[1]]
    append_new, append_prefix, append_suffix = patch_block(
        append_old,
        legacy,
        LEGACY_START,
        LEGACY_END,
        "legacy APPEND destination",
        required_existing=required,
    )
    if manifest is not None:
        context_prefix = decode(manifest["selectedContext"]["prefixSeparatorBase64"])
        context_suffix = decode(manifest["selectedContext"]["suffixSeparatorBase64"])
        append_prefix = decode(manifest["legacyAppend"]["prefixSeparatorBase64"])
        append_suffix = decode(manifest["legacyAppend"]["suffixSeparatorBase64"])
    value = manifest_value(
        selected,
        manifest["selectedContext"]["installerCreated"] if manifest is not None else not selected_snap["exists"],
        kernel,
        legacy,
        context_prefix,
        context_suffix,
        append_prefix,
        append_suffix,
    )
    return {
        "selected": selected,
        "candidates": candidates,
        "files": [
            {"kind": "context", "relativePath": selected, "before": selected_snap, "bytes": selected_new, "defaultMode": 0o600},
            {"kind": "append", "relativePath": "APPEND_SYSTEM.md", "before": append_snap, "bytes": append_new, "defaultMode": 0o600},
            {"kind": "manifest", "relativePath": f"{STATE_DIR}/{STATE_NAME}", "before": manifest_snap, "bytes": canonical_json(value), "defaultMode": 0o600},
        ],
        "manifest": value,
    }


def _snapshot_identity_equal(one: dict[str, Any], two: dict[str, Any]) -> bool:
    return one.get("exists") and two.get("exists") and (one["device"], one["inode"]) == (two["device"], two["inode"])


def receipt_boundary(path: Path, tree: ManagedRoot) -> tuple[DirBoundary, str]:
    absolute = Path(os.path.abspath(os.fspath(path)))
    root_prefix = tree.path.parts
    if absolute.parts[: len(root_prefix)] == root_prefix:
        raise ValueError("role protocol receipt must be retained outside the managed destination")
    boundary = DirBoundary(absolute.parent)
    boundary.guard = tree.assert_identity
    name = absolute.name
    if not name or name in (".", ".."):
        boundary.close()
        raise ValueError("role protocol receipt path is unsafe")
    info = boundary.lstat(name)
    if info is not None and not stat.S_ISREG(info.st_mode):
        boundary.close()
        raise ValueError("role protocol receipt is not a regular no-follow file")
    return boundary, name


def validate_apply_receipt_leaf(
    tree: ManagedRoot, receipt_ref: tuple[DirBoundary, str]
) -> tuple[dict[str, Any], dict[str, Any] | None]:
    boundary, name = receipt_ref
    snap = boundary.snapshot(name, "role protocol receipt")
    if not snap["exists"]:
        return snap, None
    if snap["mode"] != 0o600:
        raise ValueError("existing role protocol receipt must be mode 0600")
    value = validate_receipt(load_json_snapshot(snap, "role protocol receipt"), tree)
    return snap, value


def validate_apply_receipt_current_state(
    tree: ManagedRoot, value: dict[str, Any], *, transaction_present: bool
) -> None:
    if transaction_present:
        return
    use_post = value["transaction"] == "applied"
    image_key = "postimage" if use_post else "preimage"
    candidate_key = "candidatePostimages" if use_post else "candidatePreimages"
    for entry in value["files"]:
        actual = tree.snapshot(entry["relativePath"], f"existing receipt {entry['kind']}")
        if not same_snapshot(actual, entry[image_key], identity=True):
            raise ValueError("existing receipt does not own the current destination state")
    _, candidates = inspect_candidates(tree)
    for name in CONTEXT_CANDIDATES:
        if not same_snapshot(candidates[name], value[candidate_key][name], identity=True):
            raise ValueError("existing receipt candidate state is stale")


def receipt_publication_meta(snapshot_value: dict[str, Any]) -> tuple[int, int, int]:
    if snapshot_value["exists"]:
        return 0o600, snapshot_value["uid"], snapshot_value["gid"]
    return 0o600, os.getuid(), os.getgid()


def publish_bytes(boundary: DirBoundary, name: str, data: bytes, expected: dict[str, Any], label: str, mode: int, uid: int, gid: int) -> dict[str, Any]:
    staged = boundary.stage(name, data, mode, uid, gid, label)
    try:
        return boundary.publish(staged, name, expected, label)
    except Exception:
        boundary.cleanup_staged(staged)
        raise


def write_journal(tree: ManagedRoot, value: dict[str, Any], expected: dict[str, Any]) -> dict[str, Any]:
    tree.assert_identity()
    state_dir = tree.open_state(create=True)
    assert state_dir is not None
    mode, uid, gid = source_meta(expected, default_mode=0o600)
    return publish_bytes(state_dir, TX_NAME, canonical_json(value), expected, "journal", mode, uid, gid)


def load_json_snapshot(snap: dict[str, Any], label: str) -> Any:
    if not snap["exists"]:
        return None
    try:
        return json.loads(read_bytes(snap).decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} is not valid JSON") from error


def expected_inventory(selected: str) -> dict[str, str]:
    return {
        "context": selected,
        "append": "APPEND_SYSTEM.md",
        "manifest": f"{STATE_DIR}/{STATE_NAME}",
    }


def validate_file_entries(files: Any, selected: str, label: str, *, journal: bool) -> list[dict[str, Any]]:
    if not isinstance(files, list) or len(files) != 3:
        raise ValueError(f"{label} file inventory must contain exactly three entries")
    expected = expected_inventory(selected)
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for index, entry in enumerate(files):
        if not isinstance(entry, dict):
            raise ValueError(f"{label} file entry {index} is malformed")
        if journal:
            allowed = {"kind", "relativePath", "before", "after", "staged", "recovered", "recoveryTarget", "preserveExternal"}
            required = {"kind", "relativePath", "before", "after"}
        else:
            allowed = required = {"kind", "relativePath", "preimage", "postimage"}
        if not required.issubset(entry) or not set(entry).issubset(allowed):
            raise ValueError(f"{label} file entry {index} fields are malformed")
        if "preserveExternal" in entry and entry["preserveExternal"] is not True:
            raise ValueError(f"{label} file entry {index} external-preservation flag is invalid")
        kind = entry.get("kind")
        if kind not in MANAGED_KINDS or kind in seen:
            raise ValueError(f"{label} file inventory kind is missing, duplicated, or unknown")
        seen.add(kind)
        if entry.get("relativePath") != expected[kind]:
            raise ValueError(f"{label} {kind} path does not match the exact managed inventory")
        validate_snapshot(entry.get("before") if journal else entry.get("preimage"), f"{label} {kind} preimage")
        validate_snapshot(entry.get("after") if journal else entry.get("postimage"), f"{label} {kind} postimage")
        if journal:
            staged = entry.get("staged")
            if staged is not None:
                if not isinstance(staged, dict) or set(staged) != {"name", "snapshot"} or not isinstance(staged["name"], str):
                    raise ValueError(f"{label} {kind} staged record is malformed")
                validate_snapshot(staged["snapshot"], f"{label} {kind} staged snapshot")
            recovered = entry.get("recovered")
            if recovered is not None:
                validate_snapshot(recovered, f"{label} {kind} recovered snapshot")
        result.append(entry)
    if seen != set(MANAGED_KINDS):
        raise ValueError(f"{label} file inventory is incomplete")
    result.sort(key=lambda item: MANAGED_KINDS.index(item["kind"]))
    return result


def receipt_value(
    tree: ManagedRoot,
    selected: str,
    candidate_before: dict[str, dict[str, Any]],
    candidate_after: dict[str, dict[str, Any]],
    files: list[dict[str, Any]],
    transaction: str,
) -> dict[str, Any]:
    return {
        "schemaVersion": SCHEMA_VERSION,
        "manager": "prime-claw-role-protocol",
        "transaction": transaction,
        "generation": "bridge",
        "destination": destination_binding(tree),
        "selectedContext": selected,
        "manifestRelativePath": f"{STATE_DIR}/{STATE_NAME}",
        "candidatePreimages": candidate_before,
        "candidatePostimages": candidate_after,
        "files": [
            {
                "kind": entry["kind"],
                "relativePath": entry["relativePath"],
                "preimage": entry["before"],
                "postimage": entry["after"],
            }
            for entry in files
        ],
    }


def validate_candidate_map(value: Any, label: str) -> dict[str, dict[str, Any]]:
    if not isinstance(value, dict) or set(value) != set(CONTEXT_CANDIDATES):
        raise ValueError(f"{label} candidate inventory is malformed")
    for name in CONTEXT_CANDIDATES:
        validate_snapshot(value[name], f"{label} candidate {name}")
    return value


def validate_receipt(value: Any, tree: ManagedRoot) -> dict[str, Any]:
    required = {
        "schemaVersion", "manager", "transaction", "generation", "destination",
        "selectedContext", "manifestRelativePath", "candidatePreimages", "candidatePostimages", "files",
    }
    if not isinstance(value, dict) or set(value) != required:
        raise ValueError("role protocol receipt schema is malformed")
    if value["schemaVersion"] != SCHEMA_VERSION or value["manager"] != "prime-claw-role-protocol" or value["generation"] != "bridge":
        raise ValueError("role protocol receipt schema or generation is unsupported")
    if value["transaction"] not in {"prepared", "applied", "rolled_back", "restored"}:
        raise ValueError("role protocol receipt transaction state is invalid")
    validate_destination(value["destination"], tree, "receipt")
    selected = value["selectedContext"]
    if selected not in CONTEXT_CANDIDATES or value["manifestRelativePath"] != f"{STATE_DIR}/{STATE_NAME}":
        raise ValueError("role protocol receipt selection or manifest binding is invalid")
    pre_candidates = validate_candidate_map(value["candidatePreimages"], "receipt preimage")
    post_candidates = validate_candidate_map(value["candidatePostimages"], "receipt postimage")
    pre_selected = next((name for name in CONTEXT_CANDIDATES if pre_candidates[name]["exists"]), "AGENTS.md")
    post_selected = next((name for name in CONTEXT_CANDIDATES if post_candidates[name]["exists"]), "AGENTS.md")
    if pre_selected != selected or post_selected != selected:
        raise ValueError("receipt selected context does not match candidate priority")
    files = validate_file_entries(value["files"], selected, "receipt", journal=False)
    by_kind = {entry["kind"]: entry for entry in files}
    if not same_snapshot(pre_candidates[selected], by_kind["context"]["preimage"], identity=True):
        raise ValueError("receipt selected-context preimage does not match candidate inventory")
    if not same_snapshot(post_candidates[selected], by_kind["context"]["postimage"], identity=True):
        raise ValueError("receipt selected-context postimage does not match candidate inventory")
    for name in CONTEXT_CANDIDATES:
        if name == selected or same_snapshot(pre_candidates[name], post_candidates[name], identity=True):
            continue
        if (
            name.casefold() == selected.casefold()
            and post_candidates[name]["exists"]
            and _snapshot_identity_equal(post_candidates[name], post_candidates[selected])
        ):
            continue
        raise ValueError("receipt changes an unselected context candidate")
    context_post = read_bytes(by_kind["context"]["postimage"])
    kernel_range = managed_range(context_post, KERNEL_START, KERNEL_END, "receipt context postimage")
    if kernel_range is None:
        raise ValueError("receipt context postimage lacks the managed kernel")
    append_post = read_bytes(by_kind["append"]["postimage"])
    legacy_range = managed_range(append_post, LEGACY_START, LEGACY_END, "receipt APPEND postimage")
    if legacy_range is None:
        raise ValueError("receipt APPEND postimage lacks the legacy block")
    manifest_pre = parse_manifest_snapshot(by_kind["manifest"]["preimage"])
    if manifest_pre is not None:
        if manifest_pre["selectedContext"]["path"] != selected:
            raise ValueError("receipt manifest preimage is not bound to selected context")
        context_pre = read_bytes(by_kind["context"]["preimage"])
        append_pre = read_bytes(by_kind["append"]["preimage"])
        pre_kernel = managed_range(context_pre, KERNEL_START, KERNEL_END, "receipt context preimage")
        pre_legacy = managed_range(append_pre, LEGACY_START, LEGACY_END, "receipt APPEND preimage")
        if pre_kernel is None or digest(context_pre[pre_kernel[0] : pre_kernel[1]]) != manifest_pre["selectedContext"]["blockSha256"]:
            raise ValueError("receipt manifest preimage kernel binding is inconsistent")
        if pre_legacy is None or digest(append_pre[pre_legacy[0] : pre_legacy[1]]) != manifest_pre["legacyAppend"]["blockSha256"]:
            raise ValueError("receipt manifest preimage APPEND binding is inconsistent")
    manifest_post = by_kind["manifest"]["postimage"]
    manifest = parse_manifest_snapshot(manifest_post)
    if manifest is None or manifest["selectedContext"]["path"] != selected:
        raise ValueError("receipt manifest postimage is not bound to selected context")
    if manifest["selectedContext"]["blockSha256"] != digest(context_post[kernel_range[0] : kernel_range[1]]):
        raise ValueError("receipt manifest kernel digest binding is inconsistent")
    if manifest["legacyAppend"]["blockSha256"] != digest(append_post[legacy_range[0] : legacy_range[1]]):
        raise ValueError("receipt manifest APPEND digest binding is inconsistent")
    return value


def validate_journal(value: Any, tree: ManagedRoot) -> dict[str, Any]:
    required = {
        "schemaVersion", "manager", "operation", "phase", "generation", "destination",
        "selectedContext", "candidateBefore", "candidateAfter", "files", "receipt",
    }
    if not isinstance(value, dict) or set(value) != required:
        raise ValueError("role protocol transaction journal schema is malformed")
    if value["schemaVersion"] != SCHEMA_VERSION or value["manager"] != "prime-claw-role-protocol" or value["generation"] != "bridge":
        raise ValueError("role protocol transaction journal is unsupported")
    if value["operation"] not in {"apply", "restore"} or not isinstance(value["phase"], str):
        raise ValueError("role protocol transaction journal operation/phase is invalid")
    validate_destination(value["destination"], tree, "journal")
    selected = value["selectedContext"]
    if selected not in CONTEXT_CANDIDATES:
        raise ValueError("role protocol transaction selected context is invalid")
    validate_candidate_map(value["candidateBefore"], "journal before")
    validate_candidate_map(value["candidateAfter"], "journal after")
    validate_file_entries(value["files"], selected, "journal", journal=True)
    receipt_record = value["receipt"]
    if receipt_record is not None:
        if not isinstance(receipt_record, dict) or not {"path", "snapshot"}.issubset(receipt_record) or not set(receipt_record).issubset({"path", "snapshot", "preparedStaged", "appliedStaged"}) or not isinstance(receipt_record["path"], str):
            raise ValueError("role protocol transaction receipt binding is malformed")
        validate_snapshot(receipt_record["snapshot"], "journal receipt")
        for stage_key in ("preparedStaged", "appliedStaged"):
            staged = receipt_record.get(stage_key)
            if staged is not None:
                if not isinstance(staged, dict) or set(staged) != {"name", "snapshot"} or not isinstance(staged["name"], str):
                    raise ValueError(f"role protocol transaction {stage_key} receipt staging is malformed")
                validate_snapshot(staged["snapshot"], f"journal {stage_key} receipt staging")
    return value


def journal_snapshot(tree: ManagedRoot) -> dict[str, Any]:
    return tree.snapshot(f"{STATE_DIR}/{TX_NAME}", "role protocol transaction journal")


def update_journal(tree: ManagedRoot, journal: dict[str, Any], current: dict[str, Any]) -> dict[str, Any]:
    return write_journal(tree, journal, current)


def canonical_applied_receipt_from_journal(
    tree: ManagedRoot, journal: dict[str, Any]
) -> dict[str, Any]:
    return receipt_value(
        tree,
        journal["selectedContext"],
        journal["candidateBefore"],
        journal["candidateAfter"],
        journal["files"],
        "applied",
    )


def validate_recovery_applied_receipt(
    tree: ManagedRoot,
    journal: dict[str, Any],
    current: dict[str, Any],
) -> dict[str, Any]:
    record = journal.get("receipt")
    if record is None or not current["exists"]:
        raise ValueError("transaction has no applied receipt authority")
    expected_value = canonical_applied_receipt_from_journal(tree, journal)
    if read_bytes(current) != canonical_json(expected_value):
        raise ValueError("applied receipt bytes do not match the transaction journal")
    staged = record.get("appliedStaged")
    expected_snapshot = staged["snapshot"] if staged is not None else record["snapshot"]
    if not same_snapshot(current, expected_snapshot, identity=True):
        raise ValueError("applied receipt identity or metadata does not match the journaled publication")
    return validate_receipt(expected_value, tree)


def validate_exact_transaction_poststate(
    tree: ManagedRoot,
    journal: dict[str, Any],
    receipt_ref: tuple[DirBoundary, str] | None = None,
    receipt_expected: dict[str, Any] | None = None,
) -> None:
    tree.assert_identity()
    revalidate_candidates(tree, journal["candidateAfter"])
    for entry in validate_file_entries(journal["files"], journal["selectedContext"], "journal", journal=True):
        actual = tree.snapshot(entry["relativePath"], f"transaction postimage {entry['kind']}")
        if not same_snapshot(actual, entry["after"], identity=True):
            raise ValueError(f"exact transaction postimage changed for {entry['kind']}")
    if receipt_ref is not None:
        if receipt_expected is None:
            raise ValueError("receipt post-state expectation is missing")
        receipt_ref[0].assert_path_identity()
        actual_receipt = receipt_ref[0].snapshot(receipt_ref[1], "role protocol receipt")
        if not same_snapshot(actual_receipt, receipt_expected, identity=True):
            raise ValueError("exact role protocol receipt postimage changed")


def cleanup_transaction_temps(tree: ManagedRoot, journal: dict[str, Any]) -> None:
    for entry in journal["files"]:
        staged = entry.get("staged")
        if staged:
            boundary, _ = tree.boundary(entry["relativePath"], create_state=True)
            boundary.cleanup_staged(staged)
    receipt_record = journal.get("receipt")
    if receipt_record is not None:
        boundary, _ = receipt_boundary(Path(receipt_record["path"]), tree)
        try:
            for stage_key in ("preparedStaged", "appliedStaged"):
                boundary.cleanup_staged(receipt_record.get(stage_key))
        finally:
            boundary.close()


def _known_state(actual: dict[str, Any], entry: dict[str, Any], source: str, target: str) -> str | None:
    if same_snapshot(actual, entry[source], identity=True):
        return source
    if same_snapshot(actual, entry[target], identity=True):
        return target
    recovered = entry.get("recovered")
    if recovered is not None and same_snapshot(actual, recovered, identity=True):
        return target
    recovery_target = entry.get("recoveryTarget")
    if recovery_target is not None and same_snapshot(actual, recovery_target, identity=True):
        return "recoveryTarget"
    return None


def drive_to_target(tree: ManagedRoot, journal: dict[str, Any], journal_state: dict[str, Any], *, source: str, target: str) -> dict[str, Any]:
    files = validate_file_entries(journal["files"], journal["selectedContext"], "journal", journal=True)
    states: dict[str, str] = {}
    for entry in files:
        tree.assert_identity()
        actual = tree.snapshot(entry["relativePath"], f"transaction {entry['kind']}")
        known = _known_state(actual, entry, source, target)
        if known is None and entry.get("preserveExternal") is True:
            known = "external"
        if known is None:
            raise ValueError(f"transaction recovery is uncertain for {entry['kind']}; external state is preserved")
        states[entry["kind"]] = known
    order = list(reversed(files)) if target == "before" else files
    for entry in order:
        known = states[entry["kind"]]
        if known == "external":
            continue
        if known in {target, "recoveryTarget"}:
            if known == "recoveryTarget":
                entry["recovered"] = entry["recoveryTarget"]
                journal_state = update_journal(tree, journal, journal_state)
            continue
        goal = entry[target]
        boundary, name = tree.boundary(entry["relativePath"], create_state=True)
        actual = tree.snapshot(entry["relativePath"], f"transaction {entry['kind']}")
        if not goal["exists"]:
            boundary.unlink_exact(name, actual, f"transaction {entry['kind']}")
            entry["recovered"] = missing_snapshot()
            journal_state = update_journal(tree, journal, journal_state)
            continue
        staged = boundary.stage(name, read_bytes(goal), goal["mode"], goal["uid"], goal["gid"], f"recovery-{entry['kind']}")
        entry["recoveryTarget"] = staged["snapshot"]
        journal["phase"] = f"recovering-{entry['kind']}"
        journal_state = update_journal(tree, journal, journal_state)
        try:
            actual_after = boundary.publish(staged, name, actual, f"recovery-{entry['kind']}")
        except Exception:
            # If replacement occurred, retain the staged identity in the journal.
            raise
        entry["recovered"] = actual_after
        journal_state = update_journal(tree, journal, journal_state)
    return journal_state


def remove_journal(tree: ManagedRoot, expected: dict[str, Any]) -> None:
    tree.assert_identity()
    state_dir = tree.open_state(create=False)
    if state_dir is None:
        raise ValueError("transaction state directory disappeared")
    state_dir.unlink_exact(TX_NAME, expected, "role protocol transaction journal")


def receipt_with_current_preimages(
    tree: ManagedRoot, value: dict[str, Any], transaction: str
) -> dict[str, Any]:
    updated = json.loads(json.dumps(value))
    updated["transaction"] = transaction
    by_kind = {entry["kind"]: entry for entry in updated["files"]}
    for kind in MANAGED_KINDS:
        entry = by_kind[kind]
        entry["preimage"] = tree.snapshot(entry["relativePath"], f"receipt {kind} restored preimage")
    _, candidates = inspect_candidates(tree)
    updated["candidatePreimages"] = candidates
    validate_receipt(updated, tree)
    return updated


def finalize_transaction_receipt(
    tree: ManagedRoot,
    journal: dict[str, Any],
    journal_state: dict[str, Any],
    outcome: str,
) -> dict[str, Any]:
    record = journal.get("receipt")
    if record is None:
        return journal_state
    boundary, name = receipt_boundary(Path(record["path"]), tree)
    try:
        current = boundary.snapshot(name, "role protocol receipt")
        if not current["exists"]:
            if outcome == "rolled_back":
                return journal_state
            raise ValueError("restore transaction receipt disappeared")
        value = validate_receipt(load_json_snapshot(current, "role protocol receipt"), tree)
        desired = "restored" if outcome == "restored" else "rolled_back"
        if value["transaction"] == desired:
            fault("receipt-recovery:before-directory-fsync")
            os.fsync(boundary.fd)
            fault("receipt-recovery:after-directory-fsync")
            boundary.assert_path_identity()
            tree.assert_identity()
            record["snapshot"] = current
            return update_journal(tree, journal, journal_state)
        updated = receipt_with_current_preimages(tree, value, desired)
        mode, uid, gid = receipt_publication_meta(current)
        published = publish_bytes(
            boundary,
            name,
            canonical_json(updated),
            current,
            f"receipt-{desired.replace('_', '-')}",
            mode,
            uid,
            gid,
        )
        record["snapshot"] = published
        return update_journal(tree, journal, journal_state)
    finally:
        boundary.close()


def recover_existing_transaction(tree: ManagedRoot) -> dict[str, Any] | None:
    snap = journal_snapshot(tree)
    if not snap["exists"]:
        return None
    if snap["mode"] != 0o600:
        raise ValueError("role protocol transaction journal must be mode 0600")
    journal = validate_journal(load_json_snapshot(snap, "role protocol transaction journal"), tree)
    operation = journal["operation"]
    if operation == "restore":
        target = "after"
        source = "before"
        outcome = "restored"
    else:
        target = "before"
        source = "after"
        outcome = "rolled_back"
        receipt_record = journal.get("receipt")
        if receipt_record is not None:
            receipt_path = Path(receipt_record["path"])
            boundary, name = receipt_boundary(receipt_path, tree)
            try:
                current_receipt = boundary.snapshot(name, "role protocol receipt")
                if current_receipt["exists"]:
                    try:
                        validate_recovery_applied_receipt(tree, journal, current_receipt)
                        validate_exact_transaction_poststate(
                            tree, journal, (boundary, name), current_receipt
                        )
                    except ValueError:
                        pass
                    else:
                        fault("receipt-recovery:before-directory-fsync")
                        os.fsync(boundary.fd)
                        fault("receipt-recovery:after-directory-fsync")
                        validate_recovery_applied_receipt(tree, journal, current_receipt)
                        validate_exact_transaction_poststate(
                            tree, journal, (boundary, name), current_receipt
                        )
                        cleanup_transaction_temps(tree, journal)
                        remove_journal(tree, snap)
                        return {"recovered": True, "outcome": "committed"}
                safe_receipt_states = [receipt_record["snapshot"]]
                if receipt_record.get("preparedStaged") is not None:
                    safe_receipt_states.append(receipt_record["preparedStaged"]["snapshot"])
                if not any(same_snapshot(current_receipt, expected, identity=True) for expected in safe_receipt_states):
                    journal["phase"] = "uncertain"
                    try:
                        update_journal(tree, journal, snap)
                    except Exception:
                        pass
                    raise RuntimeError(
                        "transaction receipt changed outside its journaled publication; recovery remains uncertain"
                    )
            finally:
                boundary.close()
    try:
        if operation == "apply":
            for entry in journal["files"]:
                actual = tree.snapshot(entry["relativePath"], f"transaction {entry['kind']}")
                if _known_state(actual, entry, source, target) is not None:
                    continue
                staged = entry.get("staged")
                if staged is not None:
                    boundary, _ = tree.boundary(entry["relativePath"], create_state=True)
                    staged_actual = boundary.snapshot(staged["name"], f"transaction {entry['kind']} staged temp")
                    if same_snapshot(staged_actual, staged["snapshot"], identity=True):
                        entry["preserveExternal"] = True
                        continue
                raise ValueError(f"transaction recovery is uncertain for {entry['kind']}; external state is preserved")
        journal["phase"] = f"recovering-{outcome}"
        snap = update_journal(tree, journal, snap)
        snap = drive_to_target(tree, journal, snap, source=source, target=target)
        cleanup_transaction_temps(tree, journal)
        snap = finalize_transaction_receipt(tree, journal, snap, outcome)
        journal["phase"] = outcome
        snap = update_journal(tree, journal, snap)
        remove_journal(tree, snap)
        return {"recovered": True, "outcome": outcome}
    except Exception as error:
        try:
            journal["phase"] = "uncertain"
            update_journal(tree, journal, journal_snapshot(tree))
        except Exception:
            pass
        raise RuntimeError(f"transaction recovery remains uncertain: {error}") from error


def reconcile_temps(boundary: DirBoundary, target: str) -> None:
    boundary.assert_path_identity()
    if boundary.guard is not None:
        boundary.guard()
    pattern = re.compile(
        rf"^\.{re.escape(target)}\.{TEMP_TAG}-(?P<pid>[0-9]+)-[0-9a-f]{{16}}\.tmp$"
    )
    removed = False
    for name in os.listdir(boundary.fd):
        match = pattern.fullmatch(name)
        if match is None:
            continue
        try:
            os.kill(int(match.group("pid")), 0)
        except ProcessLookupError:
            pass
        except PermissionError:
            continue
        else:
            continue
        info = boundary.lstat(name)
        if info is None or not stat.S_ISREG(info.st_mode):
            continue
        fd = os.open(name, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=boundary.fd)
        try:
            if _identity(os.fstat(fd)) != _identity(info):
                continue
        finally:
            os.close(fd)
        if boundary.guard is not None:
            boundary.guard()
        os.unlink(name, dir_fd=boundary.fd)
        removed = True
    if removed:
        if boundary.guard is not None:
            boundary.guard()
        os.fsync(boundary.fd)


def reconcile_unowned_temps(tree: ManagedRoot) -> None:
    for name in (*CONTEXT_CANDIDATES, "APPEND_SYSTEM.md"):
        reconcile_temps(tree.root, name)
    state_dir = tree.open_state(create=True)
    assert state_dir is not None
    for name in (STATE_NAME, TX_NAME):
        reconcile_temps(state_dir, name)


def acquire_lock(tree: ManagedRoot, *, create: bool) -> int:
    info = tree.root.lstat(LOCK_NAME)
    if info is None and not create:
        raise ValueError("role protocol lock is missing")
    if info is not None and not stat.S_ISREG(info.st_mode):
        raise ValueError("role protocol lock is not a regular no-follow file")
    flags = os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    if create:
        flags |= os.O_CREAT
    fd = os.open(LOCK_NAME, flags, 0o600, dir_fd=tree.root.fd)
    opened = os.fstat(fd)
    if info is not None and _identity(opened) != _identity(info):
        os.close(fd)
        raise ValueError("role protocol lock changed identity while opening")
    fcntl.flock(fd, fcntl.LOCK_EX)
    tree.lock_fd = fd
    tree.assert_identity()
    return fd


def apply_protocol(root: Path, config_path: Path, kernel_path: Path, legacy_path: Path, receipt_path: Path | None) -> dict[str, Any]:
    validate_config(config_path)
    kernel = load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
    legacy = load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
    try:
        tree = ManagedRoot(root)
    except FileNotFoundError:
        validate_absent_destination(root)
        if receipt_path is not None:
            validate_receipt_path_before_root_creation(receipt_path, root)
        create_destination_directory(root)
        tree = ManagedRoot(root)
    receipt_ref: tuple[DirBoundary, str] | None = None
    lock_fd = -1
    try:
        # Reject unsafe state/receipt parents before lock or state creation.
        state_info = tree.root.lstat(STATE_DIR)
        if state_info is not None and not stat.S_ISDIR(state_info.st_mode):
            raise ValueError("role protocol state directory is unsafe")
        receipt_preflight_value = None
        if receipt_path is not None:
            receipt_ref = receipt_boundary(receipt_path, tree)
            _, receipt_preflight_value = validate_apply_receipt_leaf(tree, receipt_ref)
        # Preflight shared markers before creating the lock unless a durable
        # transaction must be recovered first.
        transaction_present = False
        if state_info is not None:
            tree.open_state(create=False)
            transaction_present = journal_snapshot(tree)["exists"]
        if receipt_preflight_value is not None:
            validate_apply_receipt_current_state(
                tree, receipt_preflight_value, transaction_present=transaction_present
            )
        if not transaction_present:
            prepare_apply(tree, kernel, legacy)
        lock_fd = acquire_lock(tree, create=True)
        tree.open_state(create=True)
        tree.assert_identity()
        recovered = recover_existing_transaction(tree)
        reconcile_unowned_temps(tree)
        if receipt_ref is not None:
            reconcile_temps(receipt_ref[0], receipt_ref[1])
        prepared = prepare_apply(tree, kernel, legacy)
        files = prepared["files"]
        # No-op installs preserve inode/mtime and do not create a new receipt.
        if all(read_bytes(entry["before"]) == entry["bytes"] for entry in files):
            result = check_protocol(root, config_path, kernel_path, legacy_path, already_locked=True, tree=tree)
            result["recovered"] = recovered
            return result
        try:
            for entry in files:
                mode, uid, gid = source_meta(entry["before"], default_mode=entry["defaultMode"])
                entry["after"] = dict(entry["before"])
                if read_bytes(entry["before"]) != entry["bytes"]:
                    boundary, name = tree.boundary(entry["relativePath"], create_state=True)
                    entry["staged"] = boundary.stage(name, entry["bytes"], mode, uid, gid, entry["kind"])
                    entry["after"] = entry["staged"]["snapshot"]
                else:
                    entry["staged"] = None
                entry.pop("bytes")
                entry.pop("defaultMode")
        except Exception:
            for staged_entry in files:
                staged = staged_entry.get("staged")
                if staged is None:
                    continue
                boundary, _ = tree.boundary(staged_entry["relativePath"], create_state=True)
                boundary.cleanup_staged(staged)
            raise
        candidate_after = dict(prepared["candidates"])
        candidate_after[prepared["selected"]] = next(entry["after"] for entry in files if entry["kind"] == "context")
        receipt_original = missing_snapshot()
        if receipt_ref is not None:
            receipt_original = receipt_ref[0].snapshot(receipt_ref[1], "role protocol receipt")
        journal = {
            "schemaVersion": SCHEMA_VERSION,
            "manager": "prime-claw-role-protocol",
            "operation": "apply",
            "phase": "prepared",
            "generation": "bridge",
            "destination": destination_binding(tree),
            "selectedContext": prepared["selected"],
            "candidateBefore": prepared["candidates"],
            "candidateAfter": candidate_after,
            "files": files,
            "receipt": None if receipt_path is None else {"path": os.path.abspath(os.fspath(receipt_path)), "snapshot": receipt_original},
        }
        journal_state = write_journal(tree, journal, missing_snapshot())
        receipt_current = receipt_original
        if receipt_ref is not None:
            prepared_receipt = receipt_value(tree, prepared["selected"], prepared["candidates"], candidate_after, files, "prepared")
            mode, uid, gid = receipt_publication_meta(receipt_current)
            prepared_staged = receipt_ref[0].stage(
                receipt_ref[1], canonical_json(prepared_receipt), mode, uid, gid, "receipt-prepared"
            )
            journal["receipt"]["preparedStaged"] = prepared_staged
            try:
                fault("receipt-prepared-stage-journal:before")
                journal_state = update_journal(tree, journal, journal_state)
            except Exception:
                current_journal = journal_snapshot(tree)
                durable_names_stage = False
                if current_journal["exists"]:
                    try:
                        durable = validate_journal(
                            load_json_snapshot(current_journal, "role protocol transaction journal"), tree
                        )
                        durable_names_stage = durable.get("receipt", {}).get("preparedStaged") == prepared_staged
                    except Exception:
                        durable_names_stage = False
                if not durable_names_stage:
                    receipt_ref[0].cleanup_staged(prepared_staged)
                raise
            receipt_current = receipt_ref[0].publish(
                prepared_staged, receipt_ref[1], receipt_current, "receipt-prepared"
            )
            journal["receipt"]["snapshot"] = receipt_current
            journal["receipt"].pop("preparedStaged", None)
            journal_state = update_journal(tree, journal, journal_state)
        expected_candidates = dict(prepared["candidates"])
        try:
            for entry in files:
                if entry["staged"] is None:
                    continue
                fault(f"{entry['kind']}:before-commit-revalidation")
                revalidate_candidates(tree, expected_candidates)
                if receipt_ref is not None:
                    receipt_ref[0].assert_path_identity()
                    if not same_snapshot(receipt_ref[0].snapshot(receipt_ref[1], "role protocol receipt"), receipt_current, identity=True):
                        raise ValueError("role protocol receipt changed concurrently")
                journal["phase"] = f"publishing-{entry['kind']}"
                journal_state = update_journal(tree, journal, journal_state)
                boundary, name = tree.boundary(entry["relativePath"], create_state=True)
                entry["after"] = boundary.publish(entry["staged"], name, entry["before"], entry["kind"])
                entry["staged"] = None
                if entry["kind"] == "context":
                    _, observed_candidates = inspect_candidates(tree)
                    for candidate_name in CONTEXT_CANDIDATES:
                        previous = expected_candidates[candidate_name]
                        observed = observed_candidates[candidate_name]
                        if same_snapshot(observed, previous, identity=True):
                            continue
                        if (
                            observed["exists"]
                            and _snapshot_identity_equal(observed, entry["after"])
                            and candidate_name.casefold() == prepared["selected"].casefold()
                        ):
                            continue
                        raise ValueError(f"global context candidate changed concurrently: {candidate_name}")
                    expected_candidates = observed_candidates
                    journal["candidateAfter"] = observed_candidates
                journal_state = update_journal(tree, journal, journal_state)
            journal["phase"] = "verifying"
            journal_state = update_journal(tree, journal, journal_state)
            fault("final-check:before")
            validate_exact_transaction_poststate(tree, journal, receipt_ref, receipt_current if receipt_ref is not None else None)
            result = check_protocol(root, config_path, kernel_path, legacy_path, already_locked=True, tree=tree, allow_transaction=True)
            fault("final-check:after")
            validate_exact_transaction_poststate(tree, journal, receipt_ref, receipt_current if receipt_ref is not None else None)
            if receipt_ref is not None:
                applied_receipt = receipt_value(tree, prepared["selected"], prepared["candidates"], expected_candidates, files, "applied")
                mode, uid, gid = receipt_publication_meta(receipt_current)
                journal["phase"] = "finalizing-receipt"
                journal_state = update_journal(tree, journal, journal_state)
                applied_staged = receipt_ref[0].stage(
                    receipt_ref[1], canonical_json(applied_receipt), mode, uid, gid, "receipt-applied"
                )
                journal["receipt"]["appliedStaged"] = applied_staged
                try:
                    fault("receipt-applied-stage-journal:before")
                    journal_state = update_journal(tree, journal, journal_state)
                except Exception:
                    # Retain a temp only when the durable journal names its
                    # exact inode; otherwise it is not recoverable authority.
                    current_journal = journal_snapshot(tree)
                    durable_names_stage = False
                    if current_journal["exists"]:
                        try:
                            durable = validate_journal(
                                load_json_snapshot(current_journal, "role protocol transaction journal"), tree
                            )
                            durable_names_stage = durable.get("receipt", {}).get("appliedStaged") == applied_staged
                        except Exception:
                            durable_names_stage = False
                    if not durable_names_stage:
                        receipt_ref[0].cleanup_staged(applied_staged)
                    raise
                receipt_current = receipt_ref[0].publish(
                    applied_staged, receipt_ref[1], receipt_current, "receipt-applied"
                )
                journal["receipt"]["snapshot"] = receipt_current
                journal["receipt"].pop("appliedStaged", None)
                journal_state = update_journal(tree, journal, journal_state)
                fault("receipt-applied:before-commit-revalidation")
                validate_exact_transaction_poststate(tree, journal, receipt_ref, receipt_current)
            journal["phase"] = "committed"
            journal_state = update_journal(tree, journal, journal_state)
            fault("journal-removal:before-commit-revalidation")
            validate_exact_transaction_poststate(tree, journal, receipt_ref, receipt_current if receipt_ref is not None else None)
            remove_journal(tree, journal_state)
            result["receipt"] = str(receipt_path) if receipt_path else None
            result["recovered"] = recovered
            return result
        except Exception as original_error:
            try:
                recovery = recover_existing_transaction(tree)
            except Exception as recovery_error:
                raise RuntimeError(f"apply failed ({original_error}); {recovery_error}") from original_error
            if recovery and recovery.get("outcome") == "committed":
                return check_protocol(root, config_path, kernel_path, legacy_path, already_locked=True, tree=tree)
            raise
    finally:
        if lock_fd >= 0:
            os.close(lock_fd)
        if receipt_ref is not None:
            receipt_ref[0].close()
        tree.close()


def _validate_installed(tree: ManagedRoot, kernel: bytes, legacy: bytes, *, allow_transaction: bool) -> dict[str, Any]:
    tree.assert_identity()
    if not allow_transaction and journal_snapshot(tree)["exists"]:
        raise ValueError("incomplete role protocol transaction requires recovery")
    selected, candidates = inspect_candidates(tree)
    manifest_snap = tree.snapshot(f"{STATE_DIR}/{STATE_NAME}", "role protocol ownership manifest")
    manifest = parse_manifest_snapshot(manifest_snap)
    if manifest is None:
        raise ValueError("missing role protocol ownership manifest")
    recorded = manifest["selectedContext"]
    if recorded["path"] != selected:
        raise ValueError(f"selected global context drift: manifest={recorded['path']} current={selected}")
    selected_snap = candidates[selected]
    if not selected_snap["exists"]:
        raise ValueError("missing selected global context")
    for name, snap in candidates.items():
        if not snap["exists"]:
            continue
        found = managed_range(read_bytes(snap), KERNEL_START, KERNEL_END, f"global context candidate {name}")
        if name != selected and found is not None and not _snapshot_identity_equal(snap, selected_snap):
            raise ValueError(f"unselected global context candidate contains a latent role kernel: {name}")
    selected_data = read_bytes(selected_snap)
    selected_range = managed_range(selected_data, KERNEL_START, KERNEL_END, "selected global context")
    if selected_range is None or selected_data[selected_range[0] : selected_range[1]] != kernel:
        raise ValueError("missing or stale managed role kernel")
    if recorded["blockSha256"] != digest(kernel):
        raise ValueError("role protocol manifest kernel digest is stale")
    separators_match(selected_data, selected_range, recorded, "selected global context")
    append_snap = tree.root.snapshot("APPEND_SYSTEM.md", "legacy APPEND destination")
    if not append_snap["exists"]:
        raise ValueError("missing legacy APPEND destination")
    append_data = read_bytes(append_snap)
    append_range = managed_range(append_data, LEGACY_START, LEGACY_END, "legacy APPEND destination")
    legacy_record = manifest["legacyAppend"]
    if append_range is None or append_data[append_range[0] : append_range[1]] != legacy:
        raise ValueError("missing or stale managed legacy APPEND block")
    if legacy_record["blockSha256"] != digest(legacy):
        raise ValueError("role protocol manifest legacy digest is stale")
    separators_match(append_data, append_range, legacy_record, "legacy APPEND")
    return {
        "generation": "bridge",
        "selectedContext": selected,
        "manifest": str(tree.path / STATE_DIR / STATE_NAME),
    }


def check_protocol(
    root: Path,
    config_path: Path,
    kernel_path: Path,
    legacy_path: Path,
    *,
    already_locked: bool = False,
    tree: ManagedRoot | None = None,
    allow_transaction: bool = False,
) -> dict[str, Any]:
    validate_config(config_path)
    kernel = load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
    legacy = load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
    owned_tree = tree is None
    if tree is None:
        tree = ManagedRoot(root)
    lock_fd = -1
    try:
        state_info = tree.root.lstat(STATE_DIR)
        if state_info is None or not stat.S_ISDIR(state_info.st_mode):
            raise ValueError("role protocol state directory is missing or unsafe")
        tree.open_state(create=False)
        if not already_locked:
            lock_fd = acquire_lock(tree, create=False)
        return _validate_installed(tree, kernel, legacy, allow_transaction=allow_transaction)
    finally:
        if lock_fd >= 0:
            os.close(lock_fd)
        if owned_tree:
            tree.close()


def restore_protocol(root: Path, receipt_path: Path) -> dict[str, Any]:
    tree = ManagedRoot(root)
    receipt_ref: tuple[DirBoundary, str] | None = None
    lock_fd = -1
    try:
        state_info = tree.root.lstat(STATE_DIR)
        if state_info is None or not stat.S_ISDIR(state_info.st_mode):
            raise ValueError("role protocol state directory is missing or unsafe")
        receipt_ref = receipt_boundary(receipt_path, tree)
        receipt_snap = receipt_ref[0].snapshot(receipt_ref[1], "role protocol receipt")
        if not receipt_snap["exists"] or receipt_snap["mode"] != 0o600:
            raise ValueError("role protocol receipt is missing or not mode 0600")
        receipt = validate_receipt(load_json_snapshot(receipt_snap, "role protocol receipt"), tree)
        lock_fd = acquire_lock(tree, create=False)
        tree.open_state(create=False)
        recovered = recover_existing_transaction(tree)
        reconcile_unowned_temps(tree)
        # Re-read and fully validate after lock/recovery before any new mutation.
        receipt_ref[0].assert_path_identity()
        receipt_snap = receipt_ref[0].snapshot(receipt_ref[1], "role protocol receipt")
        receipt = validate_receipt(load_json_snapshot(receipt_snap, "role protocol receipt"), tree)
        if receipt["transaction"] in {"rolled_back", "restored"}:
            return {"restored": False, "alreadyRestored": True, "generation": "bridge", "receipt": str(receipt_path), "recovered": recovered}
        if receipt["transaction"] not in {"applied", "prepared"}:
            raise ValueError("role protocol receipt is not recoverable")
        files = validate_file_entries(receipt["files"], receipt["selectedContext"], "receipt", journal=False)
        tx_files = [
            {
                "kind": entry["kind"],
                "relativePath": entry["relativePath"],
                "before": entry["postimage"],
                "after": entry["preimage"],
                "staged": None,
            }
            for entry in files
        ]
        # Complete validation of all current post/pre states before mutation.
        all_pre = True
        for entry in tx_files:
            current = tree.snapshot(entry["relativePath"], f"restore {entry['kind']}")
            if same_snapshot(current, entry["before"], identity=True):
                all_pre = False
            elif not same_snapshot(current, entry["after"], identity=True):
                raise ValueError(f"receipt postimage mismatch for {entry['kind']}; no files changed")
        if all_pre:
            restored_receipt = receipt_with_current_preimages(tree, receipt, "restored")
            mode, uid, gid = receipt_publication_meta(receipt_snap)
            publish_bytes(receipt_ref[0], receipt_ref[1], canonical_json(restored_receipt), receipt_snap, "receipt-restored", mode, uid, gid)
            return {"restored": False, "alreadyRestored": True, "generation": "bridge", "receipt": str(receipt_path), "recovered": recovered}
        # Candidate set and exact selection must still be the applied post-state.
        _, current_candidates = inspect_candidates(tree)
        for name in CONTEXT_CANDIDATES:
            if not same_snapshot(current_candidates[name], receipt["candidatePostimages"][name], identity=True):
                raise ValueError(f"receipt candidate postimage mismatch for {name}; no files changed")
        journal = {
            "schemaVersion": SCHEMA_VERSION,
            "manager": "prime-claw-role-protocol",
            "operation": "restore",
            "phase": "prepared",
            "generation": "bridge",
            "destination": destination_binding(tree),
            "selectedContext": receipt["selectedContext"],
            "candidateBefore": receipt["candidatePostimages"],
            "candidateAfter": receipt["candidatePreimages"],
            "files": tx_files,
            "receipt": {"path": os.path.abspath(os.fspath(receipt_path)), "snapshot": receipt_snap},
        }
        try:
            for entry in tx_files:
                goal = entry["after"]
                if goal["exists"]:
                    boundary, name = tree.boundary(entry["relativePath"], create_state=True)
                    entry["staged"] = boundary.stage(name, read_bytes(goal), goal["mode"], goal["uid"], goal["gid"], f"restore-{entry['kind']}")
                    entry["after"] = entry["staged"]["snapshot"]
            fault("restore-staging:after")
            journal_state = write_journal(tree, journal, missing_snapshot())
        except Exception:
            if not journal_snapshot(tree)["exists"]:
                cleanup_transaction_temps(tree, journal)
            raise
        try:
            journal_state = drive_to_target(tree, journal, journal_state, source="before", target="after")
            journal["phase"] = "verifying"
            journal_state = update_journal(tree, journal, journal_state)
            # Verify desired bytes and metadata; recovered identities are recorded separately.
            for entry in journal["files"]:
                actual = tree.snapshot(entry["relativePath"], f"restored {entry['kind']}")
                target = entry.get("recovered", entry["after"])
                if not same_snapshot(actual, target, identity=True):
                    raise ValueError(f"restored {entry['kind']} failed final verification")
            restored_receipt = receipt_with_current_preimages(tree, receipt, "restored")
            receipt_now = receipt_ref[0].snapshot(receipt_ref[1], "role protocol receipt")
            if not same_snapshot(receipt_now, receipt_snap, identity=True):
                raise ValueError("role protocol receipt changed during restore")
            mode, uid, gid = receipt_publication_meta(receipt_snap)
            receipt_new = publish_bytes(receipt_ref[0], receipt_ref[1], canonical_json(restored_receipt), receipt_snap, "receipt-restored", mode, uid, gid)
            journal["receipt"]["snapshot"] = receipt_new
            journal["phase"] = "restored"
            journal_state = update_journal(tree, journal, journal_state)
            cleanup_transaction_temps(tree, journal)
            remove_journal(tree, journal_state)
            return {"restored": True, "generation": "bridge", "receipt": str(receipt_path), "recovered": recovered}
        except Exception as original_error:
            # Retain/advance the durable restore transaction; never erase uncertainty.
            try:
                recovery = recover_existing_transaction(tree)
            except Exception as recovery_error:
                raise RuntimeError(f"restore failed ({original_error}); {recovery_error}") from original_error
            if recovery and recovery.get("outcome") == "restored":
                return {"restored": True, "generation": "bridge", "receipt": str(receipt_path), "recovered": recovery}
            raise
    finally:
        if lock_fd >= 0:
            os.close(lock_fd)
        if receipt_ref is not None:
            receipt_ref[0].close()
        tree.close()


def validate_absent_destination(path: Path) -> None:
    absolute = Path(os.path.abspath(os.fspath(path)))
    candidate = absolute
    missing: list[str] = []
    while True:
        try:
            boundary = DirBoundary(candidate)
            break
        except FileNotFoundError:
            if candidate.parent == candidate:
                raise
            missing.append(candidate.name)
            candidate = candidate.parent
    try:
        # The first missing component must still be absent beneath the stable
        # nearest existing no-follow ancestor. Deeper components cannot exist.
        if missing:
            first = missing[-1]
            if boundary.lstat(first) is not None:
                raise ValueError(f"destination appeared during preflight: {absolute}")
        else:
            raise ValueError(f"destination is not absent: {absolute}")
        boundary.assert_path_identity()
    finally:
        boundary.close()


def preflight(root: Path, config_path: Path, kernel_path: Path, legacy_path: Path) -> dict[str, Any]:
    validate_config(config_path)
    kernel = load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
    legacy = load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
    try:
        tree = ManagedRoot(root)
    except FileNotFoundError:
        validate_absent_destination(root)
        return {"generation": "bridge", "selectedContext": "AGENTS.md"}
    try:
        info = tree.root.lstat(STATE_DIR)
        if info is not None and not stat.S_ISDIR(info.st_mode):
            raise ValueError("role protocol state directory is unsafe")
        prepared = prepare_apply(tree, kernel, legacy)
        return {"generation": "bridge", "selectedContext": prepared["selected"]}
    finally:
        tree.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)
    for name in ("preflight", "apply", "check"):
        command = sub.add_parser(name)
        command.add_argument("config", type=Path)
        command.add_argument("kernel", type=Path)
        command.add_argument("legacy", type=Path)
        command.add_argument("root", type=Path)
        if name == "apply":
            command.add_argument("--receipt", type=Path)
    restore = sub.add_parser("restore")
    restore.add_argument("receipt", type=Path)
    restore.add_argument("root", type=Path)
    args = parser.parse_args()
    try:
        if args.mode == "preflight":
            result = preflight(args.root, args.config, args.kernel, args.legacy)
        elif args.mode == "apply":
            result = apply_protocol(args.root, args.config, args.kernel, args.legacy, args.receipt)
        elif args.mode == "check":
            result = check_protocol(args.root, args.config, args.kernel, args.legacy)
        else:
            result = restore_protocol(args.root, args.receipt)
        print(json.dumps(result, sort_keys=True))
        return 0
    except Exception as error:
        print(f"role protocol {args.mode} failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
