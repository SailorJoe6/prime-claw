---
type: C4 Component
title: Reviewed workflow tools
status: stable
groma:
  id: reviewed-workflow-tools
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extensions/reviewed-plan.ts
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/reviewed-plan-support.ts
  group: Workflow routing
description: Expose planning, readiness, Episode creation, and lifecycle operations to the agent.
---

Register Prime Agent tools and route exact task or retained-plan inputs to admission and lifecycle helpers. Policy stays in editable skills and workflows; entering planning or readiness does not authorize resource creation.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/prime-agent-plugin/extensions/reviewed-plan.ts](../../../../../../src/prime-agent-plugin/extensions/reviewed-plan.ts) | [src/prime-agent-plugin/extension-support/prep-chain.ts](../../../../../../src/prime-agent-plugin/extension-support/prep-chain.ts) | Queues readiness review | TypeScript |
| [src/prime-agent-plugin/extensions/reviewed-plan.ts](../../../../../../src/prime-agent-plugin/extensions/reviewed-plan.ts) | [src/prime-agent-plugin/extension-support/task-history-workspace.ts](../../../../../../src/prime-agent-plugin/extension-support/task-history-workspace.ts) | Resolves exact native task | TypeScript |
| [src/prime-agent-plugin/extensions/reviewed-plan.ts](../../../../../../src/prime-agent-plugin/extensions/reviewed-plan.ts) | [src/prime-agent-plugin/extension-support/spec-episode.ts](../../../../../../src/prime-agent-plugin/extension-support/spec-episode.ts) | Routes Episode lifecycle | TypeScript |
| [src/prime-agent-plugin/extensions/reviewed-plan.ts](../../../../../../src/prime-agent-plugin/extensions/reviewed-plan.ts) | [src/prime-agent-plugin/extension-support/conversation-oversight.ts](../../../../../../src/prime-agent-plugin/extension-support/conversation-oversight.ts) | Registers Conversation oversight | Prime Agent SDK |
| [src/prime-agent-plugin/extensions/reviewed-plan.ts](../../../../../../src/prime-agent-plugin/extensions/reviewed-plan.ts) | [src/prime-agent-plugin/extension-support/task-episode-cleanup.ts](../../../../../../src/prime-agent-plugin/extension-support/task-episode-cleanup.ts) | Wires exact cleanup | TypeScript |
