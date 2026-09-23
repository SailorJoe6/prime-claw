# Specification — Conversation-driven episode oversight

> **Status:** living future specification; manual lifecycle proven, lightweight plugin encoding proposed for operator review.
> **Depends on:** [Reviewed future plans and worktree-isolated implementation episodes](../../archive/worktree-isolated-specification-episodes/SPECIFICATION.md)
> **Related delivered work:** [handoff continuation resilience](../../archive/handoff-continuation-resilience/SPECIFICATION.md), [conversational Ralph command routing](../../archive/conversational-ralph-command-routing/SPECIFICATION.md), [future specification bundles](../../../../docs/future-specification-bundles.md), and [handoff chain](../../../../docs/handoff-chain.md)
> **Related future work:** [Universal-agent and project-conversation POC](../universal-agent-project-conversation-poc/SPECIFICATION.md)

## Purpose

Make conversation-owned episode oversight a small, reusable part of the
prime-claw plugin without replacing or constraining ordinary project
conversation.

A durable `PROJECT_CONVERSATION` is the operator-facing place to discuss possible
work, turn selected intent into a specification, revise it with the operator,
plan the reviewed specification, and revise that plan. Prime Agent and the
existing project skills already provide those conversational behaviors. This
feature does not implement a new conversation engine or lifecycle controller for
them; it must leave them available and begin the session with the project's
`prepare` orientation before substantive work.

The new work begins at the reviewed implementation boundary. While an episode
exists, the same conversation reviews its bounded slices, continues or revises
work within the approved scope, obtains independent review, presents the final
operator gate, and safely carries out the operator's terminal decision.
Completion returns the same conversation to ordinary project discussion and
future-work incubation. The operator may later repeat the existing discuss →
specify → plan flow and create another sequential episode. “One active episode”
means one at a time, not one for the lifetime of the conversation.

The complete lifecycle has already been driven manually. This specification no
longer proposes another manual POC. It records the behavior that proved useful
and defines the smallest first plugin release that makes that behavior repeatable.
The release should then evolve through continued dogfooding. It must not design
the eventual orchestrator, generalized lifecycle infrastructure, or speculative
state machinery in advance.

## Proven baseline

The repository already provides the ordinary conversation and deterministic
conversation-to-episode transitions that this feature builds on:

- normal Prime Agent project-rooted conversation and project awareness;
- the project `prepare` skill for consistent session orientation;
- existing project-customizable `/design`, `/spec-it-out`, `/plan`, and
  specification/plan revision behavior under `.ralph/skills/`;
- project-customizable Ralph phase policy under `.ralph/skills/`;
- native `/plan <future-folder>` and the narrow `ralph_plan` conversational
  adapter;
- native `/implement-spec <future-folder>` as the only implementation-promotion
  authority boundary;
- isolated episode branch, worktree, durable session, owner identity, and
  fail-closed bootstrap admission state;
- handoff-first episode bootstrap, so inherited planning context receives a
  focused compaction request before the first execute slice;
- exact-owner `handoff_spec_episode(location, guidance?)` for later slice
  transitions;
- canonical handoff as fail-if-busy `steer` followed by canonical execute
  exactly once as the sole queued `followUp`;
- agent-owned heartbeats and existing session observation for bounded watches;
- fresh RLM agents for independent EXPERT review, with dogfood explicitly using
  an operator-authorized higher-capability reviewer model rather than silently
  inheriting the routine agent default; and
- ordinary Git and supported Prime Agent session operations for merge,
  abandonment, and cleanup.

The archived conversational-routing episode exercised specification review,
plan review, native promotion, multiple implementation and repair slices,
owner review of exact commits, renewed final EXPERT review, explicit operator
merge approval, and safe resource retirement. Later delivery added owner-driven
remote continuation and corrected initial bootstrap to use the same handoff-first
context-focusing transition.

## Product roles

```text
PROJECT_CONTEXT — canonical project checkout
  └── PROJECT_CONVERSATION — explicitly assigned durable owner session
        ├── future specifications and plans
        ├── at most one active owned EPISODE in the first release
        └── fresh advisory EXPERT agents when useful

EPISODE — temporary sibling session in an isolated branch and worktree
```

### Project conversation

A `PROJECT_CONVERSATION` is a long-lived Prime Agent session explicitly assigned
that role when launched, with its working directory set to the project root.
Project CWD supplies context but does not make every project-rooted session a
project conversation. Debug sessions, reviewers, and other agents do not gain
episode authority merely because they share the repository.

