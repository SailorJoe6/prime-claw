# Execution plan — project-wide isolation-first testing strategy

## Active decision: Slice 4 truthful test entry and taxonomy

Slice 3 is owner-accepted at exact commit
`5d3db2f961d843a11289c38f5d60f646a8f65c9e` (tree
`5be779043b3e45f8f759ce9340467ee92a2fb42f`). Its simple trusted-host,
zero-runtime-host-mount integration launcher and retained isolation are the
foundation. Slice 4 is tracked by `prime-claw-5v7.4`.

## Practical threat model and non-goals

The host, checkout, Docker daemon, launcher, and same-UID operator are trusted.
The product boundary is accidental host execution and misleading test selection,
not hostile local tampering. Bias for DONE over perfect. Do not add adversarial
same-UID races, security attestation, custom policy engines, recursive red-team
reviews, or security-grade receipts. Use one normal bounded final review. After at
most two repair/review cycles, stop for operator scope consultation.

## Slice 4 objective

Make the public tier taxonomy, pytest collection policy, and default test entry
truthful and safe:

1. Plain `pytest` stays Docker-free and runs only host-safe unit/static tests.
2. Arbitrary marker expressions cannot bypass the safety guard.
3. The real integration body never executes directly on the host; it runs only
   inside the Slice-3 Docker image through the integration launcher.
4. Mocked tests of Docker/runtime orchestration are classified as host-safe unit
   tests rather than as real container or integration execution.
5. `scripts/test-all.sh` runs tiers 0, 1, and 2 sequentially by default and stops
   on the first failure.
6. Prime Agent plugin development and pre-merge validation remain Docker-only.
7. Lifecycle execution remains disabled. Both historical and current flags that
   might imply lifecycle enablement fail with clear, non-mutating errors.

## Accepted foundation

Preserve:

- Slice 1: `4cca0989475d7bd670620f31b67260342b3aac5d`
- Slice 2: `56afd99d3a4b5411eb37fb42210ffb36c8bf2b84`
- Slice 3: `5d3db2f961d843a11289c38f5d60f646a8f65c9e`
- Docker-only plugin development policy in `AGENTS.md`
- the simple Slice-3 integration topology and isolation contract

Prime Agent remains an upstream dependency. Do not change or patch it.

## Implementation steps

1. Repair `pytest.ini` and `tests/conftest.py` so selection is based on explicit
   tier intent, not a truthy arbitrary `-m` string. Fail or skip safely when an
   environment-requiring test was not selected through its supported tier entry.
2. Make the integration assertion body host-inert by construction and test that
   direct host collection/execution cannot run it.
3. Reclassify mocked Docker/runtime tests as tier 0. Keep only tests that really
   enter the tier-1 container under `container`, and the real stack under
   `integration`.
4. Make `scripts/test-all.sh` run tier 0, tier 1, then tier 2 sequentially without
   a lifecycle-enabling option. Keep fail-fast logs and summaries.
5. Make legacy and replacement lifecycle-enable flags deterministic usage errors
   before any Docker, OpenShell, or lifecycle mutation.
6. Update `DEVELOPERS.md`, `docs/testing-strategy.md`, the Slice-4 evidence page,
   and `config/requirements-inventory.json`.
7. Run focused policy tests, plain pytest/no-Docker proof, full host tier 0, Docker
   tier 1, real integration tier 2, then one normal bounded final review.
8. Produce one clean commit and push, record the exact receipt on
   `prime-claw-5v7.4`, and stop for owner review.

## Completion boundary

Do not start Slice 5 or later work. Do not enable lifecycle execution. Do not
refresh a user-global plugin. Stop after one published Slice-4 candidate for owner
review.

## Current validation checkpoint — 2026-10-06

- Test-first failure was observed for the pre-fix marker/taxonomy/sequencer state.
- Final focused host policy/runtime set: 148 passed plus 8 subtests; log SHA-256
  `66f1729918750b306d9a81e6f51664317a5ab9051d554646c5fd2085fb9bbbcf`.
- Final stable-tree plain-pytest Docker-sentinel run: 504 passed, 42 skipped,
  138 subtests; no Docker contact; log SHA-256 `79211c952ed6b0713d409633a301a73cb6090da93c29d6f1a43b41871e0745de`.
- Tier 1, tier 2, normal final review, commit/push, and owner decision remain.
