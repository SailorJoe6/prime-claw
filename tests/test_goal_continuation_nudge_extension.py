"""Regression coverage for the plugin-owned goal-continuation nudge."""

from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
WS_NODE_SUITE = "/workspace/tests/goal_continuation_nudge_extension.test.mjs"
PLUGIN = REPO / "src" / "prime-agent-plugin"
SKILL = PLUGIN / "skills" / "goals-and-heartbeats" / "SKILL.md"
CONTINUATION = SKILL.parent / "CONTINUATION.md"
EXTENSION = PLUGIN / "extensions" / "goal-continuation-nudge.ts"


def test_goal_continuation_nudge_node_suite(tier1_container) -> None:
    result = tier1_container.run(
        "node", "--experimental-strip-types", "--test", WS_NODE_SUITE,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr


def test_goal_skill_and_continuation_policy_are_one_plugin_owned_bundle() -> None:
    skill = SKILL.read_text()
    assert "name: goals-and-heartbeats" in skill
    assert "If you are waiting for the user" in skill
    assert SKILL.parent == CONTINUATION.parent


def test_reminder_and_timing_are_managed_plugin_markdown_not_typescript_guidance() -> None:
    reminder = CONTINUATION.read_text()
    extension = EXTENSION.read_text()
    assert "minimum_rapid_continuations: 2" in reminder
    assert "window_seconds: 30" in reminder
    assert "/skill:goals-and-heartbeats" in reminder
    assert "If there is no more work to do" not in extension
    assert "waiting on the user" not in extension
    assert "goals-and-heartbeats" in extension
    assert "CONTINUATION.md" in extension
