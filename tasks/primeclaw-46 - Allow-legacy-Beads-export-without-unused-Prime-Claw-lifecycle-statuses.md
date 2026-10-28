---
id: PRIMECLAW-46
title: Allow legacy Beads export without unused Prime Claw lifecycle statuses
status: In Design
assignee: []
created_date: '2026-10-28 22:04'
updated_date: '2026-10-28 22:05'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extension-support/task-provider-migration.ts
  - src/prime-agent-plugin/extension-support/task-providers.ts
priority: p1
type: bug
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Report and impact
Reported by the Initialize PVA on Prime-Claw conversation during Joe’s live ralph-pva migration. This issue records the supplied observations; they have not been independently reproduced here. Beads → Backlog switch inspection refuses a readable legacy source because it lacks unused Prime Claw custom lifecycle statuses. This blocks migration away from Beads and incorrectly recommends mutating the outgoing source schema.

## Reproduction (reported; do not run against the live project without authority)
Project: /Users/jlanders/gitlab_local/ralph-pva.
Call initialize_prime_claw(action="switch-request", targetProvider="backlog").
Observed failure: "Beads capability check failed: the status mapping is incomplete: in_design:active (custom); in_planning:active (custom); ready_for_merge:wip (custom); done:done (custom)". Suggested workaround is bd config set status.custom.
bd statuses --json reports built-ins only: open(active), in_progress(wip), blocked(wip), deferred(frozen), closed(done, description Completed), pinned(frozen), hooked(wip).

## Reported cause and related semantic seam
Installed extension-support/task-provider-migration.ts captureBeads() lines 529–535 unconditionally calls checkBeadsCapabilities() before source export. extension-support/task-providers.ts lines 867–871 describe that shared gate as target readiness for lifecycle mutation; lines 914–927 require all four custom statuses. Source read/export readiness is therefore coupled to ongoing Beads write readiness. Line numbers refer to the reporter’s installed generation, not necessarily current builder source.
statusFromBeads() lines 769–775 already maps legacy open → In Design and closed → Done. Separately, captureBeads() lines 551–552 reportedly classifies every legacy closed issue as archived. Closed alone does not prove abandonment or justify archival; preserve actual completion, close_reason, and history evidence.

## Required behavior and open design question
Export the outgoing Beads schema as-is, without adding unused statuses. Translate statuses actually present into supported Backlog semantics and preserve original native status/category/context, full history, and provenance.
Joe’s explicit mappings: open → Backlog In Design; closed → Backlog Done, not automatically abandoned/archived.
Deferred → native Backlog drafts was proposed tentatively, not approved. Inspect complete inventory, including deferred/pinned/hooked and any custom statuses, rather than assuming unused statuses have no instances. Resolve unsupported or ambiguous mappings without silent loss.
Keep source readability, complete inventory/history/provenance, identity, clean published revisions, quiescence, ownership continuity, receipt verification, and cutover/deletion proofs. Do not relax destination Beads lifecycle/write checks as a side effect.

## Live state and scope boundaries (reported snapshot)
Previously observed inventory: 406 Beads issues. Existing ordinary backlog/ contains RPVA-1, RPVA-2, and an archived RPVA-2 prefix probe; neither store has been migrated or deleted. Skill/setup publication: 094cbb7 (17 assets, prepare-only accepted override); remaining checkpoints: 2b3cf60. Joe separately authorized parking backlog/config.yml as backlog/config.yml.pre-migration, published as 3f29fb6, to bypass dual-provider discovery. Existing Backlog tasks are unchanged; runtime locks privately excluded, not deleted. A disposable fixture proved discovery/native CLI routing only, not end-to-end migration.
No custom Beads source statuses configured; no switch-confirm issued. This issue does not authorize live ralph-pva mutation, provider switching, check bypass, source deletion, merge, or deployment. Candidate validation must use disposable fixtures; implementation remains a separate approved lifecycle action.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read-only Beads → Backlog inspection/export accepts a legacy built-in-only source without requiring or configuring unused Prime Claw custom statuses.
- [ ] #2 Preserve all source read/publication, complete inventory/history/provenance, identity, quiescence, ownership continuity, receipt, and cutover/deletion safety proofs; destination Beads write readiness remains enforced where applicable.
- [ ] #3 Legacy open maps to Backlog In Design and closed maps to Done; closed alone does not imply abandonment or archival, and native status/category, close_reason, context, and history remain recoverable.
- [ ] #4 Inspect every status actually present, including deferred/pinned/hooked or custom statuses; deferred-to-drafts stays an explicit unresolved design question until decided, with no silent omission or guessed mapping.
- [ ] #5 Disposable regression fixtures cover built-in-only source inspection, completed closed issues, full mixed-status inventory, and retained safety failures; no live migration is needed for candidate validation.
<!-- AC:END -->
