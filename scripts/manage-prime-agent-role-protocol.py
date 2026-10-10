#!/usr/bin/env python3
"""Install and restore Prime Claw's bridge or final role protocol.

The manager is deliberately small and stdlib-only. It assumes a trusted local
operator, serializes cooperating writers with one lock, validates ordinary file
state, uses same-directory atomic replacement, and keeps an optional fixed-
inventory receipt for known-state restoration. Ambiguous state is preserved for
manual recovery rather than handled by a transaction journal.
"""

from __future__ import annotations

import argparse
import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
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
RECEIPT_MANAGER = "prime-claw-role-protocol"


def require_sandbox_fresh_root(root: Path) -> None:
    """Authorize final ownership genesis only in the isolated mounted sandbox home."""
    link = Path("/sandbox/.prime")
    if (
        os.environ.get("HOME") != "/sandbox"
        or not Path("/.dockerenv").is_file()
        or root != Path("/sandbox/.prime/agent")
        or not link.is_symlink()
        or os.readlink(link) != "home-root/.prime"
        or root.resolve() != Path("/sandbox/home-root/.prime/agent")
        or not root.is_dir()
        or root.is_symlink()
    ):
        raise ValueError("fresh final role ownership requires the exact sandbox mounted home")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def encode(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def decode(value: Any) -> bytes:
    if not isinstance(value, str):
        raise ValueError("encoded bytes must be a string")
    try:
        return base64.b64decode(value.encode("ascii"), validate=True)
    except (UnicodeError, ValueError) as error:
        raise ValueError("encoded bytes are not valid base64") from error


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, indent=2, sort_keys=True) + "\n").encode()


def managed_range(
    data: bytes, start: bytes, end: bytes, description: str
) -> tuple[int, int] | None:
    tokens: list[tuple[int, bytes]] = []
    offset = 0
    while True:
        found = [
            (position, token)
            for token in (start, end)
            if (position := data.find(token, offset)) >= 0
        ]
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
    # Source Markdown may carry one conventional terminal LF. Installed marker
    # bytes do not include that packaging newline.
    block = data[:-1] if data.endswith(b"\n") and not data.endswith(b"\r\n") else data
    selected = managed_range(block, start, end, description)
    if selected != (0, len(block)):
        raise ValueError(
            f"{description} is not exactly one complete managed block: {path}"
        )
    return block


def validate_config(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    generation = value.get("generation") if isinstance(value, dict) else None
    if generation not in {"bridge", "final"} or value != {
        "schemaVersion": 1,
        "generation": generation,
    }:
        raise ValueError(
            "role-protocol.json must declare exactly schemaVersion 1 and generation bridge or final"
        )
    return value


def safe_lstat(
    path: Path, description: str, *, allow_absent: bool = True
) -> os.stat_result | None:
    try:
        info = path.lstat()
    except FileNotFoundError:
        if allow_absent:
            return None
        raise ValueError(f"missing {description}: {path}")
    if stat.S_ISLNK(info.st_mode):
        raise ValueError(f"unsafe {description} symlink: {path}")
    return info


def require_directory(
    path: Path, description: str, *, allow_absent: bool = True
) -> os.stat_result | None:
    info = safe_lstat(path, description, allow_absent=allow_absent)
    if info is not None and not stat.S_ISDIR(info.st_mode):
        raise ValueError(f"{description} is not a directory: {path}")
    return info


def read_regular(
    path: Path, description: str, *, allow_absent: bool = True
) -> tuple[bytes, os.stat_result] | None:
    info = safe_lstat(path, description, allow_absent=allow_absent)
    if info is None:
        return None
    if not stat.S_ISREG(info.st_mode):
        raise ValueError(f"{description} is not a regular file: {path}")
    if stat.S_IMODE(info.st_mode) & 0o444 == 0:
        raise ValueError(f"{description} is unreadable: {path}")
    flags = (
        os.O_RDONLY
        | getattr(os, "O_NOFOLLOW", 0)
        | getattr(os, "O_NONBLOCK", 0)
    )
    fd = os.open(path, flags)
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode):
            raise ValueError(f"{description} changed to a non-regular file: {path}")
        if (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino):
            raise ValueError(f"{description} changed while opening: {path}")
        chunks: list[bytes] = []
        while True:
            chunk = os.read(fd, 1024 * 1024)
            if not chunk:
                break
            chunks.append(chunk)
        return b"".join(chunks), opened
    finally:
        os.close(fd)


def missing_snapshot() -> dict[str, Any]:
    return {"exists": False}


def snapshot(
    path: Path, description: str, *, allow_absent: bool = True
) -> dict[str, Any]:
    loaded = read_regular(path, description, allow_absent=allow_absent)
    if loaded is None:
        return missing_snapshot()
    data, info = loaded
    return {
        "exists": True,
        "bytesBase64": encode(data),
        "sha256": digest(data),
        "mode": stat.S_IMODE(info.st_mode),
        "uid": info.st_uid,
        "gid": info.st_gid,
    }


def validate_snapshot(value: Any, label: str) -> dict[str, Any]:
    if not isinstance(value, dict) or type(value.get("exists")) is not bool:
        raise ValueError(f"{label} snapshot is malformed")
    if not value["exists"]:
        if set(value) != {"exists"}:
            raise ValueError(f"{label} missing snapshot has unexpected fields")
        return value
    required = {"exists", "bytesBase64", "sha256", "mode", "uid", "gid"}
    if set(value) != required:
        raise ValueError(f"{label} snapshot fields are malformed")
    for key in ("mode", "uid", "gid"):
        if type(value.get(key)) is not int or value[key] < 0:
            raise ValueError(f"{label} snapshot {key} is invalid")
    if value["mode"] > 0o7777:
        raise ValueError(f"{label} snapshot mode is invalid")
    data = decode(value["bytesBase64"])
    if (
        not isinstance(value.get("sha256"), str)
        or len(value["sha256"]) != 64
        or digest(data) != value["sha256"]
    ):
        raise ValueError(f"{label} snapshot digest does not match bytes")
    return value


