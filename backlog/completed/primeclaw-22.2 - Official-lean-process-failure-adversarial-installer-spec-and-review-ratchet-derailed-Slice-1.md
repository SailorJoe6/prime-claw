---
id: PRIMECLAW-22.2
title: >-
  Official-lean process failure: adversarial installer spec and review ratchet
  derailed Slice 1
status: Done
assignee: []
created_date: '2026-10-12 01:01'
labels:
  - done-over-perfect
  - incident
  - official-lean
  - overengineering
  - p0
  - process-failure
  - product
  - workflow
dependencies: []
parent_task_id: PRIMECLAW-22
priority: p0
type: bug
ordinal: 87000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary

Slice 1 of official-lean compatibility cleanup went off the rails. A practical goal—install a neutral Prime Claw role kernel while preserving user context and a reversible migration path—became a custom high-assurance filesystem transaction, crash-recovery, and receipt-authority engine.

The specification contained broad exactness, concurrency, rollback, and fail-closed language without a bounded threat model. Two unrestricted exact-commit EXPERT reviews then promoted hostile same-user filesystem races, inode substitution, journal/receipt replacement, power-loss durability boundaries, and object-type swaps into P1/P2 acceptance blockers. Each repair enlarged the manager and probe, creating new states for the next review to attack.

The operator intervened on 2026-10-06, ordered the current F1–F9 expansion stopped immediately, and approved a realistic local-product contract that biases toward DONE over perfect. The episode is paused safely with its worktree and evidence intact while the specification and plan are corrected.

## Steps to reproduce the process failure

1. Specify a local installer using unbounded requirements such as exact restoration, authoritative receipt state, atomic mutation, concurrent-change rejection, and fail closed, without declaring the same-UID host user trusted.
2. Ask a maximum-reasoning EXPERT for a material-finding-free adversarial PASS.
3. Accept every reproducible filesystem race or crash boundary as an in-scope blocker.
4. Add each finding to the durable plan and repair contract.
5. Expand custom journaling, locking, descriptor authority, exchange/restore, fsync, receipt, and recovery machinery.
6. Review the larger implementation again under the same unrestricted rubric.
7. Continue until the operator stops the ratchet.

Exact candidate sequence: `1eba414` → `f4b858c` → uncommitted F1–F9 repair. The first two candidates passed substantial functional gates before fresh owner reviews found additional adversarial blockers.

## Severity and impact

Priority P0: critical delivery/process failure, not a production security incident.

- Slice 1 never reached acceptance; Slice 2 and both activation generations remained blocked.
- The manager grew from 669 lines at `1eba414` to 1,830 at `f4b858c` and 2,859 in the paused draft.
- The container probe reached 2,106 lines; the overall Slice-1 delta was about 6,777 insertions.
- Two published candidates were rejected and a third large repair remained uncommitted.
- Review and repair consumed repeated full host, Docker, pinned-runtime, and exact-commit gates.
- A host reboot interrupted repair work.
- Repeated upstream provider false positives poisoned the episode context; the owner had to perform a native in-place `SessionManager.branchWithSummary()` recovery while preserving episode identity and worktree state.
- The user had to identify and stop the perfection loop manually.

No production credentials or private data were exposed. No user-global apply, runtime restart, merge, activation, finalization, or cleanup occurred. The owner preserved all rejected candidates, reports, rollback material, and the exact paused draft.

## Incident timeline

### Initial candidate

Candidate `1eba414c2157740afb45dba4661a95d9a6d63785`, tree `4476add0646c69a07481831c1fb913929ec5b6b9`, passed Tier 0, Docker Tier 1, and pinned Prime Agent 0.9.8 gates. Owner review correctly found serious practical defects, including a receipt-integrity flaw that could delete an unrelated file. The complete BLOCK report SHA-256 was `409e6a838d5da82b387fb45f6e2696892af405a636b9afc5be6ccd9d6ddacb83`.

The first repair should have fixed the concrete deletion/path/receipt problems and then triggered a threat-model reassessment before accepting broader transaction guarantees.

### First hardened replacement

Candidate `f4b858cbd92cf43c86fac49de60d43e9daa9342b`, tree `59ce698d33bd8778829914bd2d50fdbdd1248e65`, again passed extensive manager, Tier 0, Docker, and pinned-runtime gates. Fresh maximum-reasoning review found F1–F9: later concurrent overwrite, receipt authority loss, journal replacement timing, contradictory creation ownership, hard-exit rollback state, parent fsync, rebound staged source, stale final authority, and FIFO swap.

