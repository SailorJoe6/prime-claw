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

`handoff_task_episode(taskId, guidance?)` exposes the same continuation for strict version-2 ownership. It selects the exact requesting owner before provider/task interpretation and keeps the public signature unchanged. The provider-absent/Backlog branch still requires canonical primary `main`, exact owner/task/path, a committed main task path, `In Progress` on main and in the Episode, meaningful plans, a clean owned worktree, exact durable-session CWD, and a quiescent queue.

The direct Beads branch instead requires that same canonical Conversation and exact active provider-specific owner, operation, base, worktree/branch, Episode/session, and optional Orca resources. It preflights idle/quiescent transport, performs one supported native pull, proves clean published state, reads the exact current raw task, pairs the read with a second stable publication proof, and proves the current Episode code head clean and pushed. Exact previous/current raw views and revisions reach both canonical prompts, and the first handoff message's admission callback records the current provider/task/code facts without treating the prior `taskEvidence` observation as an approval snapshot, so the existing Episode LLM incorporates compatible owner-authored or outside same-task changes and escalates genuine semantic, authority, or scope conflicts. Unrelated published descendants remain nonblocking. A valid continuation rechecks quiescence and binds one canonical handoff plus the sole execute follow-up to the same task and resources. Guidance is bounded focus only; it cannot supply revision/raw authority.

Blocked and resumed status are Conversation-owned prompt steps. Backlog preserves its supported exact task-path status edit, verification, commit, and push. Beads binds the exact persisted provider/task/owner/worktree/session with no task path and uses current synchronized native status rather than stale observed status. After accepting a pushed blocker report, one guarded status-plus-note update may move only `in_progress` to `blocked`, truthfully record the blocker and unblock condition, and publish once without force with exact raw revision/ref/clean proof. Only after the operator or accepted evidence clears that actual condition may one fresh guarded update return current `blocked` to `in_progress`, append clearance evidence, and publish once before ordinary task handoff. The same Episode/resources continue; its handoff callback advances factual current provider/task/code observations. Later states, foreign ownership, and uncertain operations stop without retry. No custom block/resume action, public parameter, progress receipt, alternate state machine, or replacement work is required.

Candidate review and terminal outcomes do not route through handoff. Provider-absent/Backlog retains exact task-only Ready/Request Changes/Done commits and ordinary same-Episode integration. For Beads, accepted readiness first proves pushed canonical `mainHead` and descendant pushed `candidateHead`, then makes one guarded `in_progress`→`ready_for_merge` native publication with exact raw/revision/ref/content proof. Delay changes nothing. Request Changes makes one guarded `ready_for_merge`→`in_progress` publication with truthful finding evidence before ordinary same-Episode handoff. Merge requires a fresh exact `(taskId, mainHead, candidateHead)` Git/provider preflight and explicit operator authority; ordinary canonical-main `git merge --ff-only` and normal code push are directly proved before one guarded Beads `ready_for_merge`→`done` publication with truthful tuple/code outcome evidence. Abandonment remains separately explicit. Beads uses built-in native `closed` plus the exact task/head/no-merge reason and one proved non-force publication, distinct from completed custom `done`; abandoned code never merges. No branch adds a receipt, snapshot, provider-revision approval lock, custom publisher, progress object, or replay protocol.

Cleanup never routes through handoff. After a pushed terminal outcome and separate Cleanup decision, `finalize_task_episode` verifies Backlog Done/archive or current published Beads `done`/exact-reason `closed`, code/provider ancestry, direct remotes, and exact idle resources. It durably binds the head/current facts, removes only runtime/worktree/local branch, verifies absence, and marks ownership inactive last; shared Beads state survives. It performs no lifecycle or Git/provider outcome itself.

These paths are not used for consultation, pause, destructive cleanup, another
Episode, or scope expansion.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/handoff-chain.ts`
- `src/prime-agent-plugin/extension-support/workflow-chain.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
- `src/prime-agent-plugin/workflows/handoff.md`

## Design reference

- [`handoff-chain.md`](../handoff-chain.md)
