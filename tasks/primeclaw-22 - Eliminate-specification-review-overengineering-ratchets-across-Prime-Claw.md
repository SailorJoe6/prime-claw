---
id: PRIMECLAW-22
title: Eliminate specification/review overengineering ratchets across Prime Claw
status: In Progress
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels:
  - done-over-perfect
  - overengineering
  - process-failure
  - product
  - workflow
dependencies: []
priority: p0
type: epic
ordinal: 85000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary

Prime Claw has suffered at least two P0 delivery-process incidents in which a practical product goal was converted into a custom high-assurance subsystem. Broad specifications used absolute terms without a bounded threat model. Unrestricted EXPERT reviews then found increasingly remote counterexamples. Owning Conversations promoted technically reproducible findings into durable acceptance blockers, implementations grew, and each larger implementation exposed more review surface. The user had to intervene manually in both cases.

This epic owns the product-level correction across the Prime Claw plugin, project skills, prompts/profiles, planning templates, oversight protocol, validation, and documentation. It also owns the two incident records:

- `prime-claw-5v7.9`: project-wide testing Slice 3 adversarial spec/review ratchet.
- The official-lean role-protocol incident created under this epic.

## General failure pattern

1. A practical outcome is expressed using unbounded terms such as exact, authoritative, atomic, bounded, or fail closed.
2. The spec omits trusted assumptions, realistic failure classes, explicit non-goals, a complexity budget, and an agile learning boundary.
3. The EXPERT contract requires a material-finding-free PASS without a proportionality or likelihood test.
4. Review discovers a technically valid counterexample outside realistic product use.
5. Oversight treats reproducibility plus textual scope as sufficient to accept the finding.
6. The finding becomes a durable requirement and expands implementation/test machinery.
7. Another adversarial review attacks the expanded surface.
8. No enforced stop-loss fires; delivery halts until the operator intervenes.

This is an unbounded rigor ratchet. It is a workflow/product defect, not primarily an implementer or model defect.

## Product correction

Implement the smallest durable controls that break the ratchet:

- Require concise threat model, trusted assumptions, ordinary failure model, and explicit non-goals before implementation readiness.
- Separate product acceptance and required safety from optional hardening and implementation suggestions.
- Change EXPERT review so PASS means no blocker remains inside the approved contract, not no imaginable material finding.
- Require every BLOCK to map to an approved in-model scenario with realistic impact and proportional remediation cost.
- Classify out-of-model discoveries as advisory; an EXPERT cannot expand product scope.
- Require operator approval before a new reviewer-discovered invariant becomes acceptance scope.
- Add an enforced two-review-cycle stop-loss that pauses for operator scope/architecture consultation.
- Add a lightweight complexity/simplification trigger when support machinery grows faster than delivered value or introduces a bespoke transaction/recovery subsystem.
- Prefer topology simplification, ordinary failure handling, and manual recovery from ambiguous states over exhaustive autonomous hardening.
- Treat evidence as diagnostic unless a security-grade attestation product is explicitly requested.
- Preserve agile delivery: ship the smallest safe end-to-end slice, learn from real operation, and harden observed risks.

## Evidence-based hardening and dogfooding

Potential hazards discovered by Experts must not be discarded merely because they do not block today. Record plausible non-blocking findings in a lightweight hardening backlog with the scenario, likely impact, present assumption, and a concrete promotion trigger. Valid triggers include an observed user failure, repeatable dogfood failure, near miss, credible user report, newly approved hard requirement, changed deployment boundary, or evidence that likelihood/impact was materially underestimated.

After the central controls land, keep this epic open for a bounded dogfood window covering the next three qualifying implementation candidate reviews across at least two product areas. Record only lightweight review outcomes: blocker/advisory/spec-question counts, repair-cycle count, whether scope expanded, whether the stop-loss fired, and any real hazard missed by the bounded review. If normal project activity cannot supply that sample within 30 days, the operator may close, extend, or revise the window based on available evidence.

At the end of the window, perform one concise retrospective. Check both failure directions: recurring speculative blocker inflation and genuine hazards that were incorrectly downgraded. Adjust the smallest relevant prompt/skill rule only when evidence supports it. Do not build automated telemetry, scoring infrastructure, or a generalized risk database for this validation.
## Anti-overengineering directive for this epic

Bias toward DONE over perfect. Do not remediate this incident by building another elaborate policy engine, review bureaucracy, generalized risk framework, or state machine. Prefer small edits to existing skills/profiles/templates plus focused validation. Reuse existing episode and approval state. Do not attempt to mechanically classify every theoretical finding or encode every possible complexity metric. When uncertain, use a clear operator consultation boundary rather than more automation.

