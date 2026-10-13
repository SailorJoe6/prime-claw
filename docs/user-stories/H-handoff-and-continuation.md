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

The retained `handoff_spec_episode(location, guidance?)` verifies the owner,
future-folder location, Git/Orca worktree, durable session, active route, and
idle queue. It may refresh a stale route but never replays an uncertain
transport.

An internal, unregistered `handoffTaskEpisode(taskId, guidance)` now stages the
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
resource creation. Main `Ready for Merge` rejects ordinary handoff. The
inactive final-review seam instead requires the same idle durable Episode,
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
created. No public task-native lifecycle or handoff surface is registered.

Neither path is used for consultation, pause, merge, abandonment, cleanup,
another Episode, or scope expansion.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/handoff-chain.ts`
- `src/prime-agent-plugin/extension-support/workflow-chain.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
- `src/prime-agent-plugin/workflows/handoff.md`

## Design reference

- [`handoff-chain.md`](../handoff-chain.md)
