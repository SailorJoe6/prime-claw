# Specification — Conversational routing for Ralph native commands

> **Status:** incubated future specification; not approved for planning or implementation.
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)
> **Delivered command architecture:** [Future specification bundles](../../../../docs/future-specification-bundles.md)
> **Related future work:** [Handoff continuation resilience](../handoff-continuation-resilience/SPECIFICATION.md)
> **Historical advisory evidence:** [`reports/reviews/handoff-resilience-spec-review-a93c27c.md`](../../../../reports/reviews/handoff-resilience-spec-review-a93c27c.md)

## 1. Purpose

Allow a project conversation to invoke selected Ralph native commands naturally
without requiring the operator to type slash syntax, while preserving exactly
the validation, customizable policy, authority, and mechanical operation of each
native command.

The initial opt-in command set is:

- `/handoff [guidance]`;
- `/plan .ralph/plans/future/<slug>`; and
- `/implement-spec .ralph/plans/future/<slug>`.

Conversational routing is an additional admission UX, not another implementation
of those commands. It must converge on the same extension-owned operation after
admission and must never weaken operator approval boundaries.

## 2. Context

The archived
[worktree-isolated specification episode](../../archive/worktree-isolated-specification-episodes/SPECIFICATION.md)
delivered native `/plan` and `/implement-spec` commands. Deterministic extension
code validates the selected future folder and loads project-customizable
Markdown. `/implement-spec` additionally arms one exact operator-approved folder
for one model turn before the trusted host capability may create an episode.

Native `/handoff` follows the same broad separation: extension code owns command
mechanics and loads canonical project-local workflow Markdown. The related
handoff-continuation specification separately fixes its compaction-dependent
continuation defect.

Today, natural-language requests reach the model as ordinary conversation, but
there is no supported prepared callable that admits them into these native
operations. Generating slash-command text in an assistant response is not an
acceptable substitute: it depends on reparsing behavior, obscures authority,
and can diverge from native validation.

## 3. Goals

- Provide fresh-session discoverable, project-local callable adapters for the
  three initial native Ralph commands.
- Keep every command opt-in rather than exposing arbitrary slash commands.
- Preserve each native command as the source of deterministic behavior.
- Make the exact proposed command and structured arguments visible before any
  materially inferred or authority-bearing action.
- Trust explicit user intent and confirm only material inference or required
  approval boundaries.
- Preserve `/implement-spec` as an explicit implementation authorization.
- Keep routing instructions thin and avoid copying canonical phase procedures.
- Establish a reusable adapter contract for later Ralph native commands.

## 4. Non-goals

This work does not:

- repair handoff continuation or compaction behavior;
- expose every Prime Agent or project slash command automatically;
- substring-scan prose for command-looking text;
- allow a model to self-authorize planning or implementation;
- bypass native path containment, safe-slug, readiness, collision, one-turn arm,
  or episode-creation checks;
- generate slash-command strings and rely on the host to reinterpret them;
- standardize project-specific specification or plan filenames;
- implement the complete Ralph loop or episode orchestrator; or
- modify Prime Agent core or require an unsolicited upstream change.

## 5. Architecture

### 5.1 Opt-in command adapters

Each supported command declares an explicit conversational adapter. The adapter
has:

- a prepared Python callable discoverable in a fresh supported project session;
- a bounded structured argument schema;
- a command-specific authority and confirmation policy; and
- a route to the same extension-owned operation used by native admission.

Planning may choose one shared Python package or separate command modules, but
user-facing discovery must make the available callables and their semantics
unambiguous. Packaging must not create duplicate slash-command surfaces or copy
canonical workflow prose.

### 5.2 Shared operation, different admission UX

Native invocation remains direct operator syntax. Conversational invocation may
need the agent to identify a command, normalize arguments, explain the exact
action, and obtain confirmation. After admission, both paths use the same:

- deterministic validation;
- current project-local canonical Markdown;
- extension-owned state and command operation;
- trusted host capability, where applicable; and
- result and error semantics.

