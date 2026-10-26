"""Contract tests for task-native authoring and retained folder compatibility."""

import json
from pathlib import Path
import subprocess

import pytest


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ("design", "spec-it-out")

def project_skill(name: str) -> Path:
    return ROOT / "src" / "prime-agent-plugin" / "skills" / "project-templates" / f"{name}.md"

def workflow(name: str) -> Path:
    return ROOT / "src" / "prime-agent-plugin" / "workflows" / f"{name}.md"

LEGACY_SKILLS = ("design-legacy", "spec-it-out-legacy")


def test_legacy_authoring_assets_are_separate_project_local_compatibility_skills() -> None:
    inventory = json.loads((ROOT / "src/prime-agent-plugin/asset-inventory.json").read_text())
    rows = {row["id"]: row for row in inventory["assets"]}
    expected = {
        "project-skill-design-legacy": ("skills/project-templates/design-legacy.md", ".agents/skills/design-legacy/SKILL.md"),
        "project-skill-spec-it-out-legacy": ("skills/project-templates/spec-it-out-legacy.md", ".agents/skills/spec-it-out-legacy/SKILL.md"),
    }
    for asset_id, (source, destination) in expected.items():
        row = rows[asset_id]
        target = next(value for value in row["targets"] if value["class"] == "project-customizable")
        assert row["source"] == source
        assert target["destination"] == destination
        assert target["exposure"] == "discoverable"
        assert target["lifecycleTrigger"] == "project-reconcile"
        assert "migrateFrom" not in target
        assert (ROOT / destination).read_bytes() == (ROOT / "src/prime-agent-plugin" / source).read_bytes()


def test_legacy_authoring_preserves_current_main_folder_behavior_without_duplicate_shared_policy() -> None:
    design = project_skill("design-legacy").read_text()
    synthesis = project_skill("spec-it-out-legacy").read_text()
    normalized = " ".join(design.split())
    for fragment in (
        "name: design-legacy",
        ".ralph/plans/future/<slug>/",
        "Create `SPECIFICATION.md`",
        "living source of truth",
        "explicitly ask the operator to review the saved specification",
        "stop without planning, implementing, creating a branch or worktree",
    ):
        assert fragment in normalized
    assert "backlog task create" not in design.lower()
    assert "backlog task edit" not in design.lower()

    compact = " ".join(synthesis.split())
    for fragment in (
        "name: spec-it-out-legacy",
        "read the project-local `design-legacy` skill",
        "single common authority",
        "Do not repeat or replace that shared Markdown here",
        "does not create or edit a Backlog task",
    ):
        assert fragment in compact
    assert not any(line == "## Create the future specification" for line in synthesis.splitlines())
    assert len(synthesis) < len(design) / 2


def test_retained_legacy_entry_surfaces_and_snapshot_fallback_remain_bounded() -> None:
    extension = (ROOT / "src/prime-agent-plugin/extensions/reviewed-plan.ts").read_text()
    for surface in (
        'command: "plan-spec"', 'command: "implement-spec"',
        'name: "plan_spec"', 'name: "create_spec_episode"',
        'name: "handoff_spec_episode"', 'name: "finalize_spec_episode"',
        'name: "restore_blocked_spec_episode"',
    ):
        assert surface in extension
    workflow_chain = (ROOT / "src/prime-agent-plugin/extension-support/workflow-chain.ts").read_text()
    assert 'new Set(["handoff", "execute"])' in workflow_chain
    assert 'join(root, ".ralph", "skills", name, "SKILL.md")' in workflow_chain
    ownership = (ROOT / "src/prime-agent-plugin/extension-support/episode-ownership.ts").read_text()
    assert "item.version === 1 || item.version === 2" in ownership
    assert "isLegacyEpisodeOwnership" in ownership
    assert "isTaskEpisodeOwnership" in ownership



