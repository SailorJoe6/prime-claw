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
primary `main` checkout, exact owner/task/path, `In Progress` on main and in the
Episode, meaningful plans, a clean owned worktree, exact durable-session CWD,
and a quiescent queue. It binds both handoff and execute prompts to the same
`<operator-episode-task>` value. `Blocked` must first be resumed by the
Conversation; `Ready for Merge` is reserved for the later constrained final
integration handshake. No public task-native handoff surface is registered.

Neither path is used for consultation, pause, merge, abandonment, cleanup,
another Episode, or scope expansion.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/handoff-chain.ts`
- `src/prime-agent-plugin/extension-support/workflow-chain.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
- `src/prime-agent-plugin/workflows/handoff.md`

## Design reference

- [`handoff-chain.md`](../handoff-chain.md)
