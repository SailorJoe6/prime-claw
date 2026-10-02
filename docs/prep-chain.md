# Ralph phase prep chain

> **Status:** Phase 4 dogfood automation. Native `/plan`, the explicit
> `ralph_plan` tool, and native `/implement-spec` admit their project-local prep
> policy before the canonical phase workflow.
> **Beads:** `prime-claw-h6w.26` → `prime-claw-h6w.27`

prime-claw uses a two-message admission seam when a phase transition benefits
from a fresh context window:

```text
operator /plan <future-folder>
  → project-local plan-prep turn
  → best-effort focused compaction at the turn boundary
  → canonical plan as the sole queued follow-up

operator /implement-spec <future-folder>
  → project-local implement-prep turn
  → best-effort focused compaction at the turn boundary
  → canonical implement-spec as the sole queued follow-up
```

The extension owns only deterministic mechanics. The project-local Markdown
owns every model instruction, including the readiness sniff, fixed compaction
hint, exactly-once `compact.run()` call, and result wording.

- Mechanics: [`prep-chain.ts`](../src/prime-agent-plugin/extension-support/prep-chain.ts)
- Entry surfaces: [`reviewed-plan.ts`](../src/prime-agent-plugin/extensions/reviewed-plan.ts)
- Planning prep policy: [`plan-prep/SKILL.md`](../.ralph/skills/plan-prep/SKILL.md)
- Planning phase policy: [`plan/SKILL.md`](../.ralph/skills/plan/SKILL.md)
- Promotion prep policy: [`implement-prep/SKILL.md`](../.ralph/skills/implement-prep/SKILL.md)
- Promotion phase policy: [`implement-spec/SKILL.md`](../.ralph/skills/implement-spec/SKILL.md)

This is the phase-boundary counterpart to the proven
[handoff chain](handoff-chain.md). It does not create a general transition
framework and does not make compaction the continuation trigger.

## Admission contract

All three entry surfaces keep the existing exact
`.ralph/plans/future/<slug>` validation and location envelope.

| Entry | First message | Second message |
|---|---|---|
| Native `/plan <folder>` | wrapped `plan-prep`, ordinary delivery | wrapped `plan`, sole `followUp` |
| `ralph_plan({location})` | wrapped `plan-prep`, `steer` delivery | wrapped `plan`, sole `followUp` |
| Native `/implement-spec <folder>` | wrapped `implement-prep`, ordinary delivery | wrapped `implement-spec`, sole `followUp` |

Each phase prompt remains the same wrapped project-local canonical skill and
location envelope used before the prep chain. Its prep prompt uses the same
exact envelope. `ralph_plan` still accepts only `location`; planning never
records implementation approval or creates an episode. There is no
conversational implementation tool: implementation promotion remains the
explicit native `/implement-spec` boundary.

The planning tool runs while an agent is streaming, so its prep message is
`steer`. Native command handling admits prep as an ordinary message. All three
surfaces queue their canonical phase once with `deliverAs: "followUp"` at the
same admission boundary. No compaction event can enqueue another phase turn.

## Fail-closed preflight and partial-send failures

Before either message is sent, the host:

1. validates the exact future folder using `validateFutureLocation()`;
2. loads the selected phase's prep skill (`plan-prep` or `implement-prep`); and
3. loads its canonical phase skill (`plan` or `implement-spec`).

A missing file or invalid location produces a warning and zero messages. This
is intentionally fail closed. `/implement-spec` also performs the existing
conversation-promotion identity preflight before either message is sent.
Projects must install both project-local skills for the selected phase.

Message transport can still fail after preflight. A first-send failure reports
that prep was not admitted. A second-send failure truthfully reports that prep
was admitted but the canonical follow-up was not queued and the transition is
incomplete. The plugin does not reconstruct, retry, infer completion, or arm
implementation approval in either case.

## Prep-turn policy

`plan-prep` performs only a cheap readiness sniff: the selected folder exists
and has a readable, non-placeholder `SPECIFICATION.md`. An obvious failure skips
the compaction request but cannot cancel the already queued canonical plan;
`plan` remains responsible for the authoritative semantic readiness review.

When the planning sniff passes, `plan-prep` builds its fixed role-priming hint
from the exact selected folder and calls `compact.run(focus_hint)` once. The
hint preserves reviewed decisions, constraints, non-goals, durable artifacts
and beads, and the definite role this conversation will take to own and
supervise the implementation episode if the operator later approves promotion.

`implement-prep` performs the analogous cheap bundle-presence sniff: readable,
non-placeholder `SPECIFICATION.md` and `EXECUTION_PLAN.md`. Its fixed hint
preserves the approved bundle and primes the owner-supervision role that reviews
readiness, creates the isolated episode, and supervises its slices. The queued
canonical `implement-spec` skill still performs the authoritative semantic
review and is the only workflow allowed to call `create_spec_episode`.

The immediate return is deliberately narrow:

- `scheduled: true` means compaction was requested for the turn boundary; it is
  not confirmation that compaction completed;
- `scheduled: false` reports the bounded reason and does not cancel the queued phase;
- an exception reports request failure without raw provider data and does not
  cancel the queued phase.

Each prep turn outputs only Status / Evidence / Next Step and ends. It does not
run `prepare`; the canonical phase skill runs `prepare` after the context
boundary.

## Bounded implementation approval

The native `/implement-spec` admission records exact session and location
authority only after both messages have been accepted by the transport. The
record includes a one-deep `agent_end` skip. The prep turn's `agent_end`
consumes that skip while retaining the exact approval for the queued canonical
turn. The approval is not usable before that boundary. The next `agent_end`
clears it. Repeated admissions overwrite the same
one-bit state; they cannot accumulate extra lifetime.

`create_spec_episode` still requires exact session and location equality and
consumes approval before readiness checks or host mutation, including when the
later operation fails. `session_start` and `session_shutdown` clear approval
immediately. A cancelled chain has no queue callback to revoke authority
instantly; after the prep end consumes the sole skip, the next `agent_end`
clears the orphan. No approval is written for invalid input, failed identity
preflight, missing skills, a failed prep send, or a failed follow-up send.

## Boundaries

- No optional per-invocation guidance in v1.
- No bespoke hint authored in TypeScript.
- No changes to `/design`, `/spec-it-out`, or episode-fork compaction.
- No queue cancellation, late compaction listener, or automatic retry.
- No conversational `/implement-spec` tool and no durable approval, lease,
  nonce, counter, timer, or turn-start prompt recognition.
- The captured-runtime limitation tracked by `prime-claw-f81.3` applies to the
  conversational tool path as it does to `ralph_handoff`; this slice does not
  expand that boundary.

## Verification

Plugin development and pre-merge validation are Docker tier 1 only. Never
apply, check, or probe a candidate against the host user-global
`~/.prime/agent`. The tier-1 driver and pytest fixture install the candidate
against the explicit container-local `/root/.prime/agent`, run the checks and
probes there, and destroy the container afterwards.

```sh
python3 -m pytest tests/ -q -m container
scripts/test-tier1.sh --probe
scripts/test-all.sh
```

The container-marked reviewed-plan coverage includes behavioral native `/plan`
and `/implement-spec` probes against the installed container generation. They
distinguish a truthful bounded compaction skip from confirmed compaction, prove
exactly one prep prompt and one canonical phase prompt, and exit without an
unexpected model call. The implementation probe additionally proves that the
container runtime's intervening `agent_end` preserves approval for one
successful `create_spec_episode` tool call through a controlled dependency.
`scripts/test-tier1.sh --probe` independently proves that the container-installed
command generation loads from `/root/.prime/agent`.
