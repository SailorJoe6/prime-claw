# Section 28 final Slice-3 lifecycle closure — 2026-10-07

## Accepted base and scope

- Accepted Section 27 commit: `ee655a8907882a21f693169fbd0369d2d8c2e122`.
- Accepted Section 27 tree: `60bc9c9985845f54b3ddb1b790f8e10fdda4ad06`.
- Tracker: `prime-claw-h6w.30`.
- Scope is only exact owner disposition persistence, definite public child
  closure, bounded stale cancellation, terminal neutral-role enforcement, and
  explicit exact private-state purge. No Slice 4, activation, finalization, or
  physical session-artifact cleanup is included.

## Implemented contract

- `record_disposition()` is depth-0 only. It derives the exact current owner
  session file, episode generation, repository, and unique current `SETTLED`
  report. It canonicalizes one bounded `ACCEPT`, `REVISE`, `PAUSE`, or `CONSULT`
  decision with required rationale, records its digest without rewriting the
  EXPERT report, and permits only exact-equality idempotence. The API records a
  conversational decision; it never invents product or scope authority.
- `close()` revalidates the full report/settlement/disposition and actual
  spawn/session/model/package/kernel lineage. It calls public
  `rlm.list_subagents()`, matches the stored actual child ID plus name/session
  lineage, passes only the returned public roster row to
  `rlm.delete_subagent()`, validates the delete receipt, and re-lists. Only
  proven public absence creates `CLOSED`. The immutable result preserves report,
  settlement, disposition, and bounded deletion evidence.
- A failed, malformed, ambiguous, mismatched, or uncertain delete/list result
  leaves `DISPOSITIONED` recoverable and stores one bounded failure record. It
  cannot claim cleanup. The implementation performs no automatic retry.
- Prime Agent 0.9.8 documents public deletion as immediate registry/addressability
  removal with durable tombstoning; it does not synchronously erase transcripts
  or artifacts. Section 28 records exactly that public proof and never claims or
  performs physical deletion.
- `cancel_stale()` accepts exactly one expired owned `PENDING`, `FINALIZED`, or
  `CLAIMED` record. Pending requires no same-name public child. Published states
  use the same exact public delete/re-list proof before `CANCELLED`. Non-expired,
  conflicting, ambiguous, mismatched, or uncertain states fail closed.
- `purge()` requires the exact returned `CLOSED` result after the caller has
  durably recorded it, re-proves public absence, and removes only its exact
  private `.closed.json`. It never removes Prime Agent session artifacts.
- `REPORTED`, `SETTLED`, `DISPOSITIONED`, `CLOSED`, and `CANCELLED` all select
  the neutral EXPERT kernel and explicitly abort before provider use. Conflicting
  live phase files fail closed rather than selecting a winner.
- Package capability is now `private-review-lifecycle-closure`; managed runtime
  preflight and source validation require that exact capability.

## Focused validation

- Python lifecycle, compatibility, install, and static contracts:
  `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/test_official_expert_review_skill.py tests/test_reviewed_plan_extension.py tests/test_oversee_episode_skill.py tests/test_official_expert_review_runtime.py tests/test_prime_agent_plugin_install.py -q`
  — **58 passed, 50 skipped**. Log SHA256:
  `9d0bef8333e12ffa60d98b8a752476c32eeba01461c5137f8235e87480561568`.
- Node extension contracts:
  `node --test tests/reviewed_plan_extension.test.mjs`
  — **59 passed**. Log SHA256:
  `de8ea00e1c09522a148bc15c7b8d38005bccb42f56c0ee8932c1d0075e2e686a`.
- Docker-authoritative native preflight/provider seam:
  `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/test_official_expert_review_runtime.py -q -m container`
  — **2 passed**. Log SHA256:
  `4b1ec755c0a0d310f5eed335a315d8f90158b88196cc322565eb48ba7e300075`.

## Full gates

- Full Tier 0: `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/ -q`
  — **325 passed, 184 skipped**, 11 warnings in 73.37s. Log SHA256:
  `696d8275e3fba02b95c3d758aac9e5dbe78469712f8d4190c8bf7a83424074f3`.
- Docker Tier 1: `PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/ -q -m container`
  — **77 passed, 432 deselected**, 11 warnings in 154.28s. Log SHA256:
  `9509ba1c648f1d961e51b091ae0119796f26b72c3a9fbe46b74f92c712b88b92`.
- Pinned Prime Agent 0.9.8: `scripts/test-tier1.sh --probe`
  — release checksum verified, Prime Agent 0.9.8 installed in the ephemeral
  container, package preflight reported expected SHA256
  `ef3f353d8120ea85393c650d6fa0b5076df1773fee3eecb137a80bd89c0622d0`, plugin apply/check passed, and all three canonical tools
  were registered exactly once. Log SHA256:
  `1065eb6f132d1e578a3a910d5f6b774dd6d86feab783127a8460d19bef2b695a`.

All validation passed on the Section 28 implementation bytes. No independent
review cycle was launched. The candidate is ready for one commit/push and direct
owning-Conversation review.
