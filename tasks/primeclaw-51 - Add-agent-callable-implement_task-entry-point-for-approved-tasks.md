---
id: PRIMECLAW-51
title: Add agent-callable implement_task entry point for approved tasks
status: Ready for Merge
assignee: []
created_date: '2026-10-31 17:45'
updated_date: '2026-10-31 20:48'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
documentation:
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/traceability.md
modified_files:
  - .agents/skills/backlog/SKILL.md
  - .agents/skills/design-legacy/SKILL.md
  - .agents/skills/design/SKILL.md
  - .agents/skills/spec-it-out/SKILL.md
  - .prime-claw/templates.json
  - .prime-claw/workflows/handoff.md
  - .prime-claw/workflows/implement-prep.md
  - .prime-claw/workflows/implement-spec.md
  - .prime-claw/workflows/implement-task-prep.md
  - .prime-claw/workflows/implement-task.md
  - .prime-claw/workflows/plan-prep.md
  - .prime-claw/workflows/plan-spec.md
  - .prime-claw/workflows/plan-task-prep.md
  - .prime-claw/workflows/plan-task.md
  - AGENTS.md
  - LONG_RANGE_PLAN.md
  - README.md
  - VISION.md
  - docs/README.md
  - docs/backlog.md
  - docs/conversation-driven-episode-oversight.md
  - docs/future-specification-bundles.md
  - docs/handoff-chain.md
  - docs/prep-chain.md
  - docs/project-initialization.md
  - docs/user-stories/A-installation.md
  - docs/user-stories/B-project-initialization.md
  - docs/user-stories/C-specification.md
  - docs/user-stories/D-planning.md
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/H-handoff-and-continuation.md
  - docs/user-stories/README.md
  - docs/user-stories/traceability.md
  - scripts/test-tier1.sh
  - src/prime-agent-plugin/asset-inventory.json
  - src/prime-agent-plugin/extension-support/prep-chain.ts
  - src/prime-agent-plugin/extension-support/spec-episode.ts
  - src/prime-agent-plugin/extensions/handoff-chain.ts
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
  - src/prime-agent-plugin/skills/handoff/SKILL.md
  - src/prime-agent-plugin/skills/implement-spec/SKILL.md
  - src/prime-agent-plugin/skills/implement-task/SKILL.md
  - src/prime-agent-plugin/skills/plan-spec/SKILL.md
  - src/prime-agent-plugin/skills/plan/SKILL.md
  - src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md
  - src/prime-agent-plugin/skills/project-templates/design-legacy.md
  - src/prime-agent-plugin/skills/project-templates/design.md
  - src/prime-agent-plugin/skills/project-templates/spec-it-out.md
  - src/prime-agent-plugin/workflows/handoff.md
  - src/prime-agent-plugin/workflows/implement-prep.md
  - src/prime-agent-plugin/workflows/implement-spec.md
  - src/prime-agent-plugin/workflows/implement-task-prep.md
  - src/prime-agent-plugin/workflows/implement-task.md
  - src/prime-agent-plugin/workflows/plan-prep.md
  - src/prime-agent-plugin/workflows/plan-spec.md
  - src/prime-agent-plugin/workflows/plan-task-prep.md
  - src/prime-agent-plugin/workflows/plan-task.md
  - tests/beads_task_episode_admission_extension.test.mjs
  - tests/container/reviewed_plan_source_loader.mts
  - tests/fixtures/backlog-admission-config.yml
  - tests/handoff_chain_extension.test.mjs
  - tests/reviewed_plan_extension.test.mjs
  - tests/spec_episode_extension.test.mjs
  - tests/task_episode_admission_extension.test.mjs
  - tests/task_providers.test.mjs
  - tests/test_backlog_workflow.py
  - tests/test_future_plan_skills.py
  - tests/test_global_asset_drift.py
  - tests/test_handoff_chain_extension.py
  - tests/test_oversee_episode_skill.py
  - tests/test_prime_agent_plugin_install.py
  - tests/test_project_initialization.py
  - tests/test_reviewed_plan_extension.py
  - tests/test_reviewed_plan_source_loader.py
  - tests/test_tier1_driver.py
priority: p2
type: feature
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context and outcome
Prime Claw currently mixes agent-invoked Markdown skills, agent-callable tools, and custom slash commands. Planning has an agent-callable entry point, but implementation starts through `/implement-task`, leaving the operator to supply command syntax even after giving a clear conversational instruction.

Replace Prime Claw's custom slash-command workflow with Markdown skills and commands/tools exposed to the agent. Skills tell the agent how to interpret the operator's request and invoke the supported operations. The operator should be able to direct the workflow conversationally without a required custom slash-command invocation.

This supersedes the original narrow proposal to add only `implement_task`. The inspected custom-command inventory is `/plan`, `/plan-spec`, `/implement-task`, `/implement-spec`, and `/handoff`. Remove Prime Claw's custom registrations, not Prime Agent's built-in commands or its native `/skill:` invocation mechanism.

