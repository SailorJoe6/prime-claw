from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXECUTE_SKILL = ROOT / "src" / "prime-agent-plugin" / "skills" / "project-templates" / "execute.md"
AGENT_SKILL = ROOT / ".agents" / "skills" / "execute"


def test_execute_skill_enforces_one_small_complete_slice() -> None:
    text = EXECUTE_SKILL.read_text()

    for fragment in (
        "one small elephant-carpaccio slice",
        "smallest end-to-end change that produces observable value or decisive evidence",
        "within the current context window",
        "without relying on auto-compaction",
        "clean single-purpose commit pushed for review",
        "split it before starting",
        "stop and report; do not begin another slice",
    ):
        assert fragment in text


def test_execute_skill_rejects_reviewer_driven_scope_expansion() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "Implement only the approved behavior",
        "findings are evidence, not new scope",
        "Do not implement speculative hardening",
        "concrete, material defect against that approved contract",
        "simplest change that fixes the defect",
    ):
        assert fragment in text

    for unwanted in (
        "approved threat model", "trusted assumptions",
        "qualitative complexity budget", "hardening backlog",
        "simplification checkpoint", "manual recovery",
    ):
        assert unwanted not in text


def test_execute_skill_defers_goal_and_heartbeat_control_to_plugin_context() -> None:
    text = EXECUTE_SKILL.read_text()

    for fragment in ("pause_thread_goal", "resume_thread_goal", "Set up a goal", "heartbeat"):
        assert fragment not in text


def test_agent_execute_skill_uses_canonical_definition() -> None:
    assert AGENT_SKILL.is_dir() and not AGENT_SKILL.is_symlink()
    assert (AGENT_SKILL / "SKILL.md").read_bytes() == EXECUTE_SKILL.read_bytes()
