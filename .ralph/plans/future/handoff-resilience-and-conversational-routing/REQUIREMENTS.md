# Requirements — Resilient and conversational handoff

> **Status:** incubated future requirements; not approved for implementation.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

Priority meanings: **GATE** is required for acceptance; **LATER** is an explicit
future extension and cannot weaken a gate.

## Scope and compatibility

- **R-HR-1 (GATE) — Plugin-only delivery.** The enhancement operates entirely through prime-claw project extensions and skills on the supported Prime Agent runtime; it does not require upstream Prime Agent changes or unsolicited pull requests.
- **R-HR-2 (GATE) — Narrow seam.** The enhancement hardens handoff-to-execute and adds conversational admission only; it does not implement the complete Ralph loop or episode orchestrator.
- **R-HR-3 (GATE) — Fixed continuation.** Canonical `execute` is the only automatic follow-on phase. No argument, bridge payload, or recovery action can select another skill or path.
- **R-HR-4 (GATE) — Canonical prose.** Detailed handoff and execute procedures remain canonical in `.ralph/skills/handoff/SKILL.md` and `.ralph/skills/execute/SKILL.md`; routing code and skills load rather than duplicate them.

## Entry points

- **R-HR-5 (GATE) — Native compatibility.** `/handoff` with no guidance retains existing behavior, and all trailing text remains free-form guidance rather than a phase selector.
- **R-HR-6 (GATE) — Native command position.** Only a leading native `/handoff` invocation is treated as the command; inline text remains ordinary conversation.
- **R-HR-7 (GATE) — Python-backed handoff skill.** A project-local Python-backed `handoff` skill exposes a prepared REPL callable for agent-initiated conversational handoff.
- **R-HR-8 (GATE) — Shared admission.** Native `/handoff` and the REPL callable converge on one extension-owned admission function, the same session-scoped state machine, and the same canonical handoff workflow.
- **R-HR-9 (GATE) — Agent stops after dispatch.** After invoking the conversational handoff callable, the agent does not paste workflow prose, request compaction separately, or synthesize execute; the extension owns the transition.

## Focus inference and confirmation

- **R-HR-10 (GATE) — Action-oriented focus.** Conversational focus describes what the next execute pass should be prepared to do and preserves relevant objectives, evidence, constraints, unresolved questions, and resume point; a bare topic label is insufficient when action must be inferred.
- **R-HR-11 (GATE) — Grounded inference.** The agent may infer focus only from the user message, current conversation, active plan, and active bead context; it cannot invent unsupported objectives.
- **R-HR-12 (GATE) — Confirmation before inferred focus.** If focus is absent, vague, noun-only, or expanded with an inferred objective, the agent presents one concrete interpretation and obtains user confirmation before calling the handoff function.
- **R-HR-13 (GATE) — Correction loop.** A rejected or corrected inference is revised and reconfirmed; no handoff is admitted until the user confirms it.
- **R-HR-14 (GATE) — Explicit focus avoids needless questions.** Clear, actionable operator guidance can be passed directly without redundant confirmation.
- **R-HR-15 (GATE) — Insufficient evidence.** When no grounded focus can be inferred, the agent asks what the next execution pass should be prepared to do.
- **R-HR-16 (GATE) — Native immediacy.** Explicit native `/handoff` syntax does not invoke conversational confirmation; its trailing guidance is treated as the operator’s direct instruction.

## Compaction finalization

- **R-HR-17 (GATE) — One finalizer.** The canonical handoff workflow calls one prepared finalizer with the complete focus hint instead of calling `compact.run()` independently.
- **R-HR-18 (GATE) — Exact request.** The finalizer calls `compact.run(focus_hint)` once and preserves the full focus hint.
- **R-HR-19 (GATE) — Scheduled success.** A true scheduling result waits for successful `session_compact`, after which canonical execute is injected once.
- **R-HR-20 (GATE) — All normal refusals continue.** Every normal result with `scheduled is False`, regardless of reason, causes a visible warning and immediate canonical execute injection without compaction.
- **R-HR-21 (GATE) — Complete refusal warning.** The warning includes the returned reason or complete safe result and states both that no compaction occurred and that execution is continuing directly.
- **R-HR-22 (GATE) — No token heuristic.** The plugin does not infer compaction eligibility from token count; it uses the actual `compact.run()` result.

