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

`handoff_task_episode(taskId, guidance?)` exposes the same continuation for strict version-2 ownership. It requires the canonical primary `main` checkout, exact owner/task/path, an exact committed main task path, `In Progress` on main and in the Episode, meaningful plans, a clean owned worktree, exact durable-session CWD, and a quiescent queue. It binds both handoff and execute prompts to the same `<operator-episode-task>` value and reuses the existing resources.

Blocked and resumed status are Conversation-owned prompt steps. After accepting a pushed blocker report, the Conversation uses the supported Backlog CLI on canonical main to publish `Blocked`, verifies and commits only the exact task path, and pushes. After the operator accepts the unblock condition, it publishes `In Progress` the same way and then calls ordinary task handoff. No custom block/resume action or progress receipt is required.

Candidate review and terminal outcomes do not route through handoff. After candidate acceptance, the Conversation publishes only the bound main task as `Ready for Merge`, commits and pushes that path, uses ordinary Git in the idle Episode to integrate that `mainHead` while preserving Episode-owned task content and applying the authorized status, pushes the refreshed candidate, and shows the operator `(taskId, mainHead, candidateHead)`. Delay changes nothing. Request Changes publishes only the bound main task back to `In Progress`, commits and pushes that path, integrates current main into the same Episode with ordinary Git as needed while preserving its task content and applying the authorized status, then resumes through ordinary handoff. Merge requires a fresh preflight of the displayed tuple and explicit operator authority, followed by canonical-main `git merge --ff-only`, supported Backlog `Done`, an exact task-only commit, and push. Abandonment requires separate explicit confirmation, an exact task-only selection from the pushed Episode, supported Backlog Final Summary/archive operations, an exact move commit, and push. Git and Backlog report intermediate or unsafe state directly; there is no receipt/progress/replay protocol.

Cleanup never routes through handoff. After the terminal Git/Backlog state is pushed and a separate operator Cleanup decision is explicit, the cleanup-only `finalize_task_episode` boundary durably binds the exact terminal Episode head, removes the exact idle runtime/worktree/branch, verifies absence, and marks ownership inactive. It performs no lifecycle or Git outcome itself.

These paths are not used for consultation, pause, destructive cleanup, another
Episode, or scope expansion.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/handoff-chain.ts`
- `src/prime-agent-plugin/extension-support/workflow-chain.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
- `src/prime-agent-plugin/workflows/handoff.md`

## Design reference

- [`handoff-chain.md`](../handoff-chain.md)