def same_snapshot(actual: dict[str, Any], expected: dict[str, Any]) -> bool:
    return actual == expected


def snapshot_bytes(value: dict[str, Any]) -> bytes:
    validate_snapshot(value, "file")
    if not value["exists"]:
        raise ValueError("missing snapshot has no bytes")
    return decode(value["bytesBase64"])


def metadata(info: os.stat_result | None, *, new_mode: int) -> tuple[int, int, int]:
    if info is None:
        return new_mode, os.geteuid(), os.getegid()
    return stat.S_IMODE(info.st_mode), info.st_uid, info.st_gid


def predicted_snapshot(data: bytes, meta: tuple[int, int, int]) -> dict[str, Any]:
    mode, uid, gid = meta
    return {
        "exists": True,
        "bytesBase64": encode(data),
        "sha256": digest(data),
        "mode": mode,
        "uid": uid,
        "gid": gid,
    }


def fsync_directory(path: Path) -> None:
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def require_snapshot(path: Path, expected: dict[str, Any], description: str) -> None:
    actual = snapshot(path, description)
    if not same_snapshot(actual, expected):
        raise ValueError(f"changed preimage for {description}: {path}")


def atomic_write(
    path: Path,
    data: bytes,
    *,
    mode: int,
    uid: int,
    gid: int,
    expected: dict[str, Any],
    description: str,
) -> dict[str, Any]:
    """Replace one known leaf atomically after an ordinary preimage reread."""
    require_directory(path.parent, f"{description} parent", allow_absent=False)
    validate_snapshot(expected, f"{description} expected")
    desired = predicted_snapshot(data, (mode, uid, gid))
    require_snapshot(path, expected, description)
    if same_snapshot(expected, desired):
        return expected

    temp = path.parent / (
        f".{path.name}.{TEMP_TAG}-{os.getpid()}-{secrets.token_hex(8)}.tmp"
    )
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(temp, flags, 0o600)
    try:
        view = memoryview(data)
        while view:
            written = os.write(fd, view)
            view = view[written:]
        if (uid, gid) != (os.geteuid(), os.getegid()):
            os.fchown(fd, uid, gid)
        os.fchmod(fd, mode)
        os.fsync(fd)
        os.close(fd)
        fd = -1
        require_snapshot(path, expected, description)
        os.replace(temp, path)
        fsync_directory(path.parent)
        require_snapshot(path, desired, description)
        return desired
    finally:
        if fd >= 0:
            os.close(fd)
        try:
            info = temp.lstat()
        except FileNotFoundError:
            pass
        else:
            if stat.S_ISREG(info.st_mode):
                temp.unlink()


def delete_known(path: Path, expected: dict[str, Any], description: str) -> None:
    validate_snapshot(expected, f"{description} expected")
    if not expected["exists"]:
        raise ValueError(f"cannot delete absent expected state for {description}")
    require_snapshot(path, expected, description)
    path.unlink()
    fsync_directory(path.parent)
    require_snapshot(path, missing_snapshot(), description)


def restore_known(
    path: Path,
    preimage: dict[str, Any],
    current: dict[str, Any],
    description: str,
) -> None:
    validate_snapshot(preimage, f"{description} preimage")
    validate_snapshot(current, f"{description} current")
    if same_snapshot(preimage, current):
        return
    if preimage["exists"]:
        atomic_write(
            path,
            snapshot_bytes(preimage),
            mode=preimage["mode"],
            uid=preimage["uid"],
            gid=preimage["gid"],
            expected=current,
            description=description,
        )
    else:
        delete_known(path, current, description)


def newline_style(data: bytes) -> bytes:
    crlf = data.count(b"\r\n")
    lone_lf = data.count(b"\n") - crlf
    if crlf and not lone_lf:
        return b"\r\n"
    return b"\n"


def install_new_block(existing: bytes, block: bytes) -> tuple[bytes, bytes, bytes]:
    if not existing:
        return block, b"", b""
    newline = newline_style(existing)
    had_final = existing.endswith(b"\n")
    prefix = newline if had_final else newline + newline
    suffix = newline if had_final else b""
    return existing + prefix + block + suffix, prefix, suffix


def separators_match(
    data: bytes, selected: tuple[int, int], entry: dict[str, Any], description: str
) -> None:
    start, end = selected
    prefix = decode(entry["prefixSeparatorBase64"])
    suffix = decode(entry["suffixSeparatorBase64"])
    if prefix and data[max(0, start - len(prefix)) : start] != prefix:
        raise ValueError(f"{description} owned prefix separator drifted")
    if suffix and data[end : end + len(suffix)] != suffix:
        raise ValueError(f"{description} owned suffix separator drifted")


def remove_owned_block(
    data: bytes, selected: tuple[int, int], entry: dict[str, Any], description: str
) -> bytes:
    separators_match(data, selected, entry, description)
    start, end = selected
    prefix = decode(entry["prefixSeparatorBase64"])
    suffix = decode(entry["suffixSeparatorBase64"])
    return data[: start - len(prefix)] + data[end + len(suffix) :]


