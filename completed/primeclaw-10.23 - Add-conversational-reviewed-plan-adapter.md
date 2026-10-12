---
id: PRIMECLAW-10.23
title: Add conversational reviewed-plan adapter
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
updated_date: '2026-10-12 01:02'
labels:
  - conversational-routing
  - episode-loop
  - phase4
  - ralph
dependencies:
  - PRIMECLAW-10.22
parent_task_id: PRIMECLAW-10
priority: p2
type: task
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Slice 2 after Slice 1 acceptance: expose `ralph_plan` using shared canonical validation/admission, preserve native behavior and authority boundaries, test it, and document it.

## Legacy notes

Slice 2 delivered in commit `d011968d4f505d8df52ebd552e49d654cdf45b74` on `episode/conversational-ralph-command-routing` and pushed to `origin/episode/conversational-ralph-command-routing`. Added explicit `ralph_plan`, shared canonical validation/skill admission with native `/plan`, follow-up delivery, admission-only results, focused failure isolation, installed offline discovery coverage, operator documentation, and active-plan status. Evidence: `node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs` 19/19 passed; `pytest -q tests/test_reviewed_plan_extension.py` 7/7 passed; final `pytest -q tests` 247 passed with 11 warnings; changed-document links resolve; `git diff --check` passed. Native `/plan` and `/implement-spec` delivery remains unchanged, valid or invalid conversational planning does not arm `create_spec_episode`, and no Slice 3 implementation was added.
PROJECT_CONVERSATION acceptance after independent exact-commit review: `d011968d4f505d8df52ebd552e49d654cdf45b74` matches the pushed remote and clean slice boundary; focused Node 19/19, focused Python 7/7, full repository 247 passed with 11 warnings, and `git diff --check 86b24b5..d011968` passed. Diff review found no material Slice 2 defect. Acceptance was completed after the operator had already issued the next native `/handoff` because the owner watch cadence missed the boundary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Meets the matching approved execution-plan slice, including focused and full tests, current operator documentation, one clean pushed commit, and exact evidence recorded on the bead.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 2 implemented, tested, documented, committed, and pushed for project-conversation review
<!-- SECTION:FINAL_SUMMARY:END -->
