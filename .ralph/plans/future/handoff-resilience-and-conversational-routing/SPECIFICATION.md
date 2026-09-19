# Future Specification — Resilient and conversational handoff

> **Status:** incubated future specification; not approved for planning or implementation.
> **Scope:** harden the existing native `/handoff` chain and add a conversational, agent-invoked handoff entry point.
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)
> **Current implementation:** [`docs/handoff-chain.md`](../../../../docs/handoff-chain.md)

## 1. Purpose

Prime Claw already automates one dogfood-proven Ralph transition:

```text
/execute work → /handoff [optional guidance] → focused compaction → canonical execute
```

The current extension assumes that `await compact.run(focus_hint)` schedules a
compaction and therefore that a later `session_compact` event will inject the
next execute prompt. Prime Agent 0.9.5 can instead return
`{"scheduled": false, "reason": ...}` when there is nothing eligible to
summarize. No compaction event follows, so the chain remains armed and stops.

The current native command also runs only when `/handoff` is the first
non-whitespace content in the submitted message. A conversational request such
as “I need you to hand off” is ordinary model input. There is no agent-facing
handoff callable that routes such intent through the native transition.

This enhancement makes continuation resilient when compaction cannot be
scheduled and adds a thoughtful conversational entry point. It remains a narrow
Phase 4a seam, not a Ralph orchestrator.

## 2. Goals

1. Continue into canonical execute whenever Prime Agent explicitly reports that
   compaction was not scheduled, while warning the operator why.
2. Report unexpected compaction exceptions in enough detail for safe recovery,
   without silently claiming a known scheduling outcome.
3. Give the agent a project-local Python-backed `handoff` capability for
   conversational handoff requests.
4. Make native `/handoff`, `/skill:handoff`, and the REPL callable converge on
   one extension-owned transition and one canonical handoff workflow.
5. Turn vague or implicit user focus into confirmed, action-oriented compaction
   guidance before conversational handoff begins.
6. Preserve fixed execute routing, per-session isolation, consume-once behavior,
   credential isolation, and plugin-only operation on Prime Agent 0.9.5.

## 3. Non-goals

- No upstream Prime Agent changes or unsolicited pull requests.
- No general command-invocation bridge for arbitrary slash commands.
- No alternate next-phase or user-selected skill path; execute remains fixed.
- No complete Ralph loop or episode orchestrator.
- No token-count heuristic for deciding whether compaction is possible.
- No automatic execute continuation after an exception whose scheduling outcome
  is uncertain.
- No change to the rule that inline `/handoff` text is not a native command.

## 4. Current system

The project-local extension
[`.prime/agent/extensions/handoff-chain.ts`](../../../../.prime/agent/extensions/handoff-chain.ts)
registers native `/handoff`. It loads the canonical
[`.ralph/skills/handoff/SKILL.md`](../../../../.ralph/skills/handoff/SKILL.md),
records pending execute state by stable session UUID, and injects canonical
`.ralph/skills/execute/SKILL.md` once that session emits `session_compact`.
All trailing command text is compaction guidance. It cannot select a phase or
enter a filesystem path.

In Prime Agent 0.9.5, `compact.run()` performs a structural preflight. A short
session commonly returns:

```python
{"scheduled": False, "reason": "session is too short to compact"}
```

An already-compacted branch can return:

```python
{"scheduled": False, "reason": "already compacted"}
```

“Too short” does not mean only “under 20,000 tokens.” It means no eligible
history remains to summarize after applying the configured retained-history
rules. A false result creates no pending compaction and emits no
`session_before_compact` or `session_compact` extension event. The Python caller
is the only direct observer.

Prime Agent extensions can register native commands and model-callable tools,
but cannot register a new project-defined `rlm.host_request()` operation through
the public API. A Python-backed project skill must therefore communicate its
small, typed handoff outcomes to the extension through a documented extension
surface rather than pretending to be a built-in host API.

## 5. Target architecture

### 5.1 Canonical ownership

The target system keeps these responsibilities separate:

