---
name: handoff
description: Use for Ralph's handoff phase to update durable task or plan context for the next execute pass without creating separate handoff documents.
---

## Select the bound authority

Continue the actual requested work. Carry genuine user limits and permission
boundaries forward, but keep agent-created plans, checkpoints, limits and review
findings revisable. Do not turn a summary or historical implementation into
authority for new requirements. If a saved-copy, history-proof or buffer rule
introduced by an agent blocks work, reconsider its necessity before hardening
around it. “Continue” does not add preservation, loss, duplication, crash or
replay guarantees. Routine technique reuse and removal of self-imposed
constraints need no new approval; actual user decisions and access needs do.

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

For version 2, retain `integrationBranch` as the owner merge/publication target;
only an omitted field in old records means `main`. It is separate from code
`baseRef`, isolated Episode `branch`, and provider revisions. The owner primary
checkout must match that target. A mismatch blocks without switching branches,
rebinding ownership, or allocating again; same-target advancement follows the
existing ancestry/publication rules.

With no ownership, active legacy `SPECIFICATION.md` and
`IMPLEMENTATION_PLAN.md` files on canonical main (or the retained
`EXECUTION_PLAN.md` spelling) select valid old in-place folder work without
creating Episode identity. Only when neither ownership nor those old in-place
files decides may `<operator-episode-task>` become a candidate task binding.
The tag alone cannot establish a live Episode or authorize task handoff; stop
for exact version-2 ownership recovery before task-native continuation.

### Read the exact handoff observation

For a task-native continuation, `<task-handoff-observation-reference>` contains
JSON with `schemaVersion: 1`, `sessionId`, an absolute `sessionFile`, `entryId`,
`parentId`, `customType: "prime-claw-task-handoff-observation"`, `entrySha256`,
and `bindings`. This is factual context, not task authority or acceptance.
Load it before judging continuation:

1. Read only that exact native `sessionFile` through the Episode's Python REPL.
   Verify its session header has `type: "session"` and the exact `sessionId`.
   Select exactly one row whose `id` equals `entryId`; verify `type: "custom"`,
   `customType` and `parentId`. Hash its exact UTF-8 JSONL bytes, excluding the newline,
   with SHA-256 and require `entrySha256`. Do not hash reserialized JSON, choose
   the latest entry, search other sessions, or print the journal/history.
2. Require schema version 1 in the reference and entry data. Require the entry's
   `bindings` to equal the reference's `bindings` and match this exact selected
   owner/registry Episode: `ownerSessionId`, `provider`, `taskId`, `operationId`,
   `episodeId`, `episodeSessionFile`, `episodeActiveSessionId`, `worktree`,
   `branch`, `baseRef`, `integrationBranch`, `engine`, and optional
   `projectSetupId`/`routingEnvironmentId`. Apply the existing provider and
   integration-branch defaults above for older records. Require the reference's
   `sessionId` to equal `bindings.ownerSessionId`. That source Conversation
   session is not a replacement for the Episode's durable session binding.
3. Keep the full parsed entry data in named REPL variables. Its structure is
   `{schemaVersion: 1, bindings, providerTaskObservation,
   episodeSessionObservation: {session, state}}`. Retain the full unchanged
   provider observation and native session/state facts. Preserve provider-native
   envelopes, arrays, keys, unknown fields, nulls, and absent fields; never
   normalize, flatten, truncate, or replace them with a summary.
4. Enumerate the native structure, then inspect the entire current task contract
   and all relevant prior/current differences, including fields and comments.
   Read large collections and individual huge values in bounded chunks of about
   4096 characters per output, with paths and offsets so no remainder is skipped.
   A key list, length/digest check, preview or summary is not semantic inspection.
   Do not dump one giant JSON value into model context.

A missing, unreadable, ambiguous, mismatched or inaccessible exact session/entry
stops continuation with a bounded explanation. Same-filesystem access must be
real; a remote/host label does not establish it. Do not fall back to another
entry, ownership evidence, a copied journal, a new store or giant inline data.
Previously loaded generations may still supply `<provider-task-observation>`
and `<episode-session-observation>` inline. Read those complete native values
when no reference was supplied; they never repair a failed reference. Retained
version-1 folder-plan handling is unchanged.

