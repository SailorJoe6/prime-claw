---
type: C4 Component
title: Project state directory
status: stable
groma:
  id: prime-claw-directory
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/prime-claw-directory.ts
      symbol: ensurePrimeClawDirectory
  group: Project and task setup
description: Provides the project-local directory for managed state.
---

Keeps operational metadata separate from the project’s authored source assets.
