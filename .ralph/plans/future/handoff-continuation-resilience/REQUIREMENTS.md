# Requirements — Handoff continuation resilience

> **Status:** incubated future requirements; specification review only.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

Priority meanings: **GATE** is required for acceptance. “MUST” and “SHOULD”
express product requirements, not implementation sequencing.

## Scope and compatibility

- **R-HC-1 (GATE) — Plugin-only delivery.** The fix operates through prime-claw project extensions and skills on the supported Prime Agent runtime; it requires no upstream Prime Agent change or unsolicited pull request.
- **R-HC-2 (GATE) — Bug-fix scope.** The work fixes native handoff-to-execute continuation only; conversational command routing, the complete Ralph loop, and episode orchestration remain separate work.
- **R-HC-3 (GATE) — Fixed continuation.** Canonical `execute` is the only automatic follow-on phase. No guidance, finalizer result, or bridge payload can select another skill or path.
- **R-HC-4 (GATE) — Canonical prose.** Detailed handoff and execute procedures remain canonical in `.ralph/skills/handoff/SKILL.md` and `.ralph/skills/execute/SKILL.md`; code loads rather than duplicates them.
- **R-HC-5 (GATE) — Native compatibility.** Only a leading native `/handoff` invocation is treated as the command. No-guidance behavior remains direct, trailing text remains free-form guidance, and implementations do not substring-scan conversational prose.

## Finalization and mandatory continuation

- **R-HC-6 (GATE) — One prepared finalizer.** Canonical handoff calls one prepared finalizer with the complete focus hint instead of calling `compact.run()` independently; its exact fresh-session discovery location is proven.
- **R-HC-7 (GATE) — One best-effort compaction request.** The finalizer preserves the complete focus hint and calls `compact.run(focus_hint)` at most once. Compaction is SHOULD, not a continuation precondition.
- **R-HC-8 (GATE) — Mandatory continuation.** An admitted finalization MUST queue canonical execute exactly once unless continuation itself is infeasible.
- **R-HC-9 (GATE) — Outcome independence.** Execute delivery does not depend on `session_compact` and proceeds across success, refusal, cancellation, immediate exception, asynchronous failure, missing terminal event, and late terminal event.
- **R-HC-10 (GATE) — Evidence-only compaction.** Compaction results and events record bounded evidence only. They never grant, gate, or independently trigger continuation.
- **R-HC-11 (GATE) — No summary gate.** Missing or inadequate compaction summaries neither require human approval nor pause execute. Durable artifacts remain authoritative and later auto-compaction remains available.
- **R-HC-12 (GATE) — Automatic compaction recovery.** Compaction problems continue automatically without confirmed compaction. There is no human recovery command or `RECOVERY_REQUIRED` state for compaction.
- **R-HC-13 (GATE) — Continuation infeasibility.** Human intervention occurs only when continuation cannot be performed safely, including unavailable canonical execute content, unresolved supported-session identity, or follow-up rejection with uncertain delivery.
- **R-HC-14 (GATE) — Visible status.** Operator-visible evidence distinguishes confirmed compaction, unconfirmed/no compaction with continuation queued, and continuation infeasible. Scheduling acknowledgement is never described as successful compaction.

## Bridge, state, and safety

- **R-HC-15 (GATE) — Model-controlled public bridge.** Any Python finalizer bridge uses a documented public extension surface and a narrow versioned protocol. It is explicitly model-controlled input and makes no authentication, provenance, or anti-forgery claim.
- **R-HC-16 (GATE) — Correctness validation.** Bridge validation accepts only the expected version, action, bounded allowlisted fields, supported session, matching generation, and legal state.
- **R-HC-17 (GATE) — Deterministic minimization.** Durable protocol and exception data contains only bounded allowlisted scalar fields and never serializes tracebacks, locals, arbitrary attributes or result fields, non-JSON objects, raw requests, or raw provider payloads.
- **R-HC-18 (GATE) — Accurate redaction claim.** The agent/Python layer redacts suspected sensitive content from bounded message fields; the product does not claim deterministic secret removal from arbitrary text.
- **R-HC-19 (GATE) — Session and generation state.** Pending state is keyed by stable supported-runtime session identity and distinct handoff generation.
- **R-HC-20 (GATE) — Consume before effect.** Finalization consumes or terminally marks its continuation immediately before explicit follow-up delivery.
- **R-HC-21 (GATE) — Duplicate and stale safety.** Duplicate, late, stale, malformed, and out-of-state inputs cannot queue another execute or alter another known generation.
- **R-HC-22 (GATE) — Lifecycle behavior.** Start, shutdown, reload, replacement, cancellation, missing events, and late events cannot create a compaction-gated dead end or duplicate continuation.
- **R-HC-23 (GATE) — Credential isolation.** The fix does not read or persist Keychain, browser-store, provider credential, injected secret, or unrelated host material.
- **R-HC-24 (GATE) — Explicit support boundary.** The POC supports top-level sibling episode sessions and does not claim root/RLM-child delivery isolation through a shared extension runtime; bead `prime-claw-f81.3` owns that separate proof or fix.

## Verification and lifecycle

- **R-HC-25 (GATE) — Outcome matrix tests.** Tests cover success, each known refusal, arbitrary future refusal, cancellation, immediate exception, asynchronous failure, missing terminal event, late success, duplicate events, reload, and missing canonical skills.
- **R-HC-26 (GATE) — Diagnostic tests.** Tests cover secrets in exception text, oversized strings, traceback locals and paths, arbitrary attributes, future result fields, and non-JSON values, proving only allowlisted bounded fields persist.
- **R-HC-27 (GATE) — Ordering and exactly-once tests.** Tests prove consume-before-effect, explicit `deliverAs: "followUp"`, finalizer-last ordering, and exactly one execute queue attempt per admitted generation.
- **R-HC-28 (GATE) — Real-runtime proof.** A disposable supported Prime Agent integration proves Specification §5.4, including short-session refusal, successful compaction, cancellation or failure, and exactly one canonical execute follow-up independent of `session_compact`.
- **R-HC-29 (GATE) — Regression compatibility.** Existing native command discovery, canonical Markdown loading, guidance preservation, legacy-marker cleanup, and full repository tests remain green.
- **R-HC-30 (GATE) — Future-bundle integrity.** This bundle remains under `.ralph/plans/future/` until separately approved and promoted through native `/implement-spec`; the immutable `a93c27c` report remains historical advisory evidence rather than a review of this split bundle.
