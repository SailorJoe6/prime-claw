# Execution plan — project-wide isolation-first testing strategy

## Active decision: Slice 5 moves remaining environment bodies into unit-env

Slice 4 is owner-accepted at exact commit
`854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a` (tree
`484188d741e43505c055c9c4fa9d192af415ae62`). Slice 5 is tracked by
`prime-claw-5v7.8`.

## Practical threat model and non-goals

The host, checkout, Docker daemon, launcher, and same-UID operator are trusted.
The product boundary is accidental host access by environment-dependent test
bodies. Bias for DONE over perfect. Do not add hostile same-UID hardening,
security attestation, custom policy machinery, or recursive review. Use one
normal bounded final review. After at most two repair/review cycles, stop for
operator scope consultation.

## Slice 5 objective

Move the audited remaining environment-dependent behavior into the accepted
unit-env tier-1 container:

- POSIX watchdog behavior;
- npm-onload behavior;
- launcher-meta behavior;
- Git/worktree/socket cleanup behavior; and
- probe-wrapper behavior.

Each named behavior must execute only through an explicit tier-1 body/bridge
using the Slice-4 exact `container` marker and fixture admission boundary. No
host tool or host state used by those test bodies may remain reachable.

## Accepted foundation

Preserve owner-accepted Slices 1–4, especially:

- Docker-free plain pytest;
- exact `-m container` as the sole tier-1 admission;
- noncollectable, container-entry-guarded integration body;
- `scripts/test-all.sh` tier 0 → tier 1 → tier 2;
- Docker-only Prime Agent plugin development and validation;
- disabled lifecycle execution and non-mutating legacy/current flags; and
- the simple Slice-3 zero-runtime-host-mount integration architecture.

Prime Agent remains an upstream dependency and is not an implementation surface.

## Implementation steps

1. Audit the named behaviors and identify every existing host-executed body,
   bridge, helper, local binary lookup, socket, Git/worktree, and cleanup seam.
2. Create explicit tier-1 bodies/bridges for only the named behaviors. Reuse the
   accepted `tier1_container`/`ctmp`/`croot` fixtures and exact marker policy.
3. Remove or convert the host bodies so plain pytest can test only static/pure
   contracts and cannot reach the named tools or mutable state.
4. Add regressions proving each named body is container-selected, skipped by
   plain/arbitrary-marker pytest, and executes against container-local tools and
   state only.
5. Reconcile coverage without duplicating the same behavior across tiers.
6. Update `DEVELOPERS.md`, `docs/testing-strategy.md`, requirements inventory,
   and a Slice-5 evidence page.
7. Run focused migration/guard tests, Docker-sentinel plain pytest, then the
   appropriate sequential tier gates. Obtain one normal bounded final review.
8. Publish one clean commit with exactly one push, record the Bead receipt, and
   stop for owner review.

## Implementation status

- [x] Audited and split the five named behavior families.
- [x] Added eight non-default guarded bodies and five exact-marker bridges.
- [x] Preserved pure/static and fully mocked tier-0 coverage.
- [x] Added Linux `--init`/`procps` support for POSIX body semantics.
- [x] Updated developer/testing docs, inventory, and Slice-5 evidence map.
- [x] Complete focused and plain-host Docker-sentinel source gates.
- [ ] Complete the exact-commit sequential tier gate.
- [ ] Complete one bounded final review, commit, push, and Bead receipt.

## Completion boundary

Do not implement Slice 6 or later work. Do not enable lifecycle execution,
refresh a user-global plugin, or alter the accepted Slice-3 integration topology.
