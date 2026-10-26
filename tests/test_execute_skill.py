import hashlib
import json
from pathlib import Path
import subprocess


ROOT = Path(__file__).resolve().parents[1]
BACKLOG = ROOT / "deps" / "backlog" / "dist" / "backlog"
EXECUTE_SKILL = ROOT / "src" / "prime-agent-plugin" / "skills" / "project-templates" / "execute.md"
AGENT_SKILL = ROOT / ".agents" / "skills" / "execute"


def test_execute_skill_enforces_one_small_complete_slice() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "one small elephant-carpaccio slice",
        "smallest end-to-end change that produces observable value or decisive evidence",
        "within the current context window",
        "without relying on auto-compaction",
        "clean single-purpose commit pushed for review",
        "split it before starting",
        "stop and report; do not begin another slice",
    ):
        assert fragment in text


def test_execute_skill_rejects_reviewer_driven_scope_expansion() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "Implement only the approved behavior",
        "findings are evidence, not new scope",
        "Do not implement speculative hardening",
        "concrete, material defect against that approved contract",
        "simplest change that fixes the defect",
    ):
        assert fragment in text

    for unwanted in (
        "approved threat model", "trusted assumptions",
        "qualitative complexity budget", "hardening backlog",
        "simplification checkpoint", "manual recovery",
    ):
        assert unwanted not in text


def test_execute_skill_defers_goal_and_heartbeat_control_to_plugin_context() -> None:
    text = EXECUTE_SKILL.read_text()

    for fragment in ("pause_thread_goal", "resume_thread_goal", "Set up a goal", "heartbeat"):
        assert fragment not in text


def test_agent_execute_skill_uses_canonical_definition() -> None:
    assert AGENT_SKILL.is_dir() and not AGENT_SKILL.is_symlink()
    assert (AGENT_SKILL / "SKILL.md").read_bytes() == EXECUTE_SKILL.read_bytes()


def test_managed_execute_asset_is_reconciled_to_the_canonical_source() -> None:
    source = EXECUTE_SKILL.read_bytes()
    assert (AGENT_SKILL / "SKILL.md").read_bytes() == source

    manifest = json.loads((ROOT / ".prime-claw" / "templates.json").read_text())
    entry = manifest["assets"]["project-skill-execute"]
    digest = hashlib.sha256(source).hexdigest()
    assert entry == {
        "source": "skills/project-templates/execute.md",
        "destination": ".agents/skills/execute/SKILL.md",
        "baselineSha256": digest,
        "installedSha256": digest,
        "acceptedOverrideSha256": None,
        "availableUpstreamSha256": digest,
        "state": "managed",
        "provenance": {
            "scope": "project",
            "exposure": "discoverable",
            "customization": "project-customizable",
            "lifecycleTrigger": "project-reconcile",
        },
    }


def test_task_native_execute_selects_only_the_persisted_provider() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "Select its provider only from that exact record",
        "Provider-absent and explicit Backlog without revision/evidence remain branch-local",
        "Explicit Backlog with revision/evidence uses the ignored independent nested clone",
        'A `provider: "beads"` record must have no `taskPath`',
        "exact non-empty `providerRevision`, complete raw `taskEvidence`, `baseRef`, worktree, branch, and Episode session identity",
        "Any mixed or missing binding stops for ownership recovery",
        "Do not redetect, replace, or infer it from repository files",
        'Only `provider: "beads"` selects the Beads branch',
        "Never mix commands, content, commits, or evidence between the two branches",
    ):
        assert fragment in text


