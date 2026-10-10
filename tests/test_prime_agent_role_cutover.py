"""Recording-fake coverage for the inert Generation A cutover preparation."""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time

import pytest


ROOT = Path(__file__).resolve().parents[1]
COORDINATOR = ROOT / "scripts/coordinate-prime-agent-role-cutover.py"
BUNDLE = ROOT / "scripts/manage-prime-agent-cutover-bundle.py"


def load(path: Path, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


coord = load(COORDINATOR, "prime_claw_cutover_coordinator")
bundle = load(BUNDLE, "prime_claw_cutover_bundle")


def ns(**values):
    return type("Args", (), values)()


def populate_managed(installed: Path, source: Path) -> None:
    for relative in bundle.MANAGED_FILES:
        for root in (installed, source):
            path = root / relative
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(f"managed:{relative}\n")
    for relative in bundle.PROTOCOL_SURFACES:
        path = source / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"candidate:{relative}\n")


def test_private_bundle_captures_exact_preimages_metadata_inventory_and_restores_known_postimages(tmp_path: Path) -> None:
    source = tmp_path / "source"; source.mkdir()
    global_pre = source / "AGENTS.md"; global_pre.write_bytes(b"before global\r\n")
    append_pre = source / "APPEND_SYSTEM.md"; append_pre.write_bytes(b"before append\n")
    global_post = source / "global.post"; global_post.write_bytes(b"after global\n")
    append_post = source / "append.post"; append_post.write_bytes(b"after append\n")
    installed = source / "installed"; installed.mkdir()
    managed_source = source / "managed-source"; managed_source.mkdir()
    populate_managed(installed, managed_source)
    (installed / bundle.MANAGED_FILES[0]).write_text("accepted baseline\n")
    (installed / bundle.MANAGED_FILES[1]).unlink()
    obsolete = installed / bundle.EXPECTED_ABSENT[0]; obsolete.parent.mkdir(parents=True, exist_ok=True); obsolete.write_text("accepted obsolete\n")
    (installed / "unrelated-secret.txt").write_text("DO-NOT-COPY")
    topology = source / "topology.json"; topology.write_text(json.dumps({"branch": "episode/x", "head": "a" * 40}) + "\n")
    secret = source / "unrelated-token.txt"; secret.write_text("DO-NOT-COPY")
    target = tmp_path / "private-bundle"

    result = bundle.create(ns(
        bundle=target, global_context=global_pre, append=append_pre,
        global_postimage=global_post, append_postimage=append_post,
        installed_root=installed, source_root=managed_source, candidate_postimage_root=managed_source, selected_file="AGENTS.md",
        known_good_generation="accepted-generation", source_topology=topology,
        restore_tool=[BUNDLE],
    ))
    assert result["manifestSha256"] == (target / "manifest.sha256").read_text().strip()
    verified = bundle.verify(ns(bundle=target))
    assert verified == {"schemaVersion": 1, "status": "VERIFIED", "manifestSha256": result["manifestSha256"], "inventoryEntries": len(bundle.MANAGED_FILES) + len(bundle.EXPECTED_ABSENT) + len(bundle.PROTOCOL_SURFACES) + len(bundle.MUTABLE_SURFACES)}
    manifest = json.loads((target / "manifest.json").read_text())
    assert manifest["selectedFileDecision"] == "AGENTS.md"
    assert manifest["currentKnownGoodGeneration"] == "accepted-generation"
    assert manifest["preimages"]["globalContext"]["newlineStyle"] == "crlf"
    assert manifest["preimages"]["globalContext"]["finalNewline"] is True
    assert manifest["installedInventory"][0]["path"] == bundle.MANAGED_FILES[0]
    assert manifest["installedInventory"][0]["candidateEqual"] is False
    assert manifest["installedInventory"][1]["observed"] == "absent"
    assert [entry["path"] for entry in manifest["installedInventory"]] == list(bundle.MANAGED_FILES) + list(bundle.EXPECTED_ABSENT) + list(bundle.PROTOCOL_SURFACES) + list(bundle.MUTABLE_SURFACES)
    assert manifest["sourceTopology"]["branch"] == "episode/x"
    assert manifest["restoreToolset"][0]["sha256"] == bundle.digest(BUNDLE.read_bytes())
    assert b"DO-NOT-COPY" not in b"".join(path.read_bytes() for path in target.rglob("*") if path.is_file())

    for relative in bundle.MANAGED_FILES:
        destination = installed / relative; destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((managed_source / relative).read_bytes())
    for relative in bundle.EXPECTED_ABSENT:
        destination = installed / relative
        if destination.exists(): destination.unlink()
    for relative in bundle.PROTOCOL_SURFACES:
        destination = installed / relative; destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes((managed_source / relative).read_bytes())
    for relative in bundle.MUTABLE_SURFACES:
        destination = installed / relative; destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_text("post-cutover mutable state\n")
    installed_restored = bundle.restore_installed(ns(bundle=target, installed_root=installed))
    assert installed_restored["status"] == "INSTALLED_RESTORED"
    assert (installed / bundle.MANAGED_FILES[0]).read_text() == "accepted baseline\n"
    assert not (installed / bundle.MANAGED_FILES[1]).exists()
    assert (installed / bundle.EXPECTED_ABSENT[0]).read_text() == "accepted obsolete\n"
    assert not (installed / bundle.PROTOCOL_SURFACES[0]).exists()
    assert all(not (installed / relative).exists() for relative in bundle.MUTABLE_SURFACES)

    global_destination = tmp_path / "global-destination"; global_destination.write_bytes(global_post.read_bytes())
    append_destination = tmp_path / "append-destination"; append_destination.write_bytes(append_post.read_bytes())
    restored = bundle.restore(ns(bundle=target, global_context_destination=global_destination, append_destination=append_destination))
    assert restored["status"] == "RESTORED"
    assert global_destination.read_bytes() == global_pre.read_bytes()
    assert append_destination.read_bytes() == append_pre.read_bytes()


def test_private_bundle_restore_is_all_or_nothing_on_unknown_current_content(tmp_path: Path) -> None:
    source = tmp_path / "source"; source.mkdir()
    files = {}
    for name, data in {
        "global": b"global-before\n", "append": b"append-before\n",
        "global-post": b"global-after\n", "append-post": b"append-after\n",
    }.items():
        files[name] = source / name; files[name].write_bytes(data)
    installed = source / "installed"; installed.mkdir()
    managed_source = source / "managed-source"; managed_source.mkdir()
    populate_managed(installed, managed_source)
    topology = source / "topology"; topology.write_text("{}\n")
    target = tmp_path / "bundle"
    bundle.create(ns(bundle=target, global_context=files["global"], append=files["append"], global_postimage=files["global-post"], append_postimage=files["append-post"], installed_root=installed, source_root=managed_source, candidate_postimage_root=managed_source, selected_file="AGENTS.md", known_good_generation="g", source_topology=topology, restore_tool=[BUNDLE]))
    gd = tmp_path / "gd"; gd.write_bytes(files["global-post"].read_bytes())
    ad = tmp_path / "ad"; ad.write_bytes(b"drift")
    with pytest.raises(ValueError, match="known postimage"):
        bundle.restore(ns(bundle=target, global_context_destination=gd, append_destination=ad))
    assert gd.read_bytes() == files["global-post"].read_bytes()
    assert ad.read_bytes() == b"drift"


