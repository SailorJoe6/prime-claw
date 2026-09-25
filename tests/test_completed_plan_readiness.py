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
    args = [sys.executable, str(SCRIPT), "--index", str(index), "--bundle-root", str(archive[0].parent)]
    for before, after in zip(active, archive):
        args.extend(["--artifact", str(before), str(after)])
    return subprocess.run(args, capture_output=True, text=True)


def test_unarchived_completed_bundle_is_not_ready(tmp_path):
    active, archive, index = fixture(tmp_path)
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "active artifact still present" in result.stdout
    assert "archived artifact missing" in result.stdout


def test_dangling_active_symlink_still_blocks_completion(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    active[0].symlink_to(active[0].parent / "missing-target.md")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "active artifact still present" in result.stdout


def test_archived_custom_named_bundle_is_ready(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    (archive[0].parent / "diagram.png").write_bytes(b"png")
    archive[0].write_text("[Steps](STEPS_CUSTOM.md)\n![diagram](diagram.png)\n")
    result = check(active, archive, index)
    assert result.returncode == 0, result.stdout + result.stderr
    assert check(active, archive, index).returncode == 0  # read-only replay


def test_archived_image_with_missing_local_target_blocks(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    archive[0].write_text("![diagram](missing.png)\n")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "broken link missing.png" in result.stdout


def test_archive_name_in_unrelated_prose_is_not_index_entry(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    index.write_text("# Index\nOnly an unrelated prose mention of episode-one/ exists.\n")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "archive index requires one exact" in result.stdout


def test_partial_archival_wrong_index_and_broken_link_block(tmp_path):
    active, archive, index = fixture(tmp_path)
    active[0].rename(archive[0])
    archive[0].write_text("[Missing](../not-here.md)\n")
    index.write_text("## unrelated-bundle/ — COMPLETE\n")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "active artifact still present" in result.stdout
    assert "archived artifact missing" in result.stdout
    assert "archive index requires one exact" in result.stdout
    assert "broken link" in result.stdout


def test_broken_archive_index_link_blocks(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    index.write_text("## episode-one/ — COMPLETE\n[missing](episode-one/missing.md)\n")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "README.md: broken link" in result.stdout


def test_nested_opaque_bundle_and_subsection_links(tmp_path):
    active, archive, index = fixture(tmp_path)
    nested_before = active[0].parent / "nested/notes.txt"
    nested_after = archive[0].parent / "nested/notes.txt"
    nested_before.parent.mkdir()
    nested_after.parent.mkdir()
    nested_before.write_text("notes")
    for before, after in zip(active + [nested_before], archive + [nested_after]):
        before.rename(after)
    index.write_text("## episode-one/ — COMPLETE\n### Evidence\n[notes](episode-one/nested/notes.txt)\n"
                     "## older/ — COMPLETE\n[stale](missing.md)\n")
    assert check(active + [nested_before], archive + [nested_after], index).returncode == 0
    nested_after.unlink()
    assert "archived artifact missing" in check(active + [nested_before], archive + [nested_after], index).stdout
    nested_before.write_text("leftover")
    assert "active artifact still present" in check(active + [nested_before], archive + [nested_after], index).stdout


def test_outside_bundle_and_duplicate_heading_block(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    outside = index.parent / "outside.md"
    outside.write_text("outside")
    result = check(active + [active[0]], archive + [outside], index)
    assert "outside reviewed bundle" in result.stdout
    index.write_text("## episode-one/ — COMPLETE\n## episode-one/ — duplicate\n")
    assert "found 2" in check(active, archive, index).stdout


def test_symlink_escape_from_bundle_is_rejected(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    outside = tmp_path / "outside.md"
    outside.write_text("outside")
    link = archive[0].parent / "nested/link.md"
    link.parent.mkdir()
    link.symlink_to(outside)
    result = check(active + [active[0]], archive + [link], index)
    assert "outside reviewed bundle" in result.stdout


def test_link_syntax_fails_closed_or_ignores_literal_examples(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    cases = ["[Requirements][req]\n[req]: missing.md\n",
             "[Appendix](Appendix(final).md)\n",
             "[Steps](STEPS_CUSTOM.md 'Step plan')\n", "<img src='missing.png'>\n"]
    for content in cases:
        archive[0].write_text(content)
        result = check(active, archive, index)
        assert result.returncode == 1
        assert "manual link inspection required" in result.stdout
    archive[0].write_text("```md\n[Example](missing.md)\n```\n`![literal](missing.png)`\n"
                          "`[multiline](missing.md)\ncode span`\n")
    assert check(active, archive, index).returncode == 0
    (archive[0].parent / "Appendix (final).md").write_text("appendix")
    archive[0].write_text("[Appendix](<Appendix (final).md>)\n")
    assert check(active, archive, index).returncode == 0


def test_html_comment_cannot_supply_index_entry(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    index.write_text("# Index\n<!--\n## episode-one/ — COMPLETE\n-->\n")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "requires one exact" in result.stdout
    # Comment-contained fake fences/headings/links cannot hide the real entry.
    index.write_text("# Index\n<!--\n```markdown\n## episode-one/ — fake\n"
                     "[fake](missing.md)\n-->\n## episode-one/ — COMPLETE\n"
                     "[Steps](episode-one/STEPS_CUSTOM.md)\n")
    assert check(active, archive, index).returncode == 0
    archive[0].write_text("<!-- [fake](missing.md) -->\n[Steps](STEPS_CUSTOM.md)\n")
    assert check(active, archive, index).returncode == 0


def test_unclosed_comment_and_raw_html_block_fail_closed(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    for text in ("# Index\n<!--\n## episode-one/ — fake\n",
                 "# Index\n<div>\n## episode-one/ — fake\n</div>\n"):
        index.write_text(text)
        result = check(active, archive, index)
        assert result.returncode == 1
        assert "manual link inspection required" in result.stdout
    # HTML in an unrelated section cannot silently change index visibility.
    index.write_text("## older/\n<div>opaque</div>\n## episode-one/ — COMPLETE\n")
    assert "manual link inspection required" in check(active, archive, index).stdout


def test_info_suffixed_fence_is_not_a_close_or_real_index_heading(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    index.write_text("# Index\n```markdown\n```md\n## episode-one/ — COMPLETE\n")
    result = check(active, archive, index)
    assert result.returncode == 1
    assert "requires one exact" in result.stdout
    # A legal close without an info suffix permits the real heading.
    index.write_text("# Index\n```markdown\n```md\n## example-only/\n```\n"
                     "## episode-one/ — COMPLETE\n[Steps](episode-one/STEPS_CUSTOM.md)\n")
    assert check(active, archive, index).returncode == 0
    # The same fence grammar applies to artifact links, not just headings.
    archive[0].write_text("```markdown\n```md\n[example](missing.md)\n```\n")
    assert check(active, archive, index).returncode == 0


def test_index_reference_links_require_manual_evidence(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    for usage in ("[Steps][plan]", "![Diagram][plan]"):
        index.write_text("## episode-one/ — COMPLETE\n### Evidence\n" + usage + "\n"
                         "## older/\n[plan]: episode-one/missing.md\n")
        result = check(active, archive, index)
        assert result.returncode == 1
        assert "manual link inspection required" in result.stdout


def test_fenced_index_heading_is_not_an_entry(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    index.write_text("# Index\n```markdown\n## episode-one/ — COMPLETE\n```\nNo real entry.\n")
    assert "requires one exact" in check(active, archive, index).stdout
    index.write_text("## episode-one/ — COMPLETE\n```markdown\n## unrelated/\n```\n"
                     "#### Artifacts\n![missing](episode-one/missing.png)\n")
    assert "broken link episode-one/missing.png" in check(active, archive, index).stdout


def test_selected_section_broken_link_after_subheading_blocks(tmp_path):
    active, archive, index = fixture(tmp_path)
    for before, after in zip(active, archive):
        before.rename(after)
    index.write_text("See episode-one/ below.\n## older/\nHistory.\n"
                     "## episode-one/ — COMPLETE\n### Evidence\n[missing](episode-one/missing.md)\n")
    assert "README.md: broken link" in check(active, archive, index).stdout
    index.write_text("## not.episode-one/ — unrelated\n")
    assert "requires one exact" in check(active, archive, index).stdout


def test_completed_gate_is_before_final_review_and_not_close():
    skill = SKILL.read_text()
    gate = skill.index("When the EPISODE claims completion")
    review = skill.index("obtain a fresh final EXPERT review")
    close = skill.index("Only after terminal work is verified, call `finalize_spec_episode`")
    assert gate < review < close
    for required in ["not during ordinary in-progress", "project-customizable execute",
                     "Trace the promoted paths to", "Git diff/history",
                     "uncertain provenance block", "does not discover", "documented project"]:
        assert required in skill
    assert "not an ordinary in-progress `advance` gate" in DOC.read_text()
