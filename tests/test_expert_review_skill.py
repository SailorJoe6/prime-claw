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
    text = SKILL.read_text()
    for required in (
        "normal review request", "caller overrides", "ask the caller",
        "short conclusion", "material findings", "realistic impact",
        "proportionate general repair direction", "Do not expand scope",
        "Adversarial red-team review requires explicit operator authorization",
    ):
        assert required in text
    for retired in (
        "prime_claw_official_expert_review", "launch(packet)", "submit(report)",
        "prime-claw-official-expert-review-packet", "PASS`/`BLOCK",
    ):
        assert retired not in text
