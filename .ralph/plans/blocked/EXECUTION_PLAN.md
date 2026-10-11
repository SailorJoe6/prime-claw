# Execution plan — Slice 8 gbrain no-write and whole-source evidence

## Owner-accepted handoff

Slice 7 is owner-accepted at commit
`e4cbc59e19fe823d598456dbf2185facf0621dee` (tree
`f0cb0910d9111f6c9a2067102c1c2a81e8cd59d7`). Advance only to the final
ordered Slice 8 / `prime-claw-5v7.3`.

Preserve accepted Slices 1–7. The Slice-7 lifecycle observer is consumed and
must never be rerun. Do not inspect or recover deferred P0
`prime-claw-5v7.10`. Do not access credentials, operator data, production brain,
configured runtime, private endpoints, or network providers. Do not run, hand
off, activate, or mutate Phase 3a.

Use an unlimited implementation goal. Apply P0 DONE-over-perfect guardrails:
prefer the smallest practical proof that satisfies this contract, use one
normal bounded review, and do not expand into hostile-environment hardening,
upstream gbrain work, a new framework, or recursive review.

## Active decision

Use the admitted disposable tier-2 integration fixture to prove two properties
against fixture-owned PostgreSQL, gbrain, Git, and synthetic corpus state:

1. exact logical non-mutation by
   `gbrain sync --source fixture --dry-run --no-pull --no-embed --yes`; and
2. exact synthetic whole-source path/slug accounting by
   `gbrain sync --source fixture --no-pull --no-embed --no-extract --yes`.

Then publish only a bounded Phase 3a consumer-admission proposal. This evidence
supports later owner review; it authorizes no Phase 3a action.

## Slice objective

Add explicit non-default in-container property bodies and integrate them into
the existing disposable tier-2 driver. Plain host pytest must neither collect
nor execute them. All inputs and state are generated inside the fixture. The
container remains credential-free and offline during assertions.

## Required implementation

### 1. Audit and preserve the admitted fixture

- Audit the current integration driver, provenance manifest, pinned gbrain
  artifact, database lifecycle, local bare Git remote, synthetic corpus, and
  cleanup contracts before editing.
- Extend the existing fixture instead of adding a second orchestrator,
  Docker-in-Docker, host Docker socket, production runtime seam, or upstream
  fork.
- If the pinned gbrain revision lacks the exact required flags or observable
  property surface, stop with evidence. Do not patch or fork upstream gbrain.

### 2. Non-default property bodies

Add explicitly invoked, non-default in-container bodies equivalent to:

- `gbrain_dry_run_body.py`;
- `gbrain_source_coverage_body.py`.

They must require the integration container-entry guard. Host/default pytest
collection must remain inert. The integration driver invokes them only after
network isolation, artifact provenance, database migration, fixture setup, and
ownership checks succeed.

### 3. Exact dry-run non-mutation proof

- Start from a fully migrated, seeded, fixture-owned database.
- Commit the synthetic source delta before capturing the baseline snapshot.
- Run exactly:
  `gbrain sync --source fixture --dry-run --no-pull --no-embed --yes`.
- Record sanitized stdout and exact exit semantics.
- Capture deterministic logical snapshots before and after. Require exact
  equivalence for:
  - schema and migration identity;
  - relevant ordered row sets, including failure ledger;
  - source bookmark/cursor state;
  - persistent lock ownership and post-exit fixture sessions;
  - effective fixture configuration hashes;
  - synthetic worktree HEAD, status, and tree;
  - fixture-owned bare-remote refs.
- Do not compare raw PostgreSQL storage files or WAL bytes.
- Negative proofs must make unexpected bookmark, row, failure-ledger, lock,
  session, config, worktree, or ref drift turn the claim red.

### 4. Whole-source path/slug accounting

- Run exactly:
  `gbrain sync --source fixture --no-pull --no-embed --no-extract --yes`.
- Maintain a deterministic fixture manifest containing every synthetic source
  path, expected slug, operation case, and allowed explicit exclusion.
- Compare the manifest to normalized database rows. Every path and slug must be
  represented exactly once as an imported row or a named accounted exclusion;
  no unlisted DB row, duplicate path/slug, silent omission, or stale manifest
  entry is allowed.
