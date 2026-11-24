---
type: C4 Component
title: Durable Episode ownership
status: stable
groma:
  id: durable-episode-ownership
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/task-episode-ownership.ts
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/episode-ownership.ts
  group: Episode lifecycle
description: Reserves and tracks the exact owner, operation, task, and resource identities.
---

Uses a Conversation-keyed registry and verifies native task and Git evidence before binding or transitioning ownership. Existing resources remain attached to that exact binding.
