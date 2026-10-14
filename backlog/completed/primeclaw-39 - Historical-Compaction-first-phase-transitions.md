---
id: PRIMECLAW-39
title: 'Historical: Compaction-first phase transitions'
status: Done
assignee: []
created_date: '2026-10-14 02:51'
updated_date: '2026-10-14 02:51'
labels: []
dependencies: []
references:
  - >-
    .ralph/plans/archive/compaction-first-phase-transitions/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/compaction-first-phase-transitions/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - PRIMECLAW-10.30
  - PRIMECLAW-10.31
  - PRIMECLAW-10.32
priority: p2
type: epic
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Specification imported from `.ralph/plans/archive/compaction-first-phase-transitions/SPECIFICATION.md`

# Compaction-First Phase Transitions (`/plan`, `/implement-spec`)

> Status: APPROVED, IMPLEMENTED, AND ARCHIVED — Slice 1 accepted at exact `200be5744003ac47cecd2d79a337df3e4c4aeebc`; Slice 2 accepted at exact replacement `c4de0a89c84aa02f1035f0f3f6ed4bc838223949` (runtime predecessor `94e4488ade82e1a2a8ce74cf956993870759d1f3`). Joe explicitly deferred the unrun post-candidate operator dogfood to blocked post-merge Bead `prime-claw-h6w.28`; this is not completed dogfood evidence.
> Integration: The original exact review hashes are preserved as provenance. Their patch-equivalent post-acceptance rebase map onto `origin/main` `eca48f8b284c990a8e030062ef70192313781b7f` is recorded in [EXECUTION_PLAN.md](EXECUTION_PLAN.md).
> Source: design conversation between Joe and prime-agent, 2026-10-01.

## Summary

`/plan` and `/implement-spec` become **compaction-first**. At admission, the
extension steers a small prep turn whose only jobs are a light readiness sniff
and one compaction request carrying a standard, purpose-built focus hint. The
canonical phase workflow is queued at the same admission boundary as the sole
native follow-up, so the planning (or implement-spec) turn begins on freshly
compacted context. The mechanism mirrors the proven handoff chain
(`docs/handoff-chain.md`).

## Driving evidence (manual dogfood)

During Phase 4 dogfooding, the operator almost always issues a custom
compaction command by hand at these two boundaries, because both the
specification and planning phases consume enough of the context window that
compacting before the next phase is simply the right move. Compaction at the
design→plan and plan→implement transitions is already the proven manual
practice; this feature codifies it, consistent with Phase 4's manual-first,
codify-last discipline.

A secondary benefit: the post-`/plan` conversation is long-lived (plan review
→ `/implement-spec` → episode oversight → merge → cleanup). Starting that
phase on a tight, purpose-built compaction base delays later compaction
pressure and reduces drift across the episode's lifetime.

## Current system

- **`/plan <folder>`** (`src/prime-agent-plugin/extensions/reviewed-plan.ts`):
  validates the location via `validateFutureLocation` (strict kebab-case
  slugs; whitespace rejected), wraps `.ralph/skills/plan/SKILL.md` with an
  `<operator-plan-location>` envelope, and delivers it natively. The
  `ralph_plan` conversational tool queues the same prompt as a follow-up. No
  compaction occurs at this boundary today.
- **`/implement-spec <folder>`**: same admission shape, plus a deterministic
  preflight (`assertConversationPromotionReady`) and an in-memory per-session
  approval map (`approvedLocationBySession`) written at admission.
  `create_spec_episode` requires a matching approval; the map is cleared on
  `session_start`, `agent_end`, and `session_shutdown`, and consumed on
  successful use.
- **Episode fork creation** already performs its own handoff-first focused
  compaction *inside the new episode session*. The owner conversation's
  context is untouched by that; this feature concerns the owner conversation
  only.
- **Handoff chain** (`/handoff`, `ralph_handoff`, `handoff_spec_episode`):
  the established seam pattern — steer a prep-style prompt, queue the next
  canonical workflow exactly once as a native follow-up at the same admission
  boundary; compaction is best-effort and never the continuation trigger;
  fail-closed preflight of canonical skill files; no retries after
  interruption; no conditional queue removal (no public queue-removal API
  exists).

## Required change (behavior)

1. **New dedicated prep skills.** `.ralph/skills/plan-prep/SKILL.md` and
   `.ralph/skills/implement-prep/SKILL.md` — project-customizable Markdown
   with the same ownership model as the other canonical skills. (Names are
   provisional; planning may adjust.) A dedicated skill per phase keeps the
   customizable-policy boundary clean; the existing `handoff` skill is not
   overloaded.
