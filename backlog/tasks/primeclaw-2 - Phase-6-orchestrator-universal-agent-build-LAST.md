---
id: PRIMECLAW-2
title: 'Phase 6: orchestrator (universal agent) - build LAST'
status: In Design
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-14 14:45'
labels: []
dependencies:
  - PRIMECLAW-8
  - PRIMECLAW-10.3
priority: p3
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stand up the always-on top-level agent only after Phases 1-4 are validated manually. Always-on, heartbeat-driven, checks channels on a schedule, gbrain universal source, spawns project conversations and episodes. Runs inside the OpenShell-sandboxed container. Done when it runs unattended and can spawn a project conversation on demand.
<!-- SECTION:DESCRIPTION:END -->
