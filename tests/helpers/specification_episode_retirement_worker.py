#!/usr/bin/env python3
"""Disposable fresh-process retirement fault worker for ASTRA-17/24 tests."""
import importlib.util
import json
import os
from pathlib import Path
import sys

request = json.load(sys.stdin)
spec = importlib.util.spec_from_file_location("specification_episode_fs_worker", request["helper"])
assert spec and spec.loader
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

moved = False
restored = False
barriers = 0
barrier_trace = []
if request["kind"] == "product":
    namespace_paths = [("public", request["target"]), ("quarantine", request["quarantine"])]
elif request["kind"] == "control":
    namespace_paths = [
        ("public", str(Path(request["root"]) / Path(request["rel"]).parent)),
        ("quarantine", str(Path(request["root"]) / "prime-claw/quarantine")),
    ]
else:
    namespace_paths = [("public", request["source"]), ("quarantine", request["quarantine"])]
real_rename = helper.rename_exclusive_between
real_fsync = helper.os.fsync
real_open = helper.os.open


def substitute(source_fd: int, source: str) -> None:
    replacement = request.get("replacement")
    if replacement == "directory":
        os.rename(source, request.get("owned_name", "owned-original"), src_dir_fd=source_fd, dst_dir_fd=source_fd)
        os.mkdir(source, dir_fd=source_fd)
        directory_fd = os.open(source, os.O_RDONLY | os.O_DIRECTORY, dir_fd=source_fd)
        try:
            sentinel_fd = os.open("sentinel", os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600, dir_fd=directory_fd)
            try: os.write(sentinel_fd, b"unowned-directory")
            finally: os.close(sentinel_fd)
        finally: os.close(directory_fd)
    elif replacement == "dirty-hardlink":
        os.link(source, request.get("dirty_name", "dirty-link"), src_dir_fd=source_fd, dst_dir_fd=source_fd, follow_symlinks=False)
        dirty_fd = os.open(request.get("dirty_name", "dirty-link"), os.O_WRONLY | os.O_TRUNC, dir_fd=source_fd)
        try: os.write(dirty_fd, b"unowned-dirty")
        finally: os.close(dirty_fd)


def renamed(source_fd: int, source: str, target_fd: int, target: str) -> None:
    global moved, restored
    if request.get("substitute_before_rename") and source == request["public_name"]:
        substitute(source_fd, source)
        request["substitute_before_rename"] = False
    real_rename(source_fd, source, target_fd, target)
    if source == request["public_name"] and target == request["retired_name"]:
        moved = True
    if source == request["retired_name"] and target == request["public_name"]:
        restored = True


def fsync(fd: int) -> None:
    global barriers
    fd_stat = os.fstat(fd)
    label = "other"
    for candidate, path in namespace_paths:
        try:
            if os.path.samestat(fd_stat, os.stat(path)): label = candidate
        except FileNotFoundError:
            pass
    barrier_trace.append(label)
    if request.get("trace_path"):
        trace_fd = real_open(request["trace_path"], os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
        try:
            os.write(trace_fd, (label + "\n").encode("utf-8"))
            real_fsync(trace_fd)
        finally:
            os.close(trace_fd)
    active = restored if request.get("fault_stage") == "restore" else moved
    if active:
        barriers += 1
        if request.get("fault_point") == f"barrier-{barriers}":
            os._exit(70 + barriers)
    real_fsync(fd)


def opened(name, flags, *args, **kwargs):
    if moved and request.get("fault_point") == "pre-validation" and name == request["retired_name"]:
        os._exit(73)
    return real_open(name, flags, *args, **kwargs)

helper.rename_exclusive_between = renamed
helper.os.fsync = fsync
helper.os.open = opened

try:
    if request["kind"] == "product":
        target_fd = helper.open_root(request["target"])
        quarantine_fd = helper.open_root(request["quarantine"])
        common_fd = helper.open_root(request["common"])
        try:
            result = helper.retire_anchored_file(target_fd, quarantine_fd, common_fd, request["item"])
        finally:
            for fd in (target_fd, quarantine_fd, common_fd): os.close(fd)
    elif request["kind"] == "control":
        result = helper.retire_control(
            request["root"], request["rel"], request["sha256"], request["identity"],
            request.get("prefix", "control"), retired_name=request["retired_name"],
        )
    elif request["kind"] == "evidence":
        source_fd = helper.open_root(request["source"])
        quarantine_fd = helper.open_root(request["quarantine"])
        try:
            result = helper.preserve_entry_named(
                source_fd, request["public_name"], quarantine_fd, request["retired_name"],
                request["identity"], request["sha256"],
            )
        finally:
            os.close(source_fd); os.close(quarantine_fd)
    else:
        raise RuntimeError(f"unknown worker kind: {request['kind']}")
except Exception as error:
    print(json.dumps({"ok": False, "error": str(error), "barrier_trace": barrier_trace}, sort_keys=True))
    sys.exit(1)
print(json.dumps({"ok": True, "result": result, "barrier_trace": barrier_trace}, sort_keys=True))