- Cover add, rename, and delete convergence.
- Malformed frontmatter must either fail without bookmark advance or appear as
  an explicit named exclusion with the observed reason.
- Negative proofs cover stale/incomplete manifest and unaccounted, duplicate,
  missing, or unexpected path/slug state.
- Do not add interrupted-sync injection unless the pinned upstream exposes a
  deterministic supported seam.

### 5. Repeatability and isolation

- Prove both properties twice with disjoint database names and run identities.
- Require identical normalized logical outcomes across the two runs.
- Prove all databases, containers, images, contexts, Git state, and raw result
  paths are fixture-owned and exactly cleaned or retained under the existing
  evidence contract.
- Assertion execution must have no network. No credential, operator HOME,
  production brain, configured runtime, private corpus, provider, or external
  remote may enter argv, environment, mounts, logs, fixtures, or evidence.

### 6. Provenance, documentation, and consumer proposal

Update the integration provenance/manifest so the exact installed gbrain
artifact, image inputs, fixture corpus manifest, body hashes, database/run
identities, commands, snapshots, accounting result, network isolation, and
cleanup are reconstructible and validated.

Update `DEVELOPERS.md`, `docs/testing-strategy.md`, requirements inventory,
plan/spec, and durable evidence
`docs/evidence/...-slice8-gbrain-properties.md`.

Publish, but do not apply or hand off, this bounded Phase 3a proposal:

> When the project-wide tier-2 integration fixture is admitted under
> R-TEST-3/R-TEST-6/R-TEST-13, Phase 3a may cite fixture evidence for exact
> installed-binary provenance, fully migrated
> `gbrain sync --dry-run --no-pull --no-embed --yes` logical non-mutation, and
> synthetic whole-source path/slug accounting. This supports and never replaces
> authorized host/in-sandbox exact-model probes, operator clearance, the single
> bounded resumed build, production Git/L7 proof, or cutover. No production
> dry-run or Phase 3a handoff is authorized.

## Validation matrix

Before publication require:

- focused positive and injected-drift property tests;
- both properties twice with disjoint databases/run identities and identical
  normalized outcomes;
- tier 0: `python3 -m pytest tests/ -q`;
- tier 1 through the supported pinned/source Docker gate;
- tier 2: `scripts/test-integration.sh`;
- default complete gate: `scripts/test-all.sh`;
- inventory integrity and exactly-once `R-TEST-*` completeness;
- current-source audit proving every environment-dependent body remains in a
  container or the accepted registry;
- provenance validator PASS, offline assertion proof, cleanup proof, and no
  sensitive material;
- lifecycle reported from accepted Slice 7 only; never rerun it.

## Acceptance

- Dry-run snapshots are logically identical before/after in both disjoint runs;
  every named injected drift fails.
- Whole-source accounting represents every synthetic manifest path and slug
  exactly once as an imported row or explicit exclusion; add/rename/delete and
  malformed-frontmatter behavior satisfy the contract; negative cases fail.
- The full non-live matrix passes within existing budgets.
- Every `R-TEST-*` appears exactly once with valid proof paths and no stale
  sandbox taxonomy or uncontained environment body.
- The Phase 3a packet is proposal-only and no Phase 3a or production state is
  touched.
- One practical bounded review passes, one clean commit is pushed once, the
  terminal Bead receipt is recorded, and work stops for owner review.

## Stop conditions

Stop and return to the owner if the pinned artifact cannot expose the exact
commands/properties, plain Docker cannot run it, isolation or ownership is
ambiguous, provenance is incomplete, teardown is unknown, sensitive/operator
state would be required, a product/upstream patch would be required, or the
Phase 3a proposal would require live action.

## Slice 8 completion evidence

- Offline integration-v3 property fixture passed twice per property with disjoint identities and identical normalized outcomes.
- Exact dry-run logical non-mutation, whole-source accounting, malformed-frontmatter exclusion, and named negative proofs passed.
- Full non-live matrix passed: 513 host tests, 46 exact tier-1 tests, and final default tiers 0–2.
- Phase 3a language is proposal-only and no lifecycle, production, P0, credential, or configured-runtime action occurred.
- Durable receipt: `docs/evidence/2026-10-07-testing-strategy-slice8-gbrain-properties.md`.
