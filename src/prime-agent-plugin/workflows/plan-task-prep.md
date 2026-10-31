---
name: plan-task-prep
description: Request focused compaction before provider-native Ralph planning without controlling its queued continuation.
---

Read the canonical task ID from `<operator-plan-task-id>`, the exact selected
provider from `<operator-plan-task-provider>`, and its exact project root from
`<operator-plan-task-project-root>`. Backlog also carries
`<operator-plan-task-path>`; Beads must not. These bindings were selected by
native admission. Verify that the bound provider remains the sole unambiguous
live provider, but never reselect or substitute it. Do not guess or search for a
task, invent a task path, or leave the exact root.

Preserve the operator's actual instruction and approved scope. Explicit
conditional “plan this task, then implement it when ready” authority survives
planning, preparation, and compaction; planning alone does not authorize
implementation. An explicitly delegated task selection must already be bound
to this exact canonical ID within the operator's stated bounds. Delegation
never skips design or planning. Clarify material ambiguity or new scope; do not
require a prior invocation or a separate phase-history receipt as authority.

The canonical `plan-task` workflow is already queued independently as the sole
follow-up. This prep turn cannot cancel, replace, reconstruct, retry, or invoke
that workflow. Do not run `prepare`; the queued planning turn performs the
provider-appropriate orientation after the context boundary.

## Light readiness sniff

Inspect only enough native state to decide whether focused compaction is useful:

- **Backlog:** from the exact root run `backlog task view --json -- TASK-ID`.
  Require the returned canonical ID and project-relative path to equal the bound
  values, status exactly `In Design` or `In Planning`, and Description plus the
  other supported specification fields not all empty or obvious placeholders.
- **Beads:** from the exact root run `bd context --json` and
  `bd show TASK-ID --json --long --include-comments`. Require the context to
  identify that exact root and its live Dolt store with no redirect, the
  returned canonical ID to equal the entire selected ID, native status exactly
  `in_design` or `in_planning` mapped to canonical `In Design` or `In Planning`,
  and the provider-native specification fields not all empty or obvious
  placeholders. Retain the complete raw view and raw `design`; do not translate
  it into a normalized task or use a Backlog queue as Beads readiness evidence.

This is not the authoritative planning-readiness review. If the bound provider,
root, lookup, identity, path (when applicable), status, or sniff fails, do not
request compaction. Report the bounded reason in the required format and end the
turn. The queued `plan-task` workflow remains responsible for the complete
semantic readiness decision.

## Standard compaction request

If the sniff passes, reason from your current conversation context and compose
a concise `focus_hint` to plan the selected task. Keep the selected provider,
project root, canonical ID, native status, relevant specification context, and
complete raw Beads view when applicable. Provider observations are factual
context, not semantic acceptance. Preserve the exact binding, approved scope,
actual operator instruction, and any conditional implementation authority.
A planning-only request must remain planning-only. Use your judgment to decide
what context will be most useful for that mission.

Then call exactly once:

```python
compaction_result = await compact.run(focus_hint)
```

Interpret only the immediate result:

- `scheduled: true` means compaction was requested for the turn boundary. It is
  not confirmation that compaction completed.
- `scheduled: false` means no compaction was scheduled. Report its bounded
  reason without treating it as a workflow failure.
- If the call raises, report that the request failed without pasting a traceback
  or raw provider data.

In every case, the canonical `plan-task` follow-up remains independently
queued. Do not wait for a compaction event or infer a later outcome from its
absence.

After the sniff or compaction call, output only:

- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so Prime Agent can apply the context boundary and run the queued planning
workflow.
