---
name: spec-it-out
description: Use when the conversation already contains most of a design and a reviewable future specification is needed.
---

Use the current conversation to specify the proposed work. Do not start
implementation. Ask only the remaining questions that need operator input, one
at a time. For small details that are already clear, use your best judgment.

## Create the future specification

When the specification is ready to save:

1. Derive a concise filesystem-safe slug from the work. Use lowercase ASCII
   letters, digits, and hyphens only.
2. Use `.ralph/plans/future/<slug>/` as the specification folder. It must be a
   new folder. If that path already exists, choose a different specific slug;
   never overwrite or merge into an existing specification.
3. Create `SPECIFICATION.md` inside that folder detailing the specification.
4. Do not write newly generated specification artifacts directly under
   `.ralph/plans/`.

Document the current system, the required change, and the intended end state in
`SPECIFICATION.md`. Be thorough but avoid repetition. Specify behavior and
important boundaries without inventing implementation architecture. This phase
specifies the work; it does not create an execution plan.

## Keep the specification alive

A specification under `.ralph/plans/future/` is a living source of truth, not a
point-in-time report. Update it promptly whenever discussion, review, or manual
POC work produces a durable clarification, correction, constraint, or learning.
Do not defer updates until the end of a long conversation or rely on chat
history, memory, or a later compaction summary to preserve them. Replace stale
text instead of accumulating a chronological journal.

## Stop for operator review

After saving the specification:

- report the exact project-relative future-folder path;
- link `SPECIFICATION.md` so the operator can review it now;
- explicitly ask the operator to review the saved specification; and
- stop without planning, implementing, creating a branch or worktree, or
  starting an episode.

Apply requested specification revisions to the same future folder and link the
updated specification again. Do not advance to planning unless the operator
later invokes the separate planning workflow.
