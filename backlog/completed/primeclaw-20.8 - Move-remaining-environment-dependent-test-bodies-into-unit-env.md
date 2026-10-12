---
id: PRIMECLAW-20.8
title: Move remaining environment-dependent test bodies into unit-env
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies:
  - PRIMECLAW-20.3
parent_task_id: PRIMECLAW-20
priority: p2
type: task
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Relocate the audited POSIX watchdog, npm-onload, launcher-meta, git/worktree/socket cleanup, and probe-wrapper behavior into explicit tier-1 bodies/bridges after marker and collection guards are in place.

## Legacy notes

HANDOFF READY — 2026-10-06. Owner accepted Slice 4 exact commit 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a / tree 484188d741e43505c055c9c4fa9d192af415ae62. Active plan/spec now define ordered Slice 5 only: move POSIX watchdog, npm-onload, launcher-meta, Git/worktree/socket cleanup, and probe-wrapper behavior into explicit tier-1 unit-env bodies/bridges; no named environment-dependent host body/tool/state boundary may remain. Preserve accepted Slices1-4 including Docker-free plain pytest, exact container-only admission, noncollectable integration body, test-all 0→1→2, Docker-only plugin policy, disabled lifecycle flags, and simple Slice3 zero-runtime-host-mount architecture. P0 guardrails: trusted host, explicit non-goals, DONE over perfect, no same-UID/attestation expansion, no recursive review, one normal final review, two-cycle stop-loss. Plan/spec edits are intentionally uncommitted handoff context for canonical execute. No Slice5 implementation or Slice6+ work has begun.

SLICE 5 PROGRESS — 2026-10-06. Implemented five exact tier-1 bridges plus seven direct-entry-guarded non-default bodies. 55 environment-sensitive test functions moved: watchdog 8, npm-onload 1, launcher meta 43, reviewed-plan cleanup 1, probe wrapper 2. Pure/static/fully mocked admission and meta coverage stays tier0. Added Docker --init + procps so Linux PID1 reaps POSIX descendants. Focused source tier1 PASS: 5 bridges in 190.49s; inner bodies all green; log .test-results/slice5-source-20261006T054000Z/tier1-bodies.log SHA256 7f34a60ba0d8140d4e1de4b7123682b19f82940c8b4855400ca7385c1530c7e8; manifest .test-results/slice5-source-20261006T054000Z/20261006T053227Z-13592-9427c5e5/tier1/manifest.json SHA256 1f88a5148b95ca54c2661ef3187942d0a0de2712cdbc9416fcd4289ec4865cd1, schema2 valid, network absent, teardown clean/absent, exact captured CID now absent. First focused attempt safely failed and cleaned while exposing/fixing Linux init, fake-binding, and cleanup-import defects. Full plain Docker-sentinel gate is now running; no commit/push yet.

SOURCE CANDIDATE GREEN — 2026-10-06. Corrected coverage is 56 environment-sensitive test functions across 8 guarded bodies and 5 bridges. Full plain Docker-sentinel: 451 passed / 47 skipped / 76 subtests, zero Docker calls, log .test-results/slice5-source-20261006T055000Z/plain-pytest-retry.log SHA256 3a87c00cb995d416903d0fb765e7fe14fb81d50ce97f0da93d911893ef3b19dc. Expanded launcher-meta bridge including post-preflight launch-error regression: PASS 1 in 137.56s, log .test-results/slice5-source-20261006T060000Z/launcher-meta.log SHA256 724d5587f7935e54d2ae499d101d27eba77c653fa647450793254e81bc4e6157; manifest .test-results/slice5-source-20261006T060000Z/20261006T053823Z-27731-9faef96f/tier1/manifest.json SHA256 6692b088f7390633cd15635f5b066f1882b49b6f1dd3515e578e66b901188482, network absent, teardown clean/absent. Ready for final static/inventory check and single candidate commit; no push yet.

EXACT CANDIDATE GATE PASS — 2026-10-06. Candidate d7980cf051be8e459434ebc2a5d74753b0832e3b, tree 79bcb1bc83a4dff83eebe4664f8e7751a0bda1d0, parent accepted Slice4 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a. `scripts/test-all.sh` exact clean commit PASS sequentially/fail-fast: tier0 451 passed / 47 skipped / 76 subtests (34s, SHA256 c8619c2cdf9b378ce4f357700e233a936b14b8f0bd32361b6aeec59fe3ff9bfb); tier1 45 passed / 2 skipped / 451 deselected (264s, SHA256 b355589064cec571a2f4fdec0b211f090e85a35144bb7af099310bddf3215e4e); tier2 PASS linux/arm64 (90s, SHA256 c83b090c705dd0d09b7a184949b4c561dd9155d95317bba6e3a583fef2e42b0b). Outer .test-results/slice5-d7980cf051be-test-all.log SHA256 6fa2ad5ff6d01cf52788defceb71e15963ed815227c3d50fc1d70cf8b37cfd89. Tier1 manifest .test-results/20261006T054257Z-38808-914f16f4/tier1/manifest.json SHA256 6b0655e8efbe594ced2f54beb9b82f452ef184c4ae6270df9f347c140a30988c validates exact clean HEAD, network absent, teardown clean/absent; exact CID absent. Tier2 manifest .test-results/20261006T054720Z-48648-4f1299dd/integration/manifest.json SHA256 fbe9b1b8338295807324570a20c5f0e118ecc1710ad49e133f34657dc2b5a31e validates exact clean HEAD, zero host mounts, cleanup container/image/context true; exact CID/image absent and run-label queries empty. Single bounded final review now pending. No push yet.

