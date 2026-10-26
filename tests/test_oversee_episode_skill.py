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
    assert 300 <= len(words) <= 1400
    text = " ".join(raw.split())
    for phrase in [
        "name: prime-claw-oversee-episode",
        "this Conversation's active Episode",
        "select the `.prime-claw/ownership.json` entry keyed by its exact `ownerSessionId`",
        "Version 1 selects retained folder oversight; version 2 selects task-native oversight",
        "For version 2, select the provider only from that exact owner",
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
        "Beads abandonment, finalization, and cleanup remain inactive",
        "Readiness and merge status use the existing native helper and ordinary Git",
        "no public status surface, receipt, snapshot, publisher, protocol, classifier, or replacement resource",
        "Backlog sets only the bound main task to `Ready for Merge`",
        "preserving its task content plus authorized status",
        "Git blocks every other conflict",
        "git merge --no-edit currentMainHead",
        "restore its pre-merge Episode task content, apply only the authorized `In Progress` status, let Git block every other conflict, and push the refreshed candidate",
        "Backlog then publishes its exact task-only `Done` commit, pushes, and rechecks identity/status",
        "Beads first records current clean pushed canonical code `mainHead` (not a task-status commit)",
        "proves exact branch/upstream/remote `candidateHead` and ancestry",
        "guarded `--if-status in_progress` status-plus-note update to `ready_for_merge`",
        "exact local/remote raw content, revision, ref, and preserved unrelated fields",
        "Show `(taskId, mainHead, candidateHead)` plus factual native evidence",
        "no provider revision or task equality becomes approval authority",
        "**Delay** is a strict no-op",
        "Backlog returns only the bound main task to `In Progress`",
        "guarded `--if-status ready_for_merge` update to `in_progress`",
        "Then call `handoff_task_episode` for the same Episode",
        "Before **Merge**, re-read ownership and freshly preflight the exact authorized `(taskId, mainHead, candidateHead)`",
        "git merge-base --is-ancestor mainHead candidateHead",
        "git merge --ff-only candidateHead",
        "push main normally and prove main/upstream/direct remote equal `candidateHead`",
        "Backlog then publishes its exact task-only `Done` commit",
        "guarded `--if-status ready_for_merge` update to `done`",
        "truthful final note naming the tuple/code publication",
        "never force, replay, or a fresh transaction",
        "Apply **Abandon** only after explicit operator confirmation",
        "cleanup needs separate authority",
        "cleanup-only `finalize_task_episode`",
        "durably binds that head",
        "removes exact idle runtime, worktree, and branch",
        "Same-head retry is idempotent",
        "Review conclusions are evidence",
        "material contract defect",
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



def test_managed_conversation_guide_qualifies_version2_review_by_provider():
    raw = GUIDE.read_text()
    text = " ".join(raw.split())
    for phrase in (
        "select the provider only from that exact owner",
        'provider-absent record or `provider: "backlog"`',
        "exact Backlog task ID and project-relative task path",
        'A `provider: "beads"` record has no `taskPath`',
        "published `providerRevision`",
        "complete raw `taskEvidence`",
        "code `baseRef`",
        "use `bd context --json`, one supported `bd dolt pull`",
        "exact `bd show TASK-ID --json --long --include-comments` reads",
        "never force, retry uncertain transport, or use raw Dolt writes",
        "never invent a normalized task, path, digest, receipt, or alternate authority",
        "persisted raw task and revision",
        "synchronized current raw task, publication ref, candidate code base/head",
        "An unrelated-task revision descendant alone is compatible",
        "surface the exact persisted and current fields",
        "compatible in-scope clarification or living-plan update",
        "genuine semantic conflict, authority change, scope expansion, or product decision",
        "Never replace this judgment with a classifier",
        "supplies exact previous/current native context to the existing Episode LLM",
        "Compatible owner-authored, outside same-task, and unrelated descendant changes continue",
        "Record it through canonical handoff with `handoff_task_episode`",
        "guidance supplies only bounded focus",
        "findings, and Review conclusions are evidence, not approval",
        "`handoff_task_episode` proves owner/resources, pushed code, one pull, and paired publication evidence",
        "callback records only `providerRevision`, raw `taskEvidence`, code `head`, and `updatedAt`",
        "Never replace this judgment with a classifier",
        "Integrity failure stops without retry",
        "current synchronized native status—not the older ownership observation—governs",
        "Only current `in_progress` may receive one guarded `--if-status in_progress` status-plus-note update",
        "--if-status in_progress",
        "recording truthful blocker evidence and exact unblock condition",
        "Already `blocked` is a no-op",
        "cleared operator or accepted evidence",
        "--if-status blocked",
        "with truthful clearance evidence",
        "then `handoff_task_episode`",
        "callback records only `providerRevision`, raw `taskEvidence`, code `head`, and `updatedAt`",
        "Never write `ownership.json` directly or keep an artificial `in_progress` snapshot",
        "Beads abandonment, finalization, and cleanup remain inactive",
        "guarded `--if-status in_progress` status-plus-note update to `ready_for_merge`",
        "guarded `--if-status ready_for_merge` update to `in_progress`",
        "guarded `--if-status ready_for_merge` update to `done`",
        "no provider revision or task equality becomes approval authority",
        'provider-absent record or `provider: "backlog"`',
    ):
        assert phrase in text
    assert text.index("select the `.prime-claw/ownership.json` entry keyed by its exact `ownerSessionId`") < text.index("select the provider only from that exact owner")
    assert text.index("For retained version 1 folder ownership") < text.index("Review one reported slice at a time")
    assert text.index("push main normally and prove main/upstream/direct remote equal `candidateHead`") < text.index("guarded `--if-status ready_for_merge` update to `done`")

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
    assert "optional `cleanupHead`" in current
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
