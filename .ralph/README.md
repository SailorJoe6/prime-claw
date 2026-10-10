# .ralph — prime-claw planning layout

This directory holds the Ralph-style planning artifacts used by Prime Claw.
Project skills and lifecycle workflows now live outside `.ralph`.

- `skills/` is retired. Project initialization migrates recognized legacy
  files to regular customizable `.agents/skills/` files and lifecycle-only
  `.prime-claw/workflows/` files without moving `plans/`.
- `plans/` — created on demand by the design/plan skills. The design and
  spec-it-out skills produce one `SPECIFICATION.md`; the plan skill produces
  `EXECUTION_PLAN.md`; finished work archives to `plans/archive/`; blocked work
  moves to `plans/blocked/`.

Provenance note: the migrated project assets remain Prime-Agent-native and are
canonical under `src/prime-agent-plugin/`. Installed project copies can diverge
safely under the tracked template manifest.
