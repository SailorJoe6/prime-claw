"""Regression checks for prompt-led routing, not a runtime classifier or live LLM test."""
import re
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "src/prime-agent-plugin"


def words(path: Path) -> str:
    return " ".join(path.read_text().split())


def test_direct_work_does_not_inherit_episode_admission_and_publishes_status_in_order():
    guidance = words(PLUGIN / "skills/implement-task/SKILL.md")
    direct, episode = guidance.split("## Direct tracked implementation ", 1)[1].split("## Isolated Episode implementation ")
    assert "Do not call `implement_task` or any Episode tool" in direct
    assert "or require Episode identity or a formal plan" in direct
    steps = [
        "If a same-task Episode exists or the collision check is inconclusive, stop",
        "Before editing implementation files, publish and verify",
        "native `In Progress`",
        "Implement the approved change",
        "Only after required checks and code commit/publication are proven",
        "publish and verify native `Done`",
        "Honor explicit review holds",
    ]
    offsets = [direct.index(step) for step in steps]
    assert offsets == sorted(offsets)
    assert "EXPERT stays read-only" in guidance
    assert "Only this path calls `implement_task(taskId, host?)`" in episode
    assert "If the native status is not `In Planning`/`in_planning`" in episode


@pytest.mark.parametrize("workflows", [PLUGIN / "workflows", ROOT / ".prime-claw/workflows"])
def test_planning_continuation_preserves_explicit_placement(workflows):
    prep = words(workflows / "plan-task-prep.md")
    plan = words(workflows / "plan-task.md").split("## Report the plan and apply operator authority", 1)[1]
    assert "actual operator instruction including explicit placement" in prep
    assert re.search(r"planning-only request,.*stop without creating Episode resources", plan)
    assert "continues via the direct path in the verified checkout, without calling `implement_task`" in plan
    assert "explicit Episode request uses Episode readiness and keeps any selected host" in plan
    assert "Only when placement was unspecified, apply the skill's judgment-based default" in plan
    assert "Episode path alone calls `implement_task`" in plan
