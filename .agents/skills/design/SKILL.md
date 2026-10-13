---
name: design
description: Use for Ralph's discovery-first specification phase to create or revise one reviewable Backlog task.
---

First, run the `prepare` skill.

The operator wants to propose new work in this project. Discuss it without
starting implementation. Ask requirements questions one at a time so the
operator is not overwhelmed. Keep the discovery-first behavior until you can
describe the work as a clear, detailed specification.

## Bind one exact Backlog task

If the operator explicitly selected an existing task, use only that exact task
ID. Do not search for, infer, or substitute another task. If the request might
mean either create new work or revise existing work but no exact ID is given,
ask the operator before mutation. Reload a selected task through the supported
structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID to match the selected task and its current
status to be exactly `In Design`. If the task is missing, malformed, ambiguous,
or in `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, or `Done`,
explain the exact problem and stop without mutation. Later states already have
planning or execution history that this authoring phase may not invalidate.

If the operator did not select an existing task, create exactly one new task
only after the specification is ready to save. Choose a concise title and pass
`--status "In Design"` explicitly; do not rely on the project's temporary
default status. Use the supported `backlog task create --plain` interface and
bind the exact created task ID from its output. Treat this as one mutation
attempt: if the exit result, output, returned identity, or post-create reload is
uncertain, do not issue another create. Stop, preserve the evidence, and report
the exact recovery need; retry only after proving that no task was created.
Never create a folder under `.ralph/plans`.

## Write the native specification

Use supported Backlog fields as the durable product contract:

- Description: the current system or context, intended outcome, scope, required
  behavior, material constraints, and important non-goals;
- Acceptance Criteria: one or more observable outcomes, kept proportional to
  the work and stored as native criteria in source order;
- References: related task IDs or source artifacts that materially inform the
  work; and
- Documentation: relevant living project documentation.

Use `backlog task create` with `--description`, repeated `--ac`, and optional
repeated `--ref` and `--doc` arguments for a new task. Use one supported
`backlog task edit` operation for an existing task, with `--description` and
repeated `--acceptance-criteria`; preserve existing references and
documentation unless the reviewed specification intentionally changes them. If
either list changes, pass its complete desired value from the reloaded task plus
the approved revisions so unrelated entries are not dropped. Keep real newlines
in Markdown arguments. Do not edit task Markdown directly, change the task out
of `In Design`, or write an
Implementation Plan, Implementation Notes, or Final Summary.

Make the specification clear enough to plan without guessing material product
decisions. Be thorough but avoid repetition. Include safety, failure handling,
recovery, or non-goals only when they are materially relevant. Do not require
boilerplate sections, invent risks, or prescribe implementation architecture. If a material
product decision remains unresolved, ask the operator rather than silently
deciding it or turning a reviewer suggestion into a requirement.

## Verify and preserve the task

Before mutation, record Git status and require the selected existing task path
and Git index to be clean. After creation or revision, reload the exact task
through `backlog task view --json -- TASK-ID` and verify its canonical ID,
`In Design` status, meaningful Description, native Acceptance Criteria, and
returned regular task path. Verify no path other than that exact returned task
path was newly changed and do not stage unrelated pre-existing changes.

Commit only the returned task path and verify the commit contains no other path.
Attempt a prompt push when a remote is available. A push failure is transport
evidence to report, not permission to undo the valid local specification,
create another task, or begin planning.

## Keep the specification alive

The selected Backlog task is the living source of truth. Update its supported
specification fields promptly whenever discussion, review, or manual POC work
produces a durable clarification, correction, constraint, or learning. Do not
defer updates until the end of a long conversation or rely on chat history,
memory, or a later compaction summary. Replace stale content instead of
accumulating a chronological journal.

## Stop for operator review

After the verified task-only commit:

- report the canonical task ID and exact task path;
- link the task so the operator can review its specification now;
- report local commit and push evidence separately;
- explicitly ask the operator to review the saved specification; and
- stop without planning, writing an Implementation Plan, creating a branch or
  worktree, creating ownership state, or starting an Episode.

Apply requested specification revisions to the same `In Design` task, using the
same exact-task and task-only commit rules, and link it again. Do not advance to
planning unless the operator later invokes the separate `/plan TASK-ID`
workflow. Specification approval authorizes planning only; it never authorizes
implementation.
