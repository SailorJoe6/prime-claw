from collections import Counter
import json
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
BACKLOG_SKILL = ROOT / ".agents" / "skills" / "backlog" / "SKILL.md"
PROJECT_PREPARE = ROOT / ".agents" / "skills" / "prepare" / "SKILL.md"
AGENT_GUIDANCE = ROOT / "AGENTS.md"
README = ROOT / "README.md"
BACKLOG_DOC = ROOT / "docs" / "backlog.md"
VISION = ROOT / "VISION.md"
LONG_RANGE_PLAN = ROOT / "LONG_RANGE_PLAN.md"
DEVELOPERS = ROOT / "DEVELOPERS.md"
DOCS_INDEX = ROOT / "docs" / "README.md"
EXECUTE_TEMPLATE = ROOT / "src" / "prime-agent-plugin" / "skills" / "project-templates" / "execute.md"
PREPARE_TEMPLATE = ROOT / "src" / "prime-agent-plugin" / "skills" / "project-templates" / "prepare.md"
HANDOFF_TEMPLATE = ROOT / "src" / "prime-agent-plugin" / "workflows" / "handoff.md"


LIFECYCLE_LIST = (
    'backlog task list --status "In Design" --status "In Planning" --ready --plain'
)


def normalized(path: Path) -> str:
    return " ".join(path.read_text().split())


def test_active_project_guidance_discovers_task_native_queues_without_selecting_to_do() -> None:
    for path in (AGENT_GUIDANCE, README, BACKLOG_DOC, PROJECT_PREPARE, BACKLOG_SKILL):
        text = normalized(path)
        assert LIFECYCLE_LIST in text
        assert '--status "To Do"' not in text


def test_named_operator_project_and_source_surfaces_do_not_select_to_do() -> None:
    for path in (
        AGENT_GUIDANCE,
        README,
        VISION,
        LONG_RANGE_PLAN,
        DEVELOPERS,
        DOCS_INDEX,
        BACKLOG_DOC,
        PROJECT_PREPARE,
        BACKLOG_SKILL,
        PREPARE_TEMPLATE,
    ):
        assert 'backlog task list --status "To Do"' not in normalized(path)


def test_project_backlog_skill_teaches_supported_task_native_lifecycle() -> None:
    text = normalized(BACKLOG_SKILL)

    for fragment in (
        '`deps/backlog/dist/backlog`',
        LIFECYCLE_LIST,
        'backlog task view --json -- <id>',
        'backlog task create "Short title" --status "In Design"',
        'This repository now defaults new ordinary tasks to `In Design`.',
        '`/plan TASK-ID` writes the native Implementation Plan',
        '`/implement-task TASK-ID` admits one exact approved `In Planning` task',
        'There is no generic claim edit that may bypass planning or admission.',
        'Do not edit files under `backlog/tasks/` or `backlog/completed/` directly.',
    ):
        assert fragment in text

    assert 'backlog task edit <id> --status "In Progress"' not in text
    assert 'backlog task edit <id> --status "Done"' not in text


def test_operator_guidance_creates_new_work_explicitly_in_design() -> None:
    for path in (AGENT_GUIDANCE, BACKLOG_DOC, BACKLOG_SKILL):
        text = normalized(path)
        assert 'backlog task create "' in text
        assert '--status "In Design"' in text
        assert 'generic claim' in text


def test_execute_and_handoff_keep_backlog_authority_while_prepare_discovers_native_tracker() -> None:
    execute = " ".join(EXECUTE_TEMPLATE.read_text().split())
    prepare = PREPARE_TEMPLATE.read_text()
    handoff = " ".join(HANDOFF_TEMPLATE.read_text().split())

    assert "Backlog.md-tracked projects" in execute
    assert "The Episode exclusively owns task content on its branch" in execute
    assert "references, not lifecycle authority" in execute
    assert "Use only the commands and tracker the project actually provides" in prepare
    assert "Backlog.md" not in prepare
    assert "Related Backlog tasks are references only" in handoff

def _task_frontmatter(path: Path) -> dict | None:
    text = path.read_text()
    if not text.startswith("---\n"):
        return None
    _, raw, _ = text.split("---", 2)
    value = yaml.safe_load(raw)
    return value if isinstance(value, dict) else None


def test_repository_status_migration_receipt_and_live_data_are_consistent() -> None:
    receipt = json.loads((
        ROOT / "docs/evidence/task-native-backlog-cutover/2026-10-14-step-6-status-migration.json"
    ).read_text())
    assert receipt["preCutoverCommit"] == "9cd16a40c0bbc0ff9c610bbbdb1c8395c30ac47e"
    assert receipt["before"] == {
        "activeTaskCount": 41,
        "statusCounts": {
            "Blocked": 4, "Done": 2, "In Design": 1, "In Progress": 3, "To Do": 31,
        },
        "toDoCount": 31,
    }
    assert receipt["classification"] == {
        "meaningfulPlanCount": 0,
        "noMeaningfulPlanCount": 31,
        "ambiguousCount": 0,
    }
    assert receipt["afterMigrationBeforeConfigRemoval"] == {
        "activeTaskCount": 41,
        "statusCounts": {"Blocked": 4, "Done": 2, "In Design": 32, "In Progress": 3},
        "toDoCount": 0,
        "identityOrParentDriftCount": 0,
    }
    assert receipt["configuration"] == {
        "defaultStatus": "In Design",
        "statuses": ["In Design", "In Planning", "In Progress", "Blocked", "Ready for Merge", "Done"],
        "toDoRemovedAfterObservedActiveCount": 0,
    }
    assert len(receipt["migrations"]) == 31
    assert len({row["id"] for row in receipt["migrations"]}) == 31
    assert all(row["implementationPlan"] is None for row in receipt["migrations"])
    assert all((row["from"], row["to"]) == ("To Do", "In Design") for row in receipt["migrations"])
    assert Counter(row["status"] for row in receipt["preserved"]) == {
        "Blocked": 4, "Done": 2, "In Design": 1, "In Progress": 3,
    }
    assert receipt["afterMigrationBeforeConfigRemoval"]["toDoCount"] == 0
    assert receipt["afterMigrationBeforeConfigRemoval"]["identityOrParentDriftCount"] == 0

    records = {}
    for directory in (ROOT / "backlog/tasks", ROOT / "backlog/completed", ROOT / "backlog/archive"):
        if not directory.exists():
            continue
        for path in directory.rglob("*.md"):
            record = _task_frontmatter(path)
            if record and record.get("id"):
                assert record["id"] not in records
                records[record["id"]] = record
    assert records
    assert all(record.get("status") != "To Do" for record in records.values())
    for row in receipt["migrations"] + receipt["preserved"]:
        assert row["id"] in records
        assert records[row["id"]].get("parent_task_id") == row["parentTaskId"]