def validate_manifest(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {
        "schemaVersion",
        "generation",
        "selectedContext",
        "legacyAppend",
    }:
        raise ValueError("role protocol ownership manifest is malformed")
    if value.get("schemaVersion") != 1 or value.get("generation") not in {
        "bridge",
        "final",
    }:
        raise ValueError("role protocol ownership manifest is unsupported")
    context = value.get("selectedContext")
    legacy = value.get("legacyAppend")
    common = {
        "path",
        "blockSha256",
        "prefixSeparatorBase64",
        "suffixSeparatorBase64",
    }
    if not isinstance(context, dict) or set(context) != common | {"installerCreated"}:
        raise ValueError("role protocol ownership manifest selectedContext is malformed")
    if not isinstance(legacy, dict) or set(legacy) != common:
        raise ValueError("role protocol ownership manifest legacyAppend is malformed")
    if context.get("path") not in CONTEXT_CANDIDATES or type(
        context.get("installerCreated")
    ) is not bool:
        raise ValueError("role protocol ownership manifest selected context is invalid")
    if legacy.get("path") != "APPEND_SYSTEM.md":
        raise ValueError("role protocol ownership manifest legacy path is invalid")
    for entry, label in ((context, "selectedContext"), (legacy, "legacyAppend")):
        for key in (
            "path",
            "blockSha256",
            "prefixSeparatorBase64",
            "suffixSeparatorBase64",
        ):
            if not isinstance(entry.get(key), str):
                raise ValueError(
                    f"role protocol ownership manifest {label}.{key} is invalid"
                )
        decode(entry["prefixSeparatorBase64"])
        decode(entry["suffixSeparatorBase64"])
        if len(entry["blockSha256"]) != 64:
            raise ValueError(
                f"role protocol ownership manifest {label}.blockSha256 is invalid"
            )
    return value


def load_manifest(path: Path) -> tuple[dict[str, Any] | None, dict[str, Any]]:
    current = snapshot(path, "role protocol ownership manifest")
    if not current["exists"]:
        return None, current
    if current["mode"] != 0o600:
        raise ValueError(f"role protocol ownership manifest must be mode 0600: {path}")
    try:
        value = validate_manifest(json.loads(snapshot_bytes(current).decode("utf-8")))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"role protocol ownership manifest is malformed: {path}") from error
    return value, current


def inspect_candidates(
    root: Path,
) -> tuple[str, dict[str, tuple[bytes, os.stat_result] | None]]:
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
    if name == selected_name:
        return True
    if loaded is None or selected_loaded is None:
        return False
    return (loaded[1].st_dev, loaded[1].st_ino) == (
        selected_loaded[1].st_dev,
        selected_loaded[1].st_ino,
    )


def manifest_value(
    generation: str,
    selected: str,
    installer_created: bool,
    kernel: bytes,
    legacy_sha256: str,
    context_prefix: bytes,
    context_suffix: bytes,
    append_prefix: bytes,
    append_suffix: bytes,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "generation": generation,
        "selectedContext": {
            "path": selected,
            "installerCreated": installer_created,
            "blockSha256": digest(kernel),
            "prefixSeparatorBase64": encode(context_prefix),
            "suffixSeparatorBase64": encode(context_suffix),
        },
        "legacyAppend": {
            "path": "APPEND_SYSTEM.md",
            "blockSha256": legacy_sha256,
            "prefixSeparatorBase64": encode(append_prefix),
            "suffixSeparatorBase64": encode(append_suffix),
        },
    }


