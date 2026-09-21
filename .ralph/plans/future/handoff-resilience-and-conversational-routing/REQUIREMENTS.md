# Requirements — Resilient and conversational handoff

> **Status:** incubated future requirements; specification review only.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

Priority meanings: **GATE** is required for acceptance; **LATER** is an explicit
future extension and cannot weaken a gate. “MUST” and “SHOULD” express product
requirements, not implementation sequencing.

## Scope and compatibility

- **R-HR-1 (GATE) — Plugin-only delivery.** The enhancement operates through prime-claw project extensions and skills on the supported Prime Agent runtime; it requires no upstream Prime Agent change or unsolicited pull request.
- **R-HR-2 (GATE) — Narrow seam.** The enhancement hardens handoff-to-execute and adds conversational admission only; it does not implement the complete Ralph loop or episode orchestrator.
- **R-HR-3 (GATE) — Fixed continuation.** Canonical `execute` is the only automatic follow-on phase. No argument or bridge payload can select another skill or path.
- **R-HR-4 (GATE) — Canonical prose.** Detailed handoff and execute procedures remain canonical in `.ralph/skills/handoff/SKILL.md` and `.ralph/skills/execute/SKILL.md`; routing code and skills load rather than duplicate them.

## Entry points and workflow contract

- **R-HR-5 (GATE) — Native compatibility and command position.** Only a leading native `/handoff` invocation is treated as the command. `/handoff` with no guidance retains its direct native UX, and trailing text remains free-form guidance rather than a phase selector. Implementations must not substring-scan conversational prose for `/handoff`; inline mentions remain ordinary conversation.
- **R-HR-7 (GATE) — Python-backed handoff skill.** A project-local Python-backed `handoff` skill exposes a prepared REPL callable in a fresh supported session, with its exact discovery location proven rather than assumed.
- **R-HR-8 (GATE) — Shared admission.** Native `/handoff` and the REPL callable converge after admission on one extension-owned operation, supported-runtime session state, and canonical handoff workflow.
- **R-HR-9 (GATE) — Final-action contract.** Calling `handoff.run(...)` or `handoff.finish(...)` is the agent’s final action. The agent does not paste workflow prose, compact separately, synthesize execute, or intentionally mutate afterward. This is a workflow requirement, not a hard technical termination guarantee; canonical continuation uses explicit follow-up delivery.

## User intent, focus, and durable authority

- **R-HR-10 (GATE) — Resumption focus.** Conversational focus describes what the next execute pass should retain or be prepared to do, including relevant evidence, constraints, questions, and resume point; it does not itself approve a gate or select a phase.
- **R-HR-11 (GATE) — Grounded inference.** Inference uses only the user message, conversation, active plan, bead, and applicable episode records; unsupported objectives are not invented.
- **R-HR-12 (GATE) — Material inference confirmation.** Adding or changing an objective or outcome is material. The agent presents one grounded interpretation and obtains user confirmation before admission.
- **R-HR-13 (GATE) — Correction loop.** A rejected or corrected inference is revised and reconfirmed; handoff is not admitted until the user confirms it.
- **R-HR-14 (GATE) — User authority.** Clear user-supplied intent and confirmed materially inferred intent are trusted. Faithful normalization does not trigger redundant confirmation.
- **R-HR-15 (GATE) — Durable preservation.** If confirmed intent changes durable scope, constraints, acceptance conditions, or findings, canonical handoff updates the applicable authoritative artifacts before finalization. Artifacts preserve the user’s decision rather than override it.
- **R-HR-16 (GATE) — Insufficient evidence and native immediacy.** Insufficient conversational evidence causes a clarification question. Explicit native `/handoff` remains direct operator instruction and does not invoke conversational reconfirmation.

## Finalization, compaction, and mandatory continuation

- **R-HR-17 (GATE) — One finalizer.** Canonical handoff calls one prepared finalizer with the complete focus hint instead of calling `compact.run()` independently.
- **R-HR-18 (GATE) — One best-effort compaction request.** The finalizer calls `compact.run(focus_hint)` at most once and preserves the focus hint. Compaction is SHOULD, not a continuation precondition.
- **R-HR-19 (GATE) — Mandatory continuation.** An admitted finalization MUST queue canonical execute exactly once unless continuation itself is infeasible.
- **R-HR-20 (GATE) — Outcome independence.** Execute delivery does not depend on `session_compact` and proceeds across compaction success, refusal, cancellation, immediate exception, asynchronous failure, missing terminal event, or late terminal event.
- **R-HR-21 (GATE) — Evidence-only compaction events.** Compaction results and `session_compact` record bounded evidence only. They never grant, gate, or independently trigger continuation.
- **R-HR-22 (GATE) — No summary gate.** Missing or inadequate compaction summaries do not require human approval and do not pause execute. Durable artifacts carry authority; later Prime Agent auto-compaction remains available.
- **R-HR-23 (GATE) — Automatic compaction recovery.** Compaction problems recover automatically by continuing without confirmed compaction. There is no human recovery slash command and no `RECOVERY_REQUIRED` state for compaction.
- **R-HR-24 (GATE) — Continuation infeasibility.** Human intervention occurs only when continuation itself cannot be performed safely, such as unavailable canonical execute content, unresolved supported-session identity, or follow-up rejection with uncertain delivery.
- **R-HR-25 (GATE) — Visible status.** Operator-visible evidence distinguishes confirmed compaction, unconfirmed/no compaction with continuation queued, and continuation infeasible. It never describes a scheduling acknowledgement as successful compaction.

