# H. Continue work across iterations

## US-22 — Hand off an ordinary Ralph implementation pass

**As an implementation agent, I want to update durable state, compact with a
deliberate focus, and queue the next execute pass, so that the next iteration
starts with useful context rather than an amnesiac handoff document.**

The thin global `handoff` skill invokes `ralph_handoff(guidance?)` for an explicit
ordinary Ralph handoff request. Optional guidance is operator-supplied; clarify a
materially inferred objective. The tool preflights canonical project handoff and
execute assets, admits handoff through `steer`, and queues exactly one execute
follow-up. The calling turn ends after admission. Compaction is requested once;
admission and scheduling are not completion. Compaction itself never triggers
execute. Failed or uncertain transport is not automatically retried. No custom
`/handoff` registration is needed; native `/skill:handoff` and built-ins remain.
Owned Episode continuation uses the separate lifecycle tools below.

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
live-identity revalidation before handoff. Its blocked specification must match
the same grandfathered digest before either file moves; recovery remains
provider-independent and works when the original future source is absent. Missing files never switch modes. It
may refresh a stale route but never replays an uncertain transport.

`handoff_task_episode(taskId, guidance?)` keeps exact owner/task/resource/session
targeting and native delivery. Editable Markdown decides lifecycle eligibility,
meaningful plan/design, code publication, idle completion and compatible changes.
No duplicate literal-main/role-depth/code-dirt/upstream/ancestry/old-design gate
selects continuation. Both canonical prompts receive current native task and
code facts plus session list/state observations; native first-message refusal
is truthful and never retried.

Grandfathered Backlog carries both complete current task views. Independent
Backlog prepares only the Episode clone and retains prior/current native facts,
without primary synchronization or paired equality. Beads preserves complete
raw shape/absence, local revision and actual pull/transport/warning/working-set
qualifications, not fabricated exact-task publication proof. Its post-admission
callback updates only existing observations, never second resources/assignment.
Unrelated bytes/index/history remain intact. See [handoff mechanics](../handoff-chain.md)
and the editable handoff/execute/oversight policy for current rules and native
publication procedures. Retained folder behavior remains separate and unchanged.

Blocked and resumed status are Conversation-owned prompt steps. Backlog preserves its supported exact task-path status edit, verification, commit, and push. Beads binds the exact persisted provider/task/owner/worktree/session with no task path and uses current synchronized native status rather than stale observed status. After accepting a pushed blocker report, one guarded status-plus-note update may move only `in_progress` to `blocked`, truthfully record the blocker and unblock condition, and publish once without force with exact raw revision/ref/clean proof. Only after the operator or accepted evidence clears that actual condition may one fresh guarded update return current `blocked` to `in_progress`, append clearance evidence, and publish once before ordinary task handoff. The same Episode/resources continue; its handoff callback advances factual current provider/task/code observations. Later states, foreign ownership, and uncertain operations stop without retry. No custom block/resume action, public parameter, progress receipt, alternate state machine, or replacement work is required.

Candidate review and terminal outcomes do not route through handoff. Grandfathered branch-local Backlog retains exact task-only Ready/Request Changes/Done commits and ordinary same-Episode integration. For Beads, accepted readiness first proves pushed canonical `mainHead` and descendant pushed `candidateHead`, then makes one guarded `in_progress`→`ready_for_merge` native publication with exact raw/revision/ref/content proof. Delay changes nothing. Request Changes makes one guarded `ready_for_merge`→`in_progress` publication with truthful finding evidence before ordinary same-Episode handoff. Merge requires a fresh exact `(taskId, mainHead, candidateHead)` Git/provider preflight and explicit operator authority; ordinary canonical-main `git merge --ff-only` and normal code push are directly proved before one guarded Beads `ready_for_merge`→`done` publication with truthful tuple/code outcome evidence. Abandonment remains separately explicit. Beads uses built-in native `closed` plus the exact task/head/no-merge reason and one proved non-force publication, distinct from completed custom `done`; abandoned code never merges. No branch adds a receipt, snapshot, provider-revision approval lock, custom publisher, progress object, or replay protocol.

Cleanup never routes through handoff. Before merge readiness, the Conversation verifies provider-reported idle completion of the exact Episode and explicitly proven descendants; active or unprovably idle work refuses readiness. Immediately after the already operator-authorized terminal Git/provider outcome is committed, pushed, and verified, the Conversation automatically calls cleanup without separate cleanup confirmation; the cleanup-only `finalize_task_episode` boundary verifies the exact terminal Episode head, published native terminal task evidence, code/provider ancestry and direct remotes, removes the exact idle runtime/worktree/branch, treats already absent resources as complete, and atomically removes only the unchanged owner after verified absence. Independent Backlog first proves and removes only its exact clean fully published Episode nested clone; shared provider state survives. It stores no cleanup-progress state or inactive version-2 record. It performs no lifecycle or Git outcome itself. The Conversation interprets errors and re-reads current ownership, provider, Git, and selected-provider evidence before any safe re-invocation with the exact task, terminal Episode head, and truthful outcome. No retry loop or coordinator drives cleanup.

These paths are not used for consultation, pause, destructive cleanup, another
Episode, or scope expansion.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/handoff-chain.ts`
- `src/prime-agent-plugin/skills/handoff/SKILL.md`
- `src/prime-agent-plugin/extension-support/workflow-chain.ts`
- `src/prime-agent-plugin/extension-support/spec-episode.ts`
- `src/prime-agent-plugin/workflows/handoff.md`

## Design reference

- [`handoff-chain.md`](../handoff-chain.md)