def test_beads_execute_preserves_raw_contract_and_guards_native_publication() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())
    beads = text.split("### Beads task authority", 1)[1].split("## Retained folder-plan mode", 1)[0]

    for fragment in (
        "Run every Beads command from the exact recorded current linked worktree",
        "bd dolt pull",
        "bd show TASK-ID --json --long --include-comments",
        "native status is exactly `in_progress` and maps to canonical `In Progress`",
        "raw `design` is meaningful rather than blank or placeholder text",
        "exact current Dolt database, branch, revision, publication ref, and a clean working set",
        "description, design, acceptance criteria, notes, comments, labels, dependencies, and every other provider field",
        "provider-native names, shapes, values, and absence",
        "Compare the prior factual `taskEvidence` observation with the synchronized raw view field for field",
        "Inequality is not an approval boundary",
        "provider revision advance or unrelated-task change alone does not block",
        "use the exact raw before/current values supplied by the host and reason about their meaning",
        "Incorporate a compatible change inside the approved scope as the current working basis",
        "Escalate a genuine semantic conflict, scope expansion, or authority change without a write",
        "Do not use a deterministic semantic classifier and never silently overwrite either view",
        "`bd update TASK-ID` content fields: description, design, acceptance criteria, and notes",
        "It must not change status, title, type, priority, assignee, parent, dependencies, labels, comments, metadata, task identity, or lifecycle fields",
        "without `--status`, `--force`, raw Dolt SQL writes, or retry",
        "only the exact provider-generated revision/timestamp changes caused by that write",
        "every other raw task field unchanged, and a clean working set",
        "bd dolt push --no-adopt",
        "perform one native post-publication pull/read cycle",
        "remote publication to contain the intended published revision",
        "unrelated-task descendant may advance the final revision",
        "Route any outside same-task change through the reconciliation rule above",
        "not permission to pull again, retry, reset, force, adopt, or overwrite",
        "exact prior task observation, synchronized pre-write view, post-write view, final published view",
        "published provider revision/ref, code `HEAD`, and command failures",
        "never mutates ownership directly and never publishes lifecycle status",
    ):
        assert fragment in beads

    for forbidden in ("backlog task view", "backlog task edit"):
        assert forbidden not in beads.lower()


def test_backlog_execute_branch_retains_its_structured_contract() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())
    backlog = text.split("### Provider-absent or Backlog task authority", 1)[1].split("### Beads task authority", 1)[0]

    for fragment in (
        "Use the exact task ID and path selected above",
        "backlog task view --json -- TASK-ID",
        "returned canonical ID to match the bound ID",
        "status to be exactly `In Progress`",
        "supported `backlog task edit` operations",
        "canonical ID, task path, parent identity, and lifecycle status are unchanged",
        "single-purpose code-branch commit containing that task update",
        "one task-path-only commit in the nested clone",
        "Leave its status unchanged",
    ):
        assert fragment in backlog
    assert "bd " not in backlog


def test_execute_skill_bootstraps_only_an_exact_pre_upgrade_direct_owner() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "When the file is a Conversation-keyed registry, require the tag",
        "If the tag or exact registry binding is missing, stop for recovery",
        "One live-upgrade bootstrap exception applies only when the canonical file is the pre-upgrade direct record, not registry form",
        "its embedded `ownerSessionId` is self-identifying only after its non-inactive status",
        "exact recorded current worktree",
        "durable Episode ID",
        "readable matching Episode session file",
        "exact prompt task/source binding",
        "If a tag is present, it must match the embedded owner",
        "Any failed or ambiguous check stops for recovery",
        "this exception never applies to a registry",
        "never authorizes scanning or choosing among owners",
    ):
        assert fragment in text


def test_task_native_execute_binds_exact_task_and_preserves_status_authority() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "<operator-episode-task>",
        "version-2 ownership record selects **task-native Episode mode** and binds its exact task ID",
        "Provider-absent and explicit Backlog without revision/evidence remain branch-local",
        "Explicit Backlog with revision/evidence uses the ignored independent nested clone",
        "backlog task view --json -- TASK-ID",
        "returned canonical ID to match the bound ID",
        "status to be exactly `In Progress`",
        "Do not use `.ralph/plans` as authority in this mode",
        "The Episode exclusively owns task content",
        "publishes only to `refs/heads/prime-claw/tasks`",
        "supported `backlog task edit` operations",
        "never by editing task Markdown directly",
        "Implementation Plan",
        "Implementation Notes",
        "acceptance evidence and checked criteria",
        "Final Summary",
        "canonical ID, task path, parent identity, and lifecycle status are unchanged",
        "The owning Conversation exclusively owns lifecycle status",
        "primary nested task clone for independent Backlog",
        "must not pass `--status`",
        "call `backlog task complete` or `backlog task archive`",
        "no cross-checkout copy, mirroring, or dual write",
        "single-purpose code-branch commit containing that task update",
        "one task-path-only commit in the nested clone",
        "commit/push code separately only when code changed",
        "push `HEAD:refs/heads/prime-claw/tasks` without force",
        "Report both exact heads and push evidence through the existing Episode-to-Conversation channel",
        "Leave its status unchanged",
        "Do not merge, mark `Ready for Merge` or `Done`",
    ):
        assert fragment in text