## Required behavior
Provide discoverable Markdown skill guidance and agent-callable operations for the workflow outcomes currently reached through those commands, including task-native planning and implementation, ordinary handoff, and retained folder-based compatibility where it is currently supported. Reuse existing tools where they already provide the outcome rather than adding redundant interfaces. Add the missing agent-facing implementation entry capability.

Skills must explain how to bind the intended task or retained specification, resolve material ambiguity, invoke the corresponding operation, interpret admission versus completion, and stop or continue appropriately. Users must not need to issue a custom slash command as a prerequisite. Update installed managed guidance and relevant product documentation so they describe the same skills-and-agent-operations interface.

Preserve task/provider identity, lifecycle-state validation, semantic readiness, placement selection, ownership, isolated Episode allocation, and the single fixed execute assignment. Do not let the interface change bypass resource-safety checks or silently broaden approved scope. Preserve supported legacy outcomes without retaining custom slash commands as a hidden required entry path. Failed or uncertain admission or partial creation must not cause automatic duplicate admission or Episode allocation.

## Approval and enforcement boundary
Markdown skills own the workflow rules for advancing between phases. They interpret the operator's approval and decide when to invoke the corresponding operations. An explicit conditional instruction such as "plan this task, then implement it when ready" may authorize that sequence within the approved scope; it does not require fresh approval solely because planning finished. A request to plan alone does not authorize implementation.

Native tools enforce concrete task/provider identity, valid lifecycle state, semantic readiness, placement, ownership, and resource safety. They must not require proof that a particular earlier entry point or invocation sequence was used as a substitute for the skill's interpretation of operator authority. This does not remove readiness or resource-safety validation.

## Delegated task selection and lifecycle readiness
The operator may explicitly delegate selection of work within stated bounds. The skill may select a matching task and must bind its exact canonical identity before invoking task-specific native operations. Delegated task selection is not permission to skip design or planning.

Implementation eligibility is represented by the existing task workflow states: a task must have progressed through design and planning and be in `In Planning` before implementation admission. Selecting a "ready to implement" task therefore means selecting from that eligible lifecycle state, not merely taking the highest-priority open task or relying on dependency readiness alone. Preserve the existing semantic readiness checks; do not add a second phase-history receipt or invocation-sequence proof alongside the task's native lifecycle state.

## Retained folder-based compatibility
Keep the currently supported retained folder-based planning, implementation, and continuation behavior. Replace its custom slash-command entry points with Markdown skill guidance and agent-callable operations. Removing custom commands is not authority to retire retained version-1 workflows, migrate their ownership, delete their plans, or alter their resource lifecycle.

The material operator-interview decisions are resolved. This specification remains `In Design` for operator review. Specification approval permits only the separate planning workflow; it does not itself start planning or implementation.

## Scope boundaries
This work replaces the Prime Claw workflow invocation surface; it does not remove operator authority over product, scope, merge, abandonment, or destructive actions. It does not introduce an orchestrator, new task provider, or an autonomous delivery loop.

Prefer provider-native behavior, then concise LLM instructions for semantic judgment, then only narrow deterministic integrity and transport code. Do not implement deterministic machinery for task reconciliation, iterative plan changes, semantic approval classification, or other reasoning that the Episode or Conversation can perform through the LLM. Do not add persistent state or state machines unless a named acceptance criterion cannot otherwise be met and the implementation plan demonstrates why they are necessary.

Prime Agent remains an upstream dependency. Changes belong in prime-claw's plugin, managed guidance, documentation, and tests. Candidate plugin validation remains Docker-isolated, with no candidate host/user-global apply or probe before acceptance. Installation/cutover behavior must respect the existing full-restart and active-resource safety requirements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prime Claw no longer registers its custom /plan, /plan-spec, /implement-task, /implement-spec, or /handoff commands; Prime Agent built-ins and native /skill: invocation are unaffected.
- [ ] #2 Discoverable Markdown skills instruct the agent how to invoke supported workflow operations, bind exact task or retained-specification identity, resolve material ambiguity, and distinguish admission from completion without requiring custom slash commands. Explicit delegated task selection stays within the operator's bounds; implementation selection requires the existing In Planning lifecycle state after design and planning, not dependency readiness alone, and preserves semantic readiness checks without a separate phase-history proof.
- [ ] #3 Every supported workflow outcome formerly reached through the removed custom commands remains reachable through agent-callable operations and skill guidance, including implementation entry, task-native planning, ordinary handoff, and retained folder-based planning/implementation/continuation. Existing tools are reused where sufficient. Retained version-1 workflows, ownership, plans, and resource lifecycle are not retired or migrated by this invocation change.
- [ ] #4 Markdown skills own phase-advancement and approval policy, honor explicit conditional approval for planning followed by implementation within approved scope, and do not infer implementation authority from planning alone. Native tools enforce concrete identity/state/readiness/placement/ownership/resource safety without requiring a particular prior workflow-entry invocation sequence.
- [ ] #5 The new invocation surface preserves provider/canonical identity, required lifecycle states, readiness checks, placement decisions, ownership, isolated Episode creation, and the one fixed execute assignment, without duplicate admission or allocation after failed or uncertain results.
- [ ] #6 Managed installed guidance and relevant workflow/user-story documentation consistently describe skills plus agent-callable operations and no longer prescribe removed custom slash commands as required workflow entry points.
- [ ] #7 Focused automated coverage proves removal of custom registrations, reachable replacement workflow entry points, relevant authorization guidance, and preserved admission/resource-safety outcomes for supported providers and retained compatibility; plugin-source changes pass Docker-isolated Tier-1 validation.
- [ ] #8 The interface cutover respects existing restart and active-resource safety requirements; removing command registrations does not strand supported active task-native or retained version-1 workflows.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation approach

