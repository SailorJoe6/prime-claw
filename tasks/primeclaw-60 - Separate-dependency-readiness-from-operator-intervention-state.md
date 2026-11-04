---
id: PRIMECLAW-60
title: Separate dependency readiness from operator-intervention state
status: In Design
assignee: []
created_date: '2026-11-04 19:38'
labels: []
dependencies:
  - PRIMECLAW-55
priority: p1
type: enhancement
ordinal: 145000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prime-claw currently overloads `Blocked` to mean both that prerequisite work is unfinished and that an agent needs a decision or help from the operator. Backlog already computes prerequisite readiness from native task dependencies, so duplicating that condition as a workflow status hides the task’s true phase and requires an unnecessary manual status repair after the dependency finishes. `PRIMECLAW-45` exposed this ambiguity when it was moved out of `In Planning` even though its prerequisite was already represented by `PRIMECLAW-55`.

Establish one unambiguous prime-claw workflow contract: native dependencies express prerequisite ordering, while a distinct canonical `Needs Operator` state expresses actual human intervention. A dependency-gated task keeps its truthful lifecycle phase and becomes ready through the provider’s native readiness calculation when its dependencies finish. Apply the contract consistently across supported task providers, managed lifecycle assets, and task-selection behavior.

This task does not change Backlog.md’s dependency-readiness semantics, rewrite `PRIMECLAW-55`, or make dependency completion mutate a task’s workflow phase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Prime-claw defines `Needs Operator` as the canonical workflow state used only when an agent requires an operator decision, confirmation, access, or other human help.
- [ ] #2 A task waiting only for prerequisite work retains its truthful lifecycle phase and represents the prerequisite with native task dependencies rather than an operator-intervention status.
- [ ] #3 For a dependency-gated `In Design` or `In Planning` task, supported-provider readiness is false while a dependency is unresolved and becomes true without a manual phase change when every dependency reaches its accepted terminal state.
- [ ] #4 A failed implementation admission that has not successfully established the durable Episode identity and assignment preserves or restores `In Planning` unless the recorded condition genuinely requires operator intervention.
- [ ] #5 When an active Episode enters `Needs Operator`, the task records the exact intervention or decision required and returns to the appropriate active phase when that condition is resolved.
- [ ] #6 Prime-claw task selection excludes `Needs Operator` work from ordinary pickup while allowing dependency-ready tasks in eligible design or planning phases to appear automatically.
- [ ] #7 Existing tasks in the old `Blocked` state are reviewed and reclassified from native evidence: dependency-only cases return to their truthful phase, while genuine operator-intervention cases move to `Needs Operator` without losing comments, dependencies, plans, ownership, or Episode identity.
- [ ] #8 Editable workflow skills, provider mappings, templates, instructions, and focused tests use the clarified terms consistently for both supported task providers; Backlog.md itself is not patched or forked.
<!-- AC:END -->
