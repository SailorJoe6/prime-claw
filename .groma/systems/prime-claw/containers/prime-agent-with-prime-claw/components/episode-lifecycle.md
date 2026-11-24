---
type: C4 Component
title: Episode lifecycle
status: stable
groma:
  id: episode-lifecycle
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/spec-episode.ts
  group: Episode lifecycle
description: Creates, recovers, continues, and finalizes exact isolated Episodes.
---

Selects local or Orca placement, binds an isolated Git worktree and durable session to ownership, and delivers one initial execute on fresh creation. Recovery proves prior state before repeating an action. Supports task-native ownership and retained v1 compatibility.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/prime-agent-plugin/extension-support/spec-episode.ts](../../../../../../src/prime-agent-plugin/extension-support/spec-episode.ts) | [src/prime-agent-plugin/extension-support/task-episode-ownership.ts](../../../../../../src/prime-agent-plugin/extension-support/task-episode-ownership.ts) | Reserves Episode ownership | TypeScript |
| [src/prime-agent-plugin/extension-support/spec-episode.ts](../../../../../../src/prime-agent-plugin/extension-support/spec-episode.ts) | [src/prime-agent-plugin/extension-support/task-history-workspace.ts](../../../../../../src/prime-agent-plugin/extension-support/task-history-workspace.ts) | Prepares Episode task history | TypeScript |
| [src/prime-agent-plugin/extension-support/spec-episode.ts](../../../../../../src/prime-agent-plugin/extension-support/spec-episode.ts) | [orca](../../../../../externals/orca.md) | Places isolated Episodes | Orca CLI |
