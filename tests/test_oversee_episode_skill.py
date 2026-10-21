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
    assert 300 <= len(words) <= 950
    text = " ".join(raw.split())
    for phrase in [
        "name: prime-claw-oversee-episode",
        "this Conversation's active Episode",
        "select the `.prime-claw/ownership.json` entry keyed by its exact `ownerSessionId`",
        "Version 1 selects retained folder oversight; version 2 selects task-native oversight",
        "For version 2 task-native ownership",
        "exact Backlog task ID and project-relative task path",
        "sole durable product and execution contract",
        "Never consult `.ralph/plans` in this mode",
        "The Episode owns task content on its branch; the Conversation owns lifecycle status on main",
        "For retained version 1 folder ownership",
        "Keep that pair active through blocking, candidate review, and revision",
        "exact operator-authorized version-1 recovery",
        "never live and never switches modes",
        "exceptional `transition_spec_episode_to_task` cutover surface",
        "An exact same-binding replay is the only idempotent replay",
        "plan deletion remains a separate reviewed step",
        "one reported slice at a time",
        "Accept and advance",
        "Request an in-scope revision",
        "Pause",
        "Consult the operator",
        "canonical handoff",
        "remaining lifecycle and cleanup flow applies only to version 2 task-native ownership",
        "ordinary Git and the supported Backlog CLI",
        "Do not create lifecycle receipts",
        "set only the bound main task to `Ready for Merge` through the supported Backlog CLI",
        "verify that only the bound task path changed",
        "git merge --no-edit mainHead",
        "restore its pre-merge Episode content",
        "apply only the Conversation-authorized `Ready for Merge` status",
        "Let Git block other conflicts",
        "show the operator `(taskId, mainHead, candidateHead)`",
        "not a custom status publisher, receipt, digest, or reconciliation transaction",
        "**Delay** is a strict no-op",
        "Set only the bound main task back to `In Progress` through Backlog",
        "git merge --no-edit currentMainHead",
        "pre-merge Episode content plus only the authorized `In Progress` status",
        "then call `handoff_task_episode`",
        "Before **Merge**, re-read ownership and freshly preflight the exact `(taskId, mainHead, candidateHead)`",
        "its bound task must also be `Ready for Merge`",
        "no staged or tracked changes",
        "git merge --ff-only candidateHead",
        "set the exact task to `Done` through Backlog",
        "Apply **Abandon** only after explicit operator confirmation",
        "cleanup needs separate authority",
        "cleanup-only `finalize_task_episode`",
        "durably binds that head",
        "removes exact idle runtime, worktree, and branch",
        "Same-head retry is idempotent",
        "Review conclusions are evidence",
        "concrete material contract defect",
        "Speculative hardening",
        "reviewer-invented invariants are non-blocking",
        "stop that review loop",
        "Do not request or implement another repair merely to satisfy adversarial review",
        "bounded goal",
        "one exact heartbeat",
        "operator alone decides scope",
    ]:
        assert phrase in text
    assert "Bead chronology" not in raw
    for forbidden in [
        "episodeId", "toolCallId", "rlm.find_models",
        "openai-codex/", "prime-claw-h6w", "15-minute", "delete worktree",
        "PRIME_CLAW_ROLE_KERNEL_V1",
    ]:
        assert forbidden not in raw


def test_managed_conversation_guide_has_no_authentication_metadata_or_policy_copy():
    assert not (REPO / "src/prime-agent-plugin/extension-support/conversation-guide-metadata.ts").exists()
    source = (REPO / "src/prime-agent-plugin/extension-support/conversation-oversight.ts").read_text()
    for obsolete in ("SHA256", "GuideReceipt", "activate_conversation_guide", "conversation_guide_status"):
        assert obsolete not in source


def test_current_docs_describe_ordinary_guide_and_registry_boundary():
    text = " ".join(DOC.read_text().split())
    for phrase in (
        "Universal → Project → Conversation → Episode",
        "complete ordinary `prime-claw-oversee-episode` guidance",
        "There is no guide activation, disclosure, hash, version, receipt",
        "`.prime-claw/ownership.json` is the sole durable lifecycle registry",
        "one active Episode per Conversation",
        "one full `prime-claw-oversee-episode` custom message",
        "operator alone decides product direction",
        "Guarded version-1 to version-2 ownership bridge",
        "transition_spec_episode_to_task",
        "Only an exact same-binding replay is idempotent",
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
    for surface in ("/plan TASK-ID", "/implement-task TASK-ID", "create_task_episode", "finalize_task_episode", "transition_spec_episode_to_task"):
        assert surface in current + future

def test_current_docs_distinguish_episode_edit_scope_and_cleanup_boundary():
    future = " ".join(FUTURE_DOC.read_text().split())
    current = " ".join(DOC.read_text().split())

    assert (
        "The Episode implements approved code, documentation, and tests in its isolated worktree "
        "and exclusively owns the bound task's content there. The Conversation exclusively owns "
        "lifecycle status on main"
    ) in future
    assert "The Episode edits only its bound task content" not in future

    assert "stores no review, progress, merge, or abandonment receipts" in current
    assert "Version 2 stores no `cleanupHead` or cleanup-progress stage" in current
    assert "cleanup-only `finalize_task_episode`" in current
    assert "ordinary Git and the supported Backlog CLI" in current
    assert "placement, and task-native lifecycle receipts" not in current

    traceability = " ".join(TRACEABILITY.read_text().split())
    assert (
        "A task-native Episode implements approved code, documentation, and tests in its isolated "
        "worktree, exclusively owns the bound task's content there, and leaves lifecycle status "
        "to the Conversation"
    ) in traceability
    assert "A task-bound Episode edits only its exact Backlog task content" not in traceability
    assert "retained version-1 compatibility folder Episodes keep their plan workflow" in traceability
    assert "`PRIMECLAW-10.15`, `PRIMECLAW-10.24`, and `PRIMECLAW-10.26`" in traceability
