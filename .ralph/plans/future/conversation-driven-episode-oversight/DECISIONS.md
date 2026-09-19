# Decisions — Conversation-driven episode oversight

> **Status:** incubated future decisions.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)

## D-CO-1 — Conversations, not project contexts, own episodes

**Decision:** `PROJECT_CONTEXT` remains the managed canonical Git boundary. The
`UNIVERSAL_AGENT` launches durable `PROJECT_CONVERSATION` agents inside it, and
each conversation creates and drives its own production episodes while retaining
identity across discussion, incubation, delivery, feedback, and sequential work.

**Satisfies:** R-CO-1, R-CO-2, R-CO-3.

**Rationale:** The current POC is one conversation coordinating one durable worktree episode. Adding a mandatory context agent would insert an unproven control layer.

## D-CO-2 — Automate the complete lifecycle

**Decision:** The durable conversation covers discussion, incubation, promotion,
episode disposition through merge or abandonment and cleanup, and post-delivery
feedback rather than automating only the execute loop.

**Satisfies:** R-CO-3, R-CO-4, R-CO-35, R-CO-36, R-CO-37.

**Rationale:** The difficult judgment and recovery boundaries occur before, during, and after execution. A partial controller would leave the most important ownership transitions implicit.

## D-CO-3 — Grant authority only after manual proof

**Decision:** The conversation ultimately has autonomous gate and transition authority, while the operator retains interrupt and takeover control. Release proceeds through staged dogfood after repeated manual runs.

**Satisfies:** R-CO-4, R-CO-5, R-CO-34, R-CO-41, R-CO-42.

**Rationale:** The operator is currently teaching the workflow by driving it. The purpose of the POC is to discover safe evidence and decision contracts before removing per-gate confirmation.

## D-CO-4 — Narrow the first release to one active episode per conversation

**Decision:** One durable conversation drives at most one active episode
initially, may own many sequential episodes over its lifetime, and retains their
terminal lineage. Multiple project conversations and their active episodes may
operate concurrently. Multiple active episodes per conversation remain a
planned extension.

**Satisfies:** R-CO-6, R-CO-7, R-CO-8, R-CO-38, R-CO-66.

**Rationale:** Worktrees exist to permit broad project concurrency. Limiting
active owner cardinality simplifies the first state machine without weakening
concurrency across users or conversations, and avoids conflating "one active"
with "one ever."


## D-CO-5 — Persist an evidence-bound oversight state machine

**Decision:** Store episode identity, phase, reviewed commits, findings, approvals, command receipts, escalation, and terminal state durably with atomic idempotent transitions.

**Satisfies:** R-CO-9, R-CO-10, R-CO-11, R-CO-12, R-CO-16.

**Rationale:** Compaction, restarts, and daemon recovery are normal. Neither transcript interpretation nor live Python objects are safe lifecycle authorities.

## D-CO-6 — The conversation independently owns gate decisions

**Decision:** The episode supplies a commit-bound evidence packet; the conversation verifies it and records approve, revise, escalate, or abandon with structured findings.

**Satisfies:** R-CO-11, R-CO-13, R-CO-14, R-CO-15, R-CO-17.

**Rationale:** Self-reported completion is useful routing information but cannot be the approval mechanism. Stable findings also make revision progress measurable.

## D-CO-7 — Make EXPERT expertise project-scoped but invocations fresh

**Decision:** Version an EXPERT profile with the project, then create a clean, short-lived reviewer for each gate using the strongest operator-authorized model.

**Satisfies:** R-CO-18, R-CO-19, R-CO-20.

**Rationale:** Project-scoped knowledge lets the architect role evolve with the codebase. Fresh invocations avoid context rot, cross-episode contamination, serialization bottlenecks, and attachment to prior approvals.

## D-CO-8 — Keep the EXPERT advisory and independent

**Decision:** EXPERT reviewers are read-only, review exact commits, return structured reports to the conversation, and possess no episode or lifecycle mutation authority.

**Satisfies:** R-CO-21, R-CO-38, R-CO-39, R-CO-40.

**Rationale:** The conversation must adjudicate multiple sources of evidence. Allowing a reviewer to steer or edit the subject would weaken independence and blur ownership.

## D-CO-9 — Require EXPERT review at core gates and risky slices

**Decision:** Specifications, plans, and final merge candidates always receive EXPERT review. Slice review is triggered by the enumerated risk, novelty, breadth, evidence, disagreement, and failure conditions.

**Satisfies:** R-CO-22, R-CO-23, R-CO-35.

