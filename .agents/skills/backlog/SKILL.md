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

1. Find unblocked work that has not already started:

```bash
backlog task list --status "To Do" --ready --plain
```

Use `--json` instead of `--plain` when structured output is needed. The explicit
`To Do` filter is required because `--ready` alone can also include work already
`In Progress` or explicitly `Blocked`.

2. Inspect a task before changing it:

```bash
backlog task view <id> --plain
```

3. Claim work with the supported single edit operation:

```bash
backlog task edit <id> --status "In Progress" --assignee <name>
```

Backlog.md v1.53.0 has no separate claim command or automatic current-identity
shortcut.

4. Create durable follow-up work:

```bash
backlog task create "Short title" --description "Why this exists and what needs to be done" --type task --priority P2
```

5. Mark verified work done, then move it to completed storage when cleanup is
intended:

```bash
backlog task edit <id> --status "Done" --final-summary "Completed"
backlog task complete <id>
```

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
