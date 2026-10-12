---
id: PRIMECLAW-10.20
title: Close reviewed episode workflow documentation
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels:
  - docs
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: task
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Close documentation gaps for the accepted Slices 1–3 only: add the end-to-end reviewed workflow walkthrough, manual-vs-automated validation boundary, pending/uncertain operator guidance, current root README status/discovery, and archived plan provenance. Do not reopen implementation or perform dogfood.

## Legacy notes

Documentation-only closure complete. Updated root README status and Phase 4 discoverability; expanded `docs/future-specification-bundles.md` with the exact authoring → specification review → `/plan` → plan review → `/implement-spec` walkthrough, explicit `pending`/`uncertain` preservation guidance without automated recovery, automated/integration versus owner-deferred live-dogfood boundaries, and links to the archived specification/execution plan; refreshed `docs/README.md`. No implementation or future bundle changed. Evidence: 28 local Markdown links checked, 0 broken; Node focused suites 34/34; Python focused suites 18/18; `git diff --check` clean; oversight future bundle diff empty.
Final correction: operator authoring instructions now use the actual Prime skill surfaces `/skill:design` and `/skill:spec-it-out`; native `/plan`, `/implement-spec`, and `/handoff` remain unchanged. Audited the changed operator docs: no `/design` or `/spec-it-out` shorthand remains. Checks: 28 relative links, 0 broken; git diff --check clean.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Capability and root docs make the workflow, gate boundaries, admission-state response, deferred live dogfood, current status, and archived provenance explicit; links/checks and focused regressions pass; documentation-only commit is pushed.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Documentation closure corrected to exact skill and native command invocation surfaces.
<!-- SECTION:FINAL_SUMMARY:END -->
