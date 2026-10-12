---
id: PRIMECLAW-10.12
title: Owner-authorized safe terminal episode cleanup
status: To Do
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-12 01:02'
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
