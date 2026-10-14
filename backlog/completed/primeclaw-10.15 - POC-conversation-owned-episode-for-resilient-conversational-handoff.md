---
id: PRIMECLAW-10.15
title: POC conversation-owned episode for resilient conversational handoff
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
updated_date: '2026-10-14 02:50'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
references:
  - >-
    .ralph/plans/archive/handoff-continuation-resilience/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/handoff-continuation-resilience/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
parent_task_id: PRIMECLAW-10
priority: p1
type: epic
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Manually dogfood the incubated CONVERSATION→EPISODE oversight workflow while implementing the approved future specification at .ralph/plans/future/handoff-resilience-and-conversational-routing. The owning conversation reviews exact commits and controls transitions; implementation occurs only in a dedicated worktree and sibling Prime Agent session.

## Legacy design

Operator-confirmed POC. One conversation owns one isolated episode. Use a dedicated branch/worktree/session, bounded slices, verified task and command admission, commit-bound evidence, independent EXPERT review at specification/plan/final gates and triggered risky slices, merge only after operator approval, then safe cleanup. Record observed workflow lessons and route accepted durable findings back into the oversight specification.

## Legacy notes

POC CHARTER (operator-confirmed; 2026-09-20)
Owner conversation session: 01a0ba54-da05-76bd-8d22-a0facfdd7f31
Admitted specification commit: a93c27c
Specification: .ralph/plans/future/handoff-resilience-and-conversational-routing/
Current gate: specification EXPERT review
Episode identity/session/branch/worktree: not allocated; requires operator approval after specification gate
Authority: Joe oversees all lifecycle decisions. The conversation may inspect and propose but must obtain operator confirmation before episode allocation/admission, plan acceptance, material finding disposition, merge, and cleanup.
Isolation: implementation must occur in a new dedicated worktree and daemon-managed sibling session; this canonical checkout and unrelated dirty work are out of scope.
Evidence: exact commits, tests, admission receipts, review reports, and observed manual-workflow lessons will be recorded before transitions.

SPECIFICATION EXPERT REVIEW (commit a93c27c)
Reviewer invocation: sub-345dcd87 / session 01a0bc30-8d0c-776c-95b3-551f5ec73501
Verdict: REVISE (HR-SPEC-001 through HR-SPEC-008)
Preserved report: reports/reviews/handoff-resilience-spec-review-a93c27c.md
Report preservation commit: 11dc67e
Reviewer cleanup: report hash verified; reviewer deleted; roster absence verified.

OPERATOR ADJUDICATION OF PRE-PROMOTION ADVISORY REVIEW
Review status: advisory input, not an episode specification gate.
HR-SPEC-001: Remove anti-forgery/authentication requirement; bridge is model-controlled input. Retain validation only for correctness.
HR-SPEC-002: Does not block this top-level sibling POC. Shared root/RLM-child delivery remains separately tracked by prime-claw-f81.3; do not expand support claims.
HR-SPEC-003: Agent stopping is a workflow contract, not a hard runtime guarantee. handoff.run/finish is the final action and follow-up delivery is used.
HR-SPEC-004: Continuation is MUST unless infeasible; compaction is SHOULD. No missing-summary human gate. Rely on later Prime Agent auto-compaction.
HR-SPEC-005: Execute delivery must not depend on session_compact. Finalization queues canonical execute exactly once for success, refusal, cancellation, or failure; session_compact records evidence only.
HR-SPEC-006: No human recovery command or RECOVERY_REQUIRED state for compaction problems. Recovery is automatic; human intervention only when continuation itself is infeasible.
HR-SPEC-007: The user is authoritative. Materially inferred focus is confirmed with the user; confirmed intent is trusted and durable artifacts are updated to preserve it.
HR-SPEC-008: Deterministically minimize exception data to bounded allowlisted fields and omit traceback/locals/arbitrary fields. The agent is instructed to redact suspected sensitive content from the bounded message. Do not claim deterministic secret removal from arbitrary exception text.
Next authorized transition: allocate isolated episode and admit specification revision only.

EPISODE ALLOCATION
Episode identity: ep-handoff-resilience-20260920-01
Owner conversation: 01a0ba54-da05-76bd-8d22-a0facfdd7f31
Active sibling session: 01a0bf8a-34de-70e7-9305-50929c9c6a26
Branch: poc/handoff-resilience-episode
Worktree: /Users/jlanders/code/prime-claw-handoff-resilience-episode
Base commit: 11dc67ee322ffb4bf195da4e81d7ed43b0fd2a65
Authority: operator-confirmed
Current gate: promoted active specification revision
Admitted work generation: ep-handoff-resilience-20260920-01/spec-revision-001
Expected packet: pushed exact commit containing only promotion/revision of the active spec bundle and necessary cross-spec compatibility updates; no plan or implementation.
Known base condition: root .ralph/plans/DECISIONS.md and REQUIREMENTS.md coexist with blocked/SPECIFICATION.md and blocked/EXECUTION_PLAN.md. Episode must inspect and preserve that prior blocked bundle rather than overwrite it.
Task admission evidence: sibling transcript custom_message persisted at 2026-09-20T15:58:53.428Z; episode began inspecting the admitted spec task at 2026-09-20T15:59:01.904Z.
Owner watch: heartbeat d5c6ba1d-f72d-45d4-bfc3-b99a874a61ba (`handoff-spec-revision-watch`), 15-minute follow-up cadence, scoped to spec-revision-001; must disarm after reconciliation.

