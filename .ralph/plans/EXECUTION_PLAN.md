# Execution Plan — Conversational routing for Ralph native commands

> **Status:** proposed for operator review; not approved for implementation.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Selected future folder:** `.ralph/plans/future/conversational-ralph-command-routing/`
> **Parent workstream:** `prime-claw-h6w` (Phase 4 episode loop)

## Outcome

Add three explicit, opt-in model-callable adapters so a project conversation can
act on clear natural-language intent for Ralph handoff, planning, and episode
creation without asking the operator to retype slash syntax.

Each adapter must converge on the same deterministic admission helper and
canonical project Markdown as its native command. Native `/handoff`, `/plan`, and
`/implement-spec` behavior remains unchanged. There is no generic slash-command
router and no textual slash-command reparsing.

## Current-code audit and planning decisions

The current project-local extension surface is sufficient; no Prime Agent core
change is needed.

1. **Discoverable callable surface.** `pi.registerTool()` exposes explicit tool
   schemas and command-specific `promptGuidelines` in a fresh project session.
   Register one tool per supported operation rather than a generic command name
   plus arbitrary arguments.
2. **Shared behavior.** Extract or expose small admission helpers inside the
   existing handoff and reviewed-plan extensions/support modules. Native command
   handlers and conversational tools call those same helpers. Do not call a
   command handler indirectly and do not duplicate skill-loading or path checks.
3. **Streaming delivery.** A tool runs during an agent turn, so every injected
   message supplies an explicit delivery mode. Conversational handoff sends the
   canonical handoff as `steer` and canonical execute as the sole `followUp`,
   matching the native two-stage transition. Conversational plan queues its
   canonical workflow once as `followUp`. After trusted confirmation,
   conversational implementation sends its readiness workflow as `steer` so the
   existing one-turn authorization can remain simple. Native commands retain
   their current idle-command delivery behavior.
4. **Arguments and clarification.** The handoff tool accepts only optional
   operator guidance. The planning and implementation tools accept only one
   exact `.ralph/plans/future/<slug>` location. Prompt guidance tells the model
   to ask in ordinary conversation before calling when focus or folder selection
   is materially inferred. Deterministic validation remains the final guard.
   Register all routing tools with sequential execution and describe them as
   terminal routing actions. Their results report admission, never completion.
5. **Implementation authority.** A natural-language request alone cannot
   authorize episode creation because the model interprets that request. Before
   conversational implementation proceeds, Prime Agent must show the operator a
   trusted confirmation naming the exact future folder and explaining that
   approval may create a branch, worktree, and episode session. Only explicit
   confirmation grants temporary authority for the normal readiness workflow.
   Rejection, cancellation, unavailable UI, invalid input, or failure to queue
   that workflow creates nothing. Finer direct-action versus clarification UX is
   deferred to `prime-claw-h6w.17` after dogfood and must not expand this delivery.
6. **One-use authorization handoff.** Confirmation does not create an episode
   or bypass the normal readiness workflow. The extension records only one
   pending exact folder and canonical readiness prompt, then sends that prompt
   as `steer`. When the matching extension-generated input is admitted in the
   same agent run, the pending entry becomes the existing one-use authorization
   for `create_spec_episode`. A direct call before that input, a mismatch, send
   failure, or `agent_end` remains unauthorized and clears the pending state.
7. **No authorization subsystem.** This is a small in-memory
   `pending → active → consumed` gate, not a lease, nonce protocol, journal,
   approval database, expiry service, replay mechanism, or cross-turn state
   machine. Existing durable episode identity begins only inside
   `create_spec_episode`. If one focused installed-runtime test cannot prove the
   documented `steer` ordering, keep conversational implementation native-only
   instead of adding machinery.

The public tool names are `ralph_handoff`, `ralph_plan`, and
`ralph_implement_spec`.

## Delivery discipline

Implement the work as three dependency-ordered vertical slices. Before Slice 1,
create one child implementation bead per slice under `prime-claw-h6w` and record
the dependency chain. Each slice must:

- remain inside its stated scope;
- update its own bead with the exact commit and evidence;
- run focused tests plus the active repository suite;
- update operator documentation in the same commit;
- produce one clean, single-purpose commit pushed for project-conversation
  review; and
- stop after reporting the exact commit, changed files, tests, limitations, and
  worktree state.

