---
id: PRIMECLAW-33.3
title: Unify workflow admission and prompt loading
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - low-hanging
  - plugin
  - prime-agent-plugin
  - simplification
  - user-stories
dependencies:
  - PRIMECLAW-33.2
parent_task_id: PRIMECLAW-33
priority: p2
type: task
ordinal: 109000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Planning/implementation prep and ordinary handoff currently use parallel two-stage routers and divergent prompt loaders. This duplicates error handling and lets legacy fallback behavior differ between ordinary and Episode paths.

## Work
Introduce one internal workflow-chain admission primitive and one canonical prompt loader. Preserve every public slash command/tool, exact-folder validation, preflight of both assets before first delivery, first-message delivery mode, exactly one follow-up, and honest handling of second-send uncertainty.

## Legacy design

Differences between plan, implement, ordinary handoff, and owned-Episode handoff remain declarative inputs: resolver, appended content, preflight, delivery mode, and target transport. Do not merge ordinary and owned-Episode authority or transport semantics.

## Legacy notes

Primary code: `extensions/handoff-chain.ts`, `extension-support/handoff-prompts.ts`, `extension-support/prep-chain.ts`, `extension-support/reviewed-plan-support.ts`, and command/tool adapters in `extensions/reviewed-plan.ts`, with their direct Node/Python tests.

Completion receipt (2026-10-11): replaced duplicate prompt loaders and two-stage delivery code with `workflow-chain.ts`; planning, implementation prep, ordinary handoff, and owned-Episode handoff now share canonical loading and first/follow-up sequencing while retaining separate validation, authority, and transports. Legacy lookup is explicit and limited to old handoff/execute snapshots. Second-send throws are reported as unconfirmed with no retry. The retired `handoff-prompts.ts` is removed on apply, rejected by check/cutover, and covered by upgrade regression tests. Validation: focused container bridges 7 passed/7 deselected; retired-file installer cases 4 passed/30 deselected; `scripts/test-tier1.sh --probe` PASS on pinned Prime Agent 0.9.8 after the final fix; independent review PASS. LOC across changed production TypeScript: -16; changed source/scripts/tests combined: -1; documentation adds the shared-boundary explanation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 US-11–US-13 and US-22–US-23 retain all outcomes.
- [ ] #2 One shared loader resolves current and intentionally supported legacy locations consistently.
- [ ] #3 Both assets are preflighted before the first send.
- [ ] #4 Behavioral tests cover command/tool entry, missing assets, first-send failure, uncertain second send, and exactly one follow-up.
- [ ] #5 Net source/test reduction is reported.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Unified canonical workflow loading and two-stage admission across plan/implement/handoff paths; preserved public and transport semantics, explicit legacy snapshot compatibility, honest follow-up uncertainty, installer retirement safety, focused tests, pinned 0.9.8 Tier 1, and independent review.
<!-- SECTION:FINAL_SUMMARY:END -->