| Component | Responsibility |
|---|---|
| `.ralph/skills/handoff/SKILL.md` | Canonical durable handoff procedure: update authoritative docs and beads, construct the focus hint, and finalize the boundary |
| `.ralph/skills/execute/SKILL.md` | Canonical execute workflow injected after settlement |
| Python-backed `.agents/skills/handoff/` | Conversational routing instructions plus the prepared REPL module |
| `handoff.run(...)` | Request the same handoff transition from conversational agent work |
| `handoff.finish(...)` | Request focused compaction and report its exact scheduling outcome to the extension |
| `handoff-chain.ts` | Validate protocol messages, own per-session transition state, warn the operator, and inject canonical workflow text exactly once |

The native slash handler and the REPL entry point call one shared extension
operation, conceptually `beginHandoff(session, guidance)`. The canonical handoff
skill remains the only detailed handoff workflow. The Python-backed routing
skill must not copy it.

### 5.2 Plugin-to-REPL bridge

Because project extensions cannot add host-request types, the Python module and
extension use a narrow, versioned bridge over the public IPython `tool_result`
event. The Python side emits a small machine-readable marker. The extension
recognizes only its exact protocol identifier and schema, validates it against
the current session and handoff generation, removes or hides protocol noise from
the displayed result where supported, and performs the corresponding state
transition.

The bridge supports only:

- `begin`: request handoff with optional confirmed focus;
- `not-scheduled`: report the exact `compact.run()` false response; and
- `exception`: report a caught compaction exception for user-visible recovery.

It cannot name a next phase or a skill path. Malformed, stale, duplicate, or
out-of-state markers are ignored and reported without mutating workflow state.
The protocol is an internal plugin mechanism, not a general IPC facility.

### 5.3 Transition state

Each loaded extension runtime keeps session-keyed, generation-aware state:

```text
IDLE
  ├─ native /handoff ───────────────┐
  └─ validated REPL begin request ──┴─► HANDOFF_RUNNING(generation)
                                          │ handoff.finish(focus_hint)
                                          ▼
                                   COMPACTION_REQUESTED
                                      ├─ scheduled true
                                      │    └─ session_compact
                                      │          └─ settle → execute
                                      ├─ scheduled false
                                      │    └─ warn → settle → execute
                                      └─ exception
                                           └─ detailed error → RECOVERY_REQUIRED
```

Settlement validates session identity and generation, then consumes state before
injecting execute. A duplicate marker or late compaction event cannot inject a
second execute prompt. Session start, shutdown, reload, and replacement clear or
invalidate the affected in-memory generation as defined by the existing
fail-closed lifecycle.

## 6. Native handoff flow

A native command remains immediate:

```text
/handoff
/handoff preserve the exact failed probe evidence and prepare to diagnose it
```

The handler:

1. trims and preserves all trailing guidance;
2. creates a new session-scoped generation only when safe;
3. loads canonical handoff markdown;
4. appends guidance in the existing delimited block; and
5. injects that prompt through the existing native-command path.

Native syntax is already an explicit operator instruction. It does not ask the
operator to reconfirm focus. Inline prose containing `/handoff` remains ordinary
conversation and is eligible for conversational skill routing instead.

## 7. Conversational handoff flow

The Python-backed `handoff` skill is selected when the user asks conversationally
to hand off, compact and continue, prepare the next execution pass, or similar.
It teaches the agent to decide whether the intended focus is actionable before
calling the REPL function.

### 7.1 Focus quality

A good focus states what the resumed execute pass should be prepared to do. It
preserves relevant objectives, evidence, constraints, unresolved questions, and
resume point. A topic label alone is normally insufficient.

Examples:

- Weak: `the failed gateway probe`
- Actionable: `Retain enough information to prepare for investigating and fixing the failed gateway probe.`
- Actionable with constraints: `Preserve the HTTP 502 evidence, exact-model probe command, and no-retry-without-operator-clearance rule; prepare to diagnose the gateway failure without starting another build.`

### 7.2 Confirmation rule

If the user supplies explicit, actionable guidance, the agent may use it without
another question. If the focus is absent, vague, noun-only, or requires the agent
to add an objective, the agent must:

1. infer the likely next objective from the user message, current work, active
   plan, and bead context;
2. present one concrete, action-oriented interpretation;
3. ask the user to confirm or correct it;
4. revise and repeat if corrected; and
5. call `handoff.run(confirmed_focus)` only after confirmation.

If there is not enough evidence for a grounded inference, the agent asks what
the next execution pass should be prepared to do rather than inventing a goal.

Reference interaction:

