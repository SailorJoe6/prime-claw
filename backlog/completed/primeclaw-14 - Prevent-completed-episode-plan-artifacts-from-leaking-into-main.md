---
id: PRIMECLAW-14
title: Prevent completed episode plan artifacts from leaking into main
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.26
priority: p2
type: bug
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Problem
The completed conversation-driven episode oversight implementation was merged at reviewed commit `248f944f70acdbe19d3a93c6781ebcdb2eea22d2` while its promoted `.ralph/plans/SPECIFICATION.md` and `.ralph/plans/EXECUTION_PLAN.md` remained active at the repository root. The canonical `/execute` policy requires moving both to an archive folder and updating the archive index when the plan is finished. The final owner/EXPERT review and terminal close did not catch this; the close deliberately checks identity bookkeeping rather than Git/document completeness. This is an episode-completion/merge-readiness gap, separate from the one-time archive cleanup.

## Desired outcome
A completed episode reaches merge readiness only with its reviewed plan artifacts in the appropriate finished state, or clearly reports why completion cannot yet be claimed. Preserve project-customizable bundle names, exact-commit review, operator-only terminal authority, and no-UI bookkeeping-only close. Developers should choose the suitable policy and verification design; this issue does not prescribe a plugin validator, hard-coded filenames, or a particular implementation layer.

## Context
The one-time relocation of this already merged spec/plan and archive-index update was completed separately at `26cefa16b83016a53737cceeda92822fe0098ebf`. This issue tracks the prevention policy and its bounded manual evidence, not that relocation.

## Legacy notes

Completed on origin/main at b7e977e916efe55e596eb142ba0cddb3485145e5 (wording follow-up bc699bda7251fd063fac487740dda73f4360a2d6). The owner oversight skill now checks this episode's project-required active artifact bundle, archive counterparts/index/links and Git provenance before final exact-commit EXPERT review or merge-readiness; it excludes in-progress advance and leaves operator terminal authority and bookkeeping-only close unchanged. Manual before/after coverage: 248f944 has root active spec+plan without matching archive/index, so the new policy blocks completion; 26cefa1 has root paths absent, archived counterparts and README entry, with representative relative links resolved, so it passes the artifact-state part of the policy. Existing tests assert policy contract/order; integrated Python suite passed 300 + 7 subtests. This is manual scenario evidence, not a live owner behavior test and not a mechanical markdown validator (that unnecessary helper and its tests were removed).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A completed episode cannot be presented as merge-ready while its own required active plan artifacts still need archival, unless a documented project policy explicitly defines another terminal state.
- [ ] #2 Completion evidence includes coherent archive placement/index and resolvable links for the project's artifact bundle; incomplete state is visible to the owner before final review/merge.
- [ ] #3 Coverage demonstrates that an unarchived completed bundle is caught and an archived completed bundle is accepted, without transferring semantic merge/cleanup authority to bookkeeping close or assuming every project uses the same artifact names.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Owner archive-readiness policy delivered and manually checked against active/archived historical trees; no runtime checker or live-behavior claim.
<!-- SECTION:FINAL_SUMMARY:END -->