## Exceptions and recovery

- **R-HR-23 (GATE) — Detailed exception report.** Every exception raised by `compact.run()` produces a durable, user-visible report with exception type, message, safe diagnostic detail, handoff-state disposition, execute-injection status, and exact recovery choices.
- **R-HR-24 (GATE) — Secret-safe diagnostics.** Exception reporting excludes credentials and unrelated private content while preserving actionable stack or context information.
- **R-HR-25 (GATE) — Uncertain outcome fails closed.** An exception is not treated as `scheduled: false`; automatic execute injection stops when scheduling state is uncertain.
- **R-HR-26 (GATE) — Explicit recovery.** The plugin exposes an operator-invoked continue-without-compaction action scoped to the exact recovery-required session and generation.
- **R-HR-27 (GATE) — Recovery consume-once.** Explicit recovery warns again, consumes the matching generation before injection, and injects canonical execute at most once.

## Protocol and state safety

- **R-HR-28 (GATE) — Public plugin bridge.** The Python skill communicates with the extension through a documented public extension surface, using a narrow versioned protocol rather than private runtime mutation, a shell/RPC subprocess, or a general host-request patch.
- **R-HR-29 (GATE) — Schema validation.** Bridge messages have an exact protocol identifier, allowed action, bounded strings, and validated shape before they can mutate state.
- **R-HR-30 (GATE) — Session and generation isolation.** Pending state and bridge outcomes are keyed by stable session UUID and generation; one session or generation cannot settle another.
- **R-HR-31 (GATE) — Consume before effect.** State is consumed or atomically moved to a terminal/recovery state before execute injection, preserving at-most-once behavior.
- **R-HR-32 (GATE) — Duplicate and stale safety.** Duplicate, late, stale, malformed, out-of-state, and forged protocol messages cannot inject execute or alter another handoff.
- **R-HR-33 (GATE) — Lifecycle cleanup.** Session start, shutdown, reload, replacement, and extension failure clear or invalidate affected in-memory state without consuming legacy project-wide markers.
- **R-HR-34 (GATE) — Visible failures.** Missing canonical skills, rejected protocol messages, transition conflicts, and injection failures produce visible warnings and fail closed.
- **R-HR-35 (GATE) — Credential isolation.** The enhancement does not read or persist Keychain, browser-store, provider credential, or injected secret material.

## Verification

- **R-HR-36 (GATE) — Entry-point equivalence tests.** Tests prove native and REPL admission inject equivalent canonical handoff prompts for absent, explicit, punctuated, and multiline guidance.
- **R-HR-37 (GATE) — Focus-routing tests.** Skill fixtures cover explicit actionable focus, noun-only focus requiring confirmation, missing focus inferred from context, correction, and insufficient evidence.
- **R-HR-38 (GATE) — Outcome matrix tests.** Tests cover scheduled success, each known false reason, an arbitrary future false reason, exception, explicit recovery, duplicate signals, late compaction, and missing skills.
- **R-HR-39 (GATE) — Concurrency tests.** Tests cover two session IDs sharing one CWD and one extension closure, including interleaved generations and root/RLM delivery evidence without claiming unproven isolation.
- **R-HR-40 (GATE) — Real runtime proof.** A disposable Prime Agent integration proves one real short-session fallback and one real successful-compaction path from admission through exactly one canonical execute injection.
- **R-HR-41 (GATE) — Regression compatibility.** Existing native command discovery, canonical markdown loading, guidance preservation, legacy-marker cleanup, and full repository tests remain green.