A failed characterization or unavailable public API is a plan-review boundary,
not permission to patch Prime Agent internals or add a general state machine.

## Slice 1 — Conversational handoff

### Working capability

A fresh project conversation discovers `ralph_handoff`. Given clear operator
intent, the tool admits the same canonical handoff and one canonical execute
follow-up as native `/handoff`. Optional guidance is preserved exactly after
trimming and remains guidance only.

### Implementation

- Refactor the current handoff preflight and admission into one shared helper
  used by the native command and tool.
- Keep native delivery unchanged: handoff is admitted first and execute is one
  native follow-up.
- In tool context, queue canonical handoff as `steer`, then canonical execute as
  the sole `followUp`. Both modes are explicit because the agent is streaming.
- Register the narrow tool schema and command-specific prompt guidance. The tool
  must not accept a command name, skill path, next phase, approval flag, or
  arbitrary routing metadata.
- Preserve legacy-marker cleanup and all documented compaction/cancellation
  behavior.

### Acceptance evidence

- Unit tests prove native behavior is byte-for-byte equivalent at the admission
  boundary.
- Tool tests prove registration, exact optional guidance, full preflight before
  either send, handoff-as-`steer` then execute-as-sole-`followUp`, one execute
  admission, and visible first- or second-send failure.
- Tests prove inline prose is not parsed by extension substring matching and the
  tool exposes no arbitrary-command parameter.
- Installed offline Prime Agent loading proves both `/handoff` and the tool are
  discoverable in a fresh session.
- Update `docs/handoff-chain.md` with the conversational entry path and its
  clarification boundary.
- Run:

  ```sh
  node --experimental-strip-types --test tests/handoff_chain_extension.test.mjs
  pytest -q tests/test_handoff_chain_extension.py
  pytest -q tests
  git diff --check
  ```

### Explicit non-goals

No planning or implementation adapter, no change to compaction semantics, no
new continuation state, and no generic natural-language parser.

## Slice 2 — Conversational reviewed planning

**Depends on:** Slice 1 accepted by the project conversation.

### Working capability

A fresh project conversation discovers `ralph_plan`. When the operator clearly
selects one exact future folder, the tool queues the same canonical planning
workflow as native `/plan`. It cannot escape `.ralph/plans/future/`, create an
episode, or imply implementation approval.

### Implementation

- Reuse `validateFutureLocation()` and `wrapCanonicalSkill()` through one shared
  plan-admission helper called by both the native command and tool.
- Queue the canonical plan prompt once as a `followUp` from tool context.
- Expose only the exact location argument. Put ambiguity handling in explicit
  prompt guidance: ask the operator rather than selecting among plausible
  folders or inventing a slug.
- Return concise structured success/failure text that describes admission only;
  do not claim that planning completed merely because the prompt was queued.

### Acceptance evidence

- Unit tests prove native `/plan` output remains unchanged.
- Tool tests cover current project-customized Markdown, exact location binding,
  traversal, absolute paths, whitespace/multiple arguments, missing folders,
  symlink escape, missing skill, send failure, and one queued follow-up.
- Tests prove invalid or ambiguous input creates no branch, worktree, session,
  approval arm, or partial workflow admission.
- Installed offline Prime Agent loading proves `/plan`, `/implement-spec`,
  `create_spec_episode`, and the new planning tool coexist without a duplicate
  skill-command surface.
- Update `docs/future-specification-bundles.md` with the conversational planning
  path and its unchanged review/authority boundary.
- Run:

  ```sh
  node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs
  pytest -q tests/test_reviewed_plan_extension.py
  pytest -q tests
  git diff --check
  ```

### Explicit non-goals

No folder search API, automatic selection, plan approval inference, readiness
interpretation in TypeScript, or episode creation.

## Slice 3 — Conversational implementation with host confirmation

**Depends on:** Slice 2 accepted by the project conversation.

### Working capability

In an interactive or RPC project conversation, `ralph_implement_spec` validates
one exact future folder and presents a host UI confirmation naming that folder
and the branch/worktree/session consequence. Approval steers the existing
customizable `/implement-spec` readiness workflow into the same agent run. Only
that matching extension-generated readiness input receives the existing
consume-once authorization for `create_spec_episode`. Rejection or any uncertain
path has no implementation side effect. Non-UI modes remain native-only.

### Implementation

