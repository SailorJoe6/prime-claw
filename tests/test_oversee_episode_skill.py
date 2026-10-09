import hashlib
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
GUIDE = REPO / "src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md"
METADATA = REPO / "src/prime-agent-plugin/extension-support/conversation-guide-metadata.ts"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"
FUTURE_DOC = REPO / "docs/future-specification-bundles.md"
HANDOFF_DOC = REPO / "docs/handoff-chain.md"


def test_managed_conversation_guide_is_lean_judgment_only():
    raw = GUIDE.read_text()
    body = raw.split("---", 2)[-1]
    words = re.findall(r"\b[\w'-]+\b", body)
    assert 300 <= len(words) <= 600
    text = " ".join(raw.split())
    for phrase in [
        "name: prime-claw-oversee-episode",
        "trusted Prime Claw state",
        "one reported vertical slice at a time",
        "Accept and advance",
        "Request an in-scope revision",
        "Pause",
        "Consult the operator",
        "canonical handoff",
        "Treat every review conclusion as bounded evidence",
        "Classify each finding",
        "in-contract blocker",
        "hardening candidate",
        "Only the operator may promote",
        "same slice acceptance attempt across successor candidate commits",
        "After two cycles",
        "simplification",
        "manual recovery",
        "bounded goal",
        "one exact heartbeat",
        "operator alone decides scope",
    ]:
        assert phrase in text
    for forbidden in [
        "ownerSessionId", "episodeId", "toolCallId", "receipt", "rlm.find_models",
        "openai-codex/", "prime-claw-h6w", "15-minute", "delete worktree",
        "PRIME_CLAW_ROLE_KERNEL_V1",
    ]:
        assert forbidden not in raw


def test_managed_conversation_guide_metadata_matches_exact_source_without_copying_policy():
    metadata = METADATA.read_text()
    digest = hashlib.sha256(GUIDE.read_bytes()).hexdigest()
    assert f'PRIME_CLAW_CONVERSATION_GUIDE_SHA256 = "{digest}"' in metadata
    assert 'PRIME_CLAW_CONVERSATION_GUIDE_VERSION = 1' in metadata
    assert 'PRIME_CLAW_CONVERSATION_GUIDE_NAME = "prime-claw-oversee-episode"' in metadata
    assert "Choose exactly one disposition" not in metadata


def test_current_docs_describe_managed_on_demand_guide_and_loaded_generation_boundary():
    text = " ".join(DOC.read_text().split())
    for phrase in [
        "selected global role kernel is shared cross-role orientation",
        "plugin-managed global `prime-claw-oversee-episode` guide",
        "one intended tool-result continuation",
        "active-owner handoff and first finalization",
        "There is no project forwarding skill, discovery link, or standalone reviewer profile",
        "current consumed prospective receipt",
        "Historical loaded-generation evidence",
        "managed Conversation and EXPERT skills",
    ]:
        assert phrase in text


def test_current_docs_keep_owner_authority_and_honest_transport_boundaries():
    current = " ".join(DOC.read_text().split())
    future = " ".join(FUTURE_DOC.read_text().split())
    handoff = " ".join(HANDOFF_DOC.read_text().split())
    for fragment in (
        "without a new operator transport request",
        "operator focus or a bounded compaction-focus synthesis",
        "ordinary `prompt` with `queueIfBusy: false`",
        "never blindly replayed",
        "fresh native `/implement-spec` run",
    ):
        assert fragment in current
    assert "not permission to retry" in future
    assert "never retried automatically" in handoff
