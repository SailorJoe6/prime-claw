# Specification — Handoff continuation resilience

> **Status:** incubated future specification; not approved for planning or implementation.
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)
> **Current implementation:** [`docs/handoff-chain.md`](../../../../docs/handoff-chain.md)
> **Historical advisory evidence:** [`reports/reviews/handoff-resilience-spec-review-a93c27c.md`](../../../../reports/reviews/handoff-resilience-spec-review-a93c27c.md)
> **Related future work:** [Conversational Ralph command routing](../conversational-ralph-command-routing/SPECIFICATION.md)

## 1. Purpose

Fix one reliability defect in native `/handoff`: canonical `execute` currently
depends on a successful `session_compact` event. Short sessions, refused
compaction, cancellation, asynchronous failure, missing terminal events, and
late events can therefore strand an otherwise valid handoff.

An admitted handoff must attempt focused compaction as a context-quality
improvement and then queue canonical `execute` exactly once unless continuation
itself is infeasible. Compaction is a SHOULD. Continuation is a MUST.

This bundle deliberately excludes conversational command routing. A separate
future specification defines agent-initiated adapters for `/handoff`, `/plan`,
and `/implement-spec`.

## 2. Goals

- Preserve the existing direct native `/handoff [guidance]` UX.
- Make execute continuation independent of every compaction outcome.
- Keep canonical handoff and execute prose under `.ralph/skills/`.
- Produce truthful, bounded, user-visible status for compaction and continuation.
- Preserve at-most-once execute delivery across duplicate, stale, late, and
  interleaved signals.
- Prove finalizer, event-ordering, and follow-up-delivery assumptions on the
  supported Prime Agent runtime.
- Deliver entirely within prime-claw without upstream changes.

## 3. Non-goals and support boundary

This work does not:

- add conversational invocation of native commands;
- add a general slash-command adapter framework;
- implement the Ralph loop or conversation-owned episode orchestrator;
- make compaction mandatory or treat its summary as lifecycle authority;
- add a human recovery command for compaction problems;
- permit handoff input to select a phase, skill, or filesystem path;
- change Prime Agent core or submit an unsolicited upstream pull request; or
- claim root/RLM-child delivery isolation through a shared extension runtime.

The proof-of-concept support target is a top-level sibling episode session.
Bead `prime-claw-f81.3` separately owns the shared-runtime delivery proof or fix
needed before Phase 4b can rely on root/RLM-child isolation.

## 4. Current system and provenance

The project-local extension
[`.prime/agent/extensions/handoff-chain.ts`](../../../../.prime/agent/extensions/handoff-chain.ts)
registers native `/handoff`. It loads canonical
[`.ralph/skills/handoff/SKILL.md`](../../../skills/handoff/SKILL.md), records
pending execute state by stable session UUID, and currently injects canonical
[`.ralph/skills/execute/SKILL.md`](../../../skills/execute/SKILL.md) only after
`session_compact`.

Prime Agent 0.9.5 permits `compact.run()` to return `scheduled: false`, be
cancelled by `session_before_compact`, fail immediately or asynchronously, or
never produce the terminal event on which the extension currently waits. A
scheduling acknowledgement is not successful compaction.

This specification was split from the earlier combined
`handoff-resilience-and-conversational-routing` draft after operator review
identified two separately deliverable concerns. The immutable `a93c27c` EXPERT
report reviewed that combined incubated draft. It is useful historical advisory
evidence, but it is not a review or approval of this split specification.

## 5. Target architecture

### 5.1 Canonical ownership

| Component | Responsibility |
|---|---|
| `.ralph/skills/handoff/SKILL.md` | Durable handoff procedure and focus preparation |
| Prepared finalizer callable | Invoke `compact.run()` at most once, normalize a bounded result, and signal finalization |
| `handoff-chain.ts` | Own session/generation state, status, and exactly-once canonical execute follow-up |
| `.ralph/skills/execute/SKILL.md` | Canonical continuation content |

The finalizer is an internal reliability seam. It is not the conversational
`handoff.run(...)` entry point owned by the related routing specification.
Implementation planning must prove the exact supported project-local discovery
and extension-communication mechanism rather than assume one.

### 5.2 Model-controlled bridge

If the prepared Python finalizer reports through an IPython `tool_result`, that
surface is model-controlled input. The protocol provides correctness validation,
not authentication, provenance, or anti-forgery security.

The extension accepts only a narrow versioned action with bounded allowlisted
fields, a supported session identity, a matching handoff generation, and a legal
state transition. It ignores arbitrary payload fields and never persists raw
requests, raw provider payloads, tracebacks, locals, or arbitrary exception
attributes.

### 5.3 Exactly-once continuation