def run(cwd: Path, *args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(args, cwd=cwd, text=True, capture_output=True)
    if check and result.returncode != 0:
        raise AssertionError(result.stdout + result.stderr)
    return result


def test_documented_task_authoring_cli_sequence_is_atomic_and_task_only(tmp_path: Path) -> None:
    backlog = ROOT / "deps" / "backlog" / "dist" / "backlog"
    (tmp_path / "backlog").mkdir()
    (tmp_path / "backlog" / "config.yml").write_text(
        (ROOT / "backlog" / "config.yml").read_text()
    )
    run(tmp_path, "git", "init", "-q")
    run(tmp_path, "git", "config", "user.name", "Fixture")
    run(tmp_path, "git", "config", "user.email", "fixture@example.test")
    (tmp_path / "unrelated.txt").write_text("baseline\n")
    run(tmp_path, "git", "add", "backlog/config.yml", "unrelated.txt")
    run(tmp_path, "git", "commit", "-q", "-m", "fixture baseline")
    (tmp_path / "unrelated.txt").write_text("unrelated working change\n")

    created = run(
        tmp_path, str(backlog), "task", "create", "Fixture work",
        "--status", "In Design", "--description", "Initial outcome",
        "--ac", "Observable result", "--ref", "PRIMECLAW-OTHER",
        "--doc", "docs/example.md", "--plain",
    )
    assert "Task PRIMECLAW-1 - Fixture work" in created.stdout
    task = json.loads(run(
        tmp_path, str(backlog), "task", "view", "--json", "--", "PRIMECLAW-1",
    ).stdout)["task"]
    task_path = tmp_path / task["path"]
    assert task["status"] == "In Design"
    assert task["description"] == "Initial outcome"
    assert [item["text"] for item in task["acceptanceCriteria"]] == ["Observable result"]
    assert task["references"] == ["PRIMECLAW-OTHER"]
    assert task["documentation"] == ["docs/example.md"]
    assert task["implementationPlan"] is None
    assert task_path.is_file() and task_path.parent == tmp_path / "backlog" / "tasks"

    run(tmp_path, "git", "add", "--", task["path"])
    run(tmp_path, "git", "commit", "-q", "--only", "-m", "author task", "--", task["path"])
    assert run(tmp_path, "git", "show", "--pretty=", "--name-only", "HEAD").stdout.strip() == task["path"]
    committed_head = run(tmp_path, "git", "rev-parse", "HEAD").stdout.strip()
    assert run(tmp_path, "git", "push", check=False).returncode != 0
    assert run(tmp_path, "git", "rev-parse", "HEAD").stdout.strip() == committed_head
    assert run(tmp_path, "git", "status", "--short").stdout.strip() == "M unrelated.txt"

    run(
        tmp_path, str(backlog), "task", "edit",
        "--description", "Revised outcome", "--acceptance-criteria", "Revised result",
        "--ref", "PRIMECLAW-OTHER", "--ref", "PRIMECLAW-SECOND",
        "--doc", "docs/example.md", "--doc", "docs/revised.md",
        "--", "PRIMECLAW-1",
    )
    revised = json.loads(run(
        tmp_path, str(backlog), "task", "view", "--json", "--", "PRIMECLAW-1",
    ).stdout)["task"]
    assert revised["status"] == "In Design"
    assert revised["description"] == "Revised outcome"
    assert [item["text"] for item in revised["acceptanceCriteria"]] == ["Revised result"]
    assert revised["references"] == ["PRIMECLAW-OTHER", "PRIMECLAW-SECOND"]
    assert revised["documentation"] == ["docs/example.md", "docs/revised.md"]
    assert revised["implementationPlan"] is None
    run(tmp_path, "git", "add", "--", task["path"])
    run(tmp_path, "git", "commit", "-q", "--only", "-m", "revise task", "--", task["path"])
    assert run(tmp_path, "git", "show", "--pretty=", "--name-only", "HEAD").stdout.strip() == task["path"]
    assert run(tmp_path, "git", "status", "--short").stdout.strip() == "M unrelated.txt"


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_binds_one_exact_provider_native_in_design_task(skill_name: str) -> None:
    text = " ".join(project_skill(skill_name).read_text().split())

    for fragment in (
        "sole live task provider",
        "a valid Backlog configuration selects Backlog",
        "a valid `.beads/` Dolt store selects Beads",
        "absent, malformed, dual, redirected, or unavailable",
        "operator explicitly selected an existing task",
        "ask the operator before mutation",
        "backlog task view --json -- TASK-ID",
        "bd show TASK-ID --json --long --include-comments",
        "returned canonical ID to equal the entire selected ID",
        "native status exactly `in_design`",
        "Reject `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and `Done`",
        "create exactly one task",
        '--status "In Design"',
        "--status in_design",
        "Creation is one mutation attempt",
        "do not issue another create",
        "This invocation never issues a second create after uncertainty",
        "Never search either provider's queue",
    ):
        assert fragment in text


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_uses_supported_provider_native_specification_fields(skill_name: str) -> None:
    text = " ".join(project_skill(skill_name).read_text().split())

    for fragment in (
        "current context, intended outcome, scope, required behavior",
        "Description, native Acceptance Criteria, References, and Documentation",
        "backlog task create",
        "--description",
        "--ac",
        "backlog task edit",
        "--acceptance-criteria",
        "pass its complete desired value from the reloaded task",
        "raw `description` and raw acceptance criteria",
        "`## References` and `## Documentation` sections in the description",
        "Do not invent metadata, relations, paths, or a conversion format",
        "Do not write a Beads `design` plan",
        "Implementation Plan, Implementation Notes, or Final Summary",
    ):
        assert fragment in text

    for forbidden in (
        "Create `SPECIFICATION.md`",
        ".ralph/plans/future/<slug>",
        "REQUIREMENTS.md",
        "DECISIONS.md",
        "ProviderTaskSelection",
    ):
        assert forbidden not in text


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_publishes_only_through_the_selected_provider_and_stops_for_review(
    skill_name: str,
) -> None:
    text = " ".join(project_skill(skill_name).read_text().split())

    for fragment in (
        "selected existing task path and Git index to be clean",
        "no path other than that exact returned task path was newly changed",
        "Commit only the returned task path",
        "commit contains no other path",
        "push failure is transport evidence",
        "one more supported native pull and complete raw reread",
        "bd dolt push --no-adopt",
        "one native post-publication pull/read cycle",
        "every unrelated raw field unchanged",
        "Beads authoring performs no Backlog command or Git task-file commit",
        "report the selected provider, canonical task ID, exact project root",
        "explicitly ask the operator to review the saved specification",
        "stop without planning, writing an implementation plan",
        "same exact native `In Design` task",
        "/plan TASK-ID",
        "never authorizes implementation",
    ):
        assert fragment in text

    assert "living source of truth" in text
    assert "Do not defer updates until the end" in text
    assert "Replace stale content" in text


@pytest.mark.parametrize("skill_name", SKILLS)
def test_authoring_skill_keeps_the_product_contract_proportional(skill_name: str) -> None:
    text = " ".join(project_skill(skill_name).read_text().split())

    for fragment in (
        "clear enough to plan without guessing material product decisions",
        "intended outcome, scope, required behavior, material constraints",
        "only when they are materially relevant",
        "Do not require boilerplate sections",
        "ask the operator rather than",
    ):
        assert fragment in text

    for unwanted in (
        "concise threat model", "trusted assumptions", "ordinary failure model",
        "qualitative complexity budget", "optional hardening",
        "reviewer-discovered invariant",
    ):
        assert unwanted not in text


def test_plan_and_implementation_readiness_are_proportional() -> None:
    plan = " ".join(workflow("plan-spec").read_text().split())
    readiness = " ".join(workflow("implement-spec").read_text().split())

    for fragment in (
        "without guessing material product decisions",
        "Do not demand standard risk, recovery, architecture, or process sections",
        "concise, actionable plan at the level of detail this work needs",
        "Small changes may need only a few ordered steps",
        "must not add process sections or hardening work merely to satisfy a template",
    ):
        assert fragment in plan

    for fragment in (
        "operator-approved outcome and scope",
        "without guessing material product choices",
        "actually prevents safe implementation",
        "Apply this test proportionally",
        "Do not require standard threat, failure, recovery, complexity, hardening, slice, evidence, or review-process sections",
        "reviewer suggestion is not a missing requirement",
    ):
        assert fragment in readiness

    forbidden = (
        "trusted assumptions", "qualitative complexity budget",
        "hardening backlog", "promotion trigger", "repair/review-cycle stop-loss",
    )
    for fragment in forbidden:
        assert fragment not in plan
        assert fragment not in readiness


def test_design_and_spec_it_out_keep_distinct_discovery_modes() -> None:
    design = project_skill("design").read_text()
    spec_it_out = project_skill("spec-it-out").read_text()

    normalized_design = " ".join(design.split())
    assert "For Backlog, run the `prepare` skill normally" in normalized_design
    assert "skip its Backlog-only queue inventory" in normalized_design
    assert "requirements" in design
    assert "one at a time" in design

    assert "name: spec-it-out" in spec_it_out
    assert "Use the current conversation" in spec_it_out
    assert "Ask only the remaining questions" in spec_it_out


def test_project_customized_authoring_skills_are_preserved_while_new_upstream_is_advertised() -> None:
    import hashlib

    manifest = json.loads((ROOT / ".prime-claw/templates.json").read_text())
    for skill_name in SKILLS:
        exposed = ROOT / ".agents" / "skills" / skill_name / "SKILL.md"
        canonical = project_skill(skill_name)
        entry = manifest["assets"][f"project-skill-{skill_name}"]
        installed = hashlib.sha256(exposed.read_bytes()).hexdigest()
        upstream = hashlib.sha256(canonical.read_bytes()).hexdigest()

        assert exposed.is_file() and not exposed.is_symlink()
        source = canonical.read_text()
        source_fragment = """- **Backlog:** use one supported `backlog task create --plain` command with
  `--status \"In Design\"`, then bind the exact created task ID from its output.
"""
        installed_fragment = source_fragment + """  This repository now defaults to `In Design`, but the explicit status keeps
  the authoring command self-contained and auditable.
"""
        assert exposed.read_text() == source.replace(source_fragment, installed_fragment)
        assert entry["state"] == "customized"
        assert entry["installedSha256"] == installed
        assert entry["availableUpstreamSha256"] == upstream
        assert entry["baselineSha256"] != upstream


@pytest.mark.parametrize(
    ("name", "mission"),
    (
        ("plan-prep", "plan the selected specification"),
        ("plan-task-prep", "plan the selected task"),
        ("implement-prep", "review the selected bundle for implementation promotion"),
        ("implement-task-prep", "review the selected task for implementation admission"),
    ),
)
def test_phase_prep_composes_context_aware_hint_without_fixed_inventory(
    name: str, mission: str,
) -> None:
    skill = " ".join(workflow(name).read_text().split())
    hint_policy = skill.split("## Standard compaction request", 1)[1].split(
        "Then call exactly once:", 1,
    )[0]
    for fragment in (
        "reason from your current conversation context",
        "compose a concise `focus_hint`",
        mission,
        "Use your judgment to decide what context will be most useful for that mission",
    ):
        assert fragment in hint_policy
    if name.startswith("implement"):
        assert "supervise the resulting Episode" in hint_policy
    for fragment in (
        "fixed text", "substituting only", "<selected-folder>", "<task-id>",
        "Preserve", "Retain", "operator review decisions", "acceptance criteria",
        "constraints", "material non-goals", "durable artifact and bead references",
        "Conversation-to-Episode authority",
    ):
        assert fragment not in hint_policy
    assert skill.count("await compact.run(focus_hint)") == 1
    for fragment in (
        "sole follow-up",
        "Interpret only the immediate result",
        "`scheduled: true`", "not confirmation that compaction completed",
        "`scheduled: false`", "without treating it as a workflow failure",
        "If the call raises", "without pasting a traceback or raw provider data",
        "follow-up remains independently queued",
        "Do not wait for a compaction event or infer a later outcome",
    ):
        assert fragment in skill


def test_plan_prep_skill_owns_compaction_prompt_and_bounded_continuation() -> None:
    """Plan prep owns model policy while the extension owns admission mechanics."""
    skill = workflow("plan-prep").read_text()

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
    skill = workflow("implement-prep").read_text()

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
        "isolated Docker Tier 1", "Never apply", "host user-global plugin",
        "python3 -m pytest tests/ -q -m container", "scripts/test-tier1.sh --probe",
        "scripts/test-all.sh", "reviewed-plan Node behavior bridge",
        "`create_spec_episode` remains the retained folder promotion boundary",
    ):
        assert fragment in normalized


