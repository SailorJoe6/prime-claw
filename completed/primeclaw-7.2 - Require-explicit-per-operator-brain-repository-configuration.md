---
id: PRIMECLAW-7.2
title: Require explicit per-operator brain repository configuration
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-7
priority: p1
type: task
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove the personal JLandersZen/brain repository from tracked runtime defaults and code fallbacks. Every operator must explicitly configure brain_repo through ignored local config or PRIME_CLAW_BRAIN_REPO. Commands that require a brain repository must fail before mutation with clear setup guidance. There is intentionally no public starter/example brain. Update plans/docs/tests/evidence and preserve Joe local behavior through ignored configuration.

## Legacy notes

Planning-only update requested by operator. R3a-16 / D3a-N / Slice 4R now require every operator to configure brain_repo via ignored local config or PRIME_CLAW_BRAIN_REPO. No tracked/fallback/public/example brain is permitted. Missing/malformed setup must fail before mutation with clear guidance. This bead is intentionally OPEN for a future /execute; no runtime or code implementation was performed in this session. Slice 4B is blocked on this correction.
Handoff checkpoint: planning commit 023ac25 is pushed and the repository is clean/synchronized. Beads plus active .ralph/plans/{SPECIFICATION,REQUIREMENTS,DECISIONS,EXECUTION_PLAN}.md are authoritative; prior JSONL conversation is useful but not authoritative. This OPEN P1 bead is the next implementation task for future /execute. No code/runtime changes were made. Acceptance remains: remove tracked/code brain_repo defaults, require ignored-local or PRIME_CLAW_BRAIN_REPO, clear pre-mutation failure, no public/example brain, preserve Joe value only in ignored local config, tests/inventory green. S4B is blocked until this closes.
Slice 4R implementation complete. Removed tracked/code brain_repo default; repository identity now comes only from PRIME_CLAW_BRAIN_REPO or canonical ignored .prime-claw/runtime.local.json. Common pre-mutation gate covers status/create/converge/validate/recover/embedding-build/direct clone and validates repo, branch, path, host, attempts, and delay. Hardened local provenance against base/overlay forgery and clone shell interpolation. Joe proving-instance value moved to ignored mode-0600 local config; existing private local settings preserved and not recorded. Evidence: docs/derisk/3a-slice4r.md. Tests: 50 focused passed; canonical pytest -q tests = 228 passed, 11 warnings; inventory = 2 passed; operator-local create dry-run PASS with no private endpoint emitted. Independent final review: no unresolved medium/high findings. Live sandbox/providers/databases/indexes were not mutated. S4B is now next.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No tracked runtime/code default names a personal or example brain repository; create/converge and direct brain-clone fail before mutation when brain_repo is absent; error explains PRIME_CLAW_BRAIN_REPO and .prime-claw/runtime.local.json; explicit local/env config works; offline suite and inventory pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 4R complete: explicit operator brain repository gate implemented, documented, tested, and independently reviewed
<!-- SECTION:FINAL_SUMMARY:END -->
