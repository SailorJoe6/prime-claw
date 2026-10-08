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


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_requires_a_bounded_product_contract(skill_name: str) -> None:
    text = " ".join(
        (ROOT / ".ralph" / "skills" / skill_name / "SKILL.md").read_text().split()
    )

    for fragment in (
        "concise threat model",
        "trusted assumptions",
        "ordinary failure model",
        "explicit non-goals",
        "manual recovery",
        "qualitative complexity budget",
        "Separate required acceptance behavior from optional hardening",
        "Evidence is diagnostic",
        "reviewer-discovered invariant",
        "operator approval",
    ):
        assert fragment in text


def test_plan_and_implementation_readiness_enforce_proportionate_delivery() -> None:
    plan = " ".join(
        (ROOT / ".ralph" / "skills" / "plan" / "SKILL.md").read_text().split()
    )
    readiness = " ".join(
        (ROOT / ".ralph" / "skills" / "implement-spec" / "SKILL.md")
        .read_text()
        .split()
    )

    for fragment in (
        "threat model",
        "trusted assumptions",
        "ordinary failure model",
        "explicit non-goals",
        "manual-recovery boundary",
        "qualitative complexity budget",
        "simplification checkpoint",
        "two repair/review cycles",
        "hardening backlog",
        "scenario, likely impact, current assumption",
        "operator promotes it",
    ):
        assert fragment in plan

    for fragment in (
        "threat model",
        "trusted assumptions",
        "ordinary failure model",
        "manual-recovery boundary",
        "qualitative complexity budget",
        "simplification checkpoint",
        "optional hardening",
        "evidence-based promotion trigger",
        "two-repair/review-cycle stop-loss",
        "only the operator may promote",
    ):
        assert fragment in readiness


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


def test_plan_prep_skill_owns_compaction_prompt_and_bounded_continuation() -> None:
    """Plan prep owns model policy while the extension owns admission mechanics."""
    skill = (ROOT / ".ralph" / "skills" / "plan-prep" / "SKILL.md").read_text()

    assert "name: plan-prep" in skill
    for fragment in (
        "operator plan location",
        "operator-selected path",
        "Do not guess, substitute, search for, or select another",
        "selected folder exists",
        "readable `SPECIFICATION.md`",
        "not the authoritative planning-readiness review",
        "do not request compaction",
        "Standard compaction request",
        "You are about to plan the reviewed specification",
        "operator-selected future folder",
        "operator review decisions",
        "constraints",
        "material non-goals",
        "durable artifact and bead references",
        "If the operator later approves implementation",
        "this same conversation will own and supervise the resulting",
        "implementation episode to completion",
        "Status",
        "Evidence",
        "Next Step",
        "compaction requested",
        "compaction confirmed",
        "sole follow-up",
        "cannot cancel, replace, reconstruct, retry, or invoke",
    ):
        assert fragment in skill

    assert skill.count("await compact.run(focus_hint)") == 1
    assert "Do not run `prepare`" in skill
    assert "Do not wait for a compaction event" in skill
    assert "may own and supervise" not in skill

    extension = (
        ROOT / "src" / "prime-agent-plugin" / "extensions" / "reviewed-plan.ts"
    ).read_text()
    support = (
        ROOT / "src" / "prime-agent-plugin" / "extension-support" / "prep-chain.ts"
    ).read_text()
    # TypeScript may name the project-owned skill, but it must not own the hint
    # or tell the model when/how to compact.
    for source in (extension, support):
        assert "operator review decisions" not in source
        assert "compact.run" not in source
        assert "implementation episode to completion" not in source


def test_implement_prep_skill_owns_compaction_prompt_and_bounded_continuation() -> None:
    """Implement prep owns model policy while approval mechanics stay in TS."""
    skill = (
        ROOT / ".ralph" / "skills" / "implement-prep" / "SKILL.md"
    ).read_text()

    assert "name: implement-prep" in skill
    for fragment in (
        "operator implementation location",
        "operator-selected path",
        "Do not guess, substitute, search for, or select another",
        "selected folder exists",
        "readable, non-empty `SPECIFICATION.md` and `EXECUTION_PLAN.md`",
        "not the authoritative implementation-readiness review",
        "do not request compaction",
        "Standard compaction request",
        "review and promote the operator-approved specification",
        "operator-selected future folder",
        "operator review decisions",
        "constraints",
        "material non-goals",
        "durable artifact and bead references",
        "create its isolated implementation episode",
        "owner-supervision role",
        "supervises the episode to completion",
        "Status",
        "Evidence",
        "Next Step",
        "compaction requested",
        "compaction confirmed",
        "sole follow-up",
        "cannot cancel, replace, reconstruct, retry, or",
    ):
        assert fragment in skill

    assert skill.count("await compact.run(focus_hint)") == 1
    assert "Do not run `prepare`" not in skill
    assert "queued implementation-readiness turn" not in skill
    assert "own preparation and semantic readiness review" not in skill
    assert "Do not wait for a compaction event" in skill

    extension = (
        ROOT / "src" / "prime-agent-plugin" / "extensions" / "reviewed-plan.ts"
    ).read_text()
    support = (
        ROOT / "src" / "prime-agent-plugin" / "extension-support" / "prep-chain.ts"
    ).read_text()
    for source in (extension, support):
        assert "operator review decisions" not in source
        assert "compact.run" not in source
        assert "owner-supervision role" not in source


def test_phase_prep_documentation_requires_docker_only_plugin_validation() -> None:
    docs = (ROOT / "docs" / "prep-chain.md").read_text()
    normalized = " ".join(docs.split())

    for fragment in (
        "Plugin development and pre-merge validation are Docker tier 1 only",
        "Never apply, check, or probe a candidate against the host user-global",
        "python3 -m pytest tests/ -q -m container",
        "scripts/test-tier1.sh --probe",
        "scripts/test-all.sh",
        "container-marked reviewed-plan coverage",
        "behavioral native `/plan` and `/implement-spec` probes",
        "one-deep `agent_end` skip",
        "`create_spec_episode` still requires exact session and location equality",
    ):
        assert fragment in normalized

    assert "scripts/apply-prime-agent-plugin.sh\n" not in docs
    assert "scripts/check-prime-agent-plugin.sh\n" not in docs


def test_phase_transition_docs_route_plugin_execution_to_docker_tier1() -> None:
    cases = {
        "docs/future-specification-bundles.md": (
            "python3 -m pytest tests/test_reviewed_plan_extension.py -q -m container"
        ),
        "docs/handoff-chain.md": (
            "python3 -m pytest tests/test_handoff_chain_extension.py -q -m container"
        ),
    }

    for relative, focused_command in cases.items():
        docs = (ROOT / relative).read_text()
        assert focused_command in docs
        assert "scripts/test-tier1.sh --probe" in docs
        assert "scripts/test-all.sh" in docs
        assert "node --experimental-strip-types --test" not in docs