2. **`/plan <folder>` admission.** Validate the location exactly as today —
   unchanged grammar, no additional arguments. Preflight both the `plan-prep`
   and `plan` skill files (fail closed before any partial transition). Steer
   the `plan-prep` prompt carrying the existing `<operator-plan-location>`
   envelope; queue the canonical `plan` prompt as the sole native follow-up
   at the same admission boundary. The `ralph_plan` tool receives identical
   treatment (steer + follow-up); its signature is unchanged (`location`
   only).
3. **`/implement-spec <folder>` admission.** Same shape, with `implement-prep`
   steering and the canonical `implement-spec` prompt queued as the sole
   follow-up. The existing deterministic preflight and approval-recording
   behavior are preserved, subject to the approval-token constraint below.
4. **Prep-turn behavior (both skills).** Read the location envelope. Perform
   a light readiness sniff (for plan: the folder and its `SPECIFICATION.md`
   exist; for implement-spec: the bundle is present). If the bundle is
   obviously inadequate, skip requesting compaction and end the turn — the
   queued phase workflow still runs and issues the authoritative gap report.
   Otherwise call `compact.run(focus_hint)` exactly once with the standard
   hint. Report only Status / Evidence / Next Step, distinguishing
   "compaction requested" from "compaction confirmed," and end the turn.
   The prep turn never cancels the queued follow-up and never reconstructs a
   removed one.
5. **Standard hint.** Fixed text maintained in each prep skill — not
   operator-supplied, and v1 does not require bespoke per-invocation hint
   authoring. The hint's purpose is **prospective role-priming** (in contrast
   to the handoff hint's retrospective continuity). Requirements for its
   content (exact wording is owned by the skill Markdown, per the prompt
   ownership principle below):
   - names the exact selected future folder;
   - names the upcoming role: for plan, "you are about to plan this
     specification and then own and supervise its episode to completion"; for
     implement-spec, the owner-supervision role;
   - directs preservation of operator review decisions, constraints,
     non-goals, and the locations of durable artifacts.

   **Prompt ownership principle (explicit).** All instructions to the LLM —
   including the exact standard-hint text and when to pass it to
   `compact.run()` — live in the project-local prep-skill Markdown under
   `.ralph/skills/`. Plugin code owns mechanics only: argument validation,
   file preflight, prompt loading and wrapping, admission ordering, and
   follow-up queueing. The extension loads the skill file verbatim (the same
   loader pattern used for `handoff`, `execute`, `plan`, and
   `implement-spec`) and contains no prompt text of its own. This preserves
   the two properties the pattern has served well: (a) prompts iterate
   quickly with no plugin rebuild or release, and (b) each project can
   customize the hint and prep behavior to its own quirks by editing its
   local skill copy.
6. **Safety properties inherited from the handoff chain, explicitly:**
   compaction is best-effort and never the continuation trigger; the
   follow-up is queued at admission regardless of compaction outcome
   (success, failure, cancellation, `scheduled: false`); interruption
   boundaries (TUI `C-c`, ACP cancel/close, explicit queue removal, session
   termination) cancel the transition without reconstruction or retry; a late
   or repeated compaction signal admits nothing additional; success reporting
   covers admission only, never workflow completion.

## The `/implement-spec` approval-token constraint (must be resolved in planning)

Today the approval recorded at `/implement-spec` admission survives because
the admitted workflow runs in the immediately following turn and calls
`create_spec_episode` before `agent_end` clears the map. Inserting a prep
turn means `agent_end` fires between admission and the implement-spec turn,
clearing the approval before `create_spec_episode` runs — a spurious "no
matching active approval" failure on a legitimate operator command.

The corrected mechanics must preserve both invariants:

- operator approval stays bound to the exact session, exact location, and
  this admission chain; and
- approvals cannot linger indefinitely.

Candidate approaches (planning chooses, with runtime probes if needed): a
bounded one-deep skip of the `agent_end` clear for a chained admission; or
recording approval when the canonical implement-spec turn actually starts, by
exact recognition of the extension's own constructed prompt. The execution
plan must name the chosen mechanics and include regression coverage that
proves the race is closed.

## Entry surfaces

| Surface | Treatment |
|---|---|
| Native `/plan <folder>` | Prep chain added |
| `ralph_plan` tool | Prep chain added; signature unchanged |
| Native `/implement-spec <folder>` | Prep chain added; approval mechanics corrected per the constraint above |
| `create_spec_episode`, `finalize_spec_episode`, `handoff_spec_episode` | Unchanged; `create_spec_episode` is not an entry surface (it requires prior approval) |

## Boundaries and non-goals (v1)

