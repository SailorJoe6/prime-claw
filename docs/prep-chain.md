# Ralph phase prep chain

> **Status:** Phase 4 dogfood automation. Native `/plan` and the explicit
> `ralph_plan` tool admit project-local `plan-prep` before canonical `plan`.
> `/implement-spec` remains on its direct workflow until the separately reviewed
> second slice lands.
> **Beads:** `prime-claw-h6w.26` → `prime-claw-h6w.27`

prime-claw uses a two-message admission seam when a phase transition benefits
from a fresh context window:

```text
operator /plan <future-folder>
  → project-local plan-prep turn
  → best-effort focused compaction at the turn boundary
  → canonical plan as the sole queued follow-up
```

The extension owns only deterministic mechanics. The project-local Markdown
owns every model instruction, including the readiness sniff, fixed compaction
hint, exactly-once `compact.run()` call, and result wording.

- Mechanics: [`prep-chain.ts`](../src/prime-agent-plugin/extension-support/prep-chain.ts)
- Entry surfaces: [`reviewed-plan.ts`](../src/prime-agent-plugin/extensions/reviewed-plan.ts)
- Prep policy: [`plan-prep/SKILL.md`](../.ralph/skills/plan-prep/SKILL.md)
- Phase policy: [`plan/SKILL.md`](../.ralph/skills/plan/SKILL.md)

This is the planning-boundary counterpart to the proven
[handoff chain](handoff-chain.md). It does not create a general transition
framework and does not make compaction the continuation trigger.

## Admission contract

Both entry surfaces keep the existing exact
`.ralph/plans/future/<slug>` validation and location envelope.

| Entry | First message | Second message |
|---|---|---|
| Native `/plan <folder>` | wrapped `plan-prep`, ordinary delivery | wrapped `plan`, sole `followUp` |
| `ralph_plan({location})` | wrapped `plan-prep`, `steer` delivery | wrapped `plan`, sole `followUp` |

The phase prompt remains the same wrapped project-local `plan` skill and
`<operator-plan-location>` envelope that direct planning used. The prep prompt
uses the same exact location envelope. `ralph_plan` still accepts only
`location`; planning never records implementation approval or creates an
episode.

The tool runs while an agent is streaming, so its prep message is `steer`.
Native command handling admits prep as an ordinary message. In both cases the
canonical plan is queued once with `deliverAs: "followUp"` at the same admission
boundary. No compaction event can enqueue another plan turn.

## Fail-closed preflight and partial-send failures

Before either message is sent, the host:

1. validates the exact future folder using `validateFutureLocation()`;
2. loads `.ralph/skills/plan-prep/SKILL.md`; and
3. loads `.ralph/skills/plan/SKILL.md`.

A missing file or invalid location produces a warning and zero messages. This
is intentionally fail closed. Projects must install both project-local skills
before the new generation can plan.

Message transport can still fail after preflight. A first-send failure reports
that plan-prep was not admitted. A second-send failure truthfully reports that
prep was admitted but the plan follow-up was not queued and the transition is
incomplete. The plugin does not reconstruct, retry, or infer completion in
either case.

## Prep-turn policy

`plan-prep` performs only a cheap readiness sniff: the selected folder exists
and has a readable, non-placeholder `SPECIFICATION.md`. An obvious failure skips
the compaction request but cannot cancel the already queued canonical plan;
`plan` remains responsible for the authoritative semantic readiness review.

When the sniff passes, the skill builds the fixed role-priming hint from the
exact selected folder and calls `compact.run(focus_hint)` once. The hint
preserves reviewed decisions, constraints, non-goals, durable artifacts and
beads, and the definite role this conversation will take to own and supervise
the implementation episode if the operator later approves promotion.

The immediate return is deliberately narrow:

- `scheduled: true` means compaction was requested for the turn boundary; it is
  not confirmation that compaction completed;
- `scheduled: false` reports the bounded reason and does not cancel planning;
- an exception reports request failure without raw provider data and does not
  cancel planning.

The prep turn outputs only Status / Evidence / Next Step and ends. It does not
run `prepare`; canonical `plan` runs `prepare` after the context boundary.

## Boundaries

- No optional per-invocation guidance in v1.
- No bespoke hint authored in TypeScript.
- No changes to `/design`, `/spec-it-out`, or episode-fork compaction.
- No queue cancellation, late compaction listener, or automatic retry.
- `/implement-spec` and its approval lifetime are unchanged by this slice.
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

The container-marked reviewed-plan coverage includes a behavioral native
`/plan` probe against the installed container generation. It distinguishes a
truthful bounded compaction skip from confirmed compaction, proves exactly one
`plan-prep` prompt and one canonical `plan` prompt, and exits with no remaining
follow-up. `scripts/test-tier1.sh --probe` independently proves that the
container-installed command generation loads from `/root/.prime/agent`.
