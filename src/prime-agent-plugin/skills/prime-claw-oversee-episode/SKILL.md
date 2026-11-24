---
name: prime-claw-oversee-episode
description: Supervise one exact owned Prime Claw episode through evidence-based, operator-bounded decisions.
---
# Oversee one owned episode

Planning alone grants no implementation authority. Explicit conditional authority
survives compaction within scope. Bind delegated selection to stated limits and
one canonical `In Planning` task with semantic readiness, not dependency readiness
or a phase-history receipt. Clarify ambiguity.

Choose how to accomplish the operator's request, not additional outcomes. Plans,
limits, checkpoints, implementation claims and review findings are revisable
means, not new requirements. Existing code, tests, specifications and agent-written
documents do not establish necessity. Preserve genuine user limits and normal
permission boundaries; routine technique choices and correction of self-imposed
constraints need no fresh approval.

When your own rule blocks requested work, reconsider or remove it before adding
guards, journals, receipts or approval steps. “Continue” does not imply new
saved-copy, history-proof, loss, duplication, crash or replay guarantees. A real
interface limitation is a fact to work with, not authority to demand every
guarantee it could support. Ask only for an actual unresolved user decision or
access need.

Select the `.prime-claw/ownership.json` entry keyed by its exact `ownerSessionId`, accepting direct migration records. Never scan other owners to select recovery. Before active-session or Episode-report checks, an exact top-level owning Conversation's version-2 `provisioning` or `uncertain` entry with incomplete creation returns directly to `## Owner-led creation recovery` in `.prime-claw/workflows/implement-task.md`. If native continuation cannot finish the remaining step, report that constraint; never invent a recovery API. Stop ordinary oversight; do not call `implement_task` recursively or `handoff_task_episode`. Preserve provider, task, code base, host, branch, worktree, durable session, and operation identities unchanged. An absent recorded session is not proof that none exists: inspect native terminal, launch, session, and assignment evidence before continuing. No blind replay or active promotion.

Otherwise use only for this Conversation's active Episode. Version 1 selects retained folder oversight; version 2 selects task-native oversight. Tags never override it.

Version 2 selects its persisted provider only. Absent provider, or Backlog
without revision/evidence, binds grandfathered task ID/path. Backlog with both
fields binds independent task history: `baseRef`/`head` identify code;
40-hex `providerRevision` and `taskEvidence` (Git reference or retained legacy view) identify task history.
Native fields carry the requested outcome and working context, not independent
authority for every recorded choice. The Episode owns content;
the Conversation owns status. Branch-local history stays on its code branches;
independent history uses ignored clones, never the code DAG.

`baseRef` is the starting code commit; `branch` is the Episode branch.
`integrationBranch` is the recorded merge/publication target; only an omitted
old field defaults to `main`. Never retarget a switched owner checkout.

Beads has no `taskPath`. Bind ID, observed `providerRevision`, raw `taskEvidence`,
code `baseRef` and resources. Use `bd context --json`, one `bd dolt pull` and
`bd show TASK-ID --json --long --include-comments`. Preserve native shape/absence;
no force, uncertain retry, raw Dolt writes, normalized mirror or alternate authority.

For retained version 1 folder ownership, require its readable non-empty active specification and plan, accepting `EXECUTION_PLAN.md`, bound to its exact `.prime-claw/legacy-specifications.json` source/digest even without the future source. Keep that pair active through blocking, candidate review, and revision: freeze the specification, not the plan. A missing pair is never live and never switches modes. Use exact operator-authorized version-1 recovery, legacy `handoff_spec_episode`/`finalize_spec_episode`, and no task-native authority.

Use the exceptional `transition_spec_episode_to_task` cutover surface after marker, review, merge, activation, restart, UAT, readiness, and exact heads. Preserve resources; Beads requires historical-head ancestry/clean code. An exact same-binding replay is the only idempotent replay; plan deletion remains a separate reviewed step.

Follow `.prime-claw/workflows/implement-task.md` for preparation/publication; code supplies facts, not policy. Backlog keeps exact-file commits. Beads v1.3.1 uses touched-table/staged-set multi-issue history, not per-issue isolation. Before consequential native mutation, commit or push, review consequences and consult about unauthorized/unclear pending work. Native pending/concurrent changes can prevent a safe operation. Inspect actual task history/publication before claiming status/note durability; exit-zero/local/push success is insufficient. Commit coherent edits ASAP and publish promptly, not at handoff or session end.