class RecordingRunner:
    def __init__(self, config, *, stale_after_shutdown=False, fail_label=None, process_rows=None, readiness=None, child_exit=None, initial_status=None, discovery_failure=False, version_result=None):
        self.config = config
        self.calls = []
        self.labels = []
        self.started = []
        self.landed = False
        self.pushed = False
        self.shutdown = False
        self.runtime_started = False
        self.ps_count = 0
        self.stale_after_shutdown = stale_after_shutdown
        self.fail_label = fail_label
        self.process_rows_override = process_rows
        self.readiness = list(readiness or ["current"])
        self.readiness_index = 0
        self.child_exit = child_exit
        self.initial_status = initial_status
        self.discovery_failure = discovery_failure
        self.version_result = version_result

    def _label(self, argv):
        text = " ".join(argv)
        if "shutdown --force --json" in text: return "shutdown"
        if argv[:3] == ("git", "merge", "--ff-only"): return "landing"
        if argv and argv[0].endswith("apply-prime-agent-plugin.sh"): return "apply"
        if argv and argv[0].endswith("check-prime-agent-plugin.sh"): return "check"
        if argv[-2:] == ("status", "--json") and self.runtime_started: return "status"
        return "other"

    def _status_row(self, pid, status="current"):
        c = self.config
        return {"socketPath": c["runtime"]["daemonSocket"], "pid": pid, "version": c["runtime"]["version"], "buildId": c["runtime"]["buildId"], "executablePath": c["runtime"]["entrypointRealpath"], "status": status, "isDefault": True}

    def run_version(self, argv, *, cwd=None, timeout=10):
        argv = tuple(argv); self.calls.append(argv)
        self.labels.append(self._label(argv))
        c = self.config
        if self.version_result is not None:
            return coord.RawResult(argv, *self.version_result)
        return coord.RawResult(argv, 0, c["runtime"]["version"].encode("utf-8") + b"\n", b"")

    def run(self, argv, *, cwd=None, allow_failure=False, timeout=None):
        argv = tuple(argv); self.calls.append(argv)
        label = self._label(argv); self.labels.append(label)
        if self.fail_label == label:
            raise coord.CutoverError(f"injected {label} failure")
        c = self.config; exe = c["runtime"]["executableRealpath"]
        if argv[0].endswith("manage-prime-agent-cutover-bundle.py"):
            output = {"status": "VERIFIED", "manifestSha256": c["bundle"]["manifestSha256"]}
            return coord.Result(argv, 0, json.dumps(output), "")
        cli = tuple(c["runtime"]["cliArgvPrefix"])
        if argv == ("pgrep", "-x", "prime-agent"):
            self.ps_count += 1
            if self.discovery_failure:
                return coord.Result(argv, 2, "", "injected discovery failure")
            running = self.ps_count == 1 or self.stale_after_shutdown
            if self.process_rows_override is not None and self.ps_count == 1:
                pids = [line.strip().split(None, 1)[0] for line in self.process_rows_override.splitlines() if line.strip()]
            elif running:
                pids = [str(entry["pid"]) for entry in c["processInventory"] if entry["expectedPresent"]]
            else:
                pids = []
            self._current_process_pids = pids
            return coord.Result(argv, 0 if pids else 1, "\n".join(pids) + ("\n" if pids else ""), "")
        if len(argv) >= 5 and argv[0:2] == ("ps", "-p") and argv[3:] == ("-o", "pid=,ppid=,command="):
            if self.process_rows_override is not None and self.ps_count == 1:
                out = self.process_rows_override
            else:
                rows = []
                for entry in c["processInventory"]:
                    if str(entry["pid"]) in getattr(self, "_current_process_pids", []):
                        ppid = entry.get("parentPid", 1)
                        rows.append(f"{entry['pid']} {ppid} prime-agent")
                out = "\n".join(rows) + ("\n" if rows else "")
            return coord.Result(argv, 0 if out else 1, out, "")
        if argv == ("git", "rev-parse", "--path-format=absolute", "--git-dir") or argv == ("git", "rev-parse", "--path-format=absolute", "--git-common-dir"):
            return coord.Result(argv, 0, str(Path(c["main"]["checkout"]) / ".git") + "\n", "")
        if argv == ("git", "symbolic-ref", "--quiet", "--short", "HEAD"):
            return coord.Result(argv, 0, c["main"]["branch"] + "\n", "")
        if argv == ("git", "status", "--porcelain"):
            return coord.Result(argv, 0, "", "")
        if argv == ("git", "rev-parse", "HEAD"):
            value = c["candidate"]["commit"] if self.landed else c["main"]["prelandingCommit"]
            return coord.Result(argv, 0, value + "\n", "")
        if argv == ("git", "rev-parse", c["candidate"]["commit"] + "^{tree}"):
            return coord.Result(argv, 0, c["candidate"]["tree"] + "\n", "")
        if argv == ("git", "rev-parse", c["main"]["prelandingCommit"] + "^{tree}"):
            return coord.Result(argv, 0, "9" * 40 + "\n", "")
        if argv[:2] == ("git", "ls-remote"):
            value = c["candidate"]["commit"] if self.pushed else c["main"]["prelandingCommit"]
            return coord.Result(argv, 0, value + "	refs/heads/main\n", "")
        if argv[:3] == ("git", "merge-base", "--is-ancestor"):
            return coord.Result(argv, 0, "", "")
        if argv[:3] == ("git", "cat-file", "-e"):
            oid = argv[3].removesuffix("^{commit}")
            if oid not in {"a" * 40, "b" * 40, "c" * 40, "e" * 40, "f" * 40}:
                raise coord.CutoverError("object does not resolve to a commit")
            return coord.Result(argv, 0, "", "")
        if argv[:5] == ("git", "rev-list", "--parents", "-n", "1"):
            oid = argv[5]
            actual = {"c" * 40: "b" * 40, "b" * 40: "e" * 40}
            if oid == "e" * 40:
                row = [oid, "f" * 40, "a" * 40]
            else:
                row = [oid, actual[oid]]
            return coord.Result(argv, 0, " ".join(row) + "\n", "")
        if argv[:4] == ("git", "clone", "--no-local", "--no-checkout") or argv[:3] == ("git", "checkout", "--detach") or argv[:3] == ("git", "revert", "--no-commit"):
            return coord.Result(argv, 0, "", "")
        if argv == ("git", "write-tree"):
            return coord.Result(argv, 0, "9" * 40 + "\n", "")
        if argv == (*cli, "status", "--json"):
            if self.runtime_started:
                value = self.readiness[min(self.readiness_index, len(self.readiness) - 1)]
                self.readiness_index += 1
                if value == "malformed":
                    return coord.Result(argv, 0, "not-json", "")
                if isinstance(value, list):
                    return coord.Result(argv, 0, json.dumps(value), "")
                return coord.Result(argv, 0, json.dumps([self._status_row(999, value)]), "")
            old_daemon = next(entry for entry in c["processInventory"] if entry["role"] == "daemon" and entry["expectedPresent"])
            if not self.shutdown and self.initial_status is not None:
                if self.initial_status == "malformed":
                    return coord.Result(argv, 0, "not-json", "")
                return coord.Result(argv, 0, json.dumps(self.initial_status), "")
            return coord.Result(argv, 0, "[]" if self.shutdown else json.dumps([self._status_row(old_daemon["pid"])]), "")
        if argv == (*cli, "shutdown", "--force", "--json"):
            self.shutdown = True
            return coord.Result(argv, 0, '{"stopped":[],"failed":[]}\n', "")
        if argv[:3] == ("git", "merge", "--ff-only"):
            self.landed = True; return coord.Result(argv, 0, "", "")
        if argv[:2] == ("git", "push"):
            self.pushed = True; return coord.Result(argv, 0, "", "")
        if argv and argv[0].endswith("apply-prime-agent-plugin.sh"):
            receipt = Path(argv[argv.index("--role-receipt") + 1])
            receipt.write_text(json.dumps({"transaction": "applied"}) + "\n")
        return coord.Result(argv, 0, "", "")

    def start(self, argv, *, cwd=None):
        argv = tuple(argv); self.started.append(argv)
        if self.fail_label == "start":
            raise coord.CutoverError("injected start failure")
        self.runtime_started = True
        return coord.Result(argv, 0, '{"pid":999}\n', "")

    def child_exit_code(self, pid):
        assert pid == 999
        return self.child_exit