def prepare_apply(
    root: Path, kernel: bytes, legacy: bytes | None, generation: str,
    *, allow_fresh_final: bool = False,
) -> dict[str, Any]:
    selected_name, candidates = inspect_candidates(root)
    selected_path = root / selected_name
    selected_loaded = candidates[selected_name]
    selected_data = b"" if selected_loaded is None else selected_loaded[0]
    selected_info = None if selected_loaded is None else selected_loaded[1]
    selected_range = managed_range(
        selected_data,
        KERNEL_START,
        KERNEL_END,
        f"selected global context {selected_name}",
    )

    for name, loaded in candidates.items():
        if loaded is None or aliases_selected(
            name, loaded, selected_name, selected_loaded
        ):
            continue
        if (
            managed_range(
                loaded[0],
                KERNEL_START,
                KERNEL_END,
                f"global context candidate {name}",
            )
            is not None
        ):
            raise ValueError(
                f"unselected global context candidate contains a latent role kernel: {name}"
            )

    manifest_path = root / STATE_DIR / STATE_NAME
    manifest, manifest_snapshot = load_manifest(manifest_path)
    if generation == "final" and manifest is None:
        if not allow_fresh_final:
            raise ValueError("final role protocol requires an owned bridge manifest")
        require_sandbox_fresh_root(root)
        if any(loaded is not None for loaded in candidates.values()):
            raise ValueError("fresh final role ownership requires no existing global context")
        if (root / "APPEND_SYSTEM.md").exists() or (root / "APPEND_SYSTEM.md").is_symlink():
            raise ValueError("fresh final role ownership requires no legacy APPEND destination")
    if generation == "bridge" and legacy is None:
        raise ValueError("bridge role protocol requires the legacy APPEND source")
    if (
        generation == "bridge"
        and manifest is not None
        and manifest["generation"] != "bridge"
    ):
        raise ValueError("final role protocol must be restored before bridge apply")
    installer_created = selected_loaded is None
    if manifest is not None:
        recorded = manifest["selectedContext"]
        if recorded["path"] != selected_name:
            raise ValueError(
                f"selected global context drift: manifest={recorded['path']} current={selected_name}"
            )
        if selected_loaded is None or selected_range is None:
            raise ValueError(
                f"managed role kernel disappeared from selected global context: {selected_name}"
            )
        start, end = selected_range
        existing_block = selected_data[start:end]
        if digest(existing_block) != recorded["blockSha256"]:
            raise ValueError(
                "selected global context role kernel disagrees with ownership manifest"
            )
        separators_match(
            selected_data, selected_range, recorded, "selected global context"
        )
        selected_updated = selected_data[:start] + kernel + selected_data[end:]
        context_prefix = decode(recorded["prefixSeparatorBase64"])
        context_suffix = decode(recorded["suffixSeparatorBase64"])
        installer_created = recorded["installerCreated"]
    else:
        if selected_range is not None:
            raise ValueError(
                "selected global context has an unowned role kernel without a manifest"
            )
        selected_updated, context_prefix, context_suffix = install_new_block(
            selected_data, kernel
        )

    append_path = root / "APPEND_SYSTEM.md"
    append_loaded = read_regular(append_path, "legacy APPEND destination")
    append_data = b"" if append_loaded is None else append_loaded[0]
    append_info = None if append_loaded is None else append_loaded[1]
    append_range = managed_range(
        append_data, LEGACY_START, LEGACY_END, "legacy APPEND destination"
    )
    if manifest is not None:
        recorded_legacy = manifest["legacyAppend"]
        append_prefix = decode(recorded_legacy["prefixSeparatorBase64"])
        append_suffix = decode(recorded_legacy["suffixSeparatorBase64"])
        if manifest["generation"] == "final":
            if append_range is not None:
                raise ValueError("managed legacy APPEND block reappeared after final removal")
            append_updated = append_data
        else:
            if append_range is None:
                raise ValueError("managed legacy APPEND block disappeared")
            start, end = append_range
            existing_block = append_data[start:end]
            if digest(existing_block) != recorded_legacy["blockSha256"]:
                raise ValueError("legacy APPEND block disagrees with ownership manifest")
            if generation == "final":
                append_updated = remove_owned_block(
                    append_data, append_range, recorded_legacy, "legacy APPEND"
                )
            else:
                separators_match(
                    append_data, append_range, recorded_legacy, "legacy APPEND"
                )
                append_updated = append_data[:start] + legacy + append_data[end:]
    elif generation == "final" and allow_fresh_final and manifest is None:
        # A genuinely fresh final install owns no legacy APPEND block. Do not
        # create a fake bridge or an empty APPEND_SYSTEM.md merely for migration.
        append_updated, append_prefix, append_suffix = append_data, b"", b""
    elif append_range is None:
        append_updated, append_prefix, append_suffix = install_new_block(
            append_data, legacy
        )
    else:
        start, end = append_range
        if append_data[start:end] != legacy:
            raise ValueError(
                "legacy APPEND block does not match the accepted predecessor"
            )
        # Exact predecessor adoption does not claim surrounding user separators.
        append_updated = append_data
        append_prefix = b""
        append_suffix = b""

    value = manifest_value(
        generation,
        selected_name,
        installer_created,
        kernel,
        manifest["legacyAppend"]["blockSha256"] if manifest is not None else digest(legacy or b""),
        context_prefix,
        context_suffix,
        append_prefix,
        append_suffix,
    )

    manifest_data = canonical_json(value)
    append_postimage = (
        missing_snapshot()
        if generation == "final"
        and (manifest is None or manifest["generation"] == "final")
        and append_loaded is None
        else predicted_snapshot(
            append_updated, metadata(append_info, new_mode=0o644)
        )
    )
    entries = [
        {
            "label": "context",
            "relativePath": selected_name,
            "path": selected_path,
            "preimage": snapshot(selected_path, "selected global context"),
            "postimage": predicted_snapshot(
                selected_updated, metadata(selected_info, new_mode=0o644)
            ),
        },
        {
            "label": "legacyAppend",
            "relativePath": "APPEND_SYSTEM.md",
            "path": append_path,
            "preimage": snapshot(append_path, "legacy APPEND"),
            "postimage": append_postimage,
        },
        {
            "label": "manifest",
            "relativePath": f"{STATE_DIR}/{STATE_NAME}",
            "path": manifest_path,
            "preimage": manifest_snapshot,
            "postimage": predicted_snapshot(
                manifest_data,
                metadata(
                    None if not manifest_snapshot["exists"] else os.stat(manifest_path),
                    new_mode=0o600,
                ),
            ),
        },
    ]
    return {
        "selected_name": selected_name,
        "manifest_value": value,
        "entries": entries,
    }


def expected_inventory(selected: str) -> list[tuple[str, str]]:
    if selected not in CONTEXT_CANDIDATES:
        raise ValueError("receipt selected context is invalid")
    return [
        ("context", selected),
        ("legacyAppend", "APPEND_SYSTEM.md"),
        ("manifest", f"{STATE_DIR}/{STATE_NAME}"),
    ]


def receipt_value(
    root: Path,
    generation: str,
    selected: str,
    entries: list[dict[str, Any]],
    transaction: str,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "manager": RECEIPT_MANAGER,
        "transaction": transaction,
        "generation": generation,
        "destinationRealpath": os.path.realpath(root),
        "selectedContext": selected,
        "files": [
            {
                "label": entry["label"],
                "relativePath": entry["relativePath"],
                "preimage": entry["preimage"],
                "postimage": entry["postimage"],
            }
            for entry in entries
        ],
    }


def parse_snapshot_json(value: dict[str, Any], label: str) -> dict[str, Any]:
    if not value["exists"]:
        raise ValueError(f"{label} is unexpectedly absent")
    try:
        loaded = json.loads(snapshot_bytes(value).decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"{label} JSON is malformed") from error
    if not isinstance(loaded, dict):
        raise ValueError(f"{label} JSON is malformed")
    return loaded