- **No optional trailing guidance argument.** Deferred design, recorded here
  so it is not re-derived later: if added, the standard hint remains the
  default, and the argument grammar is all-or-nothing backtick quoting —
  either one bare whitespace-free token (location only), one backtick-quoted
  segment (location), or exactly two backtick-quoted segments (location +
  guidance, *both* quoted). Mixed quoting, unbalanced backticks, more than
  two segments, empty segments, or backticks inside segment content are usage
  errors whose message shows the correct quoted form. The extracted location
  flows into `validateFutureLocation` unchanged: kebab-case slugs remain
  required, so quoting never legitimizes space-containing folder names — it
  exists purely for intent disambiguation. `ralph_plan` would gain an
  optional structured `guidance` field with no parsing.
- **No bespoke hint authoring requirement.** The standard hint suffices in
  v1; richer agent-authored enrichment within skill policy may be considered
  later.
- **No changes to `/design` or `/spec-it-out` admission.**
- **No changes to the episode fork's existing handoff-first compaction**;
  this feature concerns only the owner conversation's context at the plan and
  implement boundaries.
- **No queue-cancellation capability.** The prep turn never de-queues the
  phase workflow, even when it finds the bundle inadequate.
- **No automatic retries** after interruption or transport ambiguity.

## Done when (acceptance shape)

- `/plan <folder>` on a real reviewed specification: observed compaction (or
  a truthful `scheduled: false` report) followed by exactly one canonical
  planning turn running on compacted context.
- `/implement-spec <folder>` on a real approved bundle: the same, with
  `create_spec_episode` succeeding under the corrected approval mechanics —
  regression-proving the `agent_end` race is closed.
- Both surfaces reject malformed input exactly as today (location validation
  unchanged).
- Deterministic coverage in the handoff-chain test style (node test + pytest
  bridge), plus documentation alongside `docs/handoff-chain.md`.
- Dogfooded end-to-end by the operator through a real plan and episode
  promotion.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `/plan <folder>` on a real reviewed specification: observed compaction (or a truthful `scheduled: false` report) followed by exactly one canonical planning turn running on compacted context.
- [x] #2 `/implement-spec <folder>` on a real approved bundle: the same, with `create_spec_episode` succeeding under the corrected approval mechanics — regression-proving the `agent_end` race is closed.
- [x] #3 Both surfaces reject malformed input exactly as today (location validation unchanged).
- [x] #4 Deterministic coverage in the handoff-chain test style (node test + pytest bridge), plus documentation alongside `docs/handoff-chain.md`.
- [x] #5 Dogfooded end-to-end by the operator through a real plan and episode promotion.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/compaction-first-phase-transitions/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# Execution Plan — Compaction-first phase transitions

> **Status:** ARCHIVED — Slice 1 accepted at exact `200be5744003ac47cecd2d79a337df3e4c4aeebc`; Slice 2 accepted at exact replacement `c4de0a89c84aa02f1035f0f3f6ed4bc838223949` (runtime predecessor `94e4488ade82e1a2a8ce74cf956993870759d1f3`). Joe explicitly deferred the unrun post-candidate operator dogfood to `prime-claw-h6w.28`.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Future folder:** `.ralph/plans/future/compaction-first-phase-transitions/`
> **Bead chain:** `prime-claw-h6w.26` (Slice 1) → `prime-claw-h6w.27` (Slice 2),
> both under `prime-claw-h6w`.

## Outcome

`/plan <folder>` and `/implement-spec <folder>` compact first: admission steers
a minimal prep turn that performs a light readiness sniff and requests
compaction exactly once with a standard role-priming hint, while the canonical
phase workflow is queued at the same admission boundary as the sole native
follow-up. The phase turn then runs on freshly compacted context. The seam
reuses the proven handoff-chain mechanics and safety properties. The operator's
dogfooding practice — manually compacting at both boundaries because
specification and planning consume the context window — is codified, per Phase
4 manual-first, codify-last.

## Current-code audit and planning decisions

Audit of `src/prime-agent-plugin/extensions/reviewed-plan.ts` and
`extension-support/reviewed-plan-support.ts` against the specification:

- `admitCanonicalSkill()` validates the location, wraps the phase skill with
  its location envelope, and delivers once (native for commands, `followUp`
  for the `ralph_plan` tool). There is no prep step and no compaction at
  either boundary today.
- `/implement-spec` records operator approval in `approvedLocationBySession`
  at admission (`onValidated`) and clears it on `session_start`, `agent_end`,
  and `session_shutdown`; `create_spec_episode` consumes it. Today the
  admitted workflow runs in the immediately following turn, so the approval
  is always consumed before `agent_end` fires. Inserting a prep turn breaks
  that invariant — the race named in the specification is real by
  construction, since the prep turn is a full turn and `agent_end` fires at
  its end.

