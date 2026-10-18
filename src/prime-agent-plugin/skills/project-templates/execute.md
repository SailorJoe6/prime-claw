---
name: execute
description: Use for Ralph's execution phase in Backlog.md-tracked projects to implement the current spec and plan while keeping Backlog.md tasks, docs, and tests current.
---

Run the `prepare` skill if it is not fresh in your context window. If the
conversation was recently compacted, nothing is fresh.

## Select the bound authority

A managed Episode prompt carries `<operator-episode-owner-session>`. Its exact
value is the owning Conversation's registry key and intentionally differs from
the Episode's own session ID. Inspect `.prime-claw/ownership.json` from the
canonical primary checkout and select only that exact `ownerSessionId` entry
before interpreting task/source tags. Require its recorded worktree and Episode
session identity to match the current Episode. If a claimed live Episode lacks
this owner tag or exact binding, stop for recovery; never scan all owners or infer
the key from task/source placement. The file is a Conversation-keyed registry;
an existing direct record is valid migration input. Other Conversations' entries
never select or block this Episode, though repository-wide task/source collision
checks inspect all non-inactive entries. In a linked Episode worktree, locate the
canonical checkout through Git worktree metadata; a missing worktree-local file
does not mean the tagged owner's entry is absent.

A valid version-1 ownership record selects **retained folder-plan mode**. A live
version-1 Episode requires that record plus readable, non-empty active
`SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files in its recorded Episode
worktree; also accept the retained `EXECUTION_PLAN.md` spelling used by this
project. If those active files are missing, stop for exact ownership recovery
instead of switching modes. A valid version-2 ownership record selects
**task-native Episode mode** and binds its exact task ID and path. If an
`<operator-episode-task>` block is also present, require its entire trimmed
value to match the persisted version-2 task ID. A prompt tag never overrides
persisted ownership.

With no ownership, active legacy `SPECIFICATION.md` and
`IMPLEMENTATION_PLAN.md` files on canonical main select valid old in-place
folder work; the retained `EXECUTION_PLAN.md` spelling is equivalent. This
fallback is not a live Episode. Only when neither ownership nor old in-place
files decides may `<operator-episode-task>` become a candidate task binding.
The tag alone does not establish live Episode identity or grant Episode mutation
or lifecycle authority; stop for exact version-2 ownership recovery before a
task-native execute pass. Otherwise use retained folder-plan mode only for clear
operator-provided legacy instructions. Never guess, search for, or substitute
another task, mix the two modes, or copy content between their authorities.

## Task-native Episode mode

Use the exact task ID and path selected above. Do not use `.ralph/plans` as
authority in this mode. Reload the exact task through the supported structured
interface:

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

Use the active `.ralph/plans/SPECIFICATION.md` with its retained
`.ralph/plans/EXECUTION_PLAN.md` or `.ralph/plans/IMPLEMENTATION_PLAN.md`. The
plan describes the implementation steps for the specification. A persisted
version-1 record with a missing active pair must stop and use only
`restore_blocked_spec_episode` after the operator's explicit unblock decision;
execute cannot use chat instructions or any fallback before successful
live-identity revalidation. Only when no persisted ownership exists may clear
operator-provided legacy instructions serve as the plan; ask only when no plan
or direction exists.

There may be Backlog.md tasks related to the plan. They are references, not
lifecycle authority for this compatibility workflow. Audit existing work before
deciding what remains, and keep the active legacy plan current. Never change a
Backlog task's status, mark it `Done` or `Blocked`, complete or archive it,
finalize task-native ownership, or clean task-native resources from retained
folder-plan mode.

For persisted active version-1 ownership, keep both active plan files in
`.ralph/plans/` while work is blocked and throughout candidate review or
revision. If no implementation remains, ensure the finished behavior is
documented under `docs/`, leave the active pair in place, and report the
candidate for Conversation review. Do not archive or move either file until the
operator's terminal decision has been carried out and the exact ownership
record is inactive. For a blocker that a bounded attempt cannot clear, record
the exact blocker and unblock condition in the active execution plan, leave the
pair active, report the resumable checkpoint, and stop without a Backlog
lifecycle mutation.

With no ownership, preserve the old in-place folder workflow. It may archive
its finished specification and execution plan under `.ralph/plans/archive/`
and update that legacy archive index, or move only its blocked plan pair to
`.ralph/plans/blocked/`. Those legacy file transitions do not create Episode
identity or claim Backlog status, completion, archival, finalization, or cleanup
authority.

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
