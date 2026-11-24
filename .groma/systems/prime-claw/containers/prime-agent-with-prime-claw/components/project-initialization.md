---
type: C4 Component
title: Project initialization
status: stable
groma:
  id: project-initialization
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extensions/project-initialization.ts
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/project-initialization.ts
  group: Project and task setup
description: Inspects Git projects and reconciles managed assets on explicit setup or update.
---

Startup reports needed work during a normal turn. Reconciliation retains local customization, observes provider configuration, and preserves active Episode snapshots.