The project conversation is the operator-facing project thread. Its ordinary
conversation, project awareness, specification, and planning behavior are
existing Prime Agent and project-skill capabilities, not new implementation
scope here. This feature adds explicit startup orientation and makes episode
oversight one temporary mode of the broader role: it owns only episodes it
created, reviews their output, and drives already-authorized implementation.

After terminal disposition and safe cleanup, the project conversation keeps its
role and returns to discussion and future-work incubation. It may later author,
plan, and implement another future folder without being relaunched or rebound.
Episode-specific identity, watch, and review context must not become a permanent
conversation lock.

The first release supports at most one active episode at a time per project
conversation as a role and workflow rule. It permits any number of sequential
completed or abandoned episode cycles. It does not add a host-level active-
episode index or attempt to coordinate concurrent episodes. Dogfooding must
demonstrate a real need before concurrency enforcement or scheduling is
designed.

### Episode

An `EPISODE` is a durable sibling session rooted in a dedicated worktree. It
implements one approved future folder through bounded execute/handoff slices. It
works only on its assigned branch, keeps plans, documentation, tests, and beads
current, commits and pushes one reviewable slice, reports the exact result, and
stops for owner review.

The episode does not approve its own work, expand its own scope, merge itself,
or retire its own resources.

### Operator

The operator retains authority over specification and plan approval, scope
expansion, unresolved product decisions, pause, merge, abandonment, and
destructive cleanup. The operator may intervene or take over at any time.

Native `/implement-spec` authorizes the assigned project conversation to drive
all bounded implementation and revision slices already contained in the reviewed
specification and plan. It does not authorize any of the retained operator
choices above.

## First-release plugin shape

The initial feature has two new policy resources and reuses the host mechanics
already delivered. The division is intentionally evolvable.

### 1. Explicit project-conversation agent profile

The plugin supplies a small, file-defined `PROJECT_CONVERSATION` agent profile.
The profile is explicitly selected when a project conversation is created, and
its role instructions become part of that agent's effective system prompt. An
ordinary user-message or prompt-template expansion is not sufficient to assign
the role.

The assignment must remain effective when the durable session is resumed or its
resources are reloaded. It is bound to that exact project-conversation identity:
a fork, episode, reviewer, or other project-rooted session does not inherit the
role unless it is separately and explicitly assigned.

The implementation must use a supported Prime Agent system-prompt or
agent-profile seam and make the resulting role observable in focused tests. The
exact file layout, launch API, persistence representation, and prompt-injection
mechanism are planning decisions. The design should prefer a native resident-
session agent-profile facility if the target runtime provides one and otherwise
choose the smallest reliable plugin mechanism.

The profile contains only invariants that should shape every turn:

- run the project's `prepare` orientation when the role is first launched,
  before substantive project work;
- preserve the ordinary conversation and existing specification and planning
  workflows without intercepting or replacing them;
- preserve operator intent and reviewed scope;
- own only episodes created by this conversation;
- support at most one active episode at a time in the first release while
  permitting later sequential episodes;
- use the canonical oversight workflow only while an episode is active;
- treat side discussions as separate future work unless the operator explicitly
  changes active scope;
- distinguish admission, work completion, review, and approval;
- never infer merge, abandonment, or destructive-cleanup approval; and
- stop and surface real blockers rather than manufacturing authority.

The profile does not carry detailed review procedure, daemon protocol, Git
recipes, project-specific acceptance policy, or a complete lifecycle model. It
does not replace, intercept, or narrow the existing `/spec-it-out`, `/plan`, or
`/implement-spec` workflows. The first release does not add a general role
registry or ownership-rebinding system.

### 2. One project-customizable oversight skill

The first release adds one canonical `oversee-episode` skill. It is
project-customizable in the same way as the existing Ralph skills and is exposed
to the project conversation through the normal Prime Agent skill mechanism. It
is used while an owned episode is active; it does not replace the conversation's
ordinary discussion, specification, specification-revision, planning, or plan-
revision workflows.

The skill guides the conversation to:

1. retain the exact episode identity and expected work generation;
2. start and later cancel one bounded watch for admitted work;
3. reconcile the episode report with session, Git, plan, bead, and test evidence;
4. independently review the exact pushed commit;
5. choose `advance`, `revise`, `consult`, or `pause`;
6. record durable findings in the artifact that owns them;
7. invoke the existing exact-owner continuation capability for accepted
   in-scope work;
8. obtain and adjudicate fresh EXPERT review under the project's explicit
   operator-authorized reviewer-model policy when appropriate;
9. verify and preserve the actual reviewer model and reasoning level with the
   review evidence;
10. prepare the exact final candidate and explicit operator gate; and
11. after the operator's decision, guide the proven merge or abandonment and
    conservative cleanup procedure.

