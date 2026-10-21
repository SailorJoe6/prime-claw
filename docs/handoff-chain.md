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

Each managed handoff and execute prompt carries
`<operator-episode-owner-session>` with the exact owning Conversation's
`ownerSessionId`. The Episode selects that key in the canonical checkout's
`.prime-claw/ownership.json` registry, does not substitute its own session ID,
and verifies the selected entry's recorded worktree/session identity. Another
Conversation's Episode neither selects nor blocks this handoff. The old direct
record is accepted as migration input, and all-record inspection is reserved for
binding collisions and worktree activity.

The retained `handoff_spec_episode(location, guidance?)` surface remains
available only to the exact owner of one active version-1 folder Episode.
Persisted ownership decides before any prompt tag, and live version-1 identity
requires the recorded worktree's readable, non-empty active specification and
implementation plan (`EXECUTION_PLAN.md` remains the retained spelling). Before
messaging, it verifies:

- strict source-location syntax and the exact persisted binding, without requiring
  the obsolete promoted future folder to remain on disk;
- exact owner session;
- active lifecycle status;
- the recorded Git worktree and actual branch;
- exact Orca worktree identity for the Orca engine;
- durable Prime Agent session ID/file; and
- a quiescent Episode with no active turn, tool, compaction, child, or queue.

Persisted active version-1 ownership keeps that plan pair active through
blockers, candidate review, and bounded revisions, so ordinary continuation
never archives or moves it. If an older blocked snapshot has no active pair,
handoff stops: only the operator-authorized exact version-1 recovery in the
blocked workflow may restore the recorded worktree's pair and revalidate live
identity. Missing files never fall through to task-native continuation.

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
same `<operator-episode-task>` and `<operator-episode-owner-session>` bindings,
so handoff and execute cannot fall back to folder authority or infer an owner
from placement. The durable session must be rooted at the exact owned
worktree before any message is sent. The exact main task path must match committed
`HEAD` before the task is resolved, while unrelated dirty main paths remain
allowed; uncommitted task bytes cannot spoof a resumed lifecycle status.

The task-native handoff policy reloads that same task in the Episode worktree, keeps lifecycle status Conversation-owned, and permits only supported task content updates followed by a committed and pushed checkpoint. A task still `Blocked` on main cannot hand off. The Conversation publishes Blocked or resumed `In Progress` directly with the supported Backlog CLI, verifies and commits only the bound task path, pushes, and then uses ordinary handoff. No Episode-owned content is mirrored by a plugin transaction.

Candidate review, Delay, Request Changes, Merge, and Abandonment are not handoff. After exact candidate acceptance, the Conversation publishes an exact main-task-only `Ready for Merge` commit, pushes it, uses ordinary Git in the idle Episode to integrate that main head while preserving Episode-owned task content and applying the authorized status, pushes the refreshed candidate, and shows the operator `(taskId, mainHead, candidateHead)`. Delay is a no-op. Request Changes publishes an exact main-task-only `In Progress` commit, integrates current main into the same Episode with ordinary Git as needed while preserving its task content and applying the authorized status, then resumes through ordinary handoff. Merge requires a fresh preflight of the displayed tuple and explicit operator authority, then ordinary canonical-main `git merge --ff-only`, supported Backlog `Done`, an exact task-only commit, and push. Abandonment requires separate explicit confirmation, exact task-only selection from the pushed Episode, supported Backlog Final Summary/archive operations, an exact move commit, and push. There are no Ready receipts, phased progress objects, content digests, custom merge/archive recovery, or replay protocol.

Cleanup is likewise not handoff. Before task-native merge readiness, the Conversation verifies provider-reported idle completion of the exact Episode and explicitly proven descendants; active or unprovably idle work refuses readiness. Immediately after an operator-authorized terminal merge or abandonment is committed and pushed, the Conversation automatically calls cleanup-only `finalize_task_episode` without separate cleanup confirmation, passing exact `taskId`, terminal `episodeHead`, and truthful `outcome`. It verifies exact idle resources, removes runtime, worktree, and branch, verifies absence, and closes ownership. It performs no review or Git/Backlog lifecycle outcome and stores no cleanup head or progress state. The Conversation interprets errors and re-reads current ownership, provider, Git, and Backlog evidence before any safe re-invocation; there is no internal retry loop or successful-close replay result.

The initial Episode creation is different: it starts a fresh session with one
fixed execute assignment after bundle promotion. That assignment carries the
exact owning Conversation registry key. It does **not** run handoff.
Handoff begins only with later owner-supervised continuation.

## Post-handoff Conversation compaction

A successful `handoff_spec_episode` or `handoff_task_episode` admission can
trigger a best-effort compaction of the owning Conversation's own context.
Resume and Request Changes continuations are covered by the same
`handoff_task_episode` adapter after their ordinary Git/Backlog status steps,
so no separate trigger exists for them. Creation, blocking, candidate
acceptance, delay, merge, abandonment, cleanup, ordinary `/handoff`, and
heartbeat ticks never trigger it.

After the admitted handoff result is returned, the plugin loads
`.prime-claw/workflows/conversation-after-handoff.md` from the owning
Conversation's project (not the Episode worktree), reads current context
utilization, and only then delivers the workflow to the Conversation through
the supported steer transport. The prompt instructs the model to compose its
own mission-focused hint and call `compact.run(focus_hint)` exactly once.
Prompt delivery is an attempt, not proof that compaction ran; the existing
post-compaction restoration hook re-primes the owner if compaction executes.
A `scheduled: true` result is a request, not confirmation of completion.

Trigger conditions:

- The comparison is strict: utilization must **exceed** the threshold, not
  match it.
- Unknown, absent, or non-finite utilization skips the prompt.
- `finalize_task_episode` and failed, partial, or uncertain handoff
  dispatches never invoke the check.

Configuration lives in the workflow file's `threshold_percent` frontmatter
key. Omitting it defaults to 60. Equivalent forms are normalized: `.6`, `60`,
and `60%` all mean 60%; bare values at or below 1 are ratios and bare values
above 1 are percentages; a percent suffix always divides by 100. `0` or `0%`
disables the automatic compaction. Valid enabled bounds are 0.1 through 1
(10% through 100%) inclusive; negatives and values above 100% are rejected.

Compaction trouble never fails a handoff. An invalid configuration, a missing
or unreadable workflow, a delivery failure, or a hook error produces a bounded
warning sentence on the otherwise successful handoff receipt and is recorded
in the tool's details; ordinary skips (disabled, at or below threshold,
unknown utilization) stay silent in content. There is no retry and no second
Episode dispatch.

Deployment and UAT of this behavior are a later explicitly approved cutover:
a user-global refresh, one coordinated full restart, and resumed owner and
Episode proof. Copying files or requesting compaction is not proof.


## Authority

The Conversation may use Episode handoff after accepting an in-scope candidate
or recording an accepted in-scope revision. Pause, consultation, merge,
abandonment, remote transport, and product or scope changes remain operator
decisions and must not be routed through handoff. Task-native cleanup follows
an authorized committed and pushed terminal outcome automatically through the
Conversation's prompt policy, never through handoff. Retained version-1
destructive cleanup still requires separate operator authority.


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
