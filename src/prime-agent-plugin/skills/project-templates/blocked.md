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
task ID and project-relative task path. If a task block is present, require its
entire trimmed value to equal that task ID. If any owner, depth, checkout,
status, identity, or optional task-block check fails, stop. Never fall back to
folder mode while this Conversation has a version-2 ownership record. A task-bound Episode
session follows its execute policy for blocker recording; it cannot acquire
Conversation status authority by invoking this skill.

In version-2 task mode, use `/skill:backlog` to load the project task-tracking
workflow. Reload the exact owned task through the supported structured interface:

```sh
backlog task view --json -- TASK-ID
```

Require the returned canonical ID and project-relative task path to match the
ownership record, and require main status to be exactly `Blocked`. The task is
the sole lifecycle authority in this mode. Do not inspect or move
`.ralph/plans`, select a replacement task, or start another admission.

Use the accepted Episode-to-Conversation report already present in the owning
Conversation to explain the exact blocker, attempted actions, evidence, and
unblock condition. Do not infer missing evidence or copy Episode-owned task
content across checkouts. Work with the user to satisfy the recorded unblock
condition. If the accepted report is unavailable, stop and require recovery of
that exact report and Episode identity rather than inventing it from main-task
content.

After the user or accepted evidence clears the blocker, only that exact owning
Conversation may publish the same task as `In Progress`. The transition must be
one exact-task-only commit; unrelated main dirt is allowed, but the exact task
path must match committed `HEAD`. Push is prompt best-effort evidence and local
commit success remains authoritative. Then continue the same ownership, branch,
worktree, and session through the existing handoff channel. Never create a new
task, admission, Episode resource, or status-sync message, and never mutate
Episode-owned task content from main.

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