A technically possible edge case is not automatically a product requirement. The implementation of this epic must itself obey the threat model, complexity budget, two-cycle stop-loss, and proportional review rules it introduces.

## Legacy design

Use a small set of centrally enforced gates. Planning establishes product outcomes, threat model, trusted assumptions, non-goals, and a qualitative complexity budget. EXPERT review is contract-bounded and cannot add requirements. Oversight classifies findings and requires operator approval for scope expansion. After two repair/review cycles, continuation is blocked pending operator consultation. Prefer concise skill/profile/template changes and focused tests over a new orchestration subsystem. DONE over perfect is an explicit product principle. Preserve plausible non-blocking hazards in a lightweight backlog with evidence-based promotion triggers. Dogfood the controls over a bounded sample of real reviews, then tune only from observed false blockers or missed hazards.

## Legacy notes

Created at the operator’s explicit direction after recurrence of the same failure pattern in official-lean compatibility cleanup. Keep the correction small and practical; this epic must not reproduce the incident it fixes.
Operator clarification: preserve plausible Expert edge cases as non-blocking hardening candidates, dogfood the bounded workflow, and promote only from observed experience or newly approved requirements. Validate both false-positive blocking and false-negative hazard risk.
Official-lean corrected spec/plan landed in main commit c24ba6c1e76585193d4f34f0b0b0233846780442. This is one incident recovery input, not completion of the systemic product controls or dogfood window.
DOGFOOD SAMPLE — OFFICIAL-LEAN REDUCED SLICE 1 — 2026-10-06

Contract-bounded review outcome: 1 blocker, 1 advisory, 0 spec questions; 1 repair cycle; scope expansion: no; stop-loss: not fired. The blocker was a real in-model cooperative-lock ordering defect and received a small direct fix plus regression. The advisory aligned receipt/interruption wording without adding transaction machinery. Hostile same-UID and exhaustive crash findings remained non-blocking. Final focused/Tier0/Docker/pinned runtime gates pass. Candidate patch SHA256 `c1a4e11834a359ceb2d442d9329c86b8d73d1f5076be142f8a66091a1904951b`; review report SHA256 `ed310237272b1ac1c30f1d677428ab88b436268064f07869a6c0a8545b0b4ab1`. This is one qualifying dogfood sample for the epic's bounded validation window.
HARDENING CANDIDATE H1 — RECEIPT/ABRUPT INTERRUPTION
Scenario: the supported wrapper does not itself retain an external manager receipt, and abrupt SIGINT/SIGTERM or process death can occur outside the in-process exception rollback path. Current assumption: Gate A is separately authorized, captures coordinator preimages before mutation, and uses guarded manual known-state recovery; exhaustive crash handling is outside the trusted-local baseline. Likely impact if mishandled: manual recovery may be required after an interrupted activation, but unknown state is preserved rather than guessed. Promotion triggers: a repeatable dogfood interruption failure, operator near miss, user report, Gate A evidence showing preimages are insufficient, changed trust/deployment boundary, or a separately approved hard requirement. Do not implement a transaction journal merely to close this advisory.
Operator clarified owner authority: the owning Conversation autonomously fixes confirmed in-contract defects, backlogs unproven hardening, and rejects out-of-scope findings. Stop-loss requires owner reassessment; only genuine scope/product expansion returns to the operator. This is intended to reduce review ratchets while preserving accountability.
Section 25 dogfood: an exact public-API blocker was real, but its sender/target requirement overconstrained the product. Owner used an independent upstream expert to replace it with a supported child-self-identity/private-state design rather than patching upstream or accepting permanent blockage. Keep the replacement purpose-built and apply the two-cycle stop-loss.
Generation A exact review at f2f3fcd produced five reproducible ordinary-operation BLOCKs, all accepted in-contract (coordinator observation/readiness/rollback and bundle symlink/metadata seams). This is a positive bounded-review sample, not a scope-ratchet: hostile races/general transactions remain rejected; repair is grouped into two existing seams and requires one renewed exact candidate review.
Generation A repaired candidate ed42db9 passed the renewed exact Astra/max review with all five ordinary-operation findings independently resolved. This is a bounded dogfood success: one actionable review/repair cycle, no hostile-model expansion, and the historical BLOCK/report remain preserved.
Gate A dry validation found a concrete missed interface fact after PASS: supported Prime Agent 0.9.8 emits --version on stderr while the coordinator checked stdout only. Treat this as ordinary-operation evidence that exact reviewers must exercise real CLI stream behavior, not only recording fakes. Bounded repair stays in the existing seam; no scope expansion.
The 47d2d49 review found a real adapter-boundary test gap: recording fakes skipped Python universal-newline conversion. Owner stop-loss accepts one version-specific raw-capture fix while forbidding general runner redesign. This is a reusable review lesson: exact byte contracts require exercising the production adapter, but the remedy stays at the narrow seam.
CENTRAL GUARDRAILS LANDED — 2026-10-07
Commit `886cd9262b12e4fd9ac35336ef9d0caeb3342232` implements the bounded cross-project correction without a new policy engine or state machine. Specification authoring, planning, implementation readiness, and execution now require a practical outcome, concise threat model, trusted assumptions, ordinary failure model, explicit non-goals, evidence-preserving manual-recovery boundary, qualitative complexity budget, acceptance-vs-hardening separation, and operator-only promotion of reviewer-discovered scope. Planning and owner oversight enforce a two BLOCK→repair→renewed-review cycle stop-loss for the same slice acceptance attempt across successor commits, plus a simplification checkpoint when support machinery grows faster than value. The official EXPERT rubric now blocks only concrete in-model violations with realistic impact and proportionate remediation; PASS means no in-contract blocker or required specification decision remains. Advisories carry scenario, impact, assumption, and promotion trigger. Execution cannot implement them automatically.

