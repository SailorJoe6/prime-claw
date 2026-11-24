---
type: Groma Flow
title: Start a Backlog Episode
groma:
  id: start-a-backlog-episode
---

Follow the Orca-hosted path for a published Backlog task. Planning and readiness create no resources. A fresh Episode gets one initial execute; recovery reuses proven existing resources. Local Git placement is an alternative. Merge and cleanup are separate decisions.

## Steps

| From | To | Action |
| --- | --- | --- |
| [Operator](../actors/operator.md) | [Reviewed workflow tools](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/reviewed-workflow-tools.md) | Name the Backlog task and request Episode placement. |
| [Reviewed workflow tools](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/reviewed-workflow-tools.md) | [Planning and readiness admission](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/prep-chain.md) | Admit readiness review for the exact task. This creates no Episode. |
| [Planning and readiness admission](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/prep-chain.md) | [Canonical workflow delivery](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/workflow-chain.md) | Queue the canonical readiness workflow in the owning Conversation. |
| [Reviewed workflow tools](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/reviewed-workflow-tools.md) | [Task history](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/task-history-workspace.md) | Read the exact native task and its design and plan before creation. |
| [Reviewed workflow tools](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/reviewed-workflow-tools.md) | [Episode lifecycle](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/episode-lifecycle.md) | Create only after the Conversation checks authority, readiness, and placement. |
| [Episode lifecycle](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/episode-lifecycle.md) | [Durable Episode ownership](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/durable-episode-ownership.md) | Reserve the task and owner binding before allocating fresh resources. |
| [Episode lifecycle](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/episode-lifecycle.md) | [Task history](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/task-history-workspace.md) | Prepare separate Episode task history and publish the task status through the configured path. |
| [Episode lifecycle](../systems/prime-claw/containers/prime-agent-with-prime-claw/components/episode-lifecycle.md) | [Orca](../externals/orca.md) | On this placement path, allocate the isolated worktree and bind the durable session. The lifecycle sends one initial execute on fresh creation. |
