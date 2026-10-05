#!/usr/bin/env python3
"""Self-verifying Linux fixture scenarios for the role-protocol manager."""

import base64
import fcntl
import hashlib
import importlib.util
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
TEMP_TAG = "prime-claw-role-protocol"


def run(mode, root, *extra, ok=True, env=None):
    if mode == "restore":
        argv = [sys.executable, MANAGER, "restore", str(extra[0]), str(root)]
    else:
        argv = [sys.executable, MANAGER, mode, CONFIG, KERNEL, LEGACY, str(root), *map(str, extra)]
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    result = subprocess.run(argv, text=True, capture_output=True, env=merged_env, timeout=30)
    if ok is True and result.returncode:
        raise AssertionError(result.stdout + result.stderr)
    if ok is False and not result.returncode:
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

    # A waiter must re-bind the pathname after flock. Replacing the lock leaf
    # cannot create two writers that both enter the transaction.
    root = clean("concurrent-lock-replacement")
    target = root / "AGENTS.md"
    target.write_bytes(b"lock original\n")
    lock = root / ".prime-claw-role-protocol.lock"
    old_fd = os.open(lock, os.O_RDWR | os.O_CREAT, 0o600)
    old_info = os.fstat(old_fd)
    fcntl.flock(old_fd, fcntl.LOCK_EX)
    argv = [sys.executable, MANAGER, "apply", CONFIG, KERNEL, LEGACY, str(root)]
    waiter = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    opened_old = False
    for _ in range(100):
        fd_dir = Path(f"/proc/{waiter.pid}/fd")
        if fd_dir.exists():
            for entry in fd_dir.iterdir():
                try:
                    info = entry.stat()
                except FileNotFoundError:
                    continue
                if (info.st_dev, info.st_ino) == (old_info.st_dev, old_info.st_ino):
                    opened_old = True
                    break
        if opened_old:
            break
        time.sleep(0.01)
    assert opened_old, "waiter never opened the original lock inode"
    retired = root / ".prime-claw-role-protocol.lock.retired"
    lock.rename(retired)
    replacement_fd = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
    os.close(replacement_fd)
    current = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    current_out, current_err = current.communicate(timeout=30)
    assert current.returncode == 0, current_out + current_err
    fcntl.flock(old_fd, fcntl.LOCK_UN)
    os.close(old_fd)
    waiter_out, waiter_err = waiter.communicate(timeout=30)
    assert waiter.returncode != 0, waiter_out + waiter_err
    assert "flocked inode" in waiter_err
    run("check", root)
    assert target.read_bytes().count(START) == 1

    # Replacing the canonical lock during an active restore cannot let the old
    # holder perform its pending manifest unlink while a new-lock contender is
    # active.
    root = clean("concurrent-active-lock-replacement")
    (root / "AGENTS.md").write_bytes(b"active lock original\n")
    receipt = WORK / "concurrent-active-lock-replacement.json"
    receipt.unlink(missing_ok=True)
    run("apply", root, "--receipt", receipt)
    manifest = root / ".prime-claw/role-protocol-state.json"
    manifest_before = (manifest.read_bytes(), manifest.stat().st_ino, manifest.stat().st_mode)
    module = load_manager()
    original_fault = module.fault
    fired = False
    child_pid = None

    def replace_active_lock(point):
        nonlocal fired, child_pid
        if point == "transaction manifest:before-unlink" and not fired:
            fired = True
            lock = root / ".prime-claw-role-protocol.lock"
            lock.rename(root / ".prime-claw-role-protocol.lock.active-retired")
            replacement_fd = os.open(lock, os.O_RDWR | os.O_CREAT | os.O_EXCL, 0o600)
            os.close(replacement_fd)
            read_fd, write_fd = os.pipe()
            child_pid = os.fork()
            if child_pid == 0:
                os.close(read_fd)
                fd = os.open(lock, os.O_RDWR)
                fcntl.flock(fd, fcntl.LOCK_EX)
                os.write(write_fd, b"1")
                os.close(write_fd)
                time.sleep(30)
                os._exit(0)
            os.close(write_fd)
            assert os.read(read_fd, 1) == b"1"
            os.close(read_fd)
        return original_fault(point)

    module.fault = replace_active_lock
    try:
        try:
            module.restore_protocol(root, receipt)
        except Exception:
            pass
        else:
            raise AssertionError("active lock replacement unexpectedly restored")
    finally:
        module.fault = original_fault
        if child_pid is not None:
            os.kill(child_pid, 15)
            os.waitpid(child_pid, 0)
    assert fired and manifest.exists()
    assert (manifest.read_bytes(), manifest.stat().st_ino, manifest.stat().st_mode) == manifest_before
    assert (root / "AGENTS.md").read_bytes() == b"active lock original\n"
    assert (root / ".prime-claw/role-protocol-transaction.json").exists()
    run("restore", root, receipt)
    assert (root / "AGENTS.md").read_bytes() == b"active lock original\n"

    # Exact-pattern dead-writer temp is reconciled; lookalike is preserved.
    orphan = root / f".AGENTS.md.prime-claw-role-protocol-999999-{('a'*16)}.tmp"
    decoy = root / ".AGENTS.md.prime-claw-role-protocol-decoy.tmp"
    orphan.write_bytes(b"orphan")
    decoy.write_bytes(b"decoy")
    run("apply", root)
    assert not orphan.exists() and decoy.read_bytes() == b"decoy"