SPEC-REVISION-001 EVIDENCE RECONCILIATION
Episode packet received for pushed commit 83398d9a50f52ef302570aad41ef4b9c1f4417cc; local HEAD and origin branch match; worktree clean.
Owner watch d5c6ba1d-f72d-45d4-bfc3-b99a874a61ba cancelled before review; no recurring poll remains.
Independent checks: 30 local links resolved; active 43/43 requirements covered by 15/15 decisions; oversight requirement references resolve; blocked prior requirements/decisions match old root blobs byte-for-byte; git diff --check passed.
Owner finding OWNER-SPEC-001 (medium): the episode edited the preserved point-in-time EXPERT report to reclassify it. Classification belongs in the active spec/bead, while the preserved report should remain immutable. Acceptance: restore reports/reviews/handoff-resilience-spec-review-a93c27c.md byte-for-byte to commit 11dc67e and retain pre-promotion advisory classification in active spec/coordination state.
Owner gate recommendation: REVISE only for OWNER-SPEC-001; no other owner finding at this review.

ACTIVE SESSION REPLACEMENT — spec-revision-002
Original episode session 01a0bf8a-34de-70e7-9305-50929c9c6a26 resumed on 2026-09-21 with CWD incorrectly rebound to `/Users/jlanders/code/prime-claw` (main). Owner sent an immediate stop before permitting mutation. Canonical main status was inspected; no correction work was accepted there.
Logical episode identity, branch, and worktree remain unchanged.
Replacement active session: 01a0c44e-cdda-72eb-a5fc-aea4d1a393d8
Replacement CWD verified by daemon roster: /Users/jlanders/code/prime-claw-handoff-resilience-episode
Replacement task requires exact CWD/branch/HEAD preflight before the single-file correction.
This is manual POC evidence for active-session replacement and CWD-boundary validation.

DE-PROMOTION AND MANUAL EPISODE RETIREMENT — 2026-09-21
Operator concluded the specification was promoted before interactive requirement review was complete. The newly landed reviewed future-plan workflow at `.ralph/plans/archive/worktree-isolated-specification-episodes/` is now authoritative for the next attempt.

Preserved work:
- Useful revisions from abandoned episode tip `e14f94d6e3eb12fcf7295fe20cd08d7292827ecf` were transferred back to `.ralph/plans/future/handoff-resilience-and-conversational-routing/`.
- Accepted compatibility updates were transferred to the future conversation-oversight bundle without losing the pre-existing local edits in its specification.
- Lifecycle language was returned to incubated/future status; native `/implement-spec` is the sole later promotion boundary.
- R-HR-6 was folded into R-HR-5; 42 remaining requirements are covered by decisions; local Markdown links resolve.
- Main commit `b89ab321314926961ea23f63145d16983eb7dda2` was pushed to `origin/main`.

Retired manual episode resources:
- logical episode `ep-handoff-resilience-20260920-01` is explicitly abandoned/de-promoted, not completed or merged;
- sessions `01a0bf8a-34de-70e7-9305-50929c9c6a26`, `01a0c44e-cdda-72eb-a5fc-aea4d1a393d8`, and `01a0c453-90b0-7312-8e12-3590508df0b9` were stopped through the daemon;
- worktree `/Users/jlanders/code/prime-claw-handoff-resilience-episode` was removed cleanly;
- local and remote branch `poc/handoff-resilience-episode` were deleted.

POC lesson: specification and requirement discussion stays in the canonical future folder through explicit operator specification approval; `/plan` follows that gate, and native `/implement-spec` alone allocates a new episode after separate plan approval. Do not manually promote a still-debated bundle.

SPECIFICATION SPLIT — 2026-09-21
Operator approved splitting the combined handoff-resilience-and-conversational-routing future bundle into two independent review and promotion units:
- `.ralph/plans/future/handoff-continuation-resilience/` — native handoff bug fix: best-effort compaction, mandatory exactly-once execute continuation, internal prepared finalizer, bounded diagnostics, lifecycle/runtime proof.
- `.ralph/plans/future/conversational-ralph-command-routing/` — opt-in conversational adapters for `/handoff`, `/plan`, and `/implement-spec`, preserving native operations and command-specific authority.

The old combined folder was removed. New identifiers are R-HC/D-HC and R-CR/D-CR. Each bundle includes split-provenance mapping and states that HR-SPEC-001..008 remain incorporated where applicable; the immutable a93c27c report is historical advisory evidence, not review approval of either split bundle.

Independent audit initially found two blockers in conversational `/implement-spec`: model-controlled input could self-assert approval, and a naive authorization would expire at adapter `agent_end` before the readiness follow-up. Final design requires extension-owned host UI confirmation, then a consume-once reservation bound to stable session + normalized folder + generation + exact queued readiness follow-up. The reservation survives only adapter `agent_end`, converts atomically to the existing exact-location one-turn arm when the expected next follow-up is admitted, and fails closed to native `/implement-spec` on unavailable/uncertain UI, missing/reordered/intervening follow-up, mismatch, reload, or shutdown. Final independent re-audit: PASS.

