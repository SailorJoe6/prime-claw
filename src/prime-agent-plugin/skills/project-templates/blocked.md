---
name: blocked
description: Use when Ralph detects blocked task-native Episode work or retained planning docs and needs help explaining and clearing the blocker.
---

First, run through the "prepare" skill.

First judge whether the recorded condition actually prevents the requested
outcome. An agent-created limit, checkpoint, saved-copy or history-proof rule is
not a user requirement merely because a plan, test or prior finding records it.
Reconsider or remove an unnecessary rule rather than add guards, preservation
guarantees or approval steps around it. Correct the recorded blocker when that
resolves it; do not require the user to satisfy your own obsolete condition.
Preserve genuine user limits, access needs and normal permission boundaries.
Ask only when an actual unresolved user decision or access need remains.

## Select the durable authority before fallback

If this is a managed Episode, use the exact owning Conversation key carried by
`<operator-episode-owner-session>`; it intentionally differs from the Episode's
own session ID. A top-level owning Conversation without that tag uses its own
exact session ID. Inspect `.prime-claw/ownership.json` from the canonical primary
checkout and select only that exact `ownerSessionId` registry entry before
choosing a mode. An existing direct record is valid migration input.
Other Conversations' entries do not select this workflow. Never scan other owners
to select recovery. In a linked worktree, use Git worktree metadata to locate the
canonical checkout. An `<operator-episode-task>` block is only a candidate binding
when the selected owner's record does not decide; prompt text alone never grants
owner or lifecycle authority.

## Route incomplete creation before active-session or report checks

Before requiring a matching active Episode session or an accepted Episode report,
check the exact selected entry. Only the top-level owning Conversation's exact
version-2 `provisioning` or `uncertain` entry with incomplete creation returns
directly to `## Owner-led creation recovery` in
`.prime-claw/workflows/implement-task.md`. Stop this blocked flow; do not call
`implement_task` recursively or `handoff_task_episode`. Preserve provider, task,
code base, host, branch, worktree, durable session, and operation identities
unchanged. An absent recorded session is not proof that none exists: inspect
native terminal, launch, session, and assignment evidence. Never blindly replay
creation or assignment, or promote the entry to active. If the existing native
continuation cannot finish the remaining step, report that exact constraint;
never start another admission or invent a recovery API.

This exception belongs only to the owning Conversation, not an Episode or Expert.
Direct ownership edits are limited to that targeted documented creation-recovery
procedure: use its current registry lock, compare before editing the unchanged
selected entry, preserve other owners, and reread afterwards. This skill does not
perform those edits. Retained version-1 recovery and normal active blocking below
remain separate. For normal active mode, require a managed Episode's recorded
worktree/session identity to match the current Episode.