The adapter passes structured arguments. It does not paste or synthesize a slash
command for reparsing and does not reimplement the native handler in Python.

### 5.3 Model-controlled callable bridge

The callable is controlled by the acting model. Any public bridge marker or
request therefore provides correctness validation, not authentication or hidden
provenance. The extension accepts only:

- a supported protocol and opt-in command identifier;
- bounded allowlisted structured arguments;
- the current supported session and legal admission state; and
- any exact confirmation or one-turn authorization state required by that
  command.

Arbitrary command names, prompts, paths, host operations, or continuation targets
are rejected. Rejection is visible and fails closed before command side effects.

### 5.4 Host-owned implementation authorization

Natural-language or model-reported confirmation is not sufficient provenance for
`/implement-spec`. The model-controlled callable cannot assert an `approved`
field or manufacture authorization state.

After the adapter supplies one validated exact future-folder location, the
extension displays a host-owned confirmation dialog that names the equivalent
native command, exact folder, and branch/worktree/session consequence. Only an
affirmative host UI response creates an ephemeral authorization reservation.
The reservation is bound to the stable session, normalized folder, one admission
generation, and the exact canonical readiness follow-up that the extension then
queues once.

This is a two-stage transition. The reservation survives only the adapter turn's
`agent_end`. When the expected extension-delivered follow-up is admitted next,
the extension atomically converts the matching reservation into the existing
exact-location one-turn arm. The readiness turn may then call
`create_spec_episode`; that call consumes the arm, and that readiness turn's
`agent_end` clears any unused arm.

Denial, dismissal, correction, folder or generation mismatch, missing/rejected
or reordered follow-up, any unrelated intervening user or agent turn, reload,
shutdown, or uncertain delivery invalidates the reservation without arming.
Duplicate, stale, and cross-session requests cannot consume it. If the supported
client has no trusted extension UI confirmation channel, the exact follow-up
cannot be identified and admitted safely, or delivery is uncertain,
conversational `/implement-spec` fails closed and directs the operator to invoke
the native command. Planning must prove these host surfaces and ordering in the
supported runtime.

## 6. Authority and confirmation model

The agent may use the user message, current conversation, active/future plans,
beads, and applicable episode identity to identify a possible command and its
arguments. It must not invent unsupported objectives, folder selections, or
approval.

Explicit user intent is authoritative. Faithful normalization alone does not
require a redundant question. Confirmation is required when the agent:

- adds or changes an objective or outcome;
- selects among multiple plausible commands or folders;
- supplies a material argument absent from the user request; or
- approaches a command-specific approval boundary.

When confirmation is required, the agent presents one concrete action including
the equivalent native command and exact arguments. A correction restarts that
confirmation. Insufficient evidence produces a clarification question rather
than a guessed call.

## 7. Command-specific contracts

### 7.1 `/handoff [guidance]`

Conversational handoff carries a resumption focus: what the next execute pass
should retain or be prepared to do, including relevant evidence, constraints,
questions, and resume point. Focus does not itself approve a gate or select a
phase.

Materially inferred focus requires confirmation. Clear user-supplied focus may
proceed without a redundant question. If confirmed intent changes durable scope,
acceptance conditions, constraints, or findings, the applicable authoritative
artifacts are updated before admission.

The adapter converges on native handoff admission and the canonical handoff
workflow. The separate resilience bundle owns finalization and continuation
behavior.

### 7.2 `/plan <future-folder>`

The adapter identifies one exact existing folder under `.ralph/plans/future/`
and presents the equivalent native command when selection was inferred or
ambiguous. It reuses native path, containment, realpath, safe-slug, existence,
and canonical-skill loading checks.

Conversational planning records readiness to plan from that folder only. It does
not authorize implementation, allocate an episode, or weaken the plan skill's
semantic readiness review.

### 7.3 `/implement-spec <future-folder>`

