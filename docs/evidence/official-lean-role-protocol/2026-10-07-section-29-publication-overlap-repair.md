# Section 29 publication-overlap and public-export repair — 2026-10-07

## Authority and scope

- Owner-blocked base: `1fed99101f3dee95bf6863a3c9298d8c05d96718`, tree
  `7c28ffe42d9b7018899cd252460287c91c30604d`.
- Tracker: `prime-claw-h6w.30`.
- The rest of Section 28 lifecycle closure is directionally accepted. This
  repair changes only admission handling for the Python publication overlap and
  the package's explicit public export list. There is no lifecycle or deletion
  redesign, independent review, or Slice 4.

## Repaired contract

- The extension now counts `PENDING` with all ready authority phases during the
  existing bounded admission wait.
- `PENDING` plus exactly one `FINALIZED` is the only tolerated multi-file state,
  and only while the existing deadline has not elapsed. It is never itself
  admissible.
- Admission proceeds only after `PENDING` disappears and exactly one ready
  authority phase remains.
- Persistent `PENDING`+`FINALIZED` at the deadline and every other multiple
  authority-phase combination call `ctx.abort()` before provider dispatch.
- The Python package's exact `__all__` now includes `record_disposition`,
  `close`, `cancel_stale`, `purge`, `DISPOSITION_DECISIONS`, and
  `DISPOSITION_LIMIT_BYTES`, while preserving all intended prior public names.
- Updated package SHA256: `92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`.

## Focused validation

- Node extension: `node --test tests/reviewed_plan_extension.test.mjs` —
  **61 passed**, including transient overlap resolution, persistent overlap
  refusal, existing phase-conflict refusal, and explicit zero-provider-call
  assertions. Log SHA256: `cb8b2b3a75bb2b82ead7f572544d55d9f5ddff4c2e1afcaadf7f391071a66edf`.
- Focused Python: `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest
  tests/test_official_expert_review_skill.py tests/test_reviewed_plan_extension.py
  tests/test_official_expert_review_runtime.py tests/test_prime_agent_plugin_install.py -q`
  — **51 passed, 50 skipped**, including the exact public-surface assertion.
  Log SHA256: `6b97a433d61af81af380eb292b68a0da26a29620078dcdcb6086eda41c0b20e4`.
- Docker-authoritative native provider boundary:
  `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest
  tests/test_official_expert_review_runtime.py -q -m container` — **2 passed**.
  The native matrix admits the resolving overlap once and records no provider
  call for the persistent overlap. Log SHA256: `27f134b63b949b2870e1a62c75c4643e37b069ef1ee6a533b4054c9ba3a090a3`.

## Full gates

- Full Tier 0: `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/ -q` —
  **326 passed, 184 skipped**, 11 warnings in 75.42s. Log SHA256:
  `9082e6cfc80f0beee289bc57f8dce61a6105331939d7414cba4053d26d3e5b97`.
- Docker Tier 1: `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/ -q -m container`
  — **77 passed, 433 deselected**, 11 warnings in 219.60s. Log SHA256:
  `1653f39648c1938926d9580464b47419d412cf671aed429e2856994d2a0120fc`.
- Pinned Prime Agent 0.9.8: `scripts/test-tier1.sh --probe` — release checksum
  verified, Prime Agent 0.9.8 installed in the ephemeral container, package
  preflight reported expected SHA256 `92b7c40a36aaf3044f426a78126b5118bc578ef01ff195d1a437d2deae5f81ff`, apply/check passed, and
  all three canonical tools registered exactly once. Log SHA256:
  `60402b89fd10d9169d04bff3ac550ad804f0b87414caff258d6023075a34c3e4`.

All required repair gates passed. The narrow candidate is ready for one
commit/push and direct owner review.