For provider-absent/Backlog task-native handoff, reload the bound candidate
through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID and task path to match the binding, and
require status to remain exactly `In Progress`. The task is the sole durable
handoff authority in this branch. Coherent ticket edits must already have been
committed ASAP and published promptly; handoff is not their first durability
checkpoint. Follow execute's selected-file/native-history procedure. Ensure its Implementation Plan,
Implementation Notes, acceptance evidence, references, documentation, modified
files, and Final Summary contain the current resumable context. If an in-scope
update is needed, use supported `backlog task edit` operations only in this
Episode worktree, reload and verify identity/path/parent/status, then commit and
push the single-purpose checkpoint before compacting. Grandfathered mode commits
only the literal selected task path on the Episode code branch, separately from
code, preserving unrelated index entries. Independent mode commits only the task path
in the ignored nested clone, pushes `HEAD:refs/heads/prime-claw/tasks` without
force, proves direct publication and unchanged code HEAD, and leaves ownership
revision/evidence advancement to `handoff_task_episode` after message admission.
Inspect the selected ticket and history/publication facts. Unrelated dirty work
or compatible descendants are not blockers; foreign identity, an actual native
conflict or unavailable selected-ticket publication needs factual recovery.
Never reset or absorb another writer's work to make the clone clean. The host
supplies the persisted and freshly synchronized complete native task views and
revisions as factual context. An unrelated-task descendant alone is compatible.
For an outside same-task change, use bounded semantic judgment: incorporate a
compatible in-scope clarification or living-plan update, and stop for a genuine
semantic conflict, authority change, scope expansion, or product decision. Raw
inequality is not an approval gate; never add an equality gate or deterministic
classifier.

For independent Backlog continuation, the transport prepares and reads the
Episode's task checkout, not the mutable primary task checkout. The invoking
Conversation synchronizes its own task workspace when needed for its authorized
status publication; handoff must not synchronize or absorb another writer's
primary bytes or index. Inspect the supplied previous/current native task views,
Episode code head, and native upstream result before deciding continuation.
Apply the status, meaningful-plan, selected-ticket publication, code publication,
and history-compatibility rules here as LLM judgment, not a primary/Episode
view-equality, paired stable-head, or code-upstream approval gate.

For Beads task-native handoff, use only the exact active owner's persisted
`providerRevision` and complete raw `taskEvidence`. Before delivery, the public
boundary performs one supported native pull, reads native transport/working-set
facts and the exact current raw task. Both prompts receive previous/current raw
views, local revisions, the pull result and transport observations, including
warnings and publication-ref results. A local `currentProviderRevision`, a
successful command, or a local task read is not exact-task publication proof.
Judge status, meaningful design, publication and compatibility here using those
facts; require `in_progress` with meaningful `design` for ordinary continuation,
not a duplicate code status/plan/cleanliness gate or stable-proof pipeline.
Only after first-message admission does its callback record current
provider/task/code observations before queuing execute. Incorporate compatible
in-scope changes; escalate genuine semantic conflict, authority change or scope
expansion. Do not use Backlog, translate or mutate Beads during handoff. Leave
content updates to execute's native cycle, reviewing touched-table/staged-set
multi-issue consequences first. Guidance never reconstructs provider facts.

The referenced `providerTaskObservation` is factual before/current context,
not semantic acceptance or new authority. Grandfathered Backlog includes complete
primary/Episode native views; independent Backlog and Beads include prior/current
native views and code observations. `episodeSessionObservation` carries the
native list/state flags. The prior-generation inline tags carry the same facts.
Check idle completion, children/queues and publication
facts before ordinary continuation; these are LLM decisions under this policy,
not duplicate status/design/code-dirt/upstream/ancestry or role-depth predicates.
The first task-native request uses `followUp` with `queueIfBusy: true`, allowing
a heartbeat to win the observation/admission gap without a busy-only refusal.
First admission precedes the factual callback, then one execute follow-up;
these operations are not atomic or globally exactly-once.
Never use ordinary handoff for Blocked, merge, abandonment, cleanup, consultation,
pause or scope expansion. Do not claim execute/compaction completion from
admission. Code retains exact existing owner/task/worktree/branch/session/route
targeting and the native send result.

