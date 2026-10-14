"""Contract tests for the Markdown-only native EXPERT workflow."""
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
SKILL = REPO / "src/prime-agent-plugin/skills/prime-claw-expert-review/SKILL.md"

def test_expert_skill_uses_native_model_spawn_message_and_cleanup() -> None:
    text = SKILL.read_text()
    assert "name: prime-claw-expert-review" in text
    for required in (
        "rlm.find_models", "openai-codex/gpt-6-astra", 'thinking="max"',
        "rlm.spawn", "Bootstrap only", "agent_message.send",
        "agent_observe", "rlm.collect", "rlm.delete_subagent", "actual model",
    ):
        assert required in text
    assert text.index("rlm.spawn") < text.index("agent_message.send")


def test_expert_skill_accepts_normal_context_and_preserves_review_judgment() -> None:
    raw = SKILL.read_text()
    text = " ".join(raw.split())
    for required in (
        "normal review request", "caller overrides", "ask the caller",
        "short conclusion", "material findings", "realistic impact",
        "operator-approved product contract", "Do not add requirements",
        "not an adversarial or red-team exercise",
        "Red-team review requires an explicit operator request",
        "newly imagined invariants are not blockers",
        "smallest repair that fixes the demonstrated defect",
        "For a task-native candidate",
        "exact Backlog task ID and project-relative task path",
        "sole review contract",
        "do not consult `.ralph/plans`",
        "For a retained folder candidate",
        "Do not substitute a related Backlog task as authority",
        "Inspect persisted `.prime-claw/ownership.json` from the canonical primary checkout before prompt tags",
        "Version 1 selects the retained folder contract; version 2 selects the exact task contract",
        "A task tag is only a candidate when ownership does not decide",
        "old in-place folder review without creating live Episode identity",
        "live version-1 Episode requires persisted version-1 ownership plus those active files",
        "active pair remains the review contract through candidate review and any bounded revision",
        "exact version-1 blocked recovery path rather than task-native fallback",
        "cannot claim or mutate task-native Backlog status, completion, archival, finalization, or cleanup authority",
    ):
        assert required in text
    for unwanted in (
        "threat model", "trusted assumptions", "ordinary failure model",
        "complexity budget", "evidence-preserving manual recovery",
    ):
        assert unwanted not in text
    for retired in (
        "prime_claw_official_expert_review", "launch(packet)", "submit(report)",
        "prime-claw-official-expert-review-packet", "PASS`/`BLOCK",
    ):
        assert retired not in raw
