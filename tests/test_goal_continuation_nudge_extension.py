"""Regression coverage for the project-configurable goal-continuation nudge."""

from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
WS_NODE_SUITE = "/workspace/tests/goal_continuation_nudge_extension.test.mjs"
SKILL = REPO / ".agents" / "skills" / "goals-and-heartbeats" / "SKILL.md"
CONTINUATION = SKILL.parent / "CONTINUATION.md"
EXTENSION = REPO / "src" / "prime-agent-plugin" / "extensions" / "goal-continuation-nudge.ts"


def test_goal_continuation_nudge_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_goal_policy_avoids_trivial_goals_and_keeps_wait_ownership_explicit() -> None:
    skill = SKILL.read_text()
    assert "Do not create a goal for a direct answer" in skill
    assert "only a few tool calls" in skill
    assert "you MUST complete the active-work goal" in skill
    assert "create no heartbeat" in skill


def test_reminder_and_timing_are_project_markdown_not_typescript_guidance() -> None:
    reminder = CONTINUATION.read_text()
    extension = EXTENSION.read_text()
    assert "minimum_rapid_continuations: 2" in reminder
    assert "window_seconds: 30" in reminder
    assert "/skill:goals-and-heartbeats" in reminder
    assert "If there is no more work to do" not in extension
    assert "waiting on the user" not in extension
    assert "CONTINUATION.md" in extension