Validation: focused policy tests 66 passed; `scripts/test-all.sh` passed Tier 0 (450 passed, 185 skipped) and Docker Tier 1 against pinned Prime Agent 0.9.8; Tier 2 was intentionally not requested. An independent read-only audit found and prompted the execution-stage guard plus successor-commit cycle wording; no runtime schema or automation was added. Commit is pushed and main is synchronized.

The central-control implementation milestone is complete. Keep this epic open for its bounded post-land dogfood window: the next three qualifying implementation candidate reviews across at least two product areas, followed by the concise retrospective or explicit operator disposition. Pre-land incident recoveries remain historical evidence and do not silently satisfy the post-land sample.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Both incident Beads are children of or durably linked as owned incidents of this epic, with evidence and course corrections preserved.
- [ ] #2 Design/spec/plan readiness requires concise product outcomes, threat model, trusted assumptions, explicit non-goals, ordinary failure model, manual-recovery boundary, and a qualitative complexity budget.
- [ ] #3 The official EXPERT contract defines BLOCK only for a concrete violation inside the approved threat model; plausible non-blocking edge cases are recorded as advisory hardening candidates rather than discarded or promoted automatically.
- [ ] #4 Oversight durably classifies findings as in-contract blocker, hardening backlog, out of scope, specification defect, or operator decision; only the operator may promote new product scope.
- [ ] #5 Each hardening candidate records a scenario, likely impact, current assumption, and concrete promotion trigger such as an observed failure, near miss, credible user report, approved hard requirement, or changed deployment boundary.
- [ ] #6 A two-review-cycle stop-loss is enforced: a third repair cycle requires operator scope/architecture consultation rather than automatic handoff.
- [ ] #7 A lightweight simplification trigger pauses work when support machinery or recovery states grow materially faster than product value; it recommends deletion/topology simplification before more hardening.
- [ ] #8 Existing workflows remain usable and backward-compatible where practical; focused tests prove the new gates without introducing a new generalized policy engine or large state machine.
- [ ] #9 Documentation teaches DONE over perfect, proportional risk, agile vertical slices, diagnostic evidence by default, evidence-based hardening, and manual recovery for ambiguity.
- [ ] #10 The remediation receives one normal independent review against this bounded contract. Optional adversarial red-team review requires explicit operator authorization and cannot block the baseline contract.
- [ ] #11 After controls land, the epic remains open for the next three qualifying implementation candidate reviews across at least two product areas. Lightweight observations record finding classifications, repair cycles, scope expansion, stop-loss use, false blocker inflation, and any genuine hazard incorrectly downgraded. If the sample is unavailable within 30 days, the operator decides whether to close, extend, or revise the window.
- [ ] #12 One concise post-dogfood retrospective checks both overengineering and under-protection, makes only evidence-backed minimal adjustments, and avoids new telemetry/scoring infrastructure.
- [ ] #13 The epic is closed only after both live incident recoveries are reconciled, central product controls are implemented/tested/documented/pushed, and the bounded dogfood retrospective is complete or explicitly dispositioned by the operator.
<!-- AC:END -->
