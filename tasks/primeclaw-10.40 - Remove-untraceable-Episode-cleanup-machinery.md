---
id: PRIMECLAW-10.40
title: Make task-native Episode cleanup complete and owner-safe
status: In Design
assignee: []
created_date: '2026-10-20 04:32'
updated_date: '2026-10-20 14:55'
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

Keep `finalize_task_episode` as the version-2 task-native cleanup boundary, but make it complete, owner-safe, and direct. After an operator-authorized merge or abandonment is committed and pushed and the owning Conversation verifies the terminal result, cleanup continues automatically without a second cleanup confirmation.

Cleanup removes all and only the resources created for that exact owned Episode. It must not alter another Conversation, another Episode, or any unrelated session or Git resource.

## Exact owned resources

The cleanup boundary contains:

- the exact Prime Agent Episode session recorded when the owning Conversation created it;
- every recursive child session connected to that Episode by a clear Prime Agent parent-child chain, where each edge is explicit through either `parentSessionId` or the canonical parent session-file path;
- the exact provider-managed worktree;
- the exact local Episode branch and its exact upstream remote branch; and
- that Conversation's exact ownership-registry entry.

A shared worktree is not session ownership. Do not search for, infer, or delete possible sibling sessions. Sessions outside the explicit descendant tree are out of scope.

## Required behavior

- Merge readiness must establish that the Episode and its proven descendants have completed their work and are idle. Cleanup rechecks this. If any owned session is active, cleanup performs no destructive mutation and reports that the Episode has not completed its work.
- Verify the truthful terminal merge or abandonment state, the exact terminal Episode head, and a clean exact worktree before deleting resources.
- Remove the explicit owned session tree through supported Prime Agent operations.
- Remove the worktree through the owning provider's supported operation. For Orca, use its supported force option after the exact worktree is proven clean so initialized submodules do not block cleanup.
- Delete both the exact local branch and its exact upstream remote branch only while they still identify the terminal Episode head.
- Delete the exact ownership entry only after every owned runtime and Git resource is absent. Do not retain an inactive record or tombstone.
- If cleanup is interrupted or a provider operation fails, re-read the ordinary ownership record and actual Prime Agent, provider, and Git state, then keep making safe progress. Already absent exact resources count as cleaned. Retry recoverable operations and ask the operator for help only when safe autonomous progress is no longer possible.
- Do not persist `cleanupHead`, a cleanup stage, or another cleanup-progress marker. Do not replace them with a receipt, registry, replay engine, coordinator, or background reconciliation protocol.

## Scope and non-goals

This task changes only version-2 task-native cleanup. It does not change version-1 `finalize_spec_episode` behavior. Unifying the duplicated legacy `*spec*` and task-native `*task*` command surfaces is separate future work. Prime Agent remains an upstream dependency.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After an operator-authorized merge or abandonment is committed and pushed and its terminal result is verified, task-native Episode cleanup runs without requiring a second cleanup confirmation.
- [ ] #2 Before destructive cleanup, the exact root Episode and every explicitly related descendant are idle. Any active owned session causes zero destructive mutation and a clear report that the Episode has not completed its work.
- [ ] #3 Cleanup recursively selects only sessions connected to the exact Episode by explicit Prime Agent parent ID or canonical parent session-file path edges; shared-worktree sessions, possible siblings, and unrelated sessions are never selected.
- [ ] #4 Cleanup removes the exact owned session tree, provider worktree, local branch, exact upstream remote branch, and ownership entry. Initialized submodules do not block removal of a proven-clean Orca worktree, and unrelated ownership records and resources remain unchanged.
- [ ] #5 Terminal outcome, exact terminal head, clean worktree, branch identity, and remote identity are verified before deletion; dirty, changed, ambiguous, foreign, or mismatched evidence blocks unsafe mutation.
- [ ] #6 After partial or transient failure, cleanup re-reads ordinary ownership plus actual Prime Agent, provider, and Git state and continues safe remaining work. It stores no `cleanupHead`, cleanup stage, tombstone, receipt, or background reconciliation state and asks for help only when safe autonomous progress is impossible.
- [ ] #7 Focused tests and living finalization documentation prove the direct version-2 behavior while version-1 `finalize_spec_episode` remains unchanged; command-surface unification remains out of scope.
<!-- AC:END -->
