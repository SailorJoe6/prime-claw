# prime-claw

**Builder repo** for the prime-claw sandbox: the scripts, docs, and tooling
used to construct and iterate on a **persistent virtual personal
assistant** built on the prime-agent harness.

prime-claw is a claw for any thought worker who runs multiple parallel
projects. It helps them create by becoming a **factory** for whatever their
work produces — software, content, business, or anything else that fits its
agentic capabilities.

- [VISION.md](VISION.md) — what prime-claw is, the agent hierarchy, the
  three-horizon context model, and why prime-agent.
- [LONG_RANGE_PLAN.md](LONG_RANGE_PLAN.md) — the long-range, manual-first build order.
- [docs/](docs/README.md) — design docs and lineage notes.
- [Supported Prime Agent installation](docs/prime-agent-installation.md) — the
  mandatory fork-source identity and Docker-only build path.

## What this repo is (and is not)

This repo **builds** prime-claw. It is a control directory of build tooling, 
design docs, and verification gates. It is **not** the claw itself — the claw's 
runtime home (a sandboxed container the prime-agent daemon owns) is the product 
this repo constructs.

## Status

Active builder repository. Phases 0–2 are complete. Phase 3 has delivered its
initial tracer-bullet slices and is safely blocked at the recorded model probe
boundary pending operator clearance. Phase 4 has delivered the owner-accepted
reviewed specification/planning commands and worktree-isolated episode-promotion
mechanics; its live human end-to-end dogfood is deliberately deferred to a
separate future episode. See the [long-range plan](LONG_RANGE_PLAN.md) for the
full phase status and blockers.

## Phase 4 operator workflows

- [Task-native specification authoring and retained bundle compatibility](docs/future-specification-bundles.md)
  — author or revise one exact `In Design` task with `/skill:design` or
  `/skill:spec-it-out`, then use `/plan TASK-ID` for separate plan review.
  Use `/implement-task TASK-ID` for new task-native Episodes. The generic plugin
  retains `/plan-spec` and `/implement-spec` for initialized projects that still
  have version-1 bundles; this builder repository no longer stores a local
  `.ralph/plans` tree.
- [Native handoff chain](docs/handoff-chain.md) — update durable records and
  continue an approved episode iteration through focused compaction and the
  canonical execute workflow.
- [Documentation index](docs/README.md) — runtime, architecture, evidence, and
  operator references.

## Lineage

prime-claw synthesizes four prior projects:

- **zbrain** — generic always-on claw chassis (gbrain + gstack-browser +
  cron + channel scraping)
- **ralph-pva** — first-iteration PVA on the zbrain chassis
- **nemo-setup** — NemoClaw/OpenShell sandboxing blueprint (Hermes agent)
- **openclaw-setup** — the furthest-developed builder repo: OpenClaw on
  NemoClaw/OpenShell with full apply/check/validate/test discipline and
  requirements traceability

prime-claw keeps the sandboxing discipline and the PVA ambition, and puts
prime-agent at the core.

## Issue tracking

This project uses **Backlog.md**. Inspect the unblocked `In Design` and
`In Planning` queues with:

```sh
backlog task list --status "In Design" --status "In Planning" --ready --plain
```

See [docs/backlog.md](docs/backlog.md) for the task-native lifecycle and build
provenance.
