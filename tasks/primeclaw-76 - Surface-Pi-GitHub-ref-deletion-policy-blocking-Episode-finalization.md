---
id: PRIMECLAW-76
title: Surface Pi GitHub ref-deletion policy blocking Episode finalization
status: In Design
assignee: []
created_date: '2026-11-25 13:36'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-claw/blob/d61702f642c75ce72aa2bb80ea166388d071ab89/tasks/primeclaw-75%20-%20Diagnose-task-Episode-cleanup-refusing-a-runtime-reported-idle.md
documentation:
  - docs/project-initialization.md
priority: p1
type: bug
ordinal: 160000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The PAPI-8 owner reported that after operator-authorized detachment of the exact Orca attach pane, the live Episode was idle with zero clients. Canonical cleanup passed its runtime check but stopped at Git upstream removal because the Pi pre-push guard blocks GitHub ref deletions. This is distinct from PRIMECLAW-75 (runtime eligibility). Do not infer which resources remain without read-only verification.

Track the compatibility boundary between Prime Claw task Episode cleanup and the Pi repository policy. Preserve the policy; do not bypass hooks, delete a live ref, retry the live cleanup, or change Pi configuration under this ticket without separate operator authority.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Verify and document the exact policy refusal and cleanup boundary without a live deletion, using existing evidence or a disposable fixture.
- [ ] #2 Provide an actionable policy-blocked outcome that preserves exact ownership and does not claim completion; document any supported resolution or explicitly surface the operator policy decision needed.
<!-- AC:END -->