A valid version-1 record selects retained folder mode even when a task block is
present. Live version-1 Episode identity additionally requires readable,
non-empty active `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files in its
recorded Episode worktree, accepting the retained `EXECUTION_PLAN.md` spelling.
Missing active files are not live identity and never permit task-native or
no-ownership fallback. They permit only the exact blocked-pair recovery below
for that persisted version-1 record and recorded worktree. That recovery binds
persisted ownership and does not require the original future source folder or a
live task provider. A valid version-2
record selects task mode even when the assignment has no task block.
Require the exact persisted owner session, a top-level Conversation, the
repository root of the primary checkout on the recorded `integrationBranch`,
and the record's exact provider and task ID. Only an omitted integration field
in old version-2 records falls back to `main`; never infer or retarget it from
the current checkout. Keep code `baseRef`, isolated Episode `branch`, and provider
revisions distinct. A branch mismatch blocks without switching or allocation.
Provider-absent, or explicit Backlog without
`providerRevision`/`taskEvidence`, is grandfathered branch-local authority. An
explicit Backlog record with both fields selects the independent nested task
branch; both shapes carry the exact project-relative task path. A
`provider: "beads"` record must carry no task path and must retain its exact
published `providerRevision`, complete raw `taskEvidence`, code `baseRef`,
worktree, branch, and Episode session identity. If a task block is present,
require its entire trimmed value to equal that task ID. If any owner, depth,
checkout, provider, status, identity, or optional task-block check fails, stop.
Never fall back to folder mode while this Conversation has a version-2 ownership
record. A task-bound Episode session follows its execute policy for blocker
recording; it cannot acquire Conversation status authority by invoking this skill.

In either version-2 branch, use the accepted Episode-to-Conversation report
already present in the owning Conversation to explain the exact blocker,
attempted actions, evidence, and unblock condition. Do not infer missing
evidence or copy Episode-owned task content across checkouts. If the accepted
report is unavailable, stop and require recovery of that exact report and
Episode identity rather than inventing it from task content. Do not inspect or
move `.ralph/plans`, select replacement work, or start another admission.

For provider-absent/Backlog task mode, read the exact committed `Blocked`
ticket in the selected owner store. Use **Inspect Backlog committed ticket
evidence** in `prime-claw-oversee-episode`. In branch-local history use the
bound literal path and observed integration code commit; in independent history
use the exact published task revision and nested-store-relative path. A trusted
prior reference may come from the handoff observation, recorded independent
ownership checkpoint, or the status publication result. Compare only verified
committed blobs in bounded ranges. If a prior checkpoint is missing, report that
comparison gap; do not invent one or use the current ticket twice. Preserve
already-recorded legacy raw evidence without copying or recapturing it.

Read the recorded blocker and clearance condition. Judge actual same-task
changes, conflicts or scope changes, not equality with the older record or
whole-clone cleanliness. Keep direct remote publication facts separate from
blob readability. If current committed evidence needed for the decision is
unavailable, report it rather than falling back to a live task read. Preserve
unrelated bytes/staging/history and compatible descendants. Never reset, absorb
or force another writer's work.

Before an authorized change use `/skill:backlog` and synchronize only this
Conversation's intended workspace when needed. Before editing to clear the
blocker, compare the newly selected committed ticket in bounded ranges with the
exact committed ticket used for the clearance decision. The owner judges whether
any change affects the recorded unblock condition. Compatible changes do not
invalidate clearance; if the decision no longer applies or required evidence is
unavailable, stop before editing and resolve the decision or evidence gap. Do
not require revision equality or add a coded gate. Then use the supported structured
`backlog task view --json -- TASK-ID` to verify exact ID, path, parent and
`Blocked` status before editing. Verify these facts and the intended status/note
after the edit. Native authoring readback is not historical evidence. Assess
the recorded unblock condition under the distinction above. After the user or
accepted evidence clears an actual blocker, or its unnecessary agent-created
condition is removed, only that exact owning Conversation may publish the same
task as `In Progress`. Grandfathered Backlog preserves the existing one exact-
task-only integration-branch commit: unrelated code dirt is allowed. Inspect the selected diff
and commit with literal `git add`/`git commit --only` pathspecs, excluding other
index entries. Commit each coherent authorized blocker/clearance note ASAP and
publish promptly; do not wait for handoff or session end. Independent Backlog uses the supported CLI in the primary
nested clone, commits only the exact task path, pushes
`HEAD:refs/heads/prime-claw/tasks` without force, proves the direct remote head,
and proves canonical code HEAD unchanged. Verify the resulting `In Progress` ticket from its exact committed reference,
and prove publication separately. Then continue the same ownership, branch,
worktree, and session through
`handoff_task_episode`.

For Beads task mode, current synchronized native state—not the older ownership
observation—governs. From the canonical-primary Conversation and the exact
recorded project context, use `bd context --json`, exactly one supported
`bd dolt pull`, and `bd show TASK-ID --json --long --include-comments`, together
with native revision, publication-ref, history and working-set observations.
Require the exact canonical ID and complete raw task. Compare the persisted and
current raw views with LLM judgment: preserve compatible owner-authored or
outside changes, and stop for a genuine semantic conflict, authority change, or
scope decision. Raw inequality and an unrelated-task revision advance alone are
not blockers. Never use a deterministic classifier or equality gate.

Before either blocker or resume mutation, native commit or push, inspect
pending/staged changes and review Beads v1.3.1 touched-table/staged-set multi-issue
consequences. Auto-update can commit pending touched rows/already-staged work
BEFORE push. Disclose and consult about unauthorized/unclear work; no per-issue
isolation, blanket clean/quiescence gate or store/branch/row-filter workaround.
Commit coherent authorized blocker/clearance notes through native history ASAP
and publish promptly, not only when continuation is about to run. Inspect
`bd --readonly history TASK-ID --json --limit 0` (CommitHash/Issue snapshots) and
actual publication evidence for intended status/note inclusion. Native update
exit-zero may only log commit failure; successful push/local HEAD/task read alone
are not exact-task proof. Report actual warnings and working-set qualifications.

An accepted pushed blocker may move only current `in_progress` to `blocked`.
Use one supported guarded native update:
`bd --dolt-auto-commit=on update TASK-ID --status blocked --if-status
in_progress --append-notes "<truthful blocker, evidence, and exact unblock
condition>" --json`. Then make one `bd dolt push
--no-adopt`, never force or retry, and prove the exact resulting raw task,
committed task-history inclusion, published revision, `refs/dolt/data`, and actual
working-set observations. If current state is
already `blocked`, do not publish again; use the accepted recorded blocker. If
it is any later or different state, stop without mutation. A failed or uncertain
pull, update, push, or proof is raw evidence and never permission to retry,
reset, adopt, force, or write the live Dolt store directly.

Assess the recorded unblock condition against the actual request, not merely
its presence in a plan. Once an actual blocker clears, or an unnecessary
agent-created condition is removed, this exact Conversation may move
current native `blocked` back to `in_progress`. Repeat one fresh native
context/pull/raw-read/proof cycle, use
`bd --dolt-auto-commit=on update TASK-ID --status in_progress --if-status
blocked --append-notes "<truthful clearance evidence>" --json`, publish once
without force, and
verify actual task-history inclusion, raw task/revision/publication ref and
working-set result under the same consequence-review procedure. Then call
`handoff_task_episode`; its existing admitted callback records only factual
current `providerRevision`, raw `taskEvidence`, code head, and timestamp before
the sole execute follow-up. Never write `ownership.json` directly in this normal
active flow; only the owning Conversation's targeted documented creation-recovery
exception above permits an edit, never Episode or Expert authority.

For a demonstrably completed handoff with failed or historically unproved
following execute, or a verified pre-work runtime interruption of both received
prompts, use the exact owner's separate execute-only continuation procedure in
`prime-claw-oversee-episode`, not the ordinary handoff calls above. Blocker clearance alone does not authorize that
new send. Disclose known failure versus unknown history and callback/partial
effects, current receiver report and fresh native Episode/explicit-descendant
state/actions/queues, progress and accepted next focus. A no-execute/no-pending
report plus native readiness can reach an informed decision without historical
sender IDs/ACK/callback proof; it cannot prove historical non-admission. Require
explicit informed authority for ONE NEW continuation, not silence, compaction,
model change or idle alone. Known pending/running or unfinished admitted work,
real conflict or unproved current idleness stops; do not cancel work to qualify.
Publish actual clearance and In Progress first, with normal history/publication
proof and preserved unrelated work. Already In Progress needs no Blocked round
trip; assess it through oversight instead of forcing this Blocked-only flow.
Do not promote Ready or reopen Done. Record decision/focus/facts/history limits
in existing owner-native fields without copying Episode-owned content. Failed
publication/preparation means no send. Use only the supported managed execute-only
invocation when available, not raw execute, handoff/compaction/assignment resend,
manual registry edit or historical callback replay. New refusal/uncertainty ends
that authorization. A post-admission observation failure preserves admitted work
and any partial effects; report separately and inspect, never resend. This adds
no authority for actual historical recovery, activation/restart/live UAT,
retained version-1 or creation recovery.

Both providers resume the same task, ownership, branch, worktree, and durable
Episode session. Never create a new task, admission, Episode resource,
status-sync message, status receipt, or replacement assignment, and never mutate Episode-owned product or
plan content from the Conversation.

Use folder mode for persisted version-1 ownership. When its active pair exists,
read the blocker from that active execution plan. Work with the user to clear
it, but keep both files active throughout the blocked state and ordinary
continuation.

For an older version-1 snapshot whose active pair is already absent, recovery
is narrow and fail closed. Use only the persisted version-1 record's exact
recorded worktree. Explain the recorded blocker and wait for the operator to
explicitly decide that its unblock condition is satisfied. Only after that
decision, call `restore_blocked_spec_episode` with the exact owned future-folder
location and `confirmedUnblocked: true`; never move the files manually.

The host requires one readable, non-empty, regular blocked pair in that recorded
worktree: `.ralph/plans/blocked/SPECIFICATION.md` plus exactly one of
`EXECUTION_PLAN.md` or `IMPLEMENTATION_PLAN.md`. It requires every active
destination to be absent, follows no symlink, overwrites nothing, restores only
those two paths, re-reads unchanged ownership, and revalidates the same active
worktree identity. Only a successful result permits ordinary continuation. Any
ambiguity, partial move, identity drift, or failed revalidation remains a
recovery blocker; never fall through to task-native mode or create another
Episode.

With no ownership, preserve the separate old in-place folder behavior for
active legacy files on canonical main or clear operator-provided legacy work;
it is not a live Episode. Its existing blocked snapshot may be read from
`.ralph/plans/blocked/` and, after the user clears the blocker, moved back to
`.ralph/plans/`. A task block is a candidate only when neither persisted
ownership nor old in-place legacy files selects the mode. Do not mutate
task-native Backlog status, completion, archival, finalization, or cleanup
state. Never mix modes or copy content between their authorities.
