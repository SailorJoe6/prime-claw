---
id: PRIMECLAW-33
title: Simplify Prime Claw plugin implementation without weakening user stories
status: To Do
assignee: []
created_date: '2026-10-12 01:01'
labels:
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies: []
priority: p1
type: epic
ordinal: 106000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Prime Claw needs its plugin, but the current implementation contains duplicated routers and asset authorities, dead APIs, over-stateful advisory logic, overfit tests, and completed private migration machinery. Simplification must preserve the fixed 27 user stories rather than redefine the product downward.

## Scope
Create a story-first, evidence-backed simplification program for the current Prime Agent 0.9.8 plugin. Begin with explicit story acceptance and traceability. Then take low-risk consolidation and dead-code wins, simplify the goal reminder and asset delivery authority, right-size only the relevant tests, and retire bridge/final migration machinery after the current private UAT/rollback window is explicitly closed.

## Fixed boundaries
- The plugin remains required.
- Do not remove or weaken any US-01 through US-27 outcome.
- US-05 includes an in-product Orca side-by-side diff of the tracked worktree item; terminal `git diff --no-index` is fallback, not the intended UX.
- US-14 includes a retained visible writable Orca Prime Agent tab bound to a durable session after temporary launcher removal.
- Prime Agent 0.9.8 is the supported plugin-capable API boundary; 0.10 removed the required plugin framework and is not a routine upgrade target.
- Preserve Episode uncertainty, exact ownership/location/worktree/session checks, digest binding, operator authority, Docker-only candidate validation, and separate handoff/finalization.
- Do not undertake a speculative shared design/spec template migration or a whole-suite test cleanup.
- No implementation task may start before the story/test traceability gate is complete.

## Legacy design

Sequence: (1) story/test gate, (2) design-decision records, (3) bounded low-hanging refactors, (4) explicit UAT/rollback retirement decision, (5) final-only role reconciler and migration deletion, (6) end-to-end acceptance. Every non-obvious retained mechanism must map to a story, observed failure, or recorded design decision. Favor deletion and shared internal primitives over moving unchanged complexity into more files.

## Legacy notes

Read-only audit baseline: about 4,150 LOC under src/prime-agent-plugin, 2,248 LOC in direct install/deploy scripts, plus the 772-line historical cutover coordinator. Estimated opportunity is 700–1,100 low/medium-risk production LOC before migration retirement and roughly 2,100–2,600 total production/script LOC after accepted private migration removal. These are planning estimates, not deletion targets. The audit found the Episode uncertainty core proportionate; the largest removable areas are completed role migration, duplicated workflow routing/asset authority, dead helpers, and over-stateful advisory reminders.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every US-01 through US-27 has explicit observable acceptance and named automated, integration, or manual evidence before simplification begins.
- [ ] #2 Known non-obvious constraints are recorded under docs/design-decisions with regression anchors and revisit conditions.
- [ ] #3 All child tasks preserve the fixed boundaries above.
- [ ] #4 Completed work reports measured source/test/doc deletion and remaining complexity.
- [ ] #5 Exact supported-runtime tests and focused real acceptance pass.
- [ ] #6 Main is clean and synchronized, with no candidate mutation of live plugin/sandbox/UAT resources outside separately authorized cutover work.
<!-- AC:END -->