Validation: resilience 30/30 requirements decision-covered; routing 35/35; 22 local Markdown links resolve; contiguous IDs; git diff --check clean. Split committed and pushed on main as `cb2f5bd`.

No planning, implementation, worktree, branch, or episode was created. Both bundles remain incubated pending separate operator specification review.

BUFD CORRECTION — 2026-09-21
Operator identified that the split bundles had repeated the failed first attempt at the archived worktree-isolated specification episode: large up-front requirements/decisions catalogs created questionable obligations and pushed review toward speculative infrastructure. The successful second attempt used a specification and plan without separate requirements/decisions documents.

Both incubating bundles were simplified accordingly:
- deleted REQUIREMENTS.md and DECISIONS.md from `handoff-continuation-resilience` and `conversational-ralph-command-routing`;
- rewrote each SPECIFICATION.md around product problem, observable outcomes, scope/non-goals, compatibility/authority boundaries, acceptance examples, and open planning questions;
- removed binding Python-finalizer, bridge-protocol, authorization-reservation, generation-state, and other speculative architecture;
- resilience planning must choose the smallest implementation after a current-code/runtime audit;
- conversational `/implement-spec` may remain native-only if an equivalent trustworthy conversational approval path is not simple on supported APIs.

The simplification removed 823 lines and added 236 lean specification lines. Both specs have no formal R-/D- catalogs; all 7 local Markdown links resolve; git diff --check passed. Commit `bcaad53` pushed to main. No planning or episode resources created.

OVERSIGHT SPEC BUFD CORRECTION — 2026-09-21
Operator directed the same lean-spec lesson into `.ralph/plans/future/conversation-driven-episode-oversight/`, because future implementation of the two simplified bundles will itself be a manually driven oversight POC.

Changes:
- deleted oversight REQUIREMENTS.md and DECISIONS.md;
- reduced SPECIFICATION.md from 594 to 293 lines while preserving operator edits that UNIVERSAL_AGENT and PROJECT_CONTEXT are orientation only, PROJECT_CONVERSATION is the target, its session CWD is the canonical project root, and it owns at most one active episode in the first POC;
- aligned the lifecycle to the landed reviewed workflow: specification and planning remain in the project conversation, native `/implement-spec` alone allocates an execute-stage episode;
- replaced binding role manifests, leases, journals, registries, command-receipt protocols, autonomous authority, and exhaustive state/test matrices with a manual owner/episode/operator workflow and observations to collect;
- retained exact-commit review, one-slice stops, fresh advisory EXPERT use, active-work-only heartbeats, real native transitions, side-discussion isolation, safe merge/abandonment cleanup, and explicit operator authority;
- stated that repeated manual evidence must precede automation.

Validation: 3 local Markdown links resolve, no R-CO/D-CO catalogs remain, git diff --check passed. Commit `ede6f12` pushed to main. No planning or episode resources created.

HANDOFF DUPLICATE-ADMISSION CLARIFICATION — 2026-09-21
Operator reviewed the former at-most-once goal. Risk is duplicate autonomous execute admission from one handoff (for example fallback plus a late compaction event), which can repeat side effects or bypass the one-slice review boundary. The lean resilience spec now requires only that one admitted handoff not knowingly start multiple execute passes and that late/repeated known signals not start another pass. It explicitly does not promise mathematically strict exactly-once delivery across all crashes or uncertain transport outcomes and does not justify distributed exactly-once infrastructure. Commit `25b54d1` pushed to main.

PLANNING GATE — handoff-continuation-resilience — 2026-09-21
Operator invoked native `/plan .ralph/plans/future/handoff-continuation-resilience`, thereby approving the lean specification for planning only. Planning audited the current extension, canonical handoff skill, focused tests, docs, and installed Prime Agent 0.9.5 compact/follow-up behavior.

Operator cancellation decision: invoking `/handoff` authorizes the execute follow-up. Compaction refusal, cancellation, or failure does not revoke it. Explicit queued-message removal or session termination/replacement cancels the transition. The plugin does not infer intent from missing `session_compact` or client interruption.

Draft plan outcome: one bounded slice. Characterize public follow-up ordering first; candidate minimal design preflights both canonical skills, injects handoff, queues execute once with `{deliverAs: "followUp"}`, removes compaction-triggered execute admission and pending state, makes status truthful, replaces focused tests/docs, runs full regressions, and records disposable-runtime evidence. If compaction-only cancellation/failure drops the follow-up when delivery remains feasible, stop for plan revision rather than add a bridge/state machine/private patch.

Read-only plan audit initially BLOCKED on cancellation ambiguity and unsupported survival claims. After operator disposition and revision, final audit: PLAN PASS. Four local bundle links resolve; git diff --check clean. Specification clarification and draft `EXECUTION_PLAN.md` committed and pushed on main as `460a528`. No branch, worktree, or episode created. Next gate: operator plan review; `/implement-spec` remains unauthorized until explicit approval.

