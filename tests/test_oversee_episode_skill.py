import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
GUIDE = REPO / "src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md"
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
        "one durable Prime Claw ownership record",
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


def test_managed_conversation_guide_has_no_authentication_metadata_or_policy_copy():
    assert not (REPO / "src/prime-agent-plugin/extension-support/conversation-guide-metadata.ts").exists()
    source = (REPO / "src/prime-agent-plugin/extension-support/conversation-oversight.ts").read_text()
    for obsolete in ("SHA256", "GuideReceipt", "activate_conversation_guide", "conversation_guide_status"):
        assert obsolete not in source


def test_current_docs_describe_ordinary_guide_and_single_record_boundary():
    text = " ".join(DOC.read_text().split())
    for phrase in (
        "Universal → Project → Conversation → Episode",
        "complete ordinary `prime-claw-oversee-episode` guidance",
        "There is no guide activation, disclosure, hash, version, receipt",
        "`.prime-claw/ownership.json` is the sole durable lifecycle record",
        "one full `prime-claw-oversee-episode` custom message",
        "operator alone decides product direction",
    ):
        assert phrase in text


def test_current_docs_keep_owner_authority_and_honest_transport_boundaries():
    current = " ".join(DOC.read_text().split())
    future = " ".join(FUTURE_DOC.read_text().split())
    handoff = " ".join(HANDOFF_DOC.read_text().split())
    for fragment in (
        "Remote placement is disabled",
        "never creates a duplicate local fallback",
        "The Episode inherits no Conversation transcript",
        "The initial Episode creation is different",
    ):
        assert fragment in current + " " + handoff
    assert "not permission to retry" in future
    assert "never retried automatically" in handoff
