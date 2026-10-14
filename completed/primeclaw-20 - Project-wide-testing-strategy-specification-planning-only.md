---
id: PRIMECLAW-20
title: Project-wide testing strategy specification (planning only)
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-14 02:50'
labels: []
dependencies: []
references:
  - PRIMECLAW-22.1
  - >-
    .ralph/plans/archive/project-wide-testing-strategy/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/project-wide-testing-strategy/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - PRIMECLAW-20.1
  - PRIMECLAW-20.2
  - PRIMECLAW-20.3
  - PRIMECLAW-20.4
  - PRIMECLAW-20.5
  - PRIMECLAW-20.6
  - PRIMECLAW-20.7
  - PRIMECLAW-20.8
  - PRIMECLAW-20.9
priority: p2
type: epic
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Design deliverable per operator charter 2026-10-02: reviewable testing-strategy spec + execution plan via design/plan workflow. Core invariant: test bodies isolated from running Prime Agent harness, gbrain, Postgres, Docker/OpenShell runtime, credentials, source; disposable Docker environments by default. Decisions locked with operator: no GitHub Actions workflow (CI interface only); tier-0 static tests stay host-executed. Lifecycle risk is control-plane scope (sandbox names, providers, policy, remotes), not binary/DB clobbering. Planning only: no implementation, no episode. Conversation 01a0fe09-9641-73af-9889-b44e302490d1.

## Legacy notes

2026-10-02 READY: operator approved the bundle via `/implement-spec`; episode creation was correctly blocked while prerequisites were open. `prime-claw-blw.5` and `prime-claw-zwg.5.1` are fixed in pushed main commit 3bf905976a1a489d93e81619a838b34fc7ed8a31, closed in 927b3941ebab281c18ceacfc3c922f82e75db9fc, and the approved bundle is reconciled as implementation-ready in eca48f8b284c990a8e030062ef70192313781b7f. Clean acceptance: `scripts/test-all.sh` tier0 PASS 52s (283 passed / 147 skipped), tier1 PASS 111s (40 passed / 390 deselected); standalone pinned 0.9.8 probe PASS; pinned fixture 20 passed / 1 deselected; watchdog 31 passed; plan/inventory 10 passed; no dependency cycles; `bd ready` exposes 5v7.2. No implementation episode exists yet. Replay `/implement-spec .ralph/plans/future/project-wide-testing-strategy` to create it.
IMPLEMENTATION COMPLETE — 2026-10-07. All eight ordered slices are owner-accepted and closed: Slice1 4cca0989475d7bd670620f31b67260342b3aac5d; Slice2 56afd99d3a4b5411eb37fb42210ffb36c8bf2b84; reduced Slice3 5d3db2f961d843a11289c38f5d60f646a8f65c9e; Slice4 854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a; Slice5 d7980cf051be8e459434ebc2a5d74753b0832e3b; Slice6 fda41dcadbac15b2c957c866d9e22eafb5f6afca; Slice7 e4cbc59e19fe823d598456dbf2185facf0621dee; final Slice8 5bace57e63e51bbfc034fc2e665863b74649a218, tree 44ea6a640fe1ca03dc961149f0d13e5b3af3d5ac. Final branch local/tracking/live remote equality and clean worktree were independently verified. Final owner review: /Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-a056b967/slice8-5bace57-practical-owner-review.md SHA256 2b4a49548eeaf1e503f770ec4b37b58f1752e5289f29d8aff6242ea18aa80ffc PASS. Phase3a remains proposal-only and unexecuted. No merge, main-branch integration, user-global plugin refresh, deploy, or Phase3a handoff is authorized by this closure. P0 process issue 5v7.9 and deferred safety incident 5v7.10 remain open follow-up work and do not invalidate the completed eight-slice candidate. Episode is ready for operator merge/disposition review.

## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Specification imported from `.ralph/plans/archive/project-wide-testing-strategy/SPECIFICATION.md`

# Project-wide testing strategy — Slice 8 gbrain properties

## Status

**OWNER-ACCEPTED HANDOFF.** Begin only Slice 8 / `PRIMECLAW-20.4` from
accepted Slice-7 commit `e4cbc59e19fe823d598456dbf2185facf0621dee`
(tree `f0cb0910d9111f6c9a2067102c1c2a81e8cd59d7`). Slices 1–7 are immutable
foundations. Never rerun the consumed lifecycle observer and do not inspect P0
`PRIMECLAW-20.9`.

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
- No lifecycle observer rerun and no P0 `PRIMECLAW-20.9` work.
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
review, one clean commit/push, and terminal `PRIMECLAW-20.4` receipt complete
the slice, then work stops for owner review.

## Slice 8 completion evidence

