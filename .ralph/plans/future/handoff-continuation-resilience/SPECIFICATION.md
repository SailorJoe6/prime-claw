# Specification — Handoff continuation resilience

> **Status:** incubated future specification; not approved for planning or implementation.
> **Current implementation:** [`docs/handoff-chain.md`](../../../../docs/handoff-chain.md)
> **Related future work:** [Conversational Ralph command routing](../conversational-ralph-command-routing/SPECIFICATION.md)
> **Historical advisory evidence:** [`reports/reviews/handoff-resilience-spec-review-a93c27c.md`](../../../../reports/reviews/handoff-resilience-spec-review-a93c27c.md)

## Purpose

Fix a reliability bug in native `/handoff`: canonical `execute` currently waits
for a successful `session_compact` event. When compaction is unnecessary,
refused, cancelled, fails, or never produces that event, a valid handoff can stop
without continuing the work.

The desired product rule is simple:

> Compaction is a best-effort context improvement. Continuing into canonical
> `execute` is required unless continuation itself is infeasible.

## Current behavior

The project-local handoff extension loads the canonical handoff workflow, records
pending execute state, and waits for `session_compact` before injecting canonical
execute. Prime Agent may legitimately decline or fail to compact, especially in
a short session. A scheduling acknowledgement is also not proof that compaction
completed.

This makes an optional optimization a mandatory transition gate.

## Desired behavior

For an admitted native `/handoff`:

1. Preserve the existing command UX and all trailing guidance.
2. Prepare durable handoff context using the canonical project workflow.
3. Attempt focused compaction when appropriate.
4. Continue into canonical `execute` whether compaction succeeds, is skipped,
   is refused, is cancelled, or fails. One admitted handoff must not knowingly
   start more than one execute pass.
5. Stop and ask for human help only when execute continuation itself cannot be
   performed or its delivery state cannot be resolved safely.
6. Show concise, truthful status that distinguishes compaction outcome from
   execute continuation.

A missing or inadequate summary does not authorize, block, or select work. The
active plan, bead, confirmed operator intent, and other durable project artifacts
remain authoritative.

## Observable outcome matrix

| Situation | Required outcome |
|---|---|
| Compaction completes | Report confirmed compaction and start the execute pass |
| Compaction is unnecessary or refused | Report no compaction and start the execute pass |
| Compaction is cancelled or fails | Report the problem safely and start the execute pass |
| A compaction event arrives late | Do not start an additional execute pass |
| The same finalization signal repeats | Do not start an additional execute pass |
| Canonical execute cannot be loaded or safely delivered | Report continuation infeasibility and do not claim success |

## Compatibility and safety

- `/handoff` with no guidance retains its current direct behavior.
- Trailing text remains free-form guidance, not a phase or path selector.
- Inline mentions of `/handoff` remain ordinary conversation.
- Canonical handoff and execute procedures remain project-customizable Markdown.
- Diagnostics remain bounded and do not persist credentials, tracebacks, locals,
  raw provider payloads, or unrelated host data.
- Existing command discovery, guidance handling, and legacy cleanup continue to
  work.

## Scope

This specification covers only native handoff continuation resilience.

It does not add:

- conversational invocation of `/handoff` or other commands;
- a general command-routing framework;
- a human recovery command for compaction problems;
- phase selection through handoff guidance;
- the complete Ralph loop or episode orchestrator;
- Prime Agent core changes; or
- claims about root/RLM-child delivery isolation not proven by the supported
  runtime.

## Implementation freedom

This specification does not prescribe a Python finalizer, bridge protocol,
generation state machine, host authorization mechanism, or other infrastructure.
It also does not promise mathematically strict exactly-once delivery across every
crash or uncertain transport outcome. Planning must first audit the current
extension and supported Prime Agent APIs, then choose the smallest design that
prevents known event paths from admitting duplicate execute passes.

If a proposed approach requires substantial new infrastructure, planning must
show why a simpler extension-local solution cannot satisfy the behavior.

## Acceptance evidence

Implementation is acceptable when focused tests and one disposable supported
runtime demonstrate:

- execute starts after successful compaction;
- execute starts when compaction is unnecessary or refused;
- execute starts after cancellation or failure when delivery remains feasible;
- late or repeated known signals do not start an additional execute pass;
- visible failure when continuation itself is infeasible;
- truthful status for every tested outcome; and
- the existing native handoff and full repository regression suites remain green.

## Provenance

This specification was split from the earlier combined
`handoff-resilience-and-conversational-routing` draft after operator review found
that it conflated a reliability bug with a separate interaction feature. The
old EXPERT report is immutable historical advisory evidence; it did not review
or approve this simplified specification.

The earlier requirements and decisions catalogs were intentionally removed.
Experience from the worktree-isolated specification episode showed that large
up-front requirement matrices encouraged speculative infrastructure and obscured
the product outcome. Durable constraints now live directly in this document.
