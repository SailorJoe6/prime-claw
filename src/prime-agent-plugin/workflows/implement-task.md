---
name: implement-task
description: Review one exact operator-approved provider-native task and create its isolated implementation Episode only when it is implementation-ready.
---

First resolve the live provider as described below. For Backlog, run the
`prepare` skill normally. For Beads, perform `prepare`'s repository-orientation
reads but skip its Backlog-only queue inventory; that unrelated queue is not
task authority and must not mix providers before this readiness review.

Read the canonical task ID from the `<operator-implementation-task-id>` block
appended by native admission. Treat it only as the exact selected input, including
selection explicitly delegated within the operator's bounds. Do not guess,
substitute, search for, or select another task here. Read any optional
`<operator-implementation-host>` block as the exact stable `id:<setup-id>` to
preserve through the final create call; it is placement data, not authority.

Interpret implementation authority from the operator's actual instruction, not
from entry invocation or a stored or turn-scoped receipt. An explicit conditional
instruction such as “plan this task, then implement it when ready” may authorize
that sequence within approved scope; do not demand fresh approval solely because
planning finished. A planning-only request does not authorize implementation.
Preserve the exact task, approved scope, conditional authority, and optional
stable host through compaction. Clarify material ambiguity, missing authority,
or scope expansion instead of proceeding. Resource creation still depends on
the readiness review below. Implementation selection requires `In Planning`
(Beads native `in_planning`) after design and planning; dependency readiness
alone is insufficient and no separate phase-history receipt is required.

Read any `<operator-implementation-task-provider>` and
`<operator-implementation-task-project-root>` blocks as factual observations
from entry. Backlog may also carry `<operator-implementation-task-path>`;
Beads has no task path. Compare these observations and the exact task ID with
fresh native resolution below. Genuine provider, canonical identity, root, or
Backlog path drift blocks creation and must be reported for clarification; do
not silently rebind to another task or workspace. These observations are not
approval, revision/content locks, or invocation receipts. Compatible same-task
content refinements remain facts for semantic readiness review, not an automatic
reapproval gate. Do not require an earlier entry or manufacture missing receipt
evidence when current native resolution and operator authority are sufficient.

## Reload and review implementation readiness

Resolve the live provider directly from its native project evidence. Do not use
a provider-selection file, infer the provider from the task ID, or mix provider
commands or evidence. Reload the exact task through that provider:

- **Backlog:** when the selected store is an independent nested clone, first
  fetch the exact task ref and fast-forward only a clean clone to the stable
direct published head; dirty, local-ahead, divergent, unavailable, or foreign
history blocks. Then run `backlog task view --json -- TASK-ID`. Require the returned
  canonical ID to match the admitted identity, status exactly `In Planning`,
  and the exact returned task path. Require the native Implementation Plan to
  be meaningful and not blank or an obvious placeholder. Treat Description,
  Acceptance Criteria, constraints, references, documentation, and
  Implementation Plan as the complete reviewed contract.
- **Beads:** from the exact detected project root run `bd context --json` and
  `bd show TASK-ID --json --long --include-comments`. Require the returned
  canonical ID to equal the entire admitted ID, native status exactly
  `in_planning` mapped to canonical `In Planning`, and the raw `design` field to
  be meaningful and not blank or an obvious placeholder. Treat the complete raw
  native view—including description, design, acceptance criteria, notes,
  comments, labels, dependencies, and every other present or absent field—as
  the reviewed contract. Keep its provider-native names and shapes. Do not
  invent a task path or translate it into a normalized task model.

Reject any other status without mutation. Reject any other provider, identity,
or root without mutation. Follow
references only as needed to understand the exact contract and current
repository state.

Use semantic judgment and apply the readiness test proportionally. Require only
that the exact task:

- has a coherent operator-approved outcome and scope;
- contains enough decisions and an actionable enough native Implementation Plan
  or Beads design to proceed without guessing material product choices; and
- has no unresolved contradiction or blocker that actually prevents safe
  implementation.

Do not demand standard threat, failure, recovery, complexity, hardening, slice,
evidence, or review-process sections. Reviewer suggestions are not missing
requirements unless the operator accepted them into the product contract.

If anything material is missing, contradictory, or inadequate, explain every
deficiency with exact provider-native task-field references and concrete
revision guidance. Do not call `create_task_episode`; do not mutate task status
or create a branch, worktree, session, or ownership record. Stop after the
explanation.

