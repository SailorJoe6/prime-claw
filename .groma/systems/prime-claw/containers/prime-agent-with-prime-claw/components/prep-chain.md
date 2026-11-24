---
type: C4 Component
title: Planning and readiness admission
status: stable
groma:
  id: prep-chain
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/prep-chain.ts
  group: Workflow routing
description: Starts the canonical planning or readiness workflow for exact admitted work.
---

Binds task or bundle input and queues the next managed workflow without allocating an Episode.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/prime-agent-plugin/extension-support/prep-chain.ts](../../../../../../src/prime-agent-plugin/extension-support/prep-chain.ts) | [src/prime-agent-plugin/extension-support/workflow-chain.ts](../../../../../../src/prime-agent-plugin/extension-support/workflow-chain.ts) | Delivers readiness workflow | TypeScript |