EXECUTE SLICE-SIZING GUARD — 2026-09-21
Before implementation promotion, operator audited the canonical execute skill. Its existing wording still required one constrained task within the context window, but did not explicitly name elephant carpaccio, avoidance of auto-compaction, or a clean single-purpose pushed commit. Updated `.ralph/skills/execute/SKILL.md` to require the smallest end-to-end valuable/evidentiary slice, complete implementation/tests/docs/bead/plan work within the current context without relying on auto-compaction, one clean single-purpose commit pushed for review, then stop without starting another slice. Added `tests/test_execute_skill.py` contract coverage (2 passed). Commit `09f5953` pushed to main. Broader `tests/test_future_plan_skills.py` currently has two unrelated failures caused by pre-existing dirty design/spec-it-out edits; those files were not touched.

IMPLEMENTATION PROMOTION — handoff-continuation-resilience — 2026-09-21
Operator invoked native `/implement-spec .ralph/plans/future/handoff-continuation-resilience`, explicitly approving the lean specification and reviewed plan for implementation. Approval statuses were committed and pushed on main as `fcd8fb3` before resource creation. Readiness review passed: coherent bounded outcome, one characterization-gated vertical slice, acceptance evidence, dependencies/stop conditions, explicit non-goals, no unresolved contradiction, and all 4 local links resolve.

Trusted `create_spec_episode` result:
- stable episode/session ID: `01a0c537-4a05-75be-a435-bf32b682d49b`
- active routing ID: `364b74f15ec2`
- session name: `handoff-continuation-resilience-episode`
- branch: `episode/handoff-continuation-resilience`
- worktree: `/Users/jlanders/code/prime-claw-handoff-continuation-resilience-episode`
- execute admission: `delivered`
- reused: false

Owner watch installed before yielding: heartbeat `68435228-2663-4bc0-a490-173db8a98038`, label `handoff-resilience-episode-watch`, 15-minute follow-up cadence. It observes without steering during active work and must be cancelled immediately after the first slice packet is reconciled. No handoff, approval, retry, merge, or cleanup is automatic. Next gate: exact-commit owner review of the episode's first bounded slice.

EXTENSION DISCOVERY STARTUP REPAIR — 2026-09-21
Operator reported that new Prime Agent TUIs failed in both canonical main and the active episode worktree because `.prime/agent/extensions/spec-episode.ts` and `reviewed-plan-support.ts` did not export extension factories. Root cause: Prime Agent 0.9.5 auto-discovers every top-level `.prime/agent/extensions/*.ts`; those two files were import-only helpers. Existing RPC coverage used `--no-extensions` and explicitly loaded `reviewed-plan.ts`, so it bypassed normal discovery and missed the failure.

Repair on main: moved both helpers to `.prime/agent/extension-support/`, updated imports/test references, and added a regression that dynamically imports every top-level auto-discovered extension and requires a default factory. Main fix `cb797d6` was pushed. Evidence: combined Node suites 35/35; Python bridge 7/7; real PTY TUI launch and `/quit` exit 0 with neither reported load error.

Safe episode propagation: owner did not mutate the active worktree. Episode agent stopped at a clean boundary with no repo edits, then rebased its own branch onto exact `cb797d6`. Rebased/pushed episode HEAD is `497f7efe6a8fe627966214cfbe9900d0c9d4e065`, tracking `origin/episode/handoff-continuation-resilience`, with main-fix ancestry confirmed. Episode independently repeated 35/35 Node, 7/7 Python, and successful real PTY TUI startup/quit without extension errors. Owner accepted the repair and released the temporary pause so the already-authorized first resilience slice can resume.
HANDOFF CONTINUATION RESILIENCE IMPLEMENTATION SLICE — 2026-09-21
Episode: 01a0c537-4a05-75be-a435-bf32b682d49b
Branch: episode/handoff-continuation-resilience
Worktree: /Users/jlanders/code/prime-claw-handoff-continuation-resilience-episode

The public follow-up candidate passed the plan stop gate. Native `/handoff` now preflights canonical handoff and execute, injects handoff first, and queues execute once with `deliverAs: "followUp"`; `session_compact` no longer admits execute and the pending-session set is removed. The handoff skill reports immediate compaction request state without waiting for an event or invoking execute. Operator docs define explicit queue removal/session replacement as cancellation and preserve the prime-claw-f81.3 shared-runtime limitation.

Disposable real-extension RPC evidence:
- short/no compaction session 01a0c54f-86c0-7452-b793-c5815fc483b7;
- success session 01a0c54f-8680-7749-a1c8-3907c252f4d1;
- cancellation session 01a0c54f-8639-735c-9e5f-7fa1df1e2a9f;
- bounded failure session 01a0c54f-8661-7128-8665-3e135f1a5efb.
Each recorded exactly one execute-marker user start, one exact assistant completion, and an empty final queue.

Tests: focused Node 9 passed; focused Python 4 passed. Two full-suite attempts each passed 246 tests but hit different pre-existing candidate-progress watchdog timing failures. The first failed case passed alone; the complete watchdog file passed 24; all other tests passed 223; git diff check passed. Watchdog code remains out of scope.

