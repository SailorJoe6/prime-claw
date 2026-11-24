---
type: C4 Component
title: Conversation oversight
status: stable
groma:
  id: conversation-oversight
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/conversation-oversight.ts
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/task-handoff-observation.ts
  group: Episode lifecycle
description: Restores an owning Conversation’s oversight context and retains delivery evidence.
---

Supports review and deliberate continuation after compaction. It does not transfer implementation or terminal decision authority to another role.
