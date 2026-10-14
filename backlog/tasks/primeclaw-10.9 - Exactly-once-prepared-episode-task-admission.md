---
id: PRIMECLAW-10.9
title: Exactly-once prepared episode task admission
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
  - PRIMECLAW-10.8
references:
  - .ralph/plans/SPECIFICATION.md
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Separate publication from substantive task delivery, admit the task once across the preparation race, verify episode root/branch, and write the active three-file spec bundle.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Race, duplicate, restart, and uncertain-response tests show no duplicate substantive admission; the episode runs prepare and owns the exact active bundle in its worktree.
<!-- AC:END -->