Current gate: one single-purpose episode commit will be pushed immediately after this durable note, then the exact commit will be reported to the owner for review. Do not merge or begin another slice.
EXACT IMPLEMENTATION PACKET
Pushed commit: 8d8468bf2dc46a06f51956ce2792e53cb9117bcf
Local episode HEAD and origin/episode/handoff-continuation-resilience match this commit; worktree clean. Owner exact-commit review is now required before any merge or further slice.

OWNER EXACT-COMMIT RECONCILIATION — `8d8468bf2dc46a06f51956ce2792e53cb9117bcf` — 2026-09-21
Episode branch, remote, and clean worktree were independently reconciled. The commit descends from repaired base `cb797d6`. Owner reran `git diff --check`, focused Node (9/9), and focused Python (4/4), all passing. Disposable RPC logs under `/var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/prime-claw-handoff-runtime-2rkffoky` independently show exactly one execute user start, one exact `EXECUTE_PROBE_DELIVERED` assistant completion, and an empty final queue for short, successful compaction, compaction cancellation, and bounded synthetic compaction failure. The owner watch `68435228-2663-4bc0-a490-173db8a98038` was cancelled after reconciliation.

Approval is not inferred. Material review gap: execution-plan lines 119-122 and 219-221 required recorded evidence for operator interruption in supported TUI and ACP/daemon paths plus explicit queue removal and session termination/replacement. The commit documents conditional native behavior and has a unit lifecycle no-reconstruction check, but the implementation-result evidence lists only the four compaction outcomes. Also, the plan's `## Current-state audit` remains written in present tense about the obsolete pending-set implementation after the result section. Await operator disposition: request evidence/doc revision in the same slice or explicitly waive/narrow those acceptance items before approval. No merge, handoff, retry, or second slice was started.

OVERSIGHT ROLE CLARIFICATION — 2026-09-21
Operator clarified that PROJECT_CONVERSATION is not expected to idle for HITL approval between bounded episode slices. Native `/implement-spec` authorizes it to drive the complete reviewed spec and plan through all bounded implementation and same-slice revision work. Slice boundaries remain exact-commit evidence/control points; the EPISODE stops, but PROJECT_CONVERSATION independently reviews and promptly advances, revises, or invokes an intermediate EXPERT unless a real authority boundary, product decision, external blocker, explicit operator intervention, or terminal gate requires input.

PROJECT_CONVERSATION chooses intermediate EXPERT reviews by judgment. A fresh final EXPERT review of the complete exact merge candidate is mandatory regardless; material repairs invalidate it and require renewed final review. After final verification and EXPERT adjudication there is one required HITL gate before merge. Implementation authorization never implies merge, scope expansion, abandonment, or destructive cleanup authority. Updated `.ralph/plans/future/conversation-driven-episode-oversight/SPECIFICATION.md` and pushed main commit `cdf1c6e`. This active POC should now continue through correction review, mandatory final EXPERT review, and only then present the operator's merge gate.
SAME-SLICE INTERRUPTION/REMOVAL REVIEW EVIDENCE — 2026-09-21

Public Prime Agent 0.9.5 evidence now distinguishes compaction-only cancellation from whole-turn/lifecycle cancellation. Compaction-hook cancellation in session 01a0c54f-8639-735c-9e5f-7fa1df1e2a9f recorded aborted:true and delivered execute exactly once. A real tmux-hosted TUI session 01a0c573-211f-745c-ad79-474a273f53d6 received named C-c while its bash tool visibly ran; the tool aborted, one later submit completed handoff, execute marker count stayed zero, and the runtime queue was empty. ACP session/cancel during the running tool likewise removed execute; after the cancelling state settled, a later accepted prompt completed with zero execute markers. ACP session/close during the tool plus a replacement session also produced zero execute markers and no plugin reconstruction/retry.

Direct public-runtime proof for explicit queued-item deletion remains unsupported. Prime Agent documents TUI Alt+Up followed by an empty edit, but named M-Up was not observable through the noninteractive tmux transport even after a fresh client negotiated extended-keys csi-u. ACP/RPC expose no queue-removal request. Daemon prime-agent send is agent-message delivery, not native slash-command dispatch. No private fields or invented infrastructure were used. Docs and EXECUTION_PLAN are being amended to record the verified behavior and this acceptance boundary; the obsolete Current-state audit heading is renamed as historical. Owner review remains blocked on either a manual supported-TUI explicit-removal proof or an explicit narrowing/waiver of that evidence item. Same commit only; no merge or second slice.
AMENDED SAME-SLICE PACKET — 2026-09-21

Amended commit 7fde4eb9118166eda2a331f1fcc91855797b955a replaces 8d8468bf2dc46a06f51956ce2792e53cb9117bcf and was pushed with --force-with-lease to origin/episode/handoff-continuation-resilience. Focused Node tests passed 9/9, focused Python tests passed 4/4, and git diff --check passed. The execution plan and operator docs now record verified compaction-only preservation, TUI/ACP whole-turn removal, ACP close/replacement cancellation, and the unsupported explicit Alt+Up removal proof boundary. Work remains stopped for owner review; do not merge or start another slice. Owner must either supply/manual-drive the public TUI explicit-removal proof or explicitly narrow/waive that evidence item before acceptance.

