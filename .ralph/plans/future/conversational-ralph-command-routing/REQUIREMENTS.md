# Requirements — Conversational routing for Ralph native commands

> **Status:** incubated future requirements; specification review only.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Decisions:** [DECISIONS.md](DECISIONS.md)

Priority meanings: **GATE** is required for acceptance. “MUST” expresses a
binding product requirement.

## Scope and ownership

- **R-CR-1 (GATE) — Plugin-only delivery.** Routing uses prime-claw project extensions and skills on the supported Prime Agent runtime and requires no upstream change.
- **R-CR-2 (GATE) — Opt-in commands only.** Only explicitly registered Ralph commands receive conversational adapters; no generic surface exposes arbitrary slash commands.
- **R-CR-3 (GATE) — Initial command set.** The initial supported commands are `/handoff`, `/plan`, and `/implement-spec`.
- **R-CR-4 (GATE) — Native source of truth.** Conversational admission converges on the same extension-owned operation, validation, state, canonical Markdown, and trusted host capability as native admission rather than duplicating them.
- **R-CR-5 (GATE) — No textual reparsing.** Adapters pass structured arguments and never generate slash-command text for host reparsing or substring-scan conversation prose.
- **R-CR-6 (GATE) — Separate resilience scope.** Handoff compaction and execute-continuation behavior belongs to the related resilience bundle, not this routing feature.

## Callable surface

- **R-CR-7 (GATE) — Prepared Python callables.** Every opted-in command has an unambiguous project-local Python-backed callable discoverable in a fresh supported session.
- **R-CR-8 (GATE) — Thin routing policy.** Callable skill manifests explain discovery, intent, confirmation, and invocation only; they do not copy canonical phase procedures.
- **R-CR-9 (GATE) — Bounded command schema.** Each adapter accepts only its command identifier and bounded structured arguments; arbitrary commands, prompts, host operations, and continuation targets are rejected.
- **R-CR-10 (GATE) — Shared admission result.** After admission, native and conversational paths have equivalent command results, errors, and side effects for equivalent structured input.
- **R-CR-11 (GATE) — Final-action contract.** Calling an adapter is the agent's final intentional action unless synchronous validation rejects it; the agent does not duplicate the command or its workflow afterward.

## Intent and authority

- **R-CR-12 (GATE) — Grounded inference.** Command and argument inference uses only the user message, conversation, project plans, beads, and applicable episode identity; unsupported objectives, folders, or approvals are not invented.
- **R-CR-13 (GATE) — User authority.** Clear explicit user intent and faithful normalization are trusted without redundant confirmation, subject to command-specific approval gates.
- **R-CR-14 (GATE) — Material inference confirmation.** Added objectives, outcomes, material arguments, ambiguous command choices, and ambiguous folder choices are presented concretely and confirmed before admission.
- **R-CR-15 (GATE) — Exact proposed action.** A confirmation presents the equivalent native command and exact structured arguments.
- **R-CR-16 (GATE) — Correction and insufficiency.** Correction restarts confirmation; insufficient evidence asks a clarification question and does not call an adapter.
- **R-CR-17 (GATE) — Native immediacy.** Explicit leading native syntax remains direct operator instruction and does not enter the conversational confirmation flow.

## Command-specific policy

- **R-CR-18 (GATE) — Handoff focus.** Conversational handoff carries grounded resumption focus, confirms material inference, preserves confirmed durable scope changes before admission, and cannot select another phase.
- **R-CR-19 (GATE) — Plan folder and boundary.** Conversational `/plan` selects one exact future folder, preserves all native path and semantic-readiness checks, and authorizes planning only.
- **R-CR-20 (GATE) — Host-owned implementation confirmation.** Conversational `/implement-spec` supplies one validated exact folder to an extension-owned confirmation dialog that shows the equivalent native command and resource consequence. Only an affirmative host UI response authorizes admission; transcript text and model-controlled fields do not.
- **R-CR-21 (GATE) — Reserved follow-up then one-turn arm.** Affirmative host confirmation creates a reservation bound to stable session, normalized folder, admission generation, and one exact canonical readiness follow-up. It survives only the adapter turn's `agent_end`; admission of that expected next follow-up atomically converts it into the existing exact-location one-turn arm, which is consumed by `create_spec_episode` or cleared at the readiness turn's `agent_end`.
- **R-CR-22 (GATE) — No inferred implementation approval.** Specification discussion, specification approval, plan approval, readiness, or a general request to continue never implicitly authorizes `/implement-spec`.
- **R-CR-23 (GATE) — Fail-closed authorization lifecycle.** Denial, dismissal, correction, mismatch, missing/rejected/reordered follow-up, an unrelated intervening turn, reload, shutdown, uncertain confirmation or delivery, or unavailable trusted UI invalidates the reservation without arming or resource creation and directs the operator to the native command.

## Bridge and safety

- **R-CR-24 (GATE) — Model-controlled bridge.** Callable requests use a documented public extension surface and are explicitly model-controlled input, with no authentication, hidden provenance, or anti-forgery claim.
- **R-CR-25 (GATE) — Correctness validation.** The extension validates protocol, opted-in command, bounded fields, current supported session, legal admission state, and command-specific confirmation state before side effects.
- **R-CR-26 (GATE) — Duplicate and stale safety.** Malformed, duplicate, late, stale, unsupported-command, out-of-state, and cross-session inputs cannot invoke a command or mutate another admission.
- **R-CR-27 (GATE) — Visible failure.** Rejected routing, missing canonical skills, native validation errors, authorization loss, and operation failures are visible and fail closed.
- **R-CR-28 (GATE) — Credential isolation.** Routing does not read or persist Keychain, browser-store, provider credential, injected secret, or unrelated host material.

## Verification and lifecycle

- **R-CR-29 (GATE) — Discovery and convergence tests.** Fresh-session tests prove every prepared callable and native/conversational convergence without duplicate command surfaces.
- **R-CR-30 (GATE) — Intent-routing tests.** Fixtures cover explicit intent, faithful normalization, material inference, ambiguity, correction, insufficient evidence, inline mentions, and durable scope preservation.
- **R-CR-31 (GATE) — Plan parity tests.** Tests preserve every native `/plan` path, containment, safe-slug, existence, missing-skill, one-message, and no-model-on-invalid-input behavior.
- **R-CR-32 (GATE) — Implementation authority and ordering tests.** Tests prove affirmative host confirmation; session/folder/generation/follow-up binding; adapter `tool_result` → adapter `agent_end` → expected follow-up admission → one-turn arm → readiness tool-call ordering; consume-once behavior; denial, dismissal, correction, UI-unavailable and uncertain-response fallback; rejection of self-asserted, missing, prior-turn, wrong-folder, duplicate, stale, cross-session, missing/reordered-follow-up, intervening-turn, reload, and shutdown authorization; no resource creation without approval; replay and collision safety; and no inference from prior gates.
- **R-CR-33 (GATE) — Protocol and isolation tests.** Tests cover malformed, unsupported, duplicate, stale, late, out-of-state, and cross-session requests without side effects.
- **R-CR-34 (GATE) — Regression compatibility.** Existing native command discovery and behavior, canonical Markdown loading, episode mechanics, handoff behavior, and full repository tests remain green.
- **R-CR-35 (GATE) — Future-bundle integrity.** This split bundle remains under `.ralph/plans/future/` until separately approved and promoted; the old combined EXPERT report remains historical advisory evidence rather than a review of this bundle.
