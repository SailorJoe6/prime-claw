"""Recording-fake coverage for the inert Generation A cutover preparation."""
from __future__ import annotations

import importlib.util
import json
import os
from pathlib import Path
import sys

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
    assert verified == {"schemaVersion": 1, "status": "VERIFIED", "manifestSha256": result["manifestSha256"], "inventoryEntries": len(bundle.MANAGED_FILES) + len(bundle.EXPECTED_ABSENT) + len(bundle.PROTOCOL_SURFACES)}
    manifest = json.loads((target / "manifest.json").read_text())
    assert manifest["selectedFileDecision"] == "AGENTS.md"
    assert manifest["currentKnownGoodGeneration"] == "accepted-generation"
    assert manifest["preimages"]["globalContext"]["newlineStyle"] == "crlf"
    assert manifest["preimages"]["globalContext"]["finalNewline"] is True
    assert manifest["installedInventory"][0]["path"] == bundle.MANAGED_FILES[0]
    assert manifest["installedInventory"][0]["candidateEqual"] is False
    assert manifest["installedInventory"][1]["observed"] == "absent"
    assert [entry["path"] for entry in manifest["installedInventory"]] == list(bundle.MANAGED_FILES) + list(bundle.EXPECTED_ABSENT) + list(bundle.PROTOCOL_SURFACES)
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
    installed_restored = bundle.restore_installed(ns(bundle=target, installed_root=installed))
    assert installed_restored["status"] == "INSTALLED_RESTORED"
    assert (installed / bundle.MANAGED_FILES[0]).read_text() == "accepted baseline\n"
    assert not (installed / bundle.MANAGED_FILES[1]).exists()
    assert (installed / bundle.EXPECTED_ABSENT[0]).read_text() == "accepted obsolete\n"
    assert not (installed / bundle.PROTOCOL_SURFACES[0]).exists()

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
    def __init__(self, config, *, stale_after_shutdown=False, fail_label=None):
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

    def _label(self, argv):
        text = " ".join(argv)
        if "shutdown --force --json" in text: return "shutdown"
        if argv[:3] == ("git", "merge", "--ff-only"): return "landing"
        if argv and argv[0].endswith("apply-prime-agent-plugin.sh"): return "apply"
        if argv and argv[0].endswith("check-prime-agent-plugin.sh"): return "check"
        if argv[-2:] == ("status", "--json") and self.runtime_started: return "status"
        return "other"

    def run(self, argv, *, cwd=None, allow_failure=False):
        argv = tuple(argv); self.calls.append(argv)
        label = self._label(argv); self.labels.append(label)
        if self.fail_label == label:
            raise coord.CutoverError(f"injected {label} failure")
        c = self.config; exe = c["runtime"]["executableRealpath"]
        if argv[0].endswith("manage-prime-agent-cutover-bundle.py"):
            output = {"status": "VERIFIED", "manifestSha256": c["bundle"]["manifestSha256"]}
            return coord.Result(argv, 0, json.dumps(output), "")
        if argv == (exe, "--version"):
            return coord.Result(argv, 0, c["runtime"]["version"] + "\n", "")
        if argv == ("ps", "-axo", "pid=,ppid=,command="):
            self.ps_count += 1
            running = self.ps_count == 1 or self.stale_after_shutdown
            out = f"123 1 {exe} prime-agent --mode daemon\n" if running else ""
            return coord.Result(argv, 0, out, "")
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
        if argv[:2] == ("git", "ls-remote"):
            value = c["candidate"]["commit"] if self.pushed else c["main"]["prelandingCommit"]
            return coord.Result(argv, 0, value + "\trefs/heads/main\n", "")
        if argv[:3] == ("git", "merge-base", "--is-ancestor"):
            return coord.Result(argv, 0, "", "")
        if argv == (exe, "status", "--json"):
            if self.runtime_started:
                status = [{"socketPath": c["runtime"]["daemonSocket"], "pid": 999, "version": c["runtime"]["version"], "buildId": c["runtime"]["buildId"], "executablePath": exe, "status": "current", "isDefault": True}]
                return coord.Result(argv, 0, json.dumps(status), "")
            return coord.Result(argv, 0, "[]" if self.shutdown else json.dumps([{"status": "current"}]), "")
        if argv == (exe, "shutdown", "--force", "--json"):
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


