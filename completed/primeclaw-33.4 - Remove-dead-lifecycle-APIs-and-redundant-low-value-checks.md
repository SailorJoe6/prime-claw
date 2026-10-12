---
id: PRIMECLAW-33.4
title: Remove dead lifecycle APIs and redundant low-value checks
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
ordinal: 110000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
The plugin retains unused cleanup/compatibility APIs plus duplicate root, ownership, readback, digest, and unsupported-remote inventory logic. These obscure the credible lifecycle invariants.

## Work
Confirm and remove dead internal exports/adapters such as `parseEpisodeIdentity`, `episodeIdentityPath`, `episodeBootstrapReady`, `removeEpisodeOwnership`, unused worktree removal/session kill affordances, and existence-only values. Stop enumerating unsupported remote Orca environments. Consolidate duplicate project-root and owner/location checks, remove immediate readback that adds no boundary, and reduce redundant digest walks while retaining approval binding and promoted-byte verification.

## Legacy design

Preserve provisioning/active/uncertain/inactive, exact owner/location/worktree/session identity, idle checks, local-fallback boundary, visible retained Orca tab, durable session publisher, and no-blind-retry behavior. This is subtraction, not lifecycle redesign.

## Legacy notes

Primary code: `extension-support/spec-episode.ts`, `episode-ownership.ts`, `episode-close.ts`, `conversation-oversight.ts`, and `extensions/reviewed-plan.ts`, with `tests/spec_episode_extension.test.mjs` and direct bridge tests. Verify repository-wide references before deletion.

Completion receipt (2026-10-11): removed dead identity aliases/helpers, ownership deletion, local worktree-removal and daemon-kill affordances; consolidated Conversation/finalization Git-root discovery on the canonical resolver; removed redundant handoff tool ownership precheck while retaining core exact checks; removed immediate finalization readback after the synchronous validated atomic write; reused the single implementation-preflight digest for approval; stopped CLI enumeration of unsupported remote Orca environments while retaining pre-mutation rejection/no fallback for explicit or injected remote selection. Validation: reviewed-plan container bridge 5 passed/5 deselected; direct Node lifecycle suites 46 passed; static reviewed-plan checks 5 passed/5 skipped or deselected; final `scripts/test-tier1.sh --probe` PASS on pinned Prime Agent 0.9.8; independent review PASS. Changed production/test LOC: -67; total including documentation: -63.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every removed symbol has no external/current production consumer.
- [ ] #2 Remote selection still fails before mutation and never falls back.
- [ ] #3 Bundle changes after approval and promotion mismatches still fail closed.
- [ ] #4 Ownership, ambiguity, visible-tab, and operator-authority tests remain behavioral and passing.
- [ ] #5 Net deletion is reported.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed proven-dead lifecycle surfaces and redundant checks, consolidated root/digest handling, stopped unsupported remote enumeration, preserved exact lifecycle invariants, and passed focused Docker, pinned 0.9.8 Tier 1, static, and independent review.
<!-- SECTION:FINAL_SUMMARY:END -->
