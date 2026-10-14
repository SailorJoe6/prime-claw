---
id: PRIMECLAW-38
title: 'Historical: Conversational Ralph command routing'
status: Done
assignee: []
created_date: '2026-10-14 02:51'
updated_date: '2026-10-14 02:51'
labels: []
dependencies: []
references:
  - >-
    .ralph/plans/archive/conversational-ralph-command-routing/EXECUTION_PLAN.md
    @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/conversational-ralph-command-routing/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - PRIMECLAW-10.22
  - PRIMECLAW-10.23
  - PRIMECLAW-10.24
  - PRIMECLAW-10.25
priority: p2
type: epic
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Specification imported from `.ralph/plans/archive/conversational-ralph-command-routing/SPECIFICATION.md`

# Specification — Conversational routing for Ralph native commands

> **Status:** implemented and archived; awaiting renewed final Expert review and the explicit HITL merge decision.
> **Delivered command architecture:** [Future specification bundles](../../../../docs/future-specification-bundles.md)
> **Related delivered work:** [Handoff continuation resilience](../handoff-continuation-resilience/SPECIFICATION.md)
> **Historical advisory evidence:** [`reports/reviews/handoff-resilience-spec-review-a93c27c.md`](../../../../reports/reviews/handoff-resilience-spec-review-a93c27c.md)

## Purpose

Let a project conversation respond naturally when the operator asks it to use a
selected Ralph native command, without requiring the operator to remember and
type exact slash syntax.

The initial commands to consider are:

- `/handoff [guidance]`;
- `/plan .ralph/plans/future/<slug>`; and
- `/implement-spec .ralph/plans/future/<slug>`.

Conversational routing is an additional admission experience. It must reuse the
native command's behavior and must not weaken its validation or authority
boundary.

## Current system

Prime Claw now provides native `/plan` and `/implement-spec` commands through the
architecture delivered by the archived
[worktree-isolated specification episode](../worktree-isolated-specification-episodes/SPECIFICATION.md).
Deterministic extension code validates paths and loads current project-local
workflow Markdown. `/implement-spec` is the explicit boundary that may create a
branch, worktree, and episode.

Native `/handoff` similarly combines extension mechanics with canonical
project-local workflow Markdown. Its continuation reliability was delivered by
the archived handoff-resilience work linked above.

Natural-language requests currently reach the model as ordinary conversation.
Conversational adapters now cover handoff and reviewed planning. The required
installed-runtime characterization found that conversational implementation
cannot preserve the approved one-run authorization boundary: `agent_end` occurs
between the matching extension input and the readiness turn. Therefore
implementation promotion remains native-only; no `ralph_implement_spec` tool is
registered.

## Desired experience

The operator can state an intent naturally, for example:

- “Hand off and have the next pass investigate the failed ordering test.”
- “Plan the handoff-continuation-resilience specification.”
- “I have approved that plan; start its implementation episode.”

The agent identifies a supported command and its arguments, asks only for
material clarification or required approval, and then invokes the same operation
used by the native command.

The agent must not print a slash command and assume the host will reparse it. It
must not reproduce native validation or workflow behavior in a second
implementation.

## Command authority

Different commands have different consequences and must not be flattened into a
single generic approval rule.

| Command | Conversational authority rule |
|---|---|
| `/handoff` | Clear user-supplied focus may proceed. Materially inferred objectives or outcomes require confirmation. |
| `/plan` | Bind one exact future folder and make clear that the action creates a plan only. Ambiguous folder selection requires confirmation. |
| `/implement-spec` | Preserve explicit operator authorization for the exact future folder and the branch/worktree/session consequence. Never infer implementation approval from prior discussion, specification approval, plan approval, readiness, or a general request to continue. |

If the supported runtime cannot provide a simple, trustworthy conversational
approval path equivalent to native `/implement-spec`, that command remains
native-only. The feature must not build a large authorization subsystem merely
to claim uniform conversational coverage.

