---
name: execute
description: Use for Ralph's execution phase in Backlog.md-tracked projects to implement the current spec and plan while keeping Backlog.md tasks, docs, and tests current.
---

Run the `prepare` skill if it is not fresh in your context window. If the
conversation was recently compacted, nothing is fresh.

## Select the bound authority

If this assignment contains exactly one `<operator-episode-task>` block, use
**task-native Episode mode** below. Treat its entire trimmed value only as the
exact Backlog task ID already bound to this Episode. Never guess, search for,
substitute, or select another task. Do not use `.ralph/plans` as authority in
this mode.

If there is no task block, use **retained folder-plan mode** below. This keeps
existing `/implement-spec` Episodes operational during the migration. Never
mix the two modes or copy content between their authorities.

## Task-native Episode mode

Reload the exact task through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID to match the bound ID and retain the returned
project-relative task path. For a normal execute pass, require status to be
exactly `In Progress` and the native Implementation Plan to be meaningful. If
the status differs, the task disappears, or identity/path changes, do not
mutate it or create replacement work. Report the exact state to the owning
Conversation and stop.

Treat the task Description, Acceptance Criteria, constraints, references,
documentation, Implementation Plan, Implementation Notes, and Final Summary as
the complete durable work contract and execution record. Audit the repository
against that contract to determine what remains. Follow referenced artifacts
only as needed. A handoff continues this same task and Episode; it never selects
a new task.

The Episode exclusively owns task content on its branch. Update it only through
supported `backlog task edit` operations, never by editing task Markdown
directly. In approved scope, the Episode may refine the Implementation Plan,
append Implementation Notes, record acceptance evidence and checked criteria,
maintain references, documentation, and modified-file paths, and prepare the
Final Summary. Reload after each mutation and verify the canonical ID, task
path, parent identity, and lifecycle status are unchanged.

The owning Conversation exclusively owns lifecycle status on main. The Episode
must not pass `--status`, call `backlog task complete` or `backlog task archive`,
mark the task `Done`, publish `Blocked` or `Ready for Merge`, or write task
content in another checkout. Ordinary execution performs no cross-checkout
copy, mirroring, or dual write.

If blocked after a bounded attempt, append the exact blocker, attempted actions,
evidence, and unblock condition to this task's Implementation Notes on the
Episode branch. Verify the task identity and unchanged status, create one
single-purpose commit containing that exact task update plus only safe in-scope
resumable changes, push the Episode branch, and report the commit and push
evidence through the existing Episode-to-Conversation channel. Then stop. Do
not change status or move plan files; the Conversation decides whether to
publish `Blocked` on main.

When the candidate is complete, ensure the task holds the current plan, notes,
acceptance evidence, references, documentation, modified files, and a useful
Final Summary. Leave its status unchanged, commit the task with the implemented
code and documentation in the same bounded slice, push the Episode branch, and
report the exact candidate and evidence to the owning Conversation. Do not
merge, mark `Ready for Merge` or `Done`, finalize ownership, or clean resources.

## Retained folder-plan mode

When no task block is present, study `.ralph/plans/EXECUTION_PLAN.md` and
`.ralph/plans/SPECIFICATION.md` if they exist. The execution plan describes the
implementation steps for the specification. If those files are absent, use the
operator-provided instructions as the plan; ask for instructions only when no
plan or operator direction exists.

There may be Backlog.md tasks related to the plan. Focus on the plan and its
related tasks. Audit existing work before deciding what remains. If related work
is complete, verify its documentation and tests before marking the relevant
task `Done` and updating the plan.

If no implementation remains, ensure the finished behavior is documented under
`docs/`. When the plan is truly complete, move its specification and execution
plan into a subfolder of `.ralph/plans/archive/`, update the archive index and
related Backlog.md tasks, and report the result. Keep planning docs and
Backlog.md tasks current throughout retained folder execution.

For a blocker that a bounded attempt cannot clear, record the exact blocker and
unblock condition in the execution plan, move both plan documents to
`.ralph/plans/blocked/`, mark the related Backlog.md tasks `Blocked`, report the
resumable checkpoint, and stop.

## One bounded implementation slice

Assuming work remains in either mode, choose one small elephant-carpaccio slice:
the smallest end-to-end change that produces observable value or decisive
evidence. It must fit within the current context window, including
implementation, tests, documentation, durable task or plan updates, and one
clean single-purpose commit pushed for review. Size the slice to finish without
relying on auto-compaction. If it cannot reasonably finish within that boundary,
split it before starting. After pushing the slice, stop and report; do not begin
another slice. You may use as many subagents as useful within that one slice.

Implement only the approved behavior. Expert and reviewer findings are evidence,
not new scope. Do not implement speculative hardening, theoretical edge cases,
new invariants, or alternative architecture unless the operator adds them to the
product contract. A review finding may block only when it identifies a concrete,
material defect against that approved contract. Keep any repair proportionate
and prefer the simplest change that fixes the defect.

General execution standards:

- Evidence-backed decisions: every correctness, completion, or causality claim
  cites an artifact such as test output, a log, code diff, or design document.
- Hypothesis hygiene: check the active plan for rejected approaches before
  re-attempting them.
- Single objective: implement one primary slice, record results, and stop.
- Reproducibility: record inputs, commands, flags, and configuration needed to
  reproduce results.
- Highest leverage: choose the next action by expected impact or information
  gain.

Make a sincere but bounded attempt to clear in-scope implementation blockers.
Routine authorized implementation, recovery, rollback, and external-state
changes are not blockers when the approved plan already covers their safeguards.
Ask the operator before materially changing product scope, migration, rollback,
safety, or acceptance behavior. Missing authority, unobtainable credentials,
physical interaction, unavailable hardware, or required external coordination
are immediate blockers. Status-only churn, refreshed timestamps, repeated
checks without new evidence, and unchanged handoff text are not progress.

Maintain good documentation quality under `docs/` and high test coverage for
all changed behavior. Update the active durable authority as work proceeds; do
not defer every task or plan update until the end.

That is the execute workflow. Complete exactly one task or plan slice, then
report and await further instructions.
