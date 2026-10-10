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
- a concise threat model, trusted assumptions, and ordinary failure model;
- explicit non-goals and an evidence-preserving manual-recovery boundary;
- a qualitative complexity budget and a simplification checkpoint;
- an executable vertical-slice plan with acceptance evidence and dependencies;
- separate required acceptance behavior and optional hardening, with any
  hardening candidate carrying a concrete evidence-based promotion trigger;
- a two-repair/review-cycle stop-loss before further scope or architecture
  growth;
- explicit approval boundaries, including that only the operator may promote a
  reviewer-discovered invariant into product scope; and
- no unresolved contradiction or blocker that makes implementation unsafe.

If anything required is missing, contradictory, or inadequate, explain every
material deficiency to the operator with exact artifact references and concrete
revision guidance. Do not call `create_spec_episode`. Do not create or mutate a
branch, worktree, session, or active plan. Stop after the explanation.

## Create the episode

The full ordinary `prime-claw-oversee-episode` guidance is loaded above this
workflow in the post-preparation turn. Follow it as judgment guidance. It grants
no product, scope, merge, abandonment, cleanup, or transport authority. Do not
call an activation, disclosure, receipt, or readiness tool; those surfaces do
not exist.

Only when the complete bundle is ready, call `create_spec_episode` exactly once
with the exact selected future-folder path as its sole `location` argument. Do
not supply or invent a branch, worktree, session name, prompt, command, or host
parameter. A native `--host id:<project-host-setup-id>` bypass, when the operator
provided one, is already bound privately to this preparation. Otherwise the
trusted host selects the sole ready local setup or presents the native picker.

The capability first persists one provisioning ownership record, creates the
background worktree without an agent, prompt, or activation, promotes and
commits the exact bundle, and then launches one fresh native `prime-agent`
session with one fixed execute assignment. It does not inherit this
Conversation transcript, send an initial handoff, or send a second daemon
prompt. Remote placement remains disabled until exact bundle transport is
separately proven.

Report the returned durable Episode session identity, current routing identity,
lifecycle engine, exact Orca setup/worktree identity when applicable, actual
branch, worktree, and status. State whether the capability created the Episode
or returned the existing exact active ownership. `uncertain` or `provisioning`
state requires inspection and must never be retried as a new creation or
assignment. Do not begin implementation in the owner Conversation.

Once the tool reports success, set up one bounded heartbeat only while waiting
for observable Episode work. Then stop without implementing or invoking
`/handoff`.
