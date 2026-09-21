# Decisions — Resilient and conversational handoff

> **Status:** incubated future decisions; specification review only.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)

## D-HR-1 — Solve the narrow enhancement inside prime-claw

**Decision:** Use project-local extension and skill mechanisms supported by the
selected Prime Agent runtime. Do not depend on upstream API changes, and do not
expand the work into the Ralph loop or episode orchestrator.

**Satisfies:** R-HR-1, R-HR-2.

**Rationale:** The product need is one handoff seam. A broader orchestration or
upstream effort would mix separate risks into this proof of concept.

## D-HR-2 — Make continuation mandatory and compaction best-effort

**Decision:** An admitted finalization queues canonical execute exactly once
unless continuation itself is infeasible. It attempts focused compaction once as
a context-quality improvement, but no compaction outcome or summary gates
continuation.

**Satisfies:** R-HR-17, R-HR-18, R-HR-19, R-HR-20, R-HR-22, R-HR-23.

**Rationale:** The transition exists to continue useful work. Prime Agent can
later auto-compact. Making a best-effort summary a prerequisite recreates the
short-session dead end and adds human recovery for a non-authoritative artifact.

## D-HR-3 — Treat compaction events as evidence only

**Decision:** `compact.run()` results and `session_compact` update bounded
observability only. Finalization, not compaction, owns the consume-once right to
queue execute. Scheduled acknowledgement is never described as successful
compaction.

**Satisfies:** R-HR-20, R-HR-21, R-HR-25, R-HR-31, R-HR-33.

**Rationale:** Cancellation, asynchronous failure, and missing terminal events
make `session_compact` unsuitable as a mandatory workflow trigger. Separating
evidence from authority removes that coupling.

## D-HR-4 — Reserve human intervention for continuation infeasibility

**Decision:** Do not add a human recovery slash command or
`RECOVERY_REQUIRED` state for compaction problems. Continue automatically
without confirmed compaction. Call for human intervention only when canonical
execute cannot be safely queued or its delivery state cannot be resolved.

**Satisfies:** R-HR-23, R-HR-24, R-HR-25.

**Rationale:** Compaction failure does not prevent useful work. Delivery
infeasibility is different because claiming continuation without a safe delivery
path would be false and could make a blind retry duplicate work.

## D-HR-5 — Add a Python-backed handoff skill with final-action semantics

**Decision:** Add a project-local Python-backed `handoff` skill with an
agent-facing `handoff.run(focus=None)` entry point and an internal
`handoff.finish(focus_hint)` finalizer. Fresh-session discovery at the exact
project location is an acceptance requirement. Each call is the agent's final
action under the workflow contract.

**Satisfies:** R-HR-7, R-HR-9, R-HR-17, R-HR-18.

**Rationale:** A prepared callable gives conversational agent work a narrow entry
point while avoiding copied workflow prose. Final-action behavior is achievable
as an instruction and testable workflow contract, not as a false technical
termination guarantee.

## D-HR-6 — Converge entry points while preserving their different admission UX

**Decision:** Direct native `/handoff` and conversational REPL admission converge
on one extension operation and canonical workflow after admission. Native syntax
is immediate operator instruction; conversational material inference can require
confirmation.

**Satisfies:** R-HR-3, R-HR-5, R-HR-8, R-HR-16, R-HR-36.

**Rationale:** One transition owner prevents divergent workflow mechanics. The
routes need not erase a deliberate UX distinction in order to converge on the
same canonical handoff.

## D-HR-7 — Keep workflow prose canonical under `.ralph/skills`

**Decision:** The routing skill explains when and how to request handoff but does
not copy the durable handoff procedure. The extension loads canonical handoff
and execute markdown, and no input can select another continuation.

**Satisfies:** R-HR-3, R-HR-4, R-HR-9.

**Rationale:** Project customization belongs in canonical workflow files. Code
owns transition mechanics, not duplicate procedure text.

## D-HR-8 — Trust the user and confirm only material inference

**Decision:** Focus is resumption context, not lifecycle authority. Trust clear
operator intent. Confirm an inference when it adds or changes an objective or
outcome. After confirmation, update applicable durable artifacts so they preserve
that decision; do not use stale artifacts to overrule it.

**Satisfies:** R-HR-10, R-HR-11, R-HR-12, R-HR-13, R-HR-14, R-HR-15, R-HR-16.

**Rationale:** The user is authoritative. Confirmation prevents silent scope
invention, while durable updates ensure the trusted decision survives handoff and
does not conflict with the next pass.

## D-HR-9 — Classify the IPython bridge as model-controlled input

**Decision:** Use a narrow versioned marker on the public IPython `tool_result`
surface, but make no authentication, provenance, or anti-forgery claim. Validate
only protocol correctness, bounded fields, supported-session context, legal
state, and generation.

**Satisfies:** R-HR-26, R-HR-27, R-HR-32.

**Rationale:** The acting model can emit the same marker from arbitrary Python.
Schema and state checks prevent accidental misuse but cannot establish an
identity hidden from the model.

## D-HR-10 — Consume the generation before explicit follow-up delivery

**Decision:** Finalization validates the supported session and generation, then
consumes or terminally marks its continuation right before queuing canonical
execute with explicit `deliverAs: "followUp"`. Later bridge input and compaction
events cannot queue another execute.