Task-native failure disposition belongs to the exact owning Conversation under
`prime-claw-oversee-episode`. Stop without automatic retry. Only reviewed evidence
of definite first-stage refusal before prompt admission plus a later explicit
informed operator decision permits ONE canonical `handoff_task_episode`
re-invocation on the unchanged exact owner/provider/task/operation/durable
session/worktree/branch, original accepted scope/focus and current native facts.
Refusal alone is not authority or a new advance. Empty queues or missing observed
actions alone do not prove non-admission. Preserve evidence gaps and preparation
or task-history effects; first refusal does not mean preparation had no effects.
Uncertain first admission, callback failure after admission, and refused or
uncertain second-stage delivery remain separate stopped cases, with no generic
replay, ordinary handoff or chat steering. The first request may have been
admitted even when execute was not queued. Do not send execute from this handoff
turn; compaction instructions below never authorize reconstructing a missing or
uncertain follow-up. Record findings and operator disposition in existing native
fields/history. State evidence limits without inventing refusal or a safe resend.
The exact owner may instead assess the separate execute-only continuation policy
in `prime-claw-oversee-episode`: either a demonstrably completed handoff with
failed or historically unproved execute, or a verified pre-work runtime interruption
of both prompts demonstrably received by the same Episode. Uncertain delivery or
possible unaccounted task effects do not qualify for the interruption path.
Either path requires explicit informed authority for
ONE NEW continuation, fresh current task/code/session and explicit-descendant
facts, and the supported managed execute-only invocation. It is not replay of
this chain, an Episode dispatch decision, a compaction trigger or permission to
use raw execute on a generation without that invocation. A receiver report with
fresh idle/empty queues can support that decision without historical sender IDs
or callback proof; unknown history remains unknown. No new endpoint/store or
classifier, routine successful-handoff gate, retained version-1 change,
initial-assignment recovery or live activation is implied.

In either task-native branch, guidance is bounded compaction focus only. It
never accepts task content or supplies provider revision or raw evidence. Never pass `--status`, complete or archive the task, select replacement work,
consult `.ralph/plans`, or copy task content across checkouts. The owning
Conversation alone publishes lifecycle status through the selected provider:
grandfathered Backlog on the recorded integration branch, independent Backlog
on its task ref, and Beads through native publication.

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
For task-native handoff, this turn can start before the observation callback or
execute send. Receiving this prompt proves neither that execute is queued nor
that the callback or continuation completed. The existing transport alone sends
the sole canonical execute follow-up. Never send, reconstruct or retry it here,
including after a callback or second-send failure. Ordinary `ralph_handoff` and
retained version-1 handoff keep their existing independently queued execute.

When the handoff prompt appends an `<operator-compaction-guidance>` block, use
its contents as continuation focus within the actual operator request. The
block's label does not turn caller-authored implementation choices or findings
into user requirements. Preserve relevant current progress and the chosen next
step in the bound durable authority and `focus_hint`, without creating new scope.

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

In every case, do not wait for `session_compact`, infer a later outcome from
its absence, invoke execute yourself, or reproduce the execute workflow. Prime
Agent surfaces later compaction success, cancellation, or failure and owns its
native follow-up queue. Explicit queue removal or session termination/replacement
cancels any queued continuation. Report only observed transport facts; handoff
prompt receipt and a compaction result do not establish execute admission.

After the compact call returns or raises, output only:
- Status
- Evidence
- Next Step

Distinguish “compaction requested” from “compaction confirmed.” Then end the
turn and leave continuation to the existing canonical transport. Complete any
phase-bounded goal before yielding; do not start a goal, heartbeat or extra turn
to wait for or acknowledge the callback/follow-up. Do not include a narrative
summary or restate task, plan, specification or raw observation content.
