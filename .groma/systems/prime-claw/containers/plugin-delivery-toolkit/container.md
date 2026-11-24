---
type: C4 Container
title: Plugin delivery toolkit
status: stable
groma:
  id: plugin-delivery-toolkit
  parent: prime-claw
  technology: Python, shell
description: Stages and checks Prime Claw assets at explicit installation targets.
---

Operator-run entry scripts select a target then delegate to the Python delivery tools. A restored sandbox has a dedicated deployment path. Copying assets is distinct from live activation: an accepted refresh requires a coordinated restart and runtime checks.