## Create the Episode

The full ordinary `prime-claw-oversee-episode` guidance is loaded above this
workflow in the post-preparation turn. Follow it as judgment guidance. It grants
no product, scope, merge, abandonment, cleanup, or transport authority.

Only when the complete task is ready and operator authority applies, call
`create_task_episode` exactly once with the exact canonical `taskId` and optional
stable `host` from `<operator-implementation-host>`. Pass that host unchanged as
`id:<setup-id>`; omit it when absent. Do not supply or invent a provider, branch,
task path, project root, worktree, session name, prompt, command, or other
resource identity.

The trusted capability independently re-resolves the live provider, exact task
identity, provider-native status and plan/design evidence, exact project root,
and placement before mutation. It requires no prior entry invocation, approval
store, or turn receipt. Any invalid identity, root, native/canonical status, or
placement rejects before creation. An explicit stable host must still be a
ready local setup and never silently falls back. Without a host, native
placement selection chooses the sole ready local setup or presents its picker;
ambiguity, cancellation, remote placement, or invalid inventory blocks. Direct
local fallback is allowed only when Orca is definitively unavailable and no
explicit host was requested. Ownership and resource-safety checks still prevent
duplicate creation; never retry an uncertain dispatch as fresh work.

### Backlog admission transaction

For Backlog, the trusted capability changes only the exact task from `In
Planning` to `In Progress` through Backlog. Grandfathered branch-local mode
commits and verifies that exact task path on canonical main and creates the
Episode from that recorded status-commit SHA. Independent mode first proves the
clean pushed canonical code `baseRef`, publishes the exact task-path-only status
commit on `refs/heads/prime-claw/tasks` without force, proves the direct task
head and complete native reread, and leaves the code HEAD unchanged. Before any
branch, worktree, or session, both modes persist one `provisioning` ownership
record under this Conversation's exact registry key; independent mode also binds
its published provider revision and complete task evidence. The Episode branch
and worktree are then created from the recorded code base. Grandfathered prompt
push is best-effort when a remote exists; independent task publication must be
proved before resource creation.

A creation failure proven to have produced no Episode resource or ownership
mutation returns the exact task to `In Planning` through the same selected
Backlog authority and verifies its task-only publication. Any recorded, partial,
or uncertain mutation publishes `Blocked` through that same authority with the
exact recovery condition, preserves evidence and resources, and must never be
retried as a new Episode.

### Beads admission transaction

For Beads, the trusted capability first proves the exact clean canonical code
HEAD that will become `baseRef`. It changes only the exact native task from
`in_planning`/`In Planning` to `in_progress`/`In Progress` through the supported
provider mutation and publishes once through the configured non-force Dolt
transport. It verifies the exact raw published task, provider revision,
publication ref, and unchanged code HEAD. Before any branch, worktree, or
session creation, it persists one `provisioning` ownership record under this
Conversation's exact registry key bound to provider `beads`, the canonical task
ID, published provider revision, complete raw task evidence, exact code
`baseRef`, and preselected placement. No task path exists or may be invented.
The Episode branch and worktree are created from that exact code base.

A creation failure proven to precede durable ownership or resource mutation
publishes one exact native rollback to `in_planning`/`In Planning` and verifies
it. A failure after durable or uncertain mutation publishes `blocked`/`Blocked`
through the same native non-force path, preserves the ownership, task evidence,
provider revision, code base, and resources, and reports the exact recovery
condition. It must never retry, force, adopt, reset, use raw Dolt writes, or
start a fresh Episode.

Both provider paths create or return one durable worktree-isolated Episode with
one fixed execute assignment. They do not inherit this Conversation transcript,
send an initial handoff, or send a second daemon prompt.

Report the selected provider, canonical task ID, project root, durable Episode
and routing identities, lifecycle engine, exact Orca setup/worktree identity
when applicable, actual branch and worktree, and current ownership state. For
Backlog include the exact status commit and task path. For Beads include the raw
pre/post/published task views, published provider revision and ref, exact code
`baseRef`, and recovery evidence when present. State whether the capability
created the Episode or returned existing exact active ownership. `uncertain`,
`provisioning`, or `Blocked` state requires inspection and must not be replayed
as fresh creation. Do not begin implementation in the owner Conversation.

Once the tool reports success, set up one bounded heartbeat only while waiting
for observable Episode work. Then stop without implementing or invoking
ordinary `ralph_handoff` or sending another assignment.
