---
id: PRIMECLAW-10.8
title: Durable promoted episode allocation and transcript fork
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
  - PRIMECLAW-10.7
references:
  - .ralph/plans/SPECIFICATION.md
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement safe branch/worktree allocation, complete active-conversation SessionManager.forkFrom, daemon create(sessionPath), ownership metadata, and recoverable phase journaling.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A promoted request creates one isolated worktree-rooted sibling with verified full-branch inheritance and durable owner/identity metadata; collision and fault injection preserve recoverable evidence.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded, not completed. 10.38 ships fresh bounded sessions and durable allocation, not a full transcript fork. This archive preserves the original specification and does not assert operator acceptance.
<!-- SECTION:FINAL_SUMMARY:END -->
