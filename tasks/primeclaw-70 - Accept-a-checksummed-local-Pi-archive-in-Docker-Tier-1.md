---
id: PRIMECLAW-70
title: Accept a checksummed local Pi archive in Docker Tier 1
status: In Progress
assignee: []
created_date: '2026-11-24 06:56'
updated_date: '2026-11-24 06:57'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-agent-pi/commit/94e177fe1b2611faa722af6031d5b8f2fb2a5091
documentation:
  - docs/design-decisions/DD-003-prime-agent-v098-plugin-boundary.md
  - docs/design-decisions/DD-005-docker-only-plugin-candidate-validation.md
type: task
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable the operator-approved PAPI-61 compatibility probe on exact native archive bytes. Add an explicit, experimental local archive input to Prime Claw’s disposable Docker Tier 1 workflow, not a new approved runtime. Require an expected SHA-256 and verify before extraction or execution; preserve existing source and pinned legacy routes, defaults, and qualification policy. Do not run the actual Pi compatibility test on this task or change the host installation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An explicit local native archive and matching SHA-256 can feed the existing Docker-only probe wrapper with synthetic state; missing or mismatched inputs are rejected before extraction or execution.
- [ ] #2 Positive and negative fixture tests and the relevant Tier 1 checks verify the new route and show that default, source and pinned legacy behavior is unchanged.
- [ ] #3 Document the experimental invocation and its limits; no host install, policy change, activation or release.
<!-- AC:END -->
