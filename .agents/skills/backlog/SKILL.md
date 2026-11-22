---
name: backlog
description: Use when working in this repository's Backlog.md task tracker for ready work, task inspection, claiming, creation, blockers, dependencies, status updates, completion, or durable project handoff.
---

# Backlog.md

Use Backlog.md as the shared project task system. Run the supported CLI directly;
do not add a compatibility wrapper or edit task Markdown by hand.

Until the accepted host artifact is activated, invoke the repository-built
candidate as `deps/backlog/dist/backlog`. After activation, `backlog` is the
same CLI on `PATH`.

## Core CLI workflow

1. Inspect the unblocked task-native work queues without selecting the retained
legacy migration state:

```bash
backlog task list --status "In Design" --status "In Planning" --ready --plain
```

Use `--json` instead of `--plain` when structured output is needed. Keep the
explicit lifecycle filters: `--ready` alone can include work whose lifecycle
state does not match the phase being entered.

2. Inspect one exact task before changing it:

```bash
backlog task view --json -- <id>
```

3. Create durable follow-up work explicitly in the authoring state:

```bash
backlog task create "Short title" --status "In Design" --description "Why this exists and what needs to be done" --type task --priority P2 --plain
```

This repository now defaults new ordinary tasks to `In Design`. Keep the explicit
status in commands so the intended authoring state remains self-contained and
auditable.

4. Respect the task-native lifecycle and its authority boundaries:

- The `design` and `spec-it-out` skills create or revise only `In Design` tasks
  through supported `backlog task create` or `backlog task edit` operations.
- The `plan` skill calls `plan_task` for one exact task. Its canonical workflow
  writes the native Implementation Plan and publishes `In Planning` through one
  supported task edit.
- The Episode path in `implement-task` calls `implement_task` for one exact implementation-ready
  `In Planning` task. The owning Conversation publishes `In Progress` before
  Episode allocation. Planning alone does not authorize implementation; an explicit
  conditional plan-then-implement instruction may remain valid within approved scope.
- Later `Blocked`, resumed `In Progress`, `Ready for Merge`, and terminal `Done`
  transitions belong to the owning Conversation under the reviewed lifecycle.

Do not use a generic claim edit to bypass Episode planning or admission. For
an owned Episode, only its Conversation closes the task, which stays active
through `finalize_task_episode`; optional archive follows merged cleanup. For
ordinary direct work follow the `implement-task` skill: verify exact placement
and no same-task Episode, publish `In Progress` before implementation edits,
and publish `Done` only after required checks and code commit/publication, unless
there is a review hold. Direct work does not confer archive authority.

Archive is reversible, read-only, reserves the ID, and preserves the original
status and relationships. Restore with `backlog task restore <id>` before any
edit. Canonical archives live under `archive/tasks/`; `completed/` is legacy
archive input only, not a completion destination. Native dependencies may target
archived tasks and active drafts; add no extra graph policy. Native collision
refusal applies before writes, including archived drafts. Do not overwrite or
renumber preserved records. An archived draft's absence from native task view is
not a blocker: preserve its physical bytes, path, history, and inventory without
building a synthetic view or parser.

Only an explicitly authorized `backlog task delete <id>` on an already archived
task permanently deletes it and vacates its identity. Delete is not archive and
is not part of ordinary merged cleanup. Abandonment preserves the exact archived
non-`Done` task and Final Summary contract in `prime-claw-oversee-episode`.

## What belongs in Backlog.md

Use Backlog.md for shared project tasks, blockers and dependencies, discovered
follow-up work, resumable status, and project work that must survive compaction
or handoff. Use agent-local planning only for the current turn's checklist.
Durable repository knowledge belongs in normal tracked documentation, not in a
tracker-specific memory command.

## Rules

- Do not edit provider storage directly, including `tasks/`, `drafts/`,
  `archive/tasks/`, archived drafts, or legacy `completed/`. Use the native CLI.
- Do not create Markdown TODO files as a parallel source of truth.
- Prefer `--json` when parsing CLI output programmatically.
- Do not change or complete tasks unless the work and authority support it.
- Commit each coherent authorized ticket edit ASAP and publish promptly, not at
  handoff, compaction, session end or Episode admission. Use the actual selected
  topology: exact task path in the independent clone (non-force
  `HEAD:refs/heads/prime-claw/tasks`) or a task-only code-branch commit for an
  existing branch-local store. Use literal pathspecs for `git add` and
  `git commit --only`; inspect the selected diff, commit and native publication.
  Preserve unrelated bytes/index/history and commit code separately. Native
  conflicts and uncertain pushes need inspection, not force, reset or replay.
- Follow repository transport instructions within those task-only boundaries.
