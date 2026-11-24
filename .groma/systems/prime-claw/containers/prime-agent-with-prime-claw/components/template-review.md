---
type: C4 Component
title: Template review
status: stable
groma:
  id: template-review
  parent: prime-agent-with-prime-claw
  code:
    - scanner: typescript
      file: src/prime-agent-plugin/extension-support/template-review.ts
  group: Project and task setup
description: Shows a comparison before a destructive template decision.
---

Uses disposable copies for review and handles retained interrupted-review state separately.
