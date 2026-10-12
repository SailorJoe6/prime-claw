---
id: PRIMECLAW-10.38
title: Replace .ralph/plans with task-native Backlog/Ralph lifecycle
status: To Do
assignee: []
created_date: '2026-10-12 21:02'
updated_date: '2026-10-12 21:19'
labels:
  - backlog-md
  - episode-loop
  - phase4
  - ralph
  - migration
dependencies: []
references:
  - PRIMECLAW-35
  - PRIMECLAW-10.37
parent_task_id: PRIMECLAW-10
priority: p1
type: epic
ordinal: 121000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

The Beads-to-Backlog migration intentionally adopted Backlog.md as-is and preserved the existing Ralph specification, planning, and Episode workflow. It also explicitly deferred the product decision about reshaping Ralph around Backlog.md. That split now leaves two authorities for the same unit of work: Backlog tasks track durable project work while `.ralph/plans` folders separately track design, planning, promotion, active execution, and archival state. The duplication adds file movement, compatibility machinery, and lifecycle ambiguity.

Make one Backlog task the durable source of truth from first design through planning, direct execution or Episode execution, handoff iterations, and completion. Keep the established Conversation/operator/Episode authority boundaries and proven Episode mechanics unless this specification changes them explicitly.

## Required product contract

### Task lifecycle

Ordinary work uses these statuses: `In Design`, `In Planning`, `In Progress`, `Blocked`, and `Done`. New ordinary tasks default to `In Design`; `To Do` is retired after migration.

`/design` and `/spec-it-out` create a new task or update the explicitly selected task and leave it in `In Design`. The task itself holds the durable specification, acceptance criteria, constraints, and references. These commands do not plan or authorize implementation.

`/plan TASK-ID` writes or updates the task's optional Backlog Implementation Plan and moves the task to `In Planning`. Planning remains distinct from implementation approval.

Ordinary non-Episode task execution is outside the scope of this migration.

The current `/implement-spec` Episode pathway already requires a usable `EXECUTION_PLAN.md`; that is not a new restriction. Its task-native replacement, `/implement-task TASK-ID`, preserves the existing planned-work admission gate by requiring a meaningful Backlog Implementation Plan in the selected task instead of an `EXECUTION_PLAN.md` file. Missing, blank, placeholder-only, or materially unresolved plans are rejected before Episode resources or ownership are created. A successful admission binds the Episode to that exact task.

One task represents one complete Episode across as many execute → handoff → compact → execute iterations as needed. A handoff continues the same task and Episode; it does not create a new task or planning bundle.

### Authority replacement

Backlog task fields and statuses replace all `.ralph/plans` authority, including future specification folders, active plan files, promotion or movement between folders, and plan archives. Runtime ownership records may keep only the minimal task/Episode identity needed by existing mechanics; they must not recreate a second specification or plan authority.

Update Prime Claw's commands, tools, skills, project templates, initialization and reconciliation behavior, documentation, tests, and lifecycle language to use task IDs, task fields, and task statuses. The `SPECIFICATION.md` for this migration is only a compatibility pointer to this Backlog task, not a second source of truth.

### Migration and cutover

Migrate every existing `To Do` task: tasks with a meaningful Implementation Plan become `In Planning`; tasks without one become `In Design`. Preserve `In Progress`, `Blocked`, and `Done` semantics unless the corresponding legacy plan state supplies stronger truthful evidence.

Migrate all durable state under `.ralph/plans` into destination Backlog tasks and supported fields without losing specifications, acceptance criteria, implementation plans, decisions, execution notes, references, terminal summaries, or provenance needed to understand the work. Future or unstarted state maps to `In Design` or `In Planning` according to meaningful plan presence. Active work maps to the truthful active or blocked task state. Successfully completed archives become `Done` tasks and are completed into `backlog/completed`; do not place them in `backlog/archive`. Non-success terminal or ambiguous legacy state must be preserved and surfaced for truthful disposition rather than silently marked successful.

Implement and land this change through one final old-style `.ralph/plans` migration Episode. At merge, switch all workflow authority to Backlog tasks and remove `.ralph/plans` atomically in the same accepted change. Do not leave a dual-write or indefinite compatibility phase.

