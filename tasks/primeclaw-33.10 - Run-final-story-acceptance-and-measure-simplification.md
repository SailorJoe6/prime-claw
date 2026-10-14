---
id: PRIMECLAW-33.10
title: Run final story acceptance and measure simplification
status: In Design
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-14 14:45'
labels:
  - acceptance
  - prime-agent-plugin
  - simplification
  - testing
  - user-stories
dependencies:
  - PRIMECLAW-33.7
parent_task_id: PRIMECLAW-33
priority: p1
type: task
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
The epic succeeds only if implementation shrinks while every fixed story and accepted UX remains intact.

## Work
Recheck the story traceability matrix against the code actually changed by this epic. Run the normal Node, host, container, exact Prime Agent 0.9.8, installer, and documentation gates. Cite existing accepted dogfood for unchanged model-led or Orca behavior; repeat manual acceptance only when this epic changed that behavior. Compare source/test/doc LOC and major module complexity to the baseline.

## Legacy design

Acceptance is outcome-based. A smaller diff is not sufficient if a story lacks evidence. Report retained complexity and its story/decision justification rather than chasing a numeric deletion target.

## Legacy notes

Use the then-current `docs/testing-strategy.md`, story traceability, and design decisions. Evidence gaps document confidence limits; they do not automatically create new work. Joe is authoritative that Prime Agent 0.10 removed the plugin framework required by Prime Claw.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All 27 stories remain mapped to passing tests or existing accepted evidence appropriate to the surfaces changed by this epic.
- [ ] #2 US-05 still provides the in-product comparison and US-14 still leaves its visible Prime Agent tab open and usable.
- [ ] #3 No new manual certification program, adversarial test matrix, or UAT requirement is created for unchanged behavior.
- [ ] #4 The exact supported Prime Agent `cwd-fix-v0.9.8-r1` gates pass; Prime Agent 0.10 is out of scope because it removed the required plugin framework.
- [ ] #5 Main is synchronized.
- [ ] #6 The final report gives source/test/doc reductions and identifies any meaningful retained complexity.
- [ ] #7 No unauthorized live sandbox/plugin/UAT mutation occurred.
<!-- AC:END -->