**Rationale:** Mandatory architectural gates address correlated blind spots. Risk-based slice review controls model cost without treating routine, well-proven work like high-risk change.

## D-CO-10 — Fail closed when the EXPERT is unavailable

**Decision:** Required EXPERT unavailability pauses the controller and calls the human; the default model is not a silent substitute.

**Satisfies:** R-CO-20, R-CO-24, R-CO-28.

**Rationale:** A fallback with similar capabilities would falsely claim the independent high-capability review the gate requires.

## D-CO-11 — Escalate stagnation, not discovery

**Decision:** Two consecutive revisions with no meaningful improvement call the human. Meaningful progress resets the counter, and a new finding after a successful fix is evidence that review is working rather than a failure.

**Satisfies:** R-CO-25, R-CO-26, R-CO-27, R-CO-28, R-CO-29.

**Rationale:** Counting findings would punish thorough review. Counting consecutive non-improvement detects a stuck loop while allowing iterative hardening.

## D-CO-12 — Dispatch real commands through the episode runtime

**Decision:** The conversation checks the episode command catalog and invokes custom commands through Prime Agent's command/prompt path with unique admission and receipts. Collaboration messages do not substitute for command execution.

**Satisfies:** R-CO-30, R-CO-31, R-CO-32, R-CO-34.

**Rationale:** The POC remotely invoked the registered `/handoff`; its extension prepared compaction and injected canonical `execute`. Pasting the handoff skill would bypass the behavior under test.

## D-CO-13 — Review one bounded slice before advancing

**Decision:** Each execute phase completes one vertical slice and stops. The conversation verifies the pushed commit and required evidence before authorizing another native `/handoff`.

**Satisfies:** R-CO-13, R-CO-17, R-CO-23, R-CO-32, R-CO-33.

**Rationale:** Bounded slices create frequent inspectable checkpoints and keep correction costs low. Approval tied to a commit prevents post-review drift.

## D-CO-14 — Bind merge authorization to the final reviewed commit

**Decision:** The conversation may merge autonomously only after complete readiness and mandatory EXPERT review of the exact candidate. Any candidate change reopens the gate.

**Satisfies:** R-CO-16, R-CO-35, R-CO-36.

**Rationale:** “The branch was approved” is unsafe when the branch can move. Commit-bound authority makes the merge decision reproducible.

## D-CO-15 — Clean up only after terminal disposition

**Decision:** Retire the episode and remove its worktree only after verified merge or explicit abandonment, while preserving durable oversight evidence.

**Satisfies:** R-CO-37, R-CO-38, R-CO-39.

**Rationale:** Review fixes and rebases require the episode root. Terminal evidence is still needed after the physical worktree is gone.

## D-CO-16 — Prove concurrency, recovery, and intervention before release

**Decision:** Acceptance requires automated coverage and disposable concurrent dogfood, including restart recovery, operator interruption, EXPERT failure, stagnation, exactly-once transitions, merge, cleanup, and cross-episode isolation.

**Satisfies:** R-CO-7, R-CO-10, R-CO-24, R-CO-26, R-CO-31, R-CO-34, R-CO-38, R-CO-41, R-CO-42, R-CO-43.

**Rationale:** The system's value is safe autonomous coordination under real concurrency. Happy-path unit tests cannot prove that contract.

## D-CO-17 — Persist findings before a guided same-gate handoff

**Decision:** A failed gate does not immediately resume implementation. The
conversation first has the episode encode accepted material findings into the
authoritative requirements, decisions, specification, execution plan, and bead
as applicable. After verifying that durable state, it invokes native `/handoff`
with explicit same-gate revision guidance, inspects the resulting compaction
summary, and only then permits canonical `execute` to begin the revision.
Auto-compaction cannot substitute for or authorize this transition.

**Satisfies:** R-CO-9, R-CO-12, R-CO-15, R-CO-16, R-CO-44, R-CO-45,
R-CO-46, R-CO-47, R-CO-48, R-CO-49.

**Rationale:** In the Slice 2 POC, EXPERT findings were persisted while an
auto-compaction was in flight. The later compaction summary omitted every
finding and incorrectly named Slice 3 as next, even though the episode
subsequently received the findings and revised Slice 2. The outcome was correct
by message timing, not by a trustworthy primer. Product knowledge from review
must outlive transcripts, and a verified guided handoff must establish the next
execution context.

## D-CO-18 — Scope the owner watch to one admitted episode work generation

**Decision:** The owning conversation creates a durable liveness watch only after
an episode task or native command is durably admitted and before control is
yielded. The watch is keyed by stable episode identity plus a unique work-
generation identity and expected packet. Its normal active-work interval is
configurable and at least the 15-minute class. Explicit reports can wake the
owner earlier, but neither arrival nor absence alone approves a gate.