The report SHA-256 was `15f7fb824428cafb17ad1a08148c3499eaae682f3eef650b65f7f7f9e00d77b5`. The findings were technically grounded in the broad text, but most represented a hostile same-user or exhaustive crash-consistency contract not justified by the product.

### F1–F9 expansion and operational recovery

The episode implemented a large uncommitted repair, including further F7/F8 exact-inode and atomic-exchange refinements. A reboot and later provider false positives increased coordination cost. The owner recovered the same episode in place without changing its identity or worktree. Recovery evidence manifest SHA-256: `aa4bcc51938a05c707f5c22733e5952fa2aac349becdad6138e1d6f3d1240e78`.

### Operator intervention

The operator challenged the plausibility and value of the expanding requirements. The owner measured the implementation growth, agreed that the work had become disproportionate, paused the episode, and then received the explicit order: “Stop extending the current F1–F9 state machine immediately.”

Pause state:

- Episode `01a10774-0155-7316-a329-50ee5f7d17be`, route `e24204e3df98`, is idle and awaiting input.
- HEAD and remote remain `f4b858cbd92cf43c86fac49de60d43e9daa9342b`.
- Six expected files remain modified and uncommitted.
- Preserved binary diff SHA-256: `15c8399ac44c642484997716a08e85827bcc72bed1f29587cad9531ffee4ba1b`.
- No tests, tools, child reviewers, queued actions, or monitoring heartbeat remain.

## Root causes

- The spec converted product outcomes into universal implementation invariants before empirical learning.
- Reliability, accidental concurrency, malicious same-user behavior, and exhaustive power-loss durability were conflated.
- The EXPERT profile required a material-finding-free PASS and had no threat-model, likelihood, product-value, or proportionality filter.
- Oversight treated reproducibility and textual scope as sufficient to accept findings.
- Reviewer discoveries ratcheted acceptance scope without a fresh operator product decision.
- No two-cycle or complexity stop-loss existed.
- Automatic recovery from ambiguity was preferred over preserving evidence and asking the operator.

## Approved course correction

Use a trusted-local-operator, ordinary-failure model and bias toward DONE over perfect.

Retain:

- deterministic selection of the supported global context file;
- preservation of unrelated user bytes, newline style, mode, and ownership where normally supported;
- clear managed markers and drift detection;
- cooperative locking and rejection of obvious symlinks/non-regular files;
- ordinary atomic replacement and practical durability;
- exact receipt inventory/preimages for files this operation owns;
- restore only when current state matches a known installed state;
- safe refusal plus manual recovery when state is ambiguous;
- isolated Docker-authoritative tests and honest documentation.

Do not make these acceptance blockers:

- hostile same-UID races between individual syscalls;
- continuous descriptor/inode authority across every transition;
- malicious receipt/journal substitution by the local owner;
- power-loss proof at every fsync/rename boundary;
- autonomous recovery from every possible mixed transaction state;
- arbitrary FIFO/ABA/namespace swaps after ordinary validation;
- cryptographic or transaction-database evidence guarantees.

The corrected design should remove obsolete machinery and tests rather than merely weaken prose around the existing state machine. One normal independent final review is sufficient and must remain inside the reduced contract.

## Anti-overengineering directive

The implementer must not repeat this incident while fixing it. Bias toward DONE over perfect. Prefer deletion, straightforward file operations, existing Python/OS primitives, and manual recovery for ambiguous states. Do not introduce a new journal protocol, generalized transaction framework, policy engine, adversarial-race harness, or exhaustive crash matrix. A theoretical same-user edge case is advisory unless the revised product contract explicitly includes it. After two review cycles, stop and consult the operator rather than adding another repair generation.

## Evidence

