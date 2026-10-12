---
id: PRIMECLAW-22.1
title: >-
  Testing strategy process failure: adversarial spec and review ratchet derailed
  Slice 3
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:01'
labels:
  - incident
  - overengineering
  - p0
  - process-failure
  - testing-strategy
dependencies: []
references:
  - PRIMECLAW-20
  - PRIMECLAW-20.5
parent_task_id: PRIMECLAW-22
priority: p0
type: bug
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Summary

Slice 3 of the project-wide testing strategy went completely off the rails. A practical goal—run a real gbrain/PostgreSQL integration test inside disposable Docker without touching production state—was converted into a custom high-assurance orchestration and evidence system. The specification accumulated adversarial same-user filesystem, exact-inode publication, signal-transaction, and cryptographic evidence guarantees that were not required by the product threat model. Independent Expert reviews were then prompted as unrestricted red-team audits and repeatedly promoted increasingly remote edge cases into P1/P2 acceptance blockers.

The result was a self-reinforcing spec/review ratchet: each repair enlarged the implementation and test surface, which created more locations for the next adversarial review to challenge. Slice 4 stayed blocked while Slice 3 consumed multiple candidates, many hours of tests and review, a system reboot/recovery, repeated stale-session supervision, and thousands of lines of churn.

On 2026-10-06 the operator explicitly rejected the adversarial-security contract, required a trusted-host ordinary-failure model, and directed the project to **bias for DONE over perfect**. The Episode was paused safely and resumed under a reduced practical contract.

## Steps to Reproduce

This is a process failure, reproduced by the sequence used in Slice 3:

1. Start with a practical Docker integration-test requirement but describe provenance, cleanup, signals, and evidence with unbounded terms such as “exact,” “authoritative,” “bounded,” and “fail closed,” without declaring the host/same-UID user trusted.
2. Ask an Expert for unrestricted findings-first adversarial review and require a material-finding-free PASS.
3. Promote every reproducible same-UID filesystem race, micro-signal timing case, malformed receipt permutation, and evidence-publication fault into a P1/P2 acceptance blocker.
4. Add each finding to the durable specification and implement custom authority, signal, publication, and evidence machinery.
5. Run another unrestricted adversarial Expert over the larger implementation.
6. Repeat steps 3–5. The review surface and blocker count continue to grow while the core Docker test already functions and later slices remain blocked.

The exact project reproduction is the candidate/review sequence documented below: `6d6f7ee` → `22e41a0` → `659a293`, with each candidate passing substantial functional gates before the next adversarial review discovered new mandatory edge conditions.

## Severity and impact

**Priority: P0 — critical project/process failure.** This was not a production security incident and no production data or credentials were exposed. It is P0 because the specification and review process created a runaway delivery failure that could indefinitely prevent completion of the testing strategy.

Impact:

- Slice 3 required three published candidates and repeated internal repair generations before the scope intervention.
- Later slices remained closed for the entire incident.
- The harness grew into a custom filesystem-capability, signal-supervision, exact-publication, and evidence-validation subsystem rather than a Docker test tier.
- Host suites grew from the earlier hundreds of tests to 559 passed / 149 skipped / 130 subtests on the last pre-scope-reduction candidate.
- Large repairs repeatedly changed hundreds to more than a thousand lines across driver, provenance, supervisor, tests, plans, and evidence.
- The owning Conversation spent substantial time supervising repeated reviews, recoveries, heartbeats, evidence reconciliation, and handoffs instead of advancing the testing roadmap.
- A system reboot interrupted an in-flight repair. State was preserved, but recovery added more coordination cost.
- The user had to intervene directly to stop the perfection loop.

## Incident timeline

### 1. Practical integration tier became a high-assurance subsystem

The approved Slice-3 goal included real disposable gbrain + PostgreSQL 16 + pgvector testing, synthetic fixtures, offline runtime, pinned artifacts, provenance, and teardown. During implementation and review, words such as “exact,” “bounded,” “truthful,” “authority,” and “fail closed” were interpreted as security invariants against a hostile same-UID local process and adversarial OS timing.

