# Specification — Resilient and conversational handoff

> **Status:** incubated future specification; incorporates operator dispositions HR-SPEC-001..008; not approved for planning or implementation.
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)
> **Current implementation:** [`docs/handoff-chain.md`](../../../../docs/handoff-chain.md)
> **Pre-promotion advisory evidence:** [`reports/reviews/handoff-resilience-spec-review-a93c27c.md`](../../../../reports/reviews/handoff-resilience-spec-review-a93c27c.md)

## 1. Purpose

Prime Claw already automates one dogfood-proven Ralph transition:

```text
/execute work → /handoff [optional guidance] → focused compaction → canonical execute
```

The existing chain incorrectly depends on successful compaction to deliver the
next execute turn. Prime Agent 0.9.5 can refuse compaction for a short or already
compacted session, cancel it, or fail after acknowledging it. In those cases the
workflow can remain armed but never continue. Conversational requests such as
“I need you to hand off” also have no agent-facing callable that enters the same
canonical workflow.

This enhancement makes continuation the required outcome and compaction a
best-effort context-quality improvement. It also adds a conversational handoff
entry point whose materially inferred focus is confirmed by the user. It remains
a narrow Phase 4a seam, not a Ralph orchestrator.

## 2. Goals

1. Queue canonical execute exactly once when handoff finalization is admitted,
   regardless of compaction success, refusal, cancellation, or failure.
2. Attempt focused compaction as a best-effort improvement and record its
   observable outcome as evidence rather than as the execute trigger.
3. Give the agent a project-local Python-backed `handoff` capability for
   conversational handoff requests.
4. Make native `/handoff`, `/skill:handoff`, and the REPL callable converge on
   one extension-owned transition and the canonical handoff workflow.
5. Confirm materially inferred focus, trust confirmed operator intent, and
   preserve that decision in durable artifacts when it changes durable scope or
   constraints.
6. Preserve fixed execute routing, supported-runtime session scoping,
   consume-once behavior, credential isolation, and plugin-only operation.

## 3. Non-goals and support boundary

- No upstream Prime Agent changes or unsolicited pull requests.
- No general command-invocation bridge for arbitrary slash commands.
- No alternate next phase or user-selected skill path; execute remains fixed.
- No complete Ralph loop or episode orchestrator.
- No token-count heuristic for compaction eligibility.
- No authentication or anti-forgery claim for the IPython result bridge. It is
  model-controlled input and is validated only for correctness.
- No hard technical claim that the model cannot act after a callable returns.
- No human recovery command or `RECOVERY_REQUIRED` state for compaction
  problems.
- No claim that this enhancement proves prompt delivery isolation when one
  extension runtime is shared between a root session and RLM child. That
  separate risk remains tracked by bead `prime-claw-f81.3` and does not block
  this top-level sibling-session proof of concept.
- No change to the rule that inline `/handoff` text is not a native command.

## 4. Current system and specification provenance

The project-local extension
[`.prime/agent/extensions/handoff-chain.ts`](../../../../.prime/agent/extensions/handoff-chain.ts)
registers native `/handoff`. It loads canonical
[`.ralph/skills/handoff/SKILL.md`](../../../skills/handoff/SKILL.md), records pending
execute state by stable session UUID, and currently injects canonical
[`.ralph/skills/execute/SKILL.md`](../../../skills/execute/SKILL.md) only after
`session_compact`. All trailing native-command text is compaction guidance; it
cannot select a phase or filesystem path.

In Prime Agent 0.9.5, `compact.run()` can return `scheduled: false`, can be
cancelled by `session_before_compact`, or can fail asynchronously. A scheduling
acknowledgement is not proof of successful compaction, and a terminal
`session_compact` event is not guaranteed. Execute delivery must therefore not
depend on that event.

A manual proof-of-concept briefly promoted this bundle on an isolated episode
branch. After the reviewed worktree-isolated episode workflow landed, the
operator explicitly de-promoted it so requirement review could finish in the
canonical project conversation. The revised bundle therefore remains under
`.ralph/plans/future/handoff-resilience-and-conversational-routing/`; it claims
no active-plan slot. A later operator-approved `/implement-spec` invocation is
the sole promotion boundary.

The EXPERT report at commit `a93c27c` reviewed the incubated draft before this
episode and before promotion. It is advisory design evidence, not a failed
specification gate of this episode. Operator dispositions HR-SPEC-001..008 are
the binding resolution of its findings.

## 5. Target architecture

### 5.1 Canonical ownership

| Component | Responsibility |
|---|---|
| `.ralph/skills/handoff/SKILL.md` | Canonical durable handoff procedure: update authoritative docs and beads, construct focus, then make finalization the last action |
| `.ralph/skills/execute/SKILL.md` | Canonical execute workflow queued after finalization |
| Project-local Python-backed `handoff` skill | Conversational routing instructions plus prepared REPL module |
| `handoff.run(...)` | Request the same handoff transition from conversational agent work |
| `handoff.finish(...)` | Make one best-effort compaction request, report bounded evidence, and finalize continuation |
| `handoff-chain.ts` | Validate bridge correctness, own supported-runtime transition state, surface evidence, and queue canonical execute exactly once |

