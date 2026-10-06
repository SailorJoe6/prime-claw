# Slice 3 evidence — disposable brain-stack integration environment

**Bead:** `prime-claw-5v7.5`
**Status:** reduced-contract implementation validation in progress; owner acceptance pending

## Active contract

On 2026-10-06 the operator replaced the earlier adversarial local-filesystem and
publication contract with a trusted-host ordinary-failure contract. The local
host, checkout, Docker daemon, launcher, and same-UID operator are trusted during
a run. Completion is blocked only by real functional failure, retained isolation
violation, unsafe deletion of an unowned resource, ordinary false green, an
untruthful/missing result, or missing real-stack coverage.

The paused nine-file F1 draft was preserved before reset:

- patch: `/Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/scope-reduction-f1-draft-20261006T035100Z/paused-f1-draft.patch`
- patch SHA-256: `9cf1083f39c1ab82c95262a11efc73f5a89f13e92b925bb2faf8be40239280d1`
- status metadata: `/Users/jlanders/.prime/agent/session-artifacts/01a0fee6-4ed7-725a-8cf9-0ba9fbf056b9/scope-reduction-f1-draft-20261006T035100Z/status.json`
- metadata SHA-256: `a0216c057d596cd908757414cb8dd652798bd2d4320a0011c4129e8cc0da8012`

It is recovery history, not an active requirement.

## Capability

Slice 3 supplies one explicit, credential-free Docker integration test for:

- locked gbrain `0.50.0.0` from commit
  `a6be012a3bcfac42e279630aedec5cda4a450e29`, tree
  `68bed6c798259e641172b9c4b277fc524b06f3f2`, archive SHA-256
  `78ef4b78fbe2cb1de32862c45a244c0f0b8c20ec468a21c5ecffbba50d53ca1e`;
- PostgreSQL 16 and pgvector;
- the synthetic `tests/fixtures/brain-source/` corpus; and
- a fixture-owned local bare Git push/clone round trip.

The launcher stages only locked public build inputs plus the assertion body and
synthetic fixture. It bakes the body/fixture into the image. The runtime container
is nonroot and uses `--network none`, no host mounts, no published ports, no
socket, no host home, no credentials/provider environment, and no private or
production data/service.

HOME, PostgreSQL data/socket, temporary files, result storage, corpus worktree,
and bare Git remote are container-local. After the body finishes, the launcher
stops the container and copies the JSON receipt to the host with `docker cp`.
Cleanup is best-effort but label-gated and exact-ID only.

## Evidence model

One readable `manifest.json` records:

- run status and ordinary failure code;
- tested repository HEAD, dirty state, and selected-input content SHA-256;
- observed native platform and artifact-lock SHA-256;
- immutable image/container IDs plus verified run/contract labels;
- validated gbrain/PostgreSQL/pgvector/schema/search/Git result; and
- container, image, and temporary-context cleanup outcomes.

There is no binding sidecar, outer publication supervisor, permanent two-run
comparator, or adversarial same-UID race claim. Those are explicitly excluded
optional hardening.

## Validation required for the replacement

Run sequentially:

1. focused ordinary Slice-3 tests;
2. the full host suite;
3. one native end-to-end Docker run; and
4. one normal read-only review limited to the reduced contract.

Source gates completed sequentially:

- focused ordinary Slice-3 + inventory: **24 passed**; log SHA-256
  `1d27a19d7a90c6ab4a4e471426b6a5f0d5e152ea9845d479d1ab2acc06b4ff7e`;
- full host: **389 passed, 149 skipped, 130 subtests passed** in 162.46s;
  log SHA-256 `3b5817e9b8e16bcae99726c7eb9cf1444bcd8fe466b61a289500594e2279d3ea`.

One native Docker acceptance, final commit/tree, cleanup observation, and the
bounded final review remain to be recorded here and on the Bead.

## Historical evidence

Earlier arm64 candidates proved that the locked real environment can build and run
and that gbrain, PostgreSQL 16, pgvector, synthetic source sync/search, and local
Git round trip work. Candidate `659a293b461f5bbcc7c9b2424085a4af08848e7a`
was later rejected under the superseded high-assurance contract. Its manifests,
pair summary, binding receipts, adversarial reviews, and two-run comparator are
historical supporting records only. They do not define the active acceptance
boundary and are not reused as final replacement evidence.

## Boundary

Accepted Slice 1 and Slice 2 behavior remains unchanged. This work does not patch
Prime Agent, refresh a global plugin, access credentials/private services, or
start Slice 4.
