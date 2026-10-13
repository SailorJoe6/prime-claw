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

The ownership store now accepts either retained version-1 folder identity or
strict version-2 task identity, never a mixture. An internal reservation seam
re-resolves and verifies that the exact task is `In Progress`, still has a meaningful plan, is
clean after a HEAD commit containing only its canonical Backlog path, and then
persists version-2 `provisioning` ownership before any resource identity exists.
A non-terminal record blocks replay. Conversation compaction can retain either
identity, while folder commands reject a task-native record rather than treating
it as a folder Episode.

This remains an inactive foundation: `/implement-task` and
`create_task_episode` are not registered, the task-native allocator does not
exist yet, and current Episode creation continues through the retained folder
workflow above.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/reviewed-plan.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
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
