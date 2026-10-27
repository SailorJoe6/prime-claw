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

The Backlog branch retains canonical primary `main`, exact owner/task/path, and `In Progress` plan checks. Provider-absent or explicit Backlog without revision/evidence stays grandfathered branch-local: committed main/Episode task paths cannot be spoofed by dirty bytes, and the Conversation keeps exact-path lifecycle commits. Explicit Backlog with revision/evidence instead prepares clean independent nested clones in primary and Episode worktrees, proves the current task branch is a descendant of the owned revision and directly published, and requires the same exact In Progress meaningful task in both stores. Episode content and Conversation lifecycle changes commit only task paths and non-force-push `HEAD:refs/heads/prime-claw/tasks`; code heads remain separate. After the first handoff message is admitted, ownership records only current task revision/native evidence, code head, and time. Blocked state cannot hand off, and no plugin transaction mirrors task content across stores.

The active-Beads branch has no task path and does not use Backlog. It preserves the exact operation, base, worktree/branch, Episode/session, and optional Orca resources. Prior raw evidence may truthfully be `blocked` after accepted resume; current synchronized native state must be exact `in_progress` with meaningful design. After an initial idle/quiescent proof, handoff performs one supported native pull, proves clean published provider state, reads the exact current raw task, pairs that read with a second stable publication proof, and proves the Episode code head clean and pushed. Exact previous/current raw views and revisions reach both canonical prompts. The first message's admission callback records only factual provider/task/code observations while preserving every resource binding; raw inequality is not an approval boundary. Compatible changes continue, real conflicts escalate, and one final resource/quiescence proof precedes the same one-handoff/one-execute delivery. The owning Conversation performs any accepted guarded native block/resume status-plus-note publication before handoff; guidance never supplies lifecycle or native evidence.

Candidate review, Delay, Request Changes, Merge, and abandonment are not handoff. Grandfathered Backlog retains its exact main-task-only `Ready for Merge` or `In Progress` commits and ordinary same-Episode main integration. Independent Backlog publishes those statuses, Done, or archive only on the disconnected task branch, keeps `mainHead` as code history, and fast-forwards nested task clones without mixing task bytes into the candidate. Both retain the exact displayed tuple, ff-only code Merge, and explicit abandonment authority. Beads instead treats `mainHead` as the current pushed canonical code head, integrates it into the idle Episode when needed, and proves pushed `candidateHead` ancestry before one guarded `in_progress`→`ready_for_merge` native status-plus-note publication. Delay is a no-op. Explicit Request Changes makes one guarded `ready_for_merge`→`in_progress` publication with truthful finding evidence, then resumes the same Episode through ordinary handoff. Explicit Merge authority still binds the exact displayed `(taskId, mainHead, candidateHead)`; a fresh preflight proves Git identity/ancestry plus current native `ready_for_merge`, then canonical main uses ordinary `git merge --ff-only` and normal push before one guarded native `ready_for_merge`→`done` publication with truthful tuple/code evidence. Beads abandonment is also outside handoff: separate exact task/head authority permits one supported native `closed` plus exact reason publication, distinct from completed custom `done`, and abandoned code never enters main. No branch adds a Ready receipt, progress object, content digest, custom publisher/merge recovery, provider-revision approval lock, or replay protocol.

Cleanup is likewise not handoff. Before task-native merge readiness, the Conversation verifies provider-reported idle completion of the exact Episode and explicitly proven descendants; active or unprovably idle work refuses readiness. Immediately after an operator-authorized terminal merge or abandonment is committed and pushed, the Conversation automatically calls cleanup-only `finalize_task_episode` without separate cleanup confirmation, passing exact `taskId`, terminal `episodeHead`, and truthful `outcome`. It verifies published Backlog Done/archive or Beads custom `done`/exact-reason built-in `closed`, code/provider ancestry and direct remotes, and exact idle resources. Independent Backlog additionally proves and removes only the exact clean published Episode nested clone before parent resources. It removes the runtime, exact upstream ref, worktree, and any remaining local branch, verifies absence, and removes only the unchanged owner entry. Shared provider history survives. It performs no review or Git/provider lifecycle outcome and stores no cleanup head or progress state. The Conversation interprets errors and re-reads current ownership, provider, Git, and selected-provider evidence before any safe re-invocation; there is no internal retry loop or successful-close replay result.

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
