---
id: PRIMECLAW-26
title: Move goal continuation policy into plugin source
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p1
type: bug
ordinal: 92000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The goal-continuation nudge currently reads project-local .agents/skills/goals-and-heartbeats/CONTINUATION.md. Make the policy a managed plugin asset under src/prime-agent-plugin, install/check it with the plugin, and stop depending on project-local skill files.

## Legacy notes

Completed and validated with the combined plugin change on 2026-10-09. Goal continuation policy now lives in the plugin-managed goals-and-heartbeats bundle; installer/check inventories manage it and project-local copies are removed. Maintained host suite and canonical pinned 0.9.8 Docker tier-1 --probe passed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The extension reads the managed plugin policy by default; project-local CONTINUATION.md is not consulted; installer/check inventory includes the policy; focused and Docker plugin tests pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Goal continuation policy moved into plugin-managed source and validated
<!-- SECTION:FINAL_SUMMARY:END -->
