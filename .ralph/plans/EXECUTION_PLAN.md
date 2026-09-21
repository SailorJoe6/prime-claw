# Execution Plan — Handoff continuation resilience

> **Status:** operator approved for implementation through native `/implement-spec`.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Future bundle:** `.ralph/plans/future/handoff-continuation-resilience/`
> **Manual oversight record:** `prime-claw-h6w.11`

## Outcome

Make native `/handoff` queue canonical `execute` independently of whether the
best-effort compaction request succeeds, is unnecessary, is refused, is
cancelled, or fails. One handoff must not knowingly admit a second execute pass
from a late or repeated compaction signal.

Deliver this as one bounded implementation slice. Do not add conversational
routing or a general transition framework.

## Current-state audit

The current extension:

1. records the session UUID in `pendingExecuteBySession`;
2. injects canonical handoff Markdown;
3. waits for `session_compact`; and
4. only then consumes pending state and injects canonical execute Markdown.

A short session makes `compact.run()` return `scheduled: false`, so no
`session_compact` event occurs and execute never starts.

Prime Agent 0.9.5 already provides the smaller seam needed for this fix:

- `pi.sendUserMessage(..., { deliverAs: "followUp" })` queues a user message
  after the current agent finishes its tools;
- requested compaction runs at the current turn boundary;
- the host has queue and post-compaction continuation machinery, but survival
  across cancellation paths varies by client and must be characterized; and
- native runtime events and errors provide terminal compaction evidence that the
  extension cannot fully classify from `session_compact` alone.

The smallest candidate design is therefore to load both canonical skills during
native command admission, start the handoff turn, and queue canonical execute
once as a follow-up. Compaction remains inside the handoff workflow but no
longer owns execute admission. The `session_compact` hook must not inject
execute.

Invoking native `/handoff` is the approval to queue execute. The extension does
not infer revocation from a missing compaction event. Explicit queued-message
removal or session termination/replacement cancels the transition; native client
interrupt behavior is documented rather than reinterpreted by the plugin.

Before implementation commits to this design, a focused characterization must
confirm the installed runtime ordering for queued follow-up delivery across the
required outcomes and supported client paths. If compaction-only cancellation or
failure discards the follow-up when delivery otherwise remains feasible, the
public follow-up mechanism does not satisfy the specification: stop and return
the evidence to the owner. Do not introduce a Python bridge, durable state
machine, recovery command, private-runtime patch, or inferred-cancellation layer
as an unreviewed fallback.

## One vertical slice

### 1. Characterize the supported seam

Add the smallest focused fixture or disposable-runtime proof needed to confirm:

- canonical handoff is admitted before canonical execute;
- execute queued as `followUp` waits until the handoff tool turn ends;
- `compact.run()` returning `scheduled: false` does not strand the follow-up;
- requested compaction success resumes the same queued follow-up afterward;
- `session_before_compact` cancellation and summarizer failure preserve the
  follow-up when execute delivery remains feasible;
- operator interruption behavior is recorded separately for the TUI and ACP or
  daemon path rather than treated as a compaction result;
- explicit queued-message removal and session termination/replacement do not
  reconstruct or retry execute; and
- one queued follow-up produces one execute admission.

Prefer the installed public API and persisted session evidence. Do not test by
patching Prime Agent private fields.

### 2. Make execute admission independent

Update `.prime/agent/extensions/handoff-chain.ts` to:

- keep native `/handoff`, canonical skill loading, optional guidance wrapping,
  fixed execute routing, and legacy-marker cleanup;
- preflight both canonical handoff and execute Markdown before starting the
  transition;
- inject canonical handoff first;
- queue canonical execute once with explicit `deliverAs: "followUp"`;
- remove the compaction-triggered execute path and the in-memory pending set;
- use `session_compact` only for successful-compaction evidence if useful, never
  to admit execute or infer the meaning of its absence;
- make a missing skill or follow-up delivery failure visible without claiming
  success; and
- leave inline slash-command parsing and root/RLM-child shared-runtime delivery
  outside this change.

Late or repeated compaction events then have no path that can admit another
execute pass.

### 3. Make status truthful