The skill owns semantic judgment. It does not implement raw daemon transport,
forge session identity, bypass path or quiescence checks, or treat prose as a
host mutation.

Starting with one skill keeps the surface small. Continued use may split it or
move stable guidance between the agent profile and skills. That split is not a
permanent compatibility boundary.

### 3. Existing narrow host capabilities

The first release reuses the delivered deterministic surfaces instead of adding
a general controller:

- native `/implement-spec` and `create_spec_episode` for promotion and bootstrap;
- `handoff_spec_episode(location, guidance?)` for exact-owner continuation;
- existing daemon identity, state, queue, and quiescence validation inside those
  capabilities;
- `rlm_heartbeat` and session observation for activity-scoped watches;
- fresh RLM agents with explicit model selection for read-only EXPERT review;
- ordinary Git and supported Prime Agent session operations after terminal
  operator disposition.

Before oversight begins, the project conversation verifies that the required
native commands and project workflow policy are actually available. Missing
capability is a visible preparation blocker; it is never permission to imitate a
native transition or paste a skill as ordinary model input.

The tool guidance for `handoff_spec_episode` must match the approved authority
model. After accepting an exact slice commit, the assigned project conversation
may invoke it for its exact owned episode without a fresh operator request. The
capability still fails closed unless location, owner, durable identity, canonical
prompts, and live daemon quiescence all match.

No native merge, abandonment, cleanup, episode-status, reviewer, or arbitrary
remote-command capability is required in the first release. A later capability
must be justified by observed friction or a safety failure, not by a desire to
complete an abstract architecture.

## Repeatable reviewed lifecycle

The following whole cycle is the compatibility context for this feature. The
conversation, specification, and planning steps already exist; this release must
not block or reimplement them. Its substantive new policy begins when the
reviewed bundle crosses into an episode:

```text
project discussion
  → /design or /spec-it-out
  → living specification under .ralph/plans/future/<slug>/
  → operator specification review and revision
  → native /plan <future-folder>
  → operator plan review and revision
  → native /implement-spec <future-folder>
  → bounded episode oversight and final operator disposition
  → return to project discussion in the same PROJECT_CONVERSATION
  → repeat later with another future folder when the operator chooses
```

### Before episode creation

Specification and planning remain ordinary work in the project conversation.
Beyond initial `prepare` orientation and the non-interference requirements above,
this release adds no special mechanism for those conversational steps.

Specification approval permits planning only. Plan approval does not create an
episode. Native `/implement-spec` is the explicit implementation boundary.
Conversational implementation promotion remains intentionally absent because the
installed runtime could not preserve the required one-run authorization boundary
without adding unproven durable approval machinery.

### Handoff-first bootstrap

New episodes start with the proven ordered transition:

```text
create branch and worktree
  → promote and commit the reviewed future folder
  → fork and publish the inherited episode session
  → persist v2 handoff-pending admission state
  → send canonical handoff as steer
  → request focused compaction of inherited planning context
  → persist execute-pending after handoff acknowledgement
  → queue canonical execute exactly once as the sole follow-up
  → persist delivered after execute acknowledgement
```

Direct execute at bootstrap was tried and was wrong: the first slice inherited a
large planning conversation without the intended context-focusing handoff. The
handoff-first sequence is required for new episodes.

Admission state is not work-completion state. Acknowledgement means only that the
ordered daemon mutation was accepted.

### Active work watch

After bootstrap or an admitted continuation, the project conversation creates
one agent-owned, bounded heartbeat for that exact work generation. The watch
uses existing session observation and persisted Git/session evidence. It does
not steer active work.

The watch wakes the conversation when the episode reports, becomes idle, blocks,
or reaches an ambiguous state. It is cancelled as soon as the generation is
reconciled. A later admitted slice gets a new watch. Repeated unchanged idle
polling is a bug.

The first release does not add a notification transport, event bus, scheduler
service, or monitoring database. If this proven observation path fails in later
dogfood, that concrete failure will shape the next change.

### Slice review and continuation

An episode report is evidence, not approval. The project conversation checks the
actual branch, exact commit, diff, tests, documentation, plan, beads, and
worktree state.

The review disposition is:

- **advance** — accept the exact slice and admit the next bounded in-plan slice;
- **revise** — return concrete findings and acceptance conditions to the same
  slice;
- **consult** — obtain a fresh independent review of a material question or
  exact commit; or
- **pause** — stop for an authority boundary, unresolved decision, external
  blocker, ambiguity, or explicit operator request.

