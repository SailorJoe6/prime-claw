---
id: PRIMECLAW-70
title: Accept a checksummed local Pi archive in Docker Tier 1
status: In Progress
assignee: []
created_date: '2026-11-24 06:56'
updated_date: '2026-11-24 07:06'
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
<!-- SECTION:NOTES:END -->
