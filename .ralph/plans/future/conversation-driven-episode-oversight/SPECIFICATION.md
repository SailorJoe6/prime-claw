# Future Specification — Conversation-driven episode oversight

> **Status:** incubated future specification; manual proof-of-concept only.
> **Depends on:** [Reviewed future plans and worktree-isolated implementation episodes](../../archive/worktree-isolated-specification-episodes/SPECIFICATION.md)
> **Related work:** [Universal-agent and project-conversation manual POC](../universal-agent-project-conversation-poc/SPECIFICATION.md), [handoff continuation resilience](../../archive/handoff-continuation-resilience/SPECIFICATION.md), and [conversational Ralph command routing](../../archive/conversational-ralph-command-routing/SPECIFICATION.md)

## Purpose

Define and learn the role of a durable `PROJECT_CONVERSATION` that discusses and
incubates work with the operator, creates an isolated implementation `EPISODE`
after explicit approval, and oversees that episode through review, revision,
delivery, or abandonment.

This is intentionally a manual-first specification. The current goal is not to
build an autonomous controller. It is to run the workflow repeatedly with the
operator, record what actually needs coordination, and automate only stable,
repeated mechanics.

## Scope and hierarchy

```text
UNIVERSAL_AGENT
  └── PROJECT_CONTEXT — a managed local Git checkout
        ├── PROJECT_CONVERSATION A
        │     ├── incubated future work
        │     ├── one active EPISODE at a time
        │     └── fresh advisory EXPERT reviewers when useful
        └── PROJECT_CONVERSATION B
              └── its own work and episode
```

The `UNIVERSAL_AGENT` and `PROJECT_CONTEXT` are shown only for orientation. They
are not targets of this specification.

A `PROJECT_CONTEXT` is a local Git project, usually with an upstream remote. It
does not require a resident agent.

A `PROJECT_CONVERSATION` is a long-lived Prime Agent session whose working
directory is the root of that project checkout. It is the operator-facing
project and product thread. It discusses ideas, maintains incubated
specifications, reviews plans, creates and oversees episodes, reconciles delivery
and feedback, and remains useful after an episode ends.

An `EPISODE` is a temporary sibling session rooted in an isolated worktree. It
implements one approved future-plan bundle. The episode performs focused
production work; the project conversation remains the owner and reviewer.

The first proof of concept supports at most one active episode per project
conversation. Several conversations in the same project may be explored later,
but concurrency infrastructure is not part of the first manual run.

## Reviewed lifecycle

The landed worktree-isolated workflow establishes the front half of the
lifecycle:

```text
project discussion
  → specification under .ralph/plans/future/<slug>/
  → operator specification review
  → native /plan <future-folder>
  → operator plan review
  → native /implement-spec <future-folder>
  → isolated branch + worktree + inherited EPISODE session
  → canonical execute begins
```

Specification and planning remain in the project conversation. They do not
allocate episode resources. `/implement-spec` is the explicit implementation
boundary.

Once the episode exists, the manual oversight loop is:

```text
episode performs one bounded slice
  → episode stops and reports an exact pushed commit
  → project conversation independently reviews evidence
  → project conversation revises the slice, admits the next slice, or calls an EXPERT
  → repeat without a routine operator wait until the complete spec and plan are implemented
  → fresh final EXPERT reviews the exact merge candidate
  → project conversation adjudicates findings and drives any required repair slices
  → one final operator gate: approve merge | request revision | pause | abandon
  → after approval, merge; otherwise follow the operator's disposition
  → stop episode session and remove worktree safely after terminal disposition
  → return the project conversation to discussion and feedback
```

The project conversation is the active driver throughout implementation. An
intermediate slice boundary is an evidence and control point, not a routine HITL
gate. The operator may intervene at any time, but silence does not require the
project conversation to wait before continuing work already authorized by the
reviewed specification and plan.

A completed or abandoned episode becomes history. Later feedback stays in the
project conversation and, if promoted, creates a new episode rather than
reusing terminal authority or resources.

## Responsibilities

### Project conversation

The project conversation:

- preserves the operator's intent and the reviewed specification and plan;
- records the returned episode identity, branch, worktree, and session;
- admits only work within the implementation authority granted by
  `/implement-spec`;
- drives the episode through every bounded vertical slice needed to implement
  the complete reviewed specification and plan;
- independently checks each exact commit and its evidence, returns concrete
  findings for same-slice revision, and admits the next planned slice without a
  routine operator wait;
- pauses for the operator only at a real authority boundary, unresolved product
  decision, external blocker, explicit operator intervention, or final merge
  gate;
- decides when an intermediate fresh EXPERT review would reduce material risk;
- obtains and adjudicates a fresh final EXPERT review of the complete exact
  merge candidate;
