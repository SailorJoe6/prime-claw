# Ralph handoff chain

Prime Claw keeps handoff and execute as two separate canonical workflows.
Handoff compacts and records the transition. Execute remains the sole queued
follow-up. A prep or handoff turn never reconstructs, retries, or directly runs
the queued continuation.

## Ordinary handoff

The thin globally discoverable `handoff` skill routes an explicit ordinary Ralph
handoff request to `ralph_handoff`. The tool loads project
`.prime-claw/workflows/handoff.md` and `.agents/skills/execute/SKILL.md` before
sending handoff through `steer` and queueing execute with `followUp`. It reuses
the internal loader and two-message sequence without merging authority surfaces.
No custom `/handoff` registration is required; native `/skill:handoff` and Prime
Agent built-ins remain available.

Ordinary handoff guidance is optional operator-supplied focus, not inferred
product decisions, arbitrary chat, or scope expansion. Ask if the handoff
objective would be materially inferred. Successful admission ends the calling
turn and proves only queued work, not compaction or execute completion. Failed
or uncertain transport is reported honestly and never retried automatically.
Later compaction success or failure belongs to Prime Agent's normal queue
lifecycle. Owned-Episode continuation uses the separate tools below, whose
bounded guidance may synthesize accepted recorded in-scope findings.

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

The public `handoff_task_episode(taskId, guidance?)` sends the canonical handoff
and sole execute follow-up to the existing version-2 Episode. It selects the
exact owner, task, recorded worktree/branch, durable session and runtime route.
Editable handoff/oversight guidance owns status, meaningful plan/design, code
publication, idle completion/children/queues, scope and semantic compatibility.
Code does not repeat those decisions as literal-main, role-depth, task-byte,
whole-code-cleanliness, upstream equality, ancestry or old-design approval.
Native prompt delivery still uses `queueIfBusy: false` for the first message;
its refusal or uncertainty is reported once, without retry or a duplicate
assignment. Retained version-1 identity, frozen plans and quiescence behavior
are unchanged.

Grandfathered Backlog carries complete current primary and Episode native task
views to both prompts and the caller. Independent Backlog prepares only the
Episode task clone once, without synchronizing another writer's mutable primary
bytes/index or freezing paired heads. Both prompts retain exact previous/current
native views/revisions and Episode code-head/upstream/status results. Unrelated
Git bytes, staging and compatible history descendants survive. Publication and
same-task refinements are LLM judgments, not a classifier or frozen approval.
Backlog authoring remains literal selected-file-only, separately from code in
both topologies; each coherent ticket edit is committed ASAP and published
promptly, not saved for handoff or session end.

Beads performs one supported pull and reads current native transport and raw
task facts. Both prompts and the caller receive previous/current raw views,
local revisions, native results/warnings/working-set/ref qualifications and code
observations. The old persisted design is not a readiness lock. No clean/pushed
code or ancestry predicate can reject the observation callback after admission.
Exact fixed ownership/resource targeting and readback remain. Native session
list/get_state flags also reach both prompts; they are facts for editable policy.
`currentProviderRevision` is local HEAD, not exact-task publication proof.
The first message's callback records only existing task/provider/code observations;
execute is its sole follow-up. R1 preserves successful stderr; R2 preserves full
create mutation results through one initial execute. No new mirror or assignment.

Beads authoring uses its accepted touched-table/staged-set multi-issue semantics:
review pending/staged consequences BEFORE mutation/commit/push, consult unclear
or unauthorized work, and inspect actual task history and publication inclusion.
Exit-zero update can merely log history-commit failure; local read/HEAD or push
success is insufficient. See the editable execute/implementation and owner
guidance for the provider-native procedure. Terminal/finalization policy also
belongs to editable oversight guidance; cleanup returns raw facts and targets
exact resources. Bounded allocated independent Backlog/Orca continuation uses the
original operation through `create_task_episode`; existing-session binding sends
no assignment. This support is not general recovery, live activation, or proof of
historical assignment delivery.

Candidate review, Delay, Request Changes, Merge, and abandonment are not handoff. Grandfathered Backlog retains its exact main-task-only `Ready for Merge` or `In Progress` commits and ordinary same-Episode main integration. Independent Backlog publishes those statuses, Done, or archive only on the disconnected task branch, keeps `mainHead` as code history, and fast-forwards nested task clones without mixing task bytes into the candidate. Both retain the exact displayed tuple, ff-only code Merge, and explicit abandonment authority. Beads instead treats `mainHead` as the current pushed canonical code head, integrates it into the idle Episode when needed, and proves pushed `candidateHead` ancestry before one guarded `in_progress`→`ready_for_merge` native status-plus-note publication. Delay is a no-op. Explicit Request Changes makes one guarded `ready_for_merge`→`in_progress` publication with truthful finding evidence, then resumes the same Episode through ordinary handoff. Explicit Merge authority still binds the exact displayed `(taskId, mainHead, candidateHead)`; a fresh preflight proves Git identity/ancestry plus current native `ready_for_merge`, then canonical main uses ordinary `git merge --ff-only` and normal push before one guarded native `ready_for_merge`→`done` publication with truthful tuple/code evidence. Beads abandonment is also outside handoff: separate exact task/head authority permits one supported native `closed` plus exact reason publication, distinct from completed custom `done`, and abandoned code never enters main. No branch adds a Ready receipt, progress object, content digest, custom publisher/merge recovery, provider-revision approval lock, or replay protocol.

Cleanup is likewise not handoff. Before task-native merge readiness, the Conversation verifies provider-reported idle completion of the exact Episode and explicitly proven descendants; active or unprovably idle work refuses readiness. Immediately after an operator-authorized terminal merge or abandonment is committed and pushed, the Conversation automatically calls cleanup-only `finalize_task_episode` without separate cleanup confirmation, passing exact `taskId`, terminal `episodeHead`, and truthful `outcome`. The Conversation judges published Backlog Done/archive or Beads custom `done`/exact-reason built-in `closed`, code inclusion/exclusion, history and direct-remote facts under editable guidance before requesting cleanup. The tool returns those native observations and independently verifies exact idle resource targeting. Independent Backlog removes only the exact Episode nested clone before parent resources, preserving uncommitted bytes; ordinary cleanup does not impose a prior-revision/equal-head/ancestry publication gate. It removes the runtime, exact upstream ref, worktree, and any remaining local branch, verifies absence, and removes only the unchanged owner entry. Shared provider history survives. It performs no review or Git/provider lifecycle outcome and stores no cleanup head or progress state. The Conversation interprets errors and re-reads current ownership, provider, Git, and selected-provider evidence before any safe re-invocation; there is no internal retry loop or successful-close replay result.

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
acceptance, delay, merge, abandonment, cleanup, ordinary `ralph_handoff`, and
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
