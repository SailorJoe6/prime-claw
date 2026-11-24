---
type: C4 Component
title: Role protocol delivery
status: stable
groma:
  id: manage-prime-agent-role-protocol
  parent: plugin-delivery-toolkit
  code:
    - scanner: python
      file: scripts/manage-prime-agent-role-protocol.py
description: Reconciles the managed role guidance.
---

Keeps the installed role block aligned with the managed source without treating unrelated operator text as a managed asset.
