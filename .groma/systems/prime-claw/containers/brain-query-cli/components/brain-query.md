---
type: C4 Component
title: Cited brain lookup
status: stable
groma:
  id: brain-query
  parent: brain-query-cli
  code:
    - scanner: python
      file: scripts/runtime/brain_query.py
description: Runs a read-only lookup against gbrain.
---

Returns evidence for a query without changing brain content or native task state.
