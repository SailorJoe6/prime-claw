# Decisions — Conversation-driven episode oversight

> **Status:** incubated future decisions.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)

## D-CO-1 — Conversations, not project contexts, own episodes

**Decision:** `PROJECT_CONTEXT` remains the managed canonical Git boundary. The `UNIVERSAL_AGENT` launches `PROJECT_CONVERSATION` agents inside it, and each conversation creates and drives its own episode.

**Satisfies:** R-CO-1, R-CO-2, R-CO-3.

**Rationale:** The current POC is one conversation coordinating one durable worktree episode. Adding a mandatory context agent would insert an unproven control layer.

## D-CO-2 — Automate the complete lifecycle

**Decision:** The overseer covers disposition through merge or abandonment and cleanup rather than automating only the execute loop.

**Satisfies:** R-CO-3, R-CO-4, R-CO-35, R-CO-36, R-CO-37.

**Rationale:** The difficult judgment and recovery boundaries occur before, during, and after execution. A partial controller would leave the most important ownership transitions implicit.

## D-CO-3 — Grant authority only after manual proof

**Decision:** The conversation ultimately has autonomous gate and transition authority, while the operator retains interrupt and takeover control. Release proceeds through staged dogfood after repeated manual runs.

**Satisfies:** R-CO-4, R-CO-5, R-CO-34, R-CO-41, R-CO-42.

**Rationale:** The operator is currently teaching the workflow by driving it. The purpose of the POC is to discover safe evidence and decision contracts before removing per-gate confirmation.

## D-CO-4 — Narrow the first release to one episode per conversation

**Decision:** One conversation drives at most one active episode initially, while many project conversations and their episodes operate concurrently. Multiple episodes per conversation remain a planned extension.

**Satisfies:** R-CO-6, R-CO-7, R-CO-8, R-CO-38.

**Rationale:** Worktrees exist to permit broad project concurrency. Limiting owner cardinality simplifies the first state machine without weakening concurrency across users or conversations.

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

## D-CO-18 — Install an owner-side long-poll watch for every episode

**Decision:** Immediately after an episode is successfully activated, its owning
conversation creates a durable liveness watch keyed by the episode's stable
identity. The normal active-work interval is configurable and at least the
15-minute class. Explicit reports can wake the owner earlier, but neither their
arrival nor their absence is trusted as the sole lifecycle signal. A poll is
read-only and non-disruptive while work is active. If an episode becomes idle,
completed, failed, or stale without the expected packet, the conversation
recovers status and evidence from the session, oversight record, Git, plans, and
beads and proceeds to independent review or escalation. The watch survives owner
compaction/restart, prevents concurrent duplicate polls, and ends only at
verified terminal disposition or explicit operator cancellation.

**Satisfies:** R-CO-2, R-CO-3, R-CO-9, R-CO-10, R-CO-12, R-CO-13, R-CO-50,
R-CO-51, R-CO-52, R-CO-53.

**Rationale:** In the Slice 2 POC, the episode finished and pushed `14e5cfa` with
passing suites but did not send its final completion packet. The conversation
found the result only by explicitly inspecting the sibling session. Agent
messages are best-effort collaboration signals, and long-running work can be
quiet for many minutes. An owner-controlled long poll provides liveness without
interrupting valid work and preserves the rule that only independently verified,
durable evidence can advance a gate.


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
