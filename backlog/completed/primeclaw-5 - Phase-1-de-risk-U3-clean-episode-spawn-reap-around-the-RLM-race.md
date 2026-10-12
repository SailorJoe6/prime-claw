---
id: PRIMECLAW-5
title: 'Phase 1 (de-risk) U3: clean episode spawn/reap around the RLM race'
status: Done
assignee: []
created_date: '2026-10-12 01:00'
labels: []
dependencies: []
priority: p0
type: feature
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prove a parent session can spawn a prime-agent child with CWD=project-root and reap it cleanly, working around the RLM automatic-preparation admission race (openclaw-setup docs/prime-agent-rlm-preparation-race.md). Documented go/no-go.

## Legacy notes

2026-09-10: Spec'd and planned. EXECUTION_PLAN.md slice 5. CLI-driven session-in-a-folder start is the hard baseline (R-U3-2, known-good); agent-driven spawn + RLM race documentation is non-blocking nice-to-have (R-U3-3); test a race workaround ONLY if the race manifests (D6).
2026-09-11 U3 GO. Spawn/reap proven in-sandbox: git project /sandbox/episode-target (R-U3-1); CLI --cwd tool-read sentinel cwd proof + daemon create/get_state(cwd)/kill clean reap (R-U3-2); agent-driven spawn = same daemon channel, RLM race documented per D6 (R-U3-3 NICE). Validator scripts/validate-phase1-spawn.py exit 0, two consecutive GO. Gotchas in docs/derisk/U3.md (daemon create/kill are RPC not public CLI; prime-agent create is interactive; unique session names; cold-daemon retry). Evidence: docs/derisk/evidence/phase1-spawn-*.json.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed
<!-- SECTION:FINAL_SUMMARY:END -->