def test_task_native_execute_retains_folder_episode_compatibility() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "Conversation-keyed registry",
        "`<operator-episode-owner-session>`",
        "owning Conversation's registry key",
        "intentionally differs from the Episode's own session ID",
        "exact `ownerSessionId` entry",
        "version-1 ownership record selects **retained folder-plan mode**",
        "version-2 ownership record selects **task-native Episode mode**",
        "A prompt tag never overrides persisted ownership",
        "Only when neither ownership nor old in-place files decides may `<operator-episode-task>` become a candidate task binding",
        "tag alone does not establish live Episode identity or grant Episode mutation or lifecycle authority",
        "active legacy `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files on canonical main",
        "This fallback is not a live Episode",
        "`.ralph/plans/EXECUTION_PLAN.md`",
        "`.ralph/plans/archive/`",
        "`.ralph/plans/blocked/`",
        "keep both active plan files in `.ralph/plans/` while work is blocked",
        "throughout candidate review or revision",
        "leave the active pair in place",
        "until the operator's terminal decision has been carried out and the exact ownership record is inactive",
        "With no ownership, preserve the old in-place folder workflow",
        "persisted version-1 record with a missing active pair must stop",
        "use only `restore_blocked_spec_episode` after the operator's explicit unblock decision",
        "execute cannot use chat instructions or any fallback before successful live-identity revalidation",
        "Only when no persisted ownership exists may clear operator-provided legacy instructions serve as the plan",
    ):
        assert fragment in text

    legacy = text.split("## Retained folder-plan mode", 1)[1].split("## One bounded implementation slice", 1)[0]
    for fragment in (
        "references, not lifecycle authority",
        "Never change a Backlog task's status",
        "mark it `Done` or `Blocked`",
        "finalize task-native ownership",
        "legacy file transitions do not create Episode identity or claim Backlog status, completion, archival, finalization, or cleanup authority",
        "stop without a Backlog lifecycle mutation",
    ):
        assert fragment in legacy
    for forbidden in (
        "backlog task complete", "backlog task archive",
        "if those files are absent and this is not a recorded live version-1 episode",
    ):
        assert forbidden not in legacy.lower()


def test_supported_task_content_edits_leave_status_and_unrelated_work_unchanged(tmp_path: Path) -> None:
    (tmp_path / "backlog").mkdir()
    (tmp_path / "backlog" / "config.yml").write_bytes(
        (ROOT / "backlog" / "config.yml").read_bytes()
    )

    def run(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
        result = subprocess.run(args, cwd=tmp_path, text=True, capture_output=True)
        if check and result.returncode != 0:
            raise AssertionError(result.stdout + result.stderr)
        return result

    run("git", "init", "-q")
    run("git", "config", "user.name", "Fixture")
    run("git", "config", "user.email", "fixture@example.test")
    (tmp_path / "unrelated.txt").write_text("baseline\n")
    run("git", "add", "backlog/config.yml", "unrelated.txt")
    run("git", "commit", "-q", "-m", "fixture baseline")
    run(
        str(BACKLOG), "task", "create", "Task-bound execution fixture",
        "--status", "In Progress", "--description", "Approved outcome",
        "--ac", "Observable result", "--plan", "Implement one bounded result",
        "--plain",
    )
    before = json.loads(run(
        str(BACKLOG), "task", "view", "--json", "--", "PRIMECLAW-1",
    ).stdout)["task"]
    run("git", "add", "--", before["path"])
    run("git", "commit", "-q", "--only", "-m", "admit fixture", "--", before["path"])
    (tmp_path / "unrelated.txt").write_text("unrelated work\n")

    run(
        str(BACKLOG), "task", "edit", "PRIMECLAW-1",
        "--append-plan", "Record the verified follow-up",
        "--append-notes", "Focused check passed",
        "--check-ac", "1", "--modified-file", "src/example.ts",
    )
    after = json.loads(run(
        str(BACKLOG), "task", "view", "--json", "--", "PRIMECLAW-1",
    ).stdout)["task"]

    assert after["id"] == before["id"]
    assert after["path"] == before["path"]
    assert after["parentTaskId"] == before["parentTaskId"]
    assert after["status"] == before["status"] == "In Progress"
    assert after["acceptanceCriteria"][0]["checked"] is True
    assert "Focused check passed" in after["implementationNotes"]
    assert "Record the verified follow-up" in after["implementationPlan"]
    assert after["modifiedFiles"] == ["src/example.ts"]

    run("git", "add", "--", after["path"])
    run("git", "commit", "-q", "--only", "-m", "record episode evidence", "--", after["path"])
    assert run("git", "show", "--pretty=", "--name-only", "HEAD").stdout.strip() == after["path"]
    assert run("git", "status", "--short").stdout.strip() == "M unrelated.txt"
