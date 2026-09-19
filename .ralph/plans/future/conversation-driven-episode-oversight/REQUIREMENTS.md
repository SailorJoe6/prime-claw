# Requirements — Conversation-driven episode oversight

> **Status:** incubated future requirements.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

Priority meanings: **GATE** is required for initial acceptance; **LATER** is an
explicit extension and must not weaken a gate.

## Hierarchy and scope

- **R-CO-1 (GATE) — Context is not an agent.** `PROJECT_CONTEXT` is the managed canonical Git project boundary and does not require its own resident agent.
- **R-CO-2 (GATE) — Conversation ownership.** A durable `PROJECT_CONVERSATION` creates, logically owns, reviews, and drives its production `EPISODE` resources while retaining conversation identity before, between, and after them.
- **R-CO-3 (GATE) — Full lifecycle.** A durable conversation begins with discussion and incubation, may promote work through episode creation, specification, planning, execution slices, PR disposition, retirement, and cleanup, then returns to post-delivery feedback or incubation without losing its identity or history.
- **R-CO-4 (GATE) — Autonomous authority.** After release approval, the conversation may approve gates and advance its currently owned episode without per-gate human confirmation.
- **R-CO-5 (GATE) — Human control.** The operator can observe, pause, redirect, override, or take over at any time.

## Concurrency

- **R-CO-6 (GATE) — One active episode per conversation initially.** The first release permits at most one active episode owned by a conversation, while allowing that durable conversation to own many sequential episodes over its lifetime.
- **R-CO-7 (GATE) — Concurrent conversations.** Several conversations in one project can concurrently drive one isolated episode each without interference.
- **R-CO-8 (LATER) — Multiple concurrent episodes per conversation.** The design can later remove the one-active-episode restriction without replacing the ownership model or weakening explicit episode targeting.

## Durable conversation role and focus

- **R-CO-61 (GATE) — Stable role across changing focus.** `PROJECT_CONVERSATION` is a durable role identity, not an episode-supervisor mode. It persists while conversational focus moves among discussion, incubation, promotion, episode oversight, delivery, and post-delivery feedback.
- **R-CO-62 (GATE) — Versioned role manifest.** The role's invariant responsibilities, trust policy, compatibility requirements, and focus-specific duty packs are stored in a versioned, reviewable project manifest rather than depending on transcript prose, a user reminder, or one prompt template.
- **R-CO-63 (GATE) — Durable session-role binding.** A bound conversation records stable conversation and project identity, session lineage, role and policy versions, manifest integrity, authority mode, lease or binding epoch, and active episode identity independently of its display name and current prompt.
- **R-CO-64 (GATE) — Orthogonal focus and commitments.** Current conversational focus, active execution commitments, and authority mode are represented separately. Changing the topic or focus neither drops an owned episode nor grants episode authority, and an active episode does not prevent the conversation from incubating later work.
- **R-CO-65 (GATE) — Durable conversation thread record.** Product intent, decisions, unresolved questions, incubated specifications, current focus, delivery outcomes, user feedback, and episode lineage survive compaction and restart in a conversation-level record distinct from every episode oversight record.
- **R-CO-66 (GATE) — Sequential episode lineage.** After delivery or abandonment, the conversation retains the terminal episode record and may promote later feedback into a new episode with a new identity and explicit predecessor link; commits, approvals, findings, watches, and command receipts never carry forward implicitly.
- **R-CO-67 (GATE) — Side-discussion scope isolation.** Discussion or feedback raised while an episode is active is recorded as incubated follow-up unless the owner performs an explicit, authorized scope-change transition. Casual conversation cannot silently mutate the admitted episode's scope or acceptance conditions.
- **R-CO-68 (GATE) — Boundary reassertion.** On initial start, resume, daemon restart, fork or clone, every agent turn, and after compaction, trusted controller logic validates the binding and records, then reasserts the invariant role kernel plus the minimum focus-specific duty pack and authoritative state envelope.
- **R-CO-69 (GATE) — Failure-closed lineage and compatibility.** Missing, duplicate, corrupt, stale, incompatible, or split-brain bindings, manifests, leases, forks, or state versions remove mutation authority and enter explicit recovery, analysis-only, transfer, pause, or revocation state; names, CWD, transcript ancestry, or copied bindings cannot authorize ownership.
- **R-CO-70 (GATE) — Explicit version migration.** Role, policy, binding, conversation-record, oversight-record, and controller protocol versions migrate through deterministic trusted code with compatibility checks, atomic or replay-safe transitions, and durable audit events; active gates never silently change policy.
- **R-CO-71 (GATE) — Role and focus observability.** The operator can inspect conversation identity, bound session and lineage, role and policy versions, authority mode, current focus, active commitments, episode and gate identity, state revision, restore/compaction integrity, and allowed next transitions without reconstructing authority from raw transcripts.
- **R-CO-72 (GATE) — Context is a projection, not authority.** Skills, prompt templates, continual-harness entries, session names, transcript, compaction summaries, REPL state, and recursive-agent registries may aid reasoning but cannot establish role identity, lifecycle truth, ownership, or permission to mutate.

## Durable control state