- Offline integration-v3 property fixture passed twice per property with disjoint identities and identical normalized outcomes.
- Exact dry-run logical non-mutation, whole-source accounting, malformed-frontmatter exclusion, and named negative proofs passed.
- Full non-live matrix passed: 513 host tests, 46 exact tier-1 tests, and final default tiers 0–2.
- Phase 3a language is proposal-only and no lifecycle, production, P0, credential, or configured-runtime action occurred.
- Durable receipt: `docs/evidence/2026-10-07-testing-strategy-slice8-gbrain-properties.md`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Isolation: all assertion state is fixture-owned and no production brain, operator data/HOME, credentials, configured runtime, provider, private endpoint, or external remote is accessed or persisted.
- [x] #2 Dry-run non-mutation: the exact no-pull/no-embed dry-run leaves the full logical database, locks, config, worktree, and bare refs unchanged, with deterministic red proofs for drift.
- [x] #3 Whole-source accounting: the exact no-pull/no-embed/no-extract run accounts for every manifest path and slug exactly once, including allowed named exclusions and add/rename/delete behavior.
- [x] #4 Repeatability and provenance: both properties pass twice with disjoint identities and identical normalized outcomes tied to pinned artifacts, commands, hashes, isolation, ownership, and cleanup.
- [x] #5 Phase 3a boundary: fixture evidence is proposal-only and neither replaces nor authorizes live Phase 3a model, production, policy, cutover, write, or continuation actions.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/project-wide-testing-strategy/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# Execution plan — Slice 8 gbrain no-write and whole-source evidence

## Owner-accepted handoff

Slice 7 is owner-accepted at commit
`e4cbc59e19fe823d598456dbf2185facf0621dee` (tree
`f0cb0910d9111f6c9a2067102c1c2a81e8cd59d7`). Advance only to the final
ordered Slice 8 / `PRIMECLAW-20.4`.

Preserve accepted Slices 1–7. The Slice-7 lifecycle observer is consumed and
must never be rerun. Do not inspect or recover deferred P0
`PRIMECLAW-20.9`. Do not access credentials, operator data, production brain,
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/project-wide-testing-strategy/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/project-wide-testing-strategy/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: `PRIMECLAW-20.1`, `PRIMECLAW-20.2`, `PRIMECLAW-20.3`, `PRIMECLAW-20.4`, `PRIMECLAW-20.5`, `PRIMECLAW-20.6`, `PRIMECLAW-20.7`, `PRIMECLAW-20.8`, `PRIMECLAW-20.9`.

### Shared archive-index outcome

## project-wide-testing-strategy/ — Project-wide testing strategy ✅ COMPLETE (2026-10-07)

Delivered all eight owner-accepted testing-strategy slices. The final Slice 8
candidate is commit `5bace57e63e51bbfc034fc2e665863b74649a218`, tree
`44ea6a640fe1ca03dc961149f0d13e5b3af3d5ac`. Earlier accepted slice commits
are `4cca0989475d7bd670620f31b67260342b3aac5d`,
`56afd99d3a4b5411eb37fb42210ffb36c8bf2b84`,
`5d3db2f961d843a11289c38f5d60f646a8f65c9e`,
`854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a`,
`d7980cf051be8e459434ebc2a5d74753b0832e3b`,
`fda41dcadbac15b2c957c866d9e22eafb5f6afca`, and
`e4cbc59e19fe823d598456dbf2185facf0621dee`.

- [Archived specification](project-wide-testing-strategy/SPECIFICATION.md)
- [Archived execution plan](project-wide-testing-strategy/EXECUTION_PLAN.md)
- [Final Slice 8 evidence](../../../docs/evidence/2026-10-07-testing-strategy-slice8-gbrain-properties.md)
- Backlog.md tasks `PRIMECLAW-20.4` and parent `PRIMECLAW-20` are Done.

The Phase 3a consumer packet was proposal-only and authorized no production
Phase 3a action. Separate Phase 3a tasks and the testing incident remain
independent; they do not make this completed plan blocked. Commit `6753f82`
placed these already-completed artifacts under `.ralph/plans/blocked/` while
installing the Backlog migration plan. This archive corrects that bookkeeping
placement and does not claim new implementation work.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
All eight testing-strategy implementation slices owner-accepted through 5bace57; open incidents retained separately

## project-wide-testing-strategy/ — Project-wide testing strategy ✅ COMPLETE (2026-10-07)

Delivered all eight owner-accepted testing-strategy slices. The final Slice 8
candidate is commit `5bace57e63e51bbfc034fc2e665863b74649a218`, tree
`44ea6a640fe1ca03dc961149f0d13e5b3af3d5ac`. Earlier accepted slice commits
are `4cca0989475d7bd670620f31b67260342b3aac5d`,
`56afd99d3a4b5411eb37fb42210ffb36c8bf2b84`,
`5d3db2f961d843a11289c38f5d60f646a8f65c9e`,
`854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a`,
`d7980cf051be8e459434ebc2a5d74753b0832e3b`,
`fda41dcadbac15b2c957c866d9e22eafb5f6afca`, and
`e4cbc59e19fe823d598456dbf2185facf0621dee`.

- [Archived specification](project-wide-testing-strategy/SPECIFICATION.md)
- [Archived execution plan](project-wide-testing-strategy/EXECUTION_PLAN.md)
- [Final Slice 8 evidence](../../../docs/evidence/2026-10-07-testing-strategy-slice8-gbrain-properties.md)
- Backlog.md tasks `PRIMECLAW-20.4` and parent `PRIMECLAW-20` are Done.

The Phase 3a consumer packet was proposal-only and authorized no production
Phase 3a action. Separate Phase 3a tasks and the testing incident remain
independent; they do not make this completed plan blocked. Commit `6753f82`
placed these already-completed artifacts under `.ralph/plans/blocked/` while
installing the Backlog migration plan. This archive corrects that bookkeeping
placement and does not claim new implementation work.
<!-- SECTION:FINAL_SUMMARY:END -->
