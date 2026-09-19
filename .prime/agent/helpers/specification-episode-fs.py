#!/usr/bin/env python3
"""Bound filesystem primitives for specification-episode transactions.

All security-sensitive operations descend from held directory descriptors with
O_NOFOLLOW. Product-directory identity is a mutation guard, never deletion
authority. Removal holds that directory and retires exact receipt-bound files into retained
Git-common quarantine evidence. Checked pathnames are never unlinked. JSON uses
stdin/stdout; no secrets are read.
"""
from __future__ import annotations

import ctypes
import hashlib
import json
import os
import secrets
import subprocess
import stat
import sys
from typing import Any

O_DIRECTORY = getattr(os, "O_DIRECTORY", 0)
O_NOFOLLOW = getattr(os, "O_NOFOLLOW", 0)
DIR_FLAGS = os.O_RDONLY | O_DIRECTORY | O_NOFOLLOW
FILE_READ_FLAGS = os.O_RDONLY | O_NOFOLLOW
AT_FDCWD = -2


def rename_exclusive_between(source_fd: int, source: str, target_fd: int, target: str) -> None:
    """Atomically move one entry without replacing an existing destination."""
    libc = ctypes.CDLL(None, use_errno=True)
    source_b = os.fsencode(source)
    target_b = os.fsencode(target)
    if sys.platform == "darwin" and hasattr(libc, "renameatx_np"):
        result = libc.renameatx_np(source_fd, source_b, target_fd, target_b, 0x00000004)
    elif hasattr(libc, "renameat2"):
        result = libc.renameat2(source_fd, source_b, target_fd, target_b, 0x00000001)
    else:
        fail("this platform lacks exclusive descriptor-relative rename support")
    if result != 0:
        error_number = ctypes.get_errno()
        raise OSError(error_number, os.strerror(error_number), target)


def rename_exchange(parent_fd: int, left: str, right: str) -> None:
    """Atomically exchange two existing descriptor-relative entries."""
    libc = ctypes.CDLL(None, use_errno=True)
    left_b = os.fsencode(left)
    right_b = os.fsencode(right)
    if sys.platform == "darwin" and hasattr(libc, "renameatx_np"):
        result = libc.renameatx_np(parent_fd, left_b, parent_fd, right_b, 0x00000002)
    elif hasattr(libc, "renameat2"):
        result = libc.renameat2(parent_fd, left_b, parent_fd, right_b, 0x00000002)
    else:
        fail("this platform lacks descriptor-relative rename-exchange support")
    if result != 0:
        error_number = ctypes.get_errno()
        raise OSError(error_number, os.strerror(error_number), right)


def rename_exclusive(parent_fd: int, source: str, target: str) -> None:
    rename_exclusive_between(parent_fd, source, parent_fd, target)

def fail(message: str) -> None:
    raise RuntimeError(message)

def components(value: str) -> list[str]:
    parts = value.split("/")
    if not parts or any(part in ("", ".", "..") for part in parts):
        fail(f"unsafe relative path: {value}")
    return parts

