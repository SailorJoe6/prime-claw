---
id: PRIMECLAW-10.41
title: Handle Orca nonzero after successful Episode worktree removal
status: In Progress
assignee: []
created_date: '2026-10-27 12:48'
updated_date: '2026-10-27 14:37'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.40
documentation:
  - docs/user-stories/I-episode-finalization.md
  - docs/conversation-driven-episode-oversight.md
parent_task_id: PRIMECLAW-10
priority: p1
type: bug
ordinal: 128000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome

Keep task-native Episode cleanup simple and complete when Orca successfully removes the exact verified worktree but returns a nonzero result during a post-removal inspection of the now-absent path.

The authoritative result of a destructive provider step is the freshly observed exact resource state. If the exact owned Orca worktree is absent after the removal command, that step is complete even when Orca returned nonzero. Cleanup must continue in the same invocation using the upstream identity it already resolved, remove any remaining exact local branch, verify absence, and delete only the unchanged owner entry.

## Reproduction and context

During the merged `PRIMECLAW-10.40` UAT cleanup, the exact session tree and upstream branch were removed, then `orca worktree rm --force` removed the worktree, local branch, and branch configuration. Orca returned nonzero because it subsequently ran `git -C <deleted-worktree> rev-parse HEAD`. Cleanup treated the command result as failure even though the exact worktree was absent. A fresh retry correctly refused to infer the erased upstream identity, leaving ownership stranded and requiring manual exact-identity recovery.

## Required behavior

- Preserve all existing pre-removal gates: exact owner and task, truthful pushed terminal outcome, exact terminal head, provider identity, clean worktree, explicit idle session tree, and upstream-before-worktree ordering.
- After the supported Orca removal command returns, re-read the exact provider/Git worktree state. Exact absence means removal succeeded, including when the command returned nonzero after deleting it.
- Continue that same cleanup invocation so its already-resolved upstream identity remains available through final branch verification and owner removal.
- If the exact worktree remains present, changed, foreign, or ambiguous, return the bounded provider error and retain ownership.
- Keep actual-state recovery direct. Add no cleanup state, persisted upstream metadata, receipt, stage, retry loop, error taxonomy, coordinator, background work, or generalized reconciliation framework.

## Scope and non-goals

This is a narrow correction to Orca post-removal result handling. Do not redesign cleanup, weaken pre-deletion safety, change the public `finalize_task_episode` schema, change Git/provider ordering, add automatic retries, or alter version-1 `finalize_spec_episode` behavior. Do not encode the one-time manual recovery procedure as product behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 When a clean exact Orca worktree is removed and the provider command returns nonzero only after the exact worktree has become absent, task-native cleanup treats the worktree step as complete and finishes the same invocation, including exact owner removal.
- [ ] #2 When the worktree is still present, changed, foreign, or not provably absent after a nonzero provider result, cleanup fails closed, preserves ownership, and performs no unsafe follow-on deletion.
- [ ] #3 Existing idle-session, exact identity/head, cleanliness, remote-before-worktree, unrelated-owner preservation, and version-1 finalization behavior remain unchanged.
- [ ] #4 A focused regression reproduces delete-then-nonzero Orca behavior and proves successful completion without persistent cleanup state or retry machinery; Docker-only plugin validation passes.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. **Reconcile only the Orca worktree-removal result at the existing adapter boundary.**
   - In `src/prime-agent-plugin/extension-support/task-episode-cleanup.ts`, keep every current pre-removal identity, idle, head, cleanliness, terminal, and upstream-order check unchanged.
   - Around only the existing `orca worktree rm --force` call in `CliTaskEpisodeCleanupAdapter.removeWorktree`, catch a removal error and run one fresh `inspect(record)` with the same adapter instance. Treat the step as successful only when that inspection proves the exact worktree absent; this preserves the invocation-local resolved upstream identity when Orca also removed the local branch and configuration.
   - If the worktree remains present or the post-state is changed, foreign, partial, or ambiguous, fail closed with the bounded removal/observation error. Do not retry the command or add persisted cleanup state, metadata, stages, receipts, classifiers, or generalized reconciliation.
   - Leave `finalizeTaskEpisodeCleanup`, its public tool schema, resource order, existing post-removal verification, remaining-branch removal, and owner compare-and-delete unchanged.

2. **Cover the exact success-after-error and failure-preservation cases.**
   - In `tests/spec_episode_extension.test.mjs`, extend the production Orca cleanup fixture through `finalizeTaskEpisodeCleanup` so `worktree rm` deletes the exact Git/Orca worktree and local branch/configuration, then returns nonzero. Prove that the same invocation completes, removes only the target owner, and preserves a foreign owner.
   - Add the paired negative case where nonzero does not produce provable exact absence. Prove ownership remains and no unsafe branch or owner deletion follows.
   - Keep the existing dirty-worktree, foreign-identity, upstream-order, absent-resource, ownership-integrity, and version-1 coverage passing.

3. **Align the two cleanup contracts and validate through supported paths.**
   - Update only the affected cleanup wording in `docs/user-stories/I-episode-finalization.md` and `docs/conversation-driven-episode-oversight.md`: a nonzero removal response is reconciled once against exact post-state, proven absence is success, and any present or ambiguous state remains a bounded failure with ownership retained.
   - Run the focused `tests/spec_episode_extension.test.mjs` suite, then the Docker-only plugin gate `scripts/test-tier1.sh --probe`. Record the resulting evidence in the task during implementation.
<!-- SECTION:PLAN:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Conversation PRIMECLAW-10.39
created: 2026-10-27 14:37
---
Additional observed cleanup case: PRIMECLAW-10.39

Terminal Episode head: b893faff3c701fcba401a89e7e98f6140c404e90. The exact candidate was merged, the bound task was Done on pushed canonical main, and the Episode was clean and pushed before cleanup. Exact owning Conversation: 01a13b1e-9ea9-72cb-9bcd-1c96de0da277; Episode: 01a1506c-11a5-759f-a056-a5621ba63325.

1. finalize_task_episode(taskId=PRIMECLAW-10.39, episodeHead=b893faff3c701fcba401a89e7e98f6140c404e90, outcome=merged) removed the session/runtime, remote branch, Orca/Git worktree, and local branch, then reported: "Task Episode cleanup worktree is dirty or no longer exact".
2. Fresh reads showed the saved Episode session and directory absent, no exact Git or Orca worktree, no local branch, and an empty live git ls-remote result for refs/heads/JLanders/prime-claw-primeclaw-10-39-episode-f1b99889 on origin. The original owner entry remained unchanged.
3. A same-binding retry then reported: "Task Episode cleanup cannot prove the exact configured upstream identity; ownership retained". The deleted local branch's remote/merge configuration was absent. The adapter's resolvedUpstream cache is invocation-local, so the fresh call could not recover its prior proof. The stale origin remote-tracking ref was separately removed with an expected-head-guarded Git update-ref after live remote absence was verified.

This is the same stranded-ownership failure pattern as this ticket, but an identical initial trigger is NOT proven: 10.39 surfaced the generic worktree-mismatch error, rather than the deleted-path Git error from the 10.40 reproduction. Please retain this distinction and use 10.39 as an additional regression case when assessing same-invocation post-state handling. No new persistent cleanup state or inferred upstream identity is requested.

The operator has explicitly authorized a one-time manual close of only the unchanged 10.39 ownership entry after re-verifying complete resource absence. This recovery is not proposed as product behavior. No plugin code, task status, acceptance criteria, or implementation plan is changed by this report.
---
<!-- COMMENTS:END -->
