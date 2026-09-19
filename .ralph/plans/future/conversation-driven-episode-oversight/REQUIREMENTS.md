# Requirements — Conversation-driven episode oversight

> **Status:** incubated future requirements.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

Priority meanings: **GATE** is required for initial acceptance; **LATER** is an
explicit extension and must not weaken a gate.

## Hierarchy and scope

- **R-CO-1 (GATE) — Context is not an agent.** `PROJECT_CONTEXT` is the managed canonical Git project boundary and does not require its own resident agent.
- **R-CO-2 (GATE) — Conversation ownership.** A durable `PROJECT_CONVERSATION` creates, logically owns, reviews, and drives its `EPISODE`.
- **R-CO-3 (GATE) — Full lifecycle.** Oversight begins with interview/disposition and continues through episode creation, specification, planning, execution slices, PR disposition, retirement, and cleanup.
- **R-CO-4 (GATE) — Autonomous authority.** After release approval, the conversation may approve gates and advance its episode without per-gate human confirmation.
- **R-CO-5 (GATE) — Human control.** The operator can observe, pause, redirect, override, or take over at any time.

## Concurrency

- **R-CO-6 (GATE) — One initial episode per conversation.** The first release permits at most one active episode owned by a conversation.
- **R-CO-7 (GATE) — Concurrent conversations.** Several conversations in one project can concurrently drive one isolated episode each without interference.
- **R-CO-8 (LATER) — Multiple episodes per conversation.** The design can later remove the one-active-episode restriction without replacing the ownership model.

## Durable control state

- **R-CO-9 (GATE) — Durable state machine.** Episode phase, gate, identities, reviewed commit, findings, approvals, commands, escalations, merge, and cleanup state survive compaction and process/session restart.
- **R-CO-10 (GATE) — Atomic transitions.** Lifecycle mutations and shared records are atomic, idempotent, and scoped to project, conversation, and episode.
- **R-CO-11 (GATE) — Exact evidence identity.** Every review and approval names an exact pushed commit and applicable artifact, requirement, plan slice, and bead.
- **R-CO-12 (GATE) — No transcript-only authority.** Transcript prose and in-memory handles are not the sole source of lifecycle truth.
- **R-CO-50 (GATE) — Owner-installed episode watch.** Immediately after every successful episode activation, the owning conversation installs a durable liveness watch before yielding control; episode reporting is a fast path, never the only completion signal.
- **R-CO-51 (GATE) — Non-disruptive long observation.** Active-work polling uses a configurable long cadence, normally 15 minutes or more, observes without steering or interrupting the episode, and does not infer failure from one quiet interval.
- **R-CO-52 (GATE) — Missed-report recovery.** When an episode is idle, completed, failed, or stale without its expected report, the conversation resolves its durable identity, inspects runtime activity plus authoritative oversight, Git, plan, and bead state, and independently recovers the review packet or escalates; runtime status and message delivery alone never approve a gate.
- **R-CO-53 (GATE) — Restart-safe watch lifecycle.** Watch state, expected gate/report, last observation, and single-poller lease survive owner compaction and restart, follow stable episode identity across active-session changes, and remain active until verified terminal disposition or explicit operator cancellation.

## Review protocol

- **R-CO-13 (GATE) — Independent verification.** The conversation inspects repository evidence and never approves solely from the episode's success claim.
- **R-CO-14 (GATE) — Structured decisions.** Every gate records approve, revise, escalate, or abandon with evidence and acceptance conditions.
- **R-CO-15 (GATE) — Traceable findings.** Findings have stable IDs, severity, evidence, applicable requirements/slices, status, and acceptance conditions.
- **R-CO-16 (GATE) — Revision invalidates approval.** A changed merge candidate or artifact commit requires re-review; approval never floats to later content.
- **R-CO-17 (GATE) — Slice evidence.** Slice review covers scope, code, tests, docs, traceability, beads, reproducibility, diff hygiene, push state, and clean worktree.

## Project-scoped EXPERT

- **R-CO-18 (GATE) — Project profile.** Each project can version an evolving EXPERT definition, skills, architectural context, rubrics, model policy, and lessons.
- **R-CO-19 (GATE) — Fresh invocation.** Each review uses a separate short-lived EXPERT with clean context rather than one persistent reviewer transcript.
- **R-CO-20 (GATE) — Strongest authorized model.** EXPERT selection resolves to the most capable operator-authorized configured model and never silently claims expertise using the default model.
- **R-CO-21 (GATE) — Read-only advice.** The EXPERT reviews one exact commit, returns structured findings to the conversation, and cannot steer, modify, approve, merge, or clean the episode.
- **R-CO-22 (GATE) — Mandatory artifact reviews.** EXPERT review is required for every completed specification, completed plan, and final pre-merge candidate.
- **R-CO-23 (GATE) — Risk-triggered slice review.** EXPERT review is required for slice security, credentials, concurrency, distributed state, destructive recovery, durable migrations, public compatibility, broad diffs, disputed evidence, reviewer disagreement, novel mechanisms, or repeated failure.
- **R-CO-24 (GATE) — Unavailable expert escalation.** A required or triggered EXPERT that cannot run pauses automation and calls the human; there is no silent fallback or waiver.