Replace invocation surfaces, not the Episode lifecycle. Reuse the existing preparation, provider, placement, ownership, allocation and handoff primitives. Keep approval/phase reasoning in Markdown; keep only concrete integrity and resource checks in code. No Prime Agent changes or new dependency is required.

1. **Replace command adapters with callable workflow entries.** In `extensions/reviewed-plan.ts`, remove the `plan`, `plan-spec`, `implement-task` and `implement-spec` registrations and their command-only parsers/dispatch aliases. Remove `handoff` registration in `extensions/handoff-chain.ts`. Retain `plan_task`, `plan_spec`, `ralph_handoff` and existing lifecycle tools. Add `implement_task(taskId, host?)` over the existing task implementation prep-chain helper and `implement_spec(location, host?)` over the existing retained implementation prep chain. Use structured arguments and tool-origin steer delivery, not command-only native delivery. Reuse `admitPrepChain`, `admitProviderTaskPrepChain` and `admitWorkflowChain`: preflight both canonical assets, deliver preparation and exactly one canonical follow-up, report admission rather than compaction/readiness/creation completion, and end the calling turn. Preserve first-versus-follow-up transport uncertainty; do not retry or send a second assignment.

2. **Remove invocation-proof approval stores without losing their factual data.** Delete the legacy `ImplementationApproval` map, `TaskImplementationApprovalStore`, grant/consume/skip-next-agent-end logic and expiration hooks used solely to prove a prior command/turn. Remove the corresponding “no matching active /implement-* approval” gates. Do not rename these into tokens, required entry receipts, approved booleans or phase-history proofs. Keep final `create_task_episode` / `create_spec_episode` calls self-contained using the exact selected task/folder. Derive provider, canonical root and Backlog path from existing context and supported native lookup wherever possible; pass only facts that cannot be recovered safely, such as an explicitly selected stable host. Do not add redundant caller-supplied root/path fields, a new binding object or a receipt framework merely to replace the old stores. Preserve actual identity/drift checks and carry necessary selection facts through existing canonical workflow messages without requiring an earlier entry to mint private authority. Inputs cannot redirect the canonical root or supply arbitrary worktree/session/engine identities.

   Reuse `resolveTaskEpisodePlacement` at entry to preserve existing placement/cancellation behavior, carry any selected exact `id:<setup-id>` as operation data, and revalidate that selection at final creation before mutation. Final create must also resolve placement safely when called without a preceding entry. Preserve sole-ready selection, explicit-host/no-silent-fallback behavior, ambiguity/picker cancellation, remote refusal and the existing definitive-Orca-unavailable-only local fallback. Re-resolve current provider/task/root/path and reject genuine binding drift; do not add task-content revision approval locks.

   For retained bundles, deliberately replace the `approvedBundleDigest` dependency on the removed map: capture the current ready bundle digest at the concrete create boundary and use it in the existing capture/promotion/post-copy integrity checks. Keep grandfathered frozen-specification verification and readable meaningful plan checks. Check exact active version-1 replay before requiring the obsolete future folder; source-absent replay must return the same resources with no assignment. Keep `assertConversationPromotionReady` ownership-conflict checks and persisted ownership; those are not invocation-history proofs.

3. **Install discoverable entry skills and align actual loaded policy.** Add thin globally discoverable Markdown skills for `plan`, `plan-spec`, `implement-task`, `implement-spec` and ordinary `handoff`, following the existing initialize-prime-claw skill/tool pattern. Keep entry skills limited to entry guidance and routing through the corresponding tools to the canonical project phase workflows. Keep detailed phase procedures and project-customizable phase policy in those workflows; load them rather than copying complete procedures into global entry skills. Register their sources and targets in `asset-inventory.json` using existing managed delivery classes. Global entry placement keeps them available to active Episode snapshots that intentionally skip project reconciliation. Do not build another installer, copy plugin code into project extensions, or expose lifecycle-only workflows as scanned SKILL.md duplicates.

   Keep the stable inventory IDs and customizable project destinations of current planning/implementation/handoff workflows under `.prime-claw/workflows/`; keep retained `.ralph/skills` fallback where supported. Update source policy, relevant managed builder copies, tool descriptions/guidelines and result messages consistently. Merge intended changes into existing customization instead of resetting overrides or removing old workflow assets. Remove instructions requiring a removed slash command, a separate approval solely because planning ended, or an earlier entry invocation. Planning itself adds no implementation authority; explicit conditional authority may remain valid through preparation/compaction and allow the agent to invoke implementation after the completed plan passes readiness. A planning-only request still stops for review. Bounded delegated selection must bind one exact task before tool invocation; implementation requires existing `In Planning`/`in_planning` after design/planning plus semantic readiness, not dependency readiness alone. Skills clarify material ambiguity or new scope rather than infer authority. Do not encode semantic approval classification or task-selection reasoning in native code.

