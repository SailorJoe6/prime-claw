---
id: PRIMECLAW-10.12
title: Owner-authorized safe terminal episode cleanup
status: In Design
assignee: []
created_date: 2026-10-12 01:00
updated_date: '2026-11-26T18:14:00Z'
labels:
  - episode-loop
  - phase4
  - ralph
  - worktree-episodes
dependencies:
  - PRIMECLAW-10.11
references:
  - .ralph/plans/SPECIFICATION.md
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement merge/abandon authorization and cleanup that retires only the registered session/worktree after dirty-state and identity checks, with resumable partial cleanup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Cleanup refuses dirty, unmerged, mismatched, pre-existing, or active-required resources; successful cleanup is journaled and branch deletion remains separately safety-gated.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded, not completed. Current exact finalization replaced the legacy mechanism. Keep 72, 75 and 76 as distinct unresolved cleanup work. This archive preserves the original specification and does not assert operator acceptance.
<!-- SECTION:FINAL_SUMMARY:END -->
