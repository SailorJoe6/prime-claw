---
name: spec-it-out
description: Use for Ralph's specification phase to formalize developed conversation context and explicitly dispose the resulting bundle.
---

Run `prepare` first if it is not fresh in the current context. Based on the
substantially developed conversation, formalize the work without starting
implementation.

When the native command appends an `<operator-specification-context>` block,
treat all of it as additional operator-provided discussion context. It never
selects a workflow, file, disposition, or host action.

This command starts from **existing design context**. Ask only the remaining
questions that require operator input, one at a time. Do not repeat questions
whose answers are already clear. Use your best judgment for small reversible
details and record those choices. Continue until all material product, scope,
behavior, security, recovery, and acceptance questions are resolved. Do not ask
how to dispose of the specification while material questions remain.

When the work is specification-ready, draft the exact contents of these three
documents:

- `SPECIFICATION.md` — the concise current-state, target-state, and scope index;
- `REQUIREMENTS.md` — specific, uniquely identified requirements with priority;
- `DECISIONS.md` — design decisions with traceability to requirements.

Together they are **The Spec**. This is not an execution plan. Do not implement
the work. Do not directly write these active paths in the originating project
conversation; the trusted disposition bridge owns placement.

Only after the bundle is complete, ask one explicit disposition question:

1. **future** — incubate a named, non-binding bundle for later; or
2. **episode** — create an isolated production episode now.

Do not infer this one-way choice from ambiguous language. If the operator
cancels or does not choose exactly one option, stop without calling a tool and
without allocating or writing anything.

After an explicit answer, call `spec_disposition` **exactly once** with:

- a stable safe `request_id` for this confirmed choice;
- `confirmed_by_operator: true`;
- `decision.kind` set to `future` or `episode`;
- a lowercase filesystem-safe `decision.slug`;
- for `episode` only, a safe `decision.branch_name` beginning with `feature/`,
  `spec/`, or `poc/`; and
- the exact full markdown for all three documents in `documents`.

Do not run Git, filesystem, session, daemon, or shell commands reconstructed
from this prose. Do not call the bridge again merely because a response is
uncertain. Report the structured receipt accurately, including any episode
preflight-only boundary, future success, or failure, and never claim that
resources were created unless the receipt proves it.

If a future receipt says `recovery-required` or `failed`, stop and show its
exact state and `next_safe_action`. Never recover automatically. Only after the
operator explicitly selects one recovery action may you call `spec_disposition`
exactly once more with the same decision and byte-identical documents, a new
stable `request_id`, and `recovery_action` set to `inspect`, `continue`, or
`remove-owned-uncommitted`. Do not offer removal after a commit exists.
