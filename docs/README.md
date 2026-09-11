# prime-claw Documentation

## Founding

- [../VISION.md](../VISION.md) — the agent hierarchy, three-horizon context
  model, and why prime-agent.
- [../LONG_RANGE_PLAN.md](../LONG_RANGE_PLAN.md) — the manual-first, long-range build order.

## Lineage (prior art, distilled)

prime-claw builds on four prior projects. Read these before designing:

- [lineage/openclaw-setup.md](lineage/openclaw-setup.md) — the furthest-
  developed builder repo: apply/check/validate/test discipline,
  requirements traceability, NemoClaw/OpenShell runtime, Telegram channel
  decision, and the prime-agent RLM race workaround.
- [lineage/nemo-setup.md](lineage/nemo-setup.md) — the NemoClaw/OpenShell
  sandboxing blueprint with a Hermes agent and L7 credential injection.
- [lineage/zbrain.md](lineage/zbrain.md) — the generic always-on claw
  chassis: gbrain + gstack-browser in a container, cron, channel scraping.
- [lineage/ralph-pva.md](lineage/ralph-pva.md) — the first-iteration PVA
  and the "home it can call its own" pattern.

## Founding record

- [founding-decisions.md](founding-decisions.md) — the *why* behind the
  project: decisions, rejected alternatives, and the original session ID.
  Read this first when the reasoning matters, not just the conclusions.

## Design docs

- [information-architecture.md](information-architecture.md) — the
  multi-store routing layer: which store owns a durable fact (brain vs. docs
  vs. harness vs. beads vs. reports), the two-level routing split, and the
  report guard. Orthogonal to the three-horizon context model.

(Capability design docs land here as the builder grows, one per capability,
following the openclaw-setup pattern.)

## Runtime (Phase 2)

- [sandbox-runtime.md](sandbox-runtime.md) — the sandbox lifecycle: verbs,
  stages, repo layout, and operating guarantees.
- [runbook.md](runbook.md) — operations: failure signature → recovery command.
