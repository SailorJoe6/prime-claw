# I. Finish an Episode

## US-24 — Close lifecycle bookkeeping without implying cleanup

**As an owning Conversation, I want to mark an Episode inactive after the
operator's terminal decision has been carried out, so that oversight ends
without accidentally merging, abandoning, deleting, or stopping anything.**

`finalize_spec_episode(location)` changes the exact matching active ownership
record to `inactive`. An identical replay is idempotent. Missing, mismatched,
`provisioning`, or `uncertain` ownership blocks closure.

Finalization deliberately performs no:

- Git operation or merge;
- abandonment decision;
- session termination;
- worktree or branch removal;
- destructive cleanup.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/reviewed-plan.ts`
- `src/prime-agent-plugin/extension-support/episode-close.ts`
- `src/prime-agent-plugin/extension-support/episode-ownership.ts`

## Design references

- [`future-specification-bundles.md`](../future-specification-bundles.md)
- [`conversation-driven-episode-oversight.md`](../conversation-driven-episode-oversight.md)
