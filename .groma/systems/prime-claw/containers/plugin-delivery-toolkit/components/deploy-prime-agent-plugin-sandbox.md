---
type: C4 Component
title: Restored sandbox deployment
status: stable
groma:
  id: deploy-prime-agent-plugin-sandbox
  parent: plugin-delivery-toolkit
  code:
    - scanner: python
      file: scripts/deploy-prime-agent-plugin-sandbox.py
description: Installs plugin assets into a restored sandbox.
---

Uses the sandbox-specific installation path rather than targeting the host user-global harness.
