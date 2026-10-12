---
id: PRIMECLAW-19.1
title: 'Slice 1: tier-1 slim test image + dumb driver'
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-19
priority: p1
type: task
ordinal: 62000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
docker/test.Dockerfile (Ubuntu 24.04 + Node>=22.8 + Python3+pytest, slim; shared-base extraction attempted but deferrable per spec escape hatch), scripts/test-tier1.sh driver: build image (cached), run ephemeral container, smoke-report, destroy. Acceptance: driver green end-to-end, evidence in docs/evidence/.
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
REWORK REQUIRED (EXPERT BLOCK findings accepted 2026-09-30). Full report: .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-47d2830-expert-block.md (in main repo). Three repairs against slice-1 artifacts ONLY: B1 — scripts/test-tier1.sh: --help/--dry-run must be informational-only (no docker CLI/daemon contact on those paths); readiness checks stay on the real-execution path; add negative-environment regression tests in tests/test_tier1_image.py (recording/failing docker substitute on PATH; run with Docker absent and with unreachable daemon); real runs still fail fast, never print OK on failure. B2 — DEVELOPERS.md: describe current slice-1 reality — plain pytest still runs host-coupled live-RPC probes until slice 3; give a bounded tier-0-only command for now; do NOT add markers/conftest to make the text true; do not imply smoke validates plugins. B3 — evidence note: separate observation vs demonstrated cause vs hypothesis; qualify six-failure attribution (host generation mismatch observed but NOT demonstrated as cause; several failed tests load explicit repo source or temp installs); correct runtime-image claim — prime-claw-brain:0.1.0 exists at 5.17GB; record 606MB vs 5.17GB. Constraints: no slice-2/3 work, no plugin source changes, no host probe reruns, host gates tier-0 subset only, refresh evidence after repair, commit+push, report new exact commit hash. The 47d2830 review is invalidated; fresh EXPERT gate follows on the new commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
REWORK ROUND 2 (EXPERT BLOCK on d8dbc5d accepted 2026-09-30). Full report: .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-d8dbc5d-expert-block.md (main repo). B1/B2 verified resolved. ONE remaining finding B3-R, documentation-only in docs/evidence/2026-09-29-tier1-slice1-image-driver.md: (1) Demonstrated section ~L115-118 — bound the claim to the verified fact (neither slice-1 commit changes existing plugin/probe code); remove the categorical "cannot be the cause of the 6 failures" conclusion that rests solely on additive scope; leave the six per-test causes explicitly UNRESOLVED unless retained failure traces establish them. (2) Demote the "eliminates by construction" claim ~L144-147 to an explicit hypothesis — filesystem/process isolation prevents host contamination but does not itself repair the unbounded reads documented in the note. (3) PRESERVE all observations (host mismatch, 6 failed/307 passed, owner intervention, unbounded-read hazards) — do not erase them; the regression risk is overcorrecting and concealing them. Constraints: evidence-note-only change; no host probe reruns; no plugin source changes; no slice-2/3 work; no new test machinery; host gates tier-0 subset only. Commit+push; report new exact commit hash to owner. The d8dbc5d review is invalidated; fresh EXPERT gate follows on the new commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
REWORK ROUND 2 COMPLETE at commit 2666843 (pushed). B3-R repaired, evidence-note-only (docs/evidence/2026-09-29-tier1-slice1-image-driver.md, +37/-11): Demonstrated claim bounded to verified fact (neither 47d2830 nor d8dbc5d changes existing plugin/probe code); categorical non-causation conclusion removed — six per-test causes explicitly UNRESOLVED; 'eliminates by construction' demoted to explicit hypothesis (isolation prevents host contamination, does not repair the unbounded reads). All observations preserved. Invalidates the d8dbc5d review; fresh EXPERT gate expected on 2666843. B1/B2 remain resolved, untouched.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed
<!-- SECTION:FINAL_SUMMARY:END -->
