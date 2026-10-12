---
id: PRIMECLAW-10.16
title: Future-folder specification authoring skills
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement Slice 1 of the active reviewed specification: update design and spec-it-out canonical skills to create new reviewable bundles under .ralph/plans/future/<slug>, add focused contract tests, align active plan status/docs, and stop at operator specification review.

## Legacy notes

Completed Slice 1 only. Updated canonical design and spec-it-out skills to create new .ralph/plans/future/<slug>/ bundles, keep all artifacts inside them, report/link artifacts, revise in place, and stop at operator specification review without planning or episode resources. Added docs/future-specification-bundles.md, docs index entry, focused tests, and active plan progress. Evidence: pytest -q tests/test_future_plan_skills.py -> 7 passed; git diff --check -> clean. VISION.md and LONG_RANGE_PLAN.md alignment was already present at the episode base and required no edit. Slice 2 not started.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both authoring skills require a new safe future folder, keep all specification artifacts inside it, report and link produced artifacts, ask for operator review, revise in place, and prohibit planning/implementation/resource allocation; focused tests and git diff --check pass; changes are committed and pushed.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 1 future-folder authoring capability, documentation, and focused contract tests complete.
<!-- SECTION:FINAL_SUMMARY:END -->
