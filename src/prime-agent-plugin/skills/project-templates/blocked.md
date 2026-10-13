---
name: blocked
description: Use when Ralph detects blocked task-native Episode work or retained planning docs and needs help explaining and clearing the blocker.
---

First, run through the "prepare" skill.

Then use `/skill:backlog` to load the project task-tracking workflow.

## Select the durable authority before fallback

Inspect the one project `.prime-claw/ownership.json` record before choosing a
mode. An `<operator-episode-task>` block, when present, is only a candidate task
binding; prompt text alone never grants owner or lifecycle authority.

If the record is active version-2 task ownership, task mode is mandatory even
when the current assignment has no task block. Require the exact persisted owner
session, a top-level Conversation, the repository root of the canonical primary
`main` checkout, and the record's exact task ID and project-relative task path.
If a task block is present, require its entire trimmed value to equal that task
ID. If any owner, depth, checkout, status, identity, or optional task-block check
fails, stop. Never fall back to folder mode while any version-2 ownership record
exists. In particular, a task-bound Episode session follows its execute policy
for blocker recording; it cannot acquire Conversation status authority by
invoking this skill.

Reload the exact owned task through the supported structured interface:

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

Only when there is no version-2 ownership record and no task block may this
skill retain the folder-plan workflow. Read the files in
`.ralph/plans/blocked`. Explain why Ralph marked the project as blocked and work
with the user to clear the blocker. If the user successfully unblocks the
project, move both `.ralph/plans/blocked/EXECUTION_PLAN.md` and
`.ralph/plans/blocked/SPECIFICATION.md` back to `.ralph/plans/`. Never mix the
two modes or copy content between their authorities.
