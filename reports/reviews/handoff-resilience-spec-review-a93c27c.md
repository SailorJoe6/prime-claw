# EXPERT specification-gate review — resilient conversational handoff

**Reviewed commit:** `a93c27cc61d917fb8c7be14431048baf585eb171`  
**Bundle:** `.ralph/plans/future/handoff-resilience-and-conversational-routing/{SPECIFICATION.md,REQUIREMENTS.md,DECISIONS.md}`  
**Gate recommendation:** **REVISE**

## Scope and evidence

I reviewed the complete bundle at the exact commit, the current extension, canonical handoff/execute skills, handoff documentation, regression tests, and the conversation-driven episode-oversight bundle. I also checked the installed Prime Agent 0.9.5 public extension and Python-skill documentation. The current regression suite remains green:

```text
pytest -q tests/test_handoff_chain_extension.py
4 passed in 1.03s
```

Relevant installed-runtime evidence:

- `docs/extensions.md`, **tool_result**: the event is public, fires while the active tool turn is still in progress, can patch the result, and can interleave under parallel tools.
- `docs/extensions.md`, **pi.sendUserMessage**: sending while streaming requires `deliverAs: "steer"` or `"followUp"`; omission throws.
- `docs/extensions.md`, **ExtensionContext**: ordinary event context has no session-bound `sendUserMessage`; `pi.sendUserMessage` is the available general injection API. The repository already documents its shared/rebound runtime delivery risk in `docs/handoff-chain.md`.
- `docs/extensions.md`, **session_before_compact**: another extension can cancel compaction after it was requested.
- `docs/extensions.md`, **ctx.compact**: asynchronous compaction has distinct completion and error paths.
- `skills/skill-creator/references/python-skills.md`: project Python skills are ordinary editable Python packages in the persistent kernel. They do not gain a private authenticated extension channel.
- The installed `compact` module uses the built-in `rlm.host_request("compact.run", ...)`; project code cannot add a new host operation under the stated constraints.

## Blocking findings

### HR-SPEC-001 — CRITICAL — The proposed IPython result marker cannot satisfy the anti-forgery requirement

**Affected:** R-HR-28, R-HR-29, R-HR-32; D-HR-8; Specification §§5.2, 10.

**Evidence:** The bridge trusts a marker found in a public `tool_result`. The same model that is being instructed to call `handoff.run()` can print or return the exact marker from arbitrary IPython code. A protocol identifier, schema validation, size bound, session context, and state gate distinguish well-formed from malformed data, but do not establish provenance. No capability or nonce inaccessible to model-controlled Python is defined. A project Python package has no privileged identity in the `tool_result` event. Therefore the requirement that a “forged protocol message” cannot begin or alter a handoff is infeasible as written.

This is most acute for `begin`: `IDLE` is a valid state, so a forged well-formed `begin` has no prior state or secret against which it can fail. For settlement, a stale well-formed outcome can also match whatever generation is currently active unless the outcome carries an unforgeable generation capability.

**Acceptance condition:** Choose and specify one achievable trust contract:

1. use a public extension-registered typed tool/capability whose execution callback is the trusted admission boundary, and revise the Python-backed-callable requirement; or
2. explicitly classify the IPython bridge as model-controlled advisory input, remove the anti-forgery claim, and require a separate trusted confirmation/admission check before mutation; or
3. document and prove a public Prime Agent 0.9.5 mechanism that gives the Python package an unforgeable, session- and generation-bound capability without private runtime changes, files/RPC subprocesses, or a new host request.

Tests must include a model-controlled arbitrary IPython result containing an exact valid marker while `IDLE` and while another generation is active.

### HR-SPEC-002 — CRITICAL — End-to-end session isolation contradicts the acknowledged public-API delivery limitation

**Affected:** R-HR-8, R-HR-30, R-HR-32, R-HR-36, R-HR-39; Specification §§5.3, 10; conversation-oversight R-CO-7, R-CO-31, R-CO-38.

**Evidence:** `tool_result` supplies the correct event `ctx`, so state lookup can be session-keyed. But ordinary event context in Prime Agent 0.9.5 does not expose a session-bound message injection method. Execute/handoff injection uses the captured `pi.sendUserMessage`, whose shared/rebound delivery risk is already documented in `docs/handoff-chain.md` (“public event context has no session-bound send method”). The new specification acknowledges this as a limitation, yet R-HR-30 categorically requires that one session cannot settle another and R-HR-39 requires shared-closure root/RLM concurrency coverage. Correctly consuming session A’s state while injecting the prompt into session B still violates isolation and episode ownership.

**Acceptance condition:** Either:

- make the separately tracked delivery proof/fix a prerequisite and cite evidence that every injection is bound to the event’s stable session under concurrent root/RLM use; or
- explicitly restrict this enhancement to a runtime mode with no concurrent shared extension closure, enforce that restriction fail-closed, and narrow the requirements/claims accordingly.

