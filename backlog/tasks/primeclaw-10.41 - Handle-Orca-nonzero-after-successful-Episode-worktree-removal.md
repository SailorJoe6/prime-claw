---
id: PRIMECLAW-10.41
title: Handle Orca nonzero after successful Episode worktree removal
status: In Design
assignee: []
created_date: '2026-10-27 12:48'
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
