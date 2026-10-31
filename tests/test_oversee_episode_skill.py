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
    assert 300 <= len(words) <= 1800
    text = " ".join(raw.split())
    for phrase in [
        "name: prime-claw-oversee-episode",
        "this Conversation's active Episode",
        "select the `.prime-claw/ownership.json` entry keyed by its exact `ownerSessionId`",
        "Version 1 selects retained folder oversight; version 2 selects task-native oversight",
        "For version 2, select the provider only from that exact owner",
        "retains its exact task ID/path",
        "40-hex `providerRevision` and complete native task view",
        "sole durable product and execution contract",
        "Never consult `.ralph/plans` in this mode",
        "In branch-local mode the Episode owns task content on its code branch and the Conversation owns lifecycle status on main",
        "task commits/pushes never enter the code DAG",
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
        "Prime Claw abandonment: task TASK-ID; pushed Episode head EPISODE-HEAD; code was not merged.",
        "Beads terminals use native/Git",
        "add no public status API, publisher, protocol, or classifier",
        "Grandfathered Backlog sets only the bound main task to `Ready for Merge`",
        "Independent Backlog publishes the exact Ready status on the disconnected task branch",
        "preserving its task content plus authorized status",
        "Git blocks every other code conflict",
        "remaining lifecycle and cleanup flow applies only to version 2 task-native ownership",
        "Do not create lifecycle receipts or replay protocols",
        "git merge --no-edit currentMainHead",
        "restore its pre-merge Episode task content, apply only the authorized status, let Git block every other conflict, and push the refreshed candidate",
        "leaves both code heads unchanged",
        "Independent Backlog publishes `Done` only on `refs/heads/prime-claw/tasks`",
        "fast-forwards the Episode nested task clone to that exact terminal revision before cleanup",
        "creates the exact built-in `archive/tasks/` directory inside the nested store when absent",
        "Both push without force and recheck identity/status",
        "Beads first records current clean pushed canonical code `mainHead` (not a task-status commit)",
        "proves exact branch/upstream/remote `candidateHead` and ancestry",
        "guarded `--if-status in_progress` status-plus-note update to `ready_for_merge`",
        "exact local/remote raw content, revision, ref, and preserved unrelated fields",
        "Show `(taskId, mainHead, candidateHead)` plus factual native evidence",
        "no provider revision or task equality becomes approval authority",
        "**Delay** is a strict no-op",
        "Grandfathered Backlog returns only the bound main task to `In Progress`",
        "guarded `--if-status ready_for_merge` update to `in_progress`",
        "Then call `handoff_task_episode` for the same Episode",
        "Before **Merge**, re-read ownership and freshly preflight the exact authorized `(taskId, mainHead, candidateHead)`",
        "git merge-base --is-ancestor mainHead candidateHead",
        "git merge --ff-only candidateHead",
        "push main normally and prove main/upstream/direct remote equal `candidateHead`",
        "Grandfathered Backlog then publishes its exact task-only `Done` code commit",
        "guarded `--if-status ready_for_merge` update to `done`",
        "truthful final note naming the tuple/code publication",
        "never force, replay, or a fresh transaction",
        "Apply **Abandon** only after explicit operator confirmation",
        "selects only the bound task file from that Episode head",
        "reapplies its non-`Done` status and truthful Final Summary through the supported CLI",
        "verifies only the active/archive task move and no Episode code, commits, and pushes",
        "cleanup-only `finalize_task_episode`",
        "atomically removes only the unchanged owner entry",
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
        "provider-absent record, or `provider: \"backlog\"` without `providerRevision`/`taskEvidence`",
        "independent Backlog history",
        "retains its exact task ID/path",
        "40-hex `providerRevision` and complete native task view",
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
        "Custom `done` means completion; never map `closed` to canonical `Done`",
        "guarded `--if-status in_progress` status-plus-note update to `ready_for_merge`",
        "guarded `--if-status ready_for_merge` update to `in_progress`",
        "guarded `--if-status ready_for_merge` update to `done`",
        "no provider revision or task equality becomes approval authority",
        "provider-absent record, or `provider: \"backlog\"` without `providerRevision`/`taskEvidence`",
        "independent Backlog history",
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
    for surface in ("plan_task", "implement_task", "create_task_episode", "finalize_task_episode", "transition_spec_episode_to_task"):
        assert surface in current + future
    assert "`plan`" in current and "`implement-task`" in current
    assert "native `/skill:`" in future
    assert "/plan TASK-ID" not in current + future
    assert "/implement-task TASK-ID" not in current + future

def test_current_docs_distinguish_episode_edit_scope_and_cleanup_boundary():
    future = " ".join(FUTURE_DOC.read_text().split())
    current = " ".join(DOC.read_text().split())

    assert (
        "The Episode implements approved code, documentation, and tests in its isolated worktree "
        "and exclusively owns bound task content in the selected branch-local Backlog, independent "
        "Backlog, or published Beads store. The Conversation exclusively owns lifecycle status and "
        "review through canonical code plus the selected provider's primary native history"
    ) in future
    assert "The Episode edits only its bound task content" not in future

    assert "stores no review, progress, merge, or abandonment receipts" in current
    assert "Version 2 stores no `cleanupHead` or cleanup-progress stage" in current
    assert "cleanup-only `finalize_task_episode`" in current
    assert "ordinary Git and the selected provider's supported native CLI" in current
    assert "placement, and task-native lifecycle receipts" not in current

    traceability = " ".join(TRACEABILITY.read_text().split())
    assert (
        "A task-native Episode implements approved code, documentation, and tests in its isolated "
        "worktree, exclusively owns the bound task's content in the selected branch-local Backlog, "
        "independent Backlog, or published Beads store, publishes provider-native task history "
        "separately from code, and leaves lifecycle status to the Conversation"
    ) in traceability
    assert "A task-bound Episode edits only its exact Backlog task content" not in traceability
    assert "retained version-1 compatibility folder Episodes keep their plan workflow" in traceability
    assert "`PRIMECLAW-10.15`, `PRIMECLAW-10.24`, and `PRIMECLAW-10.26`" in traceability


def test_task_native_cleanup_is_prompt_led_without_second_confirmation():
    text = " ".join(GUIDE.read_text().split())
    task_policy = text.split("The remaining lifecycle and cleanup flow applies only to version 2", 1)[1]
    lower = task_policy.lower()
    assert "before merge readiness" in lower
    assert "provider-reported idle completion" in lower
    assert "explicitly proven descendant" in lower
    assert "prime agent list/state responses" in lower
    assert "active or unprovable-idle sessions block readiness and merge" in lower
    assert "cleanup independently rechecks before mutation" in lower
    assert "automatically" in lower and "immediately" in lower
    assert "second cleanup confirmation" in lower
    for identifier in ("taskId", "episodeHead", "outcome"):
        assert identifier in task_policy
    error_policy = lower.split("on error/interruption", 1)[1]
    assert "conversation interprets provider evidence" in error_policy
    assert "re-read current ownership, prime agent, provider, and git state" in error_policy
    assert "re-invoke only when current evidence proves safe progress" in error_policy
    assert "consult the operator only when safe progress is impossible" in error_policy
    for obsolete in (
        "confirmed: true", "cleanup needs separate authority",
        "Cleanup** is separately explicit", "Same-head retry is idempotent",
        "durably binds that head",
    ):
        assert obsolete not in task_policy


def test_current_task_cleanup_docs_remove_second_confirmation_but_keep_evidence():
    for path in (DOC, HANDOFF_DOC, REPO / "docs/user-stories/I-episode-finalization.md"):
        text = " ".join(path.read_text().split())
        assert "without separate cleanup confirmation" in text, path
        assert "provider-reported idle completion" in text, path
        assert "explicitly proven descendants" in text, path
        assert "current ownership, provider, Git, and selected-provider evidence" in text, path
        assert "durable cleanup head" not in text, path
        assert "Same-head retry is idempotent" not in text, path
