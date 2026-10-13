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


def test_task_native_execute_binds_exact_task_and_preserves_status_authority() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "<operator-episode-task>",
        "exact Backlog task ID already bound to this Episode",
        "backlog task view --json -- TASK-ID",
        "returned canonical ID to match the bound ID",
        "status to be exactly `In Progress`",
        "Do not use `.ralph/plans` as authority in this mode",
        "The Episode exclusively owns task content on its branch",
        "supported `backlog task edit` operations",
        "never by editing task Markdown directly",
        "Implementation Plan",
        "Implementation Notes",
        "acceptance evidence and checked criteria",
        "Final Summary",
        "canonical ID, task path, parent identity, and lifecycle status are unchanged",
        "The owning Conversation exclusively owns lifecycle status on main",
        "must not pass `--status`",
        "call `backlog task complete` or `backlog task archive`",
        "no cross-checkout copy, mirroring, or dual write",
        "single-purpose commit containing that exact task update",
        "push the Episode branch",
        "report the commit and push evidence through the existing Episode-to-Conversation channel",
        "Leave its status unchanged",
        "Do not merge, mark `Ready for Merge` or `Done`",
    ):
        assert fragment in text


def test_task_native_execute_retains_folder_episode_compatibility() -> None:
    text = " ".join(EXECUTE_SKILL.read_text().split())

    for fragment in (
        "If there is no task block, use **retained folder-plan mode**",
        "existing `/implement-spec` Episodes operational",
        "`.ralph/plans/EXECUTION_PLAN.md`",
        "`.ralph/plans/SPECIFICATION.md`",
        "`.ralph/plans/archive/`",
        "`.ralph/plans/blocked/`",
        "Keep planning docs and Backlog.md tasks current",
    ):
        assert fragment in text


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
