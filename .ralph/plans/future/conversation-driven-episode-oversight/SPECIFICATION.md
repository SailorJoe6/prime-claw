# Future Specification — Conversation-driven episode oversight

> **Status:** incubated future specification; not approved for planning or implementation.
> **Depends on:** worktree-isolated specification episodes (`prime-claw-h6w`).
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

## 1. Purpose

Prime Claw needs an evidence-driven control loop in which a durable
`PROJECT_CONVERSATION` creates and owns an isolated `EPISODE`, reviews its work,
and drives it through the complete Ralph lifecycle. The episode performs focused
production work. The conversation acts as the autonomous overseer: it decides
whether an artifact passes, requests revisions, invokes native phase transitions,
and advances or pauses the episode.

This specification records the workflow currently being learned through a
manual proof. It is intentionally incubated until repeated operator-driven runs
show that the review gates, evidence, escalation rules, and command mechanics are
safe enough to automate.

## 2. Agent hierarchy and responsibilities

```text
UNIVERSAL_AGENT
  └── PROJECT_CONTEXT — managed canonical Git project; not necessarily an agent
        ├── PROJECT_CONVERSATION A — durable conversational owner/overseer
        │     ├── EPISODE A — isolated branch, worktree, and production session
        │     └── EXPERT review instances — fresh, project-scoped reviewers
        └── PROJECT_CONVERSATION B
              ├── EPISODE B
              └── EXPERT review instances
```

The `UNIVERSAL_AGENT` creates or clones project contexts and launches
conversations in the correct canonical checkout. A conversation creates and
owns its episode, drives the Ralph loop, and remains the authority for lifecycle
transitions. A project context does not require a resident agent of its own.

For the first release, one conversation may drive at most one active episode.
Many conversations in the same project must be able to drive one episode each
concurrently. Supporting several active episodes per conversation is an explicit
later extension, not a permanent architectural restriction.

## 3. Full lifecycle

The automated workflow covers the episode from beginning to end:

```text
conversation interview and disposition
  → episode allocation and admission
  → specification production and review
  → planning and plan review
  → one vertical execution slice
  → slice review and handoff
  → repeated slices
  → final readiness and expert review
  → PR merge or explicit abandonment
  → episode retirement and safe worktree cleanup
```

The conversation has authority to approve gates and advance the episode without
per-gate human confirmation. The operator may observe, pause, redirect, or take
over at any time. Automation is not released as the default until manual runs
have produced sufficient evidence that this authority is safe.

## 4. Durable oversight state

Each episode shall have a durable, machine-readable oversight record owned by
the conversation. It shall identify at least:

- project, owner conversation, episode session, branch, worktree, and PR;
- current lifecycle phase and gate;
- exact artifact and commit under review;
- last accepted phase or slice;
- outstanding findings and their disposition;
- EXPERT invocations, delegated descendants, reports, and cleanup state;
- revision attempts and stagnation count;
- native commands admitted and their receipts;
- the owner-side liveness watch, last observation, expected report or gate, and
  missed-report recovery state; and
- blockers, human escalations, merge disposition, and cleanup state.

The record must survive compaction, kernel loss, session restart, daemon restart,
and owner resumption. State transitions must be atomic and idempotent. Transcript
prose and in-memory handles are evidence, not the sole authority.

### Owner-side episode watch

Immediately after successfully activating an episode, the owning conversation
shall install a durable liveness watch before it yields control. The watch is
owned by the conversation, not the episode: an episode completion message is a
useful fast path but cannot be the only mechanism that wakes the owner or
advances review.

The normal active-work observation cadence is deliberately long and
configurable, with 15 minutes or more as the default class of interval. An
episode can legitimately spend that long in tests, review, or one tool call.
The watch therefore observes without interrupting or steering active work and
does not infer failure from one quiet interval. Explicit episode reports may
wake the owner sooner.

Each observation resolves the durable episode identity even if its active
session identifier changed, then compares runtime activity with the authoritative
oversight record, Git branch/worktree, plans, and bead state. If work is active,
the owner records progress and reschedules. If the episode is idle, completed,
failed, or stale without the expected report, the owner recovers the result from
persisted evidence, requests at most one missing packet when useful, and begins
independent gate verification or escalation. Runtime labels such as `idle`,
`completed`, and `child-exited`, and the presence or absence of a message, never
constitute gate approval by themselves.

The watch and its lease/checkpoint survive owner compaction and restart, prevent
overlapping duplicate polls, and remain active through every nonterminal gate.
It is retired only after the owner verifies terminal merge or abandonment and
records episode retirement, or after an explicit operator cancellation. A
missing report must delay neither review nor safe recovery.

## 5. Review protocol

At every gate the episode first produces a review packet tied to an exact pushed
commit. The packet includes the artifact or diff, applicable requirements and
plan slice, tests and other verification evidence, documentation changes, bead
state, branch/push status, and known limitations.

The conversation independently inspects the repository and evidence. It does
not approve a gate solely because the episode reports success. A decision is one
of:

- **approve** — record the evidence and authorize the next transition;
- **revise** — adjudicate and durably incorporate findings before returning the
  same phase or slice to execution;