def test_phase_transition_docs_route_plugin_execution_to_docker_tier1() -> None:
    for relative in ("docs/future-specification-bundles.md", "docs/handoff-chain.md"):
        docs = (ROOT / relative).read_text()
        assert "python3 -m pytest tests/ -q -m container" in docs
        assert "scripts/test-tier1.sh --probe" in docs
        assert "host user-global plugin" in docs
        assert "node --experimental-strip-types --test" not in docs


def test_task_native_planning_workflows_are_exposed_without_removing_folder_compatibility() -> None:
    prep = " ".join(workflow("plan-task-prep").read_text().split())
    plan = " ".join(workflow("plan-task").read_text().split())

    for fragment in (
        "<operator-plan-task-id>",
        "<operator-plan-task-provider>",
        "<operator-plan-task-project-root>",
        "<operator-plan-task-path>",
        "backlog task view --json -- TASK-ID",
        "bd context --json",
        "bd show TASK-ID --json --long --include-comments",
        "In Design",
        "In Planning",
        "not the authoritative planning-readiness review",
        "sole follow-up",
        "cannot cancel, replace, reconstruct, retry, or invoke",
        "complete raw view",
        "not semantic acceptance",
        "Status",
        "Evidence",
        "Next Step",
        "compaction requested",
        "compaction confirmed",
    ):
        assert fragment in prep
    assert prep.count("await compact.run(focus_hint)") == 1
    assert "Do not run `prepare`" in prep

    for fragment in (
        "<operator-plan-task-id>",
        "<operator-plan-task-provider>",
        "<operator-plan-task-project-root>",
        "<operator-plan-task-path>",
        "backlog task view --json -- TASK-ID",
        "bd dolt pull",
        "bd show TASK-ID --json --long --include-comments",
        "native status exactly `in_design` or `in_planning`",
        "Reject any later status",
        "Description, Acceptance Criteria",
        "complete raw view",
        "without guessing material product decisions",
        "Do not demand standard risk, recovery, architecture, or process sections",
        "concise, actionable plan",
        "Small changes may need only a few ordered steps",
        "backlog task edit",
        "set or retain status `In Planning`",
        "never edit task Markdown directly",
        "commit only the bound task path",
        "commit contains no other path",
        "push failure is transport evidence",
        '--design "$PLAN" --status in_planning --if-status CURRENT_NATIVE_STATUS',
        "bd dolt push --no-adopt",
        "compatible owner-authored refinement or outside same-task planning change",
        "does not authorize implementation",
        "/implement-task",
    ):
        assert fragment in plan

    # Both managed planning assets are reconciled exactly in this project.
    for name in ("plan-task-prep", "plan-task"):
        source = workflow(name)
        tracked = ROOT / ".prime-claw" / "workflows" / f"{name}.md"
        assert tracked.read_bytes() == source.read_bytes()

    extension = (
        ROOT / "src" / "prime-agent-plugin" / "extensions" / "reviewed-plan.ts"
    ).read_text()
    assert 'prepSkillName: "plan-task-prep"' in extension
    assert 'phaseSkillName: "plan-task"' in extension
    assert 'pi.registerCommand("plan"' in extension
    assert 'name: "plan_task"' in extension
    assert 'command: "plan-spec"' in extension
    assert 'name: "plan_spec"' in extension