TERMINAL SLICE 5 RECEIPT — 2026-10-06. READY FOR OWNER REVIEW; Bead intentionally remains in_progress. Published exact commit d7980cf051be8e459434ebc2a5d74753b0832e3b, tree 79bcb1bc83a4dff83eebe4664f8e7751a0bda1d0, one clean commit after owner-accepted Slice4 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a. Exactly one push occurred. Local HEAD, tracking ref, and live remote all equal d7980cf051be8e459434ebc2a5d74753b0832e3b; worktree clean/up to date. Implemented approved bounded migration: 56 environment-sensitive test functions across 8 direct-entry-guarded non-default bodies, reachable only through 5 exact-marker tier1 bridges. Families: POSIX watchdog; npm-onload dynamic %2F request + Codex header rewrite; environment-sensitive launcher/fixture/image/launch-error meta; reviewed-plan Git/worktree/socket cleanup; probe wrapper. Pure/static/fully mocked contracts remain tier0. Docker --init + procps provide Linux process/reaping semantics. Plain source Docker-sentinel: 451 passed / 47 skipped / 76 subtests, zero Docker calls, .test-results/slice5-source-20261006T055000Z/plain-pytest-retry.log SHA256 3a87c00cb995d416903d0fb765e7fe14fb81d50ce97f0da93d911893ef3b19dc. Exact test-all: tier0 451 passed / 47 skipped / 76 subtests; tier1 45 passed / 2 skipped / 451 deselected; tier2 PASS linux/arm64. Outer .test-results/slice5-d7980cf051be-test-all.log SHA256 6fa2ad5ff6d01cf52788defceb71e15963ed815227c3d50fc1d70cf8b37cfd89; log SHA256s: tier0 c8619c2cdf9b378ce4f357700e233a936b14b8f0bd32361b6aeec59fe3ff9bfb, tier1 b355589064cec571a2f4fdec0b211f090e85a35144bb7af099310bddf3215e4e, tier2 c83b090c705dd0d09b7a184949b4c561dd9155d95317bba6e3a583fef2e42b0b. Tier1 manifest .test-results/20261006T054257Z-38808-914f16f4/tier1/manifest.json SHA256 6b0655e8efbe594ced2f54beb9b82f452ef184c4ae6270df9f347c140a30988c validates exact clean HEAD, network absent, teardown clean/absent; exact CID absent. Tier2 manifest .test-results/20261006T054720Z-48648-4f1299dd/integration/manifest.json SHA256 fbe9b1b8338295807324570a20c5f0e118ecc1710ad49e133f34657dc2b5a31e validates exact clean HEAD, zero host mounts, cleanup container/image/context true; exact CID/image absent and label queries empty. One normal bounded final review PASS, no material findings: /Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/sub-7374467c/slice5-final-review.md SHA256 d16ac8f7b9ce5111b95ccae056718cd7ef4d4fd7ff237ee0280fdb7e8d46c438. P0 guardrails honored: trusted host, DONE over perfect, no adversarial/recursive review or security-attestation expansion, one review cycle. No Slice6+ work started.
OWNER ACCEPT — 2026-10-06. Exact Slice-5 candidate d7980cf051be8e459434ebc2a5d74753b0832e3b, tree 79bcb1bc83a4dff83eebe4664f8e7751a0bda1d0, parent owner-accepted Slice4 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a, is accepted for advancement. Fresh practical owner review PASS: /Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-8427ac51/slice5-d7980cf-practical-owner-review.md SHA256 7f58bddeceaefedaa84a78d1ffb150baff672cb52d0e01c1c8a541d4e4a10b82. No retained-contract blockers. Reviewer verified exact clean one-commit/26-file candidate, local/tracking/live-remote equality, terminal receipt, no Slice6+ work, 56 environment-sensitive functions across 8 guarded non-default bodies and 5 exact-container-marker bridges, preserved assertions, direct-host refusal, plain-host noncollection, disposable container-only execution, accepted isolation, all 12 evidence hashes, and fresh focused no-Docker 4 passed/7 deselected. P0 prime-claw-5v7.9 remains open. Slice5 accepted and may close; ordered Slice6 prime-claw-5v7.7 may begin only through canonical handoff under practical DONE-over-perfect guardrails.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every named moved behavior runs only through the disposable unit-env container, no host tool/state boundary is reachable, coverage reconciliation passes, and docs/inventory/evidence/commit/push/bead receipt are complete.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Owner accepted practical Slice 5 candidate d7980cf after PASS review
<!-- SECTION:FINAL_SUMMARY:END -->