The native slash handler and REPL entry point converge on one conceptual
`beginHandoff(session, guidance)` operation. The canonical handoff skill remains
the only detailed workflow. The Python-backed routing skill must not copy it.

### 5.2 Model-controlled bridge

Because project extensions cannot add host-request types, the Python module and
extension use a narrow, versioned marker over the public IPython `tool_result`
event. The model can create arbitrary IPython results, including a syntactically
valid marker. The bridge is therefore model-controlled input, not an
authenticated capability or proof of provenance.

Validation establishes correctness only: recognized protocol version, exact
action, allowed bounded fields, current supported-runtime session, legal state,
and matching generation where applicable. Valid input requests an ordinary
workflow action on behalf of the acting agent. Malformed, stale, duplicate, or
out-of-state input cannot accidentally select another phase, path, or generation,
but the system does not call such input “forged” or claim to resist a model that
deliberately emits valid input.

The bridge supports only admission and finalization evidence. It cannot name a
next phase or skill path.

### 5.3 Transition state and exactly-once boundary

The supported runtime keeps session-keyed, generation-aware in-memory state:

```text
IDLE
  ├─ native /handoff ───────────────┐
  └─ valid REPL begin request ──────┴─► HANDOFF_RUNNING(generation)
                                          │ handoff.finish(focus_hint)
                                          │ (final agent action)
                                          ▼
                                      FINALIZING
                                          ├─ record bounded compaction evidence
                                          └─ consume continuation right
                                               └─ queue canonical execute once
                                                    └─ CONTINUATION_QUEUED

session_compact / refusal / cancellation / failure
  └─ evidence only; never grants or triggers continuation
```

Finalization consumes or terminally marks the generation before the execute
follow-up is queued. Duplicate finalizers and later compaction events cannot
queue a second execute. Compaction outcome does not create a recovery state.

Human intervention is required only when continuation itself is infeasible—for
example, the canonical execute skill is unavailable, the correct supported
session cannot be identified, or the public follow-up delivery call rejects and
no safe exactly-once retry can be established. Compaction failure alone is never
such a condition.

### 5.4 Feasibility and ordering assumptions for planning to prove

The specification depends on public Prime Agent behavior that planning and a
real-runtime spike must prove before implementation is accepted:

1. the finalizer can make one compaction request and still emit one admitted
   finalization result on every immediate return or exception path;
2. the extension can atomically consume the generation and enqueue canonical
   execute with explicit `deliverAs: "followUp"` while the tool turn is still
   streaming;
3. the follow-up runs after the current tool turn, so `handoff.run()` or
   `handoff.finish()` can be the agent’s final action without requiring a hard
   turn-termination primitive;
4. an early or interleaved `session_compact` cannot bypass, erase, or duplicate
   the finalization-owned continuation right;
5. cancellation, asynchronous failure, missing `session_compact`, reload, and
   late success cannot suppress or duplicate an already queued continuation;
6. a rejected follow-up can be made visibly infeasible without falsely claiming
   successful continuation or blindly retrying an uncertain delivery; and
7. the project-local Python skill is discovered and prepared in a fresh session
   at the exact supported project location.

If these assumptions do not hold, planning must revise the design or return the
specification for operator disposition. It must not restore a compaction gate or
silently weaken mandatory continuation.

## 6. Native handoff flow

A native command remains immediate:

```text
/handoff
/handoff preserve the exact failed probe evidence and prepare to diagnose it
```

The handler trims and preserves trailing guidance, creates a new supported-
runtime session generation only when safe, loads canonical handoff markdown,
appends guidance in the existing delimited block, and injects that prompt through
the native-command path. Native syntax is direct operator instruction and does
not ask for focus confirmation. Inline prose remains ordinary conversation.

## 7. Conversational handoff flow

The Python-backed skill is selected when the user conversationally asks to hand
off, compact and continue, prepare the next execution pass, or similar.

### 7.1 Focus semantics

Focus describes resumption context. It can preserve objectives, evidence,
constraints, unresolved questions, and resume point. It does not itself approve a
review gate or select a phase. The user is authoritative over intent.

- Clear user-supplied intent is trusted without redundant confirmation.
- Faithful normalization that preserves the same objective is not a material
  inference.
- Adding or changing an outcome, such as changing “investigate” to “investigate
  and fix,” is material and requires confirmation.
- If focus is absent, vague, or materially inferred, the agent proposes one
  grounded interpretation and asks the user to confirm or correct it.
- Confirmed intent is trusted. When it changes durable episode scope,
  constraints, acceptance conditions, or findings, the handoff workflow records
  that decision in the authoritative artifacts before finalization. Durable
  artifacts preserve the decision; they do not overrule the user.
- If there is insufficient evidence, the agent asks what the next execute pass
  should be prepared to do rather than inventing a goal.

Example:

