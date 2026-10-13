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

Do not rely on the temporary project default. The retained `To Do` status exists
only until the separately approved one-time migration classifies older tasks.

4. Respect the task-native lifecycle and its authority boundaries:

- `/design` and `/spec-it-out` create or revise only `In Design` tasks through
  supported `backlog task create` or `backlog task edit` operations.
- `/plan TASK-ID` writes the native Implementation Plan and publishes
  `In Planning` through one supported task edit.
- `/implement-task TASK-ID` admits one exact approved `In Planning` task; the
  owning Conversation publishes `In Progress` before Episode allocation.
- Later `Blocked`, resumed `In Progress`, `Ready for Merge`, and terminal `Done`
  transitions belong to the owning Conversation under the reviewed lifecycle.

There is no generic claim edit that may bypass planning or admission. Do not
mark a task `Done`, call `backlog task complete`, or archive it unless the exact
reviewed lifecycle and operator authority permit that action.

## What belongs in Backlog.md

Use Backlog.md for shared project tasks, blockers and dependencies, discovered
follow-up work, resumable status, and project work that must survive compaction
or handoff. Use agent-local planning only for the current turn's checklist.
Durable repository knowledge belongs in normal tracked documentation, not in a
tracker-specific memory command.

## Rules

- Do not edit files under `backlog/tasks/` or `backlog/completed/` directly.
- Do not create Markdown TODO files as a parallel source of truth.
- Prefer `--json` when parsing CLI output programmatically.
- Do not change or complete tasks unless the work and authority support it.
- Backlog.md does not own Git transport; follow repository instructions for
  commits, pulls, and pushes.
