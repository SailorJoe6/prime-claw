# H. Continue work across iterations

## US-22 — Hand off an ordinary Ralph implementation pass

**As an implementation agent, I want to update durable state, compact with a
deliberate focus, and queue the next execute pass, so that the next iteration
starts with useful context rather than an amnesiac handoff document.**

`/handoff` and `ralph_handoff(guidance?)` preflight the canonical handoff and
execute assets, admit handoff, and queue exactly one execute follow-up.
Compaction is requested once by the handoff workflow; scheduling it is not
reported as completion and compaction itself never triggers execute.

## US-23 — Continue one exact owned Episode

**As an owning Conversation, I want to advance an accepted Episode or send an
accepted in-scope revision, so that exactly one handoff and one subsequent
execute pass reach the correct idle Episode.**

The primary task-native continuation is
`handoff_task_episode(taskId, guidance?)`, described below. Retained version-1
compatibility uses `handoff_spec_episode(location, guidance?)`; it verifies the
strict location syntax and exact persisted source binding before bundle storage,
so the obsolete promoted future folder may be absent. The owner, readable active
root plan pair, Git/Orca worktree, durable session, active route, and idle queue
remain mandatory. That pair stays active through
blocked, candidate-review, and revision states. An older already-blocked pair
requires the separate operator-authorized exact version-1 restore and
live-identity revalidation before handoff. Missing files never switch modes. It
may refresh a stale route but never replays an uncertain transport.

`handoff_task_episode(taskId, guidance?)` exposes the
same continuation for strict version-2 ownership. It requires the canonical
primary `main` checkout, exact owner/task/path, an exact main task path matching
committed `HEAD` while unrelated main dirt remains allowed, `In Progress` on
main and in the Episode, meaningful plans, a clean owned worktree, exact
durable-session CWD, and a quiescent queue. It binds both handoff and execute prompts to the same
`<operator-episode-task>` value. Before a blocked continuation, the internal
Conversation lifecycle seam verifies an exact committed and pushed Episode
report head with Episode-owned task evidence, commits main `In Progress →
Blocked`, and later commits `Blocked → In Progress` after the unblock is
accepted. Both status commits touch only the exact main task path; prompt push is
best effort. The ordinary handoff then revalidates the committed resumed state
and routes the same ownership, worktree, and session without admission or
resource creation. Main `Ready for Merge` rejects ordinary handoff. The `finalize_task_episode` final-review action instead requires the same idle durable Episode,
integrates current main in its existing worktree, preserves Episode-owned task
content and parent identity while applying only the main-owned status, commits
and pushes the exact two-parent refreshed candidate, and requires Conversation
verification before any operator merge request. Delay preserves this exact
review state and performs no transport. After explicit Request Changes, the
Conversation publishes exact-task-only `In Progress`, the same idle Episode
integrates it into a newly pushed and verified two-parent candidate, and only
then ordinary handoff resumes that same ownership, branch, worktree, and durable
session. A returned status publication can survive a retryable integration
failure; no second lifecycle commit, admission, resource, or assignment is
created. Explicit Merge is a separate guarded terminal action, not continuation:
it binds the operator decision to the exact verified task/main/candidate,
fast-forwards clean canonical main only to that pushed candidate, immediately
commits only the exact task as `Done`, and verifies ancestry, code, task content,
path, parent, and status. Exact pre-merge, candidate, candidate-plus-sole-dirty
`Done` task, and one-task `Done` child states are retryable without duplicate
merge or lifecycle mutation; every other intermediate state fails closed. The
Ready publication commit must remain in verified main history. Local `Done`
remains authoritative if push or remote verification fails.
It preserves ownership and every idle Episode resource. The public task-native lifecycle is coordinated only through `finalize_task_episode`; ordinary continuation remains `handoff_task_episode`.

Confirmed abandonment never routes through handoff. Its guarded abandonment action
first rejects an archive destination already tracked at the bound main head,
then selects only the exact pushed Episode task blob, restores the captured main
status, adds the abandonment Final Summary, proves no code entered main, and
archives without `Done`. Exact task-preparation, archival-move/stage, and direct
archival-child states are retryable without repeating archive mutation. It
retains ownership and resources pending separate cleanup authority.

Cleanup also never routes through handoff. Its separate explicit authority must
bind the exact terminal outcome and every recorded Episode resource. The
guarded task-native coordinator verifies pushed terminal work, removes the exact idle
runtime/worktree/branch in monotonic order, preserves active ownership through
an interrupted exact-prefix retry, and marks ownership inactive only after all
resources are absent. It creates no continuation, assignment, or replacement
resource and is available only through separately confirmed `finalize_task_episode` cleanup.

These paths are not used for consultation, pause, destructive cleanup, another
Episode, or scope expansion.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/handoff-chain.ts`
- `src/prime-agent-plugin/extension-support/workflow-chain.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
- `src/prime-agent-plugin/workflows/handoff.md`

## Design reference

- [`handoff-chain.md`](../handoff-chain.md)
