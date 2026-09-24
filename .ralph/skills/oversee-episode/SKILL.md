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
   If no completion report arrives but the heartbeat sees apparent quiescence,
   ask the sibling exactly: `You seem done with your work. Are you complete or waiting for some process?`
   Trust that answer before beginning review or handoff. Cancel the watch when the
   generation is reconciled or waits only for owner/operator action. A later
   generation gets a fresh watch.
4. Reconcile reports against the exact session, branch, commit, diff, tests,
   documentation, active plan, Bead, push, and worktree evidence. A report is
   evidence, never approval or native-command dispatch.
5. Record findings in the owner ledger (`prime-claw-h6w.22` for this project) and
   in the specification, plan, code/tests, or linked immutable report at stable
   review gates. Do not turn living policy into point-in-time chronology.
6. Choose `advance`, `revise`, `consult`, or `pause` from reconciled evidence.
   - `advance` only after this owner accepts the exact candidate and the next
     bounded work is already approved and recorded in the specification and plan.
   - `revise` only from findings this owner has accepted, recorded durably in the
     specification, plan, Bead, code/tests, or linked report, and classified as
     inside the approved scope.
   - `consult` or `pause` for unresolved product decisions, scope changes,
     blockers, conflicting evidence, or requested work outside that boundary.
   An accepted `advance` or in-scope `revise` needs no new operator transport
   request. This semantic authority does not grant scope, product, merge,
   abandonment, or cleanup authority.
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
   model, admitted reasoning level, report artifact, and disposition.

   One narrow recovery exception applies only when the reviewer is confirmed
   terminal after a purely technical failure and produced no usable `PASS` or
   `BLOCK` disposition. Preserve the incomplete attempt and exact packet identity
   in the owner ledger so context refresh cannot replenish the one-replacement
   allowance, then retire that exact reviewer. The owner may admit exactly one
   fresh replacement under PROJECT_CONVERSATION authority with the same validated
   profile and exact review packet, including the same exact model and reasoning,
   through the safe-spawn and one-message procedure above. No new operator
   transport decision is required. This exception does not apply to a still-active
   reviewer, ambiguous delivery or state, unavailable policy or access, or a
   substantive `BLOCK`; never resend to the failed reviewer or retry a `BLOCK` to
   seek a different disposition. If the replacement also fails or is uncertain,
   pause and ask the operator; never admit a further replacement.

   If profile validation, exact discovery, spawn, returned-model verification,
   reasoning admission, delivery, or report completion otherwise fails or is
   uncertain, pause and ask the operator. Never resend an uncertain delivered
   task, delete a reviewer with outstanding delivery/report work, use the
   current/default model, lower reasoning, retry another selector, or claim that
   the EXPERT gate ran.
8. For an accepted `advance` or in-scope `revise`, use only the exact owned
   idle episode and exact retained future-folder location. At that accepted idle
   boundary, cancel the completed generation's old watch. Then pre-arm exactly
   one non-steering watch for the intended generation immediately before calling
   the terminal `handoff_spec_episode`. Optional compaction guidance may be
   operator-supplied focus or a bounded synthesis of the accepted durable
   findings that justify this continuation. Never route arbitrary chat,
   unaccepted findings, a new product decision, or scope expansion through
   guidance. Do not search for another episode or use the tool for `consult`,
   `pause`, or a terminal disposition. If the result proves definite first-send
   no-admission, keep the pre-armed intended-generation watch available for a
   later fresh observed-idle retry; do not cancel it merely because the first
   call was rejected. The watch never retries automatically. Before any owner
   retry, obtain a fresh exact state snapshot and require the exact owned episode
   to be idle again. Retain the watch across success, partial admission,
   ambiguity, or definite first-send no-admission until the intended generation
   or bounded retry is reconciled complete, blocked, stopped, or waiting only for
   owner/operator action. Never create the intended-generation watch after
   success or arm a duplicate. Admission does not prove compaction or work
   completion. Never imitate native transport with prose or
   `agent_message.send`, and never retry an uncertain transport result.
9. Before presenting merge readiness, obtain a fresh final EXPERT review of the
   complete exact candidate with the protocol above, adjudicate every finding,
   and require a `PASS` for that exact commit. An intermediate review, another
   commit's report, incomplete review, or unresolved `BLOCK` cannot satisfy this
   gate. Any material repair changes the candidate and invalidates the prior
   review, so renew the final review against the repaired exact commit. An
   operator pause or abandonment request remains available without a
   merge-readiness claim. EXPERT `PASS` is evidence, never merge authority.
   Present the complete exact candidate for the operator's explicit merge,
   revision, pause, or abandonment decision only after this owner-verification
   gate. Only the operator grants terminal authority. Never infer merge,
   abandonment, scope, or destructive cleanup.
10. For `merged` or `abandoned`, call the authorize phase of
    `finalize_spec_episode`; let its single UI confirmation record the operator
    decision. Then perform the ordinary conservative Git/session/worktree work.
    Dirty, ambiguous, or uncertain state blocks cleanup. Keep the authorized
    episode branch/ref available until completion validates its exact tip; apply
    branch-retention policy only afterward. Finally call the completion phase,
    which validates terminal facts, clears only matching state, and returns this
    session to ordinary CONVERSATION mode. Cancel episode-specific watches and
    record the terminal disposition. A later reviewed folder requires a fresh
    native `/implement-spec` run; one completed episode never lifetime-locks the
    owner conversation.

Under material context pressure, record the next P0, preserve evidence, stop at a
safe checkpoint, and use native context refresh before more implementation. This
does not accept a commit, expand scope, or create a duplicate heartbeat.

This skill supplies semantic judgment only. It does not forge identity, mutate
raw daemon state, decide implementation completeness, merge, abandon, delete
resources, or bypass trusted host checks.
