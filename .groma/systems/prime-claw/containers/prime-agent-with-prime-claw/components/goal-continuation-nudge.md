---
type: C4 Component
title: Goal continuation
status: stable
groma:
  id: goal-continuation-nudge
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extensions/goal-continuation-nudge.ts
  group: Workflow routing
description: Maintains goal continuation behavior in normal Prime Agent sessions.
---

Keeps goal nudges separate from task admission and Episode assignments.