The threat model was never explicitly bounded against delivery cost. Evidence receipts became an authoritative transaction protocol rather than diagnostic test output.

### 2. Initial candidate rejected

Candidate `6d6f7ee7bbb208b88c798fe4c469188930f07579` ran the real stack twice and had an internal PASS. Fresh owner review correctly found defects under the then-current contract, including dropped path authority, signal-restoration false-green evidence, malformed Docker label handling, and caller-pending signal ownership.

Owner BLOCK report:

- Path: `/Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-0946e302/slice3-6d6f7ee-owner-review.md`
- SHA-256: `1e8e1f94f19221e6682a1dc17b4cc0e56fc78f9b503445f05bd591523ca5c759`

Instead of reassessing whether the contract was reasonable, all findings were accepted and added to the implementation burden.

### 3. First major hardening replacement rejected

Candidate `22e41a0ed39070017a92b7beddc4b2440ed33b05` added extensive filesystem authority, signal, cleanup, and evidence hardening. Its owner review found five more blockers: authority transfer gaps, restoration-slot signal races, publication-namespace failure, caller-blocked signal loss, and unbounded final rereads.

Owner BLOCK report:

- Path: `/Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-791d8992/slice3-22e41a0-owner-review.md`
- SHA-256: `155ec9b098df03b4cdbdfded7a52cbfd61d460dcc099edf0b1c32cb2c8ad1eb1`

Again, the process accepted every adversarial condition as mandatory rather than challenging the threat model.

### 4. Second hardening cycle multiplied complexity

The next repair introduced provisional evidence, a sole final publisher, retained exact manifest descriptors, bounded readers, signal ownership matrices, continuous snapshot authority, and increasingly elaborate regression fixtures. An internal adversarial audit blocked the uncommitted repair; more repairs and re-audits followed.

A system reboot occurred during this cycle. The worktree and Bead were recovered safely, but the Episode had to reconstruct and continue a large partial repair.

### 5. Second published replacement rejected

Candidate `659a293b461f5bbcc7c9b2424085a4af08848e7a`, tree `1c786cc7548495df3dd192abe7d70bb32819cc38`, passed extensive source gates and two exact Docker runs. A fresh owner Expert still found two P1 blockers:

1. Prepared Dockerfile/lock leaf authority was not retained through build consumption.
2. Fixed container UID `10001` could not access launcher-owned `0700` bind mounts on ordinary rootful Linux with a different host UID.

Owner BLOCK report:

- Path: `/Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-89287b0e/slice3-659a-owner-review.md`
- SHA-256: `ebc0097bdd5008f66f2666e408b2581c1384726712b9d2179167c73d94729965`

The Linux UID issue was a real portability problem. The prepared-input finding was another consequence of the adversarial exact-authority contract. At this point the operator challenged the entire direction.

### 6. Operator intervention and pause

The operator stated that the volume of issues and repairs was no longer credible for “tests should run in Docker.” The owning Conversation agreed that the work had become a miniature secure operating system rather than a test runner and paused the Episode at a safe boundary.

Pause checkpoint:

- HEAD/tracking remained `659a293b461f5bbcc7c9b2424085a4af08848e7a`.
- Bead `prime-claw-5v7.5` remained `in_progress`.
- An uncommitted nine-file F1 draft was preserved.
- No commit, push, Docker run, handoff, or Slice-4 work occurred after the pause.
- A partially running affected suite was terminated and explicitly excluded from completion evidence.

### 7. Course correction approved

The operator explicitly decided that the adversarial requirements were not worth maintaining and identified both causes:

1. an overengineered specification; and
2. an overzealous Expert review process.

The operator approved a trusted-host ordinary-failure contract and directed the project to **bias for DONE over perfect**.

## What went wrong

### A. The specification had no explicit threat-model boundary

The plan required strong isolation from production state, which was correct. It did not clearly distinguish that boundary from a hostile same-UID process mutating the harness during execution. The latter is not a meaningful security boundary: the same user can also change the checkout, scripts, Git refs, Docker commands, configuration, and retained evidence.

Without an explicit trusted-host statement, every theoretical local race could be interpreted as an acceptance failure.

