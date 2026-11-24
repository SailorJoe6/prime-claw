---
id: PRIMECLAW-70
title: Accept a checksummed local Pi archive in Docker Tier 1
status: In Progress
assignee: []
created_date: '2026-11-24 06:56'
updated_date: '2026-11-24 07:14'
labels: []
dependencies: []
references:
  - >-
    https://github.com/SailorJoe6/prime-agent-pi/commit/94e177fe1b2611faa722af6031d5b8f2fb2a5091
documentation:
  - docs/design-decisions/DD-003-prime-agent-v098-plugin-boundary.md
  - docs/design-decisions/DD-005-docker-only-plugin-candidate-validation.md
modified_files:
  - tests/test_tier1_driver.py
  - scripts/test-tier1.sh
  - scripts/testing/tier1_pi_archive.py
  - scripts/testing/provenance.py
  - .env.example
  - docs/testing-strategy.md
  - tests/unit_env_tier1_driver_body.py
  - tests/test_container_helpers_static.py
  - tests/test_tier1_fixture.py
  - tests/test_testing_provenance.py
  - docker/test.Dockerfile
type: task
ordinal: 154000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Enable the operator-approved PAPI-61 compatibility probe on exact native archive bytes. Add an explicit, experimental local archive input to Prime Claw’s disposable Docker Tier 1 workflow, not a new approved runtime. Require an expected SHA-256 and verify before extraction or execution; preserve existing source and pinned legacy routes, defaults, and qualification policy. Do not run the actual Pi compatibility test on this task or change the host installation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An explicit local native archive and matching SHA-256 can feed the existing Docker-only probe wrapper with synthetic state; missing or mismatched inputs are rejected before extraction or execution.
- [ ] #2 Positive and negative fixture tests and the relevant Tier 1 checks verify the new route and show that default, source and pinned legacy behavior is unchanged.
- [ ] #3 Document the experimental invocation and its limits; no host install, policy change, activation or release.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Review candidate `72bca9cb359c77291b89254233b8eba4bf4b40cc` on `JLanders/primeclaw-70-tier1-pi-archive`. Experimental standalone `--probe` mode only; set `PRIME_AGENT_PI_ARCHIVE` and `PRIME_AGENT_PI_SHA256` together in the `TIER1_ENV_FILE`. Offline digest before archive opening, bundle kept adjacent, official isolated probe wrapper. Qualified source and legacy selection unchanged.

Docker: benign archive passed (`20261124T070200Z-46163-bff37dfe`), wrong checksum refused before install/probe (`20261124T070214Z-47331-4074e4d0`), qualified source passed (`20261124T070224Z-48178-aab7363e`); those three test the same implementation at `cb143d4`, before a test inventory count-only commit. Final candidate launcher meta bridge passed (`20261124T070351Z-54282-8e2f0b59`); focused Tier 0: 85 tests, 59 subtests passed. Full Tier 0: 736 passed, 117 skipped, seven failures also seen on clean base 12a96f6. Docker evidence hashes verified and clean offline teardown. Real Pi archive not run; no runtime qualification, installation, or activation. In Progress pending review.

Review revision `7437f719353f694bdea8308d6d0ce78ef1e7bcaf` (same review branch) fixes all three findings: Pi-only version parser preserves 0.10.2.2 at CLI/artifact/manifest; Pi-only image adds native musl and matching C++/GCC libraries; commented Pi keys preserve source/pin pytest template compatibility. Existing source/pin parsing and default build target behavior stay unchanged.

Exact revision evidence: [('20261124T071230Z-94269-4b7b3b98', 'adcef0cb336d6e54f3c9e68b03a1dd7dbb394dbf17ada4754a1d896112be2a34', 'pi-archive', 'passed', True, True, 8, True), ('20261124T071244Z-95188-ff66866b', '51a3b120c117c3a4d01c23d7c116ea9dd4f105555aaf4cfd569d8f813ed9c55f', 'pi-archive', 'failed', True, True, 7, True), ('20261124T071249Z-95573-79b72788', '4d44c31e1d5449fe6e068f092c1c9f09f12c4e8289d9bd0420f5ac10ca714f60', 'source', 'passed', True, True, 14, True)]. Benign dynamically linked ARM64 C++ fixture used interpreter /lib/ld-musl-aarch64.so.1 and loaded libstdc++.so.6, libgcc_s.so.1 and libc.musl-aarch64.so.1. Version and artifact both recorded 0.10.2.2; executable SHA-256 65b412d025d15dd5aeb5487f0a1623bf331dc706aee4bef8233a9a14add5c00e. Wrong checksum stopped before install/apply/probe. Source launcher-meta bridge passed from copied .env.example with only SOURCE selected. Focused tests 139 passed, 87 subtests passed. All 29 Docker evidence files verified against manifest hashes, and offline runs tore down cleanly. No real Pi archive execution, merge, activation or PAPI-61 lifecycle change. In Progress on review hold.
<!-- SECTION:NOTES:END -->
