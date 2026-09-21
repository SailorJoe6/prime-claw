# Decisions — Conversational routing for Ralph native commands

> **Status:** incubated future decisions; specification review only.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
> **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md)

## D-CR-1 — Build an opt-in adapter layer

**Decision:** Add conversational adapters only for explicitly registered Ralph
native commands, initially `/handoff`, `/plan`, and `/implement-spec`. Do not
expose arbitrary slash commands.

**Satisfies:** R-CR-1, R-CR-2, R-CR-3, R-CR-6.

**Rationale:** Command authority and arguments differ. Automatic exposure would
turn a convenience feature into an uncontrolled command surface.

## D-CR-2 — Converge on native operations, not command text

**Decision:** Pass bounded structured arguments into the same extension-owned
operation used by native admission. Never synthesize slash text for reparsing or
copy deterministic validation and canonical workflow prose into Python.

**Satisfies:** R-CR-4, R-CR-5, R-CR-8, R-CR-9, R-CR-10.

**Rationale:** One operation prevents behavioral drift and preserves the tested
native trust boundary.

## D-CR-3 — Provide fresh-session prepared callables

**Decision:** Each opted-in command has an unambiguous project-local
Python-backed callable discoverable in a fresh supported session. Planning may
choose shared or command-specific packaging only if discovery, command identity,
and thin routing policy remain explicit.

**Satisfies:** R-CR-7, R-CR-8, R-CR-11, R-CR-29.

**Rationale:** Conversational agents need a supported callable, while packaging
is secondary to clear discovery and behavior.

## D-CR-4 — Trust explicit intent and confirm material inference

**Decision:** Trust clear operator intent and faithful normalization. Confirm the
exact equivalent native command when the agent adds material meaning, chooses
among plausible commands or folders, or approaches a command-specific approval
boundary. Corrections restart confirmation.

**Satisfies:** R-CR-12, R-CR-13, R-CR-14, R-CR-15, R-CR-16, R-CR-17.

**Rationale:** The user is authoritative, but the model must not silently invent
scope, arguments, or authorization.

## D-CR-5 — Keep command-specific authority explicit

**Decision:** Handoff confirms materially inferred focus and preserves durable
scope changes. Plan binds one exact future folder and authorizes planning only.
Implement-spec requires an affirmative extension-owned UI confirmation that
creates a reservation bound to stable session, normalized folder, generation,
and one exact queued readiness follow-up. The reservation survives only the
adapter turn end, converts atomically to the existing one-turn arm when that
follow-up is admitted next, and is otherwise invalidated. Unavailable or
uncertain confirmation or ordering fails closed to the native command.

**Satisfies:** R-CR-18, R-CR-19, R-CR-20, R-CR-21, R-CR-22, R-CR-23.

**Rationale:** A reusable adapter contract must not flatten materially different
approval semantics.

## D-CR-6 — Treat callable requests as model-controlled input

**Decision:** Validate a narrow public bridge for correctness, current session,
legal state, opted-in command, and bounded arguments. Model-controlled input
cannot assert host approval. Treat the extension UI response as the authorization
source for implement-spec and reject unsafe or unconfirmed input before side
effects.

**Satisfies:** R-CR-24, R-CR-25, R-CR-26, R-CR-27, R-CR-28.

**Rationale:** The model controls Python input. Schema and state checks prevent
accidental misuse but do not create hidden provenance.

## D-CR-7 — Prove parity and authority at each command boundary

**Decision:** Test fresh discovery and common admission, then separately prove
handoff intent routing, complete native plan validation parity, implement-spec
host-owned authorization, reserved-follow-up ordering, one-turn arming,
protocol isolation, and full native regression compatibility.

**Satisfies:** R-CR-29, R-CR-30, R-CR-31, R-CR-32, R-CR-33, R-CR-34.

**Rationale:** Shared plumbing cannot prove command-specific approval semantics.
Each native boundary needs focused evidence.

## D-CR-8 — Keep the broader split bundle incubated

**Decision:** Keep this specification under its own future folder through
separate specification review, native planning, plan review, and native
implementation promotion. Treat the old combined EXPERT report only as
historical advisory evidence.

**Satisfies:** R-CR-35.

**Rationale:** This feature is broader than the reviewed combined handoff draft
and requires its own approval and review evidence.

## Decision → requirement traceability

| Decision | Requirements |
|---|---|
| D-CR-1 | R-CR-1, R-CR-2, R-CR-3, R-CR-6 |
| D-CR-2 | R-CR-4, R-CR-5, R-CR-8, R-CR-9, R-CR-10 |
| D-CR-3 | R-CR-7, R-CR-8, R-CR-11, R-CR-29 |
| D-CR-4 | R-CR-12, R-CR-13, R-CR-14, R-CR-15, R-CR-16, R-CR-17 |
| D-CR-5 | R-CR-18, R-CR-19, R-CR-20, R-CR-21, R-CR-22, R-CR-23 |
| D-CR-6 | R-CR-24, R-CR-25, R-CR-26, R-CR-27, R-CR-28 |
| D-CR-7 | R-CR-29, R-CR-30, R-CR-31, R-CR-32, R-CR-33, R-CR-34 |
| D-CR-8 | R-CR-35 |

Every GATE requirement is covered by at least one decision.
