"""Direct non-native coverage for plugin-global goal/heartbeat work control."""

from pathlib import Path
import shutil
import subprocess


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts"
OBSOLETE = REPO / "src/prime-agent-plugin/extensions/goal-blocker-control.ts"
NODE_SUITE = REPO / "tests/goal_heartbeat_work_control_extension.test.mjs"
MANAGED_SOURCE = REPO / "src/prime-agent-plugin"


def test_goal_heartbeat_work_control_node_suite() -> None:
    node = shutil.which("node")
    assert node, "Node.js is required because Prime Agent requires Node >=22.8"
    result = subprocess.run(
        [node, "--experimental-strip-types", "--test", str(NODE_SUITE)],
        cwd=REPO,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_event_driven_epoch_semantics_are_explicit_and_non_predictive() -> None:
    source = EXTENSION.read_text()
    required = (
        "current active-work epoch toward the broader requested outcome",
        "Completing an epoch does not claim the requested outcome is complete",
        "does not require predicting the next gate or ownership boundary",
        "actually starts a long-running or background operation",
        "if it is still running, complete the current goal even when requested work remains",
        "blocked or waiting for user input, credentials, permission, physical action",
        "complete the current goal even when the requested outcome remains unfinished",
        "After the blocker clears, create a fresh goal before substantive work resumes",
    )
    for phrase in required:
        assert phrase in source
    assert "identify the next known" not in source
    assert "objective must be true when ownership transfers" not in source


def test_obsolete_tools_and_autonomous_pause_resume_transport_are_absent() -> None:
    assert EXTENSION.is_file()
    assert not OBSOLETE.exists()
    source = "\n".join(
        path.read_text()
        for path in sorted(MANAGED_SOURCE.rglob("*"))
        if path.is_file()
    )
    assert 'name: "pause_thread_goal"' not in source
    assert 'name: "resume_thread_goal"' not in source
    assert 'sendUserMessage("/goal pause"' not in source
    assert 'sendUserMessage("/goal resume"' not in source
    assert source.count("PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1") == 1