Update `.ralph/skills/handoff/SKILL.md` only enough to:

- retain durable handoff preparation and focus-hint behavior;
- inspect the immediate `compact.run(focus_hint)` result;
- distinguish “compaction requested” from “compaction confirmed”;
- report a refusal reason without treating it as a workflow failure;
- state that execute is already queued independently; and
- avoid invoking or reproducing canonical execute itself.

Let Prime Agent's native client surface report later success, cancellation, or
failure. The project extension must not infer a terminal category from absence of
`session_compact`, and it must not add a reporting bridge merely to restate host
events.

### 4. Replace focused regressions

Update `tests/handoff_chain_extension.test.mjs` to cover:

- native command registration and lifecycle cleanup;
- no-guidance and exact trailing-guidance prompts;
- handoff followed by one explicit `followUp` execute message;
- execute being queued before any simulated compaction event;
- compaction events never admitting execute, with late and repeated success
  events producing nothing additional;
- missing handoff or execute Markdown failing before a partial transition;
- visible follow-up queue failure; and
- the separately tracked shared-runtime limitation remaining explicit.

Update `tests/test_handoff_chain_extension.py` to keep the real offline command
registration smoke and to enforce the revised handoff-skill status contract.
Remove tests whose only purpose was the obsolete pending-session set.

### 5. Update operator documentation

Revise `docs/handoff-chain.md` to describe:

- execute follow-up admission at the native command boundary;
- compaction as best-effort context improvement rather than the trigger;
- short-session, compaction-only cancellation, failure, and client interrupt
  behavior;
- explicit queued-message removal or session termination/replacement as the
  cancellation boundary;
- the absence of a retry/reload recovery requirement for compaction alone;
- prevention of additional execute admission from late/repeated signals; and
- the unchanged `prime-claw-f81.3` shared-runtime delivery limitation.

Change `VISION.md` or `LONG_RANGE_PLAN.md` only if implementation evidence shows
their high-level descriptions are false. Do not edit them merely to restate the
mechanism.

### 6. Prove, record, and stop

Run:

```text
node --experimental-strip-types --test tests/handoff_chain_extension.test.mjs
pytest -q tests/test_handoff_chain_extension.py
pytest -q tests
git diff --check
```

In a disposable supported top-level session, record persisted evidence for:

- a short-session/no-compaction handoff followed by execute;
- a successful focused compaction followed by execute; and
- `session_before_compact` cancellation followed by execute when delivery
  remains feasible;
- summarizer failure followed by execute when delivery remains feasible;
- operator interruption in each supported client path, recording whether native
  behavior keeps or drops the queued follow-up; and
- explicit queue removal or session termination/replacement without plugin retry.

Inspect persisted JSONL and queue evidence. Verify that each non-cancelled
admitted handoff produces one execute prompt and no late/repeated successful
compaction event produces another. Do not claim root/RLM-child isolation from
this evidence.

Update `prime-claw-h6w.11` with the exact commit, tests, runtime evidence,
limitations, and manual oversight lessons. Commit and push the complete slice,
then stop for owner review with a clean episode worktree.

## Dependencies and stop conditions

- The operator must approve this plan before `/implement-spec`.
- Implementation occurs only in the worktree and session created by native
  `/implement-spec`.
- The prior abandoned episode identity and branch must not be reused.
- `prime-claw-f81.3` remains separate and does not block the supported
  top-level-sibling proof.
- If follow-up ordering is not supported as audited, or real runtime evidence
  contradicts the candidate design, stop before adding infrastructure and return
  a concise revise-plan packet.

## Non-goals

This slice does not add:

- conversational command invocation;
- a Python-backed handoff adapter or finalizer;
- a bridge protocol or durable transition journal;
- strict distributed exactly-once guarantees;
- human recovery for compaction problems;
- arbitrary follow-on phase selection;
- root/RLM-child shared-runtime isolation; or
- autonomous episode orchestration.

## Review gate

Planning creates no branch, worktree, or episode. After reviewing this plan, the
operator may request revisions or separately invoke:

```text
/implement-spec .ralph/plans/future/handoff-continuation-resilience
```