def cutover_config(tmp_path: Path):
    primary = tmp_path / "primary"; primary.mkdir(parents=True)
    exe = str(Path(sys.executable).resolve())
    bundle_path = tmp_path / "private-bundle"; bundle_path.mkdir()
    candidate = "c" * 40; blocked = "b" * 40; merge = "e" * 40
    accepted = "f" * 40; baseline = "a" * 40; baseline_tree = "9" * 40
    return {
        "schemaVersion": 1,
        "operationId": "gate-a-authority-1",
        "rollbackRecipe": {
            "integrationMerge": {"commit": merge, "parents": [accepted, baseline], "mainline": 2},
            "linearReverts": [candidate, blocked],
            "acceptedBaseline": {"commit": baseline, "tree": baseline_tree},
            "commitMessage": "Rollback Prime Claw Generation A cutover",
        },
        "candidate": {"commit": candidate, "tree": "d" * 40},
        "main": {"checkout": str(primary), "remote": "origin", "branch": "main", "prelandingCommit": baseline},
        "runtime": {
            "entrypointKind": "compiled", "cliArgvPrefix": [exe],
            "executableRealpath": exe, "executableSha256": bundle.digest(Path(exe).read_bytes()),
            "entrypointRealpath": exe, "entrypointSha256": bundle.digest(Path(exe).read_bytes()),
            "version": "0.9.8", "buildId": "cwd-fix-v0.9.8-r1",
            "daemonSocket": str(tmp_path / "daemon.sock"),
            "startArgs": [exe, "--mode", "daemon", "--daemon-socket", str(tmp_path / "daemon.sock")],
            "readiness": {"attempts": 3, "intervalSeconds": 0, "deadlineSeconds": 2},
        },
        "bundle": {"path": str(bundle_path), "manifestSha256": "b" * 64},
        "operator": {"clientsExited": True, "foreignOwnersCheckpointed": True, "bundleVerified": True, "isolatedRestoreVerified": True, "executeAuthorized": True},
        "processInventory": [{
            "pid": 123, "role": "daemon", "entrypointKind": "compiled",
            "version": "0.9.8", "buildId": "cwd-fix-v0.9.8-r1", "daemonSocket": str(tmp_path / "daemon.sock"),
            "expectedPresent": True, "acknowledgedExit": False,
        }],
        "sessions": [
            {"role": "owner", "sessionId": "owner-id", "name": "owner", "cwd": "/repo", "checkpoint": "owner-checkpoint"},
            {"role": "episode", "sessionId": "episode-id", "name": "episode", "cwd": "/worktree", "checkpoint": "episode-checkpoint"},
            {"role": "ordinary", "sessionId": "ordinary-id", "name": "ordinary", "cwd": "/tmp", "checkpoint": "ordinary-checkpoint", "baselineTurn": True},
        ],
    }


def test_preflight_is_inert_and_records_inventory_build_mapping_and_bundle(tmp_path: Path) -> None:
    config = cutover_config(tmp_path); runner = RecordingRunner(config)
    result = coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert result["status"] == "PREFLIGHT_VERIFIED"
    flat = [" ".join(call) for call in runner.calls]
    assert "pgrep -x prime-agent" in flat
    assert any(call.startswith("ps -p ") for call in flat)
    assert any(call.endswith("--version") for call in flat)
    assert any("manage-prime-agent-cutover-bundle.py verify" in call for call in flat)
    assert not any("shutdown --force --json" in call for call in flat)
    assert not any(call.startswith("git merge --ff-only") for call in flat)
    assert runner.started == []


def test_execute_orders_shutdown_zero_stale_landing_apply_check_start_status_and_resume(tmp_path: Path) -> None:
    config = cutover_config(tmp_path); runner = RecordingRunner(config)
    result = coord.Coordinator(config, tmp_path / "state", runner).execute("c" * 40)
    assert result["status"] == "RESUME_CHECKLIST_EMITTED"
    assert [entry["role"] for entry in result["resumeChecklist"]] == ["owner", "episode", "ordinary"]
    flat = [" ".join(call) for call in runner.calls]
    def at(fragment): return next(index for index, call in enumerate(flat) if fragment in call)
    assert at("shutdown --force --json") < at("git merge --ff-only") < at("git push")
    assert at("apply-prime-agent-plugin.sh --user-global") < at("check-prime-agent-plugin.sh --user-global")
    assert at("check-prime-agent-plugin.sh --user-global") < len(flat) - 1
    assert runner.ps_count == 3  # inventory, post-shutdown gate, pre-start gate
    assert runner.started == [tuple(config["runtime"]["startArgs"])]
    checkpoint = json.loads((tmp_path / "state/cutover-checkpoint.json").read_text())
    assert checkpoint["checkpoint"] == "RESUME_CHECKLIST_EMITTED"


def test_persistent_stale_process_stops_before_landing(tmp_path: Path) -> None:
    config = cutover_config(tmp_path); runner = RecordingRunner(config, stale_after_shutdown=True)
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)
    with pytest.raises(coord.CutoverError, match="stale Prime Agent processes remain"):
        coordinator.execute("c" * 40)
    assert coordinator.last_checkpoint == "SHUTDOWN_REQUESTED"
    assert not runner.landed and not runner.pushed and not runner.started


@pytest.mark.parametrize(
    ("failure", "checkpoint", "recovery_fragment"),
    [
        ("shutdown", "SHUTDOWN_REQUESTED", "do not assume"),
        ("landing", "LANDING_REQUESTED", "without retrying"),
        ("apply", "APPLY_REQUESTED", "fixed managed surfaces"),
        ("check", "APPLY_REQUESTED", "fixed managed surfaces"),
        ("start", "START_REQUESTED", "do not start a second"),
        ("status", "START_REQUESTED", "do not start a second"),
    ],
)
def test_checkpoint_recovery_stops_without_retry(tmp_path: Path, failure: str, checkpoint: str, recovery_fragment: str) -> None:
    config = cutover_config(tmp_path); runner = RecordingRunner(config, fail_label=failure)
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)
    with pytest.raises(coord.CutoverError, match=recovery_fragment):
        coordinator.execute("c" * 40)
    assert coordinator.last_checkpoint == checkpoint
    labels = runner.labels + (["start"] if runner.started else [])
    assert labels.count(failure) <= 1


def test_execute_requires_exact_candidate_authorization(tmp_path: Path) -> None:
    config = cutover_config(tmp_path); runner = RecordingRunner(config)
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)
    with pytest.raises(coord.CutoverError, match="exact candidate"):
        coordinator.execute("wrong")
    assert runner.calls == [] and runner.started == []