## Material constraints and non-goals

- Preserve operator authority over product and scope changes, Episode admission, merge, abandonment, and destructive cleanup.
- Preserve Conversation supervision, exact Episode ownership, isolated worktree and session mechanics, handoff and compaction continuation, Expert review boundaries, recovery behavior, and finalization mechanics except where their old plan-folder identity must become task identity.
- Keep the migration KISS: minimally adapt the existing admission guard from the selected plan bundle to the selected task. Do not add approval commits, Git-blob or tag approval schemes, replacement or additional digest protocols, transaction journals, or other bespoke approval machinery.
- Do not redesign Backlog.md generally or create a parallel tracker abstraction.
- Do not make every task require planning or an Episode.
- Do not split one Episode into a task per execute or handoff iteration.
- Do not broaden this work into Orca redesign, Prime Agent upstream changes, general plugin simplification, or unrelated workflow cleanup.
- Use supported Prime Agent and Backlog.md interfaces. Prime Agent remains an upstream dependency, not a development target.
- Validate plugin-source changes only through the repository's Docker-isolated candidate path; do not mutate the installed user-global plugin during development.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Project configuration and user-facing guidance expose `In Design`, `In Planning`, `In Progress`, `Blocked`, and `Done` for ordinary tasks, default new ordinary tasks to `In Design`, and contain no active workflow that creates or selects `To Do` after migration.
- [ ] #2 Fresh and existing-task tests prove `/design` and `/spec-it-out` persist the specification and acceptance contract in the intended Backlog task, leave it `In Design`, do not write authoritative plan files, and do not authorize implementation.
- [ ] #3 `/plan TASK-ID` tests prove it updates that task’s optional Implementation Plan, moves that same task to `In Planning`, and creates neither an Episode nor a second planning authority.
- [ ] #4 `/implement-task TASK-ID` is the sole Episode admission command and preserves the existing planned-work gate currently enforced by `/implement-spec`: tests prove missing, blank, and placeholder-only task plans are rejected before any Episode mutation, while a meaningful Backlog Implementation Plan admits one Episode bound to the exact task ID.
- [ ] #5 End-to-end Episode evidence proves multiple execute, handoff, and compaction iterations continue the same task and Episode, retain the same task identity, and do not create per-iteration tasks or plan bundles.
- [ ] #6 Commands, model-callable tools, skills, workflow templates, initialization and reconciliation assets, ownership records, docs, and tests use Backlog task identity, fields, and statuses instead of `.ralph/plans` location or file movement as lifecycle authority.
- [ ] #7 A migration fixture proves every pre-cutover `To Do` task with a meaningful Implementation Plan becomes `In Planning`, every `To Do` task without one becomes `In Design`, and already active, blocked, or done tasks retain truthful semantics.
- [ ] #8 A representative migration fixture covering future specs with and without plans, active work, blocked work, successful archives, and ambiguous or non-success history proves all material content and references reach a traceable destination task; successful archives end as `Done` under `backlog/completed` and no migrated item is written to `backlog/archive`.
- [ ] #9 Repository-wide acceptance proves no live command, skill, workflow, template, test, or documentation treats `.ralph/plans` as authoritative, while historical references remain only where changing them would falsify history.
- [ ] #10 The accepted migration lands as one final old-style Episode change that both migrates existing state and removes `.ralph/plans`; the merged tree has no dual-write mode or partially switched authority.
- [ ] #11 The compatibility `SPECIFICATION.md` for this effort contains only a clear pointer to the created Backlog task and no duplicated mutable specification.
- [ ] #12 Existing tests plus focused Docker-isolated plugin acceptance prove Conversation, operator, and Episode authority, exact ownership, iteration handoff, recovery, Expert review, finalization, and cleanup behavior remain intact apart from the specified task-native identity and lifecycle changes.
- [ ] #13 Static and behavioral acceptance proves the change introduces no approval commits, Git-blob or tag approval scheme, replacement or additional digest protocol, bespoke transaction journal, Prime Agent source patch, or other unapproved scope expansion.
<!-- AC:END -->
