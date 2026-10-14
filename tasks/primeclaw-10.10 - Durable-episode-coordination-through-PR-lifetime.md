---
id: PRIMECLAW-10.10
title: Durable episode coordination through PR lifetime
status: In Design
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-14 14:45'
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
