---
id: PRIMECLAW-25
title: Remove obsolete chain-next migration cleanup
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p2
type: task
ordinal: 91000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The current handoff implementation never creates or consumes .prime/agent/state/chain-next. Remove the dead marker constant, deletion helper, command/tool deletion side effect, session_start/session_shutdown hooks, and update focused tests and docs.

## Legacy notes

Completed and validated with the combined plugin change on 2026-10-09. handoff-chain no longer registers lifecycle cleanup hooks or removes dead chain-next state; focused Node/Python coverage passed in the maintained host suite, and canonical pinned 0.9.8 Docker tier-1 --probe passed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 handoff-chain registers no lifecycle hooks; /handoff and ralph_handoff behavior remains unchanged; focused tests and Docker tier-1 plugin validation pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Obsolete chain-next lifecycle cleanup removed and validated
<!-- SECTION:FINAL_SUMMARY:END -->
