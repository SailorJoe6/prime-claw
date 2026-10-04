#!/usr/bin/env python3
"""Guard Prime Claw's selected global context and bridge role protocol.

The manager is stdlib-only. It owns exact marker regions, records selection and
separator ownership in a private manifest, and can restore exact preimages from
an externally retained receipt. Bridge mode retains the legacy APPEND block.
"""

from __future__ import annotations

import argparse
import base64
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
LOCK_NAME = ".prime-claw-role-protocol.lock"
TEMP_TAG = "prime-claw-role-protocol"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def unb64(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"), validate=True)


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
    # Source Markdown may carry one conventional terminal newline; installed
    # marker-region bytes never include it.
    block = data[:-1] if data.endswith(b"\n") and not data.endswith(b"\r\n") else data
    selected = managed_range(block, start, end, description)
    if selected != (0, len(block)):
        raise ValueError(f"{description} is not exactly one complete managed block: {path}")
    return block


def load_config(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if value != {"schemaVersion": 1, "generation": "bridge"}:
        raise ValueError("role-protocol.json must declare exactly schemaVersion 1 and generation bridge")
    return value


def safe_lstat(path: Path, description: str, *, allow_absent: bool = True) -> os.stat_result | None:
    try:
        info = path.lstat()
    except FileNotFoundError:
        if allow_absent:
            return None
        raise ValueError(f"missing {description}: {path}")
    if stat.S_ISLNK(info.st_mode):
        raise ValueError(f"unsafe {description} symlink: {path}")
    return info


def require_directory(path: Path, description: str, *, allow_absent: bool = True) -> os.stat_result | None:
    info = safe_lstat(path, description, allow_absent=allow_absent)
    if info is not None and not stat.S_ISDIR(info.st_mode):
        raise ValueError(f"{description} is not a directory: {path}")
    return info


def read_regular(path: Path, description: str, *, allow_absent: bool = True) -> tuple[bytes, os.stat_result] | None:
    info = safe_lstat(path, description, allow_absent=allow_absent)
    if info is None:
        return None
    if not stat.S_ISREG(info.st_mode):
        raise ValueError(f"{description} is not a regular file: {path}")
    if stat.S_IMODE(info.st_mode) & 0o444 == 0:
        raise ValueError(f"{description} is unreadable: {path}")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(path, flags)
    try:
        opened = os.fstat(fd)
        if (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino):
            raise ValueError(f"{description} changed while opening: {path}")
        with os.fdopen(fd, "rb", closefd=False) as stream:
            data = stream.read()
        return data, opened
    finally:
        os.close(fd)


def metadata(info: os.stat_result | None, *, new_mode: int) -> tuple[int, int, int]:
    if info is None:
        return new_mode, os.geteuid(), os.getegid()
    return stat.S_IMODE(info.st_mode), info.st_uid, info.st_gid


def snapshot(path: Path, description: str, *, allow_absent: bool = True) -> dict[str, Any]:
    loaded = read_regular(path, description, allow_absent=allow_absent)
    if loaded is None:
        return {"exists": False}
    data, info = loaded
    return {
        "exists": True,
        "bytesBase64": b64(data),
        "sha256": digest(data),
        "mode": stat.S_IMODE(info.st_mode),
        "uid": info.st_uid,
        "gid": info.st_gid,
    }


def assert_snapshot(path: Path, expected: dict[str, Any], description: str) -> None:
    actual = snapshot(path, description)
    if actual != expected:
        raise ValueError(f"{description} does not match the receipt postimage: {path}")


def writer_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


def reconcile_temps(directory: Path, leaf: str) -> None:
    if not directory.exists():
        return
    pattern = re.compile(rf"\.{re.escape(leaf)}\.{TEMP_TAG}-([1-9][0-9]*)-[0-9a-f]{{16}}\.tmp")
    for entry in directory.iterdir():
        match = pattern.fullmatch(entry.name)
        if match is None or writer_alive(int(match.group(1))):
            continue
        info = entry.lstat()
        if stat.S_ISREG(info.st_mode):
            entry.unlink()


def current_matches(path: Path, original: bytes | None, description: str) -> None:
    loaded = read_regular(path, description)
    current = None if loaded is None else loaded[0]
    if current != original:
        raise ValueError(f"concurrent change detected for {description}: {path}")


def atomic_write(path: Path, data: bytes, *, mode: int, uid: int, gid: int, original: bytes | None) -> None:
    require_directory(path.parent, "managed parent", allow_absent=False)
    reconcile_temps(path.parent, path.name)
    current_matches(path, original, "managed destination")
    temp = path.parent / f".{path.name}.{TEMP_TAG}-{os.getpid()}-{secrets.token_hex(8)}.tmp"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(temp, flags, 0o600)
    try:
        with os.fdopen(fd, "wb", closefd=False) as stream:
            stream.write(data)
            os.fchmod(fd, mode)
            if (uid, gid) != (os.geteuid(), os.getegid()):
                os.fchown(fd, uid, gid)
            stream.flush()
            os.fsync(fd)
        os.close(fd)
        fd = -1
        current_matches(path, original, "managed destination")
        os.replace(temp, path)
        dir_fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
        try:
            os.fsync(dir_fd)
        finally:
            os.close(dir_fd)
    finally:
        if fd >= 0:
            os.close(fd)
        try:
            temp.unlink()
        except FileNotFoundError:
            pass


def newline_style(data: bytes) -> bytes:
    crlf = data.count(b"\r\n")
    lone_lf = data.count(b"\n") - crlf
    if crlf and not lone_lf:
        return b"\r\n"
    return b"\n"


def install_new_block(existing: bytes, block: bytes) -> tuple[bytes, bytes, bytes]:
    if not existing:
        return block, b"", b""
    nl = newline_style(existing)
    has_final = existing.endswith(b"\n")
    prefix = nl if has_final else nl + nl
    suffix = nl if has_final else b""
    return existing + prefix + block + suffix, prefix, suffix


def separators_match(data: bytes, selected: tuple[int, int], entry: dict[str, Any], description: str) -> None:
    start, end = selected
    prefix = unb64(entry["prefixSeparatorBase64"])
    suffix = unb64(entry["suffixSeparatorBase64"])
    if prefix and data[max(0, start - len(prefix)):start] != prefix:
        raise ValueError(f"{description} owned prefix separator drifted")
    if suffix and data[end:end + len(suffix)] != suffix:
        raise ValueError(f"{description} owned suffix separator drifted")


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
    if context.get("path") not in CONTEXT_CANDIDATES or not isinstance(context.get("installerCreated"), bool):
        raise ValueError("role protocol ownership manifest selected context is invalid")
    if legacy.get("path") != "APPEND_SYSTEM.md":
        raise ValueError("role protocol ownership manifest legacy path is invalid")
    return value


def load_manifest(path: Path) -> tuple[dict[str, Any] | None, bytes | None, os.stat_result | None]:
    loaded = read_regular(path, "role protocol ownership manifest")
    if loaded is None:
        return None, None, None
    data, info = loaded
    if stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError(f"role protocol ownership manifest must be mode 0600: {path}")
    try:
        value = validate_manifest(json.loads(data.decode("utf-8")))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"role protocol ownership manifest is malformed: {path}") from error
    return value, data, info


def inspect_candidates(root: Path) -> tuple[str, dict[str, tuple[bytes, os.stat_result] | None]]:
    found: dict[str, tuple[bytes, os.stat_result] | None] = {}
    for name in CONTEXT_CANDIDATES:
        found[name] = read_regular(root / name, f"global context candidate {name}")
    selected = next((name for name in CONTEXT_CANDIDATES if found[name] is not None), "AGENTS.md")
    return selected, found


def aliases_selected(
    name: str,
    loaded: tuple[bytes, os.stat_result] | None,
    selected_name: str,
    selected_loaded: tuple[bytes, os.stat_result] | None,
) -> bool:
    """Treat case-folded aliases of the selected inode as the same candidate."""
    if name == selected_name:
        return True
    if loaded is None or selected_loaded is None:
        return False
    return (loaded[1].st_dev, loaded[1].st_ino) == (selected_loaded[1].st_dev, selected_loaded[1].st_ino)


def preflight(root: Path, config_path: Path, kernel_path: Path, legacy_path: Path) -> dict[str, Any]:
    load_config(config_path)
    kernel = load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
    legacy = load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
    require_directory(root, "agentDir")
    state_dir = root / STATE_DIR
    require_directory(state_dir, "role protocol state directory")
    if root.exists():
        selected, candidates = inspect_candidates(root)
        selected_loaded = candidates[selected]
        manifest, _, _ = load_manifest(state_dir / STATE_NAME)
        if manifest is not None and manifest["selectedContext"]["path"] != selected:
            raise ValueError(
                f"selected global context drift: manifest={manifest['selectedContext']['path']} current={selected}"
            )
        selected_block = None
        for name, loaded in candidates.items():
            if loaded is None:
                continue
            data = loaded[0]
            block = managed_range(data, KERNEL_START, KERNEL_END, f"global context candidate {name}")
            if aliases_selected(name, loaded, selected, selected_loaded):
                selected_block = block
            elif block is not None:
                raise ValueError(f"unselected global context candidate contains a latent role kernel: {name}")
        if manifest is None and selected_block is not None:
            raise ValueError("selected global context has an unowned role kernel without a manifest")
        append_loaded = read_regular(root / "APPEND_SYSTEM.md", "legacy APPEND destination")
        if append_loaded is not None:
            managed_range(append_loaded[0], LEGACY_START, LEGACY_END, "legacy APPEND destination")
    else:
        selected = "AGENTS.md"
    return {
        "generation": "bridge",
        "selectedContext": selected,
        "kernelSha256": digest(kernel),
        "legacyAppendSha256": digest(legacy),
    }


def prepare_apply(root: Path, kernel: bytes, legacy: bytes) -> dict[str, Any]:
    selected_name, candidates = inspect_candidates(root)
    selected_path = root / selected_name
    selected_loaded = candidates[selected_name]
    selected_data = b"" if selected_loaded is None else selected_loaded[0]
    selected_info = None if selected_loaded is None else selected_loaded[1]
    selected_range = managed_range(selected_data, KERNEL_START, KERNEL_END, f"selected global context {selected_name}")

    for name, loaded in candidates.items():
        if loaded is None or aliases_selected(name, loaded, selected_name, selected_loaded):
            continue
        if managed_range(loaded[0], KERNEL_START, KERNEL_END, f"global context candidate {name}") is not None:
            raise ValueError(f"unselected global context candidate contains a latent role kernel: {name}")

    manifest_path = root / STATE_DIR / STATE_NAME
    manifest, manifest_data, manifest_info = load_manifest(manifest_path)
    installer_created = selected_loaded is None
    if manifest is not None:
        recorded = manifest["selectedContext"]
        if recorded["path"] != selected_name:
            raise ValueError(f"selected global context drift: manifest={recorded['path']} current={selected_name}")
        if selected_loaded is None:
            raise ValueError(f"selected global context disappeared: {selected_name}")
        if selected_range is None:
            raise ValueError(f"managed role kernel disappeared from selected global context: {selected_name}")
        start, end = selected_range
        existing_block = selected_data[start:end]
        if digest(existing_block) != recorded["blockSha256"]:
            raise ValueError("selected global context role kernel disagrees with ownership manifest")
        separators_match(selected_data, selected_range, recorded, "selected global context")
        selected_updated = selected_data[:start] + kernel + selected_data[end:]
        prefix = unb64(recorded["prefixSeparatorBase64"])
        suffix = unb64(recorded["suffixSeparatorBase64"])
        installer_created = recorded["installerCreated"]
    else:
        if selected_range is not None:
            raise ValueError("selected global context has an unowned role kernel without a manifest")
        selected_updated, prefix, suffix = install_new_block(selected_data, kernel)

    append_path = root / "APPEND_SYSTEM.md"
    append_loaded = read_regular(append_path, "legacy APPEND destination")
    append_data = b"" if append_loaded is None else append_loaded[0]
    append_info = None if append_loaded is None else append_loaded[1]
    append_range = managed_range(append_data, LEGACY_START, LEGACY_END, "legacy APPEND destination")
    if manifest is not None:
        recorded_legacy = manifest["legacyAppend"]
        if append_range is None:
            raise ValueError("managed legacy APPEND block disappeared")
        start, end = append_range
        existing_block = append_data[start:end]
        if digest(existing_block) != recorded_legacy["blockSha256"]:
            raise ValueError("legacy APPEND block disagrees with ownership manifest")
        separators_match(append_data, append_range, recorded_legacy, "legacy APPEND")
        append_updated = append_data[:start] + legacy + append_data[end:]
        append_prefix = unb64(recorded_legacy["prefixSeparatorBase64"])
        append_suffix = unb64(recorded_legacy["suffixSeparatorBase64"])
    elif append_range is None:
        append_updated, append_prefix, append_suffix = install_new_block(append_data, legacy)
    else:
        start, end = append_range
        # Adopt the accepted predecessor block without claiming ambiguous
        # separators introduced before this manifest existed.
        append_updated = append_data[:start] + legacy + append_data[end:]
        append_prefix = b""
        append_suffix = b""

    manifest_value = {
        "schemaVersion": 1,
        "generation": "bridge",
        "selectedContext": {
            "path": selected_name,
            "installerCreated": installer_created,
            "blockSha256": digest(kernel),
            "prefixSeparatorBase64": b64(prefix),
            "suffixSeparatorBase64": b64(suffix),
        },
        "legacyAppend": {
            "path": "APPEND_SYSTEM.md",
            "blockSha256": digest(legacy),
            "prefixSeparatorBase64": b64(append_prefix),
            "suffixSeparatorBase64": b64(append_suffix),
        },
    }
    new_manifest = (json.dumps(manifest_value, indent=2, sort_keys=True) + "\n").encode()
    return {
        "selected_name": selected_name,
        "selected_path": selected_path,
        "selected_old": None if selected_loaded is None else selected_data,
        "selected_new": selected_updated,
        "selected_meta": metadata(selected_info, new_mode=0o644),
        "append_path": append_path,
        "append_old": None if append_loaded is None else append_data,
        "append_new": append_updated,
        "append_meta": metadata(append_info, new_mode=0o644),
        "manifest_path": manifest_path,
        "manifest_old": manifest_data,
        "manifest_new": new_manifest,
        "manifest_meta": metadata(manifest_info, new_mode=0o600),
        "manifest_value": manifest_value,
    }


def predicted_snapshot(data: bytes, meta: tuple[int, int, int]) -> dict[str, Any]:
    mode, uid, gid = meta
    return {"exists": True, "bytesBase64": b64(data), "sha256": digest(data), "mode": mode, "uid": uid, "gid": gid}


def write_external_receipt(path: Path, value: dict[str, Any], *, original: bytes | None) -> None:
    require_directory(path.parent, "receipt parent", allow_absent=False)
    info = safe_lstat(path, "role protocol receipt")
    if original is None and info is not None:
        raise ValueError(f"role protocol receipt already exists: {path}")
    data = (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()
    atomic_write(path, data, mode=0o600, uid=os.geteuid(), gid=os.getegid(), original=original)


def restore_one(path: Path, image: dict[str, Any], current: bytes | None) -> None:
    if image["exists"]:
        data = unb64(image["bytesBase64"])
        if digest(data) != image["sha256"]:
            raise ValueError(f"receipt preimage digest mismatch: {path}")
        atomic_write(path, data, mode=image["mode"], uid=image["uid"], gid=image["gid"], original=current)
    else:
        current_matches(path, current, "restore destination")
        if current is not None:
            path.unlink()
            dir_fd = os.open(path.parent, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
            try:
                os.fsync(dir_fd)
            finally:
                os.close(dir_fd)


def apply_protocol(root: Path, config_path: Path, kernel_path: Path, legacy_path: Path, receipt_path: Path | None) -> dict[str, Any]:
    preflight(root, config_path, kernel_path, legacy_path)
    if not root.exists():
        root.mkdir(parents=True, mode=0o700)
    require_directory(root, "agentDir", allow_absent=False)
    lock_path = root / LOCK_NAME
    lock_info = safe_lstat(lock_path, "role protocol lock")
    if lock_info is not None and not stat.S_ISREG(lock_info.st_mode):
        raise ValueError(f"role protocol lock is not a regular file: {lock_path}")
    lock_fd = os.open(lock_path, os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0), 0o600)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        kernel = load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
        legacy = load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
        require_directory(root / STATE_DIR, "role protocol state directory")
        if not (root / STATE_DIR).exists():
            (root / STATE_DIR).mkdir(mode=0o700)
        for candidate in CONTEXT_CANDIDATES:
            reconcile_temps(root, candidate)
        reconcile_temps(root, "APPEND_SYSTEM.md")
        reconcile_temps(root / STATE_DIR, STATE_NAME)
        prepared = prepare_apply(root, kernel, legacy)
        entries = [
            (prepared["selected_path"], prepared["selected_old"], prepared["selected_new"], prepared["selected_meta"], "selected global context"),
            (prepared["append_path"], prepared["append_old"], prepared["append_new"], prepared["append_meta"], "legacy APPEND"),
            (prepared["manifest_path"], prepared["manifest_old"], prepared["manifest_new"], prepared["manifest_meta"], "role protocol manifest"),
        ]
        preimages = {label: snapshot(path, label) for path, _, _, _, label in entries}
        receipt = {
            "schemaVersion": 1,
            "transaction": "prepared",
            "destinationRealpath": os.path.realpath(root),
            "generation": "bridge",
            "files": [
                {
                    "label": label,
                    "relativePath": str(path.relative_to(root)),
                    "preimage": preimages[label],
                    "postimage": predicted_snapshot(new, meta),
                }
                for path, _, new, meta, label in entries
            ],
        }
        receipt_original = None
        if receipt_path is not None:
            write_external_receipt(receipt_path, receipt, original=None)
            receipt_original = (json.dumps(receipt, indent=2, sort_keys=True) + "\n").encode()
        changed: list[tuple[Path, bytes | None, dict[str, Any], str]] = []
        try:
            for path, old, new, meta, label in entries:
                if old == new:
                    continue
                mode, uid, gid = meta
                atomic_write(path, new, mode=mode, uid=uid, gid=gid, original=old)
                changed.append((path, new, preimages[label], label))
        except Exception:
            for path, current, image, _label in reversed(changed):
                try:
                    restore_one(path, image, current)
                except Exception:
                    pass
            raise
        if receipt_path is not None:
            receipt["transaction"] = "applied"
            write_external_receipt(receipt_path, receipt, original=receipt_original)
        check_protocol(root, config_path, kernel_path, legacy_path, already_locked=True)
        return {"generation": "bridge", "selectedContext": prepared["selected_name"], "manifest": str(prepared["manifest_path"])}
    finally:
        os.close(lock_fd)


def check_protocol(root: Path, config_path: Path, kernel_path: Path, legacy_path: Path, *, already_locked: bool = False) -> dict[str, Any]:
    load_config(config_path)
    kernel = load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
    legacy = load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
    require_directory(root, "agentDir", allow_absent=False)
    lock_fd = None
    if not already_locked:
        lock_path = root / LOCK_NAME
        info = safe_lstat(lock_path, "role protocol lock", allow_absent=False)
        if info is None or not stat.S_ISREG(info.st_mode):
            raise ValueError(f"role protocol lock is missing or unsafe: {lock_path}")
        lock_fd = os.open(lock_path, os.O_RDWR | getattr(os, "O_NOFOLLOW", 0))
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
    try:
        selected_name, candidates = inspect_candidates(root)
        manifest, _, _ = load_manifest(root / STATE_DIR / STATE_NAME)
        if manifest is None:
            raise ValueError("missing role protocol ownership manifest")
        recorded = manifest["selectedContext"]
        if recorded["path"] != selected_name:
            raise ValueError(f"selected global context drift: manifest={recorded['path']} current={selected_name}")
        selected_loaded = candidates[selected_name]
        for name, loaded in candidates.items():
            if loaded is None:
                continue
            found = managed_range(loaded[0], KERNEL_START, KERNEL_END, f"global context candidate {name}")
            if not aliases_selected(name, loaded, selected_name, selected_loaded) and found is not None:
                raise ValueError(f"unselected global context candidate contains a latent role kernel: {name}")
        selected_loaded = candidates[selected_name]
        if selected_loaded is None:
            raise ValueError(f"missing selected global context: {selected_name}")
        selected_data = selected_loaded[0]
        selected_range = managed_range(selected_data, KERNEL_START, KERNEL_END, "selected global context")
        if selected_range is None or selected_data[selected_range[0]:selected_range[1]] != kernel:
            raise ValueError(f"missing or stale managed role kernel: {root / selected_name}")
        separators_match(selected_data, selected_range, recorded, "selected global context")
        append_loaded = read_regular(root / "APPEND_SYSTEM.md", "legacy APPEND destination", allow_absent=False)
        assert append_loaded is not None
        append_data = append_loaded[0]
        append_range = managed_range(append_data, LEGACY_START, LEGACY_END, "legacy APPEND destination")
        if append_range is None or append_data[append_range[0]:append_range[1]] != legacy:
            raise ValueError(f"missing or stale managed legacy APPEND block: {root / 'APPEND_SYSTEM.md'}")
        separators_match(append_data, append_range, manifest["legacyAppend"], "legacy APPEND")
        if recorded["blockSha256"] != digest(kernel) or manifest["legacyAppend"]["blockSha256"] != digest(legacy):
            raise ValueError("role protocol ownership manifest source digest is stale")
        return {"generation": "bridge", "selectedContext": selected_name, "kernelSha256": digest(kernel), "legacyAppendSha256": digest(legacy)}
    finally:
        if lock_fd is not None:
            os.close(lock_fd)


def restore_protocol(root: Path, receipt_path: Path) -> dict[str, Any]:
    receipt_loaded = read_regular(receipt_path, "role protocol receipt", allow_absent=False)
    assert receipt_loaded is not None
    data, info = receipt_loaded
    if stat.S_IMODE(info.st_mode) != 0o600:
        raise ValueError(f"role protocol receipt must be mode 0600: {receipt_path}")
    value = json.loads(data.decode("utf-8"))
    if value.get("schemaVersion") != 1 or value.get("transaction") != "applied" or value.get("generation") != "bridge":
        raise ValueError("role protocol receipt is not an applied bridge receipt")
    if value.get("destinationRealpath") != os.path.realpath(root):
        raise ValueError("role protocol receipt destination does not match")
    files = value.get("files")
    if not isinstance(files, list) or len(files) != 3:
        raise ValueError("role protocol receipt file inventory is malformed")
    require_directory(root, "agentDir", allow_absent=False)
    lock_path = root / LOCK_NAME
    info = safe_lstat(lock_path, "role protocol lock", allow_absent=False)
    if info is None or not stat.S_ISREG(info.st_mode):
        raise ValueError(f"role protocol lock is missing or unsafe: {lock_path}")
    lock_fd = os.open(lock_path, os.O_RDWR | getattr(os, "O_NOFOLLOW", 0))
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX)
        resolved: list[tuple[Path, dict[str, Any]]] = []
        for entry in files:
            rel = entry.get("relativePath")
            if not isinstance(rel, str) or Path(rel).is_absolute() or ".." in Path(rel).parts:
                raise ValueError("role protocol receipt contains an unsafe relative path")
            path = root / rel
            assert_snapshot(path, entry["postimage"], entry.get("label", rel))
            resolved.append((path, entry))
        for path, entry in reversed(resolved):
            current = unb64(entry["postimage"]["bytesBase64"])
            restore_one(path, entry["preimage"], current)
        state_dir = root / STATE_DIR
        if state_dir.exists() and not any(state_dir.iterdir()):
            state_dir.rmdir()
        return {"restored": True, "generation": "bridge", "receipt": str(receipt_path)}
    finally:
        os.close(lock_fd)


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="mode", required=True)
    for name in ("preflight", "apply", "check"):
        command = sub.add_parser(name)
        command.add_argument("config", type=Path)
        command.add_argument("kernel", type=Path)
        command.add_argument("legacy_append", type=Path)
        command.add_argument("agent_dir", type=Path)
        if name == "apply":
            command.add_argument("--receipt", type=Path)
    restore = sub.add_parser("restore")
    restore.add_argument("receipt", type=Path)
    restore.add_argument("agent_dir", type=Path)
    args = parser.parse_args()
    try:
        if args.mode == "preflight":
            result = preflight(args.agent_dir, args.config, args.kernel, args.legacy_append)
        elif args.mode == "apply":
            result = apply_protocol(args.agent_dir, args.config, args.kernel, args.legacy_append, args.receipt)
        elif args.mode == "check":
            result = check_protocol(args.agent_dir, args.config, args.kernel, args.legacy_append)
        else:
            result = restore_protocol(args.agent_dir, args.receipt)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (OSError, UnicodeError, ValueError, KeyError, TypeError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
