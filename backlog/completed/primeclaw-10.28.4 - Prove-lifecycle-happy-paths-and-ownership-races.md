---
id: PRIMECLAW-10.28.4
title: Prove lifecycle happy paths and ownership races
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies:
  - PRIMECLAW-10.28.3
parent_task_id: PRIMECLAW-10.28
priority: p1
type: task
ordinal: 57000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Exercise active-work epochs, monitored waits, terminal reconciliation, fresh-goal decisions, and competing completion ownership.

## Legacy notes

Slice 4 of .ralph/plans/EXECUTION_PLAN.md. Evidence paths and exact commands are defined in that slice. Strict dependency chain; claim only when predecessor is accepted.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AC15-23 success paths and race semantics have reproducible evidence and a pushed review commit.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded by the operator-approved two-checkpoint plan; no completion claim. Remaining acceptance moved to prime-claw-h6w.24.1 and .24.2.
<!-- SECTION:FINAL_SUMMARY:END -->
