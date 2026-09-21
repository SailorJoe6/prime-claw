from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
EXECUTE_SKILL = ROOT / ".ralph" / "skills" / "execute" / "SKILL.md"
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


def test_agent_execute_skill_uses_canonical_definition() -> None:
    assert AGENT_SKILL.is_symlink()
    assert AGENT_SKILL.resolve() == EXECUTE_SKILL.parent.resolve()