MANDATORY FINAL EXPERT REVIEW — 2026-09-21
Fresh read-only EXPERT reviewed exact candidate `7fde4eb9118166eda2a331f1fcc91855797b955a` against base `cb797d6dcd778dbcfcd31de2b60495baffbc7912`. Immutable report: `/Users/jlanders/.prime/agent/session-artifacts/01a0ba54-da05-76bd-8d22-a0facfdd7f31/sub-6d041f11/FINAL_EXPERT_REVIEW.md`. Verdict: `FINAL EXPERT PASS`; no material correctness, safety, compatibility, scope, test, or acceptance defect.

The EXPERT adjudicated direct Alt+Up queue-deletion automation as an acceptable public-surface limitation, not a blocker. Prime Agent documents the gesture; public ACP/RPC do not expose direct queue removal; noninteractive tmux could not observe named M-Up. Candidate-specific no-reconstruction behavior is structurally proven and corroborated by real TUI C-c, ACP session/cancel, and ACP close/replacement all removing execute without retry, while compaction-only cancellation preserves and executes once. The exact gesture remains explicitly disclosed as unautomated.

EXPERT accepted the qualified full-suite result: two runs each passed 246 tests and failed different pre-existing timing-sensitive watchdog cases; isolated watchdog file passed 24/24 and all other tests passed 223/223; no watchdog code changed. It confirmed the stale audit is now historical and all non-goals remain intact. Reviewer was deleted after report preservation; final-review heartbeat `22b82acf-2f4b-49c9-ae8a-ac066dc18280` was cancelled. The implementation is now at the single required final HITL gate. No merge or cleanup has occurred.
FINAL-CANDIDATE INTEGRATION — 2026-09-21

After FINAL EXPERT PASS on 7fde4eb9118166eda2a331f1fcc91855797b955a, the episode branch was rebased without conflict onto exact current main cdf1c6e79cd9c30e08e19afb6657a8abb5f46b3f. New exact HEAD is f89f121f2eba21d06d0bf89c220d38d0c32cc1ae; merge-base and ancestor check both confirm cdf1c6e. The implementation commit patch-id stayed 281fb515cfc8dff4b94971e8064773678e1535d3, and the complete two-commit episode range patch-id stayed 51e9511ba66711bd4dd6fa234388afe79f134a03, so the rebased diff is patch-equivalent to the reviewed candidate with no semantic changes.

Post-rebase validation: focused Node 9/9; focused Python 4/4; git diff --check passed; active integration suite `pytest -q tests` passed 247 with 11 deprecation warnings. A repository-root `pytest -q` also collected intentionally archived Phase 1 tests whose paths no longer exist; it reported 253 passes plus 36 failures/10 errors confined to scripts/archive/phase1 and is not the active suite. Branch was pushed with --force-with-lease. Local HEAD and origin branch exact-match f89f121f2eba21d06d0bf89c220d38d0c32cc1ae; worktree clean. Stop for renewed final Expert review and HITL gate; do not merge or start another slice.

INTEGRATED FINAL EXPERT + HITL GATE — 2026-09-21
Because main advanced to `cdf1c6e79cd9c30e08e19afb6657a8abb5f46b3f` with the operator-approved oversight clarification, the episode agent rebased its own branch and pushed exact integrated candidate `f89f121f2eba21d06d0bf89c220d38d0c32cc1ae`. Local/remote match, worktree clean, current-main ancestry exact. Implementation stable patch-id remains `281fb515cfc8dff4b94971e8064773678e1535d3`; implementation artifacts are byte-identical to previously reviewed `7fde4eb`. Validation: Node 9/9, Python 4/4, active `pytest -q tests` 247/247, diff-check pass. Root pytest additionally collects retired broken `scripts/archive/phase1` tests (253 pass, 36 fail, 10 error), adjudicated as pre-existing test-discovery debt outside this slice.

A fresh read-only EXPERT reviewed exact candidate `f89f121` on exact base `cdf1c6e`. Immutable report: `/Users/jlanders/.prime/agent/session-artifacts/01a0ba54-da05-76bd-8d22-a0facfdd7f31/sub-fead9be8/FINAL_EXPERT_REVIEW_REBASED.md`. Verdict: `FINAL EXPERT PASS`; no material blocker. It independently accepted the disclosed Alt+Up limitation and cancellation evidence. Minor nonblocking closure hygiene: promoted plan/spec link/status provenance and docs typo `schedule: true` vs `scheduled: true`; correct during archive/closure without changing runtime behavior. Reviewer and watch were stopped. This is now the single final HITL gate: merge exact candidate, request revision, pause, or abandon. No merge or cleanup has occurred.

