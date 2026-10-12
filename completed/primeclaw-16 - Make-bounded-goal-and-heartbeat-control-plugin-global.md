---
id: PRIMECLAW-16
title: Make bounded goal and heartbeat control plugin-global
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p1
type: task
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Move the general goal/heartbeat execution-control pattern out of the Ralph execute skill and into prime-claw's managed goal-control extension prompt guidelines so every Prime Agent session gets it whenever the plugin is loaded. Keep only Ralph-specific slice workflow in execute.

## Legacy design

Manage goal-blocker-control.ts as an allowlisted global plugin entry. Put the bounded work policy in the registered tools' promptGuidelines so it remains present even when a project APPEND_SYSTEM shadows the global identity kernel. Preserve native /goal command ownership, keep Ralph-specific slice policy in execute, and test source import, native prompt injection, installation parity, and clean installed startup.

## Legacy notes

Implemented managed plugin-wide bounded goal/heartbeat guidance in src/prime-agent-plugin/extensions/goal-blocker-control.ts; removed goal/heartbeat control from .ralph/skills/execute/SKILL.md; installer/checker now manage the extension. Validation: 20 passed plus 7 install subtests across goal-control, installer, execute, and all shipped extension entry-point loading; apply/check passed; fresh isolated installed-copy startup probe passed. Broader suite reached 176 passes before an owned RPC probe stalled; the task-related typebox source-resolution failure was fixed. Existing unrelated reviewed-plan RPC assertion remains reproducibly failing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Installed plugin context instructs substantive work to use a bounded goal; long-running external work pauses the goal and uses a scoped agent heartbeat that resumes or completes correctly; execute no longer owns the generic control-plane guidance; focused tests and plugin apply/check pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Plugin-global bounded goal and heartbeat control implemented and validated
<!-- SECTION:FINAL_SUMMARY:END -->
