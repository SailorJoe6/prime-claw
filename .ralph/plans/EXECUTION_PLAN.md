# Execution Plan — Compaction-first phase transitions

> **Status:** DRAFT — pending operator plan review.
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

### Explicit non-goals

No `/implement-spec` changes (Slice 2), no guidance argument, no bespoke
hint authoring, no queue-cancellation capability, no retries, no changes to
`/design` or `/spec-it-out`.

## Slice 2 — Compaction-first `/implement-spec` and the approval-token fix

**Bead:** `prime-claw-h6w.27` — **Depends on:** Slice 1 accepted by the
project conversation.

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
- A live probe through `scripts/run-prime-agent-probe.sh` proves the full
  chain on installed Prime Agent: prep turn, requested compaction, exactly
  one implement-spec turn, successful episode creation (or its truthful
  existing-identity return), empty queue at end.
- Plugin apply/check + fresh startup probe, same as Slice 1.
- Run the same focused and full suites as Slice 1; `git diff --check`.
- Bead `prime-claw-h6w.27` updated with commit and evidence.

### Explicit non-goals

No conversational `/implement-spec` tool (none exists; `create_spec_episode`
is not an entry surface and is unchanged), no turn-start re-arm unless
Decision 1 is falsified by probe, no changes to the episode fork's existing
handoff-first compaction, no multi-project template installation (universal
agent's job, Phase 4 narrative).

## Final review and delivery gate

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
- Live probes require the installed Prime Agent and
  `scripts/run-prime-agent-probe.sh` isolation.

## Explicit non-goals (plan-wide)

- Optional trailing guidance and the backtick-quoting grammar (deferred;
  recorded in the specification's non-goals with full rules).
- Bespoke per-invocation hint authoring (standard hint is the v1 default).
- Compaction at `/design` or `/spec-it-out` boundaries.
- Any change to the episode fork's handoff-first compaction.
- Queue-cancellation capability, automatic retries, or a general
  transition framework.
