---
id: PRIMECLAW-10.22
title: Add conversational Ralph handoff adapter
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels:
  - conversational-routing
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Slice 1 of the approved conversational Ralph command-routing plan: expose `ralph_handoff`, converge native and conversational admission on one helper, preserve native behavior, add focused/full tests, and document the conversational entry path.

## Legacy notes

Slice 1 delivered in commit `86b24b5` on `episode/conversational-ralph-command-routing` and pushed to `origin/episode/conversational-ralph-command-routing`. Changed the handoff extension, focused Node/Python tests, installed offline loader probe, operator documentation, and active plan/spec status. Evidence: `node --experimental-strip-types --test tests/handoff_chain_extension.test.mjs` 13/13 passed; `pytest -q tests/test_handoff_chain_extension.py` 4/4 passed; `pytest -q tests` 247 passed with 11 warnings; `git diff --check` passed. Independent Slice 1 diff review found no material issue. Native `/handoff` remains unchanged at its admission boundary; `ralph_handoff` exposes only optional guidance and uses `steer` then the sole `followUp`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Meets the matching approved execution-plan slice, including focused and full tests, current operator documentation, one clean pushed commit, and exact evidence recorded on the bead.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 1 implemented, tested, documented, independently reviewed, committed, and pushed for project-conversation review
<!-- SECTION:FINAL_SUMMARY:END -->
