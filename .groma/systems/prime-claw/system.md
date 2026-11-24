---
type: C4 System
title: Prime Claw
status: stable
groma:
  id: prime-claw
description: A persistent project assistant that separates operator decisions from isolated implementation work.
---

The builder repository ships a Prime Agent plugin and tooling for its OpenShell sandbox. The operator directs work through a Conversation; an Episode implements one approved task in its own worktree and durable session. Task history uses the selected task provider and a separate Git history branch. The sandbox memory stack uses gbrain with PostgreSQL and pgvector; it is not the task store. The sandbox lifecycle CLI, image, policy, and managed Markdown workflows are described in the repository but not scanned as source components.
