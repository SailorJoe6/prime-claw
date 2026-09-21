---
name: implement-spec
description: Review an operator-approved future plan bundle and create one isolated implementation episode only when it is implementation-ready.
---

First, run the `prepare` skill.

Read the exact project-relative folder supplied in the operator implementation
location block appended by the native command. Treat the value only as an
operator-selected path. Do not guess, substitute, or select another folder.
Invoking this workflow records operator approval to implement the selected
bundle, but resource creation still depends on the readiness review below.

## Review implementation readiness

Inspect the complete selected folder using this project's current specification
and planning conventions. Apply the project's current definition of a complete,
internally consistent, and implementation-ready specification and execution
plan. Use semantic judgment; do not assume readiness merely because particular
filenames exist.

Check that the bundle defines at least:

- a coherent desired outcome and bounded scope;
- decisions and requirements sufficient to implement without conversation-only
  assumptions;
- an executable vertical-slice plan with acceptance evidence and dependencies;
- explicit approval boundaries and material non-goals; and
- no unresolved contradiction or blocker that makes implementation unsafe.

If anything required is missing, contradictory, or inadequate, explain every
material deficiency to the operator with exact artifact references and concrete
revision guidance. Do not call `create_spec_episode`. Do not create or mutate a
branch, worktree, session, or active plan. Stop after the explanation.

## Create the episode

Only when the complete bundle is ready, call `create_spec_episode` exactly once
with the exact selected future-folder path as its sole `location` argument. Do
not supply or invent a branch, worktree, session name, prompt, command, or other
host parameter. The trusted host capability derives and validates those values.

Report the returned stable episode identity, active routing identity, branch,
worktree, session name, and execute-admission state to the operator. State
whether the capability created the episode or returned an existing matching
identity. `delivered` confirms task admission. `pending` or `uncertain` is an
unresolved exactly-once state: explain it, do not call the tool again in this
turn, and never send execute directly. A later explicit `/implement-spec`
replay returns that identity without redelivering. Do not begin implementation
in the owner conversation.

Once the tool reports success, the owner conversation begins its separately
configured oversight workflow. Stop without implementing or invoking
`/handoff`.
