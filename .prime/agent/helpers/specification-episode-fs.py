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
import errno
import fcntl
import hashlib
import json
import os
import secrets
import socket
import subprocess
import stat
import sys
import tempfile
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


def strict_json(text: str) -> Any:
    def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                fail(f"duplicate decoded JSON key: {key}")
            result[key] = value
        return result
    try:
        return json.loads(text, object_pairs_hook=unique_object)
    except (ValueError, TypeError) as error:
        fail(f"invalid strict JSON: {error}")


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
            created = False
            try:
                os.mkdir(part, 0o700, dir_fd=fd)
                created_any = True
                created = True
                os.fsync(fd)
            except FileExistsError:
                pass
            nxt = os.open(part, DIR_FLAGS, dir_fd=fd)
            if created: os.fsync(nxt)
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

def durable_json(root: str, rel: str, text: str, create_only: bool, expected_identity: dict[str, Any] | None = None, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None, quarantine_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = quarantine_fd = -1
    temp = f".prime-claw-{secrets.token_hex(16)}.tmp"
    temp_created = False
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "control parent")
        if quarantine_identity is None: quarantine_fd, _ = ensure_path(root_fd, "prime-claw/quarantine")
        else:
            quarantine_fd = descend(root_fd, "prime-claw/quarantine")
            require_identity(quarantine_fd, quarantine_identity, "quarantine directory")
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
                preserve_entry(parent_fd, temp, quarantine_fd, "prior-control")
                temp_created = False
                created = True
        os.fsync(parent_fd)
        if quarantine_fd >= 0: os.fsync(quarantine_fd)
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

