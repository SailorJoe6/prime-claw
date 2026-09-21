# Future Specification — Conversation-driven episode oversight

> **Status:** incubated future specification; not approved for planning or implementation.
> **Depends on:** worktree-isolated specification episodes (`prime-claw-h6w`).
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

## 1. Purpose

Prime Claw needs a durable `PROJECT_CONVERSATION` that can move naturally
between project discussion, specification incubation, implementation oversight,
delivery, and post-delivery feedback without losing its identity or duties. When
work is promoted, the conversation creates and owns an isolated `EPISODE`,
reviews its work, and drives it through the complete Ralph lifecycle. The episode
performs focused production work. The conversation remains the autonomous
owner: it preserves intent, decides whether an artifact passes, requests
revisions, invokes native phase transitions, advances or pauses the episode, and
later decides whether user feedback should remain conversational or become a new
production episode.

This specification records the workflow currently being learned through a
manual proof. It is intentionally incubated until repeated operator-driven runs
show that the review gates, evidence, escalation rules, and command mechanics are
safe enough to automate.

## 2. Agent hierarchy and responsibilities

```text
UNIVERSAL_AGENT
  └── PROJECT_CONTEXT — managed canonical Git project; not necessarily an agent
        ├── PROJECT_CONVERSATION A — durable product thread and owner/overseer
        │     ├── conversation record — intent, decisions, focus, feedback, lineage
        │     ├── EPISODE A1, A2, ... — sequential isolated production episodes
        │     └── EXPERT review instances — fresh, project-scoped reviewers
        └── PROJECT_CONVERSATION B
              ├── conversation record
              ├── EPISODE B1, B2, ...
              └── EXPERT review instances
```

The `UNIVERSAL_AGENT` creates or clones project contexts and launches
conversations in the correct canonical checkout. A project context does not
require a resident agent of its own. A `PROJECT_CONVERSATION` is a durable
project-and-product thread: it discusses and incubates possible work, decides
when work is ready for promotion, creates and owns production episodes,
independently reviews them, reconciles delivery and feedback, and preserves
continuity after each episode is retired.

Driving an episode is one temporary focus of the conversation, not its identity.
The stable role remains bound while focus moves among discussion, incubation,
promotion, episode oversight, delivery, and post-delivery feedback. For the first
release, one conversation may own at most one active episode, but it may own many
sequential episodes over its lifetime. Many conversations in the same project
may each drive one active episode concurrently. Supporting several active
episodes per conversation is an explicit later extension.

Role binding, conversational focus, active commitments, and authority mode are
orthogonal. A focus change does not relinquish an active episode or grant new
lifecycle authority. The conversation may discuss future work while an episode
runs, but that discussion is captured as incubated follow-up and cannot silently
change the active episode's admitted scope, requirements, or acceptance
conditions.

A specialized agent profile is the operator-facing abstraction for this role,
but profile text is not the role authority. Durable identity requires a
versioned project role manifest plus a per-session binding and lease. Lifecycle
truth remains in machine-readable conversation and episode records. A trusted
controller projects those sources into the model context at each boundary.


## 3. Full lifecycle

The conversation persists across repeated cycles of exploration and delivery:

```text
project discussion
  → specification incubation
  → disposition: remain incubated | promote | abandon
  → episode allocation and admission
  → specification production and review
  → planning and plan review
  → one vertical execution slice
  → slice review and handoff
  → repeated slices
  → final readiness and expert review
  → PR merge or explicit abandonment
  → episode retirement and safe worktree cleanup
  → delivery observation and user feedback
  → return to discussion/incubation
  → optional new episode with a new identity and predecessor link
```

A terminal episode is immutable history, not the conversation's terminal state.
Later feedback never reuses its approvals, commands, watches, reviewed commit, or
worktree identity. If the feedback is promoted, the conversation creates a new
episode record and explicitly links it to the relevant delivery or predecessor.

The conversation has authority to approve gates and advance an owned episode
without per-gate human confirmation only after that authority mode is released.
The operator may observe, pause, redirect, or take over at any time. Automation
is not released as the default until manual runs have produced sufficient
evidence that both focus transitions and episode lifecycle authority are safe.


## 4. Durable role, conversation, and oversight state

The controller separates durable authority into three records and one versioned
policy source.

### Versioned role manifest

