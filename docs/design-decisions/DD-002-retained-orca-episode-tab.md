# DD-002 — Retain a visible writable Orca Episode tab

- **Status:** accepted
- **Stories:** [US-14–US-16](../user-stories/E-episode-promotion.md), [US-23](../user-stories/H-handoff-and-continuation.md)

## Observed context

A combined Orca worktree-create-and-prompt call starts the model before Prime
Claw can deterministically promote and commit the approved bundle. A generic
terminal can start Prime Agent but lacks the native provider UX and
provider-aware observation. The accepted live probe instead created the
worktree without an agent, committed the bundle, used a disabled reusable
existing-workspace automation with provider `prime-agent`, and then removed
that temporary launcher. The connected visible writable Prime Agent tab and
durable exact-CWD session remained available.

Evidence: probe matrix L5, L12, L13, S1 and “Startup, compaction, and fallback
contract” in
[`2026-10-09-orca-prime-agent-integration-probes.md`](../evidence/2026-10-09-orca-prime-agent-integration-probes.md).

## Decision

Promote and commit before provider launch. Use Orca's native Prime Agent
provider without `--activate`, require positive visible readiness and one new
durable exact-CWD session, bind both identities, remove only the transient
launcher, and retain the visible writable tab. Later supervision uses native
Prime Agent messaging; Orca launch automation is not an Episode scheduler.

## Rejected simpler alternatives

- Combined create-and-prompt: violates promotion-before-execution ordering.
- Generic terminal launch: loses the accepted native provider UX.
- Closing the tab with the launcher: removes the operator's required visible
  Episode surface and weakens recovery/observation.

## Regression anchors

- `tests/spec_episode_extension.test.mjs`
- `tests/test_reviewed_plan_extension.py`
- the retained L13/S1 live probe above

## Revisit condition

Reconsider the transient automation only when a supported Orca API can launch
the native provider in an already prepared worktree, return durable
session/tab identity, preserve promotion ordering, and retain the same visible
writable surface. Re-run real tab-retention acceptance on Orca provider changes.
