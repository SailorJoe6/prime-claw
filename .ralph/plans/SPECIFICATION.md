# Project-wide testing strategy — Slice 4 truthful tier specification

## Status

Slices 1–3 are owner-accepted. Slice 4 is active on `prime-claw-5v7.4` from
accepted commit `5d3db2f961d843a11289c38f5d60f646a8f65c9e`.

## Threat model

The local host, checkout, Docker daemon, launcher, and same-UID operator are
trusted. This slice prevents accidental unsafe test execution and false claims
about which environment ran a test. It does not defend against hostile local
mutation and does not create attestation or adversarial-race machinery.

## Tier contract

- **Tier 0 — host unit/static.** Plain `pytest` runs this tier only. It must not
  require or invoke Docker, OpenShell, Prime Agent, PostgreSQL, or gbrain.
  Mocked tests of orchestration belong here.
- **Tier 1 — Docker plugin/runtime tests.** These run through the existing
  tier-1 Docker fixture/entry and retain the Docker-only plugin-development
  policy. They may never become host execution through marker tricks.
- **Tier 2 — real integration.** This is the disposable Slice-3
  PostgreSQL 16 + pgvector + locked-gbrain environment. The assertion body is
  not a host pytest entry and runs only inside its purpose-built Docker image.
- **Lifecycle.** Real OpenShell/lifecycle execution remains disabled. Tests may
  cover lifecycle code through mocks or isolated Docker probes, but no public
  test flag enables lifecycle mutation.

## Collection and entry requirements

1. With no `-m`, pytest collects/runs only tier 0 and does not call Docker.
2. A random or compound marker expression is not authorization to run protected
   tests. Only the supported tier selection can admit that tier, and the wrong
   entry fails or skips closed before its body or environment fixture runs.
3. Tests requiring tier-1 fixtures are marked consistently and can only run
   through the supported tier-1 path.
4. The integration assertion module cannot be collected or executed directly on
   the host.
5. Mock-only orchestration tests remain tier 0 and describe themselves as mocks,
   not Docker/integration proof.
6. `scripts/test-all.sh` is the default complete entry: tier 0, then tier 1,
   then tier 2, sequential and fail-fast.

## Lifecycle and plugin boundaries

Plugin source stays inert under `src/prime-agent-plugin/`. Candidate validation is
Docker-only; no host/user-global apply, check, or native plugin probe is permitted.
Any old or new CLI option that purports to enable lifecycle tests returns a clear
nonzero usage error before mutation. Slice 4 does not enable lifecycle execution.

## Acceptance

Tests cover collection behavior, arbitrary marker expressions, host-inert
integration bodies, mocked-test classification, sequential `test-all`, legacy and
current lifecycle flags, and non-mutation. Docs, requirements inventory, and a
Slice-4 evidence record match the behavior. Run the real supported tiers and one
normal review against this practical contract.

## Guardrails and boundary

Bias for DONE over perfect. Excluded same-UID attacks and security attestation are
not blockers. Do not launch recursive red-team review. If two repair/review cycles
still find material in-scope defects, stop for operator scope consultation.
Preserve accepted Slices 1–3 and do not start Slice 5+.