- Specification: `.ralph/plans/future/official-lean-compatibility-cleanup/SPECIFICATION.md`
- Plan: `.ralph/plans/future/official-lean-compatibility-cleanup/EXECUTION_PLAN.md`
- Active implementation plan: `.ralph/plans/EXECUTION_PLAN.md` in the episode worktree.
- Main tracking Bead: `prime-claw-h6w.30`.
- First rejected candidate/report: `1eba414c` / SHA-256 `409e6a838d5da82b387fb45f6e2696892af405a636b9afc5be6ccd9d6ddacb83`.
- Second rejected candidate/report: `f4b858c` / SHA-256 `15f7fb824428cafb17ad1a08148c3499eaae682f3eef650b65f7f7f9e00d77b5`.
- Paused draft SHA-256: `15c8399ac44c642484997716a08e85827bcc72bed1f29587cad9531ffee4ba1b`.
- Context-recovery evidence manifest SHA-256: `aa4bcc51938a05c707f5c22733e5952fa2aac349becdad6138e1d6f3d1240e78`.

## Legacy design

Preserve the paused draft as immutable incident evidence, then rebaseline the existing episode around a trusted-local ordinary-failure contract. Simplify the implementation instead of extending F1–F9. Use ordinary locking, validation, atomic replacement, exact owned inventory, and safe manual refusal. Remove adversarial race/crash machinery and tests. Perform focused functional gates and one proportionate final review. DONE over perfect.

## Legacy notes

Created at the operator’s explicit request after the official-lean Slice-1 scope intervention. This records a delivery-process failure, not a production breach. Live recovery remains on prime-claw-h6w.30 and the existing episode.
OPERATOR-APPROVED DONE-OVER-PERFECT CORRECTION — 2026-10-06
Primary main commit `c24ba6c1e76585193d4f34f0b0b0233846780442` rewrites the official-lean specification and plan around a trusted-local ordinary-failure model. Specification SHA256 `59532032aa2c4750050d88e4c004b276a2f9a2736c6631ff80b596147d2e047f`; future plan SHA256 `70444d8d0fa1051d981020bcf6f314a875390a5ca5411b1c265d83a7aa9c33a8`. The contract now treats hostile same-UID races, exhaustive crash/power-loss boundaries, continuous inode authority, and autonomous mixed-state recovery as advisory hardening unless promoted by dogfood, a user report/near miss, changed boundary, or separately approved hard requirement. It requires simple locking/validation/atomic replacement/fixed-inventory receipt/manual refusal, proportional one-pass review, a two-cycle stop-loss, and DONE over perfect.

Before changing the active episode plan/spec, the exact paused six-file F1–F9 draft was preserved at `/Users/jlanders/.prime/agent/session-artifacts/01a0f51d-d51b-7649-a28a-844879e42aec/official-lean-scope-reduction-20261006T041523Z`. Patch SHA256 `15c8399ac44c642484997716a08e85827bcc72bed1f29587cad9531ffee4ba1b`; manifest SHA256 `d58d4c1c8a34d84f89d88ab19741e035a82e158133cce0546b0f1557c2fca2a8`; reverse apply check passed against the paused worktree. Active episode specification SHA256 `59532032aa2c4750050d88e4c004b276a2f9a2736c6631ff80b596147d2e047f`; active plan SHA256 `e06f3deaa1eb50b96a7e0a3d7484b77f314984e6bf0fe3422f246518dd1ae223`. The code draft remains uncommitted for the episode to simplify; no owner code implementation, Slice 2, activation, landing, global mutation, or restart occurred.
INCIDENT REMEDIATION CANDIDATE — 2026-10-06