## Product constraints

- Commands are exposed explicitly and individually; arbitrary slash commands are
  not automatically callable.
- Native handlers and trusted host capabilities remain the source of behavior.
- Conversational input uses structured command arguments rather than textual
  slash-command reparsing.
- Inline command mentions are ordinary prose and are not intercepted by
  substring matching.
- Clear explicit user intent is trusted.
- Adding an objective, selecting among plausible folders, or crossing an
  authority boundary requires a concrete confirmation.
- Corrections replace the proposed action; insufficient evidence produces a
  clarification question rather than a guess.
- Project-customizable phase procedures remain in their canonical Markdown.
- Missing adapters, rejected input, unavailable approval, and native command
  failures are visible and fail closed.
- Low-likelihood cases already bounded by one agent run, exact path validation,
  or existing episode identity/replay checks do not justify nonces, leases,
  timers, durable approval state, or a generalized authorization machine.
- Routing does not access or persist credentials or unrelated host data.

## Scope

This specification defines the product behavior for opt-in conversational
routing of Ralph native commands.

It does not:

- fix handoff compaction or continuation;
- expose every Prime Agent command;
- automate the complete Ralph lifecycle;
- let the model self-authorize implementation;
- replace native path, readiness, collision, replay, or episode checks;
- standardize project-specific artifact filenames; or
- require Prime Agent core changes.

## Open design questions

Planning must audit the current runtime and answer these questions before choosing
an implementation:

1. What is the smallest supported callable surface an agent can discover in a
   fresh project session?
2. How can that surface invoke the same operation as a native command without
   copying the handler?
3. Which arguments and confirmation rules belong to each command?
4. Can `/implement-spec` obtain trustworthy explicit approval simply with the
   supported host APIs, or should it remain native-only?
5. Should the first delivery cover only `/handoff`, `/plan`, or both before
   considering `/implement-spec`?
6. What evidence proves that conversational and native admission converge after
   their intentionally different UX?

These are planning and implementation questions, not predetermined protocol or
state-machine requirements.

## Acceptance examples

A successful design must demonstrate:

- discoverable conversational invocation for each command actually included;
- the same canonical workflow and deterministic validation as native invocation;
- direct handling of clear intent without needless questions;
- confirmation for materially inferred focus or ambiguous folder choice;
- `/plan` that cannot escape `.ralph/plans/future/` and cannot begin
  implementation;
- no episode creation without explicit authorization equivalent to native
  `/implement-spec`, if conversational implementation is included;
- no side effects for rejected, ambiguous, stale, or unsupported requests;
- no duplicate native command surface or copied phase workflow; and
- unchanged native command behavior and passing repository regression tests.

## Delivery guidance

Planning should begin with a current-code audit and prefer small vertical slices.
A reasonable order may be conversational `/handoff`, conversational `/plan`, and
only then a feasibility decision for conversational `/implement-spec`. This is
guidance, not a mandated implementation architecture.

This native `/plan` invocation records specification approval for planning
only. The bundle remains in `.ralph/plans/future/` until the operator separately
approves the resulting execution plan and invokes native `/implement-spec`.

## Provenance

This specification was split from the earlier combined
`handoff-resilience-and-conversational-routing` draft when operator review found
that conversational routing should apply beyond handoff to the native commands
delivered by the worktree-isolated episode.

The old EXPERT report is immutable historical advisory evidence. It did not
review this broader simplified specification. The earlier requirements and
decisions catalogs were intentionally removed because they encoded speculative
infrastructure before the product behavior and simplest implementation were
understood.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 discoverable conversational invocation for each command actually included;
- [x] #2 the same canonical workflow and deterministic validation as native invocation;
- [x] #3 direct handling of clear intent without needless questions;
- [x] #4 confirmation for materially inferred focus or ambiguous folder choice;
- [x] #5 `/plan` that cannot escape `.ralph/plans/future/` and cannot begin implementation;
- [x] #6 no episode creation without explicit authorization equivalent to native `/implement-spec`, if conversational implementation is included;
- [x] #7 no side effects for rejected, ambiguous, stale, or unsupported requests;
- [x] #8 no duplicate native command surface or copied phase workflow; and
- [x] #9 unchanged native command behavior and passing repository regression tests.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/conversational-ralph-command-routing/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# Execution Plan — Conversational routing for Ralph native commands