- uses real native commands and supported session interfaces for transitions;
- prevents side discussions from silently changing the active episode;
- preserves useful review findings in the specification, plan, bead, or code as
  appropriate;
- presents one final HITL disposition before merge;
- oversees approved merge or explicit abandonment; and
- retires the episode resources after their terminal disposition is verified.

### Episode

The episode:

- works only in its assigned branch and worktree;
- follows the approved plan one bounded vertical slice at a time;
- keeps relevant plans, documentation, and beads current;
- runs and reports the agreed verification;
- commits and pushes its work;
- reports the exact commit, changed files, tests, limitations, and blockers; and
- stops at each slice boundary for project-conversation review rather than
  advancing itself through the lifecycle; the project conversation normally
  reviews and promptly admits the next bounded slice.

### Operator

During the manual proof of concept, the operator retains lifecycle authority.
Invoking `/implement-spec` authorizes the project conversation to drive the
reviewed specification and plan through all of their bounded implementation and
revision slices. It does not authorize scope expansion, merge, abandonment, or
destructive cleanup.

The operator may correct scope, pause work, request revision, abandon the
episode, or take over at any time. Routine intermediate progress does not wait
for affirmative operator approval. The required HITL gate occurs once the whole
specification is implemented, final verification and EXPERT review are complete,
and the exact merge candidate is ready. Repeated manual evidence must precede
any proposal to automate authority beyond these boundaries.

## Review and revision

An episode report is evidence, not approval. The project conversation checks the
actual branch, commit, diff, tests, documentation, and worktree state. Review is
always tied to an exact commit.

An intermediate review disposition is:

- **advance** — the reviewed slice is acceptable and the project conversation
  admits the next bounded slice already authorized by the plan;
- **revise** — specific findings and acceptance conditions return to the same
  slice without consuming a new lifecycle approval;
- **consult** — a fresh EXPERT reviews a material question or exact commit before
  the project conversation continues; or
- **pause** — a real blocker, authority boundary, or explicit operator request
  requires operator input.

Abandonment is a terminal operator disposition, not the default answer to an
ordinary failed slice. The project conversation should first drive bounded
revision or present a concrete blocker and recommendation.

Material findings must outlive transient reviewer conversation. They are written
into the most natural durable artifact: the specification for product behavior,
the execution plan or bead for remaining work, code and tests for regressions,
or a linked immutable review report for evidence. This specification does not
require separate requirements and decisions catalogs.

Revision stays on the same slice until its findings are resolved or the operator
changes the plan. Once resolved, the project conversation advances through the
remaining planned slices without waiting for a new operator prompt. Repeated
attempts without useful progress should be surfaced to the operator rather than
hidden behind an automatic retry limit or elaborate stagnation state machine.

## EXPERT review

A fresh EXPERT can provide an independent, read-only review of an exact commit.
The project conversation gives it only the relevant project context and review
packet, preserves and links its report, adjudicates its findings, and then stops
the reviewer.

During implementation, the project conversation uses judgment to call a fresh
EXPERT when independent review would materially reduce risk. It is especially
useful for security or credential boundaries, destructive cleanup, concurrency,
public compatibility, unusually broad changes, disputed evidence, or repeated
revision failures. The operator may also require an EXPERT at any time.

A fresh final EXPERT review is mandatory after the complete specification and
plan are implemented and before the final HITL merge gate. It reviews the exact
candidate commit. The project conversation adjudicates every material finding
and drives bounded repair work when needed. A materially changed candidate gets
a new final EXPERT review; an earlier report is not approval of later code.
Failure to obtain a required review pauses the workflow and is reported to the
operator; it does not silently downgrade the review.

The proof of concept should learn how much reviewer lifecycle management is
actually necessary. It must not pre-build a general reviewer registry,
descendant-cleanup engine, or durable review database before repeated runs show
that simpler session and artifact handling is insufficient.

## Monitoring active work

A heartbeat or watch is appropriate only while a specific admitted episode work
generation is actively running. It is not justified merely because an episode
exists, is awaiting review, or is waiting for operator input.

The watch should:

- identify the episode and expected work result;
- use a long, bounded cadence suitable for tests and tool calls;
- observe without steering active work;
- reconcile persisted messages, Git state, and the expected report when work
  becomes idle or stale; and
- stop as soon as that work generation is reconciled.

Repeated unchanged idle polling is a bug. A later admitted slice gets a new
watch. The manual runs should determine whether existing session identity and
heartbeat facilities are sufficient before any new monitoring store is designed.

## Native transitions and handoff

The project conversation uses the runtime's real registered commands and
supported interfaces. It does not paste a command's underlying skill text or
claim that transport acknowledgement proves task admission.

