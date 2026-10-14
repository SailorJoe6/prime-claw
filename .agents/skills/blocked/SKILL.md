---
name: blocked
description: Use when Ralph detects blocked task-native Episode work or retained planning docs and needs help explaining and clearing the blocker.
---

First, run through the "prepare" skill.

## Select the durable authority before fallback

Inspect persisted `.prime-claw/ownership.json` from the canonical primary
checkout before choosing a mode. In a linked worktree, use Git worktree metadata
to locate that checkout. An `<operator-episode-task>` block is only a candidate
binding when ownership does not decide; prompt text alone never grants owner or
lifecycle authority.

A valid version-1 record selects retained folder mode even when a task block is
present. Live version-1 Episode identity additionally requires readable,
non-empty active `SPECIFICATION.md` and `IMPLEMENTATION_PLAN.md` files in its
recorded Episode worktree, accepting the retained `EXECUTION_PLAN.md` spelling.
If those files are absent, stop for recovery instead of switching modes. A valid
version-2 record selects task mode even when the assignment has no task block.
Require the exact persisted owner session, a top-level Conversation, the
repository root of the canonical primary `main` checkout, and the record's exact
task ID and project-relative task path. If a task block is present, require its
entire trimmed value to equal that task ID. If any owner, depth, checkout,
status, identity, or optional task-block check fails, stop. Never fall back to
folder mode while any version-2 ownership record exists. A task-bound Episode
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

Use folder mode for persisted version-1 ownership. With no ownership, use it
for active legacy plan files on canonical main or clear operator-provided legacy
work; this old in-place fallback is not a live Episode. A task block is a
candidate only when neither persisted ownership nor old in-place legacy files
selects the mode.

Read the files in `.ralph/plans/blocked`. Explain why Ralph marked the legacy
workflow blocked and work with the user to clear it. If the user successfully
unblocks the work, move only `.ralph/plans/blocked/EXECUTION_PLAN.md` (or
`IMPLEMENTATION_PLAN.md`) and `.ralph/plans/blocked/SPECIFICATION.md` back to
`.ralph/plans/`. Do not mutate task-native Backlog status, completion, archival,
finalization, or cleanup state. Never mix the two modes or copy content between
their authorities.
