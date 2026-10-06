# Execution plan — project-wide isolation-first testing strategy

## Active decision: Slice 6 builds only the lifecycle control boundary

Slices 1–5 are owner-accepted. Slice 5 is exact commit
`d7980cf051be8e459434ebc2a5d74753b0832e3b` (tree
`79bcb1bc83a4dff83eebe4664f8e7751a0bda1d0`). Slice 6 is tracked by
`prime-claw-5v7.7`.

## Practical threat model and non-goals

The host, checkout, Docker daemon, launcher, and same-UID operator are trusted.
Bias for DONE over perfect. Do not add hostile same-UID hardening, security
attestation, custom policy machinery, or recursive review. Use one normal
bounded final review. After at most two repair/review cycles, stop for operator
scope consultation.

This slice does not run a live lifecycle occupant, call a live OpenShell or
provider control plane, mutate any sandbox/service/remote/policy, or use
credentials. It does not implement Slice 7 or later work.

## Slice 6 objective

Build the fail-closed lifecycle CONTROL BOUNDARY before any live lifecycle path
is enabled:

- workspace-scoped run, workspace, resource, and ownership identities;
- explicit lifecycle marker, fixture, and option collection gates;
- recording-fake coverage for collisions, ownership-label mismatches, daemon
  ambiguity/failure, teardown failures, and bounded owned cleanup;
- sanitized evidence retention for success, refusal, and unknown state; and
- the documented host-observer registry.

Default, ambiguous, missing, forbidden, or unowned state must cause zero
mutating calls. Cleanup may address only exact identities whose ownership was
captured and revalidated. Present/absent/unknown inspection is fail closed;
unknown retains evidence and blocks completion.

## Accepted foundation

Preserve all owner-accepted Slice 1–5 behavior, including Docker-free plain
pytest, exact `-m container` tier-1 admission, guarded/non-default environment
bodies, sequential tier 0 → tier 1 → tier 2 execution, Docker-only plugin
validation, the Slice-3 zero-runtime-host-mount integration topology, and the
existing non-mutating lifecycle CLI errors. Prime Agent remains an upstream
dependency and is not an implementation surface.

## Implementation steps

1. Claim only `prime-claw-5v7.7` and audit the planned lifecycle seams,
   collection rules, entry CLI, evidence schema, and current observer registry.
2. Add the narrow lifecycle support layer with generated non-default,
   workspace-scoped identities and explicit ownership labels. Never read an
   operator/default identity as a mutation target.
3. Add `--run-lifecycle` collection semantics: marker/fixture mismatch is a
   collection error; a valid marked+fixture test without explicit opt-in is a
   non-mutating skip. Keep `scripts/test-all.sh --with-lifecycle` and legacy
   `--with-sandbox` disabled/non-mutating until the later approved live slice.
4. Exercise all command/control behavior only through recording fakes in the
   accepted disposable tier-1 boundary. Add static guards that live bodies
   cannot bypass the support layer or call raw OpenShell/Docker controls.
5. Prove zero mutation for default names/workspaces, missing or ambiguous
   inspect state, collision, incompatible/malformed responses, daemon failure,
   ownership/label mismatch, forbidden or unowned resources, and absent opt-in.
6. Prove teardown ordering, deadlines, refusal/unknown behavior, retained
   evidence, and cleanup limited to exact captured and revalidated owned
   identities. No global prune or broad matching is allowed.
7. Update `DEVELOPERS.md`, `docs/testing-strategy.md`, the host-observer
   registry, requirements inventory, and a Slice-6 evidence page.
8. Run focused marker/CLI/fake gates, Docker-sentinel plain pytest, and the
   appropriate sequential tiers. Publish one clean commit with one push after
   one bounded final review, append the terminal Bead receipt, and stop for
   owner review.

## Slice 6 source status — 2026-10-06

Implementation steps 1–7 are complete in the source candidate. Tier-0
collection/architecture gates pass (26 tests plus 7 subtests), and the
Docker-only lifecycle recording-fake bridge passes with network absent and
clean exact-container teardown. No live lifecycle adapter or body exists.
The first exact tier-0 gate exposed and repaired a pre-existing missing
`brain-query` and GitHub-provider test stubs that could fall through to live
OpenShell. Step 8 now
requires the amended exact commit to pass with Docker and OpenShell sentinels,
then one bounded review, one push, and the terminal Bead receipt.

## Completion boundary

The Slice-6 commit may provide only inert/fake-tested control machinery and
collection gates. It must not enable or execute the live target/sentinel
occupant, contact a live OpenShell/provider control plane, mutate host control
plane state, load credentials, refresh a user-global plugin, or start Slice 7+.
