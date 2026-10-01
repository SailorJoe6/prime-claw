"""Direct non-native coverage for plugin-global goal/heartbeat work control."""

from pathlib import Path
import shutil
import subprocess


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts"
OBSOLETE = REPO / "src/prime-agent-plugin/extensions/goal-blocker-control.ts"
NODE_SUITE = REPO / "tests/goal_heartbeat_work_control_extension.test.mjs"
MANAGED_SOURCE = REPO / "src/prime-agent-plugin"
KERNEL = MANAGED_SOURCE / "APPEND_SYSTEM.md"


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


def test_lean_append_system_owns_goal_heartbeat_semantics() -> None:
    raw = KERNEL.read_text()
    source = " ".join(raw.split())
    required = (
        "maintain a goal so interrupted work resumes",
        "establish a heartbeat for that exact wait and complete the goal",
        "remove the heartbeat and create a new goal if work remains",
        "When waiting for the user, complete the goal and create no heartbeat",
        "When all work is complete, retain neither",
    )
    for phrase in required:
        assert phrase in source
    assert len(source.split()) <= 250
    assert "PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL" not in EXTENSION.read_text()


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
    assert source.count("PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1") == 0