4. **Prove the preserved outcomes with focused existing coverage.** Extend `tests/reviewed_plan_extension.test.mjs` and `tests/handoff_chain_extension.test.mjs` for tool-origin entries, no custom registrations, meaningful admission results and sole follow-up behavior. Replace tests that require an earlier approval-store invocation with self-contained final-create success and concrete invalid-state/identity/placement/ownership refusal tests. In the existing affected task/Beads/retained Episode suites, retain meaningful-plan/state checks, primary-main/provider publication checks, ownership-before-allocation, exact active legacy replay including absent source, frozen/content integrity, one fixed execute assignment, and partial/uncertain-creation refusal. Exercise the relocated placement/digest facts explicitly so deleting the old stores cannot silently weaken safety. Do not add a new admission state machine or generic test matrix.

   Extend existing initialization/delivery and focused policy tests for discoverable skill installation, unchanged internal workflow IDs, customization preservation and consistent conditional-approval/delegated-selection guidance. Update native discovery probes in `tests/test_reviewed_plan_extension.py` and `tests/test_handoff_chain_extension.py`; update `scripts/test-tier1.sh --probe` and `tests/test_tier1_driver.py`, which currently require removed commands, to assert their absence and replacement tool/skill discovery while preserving Prime Agent built-ins and `/skill:`. Run affected tests through the existing Docker container bridges (reviewed-plan, handoff, initialization, and changed provider/legacy admission cases), relevant policy/delivery checks, and mandatory `scripts/test-tier1.sh --probe` after every plugin-source change. Record actual results and remaining failures; no host/user-global candidate apply, check or probe.

5. **Update current docs and publish a reviewable candidate.** Update `README.md`, `VISION.md`, relevant Phase 4 text in `LONG_RANGE_PLAN.md`, builder `AGENTS.md`/Backlog guidance, and current prep-chain, handoff-chain, initialization, oversight and retained-bundle docs. Update affected planning, promotion, continuation and initialization user stories plus `docs/user-stories/traceability.md` to match skills/tools, approval policy and actual acceptance evidence. Distinguish removed custom commands from native `/skill:`, internal workflow names and historical references; do not mechanically rewrite historical evidence. Preserve unrelated customizations, ownership/resources and task content. The later implementation Episode publishes its code/tests/docs and bounded native task progress for review; no initial handoff or second execute assignment.

6. **Keep activation separate and safe.** Candidate validation uses existing isolated Docker apply/check/probes only. After a separately authorized merge and primary-main user-global refresh, let affected work quiesce and perform one coordinated full Prime Agent restart. Keep every resource the old generation may read, including retained active plan pairs, until resumed owner/Episode and designated ordinary-session UAT prove the new generation is active and the new skills/tool paths work without custom registrations. Copy success, `/reload` or a fresh probe alone is not cutover proof. Do not migrate/retire retained workflows, delete plans, recreate active Episodes or perform cleanup as part of this interface change. This plan does not itself authorize live deployment or restart.

## Scope limit

Prefer existing provider-native behavior, then concise LLM instructions, then the narrow integrity/transport changes above. No deterministic approval classifier, task reconciliation, iterative-plan controller, phase-history receipt, persistent coordination framework, orchestrator, autonomous backlog loop or speculative hardening. Keep explicit operator authority for product/scope, merge, abandonment and destructive actions. Planning does not authorize implementation; stop for operator review of this saved plan.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution slice 1 (2026-10-31): implement the task-native agent entry end to end: implement_task(taskId, optional stable host), self-contained create_task_episode with current provider/task/placement checks, and removal of only TaskImplementationApprovalStore invocation proof. Add the discoverable implement-task entry and align its customizable task workflows/docs. Keep all custom command registrations and retained version-1 invocation guard unchanged in this incremental slice. Later slices still remove commands, replace retained entry guards, add remaining entry skills, and align full product documentation. No acceptance criterion is claimed complete yet. Validate through Docker suites and tier-1 probe only; do not activate globally or change lifecycle status.

Slice 1 published for Conversation review (2026-10-31)

Code HEAD: 25615430ba173be461fac7ee66a8f03c6fbc0329, non-force pushed and verified on origin/JLanders/prime-claw-primeclaw-51-episode-c8541422. Code checkout is clean and up to date. This is ONE incremental task-native entry slice, not completion of PRIMECLAW-51.

