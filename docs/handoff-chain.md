# Ralph handoff chain

Prime Claw keeps handoff and execute as two separate canonical workflows.
Handoff requests native compaction once and ends. Execute remains the sole
canonical follow-up. A prep or handoff turn never reconstructs, retries, or
directly runs that continuation. Task-native handoff may start before the local
observation callback or execute send; prompt receipt is not execute admission.

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
Task-native first delivery uses the supported `followUp` plus
`queueIfBusy: true` option for ONE canonical handoff request. A heartbeat that
starts after idle observation can queue that request instead of causing a busy
refusal. Retained version-1 first delivery remains idle-only with
`queueIfBusy: false`; identity, frozen plans and quiescence behavior are unchanged.
First admission precedes the factual ownership-observation callback, then ONE
canonical execute follow-up. The two sends and local callback are not atomic or
globally exactly-once. Failure is reported once without catch/resend or automatic
retry.

### Task-native refusal and delivery uncertainty

The editable `prime-claw-oversee-episode` skill governs this version-2-only
exception. Review the exact request, native result, available session/action
observations and relevant runtime behavior. Preserve source/running-build gaps
and preparation effects: a first-message refusal does not prove that preceding
task-history preparation had no effects. Missing observed actions or empty queues
alone are not proof of non-admission.

Only reviewed evidence supporting a **definite first-stage refusal before prompt
admission**, followed by a later explicit informed operator decision, permits
ONE canonical `handoff_task_episode` re-invocation. Refusal alone is not authority.
Keep the exact owner/provider/task/operation/durable session/worktree/branch and
original accepted scope/focus unchanged; re-read current native task/code/session
facts. This is an explicit exception to the blanket refusal boundary, not a new
advance, inferred approval or automatic recovery.

Keep the other cases distinct and stopped:

- **Uncertain first admission:** preserve uncertainty and name the evidence
  that cannot establish admission or non-admission. Do not infer refusal.
- **Callback failure after first admission:** preserve the first admission and
  actual observation effects; this invocation sends no execute.
- **Second-stage refusal or uncertainty:** preserve the first admission and
  completed callback; report execute's definite refusal or uncertain delivery.

Those cases receive no generic replay permission or ordinary handoff/chat-steering
workaround. If public evidence cannot establish definite first-stage refusal,
explain the precise limit, not a safe resend of the old chain. Inspect supported
evidence without sending work, remain paused, or seek a separately authorized
normal terminal disposition. The exact owner can assess a separate NEW
continuation only if the conditions below are met. Record findings,
gaps and disposition in existing native task fields/history and publish normally,
not through a new endpoint, store, classifier or replay protocol. Ordinary
successful handoffs need no new routine permission.

### New execute-only continuation

REQUIREMENTS.md P15 and editable `prime-claw-oversee-episode` policy permit ONE
NEW canonical execute-only request to the SAME version-2 task-native Episode in
one of two cases:

- **Completed handoff:** the original canonical handoff demonstrably completed
  and the following execute failed or remains historically unproved. A receiver's
  no-execute/no-pending report and fresh native idle/empty queues are current
  evidence, not retrospective proof of non-delivery. Historical sender IDs,
  ACKs, callback proof, receipts or universal proof of absence are not required.
- **Verified pre-work runtime interruption:** both canonical prompts demonstrably
  reached the exact Episode, but a verified model/runtime failure stopped both
  before task work. Reconcile native task history, code and observed effects. A
  bounded report-only turn may confirm recovery, the current checkpoint and the
  next already-authorized step, without steering or replay. Uncertain delivery,
  possible unaccounted task effects, or idle/empty queues alone do not qualify.

Neither path re-invokes the old two-stage chain. Known pending/running execute or
unfinished admitted work stops; never cancel it to qualify.

