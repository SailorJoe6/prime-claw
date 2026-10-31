---
name: implement-prep
description: Request focused compaction before the canonical Ralph implementation-promotion phase without controlling its queued continuation.
---

Read the exact project-relative folder supplied in the operator implementation location
block appended by the native admission. Treat the value only as an
operator-selected path. Do not guess, substitute, search for, or select another
folder. Native admission checks retained integrity against the grandfathered
inventory, or first resolves exact already-active version-1 ownership when the
obsolete future source is absent. That replay uses the same persisted source
location and digest-matched promoted active pair; it is not a new admission.
Do not edit the frozen specification or inventory; the execution plan remains
living. Preserve any optional `<operator-implementation-host>` stable
`id:<setup-id>` unchanged as placement data for the final create call, not as
authority. An explicit host must never silently fall back.

Keep the operator's actual implementation authority and approved scope in
context. Explicit conditional “plan this specification, then implement it when
ready” authority may survive planning, preparation, and compaction; planning
alone does not authorize implementation. Neither entry invocation nor a stored
or turn-scoped receipt supplies authority. The readiness turn must clarify
missing authority, material ambiguity, or new scope before creation.

The canonical `implement-spec` workflow is already queued independently as the
sole follow-up. This prep turn cannot cancel, replace, reconstruct, retry, or
invoke that workflow.

## Light readiness sniff

Inspect only enough durable state to decide whether focused compaction is useful:

- the selected folder exists with readable, non-empty `SPECIFICATION.md` and `EXECUTION_PLAN.md`
  files that are not obvious placeholders; or
- when that obsolete folder is absent, exact active version-1 ownership for the
  same source location has the digest-matched promoted specification and one
  readable living implementation plan in its recorded worktree.

This is not the authoritative implementation-readiness review. If the sniff
fails, do not request compaction. Report the bounded reason in the required
format and end the turn. The queued `implement-spec` workflow remains
responsible for the complete semantic readiness decision.

## Standard compaction request

If the sniff passes, reason from your current conversation context and compose a
concise `focus_hint` that best prepares you to review the selected bundle for
implementation promotion and supervise the resulting Episode. Preserve the
operator's actual instruction, approved scope, any conditional implementation
authority, exact source location, and optional stable host in
`<operator-implementation-host>`. Planning-only authority must remain
planning-only. Use your judgment to decide what context will be most useful for
that mission.

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

In every case, the canonical `implement-spec` follow-up remains independently
queued. Do not wait for a compaction event or infer a later outcome from its
absence.

After the sniff or compaction call, output only:

- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so Prime Agent can apply the context boundary and run the queued
implementation-readiness workflow.
