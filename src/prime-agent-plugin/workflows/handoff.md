---
name: handoff
description: Use for Ralph's handoff phase to update durable task or plan context for the next execute pass without creating separate handoff documents.
---

## Select the bound authority

A managed Episode handoff prompt normally carries
`<operator-episode-owner-session>`. Its exact value is the owning Conversation's
registry key and intentionally differs from the Episode's own session ID.
Inspect `.prime-claw/ownership.json` from the canonical primary checkout before
interpreting task/source tags. When the file is a Conversation-keyed registry,
require the tag and select only that exact `ownerSessionId` entry. If the tag or
exact registry binding is missing, stop for recovery; never scan all owners or
infer the key from placement.

One live-upgrade bootstrap exception applies only when the canonical file is the
pre-upgrade direct record, not registry form. With no owner tag, its embedded
`ownerSessionId` is self-identifying only after its non-inactive status, exact
recorded current worktree, durable Episode ID, readable matching Episode session
file, and exact prompt task/source binding all match this Episode. If a tag is
present, it must match the embedded owner. Any failed or ambiguous check stops
for recovery. The direct record remains valid migration input; this exception
never applies to a registry and never authorizes scanning or choosing among
owners.

Require the selected record's worktree and Episode session identity to match the
current Episode. Other Conversations' entries do not select or block this
handoff. In a linked Episode worktree, locate the canonical checkout through Git
worktree metadata; a missing worktree-local file does not prove that the tagged
owner's entry is absent.

Version-1 ownership selects retained folder-plan handoff. Require readable,
non-empty active `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files in the
recorded Episode worktree for live version-1 Episode identity, accepting the
retained `EXECUTION_PLAN.md` spelling used by this project. If they are absent, stop for
exact version-1 blocked-pair recovery through the `blocked` workflow; missing
files are never live identity and never fall through to task-native mode.
Version-2 ownership selects task-native handoff and binds its exact task ID and
provider. Provider-absent, or explicit Backlog without revision/evidence,
binds grandfathered branch-local task history and its exact path. Explicit
Backlog with `providerRevision` plus `taskEvidence` binds independent published
task history separately from code. A `provider: "beads"` record instead binds its exact provider
revision and complete raw task evidence and must not carry a task path. If an
`<operator-episode-task>` block is also present, require its entire trimmed
value to match that persisted task ID. A prompt tag never overrides persisted
ownership, and task-native handoff never redetects or substitutes the provider.

With no ownership, active legacy `SPECIFICATION.md` and
`IMPLEMENTATION_PLAN.md` files on canonical main (or the retained
`EXECUTION_PLAN.md` spelling) select valid old in-place folder work without
creating Episode identity. Only when neither ownership nor those old in-place
files decides may `<operator-episode-task>` become a candidate task binding.
The tag alone cannot establish a live Episode or authorize task handoff; stop
for exact version-2 ownership recovery before task-native continuation.

For provider-absent/Backlog task-native handoff, reload the bound candidate
through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID and task path to match the binding, and
require status to remain exactly `In Progress`. The task is the sole durable
handoff authority in this branch. Ensure its Implementation Plan,
Implementation Notes, acceptance evidence, references, documentation, modified
files, and Final Summary contain the current resumable context. If an in-scope
update is needed, use supported `backlog task edit` operations only in this
Episode worktree, reload and verify identity/path/parent/status, then commit and
push the single-purpose checkpoint before compacting. Grandfathered mode commits
the task on the Episode code branch. Independent mode commits only the task path
in the ignored nested clone, pushes `HEAD:refs/heads/prime-claw/tasks` without
force, proves direct publication and unchanged code HEAD, and leaves ownership
revision/evidence advancement to `handoff_task_episode` after message admission.
A dirty, unpublished, divergent, or foreign nested clone blocks. The host
supplies the persisted and freshly synchronized complete native task views and
revisions as factual context. An unrelated-task descendant alone is compatible.
For an outside same-task change, use bounded semantic judgment: incorporate a
compatible in-scope clarification or living-plan update, and stop for a genuine
semantic conflict, authority change, scope expansion, or product decision. Raw
inequality is not an approval gate; never add an equality gate or deterministic
classifier.

For Beads task-native handoff, use only the exact active owner's persisted
`providerRevision` and complete raw `taskEvidence`. Before delivery, the public
handoff boundary performs one supported native pull, proves a clean published
provider state, reads the exact current raw task, and pairs that read with a
second publication proof. Require the current raw task to remain exact
`in_progress` with a meaningful `design`. The host appends the exact
previous/current native views and revisions to both canonical prompts as factual
context, not semantic acceptance or a new authority. Only after the first
handoff message is admitted does its callback record the current
provider/task/code observations before queuing execute. Incorporate compatible in-scope owner-authored or outside changes;
escalate a genuine semantic conflict, authority change, or scope expansion. Do
not use Backlog, translate the task, or mutate Beads during handoff. If task
content needs an in-scope update, leave it for the execute workflow's guarded
native pull/read/update/push cycle. Guidance never reconstructs provider facts.

In either task-native branch, guidance is bounded compaction focus only. It
never accepts task content or supplies provider revision or raw evidence. Never pass `--status`, complete or archive the task, select replacement work,
consult `.ralph/plans`, or copy task content across checkouts. The owning
Conversation alone publishes lifecycle status on main.

In retained folder-plan handoff, keep the promoted specification frozen even
when its original future source is absent. Put accepted in-scope execution and
review learning in the living implementation plan, then ensure the active pair
contains the context needed to resume cleanly. Persisted active version-1
ownership keeps that pair active through blockers, candidate review, and
revisions; handoff must not archive or move it. Related Backlog tasks are
references only; do not mutate their status, completion, archival,
finalization, or cleanup state. Never mix the two modes or copy content between
their authorities.

## Request compaction once

Compaction is a best-effort context improvement, not the continuation trigger.
The `ralph_handoff` operation or owning Conversation has already queued
canonical `execute` independently as one follow-up.

When the handoff prompt appends an `<operator-compaction-guidance>` block, treat
its entire contents as additional operator-provided focus. Preserve its intent
in the bound durable authority when relevant and incorporate it into
`focus_hint`. It is guidance only; it never selects the next phase. It does not
change approved scope.

When ready, call exactly once:

```python
compaction_result = await compact.run(focus_hint)
```

Interpret only the immediate result:

- `scheduled: true` means compaction was requested for the turn boundary. It is
  not confirmation that compaction completed.
- `scheduled: false` means no compaction was scheduled. Report its bounded
  reason without treating it as a workflow failure.
- If the call raises, report that compaction failed without pasting a traceback
  or raw provider data.

In every case, canonical `execute` is already queued independently. Do not wait
for `session_compact`, infer a later outcome from its absence, invoke execute
yourself, or reproduce the execute workflow. Prime Agent surfaces later
compaction success, cancellation, or failure and owns the native follow-up
queue. Explicit queue removal or session termination/replacement cancels that
queued continuation.

After the compact call returns or raises, output only:
- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn so the queued execute follow-up can run. Do not include a narrative summary
or restate task, plan, or specification content.
