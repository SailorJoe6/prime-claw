# Ralph handoff chain

Prime Claw keeps handoff and execute as two separate canonical workflows.
Handoff compacts and records the transition. Execute remains the sole queued
follow-up. A prep or handoff turn never reconstructs, retries, or directly runs
the queued continuation.

## Ordinary handoff

The native `/handoff` command and `ralph_handoff` tool load project
`.prime-claw/workflows/handoff.md` and `.agents/skills/execute/SKILL.md` before
sending either message. Native handoff uses an ordinary prompt; the model tool
uses `steer`. Execute is queued with `followUp` in both cases. This uses the
same internal loader and two-message admission sequence as planning and
implementation preparation without merging their public or authority surfaces.

Optional guidance is operator text or a bounded synthesis of already accepted
in-scope findings. It is not arbitrary chat, a product decision, or scope
expansion. A synchronous admission failure is reported without claiming
continuation. Later compaction success or failure belongs to Prime Agent's
normal queue lifecycle.

## Owned Episode continuation

The retained `handoff_spec_episode(location, guidance?)` surface remains
available only to the exact owner of one active version-1 folder Episode. Before
messaging, it verifies:

- exact owner session and approved future-folder location;
- active lifecycle status;
- the recorded Git worktree and actual branch;
- exact Orca worktree identity for the Orca engine;
- durable Prime Agent session ID/file; and
- a quiescent Episode with no active turn, tool, compaction, child, or queue.

If the active route is stale, Prime Claw reopens the durable session file at the
recorded worktree CWD and persists the refreshed `activeSessionId`. Terminal
handles are also refreshable and never replace durable identity.

After preflight, the tool admits canonical handoff as the ordinary Episode
prompt and queues canonical execute as the sole follow-up. Admission can be
immediate or queued but is not completion. An uncertain transport result is
preserved and never retried automatically.

The public `handoff_task_episode(taskId, guidance?)` tool seam stages the equivalent continuation
for version-2 task ownership. It additionally requires the canonical primary
checkout on `main`, the exact owner and active ownership record, the bound task
ID and path, and main status `In Progress`. Both canonical prompts carry the
same `<operator-episode-task>` binding, so handoff and execute cannot fall back
to folder authority. The durable session must be rooted at the exact owned
worktree before any message is sent. The exact main task path must match committed
`HEAD` before the task is resolved, while unrelated dirty main paths remain
allowed; uncommitted task bytes cannot spoof a resumed lifecycle status.

The task-native handoff policy reloads that same task in the Episode worktree,
keeps lifecycle status Conversation-owned, and permits only supported task
content updates followed by a committed and pushed checkpoint. An internal
status seam binds an accepted report to the exact pushed Episode head and proves
that the Episode task path has committed post-admission evidence while its
status remains `In Progress`. Only the exact owning top-level Conversation in
canonical primary `main` may commit the clean exact main task path as `Blocked`
and later back to `In Progress`; unrelated main dirt is allowed and each push is
best-effort evidence after the local commit. No Episode-owned bytes cross
checkouts. A task still `Blocked` on main cannot hand off. After the resumed
status commit, ordinary handoff revalidates main `HEAD` and continues the same
ownership, worktree, and session without creating or assigning anything.
`Ready for Merge` is never smuggled through this ordinary `In Progress`
continuation seam. The `finalize_task_episode` review handshake instead proves the accepted
pushed head, publishes an exact-task-only main status commit, requires the same
durable Episode to be idle, and integrates current main in its existing
worktree. Only the task conflict is tolerated: the accepted Episode task is
restored locally, Backlog applies `Ready for Merge`, all other Episode-owned
fields and parent identity must retain the accepted digest, and the exact
two-parent refreshed candidate must be pushed. The Conversation then verifies
that current main and the refreshed upstream head still match before asking the
operator for merge authority. Delay re-verifies and retains that exact state
without transport. Explicit Request Changes publishes main `In Progress`,
integrates that status commit in the same Episode with the same constrained
reconciliation, pushes and verifies a second refreshed candidate, and only then
uses ordinary task handoff. Publication, integration, verification, and resume
are separate retryable phases: an integration failure cannot cause another
status transition or a duplicate admission. Explicit Merge is not handoff: the
guarded terminal action binds the operator decision to the exact verified
task/main/candidate, requires clean canonical main and exact main/candidate
upstream heads, fast-forwards only to that reviewed candidate, and immediately
commits only the exact task as `Done`. A retry recognizes only exact pre-merge,
post-fast-forward, exact-task dirty/staged `Done`, or one-task `Done`-child
state. It finishes the commit or transport without duplicating merge or
lifecycle mutation. It also re-proves the Ready publication commit in main
history, direct candidate ancestry, merged code, content digest,
path, hierarchy, and status. Push or remote-verification failure is returned
without invalidating the local `Done` commit. Ownership and every idle Episode
resource remain active until separate finalization or cleanup authority. Task-native lifecycle and terminal actions are exposed only through `finalize_task_episode`; ordinary continuation remains `handoff_task_episode`.

Confirmed abandonment is also not handoff. The guarded Abandon action binds the
operator decision to the exact owner, task path, current main head/status,
pushed Episode head, candidate/main relationship, parent, Episode-content
digest, and abandonment Final Summary. It first rejects an archive destination
already tracked at the bound main head, so Backlog ID reuse cannot replace
historical archive bytes. A structured active/completed-record scan also rejects
inbound links that Backlog archive would otherwise clean from another task. It
selects only the Episode task blob, reapplies the captured
Conversation lifecycle status through Backlog, proves no
code or unrelated path entered main, and archives without `Done`. Its direct
archival child is verified and pushed. Retry recognizes only exact task
preparation, archival move/stage, or archival-child state. Ownership and every
Episode resource remain active because cleanup needs separate authority.

Cleanup is likewise not handoff. The separately confirmed Cleanup action requires a new
explicit Cleanup decision bound to the exact task, owner, Episode head, branch,
worktree, durable session/route, and all optional resource identities. The
terminal Episode head must descend from the admission base and, rather than the
stale allocation head, is the branch/worktree head authorized for cleanup. It
re-verifies the pushed Merge/`Done` or Abandon/archive terminal child before
mutation, then removes only the exact idle runtime, worktree, and branch in a
verified monotonic sequence. Ownership stays active through interruption and
becomes inactive only after all resources are absent. Exact partial-prefix retry
and inactive replay are idempotent. The coordinator rejects busy, dirty,
foreign, mixed-outcome, unpushed, and out-of-order states and is exposed only through `finalize_task_episode`.

The initial Episode creation is different: it starts a fresh session with one
fixed execute assignment after bundle promotion. It does **not** run handoff.
Handoff begins only with later owner-supervised continuation.

## Authority

The Conversation may use Episode handoff after accepting an in-scope candidate
or recording an accepted in-scope revision. Pause, consultation, merge,
abandonment, destructive cleanup, remote transport, and product or scope changes
remain operator decisions and must not be routed through handoff.


## Validation policy

Plugin candidates are validated only in isolated Docker Tier 1. Never apply,
check, or probe an unaccepted candidate against the host user-global plugin.
Useful gates are:

```bash
python3 -m pytest tests/ -q -m container
scripts/test-tier1.sh --probe
scripts/test-all.sh
```

The container suite includes the reviewed-plan Node behavior bridge and native
Prime Agent lifecycle probes. Host-safe Tier 0 covers static policy and pure
logic only.