> **Status:** implementation and final validation complete; archived for renewed Expert review and the explicit HITL merge gate.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Selected future folder:** `.ralph/plans/future/conversational-ralph-command-routing/`
> **Parent workstream:** `prime-claw-h6w` (Phase 4 episode loop)

## Outcome

Deliver explicit opt-in conversational adapters for Ralph handoff and reviewed
planning, and characterize whether implementation promotion can meet the same
authority boundary. The required runtime proof selected the planned native-only
fallback for implementation, so no `ralph_implement_spec` adapter is delivered.

Delivered adapters converge on the same deterministic admission helper and
canonical project Markdown as their native commands. Native `/handoff`, `/plan`,
and `/implement-spec` behavior remains unchanged. There is no generic
slash-command router and no textual slash-command reparsing.

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
   a conditional conversational implementation adapter would send its readiness
   workflow as `steer` only if the lifecycle proof supported the simple one-turn
   authorization. It did not. Native commands retain
   their current idle-command delivery behavior.
4. **Arguments and clarification.** The handoff tool accepts only optional
   operator guidance. The planning tool and conditional implementation design
   accept only one
   exact `.ralph/plans/future/<slug>` location. Prompt guidance tells the model
   to ask in ordinary conversation before calling when focus or folder selection
   is materially inferred. Deterministic validation remains the final guard.
   Register all routing tools with sequential execution and describe them as
   terminal routing actions. Their results report admission, never completion.
5. **Implementation authority.** A natural-language request alone cannot
   authorize episode creation because the model interprets that request. Before
   any conversational implementation could proceed, Prime Agent would have to
   show the operator a
   trusted confirmation naming the exact future folder and explaining that
   approval may create a branch, worktree, and episode session. Only explicit
   confirmation grants temporary authority for the normal readiness workflow.
   Rejection, cancellation, unavailable UI, invalid input, or failure to queue
   that workflow creates nothing. Finer direct-action versus clarification UX is
   deferred to `prime-claw-h6w.17` after dogfood and must not expand this delivery.
6. **Conditional one-use authorization handoff.** Confirmation would not create
   an episode or bypass the normal readiness workflow. The rejected conditional
   extension design records only one
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

The delivered routing tool names are `ralph_handoff` and `ralph_plan`.
`create_spec_episode` remains the existing capability gated by native
`/implement-spec`; `ralph_implement_spec` is intentionally absent.

## Delivery discipline

Implement the work as three dependency-ordered vertical slices. The implementation
bead chain is `prime-claw-h6w.18` (Slice 1) → `prime-claw-h6w.19` (Slice 2) →
`prime-claw-h6w.20` (Slice 3), all under `prime-claw-h6w`. Each slice must:

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

**Implementation status:** Accepted by the project conversation in commit
`86b24b5`; focused and full regression evidence is recorded on
`prime-claw-h6w.18`.

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

**Implementation status:** Accepted by the project conversation at
`d011968d4`; focused and full regression evidence is recorded on
`prime-claw-h6w.19`. Slice 3 may begin.

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

**Implementation status:** Accepted by the project conversation at
`272372c9e848c21d48a5968144d2495ea59c4a2e`. The required installed Prime Agent
0.9.5 RPC characterization proved confirmation → `steer` → matching extension
`input`, but
also proved that `agent_end` fires after that input and before the readiness
agent turn begins. Because the approved design must clear pending and active
authority on `agent_end`, the bounded `pending → active → consumed` gate cannot
reach the readiness turn. Per the probe-or-omit rule, `ralph_implement_spec`
remains unregistered and implementation stays native-only. The focused probe is
retained in `tests/test_reviewed_plan_extension.py` with a credential-free fake
provider and creates no episode resources. Candidate validation is green: reviewed-plan
Node 19/19, episode mechanics Node 22/22, focused Python 9/9, and full
`pytest -q tests` 249 passed with 11 warnings.

