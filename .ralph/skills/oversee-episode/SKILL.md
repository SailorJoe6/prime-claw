---
name: oversee-episode
description: Guide an exact owning CONVERSATION through evidence-based oversight of one active EPISODE.
---

# Oversee episode

Use this procedure only while trusted exact-session state says this CONVERSATION
owns an active EPISODE.

1. Retain the exact episode identity, reviewed scope, and current work generation.
2. Send one owner-coordination message. Identify this exact owner conversation,
   state that it independently reviews and approves work, and ask the EPISODE to
   report material progress, blockers, and completion directly.
3. Maintain exactly one non-steering 15-minute agent-owned heartbeat for each
   active bootstrap, continuation, repair, review-rework, or evidence generation.
   Reports are the fast path; the heartbeat is only the missed-report safety net.
   Cancel it when the generation is reconciled or waits only for owner/operator
   action. A later generation gets a fresh watch.
4. Reconcile reports against the exact session, branch, commit, diff, tests,
   documentation, active plan, Bead, push, and worktree evidence. A report is
   evidence, never approval or native-command dispatch.
5. Record findings in the owner ledger (`prime-claw-h6w.22` for this project) and
   in the specification, plan, code/tests, or linked immutable report at stable
   review gates. Do not turn living policy into point-in-time chronology.
6. Choose `advance`, `revise`, `consult`, or `pause`. Continue only bounded work
   already inside the approved specification and plan. Scope expansion,
   unresolved product decisions, blockers, and explicit operator requests pause.
7. Independently review each exact pushed candidate. Use a fresh EXPERT when
   required by project policy or material risk. EXPERT is read-only and bounded;
   preserve reviewer identity, exact commit, model/reasoning evidence, findings,
   and disposition. Every BLOCK finding states the violated invariant, root-cause
   seam, recommended repair direction and rationale, constraints and anti-patterns,
   concrete acceptance tests, regression risks, and dependencies without prescribing
   exact patch code. Never silently weaken or substitute a required review.

   For every required EXPERT review, load
   `.prime/agent/profiles/expert-reviewer.md` from the project. Validate raw
   frontmatter before constructing a mapping: line-exact delimiters; exactly one
   nonempty bounded scalar each for `name`, `model`, and `thinking`; no duplicate,
   nested, collection, block, or additional keys; `name: expert-reviewer`; and a
   nonempty Markdown body. Resolve `model` with `rlm.find_models` and require one
   exact selector match. Then use the repository safe-spawn protocol: call
   `rlm.spawn` with only a harmless bootstrap plus the exact resolved `model` and
   configured `thinking`. Before delivery, verify the returned handle names that
   exact model; successful spawn admission is the evidence that the explicit
   reasoning request was accepted. Send one combined task containing the validated
   profile body and focused read-only exact-commit packet exactly once through
   `agent_message.send`.

   Require a complete `PASS` or actionable `BLOCK` report; an incomplete report
   does not satisfy the gate. Preserve the report before stopping and deleting
   that exact fresh reviewer. Record its session identity, exact commit, returned
   model, admitted reasoning level, report artifact, and disposition. If profile
   validation, exact discovery, spawn, returned-model verification, reasoning
   admission, delivery, or report completion fails or is uncertain, pause and ask
   the operator. Never resend an uncertain delivered task, delete a reviewer with
   outstanding delivery/report work, use the current/default model, lower
   reasoning, retry another selector, or claim that the EXPERT gate ran.
8. After exact-commit acceptance, use only the existing exact-owner continuation
   capability. Admission does not prove work completion. Never imitate native
   transport with prose or `agent_message.send`.
9. Present the complete exact candidate for the operator's explicit merge,
   revision, pause, or abandonment decision. Only the operator grants terminal
   authority. Never infer merge, abandonment, scope, or destructive cleanup.
10. For `merged` or `abandoned`, call the authorize phase of
    `finalize_spec_episode`; let its single UI confirmation record the operator
    decision. Then perform the ordinary conservative Git/session/worktree work.
    Dirty, ambiguous, or uncertain state blocks cleanup. Keep the authorized
    episode branch/ref available until completion validates its exact tip; apply
    branch-retention policy only afterward. Finally call the completion phase, which validates terminal facts, clears only matching state,
    and returns this session to ordinary CONVERSATION mode.

Under material context pressure, record the next P0, preserve evidence, stop at a
safe checkpoint, and use native context refresh before more implementation. This
does not accept a commit, expand scope, or create a duplicate heartbeat.

This skill supplies semantic judgment only. It does not forge identity, mutate
raw daemon state, decide implementation completeness, merge, abandon, delete
resources, or bypass trusted host checks.
