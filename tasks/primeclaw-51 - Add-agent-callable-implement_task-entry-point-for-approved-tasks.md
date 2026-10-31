---
id: PRIMECLAW-51
title: Add agent-callable implement_task entry point for approved tasks
status: In Design
assignee: []
created_date: '2026-10-31 17:45'
updated_date: '2026-10-31 18:01'
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

## Open decisions during operator interview
- Whether retained folder-based workflow outcomes should remain supported through skills and tools after their custom slash commands are removed.

This is a living In Design specification, not ready for planning until the material decisions are resolved and the saved specification is reviewed.

## Scope boundaries
This work replaces the Prime Claw workflow invocation surface; it does not remove operator authority over product, scope, merge, abandonment, or destructive actions. It does not introduce an orchestrator, new task provider, or an autonomous delivery loop.

Prime Agent remains an upstream dependency. Changes belong in prime-claw's plugin, managed guidance, documentation, and tests. Candidate plugin validation remains Docker-isolated, with no candidate host/user-global apply or probe before acceptance. Installation/cutover behavior must respect the existing full-restart and active-resource safety requirements.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prime Claw no longer registers its custom /plan, /plan-spec, /implement-task, /implement-spec, or /handoff commands; Prime Agent built-ins and native /skill: invocation are unaffected.
- [ ] #2 Discoverable Markdown skills instruct the agent how to invoke supported workflow operations, bind exact task or retained-specification identity, resolve material ambiguity, and distinguish admission from completion without requiring custom slash commands. Explicit delegated task selection stays within the operator's bounds; implementation selection requires the existing In Planning lifecycle state after design and planning, not dependency readiness alone, and preserves semantic readiness checks without a separate phase-history proof.
- [ ] #3 Every supported workflow outcome formerly reached through those commands remains reachable through agent-callable operations and skill guidance, including implementation entry, task-native planning, ordinary handoff, and supported retained folder-based compatibility; existing tools are reused where sufficient.
- [ ] #4 Markdown skills own phase-advancement and approval policy, honor explicit conditional approval for planning followed by implementation within approved scope, and do not infer implementation authority from planning alone. Native tools enforce concrete identity/state/readiness/placement/ownership/resource safety without requiring a particular prior workflow-entry invocation sequence.
- [ ] #5 The new invocation surface preserves provider/canonical identity, required lifecycle states, readiness checks, placement decisions, ownership, isolated Episode creation, and the one fixed execute assignment, without duplicate admission or allocation after failed or uncertain results.
- [ ] #6 Managed installed guidance and relevant workflow/user-story documentation consistently describe skills plus agent-callable operations and no longer prescribe removed custom slash commands as required workflow entry points.
- [ ] #7 Focused automated coverage proves removal of custom registrations, reachable replacement workflow entry points, relevant authorization guidance, and preserved admission/resource-safety outcomes for supported providers and retained compatibility; plugin-source changes pass Docker-isolated Tier-1 validation.
- [ ] #8 Material interview decisions are resolved in the living specification before planning; the interface cutover respects existing restart and active-resource safety requirements.
<!-- AC:END -->
