---
id: PRIMECLAW-10.37.2
title: 'Implement project assets, initialization, and template reconciliation'
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies:
  - PRIMECLAW-10.37.1
parent_task_id: PRIMECLAW-10.37
priority: p1
type: task
ordinal: 97000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the accepted Markdown asset topology and the idempotent Prime Claw project initialization/upgrade experience after the discovery ticket freezes relevant Orca and startup contracts.

Scope:
- Centralize shipped Markdown sources and add an explicit asset inventory.
- Install discoverable project skills as regular customizable `.agents/skills` files.
- Install customizable internal workflows under `.prime-claw/workflows` and retire `.ralph/skills` without moving `.ralph/plans`.
- Add tracked `.prime-claw/templates.json` provenance.
- Implement `/initialize-prime-claw`, `initialize_prime_claw`, nearest-Git-root/HOME-boundary rules, and safe collision handling.
- Implement baseline-hash upgrades, accepted project overrides, safe partial reconciliation, comparison/review UX proven by discovery, and global drift backup/reset/preserve behavior.
- Reuse or add Orca registration idempotently without modifying existing metadata.
- Reconcile automatically at qualifying session startup, before prompts, while skipping active Episode worktrees and preserving customizations.
- Update docs and migration behavior.

## Legacy notes

Completed at exact candidate 20595f5. All eight acceptance criteria are satisfied. Final validation: full host non-container suite 666 passed, 1 skipped, 85 container tests deselected, 11 warnings, 75 subtests; focused project initialization 26 Node cases, template review 7, handoff 14, focused Python 12 passed with 3 environment skips; Docker Tier 1 pinned to Prime Agent 0.9.8 passed with offline RPC probe, native first-session resources_discover coverage, immutable image/network absence, and verified teardown. Evidence: .test-results/20261010T184002Z-30504-41292dc5/tier1, manifest status passed and repository HEAD 20595f57e412f179164d5497cd77db085603c91e. Final independent GPT-6 Astra review found no material in-contract defect after direct fixes for all reproduced integration failures. .ralph/plans is unchanged. No Prime Agent source, user-global plugin/runtime, or v0.10 compatibility surface was modified. Docker Desktop ENOSPC was separately recovered without reset/prune/data deletion before the final gate.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The asset inventory and destinations match the parent design and contain one source for every shipped Markdown asset.
- [ ] #2 `.ralph/skills` is migrated away while `.ralph/plans` remains unchanged.
- [ ] #3 Explicit initialization and automatic startup reconciliation pass root, nested CWD, HOME boundary, nested repo, submodule, linked worktree, repeated-run, collision, unknown-file, customization, override, and concurrency tests.
- [ ] #4 The tracked manifest distinguishes safe updates, user customization, and accepted merges across clones and plugin versions.
- [ ] #5 Safe updates apply independently; customized files are never silently overwritten and receive the proven review UX.
- [ ] #6 Existing Orca repository metadata is preserved; absent registration is added idempotently; Orca failure is visible.
- [ ] #7 Startup reconciliation is prompt-safe and produces no separate model turn; active Episode worktrees retain their snapshot.
- [ ] #8 Focused tests, Tier 0, relevant Linux-authoritative coverage, and Docker Tier 1 pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented and validated project asset topology, initialization, safe reconciliation, review/recovery, Orca registration, global drift protection, and v0.9.8 first-session discovery. Host, focused, independent review, and Docker Tier 1 gates pass at 20595f5; no global runtime changes.
<!-- SECTION:FINAL_SUMMARY:END -->
