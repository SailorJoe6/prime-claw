"""Contract tests for future-folder specification authoring skills."""

from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ("design", "spec-it-out")


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_creates_one_new_future_specification(skill_name: str) -> None:
    text = (ROOT / ".ralph" / "skills" / skill_name / "SKILL.md").read_text()

    required_fragments = (
        ".ralph/plans/future/<slug>/",
        "filesystem-safe slug",
        "It must be a",
        "never overwrite or merge into an existing specification",
        "Create `SPECIFICATION.md` inside that folder",
        "Document the current system",
        "Do not write newly generated specification artifacts directly under",
    )
    for fragment in required_fragments:
        assert fragment in text

    assert "Create every specification artifact inside that folder" not in text
    assert "REQUIREMENTS.md" not in text
    assert "DECISIONS.md" not in text
    assert "living source of truth" in text
    assert "Do not defer updates until the end" in text
    assert "Replace stale" in text


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_stops_at_operator_specification_review(
    skill_name: str,
) -> None:
    text = (ROOT / ".ralph" / "skills" / skill_name / "SKILL.md").read_text()

    required_fragments = (
        "report the exact project-relative future-folder path",
        "link `SPECIFICATION.md` so the operator can review it now",
        "explicitly ask the operator to review the saved specification",
        "stop without planning, implementing, creating a branch or worktree, or",
        "starting an episode",
        "revisions to the same future folder",
        "Do not advance to planning unless the operator",
    )
    for fragment in required_fragments:
        assert fragment in text


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_has_no_active_root_artifact_destination(
    skill_name: str,
) -> None:
    text = (ROOT / ".ralph" / "skills" / skill_name / "SKILL.md").read_text()

    assert ".ralph/plans/SPECIFICATION.md" not in text


def test_design_and_spec_it_out_keep_distinct_discovery_modes() -> None:
    design = (ROOT / ".ralph" / "skills" / "design" / "SKILL.md").read_text()
    spec_it_out = (
        ROOT / ".ralph" / "skills" / "spec-it-out" / "SKILL.md"
    ).read_text()

    assert "First, run the `prepare` skill" in design
    assert "requirements" in design
    assert "one at a time" in design

    assert "name: spec-it-out" in spec_it_out
    assert "Use the current conversation" in spec_it_out
    assert "Ask only the remaining questions" in spec_it_out


def test_prime_skill_exposure_resolves_to_canonical_authoring_skills() -> None:
    for skill_name in SKILLS:
        exposed = ROOT / ".agents" / "skills" / skill_name / "SKILL.md"
        canonical = ROOT / ".ralph" / "skills" / skill_name / "SKILL.md"
        assert exposed.resolve() == canonical.resolve()
