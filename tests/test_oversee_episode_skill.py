import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
GUIDE = REPO / "src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"
FUTURE_DOC = REPO / "docs/future-specification-bundles.md"
HANDOFF_DOC = REPO / "docs/handoff-chain.md"
TRACEABILITY = REPO / "docs/user-stories/traceability.md"


def test_managed_conversation_guide_is_lean_judgment_only():
    raw = GUIDE.read_text()
    body = raw.split("---", 2)[-1]
    words = re.findall(r"\b[\w'-]+\b", body)
    assert 300 <= len(words) <= 750
    text = " ".join(raw.split())
    for phrase in [
        "name: prime-claw-oversee-episode",
        "one active Episode owned by this Conversation",
        "one reported slice at a time",
        "Accept and advance",
        "Request an in-scope revision",
        "Pause",
        "Consult the operator",
        "canonical handoff",
        "Review conclusions are evidence",
        "concrete material contract defect",
        "Speculative hardening",
        "reviewer-invented invariants are non-blocking",
        "stop that review loop",
        "Do not request or implement another repair merely to satisfy adversarial review",
        "bounded goal",
        "one exact heartbeat",
        "operator alone decides scope",
        "For version 2 task-native ownership",
        "exact Backlog task ID and project-relative task path",
        "sole durable product and execution contract",
        "Never consult `.ralph/plans` in this mode",
        "The Episode owns task content on its branch; the Conversation owns lifecycle status on main",
        "For retained version 1 folder ownership",
        "Inspect persisted `.prime-claw/ownership.json` from the canonical primary checkout before prompt tags",
        "Version 1 selects retained folder oversight; version 2 selects task-native oversight",
        "A task tag is only a candidate when ownership does not decide",
        "Placement alone is not live Episode identity",
        "Keep that pair active through blocking, candidate review, and revision",
        "missing pair uses only exact operator-authorized version-1 recovery",
        "never live and never switches modes",
        "Use only legacy `handoff_spec_episode` and `finalize_spec_episode` paths",
        "never claim or mutate task-native Backlog status, completion, archival, finalization, or cleanup authority",
        "old in-place work, not an Episode",
        "remaining outcome and cleanup flow applies only to version 2 task-native ownership",
        "do not edit, copy, or mirror Episode-owned task content",
        "never hand off or request merge from that head",
        "publish `Ready for Merge`",
        "preserve task content and parent identity",
        "push a two-parent candidate",
        "Only then request the operator's merge decision",
        "Delay** needs an explicit operator choice",
        "strict no-op, never abandonment",
        "Request Changes** only after the operator explicitly chooses it",
        "Publish exact-task-only `In Progress`",
        "Retry failed integration from its returned receipt",
        "Apply **Merge** only when the operator explicitly authorizes the exact verified",
        "Fast-forward only to that candidate; never force",
        "Immediately publish `Done` through Backlog",
        "local `Done` commit is authoritative",
        "Keep active ownership",
        "Apply **Abandon** only after explicit operator confirmation",
        "candidate/main relationship",
        "Reject any archive destination tracked at the bound main head",
        "inbound task links before mutation",
        "Select only that task blob",
        "Reapply captured status through Backlog",
        "archive without `Done`",
        "cleanup needs separate authority",
        "Use `finalize_task_episode` as the sole task-native lifecycle coordinator",
        "Retain every returned Ready, phased-progress, and terminal receipt exactly",
        "Cleanup** through that tool only after separate explicit operator authority",
        "The host rebinds owner, Episode, and all resources",
        "reverifies pushed terminal evidence",
        "removes exact idle runtime, worktree, and branch",
        "Keep ownership active through interruption",
        "close only after all resources are absent",
    ]:
        assert phrase in text
    assert "Bead chronology" not in raw
    for forbidden in [
        "ownerSessionId", "episodeId", "toolCallId", "rlm.find_models",
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


def test_current_docs_lead_with_task_native_and_label_folder_compatibility():
    current = DOC.read_text()
    future = FUTURE_DOC.read_text()

    assert "### Primary task-native path" in current
    assert "### Retained version-1 compatibility path" in current
    assert "## Task-native terminal outcomes and cleanup" in current
    assert "## Retained version-1 compatibility finalization" in current

    assert "## Primary task-native lifecycle" in future
    assert "## Retained version-1 compatibility" in future
    assert "## Retained version-1 bundle lifecycle" in future
    for surface in ("/plan TASK-ID", "/implement-task TASK-ID", "create_task_episode", "finalize_task_episode"):
        assert surface in current + future

def test_current_docs_distinguish_episode_edit_scope_status_and_action_receipts():
    future = " ".join(FUTURE_DOC.read_text().split())
    current = " ".join(DOC.read_text().split())

    assert (
        "The Episode implements approved code, documentation, and tests in its isolated worktree "
        "and exclusively owns the bound task's content there. The Conversation exclusively owns "
        "lifecycle status on main"
    ) in future
    assert "The Episode edits only its bound task content" not in future

    assert (
        "The strict ownership record persists lifecycle state plus durable owner, authority, "
        "placement, and resource bindings. It does not store Ready, phased-progress, or terminal "
        "action receipts."
    ) in current
    assert (
        "`finalize_task_episode` returns those exact receipts to the owning Conversation, which "
        "retains them for later authorized outcomes or bounded retries."
    ) in current
    assert "placement, and task-native lifecycle receipts" not in current

    traceability = " ".join(TRACEABILITY.read_text().split())
    assert (
        "A task-native Episode implements approved code, documentation, and tests in its isolated "
        "worktree, exclusively owns the bound task's content there, and leaves lifecycle status "
        "to the Conversation"
    ) in traceability
    assert "A task-bound Episode edits only its exact Backlog task content" not in traceability
    assert "retained version-1 compatibility folder Episodes keep their plan workflow" in traceability
    assert (
        "`PRIMECLAW-10.15`, `PRIMECLAW-10.24`, and `PRIMECLAW-10.26`"
    ) in traceability