- Reuse the same future-location validation and canonical skill wrapper as
  native `/implement-spec`.
- Require `ctx.hasUI` and `ctx.ui.confirm()`; do not accept model-supplied
  `approved`, `confirmed`, or equivalent fields.
- Before sending the readiness prompt, record one pending exact folder and the
  exact canonical prompt. Reject a second pending request rather than combining
  authority.
- Send the readiness prompt as `steer`. Use the public `input` event and
  `event.source === "extension"` to convert only that matching input into the
  existing active location arm. A mismatch clears the pending entry and
  continues normally without authorization.
- Preserve the existing native command's direct one-turn arm and the existing
  `create_spec_episode` location match/consume semantics. A same-assistant direct
  call before the readiness input is admitted remains unauthorized.
- Clear pending and active state on send failure, `agent_end`, startup/reload,
  and shutdown. Do not preserve authority across agent runs, persist it, retry
  it, reconstruct it, or infer it.
- Keep all branch, worktree, collision, readiness, replay, identity, and daemon
  behavior inside the existing canonical skill and host capability.

### Acceptance evidence

- Tests cover no UI, explicit rejection, timeout/cancel, invalid location,
  missing readiness skill, confirmation text, send failure, and the successful
  `pending → active → consumed` path.
- Focused lifecycle tests prove that a same-assistant direct call is unauthorized,
  only the matching extension input activates the exact location, mismatch or
  `agent_end` clears state, and repeated `create_spec_episode` calls fail after
  the one authorization is consumed. Do not add exhaustive tests for speculative
  event orders that the chosen same-run design excludes.
- Existing native `/implement-spec` authorization tests remain green and prove
  no extra confirmation is added to native syntax.
- One disposable installed-runtime RPC probe exercises the shared helper through
  the public UI confirmation sub-protocol and proves the documented
  `steer → extension input → readiness turn` ordering. It must use no provider
  credentials and create no real episode resources. If that focused proof fails,
  omit `ralph_implement_spec`, document native-only implementation, and stop;
  do not add a more complex authorization design.
- Existing episode mechanics tests remain unchanged and green; add no private
  queue or session-field assertions.
- Update `docs/future-specification-bundles.md` with the conversational approval
  flow, non-UI fallback, cancellation behavior, and the distinction between
  confirmation, readiness, and actual episode creation.
- Run:

  ```sh
  node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs
  node --experimental-strip-types --test tests/spec_episode_extension.test.mjs
  pytest -q tests/test_reviewed_plan_extension.py
  pytest -q tests
  git diff --check
  ```

### Explicit non-goals

No durable approval record, expiry scheduler, lease, transaction journal,
general permission framework, automatic retry, direct episode creation from the
adapter tool, or support for print/JSON sessions without interactive UI.

## Final integration and owner review

After all three slice commits are accepted, the episode prepares one exact
integrated candidate and runs:

```sh
node --experimental-strip-types --test tests/handoff_chain_extension.test.mjs
node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs
node --experimental-strip-types --test tests/spec_episode_extension.test.mjs
pytest -q tests

git diff --check
```

The project conversation then independently verifies:

- the branch, exact commit range, clean worktree, and pushed remote state;
- fresh-session discovery of all three tools and all three native commands;
- convergence on canonical Markdown and deterministic validators;
- no episode side effects from clarification, rejection, invalid input, absent
  UI, mismatched pending authorization, or failed admission;
- documentation and bead evidence for every slice; and
- no unrelated changes or expansion into general orchestration.

Use a fresh final EXPERT review for the exact merge candidate because this work
changes command authority and episode-creation admission. Adjudicate every
material finding and renew that review after any material repair. Merge remains
a separate explicit operator decision.

## Plan-wide non-goals

- Natural-language parsing in extension code.
- A generic `run_command` or arbitrary slash-command tool.
- Prime Agent core or private-runtime changes.
- Copied phase workflows or duplicated path/readiness/collision logic.
- Automatic progression among handoff, plan, and implementation.
- Inferred implementation approval.
- Multiple pending or active conversational implementation authorizations per
  session.
- Nonces, timers, leases, cross-turn reservations, or lifecycle machinery for
  low-likelihood cases already bounded by one agent run and existing exact-path
  checks.
- Distributed exactly-once claims beyond the existing bounded host mechanics.
- Changes to the incubating conversation-driven oversight specification.