def open_root(path: str) -> int:
    absolute = os.path.abspath(path)
    if not os.path.isabs(absolute): fail(f"root path is not absolute: {path}")
    fd = os.open("/", DIR_FLAGS)
    try:
        for part in [part for part in absolute.split("/") if part]:
            nxt = os.open(part, DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = nxt
        return fd
    except Exception:
        os.close(fd)
        raise

def descend(root_fd: int, rel: str) -> int:
    fd = os.dup(root_fd)
    try:
        for part in components(rel):
            nxt = os.open(part, DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = nxt
        return fd
    except Exception:
        os.close(fd)
        raise

def open_parent(root_fd: int, rel: str) -> tuple[int, str]:
    parts = components(rel)
    if len(parts) == 1:
        return os.dup(root_fd), parts[0]
    return descend(root_fd, "/".join(parts[:-1])), parts[-1]


def ensure_path(root_fd: int, rel: str) -> tuple[int, bool]:
    """Create/open a directory chain without ever leaving held parent FDs."""
    fd = os.dup(root_fd)
    created_any = False
    try:
        for part in components(rel):
            try:
                os.mkdir(part, 0o700, dir_fd=fd)
                created_any = True
                os.fsync(fd)
            except FileExistsError:
                pass
            nxt = os.open(part, DIR_FLAGS, dir_fd=fd)
            os.close(fd)
            fd = nxt
        return fd, created_any
    except Exception:
        os.close(fd)
        raise


def preserve_entry(source_fd: int, source: str, quarantine_fd: int, prefix: str) -> str:
    """Move an entry to retained evidence; never unlink it."""
    target = f"{prefix}-{secrets.token_hex(16)}"
    rename_exclusive_between(source_fd, source, quarantine_fd, target)
    return target


def preserve_entry_named(source_fd: int, name: str, quarantine_fd: int, destination: str) -> str:
    """Retire or resume one exact entry at a manifest-bound destination."""
    if entry_exists(source_fd, name):
        rename_exclusive_between(source_fd, name, quarantine_fd, destination)
        os.fsync(source_fd)
        os.fsync(quarantine_fd)
    if not entry_exists(quarantine_fd, destination):
        fail(f"retirement evidence is missing: {destination}")
    return destination


def restore_exclusive(source_fd: int, source: str, target_fd: int, target: str) -> None:
    """Restore without replacing a concurrent destination."""
    rename_exclusive_between(source_fd, source, target_fd, target)

class StatxTimestamp(ctypes.Structure):
    _fields_ = [("tv_sec", ctypes.c_int64), ("tv_nsec", ctypes.c_uint32), ("reserved", ctypes.c_int32)]


class Statx(ctypes.Structure):
    _fields_ = [
        ("mask", ctypes.c_uint32), ("blksize", ctypes.c_uint32),
        ("attributes", ctypes.c_uint64), ("nlink", ctypes.c_uint32),
        ("uid", ctypes.c_uint32), ("gid", ctypes.c_uint32),
        ("mode", ctypes.c_uint16), ("spare0", ctypes.c_uint16),
        ("ino", ctypes.c_uint64), ("size", ctypes.c_uint64),
        ("blocks", ctypes.c_uint64), ("attributes_mask", ctypes.c_uint64),
        ("atime", StatxTimestamp), ("btime", StatxTimestamp),
        ("ctime", StatxTimestamp), ("mtime", StatxTimestamp),
        ("rdev_major", ctypes.c_uint32), ("rdev_minor", ctypes.c_uint32),
        ("dev_major", ctypes.c_uint32), ("dev_minor", ctypes.c_uint32),
        ("mnt_id", ctypes.c_uint64), ("dio_mem_align", ctypes.c_uint32),
        ("dio_offset_align", ctypes.c_uint32), ("spare3", ctypes.c_uint64 * 12),
    ]


def identity_fd(fd: int) -> dict[str, Any]:
    """Return a stable, platform-real incarnation identity for an open object."""
    st = os.fstat(fd)
    if sys.platform == "darwin":
        birth_ns = getattr(st, "st_birthtime_ns", None)
        if birth_ns is None:
            birth = getattr(st, "st_birthtime", None)
            if birth is None: fail("macOS filesystem does not expose stable birth time")
            birth_ns = int(birth * 1_000_000_000)
        return {
            "version": 2, "platform": "darwin", "device": str(st.st_dev),
            "inode": str(st.st_ino), "birthtime_ns": str(birth_ns), "mount_id": None,
        }
    if sys.platform.startswith("linux"):
        libc = ctypes.CDLL(None, use_errno=True)
        if not hasattr(libc, "statx"): fail("Linux runtime lacks statx support")
        result = Statx()
        # AT_EMPTY_PATH | AT_SYMLINK_NOFOLLOW; request INO | BTIME | MNT_ID.
        rc = libc.statx(fd, ctypes.c_char_p(b""), 0x1000 | 0x100, 0x100 | 0x800 | 0x1000, ctypes.byref(result))
        if rc != 0:
            error_number = ctypes.get_errno()
            raise OSError(error_number, os.strerror(error_number))
        if not (result.mask & 0x800): fail("Linux filesystem does not expose stable statx birth time")
        birth_ns = result.btime.tv_sec * 1_000_000_000 + result.btime.tv_nsec
        return {
            "version": 2, "platform": "linux", "device": str(st.st_dev),
            "inode": str(result.ino), "birthtime_ns": str(birth_ns),
            "mount_id": str(result.mnt_id) if result.mask & 0x1000 else None,
        }
    fail(f"unsupported filesystem identity platform: {sys.platform}")


def identity(st: os.stat_result) -> dict[str, Any]:
    """Compatibility parser for Darwin-only direct-stat tests; helpers use FDs."""
    if sys.platform != "darwin": fail("filesystem identity requires an open descriptor on this platform")
    birth_ns = getattr(st, "st_birthtime_ns", None)
    if birth_ns is None:
        birth = getattr(st, "st_birthtime", None)
        if birth is None: fail("macOS filesystem does not expose stable birth time")
        birth_ns = int(birth * 1_000_000_000)
    return {"version": 2, "platform": "darwin", "device": str(st.st_dev), "inode": str(st.st_ino), "birthtime_ns": str(birth_ns), "mount_id": None}


def matches_fd(fd: int, expected: dict[str, Any]) -> bool:
    return identity_fd(fd) == expected


def matches(st: os.stat_result, expected: dict[str, Any], *, ctime: bool = True) -> bool:
    del ctime
    return identity(st) == expected

def require_identity(fd: int, expected: dict[str, Any] | None, label: str) -> None:
    if expected is not None and not matches_fd(fd, expected): fail(f"{label} incarnation changed")


def entry_exists(parent_fd: int, name: str) -> bool:
    try:
        os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
        return True
    except FileNotFoundError:
        return False

def read_fd(fd: int) -> bytes:
    os.lseek(fd, 0, os.SEEK_SET)
    chunks: list[bytes] = []
    while True:
        chunk = os.read(fd, 1024 * 1024)
        if not chunk:
            return b"".join(chunks)
        chunks.append(chunk)

def durable_json(root: str, rel: str, text: str, create_only: bool, expected_identity: dict[str, Any] | None = None, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = quarantine_fd = -1
    temp = f".prime-claw-{secrets.token_hex(16)}.tmp"
    temp_created = False
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "control parent")
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=parent_fd)
        temp_created = True
        try:
            data = text.encode("utf-8")
            view = memoryview(data)
            while view:
                view = view[os.write(fd, view):]
            os.fsync(fd)
            staged_identity = identity_fd(fd)
        finally:
            os.close(fd)
        if create_only:
            try:
                os.link(temp, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd, follow_symlinks=False)
                created = True
            except FileExistsError:
                created = False
            if created:
                published_fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
                try:
                    if not matches_fd(published_fd, staged_identity): fail("created control state incarnation changed")
                finally: os.close(published_fd)
            quarantine_fd, _ = ensure_path(root_fd, "prime-claw/quarantine")
            preserve_entry(parent_fd, temp, quarantine_fd, "json-temp")
            temp_created = False
        else:
            try:
                prior_fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
            except FileNotFoundError:
                if expected_identity is not None: fail("control state disappeared before replacement")
                rename_exclusive(parent_fd, temp, name)
                published_fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
                try:
                    if not matches_fd(published_fd, staged_identity): fail("published control state incarnation changed")
                finally: os.close(published_fd)
                temp_created = False
                created = True
            else:
                if expected_identity is None or not matches_fd(prior_fd, expected_identity):
                    os.close(prior_fd)
                    fail("control state incarnation changed before replacement")
                staged_fd = os.open(temp, FILE_READ_FLAGS, dir_fd=parent_fd)
                try:
                    prior_identity = identity_fd(prior_fd)
                    if not matches_fd(staged_fd, staged_identity): fail("staged control state incarnation changed")
                finally:
                    os.close(staged_fd)
                    os.close(prior_fd)
                rename_exchange(parent_fd, temp, name)
                published_fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
                retired_fd = os.open(temp, FILE_READ_FLAGS, dir_fd=parent_fd)
                try:
                    if not matches_fd(published_fd, staged_identity): fail("published control state incarnation changed")
                    if not matches_fd(retired_fd, prior_identity): fail("replaced control state incarnation changed")
                finally:
                    os.close(retired_fd)
                    os.close(published_fd)
                quarantine_fd, _ = ensure_path(root_fd, "prime-claw/quarantine")
                preserve_entry(parent_fd, temp, quarantine_fd, "prior-control")
                temp_created = False
                created = True
        os.fsync(parent_fd)
        return {"created": created}
    finally:
        # A still-present exclusive temp is evidence. Never race an unlink.
        for fd in (quarantine_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass

def read_control(root: str, rel: str, allow_missing: bool = False, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = -1
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "control parent")
        try:
            fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
        except FileNotFoundError:
            if allow_missing: return {"exists": False}
            raise
        try:
            st = os.fstat(fd)
            if not stat.S_ISREG(st.st_mode): fail("control state is not a regular file")
            content = read_fd(fd)
            return {
                "exists": True,
                "text": content.decode("utf-8"),
                "size": len(content),
                "sha256": hashlib.sha256(content).hexdigest(),
                "identity": identity_fd(fd),
            }
        finally: os.close(fd)
    finally:
        if parent_fd >= 0: os.close(parent_fd)
        os.close(root_fd)

def retire_control(root: str, rel: str, expected_sha256: str, expected_identity: dict[str, Any], prefix: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = quarantine_fd = -1
    preserved = ""
    name = ""
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "control parent")
        fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode): fail("control state is not a regular file")
            if not matches_fd(fd, expected_identity): fail("control state incarnation changed")
            if hashlib.sha256(read_fd(fd)).hexdigest() != expected_sha256: fail("control state hash changed")
        finally:
            os.close(fd)
        quarantine_fd, _ = ensure_path(root_fd, "prime-claw/quarantine")
        preserved = preserve_entry(parent_fd, name, quarantine_fd, prefix)
        fd = os.open(preserved, FILE_READ_FLAGS, dir_fd=quarantine_fd)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode): fail("retired control state is not regular")
            if not matches_fd(fd, expected_identity): fail("retired control state incarnation changed")
            if hashlib.sha256(read_fd(fd)).hexdigest() != expected_sha256: fail("retired control state hash changed")
        finally:
            os.close(fd)
        os.fsync(parent_fd)
        os.fsync(quarantine_fd)
        return {"removed": True, "preserved_quarantine": preserved}
    except Exception:
        if preserved:
            if entry_exists(parent_fd, name):
                fail(f"control retirement failed; no-clobber restoration preserved {preserved} because destination is occupied")
            try:
                restore_exclusive(quarantine_fd, preserved, parent_fd, name)
                preserved = ""
            except Exception as restore_error:
                fail(f"control retirement failed and no-clobber restoration preserved {preserved}: {restore_error}")
        raise
    finally:
        for fd in (quarantine_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def remove_control(root: str, rel: str, expected_sha256: str, expected_identity: dict[str, Any], root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    return retire_control(root, rel, expected_sha256, expected_identity, "control", root_identity, parent_identity)



def acquire_lock(root: str, rel: str, owner_text: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = temp_fd = published_fd = -1
    temporary = f".prime-claw-lock-create-{secrets.token_hex(16)}"
    published = False
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "lock parent")
        os.mkdir(temporary, 0o700, dir_fd=parent_fd)
        temp_fd = os.open(temporary, DIR_FLAGS, dir_fd=parent_fd)
        owner_fd = os.open("owner.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=temp_fd)
        try:
            data = owner_text.encode("utf-8")
            view = memoryview(data)
            while view: view = view[os.write(owner_fd, view):]
            os.fsync(owner_fd)
            owner_identity = identity_fd(owner_fd)
        finally:
            os.close(owner_fd)
        os.fsync(temp_fd)
        temp_identity = identity_fd(temp_fd)
        try:
            rename_exclusive(parent_fd, temporary, name)
            published = True
        except FileExistsError:
            return {"created": False}
        published_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        if not matches_fd(published_fd, temp_identity): fail("published lock incarnation changed")
        owner_fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=published_fd)
        try:
            if not matches_fd(owner_fd, owner_identity): fail("published lock owner incarnation changed")
            if read_fd(owner_fd).decode("utf-8") != owner_text: fail("published lock owner changed")
        finally:
            os.close(owner_fd)
        os.fsync(parent_fd)
        return {"created": True, "lock_identity": temp_identity, "owner_identity": owner_identity, "owner_sha256": hashlib.sha256(owner_text.encode()).hexdigest()}
    except Exception:
        # If our exact incarnation reached the canonical name, retire it while
        # the parent descriptor and object identity are still authoritative.
        if published:
            try:
                current_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
                try: current_is_ours = matches_fd(current_fd, temp_identity)
                finally: os.close(current_fd)
                if current_is_ours:
                    quarantine_fd, _ = ensure_path(root_fd, "prime-claw/quarantine")
                    retained = preserve_entry(parent_fd, name, quarantine_fd, "failed-lock-acquire")
                    check_fd = os.open(retained, DIR_FLAGS, dir_fd=quarantine_fd)
                    try:
                        if not matches_fd(check_fd, temp_identity): fail("failed lock acquisition retirement mismatch")
                    finally: os.close(check_fd)
                    os.close(quarantine_fd)
            except Exception:
                pass
        raise
    finally:
        # Failed temporary/published incarnations are retained as evidence.
        for fd in (published_fd, temp_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def validate_lock(root: str, rel: str, token: str, lock_identity: dict[str, Any], owner_identity: dict[str, Any], owner_sha256: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = lock_fd = -1
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "lock parent")
        lock_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        if not matches_fd(lock_fd, lock_identity): fail("lock incarnation changed")
        if sorted(os.listdir(lock_fd)) != ["owner.json"]: fail("lock directory contains unexpected entries")
        owner_fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=lock_fd)
        try:
            if not matches_fd(owner_fd, owner_identity): fail("lock owner incarnation changed")
            owner_bytes = read_fd(owner_fd)
        finally: os.close(owner_fd)
        if hashlib.sha256(owner_bytes).hexdigest() != owner_sha256: fail("lock owner bytes changed")
        if json.loads(owner_bytes.decode("utf-8")).get("token") != token: fail("lock token changed")
        return {"valid": True}
    finally:
        for fd in (lock_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def remove_lock(root: str, rel: str, token: str, lock_identity: dict[str, Any], owner_identity: dict[str, Any], owner_sha256: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = lock_fd = quarantine_fd = -1
    preserved = ""
    name = ""
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "lock parent")
        lock_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        if not matches_fd(lock_fd, lock_identity): fail("lock incarnation changed before release")
        if sorted(os.listdir(lock_fd)) != ["owner.json"]: fail("lock directory contains unexpected entries")
        owner_fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=lock_fd)
        try:
            if not matches_fd(owner_fd, owner_identity): fail("lock owner incarnation changed before release")
            owner_bytes = read_fd(owner_fd)
        finally:
            os.close(owner_fd)
        if hashlib.sha256(owner_bytes).hexdigest() != owner_sha256: fail("lock owner bytes changed before release")
        owner = json.loads(owner_bytes.decode("utf-8"))
        if owner.get("token") != token: fail("lock token changed before release")
        quarantine_fd, _ = ensure_path(root_fd, "prime-claw/quarantine")
        preserved = preserve_entry(parent_fd, name, quarantine_fd, "released-lock")
        os.close(lock_fd)
        lock_fd = os.open(preserved, DIR_FLAGS, dir_fd=quarantine_fd)
        if not matches_fd(lock_fd, lock_identity): fail("retired lock incarnation mismatch")
        owner_fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=lock_fd)
        try:
            if not matches_fd(owner_fd, owner_identity): fail("retired lock owner incarnation mismatch")
            if hashlib.sha256(read_fd(owner_fd)).hexdigest() != owner_sha256: fail("retired lock owner bytes changed")
        finally:
            os.close(owner_fd)
        os.fsync(parent_fd)
        os.fsync(quarantine_fd)
        return {"removed": True, "preserved_quarantine": preserved}
    except Exception:
        if preserved:
            if entry_exists(parent_fd, name):
                fail(f"lock retirement failed; no-clobber restoration preserved {preserved} because destination is occupied")
            try:
                restore_exclusive(quarantine_fd, preserved, parent_fd, name)
                preserved = ""
            except Exception as restore_error:
                fail(f"lock retirement failed and no-clobber restoration preserved {preserved}: {restore_error}")
        raise
    finally:
        for fd in (lock_fd, quarantine_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def ensure_directory(repo: str, rel: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None, expected_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(repo)
    parent_fd = fd = -1
    try:
        require_identity(root_fd, root_identity, "directory root")
        if parent_identity is None:
            fd, created = ensure_path(root_fd, rel)
        else:
            parent_fd, name = open_parent(root_fd, rel)
            require_identity(parent_fd, parent_identity, "directory parent")
            try:
                fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
                created = False
            except FileNotFoundError:
                temporary = f".prime-claw-dir-create-{secrets.token_hex(16)}"
                os.mkdir(temporary, 0o700, dir_fd=parent_fd)
                staged_fd = os.open(temporary, DIR_FLAGS, dir_fd=parent_fd)
                staged_identity = identity_fd(staged_fd)
                os.close(staged_fd)
                rename_exclusive(parent_fd, temporary, name)
                fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
                if not matches_fd(fd, staged_identity): fail("published directory incarnation changed")
                created = True
        require_identity(fd, expected_identity, "directory")
        return {"created": created, "identity": identity_fd(fd)}
    finally:
        for item in (fd, parent_fd, root_fd):
            if item >= 0:
                try: os.close(item)
                except OSError: pass


def directory_identity(path: str) -> dict[str, Any]:
    fd = open_root(path)
    try: return {"identity": identity_fd(fd)}
    finally: os.close(fd)

def platform_preflight(repo: str, common_dir: str) -> dict[str, Any]:
    repo_fd = open_root(repo)
    common_fd = open_root(common_dir)
    try:
        return {"repo_identity": identity_fd(repo_fd), "common_identity": identity_fd(common_fd)}
    finally:
        os.close(common_fd)
        os.close(repo_fd)

def create_product_directory(repo: str, rel: str) -> dict[str, Any]:
    root_fd = open_root(repo)
    parent_fd = fd = published_fd = -1
    temporary = f".prime-claw-create-{secrets.token_hex(16)}"
    try:
        parent_fd, name = open_parent(root_fd, rel)
        os.mkdir(temporary, 0o700, dir_fd=parent_fd)
        fd = os.open(temporary, DIR_FLAGS, dir_fd=parent_fd)
        created_identity = identity_fd(fd)
        rename_exclusive(parent_fd, temporary, name)
        published_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        if not matches_fd(published_fd, created_identity): fail("published product directory incarnation changed")
        return {"identity": created_identity}
    finally:
        # Failed exclusive-create directories are retained; never race an rmdir.
        for item in (published_fd, fd, parent_fd, root_fd):
            if item >= 0:
                try: os.close(item)
                except OSError: pass

def create_product_file(repo: str, rel: str, content: str, directory_identity: dict[str, Any]) -> dict[str, Any]:
    root_fd = open_root(repo)
    parent_fd = -1
    try:
        parent_fd, name = open_parent(root_fd, rel)
        if not matches_fd(parent_fd, directory_identity): fail("owned directory identity changed before file creation")
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=parent_fd)
        try:
            data = content.encode("utf-8")
            view = memoryview(data)
            while view: view = view[os.write(fd, view):]
            os.fsync(fd)
            return {"identity": identity_fd(fd)}
        finally: os.close(fd)
    finally:
        if parent_fd >= 0: os.close(parent_fd)
        os.close(root_fd)

def snapshot_bundle(repo: str, target_rel: str, directory_identity: dict[str, Any], files: list[dict[str, Any]]) -> dict[str, Any]:
    root_fd = open_root(repo)
    target_fd = -1
    try:
        target_fd = descend(root_fd, target_rel)
        if not matches_fd(target_fd, directory_identity): fail("owned directory identity changed")
        names = sorted(os.listdir(target_fd))
        expected_names = sorted(item["name"] for item in files)
        if names != expected_names: fail("owned bundle entry set changed")
        for item in files:
            fd = os.open(item["name"], FILE_READ_FLAGS, dir_fd=target_fd)
            try:
                st = os.fstat(fd)
                if not stat.S_ISREG(st.st_mode): fail(f"owned bundle file is not regular: {item['name']}")
                if not matches_fd(fd, item["identity"]): fail(f"owned bundle file identity changed: {item['name']}")
                if read_fd(fd).decode("utf-8") != item["content"]: fail(f"owned bundle content changed: {item['name']}")
            finally: os.close(fd)
        return {"directory_identity": identity_fd(target_fd)}
    finally:
        if target_fd >= 0: os.close(target_fd)
        os.close(root_fd)

def create_json_in_fd(parent_fd: int, name: str, text: str, quarantine_fd: int) -> bool:
    temp = f".prime-claw-{secrets.token_hex(16)}.tmp"
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=parent_fd)
    try:
        data = text.encode("utf-8")
        view = memoryview(data)
        while view: view = view[os.write(fd, view):]
        os.fsync(fd)
    finally:
        os.close(fd)
    try:
        os.link(temp, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd, follow_symlinks=False)
        os.fsync(parent_fd)
        return True
    except FileExistsError:
        return False
    finally:
        # Retire the exclusively created temp rather than racing a final unlink.
        preserve_entry(parent_fd, temp, quarantine_fd, "consumption-temp")


def remove_bundle(data: dict[str, Any]) -> dict[str, Any]:
    repo_fd = open_root(data["repo"])
    common_fd = open_root(data["common_dir"])
    future_fd = consumed_fd = indexes_fd = target_fd = quarantine_fd = -1
    preserved: list[str] = []
    try:
        require_identity(common_fd, data.get("common_identity"), "Git common directory")
        target_parts = components(data["target_path"])
        future_fd = descend(repo_fd, "/".join(target_parts[:-1]))
        target_name = target_parts[-1]
        consumed_fd = descend(common_fd, "prime-claw/future-ownership-consumed")
        require_identity(consumed_fd, data.get("consumed_parent_identity"), "consumed control directory")
        indexes_fd = descend(common_fd, "prime-claw/indexes")
        require_identity(indexes_fd, data.get("indexes_identity"), "tree evidence directory")
        if data.get("quarantine_identity") is None:
            quarantine_fd, _ = ensure_path(common_fd, "prime-claw/quarantine")
        else:
            quarantine_fd = descend(common_fd, "prime-claw/quarantine")
            require_identity(quarantine_fd, data.get("quarantine_identity"), "quarantine directory")
        target_fd = os.open(target_name, DIR_FLAGS, dir_fd=future_fd)
        if not matches_fd(target_fd, data["directory_identity"]): fail("owned directory identity changed before removal")
        expected_names = sorted(item["name"] for item in data["files"])
        actual_names = sorted(os.listdir(target_fd))
        if any(name not in expected_names for name in actual_names): fail("owned bundle entry set changed before removal")

        consumed_created = create_json_in_fd(consumed_fd, data["consumed_name"], data["tombstone_text"], quarantine_fd)
        if not consumed_created:
            tombstone_fd = os.open(data["consumed_name"], FILE_READ_FLAGS, dir_fd=consumed_fd)
            try:
                if read_fd(tombstone_fd).decode("utf-8") != data["tombstone_text"]: fail("consumed retirement manifest changed")
            finally: os.close(tombstone_fd)

        for item in data["files"]:
            destination = item["retired_name"]
            if entry_exists(target_fd, item["name"]):
                fd = os.open(item["name"], FILE_READ_FLAGS, dir_fd=target_fd)
                try:
                    if not stat.S_ISREG(os.fstat(fd).st_mode) or not matches_fd(fd, item["identity"]): fail(f"owned file identity changed: {item['name']}")
                    if read_fd(fd).decode("utf-8") != item["content"]: fail(f"owned file content changed: {item['name']}")
                finally: os.close(fd)
            retired = preserve_entry_named(target_fd, item["name"], quarantine_fd, destination)
            fd = os.open(retired, FILE_READ_FLAGS, dir_fd=quarantine_fd)
            try:
                if not matches_fd(fd, item["identity"]): fail(f"retired file identity mismatch: {item['name']}")
                if read_fd(fd).decode("utf-8") != item["content"]: fail(f"retired file content changed: {item['name']}")
            finally: os.close(fd)
            preserved.append(retired)

        tree_name = data["tree_evidence_name"]
        tree_destination = data["tree_evidence_retired_name"]
        if entry_exists(indexes_fd, tree_name):
            fd = os.open(tree_name, FILE_READ_FLAGS, dir_fd=indexes_fd)
            try:
                if not stat.S_ISREG(os.fstat(fd).st_mode) or not matches_fd(fd, data["tree_evidence_identity"]): fail("tree evidence incarnation changed")
                if hashlib.sha256(read_fd(fd)).hexdigest() != data["tree_evidence_sha256"]: fail("tree evidence hash changed")
            finally: os.close(fd)
        retired_tree = preserve_entry_named(indexes_fd, tree_name, quarantine_fd, tree_destination)
        fd = os.open(retired_tree, FILE_READ_FLAGS, dir_fd=quarantine_fd)
        try:
            if not matches_fd(fd, data["tree_evidence_identity"]): fail("retired tree evidence incarnation changed")
            if hashlib.sha256(read_fd(fd)).hexdigest() != data["tree_evidence_sha256"]: fail("retired tree evidence hash changed")
        finally: os.close(fd)
        preserved.append(retired_tree)
        for fd in (target_fd, future_fd, consumed_fd, indexes_fd, quarantine_fd): os.fsync(fd)
        return {"consumed_created": consumed_created, "retirement_complete": True, "directory_retained": True, "preserved_quarantines": preserved}
    finally:
        for fd in (target_fd, future_fd, consumed_fd, indexes_fd, quarantine_fd, repo_fd, common_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass

def run_git(args: list[str], *, env: dict[str, str] | None = None, input_bytes: bytes | None = None) -> bytes:
    result = subprocess.run(["git", *args], env=env, input=input_bytes, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode:
        fail(f"git {' '.join(args)} failed ({result.returncode}): {result.stderr.decode(errors='replace').strip()}")
    return result.stdout

def parse_tree(common: str, tree: str) -> dict[str, tuple[str, str, str]]:
    raw = run_git(["--git-dir", common, "ls-tree", "-z", tree])
    result: dict[str, tuple[str, str, str]] = {}
    for record in [part for part in raw.split(b"\0") if part]:
        header, name = record.split(b"\t", 1)
        mode, kind, oid = header.decode().split(" ")
        result[name.decode()] = (mode, kind, oid)
    return result

def write_tree(common: str, entries: dict[str, tuple[str, str, str]]) -> str:
    body = b"".join(
        f"{mode} {kind} {oid}\t{name}".encode() + b"\0"
        for name, (mode, kind, oid) in entries.items()
    )
    return run_git(["--git-dir", common, "mktree", "-z"], input_bytes=body).decode().strip()

def replace_tree_path(common: str, tree: str, parts: list[str], leaf: tuple[str, str, str]) -> str:
    entries = parse_tree(common, tree)
    name = parts[0]
    if len(parts) == 1:
        entries[name] = leaf
    else:
        current = entries.get(name)
        if current is not None and current[1] != "tree": fail(f"tree path component is not a directory: {name}")
        child = current[2] if current is not None else write_tree(common, {})
        updated = replace_tree_path(common, child, parts[1:], leaf)
        entries[name] = ("040000", "tree", updated)
    return write_tree(common, entries)

def build_tree(data: dict[str, Any]) -> dict[str, Any]:
    common = os.path.realpath(data["common_dir"])
    common_fd = open_root(common)
    try: require_identity(common_fd, data.get("common_identity"), "Git common directory")
    finally: os.close(common_fd)
    base_tree = run_git(["--git-dir", common, "rev-parse", f"{data['base_head']}^{{tree}}"] ).decode().strip()
    bundle_entries: dict[str, tuple[str, str, str]] = {}
    for name, content in zip(data["names"], data["contents"]):
        oid = run_git(["--git-dir", common, "hash-object", "-w", "--stdin"], input_bytes=content.encode()).decode().strip()
        bundle_entries[name] = ("100644", "blob", oid)
    bundle_tree = write_tree(common, bundle_entries)
    updated = replace_tree_path(common, base_tree, components(data["target_path"]), ("040000", "tree", bundle_tree))
    return {"tree": updated, "bundle_tree": bundle_tree}

def main() -> None:
    data = json.load(sys.stdin)
    op = data["operation"]
    if op == "create-json": result = durable_json(data["root"], data["path"], data["text"], True, None, data.get("root_identity"), data.get("parent_identity"))
    elif op == "replace-json": result = durable_json(data["root"], data["path"], data["text"], False, data.get("expected_identity"), data.get("root_identity"), data.get("parent_identity"))
    elif op == "read-file": result = read_control(data["root"], data["path"], bool(data.get("allow_missing", False)), data.get("root_identity"), data.get("parent_identity"))
    elif op == "remove-file": result = remove_control(data["root"], data["path"], data["sha256"], data["identity"], data.get("root_identity"), data.get("parent_identity"))
    elif op == "acquire-lock": result = acquire_lock(data["root"], data["path"], data["owner_text"], data.get("root_identity"), data.get("parent_identity"))
    elif op == "validate-lock": result = validate_lock(data["root"], data["path"], data["token"], data["lock_identity"], data["owner_identity"], data["owner_sha256"], data.get("root_identity"), data.get("parent_identity"))
    elif op == "remove-lock": result = remove_lock(data["root"], data["path"], data["token"], data["lock_identity"], data["owner_identity"], data["owner_sha256"], data.get("root_identity"), data.get("parent_identity"))
    elif op == "ensure-directory": result = ensure_directory(data["repo"], data["path"], data.get("root_identity"), data.get("parent_identity"), data.get("expected_identity"))
    elif op == "directory-identity": result = directory_identity(data["path"])
    elif op == "platform-preflight": result = platform_preflight(data["repo"], data["common_dir"])
    elif op == "create-directory": result = create_product_directory(data["repo"], data["path"])
    elif op == "create-file": result = create_product_file(data["repo"], data["path"], data["content"], data["directory_identity"])
    elif op == "snapshot-bundle": result = snapshot_bundle(data["repo"], data["target_path"], data["directory_identity"], data["files"])
    elif op == "remove-bundle": result = remove_bundle(data)
    elif op == "build-tree": result = build_tree(data)
    else: fail(f"unsupported operation: {op}")
    print(json.dumps({"ok": True, **result}, separators=(",", ":")))

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, separators=(",", ":")))
        sys.exit(1)