### B. Evidence was treated as a security product

Test manifests and logs should help diagnose and reproduce failures. They became a transactional evidence protocol expected to remain authoritative through path replacement, namespace corruption, publication failure, exact-inode races, and signals arriving between individual handler-restoration operations.

This added large amounts of code that did not improve the core gbrain/PostgreSQL test coverage.

### C. Review prompts rewarded adversarial novelty

The owner Expert was repeatedly asked for findings-first, adversarial, material-finding-free review across every failure boundary. The prompts did not impose a practical threat model, complexity budget, or “would a normal user encounter this?” filter.

The Expert did what it was asked to do: search for increasingly subtle counterexamples. Because any reproducible contract discrepancy was treated as a blocker, the review process had no natural stopping condition.

### D. Every finding ratcheted the specification

Findings were accepted one by one and durably added to the repair contract. We did not pause early enough to ask whether the aggregate contract still served the original product goal. Every repair enlarged the surface for the next review.

### E. We built custom mechanisms instead of removing the risky topology

The design kept host bind mounts and then attempted to make every path, file, signal, and publication step race-proof. A simpler topology—bake trusted inputs into the image, write results inside the container, and copy them out after stop—removes most of those problems rather than defending every transition.

### F. Cross-platform claims were broader than the exercised environment

The implementation used a fixed nonroot container UID with private host-owned bind mounts. Docker Desktop runs passed, but ordinary rootful Linux permissions were not represented by those receipts. The architecture should have avoided the mismatch rather than adding more permission machinery.

### G. Oversight failed to apply a stop-loss rule

The owning Conversation correctly verified findings against the approved text, but continued accepting and routing repairs after the pattern clearly showed runaway complexity. It should have escalated the threat-model and cost mismatch after the first or second adversarial review, not after the third published candidate.

## What did not go wrong

- No production gbrain, PostgreSQL, Prime Agent, credentials, private data, Docker socket, or operator data mount was used.
- No host ports were exposed.
- Synthetic fixtures and pinned inputs remained intact.
- Slice 1 and Slice 2 accepted boundaries were preserved.
- Bead and evidence checkpoints preserved state across compaction, pause, stale turns, network interruption, and reboot.
- Slice 4 never started early.
- The operator intervention was honored immediately and safely.

## Approved course correction

Slice 3 now uses a **trusted-host ordinary-failure model**.

### Retained practical requirements

- Run the real integration body in disposable Docker.
- Exercise PostgreSQL 16, pgvector, locked public gbrain, synthetic corpus, and local-only Git behavior.
- Never provide credentials, private/operator data, host ports, Docker socket, production mounts, or provider environment.
- Use `--network none` for the assertion runtime.
- Pin relevant external inputs and record a simple tested commit/content/version/result receipt.
- Run nonroot.
- Support ordinary Docker Desktop and rootful-Linux use without relying on incompatible host bind permissions.
- Handle ordinary timeout, SIGINT, and SIGTERM with nonzero status and best-effort cleanup.
- Label resources by run and remove only owned resources.
- Keep tests, docs, inventory, and ordinary pass/fail behavior truthful.

### Explicitly removed requirements

These are optional hardening and must not block completion:

- hostile same-UID path, symlink, FIFO, ABA, or transient namespace races;
- continuous descriptor chains across every ancestor and leaf;
- exact-inode neutralization under corrupted publication namespaces;
- signal injection at individual restoration instructions;
- caller pending-signal transaction proofs beyond normal signal behavior;
- exhaustive malformed Docker daemon JSON fuzzing;
- bounded/tamper-proof rereads of every intermediate artifact;
- cryptographic cross-binding and binding sidecars for every receipt;
- permanent two-run comparator machinery.

### Preferred simplified architecture

1. Create one trusted source snapshot or Git archive.
2. Bake tests and fixtures into the execution image, or copy them into an owned container before execution.
3. Use no host bind mounts for workspace or results.
4. Run nonroot with container-local writable HOME, PostgreSQL data, and result paths.
5. Stop the container and use `docker cp` to copy results out.
6. Remove labelled resources with ordinary best-effort cleanup.
7. Emit one simple receipt containing tested commit/content, image/input versions, command result, and log/result location.

