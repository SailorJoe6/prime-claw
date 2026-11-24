---
type: C4 Component
title: Retained plan compatibility
status: stable
groma:
  id: retained-plan-compatibility
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/legacy-workflow.ts
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/legacy-specification-inventory.ts
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/episode-close.ts
  group: Episode lifecycle
description: Keeps existing version-1 Episodes operable while task-native workflows are preferred.
---

Tracks eligible legacy bundles and supports blocked-plan recovery and the old bookkeeping close without silently changing authority.
