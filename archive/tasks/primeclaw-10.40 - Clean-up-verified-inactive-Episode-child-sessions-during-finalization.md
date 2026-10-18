---
id: PRIMECLAW-10.40
title: Clean up verified inactive Episode child sessions during finalization
status: In Design
assignee: []
created_date: '2026-10-18 21:14'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.38
  - src/prime-agent-plugin/extension-support/task-episode-cleanup.ts
documentation:
  - docs/user-stories/I-episode-finalization.md
parent_task_id: PRIMECLAW-10
priority: p1
type: bug
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome

`finalize_task_episode` can safely finish exact task-native Episode cleanup when the Episode previously spawned RLM child sessions. Descendant sessions that the Prime Agent daemon proves are both owned by the exact Episode and inactive are part of that Episode runtime: cleanup removes them through supported Prime Agent session surfaces before removing the bound parent runtime, worktree, branch, and ownership entry.

Foreign, ambiguous, changed, or busy session identity must continue to fail closed. The repair must preserve every unrelated Conversation ownership entry and its runtime resources.

## Observed defect

On 2026-10-18, cleanup of merged and `Done` task `PRIMECLAW-10.38` failed safely with `Task Episode cleanup found a foreign or duplicate Prime Agent session identity`. The terminal Episode itself was inactive, clean, pushed, and exact. Six inactive direct RLM child sessions remained registered with the same Episode worktree and an exact `parentSessionPath` pointing to the bound Episode session file. The cleanup validator treated any additional session sharing the worktree as foreign, so it could not reap an Episode that had legitimately used subagents.

The failed attempt removed nothing. The `PRIMECLAW-10.38` ownership record, worktree, branch, and the two independent UAT Episodes remain intact.

## Required behavior

Cleanup must distinguish a daemon-proven descendant chain rooted in the exact bound Episode session from an unrelated session that merely collides on session ID, session file, route, or worktree. Every owned descendant must be inactive and quiescent before cleanup mutates anything. Cleanup removes verified descendants as part of the Episode runtime, then continues the existing exact parent-runtime, worktree, branch, absence-verification, and ownership-close sequence.

If any possible descendant is active, busy, malformed, ambiguous, changed, or cannot be proven to belong to the exact Episode, cleanup stops before unsafe deletion and reports the blocker. If a supported session deletion fails after cleanup has begun, the same terminal-head retry remains resumable and must never broaden to unrelated sessions or resources.

## Non-goals

- Do not weaken foreign-session, duplicate-identity, dirty-worktree, changed-head, unpushed-head, or owner checks.
- Do not add a manual filesystem or daemon-state deletion workaround.
- Do not alter merge, abandonment, task status, Episode admission, handoff, or Conversation-scoped ownership semantics.
- Do not disturb the active `PRIMECLAW-43` or `PRIMECLAW-10.39` Episodes while repairing or validating cleanup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An exact terminal task-native Episode with only daemon-proven inactive and quiescent descendant RLM sessions can complete `finalize_task_episode`; cleanup removes those descendants, the bound parent runtime, worktree, branch, and only that Conversation’s ownership entry.
- [ ] #2 Descendant ownership is established by an unambiguous parent chain rooted in the exact bound Episode session identity; sharing a worktree or another bound field alone never grants ownership.
- [ ] #3 Cleanup performs no deletion when any candidate descendant is active, busy, queued, streaming, compacting, running tools or children, malformed, ambiguously related, or otherwise not provably idle and owned.
- [ ] #4 Foreign sessions and duplicate or colliding route, session ID, session-file, or worktree identities continue to block cleanup with actionable evidence.
- [ ] #5 Verified descendant sessions are removed through supported Prime Agent session operations before the parent runtime or worktree is removed; no manual session-file or daemon-state deletion is introduced.
- [ ] #6 A failure after one or more owned descendant deletions preserves the ownership record and remaining resources, and an exact same-terminal-head retry safely resumes without touching unrelated sessions.
- [ ] #7 Cleanup of one Conversation preserves all other ownership-registry entries, sessions, worktrees, branches, and active Episodes; regression coverage includes the concurrent multi-owner registry shape proven by `PRIMECLAW-10.38` UAT.
- [ ] #8 Automated tests cover the observed parent-plus-six-inactive-direct-children shape, nested owned descendants, a busy descendant, a foreign same-worktree session, ambiguous identity, partial deletion and retry, and successful exact absence verification.
- [ ] #9 Living finalization documentation explains that exact inactive descendant sessions are removed with the Episode runtime and that any unproven or active descendant blocks cleanup.
<!-- AC:END -->
