"""Contract tests for future-folder specification authoring skills."""

from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ("design", "spec-it-out")


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_creates_new_future_bundle(skill_name: str) -> None:
    text = (ROOT / ".ralph" / "skills" / skill_name / "SKILL.md").read_text()

    required_fragments = (
        ".ralph/plans/future/<slug>/",
        "filesystem-safe slug",
        "It must be a new",
        "overwrite or merge into an existing specification bundle",
        "Create every specification artifact inside that folder",
        "Do not write newly generated specification artifacts directly under",
    )
    for fragment in required_fragments:
        assert fragment in text


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_stops_at_operator_specification_review(
    skill_name: str,
) -> None:
    text = (ROOT / ".ralph" / "skills" / skill_name / "SKILL.md").read_text()

    required_fragments = (
        "report the exact project-relative future-folder path",
        "link every artifact you created",
        "explicitly ask the operator to review the saved specification",
        "stop without planning, implementing, creating a branch or worktree, or",
        "starting an episode",
        "revisions to the same future folder",
        "Do not advance to planning unless the operator later",
    )
    for fragment in required_fragments:
        assert fragment in text


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_has_no_active_root_artifact_destination(
    skill_name: str,
) -> None:
    text = (ROOT / ".ralph" / "skills" / skill_name / "SKILL.md").read_text()

    for filename in ("SPECIFICATION.md", "REQUIREMENTS.md", "DECISIONS.md"):
        assert f".ralph/plans/{filename}" not in text


def test_prime_skill_exposure_resolves_to_canonical_authoring_skills() -> None:
    for skill_name in SKILLS:
        exposed = ROOT / ".agents" / "skills" / skill_name / "SKILL.md"
        canonical = ROOT / ".ralph" / "skills" / skill_name / "SKILL.md"
        assert exposed.resolve() == canonical.resolve()
