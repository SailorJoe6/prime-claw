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
  ├── CONVERSATION A — independent user-facing project session
  │     └── at most one active owned EPISODE in the first release
  ├── CONVERSATION B — another independent user-facing project session
  │     └── its own exact-session ownership and episode state
  └── any number of later independent CONVERSATION sessions

EPISODE — temporary sibling session in an isolated branch and worktree
EXPERT — fresh bounded reviewer for one focused question or exact commit
DELEGATED CHILD — bounded subagent that does not inherit owner authority
```

### Conversation

Every independent top-level Prime Agent session the user starts in a project is a
`CONVERSATION` by default. There is no unique project owner conversation and no
special launch flag. Any number of conversations may coexist in one project.
Ordinary discussion, project awareness, and the existing design,
specification, and planning skills are native behavior rather than new scope.

This feature adds one capability: any conversation may promote a reviewed future
bundle through native `/implement-spec` and drive the resulting owned episode to
completion. The conversation enters **oversight mode** only while it owns an
active episode. Identity, active mode, and detailed procedure are separate:

- `CONVERSATION` is the durable default identity;
- exact-session episode ownership activates oversight mode; and
- the `oversee-episode` package supplies the detailed procedure.

The conversation's episode-driving identity must be unforgettable. Long ordinary
discussion, context growth, native compaction, reload, resume, reports,
heartbeats, and provider/tool continuation must not make it forget how to review,
continue, pause, or return decisions to the operator. This is a behavioral
requirement, not a requirement to use a particular injection hook or to customize
Prime Agent's compaction policy.

An ordinary fork retains CONVERSATION capability but does not duplicate live
episode ownership: ownership remains bound to the exact source session. The
`/implement-spec` path uses fork-like mechanics but explicitly transitions the
new sibling to `EPISODE`. A fresh reviewer receives bounded `EXPERT` instructions,
and an RLM child follows its bounded delegated task rather than assuming the
conversation's ownership or authority.

The first release supports at most one active episode at a time per conversation
as a workflow rule while allowing multiple conversations to own distinct episodes
and any number of sequential completed or abandoned cycles. It does not add a
project-wide scheduler or host-level concurrency index.

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

Native `/implement-spec` authorizes the invoking conversation to drive all
bounded implementation and revision slices already contained in the reviewed
specification and plan. It does not authorize any of the retained operator
choices above.

## First-release plugin shape

The first release uses a small universal identity anchor, exact-session oversight
state, one canonical role package, and the deterministic host mechanics already
delivered. The evidence-only Prime Agent 0.9.5 POC proved the native mechanics
below; the production integration must retain that evidence and close the noted
readiness boundaries.

### 1. Universal identity kernel

A short native `APPEND_SYSTEM.md` resource describes identity precedence for all
standard prime-claw sessions:

- an independent top-level user-facing project session is CONVERSATION by default;
- an explicit EPISODE, EXPERT, or delegated-child assignment overrides default
  ownership and authority;
- oversight mode exists only when exact-session durable state says that
  conversation owns an active episode;
- an active conversation must use its canonical oversight package; and
- missing identity, package, or restoration readiness is a visible blocker.

The kernel is an identity router, not a complete workflow. It must remain small
and must not duplicate `oversee-episode`, `execute`, reviewer instructions, daemon
protocol, or project policy. Prime Agent rebuilds this base resource independently
of conversation history, so normal context compaction does not remove it.

Project or CLI prompt configuration may shadow the installed append resource.
Before promotion, readiness validation therefore proves that exactly one expected
kernel is present and that the restoration plugin and role package are available.
A deliberate unsupported prompt configuration leaves a truly inactive ordinary
conversation available, but fails visibly at the promotion boundary and during
explicit EPISODE, active, or recovery state rather than starting ungoverned work.
A native depth-positive delegated/RLM child is already bounded by Prime Agent's
trusted runtime task prompt; under an intentional project/CLI shadow it may run
without the CONVERSATION kernel, but receives no owner marker, ownership, or
oversight package. No prose parsing is used for this exception.

### 2. Exact-session oversight mode and fresh role package

Successful `/implement-spec` promotion activates oversight for the exact invoking
conversation without creating a model turn. The append-only session marker is
bound to that conversation UUID, exact episode generation, and the existing
durable spec-episode identity record as the independent ownership expectation.
The mutable daemon routing ID is not stable ownership; an exact verified reopen
may refresh it without invalidating the owner marker. A marker copied into a fork
is inert because its UUID no longer matches. Completed older generations remain
replayable evidence but never current ownership, so separate conversations and
later sequential cycles remain independent. On reload or resume, one valid bootstrap-ready
current-owner expectation with no marker is recovered deterministically to active
state with visible durable evidence. Inactive, malformed, or disagreeing
current-owner state blocks; it never silently becomes ordinary conversation. Only
a positively identified nonempty foreign owner is ignored; unclassifiable owner
fields block. Every exact-owner generation is reconciled before current ownership
is selected, so orphan active markers and nonterminal old receipts cannot hide
behind a different active episode. The known v1 owner marker is migrated
append-only only after every stable legacy binding matches the exact expectation,
while foreign copied legacy history is inert.

While exact-session state is active, a universal `context` hook validates the
kernel, marker, expectation, and canonical package, removes any older package
representation, and supplies exactly one fresh package to every real provider
call. This covers ordinary input, custom triggers, native follow-ups, heartbeats,
agent messages, reload, resume, and tool continuation without depending on the
input event or a mutable per-input cache. Activation itself causes no unsolicited
model response.

The canonical package uses a deliberately closed frontmatter contract rather
than general YAML. The reader validates the raw file before any whole-file
whitespace normalization: the opening and closing `---` delimiters must be exact,
unindented lines, while ordinary trailing newlines and nonempty formatted body
text remain valid. Between those delimiters it permits exactly one `name` line
and one `description` line, with no blank, comment, unknown, duplicate, nested,
sequence, or unsupported scalar metadata lines. Each key has exactly one ASCII
space after its colon. Nonempty double-quoted values use a JSON-string subset,
nonempty single-quoted values have no escapes, and unquoted values exclude YAML
reserved leading indicators, flow delimiters, quote, mapping/comment, tab, and
C0/C1 control forms. Decoded quoted controls are also invalid. Anything outside
that complete subset blocks both promotion and active dispatch before any
provider call and without changing lifecycle evidence.

Native automatic compaction remains unchanged. Its private summarizer is a
runtime utility rather than the CONVERSATION agent and need not receive the role
package. The first real call after compaction must receive one current kernel and
one current package. No proactive conversation handoff or custom context-sweet-
spot policy is part of this release.

Terminal episode disposition advances its exact durable receipt monotonically
through authorized, completing, and completed states, appends inactive state,
clears the ownership expectation, and retains a completed tombstone while leaving
default CONVERSATION identity available. Identical replays return the durable
state/result without another confirmation. Before any startup recovery appends
marker evidence, the one shared classifier validates all stable
expectation/receipt bindings directly, including when the marker is missing;
disagreement blocks with expectation, receipt, and append-only session evidence
unchanged. Marker, expectation, receipt, or package disagreement and invalid
active kernels block visibly before an oversight provider call. The existing plugin
apply/check path plus `/implement-spec` readiness validation owns installation
integrity; an infinite chain of self-checking sentinel plugins is not required.

### 3. One project-customizable oversight skill

The first release adds one canonical `oversee-episode` skill. It is
project-customizable in the same way as the existing Ralph skills. Its canonical
contents also supply the fresh oversight package while exact-session mode is
active, avoiding separate drifting copies.

The skill guides the conversation to:

1. retain the exact episode identity and expected work generation;
2. establish direct owner/episode reporting and start one non-steering 15-minute
   heartbeat for each active work generation;
3. reconcile episode reports with session, Git, plan, bead, and test evidence;
4. independently review the exact pushed commit;
5. choose `advance`, `revise`, `consult`, or `pause`;
6. record durable findings in the owner ledger and route them at stable gates;
7. invoke existing exact-owner continuation for accepted in-scope work;
8. obtain and adjudicate fresh EXPERT review under the explicit reviewer policy;
9. prepare the exact final candidate and operator gate; and
10. after the operator's decision, guide merge or abandonment and conservative
    cleanup before returning to ordinary conversation.

The skill owns semantic judgment. It does not implement raw daemon transport,
forge identity, bypass path or quiescence checks, or treat prose as a host
mutation.

### 4. Existing narrow host capabilities

The first release reuses the delivered deterministic surfaces instead of adding
a general controller:

- native `/implement-spec` and `create_spec_episode` for promotion and bootstrap;
- `handoff_spec_episode(location, guidance?)` for exact-owner continuation;
- narrow two-phase `finalize_spec_episode` for recording operator disposition and
  closing exact oversight state after ordinary terminal work;
- existing daemon identity, state, queue, and quiescence validation;
- `rlm_heartbeat` and session observation for activity-scoped watches;
- fresh RLM agents with explicit model selection for read-only EXPERT review;
- existing spec-episode identity state as the ownership expectation; and
- ordinary Git and supported Prime Agent session operations after terminal
  operator disposition.

After accepting an exact slice commit, the owning conversation may invoke
`handoff_spec_episode` for its exact episode without a fresh transport request.
The capability still fails closed unless location, owner, durable identity,
canonical prompts, and live daemon state match.

No custom prime-claw CLI, custom `prime-agent-core` agent, native merge or cleanup
command, general role registry, reviewer service, or arbitrary remote-command
router is required in the first release. `finalize_spec_episode` records and
closes lifecycle state only; it never decides whether the specification is done,
merges, abandons, stops sessions, removes worktrees, or deletes branches. Those remain later options only if this smaller
proven design fails in real use.

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
The identity kernel remains present, but this release adds no special controller
for those conversational steps. Detailed oversight guidance is inactive until a
successful `/implement-spec` transition.

Specification approval permits planning only. Plan approval does not create an
episode. Native `/implement-spec` is the explicit implementation boundary. Before
promotion it verifies the identity kernel, restoration plugin, canonical
`oversee-episode` package, and durable state surfaces. After successful episode
publication it durably binds oversight mode to the invoking conversation and
verifies the marker and spec-episode expectation before claiming activation.

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

After episode creation, the episode sends one coordination message identifying
the exact owner conversation and reports material progress, blockers, and
completion directly. Reports are evidence, never approval or native-command
dispatch.

Whenever the owned episode is actively working, the conversation maintains
exactly one non-steering 15-minute agent-owned heartbeat for that exact work
generation. This includes bootstrap, continuation, repairs, review rework, and
requested evidence. The watch uses existing observation and persisted
Git/session evidence and never steers active work.

Direct reports are the fast path; the heartbeat is a missed-report safety net. It
is cancelled as soon as the generation is reconciled as complete, blocked,
stopped, or waiting only for owner/operator action. A later generation gets a
fresh watch. Repeated unchanged idle polling or duplicate watches are bugs.

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

Every blocking EXPERT finding must be actionable enough for the EPISODE to have
a strong chance of repairing it in one pass. In addition to evidence, severity,
and impact, the report identifies the violated invariant and root cause or
lifecycle seam; recommends a repair direction and rationale without prescribing
an exact patch; names constraints and approaches to avoid; specifies concrete
positive, negative, failure, and replay acceptance evidence as applicable; and
calls out regression risks, dependencies, or findings that should be repaired
together. A true product decision includes bounded alternatives and one
recommendation. Before returning `BLOCK`, the reviewer checks that an implementer
can act without repeating the review investigation.

This guidance preserves independence. The EXPERT does not edit the subject or
dictate exact code; it supplies enough architectural and test direction to avoid
avoidable review/rework cycles.

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

The conversation and applicable project review policy decide when implementation
is complete; the host does not attempt to infer semantic completion. At the one
explicit operator gate, the conversation invokes the authorize phase of narrow
`finalize_spec_episode` with the exact location and closed disposition
(`merged` or `abandoned`). The capability confirms the disposition in the user
interface and writes an exact owner/episode authorization receipt. It performs no
Git, session, worktree, or branch mutation.

The conversation then uses the ordinary terminal path already proven in
dogfooding. It performs the authorized Git and supported Prime Agent operations,
verifies the result, stops the episode session, rechecks state, removes only the
owned worktree, and applies branch-retention policy. Dirty, ambiguous, or
uncertain state blocks destructive cleanup.

After terminal work, the conversation invokes the completion phase without a
second user confirmation. Trusted host code requires the matching authorization
receipt and conservatively validates exact Git objects, bound target and episode
tips, daemon rows, and worktree facts. The exact receipt lifecycle transaction is
serialized by a crash-released lock. Lock acquisition distinguishes readiness,
actual contention, and fatal path/runtime failure; retries only contention; and
has bounded timeout and cancellation. Unexpected holder loss blocks later
mutation. Contenders never delete a lock object or disturb a live holder. Delayed
calls reacquire and revalidate after UI confirmation and can never rewind newer
compatible evidence. It records `completing`, appends inactive oversight, clears
only the matching spec-episode ownership expectation, then records a durable
`completed` tombstone. Its shared startup classifier recognizes every exact
checkpoint the completion writer can durably leave, including a `completing`
receipt with an inactive matching marker while the matching expectation is still
retained after identity-removal failure. Recovery re-enters the existing locked
finalization coordinator, revalidates terminal facts, and completes without a
provider call, second confirmation, duplicate inactive marker, or effect on
another generation. An inactive marker plus expectation without the exact
matching `completing` receipt remains invalid. A crash or identical replay
reconciles from those monotonic boundaries without another confirmation. Recovery
validates the effective kernel and package before any lifecycle mutation and
performs no provider/model call. Failure or ambiguity preserves the receipt,
expectation, and marker evidence for another exact replay. The capability never
decides that the spec is implemented and never merges, abandons, or cleans resources itself.

Before oversight begins, the project conversation must verify that its required
native commands and workflow policy are available. Capability provisioning is
owned by the related
[universal-agent and project-conversation POC](../universal-agent-project-conversation-poc/SPECIFICATION.md).
Missing tooling is a visible preparation gap, not permission to imitate a
native transition.

Before sending a transition, it checks that the intended episode is idle and at
the expected reviewed Git boundary. After sending, it verifies enough persisted
session evidence to know that the transition was admitted before assuming work
has started. Ambiguity is surfaced rather than answered with blind duplicate
retries.

Successful completion of the authorized terminal receipt ends the episode, not
the conversation. The owner cancels episode-specific watches, releases transient
episode/review focus, and returns to ordinary discussion with its default
CONVERSATION identity intact. A
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

- identity-kernel and package readiness at the promotion boundary;
- exact-session oversight markers and agreement with spec-episode ownership;
- one fresh active role package on every real provider call;
- exact argument and path validation;
- owner, session, branch, worktree, and CWD identity;
- daemon state and quiescence checks;
- ordered handoff and execute admission;
- durable bootstrap admission checkpoints;
- at-most-once replay suppression; and
- preservation when mutation outcome is uncertain.

The identity kernel, active role package, and skill must not duplicate daemon
protocol or bypass these mechanics. Extension code must not decide product scope, review quality, or
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

1. a small universal `APPEND_SYSTEM.md` identity kernel with bounded-role
   precedence;
2. exact-session oversight activation tied to existing spec-episode identity
   state;
3. narrow two-phase terminal authorization/completion that records disposition
   and closes oversight without performing cleanup;
4. one canonical project-customizable `oversee-episode` skill whose current
   contents are supplied freshly during active oversight;
5. readiness and fail-closed validation for kernel, plugin, package, marker, and
   ownership expectation;
6. direct owner/episode reporting and one 15-minute non-steering heartbeat per
   active work generation;
7. owner-ledger routing of discoveries at stable review boundaries;
8. existing owner-driven continuation after exact-commit acceptance;
9. explicit EXPERT reviewer-model, evidence, and required-review failure policy;
   and
10. non-interference and return-to-incubation behavior around ordinary
   conversation, design, specification, and planning.

It reuses native automatic compaction and all existing deterministic host
mechanics.

## Non-goals

The first release does not add:

- a new conversation engine or controller for discussion, specification
  authoring/revision, or planning/revision;
- new replacements or wrappers for `/prepare`, `/design`, `/spec-it-out`,
  `/plan`, or `/implement-spec`;
- an autonomous universal-agent orchestrator;
- a unique or explicitly launched project-owner conversation;
- a general role registry or ownership-rebinding framework;
- custom CONVERSATION compaction or proactive self-handoff;
- a prime-claw wrapper CLI or custom `prime-agent-core` runtime;
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

The first plugin release is acceptable when native Prime Agent tests and one live
run demonstrate that:

1. multiple independent project sessions each receive exactly one CONVERSATION
   identity kernel without an explicit role flag;
2. ordinary conversation and the existing `/design`, `/spec-it-out`, `/plan`, and
   `/implement-spec` paths remain available;
3. `/implement-spec` refuses promotion when identity or oversight readiness is
   incomplete and, when ready, activates exact-session oversight without an
   unsolicited model turn;
4. the existing spec-episode identity and active marker agree on the exact owner,
   while an ordinary fork retains CONVERSATION capability without duplicating
   ownership;
5. every real active run receives exactly one current oversight package across
   ordinary prompts, reports, heartbeats, native follow-ups, tool continuation,
   reload, resume, and the first real turn after native auto-compaction;
6. missing, duplicate, or corrupt active identity/package state fails visibly
   before an ungoverned oversight model call;
7. an implement-spec target operates as EPISODE, an EXPERT remains a bounded
   reviewer, and a delegated child does not assume conversation ownership;
8. the conversation observes each active work generation with direct reporting
   plus exactly one non-steering 15-minute heartbeat;
9. it reconciles and independently reviews exact commits, continues or revises
   only within approved scope, and records discoveries in the owner ledger;
10. required EXPERT review uses the explicitly authorized model and reasoning
    level without silent fallback;
11. only the operator decides merge, abandonment, unresolved scope, and
    destructive cleanup; and
12. terminal disposition clears oversight state while leaving the same session
    available for ordinary conversation and later sequential episodes.

The run must also capture focused evidence for handoff-first bootstrap,
owner-driven continuation, actual `/implement-spec` identity transition, and
post-compaction recovery. Point-in-time POC and review evidence belongs in linked
reports and Beads rather than being copied into this living specification.

After that run, update this specification with observed friction. Add another
plugin capability only when evidence shows that the identity kernel, fresh role
package, skill, existing runtime, and readiness checks cannot meet the behavior.