The existing episode materially simplified the paused F1–F9 state machine under the approved DONE-over-perfect contract. Final patch SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b`; manager 1294 lines (paused draft 2,859), probe 556 lines (paused 2,106). The concrete unrelated-file receipt deletion defect remains covered; hostile same-UID/exhaustive crash machinery is gone.

One bounded review produced one legitimate cooperative-lock BLOCK (report SHA256 `ed310237272b1ac1c30f1d677428ab88b436268064f07869a6c0a8545b0b4ab1`), fixed directly with an exact interleaving regression. No scope expansion and no second review. Final focused/Tier0/Docker/pinned-0.9.8 gates pass. Keep this incident open until owner acceptance and reconciliation; no activation or later-slice authority is implied.
REDUCED SLICE 1 COMMITTED — 2026-10-06
Commit `57d26e582c583a81de370051b129f74f5b13ee45`; tree `d1739c3a2ffee4512d6741480b72792e3a8d4098`; parent `f4b858cbd92cf43c86fac49de60d43e9daa9342b`; exact commit patch SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b` matches the fully gated post-review repair patch. Branch push and synchronization verification follow. This is a candidate for owning-Conversation acceptance only; it grants no landing, activation, Slice 2, restart, UAT, finalization, bookkeeping, or cleanup authority.
PUSH VERIFIED — 2026-10-06
Local HEAD, tree, upstream, and independently read remote branch are `57d26e582c583a81de370051b129f74f5b13ee45` / `d1739c3a2ffee4512d6741480b72792e3a8d4098`. Worktree is clean and branch is synchronized. `bd sync` is unavailable in this installed bd CLI (`unknown command`); direct Beads updates above succeeded in the shared store. Slice 1 candidate awaits owning-Conversation review.
OWNER ACCEPT — CORRECTED SLICE 1 — 2026-10-06
Accepted exact commit `57d26e582c583a81de370051b129f74f5b13ee45`, tree `d1739c3a2ffee4512d6741480b72792e3a8d4098`, parent `f4b858cbd92cf43c86fac49de60d43e9daa9342b`, commit patch SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b` under the trusted-local ordinary-failure DONE-over-perfect contract.

Reconciliation: local HEAD, upstream, and independently read remote branch all equal the candidate; worktree is clean. The same episode `01a10774-0155-7316-a329-50ee5f7d17be` remained active and no Slice 2, landing, user-global apply, restart, UAT, finalization, bookkeeping, or cleanup occurred.

The sole independent review of pre-repair patch `ce9efae1c6ff52a1b6367aa7501f3bd2c2177aa78fa053dfd438390124dc03c9` returned one valid in-model BLOCK: mutable destination preflight preceded the cooperative lock. Report SHA256 `ed310237272b1ac1c30f1d677428ab88b436268064f07869a6c0a8545b0b4ab1`. Owner compared the final commit directly with the reviewed patch: the repair only removes the wrapper's unlocked preflight, moves mutable destination validation and restored-receipt current-state validation behind `flock`, adds the exact writer-A-intermediate/writer-B-waits regression, and narrows interruption wording. Final full patch matches preserved post-repair artifact SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b`. No second adversarial review was required; the owner verified the bounded repair and found no remaining in-contract blocker.

Final evidence: focused practical Linux matrix 10 passed; Tier 0 291 passed/167 skipped log SHA256 `3991669f5f79889aaf02d76650e2db25542c3d2647dd077fde9ae0dfdcaa8f80`; Docker Tier 1 60 passed/398 deselected log SHA256 `a0dac3c10f4225ae22274919f1b0ebacef2b1211b5cbbb2dfeb6a92b32d900a2`; pinned Prime Agent 0.9.8 probe PASS log SHA256 `4efbafd62d5e4c4f47c630d164d852d7612f1da0fe2be75287019f84c1eeaa0a`.

The review advisory about wrapper receipts and abrupt interruption is not a Slice-1 blocker. Current docs truthfully require Gate A coordinator preimages/manual recovery. It is retained on `prime-claw-gv7` with evidence-based promotion triggers. Slice 1 is accepted; only canonical handoff may begin Slice 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 This incident remains linked to the cross-project overengineering-ratchet epic and preserves both rejected candidates, reports, context-recovery evidence, and the paused draft hash.
- [ ] #2 The official-lean specification, future plan, and active episode plan state the trusted-local threat model, ordinary failures, explicit non-goals, manual-recovery boundary, qualitative complexity budget, and DONE-over-perfect principle.
- [ ] #3 The paused F1–F9 draft is preserved as a hashed external artifact before destructive simplification or restore.
- [ ] #4 The existing episode—not a replacement episode—removes or stops enforcing obsolete adversarial state-machine machinery and tests while retaining practical installer safety and accepted prior behavior.
- [ ] #5 Focused functional, Tier 0, Docker Tier 1, and pinned-runtime gates pass under the reduced contract.
- [ ] #6 One normal independent review evaluates only the reduced contract. Excluded same-user adversarial hardening is advisory and cannot block.
- [ ] #7 No Slice 2, landing, user-global apply, restart, UAT, finalization, or cleanup occurs without its existing separate operator authorization.
- [ ] #8 The incident closes only after the reduced Slice-1 candidate is owner-accepted, committed, pushed, and reconciled, and the systemic epic references the final remediation evidence.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Corrected Slice 1 accepted at 57d26e5; incident evidence preserved and systemic remediation/dogfood continues under prime-claw-gv7.
<!-- SECTION:FINAL_SUMMARY:END -->