- **escalate** — pause automation and call the human with a complete decision
  packet; or
- **abandon** — enter the explicit safe-abandonment path when authorized.

Findings need stable identities, severity, evidence, affected requirement or
slice, and acceptance condition. Re-review occurs against a new exact commit and
records whether each prior finding is satisfied, improved, unchanged, rejected
with evidence, or superseded.

An accepted material finding is product knowledge, not transient reviewer
conversation. Before revision begins, the conversation and episode shall trace
it into the authoritative artifacts appropriate to its meaning:

- a missing or changed behavioral invariant updates `REQUIREMENTS.md`;
- a changed architectural or safety choice updates `DECISIONS.md` and its
  requirement traceability;
- scope, state-machine, or acceptance changes update `SPECIFICATION.md`;
- implementation and verification work updates `EXECUTION_PLAN.md` and the
  active slice bead; and
- the immutable EXPERT report remains linked as evidence with its reviewed
  commit and finding IDs.

A finding already covered by an existing requirement or decision need not create
duplicate product prose, but the plan and bead must link it to that authority and
record its concrete regression acceptance. No failed gate may depend only on a
transcript, ephemeral message, or external report path.

## 6. EXPERT reviewer model

Each project context has a versioned EXPERT profile whose definition, skills,
architecture context, review rubrics, model policy, and project-specific lessons
can evolve with the project. The profile is durable; the reviewer session is
not.

Every review starts a fresh, short-lived EXPERT instance with clean context. It
loads the project profile and only the review packet and project material needed
for the gate. It uses the most capable model the operator has authorized for the
EXPERT role. The model selector is configurable rather than hard-coded.

The EXPERT is advisory and read-only by default. It reviews an exact commit,
returns structured findings to the owning conversation, and terminates. It does
not steer the episode, mutate its worktree, approve a gate, merge, or clean up.
The conversation adjudicates the report and retains lifecycle authority.

The owning conversation also owns the complete EXPERT invocation lifecycle. It
records the reviewer and any descendants, exact review identity, artifact
location, deadline, and cleanup state. After the report and runnable evidence
are copied to durable owner-controlled storage and independently checked, the
conversation explicitly retires the reviewer and its delegated descendants and
verifies that they no longer appear as live or idle invocation resources. A
runtime `completed`, `idle`, or `child-exited` label is not enough to delete a
review whose report has not been preserved or whose failure has not been
adjudicated.

Failure, cancellation, timeout, missed reply, and bootstrap/admission races use
the same bounded teardown path. If usable artifacts exist, they are preserved
before teardown; otherwise the durable review record explains the failure. An
interrupted or failed deletion remains `cleanup-pending`, is retried
idempotently after owner restart, and cannot silently accumulate orphaned
reviewers. Recursive cleanup is scoped to the exact invocation tree and must not
delete another conversation's reviewer or any episode resource.

EXPERT review is mandatory for:

1. every completed specification before planning;
2. every completed execution plan before execution; and
3. final pre-merge readiness.

A slice also requires EXPERT review when it involves any of:

- security or credential boundaries;
- concurrency, locking, or distributed state;
- destructive cleanup or recovery;
- database or durable-state migrations;
- public APIs or compatibility commitments;
- a large or unusually broad diff;
- weak, missing, or disputed test evidence;
- disagreement between conversation and episode;
- a novel mechanism not proven by an earlier slice; or
- a failed slice or repeated revision cycle.

The policy may sample ordinary slices for calibration. If a required or
triggered EXPERT cannot run, the conversation must pause and call the human. It
must not silently substitute the default model or waive the review.

## 7. Revision and escalation

The revision loop measures stagnation, not the total number of findings. Fixing
a finding to the EXPERT's satisfaction is successful intervention even if the
next review discovers a different issue. Meaningful but incomplete progress also
does not count as stagnation.

A failed gate remains on the same specification, plan, or execution slice. The
conversation first sends the adjudicated findings with an instruction to update
the authoritative specification bundle, execution plan, and bead as applicable,
but not to implement yet. It verifies that the resulting durable artifacts name
the findings, controlling requirements and decisions, exact reviewed commit,
acceptance conditions, and intended same-slice revision.

Only after that durable update does the conversation start the revision
iteration through a controlled compaction boundary. The preferred first-release
path invokes the native `/handoff` with explicit guidance naming the failed gate,
finding IDs, acceptance conditions, and same phase or slice. Here `/handoff`
means “prepare the next execute iteration”; it does not imply approval or
advancement to the next numbered slice.

Two consecutive revisions with no meaningful improvement trigger human
escalation. The conversation shall reset the stagnation count after meaningful
progress. The escalation packet must show the finding history, exact commits,
attempted fixes, tests, EXPERT reports, and why the last two attempts did not
improve the result. Automation stops until the human supplies a disposition.

Other immediate human escalations include unavailable required EXPERT capacity,
missing authority or credentials, an unsafe or ambiguous merge/cleanup state,
and a requested material change to approved scope or safety policy.

## 8. Phase transitions and native command execution

The conversation shall advance an episode through the episode runtime's real
registered commands and structured host interfaces. It must not imitate a custom
slash command by pasting its underlying skill text.

