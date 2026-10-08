#!/usr/bin/env python3
"""Self-verifying Linux fixtures for the practical role-protocol manager."""

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
import threading
import time

MANAGER, CONFIG, KERNEL, LEGACY, WORK, SCENARIO = sys.argv[1:]
WORK = Path(WORK)
KERNEL_BYTES = Path(KERNEL).read_bytes().rstrip(b"\n")
LEGACY_BYTES = Path(LEGACY).read_bytes().rstrip(b"\n")
START = b"<!-- prime-claw:role-kernel:start -->"
END = b"<!-- prime-claw:role-kernel:end -->"
LEGACY_START = b"<!-- prime-claw:conversation-identity:start -->"
LEGACY_END = b"<!-- prime-claw:conversation-identity:end -->"


def run(mode, root, *extra, ok=True, config=CONFIG):
    if mode == "restore":
        argv = [sys.executable, MANAGER, "restore", str(extra[0]), str(root)]
    else:
        argv = [
            sys.executable,
            MANAGER,
            mode,
            config,
            KERNEL,
            LEGACY,
            str(root),
            *map(str, extra),
        ]
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
            out[rel] = (
                "file",
                path.read_bytes(),
                stat.S_IMODE(info.st_mode),
                info.st_uid,
                info.st_gid,
            )
        elif stat.S_ISDIR(info.st_mode):
            out[rel] = ("dir", stat.S_IMODE(info.st_mode), info.st_uid, info.st_gid)
        elif stat.S_ISLNK(info.st_mode):
            out[rel] = ("link", os.readlink(path))
        else:
            out[rel] = ("other", stat.S_IFMT(info.st_mode))
    return out



def snap_without_lock(root):
    """Compare user/managed content while allowing the persistent lock leaf."""
    value = snap(root)
    value.pop(".prime-claw-role-protocol.lock", None)
    return value


def load_manager():
    spec = importlib.util.spec_from_file_location("role_protocol_manager", MANAGER)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def fresh_applied(label, *, existing=True):
    root = clean("applied-" + label)
    if existing:
        (root / "AGENTS.md").write_bytes(b"operator context\n")
    (root / "APPEND_SYSTEM.md").write_bytes(b"operator append\n")
    (root / "unrelated.txt").write_bytes(b"unrelated exact\n")
    receipt = WORK / ("receipt-" + label + ".json")
    receipt.unlink(missing_ok=True)
    run("apply", root, "--receipt", receipt)
    return root, receipt