The exact owner reads current full native task/history, meaningful living plan,
accepted bounded focus, code/head/publication/worktree facts and available
historical observations. Inspect fresh native Episode and explicitly proven
descendant state/actions/queues. The existing handoff entry captures only the
selected session/state, not all descendants; do not claim otherwise. Retain full
raw envelopes, unknown keys, null/absence and observations through bounded exact
native-entry access and meaningful reads, not giant prompt copies or an idle
boolean. Semantic judgment accepts compatible current changes and unrelated
history advances; frozen equality is not approval. Stop real identity/scope
conflicts, unsafe current work, unavailable required current evidence or
unproved idleness. Preserve owner/provider/task/operation, durable session,
worktree/branch, host/placement, original code basis and integration target.
A changed live route must resolve through supported facts to that same durable
session, not guessed name or CWD.

Brief the operator on actual handoff completion or the proven pre-work
interruption, known failure versus unknown history, callback/partial effects,
receiver report/native readiness, current progress,
accepted next scope, uncertainty and possible prior effects. Explicit informed
authority for this NEW request is required; ordinary conversation suffices and an
already informed decision needs no second phase gate. Generic earlier “continue”,
model/context change, compaction, unblock alone, idle, silence or Episode advice
is not enough. Cancellation, terminal outcomes and scope boundaries stand.

Only the owner clears a genuinely satisfied Blocked condition and publishes
truthful clearance plus In Progress through the normal provider-native lifecycle
before sending. Already In Progress needs no Blocked round trip. Do not promote
Ready or reopen Done. Record decision/focus/current facts/history limits in
existing owner-appropriate fields/history; never copy Episode Plan/Notes or use
task prose as a send receipt. Verify actual publication and prepare only the
intended Episode workspace while preserving unrelated bytes/index/history.
Failure means no send. The new request carries full current factual context
even when stored observations are older or a prior callback partly wrote.

**Managed invocation in this source candidate:** after the informed decision,
call the existing `handoff_task_episode` with the exact `taskId`,
`mode: "execute-only"`, and the accepted bounded execution focus in `guidance`.
Omitting `mode` retains the ordinary handoff/execute chain. This is a source
capability, not proof that any running process supports the mode. If the loaded
generation lacks it, stop for the interface constraint; do not inject raw
execute, use ordinary `ralph_handoff`, or patch upstream.

The new mode loads only the current canonical execute asset. It carries
`<operator-execute-guidance>`, exact owner/task tags and one bounded reference to
the existing native observation entry. That entry retains exact prior/current
provider observations (Git references for independent Backlog), selected Episode
session/state, and raw explicitly linked
descendant session/state facts. Saved descendants without live state keep that
state absent, not an invented idle boolean. The owner must obtain and judge
required current readiness evidence before invoking. A freshly resolved route
can differ from the historical ownership route only for the same natively
verified durable Episode; the operation does not reopen or rebind resources.

It sends ONE existing native busy-safe `followUp`, not handoff, compaction,
initial assignment, a historical callback, creation, or heartbeat/hook dispatch.
No after-handoff compaction trigger runs. Resume current durable progress, not
historical effects or a stale task/comment snapshot. Semantic eligibility,
informed authority, scope and history compatibility remain editable guidance,
not another code classifier or approval protocol. No routine gate is added to
successful ordinary handoff. Candidate tests do not authorize live recovery.

After definite NEW native execute admission only, the existing managed factual
mechanism advances current provider/task/code observations, not historical
callback completion. Grandfathered Backlog retains its original record shape
and advances only its existing code observation; no provider fields are invented. Refusal or uncertainty ends that authorization without
optimistic advancement. Report requested/admitted (not completed), refused,
not attempted or uncertain using bounded private-safe native stage/correlation
facts separately from factual-update results. A failed update, including
write-then-throw partial effects, preserves admitted execute and actual effects.
Inspect before another transition; never resend or invent rollback. No automatic
retry, late-reply restart, global exactly-once or retrospective non-delivery
claim; unknown history stays unknown. Further disposition requires fresh evidence
and a separate informed operator decision. No new store/protocol/state machine
is required. Retained version-1 and creation/initial-assignment recovery are
unchanged. Actual historical-case recovery and global activation/full restart/
live UAT still need separate authority and intended-generation proof.

