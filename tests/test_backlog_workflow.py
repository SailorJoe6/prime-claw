from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BACKLOG_SKILL = ROOT / ".agents" / "skills" / "backlog" / "SKILL.md"
EXECUTE_TEMPLATE = ROOT / "src" / "prime-agent-plugin" / "skills" / "project-templates" / "execute.md"
PREPARE_TEMPLATE = ROOT / "src" / "prime-agent-plugin" / "skills" / "project-templates" / "prepare.md"
HANDOFF_TEMPLATE = ROOT / "src" / "prime-agent-plugin" / "workflows" / "handoff.md"


def test_project_backlog_skill_teaches_native_ready_claim_and_completion() -> None:
    text = BACKLOG_SKILL.read_text()

    for fragment in (
        '`deps/backlog/dist/backlog`',
        'backlog task list --status "To Do" --ready --plain',
        'backlog task view <id> --plain',
        'backlog task edit <id> --status "In Progress" --assignee <name>',
        'backlog task create "Short title"',
        'backlog task edit <id> --status "Done" --final-summary "Completed"',
        'backlog task complete <id>',
        'Do not edit files under `backlog/tasks/` or `backlog/completed/` directly.',
    ):
        assert fragment in text


def test_execute_and_handoff_keep_backlog_authority_while_prepare_discovers_native_tracker() -> None:
    execute = EXECUTE_TEMPLATE.read_text()
    prepare = PREPARE_TEMPLATE.read_text()
    handoff = HANDOFF_TEMPLATE.read_text()

    assert "Backlog.md-tracked projects" in execute
    assert "planning docs and Backlog.md tasks" in execute
    assert "Use only the commands and tracker the project actually provides" in prepare
    assert "Backlog.md" not in prepare
    assert "related Backlog.md tasks" in handoff
