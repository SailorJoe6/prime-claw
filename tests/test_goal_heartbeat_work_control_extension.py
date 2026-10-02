"""Direct non-native coverage for plugin-global goal/heartbeat work control.

Tier policy (slice 3): the node suite bridge is tier 1 and runs INSIDE the
session's tier-1 container via the `tier1_container` fixture (auto-marked
`container`; see tests/conftest.py); the source-contract checks below stay
tier 0.
"""

from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
EXTENSION = REPO / "src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts"
OBSOLETE = REPO / "src/prime-agent-plugin/extensions/goal-blocker-control.ts"
# Container path (repo bind-mounted read-only at /workspace).
WS_NODE_SUITE = "/workspace/tests/goal_heartbeat_work_control_extension.test.mjs"
MANAGED_SOURCE = REPO / "src/prime-agent-plugin"
KERNEL = MANAGED_SOURCE / "APPEND_SYSTEM.md"


def test_goal_heartbeat_work_control_node_suite(tier1_container) -> None:
    """Run the TypeScript suite against a mocked ExtensionAPI, in-container."""
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=120,
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
