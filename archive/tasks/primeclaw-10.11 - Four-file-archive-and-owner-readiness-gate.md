---
id: PRIMECLAW-10.11
title: Four-file archive and owner readiness gate
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
  - PRIMECLAW-10.10
references:
  - .ralph/plans/SPECIFICATION.md
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update execute archival to the full planning set and add deterministic owner readiness checks without granting merge authority.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All four planning files archive uniquely; readiness fails for each missing acceptance predicate and never records merge/abandon authorization on archive presence alone.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Superseded, not completed. 10.38 retires active four-file planning authority for new Episodes; current review follows editable policy and native Git. This archive preserves the original specification and does not assert operator acceptance.
<!-- SECTION:FINAL_SUMMARY:END -->
