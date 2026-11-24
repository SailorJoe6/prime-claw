---
type: C4 Component
title: Task history
status: stable
groma:
  id: task-history-workspace
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/task-history-workspace.ts
  group: Project and task setup
  technology: Git worktrees and refs
description: Projects and publishes native task data separately from product code.
---

Prepares primary and Episode task-history workspaces and verifies publication on the configured Git history ref. This is separate from the Episode implementation branch and the sandbox memory database.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [src/prime-agent-plugin/extension-support/task-history-workspace.ts](../../../../../../src/prime-agent-plugin/extension-support/task-history-workspace.ts) | [backlog-md](../../../../../externals/backlog-md.md) | Accesses native task records | Backlog CLI |
