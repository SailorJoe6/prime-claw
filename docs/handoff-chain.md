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

The public `handoff_task_episode(taskId, guidance?)` tool seam stages the equivalent continuation for version-2 task ownership. It selects the exact Conversation-keyed owner before interpreting provider or task state. Both canonical prompts carry the same `<operator-episode-task>` and `<operator-episode-owner-session>` bindings, so handoff and execute cannot fall back to folder authority or infer an owner from placement. The durable session must be rooted at the exact owned worktree and fully quiescent before any message is sent.

The provider-absent/Backlog branch retains the canonical primary `main`, exact owner/task/path, committed main task path, and main/Episode `In Progress` plan checks. Unrelated dirty main paths remain allowed; uncommitted task bytes cannot spoof a resumed lifecycle status. Its handoff policy reloads the same task in the Episode worktree, keeps lifecycle status Conversation-owned, and permits only supported task content updates followed by a committed and pushed checkpoint. A task still `Blocked` on main cannot hand off. The Conversation publishes Blocked or resumed `In Progress` directly with the supported Backlog CLI, verifies and commits only the bound task path, pushes, and then uses ordinary handoff. No Episode-owned content is mirrored by a plugin transaction.

The active-Beads branch has no task path and does not use Backlog. It preserves the exact operation, base, worktree/branch, Episode/session, and optional Orca resources. Prior raw evidence may truthfully be `blocked` after accepted resume; current synchronized native state must be exact `in_progress` with meaningful design. After an initial idle/quiescent proof, handoff performs one supported native pull, proves clean published provider state, reads the exact current raw task, pairs that read with a second stable publication proof, and proves the Episode code head clean and pushed. Exact previous/current raw views and revisions reach both canonical prompts. The first message's admission callback records only factual provider/task/code observations while preserving every resource binding; raw inequality is not an approval boundary. Compatible changes continue, real conflicts escalate, and one final resource/quiescence proof precedes the same one-handoff/one-execute delivery. The owning Conversation performs any accepted guarded native block/resume status-plus-note publication before handoff; guidance never supplies lifecycle or native evidence.

Candidate review, Delay, Request Changes, Merge, and abandonment are not handoff. Provider-absent/Backlog retains its exact main-task-only `Ready for Merge` or `In Progress` commits, ordinary same-Episode main integration, exact displayed tuple, ff-only Merge, task-only `Done`, and explicit abandonment path. Beads instead treats `mainHead` as the current pushed canonical code head, integrates it into the idle Episode when needed, and proves pushed `candidateHead` ancestry before one guarded `in_progress`→`ready_for_merge` native status-plus-note publication. Delay is a no-op. Explicit Request Changes makes one guarded `ready_for_merge`→`in_progress` publication with truthful finding evidence, then resumes the same Episode through ordinary handoff. Explicit Merge authority still binds the exact displayed `(taskId, mainHead, candidateHead)`; a fresh preflight proves Git identity/ancestry plus current native `ready_for_merge`, then canonical main uses ordinary `git merge --ff-only` and normal push before one guarded native `ready_for_merge`→`done` publication with truthful tuple/code evidence. Beads abandonment, finalization, and cleanup remain deferred. No branch adds a Ready receipt, progress object, content digest, custom publisher/merge recovery, provider-revision approval lock, or replay protocol.

Cleanup is likewise not handoff. After terminal main is pushed and separately authorized, cleanup-only `finalize_task_episode` durably binds the exact terminal Episode head, verifies the exact idle resources, removes runtime, worktree, and branch, verifies absence, and closes ownership. It performs no review or Git/Backlog lifecycle outcome. Same-head retry is idempotent; different or unsafe state blocks.

The initial Episode creation is different: it starts a fresh session with one
fixed execute assignment after bundle promotion. That assignment carries the
exact owning Conversation registry key. It does **not** run handoff.
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