**Satisfies:** R-HR-19, R-HR-30, R-HR-31, R-HR-32, R-HR-33, R-HR-40.

**Rationale:** The current tool turn may still be streaming. Follow-up delivery
expresses the intended ordering, while consume-before-effect protects
at-most-once behavior across duplicates and interleaving.

## D-HR-11 — Minimize diagnostics with an allowlist and bounded strings

**Decision:** Persist only fixed scalar fields for protocol version, action,
generation, stage, scheduled status, bounded reason/type/message, and
continuation status. Never serialize traceback, locals, arbitrary attributes or
result fields, raw requests, or provider payloads. Instruct the agent/Python
layer to redact suspected sensitive text, without promising deterministic secret
removal from arbitrary strings.

**Satisfies:** R-HR-25, R-HR-28, R-HR-29, R-HR-34, R-HR-39.

**Rationale:** Deterministic data minimization is enforceable. Perfect redaction
of arbitrary exception text is not. The contract must distinguish those claims.

## D-HR-12 — Keep the POC support claim narrower than the shared-runtime risk

**Decision:** Support top-level sibling episode sessions for this POC. Do not
make root/RLM-child shared-extension-runtime delivery a prerequisite or claim.
Track that separate delivery proof or supported-API fix in `prime-claw-f81.3`
before Phase 4b depends on it.

**Satisfies:** R-HR-30, R-HR-35.

**Rationale:** Session-keyed state and shared-runtime message destination are
separate properties. This specification can prove the former in its supported
mode without falsely resolving or being blocked by the latter.

## D-HR-13 — Require real-runtime proof of finalization ordering

**Decision:** Before implementation acceptance, prove the Specification §5.4
assumptions in a disposable supported runtime: the finalizer reports every
outcome, follow-up ordering works while streaming, compaction interleaving cannot
suppress or duplicate continuation, delivery infeasibility is visible, and the
skill loads in a fresh session.

**Satisfies:** R-HR-7, R-HR-20, R-HR-33, R-HR-38, R-HR-40, R-HR-41.

**Rationale:** Public API documentation narrows the design but cannot prove event
ordering across Python, extension events, compaction, and streaming follow-up.
The assumptions must be tested rather than smuggled into planning as facts.

## D-HR-14 — Verify behavior at unit, integration, and regression boundaries

**Decision:** Cover focus routing, every compaction outcome, bounded diagnostic
serialization, ordering, exactly-once state, missing canonical content, and
current native behavior. Preserve the full repository regression suite.

**Satisfies:** R-HR-36, R-HR-37, R-HR-38, R-HR-39, R-HR-40, R-HR-41, R-HR-42.

**Rationale:** The behavior crosses model instructions, Python results, extension
state, event ordering, and delivery. No single test layer is sufficient.

## D-HR-15 — Keep review in the future bundle and retain advisory evidence

**Decision:** Keep the revised handoff specification under its canonical future
folder until the operator separately approves specification, plan, and native
`/implement-spec` promotion. Claim no active-plan slot during review. Retain the
`a93c27c` EXPERT report as immutable pre-promotion advisory evidence, not a failed
episode gate.

**Satisfies:** R-HR-43.

**Rationale:** The reviewed worktree-isolated episode workflow makes the future
folder the unit of project-conversation review and native `/implement-spec` the
sole promotion boundary. Accurate review classification avoids inventing an
episode gate that never occurred.

## Decision → requirement traceability

| Decision | Requirements |
|---|---|
| D-HR-1 | R-HR-1, R-HR-2 |
| D-HR-2 | R-HR-17, R-HR-18, R-HR-19, R-HR-20, R-HR-22, R-HR-23 |
| D-HR-3 | R-HR-20, R-HR-21, R-HR-25, R-HR-31, R-HR-33 |
| D-HR-4 | R-HR-23, R-HR-24, R-HR-25 |
| D-HR-5 | R-HR-7, R-HR-9, R-HR-17, R-HR-18 |
| D-HR-6 | R-HR-3, R-HR-5, R-HR-8, R-HR-16, R-HR-36 |
| D-HR-7 | R-HR-3, R-HR-4, R-HR-9 |
| D-HR-8 | R-HR-10, R-HR-11, R-HR-12, R-HR-13, R-HR-14, R-HR-15, R-HR-16 |
| D-HR-9 | R-HR-26, R-HR-27, R-HR-32 |
| D-HR-10 | R-HR-19, R-HR-30, R-HR-31, R-HR-32, R-HR-33, R-HR-40 |
| D-HR-11 | R-HR-25, R-HR-28, R-HR-29, R-HR-34, R-HR-39 |
| D-HR-12 | R-HR-30, R-HR-35 |
| D-HR-13 | R-HR-7, R-HR-20, R-HR-33, R-HR-38, R-HR-40, R-HR-41 |
| D-HR-14 | R-HR-36, R-HR-37, R-HR-38, R-HR-39, R-HR-40, R-HR-41, R-HR-42 |
| D-HR-15 | R-HR-43 |

Every defined GATE requirement is covered by at least one decision. The
verification below checks this matrix against the requirement IDs before review.
