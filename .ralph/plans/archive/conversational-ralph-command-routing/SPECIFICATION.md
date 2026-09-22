# Specification — Conversational routing for Ralph native commands

> **Status:** implemented and archived; awaiting renewed final Expert review and the explicit HITL merge decision.
> **Delivered command architecture:** [Future specification bundles](../../../../docs/future-specification-bundles.md)
> **Related delivered work:** [Handoff continuation resilience](../handoff-continuation-resilience/SPECIFICATION.md)
> **Historical advisory evidence:** [`reports/reviews/handoff-resilience-spec-review-a93c27c.md`](../../../../reports/reviews/handoff-resilience-spec-review-a93c27c.md)

## Purpose

Let a project conversation respond naturally when the operator asks it to use a
selected Ralph native command, without requiring the operator to remember and
type exact slash syntax.

The initial commands to consider are:

- `/handoff [guidance]`;
- `/plan .ralph/plans/future/<slug>`; and
- `/implement-spec .ralph/plans/future/<slug>`.

Conversational routing is an additional admission experience. It must reuse the
native command's behavior and must not weaken its validation or authority
boundary.

## Current system

Prime Claw now provides native `/plan` and `/implement-spec` commands through the
architecture delivered by the archived
[worktree-isolated specification episode](../worktree-isolated-specification-episodes/SPECIFICATION.md).
Deterministic extension code validates paths and loads current project-local
workflow Markdown. `/implement-spec` is the explicit boundary that may create a
branch, worktree, and episode.

Native `/handoff` similarly combines extension mechanics with canonical
project-local workflow Markdown. Its continuation reliability was delivered by
the archived handoff-resilience work linked above.

Natural-language requests currently reach the model as ordinary conversation.
Conversational adapters now cover handoff and reviewed planning. The required
installed-runtime characterization found that conversational implementation
cannot preserve the approved one-run authorization boundary: `agent_end` occurs
between the matching extension input and the readiness turn. Therefore
implementation promotion remains native-only; no `ralph_implement_spec` tool is
registered.

## Desired experience

The operator can state an intent naturally, for example:

- “Hand off and have the next pass investigate the failed ordering test.”
- “Plan the handoff-continuation-resilience specification.”
- “I have approved that plan; start its implementation episode.”

The agent identifies a supported command and its arguments, asks only for
material clarification or required approval, and then invokes the same operation
used by the native command.

The agent must not print a slash command and assume the host will reparse it. It
must not reproduce native validation or workflow behavior in a second
implementation.

## Command authority

Different commands have different consequences and must not be flattened into a
single generic approval rule.

| Command | Conversational authority rule |
|---|---|
| `/handoff` | Clear user-supplied focus may proceed. Materially inferred objectives or outcomes require confirmation. |
| `/plan` | Bind one exact future folder and make clear that the action creates a plan only. Ambiguous folder selection requires confirmation. |
| `/implement-spec` | Preserve explicit operator authorization for the exact future folder and the branch/worktree/session consequence. Never infer implementation approval from prior discussion, specification approval, plan approval, readiness, or a general request to continue. |

If the supported runtime cannot provide a simple, trustworthy conversational
approval path equivalent to native `/implement-spec`, that command remains
native-only. The feature must not build a large authorization subsystem merely
to claim uniform conversational coverage.

## Product constraints

- Commands are exposed explicitly and individually; arbitrary slash commands are
  not automatically callable.
- Native handlers and trusted host capabilities remain the source of behavior.
- Conversational input uses structured command arguments rather than textual
  slash-command reparsing.
- Inline command mentions are ordinary prose and are not intercepted by
  substring matching.
- Clear explicit user intent is trusted.
- Adding an objective, selecting among plausible folders, or crossing an
  authority boundary requires a concrete confirmation.
- Corrections replace the proposed action; insufficient evidence produces a
  clarification question rather than a guess.
- Project-customizable phase procedures remain in their canonical Markdown.
- Missing adapters, rejected input, unavailable approval, and native command
  failures are visible and fail closed.
- Low-likelihood cases already bounded by one agent run, exact path validation,
  or existing episode identity/replay checks do not justify nonces, leases,
  timers, durable approval state, or a generalized authorization machine.
- Routing does not access or persist credentials or unrelated host data.

## Scope

This specification defines the product behavior for opt-in conversational
routing of Ralph native commands.

It does not:

- fix handoff compaction or continuation;
- expose every Prime Agent command;
- automate the complete Ralph lifecycle;
- let the model self-authorize implementation;
- replace native path, readiness, collision, replay, or episode checks;
- standardize project-specific artifact filenames; or
- require Prime Agent core changes.

## Open design questions

Planning must audit the current runtime and answer these questions before choosing
an implementation:

1. What is the smallest supported callable surface an agent can discover in a
   fresh project session?
2. How can that surface invoke the same operation as a native command without
   copying the handler?
3. Which arguments and confirmation rules belong to each command?
4. Can `/implement-spec` obtain trustworthy explicit approval simply with the
   supported host APIs, or should it remain native-only?
5. Should the first delivery cover only `/handoff`, `/plan`, or both before
   considering `/implement-spec`?
6. What evidence proves that conversational and native admission converge after
   their intentionally different UX?

These are planning and implementation questions, not predetermined protocol or
state-machine requirements.

## Acceptance examples

A successful design must demonstrate:

- discoverable conversational invocation for each command actually included;
- the same canonical workflow and deterministic validation as native invocation;
- direct handling of clear intent without needless questions;
- confirmation for materially inferred focus or ambiguous folder choice;
- `/plan` that cannot escape `.ralph/plans/future/` and cannot begin
  implementation;
- no episode creation without explicit authorization equivalent to native
  `/implement-spec`, if conversational implementation is included;
- no side effects for rejected, ambiguous, stale, or unsupported requests;
- no duplicate native command surface or copied phase workflow; and
- unchanged native command behavior and passing repository regression tests.

## Delivery guidance

Planning should begin with a current-code audit and prefer small vertical slices.
A reasonable order may be conversational `/handoff`, conversational `/plan`, and
only then a feasibility decision for conversational `/implement-spec`. This is
guidance, not a mandated implementation architecture.

This native `/plan` invocation records specification approval for planning
only. The bundle remains in `.ralph/plans/future/` until the operator separately
approves the resulting execution plan and invokes native `/implement-spec`.

## Provenance

This specification was split from the earlier combined
`handoff-resilience-and-conversational-routing` draft when operator review found
that conversational routing should apply beyond handoff to the native commands
delivered by the worktree-isolated episode.

The old EXPERT report is immutable historical advisory evidence. It did not
review this broader simplified specification. The earlier requirements and
decisions catalogs were intentionally removed because they encoded speculative
infrastructure before the product behavior and simplest implementation were
understood.