A poll is read-only and non-disruptive while episode work is active. When the
watched generation becomes idle, completed, failed, or stale, the owner performs
one bounded reconciliation using session activity, the oversight record, Git,
plans, and beads and requests at most one missing packet when useful. Once the
result is recovered or verified—or owner review, EXPERT review, merge
adjudication, or human input is the only remaining dependency—the recurring
watch is cancelled and durably marked disarmed. An episode can remain alive,
idle, and nonterminal without a heartbeat. A new work generation installs a
fresh watch before the owner yields control again.

While armed, watch state survives owner compaction/restart, follows stable
identity across active-session replacement, and prevents duplicate pollers.
Runtime labels never grant gate authority, but repeated unchanged idle checks
are prohibited after reconciliation. Owner blockage is recorded as owner state;
it is never projected onto an idle episode.

**Satisfies:** R-CO-2, R-CO-3, R-CO-9, R-CO-10, R-CO-12, R-CO-13, R-CO-50,
R-CO-51, R-CO-52, R-CO-53, R-CO-60.

**Rationale:** In the Slice 2 POC, a watch correctly recovered a missed episode
completion packet. Later, after the episode completed a documentation-only turn,
sent its packet, and became idle awaiting owner verification, the watch remained
scheduled because the episode lifecycle was still nonterminal. The owner then
misread an optional threat-model choice as mandatory human input, projected that
owner-level wait onto the sibling, and emitted 13 unchanged heartbeat reports
over roughly 3 hours 15 minutes. Durable episode lifetime, active episode work,
and owner decision state are separate. A work-generation-scoped watch preserves
missed-report recovery without spending context on an inactive sibling.


## D-CO-19 — Preserve each EXPERT result, then retire its invocation tree

**Decision:** The owning conversation tracks every fresh EXPERT invocation and
all reviewer-delegated descendants as one cleanup scope. Once it has preserved
and checked the report, runnable evidence, exact candidate identity, and
invocation metadata—or recorded why the review failed—it explicitly deletes the
reviewer tree and verifies roster absence. Success, failure, cancellation,
timeout, missed reply, and admission races share this teardown protocol.
Interrupted teardown is durable `cleanup-pending` work and retries idempotently
after restart. A runtime status such as `completed` or `idle` neither substitutes
for artifact preservation nor excuses cleanup.

**Satisfies:** R-CO-9, R-CO-10, R-CO-19, R-CO-21, R-CO-24, R-CO-38,
R-CO-54, R-CO-55, R-CO-56.

**Rationale:** Manual Slice 2 reviews showed that an EXPERT can finish useful
work—or exit during the bootstrap/admission race—while its subagent remains
listed as idle. Repeated gates would otherwise accumulate stale reviewers,
confuse liveness inspection, consume runtime resources, and risk acting on the
wrong invocation. Artifact-first recursive teardown preserves auditability while
making “fresh, short-lived reviewer” an enforceable lifecycle rather than a
prompt convention.


## D-CO-20 — Separate transport acknowledgement from native-command admission

**Decision:** The conversation dispatches a native episode command only after an
idle/not-compacting/empty-queue preflight tied to the stable episode, expected
active session, Git/gate boundary, logical transition identity, and transcript
cursor. Daemon `prompt` success and RPC IDs are transport acknowledgements only;
they never authorize waiting, progression, or exactly-once claims. The owner
immediately checks for a persisted native-command or transition-state admission.
If none exists, it checks stable evidence and asks the episode once about hidden
events. Proven absence plus a newly idle target permits one retry of the same
logical transition. A second non-admission or unresolved ambiguity pauses and
calls the human. Long-work heartbeats begin only after admission and compute
elapsed time from actual timestamps, not scheduled interval assumptions.

**Satisfies:** R-CO-9, R-CO-10, R-CO-12, R-CO-31, R-CO-32, R-CO-51,
R-CO-57, R-CO-58, R-CO-59.

**Rationale:** During the ASTRA-10–15 same-Slice-2 handoff, `/handoff` was sent
while the episode was finishing another turn. The daemon returned
`success: true` with RPC ID `daemon_2`, but no command entry, compaction, or
`execute` transition was persisted. The owner mistakenly treated transport
success as admission and left both agents idle. The same RPC ID appeared on the
later successful retry, proving it was neither unique nor durable. Idle
preflight, prompt admission evidence, and bounded same-identity recovery prevent
both silent command loss and blind duplicate transitions.


