---
id: PRIMECLAW-19.5
title: Fix Tier-1 pinned installer PATH after Prime Agent 0.9.8 install
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-19
priority: p2
type: bug
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tier-1 pinned install mode is broken with Prime Agent 0.9.8. The vendor installer succeeds and reports the binary at /root/.local/share/prime-agent/bin/prime-agent plus the required shell export PATH=/root/.local/bin:$PATH, but tests/conftest.py and scripts/test-tier1.sh immediately invoke prime-agent in the same non-interactive bash command without adding that directory to PATH. Result: every container test errors during shared fixture setup before plugin tests run. Reproduced during official-lean-session-protocol Slice 1 with PRIME_AGENT_PINNED=0.9.8; setup log recorded bash: prime-agent: command not found. Fix both the direct driver and pytest fixture consistently, add pinned-mode regression coverage for the installer-reported path, and keep source mode unchanged. This is independent of the lean protocol candidate; Slice 1 used a disposable source-mode dependency copy instead.

## Legacy notes

Fixed and pushed on main in 3bf905976a1a489d93e81619a838b34fc7ed8a31. Root cause: Prime Agent 0.9.8 vendor install publishes `/root/.local/bin/prime-agent`, but the shared tier-1 image PATH omitted that directory. Fix: `docker/test.Dockerfile` now prepends `/root/.local/bin`; regression in `tests/test_tier1_image.py`. Evidence: red pinned fixture reproduced `prime-agent: command not found`; static image/driver/fixture 103 passed; pinned fixture plugin suite 20 passed / 1 deselected; pinned standalone `scripts/test-tier1.sh --probe` PASS; clean `scripts/test-all.sh` tier0 PASS 52s, tier1 PASS 111s (40 passed / 390 deselected).
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed in pushed main commit 3bf9059; clean test-all tier0+tier1 PASS.
<!-- SECTION:FINAL_SUMMARY:END -->
