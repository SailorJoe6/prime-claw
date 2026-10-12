---
id: PRIMECLAW-17
title: Deliver goal pause and resume as steering commands
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p1
type: bug
ordinal: 51000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Change the managed prime-claw goal-control plugin so both pause_thread_goal and resume_thread_goal queue their native /goal commands through steering delivery, avoiding stale follow-up resume execution after the agent reaches a later pause boundary.

## Legacy design

Keep the native /goal command transport. Change resume from followUp to steer, preserve pause steer, strengthen regression coverage for both exact delivery modes, and document the safe-boundary behavior.

## Legacy notes

Changed resume_thread_goal native /goal resume transport from followUp to steer; pause_thread_goal already used steer and remains unchanged. Regression contract now requires exactly two steering deliveries and forbids followUp in the goal-control extension. Validation: focused suite 17 passed plus 7 install subtests; plugin apply/check passed; fresh isolated installed-copy startup probe passed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both tools use deliverAs steer; focused source and native delivery tests pass; managed global plugin apply/check and installed-copy probe pass; change is committed and pushed.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both goal pause and resume now use steering delivery; validated and installed
<!-- SECTION:FINAL_SUMMARY:END -->