- **R-CO-9 (GATE) — Durable state machines.** Conversation binding, focus, commitments, thread history, and episode phase, gate, identities, reviewed commit, findings, approvals, commands, escalations, merge, and cleanup state survive compaction and process/session restart.
- **R-CO-10 (GATE) — Atomic transitions.** Lifecycle mutations and shared records are atomic, idempotent, and scoped to project, conversation, and episode.
- **R-CO-11 (GATE) — Exact evidence identity.** Every review and approval names an exact pushed commit and applicable artifact, requirement, plan slice, and bead.
- **R-CO-12 (GATE) — No transcript-only authority.** Transcript prose and in-memory handles are not the sole source of lifecycle truth.
- **R-CO-50 (GATE) — Owner-installed active-work watch.** Immediately after one episode work generation is durably admitted and before yielding control, the owning conversation installs a liveness watch keyed by the episode stable identity and that work-generation identity. Episode resource existence, an open nonterminal lifecycle, owner review, or a pending human decision does not by itself arm or retain a watch; episode reporting remains a fast path, never the only completion signal.
- **R-CO-51 (GATE) — Non-disruptive long observation.** While the admitted episode work generation is active, polling uses a configurable long cadence, normally 15 minutes or more, observes without steering or interrupting the episode, and does not infer failure from one quiet interval. Elapsed-time decisions use persisted event and observation timestamps rather than nominal heartbeat intervals, so delayed delivery cannot create a false stale finding.
- **R-CO-52 (GATE) — Bounded missed-report recovery.** When the watched work generation becomes idle, completed, failed, or stale without its expected report, the conversation resolves its durable identity, performs one bounded reconciliation against runtime activity plus authoritative oversight, Git, plan, and bead state, and independently recovers the packet, requests at most one missing packet, or escalates. Runtime status and message delivery alone never approve a gate, but recurring unchanged polls are forbidden after the work generation is reconciled or owner/human action is the only remaining dependency.
- **R-CO-53 (GATE) — Restart-safe, activity-scoped watch lifecycle.** While armed, watch state, work-generation identity, expected gate/report, last observation, and single-poller lease survive owner compaction and restart and follow stable episode identity across active-session changes. The owner cancels the scheduled watch and durably records it as disarmed immediately after the work generation and expected packet are reconciled, even when the episode resource remains nonterminal. A fresh watch is installed for the next admitted work generation.
- **R-CO-60 (GATE) — Owner blockage is not episode activity.** Independent owner review, EXPERT review, merge adjudication, or waiting for operator input blocks the owning conversation when applicable; it never keeps an inactive episode heartbeat alive. Before reporting that an episode itself is blocked, the owner must identify an admitted episode task that cannot proceed and distinguish that state from an idle episode awaiting owner action.

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
- **R-CO-54 (GATE) — Owned EXPERT invocation lifecycle.** The conversation durably records every EXPERT reviewer and delegated descendant, exact review identity, artifact location, deadline, and cleanup state from admission through retirement.
- **R-CO-55 (GATE) — Preserve then retire.** After preserving and checking the report and runnable evidence—or durably adjudicating failure, cancellation, timeout, missed reply, or admission race—the conversation explicitly retires the exact reviewer tree and verifies that no live or idle invocation resource remains; runtime status alone cannot authorize premature deletion.
- **R-CO-56 (GATE) — Idempotent orphan recovery.** Interrupted teardown remains durably `cleanup-pending`, retries after owner restart, recursively removes only the exact EXPERT invocation tree, and never deletes an episode or another conversation's reviewer.

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
- **R-CO-57 (GATE) — Idle native-command preflight.** Before dispatch, the conversation proves the intended stable episode and active session are idle, not compacting, have no queued turn, and remain at the expected durable Git/gate boundary; commands are not sent while a sibling is finishing another turn.
- **R-CO-58 (GATE) — Transport is not admission.** Daemon `prompt` success and RPC IDs are transport evidence only. Admission requires a persisted native-command entry or transition-state receipt tied to one logical transition identity and pre-dispatch transcript cursor.
- **R-CO-59 (GATE) — Bounded non-admission recovery.** Admission is checked immediately rather than by the long work heartbeat. If absent, the owner inspects persisted state and asks once about hidden command/compaction/error/phase events; only proven absence plus an idle target permits one same-identity retry, after which ambiguity or non-admission escalates.
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
- **R-CO-43 (GATE) — End-to-end proof.** Tests and concurrent dogfood prove role restoration across start, resume, fork, repeated compaction, and upgrade; movement among discussion, incubation, promotion, episode oversight, delivery, and feedback; sequential episodes with immutable prior evidence; side-discussion scope isolation; failure-closed split-brain and compatibility handling; full episode lifecycle; fresh EXPERT review; trigger and escalation behavior; report preservation followed by orphan-free recursive EXPERT retirement across failures and restart; busy-target transport-without-admission recovery without duplicate transition; owner-watch recovery of a missing report without false-stale interruption; immediate disarm after inactive-generation reconciliation; zero recurring polls during owner review or human wait; fresh re-arm for the next admitted generation; operator interruption; merge; cleanup; and non-interference.