def load_manager():
    spec = importlib.util.spec_from_file_location("role_protocol_manager", MANAGER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def scenario_descriptor_safety():
    # A direct manager apply can securely create an absent isolated destination.
    parent = clean("descriptor-absent-parent")
    root = parent / "new-agent-root"
    receipt = WORK / "descriptor-absent-receipt.json"
    receipt.unlink(missing_ok=True)
    run("apply", root, "--receipt", receipt)
    run("check", root)
    assert stat.S_IMODE(receipt.stat().st_mode) == 0o600
    run("restore", root, receipt)

    root = parent / "rejected-agent-root"
    occupied_receipt = WORK / "descriptor-occupied-receipt.json"
    occupied_receipt.write_bytes(b"unowned private bytes")
    occupied_receipt.chmod(0o600)
    run("apply", root, "--receipt", occupied_receipt, ok=False)
    assert not root.exists() and occupied_receipt.read_bytes() == b"unowned private bytes"

    # A symlink anywhere in the destination chain is not an authority.
    real = clean("descriptor-real-parent")
    (real / "agent").mkdir()
    alias = WORK / "descriptor-alias-parent"
    alias.symlink_to(real, target_is_directory=True)
    result = run("apply", alias / "agent", ok=False)
    assert result.returncode and not (real / "agent/AGENTS.md").exists()

    # check and restore reject a swapped state parent without touching its target.
    root = clean("descriptor-state-swap")
    receipt = WORK / "descriptor-state-receipt.json"
    receipt.unlink(missing_ok=True)
    run("apply", root, "--receipt", receipt)
    outside = WORK / "descriptor-outside-state"
    (root / ".prime-claw").rename(outside)
    (root / ".prime-claw").symlink_to(outside, target_is_directory=True)
    outside_before = snap(outside)
    run("check", root, ok=False)
    run("restore", root, receipt, ok=False)
    assert snap(outside) == outside_before

    # Receipt and lock parents/leaves receive the same no-follow contract.
    root = clean("descriptor-receipt-parent")
    receipt_real = WORK / "descriptor-receipts-real"
    receipt_real.mkdir(exist_ok=True)
    receipt_alias = WORK / "descriptor-receipts-alias"
    receipt_alias.symlink_to(receipt_real, target_is_directory=True)
    before = snap(root)
    run("apply", root, "--receipt", receipt_alias / "receipt.json", ok=False)
    assert snap(root) == before and not list(receipt_real.iterdir())

    root = clean("descriptor-lock")
    outside_lock = WORK / "descriptor-outside-lock"
    outside_lock.write_bytes(b"outside lock sentinel")
    (root / ".prime-claw-role-protocol.lock").symlink_to(outside_lock)
    before = snap(root)
    run("apply", root, ok=False)
    assert snap(root) == before and outside_lock.read_bytes() == b"outside lock sentinel"

    root = clean("descriptor-fifo")
    os.mkfifo(root / "AGENTS.md")
    before = snap(root)
    run("apply", root, ok=False)
    assert snap(root) == before

    # Swap the destination after staging. The descriptor remains bounded to the
    # old directory, and the path-identity recheck blocks publication.
    module = load_manager()
    parent = clean("descriptor-parent-swap")
    root = parent / "agent"
    root.mkdir()
    (root / "AGENTS.md").write_bytes(b"operator original\n")
    outside = parent / "outside"
    outside.mkdir()
    (outside / "sentinel").write_bytes(b"outside exact")
    moved = parent / "agent-moved"
    original_fault = module.fault
    fired = False

    def swap_at_commit(label):
        nonlocal fired
        if label == "context:before-commit-revalidation" and not fired:
            fired = True
            root.rename(moved)
            root.symlink_to(outside, target_is_directory=True)
        return original_fault(label)

    module.fault = swap_at_commit
    try:
        try:
            module.apply_protocol(root, Path(CONFIG), Path(KERNEL), Path(LEGACY), None)
        except Exception:
            pass
        else:
            raise AssertionError("parent swap unexpectedly succeeded")
    finally:
        module.fault = original_fault
    assert (outside / "sentinel").read_bytes() == b"outside exact"
    assert not (outside / "AGENTS.md").exists()
    run("apply", root, ok=False)
    assert (outside / "sentinel").read_bytes() == b"outside exact"


def _fresh_applied(label):
    root = clean("receipt-validate-" + label)
    (root / "AGENTS.md").write_bytes(b"operator context\n")
    (root / "APPEND_SYSTEM.md").write_bytes(b"operator append\n")
    (root / "unrelated.txt").write_bytes(b"unrelated exact\n")
    receipt = WORK / ("receipt-validate-" + label + ".json")
    receipt.unlink(missing_ok=True)
    run("apply", root, "--receipt", receipt)
    assert stat.S_IMODE(receipt.stat().st_mode) == 0o600
    return root, receipt


def scenario_receipt_validation():
    def corrupt_preimage(value):
        value["files"][0]["preimage"]["sha256"] = "0" * 64

    def duplicate_inventory(value):
        value["files"][2] = dict(value["files"][0])

    def unrelated_target(value):
        value["files"][0]["relativePath"] = "unrelated.txt"

    def wrong_destination(value):
        value["destination"]["inode"] += 1

    def invalid_base64(value):
        value["files"][1]["preimage"]["bytesBase64"] = "not-base64!"

    def invalid_metadata(value):
        value["files"][0]["postimage"]["mode"] = "0600"

    def wrong_selection(value):
        value["selectedContext"] = "CLAUDE.md"

    def extra_schema(value):
        value["unexpected"] = True

    mutators = {
        "corrupt-preimage": corrupt_preimage,
        "duplicate-inventory": duplicate_inventory,
        "unrelated-target": unrelated_target,
        "wrong-destination": wrong_destination,
        "invalid-base64": invalid_base64,
        "invalid-metadata": invalid_metadata,
        "wrong-selection": wrong_selection,
        "extra-schema": extra_schema,
    }
    for label, mutate in mutators.items():
        root, receipt = _fresh_applied(label)
        value = json.loads(receipt.read_text())
        mutate(value)
        receipt.write_text(json.dumps(value))
        receipt.chmod(0o600)
        before = snap(root)
        run("restore", root, receipt, ok=False)
        assert snap(root) == before, label
        assert (root / "unrelated.txt").read_bytes() == b"unrelated exact\n"

    for mode, contents in ((0o644, b"unrelated public file\n"), (0o600, b"unrelated private file\n")):
        root = clean(f"receipt-existing-unowned-{mode:o}")
        (root / "AGENTS.md").write_bytes(b"operator exact\n")
        receipt = WORK / f"receipt-existing-unowned-{mode:o}.json"
        receipt.write_bytes(contents)
        receipt.chmod(mode)
        before = snap(root)
        receipt_before = receipt.read_bytes()
        run("apply", root, "--receipt", receipt, ok=False)
        assert snap(root) == before
        assert receipt.read_bytes() == receipt_before and stat.S_IMODE(receipt.stat().st_mode) == mode

    root, receipt = _fresh_applied("owned-reuse")
    run("restore", root, receipt)
    assert json.loads(receipt.read_text())["transaction"] == "restored"
    run("apply", root, "--receipt", receipt)
    assert json.loads(receipt.read_text())["transaction"] == "applied"
    assert stat.S_IMODE(receipt.stat().st_mode) == 0o600


def scenario_legacy_adoption():
    root = clean("legacy-exact-adoption")
    original = b"operator prefix\n" + LEGACY_BYTES + b"\noperator suffix\n"
    append = root / "APPEND_SYSTEM.md"
    append.write_bytes(original)
    inode = append.stat().st_ino
    run("apply", root)
    assert append.read_bytes() == original and append.stat().st_ino == inode
    run("check", root)

    root = clean("legacy-disagreeing")
    disagreeing = (
        b"operator prefix\n"
        + b"<!-- prime-claw:conversation-identity:start -->\nunknown policy\n"
        + b"<!-- prime-claw:conversation-identity:end -->\n"
    )
    (root / "APPEND_SYSTEM.md").write_bytes(disagreeing)
    before = snap(root)
    first = run("apply", root, ok=False)
    second = run("apply", root, ok=False)
    assert "accepted predecessor" in first.stderr
    assert "accepted predecessor" in second.stderr
    assert snap(root) == before


def scenario_concurrency_races():
    module = load_manager()

    def execute_with_callback(label, callback):
        root = clean("race-" + label)
        target = root / "AGENTS.md"
        target.write_bytes(b"operator original\n")
        target.chmod(0o644)
        original_fault = module.fault
        fired = False

        def injected(point):
            nonlocal fired
            if point == "context:before-commit-revalidation" and not fired:
                fired = True
                callback(root, target)
            return original_fault(point)

        module.fault = injected
        try:
            try:
                module.apply_protocol(root, Path(CONFIG), Path(KERNEL), Path(LEGACY), None)
            except Exception:
                pass
            else:
                raise AssertionError(label + " unexpectedly succeeded")
        finally:
            module.fault = original_fault
        assert fired
        assert not (root / ".prime-claw/role-protocol-state.json").exists()
        assert not (root / ".prime-claw/role-protocol-transaction.json").exists()
        return root, target

    root, target = execute_with_callback("chmod", lambda _root, path: path.chmod(0o600))
    assert target.read_bytes() == b"operator original\n"
    assert stat.S_IMODE(target.stat().st_mode) == 0o600
    assert START not in target.read_bytes()

    original_inode = None

    def replace_inode(_root, path):
        nonlocal original_inode
        original_inode = path.stat().st_ino
        replacement = path.with_name("replacement")
        replacement.write_bytes(path.read_bytes())
        replacement.chmod(0o644)
        os.replace(replacement, path)

    root, target = execute_with_callback("inode", replace_inode)
    assert target.stat().st_ino != original_inode
    assert target.read_bytes() == b"operator original\n" and START not in target.read_bytes()

    root = clean("race-selection")
    target = root / "CLAUDE.md"
    target.write_bytes(b"operator claude\n")
    original_fault = module.fault
    fired = False

    def create_higher(point):
        nonlocal fired
        if point == "context:before-commit-revalidation" and not fired:
            fired = True
            (root / "AGENTS.md").write_bytes(b"operator higher priority\n")
        return original_fault(point)

    module.fault = create_higher
    try:
        try:
            module.apply_protocol(root, Path(CONFIG), Path(KERNEL), Path(LEGACY), None)
        except Exception:
            pass
        else:
            raise AssertionError("selection race unexpectedly succeeded")
    finally:
        module.fault = original_fault
    assert (root / "AGENTS.md").read_bytes() == b"operator higher priority\n"
    assert target.read_bytes() == b"operator claude\n"
    assert not (root / ".prime-claw/role-protocol-state.json").exists()
    assert not (root / ".prime-claw/role-protocol-transaction.json").exists()

    def execute_late_race(label, hook, callback, *, with_receipt=False):
        root = clean("race-late-" + label)
        target = root / "AGENTS.md"
        target.write_bytes(b"late original\n")
        target.chmod(0o644)
        receipt = WORK / ("race-late-" + label + ".json") if with_receipt else None
        if receipt is not None:
            receipt.unlink(missing_ok=True)
        original_fault = module.fault
        fired = False

        def injected(point):
            nonlocal fired
            if point == hook and not fired:
                fired = True
                callback(root, target)
            return original_fault(point)

        module.fault = injected
        try:
            try:
                module.apply_protocol(root, Path(CONFIG), Path(KERNEL), Path(LEGACY), receipt)
            except Exception:
                pass
            else:
                raise AssertionError(label + " unexpectedly succeeded")
        finally:
            module.fault = original_fault
        assert fired
        journal = root / ".prime-claw/role-protocol-transaction.json"
        assert journal.exists() and json.loads(journal.read_text())["phase"] == "uncertain"
        before = snap(root)
        extra = ("--receipt", receipt) if receipt is not None else ()
        run("apply", root, *extra, ok=False)
        assert snap(root) == before
        return root, target

    root, target = execute_late_race(
        "final-chmod",
        "final-check:before",
        lambda _root, path: path.chmod(0o600),
    )
    assert stat.S_IMODE(target.stat().st_mode) == 0o600

    root, target = execute_late_race(
        "final-chown",
        "final-check:before",
        lambda _root, path: os.chown(path, 1234, 1235),
    )
    assert (target.stat().st_uid, target.stat().st_gid) == (1234, 1235)

    late_inode = None

    def replace_late_inode(_root, path):
        nonlocal late_inode
        late_inode = path.stat().st_ino
        replacement = path.with_name("late-replacement")
        replacement.write_bytes(path.read_bytes())
        os.chmod(replacement, stat.S_IMODE(path.stat().st_mode))
        os.chown(replacement, path.stat().st_uid, path.stat().st_gid)
        os.replace(replacement, path)

    root, target = execute_late_race(
        "receipt-inode",
        "receipt-applied:before-commit-revalidation",
        replace_late_inode,
        with_receipt=True,
    )
    assert target.stat().st_ino != late_inode

    root = clean("race-journal-removal-selection")
    target = root / "CLAUDE.md"
    target.write_bytes(b"late claude\n")
    original_fault = module.fault
    fired = False

    def create_at_journal_removal(point):
        nonlocal fired
        if point == "journal-removal:before-commit-revalidation" and not fired:
            fired = True
            (root / "AGENTS.md").write_bytes(b"late higher priority\n")
        return original_fault(point)

    module.fault = create_at_journal_removal
    try:
        try:
            module.apply_protocol(root, Path(CONFIG), Path(KERNEL), Path(LEGACY), None)
        except Exception:
            pass
        else:
            raise AssertionError("journal-removal selection race unexpectedly succeeded")
    finally:
        module.fault = original_fault
    assert fired
    assert (root / "AGENTS.md").read_bytes() == b"late higher priority\n"
    assert target.read_bytes() == b"late claude\n"
    assert not (root / ".prime-claw/role-protocol-state.json").exists()
    assert not (root / ".prime-claw/role-protocol-transaction.json").exists()

    # A non-locking edit after replacement is not guessed away. The exact
    # external bytes survive and a durable uncertainty journal blocks replay.
    root = clean("race-post-replace-uncertainty")
    target = root / "AGENTS.md"
    target.write_bytes(b"operator original\n")
    original_fault = module.fault
    fired = False

    def edit_after_replace(point):
        nonlocal fired
        if point == "context:after-replace" and not fired:
            fired = True
            target.write_bytes(target.read_bytes() + b"external late edit\n")
        return original_fault(point)

    module.fault = edit_after_replace
    try:
        try:
            module.apply_protocol(root, Path(CONFIG), Path(KERNEL), Path(LEGACY), None)
        except Exception:
            pass
        else:
            raise AssertionError("late external edit unexpectedly succeeded")
    finally:
        module.fault = original_fault
    assert fired and target.read_bytes().endswith(b"external late edit\n")
    journal = root / ".prime-claw/role-protocol-transaction.json"
    assert journal.exists() and json.loads(journal.read_text())["phase"] == "uncertain"
    before = snap(root)
    run("apply", root, ok=False)
    assert snap(root) == before


def scenario_fault_recovery():
    boundaries = [
        "before-file-fsync",
        "after-file-fsync",
        "before-replace",
        "after-replace",
        "before-directory-fsync",
        "after-directory-fsync",
    ]
    apply_labels = [
        *(f"{kind}:{boundary}" for kind in ("context", "append", "manifest", "journal") for boundary in boundaries),
        *(f"{kind}:{boundary}" for kind in ("receipt-prepared", "receipt-applied") for boundary in boundaries),
        "final-check:before",
        "final-check:after",
    ]
    apply_success_after_fault = {
        "receipt-applied:after-replace",
        "receipt-applied:before-directory-fsync",
        "receipt-applied:after-directory-fsync",
    }
    exit_labels = [
        "context:after-replace",
        "manifest:after-replace",
        "journal:after-replace",
        "receipt-applied:after-replace",
        "receipt-applied:before-directory-fsync",
    ]
    rows = [(label, "error") for label in apply_labels] + [(label, "exit") for label in exit_labels]
    for index, (label, action) in enumerate(rows):
        root = clean(f"fault-apply-{index}-{action}")
        target = root / "AGENTS.md"
        append = root / "APPEND_SYSTEM.md"
        target.write_bytes(b"operator original\n")
        append.write_bytes(b"operator append\n")
        receipt = WORK / f"fault-apply-{index}-{action}.json"
        receipt.unlink(missing_ok=True)
        first = run(
            "apply", root, "--receipt", receipt, ok=None,
            env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": f"{label}={action}"},
        )
        if not (label in apply_success_after_fault and action == "error"):
            assert first.returncode != 0, (label, first.stdout, first.stderr)
        run("apply", root, "--receipt", receipt)
        run("check", root)
        assert json.loads(receipt.read_text())["transaction"] == "applied"
        run("restore", root, receipt)
        assert target.read_bytes() == b"operator original\n"
        assert append.read_bytes() == b"operator append\n"
        replay = run("restore", root, receipt)
        assert json.loads(replay.stdout)["alreadyRestored"] is True
        assert not (root / ".prime-claw/role-protocol-transaction.json").exists()

    for stage_kind in ("prepared", "applied"):
        for action in ("error", "exit"):
            root = clean(f"fault-receipt-{stage_kind}-stage-journal-{action}")
            (root / "AGENTS.md").write_bytes(b"stage journal original\n")
            receipt = WORK / f"fault-receipt-{stage_kind}-stage-journal-{action}.json"
            receipt.unlink(missing_ok=True)
            label = f"receipt-{stage_kind}-stage-journal:before"
            first = run(
                "apply", root, "--receipt", receipt, ok=None,
                env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": f"{label}={action}"},
            )
            assert first.returncode != 0
            staged_pattern = f".{receipt.name}.{TEMP_TAG}-*.tmp"
            if action == "error":
                assert not list(receipt.parent.glob(staged_pattern))
            run("apply", root, "--receipt", receipt)
            assert not list(receipt.parent.glob(staged_pattern))
            run("check", root)
            run("restore", root, receipt)
            assert (root / "AGENTS.md").read_bytes() == b"stage journal original\n"

    pre_journal_restore_labels = [
        *(f"restore-{kind}:{boundary}" for kind in ("context", "append") for boundary in ("before-file-fsync", "after-file-fsync")),
        "restore-staging:after",
    ]
    for index, (label, action) in enumerate(
        (label, action) for label in pre_journal_restore_labels for action in ("error", "exit")
    ):
        root = clean(f"fault-restore-staging-{index}-{action}")
        target = root / "AGENTS.md"
        append = root / "APPEND_SYSTEM.md"
        target.write_bytes(b"staging original\n")
        append.write_bytes(b"staging append\n")
        receipt = WORK / f"fault-restore-staging-{index}-{action}.json"
        receipt.unlink(missing_ok=True)
        run("apply", root, "--receipt", receipt)
        first = run(
            "restore", root, receipt, ok=None,
            env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": f"{label}={action}"},
        )
        assert first.returncode != 0, (label, action, first.stdout, first.stderr)
        if action == "error":
            assert not list(root.rglob(f"*.{TEMP_TAG}-*.tmp"))
        run("restore", root, receipt)
        assert target.read_bytes() == b"staging original\n"
        assert append.read_bytes() == b"staging append\n"
        assert json.loads(receipt.read_text())["transaction"] == "restored"
        assert not list(root.rglob(f"*.{TEMP_TAG}-*.tmp"))
        assert not (root / ".prime-claw/role-protocol-transaction.json").exists()

    # Recovery of an applied receipt must prove its parent-directory fsync
    # before deleting the only journal, for both synchronous and crash faults.
    for action in ("error", "exit"):
        root = clean(f"fault-receipt-recovery-fsync-{action}")
        (root / "AGENTS.md").write_bytes(b"durability original\n")
        receipt = WORK / f"fault-receipt-recovery-fsync-{action}.json"
        receipt.unlink(missing_ok=True)
        interrupted = run(
            "apply", root, "--receipt", receipt, ok=None,
            env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": "receipt-applied:after-replace=exit"},
        )
        assert interrupted.returncode != 0
        journal = root / ".prime-claw/role-protocol-transaction.json"
        assert journal.exists() and json.loads(receipt.read_text())["transaction"] == "applied"
        replay = run(
            "apply", root, "--receipt", receipt, ok=None,
            env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": f"receipt-recovery:before-directory-fsync={action}"},
        )
        assert replay.returncode != 0
        assert journal.exists()
        run("apply", root, "--receipt", receipt)
        assert not journal.exists()
        run("check", root)
        run("restore", root, receipt)
        assert (root / "AGENTS.md").read_bytes() == b"durability original\n"

    for action in ("error", "exit"):
        root = clean(f"fault-restored-receipt-recovery-fsync-{action}")
        (root / "AGENTS.md").write_bytes(b"restored durability original\n")
        receipt = WORK / f"fault-restored-receipt-recovery-fsync-{action}.json"
        receipt.unlink(missing_ok=True)
        run("apply", root, "--receipt", receipt)
        interrupted = run(
            "restore", root, receipt, ok=None,
            env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": "receipt-restored:after-replace=exit"},
        )
        assert interrupted.returncode != 0
        journal = root / ".prime-claw/role-protocol-transaction.json"
        assert journal.exists() and json.loads(receipt.read_text())["transaction"] == "restored"
        replay = run(
            "restore", root, receipt, ok=None,
            env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": f"receipt-recovery:before-directory-fsync={action}"},
        )
        assert replay.returncode != 0
        assert journal.exists()
        run("restore", root, receipt)
        assert not journal.exists()
        assert (root / "AGENTS.md").read_bytes() == b"restored durability original\n"

    # A valid but different receipt, an identical-byte replacement inode, or
    # metadata drift cannot be mistaken for this journal's applied receipt.
    for variant in ("old-valid", "same-bytes-new-inode", "metadata"):
        root = clean(f"fault-receipt-substitution-{variant}")
        (root / "AGENTS.md").write_bytes(b"substitution original\n")
        receipt = WORK / f"fault-receipt-substitution-{variant}.json"
        receipt.unlink(missing_ok=True)
        old_bytes = None
        if variant == "old-valid":
            run("apply", root, "--receipt", receipt)
            old_bytes = receipt.read_bytes()
            run("restore", root, receipt)
        interrupted = run(
            "apply", root, "--receipt", receipt, ok=None,
            env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": "receipt-applied:after-replace=exit"},
        )
        assert interrupted.returncode != 0
        if variant == "old-valid":
            replacement_bytes = old_bytes
        else:
            replacement_bytes = receipt.read_bytes()
        if variant in {"old-valid", "same-bytes-new-inode"}:
            replacement = receipt.with_name(receipt.name + ".replacement")
            replacement.write_bytes(replacement_bytes)
            replacement.chmod(0o600)
            os.chown(replacement, receipt.stat().st_uid, receipt.stat().st_gid)
            os.replace(replacement, receipt)
        else:
            receipt.chmod(0o400)
        managed_paths = [
            root / "AGENTS.md",
            root / "APPEND_SYSTEM.md",
            root / ".prime-claw/role-protocol-state.json",
        ]
        managed_before = [
            (path.read_bytes(), path.stat().st_ino, path.stat().st_mode, path.stat().st_uid, path.stat().st_gid)
            for path in managed_paths
        ]
        receipt_before = receipt.read_bytes()
        replay = run("apply", root, "--receipt", receipt, ok=False)
        managed_after = [
            (path.read_bytes(), path.stat().st_ino, path.stat().st_mode, path.stat().st_uid, path.stat().st_gid)
            for path in managed_paths
        ]
        assert managed_after == managed_before and receipt.read_bytes() == receipt_before
        journal = root / ".prime-claw/role-protocol-transaction.json"
        assert journal.exists()
        if variant != "metadata":
            assert "uncertain" in replay.stderr
            assert json.loads(journal.read_text())["phase"] == "uncertain"

    restore_labels = [
        *(f"recovery-{kind}:{boundary}" for kind in ("context", "append") for boundary in boundaries),
        *(f"transaction manifest:{boundary}" for boundary in ("before-unlink", "after-unlink", "before-directory-fsync", "after-directory-fsync")),
        *(f"receipt-restored:{boundary}" for boundary in boundaries),
    ]
    restore_success_after_fault = {
        *(f"recovery-{kind}:{boundary}" for kind in ("context", "append") for boundary in ("after-replace", "before-directory-fsync", "after-directory-fsync")),
        *(f"transaction manifest:{boundary}" for boundary in ("after-unlink", "before-directory-fsync", "after-directory-fsync")),
        "receipt-restored:after-replace",
        "receipt-restored:before-directory-fsync",
        "receipt-restored:after-directory-fsync",
    }
    for index, label in enumerate(restore_labels):
        root = clean(f"fault-restore-{index}")
        target = root / "AGENTS.md"
        append = root / "APPEND_SYSTEM.md"
        target.write_bytes(b"restore original\n")
        append.write_bytes(b"restore append\n")
        receipt = WORK / f"fault-restore-{index}.json"
        receipt.unlink(missing_ok=True)
        run("apply", root, "--receipt", receipt)
        first = run(
            "restore", root, receipt, ok=None,
            env={"PRIME_CLAW_ROLE_PROTOCOL_FAULT": f"{label}=error"},
        )
        if label not in restore_success_after_fault:
            assert first.returncode != 0, (label, first.stdout, first.stderr)
        replay = run("restore", root, receipt)
        verdict = json.loads(replay.stdout)
        assert verdict.get("restored") is True or verdict.get("alreadyRestored") is True
        assert target.read_bytes() == b"restore original\n"
        assert append.read_bytes() == b"restore append\n"
        assert json.loads(receipt.read_text())["transaction"] == "restored"
        assert not (root / ".prime-claw/role-protocol-transaction.json").exists()


SCENARIOS = {
    "priority": scenario_priority,
    "preserve": scenario_preserve,
    "malformed": scenario_malformed,
    "drift": scenario_drift,
    "receipt": scenario_receipt,
    "unsafe": scenario_unsafe,
    "concurrent": scenario_concurrent,
    "descriptor-safety": scenario_descriptor_safety,
    "receipt-validation": scenario_receipt_validation,
    "legacy-adoption": scenario_legacy_adoption,
    "concurrency-races": scenario_concurrency_races,
    "fault-recovery": scenario_fault_recovery,
}
SCENARIOS[SCENARIO]()
print(json.dumps({"ok": True, "scenario": SCENARIO}, sort_keys=True))
