# Future Specification — Conversation-driven episode oversight

> **Status:** incubated future specification; manual proof-of-concept only.
> **Depends on:** [Reviewed future plans and worktree-isolated implementation episodes](../../archive/worktree-isolated-specification-episodes/SPECIFICATION.md)
> **Related work:** [Handoff continuation resilience](../handoff-continuation-resilience/SPECIFICATION.md) and [conversational Ralph command routing](../conversational-ralph-command-routing/SPECIFICATION.md)

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
  → operator/conversation disposition: approve | revise | pause | abandon
  → approved next work uses the real native transition
  → repeat until merge-ready or abandoned
  → merge or explicit abandonment
  → stop episode session and remove worktree safely
  → return the project conversation to discussion and feedback
```

A completed or abandoned episode becomes history. Later feedback stays in the
project conversation and, if promoted, creates a new episode rather than
reusing terminal authority or resources.

## Responsibilities

### Project conversation

The project conversation:

- preserves the operator's intent and the reviewed specification and plan;
- records the returned episode identity, branch, worktree, and session;
- admits only the work the operator has approved;
- independently checks the episode's exact commit and evidence;
- decides, with the operator, whether to approve, revise, pause, or abandon;
- uses real native commands and supported session interfaces for transitions;
- prevents side discussions from silently changing the active episode;
- preserves useful review findings in the specification, plan, bead, or code as
  appropriate;
- oversees merge or explicit abandonment; and
- retires the episode resources after their terminal disposition is verified.

### Episode

The episode:

- works only in its assigned branch and worktree;
- follows the approved plan one bounded vertical slice at a time;
- keeps relevant plans, documentation, and beads current;
- runs and reports the agreed verification;
- commits and pushes its work;
- reports the exact commit, changed files, tests, limitations, and blockers; and
- stops for owner review rather than advancing itself through the lifecycle.

### Operator

During the manual proof of concept, the operator retains lifecycle authority.
The operator may correct scope, pause work, request revision, approve a gate,
abandon the episode, or take over at any time. The project conversation may make
recommendations and perform explicitly authorized mechanics, but repeated manual
evidence must precede any proposal for autonomous authority.

## Review and revision

An episode report is evidence, not approval. The project conversation checks the
actual branch, commit, diff, tests, documentation, and worktree state. Review is
always tied to an exact commit.

A review disposition is:

- **approve** — the reviewed result is acceptable and the operator may authorize
  the next slice or terminal action;
- **revise** — specific findings and acceptance conditions return to the same
  slice;
- **pause** — more information or operator input is required; or
- **abandon** — preserve evidence and enter safe cleanup.

Material findings must outlive transient reviewer conversation. They are written
into the most natural durable artifact: the specification for product behavior,
the execution plan or bead for remaining work, code and tests for regressions,
or a linked immutable review report for evidence. This specification does not
require separate requirements and decisions catalogs.

Revision stays on the same slice until its findings are resolved or the operator
changes the plan. Repeated attempts without useful progress should be surfaced
to the operator rather than hidden behind an automatic retry limit or elaborate
stagnation state machine.

## EXPERT review

A fresh EXPERT can provide an independent, read-only review of an exact commit.
The project conversation gives it only the relevant project context and review
packet, preserves and links its report, adjudicates its findings, and then stops
the reviewer.

During manual dogfood, EXPERT review is especially useful for specifications,
plans, final merge readiness, security or credential boundaries, destructive
cleanup, concurrency, public compatibility, unusually broad changes, or disputed
test evidence. The operator decides when it is required. Failure to obtain a
required review pauses the workflow; it does not silently downgrade the review.

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

The project conversation may recommend merge only after reviewing the exact
candidate commit, required tests, documentation, repository state, and any
required independent review. A changed candidate invalidates the earlier review.

Cleanup begins only after verified merge or explicit abandonment. It stops the
episode session before removing its worktree, preserves useful evidence, avoids
deleting dirty or ambiguous state, and removes local and remote branches only
when the terminal disposition calls for it.

Cleanup does not delete unrelated sessions, worktrees, branches, or another
conversation's resources. Historical transcripts and reports may remain as
inactive evidence even after live resources are retired.

## Manual proof-of-concept observations

Each run should record concise evidence about:

- whether specification and plan review finished before `/implement-spec`;
- whether the created episode had the expected identity, CWD, branch, worktree,
  inherited context, and initial execute admission;
- what the project conversation needed to remember outside Git, plans, beads,
  and the session transcript;
- whether one-slice stops and reports were clear;
- which independent checks found real issues;
- which operator corrections changed the workflow;
- when a watch helped and when it became noise;
- how native transition admission was verified;
- how revision findings were preserved;
- whether merge or abandonment cleanup was safe; and
- which repeated manual steps are stable enough to automate.

The record should distinguish observed facts from proposed automation.

## Non-goals

The first manual proof of concept does not build:

- a universal-agent or project-context controller;
- autonomous lifecycle authority;
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
3. observe one bounded slice without intrusive polling;
4. independently review its exact pushed commit;
5. request and verify a same-slice revision or approve the next transition;
6. use a fresh EXPERT review when chosen and preserve its report;
7. reach verified merge or explicit abandonment;
8. stop the episode and clean up its worktree safely; and
9. return to ordinary project discussion with the episode retained only as
   history.

The run should end with a short lessons-learned record. Automation is a later
product decision based on repeated evidence, not an acceptance requirement for
this specification.
