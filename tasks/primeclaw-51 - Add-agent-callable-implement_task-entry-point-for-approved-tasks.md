---
id: PRIMECLAW-51
title: Add agent-callable implement_task entry point for approved tasks
status: In Progress
assignee: []
created_date: '2026-10-31 17:45'
updated_date: '2026-10-31 19:23'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
documentation:
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/traceability.md
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
