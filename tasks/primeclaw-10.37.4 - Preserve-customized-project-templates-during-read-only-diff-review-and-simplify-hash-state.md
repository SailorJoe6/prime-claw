---
id: PRIMECLAW-10.37.4
title: Simplify managed-template hash state without losing customization
status: In Design
assignee: []
created_date: 2026-10-13 14:34
updated_date: '2026-11-26T18:13:00Z'
labels:
  - project-initialization
  - templates
  - safety
dependencies: []
references:
  - PRIMECLAW-10.37.2
parent_task_id: PRIMECLAW-10.37
priority: p1
type: bug
ordinal: 122000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The read-only comparison shipped (f12d0499; PRIMECLAW-44). Do not bring back a required Orca viewer, overwrite, or restore step. The residual design question is whether one canonical hash can preserve current upgrade, customization, and explicitly accepted override behavior safely. Keep the existing schema if simplification cannot meet those outcomes.

[Previous specification](https://github.com/SailorJoe6/prime-claw/blob/7837f31ed8c8f9716abfa185b6429931b98c14ff/tasks/primeclaw-10.37.4%20-%20Preserve-customized-project-templates-during-read-only-diff-review-and-simplify-hash-state.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Review whether one canonical hash suffices for safe upgrades, customization and explicit overrides; if not, record the exact behavior requiring retained state.
- [ ] #2 If simplifying, prove migration preserves customized bytes, existing valid overrides and current read-only Git patch behavior; ambiguous legacy data fails closed without overwrite.
- [ ] #3 Cover discoverable skills and internal workflows with focused regressions. Reset remains separately authorized; comparison never mutates project files or the Git index.
<!-- AC:END -->