A Git-controlled project manifest defines the invariant `PROJECT_CONVERSATION`
responsibilities, trust policy, compatible controller and state-schema versions,
and focus-specific duty packs. A binding pins the manifest and policy versions
used for an active gate. Policy changes never silently alter authority midway
through a gate; compatible upgrades use an explicit, audited migration.

A prompt template, skill, continual-harness entry, context file, or agent profile
may expose or explain this manifest, but none is sufficient authority by itself.

### Durable session-role binding

Each conversation session has a durable binding that identifies at least:

- project and conversation identity;
- stable bound session and parent/fork lineage;
- role, policy, controller-protocol, and state-schema versions plus manifest hash;
- authority mode and operator pause, takeover, or revocation state;
- binding or lease epoch and current owner session;
- current conversational focus and active commitments;
- zero or one active episode identity for the first release; and
- last verified conversation and oversight revisions.

Display names, CWD, transcript text, ancestry alone, and copied bindings are not
ownership proofs. A missing, corrupt, incompatible, duplicated, or split-brain
binding enters `RECOVERY_REQUIRED`, `ANALYSIS_ONLY`, `PAUSED`, or `REVOKED` and
exposes no mutating lifecycle transition.

### Durable conversation thread record

The conversation-level record preserves information that outlives any episode:

- project/product intent and evolving user goals;
- decisions, unresolved questions, and incubated specifications;
- current primary focus and focus-transition history;
- active commitments and explicitly deferred or follow-up ideas;
- delivery outcomes and post-delivery user feedback; and
- the ordered lineage of all episodes created by the conversation.

This record makes a casual discussion, an incubation cycle, episode oversight,
and later feedback parts of one durable conversation without conflating their
scopes. When side discussion occurs during active implementation, it is filed as
incubated follow-up unless an explicit authorized transition changes the active
episode scope.

### Episode oversight record

Each episode has a separate durable, machine-readable oversight record owned by
the conversation. It identifies at least:

- project, owner conversation, episode session, branch, worktree, and PR;
- current lifecycle phase and gate;
- exact artifact and commit under review;
- last accepted phase or slice;
- outstanding findings and their disposition;
- EXPERT invocations, delegated descendants, reports, and cleanup state;
- revision attempts and stagnation count;
- native commands admitted and their receipts;
- the owner-side watch state, admitted work-generation identity, last observation,
  expected report or gate, missed-report recovery state, and disarm reason; and
- blockers, human escalations, merge disposition, and cleanup state.

Conversation and episode records survive compaction, kernel loss, session
restart, daemon restart, and owner resumption. Mutations are atomic, idempotent,
versioned, auditable, and scoped by project, conversation, and episode. An
append-only transition journal plus deterministic materialized snapshot or an
equivalent transactional design is required. Model prose and in-memory handles
never mutate authority directly; trusted typed tools validate expected revision,
identity, lease, and idempotency key.

### Role restoration and focus projection

On initial start, resume, daemon restart, fork or clone, every model turn, and
after compaction, trusted controller logic:

1. resolves the stable session and project;
2. validates the role binding, lease, manifest hash and versions;
3. validates the conversation record and any active episode snapshot/journal;
4. enters failure-closed recovery on ambiguity or incompatibility;
5. reasserts the invariant role kernel;
6. loads only the duty packs needed by current focus and active commitments; and
7. injects a compact state envelope naming identity, authority mode, focus,
   commitments, revisions, authoritative pointers, and allowed transitions.

For example:

```text
Role: PROJECT_CONVERSATION
Conversation: pc-...
Focus: EPISODE_OVERSIGHT
Authority: operator-confirmed
Active commitment: episode ep-... / execute / Slice 2 owner review
Conversation revision: 42
Episode revision: 184
Loaded duty pack: episode oversight
Allowed transitions: approve, revise, escalate, abandon
```

The envelope is a projection, not authority. A stale compaction summary, harness
memory, REPL variable, session name, or subagent registry cannot override the
binding or records. In discussion or incubation focus, unnecessary episode gate
machinery is omitted unless an active commitment still requires it. If attention
moves to a side discussion while an episode remains active, both facts appear in
the envelope.

Fork and clone boundaries fail closed. A copied bound session starts without
mutation authority until trusted control explicitly transfers the owner lease,
creates a new conversation identity with no inherited active episode, or marks
the fork analysis-only. Concurrent claims for one lease are resolved atomically;
names, lineage, or most-recent-session inference cannot select a winner.


### Owner-side episode watch

