import hashlib
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "prime-agent-plugin" / "skills" / "project-templates" / "blocked.md"
TRACKED = ROOT / ".agents" / "skills" / "blocked" / "SKILL.md"
MANIFEST = ROOT / ".prime-claw" / "templates.json"


def test_blocked_skill_supports_disjoint_task_and_retained_folder_authority() -> None:
    normalized = " ".join(SOURCE.read_text().split())
    for fragment in (
        ".prime-claw/ownership.json",
        "prompt text alone never grants owner or lifecycle authority",
        "version-1 record selects retained folder mode even when a task block is present",
        "version-2 record selects task mode even when the assignment has no task block",
        "task block is a candidate only when neither persisted ownership nor old in-place legacy files selects the mode",
        "Never fall back to folder mode while this Conversation has a version-2 ownership record.",
        "`<operator-episode-owner-session>`",
        "intentionally differs from the Episode's own session ID",
        "exact `ownerSessionId` registry entry",
        "recorded worktree/session identity",
        "task-bound Episode session follows its execute policy",
        'provider-absent record or `provider: "backlog"`',
        '`provider: "beads"` record must carry no task path',
        "published `providerRevision`, complete raw `taskEvidence`, code `baseRef`",
        "backlog task view --json -- TASK-ID",
        "status to be exactly `Blocked`",
        "task is the sole lifecycle authority",
        "accepted Episode-to-Conversation report",
        "Do not infer missing evidence or copy Episode-owned task content across checkouts",
        "repository root of the canonical primary `main` checkout",
        "one exact-task-only status commit",
        "unrelated main dirt is allowed",
        "push is prompt best-effort evidence after authoritative local commit success",
        "same task, ownership, branch, worktree, and durable Episode session",
        "Never create a new task, admission, Episode resource, status-sync message",
        "current synchronized native state—not the older ownership observation—governs",
        "bd context --json",
        "exactly one supported `bd dolt pull`",
        "bd show TASK-ID --json --long --include-comments",
        "An accepted pushed blocker may move only current `in_progress` to `blocked`",
        "--if-status in_progress",
        "<truthful blocker, evidence, and exact unblock condition>",
        "bd dolt push --no-adopt",
        "If current state is already `blocked`, do not publish again",
        "operator or accepted evidence clears it",
        "--if-status blocked",
        "truthful clearance evidence",
        "Then call `handoff_task_episode`",
        "Never write `ownership.json` directly",
        "not a live Episode",
        "Missing active files are not live identity and never permit task-native or no-ownership fallback",
        "keep both files active throughout the blocked state and ordinary continuation",
        "persisted version-1 record's exact recorded worktree",
        ".ralph/plans/blocked/SPECIFICATION.md",
        "exactly one of `EXECUTION_PLAN.md` or `IMPLEMENTATION_PLAN.md`",
        "active destination to be absent",
        "wait for the operator to explicitly decide that its unblock condition is satisfied",
        "call `restore_blocked_spec_episode` with the exact owned future-folder location",
        "`confirmedUnblocked: true`",
        "never move the files manually",
        "re-reads unchanged ownership",
        "revalidates the same active worktree identity",
        "follows no symlink",
        "never fall through to task-native mode or create another Episode",
        "With no ownership, preserve the separate old in-place folder behavior",
        "Do not mutate task-native Backlog status, completion, archival, finalization, or cleanup state",
        "Never mix modes",
    ):
        assert fragment in normalized


def test_blocked_skill_tracked_copy_and_manifest_hash_match_source() -> None:
    source = SOURCE.read_bytes()
    assert TRACKED.read_bytes() == source
    digest = hashlib.sha256(source).hexdigest()
    item = json.loads(MANIFEST.read_text())["assets"]["project-skill-blocked"]
    assert item["baselineSha256"] == digest
    assert item["installedSha256"] == digest
    assert item["availableUpstreamSha256"] == digest
    assert item["state"] == "managed"