For each supported session the extension owns one handoff generation with an
explicit continuation disposition. Finalization validates the session and
generation, then consumes or terminally marks the continuation immediately
before queuing canonical execute with explicit `deliverAs: "followUp"`.

Later bridge input, duplicate finalization, or compaction events may update
bounded evidence but cannot acquire another right to queue execute. Continuation
infeasibility is visible and does not permit a blind retry with uncertain
delivery.

### 5.4 Ordering assumptions that planning must prove

Before implementation is accepted, a disposable supported runtime must prove:

1. a prepared finalizer can observe and normalize every immediate
   `compact.run()` return or exception without arbitrary serialization;
2. the extension can queue a follow-up while the finalizer tool turn is still
   finishing;
3. explicit follow-up ordering does not re-enter or corrupt the current stream;
4. successful compaction, cancellation, asynchronous failure, missing events,
   and late events cannot suppress or duplicate continuation;
5. consume-before-effect and reload behavior preserve at-most-once delivery;
6. continuation infeasibility is distinguishable from compaction failure; and
7. the prepared finalizer is discoverable in a fresh supported project session.

If a required assumption fails, planning must revise the design or stop. It must
not silently restore `session_compact` as the continuation gate.

## 6. Native handoff flow

For `/handoff` with no guidance, the native UX remains direct. For
`/handoff <guidance>`, all trailing text remains free-form handoff guidance.
Only a leading native invocation is the command; inline mentions remain ordinary
conversation and the extension does not substring-scan prose.

The handler loads canonical handoff Markdown and appends guidance in the
existing operator-input envelope. No input can select another phase or workflow.
Canonical handoff prepares durable state and one complete focus hint, then calls
the prepared finalizer as its final workflow action.

## 7. Finalization, compaction, and continuation

The finalizer calls `compact.run(focus_hint)` at most once.

- A confirmed successful compaction records confirmed evidence.
- A refusal, cancellation, exception, asynchronous failure, missing terminal
  event, or late event records bounded unconfirmed/no-compaction evidence.
- Every outcome queues canonical execute exactly once unless continuation itself
  is infeasible.
- Missing or inadequate summaries do not pause execution or require approval.
- Later Prime Agent auto-compaction remains available.

There is no `/handoff-continue` command and no `RECOVERY_REQUIRED` state for
compaction. Human intervention is reserved for cases where execute content,
supported-session identity, or follow-up delivery cannot be resolved safely.

## 8. Diagnostic data contract

Durable protocol and exception records use fixed bounded scalar fields only,
such as protocol version, action, generation, stage, scheduled status, bounded
reason/type/message, compaction evidence, and continuation disposition.

They exclude:

- tracebacks and stack dumps;
- frame locals and environment values;
- arbitrary exception attributes;
- arbitrary present or future result fields;
- non-JSON object representations;
- raw requests and provider payloads; and
- credentials or unrelated host state.

The Python/agent layer is instructed to redact suspected sensitive fragments
from bounded message text. The product does not claim deterministic secret
removal from arbitrary exception or refusal strings.

## 9. Split provenance

This bundle preserves the continuation portion of the former combined draft:

| Former combined material | Split destination |
|---|---|
| R-HR-1..5 scope, fixed continuation, canonical prose, and native compatibility | R-HC-1..5 |
| Internal-finalizer portions of R-HR-7 and R-HR-9 | R-HC-6, R-HC-27, R-HC-28 |
| R-HR-17..25 finalization, compaction, continuation, and status | R-HC-6..14 |
| R-HR-26..35 bridge, diagnostics, state, lifecycle, and support boundary | R-HC-15..24 |
| R-HR-38..42 outcome, diagnostic, ordering, runtime, and regression evidence | R-HC-25..29 |
| R-HR-43 future-bundle and evidence lifecycle | R-HC-30 |
| D-HR-1..5 and D-HR-9..15 continuation-relevant decisions | D-HC-1..10 |

Operator dispositions HR-SPEC-001..008 remain incorporated where applicable:
continuation-first semantics, user-visible truthful status, model-controlled
bridge classification, bounded diagnostics, intent authority carried in durable
artifacts, and the explicit runtime support boundary. The split supersedes only
the decision to deliver conversational routing in the same implementation unit.

## 10. Acceptance summary

The specification is ready for planning only after operator approval. Eventual
implementation acceptance requires:

1. canonical execute continues exactly once for every compaction outcome unless
   continuation itself is infeasible;
2. no `session_compact` event or summary grants continuation authority;
3. duplicate, stale, late, reload, and cancellation paths cannot dead-end or
   duplicate a generation;
4. visible status accurately separates compaction evidence from execute delivery;
5. the runtime ordering assumptions in §5.4 are proven; and
6. native command discovery, guidance preservation, canonical Markdown loading,
   legacy cleanup, and the complete repository test suite remain green.