Delivered: structured implement_task(taskId, host?) with tool-origin steer plus one canonical readiness follow-up; global inventory-managed implement-task entry skill; self-contained create_task_episode(taskId, host?) without TaskImplementationApprovalStore, grant/consume, or task-only expiry hooks. Existing provider/canonical identity, primary-main, native In Planning/required plan evidence, publication, placement, ownership-before-allocation and fixed execute-assignment safeguards remain. Selected stable host and factual provider/root/Backlog path observations cross both workflow messages; no content/revision receipt or invocation-sequence gate is added. Markdown retains semantic readiness, explicit conditional plan-then-implement authority, bounded delegated selection and planning-only limits. Updated source and builder task workflows, template hashes, relevant docs, native discovery, and synthetic tests. Retained custom commands and version-1 guard remain unchanged.

Validation (Docker only for plugin behavior; supported annotated source identity cwd-fix-v0.9.8-r1 independently verified):
- scripts/test-tier1.sh --probe: PASS on final plugin source, including isolation, loading, teardown and manifest publication. Evidence .test-results/20261031T193149Z-27484-542c2bd5/tier1; log .test-results/primeclaw-51-slice1-probe-final.log.
- python3 -m pytest tests/test_reviewed_plan_extension.py::test_reviewed_plan_node_suite -q -m container: 1 passed (final bytes), all registered Node behavior checks passed. Log .test-results/primeclaw-51-slice1-reviewed-final.log.
- python3 -m pytest tests/test_reviewed_plan_extension.py tests/test_task_providers.py -q -m container: 9 passed, 1 failed, 12 deselected. Only failure was the already-snapshotted obsolete task placement guidance assertion; the final-byte single bridge above fixes and passes it. The 9 passing bridges cover native discovery, retained Episode lifecycle/close, Backlog admission, Beads admission, task ownership and provider resolution. Log .test-results/primeclaw-51-slice1-admission-final.log.
- python3 -m pytest tests/test_reviewed_plan_extension.py tests/test_project_initialization.py tests/test_prime_agent_plugin_install.py tests/test_global_asset_drift.py -q -m container: 47 passed, 1 failed, 25 deselected. Sole failure was the same superseded reviewed-plan assertion; initialization, delivery and installation/discovery checks passed. Log .test-results/primeclaw-51-slice1-focused.log.
- python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_source_loader.py -q -m container: initial 3 passed/2 failed/3 deselected. Supported default source-loader, Beads admission and task ownership passed; later provider/admission rerun above passed after replacing retired backlog/config.yml test input with a tracked synthetic fixture and removing an obsolete test-only prior-entry expectation. Log .test-results/primeclaw-51-slice1-providers.log.
- python3 -m pytest tests/ -q: 678 passed, 12 failed, 89 skipped, 75 subtests passed. No candidate-only failures remain against committed e4bc60d baseline. Logs .test-results/primeclaw-51-slice1-tier0-final.log and .test-results/primeclaw-51-slice1-baseline-tier0.log. Baseline archive has 15 failures: the same 12 plus three archive-only missing Git/submodule-metadata checks. Existing failed nodes below remain outside this slice; no unrelated customization was reset.
- Focused task-policy subset: 7 passed; git diff --check passed. Full container suite was not run for this incremental slice.

Remaining baseline static failures:
- tests/test_backlog_workflow.py::test_plan_tree_deletion_receipt_proves_durable_task_owners
- tests/test_backlog_workflow.py::test_repository_status_migration_receipt_and_live_data_are_consistent
- tests/test_backlog_workflow.py::test_prompt_led_merge_uses_ff_only_then_exact_backlog_done_commit
- tests/test_execute_skill.py::test_supported_task_content_edits_leave_status_and_unrelated_work_unchanged
- tests/test_future_plan_skills.py::test_documented_task_authoring_cli_sequence_is_atomic_and_task_only
- tests/test_future_plan_skills.py::test_project_customized_authoring_skills_are_preserved_while_new_upstream_is_advertised
- tests/test_future_plan_skills.py::test_task_native_planning_workflows_are_exposed_without_removing_folder_compatibility
- tests/test_inventory_integrity.py::test_project_wide_testing_proofs_use_durable_backlog_tasks
- tests/test_inventory_integrity.py::test_current_proof_surfaces_do_not_depend_on_plan_worktree_paths
- tests/test_managed_session_protocol.py::test_managed_plugin_has_exact_typescript_inventory_and_no_retired_work_control_transport
- tests/test_project_initialization.py::test_builder_project_uses_regular_project_assets_and_no_legacy_skill_tree
- tests/test_reviewed_plan_extension.py::test_repository_status_cutover_uses_task_native_order_without_to_do

Remaining approved work: remove all five custom command registrations/adapters; replace retained ImplementationApproval invocation proof while preserving frozen bundle integrity/source-absent replay and resource lifecycle; add remaining plan/plan-spec/implement-spec/handoff global entries; align actual planning/handoff/oversight policy, conditional authority and delegated selection across all loaded guidance; update full product docs and final discovery probes; complete remaining focused/full acceptance coverage. No full acceptance criterion is marked complete by this slice. Lifecycle status remains In Progress. No global apply/check/probe, live deployment, restart, merge, abandonment, cleanup, task-provider migration, or second Episode assignment occurred. Continue only after the owning Conversation reviews this checkpoint.

