---
type: C4 Actor
title: Operator
description: Sets intent, reviews work, and authorizes consequential actions.
status: stable
groma:
  id: operator
---

Uses a Conversation to select tasks and review readiness. Keeps authority over scope, merge, abandonment, and destructive cleanup.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [operator](operator.md) | [reviewed-workflow-tools](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/reviewed-workflow-tools.md) | Requests isolated implementation | Prime Agent tools |
| [operator](operator.md) | [plugin-delivery-toolkit](../systems/prime-claw/containers/plugin-delivery-toolkit/container.md) | Stages plugin updates | Shell CLI |
