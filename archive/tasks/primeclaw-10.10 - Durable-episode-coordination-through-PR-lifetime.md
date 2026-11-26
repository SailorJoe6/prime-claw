---
id: PRIMECLAW-10.10
title: Durable episode coordination through PR lifetime
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
  - PRIMECLAW-10.9
references:
  - .ralph/plans/SPECIFICATION.md
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add owner-side status/recovery operations and prove durable bidirectional coordination through planning, implementation, PR, review-fix, and rebase states.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Owner identity survives compaction/kernel loss; the episode remains resolvable, messageable, and resumable through simulated PR lifecycle transitions without premature cleanup.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded, not completed. Current editable owner review, native Git and continuation replace the proposed PR-lifetime coordinator; remaining operator exercise lives in 10.32. This archive preserves the original specification and does not assert operator acceptance.
<!-- SECTION:FINAL_SUMMARY:END -->