def validate_receipt(
    value: Any,
    root: Path,
    *,
    allowed_transactions: set[str] | None = None,
) -> dict[str, Any]:
    required = {
        "schemaVersion",
        "manager",
        "transaction",
        "generation",
        "destinationRealpath",
        "selectedContext",
        "files",
    }
    if not isinstance(value, dict) or set(value) != required:
        raise ValueError("role protocol receipt schema is malformed")
    if (
        value.get("schemaVersion") != 1
        or value.get("manager") != RECEIPT_MANAGER
        or value.get("generation") not in {"bridge", "final"}
    ):
        raise ValueError("role protocol receipt is unsupported")
    transaction = value.get("transaction")
    if transaction not in {"prepared", "applied", "rolled_back", "restored"}:
        raise ValueError("role protocol receipt transaction is invalid")
    if allowed_transactions is not None and transaction not in allowed_transactions:
        raise ValueError(
            f"role protocol receipt is not in an allowed state: {transaction}"
        )
    if value.get("destinationRealpath") != os.path.realpath(root):
        raise ValueError("role protocol receipt destination does not match")
    selected = value.get("selectedContext")
    inventory = expected_inventory(selected)
    files = value.get("files")
    if not isinstance(files, list) or len(files) != len(inventory):
        raise ValueError("role protocol receipt file inventory is malformed")

    validated: dict[str, dict[str, Any]] = {}
    for index, ((label, relative), entry) in enumerate(zip(inventory, files)):
        if not isinstance(entry, dict) or set(entry) != {
            "label",
            "relativePath",
            "preimage",
            "postimage",
        }:
            raise ValueError(f"role protocol receipt file {index} is malformed")
        if entry.get("label") != label or entry.get("relativePath") != relative:
            raise ValueError("role protocol receipt fixed inventory does not match")
        validate_snapshot(entry.get("preimage"), f"receipt {label} preimage")
        validate_snapshot(entry.get("postimage"), f"receipt {label} postimage")
        if not entry["postimage"]["exists"] and not (
            value["generation"] == "final" and label == "legacyAppend"
        ):
            raise ValueError(f"role protocol receipt {label} postimage is absent")
        validated[label] = entry

    manifest_post = validate_manifest(
        parse_snapshot_json(validated["manifest"]["postimage"], "manifest postimage")
    )
    if manifest_post["generation"] != value["generation"]:
        raise ValueError("receipt generation disagrees with manifest postimage")
    if manifest_post["selectedContext"]["path"] != selected:
        raise ValueError("receipt selection disagrees with manifest postimage")

    context_post = snapshot_bytes(validated["context"]["postimage"])
    context_range = managed_range(
        context_post, KERNEL_START, KERNEL_END, "receipt context postimage"
    )
    if context_range is None or digest(
        context_post[context_range[0] : context_range[1]]
    ) != manifest_post["selectedContext"]["blockSha256"]:
        raise ValueError("receipt context postimage disagrees with manifest")

    append_post_snapshot = validated["legacyAppend"]["postimage"]
    append_post = (
        snapshot_bytes(append_post_snapshot)
        if append_post_snapshot["exists"]
        else b""
    )
    append_range = managed_range(
        append_post, LEGACY_START, LEGACY_END, "receipt APPEND postimage"
    )
    if manifest_post["generation"] == "bridge":
        if append_range is None or digest(
            append_post[append_range[0] : append_range[1]]
        ) != manifest_post["legacyAppend"]["blockSha256"]:
            raise ValueError("receipt APPEND postimage disagrees with manifest")
    elif append_range is not None:
        raise ValueError("final receipt APPEND postimage retains the managed block")

    manifest_preimage = validated["manifest"]["preimage"]
    context_preimage = validated["context"]["preimage"]
    if manifest_preimage["exists"]:
        manifest_pre = validate_manifest(
            parse_snapshot_json(manifest_preimage, "manifest preimage")
        )
        if (
            manifest_pre["selectedContext"]["path"] != selected
            or manifest_pre["selectedContext"]["installerCreated"]
            != manifest_post["selectedContext"]["installerCreated"]
            or not context_preimage["exists"]
        ):
            raise ValueError("receipt context ownership transition is contradictory")
    elif manifest_post["selectedContext"]["installerCreated"] != (
        not context_preimage["exists"]
    ):
        raise ValueError("receipt context creation ownership is contradictory")

    if value["generation"] == "final":
        if not manifest_preimage["exists"]:
            # A container-only fresh final install has no bridge preimage to
            # restore. The fixed inventory must instead restore a wholly absent
            # context, manifest, and APPEND file, not any unrelated user bytes.
            require_sandbox_fresh_root(root)
            append_preimage = validated["legacyAppend"]["preimage"]
            if (context_preimage["exists"] or append_preimage["exists"]
                    or append_post_snapshot["exists"]
                    or not manifest_post["selectedContext"]["installerCreated"]
                    or manifest_post["legacyAppend"]["blockSha256"] != digest(b"")
                    or context_post[:context_range[0]].strip()
                    or context_post[context_range[1]:].strip()):
                raise ValueError("fresh final receipt does not restore an empty sandbox role preimage")
            separators_match(context_post, context_range,
                             manifest_post["selectedContext"],
                             "fresh final receipt context postimage")
            return value
        context_pre = snapshot_bytes(context_preimage)
        context_pre_range = managed_range(
            context_pre, KERNEL_START, KERNEL_END, "receipt context preimage"
        )
        if context_pre_range is None or digest(
            context_pre[context_pre_range[0] : context_pre_range[1]]
        ) != manifest_pre["selectedContext"]["blockSha256"]:
            raise ValueError("receipt context preimage disagrees with manifest")
        separators_match(
            context_pre,
            context_pre_range,
            manifest_pre["selectedContext"],
            "receipt context preimage",
        )
        post_start, post_end = context_range
        pre_start, pre_end = context_pre_range
        expected_context_post = (
            context_pre[:pre_start]
            + context_post[post_start:post_end]
            + context_pre[pre_end:]
        )
        context_postimage = validated["context"]["postimage"]
        if (context_post != expected_context_post
                or any(context_preimage[key] != context_postimage[key]
                       for key in ("mode", "uid", "gid"))):
            raise ValueError("final receipt changes bytes outside the owned context block")
        expected_final_manifest = {
            **manifest_pre,
            "generation": "final",
            "selectedContext": {
                **manifest_pre["selectedContext"],
                "blockSha256": manifest_post["selectedContext"]["blockSha256"],
            },
        }
        if manifest_post != expected_final_manifest:
            raise ValueError("final receipt manifest transition is contradictory")
        append_preimage = validated["legacyAppend"]["preimage"]
        append_postimage = validated["legacyAppend"]["postimage"]
        if manifest_pre["generation"] == "final":
            if append_preimage != append_postimage:
                raise ValueError("final refresh receipt unexpectedly changes APPEND")
        else:
            if not append_preimage["exists"]:
                raise ValueError("final receipt bridge APPEND preimage is absent")
            append_pre = snapshot_bytes(append_preimage)
            append_pre_range = managed_range(
                append_pre, LEGACY_START, LEGACY_END, "receipt APPEND preimage"
            )
            if append_pre_range is None or digest(
                append_pre[append_pre_range[0] : append_pre_range[1]]
            ) != manifest_pre["legacyAppend"]["blockSha256"]:
                raise ValueError(
                    "final receipt bridge APPEND preimage disagrees with manifest"
                )
            expected_append_post = remove_owned_block(
                append_pre,
                append_pre_range,
                manifest_pre["legacyAppend"],
                "receipt bridge APPEND",
            )
            if (not append_postimage["exists"]
                    or snapshot_bytes(append_postimage) != expected_append_post
                    or any(append_preimage[key] != append_postimage[key]
                           for key in ("mode", "uid", "gid"))):
                raise ValueError("final receipt bridge APPEND removal is contradictory")
    return value