## Revision and human escalation

- **R-CO-25 (GATE) — Stagnation semantics.** New findings after a successful fix and meaningful incomplete progress do not count as failed intervention.
- **R-CO-26 (GATE) — Two-strike escalation.** Two consecutive revisions with no meaningful improvement pause automation and call the human.
- **R-CO-27 (GATE) — Progress reset.** Meaningful improvement resets the consecutive-stagnation counter.
- **R-CO-28 (GATE) — Complete escalation packet.** Human escalation includes exact commits, findings, attempts, evidence, tests, EXPERT reports, and requested disposition.
- **R-CO-29 (GATE) — Immediate safety escalation.** Missing authority/credentials, unsafe merge or cleanup ambiguity, and material scope/safety changes pause for the human.
- **R-CO-44 (GATE) — Durable material findings.** Every accepted material EXPERT or owner finding is persisted before revision with stable ID, reviewed commit, evidence, controlling requirement/decision, and acceptance condition; transcript or report-only findings are insufficient.
- **R-CO-45 (GATE) — Authoritative artifact incorporation.** Findings update requirements and decisions when they expose missing or changed product invariants, update specification scope/state/acceptance when applicable, and always update the execution plan and active bead with concrete regression work. Existing authority may be linked instead of duplicated.
- **R-CO-46 (GATE) — Same-gate revision.** A failed review remains on the same specification, plan, or slice. Implementation does not resume and later work does not start until finding incorporation is verified.

## Commands and phase progression

- **R-CO-30 (GATE) — Real native commands.** The conversation invokes registered episode commands through the Prime Agent command path; it does not imitate commands by pasting skill text.
- **R-CO-31 (GATE) — Exactly-once transition.** Command registration, unique admission, receipt, persisted boundary, next-phase entry, and uncertain-operation recovery are verified for every phase transition.
- **R-CO-32 (GATE) — Handoff chain.** Approved work advances through native `/handoff`, successful compaction, and exactly one canonical `execute` injection.
- **R-CO-33 (GATE) — One vertical slice.** Each execute phase performs one bounded vertical slice and stops for review.
- **R-CO-34 (GATE) — Operator precedence.** TUI observation is safe and operator steering/pause takes precedence over autonomous advancement.
- **R-CO-47 (GATE) — Guided revision handoff.** After durable finding incorporation, a failed gate advances to its next same-gate execute iteration through native `/handoff` guidance naming the findings and acceptance conditions; handoff does not imply approval or numbered-slice advancement.
- **R-CO-48 (GATE) — Verified compaction primer.** The conversation verifies that the resulting compaction summary names the correct next phase or same-gate revision, finding IDs, and authoritative artifacts before allowing execute to proceed.
- **R-CO-49 (GATE) — Auto-compaction race safety.** Auto-compaction cannot authorize progression. The controller prevents, pauses, supersedes, or recovers any compaction that races with gate adjudication or omits late findings, then establishes a verified controlled primer.

## Merge, cleanup, and safety

- **R-CO-35 (GATE) — Final readiness.** Merge review verifies archive, docs, beads, tests, CI, PR feedback, branch currency, push state, clean worktree, and mandatory EXPERT approval.
- **R-CO-36 (GATE) — Commit-bound merge authority.** Autonomous merge is allowed only for the exact approved candidate under repository policy; candidate changes invalidate authorization.
- **R-CO-37 (GATE) — Terminal cleanup only.** Session retirement and worktree cleanup occur only after verified merge or explicit abandonment and preserve durable evidence.
- **R-CO-38 (GATE) — Cross-episode isolation.** A conversation cannot review, steer, merge, or clean another conversation's episode through inferred identity or shared CWD.
- **R-CO-39 (GATE) — Trusted mutation boundary.** Validated trusted host code owns Git, daemon, session, path, locking, and cleanup mutations using safe argument handling.
- **R-CO-40 (GATE) — Credential isolation.** Oversight and EXPERT review preserve the OpenShell credential boundary and never read Keychain, browser stores, or sandbox credential files.

## Adoption and verification

- **R-CO-41 (GATE) — Manual-first evidence.** Autonomous release remains gated on operator acceptance of repeated manual oversight runs and recorded lessons.
- **R-CO-42 (GATE) — Staged autonomy.** Adoption progresses from passive reporting through suggested decisions and operator-confirmed transitions to disposable autonomous dogfood.
- **R-CO-43 (GATE) — End-to-end proof.** Tests and concurrent dogfood prove full lifecycle, fresh EXPERT review, triggers, escalation, command recovery, restart recovery, owner-watch recovery of a missing report without false-stale interruption, operator interruption, merge, cleanup, and non-interference.
