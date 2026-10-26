---
name: blocked
description: Use when Ralph detects blocked task-native Episode work or retained planning docs and needs help explaining and clearing the blocker.
---

First, run through the "prepare" skill.

## Select the durable authority before fallback

If this is a managed Episode, use the exact owning Conversation key carried by
`<operator-episode-owner-session>`; it intentionally differs from the Episode's
own session ID. A top-level owning Conversation without that tag uses its own
exact session ID. Inspect `.prime-claw/ownership.json` from the canonical primary
checkout and select only that exact `ownerSessionId` registry entry before
choosing a mode. Require a managed Episode's recorded worktree/session identity
to match the current Episode. An existing direct record is valid migration input.
Other Conversations' entries do not select this workflow. In a linked worktree,
use Git worktree metadata to locate the canonical checkout. An
`<operator-episode-task>` block is only a candidate binding when the selected
owner's record does not decide; prompt text alone never grants owner or lifecycle
authority.

A valid version-1 record selects retained folder mode even when a task block is
present. Live version-1 Episode identity additionally requires readable,
non-empty active `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files in its
recorded Episode worktree, accepting the retained `EXECUTION_PLAN.md` spelling.
Missing active files are not live identity and never permit task-native or
no-ownership fallback. They permit only the exact blocked-pair recovery below
for that persisted version-1 record and recorded worktree. A valid version-2
record selects task mode even when the assignment has no task block.
Require the exact persisted owner session, a top-level Conversation, the
repository root of the canonical primary `main` checkout, and the record's exact
provider and task ID. Provider-absent, or explicit Backlog without
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

For provider-absent/Backlog task mode, use `/skill:backlog`, then reload the
exact owned task through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID and project-relative task path to match the
ownership record, and require status to be exactly `Blocked` in the selected
Backlog store. The task is the sole lifecycle authority in this branch.
Grandfathered Backlog reads canonical main. Independent Backlog first
fast-forwards the clean primary nested clone to the directly published
`refs/heads/prime-claw/tasks`; dirty, local-ahead, divergent, unavailable, or
foreign history blocks without migration or force. Work with the user to satisfy the
recorded unblock condition. After the user or accepted
evidence clears it, only that exact owning Conversation may publish the same
task as `In Progress`. Grandfathered Backlog preserves the existing one exact-
task-only main commit: unrelated main dirt is allowed, the task path must match
committed `HEAD`, and push is prompt best-effort evidence after authoritative
local commit success. Independent Backlog uses the supported CLI in the primary
nested clone, commits only the exact task path, pushes
`HEAD:refs/heads/prime-claw/tasks` without force, proves the direct remote head,
and proves canonical code HEAD unchanged. Then continue the same ownership, branch, worktree, and session through
`handoff_task_episode`.

For Beads task mode, current synchronized native state—not the older ownership
observation—governs. From the canonical-primary Conversation and the exact
recorded project context, use `bd context --json`, exactly one supported
`bd dolt pull`, and `bd show TASK-ID --json --long --include-comments`, together
with the existing native revision, publication-ref, and clean-working-set proof.
Require the exact canonical ID and complete raw task. Compare the persisted and
current raw views with LLM judgment: preserve compatible owner-authored or
outside changes, and stop for a genuine semantic conflict, authority change, or
scope decision. Raw inequality and an unrelated-task revision advance alone are
not blockers. Never use a deterministic classifier or equality gate.

An accepted pushed blocker may move only current `in_progress` to `blocked`.
Use one supported guarded native update:
`bd --dolt-auto-commit=on update TASK-ID --status blocked --if-status
in_progress --append-notes "<truthful blocker, evidence, and exact unblock
condition>" --json`. Then make one `bd dolt push
--no-adopt`, never force or retry, and prove the exact resulting raw task,
published revision, `refs/dolt/data`, and clean working set. If current state is
already `blocked`, do not publish again; use the accepted recorded blocker. If
it is any later or different state, stop without mutation. A failed or uncertain
pull, update, push, or proof is raw evidence and never permission to retry,
reset, adopt, force, or write the live Dolt store directly.

Work with the user to satisfy that actual recorded unblock condition. Only after
the operator or accepted evidence clears it may this exact Conversation move
current native `blocked` back to `in_progress`. Repeat one fresh native
context/pull/raw-read/proof cycle, use
`bd --dolt-auto-commit=on update TASK-ID --status in_progress --if-status
blocked --append-notes "<truthful clearance evidence>" --json`, publish once
without force, and
prove the exact raw task/revision/ref/clean result. Then call
`handoff_task_episode`; its existing admitted callback records only factual
current `providerRevision`, raw `taskEvidence`, code head, and timestamp before
the sole execute follow-up. Never write `ownership.json` directly.

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
