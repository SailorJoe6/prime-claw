import hashlib
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SHIM = REPO / ".ralph/skills/oversee-episode/SKILL.md"
GUIDE = REPO / "src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md"
METADATA = REPO / "src/prime-agent-plugin/extension-support/conversation-guide-metadata.ts"
PROFILE = REPO / ".prime/agent/profiles/expert-reviewer.md"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"
FUTURE_DOC = REPO / "docs/future-specification-bundles.md"
HANDOFF_DOC = REPO / "docs/handoff-chain.md"


def _parse_profile(text: str):
    lines = text.splitlines()
    assert lines and lines[0] == "---"
    assert "---" in lines[1:]
    closing = lines.index("---", 1)
    assert closing > 1
    pairs = []
    for line in lines[1:closing]:
        assert line and not line.startswith((" ", "\t", "#"))
        assert line.count(":") == 1
        key, value = line.split(":", 1)
        assert key in {"name", "model", "thinking"}
        assert value.startswith(" ")
        scalar = value.strip()
        assert re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", scalar)
        pairs.append((key, scalar))
    assert len(pairs) == 3
    assert len({key for key, _ in pairs}) == 3
    fields = dict(pairs)
    assert fields["name"] == "expert-reviewer"
    body = "\n".join(lines[closing + 1 :]).strip()
    assert body
    return fields, body


def _profile():
    return _parse_profile(PROFILE.read_text())


def test_expert_profile_selects_one_exact_model_and_reasoning_level():
    fields, body = _profile()
    assert fields == {
        "name": "expert-reviewer",
        "model": "openai-codex/gpt-6-astra",
        "thinking": "max",
    }
    assert body


def test_expert_profile_contract_rejects_ambiguous_or_open_configuration():
    valid = PROFILE.read_text()
    invalid = [
        valid.replace("name: expert-reviewer", "name: other"),
        valid.replace("model: openai-codex/gpt-6-astra", "model: unauthorized\nmodel: openai-codex/gpt-6-astra"),
        valid.replace("name: expert-reviewer", "name: other\nname: expert-reviewer"),
        valid.replace("thinking: max", "thinking: low\nthinking: max"),
        valid.replace("thinking: max", "fallback: default\nthinking: max"),
        valid.replace("name: expert-reviewer\n", ""),
        valid.replace("model: openai-codex/gpt-6-astra\n", ""),
        valid.replace("thinking: max", "thinking:"),
        valid.replace("thinking: max", "thinking:\n  level: max"),
        valid.replace("thinking: max", "thinking: [max]"),
        valid.replace("thinking: max", "thinking: {level: max}"),
        valid.replace("thinking: max", "thinking: |"),
        valid.replace("thinking: max", "thinking: >"),
        valid.replace("thinking: max", "thinking: &level max"),
        valid.replace("---\n", " ---\n", 1),
        valid.replace("---\n# EXPERT", "--- extra\n# EXPERT", 1),
        "---\nname: expert-reviewer\nmodel: openai-codex/gpt-6-astra\nthinking: max\n---\n",
    ]
    for text in invalid:
        try:
            _parse_profile(text)
        except AssertionError:
            continue
        raise AssertionError("invalid EXPERT profile was accepted")


def test_expert_profile_is_read_only_and_makes_blocks_actionable():
    _, raw_body = _profile()
    body = " ".join(raw_body.split())
    for phrase in [
        "one exact pushed commit",
        "independently and read-only",
        "Do not edit or steer the subject",
        "Return the result to the owning conversation",
        "Return `PASS`",
        "Return `BLOCK`",
        "violated approved invariant",
        "root cause or failing lifecycle seam",
        "proportionate repair direction",
        "approaches to avoid",
        "positive, negative, failure, and replay tests",
        "regression risks",
        "repaired together",
        "bounded alternatives",
        "approved product contract",
        "An EXPERT cannot expand product scope",
        "realistic product impact",
        "proportionate remediation cost",
        "PASS does not mean that no imaginable finding exists",
        "evidence-based promotion trigger",
        "explicit operator authorization",
    ]:
        assert phrase in body

    assert "PASS only when no finding remains" not in body
    assert "BLOCK for any material defect" not in body


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
        "Treat every verdict as bounded evidence",
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


def test_project_oversee_entry_is_a_policy_free_compatibility_shim():
    raw = SHIM.read_text()
    text = " ".join(raw.split())
    assert "compatibility shim" in text
    assert "plugin-managed global `prime-claw-oversee-episode` skill" in text
    assert "native activation and readiness tools" in text
    for retired in [
        "one owner-coordination message", "15-minute", "rlm.spawn",
        "expert-reviewer.md", "handoff_spec_episode", "finalize_spec_episode",
        "merge readiness", "technical failure",
    ]:
        assert retired not in raw
    link = REPO / ".agents/skills/oversee-episode"
    assert link.is_symlink()
    assert link.resolve() == SHIM.parent.resolve()


def test_current_docs_describe_managed_on_demand_guide_and_loaded_generation_boundary():
    text = " ".join(DOC.read_text().split())
    for phrase in [
        "selected global role kernel is the current neutral invariant floor",
        "plugin-managed global `prime-claw-oversee-episode` guide",
        "one intended tool-result continuation",
        "active-owner handoff and first finalization",
        "project `oversee-episode` entry is a compatibility shim",
        "current consumed prospective receipt",
        "Loaded-generation compatibility reference (temporary)",
        "one coordinated full restart",
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