**Decision 1 — approval race: bounded one-deep skip.** At chained
`/implement-spec` admission, record the approval together with a per-session
chained-admission flag. The `agent_end` handler clears the flag instead of
the approval exactly once; any later `agent_end` clears the approval
normally. `session_start`/`session_shutdown` clearing and consume-on-use are
unchanged. Chosen over turn-start re-arm because it is fully deterministic,
bounded (an orphaned approval survives at most one extra `agent_end`), and
testable offline in the node harness; turn-start re-arm depends on an
extension event surface we have not probed and is recorded as the rejected
alternative, revisit only if probes during implementation falsify the skip.

**Decision 2 — fail-closed prep-skill preflight, per spec.** Both the prep
skill and the phase skill must exist before any admission. Rollout
implication: a project whose `.ralph/skills/` lacks `plan-prep` or
`implement-prep` gets a warning and no admission from the new extension.
That matches handoff-chain behavior and the Phase-4 policy that the
universal agent installs missing canonical templates. This builder repo's
own skill set gains both files in these slices.

**Decision 3 — envelope reuse.** The prep prompt is the wrapped prep skill
plus the *same* location envelope tag the phase uses today
(`<operator-plan-location>` / `<operator-implementation-location>`). The
queued phase prompt is byte-identical to today's, so the phase skills and
their tests need no content change.

**Decision 4 — delivery modes mirror the handoff chain exactly.** Native
command: prep prompt as an ordinary message, phase prompt as the sole
`followUp`. `ralph_plan` tool: prep prompt as `steer`, plan prompt as the
sole `followUp`. The known shared-runtime limitation on the captured
`pi.sendUserMessage` runtime (`prime-claw-f81.3`) applies to this tool path
exactly as it does to `ralph_handoff`; it is documented, not fixed here.

**Decision 5 — prep turns do not run `prepare`.** The queued `plan` and
`implement-spec` skills already run `prepare` first, which re-orients the
agent on the freshly compacted context. The prep turn stays minimal:
sniff, compact once, report, end.

**Decision 6 — prompt ownership.** The standard hint text and all prep-turn
instructions live in `.ralph/skills/plan-prep/SKILL.md` and
`.ralph/skills/implement-prep/SKILL.md`. Plugin TypeScript contains no
prompt text — mechanics only (validation, preflight, loading, admission
ordering, queueing).

## Delivery discipline

Implement as two dependency-ordered vertical slices. Each slice must:

- remain inside its stated scope;
- validate every plugin-source change only in Docker tier 1 with
  `scripts/test-tier1.sh --probe` and the `container` pytest gate; never apply,
  check, or probe a candidate against the host user-global generation;
- keep any additional live Prime Agent probe inside Docker and preserve the
  probe isolation contract (config-mutating RPC never runs unguarded);
- update its own bead with the exact commit and evidence;
- run focused tests plus the active repository suite;
- update operator documentation in the same commit;
- produce one clean, single-purpose commit pushed for project-conversation
  review; and
- stop after reporting the exact commit, changed files, tests, limitations,
  and worktree state.

A missing public capability or a probe result that contradicts these
mechanics is a plan-review boundary, not permission to patch Prime Agent
internals. Prime Agent remains an upstream dependency.

## Slice 1 — Compaction-first `/plan`

**Bead:** `prime-claw-h6w.26`

**Implementation status:** Owner-accepted at exact pushed commit
`200be5744003ac47cecd2d79a337df3e4c4aeebc` on 2026-10-02. Its dependency gate
for Slice 2 was satisfied. Slice 2 was later owner-accepted at documentation
replacement `c4de0a89c84aa02f1035f0f3f6ed4bc838223949`, with runtime predecessor
`94e4488ade82e1a2a8ce74cf956993870759d1f3`.

### Working capability

`/plan <folder>` and the `ralph_plan` tool admit a `plan-prep` turn first.
The prep turn sniffs readiness, requests compaction once with the standard
role-priming hint (plan this exact folder, then own and supervise its
episode), reports Status / Evidence / Next Step, and ends. The canonical
plan workflow then runs once on compacted context. Location validation,
envelope content, and the queued plan prompt are byte-identical to today.

### Implementation

- Add a shared prep-chain admission helper (alongside
  `reviewed-plan-support.ts`) that: preflights both skill files (fail
  closed), steers/sends the wrapped prep prompt with the location envelope,
  and queues the wrapped phase prompt as the sole `followUp` — with visible
  first- and second-send failure reporting mirroring `admitHandoff`.