def cutover_config(tmp_path: Path):
    primary = tmp_path / "primary"; primary.mkdir(parents=True)
    exe = str(Path(sys.executable).resolve())
    bundle_path = tmp_path / "private-bundle"; bundle_path.mkdir()
    return {
        "schemaVersion": 1,
        "operationId": "gate-a-authority-1",
        "rollbackRecipe": {"argv": ["git", "revert", "--no-commit", "candidate-range"]},
        "candidate": {"commit": "c" * 40, "tree": "d" * 40},
        "main": {"checkout": str(primary), "remote": "origin", "branch": "main", "prelandingCommit": "a" * 40},
        "runtime": {"executableRealpath": exe, "version": "0.9.8", "buildId": "cwd-fix-v0.9.8-r1", "daemonSocket": str(tmp_path / "daemon.sock"), "startArgs": [exe, "--mode", "daemon", "--daemon-socket", str(tmp_path / "daemon.sock")]},
        "bundle": {"path": str(bundle_path), "manifestSha256": "b" * 64},
        "operator": {"clientsExited": True, "foreignOwnersCheckpointed": True, "bundleVerified": True, "isolatedRestoreVerified": True, "executeAuthorized": True},
        "processInventory": [{"pid": 123, "kind": "daemon", "executableRealpath": exe, "version": "0.9.8", "buildId": "cwd-fix-v0.9.8-r1", "daemonSocket": str(tmp_path / "daemon.sock"), "resident": False, "acknowledgedExit": True}],
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
    assert any(call.startswith("ps -axo") for call in flat)
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

def test_generation_a_bridge_inventory_is_complete_and_retains_compatibility_resources() -> None:
    apply_text = (ROOT / "scripts/apply-prime-agent-plugin.sh").read_text()
    check_text = (ROOT / "scripts/check-prime-agent-plugin.sh").read_text()
    guide = (ROOT / "docs/lab-global-plugin.md").read_text()
    assert len(bundle.MANAGED_FILES) == 16
    for relative in bundle.MANAGED_FILES:
        assert Path(ROOT / "src/prime-agent-plugin" / relative).is_file(), relative
    for relative in bundle.MANAGED_FILES[:11]:
        assert relative in apply_text and relative in check_text, relative
    assert 'managed_skill_relative="skills/prime-claw-oversee-episode/SKILL.md"' in apply_text
    assert 'expert_skill_root_relative="skills/prime-claw-official-expert-review"' in apply_text
    for suffix in ("SKILL.md", "pyproject.toml", "src/prime_claw_official_expert_review/__init__.py", "src/prime_claw_official_expert_review/reviewer.md"):
        assert f'$expert_skill_root_relative/{suffix}' in apply_text
    assert "conversation-guide-metadata.ts" in guide and "expert-review-reservation.ts" in guide
    assert "prime-claw-oversee-episode/SKILL.md" in guide and "prime-claw-official-expert-review" in guide
    for relative in bundle.EXPECTED_ABSENT:
        assert relative in apply_text and relative in check_text
        assert not (ROOT / "src/prime-agent-plugin" / relative).exists()
    shim = ROOT / ".ralph/skills/oversee-episode/SKILL.md"
    discovery = ROOT / ".agents/skills/oversee-episode"
    profile = ROOT / ".prime/agent/profiles/expert-reviewer.md"
    reviewer = ROOT / "src/prime-agent-plugin/skills/prime-claw-official-expert-review/src/prime_claw_official_expert_review/reviewer.md"
    assert shim.is_file() and "compatibility shim" in shim.read_text()
    assert discovery.is_symlink() and discovery.resolve() == shim.parent.resolve()
    assert profile.read_bytes() == reviewer.read_bytes()
    assert (ROOT / "src/prime-agent-plugin/APPEND_SYSTEM.md").is_file()
    assert (ROOT / "scripts/manage-prime-agent-append-system.py").is_file()

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
