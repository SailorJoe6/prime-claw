---
id: PRIMECLAW-10.1.3
title: Verify current handoff delivery stays bound to the exact session
status: In Design
assignee: []
created_date: 2026-10-12 01:00
updated_date: '2026-11-26T18:13:00Z'
labels:
  - handoff
  - phase4
  - phase4a
  - rlm
dependencies: []
parent_task_id: PRIMECLAW-10.1
priority: p1
type: bug
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Prime Agent 0.9.5 shared-extension `/handoff` concern is historical. Map current supported durable session delivery evidence (15, 62, 63, 67, 69) to the reported wrong-session risk. Only keep a code fix if a current bounded regression identifies a gap.

[Previous specification](https://github.com/SailorJoe6/prime-claw/blob/7837f31ed8c8f9716abfa185b6429931b98c14ff/tasks/primeclaw-10.1.3%20-%20Prove-session-bound-handoff-message-delivery-with-shared-RLM-extension-runtime.md).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Current focused evidence covers the exact-session routing concern, or records a specific residual failure on the supported path. Do not revive the removed custom command or require upstream changes.
<!-- AC:END -->
