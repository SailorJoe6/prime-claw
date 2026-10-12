---
id: PRIMECLAW-33.5
title: Simplify the goal-continuation reminder state machine
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - goals-heartbeats
  - plugin
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies:
  - PRIMECLAW-33.2
parent_task_id: PRIMECLAW-33
priority: p2
type: task
ordinal: 111000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
US-25/US-26 require advisory reminders, but the six-line reminder currently drives a large per-session observation/cache/reset state machine and implementation-coupled tests.

## Work
Replace bespoke state where possible with structured `goal_context` information already available in context. Preserve one idempotent rapid-repeat reminder, one silent post-compaction reminder, safe regular-file/symlink/size validation, malformed-config no-op, and cleanup at real session boundaries.

## Legacy design

This remains advisory context injection, not an autonomous scheduler or durable enforcement engine. Optimize for idempotent observable output rather than preserving the current Observation-map implementation.

## Legacy notes

Primary code: `extensions/goal-continuation-nudge.ts`, `skills/goals-and-heartbeats/CONTINUATION.md`, and direct Node/Python tests. Do not change the user skill policy in `SKILL.md` unless traceability identifies a contract defect.

Completion receipt (2026-10-11): replaced the per-session observation map and six-field cached observation with one extension-local sequence observation backed by native `goal_context` details; removed the custom reverse-scan helper and redundant reminder flags; retained exact managed reminder text/timing, idempotent repeated provider calls, goal/user/time/session resets, safe malformed/oversized/symlink no-op handling, image-block preservation, and one silent non-turn reminder per compaction event. Removed an implementation-only listener-registration assertion. Validation: direct Node reminder suite 11/11 PASS; focused container bridge 1 passed/2 deselected; static bundle checks 2 passed/1 deselected; final `scripts/test-tier1.sh --probe` PASS on pinned Prime Agent 0.9.8; independent review PASS. Net source/test reduction: 32 lines (21 production, 11 tests).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The documented goal/heartbeat guidance and the current user-visible reminder behavior are unchanged.
- [ ] #2 Repeated provider context calls do not duplicate reminders.
- [ ] #3 Goal/user/time boundaries reset the rapid sequence correctly.
- [ ] #4 Malformed, oversized, or symlinked configuration is a no-op.
- [ ] #5 Actual compaction injects one non-turn reminder.
- [ ] #6 Tests focus on the reminder code changed by this task; no new operational UAT is required for unchanged goal/heartbeat policy.
- [ ] #7 Net source/test reduction is reported.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Simplified reminder state to one native-goal-context observation, preserved all visible/reset/config/compaction behavior, reduced source/tests by 32 lines, and passed focused, pinned-runtime, and independent review.
<!-- SECTION:FINAL_SUMMARY:END -->
