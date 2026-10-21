# I. Finish an Episode

## US-24 — Finish only through explicit verified decisions

**As an owning Conversation, I want every terminal outcome and cleanup action
bound to exact verified evidence and operator authority, so that finishing an
Episode cannot silently merge, abandon, delete, or stop the wrong work.**

### Primary task-native lifecycle

Review and terminal Git/Backlog work are Conversation instructions, not a plugin state machine. Before merge readiness, the Conversation verifies provider-reported idle completion of the exact Episode and explicitly proven descendants; active or unprovably idle work refuses readiness. The Conversation verifies one exact pushed candidate, publishes only the bound main task as `Ready for Merge`, commits and pushes that path, then uses ordinary Git in the idle Episode to integrate `mainHead` while preserving Episode-owned task content and applying the authorized status. After pushing and verifying the refreshed candidate, it shows the operator `(taskId, mainHead, candidateHead)`. Delay is a no-op. Request Changes returns only the bound main task to `In Progress`, commits and pushes that path, integrates current main into the same Episode with ordinary Git as needed while preserving its task content and applying the authorized status, then resumes by handoff. Merge requires explicit operator authority for the freshly verified displayed tuple, ordinary `git merge --ff-only candidateHead`, a supported Backlog update to `Done`, an exact task-only commit, and push. Abandonment requires separate explicit confirmation, exact task-only selection from the pushed Episode, a truthful Backlog Final Summary, supported task archive, an exact move commit, and push. After either operator-authorized terminal outcome is committed, pushed, and verified, the Conversation continues automatically and immediately to exact cleanup without separate cleanup confirmation.

`finalize_task_episode` is the cleanup-only stable host boundary for version-2 ownership. It accepts only the exact task ID, terminal Episode head, and truthful `merged` or `abandoned` outcome, without a separate confirmation field or second cleanup decision. It verifies the supplied terminal head against pushed terminal main plus the exact idle clean resources. It persists no cleanup head or progress stage. The runtime is the Prime Agent session tree rooted at the bound Episode. Every descendant requires an explicit `parentSessionId` or canonical `parentSessionPath` edge to that root or another proven descendant. When both fields are present, they must identify the same parent. CWD, `runtimeKind`, `rlmDepth`, and `rlmChildId` do not establish ownership or restrict a proven descendant: a child can work in another directory or omit RLM metadata. Sharing a worktree or a parent with the Episode never grants ownership. An unrelated listed session using the owned worktree blocks cleanup; it is not inspected recursively, stopped, or deleted. Every root and descendant must be inactive and quiescent; for a routed session, cleanup preserves list-reported active or registered heartbeat and cron evidence while also checking its exact live state. Immediately before deleting an unrouted saved session it revalidates the unique listed identity and quiescence again. A busy or unprovably idle owned session reports that the Episode has not completed its work and blocks deletion. Foreign, contradictory, mismatched, duplicate, or changed identities block cleanup before unsafe deletion.

Cleanup removes proven descendants deepest-first through supported Prime Agent session operations, then removes the parent runtime. It deletes and verifies the upstream remote ref before worktree removal because Orca may also delete the local branch as part of that operation. Any remaining local branch is deleted last. Orca removal uses supported `worktree rm --force` only after rechecking exact provider, terminal, Git-head, and clean-worktree identity; this allows initialized submodules without accepting dirty work. Local worktree removal remains non-force. Branch cleanup resolves the configured upstream remote and full ref from ordinary Git on each invocation. It checks the live remote head, not a cached tracking ref, and requires one unambiguous fetch/push destination. It deletes the exact remote ref with an expected-head lease, verifies absence, then deletes the local ref with an expected-head compare-and-delete and verifies absence. Existing ordinary branch configuration is not replaced with cleanup metadata. Each exact absent resource is already complete, regardless of which other resources remain. The configured upstream must still be provable: if external deletion removed both the local branch and its upstream configuration before this call, cleanup retains ownership and reports that missing identity. It never guesses `origin/<branch>` or scans possible remotes. Only identity resolved within the current call may be carried in memory across native configuration removal. Each present resource must still match before deletion; changed or ambiguous state blocks. A surviving explicit child whose recorded root is missing blocks cleanup and retains ownership; cleanup does not infer the missing session tree. After verifying every resource absent, cleanup atomically compares and removes only the unchanged version-2 ownership entry, preserving foreign entries. It leaves no inactive record or tombstone. It performs no candidate acceptance, delay, revision, merge, abandonment, task mutation, archive, or push. A provider error returns immediately with the ordinary ownership entry retained. The Conversation interprets the error and re-reads current ownership, provider, Git, and Backlog evidence, including supported Prime Agent list/state responses, before any safe re-invocation with the exact task, terminal head, and truthful outcome. It never blindly replays a failure or infers success from an absent response. It asks the operator for help only when safe autonomous progress is no longer possible, explaining the exact blocker and needed action; the tool has no internal retry or cleanup-progress state. A call after successful owner deletion reports missing ownership, not a replay result.

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
