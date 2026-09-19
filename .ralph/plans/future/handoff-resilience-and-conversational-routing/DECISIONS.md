# Decisions — Resilient and conversational handoff

> **Status:** incubated future decisions; not approved for implementation.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)

## D-HR-1 — Solve the enhancement entirely inside prime-claw

**Decision:** Use project-local extension and skill mechanisms supported by the
installed Prime Agent runtime. Do not depend on upstream API changes or
unsolicited Prime Agent pull requests.

**Satisfies:** R-HR-1, R-HR-2.

**Rationale:** Prime Agent does not accept unsolicited contributions, and the
required behavior can be built as a narrow project plugin protocol.

## D-HR-2 — Prefer known continuation over optional compaction

**Decision:** Treat every normal `compact.run()` result with
`scheduled is False` as authoritative evidence that no compaction was scheduled.
Warn with the returned reason, consume the handoff, and inject canonical execute
without compaction.

**Satisfies:** R-HR-20, R-HR-21, R-HR-22.

**Rationale:** Compaction improves context quality but is not the purpose of the
transition. When Prime Agent explicitly declines it, blocking execution is less
reliable than continuing with the current context.

## D-HR-3 — Distinguish a refusal from an exception

**Decision:** A false scheduling result continues automatically. An exception
produces a detailed operator-visible error and enters recovery-required state;
it does not automatically inject execute.

**Satisfies:** R-HR-23, R-HR-24, R-HR-25.

**Rationale:** A returned false result is a known outcome. An exception can leave
the scheduling outcome uncertain, so automatic continuation could race a real
compaction or duplicate execute.

## D-HR-4 — Provide explicit continue-without-compaction recovery

**Decision:** A narrowly scoped operator recovery action can settle the exact
recovery-required session generation and inject execute without compaction. It
warns again and consumes state before injection.

**Satisfies:** R-HR-26, R-HR-27, R-HR-31.

**Rationale:** The operator needs a deliberate escape hatch that favors
execution without converting all unexpected errors into silent success.

## D-HR-5 — Add a Python-backed handoff skill

**Decision:** Add a project-local Python-backed `handoff` skill with an
agent-facing `handoff.run(focus=None)` entry point and an internal
`handoff.finish(focus_hint)` finalizer.

**Satisfies:** R-HR-7, R-HR-9, R-HR-17, R-HR-18.

**Rationale:** This matches Prime Agent’s command-plus-skill interaction model:
the agent gets a prepared REPL capability while the native command remains
available to the operator.

## D-HR-6 — Converge all admission in one extension operation

**Decision:** Native `/handoff` and validated REPL requests call one shared
extension-owned admission function and use one session/generation state machine.

**Satisfies:** R-HR-3, R-HR-5, R-HR-8, R-HR-30.

**Rationale:** Multiple entry points are safe only if they do not become multiple
workflow implementations or multiple routing authorities.

## D-HR-7 — Keep workflow prose canonical under `.ralph/skills`

**Decision:** The Python-backed routing skill explains when and how to request a
handoff but does not copy the durable handoff procedure. The extension continues
to load canonical `.ralph/skills/handoff` and `.ralph/skills/execute` markdown.

**Satisfies:** R-HR-4, R-HR-9.

**Rationale:** Operator/project customization belongs in canonical workflow
files. Code should own transition mechanics, not duplicate prose.

## D-HR-8 — Use a narrow versioned IPython-result protocol

**Decision:** The Python module reports `begin`, `not-scheduled`, and `exception`
outcomes through a schema-validated, versioned marker observed through the
public IPython `tool_result` extension event. The protocol is state-gated and
cannot name arbitrary commands, phases, or paths.

**Satisfies:** R-HR-28, R-HR-29, R-HR-32.

**Rationale:** Project extensions cannot register custom kernel host-request
handlers. A private runtime patch, shell/RPC process, or unowned file marker
would be broader and less trustworthy than a tiny protocol over a documented
extension event.

## D-HR-9 — Make conversational focus action-oriented

**Decision:** The routing skill converts conversational intent into a focus that
states what the next execute pass should be prepared to do, including relevant
evidence and constraints rather than merely repeating a topic label.

**Satisfies:** R-HR-10, R-HR-11.

**Rationale:** Compaction guidance must preserve the future task. “The failed
probe” names a topic; “prepare to investigate and fix the failed probe” names a
resumable objective.

## D-HR-10 — Confirm every materially inferred focus

**Decision:** When the agent must infer or expand the objective, it presents the
proposed action-oriented focus and waits for user confirmation. Explicit,
actionable guidance proceeds without a redundant question, while insufficient
evidence produces a clarification question.

**Satisfies:** R-HR-12, R-HR-13, R-HR-14, R-HR-15, R-HR-16.

**Rationale:** The agent may understand context well enough to propose useful
guidance, but only the operator can authorize a materially inferred next
objective. Native syntax remains the operator’s direct instruction.

## D-HR-11 — Finalize through the prepared handoff module

**Decision:** The canonical handoff workflow calls `handoff.finish(focus_hint)`.
That function calls `compact.run()` once and reports its exact returned outcome
to the extension; the canonical skill no longer assumes that a compaction event
will necessarily occur.

**Satisfies:** R-HR-17, R-HR-18, R-HR-19, R-HR-20, R-HR-23.

**Rationale:** Only the Python caller sees an immediate false scheduling result
in Prime Agent 0.9.5. Making finalization explicit closes the otherwise
unobservable short-session gap.

## D-HR-12 — Settle by session and generation before injection

**Decision:** All success, refusal, and recovery paths validate stable session
identity plus a monotonically distinct handoff generation, then consume or
terminally transition that state before injecting execute.

**Satisfies:** R-HR-30, R-HR-31, R-HR-32, R-HR-33.

**Rationale:** Event and callback ordering can vary. One settlement gate prevents
duplicate and cross-handoff execute injection even when signals arrive late.

## D-HR-13 — Expose both native and skill slash surfaces intentionally

**Decision:** The project intentionally supports `/handoff` and
`/skill:handoff`. The former is a direct native command. The latter exposes the
agent-facing routing skill whose REPL function converges on the same admission
operation.

**Satisfies:** R-HR-5, R-HR-6, R-HR-7, R-HR-8.

**Rationale:** This replaces the earlier one-surface rule because the new skill
adds conversational reasoning and confirmation without creating another
canonical workflow.

## D-HR-14 — Test behavior at unit and real-runtime boundaries

**Decision:** Preserve mocked extension coverage and add real Prime Agent proofs
for both a short-session refusal and successful compaction, including concurrent
session evidence and the existing regression suite.

**Satisfies:** R-HR-34, R-HR-36, R-HR-37, R-HR-38, R-HR-39, R-HR-40, R-HR-41.

**Rationale:** The behavior spans model routing, Python kernel results,
extension events, compaction, and prompt injection. Unit tests alone cannot
prove the complete boundary.

## D-HR-15 — Preserve credential and diagnostic boundaries

**Decision:** Protocol payloads and error reports are bounded and validated;
diagnostics retain actionable type/message/context while excluding credentials
and unrelated private content.

**Satisfies:** R-HR-24, R-HR-29, R-HR-35.

**Rationale:** Better recovery evidence must not weaken the sandbox’s credential
isolation or turn arbitrary output into trusted control input.
