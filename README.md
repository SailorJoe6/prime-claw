# prime-claw

**Builder repo** for the prime-claw sandbox: the scripts, docs, plans, and
tooling used to construct and iterate on a persistent personal engineering
org built on the prime-agent harness.

- [VISION.md](VISION.md) — what prime-claw is, the agent hierarchy, the
  three-horizon context model, and why prime-agent.
- [LONG_RANGE_PLAN.md](LONG_RANGE_PLAN.md) — the long-range, manual-first build order.
- [docs/](docs/README.md) — design docs and lineage notes.

## What this repo is (and is not)

This repo **builds** prime-claw. It is analogous to `openclaw-setup` and
`nemo-setup`: a control directory of build tooling, design docs, and
verification gates. It is **not** the claw itself — the claw's runtime home
(a sandboxed container the prime-agent daemon owns) is the product this
repo constructs.

## Status

Founding skeleton. See [LONG_RANGE_PLAN.md](LONG_RANGE_PLAN.md) Phase 0.

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

This project uses **bd** (beads). Run `bd ready` to find available work.
