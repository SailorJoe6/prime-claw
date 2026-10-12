---
id: PRIMECLAW-10.37.1
title: Probe Orca and Prime Agent integration and freeze the final design
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10.37
priority: p1
type: task
ordinal: 96000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run an evidence-first discovery phase before freezing or implementing the Prime Agent/Orca boundary for the simplified Conversation lifecycle.

Scope:
- Probe Orca worktree creation, parentage, status, cleanup, and uncertain outcomes.
- Distinguish Orca's separate `pi` TUI ID from the native `prime-agent` provider, then prove background worktree/session creation, CWD, preparation, initial-prompt admission, returned identities, operator GUI behavior, and daemon visibility.
- Prove messaging and observation interoperability from the owning Conversation, including restart/recovery behavior.
- Probe project registration and multiple project-location data used by the host picker.
- Probe remote placement, exact approved-bundle transport, and failure behavior without exposing credentials.
- Distinguish Orca automations/orchestration from Prime Agent heartbeats/RLM using observed contracts, and prove the narrow disabled-automation provider-launch seam after deterministic bundle promotion.
- Test Orca branch-name/reuse capabilities across GUI/RPC/CLI surfaces and Orca ADE review options for safe current-versus-template comparison.
- Test `session_start` reconciliation ordering, including Orca launch with an initial prompt, and `session_compact` reinjection mechanics.
- Classify when a pre-mutation Orca failure can safely use the local fallback versus when partial/uncertain state must be preserved.

Deliver an evidence matrix with reproducible commands/results, documented constraints, and an updated final design on the parent Bead. Do not implement the production lifecycle in this ticket; disposable probes and focused test fixtures are allowed.

## Legacy notes

Final-review checkpoint 2026-10-10: GPT-6 Astra found the promotion ordering and duplicate daemon assignment defects resolved. Its sole remaining finding was that the first template fixture restored before proving the lazy-loaded diff stayed usable. Corrected fixture `prime-claw-template-review-lifetime-0150` used prepared commit `bcc5974`: clean tracked regular-file guard passed; dirty tracked and symlink guards refused; the upstream overwrite remained while a focused Orca side-by-side view visibly showed customized versus upstream and a separate check returned `REVIEW_DIFF_STILL_HELD`; explicit completion, cancellation, and injected selector-error paths each restored clean; interrupted state was preserved for an explicit decision and manually restored clean. Terminal, worktree, path, and fixture branch were removed. The fixture also exposed an operator UX/safety defect: foreground focus happened without warning, and an attempted Orca Computer Use observation triggered an unexpected macOS Accessibility-control request. No permission was granted. Final contract requires an explanatory user ready/cancel gate before overwrite or focus, makes cancel-before-ready a no-op, and forbids Orca Computer Use/macOS Accessibility/other OS GUI control without separate explicit approval. Evidence matrix and parent contracts are updated. Next: final validation, commit/push, close this Bead, persist closure receipt, and verify .33.2/.33.3 ready.

Validation receipt 2026-10-10: evidence matrix status frozen; 23/23 matrix IDs unique; docs README link present; evidence and index have no broken local Markdown links; required lifetime/completion/cancellation/error/interruption receipts present; changed-doc secret-pattern scan empty; `git diff --check` clean; Beads dependency graph has no cycles; parent/child contracts contain the ready/cancel gate and no-unapproved-GUI-control boundary; exact temp automation list empty; all disposable probe worktrees/paths/branches absent. Host-safe Tier 0: 654 passed, 76 skipped, 11 warnings, 75 subtests passed in 57.68s. HEAD and origin/main both 1cbd801 before commit.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A checked-in evidence matrix covers every required local, remote, session, messaging, restart, automation, diff, startup, compaction, and fallback probe.
- [ ] #2 Each conclusion cites observed output or a version-matched public Orca/Prime Agent contract.
- [ ] #3 Native `prime-agent` creation is proven end to end after deterministic bundle promotion: separate background worktree, disabled reusable existing-workspace launch automation, exactly one assignment, visible exact-CWD durable session/tab, automation removal with the session retained, unchanged operator selection, and later native supervision. `pi` is correctly recorded as a different TUI agent ID.
- [ ] #4 Remote exact-bundle transport is either proven end to end or remains disabled in the final design.
- [ ] #5 Startup reconciliation does not lose or race an Orca-provided initial prompt in the tested design.
- [ ] #6 The parent Bead's design and acceptance criteria are updated to match evidence, with assumptions removed.
- [ ] #7 No production Episode lifecycle is implemented under this ticket.
- [ ] #8 Template-review evidence proves the overwrite remains until focused review completes/cancels and cleanup restores clean; final design adds a ready/cancel gate before overwrite or foregrounding, conservative interruption recovery, dirty/non-restorable refusal, and no unapproved OS GUI-control/Accessibility use.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Evidence-first discovery complete. Corrected design proves background native prime-agent UX, promotion-before-execute via transient disabled reusable automation, exactly one provider assignment, durable exact-CWD recovery, accurate Orca branch capabilities, explicit ready/cancel-gated template review with held focused diff and verified restore, conservative interruption recovery, and no unapproved GUI-control/Accessibility use. Final independent review has no remaining material finding. Tier 0: 654 passed, 76 skipped, 75 subtests.
<!-- SECTION:FINAL_SUMMARY:END -->
