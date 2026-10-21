"""Contract tests for the Markdown-only native EXPERT workflow."""
import json
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
        'provider-absent or `provider: "backlog"` version-2 ownership',
        "exact Backlog task ID and project-relative task path",
        "sole review contract",
        "do not consult `.ralph/plans`",
        "For a retained folder candidate",
        "Do not substitute a related Backlog task as authority",
        "select the exact `ownerSessionId` entry identified by the requesting Conversation",
        "Version 1 selects the retained folder contract; version 2 selects the exact task contract",
        "A task tag is only a candidate when the exact owner has no record",
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

def test_expert_skill_sends_provider_native_beads_review_evidence_without_lifecycle_authority() -> None:
    raw = SKILL.read_text()
    text = " ".join(raw.split())
    for required in (
        "version 2 selects the exact task contract and the provider recorded by that exact owner",
        "With no ownership, require the caller to make any task provider unambiguous",
        "record must not carry Beads evidence",
        'For `provider: "beads"` version-2 ownership',
        "require no `taskPath`",
        "published `providerRevision`",
        "complete raw `taskEvidence`",
        "code `baseRef`, candidate head",
        "recorded Episode worktree, branch, and session identity",
        "use `bd context --json`, one supported `bd dolt pull`",
        "exact `bd show TASK-ID --json --long --include-comments` results",
        "without force, uncertain-transport retry, or raw Dolt writes",
        "do not construct a normalized task, path, content digest, receipt, or alternate authority",
        "exact persisted and current raw task values",
        "recorded and current provider revisions and publication refs",
        "An unrelated-task revision descendant alone is compatible",
        "show exact before and current fields and use semantic judgment",
        "compatible in-scope clarification and living-plan updates may be incorporated",
        "genuine semantic conflict, authority change, scope expansion, or product choice is escalated",
        "Do not ask a fake unit test or deterministic classifier to make that judgment",
        "Findings are evidence, not approval",
        "do not invoke unavailable handoff, blocked, status, terminal, finalization, cleanup, or ownership-evidence advancement paths",
        "report the exact factual provider evidence and stop",
        "using a Backlog-only route or writing `ownership.json`",
    ):
        assert required in text
    assert text.index("select the exact `ownerSessionId` entry identified by the requesting Conversation") < text.index("provider recorded by that exact owner")


def test_review_skills_are_canonical_plugin_root_managed_assets() -> None:
    inventory = json.loads((REPO / "src/prime-agent-plugin/asset-inventory.json").read_text())
    assets = {row["id"]: row for row in inventory["assets"]}
    assert assets["global-expert-review"] == {
        "id": "global-expert-review",
        "source": "skills/prime-claw-expert-review/SKILL.md",
        "targets": [{"class": "plugin-root-managed", "destination": "skills/prime-claw-expert-review/SKILL.md"}],
    }
    assert assets["global-oversee-episode"] == {
        "id": "global-oversee-episode",
        "source": "skills/prime-claw-oversee-episode/SKILL.md",
        "targets": [{"class": "plugin-root-managed", "destination": "skills/prime-claw-oversee-episode/SKILL.md"}],
    }