For `advance` or an in-scope `revise`, the project conversation may invoke
`handoff_spec_episode` without asking the operator to transport another
`/handoff`. The host capability preflights canonical handoff and execute, checks
the exact owner and idle episode, sends handoff as fail-if-busy `steer`, and
queues exactly one execute `followUp`.

Ordinary `agent_message.send()` is model input. It does not dispatch a sibling's
native slash command. The deterministic host capability exists because the
manual TUI handoff was a transport burden, not an authority requirement.

### EXPERT review

A fresh EXPERT is an ordinary fresh RLM reviewer given a focused, read-only
packet for one exact commit. It has no episode or lifecycle mutation authority.
The project conversation preserves useful findings in the specification, plan,
bead, code/tests, or a linked immutable report, then stops the reviewer.

Every EXPERT invocation is governed by an explicit project/operator reviewer-
model policy. The selected reviewer must be operator-authorized for its cost and
access and intentionally suitable for high-capability independent review. It
must not be chosen merely by inheriting whatever model the project conversation
or episode happens to use. A project may configure the same model only when that
model already satisfies the explicit EXPERT policy; the choice is still
intentional and auditable rather than an implicit fallback.

The exact model name is not a portable product invariant. Manual dogfood used
GPT-6 Astra with maximum reasoning effort for this operator, but another operator
or project may authorize a different high-capability reviewer. Prime Claw must
not claim that it can automatically rank all available models or infer the
operator's cost authorization.

The review evidence records the actual reviewer model selector and reasoning
level alongside the exact reviewed commit. If a required EXPERT cannot run under
the authorized policy, the workflow pauses and asks the operator. It must not
silently substitute the routine/default model, weaken the review requirement, or
report a passing EXPERT gate without the required reviewer.

Intermediate EXPERT use is judgment-based. It is especially useful for security,
credential boundaries, destructive operations, concurrency, compatibility,
broad changes, disputed evidence, or repeated failed revisions. Once an
intermediate EXPERT is required by project policy or selected as necessary gate
evidence, the same explicit-model and fail-closed requirements apply.

A fresh final EXPERT review is mandatory for the complete exact merge candidate
in this workflow. Every material finding is adjudicated. A material repair
changes the candidate and requires renewed review; a favorable report never
authorizes merge.

This specification defines the reviewer-model outcome, not how configuration is
stored, how a selector is resolved, or which supported spawn surface applies it.
Those are planning decisions. The first release does not require a reviewer
registry, model-ranking service, or general model router.

### Final operator gate and terminal work

Only after owner verification and a passing final EXPERT review does the project
conversation present the exact candidate for one explicit operator decision:

```text
approve merge | request revision | pause | abandon
```

The first release uses the terminal path already proven in dogfooding. After the
operator's explicit decision, the project conversation uses ordinary Git and
supported Prime Agent session operations. It verifies the disposition, stops the
episode session, rechecks Git and worktree state, removes only the owned worktree,
and applies the project's branch-retention policy.

Dirty, ambiguous, or uncertain state blocks destructive cleanup. Cleanup never
touches unrelated sessions, worktrees, branches, identities, or another
conversation's resources. A dedicated terminal host capability is deferred
unless repeated use shows that the skill-guided path is inadequate.

Terminal disposition ends the episode, not the project conversation. The owner
cancels episode-specific watches, releases transient episode/review focus, keeps
its `PROJECT_CONVERSATION` assignment, and returns to ordinary discussion. A
later operator-approved future folder may start a new sequential episode through
the same `/spec-it-out` → `/plan` → `/implement-spec` gates.

## Failure and replay boundaries

The oversight workflow must preserve the failure semantics already delivered:

- both canonical prompts are loaded before a two-message transition begins;
- a definite first-send rejection admits no handoff and may clean up only
  invocation-owned bootstrap resources;
- once handoff may have been admitted, the session, worktree, branch, identity,
  and session file are preserved;
- a definite second-send rejection is an irreversible partial transition, not a
  reason to erase the admitted handoff;
- ambiguous daemon results are inspection boundaries and are never blindly
  replayed;
- a repeated creation request validates or reopens the exact identity but does
  not replay a nonterminal bootstrap stage;
- legacy version-1 delivered identities remain truthful direct-execute records
  and may use later owner-driven handoff; and
- compaction success is not required for execute continuation, while explicit
  whole-turn cancellation or session replacement removes continuation and is
  not reconstructed.

The project conversation reports uncertainty honestly. Idle state, a missing
response, or transport acknowledgement must not be promoted into stronger
claims.

## Policy and mechanics boundary

Project-customizable Markdown owns:

- review depth and evidence sufficiency;
- slice-sizing and acceptance judgment;
- advance, revise, consult, or pause decisions;
- when an intermediate EXPERT adds value;
- the explicit operator-authorized EXPERT model policy and required-review
  unavailability response;
- durable placement of findings;
- final review preparation; and
- project-specific merge and branch-retention practice.

Trusted extension code owns:

- exact argument and path validation;
- owner, session, branch, worktree, and CWD identity;
- daemon state and quiescence checks;
- ordered handoff and execute admission;
- durable bootstrap admission checkpoints;
- at-most-once replay suppression; and
- preservation when mutation outcome is uncertain.

The agent profile and skill must not duplicate daemon protocol or bypass these
mechanics. Extension code must not decide product scope, review quality, or
operator intent.

## Side discussions and living intent

Driving an episode is one temporary focus of the project conversation, not its
whole identity. The operator may discuss unrelated work while an episode exists.
That work remains future incubation unless the operator explicitly changes the
active episode's approved scope.

Clear operator corrections are authoritative. When they affect durable scope or
acceptance, the project conversation updates the owning specification or plan
before the next episode transition. Updating this future specification does not
retroactively change an already approved episode bundle.

This document is a living product contract. Durable lessons from dogfooding
replace stale text here. Point-in-time chronology and immutable evidence remain
in archived plans, beads, reports, tests, and Git history rather than turning
this specification into an append-only journal.

## First-release scope

The first release adds or changes only:

1. an explicit lightweight project-conversation agent profile with durable,
   identity-bound system-prompt behavior and startup `prepare` orientation;
2. one project-customizable `oversee-episode` skill;
3. role and skill guidance that starts and cancels existing per-generation
   heartbeat watches;
4. `handoff_spec_episode` guidance that permits owner-driven in-scope
   continuation after exact-commit acceptance;
5. explicit EXPERT reviewer-model, evidence, and required-review failure policy;
6. focused tests and documentation for these contracts; and
7. a non-interference and return-to-incubation contract that leaves the existing
   conversational workflows available before and after an episode.

It reuses all existing deterministic host mechanics and ordinary terminal
operations.

## Non-goals

The first release does not add:

- a new conversation engine or controller for discussion, specification
  authoring/revision, or planning/revision;
- new replacements or wrappers for `/prepare`, `/design`, `/spec-it-out`,
  `/plan`, or `/implement-spec`;
- an autonomous universal-agent orchestrator;
- implicit project-conversation role assignment from CWD;
- a role registry or ownership-rebinding framework;
- host enforcement or scheduling of multiple active episodes;
- a lifecycle database, generalized state machine, append-only transition
  journal, leases, nonces, or timers;
- a notification service or persistent monitoring store;
- a generic remote command or free-form prompt router;
- conversational implementation promotion;
- a reviewer registry, automatic “strongest model” ranking service, general
  model router, or dedicated EXPERT service;
- a product-wide hard-coded GPT-6 Astra requirement;
- native merge, abandonment, or cleanup commands;
- automatic merge, abandonment, destructive cleanup, or scope expansion; or
- automatic replay after uncertain admission.

## Acceptance and continued dogfooding

The first plugin release is acceptable when a newly launched explicit
`PROJECT_CONVERSATION`:

1. runs the existing project `prepare` orientation before substantive work;
2. retains normal project conversation and the existing `/spec-it-out`, `/plan`,
   and `/implement-spec` entry paths without new wrappers or restrictions;
3. crosses the implementation boundary only through `/implement-spec` for an
   already reviewed bundle and retains the returned exact episode identity;
4. observes one admitted work generation with a bounded heartbeat;
5. reconciles and independently reviews an exact slice commit;
6. revises or continues the exact owned episode without another operator
   transport step and without exceeding approved scope;
7. obtains and adjudicates a fresh final EXPERT review using the explicit
   operator-authorized reviewer-model policy, with the actual model and reasoning
   level recorded against the exact commit;
8. pauses for the operator rather than silently falling back when that required
   reviewer is unavailable;
9. presents the exact merge candidate for explicit operator disposition;
10. follows the existing safe terminal procedure without new lifecycle
    infrastructure; and
11. remains the same assigned, normally conversational project session afterward,
    with no stale episode lock preventing a later existing workflow or new
    `/implement-spec` promotion.

The run must also capture focused evidence for the handoff-first bootstrap and
owner-driven continuation in a live episode, because those transports have
strong automated coverage but still benefit from a concise end-to-end transcript
in the new role-driven workflow.

After that run, update this living specification with observed friction. Add
another plugin capability only when the run demonstrates a repeated need that
cannot be handled clearly by the agent profile, skill, or existing supported
operations.
