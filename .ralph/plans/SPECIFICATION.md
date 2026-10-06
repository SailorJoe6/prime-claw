# Project-wide testing strategy — Slice 5 unit-env body migration

## Status

Slices 1–4 are owner-accepted. Slice 5 source candidate is validated and active on `prime-claw-5v7.8` from
accepted commit `854dedb2c4161c3cbd8c0282d0c2b0b9fc0cfe9a`.

## Threat model

The local host, checkout, Docker daemon, launcher, and same-UID operator are
trusted. This slice prevents environment-dependent test bodies from using host
tools or mutable host state. It does not defend against hostile local mutation
and does not create security-attestation machinery.

## Required migration

The following behavior families execute only inside the disposable unit-env
container through explicit tier-1 bodies/bridges:

1. POSIX watchdog process, signal, process-group, and cleanup behavior.
2. npm-onload Node preload and request/header rewrite behavior.
3. launcher-meta behavior that depends on real launcher/tool semantics.
4. The reviewed-plan post-creation Git/worktree/socket cleanup body formerly
   collected from `test_reviewed_plan_native_discovery.py`.
5. Prime Agent probe-wrapper behavior formerly collected from
   `test_prime_agent_probe_isolation.py`.

A moved body may use only the accepted read-only repository snapshot,
container-local installed tools, and run-owned container-local/scratch state.
It must not resolve or execute a host Node/Prime Agent/Git test subject, touch a
host socket/worktree/runtime, or inherit host credentials/private state.

## Collection and coverage contract

- Every moved test uses the accepted tier-1 fixture/bridge and is auto-marked
  `container`.
- Only exact `-m container` admits it. Plain pytest and arbitrary marker
  expressions skip it before fixtures or bodies run.
- Tier 0 retains only static or pure recording-fake coverage for these areas.
- Coverage reconciliation maps each named behavior to one authoritative tier-1
  execution and removes misleading duplicate host proof.
- Tier 2 remains the noncollectable Slice-3 gbrain/PostgreSQL body and is not
  widened by this migration.

## Preserved boundaries

Plain pytest remains Docker-free. Plugin development remains Docker-only.
Lifecycle execution remains disabled; `--with-sandbox` and `--with-lifecycle`
remain non-mutating errors. The simple zero-runtime-host-mount integration
architecture and all accepted Slice 1–4 isolation/evidence behavior remain.

## Acceptance

Tests prove migration and guard behavior for all five named families. Docs,
requirements inventory, evidence, and Bead receipt agree. Run appropriate
sequential gates and one normal bounded final review against this practical
contract, then publish one clean commit/push and stop for owner review.

## Guardrails and boundary

Bias for DONE over perfect. Excluded same-UID attacks and security attestation
are not blockers. Do not launch recursive review. If two review cycles still
find material in-scope defects, stop for operator scope consultation. Do not
start Slice 6+.
