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
- [handoff-chain.md](handoff-chain.md) — the Phase 4a native `/handoff` →
  focused compaction → next-skill transition, its legacy Ralph-loop lineage,
  marker lifecycle, regression tests, evidence, and short-session recovery.
- [future-specification-bundles.md](future-specification-bundles.md) — reviewed
  future-folder authoring plus the native `/plan` gate and its deterministic
  loader versus customizable planning-policy boundary.

(Capability design docs land here as the builder grows, one per capability,
following the openclaw-setup pattern.)

## De-risk evidence (Phase 3)

- [derisk/3a-slice0.md](derisk/3a-slice0.md) — Slice 0 spike verdict (GO):
  upstream gbrain builds/runs in-sandbox; models.json mirroring (R3a-13).
- [derisk/3a-slice1.md](derisk/3a-slice1.md) — Slice 1: push-capable
  credential-safe brain clone, and the shell-quoting root cause of the
  fresh-create 401s (a cautionary bisect tale).
- [derisk/3a-slice2.md](derisk/3a-slice2.md) — Slice 2: in-sandbox index
  serving (brain-index stage, 1057 pages + 3029 embeddings), the validate
  false-pass fix, and the VPN-down RBAC-403 signature.
- [derisk/3a-slice3.md](derisk/3a-slice3.md) — Slice 3: cited
  read/query from sandboxed prime-agent, plus host settings mirroring and
  placeholder-isolated ChatGPT-5.6 Sol / openai-codex OAuth as an explicit operator override.
- [derisk/3a-slice4r.md](derisk/3a-slice4r.md) — Slice 4R: mandatory explicit
  per-operator brain repository setup, provenance hardening, and pre-mutation gates.

## Runtime (Phase 2)

- [sandbox-runtime.md](sandbox-runtime.md) — the sandbox lifecycle: verbs,
  stages, repo layout, and operating guarantees.
- [home-embedding-runtime.md](home-embedding-runtime.md) — portable AI-gateway embedding
  default plus the optional, non-destructive 1536→4096 home-Qwen override contract.
- [runbook.md](runbook.md) — operations: failure signature → recovery command.