Grandfathered Backlog observes committed tickets at the current integration
and Episode code heads. Independent Backlog prepares only the Episode task
clone once, without synchronizing another writer's mutable primary bytes/index
or freezing paired
heads. For ordinary handoff and execute-only, the new observation uses exact
previous/current Git ticket references and revisions, separate from the Episode
code-head/upstream and runtime facts. Current ticket evidence is from the
observed published task revision, not a separately retained local head.
`selectedTaskStatus` carries the raw literal-ticket Git status result as
publication context, not an automatic cleanliness gate or mutable fallback.
Unrelated Git bytes, staging and compatible history descendants survive. Publication and same-task refinements
are LLM judgments, not a classifier or frozen approval. Backlog authoring remains
literal selected-file-only, separately from code in both topologies; each
coherent ticket edit is committed ASAP and published promptly, not saved for
handoff or session end. The Git-reference read-only handoff uses the committed
contract. It does not require a live full task view. Actual edits and
legacy raw handoff retain native reads and checks.

Beads performs one supported pull and reads current native transport and raw
task facts. Its exact observation includes previous/current raw views, local
revisions, native results/warnings/working-set/ref qualifications and code
observations. The old persisted design is not a readiness lock. No clean/pushed
code or ancestry predicate can reject the observation callback after admission.
Exact fixed ownership/resource targeting and readback remain. Native session
list/get_state flags are also captured as facts for editable policy.
`currentProviderRevision` is local HEAD, not exact-task publication proof.
The first message's callback records only existing task/provider/code observations;
execute is its sole follow-up. R1 preserves successful stderr; R2 preserves full
create mutation results through one initial execute. No new mirror or assignment.

### Independent Backlog creation evidence

For a new Episode from an existing independent Backlog ticket, creation streams
`backlog task view --json` at the registered creation entry, before allocation,
around status publication and reservation, and again in the Episode checkout
before starting the session.
It keeps only the canonical ID, exact path and status needed by those checks.
The launch carries Git repository, commit and literal path references, not a
native task snapshot. Before assignment, creation resolves the exact reserved
and fetched published ticket blobs in the Episode clone. A retained local tip
that is ahead is reported separately, never as publication; creation does not
reset or push the retained clone. Creation does not use the scratch header reader.
The editable workflow still decides readiness and interprets the plan.
An existing operation keeps its own resource binding; this sends no replay.

### Branch-local Backlog creation evidence

The registered creation tool streams native Backlog identity (canonical ID,
path and status), not the full native response, for selection and around the
existing status edit. It verifies the exact integration commit's ticket before
mutation, then verifies the task-only status commit before reservation. That
status commit remains the Episode code base. The code push retains its existing
outcome reporting; a Git reference is not proof of remote publication.

Before opening a fresh session, creation verifies the same ticket commit and
same code repository again in the allocated worktree. The single initial
execute carries `currentTaskEvidence` in the provider observation. It is a
branch-local `backlog-git` reference, not a task snapshot or a continuation pair.
Ownership keeps its existing branch-local shape. Missing committed evidence
stops before a session or assignment; exact active recovery returns the same
resources without issuing another execute.

### Bounded task-native transport observations

The existing JSONL client attaches ephemeral `transport` facts to its local
response or error. These retain the **original** generated `clientId` and
`commandId`, command type and selected runtime route, request start, result-wait
timeout and elapsed time, write attempt, result presence, native success/code when
available, and timeout/socket/write/connect cause. Only bounded machine-code
tokens cross this boundary; native error text, callback exceptions, prompt/task
bodies, credentials and arbitrary response data do not.