Before sending a transition, it checks that the intended episode is idle and at
the expected reviewed Git boundary. After sending, it verifies enough persisted
session evidence to know that the transition was admitted before assuming work
has started. Ambiguity is surfaced rather than answered with blind duplicate
retries.

The separate handoff-resilience specification owns compaction and execute-
continuation behavior. This oversight specification requires only that the
conversation use the accepted native transition and verify its observable
result.

## Side discussions and changing intent

Driving an episode is one temporary focus of the project conversation, not its
identity. The operator may discuss other work while an episode exists.

A side discussion remains incubated future work unless the operator explicitly
changes the active episode's approved scope. The conversation must not let a
focus shift, stale summary, or model inference silently alter the episode's
specification, plan, acceptance conditions, or lifecycle authority.

Clear operator corrections are authoritative. When they affect durable scope or
acceptance, the project conversation updates the appropriate artifact before the
next episode transition.

## Merge, abandonment, and cleanup

The project conversation may present the final HITL merge gate only after it has
reviewed the exact candidate commit, required tests, documentation, repository
state, and the mandatory final EXPERT report. A changed candidate invalidates
the earlier final review and requires renewed review before the gate.

Merge requires explicit operator approval at that final gate. The project
conversation must not infer approval from implementation authorization, operator
silence, successful tests, or a favorable EXPERT report.

Cleanup begins only after verified merge or explicit abandonment. It stops the
episode session before removing its worktree, preserves useful evidence, avoids
deleting dirty or ambiguous state, and removes local and remote branches only
when the terminal disposition calls for it.

Cleanup does not delete unrelated sessions, worktrees, branches, or another
conversation's resources. Historical transcripts and reports may remain as
inactive evidence even after live resources are retired.

## Living specification discipline

This incubating specification is durable working memory for conversations and
POC runs that may span many context compactions. The project conversation and
the universal-agent emulator must update it promptly when durable operator
intent, corrections, oversight findings, or workflow learnings emerge. They
must not wait for an end-of-run documentation pass or rely on transcripts,
model memory, or later compaction summaries to recover unrecorded design state.

Keep the specification current rather than append-only. Integrate each learning
into the relevant behavior or boundary, replace stale claims, and distinguish
observed facts from ideas that still need testing. When an implementation
episode already exists, updating this incubating document does not silently
change that episode's approved scope; scope changes still follow the explicit
review and authority rules above.

## Manual proof-of-concept observations

Each run should record concise evidence about:

- whether specification and plan review finished before `/implement-spec`;
- whether the created episode had the expected identity, CWD, branch, worktree,
  inherited context, and initial execute admission;
- what the project conversation needed to remember outside Git, plans, beads,
  and the session transcript;
- whether slice stops and reports gave the project conversation enough evidence
  to revise or advance promptly;
- whether the project conversation drove all planned slices without unnecessary
  operator waits;
- which intermediate or final EXPERT checks found real issues;
- which operator interventions changed the workflow;
- when a watch helped and when it became noise;
- how native transition admission was verified;
- how revision findings were preserved;
- whether merge or abandonment cleanup was safe; and
- which repeated manual steps are stable enough to automate.

The record should distinguish observed facts from proposed automation.

## Non-goals

The first manual proof of concept does not build:

- a universal-agent or project-context controller;
- unbounded autonomous authority outside an operator-approved specification and
  plan;
- a versioned role-manifest, lease, or policy-migration system;
- a transactional conversation or oversight database;
- an append-only transition journal;
- a general command receipt protocol;
- a complete episode orchestrator;
- multi-episode ownership by one conversation;
- a general EXPERT registry or recursive cleanup service; or
- automatic merge or destructive cleanup.

Any of these may be proposed later only when repeated runs provide evidence that
existing project artifacts and supported runtime mechanics are insufficient.

## Success criteria

The manual proof of concept succeeds when the operator and one project
conversation can:

1. review a future specification and plan before allocating resources;
2. create one episode through native `/implement-spec`;
3. observe bounded slices without intrusive polling;
4. independently review each exact pushed commit and drive same-slice revisions
   or the next planned slice without routine operator waits;
5. continue until the complete specification and plan are implemented;
6. call intermediate EXPERT reviews when judgment says they add value;
7. obtain, preserve, and adjudicate a mandatory final EXPERT review of the exact
   merge candidate;
8. present one final HITL gate and merge only after explicit operator approval,
   or follow an explicit pause, revision, or abandonment disposition;
9. stop the episode and clean up its worktree safely; and
10. return to ordinary project discussion with the episode retained only as
    history.

The run should end with a short lessons-learned record. Automation is a later
product decision based on repeated evidence, not an acceptance requirement for
this specification.
