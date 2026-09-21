# Execution Plan — Handoff continuation resilience

> **Status:** implemented, final-Expert reviewed, operator approved, and merged.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Promoted from:** `.ralph/plans/future/handoff-continuation-resilience/`
> **Implementation commit:** `f89f121f2eba21d06d0bf89c220d38d0c32cc1ae`
> **Manual oversight record:** `prime-claw-h6w.11`

## Outcome

Make native `/handoff` queue canonical `execute` independently of whether the
best-effort compaction request succeeds, is unnecessary, is refused, is
cancelled, or fails. One handoff must not knowingly admit a second execute pass
from a late or repeated compaction signal.

Deliver this as one bounded implementation slice. Do not add conversational
routing or a general transition framework.

## Implementation result

The minimal public-follow-up candidate passed the characterization stop gate and
was implemented as the bounded slice:

- native `/handoff` preflights both canonical workflow files;
- handoff is injected first and execute is admitted once with
  `deliverAs: "followUp"` at the command boundary;
- `session_compact` no longer admits execute and the pending-session set is gone;
- the handoff skill reports only the immediate compaction request state and does
  not invoke execute; and
- operator documentation now treats queue removal or session termination as the
  cancellation boundary.

Disposable Prime Agent 0.9.5 RPC sessions loaded the revised real extension and
proved one completed execute marker with an empty final queue for:

| Path | Session | Evidence |
|---|---|---|
| short / no compaction | `01a0c54f-86c0-7452-b793-c5815fc483b7` | `scheduled: false`; one execute follow-up completed |
| requested success | `01a0c54f-8680-7749-a1c8-3907c252f4d1` | successful `compaction_end`; one execute follow-up completed |
| requested cancellation | `01a0c54f-8639-735c-9e5f-7fa1df1e2a9f` | `compaction_end` with `aborted: true`; one execute follow-up completed |
| requested failure | `01a0c54f-8661-7128-8665-3e135f1a5efb` | bounded synthetic failure surfaced; one execute follow-up completed |

Each persisted session recorded exactly one execute-marker user start and one
exact assistant completion. Supported top-level evidence does not claim
root/RLM-child isolation, which remains tracked by `prime-claw-f81.3`.

Public interruption and lifecycle evidence:

| Public path | Evidence | Observed result |
|---|---|---|
| compaction-only cancellation | session `01a0c54f-8639-735c-9e5f-7fa1df1e2a9f` used `session_before_compact` cancellation | compaction recorded `aborted: true`; execute completed once |
| TUI whole-turn interrupt | tmux TUI session `01a0c573-211f-745c-ad79-474a273f53d6`; named `C-c` while bash visibly ran | tool aborted; one later submit completed handoff; execute marker count stayed zero and runtime queue was empty |
| ACP whole-turn cancel | ACP session `9348763c-5a36-449e-852b-4ae87a52a90f` used `session/cancel` during the running tool | handoff returned `cancelled`; a later accepted prompt completed; execute marker count stayed zero |
| ACP close and replacement | ACP session `8a8bc10e-2142-4f4d-9079-9990442b8d94` was closed during the tool, then replacement `f8e8a912-f9d8-48ac-8bf7-905e60c8acba` completed | execute marker count stayed zero; plugin did not reconstruct or retry in the replacement session |

These results distinguish compaction-only cancellation, which preserves the
native follow-up, from supported whole-turn TUI/ACP interruption, which removes
it. The plugin has no reconstruction path and did not retry after either
whole-turn cancellation or session replacement.

One public-surface limitation remains disclosed. Prime Agent's TUI documents
Alt+Up followed by an empty edit as explicit queued-message deletion, but named
`M-Up` was not observable through the noninteractive tmux transport even after a
fresh `csi-u` negotiation. ACP and RPC expose no direct queue-removal request,
and daemon `prime-agent send` delivers an agent message rather than invoking
native slash-command dispatch. Two fresh exact-commit EXPERT reviews adjudicated
this as nonblocking: the host gesture is documented, the plugin has no
reconstruction path, and the real TUI/ACP cancellation evidence independently
proves that removed continuation is not retried. No private-field test or new
infrastructure was added.

Final integrated-candidate validation:

- focused Node extension suite: 9 passed;
- focused Python bridge and installed-loader suite: 4 passed;
- active repository suite `pytest -q tests`: 247 passed; and
- `git diff --check` passed.

Root `pytest -q` additionally collected retired broken tests under
`scripts/archive/phase1` (253 passed, 36 failed, 10 errors). The final EXPERT
adjudicated that result as pre-existing test-discovery debt rather than a
candidate regression; the supported active suite was fully green.

## Pre-implementation audit (historical)

Before this slice, the extension:

1. records the session UUID in `pendingExecuteBySession`;
2. injects canonical handoff Markdown;
3. waits for `session_compact`; and
4. only then consumes pending state and injects canonical execute Markdown.

In that design, a short session made `compact.run()` return
`scheduled: false`, so no `session_compact` event occurred and execute never
started.

Prime Agent 0.9.5 already provided the smaller seam needed for this fix:

- `pi.sendUserMessage(..., { deliverAs: "followUp" })` queues a user message
  after the current agent finishes its tools;
- requested compaction runs at the current turn boundary;
- the host has queue and post-compaction continuation machinery, but survival
  across cancellation paths varies by client and must be characterized; and
- native runtime events and errors provide terminal compaction evidence that the
  extension cannot fully classify from `session_compact` alone.

The smallest candidate design was therefore to load both canonical skills during
native command admission, start the handoff turn, and queue canonical execute
once as a follow-up. Compaction would remain inside the handoff workflow but no
longer own execute admission. The `session_compact` hook would not inject
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
