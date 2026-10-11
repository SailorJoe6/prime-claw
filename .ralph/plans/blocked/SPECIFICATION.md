# Project-wide testing strategy — Slice 8 gbrain properties

## Status

**OWNER-ACCEPTED HANDOFF.** Begin only Slice 8 / `prime-claw-5v7.3` from
accepted Slice-7 commit `e4cbc59e19fe823d598456dbf2185facf0621dee`
(tree `f0cb0910d9111f6c9a2067102c1c2a81e8cd59d7`). Slices 1–7 are immutable
foundations. Never rerun the consumed lifecycle observer and do not inspect P0
`prime-claw-5v7.10`.

## Authorized outcome

The existing disposable tier-2 fixture produces reproducible offline evidence
for exact logical gbrain dry-run non-mutation and complete synthetic source
path/slug accounting. It also produces a bounded Phase 3a consumer-admission
proposal without running, activating, handing off, or mutating Phase 3a.

## Required contracts

### Isolation

All assertion state is fixture-owned: PostgreSQL database, installed pinned
gbrain, local Git worktree and bare remote, configuration, corpus, result paths,
and run identities. Assertions run after network removal. No production brain,
operator data/HOME, credential, configured runtime, provider, private endpoint,
or external remote is read, mounted, contacted, logged, or persisted.

### Dry-run non-mutation

On a fully migrated seeded database, commit the synthetic delta before the
baseline. Run exactly:

`gbrain sync --source fixture --dry-run --no-pull --no-embed --yes`

The before/after logical snapshot must be identical across schema/migrations,
ordered relevant rows and failure ledger, bookmark, persistent locks,
post-exit fixture sessions, configuration hashes, worktree HEAD/status/tree,
and bare refs. Raw PostgreSQL files and WAL are excluded. Each named drift has
a deterministic red proof.

### Whole-source accounting

Run exactly:

`gbrain sync --source fixture --no-pull --no-embed --no-extract --yes`

A tracked synthetic manifest maps every source path to its expected slug,
operation, and any allowed named exclusion. Normalized database accounting must
show each path and slug exactly once as a row or explicit exclusion, with no
silent omission, duplicate, stale manifest entry, or unlisted row. Add, rename,
and delete converge. Malformed frontmatter either fails without bookmark
advance or is a named accounted exclusion.

### Repeatability and provenance

Both properties pass twice using disjoint databases and run identities and
produce identical normalized outcomes. Evidence validates the pinned installed
gbrain artifact, images/build inputs, body and corpus hashes, exact commands,
logical snapshots, accounting, network isolation, ownership, and cleanup.
Non-default in-container bodies cannot be collected or executed by plain host
pytest.

### Phase 3a boundary

The deliverable is documentation/proposal only. Fixture evidence may be offered
to the Phase 3a owner under R-TEST-3/R-TEST-6/R-TEST-13. It never replaces or
authorizes live exact-model probes, production dry-run, resumed build, Git/L7
proof, policy application, cutover, routed write, continuation, or handoff.

## Non-goals

- No production or operator gbrain/runtime access.
- No Phase 3a execution, activation, mutation, or handoff.
- No credentials, network providers, private data, or external remotes.
- No lifecycle observer rerun and no P0 `prime-claw-5v7.10` work.
- No upstream gbrain or Prime Agent patch/fork.
- No new orchestration framework, Docker-in-Docker, or host Docker socket.
- No semantic embedding-quality test or interrupted-sync fault seam not
  supported by the pinned upstream.
- No Slice-1–7 behavior changes except narrow compatibility needed to admit the
  new offline tests; any material change requires owner review.

## Completion

The focused properties, two disjoint repetitions, tier 0, supported tier 1,
tier 2, default `test-all`, inventory, provenance, isolation, and cleanup gates
all pass. Documentation and `R-TEST-*` inventory agree. One practical bounded
review, one clean commit/push, and terminal `prime-claw-5v7.3` receipt complete
the slice, then work stops for owner review.

## Slice 8 completion evidence

- Offline integration-v3 property fixture passed twice per property with disjoint identities and identical normalized outcomes.
- Exact dry-run logical non-mutation, whole-source accounting, malformed-frontmatter exclusion, and named negative proofs passed.
- Full non-live matrix passed: 513 host tests, 46 exact tier-1 tests, and final default tiers 0–2.
- Phase 3a language is proposal-only and no lifecycle, production, P0, credential, or configured-runtime action occurred.
- Durable receipt: `docs/evidence/2026-10-07-testing-strategy-slice8-gbrain-properties.md`.
