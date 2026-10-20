---
id: PRIMECLAW-10.40
title: Remove untraceable Episode cleanup machinery
status: In Design
assignee: []
created_date: '2026-10-20 04:32'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.38
documentation:
  - docs/user-stories/I-episode-finalization.md
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 127000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome

Remove the custom task-Episode cleanup protocol that was not directly required by the operator. Cleanup must perform the smallest supported provider-native deletion after explicit operator approval, delete only the exact completed Episode, and preserve every unrelated Episode.

## Required behavior

- Bind cleanup to this Conversation's exact active ownership record and the operator-confirmed task.
- Before deletion, require the task's truthful terminal outcome and an exact clean pushed Episode candidate that is merged for a merged outcome or excluded for an abandoned outcome.
- Use the owning provider's supported worktree-removal operation. For Orca, use its supported force option after the exact target is proven clean so initialized submodules do not block deletion.
- Remove the exact target worktree and local branch, then close only its ownership record.
- Leave unrelated ownership records, sessions, worktrees, and branches unchanged.
- Complete the currently partial PRIMECLAW-10.38 cleanup whose session is already absent and whose exact clean worktree and branch remain at `0106fe790f3c2b00617f32245930e41e9006f8bd`.

## Remove

Delete the unrequired `cleanupHead`, custom staged runtime/worktree/branch state machine, descendant session-tree ownership algorithm, cleanup replay protocol, immediate post-step settlement checks, and cleanup heartbeat/reconciliation behavior. Prime Agent and Orca own their ordinary session and worktree lifecycle. Do not replace the removed machinery with another coordinator, receipt, registry, retry engine, or background monitor.

## Traceability rule

Every retained or new cleanup behavior must cite one of the required behaviors above. If it cannot, remove it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After explicit cleanup approval, one exact clean and terminal task Episode is removed through supported provider-native operations; initialized submodules do not block an Orca cleanup.
- [ ] #2 Cleanup selects only the current Conversation owner and exact task/worktree identity, refuses a dirty, nonterminal, unpushed, unmerged-for-merge, or mismatched target, and leaves unrelated Episode resources unchanged.
- [ ] #3 The exact target worktree and local branch are absent and only its ownership record is closed after provider-native removal succeeds.
- [ ] #4 `cleanupHead`, the custom multi-stage cleanup state machine, descendant session-tree deletion/validation, cleanup replay/settlement logic, and cleanup heartbeats are removed rather than replaced.
- [ ] #5 Focused tests prove the direct success path and the minimum refusal cases without receipts, registries, staged recovery, or background coordination.
- [ ] #6 Living finalization documentation states the direct requirement-to-behavior mapping and no longer describes the deleted protocol.
<!-- AC:END -->