Two runs may be used as acceptance evidence, but the comparator is not permanent public launcher machinery.

## Reviewer guardrail

All future Slice-3 owner or Expert reviews must be limited to the reduced practical contract. A review may block only for:

- a real functional failure under the trusted-host model;
- violation of retained production isolation;
- unsafe deletion of resources not owned by the test run;
- ordinary false-green pass/fail behavior;
- missing real-stack integration coverage;
- materially false documentation about retained requirements.

Excluded adversarial conditions must be labeled optional hardening, not acceptance blockers. Do not launch recursive red-team workers to invent a broader threat model. One normal independent final review is sufficient.

## Corrective and preventive actions

1. Preserve the current nine-file F1 draft as a hashed external patch, then restore the worktree to clean `659a293b` before redesign.
2. Rewrite active Slice-3 plan/spec/docs/inventory to state the trusted-host threat model and removed requirements explicitly.
3. Replace the bind-mount/evidence-supervisor topology with the simpler bake/copy-run/`docker cp`/cleanup flow where practical.
4. Delete or stop enforcing obsolete adversarial tests and machinery rather than carrying dead complexity.
5. Run focused ordinary tests, the full host suite, and one native end-to-end Docker acceptance sequentially.
6. State platform evidence accurately; do not require unavailable remote Linux/amd64 execution to declare the current native implementation done.
7. Perform one normal final review against the reduced contract only.
8. Before future specs are approved, require an explicit threat model, non-goals, complexity budget, and stop condition for review-discovered hardening.
9. Add a review stop-loss: after two repair/review cycles on one slice, the owning Conversation must reassess scope and architecture with the operator before accepting more blockers.
10. Treat evidence as diagnostic unless the product explicitly requires a security-grade attestation system.

## Current status

The operator-approved scope reduction is recorded durably on `prime-claw-5v7.5`. The existing Episode has been resumed under the simplified contract. It must preserve accepted Slice 1/2 behavior and remain stopped before Slice 4 until Slice 3 receives one practical owner acceptance.

## Evidence references

- Active plan: `.ralph/plans/future/project-wide-testing-strategy/EXECUTION_PLAN.md`
- Specification: `.ralph/plans/future/project-wide-testing-strategy/SPECIFICATION.md`
- Slice-3 task: `prime-claw-5v7.5`
- Initial rejected candidate: `6d6f7ee7bbb208b88c798fe4c469188930f07579`
- First hardened rejected candidate: `22e41a0ed39070017a92b7beddc4b2440ed33b05`
- Second hardened rejected candidate: `659a293b461f5bbcc7c9b2424085a4af08848e7a`
- Operator-approved scope-reduction note: terminal notes on `prime-claw-5v7.5`, 2026-10-06.

## Legacy design

Treat the host, checkout, launcher, and same-UID user as trusted during a test run. Preserve the container as the production-isolation boundary. Prefer topology simplification over race-proof wrappers: bake or owned-copy inputs into the container, keep mutable state/results container-local, copy results out after stop, and use labelled best-effort cleanup. Evidence is diagnostic, not a security attestation protocol. Reviews are bounded to the approved practical threat model and use a two-cycle stop-loss.

## Legacy notes