For an approved gate, the conversation invokes native `/handoff` to prepare and
start the next approved phase or slice. For a failed gate, it invokes native
`/handoff` only after the findings are durably incorporated, with guidance that
starts another execute iteration for the same phase or slice. The command owns
handoff preparation and compaction; the project-local extension then injects
canonical `execute` exactly once after successful compaction.

Every transition requires:

- confirmation that the intended command is registered in the episode runtime;
- a unique admission/transition identity;
- an accepted-command receipt;
- observation of the expected persisted boundary, such as compaction;
- inspection of the resulting compaction summary;
- proof that the summary identifies the correct approved next phase or failed-
  gate revision, relevant finding IDs, and authoritative durable artifacts;
- confirmation that the next phase was injected or entered exactly once; and
- recoverable handling of accepted-but-uncertain or interrupted operations.

Auto-compaction is not an authoritative handoff. The controller must prevent,
pause, supersede, or otherwise race-proof auto-compaction while a review gate is
being adjudicated. If auto-compaction races with late findings or produces a
stale primer, the conversation must not advance on that summary. It shall finish
persisting the findings and run a controlled guided handoff whose verified
summary supersedes the stale one.

Messages used for collaboration are not interchangeable with command dispatch.
Simultaneous TUI observation must remain safe, and operator steering takes
precedence over autonomous advancement.

## 9. Slice execution gate

The episode performs one bounded vertical slice per execute phase. Before the
conversation authorizes the next `/handoff`, it verifies at least:

- the slice matches the approved plan and claimed bead;
- implementation, tests, documentation, and requirement traceability are current;
- reported commands and outputs are reproducible;
- applicable focused and repository-wide checks pass;
- the diff contains no unexplained or unrelated work;
- review findings are resolved or explicitly accepted;
- the slice bead and plan accurately describe remaining work;
- the commit is pushed and the episode worktree is clean; and
- any risk trigger has received required EXPERT review.

Failure returns the episode to revision without advancing the phase. Approval is
a durable event tied to the reviewed commit; later changes invalidate it.

## 10. Final readiness, merge, and cleanup

When all slices are complete, the conversation verifies the complete archive,
durable documentation, beads, tests, CI, PR feedback, branch currency, push
state, and clean worktree. The mandatory final EXPERT reviews the exact proposed
merge commit.

The conversation may authorize and perform merge when every required gate
passes and repository policy permits it. Merge authorization must name the
reviewed commit and becomes invalid if the merge candidate changes. Otherwise it
requests revision, escalates, or explicitly abandons.

Only after verified merge or explicit abandonment may the conversation retire
the episode and remove its worktree. Cleanup uses the episode specification's
dirty-state, branch, session, and non-destructive recovery safeguards. Terminal
state and evidence remain durable after physical cleanup.

## 11. Concurrency and safety

Multiple conversations and episodes share Git objects, refs, remotes, daemon
services, and project stores. Oversight identities, locks, records, command
receipts, EXPERT reports, and cleanup operations must be scoped by project,
conversation, and episode. One conversation must never approve, steer, merge, or
clean another conversation's episode by inference from names or current CWD.

All model-derived paths, commands, finding data, and identifiers are validated.
Trusted host code owns Git, session, filesystem, and daemon mutations. Argument
arrays replace interpolated shell fragments. Credential isolation remains
unchanged; neither overseer nor EXPERT reads Keychain, browser stores, or sandbox
credential files.

## 12. Manual-first adoption

The current manual POC is product discovery for this controller. Each run should
record which evidence the conversation inspected, when the operator corrected
it, which EXPERT reviews would have helped, what made a transition safe, and how
command/compaction monitoring behaved.

Automation should proceed in stages: passive observation and reports, suggested
review decisions, operator-confirmed transitions, then autonomous transitions in
disposable dogfood runs. Full autonomous authority becomes the default only
after the operator explicitly accepts the accumulated evidence and specification.

## 13. Acceptance outcomes

Acceptance requires automated tests and concurrent dogfood runs proving that a
conversation can create and autonomously drive one episode through the entire
lifecycle while another conversation does the same in the same project. Tests
must show independent evidence review, fresh project-scoped EXPERT invocations,
risk-triggered reviews, durable finding incorporation, same-slice revision,
stagnation escalation, unavailable-EXPERT escalation, controlled compaction
summary verification, auto-compaction race recovery, exactly-once native
transitions, restart recovery, operator interruption, safe merge authorization,
and terminal cleanup without cross-episode interference. The proof must also
include a long-running episode that is not falsely declared stale, an episode
that finishes without reporting, owner restart or compaction while its watch is
active, active-session replacement, and exactly one recovery poll that discovers
and verifies the missed result without advancing from a runtime status alone.
EXPERT lifecycle tests must cover successful review, failure, timeout,
cancellation, missed reply, bootstrap/admission race, nested reviewer descendants,
and owner restart between artifact preservation and deletion. Every case must
end with durable evidence or a durable failure record and no orphaned live or
idle EXPERT resource outside an explicit `cleanup-pending` retry state.