def receipt_location_is_external(receipt_path: Path, root: Path) -> None:
    receipt = Path(os.path.abspath(os.fspath(receipt_path)))
    destination = Path(os.path.abspath(os.fspath(root)))
    if receipt == destination or destination in receipt.parents:
        raise ValueError("role protocol receipt must be outside the managed destination")
    require_directory(receipt.parent, "role protocol receipt parent", allow_absent=False)


def load_receipt(
    path: Path,
    root: Path,
    *,
    allowed_transactions: set[str] | None = None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    current = snapshot(path, "role protocol receipt", allow_absent=False)
    if current["mode"] != 0o600:
        raise ValueError(f"role protocol receipt must be mode 0600: {path}")
    try:
        value = json.loads(snapshot_bytes(current).decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"role protocol receipt is malformed: {path}") from error
    return validate_receipt(
        value, root, allowed_transactions=allowed_transactions
    ), current


def write_receipt(
    path: Path,
    value: dict[str, Any],
    root: Path,
    expected: dict[str, Any],
) -> dict[str, Any]:
    validate_receipt(value, root)
    return atomic_write(
        path,
        canonical_json(value),
        mode=0o600,
        uid=os.geteuid(),
        gid=os.getegid(),
        expected=expected,
        description="role protocol receipt",
    )


def acquire_lock(root: Path, *, create: bool) -> int:
    lock_path = root / LOCK_NAME
    info = safe_lstat(lock_path, "role protocol lock")
    if info is not None and not stat.S_ISREG(info.st_mode):
        raise ValueError(f"role protocol lock is not a regular file: {lock_path}")
    flags = os.O_RDWR | getattr(os, "O_NOFOLLOW", 0)
    if create:
        flags |= os.O_CREAT
    elif info is None:
        raise ValueError(f"role protocol lock is missing: {lock_path}")
    fd = os.open(lock_path, flags, 0o600)
    try:
        if not stat.S_ISREG(os.fstat(fd).st_mode):
            raise ValueError(f"role protocol lock is not a regular file: {lock_path}")
        fcntl.flock(fd, fcntl.LOCK_EX)
        return fd
    except Exception:
        os.close(fd)
        raise


def preflight(
    root: Path, config_path: Path, kernel_path: Path, legacy_path: Path,
    *, allow_fresh_final: bool = False,
) -> dict[str, Any]:
    generation = validate_config(config_path)["generation"]
    if allow_fresh_final:
        if generation != "final":
            raise ValueError("fresh final ownership requires the final role protocol")
        require_sandbox_fresh_root(root)
    kernel = load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
    legacy = (
        load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
        if generation == "bridge"
        else None
    )
    require_directory(root, "agentDir")
    if not root.exists():
        if generation == "final":
            raise ValueError("final role protocol requires an owned bridge manifest")
        selected = "AGENTS.md"
        legacy_sha256 = digest(legacy)
    else:
        state_dir = root / STATE_DIR
        require_directory(state_dir, "role protocol state directory")
        selected, candidates = inspect_candidates(root)
        selected_loaded = candidates[selected]
        manifest, _ = load_manifest(state_dir / STATE_NAME)
        if generation == "final" and manifest is None:
            if not allow_fresh_final:
                raise ValueError("final role protocol requires an owned bridge manifest")
            if any(loaded is not None for loaded in candidates.values()):
                raise ValueError("fresh final role ownership requires no existing global context")
            if (root / "APPEND_SYSTEM.md").exists() or (root / "APPEND_SYSTEM.md").is_symlink():
                raise ValueError("fresh final role ownership requires no legacy APPEND destination")
        if (
            generation == "bridge"
            and manifest is not None
            and manifest["generation"] != "bridge"
        ):
            raise ValueError("final role protocol must be restored before bridge apply")
        if manifest is not None and manifest["selectedContext"]["path"] != selected:
            raise ValueError(
                f"selected global context drift: manifest={manifest['selectedContext']['path']} current={selected}"
            )
        selected_block = None
        for name, loaded in candidates.items():
            if loaded is None:
                continue
            found = managed_range(
                loaded[0],
                KERNEL_START,
                KERNEL_END,
                f"global context candidate {name}",
            )
            if aliases_selected(name, loaded, selected, selected_loaded):
                selected_block = found
            elif found is not None:
                raise ValueError(
                    f"unselected global context candidate contains a latent role kernel: {name}"
                )
        if manifest is None and selected_block is not None:
            raise ValueError(
                "selected global context has an unowned role kernel without a manifest"
            )
        append_loaded = read_regular(
            root / "APPEND_SYSTEM.md", "legacy APPEND destination"
        )
        if append_loaded is not None:
            found = managed_range(
                append_loaded[0],
                LEGACY_START,
                LEGACY_END,
                "legacy APPEND destination",
            )
            if manifest is None and found is not None:
                start, end = found
                if append_loaded[0][start:end] != legacy:
                    raise ValueError(
                        "legacy APPEND block does not match the accepted predecessor"
                    )
        legacy_sha256 = (
            manifest["legacyAppend"]["blockSha256"]
            if manifest is not None
            else digest(legacy or b"")
        )
    return {
        "generation": generation,
        "selectedContext": selected,
        "kernelSha256": digest(kernel),
        "legacyAppendSha256": legacy_sha256,
    }


def entry_path(root: Path, entry: dict[str, Any]) -> Path:
    return root / entry["relativePath"]


def classify_entries(
    root: Path, entries: list[dict[str, Any]]
) -> list[tuple[dict[str, Any], dict[str, Any], str]]:
    classified: list[tuple[dict[str, Any], dict[str, Any], str]] = []
    for entry in entries:
        current = snapshot(entry_path(root, entry), entry["label"])
        if same_snapshot(current, entry["preimage"]):
            state = "preimage"
        elif same_snapshot(current, entry["postimage"]):
            state = "postimage"
        else:
            raise RuntimeError(
                f"unknown state for {entry['label']}; preserve files and receipt for manual recovery"
            )
        classified.append((entry, current, state))
    return classified


def rollback_known_entries(root: Path, entries: list[dict[str, Any]]) -> None:
    classified = classify_entries(root, entries)
    for entry, current, state in reversed(classified):
        if state == "postimage":
            restore_known(
                entry_path(root, entry),
                entry["preimage"],
                current,
                entry["label"],
            )
    for entry in entries:
        require_snapshot(
            entry_path(root, entry), entry["preimage"], entry["label"]
        )


def apply_protocol(
    root: Path,
    config_path: Path,
    kernel_path: Path,
    legacy_path: Path,
    receipt_path: Path | None,
    *, allow_fresh_final: bool = False,
) -> dict[str, Any]:
    if allow_fresh_final:
        require_sandbox_fresh_root(root)
    receipt_expected = missing_snapshot()
    if receipt_path is not None:
        receipt_location_is_external(receipt_path, root)
        current = snapshot(receipt_path, "role protocol receipt")
        if current["exists"]:
            previous_value, receipt_expected = load_receipt(
                receipt_path,
                root,
                allowed_transactions={"rolled_back", "restored"},
            )
    # Static source validation is safe before destination serialization. Every
    # read of mutable destination state happens only after the cooperative lock.
    generation = validate_config(config_path)["generation"]
    load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
    if generation == "bridge":
        load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
    require_directory(root, "agentDir")
    root.mkdir(parents=True, mode=0o700, exist_ok=True)
    require_directory(root, "agentDir", allow_absent=False)
    lock_fd = acquire_lock(root, create=True)
    prepared_receipt_snapshot: dict[str, Any] | None = None
    prepared: dict[str, Any] | None = None
    try:
        preflight(root, config_path, kernel_path, legacy_path,
                  allow_fresh_final=allow_fresh_final)
        if receipt_path is not None:
            require_snapshot(
                receipt_path, receipt_expected, "role protocol receipt"
            )
            if receipt_expected["exists"]:
                previous_value, _ = load_receipt(
                    receipt_path,
                    root,
                    allowed_transactions={"rolled_back", "restored"},
                )
                if any(
                    not same_snapshot(
                        snapshot(entry_path(root, entry), entry["label"]),
                        entry["preimage"],
                    )
                    for entry in previous_value["files"]
                ):
                    raise ValueError(
                        "existing restored receipt no longer matches its known preimages"
                    )
        kernel = load_block(
            kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source"
        )
        legacy = (
            load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
            if generation == "bridge"
            else None
        )
        state_dir = root / STATE_DIR
        require_directory(state_dir, "role protocol state directory")
        if not state_dir.exists():
            state_dir.mkdir(mode=0o700)
            fsync_directory(root)
        prepared = prepare_apply(root, kernel, legacy, generation,
                                 allow_fresh_final=allow_fresh_final)
        entries = prepared["entries"]

        if receipt_path is not None:
            receipt = receipt_value(
                root, generation, prepared["selected_name"], entries, "prepared"
            )
            prepared_receipt_snapshot = write_receipt(
                receipt_path, receipt, root, receipt_expected
            )

        try:
            for entry in entries:
                if same_snapshot(entry["preimage"], entry["postimage"]):
                    continue
                postimage = entry["postimage"]
                atomic_write(
                    entry_path(root, entry),
                    snapshot_bytes(postimage),
                    mode=postimage["mode"],
                    uid=postimage["uid"],
                    gid=postimage["gid"],
                    expected=entry["preimage"],
                    description=entry["label"],
                )
            check_protocol(
                root,
                config_path,
                kernel_path,
                legacy_path,
                already_locked=True,
            )
            if receipt_path is not None:
                assert prepared_receipt_snapshot is not None
                applied = receipt_value(
                    root, generation, prepared["selected_name"], entries, "applied"
                )
                write_receipt(
                    receipt_path,
                    applied,
                    root,
                    prepared_receipt_snapshot,
                )
        except Exception as error:
            try:
                rollback_known_entries(root, entries)
                if receipt_path is not None and prepared_receipt_snapshot is not None:
                    rolled_back = receipt_value(
                        root,
                        generation,
                        prepared["selected_name"],
                        entries,
                        "rolled_back",
                    )
                    write_receipt(
                        receipt_path,
                        rolled_back,
                        root,
                        prepared_receipt_snapshot,
                    )
            except Exception as rollback_error:
                raise RuntimeError(
                    f"apply failed ({error}); automatic rollback is incomplete ({rollback_error}); "
                    "preserve files and receipt for manual recovery"
                ) from error
            raise RuntimeError(f"apply failed ({error}); changes rolled back") from error

        return {
            "generation": generation,
            "selectedContext": prepared["selected_name"],
            "manifest": str(root / STATE_DIR / STATE_NAME),
        }
    finally:
        os.close(lock_fd)


def check_protocol(
    root: Path,
    config_path: Path,
    kernel_path: Path,
    legacy_path: Path,
    *,
    already_locked: bool = False,
) -> dict[str, Any]:
    generation = validate_config(config_path)["generation"]
    kernel = load_block(kernel_path, KERNEL_START, KERNEL_END, "ROLE_KERNEL source")
    legacy = (
        load_block(legacy_path, LEGACY_START, LEGACY_END, "legacy APPEND source")
        if generation == "bridge"
        else None
    )
    require_directory(root, "agentDir", allow_absent=False)
    lock_fd = None if already_locked else acquire_lock(root, create=False)
    try:
        require_directory(
            root / STATE_DIR, "role protocol state directory", allow_absent=False
        )
        selected_name, candidates = inspect_candidates(root)
        manifest, _ = load_manifest(root / STATE_DIR / STATE_NAME)
        if manifest is None:
            raise ValueError("missing role protocol ownership manifest")
        if manifest["generation"] != generation:
            raise ValueError(
                "role protocol generation mismatch: "
                f"manifest={manifest['generation']} config={generation}"
            )
        recorded = manifest["selectedContext"]
        if recorded["path"] != selected_name:
            raise ValueError(
                f"selected global context drift: manifest={recorded['path']} current={selected_name}"
            )
        selected_loaded = candidates[selected_name]
        for name, loaded in candidates.items():
            if loaded is None:
                continue
            found = managed_range(
                loaded[0],
                KERNEL_START,
                KERNEL_END,
                f"global context candidate {name}",
            )
            if not aliases_selected(
                name, loaded, selected_name, selected_loaded
            ) and found is not None:
                raise ValueError(
                    f"unselected global context candidate contains a latent role kernel: {name}"
                )
        if selected_loaded is None:
            raise ValueError(f"missing selected global context: {selected_name}")
        selected_data = selected_loaded[0]
        selected_range = managed_range(
            selected_data,
            KERNEL_START,
            KERNEL_END,
            "selected global context",
        )
        if (
            selected_range is None
            or selected_data[selected_range[0] : selected_range[1]] != kernel
        ):
            raise ValueError(
                f"missing or stale managed role kernel: {root / selected_name}"
            )
        separators_match(
            selected_data, selected_range, recorded, "selected global context"
        )
        append_loaded = read_regular(
            root / "APPEND_SYSTEM.md",
            "legacy APPEND destination",
            allow_absent=generation == "final",
        )
        append_data = b"" if append_loaded is None else append_loaded[0]
        append_range = managed_range(
            append_data,
            LEGACY_START,
            LEGACY_END,
            "legacy APPEND destination",
        )
        if generation == "bridge":
            if (
                append_range is None
                or append_data[append_range[0] : append_range[1]] != legacy
            ):
                raise ValueError(
                    f"missing or stale managed legacy APPEND block: {root / 'APPEND_SYSTEM.md'}"
                )
            separators_match(
                append_data,
                append_range,
                manifest["legacyAppend"],
                "legacy APPEND",
            )
        elif append_range is not None:
            raise ValueError(
                "managed legacy APPEND block remains after final removal: "
                f"{root / 'APPEND_SYSTEM.md'}"
            )
        if recorded["blockSha256"] != digest(kernel):
            raise ValueError("role protocol ownership manifest source digest is stale")
        legacy_sha256 = manifest["legacyAppend"]["blockSha256"]
        if generation == "bridge" and legacy_sha256 != digest(legacy):
            raise ValueError("role protocol ownership manifest source digest is stale")
        return {
            "generation": generation,
            "selectedContext": selected_name,
            "kernelSha256": digest(kernel),
            "legacyAppendSha256": legacy_sha256,
        }
    finally:
        if lock_fd is not None:
            os.close(lock_fd)


def restore_protocol(root: Path, receipt_path: Path) -> dict[str, Any]:
    receipt_location_is_external(receipt_path, root)
    require_directory(root, "agentDir", allow_absent=False)
    value, receipt_before_lock = load_receipt(receipt_path, root)
    lock_fd = acquire_lock(root, create=False)
    try:
        require_snapshot(
            receipt_path, receipt_before_lock, "role protocol receipt"
        )
        value, receipt_current = load_receipt(receipt_path, root)
        entries = value["files"]
        classified = classify_entries(root, entries)
        if all(state == "preimage" for _, _, state in classified):
            already = True
        else:
            already = False
            for entry, current, state in classified:
                if state == "postimage":
                    restore_known(
                        entry_path(root, entry),
                        entry["preimage"],
                        current,
                        entry["label"],
                    )
            for entry in entries:
                require_snapshot(
                    entry_path(root, entry), entry["preimage"], entry["label"]
                )

        if value["transaction"] != "restored":
            restored = dict(value)
            restored["transaction"] = "restored"
            write_receipt(
                receipt_path, restored, root, receipt_current
            )

        state_dir = root / STATE_DIR
        if state_dir.exists() and not any(state_dir.iterdir()):
            state_dir.rmdir()
            fsync_directory(root)
        return {
            "restored": True,
            "alreadyRestored": already,
            "generation": value["generation"],
            "receipt": str(receipt_path),
        }
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
            command.add_argument("--allow-fresh-final", action="store_true")
    restore = sub.add_parser("restore")
    restore.add_argument("receipt", type=Path)
    restore.add_argument("agent_dir", type=Path)
    args = parser.parse_args()
    try:
        if args.mode == "preflight":
            result = preflight(
                args.agent_dir, args.config, args.kernel, args.legacy_append
            )
        elif args.mode == "apply":
            result = apply_protocol(
                args.agent_dir,
                args.config,
                args.kernel,
                args.legacy_append,
                args.receipt,
                allow_fresh_final=args.allow_fresh_final,
            )
        elif args.mode == "check":
            result = check_protocol(
                args.agent_dir, args.config, args.kernel, args.legacy_append
            )
        else:
            result = restore_protocol(args.agent_dir, args.receipt)
        print(json.dumps(result, sort_keys=True))
        return 0
    except (
        OSError,
        RuntimeError,
        UnicodeError,
        ValueError,
        KeyError,
        TypeError,
        json.JSONDecodeError,
    ) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