```text
User:  Hand off with a focus on the failed gateway probe.
Agent: Should the next pass investigate the failed probe only, preserving the
       HTTP 502 evidence and no-retry constraint, or also attempt a fix?
User:  Investigate only. Do not retry without clearance.
Agent: await handoff.run(
           "Preserve the HTTP 502 evidence and prepare to investigate the failed "
           "gateway probe without retrying or starting another build."
       )
```

Calling `handoff.run(...)` is the final action in the agent workflow contract.
The agent must not paste canonical workflow prose, call `compact.run()`
independently, synthesize execute, or intentionally perform later mutations in
that turn. This is an instruction and acceptance contract, not a technical claim
that arbitrary model output can be forcibly terminated. The extension uses a
follow-up delivery for canonical workflow continuation.

## 8. Finalization, compaction, and continuation

After durable handoff updates are complete, the canonical skill constructs the
focus hint and makes this its final action:

```python
await handoff.finish(focus_hint)
```

The finalizer attempts `compact.run(focus_hint)` once. Compaction is **SHOULD**:
its success improves the next context but is not required. Continuation is
**MUST** unless continuation itself is infeasible.

For every observable compaction outcome—scheduled, refused, cancelled, failed,
raised exception, or no terminal event—the finalization path owns canonical
execute delivery. It records bounded evidence, consumes the matching generation,
and queues canonical execute exactly once. `session_compact` only adds evidence
about whether compaction occurred; it never gates or triggers execute.

There is no missing-summary human gate. If no useful compaction summary exists,
execute proceeds with current context and durable artifacts. Later Prime Agent
auto-compaction may compact normally. Episode oversight must verify authoritative
state before handoff, not block execute while waiting for a summary.

When compaction is not known to have succeeded, the operator-visible evidence
states that continuation is proceeding without confirmed compaction. When
continuation itself is infeasible, the system emits a visible, durable failure
that names the generation and bounded reason and does not claim execute was
queued. That is the only case that calls for human intervention.

## 9. Diagnostic data contract

All bridge and durable diagnostic data is deterministically minimized to an
allowlist. A proposed maximum schema is:

| Field | Rule |
|---|---|
| `protocol_version` | fixed small integer |
| `action` | fixed enum |
| `generation` | bounded identifier |
| `stage` | fixed enum such as `admission`, `compaction-request`, `follow-up-delivery` |
| `scheduled` | boolean or absent |
| `reason` | bounded plain string from an allowed result field |
| `exception_type` | bounded class name |
| `message` | bounded plain string |
| `continuation_status` | fixed enum |

Tracebacks, locals, arbitrary exception attributes, arbitrary future result
fields, non-JSON objects, paths collected from stack frames, and raw provider or
request payloads are never serialized. Oversized allowed strings are truncated
with an explicit marker.

Because arbitrary exception text can itself contain secrets, deterministic
field minimization is not deterministic secret removal. The handoff instructions
require the agent/Python layer to redact suspected credentials or sensitive
content from the bounded `message` and `reason` fields before emission. Tests
must prove the allowlist and bounds; documentation must not claim that arbitrary
text is guaranteed secret-free.

## 10. Support, isolation, and failure behavior

- User and confirmed guidance is data, never a file path or skill selector.
- Bridge validation checks correctness, not authenticity.
- Pending state is keyed by the stable session identity and generation available
  in the supported top-level session runtime.
- State is consumed before execute follow-up delivery.
- Unexpected state, duplicate input, missing canonical skills, or continuation
  delivery failure produces visible bounded diagnostics.
- The enhancement does not access Keychain, browser stores, credential files, or
  unrelated host state.
- Top-level sibling episode sessions are the POC support target. Shared
  root/RLM-child extension-runtime delivery is neither required nor claimed here;
  `prime-claw-f81.3` owns that separate proof/fix before Phase 4b depends on it.

## 11. Acceptance summary

The enhancement is ready for planning only after this future specification is
approved. Implementation acceptance will require proof that:

1. native and conversational admissions converge on canonical handoff behavior
   after their deliberately different admission UX;
2. materially inferred focus is confirmed, explicit intent is trusted, and any
   durable scope decision is preserved before finalization;
3. finalization queues exactly one canonical execute follow-up for every
   compaction outcome, with compaction evidence recorded independently;
4. the agent workflow makes dispatch/finalization its last action and explicit
   follow-up delivery preserves ordering in the supported runtime;
5. no compaction problem creates a human recovery command, missing-summary gate,
   or `RECOVERY_REQUIRED` state;
6. bounded allowlisted diagnostics exclude traceback, locals, and arbitrary
   payload fields, with accurate limits on redaction claims;
7. stale, duplicate, malformed, cross-session, and cross-generation input cannot
   accidentally settle another supported-runtime handoff;
8. continuation infeasibility is visible and never misreported as success;
9. the feasibility and ordering assumptions in §5.4 pass real-runtime proof;
10. no support claim is inferred for the separate `prime-claw-f81.3` shared-
    runtime scenario; and
11. no upstream Prime Agent modification is required.