def retire_control(root: str, rel: str, expected_sha256: str, expected_identity: dict[str, Any], prefix: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None, quarantine_identity: dict[str, Any] | None = None, retired_name: str | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = quarantine_fd = retired_fd = -1
    destination = retired_name or f"{prefix}-{expected_sha256}-{expected_identity['inode']}"
    moved = False
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "control parent")
        if quarantine_identity is None: quarantine_fd, _ = ensure_path(root_fd, "prime-claw/quarantine")
        else:
            quarantine_fd = descend(root_fd, "prime-claw/quarantine")
            require_identity(quarantine_fd, quarantine_identity, "quarantine directory")
        # A deterministic already-retired object is the authoritative outcome.
        # Reconcile it before consulting the canonical name so a new canonical
        # blocker/control record is never moved or adopted after response loss.
        already_retired = retired_name is not None and entry_exists(quarantine_fd, destination)
        if not already_retired and entry_exists(parent_fd, name):
            if retired_name is None:
                destination = preserve_entry(parent_fd, name, quarantine_fd, prefix)
            else:
                rename_exclusive_between(parent_fd, name, quarantine_fd, destination)
            moved = True
            os.fsync(parent_fd)
            os.fsync(quarantine_fd)
        if not entry_exists(quarantine_fd, destination):
            fail(f"control retirement evidence is missing: {destination}")
        try:
            retired_fd = os.open(destination, FILE_READ_FLAGS, dir_fd=quarantine_fd)
            if not stat.S_ISREG(os.fstat(retired_fd).st_mode): fail("retired control state is not regular")
            if not matches_fd(retired_fd, expected_identity): fail("retired control state incarnation changed")
            if hashlib.sha256(read_fd(retired_fd)).hexdigest() != expected_sha256: fail("retired control state hash changed")
        except Exception as validation_error:
            if retired_fd >= 0:
                os.close(retired_fd)
                retired_fd = -1
            if moved:
                if entry_exists(parent_fd, name):
                    fail(f"control retirement preserved {destination}; public destination is occupied: {validation_error}")
                try:
                    restore_exclusive(quarantine_fd, destination, parent_fd, name)
                    moved = False
                    os.fsync(quarantine_fd)
                    os.fsync(parent_fd)
                except Exception as restore_error:
                    fail(f"control retirement preserved {destination}; no-clobber restoration failed: {restore_error}")
            raise
        os.fsync(parent_fd)
        os.fsync(quarantine_fd)
        return {"removed": True, "reconciled": not moved, "preserved_quarantine": destination}
    finally:
        for fd in (retired_fd, quarantine_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def remove_control(root: str, rel: str, expected_sha256: str, expected_identity: dict[str, Any], root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None, quarantine_identity: dict[str, Any] | None = None, retired_name: str | None = None) -> dict[str, Any]:
    return retire_control(root, rel, expected_sha256, expected_identity, "control", root_identity, parent_identity, quarantine_identity, retired_name)



def broker_request(path: str, token: str, command: str) -> bool:
    try:
        client = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        client.settimeout(2.0); client.connect(path)
        client.sendall((json.dumps({"token": token, "command": command}) + "\n").encode("utf-8"))
        response = b""
        while not response.endswith(b"\n"):
            chunk = client.recv(4096)
            if not chunk: break
            response += chunk
        client.close()
        parsed = strict_json(response.decode("utf-8"))
        return parsed.get("ok") is True
    except Exception:
        return False


def lock_broker_path(root: str, token: str, role: str = "primary") -> str:
    digest = hashlib.sha256((root + "\0" + token + "\0" + role).encode("utf-8")).hexdigest()[:32]
    base = tempfile.gettempdir()
    path = os.path.join(base, f"prime-claw-lock-{digest}.sock")
    if len(path.encode("utf-8")) >= 100: path = f"/tmp/prime-claw-lock-{digest}.sock"
    return path


def start_lock_broker(root_fd: int, token: str, root: str, owner_pid: int, role: str = "primary") -> tuple[str, int]:
    path = lock_broker_path(root, token, role)
    server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    try:
        server.bind(path); os.chmod(path, 0o600); server.listen(4); server.settimeout(1.0)
        pid = os.fork()
        if pid == 0:
            try:
                os.setsid()
                keep = {root_fd, server.fileno()}
                for fd in range(0, 256):
                    if fd not in keep:
                        try: os.close(fd)
                        except OSError: pass
                while True:
                    try: os.kill(owner_pid, 0)
                    except ProcessLookupError: break
                    try: connection, _ = server.accept()
                    except socket.timeout: continue
                    try:
                        request = b""
                        while not request.endswith(b"\n"):
                            chunk = connection.recv(4096)
                            if not chunk: break
                            request += chunk
                        parsed = strict_json(request.decode("utf-8"))
                        valid = parsed.get("token") == token and parsed.get("command") in ("ping", "release")
                        connection.sendall((json.dumps({"ok": valid}) + "\n").encode("utf-8"))
                        if valid and parsed.get("command") == "release": break
                    except Exception:
                        try: connection.sendall(b'{"ok":false}\n')
                        except Exception: pass
                    finally: connection.close()
            finally:
                try: os.unlink(path)
                except OSError: pass
                # Close-on-exit releases only this inherited descriptor copy;
                # replicated supervisors sharing the original open-file
                # description retain authority until the last copy exits.
                try: os.close(root_fd)
                except OSError: pass
                os._exit(0)
        server.close()
        if not broker_request(path, token, "ping"): fail("project exclusion broker did not become ready")
        return path, pid
    except Exception:
        server.close()
        try: os.unlink(path)
        except OSError: pass
        raise


def require_lock_broker(path: str, token: str) -> None:
    if not broker_request(path, token, "ping"): fail("project exclusion broker authority is unavailable")


def require_replicated_lock_authority(primary: str, authority: str, token: str) -> None:
    if not (broker_request(primary, token, "ping") or broker_request(authority, token, "ping")):
        fail("replicated project exclusion authority is unavailable")


def acquire_lock(root: str, rel: str, owner_text: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None, quarantine_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = temp_fd = published_fd = guard_fd = -1
    temporary = f".prime-claw-lock-create-{secrets.token_hex(16)}"
    try:
        require_identity(root_fd, root_identity, "control root")
        try: fcntl.flock(root_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: return {"created": False}
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "lock parent")
        guard_name = f"{name}.guard"
        if entry_exists(parent_fd, name): return {"created": False}
        try:
            guard_fd = os.open(guard_name, os.O_RDWR | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=parent_fd)
        except FileExistsError:
            return {"created": False}
        data = owner_text.encode("utf-8")
        view = memoryview(data)
        while view: view = view[os.write(guard_fd, view):]
        os.fsync(guard_fd)
        guard_identity = identity_fd(guard_fd)
        os.fsync(parent_fd)
        os.mkdir(temporary, 0o700, dir_fd=parent_fd)
        temp_fd = os.open(temporary, DIR_FLAGS, dir_fd=parent_fd)
        owner_fd = os.open("owner.json", os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=temp_fd)
        try:
            view = memoryview(data)
            while view: view = view[os.write(owner_fd, view):]
            os.fsync(owner_fd)
            owner_identity = identity_fd(owner_fd)
        finally:
            os.close(owner_fd)
        os.fsync(temp_fd)
        temp_identity = identity_fd(temp_fd)
        rename_exclusive(parent_fd, temporary, name)
        os.fsync(parent_fd)
        parsed_owner = strict_json(owner_text); token = parsed_owner.get("token"); owner_pid = parsed_owner.get("pid")
        if not isinstance(token, str) or not isinstance(owner_pid, int) or owner_pid <= 0: fail("lock owner token/pid is invalid")
        broker_socket, broker_pid = start_lock_broker(root_fd, token, root, owner_pid, "primary")
        try: authority_socket, authority_pid = start_lock_broker(root_fd, token, root, owner_pid, "authority")
        except Exception:
            broker_request(broker_socket, token, "release")
            raise
        published_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        if not matches_fd(published_fd, temp_identity): fail("published lock incarnation changed")
        owner_fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=published_fd)
        try:
            if not matches_fd(owner_fd, owner_identity): fail("published lock owner incarnation changed")
            if read_fd(owner_fd) != data: fail("published lock owner changed")
        finally: os.close(owner_fd)
        os.fsync(parent_fd)
        return {"created": True, "lock_identity": temp_identity, "owner_identity": owner_identity, "guard_identity": guard_identity, "owner_sha256": hashlib.sha256(data).hexdigest(), "broker_socket": broker_socket, "broker_pid": broker_pid, "authority_socket": authority_socket, "authority_pid": authority_pid}
    except Exception:
        # The durable guard remains canonical serialization authority. The caller
        # reconciles its exact token and either publishes a usable handle or
        # retires only that exact guard+lock state.
        raise
    finally:
        for fd in (guard_fd, published_fd, temp_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def process_alive(pid: int) -> bool:
    try: os.kill(pid, 0); return True
    except ProcessLookupError: return False
    except PermissionError: return True


def reconcile_lock(root: str, rel: str, token: str, owner_sha256: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None, allow_inactive: bool = False) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = lock_fd = owner_fd = guard_fd = -1
    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "lock parent")
        guard_name = f"{name}.guard"
        try: guard_fd = os.open(guard_name, FILE_READ_FLAGS, dir_fd=parent_fd)
        except FileNotFoundError: return {"exists": False}
        guard_bytes = read_fd(guard_fd)
        if hashlib.sha256(guard_bytes).hexdigest() != owner_sha256: fail("lock guard bytes do not match acquisition intent")
        if strict_json(guard_bytes.decode("utf-8")).get("token") != token: fail("lock guard token does not match acquisition intent")
        try: lock_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        except FileNotFoundError:
            return {"exists": True, "complete": False, "guard_identity": identity_fd(guard_fd), "owner_sha256": owner_sha256}
        if sorted(os.listdir(lock_fd)) != ["owner.json"]: fail("lock directory contains unexpected entries")
        owner_fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=lock_fd)
        owner_bytes = read_fd(owner_fd)
        if owner_bytes != guard_bytes: fail("lock owner and stable guard disagree")
        broker_socket = lock_broker_path(root, token, "primary"); authority_socket = lock_broker_path(root, token, "authority")
        primary_live = broker_request(broker_socket, token, "ping"); authority_live = broker_request(authority_socket, token, "ping")
        abandoned = False
        if not (primary_live and authority_live):
            parsed_owner = strict_json(owner_bytes.decode("utf-8")); pid = parsed_owner.get("pid")
            if not allow_inactive or primary_live or authority_live or not isinstance(pid, int) or process_alive(pid):
                fail("complete lock does not have its full live replicated authority")
            abandoned = True
        return {"exists": True, "complete": True, "abandoned": abandoned, "lock_identity": identity_fd(lock_fd), "owner_identity": identity_fd(owner_fd), "guard_identity": identity_fd(guard_fd), "owner_sha256": owner_sha256, "broker_socket": broker_socket, "authority_socket": authority_socket}
    finally:
        for fd in (guard_fd, owner_fd, lock_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def validate_lock(root: str, rel: str, token: str, lock_identity: dict[str, Any], owner_identity: dict[str, Any], guard_identity: dict[str, Any], owner_sha256: str, broker_socket: str, authority_socket: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = lock_fd = guard_fd = -1
    try:
        require_replicated_lock_authority(broker_socket, authority_socket, token)
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        require_identity(parent_fd, parent_identity, "lock parent")
        guard_fd = os.open(f"{name}.guard", FILE_READ_FLAGS, dir_fd=parent_fd)
        if not matches_fd(guard_fd, guard_identity): fail("stable lock guard incarnation changed")
        guard_bytes = read_fd(guard_fd)
        if hashlib.sha256(guard_bytes).hexdigest() != owner_sha256: fail("stable lock guard bytes changed")
        if strict_json(guard_bytes.decode("utf-8")).get("token") != token: fail("stable lock guard token changed")
        lock_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        if not matches_fd(lock_fd, lock_identity): fail("lock incarnation changed")
        if sorted(os.listdir(lock_fd)) != ["owner.json"]: fail("lock directory contains unexpected entries")
        owner_fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=lock_fd)
        try:
            if not matches_fd(owner_fd, owner_identity): fail("lock owner incarnation changed")
            owner_bytes = read_fd(owner_fd)
        finally: os.close(owner_fd)
        if owner_bytes != guard_bytes: fail("lock owner and stable guard disagree")
        require_replicated_lock_authority(broker_socket, authority_socket, token)
        return {"valid": True}
    finally:
        for fd in (guard_fd, lock_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def remove_lock(root: str, rel: str, token: str, lock_identity: dict[str, Any], owner_identity: dict[str, Any], guard_identity: dict[str, Any], owner_sha256: str, broker_socket: str, authority_socket: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None, quarantine_identity: dict[str, Any] | None = None, recover_abandoned: bool = False) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = quarantine_fd = -1
    lock_destination = f"released-lock-{owner_sha256[:16]}-{lock_identity['inode']}"
    guard_destination = f"released-lock-guard-{owner_sha256[:16]}-{guard_identity['inode']}"
    lock_moved = guard_moved = retirement_complete = False

    def validate_lock_directory(container_fd: int, name: str) -> None:
        fd = os.open(name, DIR_FLAGS, dir_fd=container_fd)
        try:
            if not matches_fd(fd, lock_identity): fail("lock incarnation changed before release")
            if sorted(os.listdir(fd)) != ["owner.json"]: fail("lock directory contains unexpected entries")
            owner_fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=fd)
            try:
                if not matches_fd(owner_fd, owner_identity): fail("lock owner incarnation changed before release")
                owner_bytes = read_fd(owner_fd)
            finally: os.close(owner_fd)
            if hashlib.sha256(owner_bytes).hexdigest() != owner_sha256: fail("lock owner bytes changed before release")
            if strict_json(owner_bytes.decode("utf-8")).get("token") != token: fail("lock token changed before release")
        finally: os.close(fd)

    def validate_guard(container_fd: int, name: str) -> None:
        fd = os.open(name, FILE_READ_FLAGS, dir_fd=container_fd)
        try:
            if not matches_fd(fd, guard_identity): fail("stable lock guard incarnation changed before release")
            guard_bytes = read_fd(fd)
            if hashlib.sha256(guard_bytes).hexdigest() != owner_sha256: fail("stable lock guard bytes changed before release")
            if strict_json(guard_bytes.decode("utf-8")).get("token") != token: fail("stable lock guard token changed before release")
        finally: os.close(fd)

    try:
        require_identity(root_fd, root_identity, "control root")
        parent_fd, name = open_parent(root_fd, rel)
        guard_name = f"{name}.guard"
        require_identity(parent_fd, parent_identity, "lock parent")
        if quarantine_identity is None: quarantine_fd, _ = ensure_path(root_fd, "prime-claw/quarantine")
        else:
            quarantine_fd = descend(root_fd, "prime-claw/quarantine")
            require_identity(quarantine_fd, quarantine_identity, "quarantine directory")

        destinations_complete = entry_exists(quarantine_fd, lock_destination) and entry_exists(quarantine_fd, guard_destination)
        primary_present = broker_request(broker_socket, token, "ping"); authority_present = broker_request(authority_socket, token, "ping")
        if not destinations_complete and not (primary_present or authority_present):
            if not recover_abandoned: fail("project exclusion broker authority is unavailable")
            validate_lock_directory(parent_fd, name)
            lock_check = os.open(name, DIR_FLAGS, dir_fd=parent_fd); owner_check = -1
            try:
                owner_check = os.open("owner.json", FILE_READ_FLAGS, dir_fd=lock_check)
                parsed_owner = strict_json(read_fd(owner_check).decode("utf-8")); pid = parsed_owner.get("pid")
                if not isinstance(pid, int) or process_alive(pid): fail("abandoned-lock recovery owner is still live or invalid")
            finally:
                if owner_check >= 0: os.close(owner_check)
                os.close(lock_check)
        if entry_exists(quarantine_fd, lock_destination):
            validate_lock_directory(quarantine_fd, lock_destination)
        else:
            validate_lock_directory(parent_fd, name)
            rename_exclusive_between(parent_fd, name, quarantine_fd, lock_destination)
            lock_moved = True
            os.fsync(parent_fd); os.fsync(quarantine_fd)
            try: validate_lock_directory(quarantine_fd, lock_destination)
            except Exception:
                if not entry_exists(parent_fd, name): restore_exclusive(quarantine_fd, lock_destination, parent_fd, name)
                lock_moved = False; os.fsync(quarantine_fd); os.fsync(parent_fd); raise

        if entry_exists(quarantine_fd, guard_destination):
            validate_guard(quarantine_fd, guard_destination)
        else:
            validate_guard(parent_fd, guard_name)
            rename_exclusive_between(parent_fd, guard_name, quarantine_fd, guard_destination)
            guard_moved = True
            os.fsync(parent_fd); os.fsync(quarantine_fd)
            try: validate_guard(quarantine_fd, guard_destination)
            except Exception:
                if not entry_exists(parent_fd, guard_name): restore_exclusive(quarantine_fd, guard_destination, parent_fd, guard_name)
                guard_moved = False; os.fsync(quarantine_fd); os.fsync(parent_fd); raise

        os.fsync(parent_fd); os.fsync(quarantine_fd)
        retirement_complete = True
        primary_released = not primary_present or broker_request(broker_socket, token, "release") or not broker_request(broker_socket, token, "ping")
        authority_released = not authority_present or broker_request(authority_socket, token, "release") or not broker_request(authority_socket, token, "ping")
        if not (primary_released and authority_released): fail("project exclusion supervisors did not acknowledge release; deterministic retirement is complete")
        return {"removed": True, "reconciled": not lock_moved and not guard_moved, "preserved_quarantine": lock_destination, "preserved_guard": guard_destination}
    except Exception:
        # Roll back only transitions performed by this response. A retry after a
        # completed response-loss observes both deterministic destinations and
        # returns success without touching a replacement canonical lock.
        if not retirement_complete and guard_moved and not entry_exists(parent_fd, guard_name):
            try: restore_exclusive(quarantine_fd, guard_destination, parent_fd, guard_name); guard_moved = False
            except Exception as error: fail(f"lock guard retirement failed and restoration preserved {guard_destination}: {error}")
        if not retirement_complete and lock_moved and not entry_exists(parent_fd, name):
            try: restore_exclusive(quarantine_fd, lock_destination, parent_fd, name); lock_moved = False
            except Exception as error: fail(f"lock retirement failed and restoration preserved {lock_destination}: {error}")
        if quarantine_fd >= 0: os.fsync(quarantine_fd); os.fsync(parent_fd)
        raise
    finally:
        for fd in (quarantine_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


def ensure_directory(repo: str, rel: str, root_identity: dict[str, Any] | None = None, parent_identity: dict[str, Any] | None = None, expected_identity: dict[str, Any] | None = None) -> dict[str, Any]:
    root_fd = open_root(repo)
    parent_fd = fd = -1
    retained_directory = None
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
                try:
                    staged_identity = identity_fd(staged_fd)
                    try:
                        rename_exclusive(parent_fd, temporary, name)
                    except FileExistsError:
                        # A concurrent creator won publication. Bind its real
                        # directory, but retain this call's private staging
                        # allocation: POSIX has no rmdir-by-fd operation, so a
                        # checked pathname can never authorize later cleanup.
                        fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
                        if os.listdir(staged_fd): fail("private directory staging allocation is not empty")
                        staged_name_fd = os.open(temporary, DIR_FLAGS, dir_fd=parent_fd)
                        try:
                            if not matches_fd(staged_name_fd, staged_identity):
                                fail(f"private directory staging name was replaced; retained {temporary}")
                        finally:
                            os.close(staged_name_fd)
                        retained_directory = "/".join((*components(rel)[:-1], temporary))
                        created = False
                    else:
                        fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
                        if not matches_fd(fd, staged_identity): fail("published directory incarnation changed")
                        os.fsync(fd)
                        os.fsync(parent_fd)
                        created = True
                finally: os.close(staged_fd)
        require_identity(fd, expected_identity, "directory")
        result = {"created": created, "identity": identity_fd(fd)}
        if retained_directory is not None: result["retained_directory"] = retained_directory
        return result
    finally:
        for item in (fd, parent_fd, root_fd):
            if item >= 0:
                try: os.close(item)
                except OSError: pass


def directory_identity(path: str) -> dict[str, Any]:
    fd = open_root(path)
    try: return {"identity": identity_fd(fd)}
    finally: os.close(fd)

def open_nearest_directory(path: str) -> tuple[int, str]:
    absolute = os.path.abspath(path)
    fd = os.open(os.path.sep, DIR_FLAGS)
    bound = os.path.sep
    try:
        parts = [part for part in absolute.split(os.path.sep) if part]
        if any(part in (".", "..") or "\x00" in part for part in parts): fail("unsafe absolute preflight path")
        for part in parts:
            try: nxt = os.open(part, DIR_FLAGS, dir_fd=fd)
            except FileNotFoundError: return fd, bound
            os.close(fd); fd = nxt; bound = os.path.join(bound, part)
        return fd, bound
    except Exception:
        os.close(fd); raise


def platform_preflight(repo: str, common_dir: str, target_rel: str | None = None, require_retirement: bool = False, quarantine_dir: str | None = None, anchor_dir: str | None = None) -> dict[str, Any]:
    repo_fd = open_root(repo)
    common_fd = open_root(common_dir)
    target_fd = quarantine_fd = anchor_fd = probe_fd = -1
    probe_name = probe_retired = probe_anchor = None
    moved_to_quarantine = linked_to_product = anchor_created = False
    try:
        repo_identity = identity_fd(repo_fd); common_identity = identity_fd(common_fd)
        target_fd = os.dup(repo_fd); target_bound = os.path.abspath(repo)
        if target_rel is not None:
            for part in components(target_rel):
                try: nxt = os.open(part, DIR_FLAGS, dir_fd=target_fd)
                except FileNotFoundError: break
                except OSError as error:
                    if error.errno in (errno.ENOTDIR, errno.ELOOP): break
                    raise
                os.close(target_fd); target_fd = nxt; target_bound = os.path.join(target_bound, part)
        target_identity = identity_fd(target_fd)
        quarantine_identity = common_identity; anchor_identity = common_identity
        if require_retirement:
            if not quarantine_dir or not anchor_dir: fail("retirement topology requires actual quarantine and anchor directories")
            quarantine_fd, quarantine_bound = open_nearest_directory(quarantine_dir)
            anchor_fd, anchor_bound = open_nearest_directory(anchor_dir)
            quarantine_identity = identity_fd(quarantine_fd); anchor_identity = identity_fd(anchor_fd)
            mount = (target_identity["device"], target_identity.get("mount_id"))
            if any((candidate["device"], candidate.get("mount_id")) != mount for candidate in (quarantine_identity, anchor_identity)):
                fail("unsupported retirement topology: product, quarantine, and allocation anchors are not on one mount")
            libc = ctypes.CDLL(None, use_errno=True)
            if not ((sys.platform == "darwin" and hasattr(libc, "renameatx_np")) or hasattr(libc, "renameat2")):
                fail("unsupported retirement topology: exclusive descriptor-relative rename is unavailable")
            # Exercise production directions on allocation-bound names:
            # anchor -> product namespace, then product -> quarantine. The exact
            # anchor and retired witness are retained because pathname cleanup
            # cannot be object-bound on supported POSIX platforms.
            token = secrets.token_hex(16)
            probe_name = f"capability-probe-{token}"; probe_anchor = f"preflight-anchor-{token}"; probe_retired = f"preflight-retired-{token}"
            probe_content = b"prime-claw-retirement-capability-v1\n"
            try:
                probe_fd = os.open(probe_anchor, os.O_RDWR | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=anchor_fd); anchor_created = True
                os.write(probe_fd, probe_content); os.fsync(probe_fd); os.fsync(anchor_fd)
                # Exercise the actual target directory directly. A disposable
                # subdirectory would itself require an unsafe checked-name rmdir.
                os.link(probe_anchor, probe_name, src_dir_fd=anchor_fd, dst_dir_fd=target_fd, follow_symlinks=False); linked_to_product = True; os.fsync(target_fd)
                rename_exclusive_between(target_fd, probe_name, quarantine_fd, probe_retired); linked_to_product = False; moved_to_quarantine = True
                os.fsync(target_fd); os.fsync(quarantine_fd)
                retired_fd = os.open(probe_retired, FILE_READ_FLAGS, dir_fd=quarantine_fd)
                try:
                    if not matches_fd(retired_fd, identity_fd(probe_fd)) or read_fd(retired_fd) != probe_content: fail("retirement capability probe changed allocation or bytes")
                finally: os.close(retired_fd)
            finally:
                def validate_owned_probe(container_fd: int, name: str) -> None:
                    check = os.open(name, FILE_READ_FLAGS, dir_fd=container_fd)
                    try:
                        if not matches_fd(check, identity_fd(probe_fd)) or read_fd(check) != probe_content:
                            fail(f"capability probe name was replaced; retained {name}")
                    finally:
                        os.close(check)
                # Probe allocations are intentionally retained. POSIX unlink and
                # rmdir address names rather than held objects; checking an fd and
                # then deleting by name would recreate ASTRA-10/11. Random names
                # bound growth to one retained allocation set per preflight.
                if moved_to_quarantine: validate_owned_probe(quarantine_fd, probe_retired)
                elif linked_to_product: validate_owned_probe(target_fd, probe_name)
                if anchor_created: validate_owned_probe(anchor_fd, probe_anchor)
                if probe_fd >= 0: os.close(probe_fd); probe_fd = -1
        return {
            "repo_identity": repo_identity,
            "common_identity": common_identity,
            "target_identity": target_identity,
            "quarantine_identity": quarantine_identity,
            "anchor_identity": anchor_identity,
            "retirement_supported": True,
            "retained_probes": ({
                "target_directory": None,
                "anchor": os.path.join(anchor_bound, probe_anchor),
                "retired": os.path.join(quarantine_bound, probe_retired) if moved_to_quarantine else None,
                "product_leaf": os.path.join(target_bound, probe_name) if linked_to_product else None,
            } if anchor_created else None),
        }
    except Exception as error:
        # Every created probe is retained for inspection because cleanup cannot
        # bind a pathname unlink/rmdir to the allocation held before the syscall.
        retained = {
            "target_directory": None,
            "anchor": os.path.join(locals().get("anchor_bound", os.path.abspath(anchor_dir or common_dir)), probe_anchor) if anchor_created else None,
            "retired": os.path.join(locals().get("quarantine_bound", os.path.abspath(quarantine_dir or common_dir)), probe_retired) if moved_to_quarantine else None,
            "product_leaf": os.path.join(locals().get("target_bound", os.path.abspath(repo)), probe_name) if linked_to_product else None,
        }
        fail(f"{error}; retained capability probes: {json.dumps(retained, sort_keys=True)}")
    finally:
        if probe_fd >= 0: os.close(probe_fd)
        for fd in (anchor_fd, quarantine_fd, target_fd, common_fd, repo_fd):
            if fd >= 0: os.close(fd)

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
        os.fsync(published_fd)
        os.fsync(parent_fd)
        return {"identity": created_identity}
    finally:
        # Failed exclusive-create directories are retained; never race an rmdir.
        for item in (published_fd, fd, parent_fd, root_fd):
            if item >= 0:
                try: os.close(item)
                except OSError: pass

def create_product_file(data: dict[str, Any]) -> dict[str, Any]:
    repo_fd = open_root(data["repo"])
    common_fd = open_root(data["common_dir"])
    parent_fd = anchor_parent_fd = anchor_fd = published_fd = -1
    try:
        require_identity(common_fd, data.get("common_identity"), "Git common directory")
        parent_fd, name = open_parent(repo_fd, data["path"])
        if not matches_fd(parent_fd, data["directory_identity"]): fail("owned directory identity changed before file creation")
        anchor_parent_fd, anchor_name = open_parent(common_fd, data["anchor_path"])
        require_identity(anchor_parent_fd, data.get("anchor_parent_identity"), "file anchor directory")
        anchor_fd = os.open(anchor_name, os.O_RDWR | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=anchor_parent_fd)
        content = data["content"].encode("utf-8")
        view = memoryview(content)
        while view: view = view[os.write(anchor_fd, view):]
        os.fsync(anchor_fd)
        anchor_identity = identity_fd(anchor_fd)
        os.link(anchor_name, name, src_dir_fd=anchor_parent_fd, dst_dir_fd=parent_fd, follow_symlinks=False)
        os.fsync(anchor_parent_fd)
        os.fsync(parent_fd)
        published_fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
        if not os.path.samestat(os.fstat(published_fd), os.fstat(anchor_fd)):
            fail("published product file is not the protected anchor allocation")
        if read_fd(published_fd) != content: fail("published product file content changed")
        return {"identity": identity_fd(published_fd), "anchor_identity": anchor_identity}
    finally:
        for fd in (published_fd, anchor_fd, anchor_parent_fd, parent_fd, common_fd, repo_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass

def snapshot_bundle(data: dict[str, Any]) -> dict[str, Any]:
    root_fd = open_root(data["repo"])
    common_fd = open_root(data["common_dir"])
    target_fd = anchor_parent_fd = -1
    try:
        require_identity(common_fd, data.get("common_identity"), "Git common directory")
        target_fd = descend(root_fd, data["target_path"])
        if not matches_fd(target_fd, data["directory_identity"]): fail("owned directory identity changed")
        names = sorted(os.listdir(target_fd))
        expected_names = sorted(item["name"] for item in data["files"])
        if names != expected_names: fail("owned bundle entry set changed")
        for item in data["files"]:
            fd = anchor_fd = -1
            try:
                fd = os.open(item["name"], FILE_READ_FLAGS, dir_fd=target_fd)
                anchor_parent_fd, anchor_name = open_parent(common_fd, item["anchor_path"])
                require_identity(anchor_parent_fd, item.get("anchor_parent_identity"), "file anchor directory")
                anchor_fd = os.open(anchor_name, FILE_READ_FLAGS, dir_fd=anchor_parent_fd)
                st = os.fstat(fd)
                if not stat.S_ISREG(st.st_mode): fail(f"owned bundle file is not regular: {item['name']}")
                if not os.path.samestat(st, os.fstat(anchor_fd)): fail(f"owned bundle file is not the protected allocation: {item['name']}")
                if not matches_fd(fd, item["identity"]): fail(f"owned bundle file identity changed: {item['name']}")
                if read_fd(fd).decode("utf-8") != item["content"]: fail(f"owned bundle content changed: {item['name']}")
            finally:
                for child_fd in (anchor_fd, fd, anchor_parent_fd):
                    if child_fd >= 0:
                        try: os.close(child_fd)
                        except OSError: pass
                anchor_parent_fd = -1
        return {"directory_identity": identity_fd(target_fd)}
    finally:
        for fd in (anchor_parent_fd, target_fd, common_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass

def create_json_in_fd(parent_fd: int, name: str, text: str, quarantine_fd: int) -> bool:
    temp = f".prime-claw-{secrets.token_hex(16)}.tmp"
    fd = os.open(temp, os.O_RDWR | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=parent_fd)
    data = text.encode("utf-8")
    try:
        view = memoryview(data)
        while view: view = view[os.write(fd, view):]
        os.fsync(fd)
        staged_identity = identity_fd(fd)
        try:
            os.link(temp, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd, follow_symlinks=False)
            os.fsync(parent_fd)
            published_fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
            try:
                if not os.path.samestat(os.fstat(fd), os.fstat(published_fd)):
                    fail("published consumption manifest is not the staged allocation")
                if not matches_fd(published_fd, staged_identity) or read_fd(published_fd) != data:
                    fail("published consumption manifest changed")
            finally: os.close(published_fd)
            return True
        except FileExistsError:
            return False
    finally:
        os.close(fd)
        # Retire the exact staged object and durably record both namespaces.
        preserve_entry(parent_fd, temp, quarantine_fd, "consumption-temp")
        os.fsync(parent_fd)
        os.fsync(quarantine_fd)


def retire_anchored_file(target_fd: int, quarantine_fd: int, common_fd: int, item: dict[str, Any]) -> str:
    anchor_parent_fd = anchor_fd = retired_fd = -1
    destination = item["retired_name"]
    moved = False
    try:
        anchor_parent_fd, anchor_name = open_parent(common_fd, item["anchor_path"])
        require_identity(anchor_parent_fd, item.get("anchor_parent_identity"), "file anchor directory")
        anchor_fd = os.open(anchor_name, FILE_READ_FLAGS, dir_fd=anchor_parent_fd)
        if not matches_fd(anchor_fd, item["anchor_identity"]): fail(f"file anchor incarnation changed: {item['name']}")
        if read_fd(anchor_fd).decode("utf-8") != item["content"]: fail(f"file anchor content changed: {item['name']}")
        if entry_exists(target_fd, item["name"]):
            rename_exclusive_between(target_fd, item["name"], quarantine_fd, destination)
            moved = True
            os.fsync(target_fd)
            os.fsync(quarantine_fd)
        if not entry_exists(quarantine_fd, destination): fail(f"retirement evidence is missing: {destination}")
        try:
            retired_fd = os.open(destination, FILE_READ_FLAGS, dir_fd=quarantine_fd)
            if not stat.S_ISREG(os.fstat(retired_fd).st_mode): fail(f"retired entry is not a regular file: {item['name']}")
            if not os.path.samestat(os.fstat(retired_fd), os.fstat(anchor_fd)):
                fail(f"retired file is not the protected allocation: {item['name']}")
            if not matches_fd(retired_fd, item["identity"]): fail(f"retired file identity mismatch: {item['name']}")
            if read_fd(retired_fd).decode("utf-8") != item["content"]: fail(f"retired file content changed: {item['name']}")
        except Exception as validation_error:
            if retired_fd >= 0:
                os.close(retired_fd)
                retired_fd = -1
            if moved:
                if entry_exists(target_fd, item["name"]):
                    fail(f"unauthorized replacement retained as {destination}; public destination is occupied: {validation_error}")
                try:
                    restore_exclusive(quarantine_fd, destination, target_fd, item["name"])
                    moved = False
                    os.fsync(quarantine_fd)
                    os.fsync(target_fd)
                except Exception as restore_error:
                    fail(f"unauthorized replacement retained as {destination}; no-clobber restoration failed: {restore_error}")
            raise
        return destination
    finally:
        for fd in (retired_fd, anchor_fd, anchor_parent_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass


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
        tombstone_fd = os.open(data["consumed_name"], FILE_READ_FLAGS, dir_fd=consumed_fd)
        try:
            if read_fd(tombstone_fd).decode("utf-8") != data["tombstone_text"]: fail("consumed retirement manifest changed")
        finally: os.close(tombstone_fd)
        os.fsync(consumed_fd)

        for item in data["files"]:
            retired = retire_anchored_file(target_fd, quarantine_fd, common_fd, item)
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
    if op == "parse-json": result = {"value": strict_json(data["text"])}
    elif op == "create-json": result = durable_json(data["root"], data["path"], data["text"], True, None, data.get("root_identity"), data.get("parent_identity"), data.get("quarantine_identity"))
    elif op == "replace-json": result = durable_json(data["root"], data["path"], data["text"], False, data.get("expected_identity"), data.get("root_identity"), data.get("parent_identity"), data.get("quarantine_identity"))
    elif op == "read-file": result = read_control(data["root"], data["path"], bool(data.get("allow_missing", False)), data.get("root_identity"), data.get("parent_identity"))
    elif op == "remove-file": result = remove_control(data["root"], data["path"], data["sha256"], data["identity"], data.get("root_identity"), data.get("parent_identity"), data.get("quarantine_identity"), data.get("retired_name"))
    elif op == "acquire-lock": result = acquire_lock(data["root"], data["path"], data["owner_text"], data.get("root_identity"), data.get("parent_identity"), data.get("quarantine_identity"))
    elif op == "reconcile-lock": result = reconcile_lock(data["root"], data["path"], data["token"], data["owner_sha256"], data.get("root_identity"), data.get("parent_identity"), bool(data.get("allow_inactive", False)))
    elif op == "validate-lock": result = validate_lock(data["root"], data["path"], data["token"], data["lock_identity"], data["owner_identity"], data["guard_identity"], data["owner_sha256"], data["broker_socket"], data["authority_socket"], data.get("root_identity"), data.get("parent_identity"))
    elif op == "remove-lock": result = remove_lock(data["root"], data["path"], data["token"], data["lock_identity"], data["owner_identity"], data["guard_identity"], data["owner_sha256"], data["broker_socket"], data["authority_socket"], data.get("root_identity"), data.get("parent_identity"), data.get("quarantine_identity"), bool(data.get("recover_abandoned", False)))
    elif op == "ensure-directory": result = ensure_directory(data["repo"], data["path"], data.get("root_identity"), data.get("parent_identity"), data.get("expected_identity"))
    elif op == "directory-identity": result = directory_identity(data["path"])
    elif op == "platform-preflight": result = platform_preflight(data["repo"], data["common_dir"], data.get("target_path"), bool(data.get("require_retirement", False)), data.get("quarantine_dir"), data.get("anchor_dir"))
    elif op == "create-directory": result = create_product_directory(data["repo"], data["path"])
    elif op == "create-file": result = create_product_file(data)
    elif op == "snapshot-bundle": result = snapshot_bundle(data)
    elif op == "remove-bundle": result = remove_bundle(data)
    elif op == "build-tree": result = build_tree(data)
    else: fail(f"unsupported operation: {op}")
    print(json.dumps({"ok": True, **result}, separators=(",", ":")))

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, separators=(",", ":")))
        sys.exit(1)