Created at the operator's explicit request after the Slice-3 scope intervention. This issue is the durable P0 incident and remediation record. It is not evidence of a production breach. It documents a specification/review/oversight failure that caused severe delivery paralysis. Related live remediation remains on prime-claw-5v7.5; Slice4 stays closed until practical Slice3 acceptance.
MILESTONE — 2026-10-06. The reduced-contract Slice-3 candidate 5d3db2f961d843a11289c38f5d60f646a8f65c9e received owner PASS (report SHA256 1e2586678e14d28b5d51c5e7a87366af7db3a815a35aab19d464296c54506ac3) and prime-claw-5v7.5 is closing. The implementation removed 6,770 lines and passed practical host/native Docker acceptance. This closes the immediate Slice-3 remediation milestone, but this P0 remains OPEN until the project-wide threat-model/non-goal template, two-cycle stop-loss, and reviewer-scope guardrails in its acceptance criteria are durable beyond the local session.
MILESTONE — 2026-10-06. Slice4 candidate 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a passed one practical owner review with no blocker (report SHA256 93b4fdba8772da6d2b3cc83d421a234003d13cb05a0ce4937c478d881fca2c82). Guardrails worked: explicit retained contract/non-goals, one normal review, no adversarial review ratchet, and DONE without a repair cycle. prime-claw-5v7.4 is closing. P0 remains open for durable cross-session/process remediation. Status-language correction: later slice Beads are open and unstarted rather than literally closed; the control boundary is that they are not started or authorized before ordered acceptance.
MILESTONE — 2026-10-06. Slice5 candidate d7980cf051be8e459434ebc2a5d74753b0832e3b passed one practical owner review with no blocker (report SHA256 7f58bddeceaefedaa84a78d1ffb150baff672cb52d0e01c1c8a541d4e4a10b82). Guardrails held: explicit bounded contract, one normal review, no adversarial scope ratchet, no repair cycle, and accepted completion of the 56-function unit-env migration. prime-claw-5v7.8 is closing; P0 remains open for durable process remediation.
MILESTONE — 2026-10-06. Slice6 candidate fda41dcadbac15b2c957c866d9e22eafb5f6afca passed one practical owner review with no candidate blocker (report SHA256 2aaae868e7b6403820af48464629ef9ae3f2df3c7eb306642be1d60718277785). The review correctly separated candidate acceptance from a real historical test-isolation incident. Dedicated P0 prime-claw-5v7.10 now tracks possible configured-sandbox/provider effects and potential host-token access; no live investigation/recovery is authorized without operator decision. prime-claw-5v7.7 is closing. Process P0 remains open.
FINAL SPEC MILESTONE — 2026-10-07. All eight project-wide testing slices are owner-accepted and closed through final commit 5bace57e63e51bbfc034fc2e665863b74649a218. The practical reviewer boundary and two-cycle stop-loss prevented another adversarial ratchet and were exercised explicitly during Slice7. However, keep this process P0 OPEN: acceptance criterion 6 requires a durable cross-spec/project guard, and the final active plan no longer carries an explicit trusted-host/stop-loss template. The local conversation prompt is not sufficient repository durability. Follow up separately without blocking the completed implementation. Safety incident prime-claw-5v7.10 is also open/deferred and distinct.
SYSTEMIC REMEDIATION COMPLETE — 2026-10-07
Cross-project guardrails landed and were pushed in `886cd9262b12e4fd9ac35336ef9d0caeb3342232`. They durably add the threat-model/non-goal/manual-recovery/complexity-budget readiness contract, bounded EXPERT rubric, operator-only scope promotion, simplification trigger, and two-cycle stop-loss across successor candidate commits. Full validation passed Tier 0 and Docker Tier 1 against Prime Agent 0.9.8. This satisfies the incident's remaining durable project-guard criterion; the broader post-land dogfood window continues under parent epic `prime-claw-gv7`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The trusted-host ordinary-failure threat model and explicit non-goals are durable in the active plan, specification, Bead, and reviewer policy.
- [ ] #2 The paused F1 draft is preserved as a hashed external artifact before any restore.
- [ ] #3 Slice 3 is simplified to remove or stop enforcing obsolete adversarial machinery and uses no workspace/results host bind mounts where practical.
- [ ] #4 Retained isolation, real-stack behavior, nonroot execution, ordinary cleanup/failure handling, docs, and inventory pass focused, full-host, and one native Docker acceptance gate.
- [ ] #5 One normal independent review checks only the reduced contract and does not promote excluded adversarial hardening into blockers.
- [ ] #6 A durable project guard requires explicit threat model/non-goals and a two-cycle review stop-loss for future slices/specs.
- [ ] #7 The incident Bead records final remediation evidence and is closed only after the reduced Slice-3 candidate is owner-accepted.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Incident remediation and durable cross-project guardrails landed in 886cd92; parent epic remains open for post-land dogfood.
<!-- SECTION:FINAL_SUMMARY:END -->