### Inspect Backlog committed ticket evidence

For read-only oversight, review, block/resume and terminal judgment, use the
exact `backlog-git` references from the relevant observation or the full commit
OIDs and literal task paths already established at that boundary. Do not infer
a historical revision from a current tip. Bind each reference to the canonical
task ID and the selected repository:

- Branch-local: use the bound code repository and literal repository-relative
  task path. The identity is SHA-256 of UTF-8 `local:` plus the real canonical
  Git common directory. Use the exact observed integration/Episode code commits
  for the comparison in question, not the starting `baseRef` by default.
- Independent: use the already selected task clone (the owner's for owner
  publication/cleanup and the Episode's for handoff). The identity is SHA-256
  of UTF-8 `remote:` plus the selected task remote URL, with trailing whitespace
  removed. Do not expose the URL. Paths are relative to the nested store;
  code heads are not task revisions.

Use the bounded Backlog Git procedure in the project's canonical handoff
workflow. Verify the repository identity, full commit OID and exact literal
regular blob (`git --no-replace-objects --literal-pathspecs ls-tree -z`); verify
its committed header's canonical ID with native Backlog, not the filename.
Stream `git cat-file blob` or a Git diff of the verified blobs (no ext-diff or
textconv) in roughly 4096-byte windows with offsets and incremental UTF-8
decoding. Include the relevant fields and tail; check process exit and byte
count for a complete blob read. Do not dump, copy, or persist ticket snapshots.
A readable reference is not publication proof: retain direct remote/upstream
and selected-ticket publication facts separately from code and retained local
evidence.

Report any missing, mismatched or unreadable evidence at the boundary that
needs it. Do not substitute `HEAD`, tracking tips, index/working files, live
native views, or guessed revisions. An unavailable optional historical
comparison is not a new lifecycle gate. Preserve complete legacy evidence
already supplied by older generations without rewriting or recapturing it.
Keep native CLI reads, edits and readbacks for actual authorized authoring
separate; only the Conversation publishes lifecycle status. Judge semantic
compatibility, scope and readiness here, not by byte equality or a coded gate.

Review one reported slice at a time: check ownership/code/tests/docs and the
exact task/history observations (committed Backlog references or Beads native
views) against the actual request. An unrelated-task descendant alone is
compatible. Judge same-task changes as in-scope clarification or genuine
semantic conflict, authority change, scope expansion, or product decision.
Apply before handoff, blockers, terminals and cleanup; no equality gate or
classifier replaces judgment.

When assigning implementation or independent review, distinguish requested
outcomes and genuine constraints from the proposed approach and claims. Ask
reviewers to assess material supported-path behavior and unnecessary mechanisms,
not enforce every plan detail. A report or finding is evidence, not approval or
an implementation order. Decide each finding against the actual task:

- **Accept and advance** when evidence supports the requested behavior. For
  Beads, `handoff_task_episode` supplies exact previous/current native context to
  the existing Episode LLM. Compatible same-task and unrelated changes continue.
- **Request an in-scope revision** for a concrete material defect, including
  public-path bugs and genuine safety, security or interface failures. Choose a
  targeted fix and verification; do not dismiss real defects as scope creep.
  A mismatch with your proposed approach alone need not be a product defect.
  A false claim may need correction or narrowing, or removal of an unnecessary
  mechanism, rather than construction of the claimed machinery. Record the
  chosen repair and rationale through canonical `handoff_task_episode`; do not
  edit, copy or mirror Episode-owned task content.
- **Pause** when an actual unresolved condition prevents progress, not merely
  to preserve a self-imposed rule.
- **Consult the operator** for a real scope/product decision, missing access,
  merge, abandonment, or cleanup outside task-native authority. Findings do not
  authorize their own repair scope.


Never steer through chat.

The remaining lifecycle and cleanup flow applies only to version 2 task-native ownership. Use ordinary Git and the selected provider's supported native CLI. Do not create lifecycle receipts or replay protocols.

Before merge readiness, verify provider-reported idle completion of the Episode and explicitly proven descendants through Prime Agent list/state responses. Only recursive explicit parent session ID or canonical parent session-file edges prove descendants; require agreement when both exist. CWD/RLM metadata grants no ownership. Active or unprovable-idle sessions block readiness and merge; cleanup independently rechecks before mutation.

Handoff supplies exact task/code and native session list/state observations to both
prompts. For Backlog, use the previous/current independent or integration/Episode
branch-local Git pair; preserve an already-recorded legacy pair unchanged. Judge status, meaningful plan/design, code publication and idle
completion/children/queues here, not in code-level dirt/upstream/ancestry/role-depth
checks. Beads prior may be `blocked`; local revisions/success are not publication
proof. Task-native first delivery uses one `followUp` request with
`queueIfBusy: true` so a heartbeat winning the observation/admission gap can
queue that same request. First admission precedes the factual observation
callback, then one canonical execute follow-up. These two sends and the callback
are not atomic or globally exactly-once. After admission record only native/code
observations; no catch/resend or automatic retry.

### Task-native handoff refusal disposition

This exception applies only to version 2, not retained version-1 handoff or
creation/initial-assignment recovery. Stop after a failed or uncertain result.
Review the exact attempted request, native result, available session/action
observations and relevant supported runtime behavior. Preserve evidence gaps,
including source-versus-running-build limits and any preparation/task-history
effects; first-message refusal does not mean preparation had no effects.
Missing observed actions or empty queues alone do not prove non-admission.

- **Definite first-stage refusal before prompt admission:** reviewed evidence
  must support that conclusion, not merely an error label. Refusal alone grants
  no retry authority. Explain the findings and limits to the operator. Only a
  later explicit informed operator decision may permit ONE canonical
  `handoff_task_episode` re-invocation, by the same exact owner for the unchanged
  provider/task/operation/durable session/worktree/branch, with the original
  accepted scope and focus plus current native task/code/session facts. Re-read
  those facts and bindings before acting. This is an explicit exception to the
  blanket refusal boundary, not a new advance or an inferred approval. Report
  its actual result once; it grants no further retry.
- **Uncertain first admission:** keep delivery uncertain. Do not infer refusal
  from silence, an error, missing actions or empty queues. State exactly which
  available evidence cannot establish admission or non-admission.
- **Callback failure after first admission:** preserve that admitted first
  request and any actual observation effects. Execute was not sent by this
  invocation; do not rerun handoff or invoke execute from that failed chain.
- **Second-stage refusal or uncertainty:** preserve the first admission and
  completed factual callback. Report whether execute was definitely refused or
  remains uncertain; do not replay either stage.

The last three cases have no generic replay permission, even on operator
request under this refusal exception. Inspect missing supported evidence without
sending work, remain paused, or seek a separately authorized normal terminal
disposition. The separate NEW continuation policy below may apply if its
conditions are met; it is not a replay of a refused or uncertain send. Never
invent a safe resend of the old chain, use ordinary handoff/chat steering or
replace resources. Record findings, gaps and disposition in existing native
fields/history and publish normally. Neither exception adds routine permission
to ordinary successful handoffs or authorizes a live historical recovery itself.

### New execute-only continuation after a verified runtime interruption

For the same active version-2 task-native Episode only, use either of these paths:

- The original canonical handoff demonstrably completed; the following execute
  failed or remains historically unproved.
- Both canonical prompts demonstrably reached the exact Episode, but a verified
  model/runtime failure stopped both before task work. Reconcile native history,
  code and observed effects; a bounded report-only coordination turn can confirm
  recovery, the current checkpoint and the next already-authorized step. It is
  neither task steering nor replay. A cleared runtime interruption is not an
  ongoing task blocker. Do not use this path for uncertain delivery or possible
  unaccounted task effects. Idle or an empty queue alone does not qualify.

Preserve exact owner/provider/task, operation, durable session, worktree/branch,
host/placement, original code basis and integration target. Resolve a changed
route through supported native facts to that SAME durable session, never by
name/CWD alone. No allocation or rebinding.

Read the exact published Backlog ticket and relevant committed diffs (or current
published full native Beads task/history) and meaningful living plan,
accepted bounded focus, code/head/publication/worktree facts, available historical
observations and fresh native Episode and explicitly proven descendant
state/actions/queues. Keep complete raw fields, unknown keys, nulls and absence
through existing exact native-entry evidence and meaningful bounded reads, not
giant prompts or an idle boolean. Ordinary handoff capture remains selected-session
only; execute-only capture also retains raw explicitly linked descendants. Saved
descendants without live state keep that state absent. Inspect actual supplied
facts and obtain required current evidence rather than declaring absence idle.
Judge compatible task/plan/history advances semantically, not frozen equality.
Foreign identity, real scope conflict, unsafe current work, missing required
current evidence or unproved current idleness stops. Known pending/running execute
or unfinished admitted work stops. Do not cancel work to qualify. Cancellation,
terminal disposition and scope boundaries stand.

Brief the operator: actual handoff completion or the proven pre-work interruption;
known failed/refused/not-attempted versus
unknown historical execute admission; known callback/partial effects; receiver
report plus fresh native idle/empty-queue facts; current progress, accepted next
scope and remaining uncertainty/possible prior effects. A no-execute/no-pending
receiver report is useful current evidence, not historical non-admission proof.
That reported TASK-2-shaped case can reach the decision without historical sender
IDs, ACKs or callback proof, receipts or impossible proof of absence.
Require explicit informed operator authorization for ONE NEW continuation.
Ordinary conversational authority suffices; honor an already informed decision
without another phase gate, token or syntax ritual. Generic prior “continue”,
model change, compaction, unblock alone, idle, silence or Episode advice is not it.

If genuinely cleared Blocked, first publish truthful clearance and In Progress
through the owner-native procedure below. Already In Progress needs no status
round trip; do not promote Ready or reopen Done. Record decision/focus/current
facts and historical limits in existing owner-appropriate native fields/history.
Do not mirror Episode-owned content or manufacture a send receipt. Verify actual
publication and prepare only the intended Episode provider workspace; preserve
unrelated bytes/index/history. Publication/preparation failure means no send.

After the informed decision, call `handoff_task_episode` once with the exact
`taskId`, `mode: "execute-only"`, and accepted bounded execution focus in
`guidance`. Omit `mode` for the unchanged ordinary chain, never as a substitute
for this new request. Use this mode only on a supporting loaded generation;
otherwise report the concrete interface constraint, not an ad hoc raw execute
workaround or upstream patch. It sends one NEW canonical execute with current
factual context, exact native-entry reference and `<operator-execute-guidance>`.
Native same-durable-session resolution may supply a current route different
from historical ownership; do not guess or manually rebind it. Resume
current durable progress, not stale snapshots or historical side effects. Never
resend handoff/initial assignment, replay historical callback, call ordinary
`ralph_handoff`, re-enter creation/implementation admission, or dispatch from a
hook/heartbeat. No compaction prerequisite or after-handoff compaction trigger.
Compaction is optional context control, never authority.

After definite NEW native admission only, use the existing managed factual-update
mechanism for current provider/task/code observations, not the historical callback
or manual registry edits. Report bounded private-safe native send/stage/correlation
facts separately from factual-update results: requested/admitted (not completed),
refused, not attempted or uncertain. Definite refusal or uncertainty stops this
authorization without optimistic advancement. Factual-update failure, including
possible partial writes, preserves admitted execute and actual effects: inspect
before another transition, never resend or invent rollback. No catch/retry,
automatic retry or late-result restart. Further disposition needs fresh evidence
and a separate informed decision. Keep unknown history unknown; claim neither
retrospective non-delivery nor global exactly-once. Add no store/state machine,
endpoint or classifier. This does not change retained version-1 and
initial-creation recovery. Global activation/restart/UAT and actual historical
case recovery require separate authority and loaded-generation proof.

Only the owning Conversation publishes accepted blockers. Grandfathered Backlog uses exact-task code-DAG commits/pushes. Independent Backlog commits/pushes only the task path to `HEAD:refs/heads/prime-claw/tasks`, leaving code HEAD unchanged; synchronize the Conversation's own clone for publication, while handoff prepares only the Episode clone. Preserve unrelated bytes/index/history. Restore `In Progress` before continuation. Judge status, blocker/clearance notes and compatible advances from the relevant exact Backlog blobs and diffs. Independent status publication can supply `taskHistory.taskEvidence` at `publishedHead` and optional `taskHistory.previousTaskEvidence` at `baseHead`; use the exact branch-local task-only commits for equivalent comparisons. Treat a missing pre-edit checkpoint as unavailable, not a fresh tip or a required approval predicate. Judge eligibility and code publication separately in editable guidance. Record observations after admission.

For Beads, current synchronized native status—not the older ownership observation—governs. Inspect exact bindings, raw task, native history, working set and publication ref under the consequence procedure above. Only current `in_progress` may receive one guarded `--if-status in_progress` status-plus-note update recording truthful blocker evidence and exact unblock condition; push once without force and verify `blocked` status/note inclusion in native history/publication. Already `blocked` is a no-op; other states or uncertainty stop without retry/force/raw writes. Only cleared operator or accepted evidence permits one guarded `--if-status blocked` update with truthful clearance evidence, one non-force `in_progress` publication, then `handoff_task_episode`. Never write `ownership.json` directly in ordinary oversight or keep an artificial `in_progress` snapshot; semantic meaning remains LLM judgment. Only the owning Conversation's targeted documented creation-recovery exception permits an edit: use its current registry lock, compare before editing the unchanged selected entry, preserve other owners, and reread afterwards. Episode/Expert roles gain no exception.

Beads terminals use native/Git; add no public status API, publisher, protocol, or classifier.

For an accepted complete pushed candidate: Grandfathered Backlog sets only the bound integration-branch task to `Ready for Merge`, reloads ID/path/parent/status, verifies and commits one path, pushes, and records `targetHead`; ordinarily merge into the idle Episode, preserving its task content plus authorized status. Independent Backlog publishes the exact Ready status on the disconnected task branch with native/path/direct-remote proofs; `targetHead` stays the pushed code HEAD; synchronize only the intended task workspace without a code merge or other-writer bytes/index absorption. Git blocks every other code conflict; push and prove `candidateHead`. Beads first records current clean pushed canonical code `targetHead` (not a task-status commit), ordinarily integrates it into the idle Episode if needed, and proves exact branch/upstream/remote `candidateHead` and ancestry after push. Then re-prove exact owner/provider/task, current `in_progress`, raw task, history/working-set and publication facts; publish one guarded `--if-status in_progress` status-plus-note update to `ready_for_merge` without force; and prove exact local/remote raw content, revision, ref, and preserved unrelated fields. Show `(taskId, integrationBranch, targetHead, candidateHead)` plus factual native evidence; no provider revision or task equality becomes approval authority.

**Delay** is a strict no-op. **Request Changes** requires an explicit operator choice and recorded in-scope finding. Grandfathered Backlog returns only the bound integration-branch task to `In Progress`, verifies/commits/pushes that path, and uses ordinary `git merge --no-edit currentTargetHead` to refresh the Episode when needed; restore its pre-merge Episode task content, apply only the authorized status, let Git block every other conflict, and push the refreshed candidate. Independent Backlog instead publishes exact `In Progress` status/finding evidence on the task branch, leaves both code heads unchanged, and lets `handoff_task_episode` prepare only the Episode clone and bind current evidence. Beads uses one fresh proof and guarded `--if-status ready_for_merge` update to `in_progress` with a truthful finding note, one non-force push, and exact raw/revision/ref/content proof. Then call `handoff_task_episode` for the same Episode. Never replace resources or retry uncertain transport.

Before **Merge**, re-read ownership and freshly preflight the exact authorized `(taskId, integrationBranch, targetHead, candidateHead)`: recheck provider-reported idle completion; the recorded integration branch in the primary checkout is operation-free, clean, and equals upstream/direct remote/`targetHead`; the exact idle Episode is clean with branch/local/upstream/direct-remote heads at `candidateHead`; and `git merge-base --is-ancestor targetHead candidateHead` succeeds. Backlog must hold its exact task at `Ready for Merge` in both selected stores; independent stores supply exact selected-ticket publication facts, not a whole-clone clean/equal-head gate. Beads must prove exact current `ready_for_merge`, raw task, native history/publication and pending-work consequences, meaningful design, and unchanged owner/resources. Explicit tuple authority alone permits `git merge --ff-only candidateHead`; push the integration branch normally and prove its local/upstream/direct remote equal `candidateHead`. Grandfathered Backlog then publishes its exact task-only `Done` code commit. Independent Backlog publishes `Done` only on `refs/heads/prime-claw/tasks`, proving unchanged code HEAD, then fast-forwards the Episode nested task clone to that exact terminal revision before cleanup. Both use `backlog task edit TASK-ID --status Done`, push without force and verify exact task-history publication/identity/status. Keep the Done task active through `finalize_task_episode`; optional archive is only after merged cleanup. Beads instead publishes one guarded `--if-status ready_for_merge` update to `done` with a truthful final note naming the tuple/code publication, one non-force push, and actual task-history/publication status/note/revision/ref/content evidence. Preserve ownership/resources on failure; never force, replay, or a fresh transaction.

Apply **Abandon** only after explicit operator confirmation of task and pushed Episode head. Grandfathered Backlog on the clean pushed integration branch selects only the bound task file from that Episode head, reapplies its non-`Done` status and truthful Final Summary containing the exact line "Prime Claw abandonment: task TASK-ID; pushed Episode head EPISODE-HEAD; code was not merged." through the supported CLI, archives it, verifies only the active/archive task move and no Episode code, commits, and pushes. Independent Backlog first creates the exact built-in `archive/tasks/` directory inside the nested store when absent, then performs that native summary/archive in the intended primary clone, preserving unrelated work, commits only active/archive paths, non-force-publishes the task ref, proves code HEAD unchanged, and fast-forwards the Episode clone to that archived revision. Beads proves resources/heads/ancestry and current task/design publication. Run `bd close TASK-ID --reason "Prime Claw abandonment: task TASK-ID; pushed Episode head EPISODE-HEAD; code was not merged." --json` once, then non-force-push once. Prove `closed`, reason/time/history/revision/remote ref. Custom `done` means completion; never map `closed` to canonical `Done`, retry uncertainty, or merge abandoned code.

**Cleanup** follows after the operator-authorized terminal outcome is committed, pushed and verified; no second confirmation. Judge task/history/code/publication/runtime facts here, not in TypeScript. Backlog needs active Done for merged work or archived non-`Done` with the exact abandonment Final Summary; Beads needs published `done` with merged code or exact-reason `closed` without merged code. Local revisions/exit-zero/push alone are insufficient. Never delete the integration branch.

Before calling cleanup for Backlog, inspect the proven published terminal ticket
and the relevant exact active/archive path facts using the procedure above.
Verify the Episode workspace facts separately; the cleanup observation does not
prove terminal task publication or report an Episode task-clone publication.

Call cleanup-only `finalize_task_episode` with exact `taskId`, `episodeHead`, and `merged`/`abandoned` outcome. Factual observations return in text/details. Backlog `providerTaskObservation.active` and, on abandonment, `.archived` report `available` with a Git reference, `absent` after a successful empty lookup, or `unavailable` on proof failure. Verify the literal active/archive path and inspect the exact committed content at the observed integration commit (branch-local) or primary task-clone commit (independent). Compare only verified blobs. For independent Backlog, `previousTaskEvidence` is the recorded prior active checkpoint or `unavailable`; report this gap without treating it as a refusal or undoing completed cleanup. Do not infer absence from unavailable evidence or publication from readability. Beads retains raw observations. Independent Backlog removes its Episode clone: inspect local commits/publication without frozen-revision/equal-head/classifier gates. Preserve unrelated primary work and uncommitted resource bytes. Exact identity/collision/ref/head compare-delete and supported idle-runtime safety remain mechanical. Remove owned resources/descendants/upstream, verify absence; cleanup atomically removes only the unchanged owner entry. No lifecycle edit/push/shared-store/server removal/progress store.

Backlog archive is reversible/read-only, reserves the ID, and preserves status/relationships; restore before any edit. Only separately authorized native `backlog task delete TASK-ID` on an archived task permanently deletes it and vacates its identity; it is not archive or ordinary merged cleanup.

On error reread evidence; absence counts as removed. Re-invoke only for safe progress, never blind retry/reconciliation. Busy/changed/foreign resources or uncommitted bytes block removal. Consult only when safe progress is impossible.

Use `prime-claw-expert-review` for useful independent review. Carry the actual
request, genuine limits, current progress and chosen next step through
continuation/compaction. Keep proposed approaches revisable; do not promote old
plans, findings or summaries into stronger requirements on resume.

Maintain a bounded goal, or one exact heartbeat while waiting for Episode/Expert work.

The operator alone decides scope, product, merge, abandonment.