## D-CO-21 — Bind a versioned conversation role; do not rely on a template alone

**Decision:** `PROJECT_CONVERSATION` is represented by a Git-versioned role
manifest plus a durable per-session role binding and owner lease. A specialized
agent profile or template is the operator-facing entry point, but prompt text,
session name, CWD, transcript, skills, continual-harness entries, and REPL state
cannot establish identity or mutation authority.

**Satisfies:** R-CO-2, R-CO-9, R-CO-12, R-CO-61, R-CO-62, R-CO-63, R-CO-69,
R-CO-70, R-CO-72.

**Rationale:** The role must survive repeated compaction, restart, focus changes,
and sequential episodes. A static template can explain duties but cannot prevent
fork split-brain, prove ownership, pin a policy version, or recover lifecycle
truth. A binding and lease make the profile a durable role instead of a persona.


## D-CO-22 — Separate role identity, conversational focus, commitments, and authority

**Decision:** The controller models four independent dimensions: durable role
binding; current conversational focus; active bounded commitments such as an
episode or review; and authority mode. Focus may move among discussion,
incubation, promotion, episode oversight, delivery, and feedback without
changing role identity. An active episode commitment remains explicit when
attention moves elsewhere.

**Satisfies:** R-CO-3, R-CO-5, R-CO-61, R-CO-64, R-CO-67, R-CO-71.

**Rationale:** A project conversation is not permanently an episode supervisor.
It naturally moves from casual discussion into implementation and back to user
feedback. Treating those as different agents loses continuity; treating focus as
an exclusive lifecycle state drops active duties or lets side discussion mutate
scope. Orthogonal dimensions preserve both natural conversation and control.


## D-CO-23 — Keep conversation history separate from episode authority

**Decision:** A durable conversation thread record stores intent, decisions,
incubated specifications, focus, feedback, commitments, and episode lineage.
Every promoted episode receives a separate oversight journal and snapshot.
Terminal episode evidence remains immutable; later feedback either stays in the
conversation or creates a new explicitly linked episode and never inherits old
approvals, watches, commands, or commit authority.

**Satisfies:** R-CO-6, R-CO-9, R-CO-10, R-CO-11, R-CO-65, R-CO-66,
R-CO-67.

**Rationale:** Product understanding outlives one implementation burst, while
execution authority must stay exact and bounded. One undifferentiated record
would either discard valuable continuity or accidentally float approvals and
scope across releases.


## D-CO-24 — Reassert the role and minimum duty pack at every context boundary

**Decision:** Trusted controller logic validates the role binding, lease,
versions, conversation record, and active oversight record on start, resume,
daemon restart, fork or clone, every agent turn, and after compaction. It then
injects the invariant role kernel, the minimum duty packs required by current
focus and commitments, and a compact authoritative state envelope. The envelope
is a projection and never overrides the source records.

For the manual prototype, Prime Agent 0.9.5 project-local extension hooks such as
`session_start`, `before_agent_start`, fork hooks, compaction hooks, persistent
custom entries, and session-manager identity can prove this design in
`observe` or `operator-confirmed` mode. Production still requires typed
bindings, transactional records, capability-gated transitions, and durable
receipts, whether supplied by Prime Agent core or a reviewed Prime Claw
controller.

**Satisfies:** R-CO-9, R-CO-12, R-CO-62, R-CO-63, R-CO-68, R-CO-70,
R-CO-71, R-CO-72.

**Rationale:** Compaction summaries and relevance-ranked harness reminders are
lossy by design. Loading the complete oversight manual during casual discussion
wastes context, while failing to reload it during active execution causes role
drift. Validated focus-specific projection restores exactly the duties needed
without confusing memory with authority.


## D-CO-25 — Fail closed at fork, lease, version, and integrity ambiguity

**Decision:** A fork or clone of a bound conversation starts without mutation
authority until trusted control atomically transfers the existing lease, creates
a new conversation identity with no inherited active episode, or marks the new
session analysis-only. Missing, duplicate, corrupt, stale, incompatible, or
split-brain binding or state enters explicit recovery, pause, or revocation.
Migrations are deterministic, versioned, atomic or replay-safe, and audited.

**Satisfies:** R-CO-10, R-CO-38, R-CO-63, R-CO-68, R-CO-69, R-CO-70,
R-CO-71.

**Rationale:** Prime Agent sessions can resume, fork, clone, compact, and change
active runtime identity. Ancestry and copied context are useful evidence but do
not decide which session owns lifecycle authority. Failure-closed lease and
compatibility checks prevent two plausible conversations from steering one
episode or silently changing policy mid-gate.
