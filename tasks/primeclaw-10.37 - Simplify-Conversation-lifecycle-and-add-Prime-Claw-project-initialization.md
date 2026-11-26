---
id: PRIMECLAW-10.37
title: Reconcile initialization and Conversation acceptance with shipped behavior
status: In Design
assignee: []
created_date: 2026-10-12 01:01
updated_date: '2026-11-26T18:13:00Z'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: feature
ordinal: 95000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Initialization, read-only startup inspection and patch comparison, and fresh task-native Episode placement have shipped in PRIMECLAW-44, 58 and 10.38. Remaining work for this parent is mapping product outcomes to current evidence, not a parallel implementation. Template hash design lives in 10.37.4, root config and upgrade order in 74/73, and live dogfood in 10.32. Do not reinstate custom commands, transcript forks, automatic startup writes, or Orca viewer gates.

[Previous specification](https://github.com/SailorJoe6/prime-claw/blob/7837f31ed8c8f9716abfa185b6429931b98c14ff/tasks/primeclaw-10.37%20-%20Simplify-Conversation-lifecycle-and-add-Prime-Claw-project-initialization.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Map current initialization and Conversation outcomes to already accepted evidence and the named residual tickets. File only concrete uncovered gaps; no blanket retest or global activation.
<!-- AC:END -->
