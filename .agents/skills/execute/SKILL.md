---
name: execute
description: Use for Ralph's execution phase in Backlog.md-tracked projects to implement the current spec and plan while keeping Backlog.md tasks, docs, and tests current.
---

Run the `prepare` skill if it is not fresh in your context window. If the
conversation was recently compacted, nothing is fresh.

## Select the bound authority

A managed Episode prompt normally carries `<operator-episode-owner-session>`.
Its exact value is the owning Conversation's registry key and intentionally
differs from the Episode's own session ID. Inspect `.prime-claw/ownership.json`
from the canonical primary checkout before interpreting task/source tags. When
the file is a Conversation-keyed registry, require the tag and select only that
exact `ownerSessionId` entry. If the tag or exact registry binding is missing,
stop for recovery; never scan all owners or infer the key from task/source
placement.

One live-upgrade bootstrap exception applies only when the canonical file is the
pre-upgrade direct record, not registry form. With no owner tag, its embedded
`ownerSessionId` is self-identifying only after its non-inactive status, exact
recorded current worktree, durable Episode ID, readable matching Episode session
file, and exact prompt task/source binding all match this Episode. If a tag is
present, it must match the embedded owner. Any failed or ambiguous check stops
for recovery. The direct record remains valid migration input; this exception
never applies to a registry and never authorizes scanning or choosing among
owners.

Require the selected record's worktree and Episode session identity to match the
current Episode. Other Conversations' entries never select or block this
Episode, though repository-wide task/source collision checks inspect all
non-inactive entries. In a linked Episode worktree, locate the canonical checkout
through Git worktree metadata; a missing worktree-local file does not mean the
tagged owner's entry is absent.

A valid version-1 ownership record selects **retained folder-plan mode**. A live
version-1 Episode requires that record plus readable, non-empty active
`SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files in its recorded Episode
worktree; also accept the retained `EXECUTION_PLAN.md` spelling used by this
project. If those active files are missing, stop for exact ownership recovery
instead of switching modes. A valid version-2 ownership record selects
**task-native Episode mode** and binds its exact task ID. Select its provider
only from that exact record. A provider-absent record or `provider: "backlog"`
must retain its exact `taskPath`; it must not carry Beads revision or task
evidence. A `provider: "beads"` record must have no `taskPath` and must retain
its exact non-empty `providerRevision`, complete raw `taskEvidence`, `baseRef`,
worktree, branch, and Episode session identity. Any mixed or missing binding
stops for ownership recovery. If an `<operator-episode-task>` block is also
present, require its entire trimmed value to match the persisted version-2 task
ID. A prompt tag never overrides persisted ownership.

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

Use the provider selected from the exact version-2 owner. Do not redetect,
replace, or infer it from repository files. Do not use `.ralph/plans` as
authority in this mode. A provider-absent record or `provider: "backlog"`
continues through the Backlog branch below. Only `provider: "beads"` selects
the Beads branch. Never mix commands, content, commits, or evidence between the
two branches.

### Provider-absent or Backlog task authority

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

### Beads task authority

Use the exact task ID, raw task evidence, provider revision, code `baseRef`,
worktree, branch, and Episode session identity selected above. Run every Beads
command from the exact recorded current linked worktree. Do not use Backlog,
edit task Markdown, copy a task store, redirect Beads, or write the ownership
registry.

Before interpreting or changing the task, perform one native synchronization
and read cycle. Run the configured native pull and exact raw task read:

```sh
bd dolt pull
bd show TASK-ID --json --long --include-comments
```

Require one raw task whose exact canonical ID equals the bound task ID, whose
native status is exactly `in_progress` and maps to canonical `In Progress`, and
whose raw `design` is meaningful rather than blank or placeholder text. Also
require native evidence for the exact current Dolt database, branch, revision,
publication ref, and a clean working set. If synchronization or any identity,
status, design, revision, ref, worktree, or session proof fails, do not mutate
anything. Report the exact provider evidence to the owning Conversation and
stop.

Treat the complete raw Beads view as the durable work contract: description,
design, acceptance criteria, notes, comments, labels, dependencies, and every
other provider field all retain their provider-native names, shapes, values,
and absence. Do not translate them into a normalized task model. Compare the
persisted raw `taskEvidence` with the synchronized raw view field for field.
A provider revision advance or unrelated-task change alone does not block this
Episode. For every outside change to the same task, present the exact raw before
and current values and reason about their meaning. A compatible change that is
inside the approved scope may become the new working basis. A genuine semantic
conflict, scope expansion, or authority change must be escalated without a
write. Do not use a deterministic semantic classifier and never silently
overwrite either view.

The Episode may change only owner-authored task content through supported
`bd update TASK-ID` content fields: description, design, acceptance criteria,
and notes. It must not change status, title, type, priority, assignee, parent,
dependencies, labels, comments, metadata, task identity, or lifecycle fields.
Immediately before any write, synchronize once more, reread the complete raw
task, and repeat the same-task comparison. Apply at most the intended in-scope
content update without `--status`, `--force`, raw Dolt SQL writes, or retry.
Immediately after the write, reread the complete raw task and native revision,
branch, ref, and working-set state. Require the exact intended owner-authored
field changes, only the exact provider-generated revision/timestamp changes
caused by that write, every other raw task field unchanged, and a clean working
set.

Publish the verified native task update exactly once and without force:

```sh
bd dolt push --no-adopt
```

After publication, perform one native post-publication pull/read cycle and
capture the exact raw task plus revision/ref evidence again. Require the remote
publication to contain the intended published revision, the published task to
equal the verified post-write view, and the local working set to remain clean.
An unrelated-task descendant may advance the final revision; report both exact
revisions and require the same target-task view. Route any outside same-task
change through the reconciliation rule above. A rejected or uncertain
synchronization, update, or push is evidence, not permission to pull again,
retry, reset, force, adopt, or overwrite. Preserve and report the exact raw
state instead.

On a candidate or blocker, keep the Beads design/notes and Episode code evidence
current through the same guarded native flow. Commit and push only the approved
Episode code-branch changes when appropriate. Report the exact persisted task
view, synchronized pre-write view, post-write view, final published view,
published provider revision/ref, code `HEAD`, and command failures to the owning
Conversation so it can later advance the existing ownership receipt. The
Episode never mutates that receipt directly and never publishes lifecycle
status. The Conversation alone decides status, merge, abandonment,
finalization, and cleanup.

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