A mocked shared map is insufficient. The gate needs a real concurrent runtime test that proves prompt destination, not merely state-key isolation.

### HR-SPEC-003 — HIGH — Tool-result timing does not enforce “dispatch, then stop,” and the required delivery mode is unspecified

**Affected:** R-HR-9, R-HR-19–R-HR-21; Specification §§5.2, 7.2, 8.

**Evidence:** A conversational `handoff.run()` or `handoff.finish()` executes inside the IPython tool call. Its marker is observed only in `tool_result`, while the agent turn is still streaming. Prime Agent 0.9.5 requires `deliverAs` when `pi.sendUserMessage` is called during streaming; omission throws. Even with `followUp`, the model normally receives the patched tool result and can continue acting or emit prose before the queued canonical prompt. The specification says the agent “stops,” but provides only an instruction, not a control mechanism. The false-result path also does not explicitly require the canonical handoff turn to stop after `handoff.finish()`.

This permits work between settlement and execute injection, or an injection failure caused by calling `sendUserMessage` without a streaming delivery mode.

**Acceptance condition:** Specify the exact event-time behavior and public API calls for `begin`, false, and exception outcomes. Prove that:

- the current tool turn cannot perform additional mutations after an admitted dispatch/finalizer;
- canonical prompt injection uses an explicit valid delivery mode or another documented public primitive;
- injection failure is visible and leaves a recoverable, non-consumed state; and
- no extra model turn or action appears between the dispatch result and the intended canonical workflow.

If Prime Agent 0.9.5 cannot enforce that for Python-return markers, revise the architecture to a terminating extension tool or weaken the guarantee explicitly.

### HR-SPEC-004 — CRITICAL — Automatic no-compaction continuation conflicts with the episode-oversight compaction-primer gate

**Affected:** R-HR-20, R-HR-21; D-HR-2; Specification §8.2; conversation-oversight R-CO-31, R-CO-32, R-CO-47, R-CO-48, R-CO-49 and D-CO-17.

**Evidence:** The handoff bundle requires *every* `scheduled: false` result to inject execute immediately without compaction. The oversight specification requires the owner to inspect the resulting compaction summary and prove it names the correct approved next phase or same-gate revision, findings, and authoritative artifacts **before allowing execute to proceed**. When compaction is refused there is no summary to inspect. Immediate fallback execute therefore bypasses a mandatory safety gate, especially for failed-gate guided revisions—the exact case D-CO-17 says must not advance on a stale or absent primer.

A warning does not reconcile these contracts. “Compaction is optional” in D-HR-2 is incompatible with controlled episode progression as currently specified.

**Acceptance condition:** Define an explicit compatibility rule. At minimum, one of these must hold:

- oversight-controlled transitions treat `scheduled: false` as a paused/recovery state and require the owner to validate an equivalent persisted primer before authorizing execute;
- the fallback injects a trusted, owner-verifiable primer artifact that satisfies R-CO-48 before execute; or
- the handoff enhancement is expressly excluded from episode-oversight transitions, with enforcement and tests.

Update both specification bundles or their dependency contract so they cannot simultaneously claim opposite behavior.

### HR-SPEC-005 — HIGH — A true scheduling acknowledgment is incorrectly treated as sufficient for eventual settlement

**Affected:** R-HR-19, R-HR-25–R-HR-27, R-HR-33, R-HR-38, R-HR-40; Specification §§5.3, 8.1–8.3.

**Evidence:** `compact.run()` returning `scheduled: true` only acknowledges scheduling. Prime Agent’s public API allows `session_before_compact` to cancel, and compaction can fail after scheduling. In those cases there may be no `session_compact`, while `handoff.finish()` has already returned normally, so the proposed exception marker never occurs. The generation remains armed indefinitely. The outcome matrix covers immediate exception and late compaction, but not cancellation or asynchronous post-schedule failure.

**Acceptance condition:** Add states, observability, timeout/reconciliation, and operator recovery for at least:

- scheduled then cancelled before compaction;
- scheduled then failed;
- scheduled with no terminal event by a bounded checkpoint;
- extension reload/shutdown during that interval; and
- a late success after recovery was offered or used.

A scheduled acknowledgment must not be described as successful compaction. Real-runtime tests must cover at least one post-schedule non-success path, or the specification must demonstrate that the Python host operation makes such a path impossible in 0.9.5.

### HR-SPEC-006 — HIGH — Recovery is not specified enough to implement safely or test exactly once

**Affected:** R-HR-23–R-HR-27, R-HR-31–R-HR-34, R-HR-38; D-HR-3, D-HR-4; Specification §§8.3, 9.

**Evidence:** The bundle calls for a “narrowly scoped operator-invoked recovery action” but does not define its command/tool name, arguments, how the operator obtains the exact generation, whether it is callable while streaming, or its durable receipt. “Retry or cancel/reload as instructed” is also ambiguous. Retrying after an exception with uncertain scheduling can create two compaction attempts. Reload clears memory but is not a generation-specific cancel. The desired behavior for a `session_compact` event arriving while `RECOVERY_REQUIRED`—before or after continue-without-compaction—is not stated.