This command is an explicit implementation approval boundary. Conversational
admission supplies one validated exact folder to the extension, which obtains the
host-owned confirmation defined in §5.4. The dialog names the equivalent native
command and resource-creation consequence. Transcript text or a model-controlled
bridge field cannot substitute for the affirmative host response.

After confirmation, the extension reserves authorization for exactly one
identified canonical readiness follow-up. Admission of that expected follow-up
atomically converts the reservation into the same exact-location, one-turn arm
used by native invocation. The arm is consumed by `create_spec_episode` or
cleared at the readiness turn's end. Semantic readiness review, replay
protection, and collision safety remain unchanged. The agent cannot infer
implementation approval from specification discussion, plan approval, readiness,
or a desire to continue. Without supported trusted UI and follow-up-ordering
surfaces, the adapter fails closed to the native command.

## 8. Workflow contract

After invoking a prepared command adapter, the invocation is the agent's final
intentional action in that turn unless the adapter synchronously reports a
validation rejection that requires explanation. The agent does not paste
workflow prose, issue the equivalent slash command separately, or duplicate a
trusted host action.

This is an agent-workflow contract, not a false guarantee that Python terminates
the model or cancels already scheduled host work. For conversational
`/implement-spec`, extension-owned confirmation and follow-up reservation occur
during that final adapter action; canonical readiness runs only in the bound next
follow-up turn described in §5.4.

## 9. Verification

Tests must prove:

1. each opt-in adapter is discoverable with its prepared callable in a fresh
   supported project session;
2. native and conversational admissions converge on the same operation and
   canonical Markdown after deliberately different admission UX;
3. inline command mentions remain ordinary conversation;
4. explicit intent, faithful normalization, material inference, correction,
   ambiguity, and insufficient evidence follow the authority model;
5. `/plan` preserves every native invalid-path and no-model-invocation guard;
6. `/implement-spec` proves adapter `tool_result` → adapter `agent_end` → exact
   follow-up admission → one-turn arm → readiness tool-call ordering, with the
   authorization bound to session, folder, generation, and follow-up identity;
7. self-asserted, missing, denied, dismissed, UI-unavailable, wrong-folder,
   prior-generation, duplicate, stale, unsupported-command, cross-session,
   missing/reordered follow-up, intervening turn, reload, and shutdown paths fail
   closed without side effects;
8. no adapter duplicates native behavior or canonical phase prose; and
9. native command discovery and the complete repository suite remain green.

## 10. Split provenance

This bundle preserves and broadens the conversational-routing portion of the
former combined draft:

| Former combined material | Split destination |
|---|---|
| Routing portions of R-HR-1..5 | R-CR-1..6 |
| R-HR-7..16 callable admission, final-action, focus, inference, and authority | R-CR-7..18 |
| Conversational aspects of R-HR-26..35 bridge, validation, state, and safety | R-CR-24..28 |
| R-HR-36..37 entry convergence and focus-routing evidence | R-CR-29..30 |
| Applicable R-HR-39..42 protocol, ordering, runtime, and regression evidence | R-CR-31..34 |
| R-HR-43 future-bundle and evidence lifecycle | R-CR-35 |
| D-HR-5..9 and D-HR-11..15 routing-relevant decisions | D-CR-1..8 |

Operator dispositions HR-SPEC-001..008 remain incorporated where applicable,
including user authority, material-inference confirmation, model-controlled
bridge classification, bounded data, accurate security claims, and the support
boundary. This split intentionally broadens the feature from conversational
`/handoff` alone to opt-in routing for `/handoff`, `/plan`, and
`/implement-spec`; that broader scope requires its own future review.

## 11. Delivery order and lifecycle

The handoff adapter may depend on the accepted handoff-continuation capability;
the `/plan` and `/implement-spec` adapters retain the mechanics that already
landed. Planning should deliver the shared opt-in adapter contract first and then
command-specific vertical slices with authority tests.

This bundle remains under `.ralph/plans/future/` until separately approved,
planned with native `/plan`, reviewed, and promoted with native
`/implement-spec`. The old combined EXPERT report is historical advisory
evidence only and does not approve this broader split specification.
