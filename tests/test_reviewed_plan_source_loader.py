"""Regression for the supported source release's default extension loader.

Run: python3 -m pytest tests/test_reviewed_plan_source_loader.py -m container -q
The default builds the pinned source fixture. SOURCE_LOADER_IMAGE is an optional
local diagnostic shortcut; labels AND in-image source identity must still match.
No candidate JavaScript runs on the host, and no generated package dist is used.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import shutil
import uuid

import pytest

from scripts.testing.bounded import run_completed

REPO = Path(__file__).resolve().parents[1]
IDENTITY = {
    "tag": "cwd-fix-v0.9.8-r1",
    "tag-object": "8ca4d5c39b7c738f71b5c86422ea46394c3d0558",
    "commit": "a1faacd53ac4473a75de1d434afaf50945c2f647",
    "tree": "5301c70d9c9d74e474ccaf258fdd3c8de982c52f",
    "lock-sha256": "3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74",
}
COMMANDS = {"plan-spec", "plan", "implement-spec", "implement-task"}
TOOLS = {
    "plan_spec", "plan_task", "create_spec_episode", "create_task_episode",
    "transition_spec_episode_to_task", "finalize_spec_episode",
    "finalize_task_episode", "handoff_task_episode",
    "restore_blocked_spec_episode", "handoff_spec_episode",
}


def _docker(argv, evidence: Path, name: str, *, timeout=60):
    result = run_completed(
        ["docker", *argv], timeout=timeout, kill_grace=5, reap_grace=5,
        capture_output=True, text=True,
    )
    (evidence / f"{name}.stdout").write_text(result.stdout or "")
    (evidence / f"{name}.stderr").write_text(result.stderr or "")
    (evidence / f"{name}.status.json").write_text(json.dumps({
        "outcome": result.outcome, "returncode": result.returncode,
        "signal": result.signal,
    }, sort_keys=True))
    return result


def _require_success(result):
    assert result.outcome == "exited" and result.returncode == 0, (
        result.outcome, result.returncode, result.stdout, result.stderr,
    )


@pytest.mark.container
def test_reviewed_plan_loads_with_default_source_loader(tmp_path):
    context = tmp_path / "build-context"
    context.mkdir()
    shutil.copyfile(
        REPO / "docker/test-prime-agent-source-loader.Dockerfile",
        context / "Dockerfile",
    )
    image = os.environ.get("SOURCE_LOADER_IMAGE")
    if not image:
        iidfile = tmp_path / "image.iid"
        _require_success(_docker(
            ["build", "--iidfile", str(iidfile), str(context)],
            tmp_path, "build", timeout=1200,
        ))
        image = iidfile.read_text().strip()
        assert re.fullmatch(r"sha256:[0-9a-f]{64}", image)
    inspected = _docker(["image", "inspect", image], tmp_path, "image")
    _require_success(inspected)
    rows = json.loads(inspected.stdout)
    assert len(rows) == 1
    image_id = rows[0]["Id"]
    assert re.fullmatch(r"sha256:[0-9a-f]{64}", image_id)
    labels = rows[0]["Config"]["Labels"]
    for field, expected in IDENTITY.items():
        assert labels.get(f"org.prime-claw.prime-agent-source-{field}") == expected
    (tmp_path / "identity.json").write_text(json.dumps({
        "image_id": image_id, "source": IDENTITY,
    }, sort_keys=True))

    # Mount only source fixture inputs. Never mount the checkout/home, host
    # dependencies, credentials, Prime state, Docker socket, or writable code.
    snapshot = tmp_path / "snapshot"
    snapshot.mkdir()
    shutil.copytree(
        REPO / "src/prime-agent-plugin", snapshot / "candidate",
        ignore=shutil.ignore_patterns("node_modules", "dist", ".git", "__pycache__", ".DS_Store"),
    )
    shutil.copyfile(REPO / "scripts/run-prime-agent-probe.sh", snapshot / "probe.sh")
    shutil.copyfile(
        REPO / "tests/container/reviewed_plan_source_loader.mts", snapshot / "driver.mts",
    )
    name = f"prime-claw-source-loader-{uuid.uuid4().hex}"
    try:
        result = _docker([
            "run", "--rm", "--name", name, "--network", "none",
            "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777",
            "--mount", f"type=bind,src={snapshot / 'candidate'},dst=/candidate,readonly",
            "--mount", f"type=bind,src={snapshot / 'probe.sh'},dst=/fixture/probe.sh,readonly",
            "--mount", f"type=bind,src={snapshot / 'driver.mts'},dst=/fixture/driver.mts,readonly",
            "--env", "HOME=/tmp/home", "--env", "TMPDIR=/tmp",
            "--env", "TSX_TSCONFIG_PATH=/opt/prime-agent/tsconfig.json",
            "--env", f"SOURCE_LOADER_IDENTITY={json.dumps(IDENTITY)}",
            "--workdir", "/tmp", "--entrypoint", "/bin/sh", image_id,
            "-c", "mkdir -p /tmp/home /tmp/cwd && cd /tmp/cwd && "
            "exec sh /fixture/probe.sh /opt/prime-agent/node_modules/.bin/tsx /fixture/driver.mts",
        ], tmp_path, "loader", timeout=180)
        _require_success(result)
    finally:
        # The Docker client deadline does not kill a container. Remove exactly
        # this run-owned name even if the client timed out or was interrupted.
        cleanup = _docker(["rm", "--force", name], tmp_path, "cleanup", timeout=30)
        assert (cleanup.outcome == "exited" and (
            cleanup.returncode == 0 or "No such container" in (cleanup.stderr or "")
        )), (cleanup.outcome, cleanup.stderr)

    lines = [line.removeprefix("SOURCE_LOADER_RESULT=")
             for line in result.stdout.splitlines() if line.startswith("SOURCE_LOADER_RESULT=")]
    assert len(lines) == 1, result.stdout
    loaded = json.loads(lines[0])
    (tmp_path / "loader-result.json").write_text(json.dumps(loaded, indent=2, sort_keys=True))
    assert loaded["identity"] == IDENTITY
    control = next(row for row in loaded["loaded"] if row["path"] == "/tmp/loader-control.ts")
    assert control["commands"] == ["loader-control"]
    assert loaded["errors"] == [], loaded["errors"]
    reviewed = next(row for row in loaded["loaded"] if row["path"] == "/candidate/extensions/reviewed-plan.ts")
    assert set(reviewed["commands"]) == COMMANDS
    assert set(reviewed["tools"]) == TOOLS