The task-native publisher returns `delivery` in the normal handoff tool text
and details, including on stopped chains. Its three factual parts are:

- `first`: actual admission, refusal, failure or uncertainty, with available
  original request facts;
- `callback`: not required/not attempted, completed or failed; failure can have
  partial native effects, so it is not a rollback claim;
- `followUp`: not attempted, admitted, refused, failed or uncertain, with its
  own original request facts when attempted.

A first success precedes the factual callback and then **one** canonical execute
follow-up through the existing workflow chain. A callback failure stops before
that follow-up. A missing result after a write remains uncertain, even if the
socket closes or a reply arrives after the request has returned. No late reply
restarts the chain. No retry, replay, lookup API, command-history store or durable
receipt is added. These observations supply facts for editable workflow/LLM
judgment; they do not authorize another transition or establish global
exactly-once execution.

For mutation results, `transport.ack.commandId` identifies the original local
`ack_result` frame. `writeReturned` means only that its socket write returned,
not that the daemon received or persisted the acknowledgement. Native result
success establishes prompt admission, not compaction or execute completion.
An absent transport record from an injected test adapter is not fabricated.
Retained version-1 handoff stays on its existing idle-only publisher path.

### Exact native task observation reference

Task-native handoff and execute carry the same bounded
`<task-handoff-observation-reference>` JSON rather than giant inline task views.
It names `schemaVersion: 1`, the source native `sessionId`, absolute `sessionFile`,
exact `entryId`, `parentId`, `customType: "prime-claw-task-handoff-observation"`,
`entrySha256`, and exact `bindings`. Bindings identify `ownerSessionId`, `provider`,
`taskId`, `operationId`, `episodeId`, `episodeSessionFile`, `episodeActiveSessionId`,
`worktree`, `branch`, `baseRef`, `integrationBranch`, `engine`, and optional
`projectSetupId`/`routingEnvironmentId`.

The custom entry data is `{schemaVersion: 1, bindings,
providerTaskObservation, episodeSessionObservation: {session, state}}`.
`providerTaskObservation` holds the unchanged facts, not a normalized task model
or summary. For independent Backlog ordinary handoff and execute-only, new
`previousTaskEvidence` and `currentTaskEvidence` values are `backlog-git`
references, not ticket snapshots. They bind `previousProviderRevision` and
`publishedProviderRevision` respectively. An optional `localTaskEvidence`
points to a separately retained local head, not publication. When relevant,
bind it to the same repository and literal ticket path, resolve its own commit
and canonical task ID, and read or diff the exact blob against the published
blob with the same bounded procedure. The managed sender verifies both independent
references and their native canonical IDs from committed headers in the exact Episode clone before
delivery. It stops with an evidence gap if either cannot be proven. An older
owner record's historical checkpoint may be resolved exactly; its raw view is
not committed evidence and stays intact in historical records. The native task
remains authority. The journal locator selects factual context; it is not
semantic acceptance or publication proof. The caller receives bounded
transport/reference facts, not the entire payload.

For branch-local Backlog ordinary handoff and execute-only, the shared sender
helper takes the exact current integration and Episode code head OIDs and puts
`backlog-git` references in `mainTaskEvidence` and `currentTaskEvidence`,
respectively. `mainTaskEvidence` refers to the observed head of the recorded
integration branch, not necessarily `main`. The exact branch-local binding supplies the same literal
task path for both. The sender verifies both committed regular blobs and their
native canonical IDs before delivery. Missing or mismatched evidence stops
continuation; it never substitutes a historical checkpoint, mutable native
view, or either branch's tracking tip. No provider revision or ownership
checkpoint is added for branch-local Backlog.

