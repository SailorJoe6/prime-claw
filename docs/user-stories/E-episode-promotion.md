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

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/reviewed-plan.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
- `src/prime-agent-plugin/extension-support/episode-ownership.ts`
- `src/prime-agent-plugin/workflows/implement-prep.md`
- `src/prime-agent-plugin/workflows/implement-spec.md`

## Design references

- [`future-specification-bundles.md`](../future-specification-bundles.md)
- [`conversation-driven-episode-oversight.md`](../conversation-driven-episode-oversight.md)
- [`prep-chain.md`](../prep-chain.md)
