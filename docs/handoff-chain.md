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

The internal, deliberately unregistered
`handoffTaskEpisode(taskId, guidance)` seam stages the equivalent continuation
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
content updates followed by a committed and pushed checkpoint. A task still
`Blocked` on main cannot resume. `Ready for Merge` integration remains a later
review-handshake increment rather than being smuggled through this ordinary
`In Progress` continuation seam. No public task-native handoff tool is
registered yet.

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