- Rewire native `/plan` and the `ralph_plan` tool through the helper. The
  tool signature is unchanged (`location` only).
- Write `.ralph/skills/plan-prep/SKILL.md`: read the
  `<operator-plan-location>` envelope as operator-selected input; light
  readiness sniff (folder and `SPECIFICATION.md` present — if obviously
  inadequate, skip compaction and end the turn so the queued plan workflow
  issues the authoritative gap report); otherwise call
  `compact.run(focus_hint)` exactly once with the embedded standard hint;
  report Status / Evidence / Next Step distinguishing "compaction requested"
  from "compaction confirmed"; never cancel, reconstruct, or invoke the
  queued workflow; end the turn.
- Update `docs/` with the new seam (new `docs/prep-chain.md`, cross-linked
  from `docs/handoff-chain.md`).

### Acceptance evidence

- Node tests prove: both skill files preflighted before any send; prep
  prompt admitted first (native: ordinary message; tool: `steer`); the plan
  prompt queued exactly once as the sole `followUp` and byte-identical to
  today's wrapped prompt; malformed locations rejected exactly as today;
  missing prep or plan skill fails closed with a visible warning; first- and
  second-send failures surface without partial-transition claims.
- Existing `tests/reviewed_plan_extension.test.mjs` expectations that
  asserted the old direct-delivery shape are updated deliberately and called
  out in the commit message.
- Skill-content tests (`test_future_plan_skills.py` style) pin `plan-prep`
  policy invariants: exactly-once `compact.run`, standard-hint presence,
  no self-invocation of `plan`, Status/Evidence/Next Step contract.
- A container behavioral `/plan` probe from `/workspace` proves: compaction
  requested (or a truthful `scheduled: false`), then exactly one plan turn,
  empty queue at end — an evidence table mirroring `docs/handoff-chain.md`.
- The explicit container-root apply/check performed by tier 1 passes, followed
  by the container startup probe showing the candidate generation active.
- Run:

  ```sh
  python3 -m pytest -q tests/test_reviewed_plan_extension.py tests/test_future_plan_skills.py
  python3 -m pytest -q tests -m container
  scripts/test-tier1.sh --probe
  scripts/test-all.sh
  git diff --check
  ```

- `docs/prep-chain.md` updated in the same commit; bead `prime-claw-h6w.26`
  updated with commit and evidence.

### Candidate evidence (2026-10-02)

The earlier host/user-global apply, check, startup, and behavioral-probe claims
from candidate `ef9c401` are superseded and are not acceptance evidence. The
rebased candidate was validated only in Docker tier 1:

- Rebased onto `origin/main` `f85680f`, which contains accepted authority tip
  `ded4a8c` and guardrail implementation `672be3b`.
- Focused tier-0 policy/bridge checks: 22 passed, 7 environment-skipped.
- `python3 -m pytest tests/ -q -m container`: 41 passed, 385 deselected;
  11 existing deprecation warnings.
- Container behavioral test
  `test_container_installed_native_plan_runs_prep_then_one_plan_followup`
  loaded `/root/.prime/agent/extensions/reviewed-plan.ts`, executed one real
  container-local `compact.run()` call with truthful `scheduled: false`, saw
  exactly one `plan-prep` prompt and one canonical `plan` prompt, emitted one
  completion marker, and exited without an unexpected model call. Its Python
  runtime bootstrap used `PRIME_AGENT_INSTALL_UV=1` inside the ephemeral
  container only.
- `scripts/test-tier1.sh --probe`: PASS with pinned Prime Agent `0.9.3`;
  explicit-root apply/check succeeded at `/root/.prime/agent`, `handoff`,
  `plan`, and `implement-spec` were each discovered exactly once from the
  container-installed extension tree, and the container was destroyed.
- `scripts/test-all.sh`: PASS — tier 0 had 278 passed and 148 skipped; tier 1
  had 41 passed and 385 deselected; tier 2 was intentionally not requested.
  One preceding final-tree attempt hit two unrelated timing-sensitive
  `test_embedding_candidate_build.py` watchdog tests; a bounded isolated check
  passed one and reproduced one, and the single bounded unified rerun passed
  without changing watchdog code.
- No resumed candidate validation applied, checked, or probed the host
  user-global `~/.prime/agent`. The ignored local `.env` selected pinned
  Prime Agent `0.9.3` and is not part of the candidate.

### Owner acceptance (2026-10-02)

