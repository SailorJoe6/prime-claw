---
name: prepare
description: Use for prime-claw's session orientation to load the minimum context needed before work begins.
---

# Prepare — prime-claw session orientation

prime-claw follows progressive disclosure: load the minimum context for the
current task, follow links to detail, never bulk-load. This skill orients a
fresh session.

## Orientation (do this)

Read these files, in this order:

1. **[AGENTS.md](AGENTS.md)** — operating instructions, beads usage, the RLM
   safe-spawn protocol, credential isolation, and the land-the-plane rule.
2. **[VISION.md](VISION.md)** — what prime-claw is, the four-tier hierarchy,
   and the three-horizon context model.
3. **[LONG_RANGE_PLAN.md](LONG_RANGE_PLAN.md)** — the risk-ordered slice map and
   which phase is active.
4. **[docs/information-architecture.md](docs/information-architecture.md)** —
   the multi-store routing layer (consult when a task involves persisting
   anything durable).

Then run `bd ready` to see unblocked work.

## When the reasoning matters

If the task depends on *why* a design decision was made (not just what it is),
read **[docs/founding-decisions.md](docs/founding-decisions.md)**. It is the
curated record of the founding session's decisions and rejected alternatives.

## Deeper context (only as needed)

- `docs/lineage/` — prior art (zbrain, ralph-pva, nemo-setup, openclaw-setup).
- `docs/README.md` — the full documentation index.
- The raw founding-session transcript is referenced in
  `docs/founding-decisions.md` — consult only when the curated doc is
  insufficiently specific.

Do not read all of these up front. Pull them when the task touches them.
