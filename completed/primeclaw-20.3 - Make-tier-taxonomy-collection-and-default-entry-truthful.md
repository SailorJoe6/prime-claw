---
id: PRIMECLAW-20.3
title: 'Make tier taxonomy, collection, and default entry truthful'
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies:
  - PRIMECLAW-20.5
parent_task_id: PRIMECLAW-20
priority: p2
type: task
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Repair marker/collection policy, reclassify mocked runtime tests, preserve integration-body host exclusion, make test-all run tiers 0+1+2, pin Docker-only plugin testing policy, and keep lifecycle disabled.

## Legacy notes

TERMINAL SLICE 4 RECEIPT — 2026-10-06. READY FOR OWNER REVIEW; bead intentionally remains in_progress. Published exact commit 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a, tree 484188d741e43505c055c9c4fa9d192af415ae62, one clean commit after owner-accepted Slice 3 5d3db2f961d843a11289c38f5d60f646a8f65c9e. Exactly one push occurred. Local HEAD, tracking ref, and live remote all equal 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a; worktree is clean and up to date. Implemented practical scope: exact `-m container` is the only tier-1 admission; arbitrary/negated/grouped/compound marker expressions cannot authorize protected tests; plain pytest is Docker-free; the non-collectable integration body requires a launcher-only container marker before work; mocked runtime suites are truthful tier 0; scripts/test-all.sh runs tier0→tier1→tier2 sequentially/fail-fast; Docker-only plugin policy remains; lifecycle execution stays disabled; both --with-sandbox and --with-lifecycle fail code 64 before preflight/mutation. Test-first focused final: 148 passed + 8 subtests, log .test-results/slice4-source-20261006T044000Z/focused-final.log SHA256 66f1729918750b306d9a81e6f51664317a5ab9051d554646c5fd2085fb9bbbcf. Stable source plain-pytest Docker-sentinel: 504 passed / 42 skipped / 138 subtests, no Docker calls, log .test-results/slice4-source-20261006T044000Z/plain-pytest-final.log SHA256 79211c952ed6b0713d409633a301a73cb6090da93c29d6f1a43b41871e0745de. Sequential exact-commit test-all retry with isolated ignored public selector PRIME_AGENT_PINNED=0.9.8: tier0 504 passed / 42 skipped / 138 subtests, SHA256 49fcb33c2196c2c6de6a2a6c3d7d0a7402d276f23fddc51e573389a77497fc46; tier1 40 passed / 2 skipped / 504 deselected, SHA256 a993ec0a627a565bdb58e69d9cf6278aee50d5baaf11807528fe9ec9683d0d68; tier2 PASS linux/arm64, SHA256 0e2ad3a35381d51c56a446a1a03cb16e0e8a2339352dba5812b72bf3b70e91c0; outer log .test-results/slice4-854dedb2c416-test-all-retry.log SHA256 c2a71b0187a11411c48cbc43d0ab97fa3073e8f9138e51f7571da111c0471d44. Tier1 manifest .test-results/20261006T045522Z-26835-d3de313e/tier1/manifest.json SHA256 4994d5eab4ccedf4a28a7987b2172aea2d7596e5ec2f4a7d60f74dee04f8a8a6 validates exact clean HEAD/network absent/teardown clean+absent. Tier2 manifest /Users/jlanders/code/prime-claw-project-wide-testing-strategy-episode/.test-results/20261006T045732Z-31943-2d13f13c/integration/manifest.json SHA256 e344d78cd72e0a31ff2ee9b8d31c5505181626d7d7d6abb531781fda3f67bc5d validates exact clean HEAD, retained zero-runtime-host-mount Slice-3 isolation, and container/image/context cleanup true; fresh exact CID/IID inspect absent and run-label queries empty. Initial exact test-all attempt passed tier0 then stopped before tier1 because local .env was absent; no Docker action occurred, and the isolated-selector retry fully passed. One normal bounded final review PASS with no material in-scope findings: /Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/sub-0f16795b/slice4-final-review.md SHA256 2b651a216eb51000f3fca9a3835c3e90066c0ebb10b6db6710a1a8184af23473. P0 guardrails honored: trusted-host threat model, DONE over perfect, no adversarial/recursive review, no security-attestation expansion, one review cycle. No Slice5+ work started.
OWNER ACCEPT — 2026-10-06. Exact Slice-4 candidate 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a, tree 484188d741e43505c055c9c4fa9d192af415ae62, parent owner-accepted Slice3 5d3db2f961d843a11289c38f5d60f646a8f65c9e, is accepted for advancement. Fresh practical owner review PASS: /Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-230c275e/slice4-854dedb-practical-owner-review.md SHA256 93b4fdba8772da6d2b3cc83d421a234003d13cb05a0ce4937c478d881fca2c82. No retained-contract blockers. Reviewer verified exact clean one-commit candidate, 22-file scope, local/tracking/live-remote equality, terminal receipt, all nine evidence hashes, existing manifest validators, and fresh bounded 13-pass + 8-subtest review. Accepted behavior: plain pytest Docker-free; exact container marker is sole tier1 admission; arbitrary marker expressions cannot authorize protected tests; integration body is container-entry guarded before side effects; mocked runtime suites are tier0; test-all runs 0→1→2 fail-fast; plugin work remains Docker-only; Slice3 isolation remains; lifecycle flags fail 64 before preflight/mutation; docs/inventory/evidence are materially truthful. Terminology correction: later Beads .3/.6/.7/.8 are open and unstarted, not literally closed; no Slice5+ implementation exists or is authorized. P0 prime-claw-5v7.9 remains open. Slice4 accepted and may close; next ordered Slice5 is prime-claw-5v7.8 and may begin only through canonical handoff under the practical DONE-over-perfect boundary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Plain pytest stays Docker-free; arbitrary markers cannot bypass guards; integration bodies cannot run on host; test-all runs 0+1+2; old/new lifecycle flags are non-mutating errors; docs/inventory/evidence/commit/push/bead receipt are complete.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Owner accepted practical Slice 4 candidate 854dedb after PASS review
<!-- SECTION:FINAL_SUMMARY:END -->