The durable episode resource and an active episode work generation are different
states. Immediately after a task or native command is durably admitted, and
before the owning conversation yields control, it shall install a liveness watch
keyed by the episode's stable identity plus a unique work-generation identity
and expected packet. Creating an episode, keeping it nonterminal, reviewing its
output, or waiting for operator input does not by itself justify a scheduled
heartbeat.

The normal active-work cadence is deliberately long and configurable, with 15
minutes or more as the default class. A generation can legitimately spend that
long in tests, review, or one tool call. While work is active, the watch observes
without interrupting or steering and does not infer failure from one quiet
interval. Explicit episode reports may wake the owner sooner.

Each observation resolves durable identity even if the active session changed,
then compares runtime activity with the authoritative oversight record, Git,
plans, and bead state. If work remains active, the owner records progress and
reschedules. If it becomes idle, completed, failed, or stale, the owner performs
one bounded reconciliation, recovers the expected packet from persisted
evidence, requests at most one missing packet when useful, or escalates.
Runtime labels such as `idle`, `completed`, and `child-exited` never approve a
gate, but they do inform whether an admitted generation is still active.

As soon as the work generation and its packet are reconciled, the owner cancels
the recurring watch and durably records it as disarmed. This remains true when
the episode is alive and nonterminal, when independent owner or EXPERT review is
underway, and when the owning conversation is waiting for human input. Those are
owner states, not episode activity. Repeated unchanged idle ticks are prohibited.
The next admitted episode task installs a fresh watch before control is yielded.

While armed, the watch and its lease/checkpoint survive owner compaction and
restart, prevent overlapping duplicate polls, and follow stable episode identity
across active-session replacement. Terminal episode retirement remains a
separate lifecycle operation and does not determine whether a heartbeat should
exist.


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
iteration through a controlled handoff boundary. Focused compaction is a
best-effort context improvement, not an authority or continuation gate. The
preferred first-release path invokes native `/handoff` with explicit guidance
naming the failed gate,
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
handoff preparation and a best-effort compaction attempt; the project-local
extension then queues canonical `execute` exactly once unless continuation itself
is infeasible. Execute delivery does not depend on a `session_compact` event.

Every transition requires:

- confirmation that the intended command is registered in the episode runtime;
- pre-dispatch proof that the intended stable episode and active session are
  idle, not compacting, have no queued turn, and remain at the expected durable
  Git/gate boundary;
- a unique logical transition identity and pre-dispatch transcript cursor;
- a transport acknowledgement that is explicitly not treated as admission;
- durable admission evidence in the stable episode transcript or transition
  state, such as the expanded native command entry;
- pre-handoff proof that the authoritative durable artifacts identify the correct
  approved next phase or failed-gate revision, relevant finding IDs, and accepted
  operator intent;
- observation of bounded compaction evidence when available, without waiting for
  or treating a summary as authority;
- confirmation that the next phase was queued or entered exactly once; and
- recoverable handling of accepted-but-uncertain or interrupted operations.

Auto-compaction is not an authoritative handoff. The controller must prevent,
pause, supersede, or otherwise race-proof auto-compaction while a review gate is
being adjudicated. If auto-compaction races with late findings or produces a
stale summary, that summary grants no progression authority. The conversation
finishes persisting the findings and runs a controlled guided handoff. Canonical
execute continuation remains mandatory and does not wait for a replacement
summary; the durable artifacts and confirmed operator intent are authoritative.

A daemon `prompt` response with `success: true` proves only transport handling.
Its RPC ID may repeat and is not a command receipt. The conversation performs a
short admission check immediately after dispatch; the long episode-work
heartbeat is not a substitute. If no admission is persisted, it inspects the
stable transcript/state and asks the episode once whether any command,
compaction, error, or phase injection occurred. Only after absence is proven and
the episode is idle may it retry the same logical transition once. Persistent
ambiguity or a second non-admission pauses and escalates rather than leaving both
agents idle or blindly resending.

Heartbeat and timeout decisions use actual persisted event and observation
timestamps. A delayed or coalesced heartbeat delivery never counts as elapsed
watch time merely because its nominal interval passed.

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
services, and project stores. Role bindings, owner leases, conversation records,
oversight identities, locks, command receipts, EXPERT reports, and cleanup
operations must be scoped by project, conversation, episode, and work generation
where applicable. One conversation must never approve, steer, merge, or clean
another conversation's episode by inference from names, lineage, current CWD, or
"most recent" state. Sequential episodes owned by one conversation retain unique
identities and explicitly target all transitions; terminal evidence cannot leak
forward into a successor.