def test_task_native_implementation_policies_are_publicly_activated_with_folder_compatibility() -> None:
    prep = " ".join(workflow("implement-task-prep").read_text().split())
    implement = " ".join(workflow("implement-task").read_text().split())

    for fragment in (
        "<operator-implementation-task-id>",
        "backlog task view --json -- TASK-ID",
        "status exactly `In Planning`",
        "meaningful",
        "not blank or an obvious placeholder",
        "not the authoritative implementation-readiness review",
        "sole follow-up",
        "cannot cancel, replace, reconstruct, retry, or invoke",
        "Status",
        "Evidence",
        "Next Step",
        "compaction requested",
        "compaction confirmed",
    ):
        assert fragment in prep
    for fragment in (
        "Resolve the live provider directly from its native project evidence",
        "exact returned task path",
        "bd context --json",
        "bd show TASK-ID --json --long --include-comments",
        "native status exactly `in_planning` mapped to canonical `In Planning`",
        "raw `design` field",
        "do not invent a task path or translate it into a normalized task model",
        "exact native project root",
    ):
        assert fragment in prep
    assert prep.count("await compact.run(focus_hint)") == 1
    assert "Do not run `prepare`" in prep

    for fragment in (
        "<operator-implementation-task-id>",
        "backlog task view --json -- TASK-ID",
        "status exactly `In Planning`",
        "Reject any other status without mutation",
        "Description, Acceptance Criteria",
        "Implementation Plan",
        "without guessing material product choices",
        "Do not demand standard threat, failure, recovery, complexity, hardening",
        "Do not call `create_task_episode`",
        "call `create_task_episode` exactly once",
        "exact canonical task ID as its sole `taskId` argument",
        "from `In Planning` to `In Progress` through Backlog",
        "commit and verify that exact task path",
        "persist one `provisioning` ownership record",
        "bound to the canonical task and status-commit SHA",
        "before creating any branch, worktree, or session",
        "creates the Episode branch and worktree from that recorded SHA",
        "transport failure alone does not block local Episode creation",
        "returns the exact main task to `In Planning`",
        "partial, or uncertain mutation publishes `Blocked`",
        "must never be retried as a new Episode",
        "one fixed execute assignment",
        "Do not begin implementation in the owner Conversation",
    ):
        assert fragment in implement
    for fragment in (
        "perform `prepare`'s repository-orientation reads",
        "skip its Backlog-only queue inventory",
        "Resolve the live provider directly from its native project evidence",
        "exact returned task path",
        "bd context --json",
        "bd show TASK-ID --json --long --include-comments",
        "native status exactly `in_planning` mapped to canonical `In Planning`",
        "complete raw native view",
        "Do not invent a task path or translate it into a normalized task model",
        "provider-native status and plan/design evidence",
        "approval is then consumed once",
        "published provider revision",
        "complete raw task evidence",
        "exact code `baseRef`",
        "No task path exists or may be invented",
        "one fixed execute assignment",
        "must never retry, force, adopt, reset, use raw Dolt writes",
    ):
        assert fragment in implement
    assert implement.index("verified status commit") < implement.index("persist one `provisioning` ownership record")
    assert implement.index("persist one `provisioning` ownership record") < implement.index("before creating any branch, worktree, or session")
    assert implement.index("before creating any branch, worktree, or session") < implement.index("creates the Episode branch and worktree from that recorded SHA")

    # Installed prep policy may differ until deliberate candidate activation.
    for name in ("implement-task-prep", "implement-task"):
        source = workflow(name)
        tracked = ROOT / ".prime-claw" / "workflows" / f"{name}.md"
        assert tracked.read_bytes() == source.read_bytes()

    extension = (
        ROOT / "src" / "prime-agent-plugin" / "extensions" / "reviewed-plan.ts"
    ).read_text()
    assert 'pi.registerCommand("implement-task"' in extension
    assert 'name: "create_task_episode"' in extension
    assert "admitProviderTaskPrepChain" in extension
    assert "providerTaskResolver" in extension
    assert "requireLiveImplementationTask" in extension
    assert "samePlacement" in extension
    assert 'name: "handoff_task_episode"' in extension
    assert 'name: "finalize_task_episode"' in extension
    assert 'name: "transition_spec_episode_to_task"' in extension
    assert 'command: "implement-spec"' in extension
    assert 'name: "create_spec_episode"' in extension
    assert 'name: "handoff_spec_episode"' in extension
    assert 'name: "finalize_spec_episode"' in extension
