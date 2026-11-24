---
type: C4 Component
title: Sandbox Node compatibility
status: stable
groma:
  id: npm-onload
  parent: prime-agent-with-prime-claw
  code:
    - scanner: javascript
      file: scripts/lib/npm-onload.js
description: Loads the Node compatibility shim in the sandbox runtime.
---

The sandbox lifecycle CLI stages this preload alongside the runtime. It is not part of the Prime Claw TypeScript plugin.
