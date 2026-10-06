# Slice 4 evidence — truthful test tiers and default entry

Date: 2026-10-06  
Bead: `prime-claw-5v7.4`  
Base: owner-accepted Slice 3 `5d3db2f961d843a11289c38f5d60f646a8f65c9e`

## Practical boundary

The host, checkout, Docker daemon, launcher, and same-UID operator are trusted.
This slice prevents accidental host execution and misleading tier claims. It does
not add same-UID adversary defenses, attestation machinery, or recursive red-team
review. The two-cycle stop-loss from `prime-claw-5v7.9` applies.

## Implemented behavior

- Plain pytest keeps every environment tier skipped and runs host-safe tier 0.
- Only exact `-m container` admits tier 1. Other marker expressions cannot turn
  fixture users into host execution.
- Mocked `test_runtime_*` suites are accurately unmarked tier-0 unit tests.
- The tier-2 assertion program is non-collectable, imports no pytest machinery,
  and requires a launcher-supplied container entry marker before any work.
- `scripts/test-all.sh` runs tier 0, tier 1, then tier 2 sequentially and
  fail-fast. It has no lifecycle mode.
- `--with-sandbox` and `--with-lifecycle` return code 64 before tool preflight or
  mutation.
- Plugin candidate apply/check/probe remains Docker-only.
- Real OpenShell lifecycle execution remains disabled.

## Test-first checkpoint

The focused policy tests were first run against the pre-fix implementation and
failed on the marker bypass, old taxonomy, missing container entry marker,
missing tier-2 sequencing, and accepted legacy flag. After the implementation
change, the final focused policy/runtime set passed: 148 tests plus 8 subtests
in 7.22s. Log: `.test-results/slice4-source-20261006T044000Z/focused-final.log`;
SHA-256: `66f1729918750b306d9a81e6f51664317a5ab9051d554646c5fd2085fb9bbbcf`.

The final stable-tree plain-pytest sentinel run passed 504 tests, skipped 42,
and passed 138 subtests in 173.27s without invoking Docker. Log:
`.test-results/slice4-source-20261006T044000Z/plain-pytest-final.log`; SHA-256:
`79211c952ed6b0713d409633a301a73cb6090da93c29d6f1a43b41871e0745de`. Tier-1, tier-2, exact commit identity, and bounded final
review will be recorded on the Bead receipt after completion.