All model-derived paths, commands, finding data, and identifiers are validated.
Trusted host code owns Git, session, filesystem, and daemon mutations. Argument
arrays replace interpolated shell fragments. Credential isolation remains
unchanged; neither overseer nor EXPERT reads Keychain, browser stores, or sandbox
credential files.

## 12. Manual-first adoption

The current manual POC is product discovery for both the conversation role and
the episode controller. Each run should record which focus the conversation was
in, which durable commitments remained active, what context had to be restored,
which evidence the conversation inspected, when the operator corrected it,
which EXPERT reviews helped, what made a transition safe, and how command,
compaction, fork, and monitoring behavior worked.

Prime Agent 0.9.5 has enough verified hooks for a bounded prototype: a
Git-versioned role manifest; a project-local trusted extension using
`session_start`, `before_agent_start`, fork and compaction hooks; durable custom
session entries; and an external atomic conversation/oversight registry. The
prototype begins in `observe` or `operator-confirmed` authority mode and proves
role restoration and one typed transition. It does not claim that a system
prompt, prompt template, skill, continual-harness note, session name, or
process-local set is a durable role system.

Production acceptance requires typed role bindings, explicit fork/transfer/new-
conversation/analysis-only semantics, transactional conversation and episode
state, capability-gated transition tools, durable command admission receipts,
and unconditional cold-boundary context projection. These may ultimately live
in Prime Agent core or in a reviewed Prime Claw controller, but the behavior and
failure-closed guarantees are mandatory.

Automation proceeds in stages: passive observation and reports, suggested focus
and review decisions, operator-confirmed transitions, then autonomous
transitions in disposable dogfood runs. Full autonomous authority becomes the
default only after the operator explicitly accepts accumulated evidence for
role continuity, focus changes, sequential episode lineage, and the complete
episode lifecycle.


## 13. Acceptance outcomes

Acceptance requires automated tests and concurrent dogfood runs proving that a
bound conversation restores its role across initial start, resume, daemon
restart, fork or clone, kernel loss, upgrade, and repeated compaction; moves
among discussion, incubation, promotion, oversight, delivery, and feedback;
retains or changes active commitments correctly as focus changes; and drives
many sequential episodes without reusing terminal authority. A side discussion
during active work must remain incubated unless an explicit authorized scope
transition occurs. Corrupt, stale, incompatible, duplicate, or split-brain
bindings and owner leases must fail closed, and lease transfer, new-conversation,
and analysis-only fork dispositions must be proven exactly once.

Tests must also prove that one conversation can create and autonomously drive
one active episode through the entire lifecycle while another conversation does
the same in the same project. They must show independent evidence review, fresh
project-scoped EXPERT invocations,
risk-triggered reviews, durable finding incorporation, same-slice revision,
stagnation escalation, unavailable-EXPERT escalation, controlled compaction
summary verification, auto-compaction race recovery, exactly-once native
transitions, restart recovery, operator interruption, safe merge authorization,
and terminal cleanup without cross-episode interference. The proof must also
include a long-running episode that is not falsely declared stale, an episode
that finishes without reporting, owner restart or compaction while its watch is
active, active-session replacement, and exactly one recovery poll that discovers
and verifies the missed result without advancing from a runtime status alone.
After reconciliation the scheduled watch must be absent while the idle episode
awaits owner review or human input, and the next admitted work generation must
install exactly one fresh watch before control is yielded.

Role-restoration tests must verify the pinned manifest, binding epoch, authority
mode, current focus, active commitments, state revisions, and allowed transitions
in the first turn after every cold boundary. A deliberately stale compaction
summary or harness memory must not override the durable records. Compatible
migrations must be atomic and auditable; unknown or incompatible versions must
remove mutation authority. The operator status surface must explain current
identity, focus, commitments, versions, restore integrity, and permitted next
transitions without reading private raw transcript text.

EXPERT lifecycle tests must cover successful review, failure, timeout,
cancellation, missed reply, bootstrap/admission race, nested reviewer descendants,
and owner restart between artifact preservation and deletion. Every case must
end with durable evidence or a durable failure record and no orphaned live or
idle EXPERT resource outside an explicit `cleanup-pending` retry state.
Native-command tests must also reproduce transport success while a busy episode
drops admission, repeated/non-unique RPC IDs, proven-absent same-identity retry,
ambiguous admission escalation, duplicate suppression, delayed heartbeat
delivery, and exactly one eventual compaction and next-phase injection.