Accepted handoff checkpoint (2026-10-31)

The owning Conversation accepted slice 1 as an incremental candidate, not full-task acceptance. It verified native changes limited to Implementation Notes, modified-file metadata and timestamp with unchanged scope/plan/AC/status; clean pushed code 25615430ba173be461fac7ee66a8f03c6fbc0329; passing Docker Tier-1 and final reviewed-plan bridge; and no candidate-only static failures against baseline. Its independent read-only GPT-6 Astra source/test review reported no material defect. Continue this same Episode only.

Next bounded execute slice: retained-folder parity. Add implement_spec(location, optional stable host) tool-origin entry and discoverable global skill; make create_spec_episode self-contained without the remaining legacy invocation-proof ImplementationApproval map. Capture the current implementation-ready bundle digest at the concrete create boundary and retain the existing capture/promotion/post-copy integrity checks, grandfathered frozen-specification verification and meaningful-plan checks. Check exact active version-1 replay before requiring an obsolete future source; source-absent replay must return the same resources with no execute assignment. Preserve placement, explicit stable host/no silent fallback, ownership/resource safety, stable customizable workflow IDs and retained .ralph/skills lookup support.

Do not add tokens, receipts, approval classifiers or binding frameworks. Do not migrate, retire, delete or recreate retained work. Keep command removals, other global entry skills and complete policy/docs/probe alignment pending unless this slice needs a proportionate related change. Validate changed plugin source only through Docker and the mandatory Tier-1 probe. Publish truthful native task evidence and one clean pushed code slice, then stop for Conversation review. No host/global candidate apply/check/probe, merge, activation, restart, cleanup, new Episode or second assignment. This task remains In Progress; product scope, plan and AC remain unchanged.

Slice 2: retained-folder parity published for Conversation review (2026-10-31)

Code HEAD: 8dfe2077a4a9e4041a927a6183371586487347e9, non-force pushed and directly verified on origin/JLanders/prime-claw-primeclaw-51-episode-c8541422. One bounded retained-folder parity slice on the same Episode; no new Episode, assignment, lifecycle publication, migration, activation, or resource cleanup. This is not completion of PRIMECLAW-51. Status remains In Progress and original specification, plan and eight unchecked acceptance criteria remain unchanged.

Delivered: structured implement_spec(location, host?) routes tool-origin steer plus one canonical implementation-readiness follow-up; global inventory-managed implement-spec entry skill; self-contained create_spec_episode(location, host?) without the remaining ImplementationApproval map, skip-next-agent-end or approval-expiry hooks. Fresh creation captures the current readable meaningful-plan/frozen-spec bundle digest for existing capture/promotion/post-copy integrity checks rather than accepting a caller-supplied invocation digest. Exact active retained ownership is checked before obsolete source lookup, including source-absent replay; the same verified resources return without another execute assignment. Entry and create retain explicit stable host/no silent fallback, placement cancellation/refusal, assertConversationPromotionReady, ownership/resource and frozen-spec safeguards. Orca inventory delegates to existing strict missing-only task-placement lookup so malformed/runtime failures cannot silently select local fallback. No tokens, receipts, approval classifier or binding framework added.

Loaded source and builder implement-prep/spec policies now keep semantic/conditional authority in Markdown, carry the selected stable host as factual operation data, and describe direct create/replay boundaries. Workflow IDs and builder customized states/historical baseline hashes remain; only exact changed installed/upstream hashes were updated. Supported existing .ralph/skills snapshot fallback was preserved unchanged (not expanded to retained implementation entry). Added focused Node regressions and narrow retained-entry docs in README.md, docs/prep-chain.md and docs/user-stories/E-episode-promotion.md, plus discovery/install/inventory coverage.