```text
User:  I need you to hand off, with a focus on the failed gateway probe.
Agent: To be clear, you want the handoff to prepare the next execution pass to
       investigate and fix the failed gateway probe. Is that right?
User:  Yes, that's right.
Agent: await handoff.run(
           "Retain enough information to prepare for investigating and fixing "
           "the failed gateway probe."
       )
```

After calling `handoff.run(...)`, the agent stops. The extension owns admission
and canonical prompt injection. The agent must not paste the canonical skill,
call `compact.run()` independently, or synthesize execute itself.

## 8. Handoff finalization and compaction outcomes

After durable handoff updates are complete, the canonical skill builds the
focus hint and calls:

```python
await handoff.finish(focus_hint)
```

The Python implementation calls `await compact.run(focus_hint)` exactly once and
reports one of the following outcomes.

### 8.1 Scheduled

For `{"scheduled": true}`:

- no fallback execute is injected;
- the current turn ends;
- successful compaction emits `session_compact`; and
- the extension settles the matching generation and injects canonical execute
  exactly once.

### 8.2 Not scheduled

For every normal return with `scheduled is False`, regardless of `reason`:

1. the bridge reports the complete returned result;
2. the extension emits a visible warning containing the reason;
3. the warning states that compaction did not occur and execution will continue;
4. the extension consumes the matching generation; and
5. canonical execute is injected immediately without compaction.

Example warning:

```text
Handoff compaction could not be scheduled: session is too short to compact.
No compaction occurred. Continuing directly with execute.
```

The false result is authoritative evidence that no compaction was scheduled, so
continuation is preferred over retaining a blocked handoff.

### 8.3 Exception

If `compact.run()` raises, `handoff.finish()` captures sufficient structured
error information for the extension to show a detailed, durable operator error:

- exception type;
- exception message;
- safe diagnostic context or traceback where useful, with secrets excluded;
- whether handoff state remains armed;
- confirmation that automatic execute was or was not injected; and
- exact recovery choices.

An exception is not equivalent to `scheduled: false`; the scheduling outcome
may be uncertain. The extension therefore does not automatically inject execute.
It moves the generation to `RECOVERY_REQUIRED` and exposes an explicit
operator-invoked continue-without-compaction recovery action. That action warns
again, consumes the exact generation, and injects canonical execute once. The
operator may instead retry or cancel/reload as instructed. Unknown errors are
never silently converted into success.

## 9. User-visible command surfaces

The completed enhancement intentionally exposes both:

- `/handoff [guidance]` — direct native operator command; and
- `/skill:handoff` plus the prepared `handoff` REPL module — conversational and
  agent-invoked route.

This revises the current “one slash surface” rule. The two surfaces are not
competing workflow implementations: the routing skill calls the shared native
transition, while canonical workflow text remains under `.ralph/skills/`.

The plugin also exposes a narrowly scoped recovery action for an exact
`RECOVERY_REQUIRED` generation. It cannot begin a new handoff, select another
phase, or operate on another session’s generation.

## 10. Security, isolation, and failure behavior

- User and inferred guidance is data, never a file path or skill selector.
- Protocol messages are schema-validated and size-bounded.
- Pending state is keyed by stable Prime Agent session UUID and generation.
- State is consumed before execute injection.
- Unexpected state, duplicate messages, malformed payloads, and unknown errors
  fail closed with visible diagnostics.
- The enhancement does not access Keychain, browser stores, credential files,
  or unrelated host state.
- Existing shared-runtime message-delivery risk remains a separately tracked
  limitation and must be exercised by concurrent root/RLM tests; the enhancement
  must not claim stronger isolation than the runtime evidence proves.

## 11. Acceptance summary

The enhancement is ready for planning only when the specification is approved.
Implementation is accepted when tests and dogfood prove that:

1. native and REPL requests converge on identical canonical handoff behavior;
2. inferred focus is confirmed before admission while explicit actionable focus
   does not incur unnecessary questioning;
3. scheduled compaction still produces exactly one post-compaction execute;
4. every false scheduling result visibly warns and continues without compaction;
5. every exception produces a detailed visible error and requires explicit
   recovery before execute;
6. stale, duplicate, malformed, cross-session, and cross-generation signals
   cannot inject execute;
7. canonical workflow text is not duplicated; and
8. no upstream Prime Agent modification is required.