Both editable workflows require the Episode REPL to read only the exact source
session file, verify its exact session header ID, select one exact entry ID,
and verify `type: "custom"`, custom type, parent, schema and bindings against its
own selected registry Episode. SHA-256 covers the exact UTF-8 JSONL row bytes
excluding the newline, not JSON reserialization. The full parsed entry data
stays in named REPL variables. The reference's `sessionId` must equal `bindings.ownerSessionId`. That source
Conversation session and the bound Episode session are distinct identities;
neither silently substitutes for the other.

Supported placement uses the pinned same-user local daemon. For Orca, inspect
the exact selected current setup: `hostId` must be local/unrouted. Check the
exact native Episode session header/file, current route and CWD, and actual
same-UID disk access to the source session file. These are placement facts, not
a new approval protocol. External sandboxes, different user namespaces and
remote execution are not proven by this support; do not infer access there.

For both Backlog Git observation shapes, the LLM reads the complete current
contract and relevant prior/current differences using the
[exact Git procedure](#backlog-git-evidence-reader) below. Both references are
required; a malformed reference does not fall back to a live or historical view.
For complete legacy raw observations (both native task views for the selected
Backlog topology) and Beads, the LLM
enumerates the native structure and reads the current contract and relevant
prior/current differences. Provider envelopes, arrays, unknown fields, comments,
nulls and absence retain their exact meaning. Large collections and individual
huge values are read in chunks of about 4096 characters per output.
Key/length/digest checks, previews and summaries cannot replace semantic
inspection. Neither workflow prints the whole history or one giant payload.

Missing, unreadable, ambiguous, mismatched or remotely inaccessible exact
evidence stops continuation. The supported placement needs real access to the
same native session file; host labels alone do not prove access. There is no
journal search, copied evidence store or giant-inline fallback. Prior loaded
generations' `<provider-task-observation>` and `<episode-session-observation>`
remain readable when no reference is supplied, never as repair for a failed
reference. Retained version-1 handoff is unchanged. The reference does not add
transport retry, callback atomicity, historical recovery or assignment authority.

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
heartbeat ticks never trigger it. The separate new execute-only continuation
must not invoke this after-handoff hook; compaction remains optional context
control, never execution authority.

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


## Backlog Git evidence reader

A `backlog-git` reference identifies the selected topology and repository,
full commit OID, and literal ticket path relative to that repository. For an
independent store, the path is relative to the nested clone, not the code
worktree. For branch-local Backlog, it is relative to the code repository.
Repository identity binds the selected independent Git transport URL by digest,
or the canonical Git common directory for a local identity. A branch-local
reference always uses a local identity, even if the repository has a remote.
It does not imply publication or portability.

The managed `readBacklogGitEvidence` helper takes the already selected
repository and canonical task ID. It checks the commit and regular ticket
blob. It stages only the committed frontmatter in a private scratch directory
for the native Backlog parser and compares the returned canonical ID exactly.
The Git reader writes and replays that frontmatter in bounded chunks, with no
fixed header size limit. It removes the scratch directory on completion,
failure, or early return. The body is never passed to Backlog or copied into
the scratch directory. Missing delimiters or failed verification are evidence gaps.

Use `streamBacklogGitEvidence` to inspect adjacent ranges. One Git blob
process yields successive windows of up to 4096 raw bytes with their offsets
and the total byte length. Exhaust the iterator to verify Git's exit status
and the byte count; breaking early closes the process and is not a complete
read. `readBacklogGitEvidence` is for a single offset, not a loop over adjacent
windows. Use a streaming UTF-8 decoder if a character crosses a window
boundary. Long lines in the body do not shorten the evidence.

For independent continuation, first bind both `backlog-git` references to the
Episode's already selected nested clone, normally `<worktree>/.backlog` (or the
configured store path). Do not use the code repository or primary clone.
Verify `git --no-replace-objects -C "$root" rev-parse --show-toplevel` resolves
to that exact canonical store root. Each reference's topology must be
`independent`. Its repository identity must equal lowercase SHA-256 of UTF-8
`remote:` plus the output of `git -C "$root" remote get-url -- "$remote"`
with trailing whitespace removed. Use the existing selected remote; do not
print the URL or infer identity from a remote name alone.

