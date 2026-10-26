# I. Finish an Episode

## US-24 — Finish only through explicit verified decisions

**As an owning Conversation, I want every terminal outcome and cleanup action
bound to exact verified evidence and operator authority, so that finishing an
Episode cannot silently merge, abandon, delete, or stop the wrong work.**

### Primary task-native lifecycle

Review and terminal provider/Git work are Conversation instructions, not a plugin state machine. Backlog keeps its exact Ready, Delay, Request Changes, ff-only Merge plus task-only `Done`, and separately confirmed non-`Done` archive flows. Beads keeps guarded readiness/revision/custom-`done` completion. Its separately confirmed abandonment proves the exact task and pushed Episode head, code/resources, and current publication; invokes supported `bd close` once with the exact task/head/no-merge reason; pushes once without force; and proves built-in native `closed`, `closed_at`, `close_reason`, preserved task/comments/history, revision, and publication ref. Prime Claw does not map `closed` to canonical `Done`; completed work is custom `done`, and abandoned code never merges. Ownership/resources remain active after either outcome.

`finalize_task_episode(taskId, episodeHead, outcome, confirmed)` remains cleanup-only. Backlog terminal verification is unchanged. Beads pairs current clean publication proof around the complete raw task and accepts only custom `done` with the Episode head in main for `merged`, or built-in `closed` with the exact abandonment reason and code absent from main for `abandoned`. It proves code/provider ancestry and direct-remote heads, durably binds `cleanupHead` plus current factual Beads revision/raw task/code head, removes only the exact idle runtime, linked worktree, and local branch, verifies absence, and marks ownership inactive last. Shared Beads store/server/history and unrelated owners survive. The tool performs no terminal mutation, merge, abandonment, archive, provider push, or server shutdown. Same-head partial cleanup and inactive replay are idempotent; unbound missing resources and unsafe evidence fail closed.

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
