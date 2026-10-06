# Project-wide testing strategy — Slice 6 lifecycle control boundary

## Status

Slices 1–5 are owner-accepted. Slice 6 / `prime-claw-5v7.7` starts from exact
accepted commit `d7980cf051be8e459434ebc2a5d74753b0832e3b` (tree
`79bcb1bc83a4dff83eebe4664f8e7751a0bda1d0`).

## Threat model

The local host, checkout, Docker daemon, launcher, and same-UID operator are
trusted. The material lifecycle risk is accidental mutation of shared
control-plane state through default, ambiguous, colliding, missing, or unowned
identities. Hostile same-UID mutation and security attestation are non-goals.

## Required control boundary

Slice 6 creates an inert, recording-fake-tested lifecycle support boundary:

1. Every run generates a full run identity, a non-default workspace identity,
   test-prefixed resource identities, and exact ownership labels. Gateway and
   workspace scope are explicit; the default workspace is never a target.
2. Lifecycle collection requires the `lifecycle` marker, the scoped fixture,
   and explicit `--run-lifecycle` opt-in. Structural mismatch fails collection;
   absent opt-in skips with zero mutation.
3. Preflight and inspection use exact selectors and a present/absent/unknown
   result. Collision, ambiguity, daemon/CLI failure, malformed output,
   forbidden identity, missing ownership proof, and label mismatch fail before
   any recorded mutating call.
4. Ownership is captured only after an exact label/scope reread. Teardown uses
   bounded deadlines and only exact captured, revalidated owned identities.
   Unowned targets are never deleted; unknown/refusal is failure and retains
   sanitized evidence.
5. The host-observer registry records the exceptional seam, marker, fixture,
   inadequate fake/container alternative, ownership rules, and current
   disabled status. No live observer body is enabled in this slice.
6. Evidence records sanitized identity, scope, command class, result,
   timestamps/deadlines, and teardown/absence state. It contains no credentials,
   private endpoints, production config, or raw private content.

## Required fake proofs

Recording-fake and static tests prove collision handling, default-name/workspace
rejection, missing/ambiguous state, ownership-label mismatch, incompatible CLI
or malformed results, daemon failure, teardown refusal/failure, unknown inspect,
evidence retention, and attempted unowned cleanup. Every pre-ownership failure
has zero mutating calls. Post-ownership cleanup may reference only the exact
owned identities recorded by the scope.

## Preserved boundaries

Plain pytest remains Docker-free. Tier-1 admission remains exact `-m container`.
Tier 2 and the accepted Slice-3 isolation topology do not change. Plugin work
remains Docker-only. `scripts/test-all.sh --with-lifecycle` and
`--with-sandbox` remain deterministic non-mutating errors until the approved
later live-occupant slice. No live OpenShell/provider call, sandbox/service/
remote/policy mutation, credentials, or user-global refresh is allowed.

## Acceptance

Marker/CLI/static and recording-fake gates prove fail-closed collection,
identity, ownership, inspection, evidence, and bounded cleanup semantics. Docs,
host-observer registry, inventory, evidence, and Bead receipt agree. Run the
appropriate source and exact-commit sequential gates plus one normal bounded
final review, publish one clean commit/push, and stop for owner review.

## Source-candidate status — 2026-10-06

The inert support layer, collection contract, Docker-only recording-fake
matrix, tier-0 architecture guards, docs, host-observer registry, inventory,
and evidence page are implemented. Focused host and recording-fake gates pass.
Exact-commit sequential validation, the single bounded review, publication,
and owner acceptance remain pending.

## Guardrails and boundary

Bias for DONE over perfect. Do not add same-UID hardening, security attestation,
or recursive review. If two repair/review cycles still find material in-scope
defects, stop for operator consultation. Do not run a live lifecycle occupant
or implement Slice 7+.
