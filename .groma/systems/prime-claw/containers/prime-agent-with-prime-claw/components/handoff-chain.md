---
type: C4 Component
title: Ordinary Ralph handoff
status: stable
groma:
  id: handoff-chain
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extensions/handoff-chain.ts
      symbol: handoffChain
  group: Workflow routing
description: Queues handoff followed by one execute continuation for ordinary work.
---

This is separate from an owning Conversation continuing an exact managed Episode.