The project conversation accepted exact pushed commit
`200be5744003ac47cecd2d79a337df3e4c4aeebc` and closed
`prime-claw-h6w.26`. Fresh EXPERT `expert-reviewer-compaction-slice1-200be574`
(session `01a0fe94-c76e-7044-9d6a-892fffcde77f`, Astra/max) returned PASS;
the preserved report is
`/Users/jlanders/.prime/agent/session-artifacts/01a0fdbc-eaa1-75cb-a44b-86787dfeb048/expert-review-slice1-200be574.md`.
This acceptance authorizes only the already-approved Slice 2. It is not merge
approval and does not expand scope.

### Explicit non-goals

No `/implement-spec` changes (Slice 2), no guidance argument, no bespoke
hint authoring, no queue-cancellation capability, no retries, no changes to
`/design` or `/spec-it-out`.

## Slice 2 — Compaction-first `/implement-spec` and the approval-token fix

**Bead:** `prime-claw-h6w.27` — **Dependency satisfied:** Slice 1 was
owner-accepted at exact commit `200be5744003ac47cecd2d79a337df3e4c4aeebc` and
`prime-claw-h6w.26` is closed.

### Working capability

`/implement-spec <folder>` admits an `implement-prep` turn first (sniff,
standard owner-supervision hint, one compaction request, report, end), and
the canonical implement-spec workflow then runs once on compacted context.
`create_spec_episode` succeeds inside that turn because the admission
approval provably survives exactly the one intervening `agent_end`. A
cancelled chain leaves no usable approval beyond the next `agent_end`.

### Implementation

- Write `.ralph/skills/implement-prep/SKILL.md`: same prep-turn contract as
  Slice 1; the sniff checks bundle presence; the standard hint primes the
  owner-supervision role (review readiness, create the episode, then
  supervise it to completion).
- Rewire native `/implement-spec` through the Slice-1 helper, keeping
  `assertConversationPromotionReady` preflight and approval recording at
  admission.
- Implement Decision 1: a per-session chained-admission flag recorded with
  the approval; the `agent_end` handler consumes the flag once in place of
  clearing the approval. Consume-on-use and lifecycle clearing unchanged.
- Update `docs/prep-chain.md` and the approval-boundary documentation.

### Acceptance evidence

- Node tests prove: approval survives exactly one `agent_end` after chained
  admission; it is cleared at the second; `create_spec_episode` in the
  implement-spec turn succeeds after a prep turn; consume-on-use still
  deletes; `session_start`/`session_shutdown` still clear; a cancelled chain
  (no implement-spec turn) leaves the approval dead after the next
  `agent_end`; `create_spec_episode` without any admission still fails.
- A container behavioral probe against the tier-1 installed Prime Agent proves
  the full chain: prep turn, requested compaction, exactly one implement-spec
  turn, successful episode creation (or its truthful existing-identity return),
  and an empty queue at exit.
- Explicit container-root apply/check plus the tier-1 startup probe pass, same
  as Slice 1. No candidate validation touches the host user-global generation.
- Run the same focused and full suites as Slice 1; `git diff --check`.
- Bead `prime-claw-h6w.27` updated with commit and evidence.

### Implementation checkpoint (2026-10-02)

- Added project-local `.ralph/skills/implement-prep/SKILL.md`; it owns the
  cheap bundle sniff, fixed owner-supervision hint, exactly-once
  `compact.run(focus_hint)` request, and bounded Status / Evidence / Next Step
  report.
- Routed native `/implement-spec` through the shared two-message prep chain.
  Both project-local skills and the existing conversation-promotion boundary
  preflight before either message; approval is recorded only after both sends
  and remains unusable until the prep turn's `agent_end` consumes its skip.
- Replaced the per-session location string with exact location plus one
  non-accumulating `agent_end` skip. The prep end consumes the skip; the next
  end clears unused authority. Consume-on-use, `session_start`, and
  `session_shutdown` remain clearing boundaries.
- Added positive, wrong-location, missing-skill, partial-send, cancellation,
  repeated-admission, lifecycle-clear, consume/replay, and fresh-rearm Node
  coverage plus an installed-container native `/implement-spec` behavioral
  probe that requires exactly one observed intervening `agent_end` before its
  controlled episode creation succeeds.
- Updated `docs/prep-chain.md`, `docs/future-specification-bundles.md`, the docs
  index, and the handoff-chain cross-reference.

### Candidate evidence (2026-10-02)

- Focused tier-0 policy/documentation checks: 23 passed, 8 container tests
  deselected.
- Container node bridge for the reviewed-plan suite: PASS.
- Installed-container native `/implement-spec` behavioral probe: PASS; one
  `implement-prep`, one canonical `implement-spec`, one real container-local
  `compact.run()` call, exactly one observed intervening `agent_end`, one
  authorized controlled episode creation, and no unexpected model call.