def test_resume_order_and_runtime_inventory_are_fail_closed(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    config["sessions"][0], config["sessions"][1] = config["sessions"][1], config["sessions"][0]
    with pytest.raises(coord.CutoverError, match="ordered owner"):
        coord.Coordinator(config, tmp_path / "state", RecordingRunner(config)).preflight()
    config = cutover_config(tmp_path / "second")
    config["processInventory"][0]["buildId"] = ""
    with pytest.raises(coord.CutoverError, match="must be a non-empty string"):
        coord.Coordinator(config, tmp_path / "state-2", RecordingRunner(config)).preflight()

def test_final_source_inventory_reflects_markdown_only_expert_workflow() -> None:
    apply_text = (ROOT / "scripts/apply-prime-agent-plugin.sh").read_text()
    check_text = (ROOT / "scripts/check-prime-agent-plugin.sh").read_text()
    cleanup_text = (ROOT / "scripts/cleanup-retired-prime-agent-expert-review.py").read_text()
    guide = (ROOT / "docs/lab-global-plugin.md").read_text()
    assert len(bundle.MANAGED_FILES) == 29
    inventoried = {
        row["source"] for row in json.loads((ROOT / "src/prime-agent-plugin/asset-inventory.json").read_text())["assets"]
    }
    for relative in bundle.MANAGED_FILES:
        assert Path(ROOT / "src/prime-agent-plugin" / relative).is_file(), relative
        assert (relative in apply_text and relative in check_text) or relative in inventoried, relative
    assert 'managed_skill_relative="skills/prime-claw-oversee-episode/SKILL.md"' in apply_text
    assert 'expert_skill_relative="skills/prime-claw-expert-review/SKILL.md"' in apply_text
    assert "prime-claw-expert-review/SKILL.md" in guide
    assert "Python-backed package" not in guide
    for relative in bundle.EXPECTED_ABSENT:
        assert not (ROOT / "src/prime-agent-plugin" / relative).exists()
    for relative in bundle.EXPECTED_ABSENT[:6]:
        assert relative in apply_text and relative in check_text
    assert "prime-claw-official-expert-review" in cleanup_text
    assert "expert-review-launches" in cleanup_text
    assert not (ROOT / ".ralph/skills/oversee-episode").exists()
    assert not (ROOT / ".agents/skills/oversee-episode").exists()
    assert not (ROOT / ".agents/skills/oversee-episode").is_symlink()
    assert not (ROOT / ".prime/agent/profiles/expert-reviewer.md").exists()
    assert not (ROOT / "src/prime-agent-plugin/APPEND_SYSTEM.md").exists()
    assert not (ROOT / "scripts/manage-prime-agent-append-system.py").exists()
    assert not (ROOT / "scripts/generate-prime-agent-role-kernel.py").exists()
    assert not (ROOT / "scripts/check-prime-agent-expert-runtime.py").exists()
    assert json.loads((ROOT / "src/prime-agent-plugin/role-protocol.json").read_text()) == {
        "schemaVersion": 1, "generation": "final",
    }

def test_bundle_verify_rejects_unexpected_files_and_required_secret_patterns(tmp_path: Path) -> None:
    source = tmp_path / "source"; source.mkdir()
    installed = source / "installed"; installed.mkdir()
    managed_source = source / "managed"; managed_source.mkdir()
    populate_managed(installed, managed_source)
    topology = source / "topology"; topology.write_text("{}\n")
    global_pre = source / "AGENTS.md"; global_pre.write_text("ordinary\n")
    append = source / "APPEND_SYSTEM.md"; append.write_text("append\n")
    global_post = source / "global.post"; global_post.write_text("post\n")
    append_post = source / "append.post"; append_post.write_text("post append\n")
    target = tmp_path / "bundle"
    args = ns(bundle=target, global_context=global_pre, append=append, global_postimage=global_post, append_postimage=append_post, installed_root=installed, source_root=managed_source, candidate_postimage_root=managed_source, selected_file="AGENTS.md", known_good_generation="g", source_topology=topology, restore_tool=[BUNDLE])
    bundle.create(args)
    (target / "unexpected-private-file").write_text("x")
    with pytest.raises(ValueError, match="unexpected files"):
        bundle.verify(ns(bundle=target))
    secret_target = tmp_path / "secret-bundle"
    global_pre.write_text("token sk-abcdefghijklmnopqrstuvwxyz123456\n")
    args.bundle = secret_target
    with pytest.raises(ValueError, match="likely credential"):
        bundle.create(args)
    assert not secret_target.exists()


def test_exact_preflight_checkpoint_can_advance_once_to_authorized_execute(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    first = RecordingRunner(config)
    coord.Coordinator(config, tmp_path / "state", first).preflight()
    second = RecordingRunner(config)
    result = coord.Coordinator(config, tmp_path / "state", second).execute("c" * 40)
    assert result["status"] == "RESUME_CHECKLIST_EMITTED"
    with pytest.raises(coord.CutoverError, match="automatic retry is forbidden"):
        coord.Coordinator(config, tmp_path / "state", RecordingRunner(config))

def operational_calls(runner):
    flat = [" ".join(call) for call in runner.calls]
    return [call for call in flat if "shutdown --force --json" in call or call.startswith("git merge --ff-only") or "apply-prime-agent-plugin.sh" in call]


def test_preflight_rejects_observed_declared_live_tui_before_mutation(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    config["processInventory"].append({
        "pid": 456, "role": "tui", "entrypointKind": "compiled",
        "version": "0.9.8", "buildId": "cwd-fix-v0.9.8-r1",
        "daemonSocket": str(tmp_path / "tui.sock"),
        "expectedPresent": False, "acknowledgedExit": True,
    })
    rows = "123 1 prime-agent\n456 1 prime-agent\n"
    runner = RecordingRunner(config, process_rows=rows)
    with pytest.raises(coord.CutoverError, match="tui must be absent"):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert operational_calls(runner) == []
    assert not any(call[:3] == ("git", "clone", "--no-local") for call in runner.calls)
    assert runner.started == []


def test_preflight_supports_exact_node_interpreter_entrypoint(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    entrypoint = tmp_path / "prime-agent-entrypoint.js"
    entrypoint.write_text("// exact tested entrypoint\n")
    exe = config["runtime"]["executableRealpath"]
    config["runtime"].update({
        "entrypointKind": "node",
        "cliArgvPrefix": [exe, str(entrypoint)],
        "entrypointRealpath": str(entrypoint),
        "entrypointSha256": bundle.digest(entrypoint.read_bytes()),
        "startArgs": [exe, str(entrypoint), "--mode", "daemon", "--daemon-socket", config["runtime"]["daemonSocket"]],
    })
    config["processInventory"][0]["entrypointKind"] = "node"
    runner = RecordingRunner(config)
    result = coord.Coordinator(config, tmp_path / "state", runner).execute(config["candidate"]["commit"])
    assert result["status"] == "RESUME_CHECKLIST_EMITTED"
    prefix = tuple(config["runtime"]["cliArgvPrefix"])
    assert (*prefix, "--version") in runner.calls
    assert (*prefix, "status", "--json") in runner.calls
    assert (*prefix, "shutdown", "--force", "--json") in runner.calls
    assert runner.started == [tuple(config["runtime"]["startArgs"])]


@pytest.mark.parametrize(
    "version_result",
    [(0, b"0.9.8\n", b""), (0, b"", b"0.9.8\n")],
)
def test_verify_executable_accepts_exact_lf_terminated_version_from_exactly_one_stream(
    tmp_path: Path,
    version_result: tuple[int, bytes, bytes],
) -> None:
    config = cutover_config(tmp_path)
    runner = RecordingRunner(config, version_result=version_result)
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)

    coordinator.validate_static()
    coordinator.verify_executable()

    assert runner.calls == [(*config["runtime"]["cliArgvPrefix"], "--version")]
    assert coordinator.observations["runtime"]["version"] == "0.9.8"


@pytest.mark.parametrize(
    ("version_result", "message"),
    [
        ((7, b"0.9.8\n", b""), "version command failed"),
        ((7, b"", b"0.9.8\n"), "version command failed"),
        ((0, b"0.9.8\n", b"0.9.8\n"), "exactly one stream"),
        ((0, b"", b""), "exactly one stream"),
        ((0, b"prime-agent 0.9.8\n", b""), "version mismatch"),
        ((0, b"", b"prime-agent 0.9.8\n"), "version mismatch"),
        ((0, b"0.9.8\nextra\n", b""), "version mismatch"),
        ((0, b"", b"extra\n0.9.8\n"), "version mismatch"),
        ((0, b"\n0.9.8\n", b""), "version mismatch"),
        ((0, b"0.9.8\n\n", b""), "version mismatch"),
        ((0, b"", b"\n0.9.8\n"), "version mismatch"),
        ((0, b"", b"0.9.8\n\n"), "version mismatch"),
        ((0, b"0.9.7\n", b""), "version mismatch"),
        ((0, b"", b"0.9.7\n"), "version mismatch"),
        ((0, b"0.9.8", b""), "version mismatch"),
        ((0, b"", b"0.9.8"), "version mismatch"),
        ((0, b"0.9.8\r\n", b""), "version mismatch"),
        ((0, b"", b"0.9.8\r\n"), "version mismatch"),
        ((0, b" 0.9.8\n", b""), "version mismatch"),
        ((0, b"", b"0.9.8 \n"), "version mismatch"),
    ],
)
def test_verify_executable_rejects_ambiguous_empty_extra_multiline_mismatch_or_nonzero_version_output(
    tmp_path: Path,
    version_result: tuple[int, bytes, bytes],
    message: str,
) -> None:
    config = cutover_config(tmp_path)
    runner = RecordingRunner(config, version_result=version_result)
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)

    coordinator.validate_static()
    with pytest.raises(coord.CutoverError, match=message):
        coordinator.verify_executable()

    assert runner.calls == [(*config["runtime"]["cliArgvPrefix"], "--version")]
    assert runner.started == []



def configure_node_version_emitter(config: dict, tmp_path: Path, *, stdout: bytes, stderr: bytes, returncode: int = 0, sleep_seconds: float = 0) -> Path:
    emitter = (tmp_path / "version-emitter.py").resolve()
    emitter.write_text(
        "import os, sys, time\n"
        "if sys.argv[1:] != ['--version']:\n"
        "    raise SystemExit(91)\n"
        f"time.sleep({sleep_seconds!r})\n"
        f"os.write(1, {stdout!r})\n"
        f"os.write(2, {stderr!r})\n"
        f"raise SystemExit({returncode})\n"
    )
    executable = Path(sys.executable).resolve()
    config["runtime"].update({
        "entrypointKind": "node",
        "cliArgvPrefix": [str(executable), str(emitter)],
        "executableRealpath": str(executable),
        "executableSha256": bundle.digest(executable.read_bytes()),
        "entrypointRealpath": str(emitter),
        "entrypointSha256": bundle.digest(emitter.read_bytes()),
        "startArgs": [str(executable), str(emitter), "--mode", "daemon", "--daemon-socket", config["runtime"]["daemonSocket"]],
    })
    config["processInventory"][0]["entrypointKind"] = "node"
    return emitter


class ObservingLocalRunner(coord.LocalRunner):
    def __init__(self) -> None:
        super().__init__()
        self.version_calls: list[tuple[tuple[str, ...], dict[str, object]]] = []
        self.version_results: list[coord.RawResult] = []
        self.text_calls: list[tuple[str, ...]] = []

    def run_version(self, argv, **kwargs):
        self.version_calls.append((tuple(argv), dict(kwargs)))
        result = super().run_version(argv, **kwargs)
        self.version_results.append(result)
        return result

    def run(self, argv, **kwargs):
        argv = tuple(argv)
        self.text_calls.append(argv)
        if argv and argv[0].endswith("manage-prime-agent-cutover-bundle.py"):
            return coord.Result(argv, 0, json.dumps({"status": "VERIFIED", "manifestSha256": "b" * 64}), "")
        return super().run(argv, **kwargs)


@pytest.mark.parametrize(
    ("stdout", "stderr", "returncode", "accepted", "message"),
    [
        (b"0.9.8\n", b"", 0, True, None),
        (b"", b"0.9.8\n", 0, True, None),
        (b"0.9.8\r\n", b"", 0, False, "version mismatch"),
        (b"", b"0.9.8\r\n", 0, False, "version mismatch"),
        (b"0.9.8\r", b"", 0, False, "version mismatch"),
        (b"", b"0.9.8\r", 0, False, "version mismatch"),
        (b"0.9.8", b"", 0, False, "version mismatch"),
        (b"", b"0.9.8", 0, False, "version mismatch"),
        (b"0.9.8\n", b"0.9.8\n", 0, False, "exactly one stream"),
        (b"", b"", 0, False, "exactly one stream"),
        (b" 0.9.8\n", b"", 0, False, "version mismatch"),
        (b"", b"0.9.8 \n", 0, False, "version mismatch"),
        (b"0.9.8\nextra\n", b"", 0, False, "version mismatch"),
        (b"", b"\n0.9.8\n", 0, False, "version mismatch"),
        (b"0.9.8\n\n", b"", 0, False, "version mismatch"),
        (b"", b"0.9.7\n", 0, False, "version mismatch"),
        (b"\xff\n", b"", 0, False, "version mismatch"),
        (b"", b"0.9.8\n", 7, False, "version command failed"),
    ],
)
def test_production_version_adapter_preserves_exact_raw_stream_bytes(
    tmp_path: Path,
    stdout: bytes,
    stderr: bytes,
    returncode: int,
    accepted: bool,
    message: str | None,
) -> None:
    config = cutover_config(tmp_path)
    configure_node_version_emitter(config, tmp_path, stdout=stdout, stderr=stderr, returncode=returncode)
    runner = ObservingLocalRunner()
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)
    coordinator.validate_static()

    if accepted:
        coordinator.verify_executable()
        coordinator.verify_executable()
        assert coordinator.observations["runtime"]["version"] == "0.9.8"
        assert len(runner.version_results) == 2
        assert all(result.stdout == stdout and result.stderr == stderr for result in runner.version_results)
    else:
        for _ in range(2):
            with pytest.raises(coord.CutoverError, match=message):
                coordinator.verify_executable()
        assert len(runner.version_results) == 2
        assert all(result.stdout == stdout and result.stderr == stderr for result in runner.version_results)

    expected_argv = tuple(config["runtime"]["cliArgvPrefix"] + ["--version"])
    assert runner.version_calls == [
        (expected_argv, {"cwd": None, "timeout": 10})
    ] * 2
    assert runner.text_calls == []
    assert runner.children == {}


def test_production_version_adapter_failure_stops_preflight_before_downstream_commands(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    configure_node_version_emitter(config, tmp_path, stdout=b"0.9.8\r\n", stderr=b"")
    runner = ObservingLocalRunner()

    with pytest.raises(coord.CutoverError, match="version mismatch"):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()

    assert len(runner.version_calls) == 1
    assert runner.version_results[0].stdout == b"0.9.8\r\n"
    assert len(runner.text_calls) == 1
    assert runner.text_calls[0][0].endswith("manage-prime-agent-cutover-bundle.py")
    assert not any(call[-2:] == ("status", "--json") for call in runner.text_calls)
    assert not any(call[:3] == ("git", "clone", "--no-local") for call in runner.text_calls)
    assert runner.children == {}


def test_production_version_adapter_timeout_is_bounded_and_reaps_child(tmp_path: Path) -> None:
    pid_file = tmp_path / "version-emitter.pid"
    emitter = (tmp_path / "slow-version-emitter.py").resolve()
    emitter.write_text(
        "import os, pathlib, time\n"
        f"pathlib.Path({str(pid_file)!r}).write_text(str(os.getpid()))\n"
        "time.sleep(60)\n"
        "os.write(1, b'0.9.8\\n')\n"
    )
    runner = ObservingLocalRunner()
    started = time.monotonic()

    with pytest.raises(coord.CutoverError, match="command timed out"):
        runner.run_version((sys.executable, str(emitter), "--version"), timeout=0.2)

    elapsed = time.monotonic() - started
    assert elapsed < 3
    assert len(runner.version_calls) == 1
    pid = int(pid_file.read_text())
    with pytest.raises(ProcessLookupError):
        os.kill(pid, 0)
    assert runner.children == {}

def test_supported_prime_agent_098_wrapper_uses_exact_stderr_version_interface(tmp_path: Path) -> None:
    wrapper = Path("/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source/prime-agent.sh")
    if not wrapper.is_file():
        pytest.skip(f"supported Prime Agent 0.9.8 wrapper is unavailable: {wrapper}")
    wrapper = wrapper.resolve()

    class CapturingLocalRunner(coord.LocalRunner):
        def __init__(self) -> None:
            super().__init__()
            self.results: list[coord.RawResult] = []
            self.calls: list[tuple[tuple[str, ...], dict[str, object]]] = []

        def run_version(self, argv, **kwargs):
            self.calls.append((tuple(argv), dict(kwargs)))
            result = super().run_version(argv, **kwargs)
            self.results.append(result)
            return result

    config = cutover_config(tmp_path)
    wrapper_sha = bundle.digest(wrapper.read_bytes())
    config["runtime"].update({
        "entrypointKind": "compiled",
        "cliArgvPrefix": [str(wrapper)],
        "executableRealpath": str(wrapper),
        "executableSha256": wrapper_sha,
        "entrypointRealpath": str(wrapper),
        "entrypointSha256": wrapper_sha,
        "version": "0.9.8",
        "startArgs": [str(wrapper), "--mode", "daemon", "--daemon-socket", config["runtime"]["daemonSocket"]],
    })
    runner = CapturingLocalRunner()
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)

    coordinator.validate_static()
    coordinator.verify_executable()

    assert runner.calls == [((str(wrapper), "--version"), {"cwd": None, "timeout": 10})]
    assert len(runner.results) == 1
    assert runner.results[0].argv == (str(wrapper), "--version")
    assert runner.results[0].returncode == 0
    assert runner.results[0].stdout == b""
    assert runner.results[0].stderr == b"0.9.8\n"
    assert coordinator.observations["runtime"]["version"] == "0.9.8"


def test_preflight_rejects_same_version_wrong_build_before_status_or_git(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    config["runtime"]["entrypointSha256"] = "0" * 64
    runner = RecordingRunner(config)
    with pytest.raises(coord.CutoverError, match="build digest mismatch"):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert operational_calls(runner) == []
    assert not any(call[-2:] == ("status", "--json") for call in runner.calls)
    assert not any(call[:3] == ("git", "clone", "--no-local") for call in runner.calls)


def test_readiness_delays_read_only_after_exactly_one_start(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    runner = RecordingRunner(config, readiness=[[], "unreachable", "current"])
    result = coord.Coordinator(config, tmp_path / "state", runner).execute(config["candidate"]["commit"])
    assert result["status"] == "RESUME_CHECKLIST_EMITTED"
    assert runner.started == [tuple(config["runtime"]["startArgs"])]
    status_calls = [call for call in runner.calls if call[-2:] == ("status", "--json")]
    assert len(status_calls) == 5  # initial, stopped, and three bounded readiness observations


@pytest.mark.parametrize("case", ["malformed", "wrong-identity", "duplicate", "attempt-limit", "child-exit", "pending-missing-socket", "pending-wrong-pid", "malformed-rows"])
def test_readiness_failures_never_start_twice(tmp_path: Path, case: str) -> None:
    config = cutover_config(tmp_path)
    if case == "malformed":
        runner = RecordingRunner(config, readiness=["malformed"])
        match = "did not return JSON"
    elif case == "attempt-limit":
        config["runtime"]["readiness"]["attempts"] = 2
        runner = RecordingRunner(config, readiness=[[], []])
        match = "observation limit reached before deadline"
    elif case == "child-exit":
        runner = RecordingRunner(config, readiness=[[]], child_exit=17)
        match = "child exited.*17"
    else:
        runner = RecordingRunner(config)
        exact = runner._status_row(999)
        if case == "wrong-identity":
            exact["buildId"] = "same-version-wrong-build"
            runner.readiness = [[exact]]
            match = "identity mismatch: buildId"
        elif case == "duplicate":
            runner.readiness = [[exact, dict(exact, pid=1000)]]
            match = "duplicate runtimes"
        elif case == "pending-missing-socket":
            runner.readiness = [[{"status": "unreachable"}]]
            match = "pending socket identity mismatch"
        elif case == "pending-wrong-pid":
            pending = runner._status_row(1000, "unreachable")
            runner.readiness = [[pending]]
            match = "pending identity mismatch: pid"
        else:
            runner.readiness = [["bad", "rows"]]
            match = "malformed rows"
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)
    with pytest.raises(coord.CutoverError, match=match):
        coordinator.execute(config["candidate"]["commit"])
    assert coordinator.last_checkpoint == "START_REQUESTED"
    assert runner.started == [tuple(config["runtime"]["startArgs"])]


def test_concrete_rollback_recipe_records_complete_resolvable_chain(tmp_path: Path) -> None:
    config = cutover_config(tmp_path); runner = RecordingRunner(config)
    result = coord.Coordinator(config, tmp_path / "state", runner).preflight()
    rollback = result["observations"]["rollback"]
    assert rollback["linearReverts"] == ["c" * 40, "b" * 40]
    assert rollback["integrationParents"] == ["f" * 40, "a" * 40]
    assert rollback["resultingTree"] == "9" * 40
    assert rollback["commands"] == [
        ["git", "revert", "--no-commit", "c" * 40],
        ["git", "revert", "--no-commit", "b" * 40],
        ["git", "revert", "--no-commit", "-m", "2", "e" * 40],
        ["git", "commit", "-m", "Rollback Prime Claw Generation A cutover"],
    ]
    assert any(call[:4] == ("git", "clone", "--no-local", "--no-checkout") for call in runner.calls)
    assert not any(call[:2] == ("git", "worktree") for call in runner.calls)


@pytest.mark.parametrize(
    ("mutation", "match"),
    [
        ("placeholder", "exact Git object IDs"),
        ("non-resolving-commit", "object does not resolve"),
        ("resolving-wrong-commit", "complete newest-to-oldest"),
        ("missing-linear", "complete newest-to-oldest"),
        ("wrong-mainline", "mainline must be 2"),
        ("wrong-baseline-tree", "baseline tree mismatch"),
    ],
)
def test_rollback_recipe_rejects_placeholder_wrong_topology_or_mainline_before_mutation(tmp_path: Path, mutation: str, match: str) -> None:
    config = cutover_config(tmp_path)
    if mutation == "placeholder":
        config["rollbackRecipe"]["linearReverts"][0] = "candidate-range"
    elif mutation == "non-resolving-commit":
        config["rollbackRecipe"]["linearReverts"][1] = "7" * 40
    elif mutation == "resolving-wrong-commit":
        config["rollbackRecipe"]["linearReverts"][1] = "f" * 40
    elif mutation == "missing-linear":
        config["rollbackRecipe"]["linearReverts"] = ["c" * 40]
    elif mutation == "wrong-mainline":
        config["rollbackRecipe"]["integrationMerge"]["mainline"] = 1
    else:
        config["rollbackRecipe"]["acceptedBaseline"]["tree"] = "8" * 40
    runner = RecordingRunner(config)
    with pytest.raises(coord.CutoverError, match=match):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert operational_calls(runner) == []
    assert runner.started == []

def make_bundle_case(tmp_path: Path, *, selected_file="AGENTS.md"):
    tmp_path.mkdir(parents=True, exist_ok=True)
    source = tmp_path / "source"; source.mkdir()
    global_pre = source / selected_file; global_pre.write_bytes(b"global-before\n")
    append_pre = source / "APPEND_SYSTEM.md"; append_pre.write_bytes(b"append-before\n")
    global_post = source / "global.post"; global_post.write_bytes(b"global-after\n")
    append_post = source / "append.post"; append_post.write_bytes(b"append-after\n")
    installed = source / "installed"; installed.mkdir()
    managed_source = source / "managed-source"; managed_source.mkdir()
    populate_managed(installed, managed_source)
    topology = source / "topology.json"; topology.write_text(json.dumps({"branch": "episode/x", "head": "a" * 40}) + "\n")
    target = tmp_path / "bundle"
    args = ns(
        bundle=target, global_context=global_pre, append=append_pre,
        global_postimage=global_post, append_postimage=append_post,
        installed_root=installed, source_root=managed_source,
        candidate_postimage_root=managed_source, selected_file=selected_file,
        known_good_generation="accepted-generation", source_topology=topology,
        restore_tool=[BUNDLE],
    )
    return args, {"global": global_pre, "append": append_pre, "global_post": global_post, "append_post": append_post, "installed": installed, "source": managed_source, "target": target}


@pytest.mark.parametrize("dangling", [False, True])
def test_create_rejects_visible_and_dangling_selected_context_symlink_before_bundle_mutation(tmp_path: Path, dangling: bool) -> None:
    args, paths = make_bundle_case(tmp_path)
    original = paths["global"]
    original.unlink()
    target = tmp_path / ("missing-context" if dangling else "real-context")
    if not dangling:
        target.write_text("real\n")
    original.symlink_to(target)
    with pytest.raises(ValueError, match="regular non-symlink"):
        bundle.create(args)
    assert not paths["target"].exists()
    if not dangling:
        assert target.read_text() == "real\n"


@pytest.mark.parametrize("dangling", [False, True])
def test_create_rejects_visible_and_dangling_bundle_root_symlink(tmp_path: Path, dangling: bool) -> None:
    args, paths = make_bundle_case(tmp_path)
    target = tmp_path / ("missing-bundle-target" if dangling else "bundle-target")
    if not dangling:
        target.mkdir(); (target / "sentinel").write_text("keep\n")
    paths["target"].symlink_to(target, target_is_directory=True)
    with pytest.raises(ValueError, match="bundle path must not be a symlink"):
        bundle.create(args)
    if not dangling:
        assert (target / "sentinel").read_text() == "keep\n"


@pytest.mark.parametrize(("component", "dangling"), [("parent", False), ("parent", True), ("leaf", False), ("leaf", True)])
def test_create_rejects_visible_or_dangling_fixed_managed_components(tmp_path: Path, component: str, dangling: bool) -> None:
    args, paths = make_bundle_case(tmp_path)
    installed = paths["installed"]
    if component == "parent":
        victim = installed / "extensions"
        shutil.rmtree(victim)
        target = tmp_path / ("missing-parent" if dangling else "external-parent")
        if not dangling:
            target.mkdir(); (target / "sentinel").write_text("keep\n")
        victim.symlink_to(target, target_is_directory=True)
    else:
        victim = installed / bundle.MANAGED_FILES[0]
        victim.unlink()
        target = tmp_path / ("missing-leaf" if dangling else "external-leaf")
        if not dangling:
            target.write_text("keep\n")
        victim.symlink_to(target)
    with pytest.raises(ValueError, match="must not be a symlink"):
        bundle.create(args)
    assert not paths["target"].exists()
    if not dangling:
        if target.is_dir():
            assert (target / "sentinel").read_text() == "keep\n"
        else:
            assert target.read_text() == "keep\n"


@pytest.mark.parametrize("dangling", [False, True])
def test_restore_rejects_visible_and_dangling_destination_symlink_before_any_restore(tmp_path: Path, dangling: bool) -> None:
    args, paths = make_bundle_case(tmp_path)
    bundle.create(args)
    global_destination = tmp_path / "global-destination"
    target = tmp_path / ("missing-destination" if dangling else "real-destination")
    if not dangling:
        target.write_bytes(paths["global_post"].read_bytes())
    global_destination.symlink_to(target)
    append_destination = tmp_path / "append-destination"
    append_destination.write_bytes(paths["append_post"].read_bytes())
    before_append = append_destination.read_bytes()
    with pytest.raises(ValueError, match="regular non-symlink"):
        bundle.restore(ns(bundle=paths["target"], global_context_destination=global_destination, append_destination=append_destination))
    assert append_destination.read_bytes() == before_append
    if not dangling:
        assert target.read_bytes() == paths["global_post"].read_bytes()


@pytest.mark.parametrize("dangling", [False, True])
def test_verify_rejects_visible_and_dangling_supplied_bundle_symlink(tmp_path: Path, dangling: bool) -> None:
    args, paths = make_bundle_case(tmp_path)
    bundle.create(args)
    supplied = tmp_path / "supplied-bundle"
    supplied.symlink_to(tmp_path / "missing" if dangling else paths["target"], target_is_directory=True)
    with pytest.raises(ValueError, match="real directory"):
        bundle.verify(ns(bundle=supplied))


@pytest.mark.parametrize("selected", ["AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"])
def test_bundle_preserves_supported_selected_context_naming(tmp_path: Path, selected: str) -> None:
    args, paths = make_bundle_case(tmp_path, selected_file=selected)
    bundle.create(args)
    manifest = json.loads((paths["target"] / "manifest.json").read_text())
    assert manifest["selectedFileDecision"] == selected


def test_bundle_rejects_nonregular_selected_input_and_destination(tmp_path: Path) -> None:
    args, paths = make_bundle_case(tmp_path / "create")
    paths["global"].unlink(); paths["global"].mkdir()
    with pytest.raises(ValueError, match="regular non-symlink"):
        bundle.create(args)
    args, paths = make_bundle_case(tmp_path / "restore")
    bundle.create(args)
    gd = tmp_path / "restore/gd"; gd.mkdir()
    ad = tmp_path / "restore/ad"; ad.write_bytes(paths["append_post"].read_bytes())
    with pytest.raises(ValueError, match="regular non-symlink"):
        bundle.restore(ns(bundle=paths["target"], global_context_destination=gd, append_destination=ad))


def test_equal_bytes_mode_drift_is_restored_for_context_and_installed_then_replay_is_complete(tmp_path: Path) -> None:
    args, paths = make_bundle_case(tmp_path)
    os.chmod(paths["global"], 0o640)
    first_installed = paths["installed"] / bundle.MANAGED_FILES[0]
    os.chmod(first_installed, 0o600)
    bundle.create(args)

    gd = tmp_path / "gd"; gd.write_bytes(paths["global"].read_bytes()); os.chmod(gd, 0o644)
    ad = tmp_path / "ad"; ad.write_bytes(paths["append"].read_bytes())
    os.chmod(ad, paths["append"].stat().st_mode & 0o777)
    restored = bundle.restore(ns(bundle=paths["target"], global_context_destination=gd, append_destination=ad))
    assert restored["alreadyRestored"] is False and str(gd.resolve()) in restored["restored"]
    assert (gd.stat().st_mode & 0o777) == 0o640
    replay = bundle.restore(ns(bundle=paths["target"], global_context_destination=gd, append_destination=ad))
    assert replay["alreadyRestored"] is True and replay["restored"] == []

    os.chmod(first_installed, 0o644)
    installed = bundle.restore_installed(ns(bundle=paths["target"], installed_root=paths["installed"]))
    assert installed["alreadyRestored"] is False and bundle.MANAGED_FILES[0] in installed["restored"]
    assert (first_installed.stat().st_mode & 0o777) == 0o600
    installed_replay = bundle.restore_installed(ns(bundle=paths["target"], installed_root=paths["installed"]))
    assert installed_replay["alreadyRestored"] is True and installed_replay["restored"] == []


def test_metadata_failure_is_truthful_and_replay_repairs_remaining_drift(tmp_path: Path, monkeypatch) -> None:
    args, paths = make_bundle_case(tmp_path)
    os.chmod(paths["global"], 0o600)
    bundle.create(args)
    gd = tmp_path / "gd"; gd.write_bytes(paths["global"].read_bytes()); os.chmod(gd, 0o644)
    ad = tmp_path / "ad"; ad.write_bytes(paths["append"].read_bytes()); os.chmod(ad, paths["append"].stat().st_mode & 0o777)
    real_chmod = bundle.os.chmod
    def fail_target(path, mode, **kwargs):
        if Path(path) == gd.resolve():
            raise PermissionError("injected metadata failure")
        return real_chmod(path, mode, **kwargs)
    monkeypatch.setattr(bundle.os, "chmod", fail_target)
    with pytest.raises(PermissionError, match="injected metadata failure"):
        bundle.restore(ns(bundle=paths["target"], global_context_destination=gd, append_destination=ad))
    assert (gd.stat().st_mode & 0o777) == 0o644
    monkeypatch.setattr(bundle.os, "chmod", real_chmod)
    repaired = bundle.restore(ns(bundle=paths["target"], global_context_destination=gd, append_destination=ad))
    assert repaired["alreadyRestored"] is False
    assert bundle.restore(ns(bundle=paths["target"], global_context_destination=gd, append_destination=ad))["alreadyRestored"] is True


def test_installed_restore_classifies_complete_fixed_set_before_metadata_mutation(tmp_path: Path) -> None:
    args, paths = make_bundle_case(tmp_path)
    first = paths["installed"] / bundle.MANAGED_FILES[0]
    os.chmod(first, 0o600)
    bundle.create(args)
    os.chmod(first, 0o644)
    later = paths["installed"] / bundle.MANAGED_FILES[1]
    later.write_bytes(b"unknown-third-state\n")
    with pytest.raises(ValueError, match="unknown installed state"):
        bundle.restore_installed(ns(bundle=paths["target"], installed_root=paths["installed"]))
    assert (first.stat().st_mode & 0o777) == 0o644

@pytest.mark.parametrize(("component", "dangling"), [("parent", False), ("parent", True), ("leaf", False), ("leaf", True)])
def test_restore_installed_rejects_visible_or_dangling_fixed_components_before_mutation(tmp_path: Path, component: str, dangling: bool) -> None:
    args, paths = make_bundle_case(tmp_path)
    bundle.create(args)
    installed = paths["installed"]
    sentinel = installed / bundle.MANAGED_FILES[1]
    before = sentinel.read_bytes()
    if component == "parent":
        victim = installed / "extensions"
        shutil.rmtree(victim)
        target = tmp_path / ("missing-restore-parent" if dangling else "restore-parent")
        if not dangling:
            target.mkdir(); (target / "sentinel").write_text("keep\n")
        victim.symlink_to(target, target_is_directory=True)
    else:
        victim = installed / bundle.MANAGED_FILES[0]
        victim.unlink()
        target = tmp_path / ("missing-restore-leaf" if dangling else "restore-leaf")
        if not dangling:
            target.write_text("keep\n")
        victim.symlink_to(target)
    with pytest.raises(ValueError, match="must not be a symlink"):
        bundle.restore_installed(ns(bundle=paths["target"], installed_root=installed))
    if component == "leaf":
        assert sentinel.read_bytes() == before
    if not dangling:
        assert (target / "sentinel").read_text() == "keep\n" if target.is_dir() else target.read_text() == "keep\n"


def test_installed_metadata_failure_does_not_claim_restoration_and_replay_repairs(tmp_path: Path, monkeypatch) -> None:
    args, paths = make_bundle_case(tmp_path)
    first = paths["installed"] / bundle.MANAGED_FILES[0]
    os.chmod(first, 0o600)
    bundle.create(args)
    os.chmod(first, 0o644)
    real_chmod = bundle.os.chmod
    def fail_target(path, mode, **kwargs):
        if Path(path) == first:
            raise PermissionError("injected installed metadata failure")
        return real_chmod(path, mode, **kwargs)
    monkeypatch.setattr(bundle.os, "chmod", fail_target)
    with pytest.raises(PermissionError, match="injected installed metadata failure"):
        bundle.restore_installed(ns(bundle=paths["target"], installed_root=paths["installed"]))
    assert (first.stat().st_mode & 0o777) == 0o644
    monkeypatch.setattr(bundle.os, "chmod", real_chmod)
    repaired = bundle.restore_installed(ns(bundle=paths["target"], installed_root=paths["installed"]))
    assert repaired["alreadyRestored"] is False and bundle.MANAGED_FILES[0] in repaired["restored"]
    assert bundle.restore_installed(ns(bundle=paths["target"], installed_root=paths["installed"]))["alreadyRestored"] is True


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(["git", *args], cwd=repo, text=True, capture_output=True, check=True)
    return result.stdout.strip()


def test_rollback_topology_uses_isolated_clone_and_produces_exact_baseline_tree(tmp_path: Path) -> None:
    repo = tmp_path / "repo"; repo.mkdir()
    git(repo, "init", "-q")
    git(repo, "config", "user.name", "Prime Claw Test")
    git(repo, "config", "user.email", "prime-claw-test@example.invalid")
    (repo / "root.txt").write_text("root\n"); git(repo, "add", "."); git(repo, "commit", "-qm", "root")
    root = git(repo, "rev-parse", "HEAD")
    git(repo, "checkout", "-qb", "accepted")
    (repo / "episode.txt").write_text("accepted\n"); git(repo, "add", "."); git(repo, "commit", "-qm", "accepted")
    accepted = git(repo, "rev-parse", "HEAD")
    git(repo, "checkout", "-qb", "mainline", root)
    (repo / "main.txt").write_text("main\n"); git(repo, "add", "."); git(repo, "commit", "-qm", "main")
    baseline = git(repo, "rev-parse", "HEAD"); baseline_tree = git(repo, "rev-parse", "HEAD^{tree}")
    git(repo, "checkout", "-q", "accepted")
    git(repo, "merge", "--no-ff", "mainline", "-qm", "integration")
    merge = git(repo, "rev-parse", "HEAD")
    (repo / "candidate-one.txt").write_text("one\n"); git(repo, "add", "."); git(repo, "commit", "-qm", "candidate one")
    candidate_one = git(repo, "rev-parse", "HEAD")
    (repo / "candidate-two.txt").write_text("two\n"); git(repo, "add", "."); git(repo, "commit", "-qm", "candidate two")
    candidate_two = git(repo, "rev-parse", "HEAD")
    before_status = git(repo, "status", "--porcelain")

    coordinator = coord.Coordinator.__new__(coord.Coordinator)
    coordinator.config = {
        "rollbackRecipe": {
            "integrationMerge": {"commit": merge, "parents": [accepted, baseline], "mainline": 2},
            "linearReverts": [candidate_two, candidate_one],
            "acceptedBaseline": {"commit": baseline, "tree": baseline_tree},
            "commitMessage": "Rollback Prime Claw Generation A cutover",
        }
    }
    coordinator.primary = repo.resolve()
    coordinator.commit = candidate_two
    coordinator.main = {"prelandingCommit": baseline}
    coordinator.runner = coord.LocalRunner()
    coordinator.observations = {}
    coordinator.verify_rollback_topology()
    assert coordinator.observations["rollback"]["resultingTree"] == baseline_tree
    assert coordinator.observations["rollback"]["proof"] == "isolated-no-local-clone-inverse"
    assert git(repo, "status", "--porcelain") == before_status
    assert not (repo / ".git/worktrees").exists()

@pytest.mark.parametrize("failure", ["malformed-status", "failed-discovery"])
def test_failed_or_malformed_preflight_observation_stops_before_scratch_or_operational_mutation(tmp_path: Path, failure: str) -> None:
    config = cutover_config(tmp_path)
    runner = RecordingRunner(
        config,
        initial_status="malformed" if failure == "malformed-status" else None,
        discovery_failure=failure == "failed-discovery",
    )
    match = "did not return JSON" if failure == "malformed-status" else "PID discovery failed"
    with pytest.raises(coord.CutoverError, match=match):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert operational_calls(runner) == []
    assert runner.started == []
    assert not any(call[:3] == ("git", "clone", "--no-local") for call in runner.calls)

@pytest.mark.parametrize(
    "extra",
    [
        {"argv": ["git", "revert", "--no-commit", "candidate-range"]},
        {"commands": [["git", "reset", "--hard", "HEAD^"]]},
        {"commands": [["git", "rebase", "main"]]},
        {"commands": [["git", "push", "--force", "origin", "main"]]},
    ],
)
def test_rollback_recipe_rejects_legacy_or_forbidden_extra_command_fields(tmp_path: Path, extra: dict) -> None:
    config = cutover_config(tmp_path)
    config["rollbackRecipe"].update(extra)
    runner = RecordingRunner(config)
    with pytest.raises(coord.CutoverError, match="only the exact topology fields"):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert runner.calls == [] and runner.started == []

def test_preflight_rejects_same_version_wrong_status_build_before_mutation(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    runner = RecordingRunner(config)
    row = runner._status_row(123)
    row["buildId"] = "different-build-same-version"
    runner.initial_status = [row]
    with pytest.raises(coord.CutoverError, match="identity mismatch: buildId"):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert any(call[-2:] == ("status", "--json") for call in runner.calls)
    assert not any(call[:3] == ("git", "clone", "--no-local") for call in runner.calls)
    assert operational_calls(runner) == [] and runner.started == []


def test_preflight_allows_approved_worker_tied_to_exact_supervisor(tmp_path: Path) -> None:
    config = cutover_config(tmp_path)
    config["processInventory"].append({
        "pid": 124, "parentPid": 123, "role": "worker", "entrypointKind": "compiled",
        "version": config["runtime"]["version"], "buildId": config["runtime"]["buildId"],
        "daemonSocket": str(tmp_path / "worker.sock"), "expectedPresent": True,
        "acknowledgedExit": False,
    })
    runner = RecordingRunner(config)
    result = coord.Coordinator(config, tmp_path / "state", runner).preflight()
    workers = [entry for entry in result["observations"]["processes"] if entry["role"] == "worker"]
    assert workers == [{
        "pid": 124, "ppid": 123, "role": "worker", "entrypointKind": "compiled",
        "commandSha256": bundle.digest(b"prime-agent"),
        "declaredVersion": config["runtime"]["version"],
        "declaredBuildId": config["runtime"]["buildId"],
        "daemonSocket": str(tmp_path / "worker.sock"), "observed": "present",
        "identityBasis": "approved-worker-parent-and-entrypoint",
    }]


@pytest.mark.parametrize("mismatch", ["version", "build", "socket"])
def test_preflight_rejects_worker_not_tied_to_exact_supervisor_contract(tmp_path: Path, mismatch: str) -> None:
    config = cutover_config(tmp_path)
    worker = {
        "pid": 124, "parentPid": 123, "role": "worker", "entrypointKind": "compiled",
        "version": config["runtime"]["version"], "buildId": config["runtime"]["buildId"],
        "daemonSocket": str(tmp_path / "worker.sock"), "expectedPresent": True,
        "acknowledgedExit": False,
    }
    if mismatch == "version": worker["version"] = "0.9.7"
    elif mismatch == "build": worker["buildId"] = "wrong-build"
    else: worker["daemonSocket"] = config["runtime"]["daemonSocket"]
    config["processInventory"].append(worker)
    runner = RecordingRunner(config)
    with pytest.raises(coord.CutoverError, match="worker version/build|distinct unique"):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert runner.calls == [] and runner.started == []


@pytest.mark.parametrize("fault", ["wrong-mode", "wrong-socket", "duplicate-mode", "duplicate-socket"])
def test_preflight_rejects_nonexact_start_mode_or_socket_before_commands(tmp_path: Path, fault: str) -> None:
    config = cutover_config(tmp_path)
    args = config["runtime"]["startArgs"]
    if fault == "wrong-mode": args[args.index("daemon")] = "text"
    elif fault == "wrong-socket": args[args.index("--daemon-socket") + 1] = str(tmp_path / "wrong.sock")
    elif fault == "duplicate-mode": args.extend(["--mode", "daemon"])
    else: args.extend(["--daemon-socket", config["runtime"]["daemonSocket"]])
    runner = RecordingRunner(config)
    with pytest.raises(coord.CutoverError, match="--mode|daemon socket|--daemon-socket"):
        coord.Coordinator(config, tmp_path / "state", runner).preflight()
    assert runner.calls == [] and runner.started == []


def test_readiness_reports_real_monotonic_deadline_not_attempt_exhaustion(tmp_path: Path, monkeypatch) -> None:
    config = cutover_config(tmp_path)
    config["runtime"]["readiness"].update({"attempts": 20, "deadlineSeconds": 1, "intervalSeconds": 0})
    runner = RecordingRunner(config, readiness=[[]])
    ticks = iter([0.0, 0.0, 2.0])
    monkeypatch.setattr(coord.time, "monotonic", lambda: next(ticks))
    coordinator = coord.Coordinator(config, tmp_path / "state", runner)
    with pytest.raises(coord.CutoverError, match="deadline expired"):
        coordinator.execute(config["candidate"]["commit"])
    assert coordinator.last_checkpoint == "START_REQUESTED"
    assert runner.started == [tuple(config["runtime"]["startArgs"])]
