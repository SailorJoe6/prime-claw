#!/usr/bin/env python3
"""Install prime-claw's managed APPEND_SYSTEM block transactionally."""

import argparse
import fcntl
import os
from pathlib import Path
import secrets
import stat
import sys

START = b"<!-- prime-claw:conversation-identity:start -->"
END = b"<!-- prime-claw:conversation-identity:end -->"
LOCK_NAME = ".prime-claw-append-system.lock"


def managed_range(text: bytes, description: str) -> tuple[int, int] | None:
    """Return the sole complete managed range, rejecting every malformed shape."""
    tokens: list[tuple[int, bytes]] = []
    offset = 0
    while True:
        start = text.find(START, offset)
        end = text.find(END, offset)
        positions = [(position, token) for position, token in ((start, START), (end, END)) if position >= 0]
        if not positions:
            break
        position, token = min(positions, key=lambda item: item[0])
        tokens.append((position, token))
        offset = position + len(token)

    if not tokens:
        return None
    if len(tokens) != 2:
        if sum(token == START for _, token in tokens) > 1 or sum(token == END for _, token in tokens) > 1:
            raise ValueError(f"{description} has duplicate prime-claw identity blocks (including overlap)")
        raise ValueError(f"{description} has incomplete prime-claw identity markers")
    (start_at, first), (end_at, second) = tokens
    if first != START or second != END:
        raise ValueError(f"{description} has reversed prime-claw identity markers")
    return start_at, end_at + len(END)


def load_block(path: Path) -> bytes:
    text = path.read_bytes().strip()
    try:
        selected = managed_range(text, f"managed APPEND_SYSTEM source {path}")
    except ValueError:
        raise
    if selected is None or selected != (0, len(text)):
        raise ValueError(f"managed APPEND_SYSTEM source is malformed: {path}")
    return text


def open_parent(destination: Path) -> int:
    parent = destination.parent
    try:
        info = parent.lstat()
    except FileNotFoundError:
        parent.mkdir(parents=True, exist_ok=True)
        info = parent.lstat()
    if stat.S_ISLNK(info.st_mode):
        raise ValueError(f"unsafe APPEND_SYSTEM parent symlink: {parent}")
    if not stat.S_ISDIR(info.st_mode):
        raise ValueError(f"APPEND_SYSTEM parent is not a directory: {parent}")
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0) | getattr(os, "O_NOFOLLOW", 0)
    return os.open(parent, flags)


def read_destination(parent_fd: int, name: str) -> tuple[bytes, int | None]:
    try:
        info = os.stat(name, dir_fd=parent_fd, follow_symlinks=False)
    except FileNotFoundError:
        return b"", None
    if stat.S_ISLNK(info.st_mode):
        raise ValueError(f"unsafe APPEND_SYSTEM destination symlink: {name}")
    if not stat.S_ISREG(info.st_mode):
        raise ValueError(f"APPEND_SYSTEM destination is not a regular file: {name}")
    flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(name, flags, dir_fd=parent_fd)
    with os.fdopen(fd, "rb") as stream:
        return stream.read(), stat.S_IMODE(info.st_mode)


def atomic_write(parent_fd: int, name: str, content: bytes, mode: int | None) -> None:
    temp_name = f".{name}.prime-claw-{os.getpid()}-{secrets.token_hex(8)}.tmp"
    flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(temp_name, flags, 0o600, dir_fd=parent_fd)
    try:
        stream_fd, fd = fd, -1
        with os.fdopen(stream_fd, "wb") as stream:
            stream.write(content)
            os.fchmod(stream.fileno(), mode if mode is not None else 0o644)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_name, name, src_dir_fd=parent_fd, dst_dir_fd=parent_fd)
        os.fsync(parent_fd)
    finally:
        if fd >= 0:
            os.close(fd)
        try:
            os.unlink(temp_name, dir_fd=parent_fd)
        except FileNotFoundError:
            pass


def update(existing: bytes, selected: tuple[int, int] | None, block: bytes) -> bytes:
    if selected is not None:
        start, end = selected
        return existing[:start] + block + existing[end:]
    if not existing:
        return block + b"\n"
    separator = b"\n" if existing.endswith(b"\n") else b"\n\n"
    return existing + separator + block + b"\n"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["apply", "check", "validate"])
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    args = parser.parse_args()
    try:
        block = load_block(args.source)
        parent_fd = open_parent(args.destination)
        try:
            lock_flags = os.O_RDWR | os.O_CREAT | getattr(os, "O_NOFOLLOW", 0)
            lock_fd = os.open(LOCK_NAME, lock_flags, 0o600, dir_fd=parent_fd)
            try:
                fcntl.flock(lock_fd, fcntl.LOCK_EX)
                existing, mode = read_destination(parent_fd, args.destination.name)
                selected = managed_range(existing, "installed APPEND_SYSTEM")
                if args.mode == "validate":
                    return 0
                if args.mode == "check":
                    if selected is None:
                        print(f"missing managed identity block: {args.destination}", file=sys.stderr)
                        return 1
                    start, end = selected
                    if existing[start:end] != block:
                        print(f"stale managed identity block: {args.destination}", file=sys.stderr)
                        return 1
                    return 0
                updated = update(existing, selected, block)
                if updated != existing:
                    atomic_write(parent_fd, args.destination.name, updated, mode)
                return 0
            finally:
                os.close(lock_fd)
        finally:
            os.close(parent_fd)
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