Validation evidence (plugin/runtime behavior Docker-only; supported read-only cwd-fix-v0.9.8-r1 source identity unchanged):
- scripts/test-tier1.sh --probe: PASS on final plugin bytes; immutable image, network isolation, checks, teardown and manifest publication verified. Evidence .test-results/20261031T195205Z-94898-4f48af54/tier1; log .test-results/primeclaw-51-slice2-probe.log.
- python3 -m pytest tests/test_reviewed_plan_extension.py tests/test_task_providers.py tests/test_project_initialization.py tests/test_prime_agent_plugin_install.py tests/test_global_asset_drift.py tests/test_reviewed_plan_source_loader.py -q -m container: 54 passed, 1 failed, 28 deselected. The passing bridges cover reviewed-plan/tool admission, retained fresh/replay/integrity/placement/uncertainty, task ownership/close, Backlog admission/provider resolution, real fresh-session publication, native tool discovery, initialization/global skill discovery, install/delivery, and supported source-loader. Sole failure was an obsolete Beads test-only call to the removed agent_end hook; no plugin defect. Replaced that call with an assertion that the hook is absent. Log .test-results/primeclaw-51-slice2-container-final.log.
- python3 -m pytest tests/test_task_providers.py::test_beads_task_episode_admission_node_suite -q -m container: 1 passed on corrected final test bytes; all Beads admission cases passed. Log .test-results/primeclaw-51-slice2-beads-final.log. No plugin source changed after either passing snapshot.
- python3 -m pytest tests/ -q: 680 passed, 12 failed, 91 skipped, 75 subtests passed. The failed-node set exactly matches the 12 recorded slice-1/baseline failures, with no candidate-only failed node. Log .test-results/primeclaw-51-slice2-tier0-last.log. Last subsequent edit was only the obsolete Node test call noted above; no host plugin runtime execution.
- Focused host-safe delivery/policy checks: 35 passed, 3 unrelated baseline checks deselected. git diff --check passed. Full container suite was not run.
- Initial concurrent container attempt did not execute fixture tests: source-builder image ID was absent at inspection (read-only docker image inspect confirmed No such image); receipt showed no builder allocation and identical source checkout inventory before/after. Independent source-loader passed, 54 fixture setup errors. Preserved evidence .test-results/20261031T195205Z-94724-261b599e/tier1 and .test-results/primeclaw-51-slice2-container.log. The serialized rerun above passed all but the superseded Beads fixture; no testing-harness or Prime Agent change was made. Two obsolete static wording assertions and exact current managed-hash fixtures were updated; unrelated customized assets/baseline failures were not reset.

Still pending: removal of all five custom command registrations/adapters; remaining plan/plan-spec/handoff global entry skills; broader loaded planning/handoff/oversight policy and product docs/probe alignment; final acceptance and full-task cutover proof. Custom commands intentionally remain in this slice. No full acceptance criterion is marked complete. Candidate host/global apply/check/probe, merge/rebase, restart, deployment, migration/retirement, new Episode and cleanup remain outside this slice. Stop here for owning Conversation review.

Accepted slice-2 handoff focus (2026-10-31)

The owning Conversation accepted retained-folder parity slice 2 as an incremental candidate, not full-task acceptance. It verified compatible native notes/modified-file/timestamp updates with unchanged Description, plan, eight AC and In Progress status; exact clean pushed code 8dfe2077a4a9e4041a927a6183371586487347e9 and task evidence 696e87c5d1f92d42f9b0ac4dfd35580bf379a4c1; passing Docker Tier-1 and affected bridges after the obsolete test-only Beads hook was corrected; and no candidate-only static failures. Its independent read-only GPT-6 Astra source/test review found no material defect, including current digest/frozen-spec integrity, active source-absent replay/no assignment, host/error refusal and ownership safety. Continue only this same Episode within the original approved plan.

Next bounded execute focus: remaining invocation cutover. Remove the five custom command registrations/adapters. Add the remaining thin globally discoverable plan, plan-spec and ordinary handoff entry skills by reusing existing tools. Align actually loaded planning/handoff/oversight guidance and relevant docs/probes/tests with skill-owned conditional authority and bounded delegated selection. Load canonical phase policy instead of copying detailed procedures into entry skills. Preserve accepted self-contained task/retained creation, stable customizable internal workflow IDs and supported fallback, all provider/identity/state/readiness/placement/ownership/resource safeguards, Prime Agent built-ins/native /skill:, and admission-versus-completion/sole-follow-up/uncertainty behavior. Do not introduce replacement approval tokens, receipts, classifiers or a broad framework.

Use existing focused Docker suites and mandatory scripts/test-tier1.sh --probe after plugin-source changes. Report truthful full-task coverage and remaining gaps/baseline failures without fixing unrelated scope. Publish clean pushed code and native task progress, then stop for Conversation review. No candidate host/global apply/check/probe, merge, activation, restart, migration/retirement, cleanup or new Episode. Product scope, specification, plan, AC and In Progress status remain unchanged.

Invocation-cutover slice in progress (2026-10-31)

Continuing the same approved PRIMECLAW-51 Episode after incremental acceptance of retained-folder parity. Runtime changes remove the five custom command registrations and their command-only adapters/parsers, keep structured planning/implementation/handoff operations, and preserve self-contained create/resource checks. Tool-origin steer, exactly one canonical follow-up, and explicit unconfirmed-delivery/no-retry wording are retained. Remaining global entry skills and actually loaded planning/handoff/oversight policy are being aligned with conditional operator authority and bounded delegated selection. Current docs and isolated discovery probes are being updated in parallel. Code changes are not yet committed, validated, or accepted; final Docker suites and mandatory Tier-1 probe are pending. Existing plan/specification/AC/status and resource ownership remain unchanged; no activation or lifecycle action is authorized by this progress note.

Slice 3: invocation cutover published for Conversation review (2026-10-31)

Code HEAD: 54801a963af97f5c1be6fc57cbda812960c3afba, non-force pushed and directly verified on origin/JLanders/prime-claw-primeclaw-51-episode-c8541422. One bounded invocation-cutover slice in this same Episode, following incremental acceptance of slices 1 and 2. This is a review candidate, not full-task acceptance or live activation. Status remains In Progress; original Description, Implementation Plan and all eight unchecked acceptance criteria remain unchanged.

