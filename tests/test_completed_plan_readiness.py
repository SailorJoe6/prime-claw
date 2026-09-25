"""Regression for the completed-episode artifact gate (not terminal close)."""
from pathlib import Path
import subprocess
import sys

REPO = Path(__file__).resolve().parents[1]
SCRIPT = REPO / "scripts/verify-completed-plan.py"
SKILL = REPO / ".ralph/skills/oversee-episode/SKILL.md"
DOC = REPO / "docs/conversation-driven-episode-oversight.md"


def fixture(tmp_path):
    plans = tmp_path / ".ralph/plans"
    active = [plans / "DESIGN_CUSTOM.md", plans / "STEPS_CUSTOM.md"]
    archive = [plans / "archive/episode-one" / path.name for path in active]
    index = plans / "archive/README.md"
    archive[0].parent.mkdir(parents=True)
    index.write_text("## episode-one/ — COMPLETE\n")
    active[0].write_text("# Design\n")
    active[1].write_text("# Steps\n")
    return active, archive, index


def check(active, archive, index):
    args = [sys.executable, str(SCRIPT), "--index", str(index)]
    for before, after in zip(active, archive):
        args.extend(["--artifact", str(before), str(after)])
    return subprocess.run(args, capture_output=True, text=True)


def test_unarchived_completed_bundle_is_not_ready(tmp_path):
    active, archive, index = fixture(tmp_path)
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "active artifact still present" in result.stdout
    assert "archived artifact missing" in result.stdout


def test_archived_custom_named_bundle_is_ready(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    archive[0].write_text("[Steps](STEPS_CUSTOM.md)\n")
    result = check(active, archive, index)
    assert result.returncode == 0, result.stdout + result.stderr


def test_partial_archival_wrong_index_and_broken_link_block(tmp_path):
    active, archive, index = fixture(tmp_path)
    active[0].rename(archive[0])
    archive[0].write_text("[Missing](../not-here.md)\n")
    index.write_text("## unrelated-bundle/ — COMPLETE\n")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "active artifact still present" in result.stdout
    assert "archived artifact missing" in result.stdout
    assert "archive index has no entry" in result.stdout
    assert "broken link" in result.stdout


def test_broken_archive_index_link_blocks(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    index.write_text("## [episode-one/](episode-one/missing.md) — COMPLETE\n")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "broken index link" in result.stdout


def test_completed_gate_is_before_final_review_and_not_close():
    skill = SKILL.read_text()
    gate = skill.index("When the EPISODE claims completion")
    review = skill.index("obtain a fresh final EXPERT review")
    close = skill.index("Only after terminal work is verified, call `finalize_spec_episode`")
    assert gate < review < close
    for required in ["not during ordinary in-progress", "project-customizable execute",
                     "Trace the promoted paths to", "Git diff/history",
                     "uncertain provenance block", "does not discover the", "documented project"]:
        assert required in skill
    assert "not an ordinary in-progress `advance` gate" in DOC.read_text()