def scenario_priority():
    rows = [
        ({}, "AGENTS.md"),
        (
            {
                name: name.encode() + b"\n"
                for name in ("AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD")
            },
            "AGENTS.md",
        ),
        (
            {name: name.encode() + b"\n" for name in ("AGENTS.MD", "CLAUDE.md", "CLAUDE.MD")},
            "AGENTS.MD",
        ),
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
                assert actual.startswith(data)
                assert actual.count(START) == actual.count(END) == 1
            else:
                assert actual == data and START not in actual
        manifest = json.loads((root / ".prime-claw/role-protocol-state.json").read_text())
        assert manifest["selectedContext"]["path"] == selected
        if selected.startswith("CLAUDE"):
            assert not (root / "AGENTS.md").exists()


def scenario_preserve():
    rows = [
        (b"a\nb\n", b"\n"),
        (b"a\nb", b""),
        (b"a\r\nb\r\n", b"\r\n"),
        (b"a\r\nb", b""),
    ]
    for index, (original, tail) in enumerate(rows):
        root = clean(f"preserve-{index}")
        target = root / "AGENTS.md"
        target.write_bytes(original)
        target.chmod(0o640)
        os.chown(target, 1234, 1235)
        append = root / "APPEND_SYSTEM.md"
        append.write_bytes(b"operator append\n")
        append.chmod(0o660)
        unrelated = root / "unrelated.bin"
        unrelated.write_bytes(b"\x00\xff keep\r\n")
        run("apply", root)
        first = target.read_bytes()
        info = target.stat()
        assert first.startswith(original)
        assert (first.endswith(tail) if tail else not first.endswith(b"\n"))
        assert first.count(START) == 1
        assert stat.S_IMODE(info.st_mode) == 0o640
        assert (info.st_uid, info.st_gid) == (1234, 1235)
        assert stat.S_IMODE(append.stat().st_mode) == 0o660
        tree = snap(root)
        inode = info.st_ino
        run("apply", root)
        run("check", root)
        assert snap(root) == tree
        assert target.stat().st_ino == inode
        assert unrelated.read_bytes() == b"\x00\xff keep\r\n"


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
        (root / "AGENTS.md").write_bytes(original)
        before = snap_without_lock(root)
        run("apply", root, ok=False)
        assert snap_without_lock(root) == before
    root = clean("stale")
    (root / "AGENTS.md").write_bytes(START + b"\nstale\n" + END)
    before = snap_without_lock(root)
    run("apply", root, ok=False)
    assert snap_without_lock(root) == before


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
    receipt = WORK / "existing-receipt.json"
    receipt.unlink(missing_ok=True)
    run("apply", root, "--receipt", receipt)
    assert json.loads(receipt.read_text())["transaction"] == "applied"
    run("restore", root, receipt)
    assert target.read_bytes() == original
    info = target.stat()
    assert stat.S_IMODE(info.st_mode) == 0o640
    assert (info.st_uid, info.st_gid) == (1234, 1235)
    assert append.read_bytes() == append_original
    assert not (root / ".prime-claw/role-protocol-state.json").exists()
    replay = run("restore", root, receipt)
    assert json.loads(replay.stdout)["alreadyRestored"] is True

    absent = clean("receipt-absent")
    receipt2 = WORK / "absent-receipt.json"
    receipt2.unlink(missing_ok=True)
    run("apply", absent, "--receipt", receipt2)
    assert (absent / "AGENTS.md").exists()
    run("restore", absent, receipt2)
    assert not (absent / "AGENTS.md").exists()
    assert not (absent / "APPEND_SYSTEM.md").exists()
    # A completed receipt is safely reusable when its known preimages remain.
    run("apply", absent, "--receipt", receipt2)
    run("check", absent)

    guarded, receipt3 = fresh_applied("guarded")
    installed_context = (guarded / "AGENTS.md").read_bytes()
    (guarded / "APPEND_SYSTEM.md").write_bytes(
        (guarded / "APPEND_SYSTEM.md").read_bytes() + b"operator edit\n"
    )
    before_context = (guarded / "AGENTS.md").read_bytes()
    result = run("restore", guarded, receipt3, ok=False)
    assert "manual recovery" in result.stderr
    assert (guarded / "AGENTS.md").read_bytes() == before_context == installed_context
    assert (guarded / "unrelated.txt").read_bytes() == b"unrelated exact\n"


def scenario_receipt_validation():
    def corrupt_preimage(value):
        value["files"][0]["preimage"]["sha256"] = "0" * 64

    def duplicate_inventory(value):
        value["files"][2] = dict(value["files"][0])

    def missing_inventory(value):
        value["files"].pop()

    def unrelated_target(value):
        value["files"][0]["relativePath"] = "unrelated.txt"

    def invalid_metadata(value):
        value["files"][0]["postimage"]["mode"] = "0600"

    def wrong_selection(value):
        value["selectedContext"] = "CLAUDE.md"

    def contradictory_creation(value):
        value["files"][0]["preimage"] = {"exists": False}

    mutators = {
        "corrupt-preimage": corrupt_preimage,
        "duplicate-inventory": duplicate_inventory,
        "missing-inventory": missing_inventory,
        "unrelated-target": unrelated_target,
        "invalid-metadata": invalid_metadata,
        "wrong-selection": wrong_selection,
        "contradictory-creation": contradictory_creation,
    }
    for label, mutate in mutators.items():
        root, receipt = fresh_applied(label)
        value = json.loads(receipt.read_text())
        if label == "unrelated-target":
            postimage = value["files"][0]["postimage"]
            unrelated = root / "unrelated.txt"
            unrelated.write_bytes(base64.b64decode(postimage["bytesBase64"]))
            unrelated.chmod(postimage["mode"])
            os.chown(unrelated, postimage["uid"], postimage["gid"])
        mutate(value)
        receipt.write_text(json.dumps(value))
        receipt.chmod(0o600)
        before = snap(root)
        run("restore", root, receipt, ok=False)
        assert snap(root) == before, label

    for mode, contents in (
        (0o644, b"unrelated public file\n"),
        (0o600, b"unrelated private file\n"),
    ):
        root = clean(f"receipt-unowned-{mode:o}")
        (root / "AGENTS.md").write_bytes(b"operator exact\n")
        receipt = WORK / f"receipt-unowned-{mode:o}.json"
        receipt.write_bytes(contents)
        receipt.chmod(mode)
        before = snap(root)
        receipt_before = (receipt.read_bytes(), stat.S_IMODE(receipt.stat().st_mode))
        run("apply", root, "--receipt", receipt, ok=False)
        assert snap(root) == before
        assert (receipt.read_bytes(), stat.S_IMODE(receipt.stat().st_mode)) == receipt_before


def scenario_unsafe():
    WORK.mkdir(parents=True, exist_ok=True)
    outside = WORK / "outside"
    outside.write_bytes(b"outside exact")
    root = clean("unsafe-symlink")
    (root / "AGENTS.md").symlink_to(outside)
    before = snap_without_lock(root)
    run("apply", root, ok=False)
    assert snap_without_lock(root) == before and outside.read_bytes() == b"outside exact"

    root = clean("unsafe-dir")
    (root / "AGENTS.md").mkdir()
    before = snap_without_lock(root)
    run("apply", root, ok=False)
    assert snap_without_lock(root) == before

    root = clean("unsafe-unreadable")
    target = root / "AGENTS.md"
    target.write_bytes(b"private")
    target.chmod(0)
    before = snap_without_lock(root)
    assert "unreadable" in run("apply", root, ok=False).stderr
    assert snap_without_lock(root) == before

    root = clean("unsafe-state")
    (root / ".prime-claw").symlink_to(WORK, target_is_directory=True)
    before = snap_without_lock(root)
    run("apply", root, ok=False)
    assert snap_without_lock(root) == before

    root = clean("unsafe-receipt-location")
    before = snap_without_lock(root)
    run("apply", root, "--receipt", root / "receipt.json", ok=False)
    assert snap_without_lock(root) == before


def scenario_concurrent():
    root = clean("cooperative")
    target = root / "AGENTS.md"
    target.write_bytes(b"before\n")
    lock = root / ".prime-claw-role-protocol.lock"
    lock_fd = os.open(lock, os.O_RDWR | os.O_CREAT, 0o600)
    fcntl.flock(lock_fd, fcntl.LOCK_EX)
    argv = [sys.executable, MANAGER, "apply", CONFIG, KERNEL, LEGACY, str(root)]
    contenders = [
        subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        for _ in range(3)
    ]
    time.sleep(0.2)
    target.write_bytes(b"changed while queued\n")
    fcntl.flock(lock_fd, fcntl.LOCK_UN)
    os.close(lock_fd)
    for process in contenders:
        stdout, stderr = process.communicate(timeout=20)
        assert process.returncode == 0, stdout + stderr
    run("check", root)
    assert target.read_bytes().startswith(b"changed while queued\n")
    assert target.read_bytes().count(START) == 1

    # Mutable destination preflight is covered by the same lock as writes. A
    # second cooperating apply must not inspect the first writer's intermediate
    # context-without-manifest state.
    module = load_manager()
    root = clean("cooperative-intermediate")
    (root / "AGENTS.md").write_bytes(b"interleaving original\n")
    published = threading.Event()
    release = threading.Event()
    writer_errors = []
    original_atomic_write = module.atomic_write
    paused_once = False

    def pause_after_context(path, data, **kwargs):
        nonlocal paused_once
        result = original_atomic_write(path, data, **kwargs)
        if kwargs.get("description") == "context" and not paused_once:
            paused_once = True
            published.set()
            if not release.wait(10):
                raise TimeoutError("timed out waiting to release first writer")
        return result

    def first_writer():
        try:
            module.apply_protocol(
                root, Path(CONFIG), Path(KERNEL), Path(LEGACY), None
            )
        except Exception as error:
            writer_errors.append(error)

    module.atomic_write = pause_after_context
    thread = threading.Thread(target=first_writer)
    thread.start()
    assert published.wait(10), "first writer did not publish context"
    second = subprocess.Popen(
        [sys.executable, MANAGER, "apply", CONFIG, KERNEL, LEGACY, str(root)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    time.sleep(0.3)
    assert second.poll() is None, "second writer did not wait on the cooperative lock"
    release.set()
    thread.join(timeout=20)
    module.atomic_write = original_atomic_write
    assert not thread.is_alive() and not writer_errors, writer_errors
    second_out, second_err = second.communicate(timeout=20)
    assert second.returncode == 0, second_out + second_err
    run("check", root)
    assert (root / "AGENTS.md").read_bytes().count(START) == 1

    # Directly prove the ordinary prepare/reread boundary rejects a changed
    # byte/metadata preimage without a race-injection framework.
    root = clean("changed-preimage")
    target = root / "AGENTS.md"
    target.write_bytes(b"ordinary original\n")
    (root / ".prime-claw").mkdir()
    prepared = module.prepare_apply(root, KERNEL_BYTES, LEGACY_BYTES, "bridge")
    context = prepared["entries"][0]
    target.chmod(0o600)
    try:
        post = context["postimage"]
        module.atomic_write(
            target,
            module.snapshot_bytes(post),
            mode=post["mode"],
            uid=post["uid"],
            gid=post["gid"],
            expected=context["preimage"],
            description="context",
        )
    except ValueError as error:
        assert "changed preimage" in str(error)
    else:
        raise AssertionError("changed preimage unexpectedly published")
    assert target.read_bytes() == b"ordinary original\n"
    assert stat.S_IMODE(target.stat().st_mode) == 0o600
    assert START not in target.read_bytes()


def scenario_legacy_adoption():
    root = clean("legacy-exact")
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
        + LEGACY_START
        + b"\nunknown policy\n"
        + LEGACY_END
        + b"\n"
    )
    (root / "APPEND_SYSTEM.md").write_bytes(disagreeing)
    before = snap_without_lock(root)
    first = run("apply", root, ok=False)
    assert "accepted predecessor" in first.stderr
    assert snap_without_lock(root) == before


def scenario_ordinary_failure():
    module = load_manager()
    root = clean("write-failure")
    context = root / "AGENTS.md"
    context.write_bytes(b"operator context\n")
    append = root / "APPEND_SYSTEM.md"
    append.write_bytes(b"operator append\n")
    receipt = WORK / "write-failure-receipt.json"
    receipt.unlink(missing_ok=True)
    original_atomic_write = module.atomic_write
    fired = False

    def fail_append(path, data, **kwargs):
        nonlocal fired
        if kwargs.get("description") == "legacyAppend" and not fired:
            fired = True
            raise OSError("simulated ordinary write failure")
        return original_atomic_write(path, data, **kwargs)

    module.atomic_write = fail_append
    try:
        try:
            module.apply_protocol(
                root, Path(CONFIG), Path(KERNEL), Path(LEGACY), receipt
            )
        except RuntimeError as error:
            assert "changes rolled back" in str(error)
        else:
            raise AssertionError("ordinary failure unexpectedly succeeded")
    finally:
        module.atomic_write = original_atomic_write
    assert fired
    assert context.read_bytes() == b"operator context\n"
    assert append.read_bytes() == b"operator append\n"
    assert not (root / ".prime-claw/role-protocol-state.json").exists()
    assert json.loads(receipt.read_text())["transaction"] == "rolled_back"

    # A mixed state made only of exact recorded pre/postimages is recoverable
    # without a transaction journal.
    root, receipt = fresh_applied("known-mixed")
    value = json.loads(receipt.read_text())
    context_entry = value["files"][0]
    current = module.snapshot(root / context_entry["relativePath"], "context")
    module.restore_known(
        root / context_entry["relativePath"],
        context_entry["preimage"],
        current,
        "context",
    )
    run("restore", root, receipt)
    assert (root / "AGENTS.md").read_bytes() == b"operator context\n"
    assert (root / "APPEND_SYSTEM.md").read_bytes() == b"operator append\n"
    assert (root / "unrelated.txt").read_bytes() == b"unrelated exact\n"


def scenario_final_removal():
    WORK.mkdir(parents=True, exist_ok=True)
    final_config = WORK / "role-protocol-final.json"
    final_config.write_text(json.dumps({"schemaVersion": 1, "generation": "final"}))

    originals = [
        b"",
        b"operator LF\n",
        b"operator no-final",
        b"operator CRLF\r\n",
        b"operator CRLF no-final\r\nnext",
    ]
    for index, original in enumerate(originals):
        root = clean(f"final-owned-{index}")
        context = root / "AGENTS.md"
        context.write_bytes(b"operator context\n")
        append = root / "APPEND_SYSTEM.md"
        append.write_bytes(original)
        append.chmod(0o660)
        unrelated = root / "unrelated.bin"
        unrelated.write_bytes(b"unrelated exact\x00\xff")
        run("apply", root)
        bridge_tree = snap(root)
        bridge_append_info = append.stat()
        bridge_context = context.read_bytes()
        bridge_append = append.read_bytes()
        receipt = WORK / f"final-owned-{index}-receipt.json"
        receipt.unlink(missing_ok=True)

        run("apply", root, "--receipt", receipt, config=final_config)
        assert append.read_bytes() == original
        assert LEGACY_START not in append.read_bytes()
        assert context.read_bytes() == bridge_context
        append_info = append.stat()
        assert (
            stat.S_IMODE(append_info.st_mode), append_info.st_uid, append_info.st_gid
        ) == (
            stat.S_IMODE(bridge_append_info.st_mode),
            bridge_append_info.st_uid,
            bridge_append_info.st_gid,
        )
        assert unrelated.read_bytes() == b"unrelated exact\x00\xff"
        manifest = json.loads((root / ".prime-claw/role-protocol-state.json").read_text())
        assert manifest["generation"] == "final"
        assert json.loads(receipt.read_text())["generation"] == "final"
        run("check", root, config=final_config)
        if index == 0:
            tampered = json.loads(receipt.read_text())
            manifest_preimage = tampered["files"][2]["preimage"]
            manifest_pre = json.loads(
                base64.b64decode(manifest_preimage["bytesBase64"])
            )
            manifest_pre["generation"] = "final"
            manifest_pre_bytes = (
                json.dumps(manifest_pre, indent=2, sort_keys=True) + "\n"
            ).encode()
            manifest_preimage["bytesBase64"] = base64.b64encode(
                manifest_pre_bytes
            ).decode()
            manifest_preimage["sha256"] = hashlib.sha256(
                manifest_pre_bytes
            ).hexdigest()
            tampered_receipt = WORK / "final-tampered-receipt.json"
            tampered_receipt.write_text(json.dumps(tampered))
            tampered_receipt.chmod(0o600)
            before_tampered_restore = snap(root)
            result = run("restore", root, tampered_receipt, ok=False)
            assert "owned bridge manifest" in result.stderr
            assert snap(root) == before_tampered_restore

        final_tree = snap(root)
        append_inode = append.stat().st_ino
        run("apply", root, config=final_config)
        assert snap(root) == final_tree
        assert append.stat().st_ino == append_inode

        run("restore", root, receipt)
        assert snap(root) == bridge_tree
        assert append.read_bytes() == bridge_append
        run("check", root)
        mismatch = run("check", root, ok=False, config=final_config)
        assert "generation mismatch" in mismatch.stderr
        replay = run("restore", root, receipt)
        assert json.loads(replay.stdout)["alreadyRestored"] is True
        if index == 0:
            run("apply", root, config=final_config)
            append.unlink()
            run("check", root, config=final_config)
            run("apply", root, config=final_config)
            assert not append.exists()
            run("check", root, config=final_config)

    adopted = clean("final-adopted")
    adopted_append = adopted / "APPEND_SYSTEM.md"
    prefix = b"operator prefix\r\n"
    suffix = b"\r\noperator suffix-no-final"
    adopted_original = prefix + LEGACY_BYTES + suffix
    adopted_append.write_bytes(adopted_original)
    run("apply", adopted)
    adopted_bridge = snap(adopted)
    adopted_receipt = WORK / "final-adopted-receipt.json"
    adopted_receipt.unlink(missing_ok=True)
    run("apply", adopted, "--receipt", adopted_receipt, config=final_config)
    assert adopted_append.read_bytes() == prefix + suffix
    run("check", adopted, config=final_config)
    run("restore", adopted, adopted_receipt)
    assert snap(adopted) == adopted_bridge

    malformed = clean("final-malformed")
    (malformed / "APPEND_SYSTEM.md").write_bytes(b"operator append\n")
    run("apply", malformed)
    malformed_append = malformed / "APPEND_SYSTEM.md"
    malformed_append.write_bytes(malformed_append.read_bytes() + b"\n" + LEGACY_BYTES)
    malformed_before = snap(malformed)
    result = run("apply", malformed, ok=False, config=final_config)
    assert "duplicate managed markers" in result.stderr
    assert snap(malformed) == malformed_before

    unknown = clean("final-unknown-restore")
    (unknown / "APPEND_SYSTEM.md").write_bytes(b"operator append\n")
    run("apply", unknown)
    unknown_receipt = WORK / "final-unknown-receipt.json"
    unknown_receipt.unlink(missing_ok=True)
    run("apply", unknown, "--receipt", unknown_receipt, config=final_config)
    (unknown / "APPEND_SYSTEM.md").write_bytes(
        (unknown / "APPEND_SYSTEM.md").read_bytes() + b"operator drift\n"
    )
    unknown_before = snap(unknown)
    result = run("restore", unknown, unknown_receipt, ok=False)
    assert "manual recovery" in result.stderr
    assert snap(unknown) == unknown_before

    source_drift = clean("final-source-drift")
    (source_drift / "APPEND_SYSTEM.md").write_bytes(b"operator append\n")
    run("apply", source_drift)
    source_drift_before = snap(source_drift)
    module = load_manager()
    changed_kernel = KERNEL_BYTES.replace(b"Prime Claw", b"Prime claw", 1)
    changed_legacy = LEGACY_BYTES.replace(b"CONVERSATION", b"Conversation", 1)
    assert changed_kernel != KERNEL_BYTES and changed_legacy != LEGACY_BYTES
    for kernel, legacy, diagnostic in (
        (changed_kernel, LEGACY_BYTES, "role kernel"),
        (KERNEL_BYTES, changed_legacy, "legacy block source"),
    ):
        try:
            module.prepare_apply(source_drift, kernel, legacy, "final")
        except ValueError as error:
            assert diagnostic in str(error)
        else:
            raise AssertionError("final removal unexpectedly accepted source drift")
        assert snap(source_drift) == source_drift_before

    unowned = clean("final-unowned")
    (unowned / "APPEND_SYSTEM.md").write_bytes(b"operator append\n")
    unowned_before = snap_without_lock(unowned)
    result = run("apply", unowned, ok=False, config=final_config)
    assert "owned bridge manifest" in result.stderr
    assert snap_without_lock(unowned) == unowned_before


SCENARIOS = {
    "priority": scenario_priority,
    "preserve": scenario_preserve,
    "malformed": scenario_malformed,
    "drift": scenario_drift,
    "receipt": scenario_receipt,
    "receipt-validation": scenario_receipt_validation,
    "unsafe": scenario_unsafe,
    "concurrent": scenario_concurrent,
    "legacy-adoption": scenario_legacy_adoption,
    "ordinary-failure": scenario_ordinary_failure,
    "final-removal": scenario_final_removal,
}
SCENARIOS[SCENARIO]()
print(json.dumps({"ok": True, "scenario": SCENARIO}, sort_keys=True))