**Depends on:** Slice 2 accepted by the project conversation.

### Conditional capability (not delivered)

Had the lifecycle proof passed, an interactive or RPC project conversation would
have exposed `ralph_implement_spec` with exact-folder validation and trusted host
confirmation. The observed `agent_end` boundary makes the approved same-run
consume-once authorization impossible, so this conditional path was omitted.
All modes remain native-only for implementation promotion.

### Conditional implementation (not delivered)

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

### Acceptance evidence and fallback

The UI-path bullets below describe the branch that the failed lifecycle proof
correctly prevented. The retained evidence instead proves the ordering, the
native-only surface, and unchanged native authorization.

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
- fresh-session discovery of the delivered tools (`ralph_handoff`, `ralph_plan`,
  and existing `create_spec_episode`), absence of `ralph_implement_spec`, and all
  three native commands;
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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/conversational-ralph-command-routing/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/conversational-ralph-command-routing/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: `PRIMECLAW-10.22`, `PRIMECLAW-10.23`, `PRIMECLAW-10.24`, `PRIMECLAW-10.25`.

### Shared archive-index outcome

## conversational-ralph-command-routing/ — Conversational routing for Ralph native commands ✅ COMPLETE (2026-09-22)

Delivered explicit `ralph_handoff` and `ralph_plan` tools that converge on the
canonical native workflows while preserving `/handoff`, `/plan`, and
`/implement-spec`. Handoff uses `steer` followed by the sole `followUp`; planning
queues canonical planning once and grants no implementation authority. Installed
Prime Agent 0.9.5 lifecycle evidence selected the approved native-only fallback
for implementation, so `ralph_implement_spec` is intentionally absent.

Accepted slice commits are `86b24b5dfecac312a46cfbab2190236b73af430b`,
`d011968d4f505d8df52ebd552e49d654cdf45b74`, and
`272372c9e848c21d48a5968144d2495ea59c4a2e`; acceptance state is recorded by
`a25f3b426f8ebe222911d78458f899098e017ff5`. Final validation covered all three
Node suites, the full Python suite, installed-runtime discovery, archive-link
resolution, and a clean diff. The unrelated `conversation-driven-episode-oversight`
bundle remains incubating and unchanged. Merge and resource cleanup remain
separate explicit operator decisions.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## conversational-ralph-command-routing/ — Conversational routing for Ralph native commands ✅ COMPLETE (2026-09-22)

Delivered explicit `ralph_handoff` and `ralph_plan` tools that converge on the
canonical native workflows while preserving `/handoff`, `/plan`, and
`/implement-spec`. Handoff uses `steer` followed by the sole `followUp`; planning
queues canonical planning once and grants no implementation authority. Installed
Prime Agent 0.9.5 lifecycle evidence selected the approved native-only fallback
for implementation, so `ralph_implement_spec` is intentionally absent.

Accepted slice commits are `86b24b5dfecac312a46cfbab2190236b73af430b`,
`d011968d4f505d8df52ebd552e49d654cdf45b74`, and
`272372c9e848c21d48a5968144d2495ea59c4a2e`; acceptance state is recorded by
`a25f3b426f8ebe222911d78458f899098e017ff5`. Final validation covered all three
Node suites, the full Python suite, installed-runtime discovery, archive-link
resolution, and a clean diff. The unrelated `conversation-driven-episode-oversight`
bundle remains incubating and unchanged. Merge and resource cleanup remain
separate explicit operator decisions.
<!-- SECTION:FINAL_SUMMARY:END -->
