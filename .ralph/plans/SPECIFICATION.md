# Compaction-First Phase Transitions (`/plan`, `/implement-spec`)

> Status: APPROVED — Slice 1 accepted; Slice 2 candidate ready for owner review.
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
