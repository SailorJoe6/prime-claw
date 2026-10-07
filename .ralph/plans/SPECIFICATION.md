# Project-wide testing strategy — Slice 7 guarded real lifecycle observer

## Status

**SLICE 7 CANDIDATE COMPLETE; publication pending.** The exact structured
identity audit fix and regressions passed all invalidated non-live gates. The
sole final observer ran once with fresh run `2f8d0cd3754147028f71a6a34a740441` and
passed. Retained evidence proves target absence, sentinel preservation until
finalizer, empty provider lists, exact-owned teardown, all generated resources
absent, and identical configured-production before/after hash
`fd7e356ab7c2050174c4a817d790e9a83e4cced9e77ec74a728443ced685f945`.

No cleanup or observer was retried. No P0, credential, configured-production,
third-cycle, extra-live-run, or Slice-8 work occurred. The one bounded review
completed; its offline admission and publication-consistency findings were
corrected and host-tested. One clean commit/push remains before owner review.

Slices 1–6 remain owner-accepted. Slice 7 / `prime-claw-5v7.6` starts from exact
accepted commit `fda41dcadbac15b2c957c866d9e22eafb5f6afca` (tree
`a5e1245c29022092b5684be99c7220d0b6fc7d9a`).

## Authorized outcome

One explicitly invoked host observer proves the product destroy path against a
generated target and sentinel inside a generated non-default workspace. Live
mutation is authorized only for the captured and revalidated test identities
created by that run. A sanitized read-only configured-production snapshot is
captured before and after and must be unchanged.

## Required safety contract

1. **Explicit admission.** The registered body requires the `lifecycle` marker,
   `lifecycle_scope`, pytest `--run-lifecycle`, and sequencer
   `--with-lifecycle`. Plain pytest, plain `test-all`, arbitrary expressions,
   and deprecated `--with-sandbox` cannot run it.
2. **Generated scope.** The run generates full run/workspace/target/sentinel/
   image identities and exact ownership labels. Gateway and workspace are
   explicit on every OpenShell call. Default, forbidden, colliding, ambiguous,
   malformed, missing, or unowned state fails closed.
3. **Credential-free fixture.** The pinned fixture image uses a tracked minimal
   no-egress policy. Target and sentinel use `--no-auto-providers --no-tty`, no
   remote or brain, and empty provider lists. No Keychain/browser credential,
   token, provider value, private endpoint, or raw production config enters
   disk, argv evidence, logs, or fixtures.
4. **Product-path proof.** A generated config with no local overlay names only
   the generated target/image and explicit gateway/workspace. A run-owned
   proxy accepts only exact target get/delete argv and records safe classes.
   The observer runs `bin/prime-claw --config <generated> destroy --yes`
   without `--image`, then
   proves target absent and sentinel present with unchanged exact
   workspace/policy/labels.
5. **Production noninterference.** A reviewed read-only seam uses bounded
   `sandbox list --names` pages in the explicit tracked production workspace
   before mutation and after cleanup. It retains only hashes of configured
   identity/workspace and presence. Equality is mandatory. It never requests
   policy, annotations, providers, endpoints, secrets, brain content, or local
   overlay. Production resource/workspace/image identities cannot occur in a
   mutating transcript event; the shared selected gateway is not a resource.
6. **Bounded finalization.** Ownership is captured only after exact reread.
   Every post-ownership exit enters the Slice-6 finalizer. It revalidates and
   removes only captured target/sentinel/workspace/image identities, then
   positively verifies absence. Unknown/refusal fails, retains evidence, and is
   not automatically retried.
7. **Sanitized evidence.** Each event records run/gateway/workspace/resource,
   deadline, version, command class, result, and evidence destination without
   raw command output, secrets, or private endpoints. Evidence includes
   before/after snapshot hashes, target/sentinel proof, transcript audit, and
   teardown/absence state.

## Required fake and static proofs

Before the live run, recording fakes and static guards prove wrong-target,
sentinel-delete, target-preserved, snapshot-drift, forbidden/default identity,
ownership/policy/label mismatch, incompatible or malformed CLI response, daemon
failure, unknown state, teardown refusal, evidence retention, and attempted
unowned cleanup. Deliberate faults never run against the live control plane.
Raw Docker/OpenShell calls are confined to the reviewed lifecycle support seam.

## P0 incident separation

`prime-claw-5v7.10` remains open and deferred by operator decision. Slice 7 does
not inspect or recover suspected historical effects, remediate providers,
investigate credentials, retrieve tokens, clean historical resources, or make
an operational-impact determination. The authorized production snapshot is
only a bounded before/after noninterference proof for this Slice-7 run.

## Preserved boundaries

Preserve accepted Slices 1–6: Docker-free plain pytest, exact `-m container`
tier-1 admission, zero-runtime-host-mount tier 2, Docker-only plugin work,
Slice-6 ownership/evidence rules, and Prime Agent as an upstream dependency.
Do not refresh the user-global plugin or implement Slice 8.

## Acceptance

The single explicit real run passes once within its deadline. Target is absent,
sentinel remains until finalizer, provider lists stay empty, all captured test
resources end absent, transcript mutation is test-scope-only, and canonical
configured-production snapshots match. Focused fake/static/CLI gates and the
appropriate exact-commit sequence pass. Docs/registry/inventory/evidence/Bead
agree. One normal bounded final review passes, one clean commit is pushed once,
and execution stops for owner review.

## Practical guardrails

The host, checkout, Docker daemon, launcher, OpenShell installation, and
same-UID operator are trusted. Bias for DONE over perfect. No hostile same-UID
hardening, attestation, recursive review, credential archaeology, or custom
policy framework. Goals are unbudgeted; the approved slice/spec is the bound.