Delivered: removed all five Prime Claw custom command registrations (plan, plan-spec, implement-task, implement-spec, handoff) and command-only adapters/parsers. Existing plan_task, plan_spec, implement_task, implement_spec, ralph_handoff and lifecycle tools remain. Structured implementation arguments no longer round-trip through command strings. Added thin globally discoverable plan, plan-spec and handoff skills through existing inventory-managed global delivery, completing the five entry skills without another installer. Existing inventory IDs, customizable workflow destinations and supported old-layout handoff/execute fallback are unchanged. Canonical project workflows remain the detailed policy authority rather than being duplicated into entry skills.

Actual loaded source and customized builder planning/prep/completion, implementation, handoff, authoring and oversight guidance now agree: Markdown interprets explicit conditional plan-then-implement authority and bounded delegated selection, planning alone does not authorize implementation, exact task binding precedes native operations, and implementation requires native In Planning after design/planning plus semantic readiness. Native tools retain concrete identity/state/readiness/placement/ownership/resource checks without invocation receipts, content-revision approval locks, classifiers or framework state. Accepted self-contained task/retained create paths, current digest/frozen-spec integrity, exact source-absent retained replay without assignment, stable host/no-silent-fallback and fixed single execute assignment remain intact. Planning/handoff delivery uncertainty now reports unconfirmed transport, not false non-admission; sole-follow-up and no-auto-retry rules remain. Prime Agent built-ins and native /skill: are not changed by this plugin cutover.

Updated current product docs/user stories, Backlog skill guidance, isolated discovery probes and focused tests. All builder baseline hashes, customization states, accepted overrides and provenance remain unchanged; only exact changed installed/upstream SHA256 fields were advanced. Existing inventory rows are byte-for-byte unchanged in parsed data; only global-plan, global-plan-spec and global-handoff entries were added. Oversight guide stays within the existing 1800-word ceiling and its complete nine-test policy module passes.

Final validation (plugin/runtime behavior Docker-only, supported read-only cwd-fix-v0.9.8-r1 source selection unchanged):
- scripts/test-tier1.sh --probe: PASS on final plugin source, immutable-image/network isolation/teardown/manifest publication verified. Evidence .test-results/20261031T202744Z-19046-bf3e0317/tier1; log .test-results/primeclaw-51-slice3-probe.log.
- python3 -m pytest tests/test_reviewed_plan_extension.py tests/test_handoff_chain_extension.py tests/test_task_providers.py tests/test_project_initialization.py tests/test_prime_agent_plugin_install.py tests/test_global_asset_drift.py -q -m container tests/test_reviewed_plan_source_loader.py: 60 passed, 32 deselected, on final plugin/source/test bytes. Log .test-results/primeclaw-51-slice3-container-final.log. Covers command absence, replacement tool-origin chains/steer/sole follow-up/uncertainty, provider/placement/ownership/retained integrity/replay/close safeguards, fresh-session publication, native tool and /skill: discovery, initialization/delivery/install, and supported source-loader. Plugin source hashes are unchanged between mandatory probe, final Docker snapshot and publication.
- python3 -m pytest tests/ -q: 690 passed, 12 baseline failures, 94 skipped, 104 subtests passed. Failed-node set exactly equals the recorded pre-cutover/slice-2 twelve, with no candidate-only failure. Log .test-results/primeclaw-51-slice3-tier0-verified.log. No unrelated baseline/config/customization repair was made.
- Final evidence-only traceability update subsequently passed its affected host-safe doc checks: 7 passed, 17 deselected. git diff --check passed. Final full container suite was not run.

Bounded validation repairs: initial static sweep found four stale doc/wording expectations plus oversized guide; guide shortening exposed two more existing phrase checks, all repaired without raising ceilings or weakening authority/resource checks. A later old Backlog-skill command-presence assertion was updated with positive replacement-operation/conditional-authority checks. Initial focused Docker run had 58 passed / 1 failed / 32 deselected; sole failure was an obsolete exact installed-skill set omitting the three new skills. Corrected that test-only set, then the final 60-bridge run above passed. No plugin runtime defect or testing-harness/Prime Agent change was needed.

Coverage limits and next boundary: discovery verifies installed native skills/tools, absence of the five custom commands, and representative built-in-name nonshadowing; get_commands does not enumerate built-ins, so actual native built-in command execution is not claimed. Existing semantic planning/readiness and live cutover evidence gaps remain explicit in user-story traceability. No full acceptance criterion is marked complete by this slice. Stop for owning Conversation review of this exact pushed candidate and separate native task publication. No candidate host/global apply/check/probe, merge/rebase, activation/restart, migration/retirement/deletion, cleanup, new Episode, second assignment or task lifecycle mutation occurred. Separate accepted-main refresh, coordinated full restart and retained-resource owner/Episode/ordinary-session UAT remain separately authorized work, not completion of this Episode slice.
<!-- SECTION:NOTES:END -->
