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
        "task mode is mandatory even when the current assignment has no task block",
        "Never fall back to folder mode while any version-2 ownership record exists",
        "task-bound Episode session follows its execute policy",
        "backlog task view --json -- TASK-ID",
        "status to be exactly `Blocked`",
        "task is the sole lifecycle authority",
        "accepted Episode-to-Conversation report",
        "Do not infer missing evidence or copy Episode-owned task content across checkouts",
        "repository root of the canonical primary `main` checkout",
        "one exact-task-only commit",
        "unrelated main dirt is allowed",
        "Push is prompt best-effort evidence and local commit success remains authoritative",
        "same ownership, branch, worktree, and session",
        "Never create a new task, admission, Episode resource, or status-sync message",
        "Only when there is no version-2 ownership record and no task block",
        ".ralph/plans/blocked/EXECUTION_PLAN.md",
        ".ralph/plans/blocked/SPECIFICATION.md",
        "Never mix the two modes",
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
