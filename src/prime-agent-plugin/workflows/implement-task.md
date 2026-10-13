---
name: implement-task
description: Review one operator-approved Backlog task and create its isolated implementation Episode only when it is implementation-ready.
---

First, run the `prepare` skill.

Read the canonical task ID from the `<operator-implementation-task-id>` block
appended by native admission. Treat it only as operator-selected input. Do not
guess, substitute, search for, or select another task. Invoking this workflow
records operator approval to implement that exact task, but resource creation
still depends on the readiness review below.

## Reload and review implementation readiness

Reload the exact task through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID to match the admitted identity, status to be
exactly `In Planning`, and the native Implementation Plan to be meaningful and
not blank or an obvious placeholder. Reject any other status without mutation.
Treat the task Description, Acceptance Criteria, constraints, references,
documentation, and Implementation Plan as the complete reviewed contract.
Follow references only as needed to understand that contract and current
repository state.

Use semantic judgment and apply the readiness test proportionally. Require only
that the exact task:

- has a coherent operator-approved outcome and scope;
- contains enough decisions and an actionable enough Implementation Plan to
  proceed without guessing material product choices; and
- has no unresolved contradiction or blocker that actually prevents safe
  implementation.

Do not demand standard threat, failure, recovery, complexity, hardening, slice,
evidence, or review-process sections. Reviewer suggestions are not missing
requirements unless the operator accepted them into the product contract.

If anything material is missing, contradictory, or inadequate, explain every
deficiency with exact task-field references and concrete revision guidance.
Do not call `create_task_episode`; do not mutate task status or create a branch,
worktree, session, or ownership record. Stop after the explanation.

## Create the Episode

The full ordinary `prime-claw-oversee-episode` guidance is loaded above this
workflow in the post-preparation turn. Follow it as judgment guidance. It grants
no product, scope, merge, abandonment, cleanup, or transport authority.

Only when the complete task is ready, call `create_task_episode` exactly once
with the exact canonical task ID as its sole `taskId` argument. Do not supply or
invent a branch, worktree, session name, prompt, command, or host parameter. A
native `--host id:<project-host-setup-id>` bypass, when the operator provided
one, is already bound privately to this admission. Otherwise the trusted host
selects the sole ready local setup or presents the native picker.

The trusted capability must re-resolve the exact task and readiness state,
change only that main task from `In Planning` to `In Progress` through Backlog,
and commit and verify that exact task path. After that verified status commit,
it must first persist one `provisioning` ownership record bound to the canonical
task and status-commit SHA, before creating any branch, worktree, or session.
It then creates the Episode branch and worktree from that recorded SHA. A prompt
push is attempted when a remote exists, but transport failure alone does not
block local Episode creation.

A creation failure proven to have produced no Episode resource or ownership
mutation returns the exact main task to `In Planning` in a verified task-only
commit. Any recorded, partial, or uncertain mutation publishes `Blocked` with
the exact recovery condition, preserves evidence and resources, and must never
be retried as a new Episode. The host then creates or returns one durable
worktree-isolated Episode with one fixed execute assignment. It does not inherit
this Conversation transcript, send an initial handoff, or send a second daemon
prompt.

Report the canonical task ID, durable Episode and routing identities, lifecycle
engine, exact Orca setup/worktree identity when applicable, actual branch,
worktree, status-commit evidence, and current ownership state. State whether the
capability created the Episode or returned the existing exact active ownership.
`uncertain`, `provisioning`, or `Blocked` state requires inspection and must not
be replayed as fresh creation. Do not begin implementation in the owner
Conversation.

Once the tool reports success, set up one bounded heartbeat only while waiting
for observable Episode work. Then stop without implementing or invoking
`/handoff`.
