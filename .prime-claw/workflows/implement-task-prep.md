---
name: implement-task-prep
description: Request focused compaction before provider-native task Episode admission without controlling its queued continuation.
---

Read the canonical task ID from the `<operator-implementation-task-id>` block
appended by native admission. Treat it only as the exact selected task, including
selection explicitly delegated within the operator's bounds. Do not guess,
substitute, search for, or select another task here. Preserve any optional
`<operator-implementation-host>` stable `id:<setup-id>` unchanged as placement
data for the final create call, not as authority.

Keep the operator's actual implementation authority and approved scope in
context. Explicit conditional “plan this task, then implement it when ready”
authority may survive planning, preparation, and compaction; planning alone does
not authorize implementation. Neither entry invocation nor a stored or
turn-scoped receipt supplies authority. The readiness turn must clarify missing
authority, material ambiguity, or new scope before creation. Implementation
selection requires `In Planning` (Beads native `in_planning`) after design and
planning, not dependency readiness alone; no separate phase-history proof is
required.

The canonical `implement-task` workflow is already queued independently as the
sole follow-up. This prep turn cannot cancel, replace, reconstruct, retry, or
invoke that workflow. Do not run `prepare`; the queued implementation-readiness
turn does that after the context boundary.

Read any `<operator-implementation-task-provider>` and
`<operator-implementation-task-project-root>` blocks as factual observations
from entry. Backlog may also carry `<operator-implementation-task-path>`;
Beads has no task path. Compare these observations and the exact task ID with
fresh native resolution below. Genuine provider, canonical identity, root, or
Backlog path drift blocks creation and must be reported for clarification; do
not silently rebind to another task or workspace. These observations are not
approval, revision/content locks, or invocation receipts. Compatible same-task
content refinements remain facts for semantic readiness review, not an automatic
reapproval gate. Do not require an earlier entry or manufacture missing receipt
evidence when current native resolution and operator authority are sufficient.

The `<operator-implementation-task-observation>` block contains the complete
provider-native task-view JSON observed while queueing this chain. Keep its
native envelope, field names, values, and absent fields for both Backlog and
Beads. It is factual context, not implementation approval, a frozen revision,
or evidence that the entry tool checked lifecycle eligibility. Reread the exact
native task before readiness decisions or mutation; judge compatible refinements
from the current task rather than rejecting a newer observation solely because
it differs.

This editable workflow owns status and readiness decisions. Implementation
requires `In Planning` (Beads `in_planning`) and a meaningful native
Implementation Plan or raw Beads `design`, not status or dependency readiness
alone. An unexpected or unmapped native status or an inadequate plan must be
explained without mutation or creation; do not rely on entry or prep-chain code
to reject it. Successful queue admission is not permission to create resources.

## Native lookup and explicit workspace actions

A task lookup observes the selected workspace as it is. It does not prepare a
missing Backlog clone, fetch or fast-forward task history, or validate lifecycle
configuration before returning a readable task. Beads raw statuses and absent
fields remain facts even when no canonical status alias exists. Use the native
view below to make the stage's eligibility decision; a readable task is not
permission to advance it.

Inspect task history and publication when this stage needs them. Perform any
needed preparation or synchronization explicitly, using the supported native
operations on the intended workspace. Preserve unrelated staged, unstaged and
untracked task/code work. Do not repair another Conversation's workspace or
require it to be globally clean to read this task. Report native command failures
truthfully; a failed read does not authorize initialization or another store.

Preparation and publication return native observations and operation results,
not a cleanliness or frozen-revision approval. Keep native task fields, history,
workspace/database/branch/remote identities, and consequential failure evidence
in the readiness focus. A newer remote head alone does not reject the selected
task. The readiness Agent must inspect intended exact-task changes, preserve
unrelated bytes and staging, and decide any real conflict before requesting an
operation. Beads v1.3.1 native touched-table/staged-set commits may include
multiple issues; do not promise per-issue history isolation. Keep pending/staged
native changes and commit/publication consequences in the readiness focus.
Before consequential native mutation, commit, or push, the readiness Agent must
disclose and review those consequences and consult if pending work is
unauthorized or unclear. With auto-commit on, a native update may commit
touched-table/pre-staged pending work before any push. Pending or concurrent
native database changes can prevent a safe operation, without a replacement
code-level dirty gate or blanket quiescence rule. Native command success is not
proof the changed task reached history; a trailing commit may fail or only log
failure. Preserve actual history/revision/publication facts for review. Do not
add row filtering, another store/branch, dependency patches, or a policy/facts
framework. Do not ask preparation code to synchronize another owner's dirty
primary checkout, reconcile a rejected push, or retry uncertain delivery.

## Light readiness sniff

Resolve the live provider directly from its native project evidence. Do not use
a provider-selection file, infer from a task ID, or mix providers. Then read the
exact selected task through that provider:

- **Backlog:** run `backlog task view --json -- TASK-ID`. Require the returned
  canonical ID, status exactly `In Planning`, exact returned task path, and a
  readable, meaningful native Implementation Plan that is not blank or an
  obvious placeholder.
- **Beads:** from the exact detected project root run `bd context --json` and
  `bd show TASK-ID --json --long --include-comments`. Require the returned
  canonical ID to equal the entire selected ID, native status exactly
  `in_planning` mapped to canonical `In Planning`, and the raw `design` field to
  be readable, meaningful, and not blank or an obvious placeholder. Retain the
  complete raw task view and exact native project root; do not invent a task
  path or translate it into a normalized task model.

Inspect only enough native state to decide whether focused compaction is useful.
This is not the authoritative implementation-readiness review. If provider
resolution or the sniff fails, do not request compaction. Report the provider,
exact task identity, native status/read evidence, and bounded reason in the
required format, then end the turn. The queued `implement-task` workflow remains
responsible for the complete semantic readiness decision.

## Standard compaction request

If the sniff passes, reason from your current conversation context and compose a
concise `focus_hint` that best prepares you to review the selected task for
implementation admission and supervise the resulting Episode. Keep
its exact provider, project root, task ID, observed Backlog task path when
applicable, native readiness fields, and the complete provider-native
observation for either provider. Preserve the operator's actual instruction,
approved scope, any conditional implementation authority, and optional stable
host in `<operator-implementation-host>`. Planning-only authority must remain
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
  or raw provider data. Do not automatically retry an uncertain request; inspect
  the actual result and current state instead.

In every case, the canonical `implement-task` follow-up remains independently
queued. Do not wait for a compaction event or infer a later outcome from its
absence.

After the sniff or compaction call, output only:

- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so Prime Agent can apply the context boundary and run the queued
implementation-readiness workflow.