TERMINAL MERGE AND CLEANUP — 2026-09-21
Operator approved merge at the single final HITL gate. Canonical main fast-forwarded through reviewed implementation `f89f121f2eba21d06d0bf89c220d38d0c32cc1ae`; bounded archive/closure commit `49547fe32995edcf6a5ed2a7c34a5a2d6469143e` moved the active specification and plan to `.ralph/plans/archive/handoff-continuation-resilience/`, updated the archive index and final adjudication evidence, and corrected the nonbehavioral `schedule`/`scheduled` documentation typo. A fresh detached worktree at exact `49547fe` passed the full active suite: 247 passed, 11 warnings; focused validation remained 9 Node + 4 Python and diff-check clean. `main` and `origin/main` match `49547fe`.

Terminal resources retired after verified push: episode session `01a0c537-4a05-75be-a435-bf32b682d49b` was already inactive with zero queued work; clean worktree `/Users/jlanders/code/prime-claw-handoff-continuation-resilience-episode` removed; local and remote `episode/handoff-continuation-resilience` deleted; terminal identity `.prime/agent/state/spec-episodes/handoff-continuation-resilience.json` removed. Historical transcript and both immutable final EXPERT reports remain as evidence. Unrelated canonical dirty files were preserved unchanged.

POC acceptance is satisfied: the handoff fix was implemented, tested, twice final-EXPERT reviewed, operator-approved, and merged; the episode was retired only after terminal disposition; and accepted workflow findings were incorporated into `.ralph/plans/future/conversation-driven-episode-oversight/SPECIFICATION.md` at `cdf1c6e`, including continuous PROJECT_CONVERSATION driving across slices, judgment-based intermediate EXPERT use, mandatory final EXPERT review, and one final HITL merge gate.

## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Specification imported from `.ralph/plans/archive/handoff-continuation-resilience/SPECIFICATION.md`

# Specification — Handoff continuation resilience

> **Status:** operator approved for implementation through native `/implement-spec`.
> **Current implementation:** [`docs/handoff-chain.md`](../../../../docs/handoff-chain.md)
> **Related future work:** [Conversational Ralph command routing](../../future/conversational-ralph-command-routing/SPECIFICATION.md)
> **Historical advisory evidence:** [`reports/reviews/handoff-resilience-spec-review-a93c27c.md`](../../../../reports/reviews/handoff-resilience-spec-review-a93c27c.md)

## Purpose

Fix a reliability bug in native `/handoff`: canonical `execute` currently waits
for a successful `session_compact` event. When compaction is unnecessary,
refused, cancelled, fails, or never produces that event, a valid handoff can stop
without continuing the work.

The desired product rule is simple:

> Compaction is a best-effort context improvement. Continuing into canonical
> `execute` is required unless continuation itself is infeasible.

## Current behavior

The project-local handoff extension loads the canonical handoff workflow, records
pending execute state, and waits for `session_compact` before injecting canonical
execute. Prime Agent may legitimately decline or fail to compact, especially in
a short session. A scheduling acknowledgement is also not proof that compaction
completed.

This makes an optional optimization a mandatory transition gate.

## Desired behavior

For an admitted native `/handoff`:

1. Preserve the existing command UX and all trailing guidance.
2. Prepare durable handoff context using the canonical project workflow.
3. Attempt focused compaction when appropriate.
4. Continue into canonical `execute` whether compaction succeeds, is skipped,
   is refused, is cancelled, or fails. One admitted handoff must not knowingly
   start more than one execute pass.
5. Treat native `/handoff` as authorization for the execute follow-up.
   Compaction refusal, cancellation, or failure does not revoke that approval.
   Explicit removal of the queued execute message or termination/replacement of
   the session cancels the transition.
6. Stop and ask for human help only when execute continuation itself cannot be
   performed or its delivery state cannot be resolved safely.
7. Show concise, truthful status that distinguishes compaction outcome from
   execute continuation.

A missing or inadequate summary does not authorize, block, or select work. The
active plan, bead, confirmed operator intent, and other durable project artifacts
remain authoritative.

## Observable outcome matrix

| Situation | Required outcome |
|---|---|
| Compaction completes | Report confirmed compaction and start the execute pass |
| Compaction is unnecessary or refused | Report no compaction and start the execute pass |
| Compaction alone is cancelled or fails | Report the problem safely and start the execute pass when delivery remains feasible |
| The queued execute message is explicitly removed | Cancel the transition; do not reconstruct or retry it |
| The session terminates or is replaced | Cancel the transition with that session |
| A compaction event arrives late | Do not start an additional execute pass |
| The same finalization signal repeats | Do not start an additional execute pass |
| Canonical execute cannot be loaded or safely delivered | Report continuation infeasibility and do not claim success |

## Compatibility and safety

- `/handoff` without trailing guidance retains its current default behavior: it
  starts the canonical handoff workflow without requiring the user to provide or
  confirm a focus hint.
- Trailing text remains free-form guidance, not a phase or path selector.
- Inline mentions of `/handoff` remain ordinary conversation.
- The extension does not infer cancellation intent from a missing
  `session_compact` event or an interrupted compaction. Explicit queue removal or
  session termination/replacement is the cancellation boundary.
- Canonical handoff and execute procedures remain project-customizable Markdown.
- Diagnostics remain bounded and do not persist credentials, tracebacks, locals,
  raw provider payloads, or unrelated host data.
