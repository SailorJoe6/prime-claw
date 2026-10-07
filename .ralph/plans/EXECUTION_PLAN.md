# Execution plan — project-wide isolation-first testing strategy

## SLICE 7 CANDIDATE COMPLETE — awaiting owner review

The retained cycle-2 cleanup is accepted and consumed. The offline mutation
audit now classifies structured `resource` identities by exact equality rather
than matching serialized substrings. Regressions accept the authorized generated
image containing `prime-claw` while rejecting exact configured identities,
malformed identities, and material policy drift.

All invalidated non-live gates passed. The one still-unused final observer ran
once with fresh run `2f8d0cd3754147028f71a6a34a740441` and passed. Target destruction,
sentinel preservation, empty providers, exact-owned teardown, positive absence
for all resources, and unchanged configured-production hash
`fd7e356ab7c2050174c4a817d790e9a83e4cced9e77ec74a728443ced685f945` are retained in the evidence doc.
No retry, P0 work, credential access, configured-production mutation, or Slice 8
work occurred.

The one bounded review completed. Its inherited-admission finding was corrected
offline and validated by focused plus full host sentinel gates; its evidence and
inventory consistency findings were reconciled. The consumed observer was not
rerun. One clean commit, terminal Bead receipt, and one push remain before
stopping for owner review.

## Active decision: Slice 7 runs one guarded real lifecycle observer

Slices 1–6 are owner-accepted. Slice 6 is exact commit
`fda41dcadbac15b2c957c866d9e22eafb5f6afca` (tree
`a5e1245c29022092b5684be99c7220d0b6fc7d9a`). Slice 7 is tracked by
`prime-claw-5v7.6`.

## Authorization and hard boundary

The operator authorizes one explicit host lifecycle acceptance run using only
generated, exact-owned test identities required by this slice. Live mutation is
limited to that generated run/workspace/target/sentinel/image scope. Preserve
the Slice-6 fail-closed boundary and all accepted tier/isolation behavior.

P0 incident `prime-claw-5v7.10` stays open for later follow-up. This slice must
not perform incident-specific inspection or recovery, provider remediation,
credential investigation, token retrieval, cleanup of suspected historical
effects, or any mutation of configured production resources. Do not use
Keychain/browser credentials or expose credential material. Do not implement
Slice 8.

The host, checkout, Docker daemon, launchers, OpenShell installation, and
same-UID operator are trusted for this practical acceptance. Bias for DONE over
perfect. Do not add hostile same-UID hardening, attestation, custom policy
machinery, or recursive review. Use one normal bounded final review.
Implementation goals have no token budget; approved slice/spec scope is the
bound.

## Slice 7 objective

Build and run the registered host acceptance observer exactly once. It must
prove that `bin/prime-claw --config <generated> destroy --yes` deletes one
generated target sandbox while preserving the generated sentinel and leaving a
sanitized, read-only configured-production snapshot byte-for-byte unchanged.
All captured test resources must then be removed through Slice-6 exact ownership
revalidation and positive absence checks.

## Required observer contract

- Generate a full run ID, non-default `pct-<12hex>` workspace, unique target,
  sentinel, fixture image, exact `pc-test=true` / `pc-run=<full-id>` labels,
  bounded deadline, and run evidence directory.
- Pin every OpenShell call to the selected gateway and generated workspace.
  Never use a default workspace, broad selector, guessed name, `--all`, prune,
  automatic provider, remote, or credential.
- Build the tracked lifecycle fixture image by iidfile with unique ownership
  labels. Use a tracked minimal no-egress policy. Create target and sentinel
  with `--no-auto-providers --no-tty`; both provider lists must be empty.
- Generate the product config inside the run evidence directory. It names only
  generated target/image plus explicit gateway/workspace and has no local
  overlay. Run `destroy --yes` through a generated proxy accepting only exact
  target get/delete argv; do not pass `--image`.
- Capture a names-only configured-production snapshot before test mutation and
  again after target destruction and exact-owned cleanup, using the tracked
  explicit production workspace and bounded `sandbox list --names` pages. Hash
  only configured identity/workspace and presence. This is read-only proof,
  not incident investigation. Never request policy, annotations, providers,
  secrets, endpoints, brain content, or operator-local config. Equality is
  required.
- Require target absent after destroy, sentinel still present, sentinel
  workspace/policy/labels unchanged, and both initial provider lists empty.
- Enter the Slice-6 finalizer on every post-ownership exit. Reinspect exact
  captured ownership, then remove sentinel, workspace, and fixture image in
  bounded order with positive absence verification. Unknown/refusal retains
  evidence, fails the run, and is never automatically retried.
- Audit the sanitized transcript to prove no forbidden/default/configured
  production identity was used by a mutating command.

## Implementation steps

1. Claim only `prime-claw-5v7.6`. Audit the accepted Slice-6 support boundary,
   current OpenShell public CLI behavior, product destroy path, sequencer, and
   safe read-only production-snapshot seam. Do not inspect incident impact.
2. Add the narrow reviewed live adapter/body under `tests/lifecycle/`. Keep raw
   Docker/OpenShell process calls confined to that support boundary and retain
   marker + `lifecycle_scope` + `--run-lifecycle` admission.
3. Add `docker/test-lifecycle.Dockerfile` pinned to the approved digest and
   tracked `policies/test-lifecycle.yaml` with minimal no-egress behavior.
4. Add recording-fake/static red proofs for injected failures: wrong target,
   sentinel deletion, target preservation, snapshot drift, ownership mismatch,
   unknown inspection, teardown refusal, and sensitive evidence. Never inject a
   deliberate fault into the real run.
5. Atomically enable `scripts/test-all.sh --with-lifecycle` so it runs tiers
   0→1→2 and then only the registered lifecycle observer through pytest
   `--run-lifecycle`. Defaults, arbitrary marker expressions, `--with-sandbox`,
   and plain `test-all` must not run the observer.
6. Perform preflight, capture the read-only production snapshot, create only
   generated exact-owned test resources, run product destroy against the target,
   verify target/sentinel invariants, finalize owned resources, capture the
   after snapshot, and require canonical equality. Run this live observer once;
   do not automatically retry.
7. Update `DEVELOPERS.md`, `docs/testing-strategy.md`, the host-observer registry,
   requirements inventory, and `docs/evidence/...-slice7-lifecycle-destroy.md`
   with sanitized commands/identities, snapshot hashes, cleanup, and acceptance.
8. Run focused fake/static/CLI gates before the live run. After the single live
   run, validate exact absence/evidence, run the appropriate exact-commit gate,
   perform one bounded final review, publish one clean commit with one push,
   append the terminal Bead receipt, and stop for owner review.

## Acceptance

- Injected guard failures pass only with recording fakes/inert fixtures and
  produce zero unauthorized mutation.
- The one explicit live run addresses only generated exact-owned test
  identities. Target becomes absent; sentinel remains present until finalizer;
  both provider lists are empty; workspace/policy/labels match.
- All captured test resources are positively absent at completion. Unknown or
  teardown refusal fails without retry and retains sanitized evidence.
- The configured-production before/after canonical snapshot is unchanged, and
  no configured production identity occurs in a mutating transcript event.
- Default commands do not run lifecycle work. `--with-lifecycle` is the only
  sequencer entry and `--with-sandbox` remains a non-mutating exit-64 error.
- Docs, registry, inventory, evidence, Bead, exact commit, push, and the one
  final review agree.

## Rollback

Before reverting, remove only captured/revalidated Slice-7 test identities and
prove absence. Unknown state preserves evidence and blocks rollback. Never
prune, broaden selectors, inspect incident effects, or mutate configured
production state.