**Acceptance condition:** Specify the recovery surface and complete transition table, including:

- exact invocation syntax and generation capability;
- authorization and session binding;
- behavior of retry, continue, cancel, reload, late `session_compact`, duplicate recovery, and injection failure;
- which state is persisted versus memory-only;
- consume-before-effect ordering and retry behavior if the effect fails; and
- durable receipts/diagnostics.

Tests must assert the selected behavior for every race, not only that duplicates do not inject twice.

### HR-SPEC-007 — HIGH — Conversational focus can silently invent or change episode scope

**Affected:** R-HR-10–R-HR-16; D-HR-9, D-HR-10; Specification §7; conversation-oversight R-CO-64, R-CO-67, R-CO-44–R-CO-49.

**Evidence:** The reference converts “focus on the failed gateway probe” into “investigate and fix,” adding an objective that the user did not state. Confirmation helps, but in an overseen episode, user confirmation of compaction wording is not by itself the required durable scope-change/gate transition. The oversight specification says side discussion is incubated unless an explicit authorized scope transition updates authoritative artifacts. It also says a failed-gate handoff may start only after findings and acceptance conditions are durably incorporated. The handoff bundle allows inference from conversation, plan, and bead, but does not state that focus is non-authoritative, cannot approve a gate, cannot change admitted scope, and must defer to durable episode state.

“Actionable” is also underdefined: ordinary linguistic normalization, adding a verb, adding a new outcome (“fix”), and adding safety constraints are treated alike. That makes R-HR-12/R-HR-14 routing nondeterministic.

**Acceptance condition:** Define exact semantics:

- focus describes resumption context only and cannot grant lifecycle authority, approve a gate, alter admitted scope, or override plan/bead/oversight records;
- distinguish faithful restatement from a material objective expansion;
- any material expansion in an active episode is incubated or routed through the oversight scope-change/finding-incorporation process before admission;
- specify handling when conversational guidance conflicts with durable state; and
- add fixtures for “investigate” versus “fix,” unsafe retry constraints, a side-discussion request during active work, a failed gate before findings are persisted, and explicit guidance that conflicts with the active plan.

### HR-SPEC-008 — MEDIUM — “Complete” diagnostics and “secret-safe” diagnostics are not a coherent schema

**Affected:** R-HR-21, R-HR-23, R-HR-24, R-HR-29, R-HR-34; Specification §§8.2, 8.3, 10.

**Evidence:** The bundle asks to bridge the “complete returned result” and preserve exception type/message/traceback while also excluding credentials and unrelated private content. Exception messages and tracebacks can themselves contain secrets, paths, arguments, or conversation data. An opaque future false-result field has the same problem. “Detailed, durable operator error” is not tied to a durable public surface; a UI notification is visible but not durable.

**Acceptance condition:** Define an allowlisted, bounded diagnostic schema and redaction policy. Name the durable session entry/message surface used, its retention behavior, and the separate operator-visible rendering. Preserve raw diagnostics only if a safe owner-controlled location and access policy are specified; otherwise do not promise completeness. Add tests with secrets in exception messages, traceback locals/paths, oversized fields, non-JSON values, and arbitrary future refusal payloads.

## Non-blocking observations

### HR-OBS-001 — MEDIUM — Requirement wording overstates entry-point equivalence

R-HR-36 says native and REPL admission inject “equivalent” prompts for absent guidance, but the conversational route requires confirmation for absent/vague focus while native `/handoff` is immediate. The intended equivalence appears to begin *after admission*: same canonical markdown, normalized confirmed guidance, and same state machine. Narrow the assertion so tests do not erase the deliberate UX difference.

### HR-OBS-002 — LOW — Project skill location should match the installed 0.9.5 convention explicitly

Installed Python-skill documentation uses `.prime/agent/skills/<name>/` as the project location, while this repository also has `.agents/skills/` for markdown slash skills. The proposal says `.agents/skills/handoff/`. This may be supported by project configuration, but the specification should cite the exact discovery/config evidence and test that the Python package is prepared in a fresh real session. Do not leave this as an assumed path convention.

### HR-OBS-003 — LOW — Existing tests prove the current seam, not the proposed architecture

The four passing pytest tests are useful regression evidence for current native command registration and mocked state behavior. They do not prove IPython marker provenance, streaming injection, session-bound destination, compaction refusal, asynchronous failure, or recovery. R-HR-40 correctly asks for real runtime proof, but its matrix should be expanded per the findings above.

## Gate conclusion

**REVISE.** The specification has a sound product goal and correctly identifies the short-session dead end, but the selected bridge cannot meet its own anti-forgery claim, cannot currently prove session-bound delivery under the acknowledged shared runtime, and conflicts with the episode-oversight requirement that execute must not start before a verified controlled primer. The exception and post-schedule failure state machines also need completion before planning.