- Existing command discovery, guidance handling, and legacy cleanup continue to
  work.

## Scope

This specification covers only native handoff continuation resilience.

It does not add:

- conversational invocation of `/handoff` or other commands;
- a general command-routing framework;
- a human recovery command for compaction problems;
- phase selection through handoff guidance;
- the complete Ralph loop or episode orchestrator;
- Prime Agent core changes; or
- claims about root/RLM-child delivery isolation not proven by the supported
  runtime.

## Implementation freedom

This specification does not prescribe a Python finalizer, bridge protocol,
generation state machine, host authorization mechanism, or other infrastructure.
It also does not promise mathematically strict exactly-once delivery across every
crash or uncertain transport outcome. Planning must first audit the current
extension and supported Prime Agent APIs, then choose the smallest design that
prevents known event paths from admitting duplicate execute passes.

If a proposed approach requires substantial new infrastructure, planning must
show why a simpler extension-local solution cannot satisfy the behavior.

## Acceptance evidence

Implementation is acceptable when focused tests and one disposable supported
runtime demonstrate:

- execute starts after successful compaction;
- execute starts when compaction is unnecessary or refused;
- execute starts after compaction-only cancellation or failure when delivery
  remains feasible;
- explicit queued-message removal and session termination/replacement do not
  reconstruct or retry execute;
- late or repeated known signals do not start an additional execute pass;
- visible failure when continuation itself is infeasible;
- truthful status for every tested outcome; and
- the existing native handoff and full repository regression suites remain green.

## Provenance

This specification was split from the earlier combined
`handoff-resilience-and-conversational-routing` draft after operator review found
that it conflated a reliability bug with a separate interaction feature. The
old EXPERT report is immutable historical advisory evidence; it did not review
or approve this simplified specification.

The earlier requirements and decisions catalogs were intentionally removed.
Experience from the worktree-isolated specification episode showed that large
up-front requirement matrices encouraged speculative infrastructure and obscured
the product outcome. Durable constraints now live directly in this document.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 execute starts after successful compaction;
- [x] #2 execute starts when compaction is unnecessary or refused;
- [x] #3 execute starts after compaction-only cancellation or failure when delivery remains feasible;
- [x] #4 explicit queued-message removal and session termination/replacement do not reconstruct or retry execute;
- [x] #5 late or repeated known signals do not start an additional execute pass;
- [x] #6 visible failure when continuation itself is infeasible;
- [x] #7 truthful status for every tested outcome; and
- [x] #8 the existing native handoff and full repository regression suites remain green.
- [x] #9 Prior task criterion: The handoff enhancement is implemented, tested, reviewed, and merged without modifying unrelated ongoing work; the episode is retired only after terminal disposition; and accepted manual-workflow findings are incorporated into the conversation-driven episode oversight specification bundle.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/handoff-continuation-resilience/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

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
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/handoff-continuation-resilience/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/handoff-continuation-resilience/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: .

### Shared archive-index outcome

## handoff-continuation-resilience/ — Compaction-independent handoff continuation ✅ COMPLETE (2026-09-21)

Changed native `/handoff` to preflight both canonical workflows, admit handoff,
and queue canonical execute once as a native `followUp`. Compaction remains a
best-effort context improvement and no longer owns execute admission. Late or
repeated compaction signals have no path to start another execute pass.

Disposable Prime Agent 0.9.5 evidence covered no-compaction, compaction success,
compaction cancellation, bounded compaction failure, real TUI interruption, ACP
cancel, and ACP close/replacement. The integrated implementation commit is
`f89f121f2eba21d06d0bf89c220d38d0c32cc1ae`. Final validation passed 9 focused
Node tests, 4 Python bridge/loader tests, all 247 active repository tests, and
`git diff --check`. Two fresh exact-commit EXPERT reviews returned
`FINAL EXPERT PASS`, after which the operator explicitly approved merge. Bead
`PRIMECLAW-10.15` holds the manual oversight and evidence record.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
POC completed: resilient handoff merged at 49547fe; final Expert/HITL gates passed; episode resources retired safely.

## handoff-continuation-resilience/ — Compaction-independent handoff continuation ✅ COMPLETE (2026-09-21)

Changed native `/handoff` to preflight both canonical workflows, admit handoff,
and queue canonical execute once as a native `followUp`. Compaction remains a
best-effort context improvement and no longer owns execute admission. Late or
repeated compaction signals have no path to start another execute pass.

Disposable Prime Agent 0.9.5 evidence covered no-compaction, compaction success,
compaction cancellation, bounded compaction failure, real TUI interruption, ACP
cancel, and ACP close/replacement. The integrated implementation commit is
`f89f121f2eba21d06d0bf89c220d38d0c32cc1ae`. Final validation passed 9 focused
Node tests, 4 Python bridge/loader tests, all 247 active repository tests, and
`git diff --check`. Two fresh exact-commit EXPERT reviews returned
`FINAL EXPERT PASS`, after which the operator explicitly approved merge. Bead
`PRIMECLAW-10.15` holds the manual oversight and evidence record.
<!-- SECTION:FINAL_SUMMARY:END -->
