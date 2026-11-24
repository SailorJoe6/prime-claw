---
type: C4 Component
title: Canonical workflow delivery
status: stable
groma:
  id: workflow-chain
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/workflow-chain.ts
  group: Workflow routing
description: Delivers ordered workflow prompts without silently substituting entry points.
---

Shares delivery mechanics across preparation and continuation, with explicit admission results.

## Derived relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/prime-agent-plugin/extension-support/workflow-chain.ts](../../../../../../src/prime-agent-plugin/extension-support/workflow-chain.ts) | [src/prime-agent-plugin/extension-support/prep-chain.ts](../../../../../../src/prime-agent-plugin/extension-support/prep-chain.ts) | Invokes supplied callbacks: deliverFirst, deliverFollowUp | typescript |
| [src/prime-agent-plugin/extension-support/workflow-chain.ts](../../../../../../src/prime-agent-plugin/extension-support/workflow-chain.ts) | [src/prime-agent-plugin/extension-support/spec-episode.ts](../../../../../../src/prime-agent-plugin/extension-support/spec-episode.ts) | Invokes supplied callbacks: deliverFirst, deliverFollowUp | typescript |
| [src/prime-agent-plugin/extension-support/workflow-chain.ts](../../../../../../src/prime-agent-plugin/extension-support/workflow-chain.ts) | [src/prime-agent-plugin/extensions/handoff-chain.ts](../../../../../../src/prime-agent-plugin/extensions/handoff-chain.ts) | Invokes supplied callbacks: deliverFirst, deliverFollowUp | typescript |
