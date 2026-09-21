# Decisions — Handoff continuation resilience

> **Status:** incubated future decisions; specification review only.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)

## D-HC-1 — Isolate the continuation defect

**Decision:** Fix native handoff continuation independently of conversational
command routing, the Ralph loop, and episode orchestration. Use only supported
prime-claw extension and skill mechanisms.

**Satisfies:** R-HC-1, R-HC-2, R-HC-3, R-HC-4, R-HC-5.

**Rationale:** The continuation dead end is a discrete reliability defect. It
should not wait for a broader interaction feature.

## D-HC-2 — Make continuation mandatory and compaction best-effort

**Decision:** An admitted finalization queues canonical execute exactly once
unless continuation itself is infeasible. It attempts focused compaction once as
a context-quality improvement, but no compaction outcome or summary gates
continuation.

**Satisfies:** R-HC-6, R-HC-7, R-HC-8, R-HC-9, R-HC-11, R-HC-12.

**Rationale:** Prime Agent can auto-compact later. A best-effort summary must not
strand otherwise valid work.

## D-HC-3 — Treat compaction as evidence only

**Decision:** `compact.run()` results and `session_compact` update bounded
observability only. Finalization owns the consume-once right to queue execute,
and a scheduling acknowledgement is never described as successful compaction.

**Satisfies:** R-HC-9, R-HC-10, R-HC-14, R-HC-20, R-HC-22.

**Rationale:** Cancellation, asynchronous failure, and missing terminal events
make compaction unsuitable as a mandatory trigger.

## D-HC-4 — Reserve human intervention for continuation infeasibility

**Decision:** Add no human recovery action for compaction problems. Continue
automatically without confirmed compaction. Escalate only when execute cannot be
safely queued or its delivery state cannot be resolved.

**Satisfies:** R-HC-12, R-HC-13, R-HC-14.

**Rationale:** Compaction failure does not prevent useful work; uncertain
continuation can make a blind retry duplicate work.

## D-HC-5 — Use one internal prepared finalizer

**Decision:** Canonical handoff calls one prepared finalizer as its last workflow
action. The finalizer invokes compaction at most once, reports a normalized
bounded outcome, and is distinct from the future conversational `handoff.run`
adapter.

**Satisfies:** R-HC-6, R-HC-7, R-HC-27, R-HC-28.

**Rationale:** The bug fix needs one observable finalization seam without also
shipping conversational routing.

## D-HC-6 — Classify the bridge as model-controlled input

**Decision:** If IPython `tool_result` is used, accept only a narrow versioned
marker with bounded allowlisted fields and legal session/generation state. Make
no authentication, provenance, or anti-forgery claim.

**Satisfies:** R-HC-15, R-HC-16, R-HC-19, R-HC-21.

**Rationale:** The acting model can emit arbitrary Python output. Validation can
ensure correctness and accidental isolation, not hidden provenance.

## D-HC-7 — Consume before explicit follow-up delivery

**Decision:** Validate and consume or terminally mark the matching generation
immediately before queuing canonical execute with explicit
`deliverAs: "followUp"`. Later finalizer or compaction signals cannot queue it
again.

**Satisfies:** R-HC-8, R-HC-19, R-HC-20, R-HC-21, R-HC-22, R-HC-27.

**Rationale:** Follow-up delivery expresses ordering while consume-before-effect
protects at-most-once behavior.

## D-HC-8 — Minimize diagnostics deterministically

**Decision:** Persist only bounded allowlisted scalar fields. Exclude tracebacks,
locals, arbitrary attributes and result fields, object representations, raw
requests, provider payloads, credentials, and unrelated host state. Instruct the
agent layer to redact suspected sensitive fragments without claiming perfect
secret removal.

**Satisfies:** R-HC-14, R-HC-17, R-HC-18, R-HC-23, R-HC-26.

**Rationale:** Data minimization is enforceable; perfect redaction of arbitrary
text is not.

## D-HC-9 — Bound support and require real-runtime proof

**Decision:** Support top-level sibling episodes for the POC and leave the shared
root/RLM-child risk to `prime-claw-f81.3`. Prove finalizer discovery, ordering,
outcome independence, lifecycle behavior, and exactly-once delivery in a
disposable supported runtime before acceptance.

**Satisfies:** R-HC-22, R-HC-24, R-HC-25, R-HC-27, R-HC-28, R-HC-29.

**Rationale:** Public APIs narrow the design but do not prove streaming and event
ordering. The support claim must not exceed the evidence.

## D-HC-10 — Keep the split bundle incubated

**Decision:** Keep this specification under its future folder until separate
specification and plan approvals followed by native `/implement-spec`. Preserve
the old combined review report as immutable historical advisory evidence only.

**Satisfies:** R-HC-30.

**Rationale:** The future folder is the reviewed unit, and the old report did not
review this split scope.

## Decision → requirement traceability

| Decision | Requirements |
|---|---|
| D-HC-1 | R-HC-1, R-HC-2, R-HC-3, R-HC-4, R-HC-5 |
| D-HC-2 | R-HC-6, R-HC-7, R-HC-8, R-HC-9, R-HC-11, R-HC-12 |
| D-HC-3 | R-HC-9, R-HC-10, R-HC-14, R-HC-20, R-HC-22 |
| D-HC-4 | R-HC-12, R-HC-13, R-HC-14 |
| D-HC-5 | R-HC-6, R-HC-7, R-HC-27, R-HC-28 |
| D-HC-6 | R-HC-15, R-HC-16, R-HC-19, R-HC-21 |
| D-HC-7 | R-HC-8, R-HC-19, R-HC-20, R-HC-21, R-HC-22, R-HC-27 |
| D-HC-8 | R-HC-14, R-HC-17, R-HC-18, R-HC-23, R-HC-26 |
| D-HC-9 | R-HC-22, R-HC-24, R-HC-25, R-HC-27, R-HC-28, R-HC-29 |
| D-HC-10 | R-HC-30 |

Every GATE requirement is covered by at least one decision.
