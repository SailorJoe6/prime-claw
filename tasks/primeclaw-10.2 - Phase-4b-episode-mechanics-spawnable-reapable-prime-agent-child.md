---
id: PRIMECLAW-10.2
title: 'Phase 4b: episode mechanics (spawnable, reapable prime-agent child)'
status: To Do
assignee: []
created_date: '2026-10-12 01:00'
updated_date: '2026-10-12 01:02'
labels: []
dependencies:
  - PRIMECLAW-10.1
parent_task_id: PRIMECLAW-10
priority: p2
type: feature
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Define/validate the episode as a spawnable, reapable prime-agent child agent with CWD=project root. Invocation-tier state in the episode REPL; living-doc updates flow back. Respect the RLM automatic-preparation admission race (safe two-message spawn protocol). Done when an episode runs a full design->plan->execute cycle, updates living docs, and is reaped cleanly, manually driven.

## Legacy notes

Spawn-protocol nuance (Joe, 2026-09-08): the safe two-message spawn protocol stems from the auto-/prepare-injection plugin. If we drive everything manually at first, we may be able to simply start each spawned subagent with an instruction like 'start by running the prepare skill, then do X' instead of the bootstrap workaround. Do NOT over-engineer up front — decide after manual driving reveals what the episode actually needs.
<!-- SECTION:DESCRIPTION:END -->
