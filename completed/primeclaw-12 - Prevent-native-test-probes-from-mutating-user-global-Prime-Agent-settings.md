---
id: PRIMECLAW-12
title: Prevent native test probes from mutating user-global Prime Agent settings
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p0
type: bug
ordinal: 46000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A conversation-identity POC isolated session storage but called set_auto_compaction without isolating the Prime Agent config directory, persisting compaction.enabled=false in ~/.prime/agent/settings.json. Restore the setting and add deterministic config isolation/restoration plus regression coverage for native probes/tests.

## Legacy notes

Root cause independently supplied and confirmed: one-off POC session isolation did not isolate user-global config before set_auto_compaction(false). Global setting restored through native RPC to enabled=true. Isolated subagent sub-3630e068 is implementing durable regression prevention on origin/main; active episode remains untouched.
OWNER ACCEPTED exact `624f85612d3172ad559b369502ddbc5fae4d7be4` on origin/main. Root cause: `--session-dir` isolates artifacts but not persistent config; config-mutating RPC reached default `~/.prime/agent`. Global auto-compaction was restored through native RPC and reverified enabled. Durable fix adds mandatory isolated wrapper with temporary `PRIME_AGENT_CODING_AGENT_DIR` + `PRIME_AGENT_SESSION_DIR`, signal/exit cleanup, preserved child status, policy in AGENTS.md, and regression tests. Independent exact-archive owner gate: 2/2 targeted PASS plus `sh -n`; diff scoped to AGENTS.md, wrapper, and test. Subagent also verified real mutating RPC left user settings hash unchanged, Node 72 PASS, Python 255 PASS + one timing retry PASS. Origin main exact/pushed; owner dirty checkout intentionally not reset or pulled. Episode integration waits for its safe boundary and must preserve reviewed history.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed and owner-verified on origin/main at 624f856; global auto-compaction restored
<!-- SECTION:FINAL_SUMMARY:END -->