## Bridge, diagnostics, and safety

- **R-HR-26 (GATE) — Model-controlled public bridge.** The Python skill communicates through a documented public extension surface using a narrow versioned protocol. The bridge is explicitly model-controlled input and makes no authentication, provenance, or anti-forgery claim.
- **R-HR-27 (GATE) — Correctness validation.** Bridge validation accepts only the expected protocol version, action, bounded allowlisted fields, legal state, supported session, and matching generation. Validation is for correctness and accidental isolation only.
- **R-HR-28 (GATE) — Deterministic minimization.** Durable protocol and exception data is restricted to bounded allowlisted scalar fields. It never serializes tracebacks, locals, arbitrary exception attributes, arbitrary future result fields, non-JSON objects, raw requests, or raw provider payloads.
- **R-HR-29 (GATE) — Accurate redaction claim.** The agent/Python layer is instructed to redact suspected sensitive content from bounded message fields. The product does not claim deterministic secret removal from arbitrary exception or refusal text.

## State, support boundary, and lifecycle

- **R-HR-30 (GATE) — Session and generation state.** Pending state is keyed by the stable supported-runtime session identity and distinct handoff generation; an input for one known session or generation cannot accidentally settle another.
- **R-HR-31 (GATE) — Consume before effect.** Finalization consumes or terminally marks its continuation right before follow-up delivery, preserving at-most-once behavior.
- **R-HR-32 (GATE) — Duplicate and stale safety.** Duplicate, late, stale, malformed, and out-of-state inputs cannot queue another execute or alter another known generation.
- **R-HR-33 (GATE) — Lifecycle behavior.** Start, shutdown, reload, replacement, cancellation, missing terminal events, and late compaction are specified and tested so they cannot create a compaction-gated dead end or duplicate continuation.
- **R-HR-34 (GATE) — Credential isolation.** The enhancement does not read or persist Keychain, browser-store, provider credential, injected secret, or unrelated host material.
- **R-HR-35 (GATE) — Explicit support boundary.** The POC supports top-level sibling episode sessions. It neither depends on nor claims root/RLM-child delivery isolation through a shared extension runtime; bead `prime-claw-f81.3` separately owns that proof or fix before Phase 4b relies on it.

## Verification and evidence

- **R-HR-36 (GATE) — Entry-point convergence tests.** Tests prove that, after deliberately different native versus conversational admission UX, both routes load the same canonical handoff prompt and use the same finalization contract for absent, explicit, punctuated, and multiline guidance.
- **R-HR-37 (GATE) — Focus-routing tests.** Fixtures cover explicit intent, faithful normalization, noun-only focus, “investigate” versus “fix,” unsafe retry constraints, missing focus, correction, insufficient evidence, side discussion, and durable scope preservation.
- **R-HR-38 (GATE) — Compaction outcome matrix.** Tests cover success, each known refusal, arbitrary future refusal, cancellation, immediate exception, asynchronous failure, missing terminal event, late success, duplicate events, reload, and missing canonical skills.
- **R-HR-39 (GATE) — Diagnostic tests.** Tests cover secrets in exception text, oversized strings, traceback locals and paths, arbitrary attributes, future result fields, and non-JSON values, proving only allowlisted bounded fields persist.
- **R-HR-40 (GATE) — Ordering and exactly-once tests.** Tests prove consume-before-effect, explicit `deliverAs: "followUp"`, final-action ordering, no action inserted by the workflow between finalization and canonical follow-up, and exactly one execute queue attempt per admitted generation.
- **R-HR-41 (GATE) — Real runtime feasibility proof.** A disposable supported Prime Agent integration proves the assumptions in Specification §5.4, including a short-session refusal, successful compaction, cancellation or failure, and exactly one canonical execute follow-up independent of `session_compact`.
- **R-HR-42 (GATE) — Regression compatibility.** Existing native command discovery, canonical markdown loading, guidance preservation, legacy-marker cleanup, and full repository tests remain green.
- **R-HR-43 (GATE) — Future-bundle and evidence integrity.** While specification review remains open, the revised handoff bundle stays under `.ralph/plans/future/` and claims no active-plan slot; native `/implement-spec` remains the sole promotion boundary. The `a93c27c` EXPERT report remains immutable pre-promotion advisory evidence rather than an episode gate result.
