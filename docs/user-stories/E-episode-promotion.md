# E. Promote an approved bundle into an Episode

## US-13 — Perform a final implementation-readiness review

**As an operator, I want the exact specification-and-plan bundle checked
immediately before promotion, so that incomplete or contradictory work creates
no implementation resources.**

`/implement-spec .ralph/plans/future/<slug>` runs the implementation preparation
and readiness workflow. Approval is bound to the exact session, folder, optional
host, and complete bundle digest and is consumable once.

## US-14 — Create one isolated implementation Episode

**As an owning Conversation, I want an approved bundle promoted into one
isolated Episode, so that implementation occurs on an exact design basis outside
the canonical checkout.**

`create_spec_episode(location=...)` creates or returns the one matching Episode.
A fresh Episode receives:

- a feature worktree;
- the approved bundle promoted into active `.ralph/plans`;
- a promotion commit;
- a fresh durable Prime Agent session rooted at that worktree;
- a visible writable Orca Prime Agent tab bound to that durable session and
  retained after the temporary launcher is removed;
- exactly one fixed execute assignment;
- durable ownership by the originating Conversation.

It does not inherit the Conversation transcript and receives no initial
handoff.

## US-15 — Select Episode placement explicitly

**As an operator with multiple Orca setups, I want to choose the exact local
execution setup, so that the plugin never silently runs work somewhere else.**

A sole ready setup may be selected automatically. Multiple setups require a
native picker or an exact stable ID. Cancellation, ambiguity, or remote
selection creates nothing. An explicit host request never silently falls back.

## US-16 — Recover safely from ambiguous Episode creation

**As an operator, I want partially created resources preserved and identified,
so that retries cannot create duplicate worktrees, sessions, or assignments.**

The one project-level ownership record can be `provisioning`, `active`,
`uncertain`, or `inactive`. Failures after durable mutation preserve evidence as
`uncertain`; replay does not recreate or reassign those resources. Direct local
fallback exists only for definitive pre-mutation Orca unavailability with no
explicit host request.

## Task-native admission migration

Project reconciliation stages `implement-task-prep` and `implement-task` as
customizable internal policies for the future exact-task admission path. They
encode the `In Planning` structural and semantic readiness gates, the single
`create_task_episode` call boundary, the main-task `In Progress` status commit,
a durable provisioning reservation before branch/worktree/session creation,
clean rollback to `In Planning`, and uncertain/partial `Blocked` outcome.

An inactive deterministic admission helper now resolves placement before it
queues either compact-first workflow message. It accepts one exact ready local
Orca setup, selected automatically when sole, by stable ID, or by the native UI
picker. Zero ready setups, remote setup, noninteractive ambiguity, and picker
cancellation fail without task, Git, ownership, or resource mutation. Direct
local fallback exists only when the production Orca command is definitively
absent and never when an explicit setup was requested. Malformed JSON, a
negative inventory envelope, and other inventory failures propagate and fail
closed rather than selecting local execution.

Only after placement and both workflow messages succeed does the helper grant
one ephemeral approval bound to the owner session, canonical task ID/path and
project root, and exact placement. The prep-turn end exposes it to the semantic
turn; one exact consume removes it, while phase end, session start, or shutdown
clears it. The full ordinary oversight guide precedes `implement-task` semantic
readiness. No approval is durable or inferred from planning.

The ownership store now accepts either retained version-1 folder identity or
strict version-2 task identity, never a mixture. An internal reservation seam
re-resolves and verifies that the exact task is `In Progress`, still has a
meaningful plan, is clean after a HEAD commit containing only its canonical
Backlog path, and then persists version-2 `provisioning` ownership before any
resource identity exists.

An internal task-native allocator now consumes only that exact reservation. It
derives non-authoritative branch/worktree labels from the task ID, creates the
local or exact reserved Orca worktree from the bound status-commit SHA, skips
all bundle copy and promotion-commit behavior, binds one durable exact-CWD
session, and injects the exact task ID into one execute assignment. Active
replay validates the worktree plus durable session ID, file, and CWD, and may
reopen that same identity without replaying the assignment. Partial
`provisioning` or any failed allocation becomes `uncertain` and cannot replay
as fresh work.

An inactive trusted-admission transaction now joins those seams. Before task
lookup or mutation, it requires the caller to be at the repository root of the
primary Git worktree on `main`; a linked worktree or another branch is rejected
without changing task bytes, Git state, ownership, or allocator state. It then
accepts only a clean exact `In Planning` task with a meaningful plan and no
non-terminal project ownership. It changes that task to `In Progress` through
Backlog, commits only its canonical path, treats push failure as non-gating
transport evidence, reserves ownership against that exact commit, allocates, and verifies
the durable active identity plus unchanged main-task state. A proven clean
failure before ownership or resource mutation commits the exact task back to
`In Planning`. Any durable or uncertain mutation instead commits `Blocked` plus
the exact inspection/reconciliation condition and preserves all evidence.

This remains an inactive foundation: `/implement-task` and
`create_task_episode` are not registered, so neither the staged chain nor its
single-use approval can call the transaction yet. Current public Episode
creation continues through the retained folder workflow above.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/reviewed-plan.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts` (retained allocator plus inactive task-native admission transaction)
- `src/prime-agent-plugin/extension-support/episode-ownership.ts`
- `src/prime-agent-plugin/extension-support/task-episode-ownership.ts` (inactive reservation foundation)
- `src/prime-agent-plugin/workflows/implement-prep.md`
- `src/prime-agent-plugin/workflows/implement-spec.md`
- `src/prime-agent-plugin/workflows/implement-task-prep.md` (staged policy)
- `src/prime-agent-plugin/workflows/implement-task.md` (staged policy)

## Design references

- [`future-specification-bundles.md`](../future-specification-bundles.md)
- [`conversation-driven-episode-oversight.md`](../conversation-driven-episode-oversight.md)
- [`prep-chain.md`](../prep-chain.md)
