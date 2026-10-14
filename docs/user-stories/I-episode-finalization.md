# I. Finish an Episode

## US-24 — Finish only through explicit verified decisions

**As an owning Conversation, I want every terminal outcome and cleanup action
bound to exact verified evidence and operator authority, so that finishing an
Episode cannot silently merge, abandon, delete, or stop the wrong work.**

### Primary task-native lifecycle

`finalize_task_episode` is the guarded coordinator for version-2 ownership. Its
`accept-candidate` final-review action accepts only an exact pushed candidate,
publishes the task-only `Ready for Merge` transition, refreshes the same Episode
against current main, verifies the resulting exact handshake, and then waits for
the operator. Delay changes nothing.
Request Changes publishes `In Progress`, refreshes and verifies the same
Episode, and resumes it through canonical handoff. Merge and abandonment are
separate explicit operator outcomes with exact task, parent, commit, ancestry,
and content checks.

Cleanup is another separate explicit operator decision after verified merge or
abandonment. It removes only the bound idle session, retained Orca terminals,
worktree, and branch through supported interfaces. Exact completed prefixes are
retryable, but ownership remains active until every recorded resource is absent
and closes last. No review, delay, revision, merge, or abandonment action
implicitly performs cleanup.

### Retained version-1 compatibility

`finalize_spec_episode(location)` remains the bookkeeping-only close for an
exact matching active folder Episode. It changes the version-1 ownership record
to `inactive`; identical replay is idempotent, while missing, mismatched,
`provisioning`, or `uncertain` ownership blocks closure. The active plan pair is
retained until that close succeeds. It performs no Git operation, plan archival,
merge, abandonment, session termination, worktree or branch removal, or
destructive cleanup. Legacy archival requires separate explicit post-terminal
authority; this repair adds no archival tool, so the plans remain until a later
action is approved.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/reviewed-plan.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
- `src/prime-agent-plugin/extension-support/task-episode-cleanup.ts`
- `src/prime-agent-plugin/extension-support/episode-close.ts`
- `src/prime-agent-plugin/extension-support/episode-ownership.ts`

## Design references

- [`future-specification-bundles.md`](../future-specification-bundles.md)
- [`conversation-driven-episode-oversight.md`](../conversation-driven-episode-oversight.md)
