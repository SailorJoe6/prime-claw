---
type: C4 Container
title: Brain query CLI
status: stable
groma:
  id: brain-query-cli
  parent: prime-claw
  technology: Python, gbrain
description: Reads cited memory from the sandbox brain.
---

The sandbox lifecycle CLI stages this Python helper separately from the plugin. It talks to the sandbox gbrain installation and does not participate in task-history publication.

## Relationships

| Source | Target | Description | Technology |
| --- | --- | --- | --- |
| [brain-query-cli](container.md) | [gbrain](../../../../externals/gbrain.md) | Queries sandbox memory | gbrain CLI |
