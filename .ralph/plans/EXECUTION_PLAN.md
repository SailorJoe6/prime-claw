# Execution plan — project-wide isolation-first testing strategy

## Active decision: finish Slice 3 with a trusted-host Docker contract

The operator reduced Slice 3 on 2026-10-06. The host, checkout, launcher process,
and same-UID user are trusted during a run. Bias for DONE over adversarial
hardening. The durable decision is on `prime-claw-5v7.5`.

The rejected high-assurance candidate remains published as
`659a293b461f5bbcc7c9b2424085a4af08848e7a` (tree
`1c786cc7548495df3dd192abe7d70bb32819cc38`). Its uncommitted follow-up draft was
preserved before reset at:

- patch: `/Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/scope-reduction-f1-draft-20261006T035100Z/paused-f1-draft.patch`
- patch SHA-256: `9cf1083f39c1ab82c95262a11efc73f5a89f13e92b925bb2faf8be40239280d1`
- metadata: `/Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/scope-reduction-f1-draft-20261006T035100Z/status.json`
- metadata SHA-256: `a0216c057d596cd908757414cb8dd652798bd2d4320a0011c4129e8cc0da8012`

Those artifacts are historical recovery material, not requirements.

## Accepted foundation

- Slice 1: `4cca0989475d7bd670620f31b67260342b3aac5d`
- Slice 2: `56afd99d3a4b5411eb37fb42210ffb36c8bf2b84`

Preserve their accepted tier-1 isolation, pinned/source build behavior, tests, and
documentation. Prime Agent remains an upstream dependency. Do not change or patch
Prime Agent.

## Slice 3 objective

Deliver one readable, credential-free Docker integration test that proves the
real locked gbrain binary against PostgreSQL 16 + pgvector and the synthetic local
Git/corpus fixture.

### Runtime contract

1. Stage only trusted public inputs into a temporary Docker build context:
   locked gbrain source, locked Bun artifact, artifact lock, assertion body, and
   synthetic fixture corpus.
2. Bake the assertion body and fixture into the image. Do not mount the checkout,
   results, host home, Docker/OpenShell socket, credentials, or production data.
3. Run the container as a nonroot image user with container-local writable HOME,
   PostgreSQL data, scratch, Git remote, and results.
4. Create/start with `--network none`, no published ports, no privilege, and exact
   run/contract labels.
5. Run the explicit assertion body with a bounded timeout. Ordinary command
   failure, timeout, SIGINT, or SIGTERM is nonzero.
6. Stop the container, copy one JSON body receipt out with `docker cp`, validate a
   small result schema, then remove the labelled container and image best-effort.
7. Publish one simple host manifest containing run status, tested repository
   commit/content identity, platform, locked versions, immutable image/container
   IDs, body receipt, and cleanup outcomes.

### Retained functional proof

The body must prove:

- exact gbrain `0.50.0.0` executable built from locked commit/tree/archive;
- PostgreSQL major 16 and pgvector available;
- real schema initialization/migration;
- synthetic source sync plus get/search;
- fixture-owned bare Git push/clone round trip;
- nonroot execution and runtime external TCP refusal.

## Explicit non-requirements

Do not implement or block completion on hostile same-UID pathname races,
descriptor/ancestor chains, exact-inode publication transactions, instruction-level
signal timing, caller pending-signal proofs, exhaustive malformed-daemon fuzz,
cryptographic binding sidecars, tamper-proof rereads of every intermediate file,
or permanent two-run comparison machinery. These are optional future hardening.

## Implementation steps

1. Replace the Slice-3 supervisor/driver/provenance path with a small trusted-host
   launcher and validator.
2. Update the integration Dockerfile and body for baked assets and container-local
   writable state.
3. Replace adversarial Slice-3 tests with readable ordinary success/failure,
   isolation, receipt, timeout/signal, and cleanup tests. Do not weaken accepted
   Slice-1/Slice-2 tests.
4. Update `DEVELOPERS.md`, `docs/testing-strategy.md`, the Slice-3 evidence page,
   and `config/requirements-inventory.json` to this contract.
5. Run sequentially:
   - focused ordinary Slice-3 tests;
   - full host suite;
   - one native end-to-end Docker acceptance run;
   - one normal read-only final review limited to this reduced contract.
6. Commit and push one clean replacement, record exact evidence on
   `prime-claw-5v7.5`, notify the owning Conversation, and stop for owner review.

## Completion boundary

One native platform is sufficient acceptance evidence. State the observed platform
truthfully; do not require remote Linux/amd64 proof. Do not start Slice 4 or later
work.

## Current validation checkpoint — 2026-10-06

- Focused reduced-contract gate: 24 passed (log SHA-256 `1d27a19d7a90c6ab4a4e471426b6a5f0d5e152ea9845d479d1ab2acc06b4ff7e`).
- Full host gate: 389 passed, 149 skipped, 130 subtests (log SHA-256 `3b5817e9b8e16bcae99726c7eb9cf1444bcd8fe466b61a289500594e2279d3ea`).
- Native Docker acceptance, bounded final review, publication, and owner decision remain pending.
