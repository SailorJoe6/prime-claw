---
id: PRIMECLAW-33.1
title: Define and trace all plugin user-story acceptance
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels:
  - gate
  - prime-agent-plugin
  - simplification
  - testing
  - user-stories
dependencies: []
parent_task_id: PRIMECLAW-33
priority: p1
type: task
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Simplification cannot safely begin until every fixed story has observable acceptance and named evidence. Current US-05 and US-14 omit important Orca UX details discovered during review.

## Work
- Strengthen US-05 to require the in-product Orca side-by-side diff of the tracked worktree item, with terminal diff only as fallback.
- Strengthen US-14 to require a retained visible writable Orca Prime Agent tab bound to the durable Episode session after launcher removal.
- Review all US-01 through US-27 for observable acceptance, supporting invariants, and actor/authority clarity.
- Create one traceability matrix mapping each story to behavioral tests, integration/manual acceptance, and known gaps.
- Run or inspect the existing evidence sufficiently to distinguish true gaps from tests that merely use different names.
- Do not change implementation code in this task.

## Legacy design

The user-story documents remain the product contract. The traceability matrix references rather than duplicates story prose. Evidence may be automated, focused integration, or an explicitly named manual acceptance where GUI/runtime behavior cannot be proved cheaply. Avoid one-test-per-sentence and prose snapshot tests.

## Legacy notes

Primary sources: `docs/user-stories/README.md` and A–K files, `docs/testing-strategy.md`, direct plugin tests under `tests/`, and the pinned 0.9.8 Tier-1 evidence. Deliverable: `docs/user-stories/traceability.md` or an equally explicit indexed matrix.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 US-05 and US-14 contain the agreed Orca UX requirements.
- [ ] #2 All 27 stories have observable acceptance and at least one named evidence path or an explicit test gap.
- [ ] #3 Operator/Conversation/Episode/Expert authority remains unchanged.
- [ ] #4 The matrix identifies which current tests are behavioral versus static/prose proxies.
- [ ] #5 No simplification implementation is performed.
- [ ] #6 Documentation/link checks pass and the result is reviewed before dependent work begins.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added explicit US-05/US-14 UX contracts and a 27-story acceptance/evidence matrix with behavioral, integration, manual, static-proxy, and named-gap classifications; links and focused host-safe tests validated.
<!-- SECTION:FINAL_SUMMARY:END -->
