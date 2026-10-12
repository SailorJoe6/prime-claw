---
id: PRIMECLAW-19.3
title: 'Slice 3: migrate plugin tests to tier 1 + tier markers + unified entry'
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-19
priority: p1
type: task
ordinal: 64000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
pytest markers (tier0 default, container, sandbox), session-scoped conftest fixture (one container per run), migrate node .test.mjs bridges + install tests + live RPC probes into container, scripts/test-all.sh composes tiers fast-first fail-fast, results in gitignored dir, docs updated.
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
SLICE-3 SCOPE (operator-approved at handoff after slice-2 PASS on bc00cba; final slice): (1) pytest.ini or pyproject.toml registering markers container (tier 1) and sandbox (tier 2); unmarked = tier 0. (2) tests/conftest.py session-scoped fixture: ONE tier-1 container per pytest run that includes container tests, exec helper, destroyed at session end; driver-equivalent setup (install prime-agent per .env, apply plugin inside) runs ONCE per session. (3) Migrate the tier-1 inventory so node/prime-agent subprocess calls execute INSIDE the container via the fixture; tier-1 test code must not reference host paths (shutil.which(prime-agent) -> container exec). (4) scripts/test-all.sh dumb sequencer: tier 0 -> tier 1 -> (tier 2 only on explicit --with-sandbox), fail-fast, tier summary; results/logs to a gitignored results dir. (5) Decide + document episode_close_extension.test.mjs fate (bridge or documented reason). (6) DEVELOPERS.md testing section update. (7) R-T1-* entries in config/requirements-inventory.json per apply/check/validate/test discipline; tests/test_inventory_integrity.py must stay green. MERGE-RECONCILIATION (plan watch item): rebase onto current main first if advanced; re-audit the test inventory against current main using the assignment RULE (needs node / prime-agent binary / plugin install -> tier 1), not the frozen planning-time list; migrate any new plugin-touching tests that landed on main. CONSTRAINTS: no plugin source changes; host gates tier-0 subset only (skip live RPC probes); driver/sequencer stays dumb; no CI wiring; do NOT retire run-prime-agent-probe.sh. ACCEPTANCE: pytest tests/ -q (tier-0 default) passes with no Docker dependency; pytest -m container runs the full migrated plugin suite inside ONE container per run, green, host plugin install untouched; scripts/test-all.sh runs tier 0 + tier 1 green end-to-end; evidence note under docs/evidence/; close blw.3 with evidence; commit+push; report new exact commit hash(es) to owner.
---

author: Joe Landers
created: 2026-10-12 01:02
---
COMPLETE at d040c02 (slice 3) + 7118a44 (merge reconciliation onto 9b3edd2), pushed. Markers (container/sandbox; unmarked=tier-0) + default-skip policy in pytest.ini/conftest.py; session-scoped tier1_container fixture (one container per run, driver-equivalent setup once, exec/popen with in-container hard timeouts, same-path ctmp share + container-local croot); all 7 tier-1 files migrated (plugin_install converted unittest->pytest); every node suite bridged (episode_close + project_conversation were BOTH unbridged — decision: bridge both, statically enforced); scripts/test-all.sh dumb sequencer (tier0->tier1, --with-sandbox tier2, fail-fast, summary, gitignored .test-results/); DEVELOPERS.md rewritten; R-T1-1..5 in requirements-inventory.json (integrity green). Acceptance: tier-0 default 223 passed/141 skipped (no Docker); pytest -m container 37 passed in ONE container (pinned 0.9.3 AND source fork 0.9.8); test-all.sh tier0+tier1 PASS; host plugin untouched; no leftover containers. Findings in docs/evidence/2026-09-30-tier1-slice3-migration-sequencer.md: gRPC-FUSE cpSync EACCES (guest-created sources) -> croot; host Unix sockets unreachable from container (EOPNOTSUPP) -> in-container fake daemons; stale daemon-trace assertion repaired to the 376bc2b contract (test/plugin drift, flagged to owner). Awaiting fresh EXPERT gate.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed
<!-- SECTION:FINAL_SUMMARY:END -->