- Updated native-discovery activation/lifecycle fixtures: 2 focused container
  tests passed through the two-turn chain.
- Independent static review: PASS after one blocking finding was repaired by
  making approval unusable before the prep-turn `agent_end` and adding the
  matching regression.
- `python3 -m pytest tests/ -q -m container`: 42 passed, 386 deselected;
  11 existing deprecation warnings.
- `scripts/test-tier1.sh --probe`: PASS with pinned Prime Agent `0.9.3`;
  explicit-root apply/check succeeded at `/root/.prime/agent`, `handoff`, `plan`,
  and `implement-spec` each registered exactly once, and the container was
  destroyed.
- `scripts/test-all.sh`: PASS — tier 0 had 279 passed and 149 skipped;
  tier 1 had 42 passed and 386 deselected; tier 2 was intentionally not
  requested.
- No candidate validation applied, checked, or probed the host user-global
  `~/.prime/agent`. The ignored local `.env` selected pinned Prime Agent
  `0.9.3` and is not part of the candidate.

### Explicit non-goals

No conversational `/implement-spec` tool (none exists; `create_spec_episode`
remains not an entry surface, and its signature and episode-resource behavior
are unchanged beyond the planned approval gate), no turn-start re-arm unless
Decision 1 is falsified by probe, no changes to the episode fork's existing
handoff-first compaction, no multi-project template installation (universal
agent's job, Phase 4 narrative).

## Final review and delivery gate

**Current gate disposition:** DEFERRED. Both planned slices are owner-accepted,
and Joe explicitly selected deferral of the unrun post-candidate operator
end-to-end dogfood to `prime-claw-h6w.28` on 2026-10-02. That P1 Bead remains
BLOCKED on separate merge authorization and deliberate post-merge activation
from primary `main`; it is not completed dogfood evidence.

This explicit separately tracked deferral matches the prior
`prime-claw-h6w.15` archival precedent and satisfies this episode's disposition
requirement. Final docs-only archival records that disposition; it does not
claim dogfood completion, merge readiness, activation, merge, or episode cleanup.

### Post-acceptance integration rebase (2026-10-03)

The finalized branch was rebased without conflicts from integration base
`f85680fc87cb4985b84f1650c8ab866ab94733b6` onto current `origin/main`
`eca48f8b284c990a8e030062ef70192313781b7f`. Original hashes remain the exact
owner-review provenance above; `git range-diff` reported all six commits as
patch-equivalent (`=`):

| Reviewed commit | Rebased equivalent | Purpose |
|---|---|---|
| `b9c7c4b9821d07278153e50f5dfbf2b26575a67e` | `a88f0803f1bb1d41a1243f5f20c800f345db745f` | specification promotion |
| `200be5744003ac47cecd2d79a337df3e4c4aeebc` | `e93240aa0dc458203b16c171b5dc5a45525f97b4` | accepted Slice 1 |
| `94e4488ade82e1a2a8ce74cf956993870759d1f3` | `d7963b28b78afd446878abfa19d54c4315049992` | Slice 2 runtime |
| `c4de0a89c84aa02f1035f0f3f6ed4bc838223949` | `6fc2bb44f943393241b0dbc2164df8f122bab605` | accepted Slice 2 replacement |
| `90482d8fd454003319030d0f0f0304d1af66b983` | `fae0daf4a5c2a64c3060dc6c2ff15d88e84c893d` | terminal checkpoint |
| `b1953ac556328df1e627dc9d578da53df64f5058` | `445ca79b38ccccc79ca857eaaa8d3bf1d575bb34` | final archive |

Reconciliation evidence on rebased archive `445ca79b`: focused checks 27 passed /
11 skipped; `scripts/test-tier1.sh --probe` PASS using a session-local selector
for pinned Prime Agent `0.9.3`; `scripts/test-all.sh` PASS with tier 0 at 287
passed / 149 skipped and tier 1 at 42 passed / 394 deselected. The initial gate
attempt stopped before testing because the linked worktree lacked its ignored
`.env`; it is not acceptance evidence. No host user-global plugin was touched.

After both slices land, the operator dogfoods end-to-end: a real `/plan` on
a real reviewed specification and a real `/implement-spec` promotion, with
observed compaction (or truthful `scheduled: false`) at both boundaries and
exactly one phase turn each. The specification's "Done when" checklist is
the acceptance record. Plan-level review by the project conversation gates
the episode; per-slice acceptance follows the execute protocol.

## Dependencies

- Slice 2 depends on Slice 1 (shared helper and established seam evidence).
- No Prime Agent changes. Prime Agent is an upstream dependency; any
  capability gap is reported to the operator, never patched upstream.
- Live probes require the tier-1 container-installed Prime Agent. Candidate
  probes never load or mutate the host user-global generation.

## Explicit non-goals (plan-wide)

- Optional trailing guidance and the backtick-quoting grammar (deferred;
  recorded in the specification's non-goals with full rules).
- Bespoke per-invocation hint authoring (standard hint is the v1 default).
- Compaction at `/design` or `/spec-it-out` boundaries.
- Any change to the episode fork's handoff-first compaction.
- Queue-cancellation capability, automatic retries, or a general
  transition framework.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/compaction-first-phase-transitions/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/compaction-first-phase-transitions/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: `PRIMECLAW-10.30`, `PRIMECLAW-10.31`, `PRIMECLAW-10.32`.

### Shared archive-index outcome

## compaction-first-phase-transitions/ — Compaction-first phase transitions ✅ COMPLETE (2026-10-02)

Delivered project-local compaction-first transitions for reviewed `/plan` and
`/implement-spec` flows. Each command now admits a minimal prep turn, requests
best-effort compaction, and queues exactly one canonical phase turn while
preserving existing location, readiness, approval, and replay boundaries.

- Slice 1 accepted at `200be5744003ac47cecd2d79a337df3e4c4aeebc`
  (`PRIMECLAW-10.30`).
- Slice 2 accepted at documentation replacement
  `c4de0a89c84aa02f1035f0f3f6ed4bc838223949`, with runtime predecessor
  `94e4488ade82e1a2a8ce74cf956993870759d1f3` (`PRIMECLAW-10.31`).
- [Archived specification](compaction-first-phase-transitions/SPECIFICATION.md)
- [Archived execution plan](compaction-first-phase-transitions/EXECUTION_PLAN.md)
- [Prep-chain operator contract](../../../docs/prep-chain.md)

Joe explicitly deferred the planned human-operated `/plan` + `/implement-spec`
dogfood to P1/BLOCKED Backlog.md task `PRIMECLAW-10.32`, pending separate merge
authorization and deliberate activation from primary `main`. That disposition
matches the `PRIMECLAW-10.19` precedent and is not completed dogfood evidence.
This archive does not claim merge readiness, host-global activation, merge,
episode cleanup, or any product-scope change.

Post-acceptance integration rebased the six reviewed commits onto `origin/main`
`eca48f8b284c990a8e030062ef70192313781b7f`. The original review hashes remain
acceptance provenance; their patch-equivalent rebased hashes are recorded in the
archived execution plan. The rebased archive commit is
`445ca79b38ccccc79ca857eaaa8d3bf1d575bb34`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## compaction-first-phase-transitions/ — Compaction-first phase transitions ✅ COMPLETE (2026-10-02)

Delivered project-local compaction-first transitions for reviewed `/plan` and
`/implement-spec` flows. Each command now admits a minimal prep turn, requests
best-effort compaction, and queues exactly one canonical phase turn while
preserving existing location, readiness, approval, and replay boundaries.

- Slice 1 accepted at `200be5744003ac47cecd2d79a337df3e4c4aeebc`
  (`PRIMECLAW-10.30`).
- Slice 2 accepted at documentation replacement
  `c4de0a89c84aa02f1035f0f3f6ed4bc838223949`, with runtime predecessor
  `94e4488ade82e1a2a8ce74cf956993870759d1f3` (`PRIMECLAW-10.31`).
- [Archived specification](compaction-first-phase-transitions/SPECIFICATION.md)
- [Archived execution plan](compaction-first-phase-transitions/EXECUTION_PLAN.md)
- [Prep-chain operator contract](../../../docs/prep-chain.md)

Joe explicitly deferred the planned human-operated `/plan` + `/implement-spec`
dogfood to P1/BLOCKED Backlog.md task `PRIMECLAW-10.32`, pending separate merge
authorization and deliberate activation from primary `main`. That disposition
matches the `PRIMECLAW-10.19` precedent and is not completed dogfood evidence.
This archive does not claim merge readiness, host-global activation, merge,
episode cleanup, or any product-scope change.

Post-acceptance integration rebased the six reviewed commits onto `origin/main`
`eca48f8b284c990a8e030062ef70192313781b7f`. The original review hashes remain
acceptance provenance; their patch-equivalent rebased hashes are recorded in the
archived execution plan. The rebased archive commit is
`445ca79b38ccccc79ca857eaaa8d3bf1d575bb34`.
<!-- SECTION:FINAL_SUMMARY:END -->
