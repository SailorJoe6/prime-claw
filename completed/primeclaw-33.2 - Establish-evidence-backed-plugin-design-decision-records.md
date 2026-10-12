---
id: PRIMECLAW-33.2
title: Establish evidence-backed plugin design-decision records
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - design-decisions
  - gate
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies:
  - PRIMECLAW-33.1
parent_task_id: PRIMECLAW-33
priority: p1
type: task
ordinal: 108000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Non-obvious mechanisms have repeatedly looked unnecessary until their original failure or external constraint was rediscovered. Simplification needs durable scar-tissue records without turning every ordinary choice into an ADR.

## Work
Create `docs/design-decisions/` with a minimal index/template and initial records for: Orca tracked-item template comparison, retained visible Episode tab, Prime Agent 0.9.8 plugin API boundary, ambiguous external mutations/no blind replay, and Docker-only self-hosted plugin validation. Link each record to affected stories and tests/evidence.

## Legacy design

A record exists only for an observed incident, failed simpler design, external API constraint, or non-obvious safety invariant. Each record contains status, stories, observed context, decision, why the obvious alternative failed, regression evidence, and revisit/removal conditions. It is not a general architecture diary.

## Legacy notes

Primary sources: `docs/user-stories/`, `docs/evidence/2026-10-09-orca-prime-agent-integration-probes.md`, `docs/prime-agent-installation.md`, `docs/testing-strategy.md`, and observed incident/evidence records. Do not infer an incident from code shape alone.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The folder and index define the narrow admission rule.
- [ ] #2 Each initial record cites concrete evidence and affected stories.
- [ ] #3 Each record names the regression anchor and conditions for reconsideration.
- [ ] #4 No speculative decision is recorded as fact.
- [ ] #5 User-story traceability links to relevant records without duplicating their content.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a narrow design-decision index and five evidence-backed records for Orca template review, retained Episode tab, exact supported 0.9.8 line, no-blind-replay ambiguity handling, and Docker-only candidate validation; each links stories, evidence, regression anchors, rejected alternatives, and revisit conditions.
<!-- SECTION:FINAL_SUMMARY:END -->
