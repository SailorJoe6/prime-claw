#!/usr/bin/env python3
"""Bound filesystem primitives for specification-episode transactions.

All security-sensitive operations descend from held directory descriptors with
O_NOFOLLOW. Product-directory identity is a mutation guard, never deletion
authority. Removal holds that directory, quarantines exact receipt-bound files,
then unlinks only their randomized names. JSON uses stdin/stdout; no secrets are read.
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


def rename_exclusive(parent_fd: int, source: str, target: str) -> None:
    """Atomically publish source as target without replacing an existing entry."""
    libc = ctypes.CDLL(None, use_errno=True)
    source_b = os.fsencode(source)
    target_b = os.fsencode(target)
    if sys.platform == "darwin" and hasattr(libc, "renameatx_np"):
        result = libc.renameatx_np(parent_fd, source_b, parent_fd, target_b, 0x00000004)
    elif hasattr(libc, "renameat2"):
        result = libc.renameat2(parent_fd, source_b, parent_fd, target_b, 0x00000001)
    else:
        fail("this platform lacks exclusive descriptor-relative rename support")
    if result != 0:
        error_number = ctypes.get_errno()
        raise OSError(error_number, os.strerror(error_number), target)

def fail(message: str) -> None:
    raise RuntimeError(message)

def components(value: str) -> list[str]:
    parts = value.split("/")
    if not parts or any(part in ("", ".", "..") for part in parts):
        fail(f"unsafe relative path: {value}")
    return parts

def open_root(path: str) -> int:
    return os.open(os.path.realpath(path), DIR_FLAGS)

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

def identity(st: os.stat_result) -> dict[str, str]:
    birth_ns = getattr(st, "st_birthtime_ns", None)
    if birth_ns is None:
        birth = getattr(st, "st_birthtime", None)
        birth_ns = int(birth * 1_000_000_000) if birth is not None else st.st_ctime_ns
    return {
        "device": str(st.st_dev),
        "inode": str(st.st_ino),
        "birthtime_ns": str(birth_ns),
        "ctime_ns": str(st.st_ctime_ns),
    }

def matches(st: os.stat_result, expected: dict[str, Any], *, ctime: bool = True) -> bool:
    actual = identity(st)
    keys = ("device", "inode", "birthtime_ns") + (("ctime_ns",) if ctime else ())
    return all(actual[key] == str(expected.get(key, "")) for key in keys)

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

def durable_json(root: str, rel: str, text: str, create_only: bool) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = -1
    temp = f".prime-claw-{secrets.token_hex(16)}.tmp"
    try:
        parent_fd, name = open_parent(root_fd, rel)
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=parent_fd)
        try:
            data = text.encode("utf-8")
            view = memoryview(data)
            while view:
                view = view[os.write(fd, view):]
            os.fsync(fd)
        finally:
            os.close(fd)
        if create_only:
            try:
                os.link(temp, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd, follow_symlinks=False)
                created = True
            except FileExistsError:
                created = False
        else:
            os.replace(temp, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
            created = True
        os.fsync(parent_fd)
        return {"created": created}
    finally:
        if parent_fd >= 0:
            try: os.unlink(temp, dir_fd=parent_fd)
            except FileNotFoundError: pass
            os.close(parent_fd)
        os.close(root_fd)

def read_control(root: str, rel: str, allow_missing: bool = False) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = -1
    try:
        parent_fd, name = open_parent(root_fd, rel)
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
            }
        finally: os.close(fd)
    finally:
        if parent_fd >= 0: os.close(parent_fd)
        os.close(root_fd)

def remove_control(root: str, rel: str, expected_sha256: str) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = -1
    quarantine = f".prime-claw-remove-{secrets.token_hex(16)}"
    moved = False
    try:
        parent_fd, name = open_parent(root_fd, rel)
        fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode): fail("control state is not a regular file")
            if hashlib.sha256(read_fd(fd)).hexdigest() != expected_sha256: fail("control state hash changed")
        finally: os.close(fd)
        os.rename(name, quarantine, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
        moved = True
        fd = os.open(quarantine, FILE_READ_FLAGS, dir_fd=parent_fd)
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode): fail("quarantined control state is not regular")
            if hashlib.sha256(read_fd(fd)).hexdigest() != expected_sha256: fail("quarantined control state hash changed")
        finally: os.close(fd)
        os.unlink(quarantine, dir_fd=parent_fd)
        moved = False
        os.fsync(parent_fd)
        return {"removed": True}
    except Exception:
        if moved and not entry_exists(parent_fd, name):
            try: os.rename(quarantine, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
            except Exception: pass
        raise
    finally:
        if parent_fd >= 0: os.close(parent_fd)
        os.close(root_fd)

def remove_index(root: str, rel: str, expected_sha256: str) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = -1
    quarantine = f".prime-claw-index-{secrets.token_hex(16)}"
    moved = False
    try:
        parent_fd, name = open_parent(root_fd, rel)
        try: fd = os.open(name, FILE_READ_FLAGS, dir_fd=parent_fd)
        except FileNotFoundError: return {"removed": False}
        try:
            if not stat.S_ISREG(os.fstat(fd).st_mode): fail("private index is not regular")
            if hashlib.sha256(read_fd(fd)).hexdigest() != expected_sha256: fail("private index hash changed")
        finally: os.close(fd)
        os.rename(name, quarantine, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
        moved = True
        fd = os.open(quarantine, FILE_READ_FLAGS, dir_fd=parent_fd)
        try:
            if hashlib.sha256(read_fd(fd)).hexdigest() != expected_sha256: fail("quarantined private index hash changed")
        finally: os.close(fd)
        os.unlink(quarantine, dir_fd=parent_fd)
        moved = False
        os.fsync(parent_fd)
        return {"removed": True}
    except Exception:
        if moved and not entry_exists(parent_fd, name):
            try: os.rename(quarantine, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
            except Exception: pass
        raise
    finally:
        if parent_fd >= 0: os.close(parent_fd)
        os.close(root_fd)

def create_lock(root: str, rel: str) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = -1
    try:
        parent_fd, name = open_parent(root_fd, rel)
        try:
            os.mkdir(name, 0o700, dir_fd=parent_fd)
            created = True
        except FileExistsError:
            created = False
        os.fsync(parent_fd)
        return {"created": created}
    finally:
        if parent_fd >= 0: os.close(parent_fd)
        os.close(root_fd)

def remove_lock(root: str, rel: str, token: str) -> dict[str, Any]:
    root_fd = open_root(root)
    parent_fd = lock_fd = -1
    quarantine = f".prime-claw-lock-{secrets.token_hex(16)}"
    moved = False
    try:
        parent_fd, name = open_parent(root_fd, rel)
        lock_fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        if sorted(os.listdir(lock_fd)) != ["owner.json"]: fail("lock directory contains unexpected entries")
        fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=lock_fd)
        try: owner = json.loads(read_fd(fd).decode("utf-8"))
        finally: os.close(fd)
        if owner.get("token") != token: fail("lock token changed before release")
        os.rename(name, quarantine, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
        moved = True
        os.close(lock_fd); lock_fd = os.open(quarantine, DIR_FLAGS, dir_fd=parent_fd)
        fd = os.open("owner.json", FILE_READ_FLAGS, dir_fd=lock_fd)
        try: owner = json.loads(read_fd(fd).decode("utf-8"))
        finally: os.close(fd)
        if owner.get("token") != token: fail("quarantined lock token mismatch")
        os.unlink("owner.json", dir_fd=lock_fd)
        os.close(lock_fd); lock_fd = -1
        os.rmdir(quarantine, dir_fd=parent_fd)
        moved = False
        os.fsync(parent_fd)
        return {"removed": True}
    except Exception:
        if moved:
            if not entry_exists(parent_fd, name):
                try: os.rename(quarantine, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
                except Exception: pass
        raise
    finally:
        for fd in (lock_fd, parent_fd, root_fd):
            if fd >= 0:
                try: os.close(fd)
                except OSError: pass

def ensure_directory(repo: str, rel: str) -> dict[str, Any]:
    root_fd = open_root(repo)
    parent_fd = fd = -1
    try:
        parent_fd, name = open_parent(root_fd, rel)
        try:
            os.mkdir(name, 0o700, dir_fd=parent_fd)
            created = True
        except FileExistsError:
            created = False
        fd = os.open(name, DIR_FLAGS, dir_fd=parent_fd)
        return {"created": created, "identity": identity(os.fstat(fd))}
    finally:
        for item in (fd, parent_fd, root_fd):
            if item >= 0:
                try: os.close(item)
                except OSError: pass

def create_product_directory(repo: str, rel: str) -> dict[str, Any]:
    root_fd = open_root(repo)
    parent_fd = -1
    temporary = f".prime-claw-create-{secrets.token_hex(16)}"
    temporary_created = False
    fd = -1
    try:
        parent_fd, name = open_parent(root_fd, rel)
        os.mkdir(temporary, 0o700, dir_fd=parent_fd)
        temporary_created = True
        fd = os.open(temporary, DIR_FLAGS, dir_fd=parent_fd)
        created_identity = identity(os.fstat(fd))
        rename_exclusive(parent_fd, temporary, name)
        temporary_created = False
        return {"identity": created_identity}
    finally:
        if fd >= 0: os.close(fd)
        if temporary_created and parent_fd >= 0:
            try: os.rmdir(temporary, dir_fd=parent_fd)
            except Exception: pass
        if parent_fd >= 0: os.close(parent_fd)
        os.close(root_fd)

def create_product_file(repo: str, rel: str, content: str, directory_identity: dict[str, Any]) -> dict[str, Any]:
    root_fd = open_root(repo)
    parent_fd = -1
    try:
        parent_fd, name = open_parent(root_fd, rel)
        if not matches(os.fstat(parent_fd), directory_identity, ctime=False): fail("owned directory identity changed before file creation")
        fd = os.open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=parent_fd)
        try:
            data = content.encode("utf-8")
            view = memoryview(data)
            while view: view = view[os.write(fd, view):]
            os.fsync(fd)
            return {"identity": identity(os.fstat(fd))}
        finally: os.close(fd)
    finally:
        if parent_fd >= 0: os.close(parent_fd)
        os.close(root_fd)

def snapshot_bundle(repo: str, target_rel: str, directory_identity: dict[str, Any], files: list[dict[str, Any]]) -> dict[str, Any]:
    root_fd = open_root(repo)
    target_fd = -1
    try:
        target_fd = descend(root_fd, target_rel)
        if not matches(os.fstat(target_fd), directory_identity, ctime=False): fail("owned directory identity changed")
        names = sorted(os.listdir(target_fd))
        expected_names = sorted(item["name"] for item in files)
        if names != expected_names: fail("owned bundle entry set changed")
        for item in files:
            fd = os.open(item["name"], FILE_READ_FLAGS, dir_fd=target_fd)
            try:
                st = os.fstat(fd)
                if not stat.S_ISREG(st.st_mode): fail(f"owned bundle file is not regular: {item['name']}")
                if not matches(st, item["identity"]): fail(f"owned bundle file identity changed: {item['name']}")
                if read_fd(fd).decode("utf-8") != item["content"]: fail(f"owned bundle content changed: {item['name']}")
            finally: os.close(fd)
        return {"directory_identity": identity(os.fstat(target_fd))}
    finally:
        if target_fd >= 0: os.close(target_fd)
        os.close(root_fd)

def create_json_in_fd(parent_fd: int, name: str, text: str) -> bool:
    temp = f".prime-claw-{secrets.token_hex(16)}.tmp"
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | O_NOFOLLOW, 0o600, dir_fd=parent_fd)
    try:
        data = text.encode("utf-8")
        view = memoryview(data)
        while view: view = view[os.write(fd, view):]
        os.fsync(fd)
    finally: os.close(fd)
    try:
        os.link(temp, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd, follow_symlinks=False)
        os.fsync(parent_fd)
        return True
    except FileExistsError:
        return False
    finally:
        os.unlink(temp, dir_fd=parent_fd)

def remove_bundle(data: dict[str, Any]) -> dict[str, Any]:
    repo_fd = open_root(data["repo"])
    common_fd = open_root(data["common_dir"])
    future_fd = consumed_fd = indexes_fd = target_fd = -1
    try:
        target_parts = components(data["target_path"])
        future_fd = descend(repo_fd, "/".join(target_parts[:-1]))
        target_name = target_parts[-1]
        consumed_fd = descend(common_fd, "prime-claw/future-ownership-consumed")
        indexes_fd = descend(common_fd, "prime-claw/indexes")
        target_fd = os.open(target_name, DIR_FLAGS, dir_fd=future_fd)
        if not matches(os.fstat(target_fd), data["directory_identity"]): fail("owned directory identity changed before removal")
        expected_names = sorted(item["name"] for item in data["files"])
        if sorted(os.listdir(target_fd)) != expected_names: fail("owned bundle entry set changed before removal")
        # Validate every product file before authority is consumed.
        for item in data["files"]:
            fd = os.open(item["name"], FILE_READ_FLAGS, dir_fd=target_fd)
            try:
                st = os.fstat(fd)
                if not stat.S_ISREG(st.st_mode) or not matches(st, item["identity"]): fail(f"owned file identity changed: {item['name']}")
                if read_fd(fd).decode("utf-8") != item["content"]: fail(f"owned file content changed: {item['name']}")
            finally: os.close(fd)
        # Validate the private index through the held genuine indexes directory.
        index_name = data["index_name"]
        index_exists = True
        try: index_fd = os.open(index_name, FILE_READ_FLAGS, dir_fd=indexes_fd)
        except FileNotFoundError:
            index_exists = False
            index_fd = -1
        if index_exists:
            try:
                if not stat.S_ISREG(os.fstat(index_fd).st_mode): fail("owned private index is not regular")
                if hashlib.sha256(read_fd(index_fd)).hexdigest() != data["index_sha256"]: fail("owned private index hash changed")
            finally: os.close(index_fd)
        # Consume authority in the held genuine control directory before unlink.
        if not create_json_in_fd(consumed_fd, data["consumed_name"], data["tombstone_text"]):
            fail("removal authority for this transaction was already consumed")
        # Keep the product directory. No portable syscall can both create a
        # directory and return its FD atomically, so directory identity never
        # grants destructive authority. Only atomically created file objects are
        # quarantined and unlinked through this already-held directory FD.
        for item in data["files"]:
            quarantine = f".prime-claw-file-{secrets.token_hex(16)}"
            moved = False
            try:
                os.rename(item["name"], quarantine, src_dir_fd=target_fd, dst_dir_fd=target_fd)
                moved = True
                fd = os.open(quarantine, FILE_READ_FLAGS, dir_fd=target_fd)
                try:
                    if not matches(os.fstat(fd), item["identity"], ctime=False): fail(f"quarantined file identity mismatch: {item['name']}")
                    if read_fd(fd).decode("utf-8") != item["content"]: fail(f"quarantined file content changed: {item['name']}")
                finally: os.close(fd)
                os.unlink(quarantine, dir_fd=target_fd)
                moved = False
            except Exception:
                if moved and not entry_exists(target_fd, item["name"]):
                    try: os.rename(quarantine, item["name"], src_dir_fd=target_fd, dst_dir_fd=target_fd)
                    except Exception: pass
                raise
        os.fsync(target_fd)
        if index_exists:
            quarantine = f".prime-claw-index-{secrets.token_hex(16)}"
            os.rename(index_name, quarantine, src_dir_fd=indexes_fd, dst_dir_fd=indexes_fd)
            fd = os.open(quarantine, FILE_READ_FLAGS, dir_fd=indexes_fd)
            try:
                if hashlib.sha256(read_fd(fd)).hexdigest() != data["index_sha256"]: fail("quarantined private index hash changed")
            finally: os.close(fd)
            os.unlink(quarantine, dir_fd=indexes_fd)
        os.fsync(future_fd)
        os.fsync(consumed_fd)
        os.fsync(indexes_fd)
        return {"consumed_created": True, "index_removed": index_exists, "directory_retained": True}
    finally:
        for fd in (target_fd, future_fd, consumed_fd, indexes_fd, repo_fd, common_fd):
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
    base_tree = run_git(["--git-dir", common, "rev-parse", f"{data['base_head']}^{{tree}}"] ).decode().strip()
    bundle_entries: dict[str, tuple[str, str, str]] = {}
    for name, content in zip(data["names"], data["contents"]):
        oid = run_git(["--git-dir", common, "hash-object", "-w", "--stdin"], input_bytes=content.encode()).decode().strip()
        bundle_entries[name] = ("100644", "blob", oid)
    bundle_tree = write_tree(common, bundle_entries)
    updated = replace_tree_path(common, base_tree, components(data["target_path"]), ("040000", "tree", bundle_tree))
    return {"tree": updated, "bundle_tree": bundle_tree}

def build_index(data: dict[str, Any]) -> dict[str, Any]:
    common = os.path.realpath(data["common_dir"])
    repo = os.path.realpath(data["repo"])
    disposition = data["disposition_id"]
    filename = f"{disposition}.index"
    root_fd = open_root(common)
    index_fd = -1
    old_cwd = os.open(".", DIR_FLAGS)
    try:
        index_fd = descend(root_fd, "prime-claw/indexes")
        os.fchdir(index_fd)
        try:
            probe = os.open(filename, FILE_READ_FLAGS, dir_fd=index_fd)
        except FileNotFoundError:
            probe = -1
        if probe >= 0:
            os.close(probe)
            fail("private index already exists at secure build boundary")
        env = dict(os.environ)
        env["GIT_INDEX_FILE"] = filename
        env["GIT_DIR"] = common
        env["GIT_WORK_TREE"] = repo
        prefix: list[str] = []
        run_git(prefix + ["read-tree", data["base_head"]], env=env)
        run_git(prefix + ["add", "--", *[f":(top,literal){p}" for p in data["owned_paths"]]], env=env)
        raw = run_git(prefix + ["ls-files", "--stage", "-z", "--", *[f":(top,literal){p}" for p in data["owned_paths"]]], env=env)
        records = [record for record in raw.split(b"\0") if record]
        entries: list[dict[str, str]] = []
        for record in records:
            header, path = record.split(b"\t", 1)
            mode, oid, stage = header.decode().split(" ")
            entries.append({"mode": mode, "oid": oid, "stage": stage, "path": path.decode()})
        if sorted(e["path"] for e in entries) != sorted(data["owned_paths"]): fail(f"private index path set mismatch: {[e['path'] for e in entries]} expected {data['owned_paths']}")
        expected = dict(zip(data["owned_paths"], data["contents"]))
        for entry in entries:
            if entry["mode"] != "100644" or entry["stage"] != "0": fail(f"unsafe private-index mode: {entry['path']}")
            if run_git(prefix + ["cat-file", "-t", entry["oid"]]).strip() != b"blob": fail("private-index object is not a blob")
            if run_git(prefix + ["cat-file", "blob", entry["oid"]]).decode() != expected[entry["path"]]: fail("private-index content mismatch")
        tree = run_git(prefix + ["write-tree"], env=env).decode().strip()
        fd = os.open(filename, FILE_READ_FLAGS, dir_fd=index_fd)
        try: digest = hashlib.sha256(read_fd(fd)).hexdigest()
        finally: os.close(fd)
        return {"tree": tree, "index_sha256": digest, "entries": entries}
    finally:
        os.fchdir(old_cwd)
        os.close(old_cwd)
        if index_fd >= 0: os.close(index_fd)
        os.close(root_fd)

def main() -> None:
    data = json.load(sys.stdin)
    op = data["operation"]
    if op == "create-json": result = durable_json(data["root"], data["path"], data["text"], True)
    elif op == "replace-json": result = durable_json(data["root"], data["path"], data["text"], False)
    elif op == "read-file": result = read_control(data["root"], data["path"], bool(data.get("allow_missing", False)))
    elif op == "remove-file": result = remove_control(data["root"], data["path"], data["sha256"])
    elif op == "remove-index": result = remove_index(data["root"], data["path"], data["sha256"])
    elif op == "create-lock": result = create_lock(data["root"], data["path"])
    elif op == "remove-lock": result = remove_lock(data["root"], data["path"], data["token"])
    elif op == "ensure-directory": result = ensure_directory(data["repo"], data["path"])
    elif op == "create-directory": result = create_product_directory(data["repo"], data["path"])
    elif op == "create-file": result = create_product_file(data["repo"], data["path"], data["content"], data["directory_identity"])
    elif op == "snapshot-bundle": result = snapshot_bundle(data["repo"], data["target_path"], data["directory_identity"], data["files"])
    elif op == "remove-bundle": result = remove_bundle(data)
    elif op == "build-index": result = build_index(data)
    elif op == "build-tree": result = build_tree(data)
    else: fail(f"unsupported operation: {op}")
    print(json.dumps({"ok": True, **result}, separators=(",", ":")))

if __name__ == "__main__":
    try: main()
    except Exception as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, separators=(",", ":")))
        sys.exit(1)
