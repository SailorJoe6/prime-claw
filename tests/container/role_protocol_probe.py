#!/usr/bin/env python3
"""Self-verifying Linux fixture scenarios for the role-protocol manager."""

import base64
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import time

MANAGER, CONFIG, KERNEL, LEGACY, WORK, SCENARIO = sys.argv[1:]
WORK = Path(WORK)
KERNEL_BYTES = Path(KERNEL).read_bytes()
LEGACY_BYTES = Path(LEGACY).read_bytes().rstrip(b"\n")
START = b"<!-- prime-claw:role-kernel:start -->"
END = b"<!-- prime-claw:role-kernel:end -->"


def run(mode, root, *extra, ok=True):
    if mode == "restore":
        argv = [sys.executable, MANAGER, "restore", str(extra[0]), str(root)]
    else:
        argv = [sys.executable, MANAGER, mode, CONFIG, KERNEL, LEGACY, str(root), *map(str, extra)]
    result = subprocess.run(argv, text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(result.stdout + result.stderr)
    if not ok and not result.returncode:
        raise AssertionError("expected failure: " + " ".join(argv))
    return result


def clean(name):
    root = WORK / name
    shutil.rmtree(root, ignore_errors=True)
    root.mkdir(parents=True)
    return root


def snap(root):
    out = {}
    for path in sorted(root.rglob("*")):
        rel = str(path.relative_to(root))
        info = path.lstat()
        if stat.S_ISREG(info.st_mode):
            out[rel] = ("file", path.read_bytes(), stat.S_IMODE(info.st_mode), info.st_uid, info.st_gid)
        elif stat.S_ISDIR(info.st_mode):
            out[rel] = ("dir", stat.S_IMODE(info.st_mode), info.st_uid, info.st_gid)
        elif stat.S_ISLNK(info.st_mode):
            out[rel] = ("link", os.readlink(path))
        else:
            out[rel] = ("other", stat.S_IFMT(info.st_mode))
    return out


def scenario_priority():
    rows = [
        ({}, "AGENTS.md"),
        ({name: name.encode() + b"\n" for name in ("AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD")}, "AGENTS.md"),
        ({name: name.encode() + b"\n" for name in ("AGENTS.MD", "CLAUDE.md", "CLAUDE.MD")}, "AGENTS.MD"),
        ({name: name.encode() + b"\n" for name in ("CLAUDE.md", "CLAUDE.MD")}, "CLAUDE.md"),
        ({"CLAUDE.MD": b"last\n"}, "CLAUDE.MD"),
    ]
    for index, (seed, selected) in enumerate(rows):
        root = clean(f"priority-{index}")
        for name, data in seed.items():
            (root / name).write_bytes(data)
        before = {name: (root / name).read_bytes() for name in seed}
        run("apply", root)
        run("check", root)
        for name, data in before.items():
            actual = (root / name).read_bytes()
            if name == selected:
                assert actual.startswith(data) and actual.count(START) == actual.count(END) == 1
            else:
                assert actual == data and START not in actual
        assert json.loads((root / ".prime-claw/role-protocol-state.json").read_text())["selectedContext"]["path"] == selected
        if selected.startswith("CLAUDE"):
            assert not (root / "AGENTS.md").exists()


def scenario_preserve():
    rows = [(b"a\nb\n", b"\n"), (b"a\nb", b""), (b"a\r\nb\r\n", b"\r\n"), (b"a\r\nb", b"")]
    for index, (original, tail) in enumerate(rows):
        root = clean(f"preserve-{index}")
        target = root / "AGENTS.md"
        target.write_bytes(original)
        target.chmod(0o640)
        os.chown(target, 1234, 1235)
        (root / "APPEND_SYSTEM.md").write_bytes(b"operator append\n")
        unrelated = root / "unrelated.bin"
        unrelated.write_bytes(b"\x00\xff keep\r\n")
        run("apply", root)
        first = target.read_bytes()
        info = target.stat()
        assert first.startswith(original)
        assert first.endswith(tail) if tail else not first.endswith(b"\n")
        assert first.count(START) == 1
        assert stat.S_IMODE(info.st_mode) == 0o640 and (info.st_uid, info.st_gid) == (1234, 1235)
        inode, mtime = info.st_ino, info.st_mtime_ns
        tree = snap(root)
        run("apply", root)
        run("check", root)
        assert snap(root) == tree
        info2 = target.stat()
        assert (info2.st_ino, info2.st_mtime_ns) == (inode, mtime)
        assert unrelated.read_bytes() == b"\x00\xff keep\r\n"
        assert not list(root.rglob("*.tmp"))


def scenario_malformed():
    malformed = {
        "start": b"x\n" + START,
        "end": b"x\n" + END,
        "reversed": END + b"\n" + START,
        "duplicate": KERNEL_BYTES + b"\n" + KERNEL_BYTES,
        "nested": START + b"\n" + START + b"\n" + END + b"\n" + END,
    }
    for label, original in malformed.items():
        root = clean("malformed-" + label)
        target = root / "AGENTS.md"
        target.write_bytes(original)
        before = snap(root)
        run("apply", root, ok=False)
        assert snap(root) == before
    root = clean("stale")
    (root / "AGENTS.md").write_bytes(START + b"\nstale\n" + END)
    before = snap(root)
    run("apply", root, ok=False)
    assert snap(root) == before


def scenario_drift():
    root = clean("drift")
    (root / "CLAUDE.md").write_bytes(b"claude\n")
    run("apply", root)
    (root / "AGENTS.md").write_bytes(b"new higher priority\n")
    before = snap(root)
    assert "selected global context drift" in run("check", root, ok=False).stderr
    assert "selected global context drift" in run("apply", root, ok=False).stderr
    assert snap(root) == before
    assert (root / "CLAUDE.md").read_bytes().count(START) == 1
    assert START not in (root / "AGENTS.md").read_bytes()


def scenario_receipt():
    root = clean("receipt-existing")
    target = root / "AGENTS.md"
    original = b"binary\x00\xff\r\nno-final"
    target.write_bytes(original)
    target.chmod(0o640)
    os.chown(target, 1234, 1235)
    append = root / "APPEND_SYSTEM.md"
    append_original = b"operator append\n"
    append.write_bytes(append_original)
    before = snap(root)
    receipt = WORK / "existing-receipt.json"
    receipt.unlink(missing_ok=True)
    run("apply", root, "--receipt", receipt)
    assert json.loads(receipt.read_text())["transaction"] == "applied"
    run("restore", root, receipt)
    after = snap(root)
    # Lock persists by design; all receipt-owned surfaces return exactly.
    assert target.read_bytes() == original
    info = target.stat()
    assert stat.S_IMODE(info.st_mode) == 0o640 and (info.st_uid, info.st_gid) == (1234, 1235)
    assert append.read_bytes() == append_original
    assert not (root / ".prime-claw/role-protocol-state.json").exists()

    absent = clean("receipt-absent")
    receipt2 = WORK / "absent-receipt.json"
    receipt2.unlink(missing_ok=True)
    run("apply", absent, "--receipt", receipt2)
    assert (absent / "AGENTS.md").exists()
    run("restore", absent, receipt2)
    assert not (absent / "AGENTS.md").exists()
    assert not (absent / "APPEND_SYSTEM.md").exists()

    guarded = clean("receipt-guarded")
    receipt3 = WORK / "guarded-receipt.json"
    receipt3.unlink(missing_ok=True)
    run("apply", guarded, "--receipt", receipt3)
    (guarded / "AGENTS.md").write_bytes((guarded / "AGENTS.md").read_bytes() + b"\noperator edit")
    run("restore", guarded, receipt3, ok=False)
    assert (guarded / "AGENTS.md").read_bytes().endswith(b"operator edit")


def scenario_unsafe():
    WORK.mkdir(parents=True, exist_ok=True)
    outside = WORK / "outside"
    outside.write_bytes(b"outside exact")
    root = clean("unsafe-symlink")
    (root / "AGENTS.md").symlink_to(outside)
    before = snap(root)
    run("apply", root, ok=False)
    assert snap(root) == before and outside.read_bytes() == b"outside exact"

    root = clean("unsafe-dir")
    (root / "AGENTS.md").mkdir()
    before = snap(root)
    run("apply", root, ok=False)
    assert snap(root) == before

    root = clean("unsafe-unreadable")
    target = root / "AGENTS.md"
    target.write_bytes(b"private")
    target.chmod(0)
    before = snap(root)
    assert "unreadable" in run("apply", root, ok=False).stderr
    assert snap(root) == before

    root = clean("unsafe-state")
    (root / ".prime-claw").symlink_to(WORK, target_is_directory=True)
    before = snap(root)
    run("apply", root, ok=False)
    assert snap(root) == before


def scenario_concurrent():
    root = clean("concurrent")
    target = root / "AGENTS.md"
    target.write_bytes(b"before\n")
    lock = root / ".prime-claw-role-protocol.lock"
    lock_fd = os.open(lock, os.O_RDWR | os.O_CREAT, 0o600)
    fcntl.flock(lock_fd, fcntl.LOCK_EX)
    argv = [sys.executable, MANAGER, "apply", CONFIG, KERNEL, LEGACY, str(root)]
    contenders = [subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True) for _ in range(4)]
    time.sleep(0.2)
    target.write_bytes(b"changed while queued\n")
    fcntl.flock(lock_fd, fcntl.LOCK_UN)
    os.close(lock_fd)
    for proc in contenders:
        stdout, stderr = proc.communicate(timeout=15)
        assert proc.returncode == 0, stdout + stderr
    run("check", root)
    assert target.read_bytes().startswith(b"changed while queued\n")
    assert target.read_bytes().count(START) == 1

    # Exact-pattern dead-writer temp is reconciled; lookalike is preserved.
    orphan = root / f".AGENTS.md.prime-claw-role-protocol-999999-{('a'*16)}.tmp"
    decoy = root / ".AGENTS.md.prime-claw-role-protocol-decoy.tmp"
    orphan.write_bytes(b"orphan")
    decoy.write_bytes(b"decoy")
    run("apply", root)
    assert not orphan.exists() and decoy.read_bytes() == b"decoy"


SCENARIOS = {
    "priority": scenario_priority,
    "preserve": scenario_preserve,
    "malformed": scenario_malformed,
    "drift": scenario_drift,
    "receipt": scenario_receipt,
    "unsafe": scenario_unsafe,
    "concurrent": scenario_concurrent,
}
SCENARIOS[SCENARIO]()
print(json.dumps({"ok": True, "scenario": SCENARIO}, sort_keys=True))
