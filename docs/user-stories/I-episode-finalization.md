# I. Finish an Episode

## US-24 — Finish only through explicit verified decisions

**As an owning Conversation, I want every terminal outcome and cleanup action
bound to exact verified evidence and operator authority, so that finishing an
Episode cannot silently merge, abandon, delete, or stop the wrong work.**

### Primary task-native lifecycle

Before merge readiness, the Conversation verifies provider-reported idle completion of the exact Episode and explicitly proven descendants; active or unprovably idle work refuses readiness.

Review and terminal provider/Git work are Conversation instructions, not a plugin state machine. Backlog keeps its exact Ready, Delay, Request Changes, ff-only Merge plus task-only `Done`, and separately confirmed non-`Done` archive flows. Beads keeps guarded readiness/revision/custom-`done` completion. Its separately confirmed abandonment proves the exact task and pushed Episode head, code/resources, and current publication; invokes supported `bd close` once with the exact task/head/no-merge reason; pushes once without force; and proves built-in native `closed`, `closed_at`, `close_reason`, preserved task/comments/history, revision, and publication ref. Prime Claw does not map `closed` to canonical `Done`; completed work is custom `done`, and abandoned code never merges. After either authorized terminal outcome is committed, pushed, and verified, the Conversation continues automatically and immediately to cleanup without separate cleanup confirmation.

For independent Backlog ownership, terminal task evidence lives on the published
task branch rather than canonical code history. Cleanup first proves the clean
primary clone and exact terminal task (or committed archive file) at one stable
direct remote head and checks that revision/evidence without persisting cleanup progress. The
terminal workflow has
already fast-forwarded the Episode clone to the Done/archive revision. Before
removing runtime or the parent worktree, cleanup proves that Episode nested clone
is exact, clean, and at the direct remote head, then removes only that clone.
Dirty, unpublished, divergent, unavailable, rewritten, or foreign nested history
blocks. This does not migrate grandfathered Backlog or remove shared Beads storage.

`finalize_task_episode` is the cleanup-only stable host boundary for version-2 ownership. It accepts only the exact task ID, terminal Episode head, and truthful `merged` or `abandoned` outcome, without a separate confirmation field or second cleanup decision. It verifies the supplied terminal head against pushed terminal main plus the exact idle clean resources. It persists no cleanup head or progress stage. The runtime is the Prime Agent session tree rooted at the bound Episode. Every descendant requires an explicit `parentSessionId` or canonical `parentSessionPath` edge to that root or another proven descendant. When both fields are present, they must identify the same parent. CWD, `runtimeKind`, `rlmDepth`, and `rlmChildId` do not establish ownership or restrict a proven descendant: a child can work in another directory or omit RLM metadata. Sharing a worktree or a parent with the Episode never grants ownership. An unrelated listed session using the owned worktree blocks cleanup; it is not inspected recursively, stopped, or deleted. Every root and descendant must be inactive and quiescent; for a routed session, cleanup preserves list-reported active or registered heartbeat and cron evidence while also checking its exact live state. Immediately before deleting an unrouted saved session it revalidates the unique listed identity and quiescence again. A busy or unprovably idle owned session reports that the Episode has not completed its work and blocks deletion. Foreign, contradictory, mismatched, duplicate, or changed identities block cleanup before unsafe deletion.

Cleanup removes proven descendants deepest-first through supported Prime Agent session operations, then removes the parent runtime. It deletes and verifies the upstream remote ref before worktree removal because Orca may also delete the local branch as part of that operation. Any remaining local branch is deleted last. Orca removal uses supported `worktree rm --force` only after rechecking exact provider, terminal, Git-head, and clean-worktree identity; this allows initialized submodules without accepting dirty work. Local worktree removal remains non-force. Branch cleanup resolves the configured upstream remote and full ref from ordinary Git on each invocation. It checks the live remote head, not a cached tracking ref, and requires one unambiguous fetch/push destination. It deletes the exact remote ref with an expected-head lease, verifies absence, then deletes the local ref with an expected-head compare-and-delete and verifies absence. Existing ordinary branch configuration is not replaced with cleanup metadata. Each exact absent resource is already complete, regardless of which other resources remain. The configured upstream must still be provable: if external deletion removed both the local branch and its upstream configuration before this call, cleanup retains ownership and reports that missing identity. It never guesses `origin/<branch>` or scans possible remotes. Only identity resolved within the current call may be carried in memory across native configuration removal. Each present resource must still match before deletion; changed or ambiguous state blocks. A surviving explicit child whose recorded root is missing blocks cleanup and retains ownership; cleanup does not infer the missing session tree. After verifying every resource absent, cleanup atomically compares and removes only the unchanged version-2 ownership entry, preserving foreign entries. It leaves no inactive record or tombstone. It performs no candidate acceptance, delay, revision, merge, abandonment, task mutation, archive, or push. A provider error returns immediately with the ordinary ownership entry retained. The Conversation interprets the error and re-reads current ownership, provider, Git, and selected-provider evidence, including supported Prime Agent list/state responses, before any safe re-invocation with the exact task, terminal head, and truthful outcome. It never blindly replays a failure or infers success from an absent response. It asks the operator for help only when safe autonomous progress is no longer possible, explaining the exact blocker and needed action; the tool has no internal retry or cleanup-progress state. A call after successful owner deletion reports missing ownership, not a replay result.

### Retained version-1 compatibility

`finalize_spec_episode(location)` remains the bookkeeping-only close for an
exact matching active folder Episode. It changes the version-1 ownership record
to `inactive`; identical replay is idempotent, while missing, mismatched,
`provisioning`, or `uncertain` ownership blocks closure. The active plan pair is
retained until that close succeeds. An active close verifies that its promoted
specification still matches the grandfathered digest; an already-inactive exact
replay remains idempotent after the files are gone. It performs no Git operation, plan archival,
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