For branch-local continuation, use the code repository in the exact bound
Episode worktree, not an independent task clone. Verify the canonical Git
top-level is that worktree. Require both reference topologies to be
`branch-local` and both paths to equal the literal code-repository-relative
path from the binding. Resolve `git --no-replace-objects -C "$root" rev-parse
--path-format=absolute --git-common-dir`, trim trailing whitespace, and resolve
the result with `realpath`. Both identities must equal the lowercase SHA-256
of UTF-8 `local:` followed by that canonical common Git directory path. This
binds linked worktrees of the same local checkout, not a remote or another
clone. Use the observed commits in the references, not freshly resolved tips.
Compare integration to Episode and read the complete Episode ticket. Keep
native code upstream/publication facts separate; neither reference proves them.

Each commit must be a full lowercase 40-hex OID, and `cat-file -t` must return
`commit`. Use each reference's literal clone-relative `.md` path. Reject empty,
`.` or `..` components, NUL, CR, LF and backslashes. This command must return
exactly one NUL-terminated entry with mode `100644` or `100755`, type `blob`, a
full blob OID and the exact path after the tab:

```bash
git --no-replace-objects -C "$root" --literal-pathspecs ls-tree -z "$oid" -- "$path"
```

Check `cat-file -t` returns `blob` for each resolved blob OID. Verify each
committed header's native canonical ID against the bound task ID. Use the verified
OIDs for bounded native Git inspection, not a filename match or current tip:

```bash
git --no-replace-objects -C "$root" cat-file blob "$new_blob"
git --no-replace-objects -C "$root" --no-pager diff --no-color --no-ext-diff \
  --no-textconv --text "$old_blob" "$new_blob" --
```

In the REPL, pass arguments separately and stream stdout in successive windows
of about 4096 bytes with offsets and incremental UTF-8 decoding. Include the
header and the tail; a long line is not a stopping point. Check Git's exit
result and the `cat-file -s` byte count for a complete blob read. Do not dump
or persist full snapshots. If the exact repository, commit, path or bound task
ID cannot be verified, report the evidence gap. Do not substitute `HEAD`, a
tracking ref, mutable files, the index or a live task view.

The reader does not choose a store, verify live publication, or judge readiness.
Those remain at the existing lifecycle boundaries. Independent creation and
ordinary handoff/execute-only in both Backlog topologies use Git references.
Other lifecycle evidence paths and native task authoring are unchanged.

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

## Native observation feasibility evidence

PRIMECLAW-62 slice 1 proved lossless, exact custom-entry access from a native
Episode REPL on the same filesystem. See the
[proof and placement limits](evidence/primeclaw-62-native-entry-proof.md).
Slice 2 adopts that exact-reference shape in the task-native handoff candidate;
it does not claim host activation or real-model UAT. Pre-assistant append can
be deferred in memory, so in-memory entry access alone is not evidence that
another session can read it. Dispatch needs actual exact-row persistence.
Native compaction and the sole existing execute follow-up remain in place.
Slice 3 adds bounded transport observations and real-client/fake-socket tests.
Slice 4 extends the linked proof with actual candidate-generated handoff/execute
inputs, real Episode REPL `compact.run`, completed native compaction and one
substantive post-compaction marker. That scripted native execution uses a
request adapter into the public SDK entry used by the daemon; it is not a real
daemon/socket transport test, real-model semantic proof or live activation.
Historical uncertain delivery remains unrecovered.

Goals stay bounded to the admitted phase, report or wait boundary. Continuation
and post-compaction reminders are advisory background guidance, not assignments
or acknowledgement requests. They do not start another slice, compaction,
execute pass or recovery turn. Existing authorized supervision may continue
without extra reminder-driven status chatter.
