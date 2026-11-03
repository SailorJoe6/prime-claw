# E. Admit approved work into an Episode

## US-13 — Perform a final implementation-readiness review

**As an operator, I want the exact approved task checked immediately before
Episode creation, so that incomplete or contradictory work creates no
implementation resources.**

The globally discoverable `implement-task` skill routes an approved
conversational request through `implement_task(taskId, host?)`. It binds one
exact canonical task, including selection explicitly delegated within the
operator's bounds. Implementation selection requires `In Planning` (Beads native
`in_planning`) after design and planning, not dependency readiness alone. The
entry resolves native task and placement before its compact-first readiness
workflow; a failed semantic review creates no Episode. Readiness shows the
current named branch and exact code HEAD. Fresh admission uses that branch as
its code basis and records it as the default integration target, without
switching to a differently named default branch.

Markdown owns approval judgment. An explicit conditional instruction to plan
then implement when ready may authorize that sequence within approved scope;
planning alone does not authorize implementation. Preparation and compaction
preserve the operator's instruction, scope, conditional authority, exact task,
and optional stable host. Material ambiguity or new scope requires clarification.
Final `create_task_episode(taskId, host?)` independently resolves concrete native
identity, state, readiness, placement, and ownership; it requires no prior entry
invocation, approval store, or turn receipt.

The five custom workflow command registrations are removed. Thin global entry
skills reuse agent-callable operations and canonical project policy; Prime Agent
built-ins and native `/skill:` remain available. Entry admission means queued
work, not completed compaction, readiness, or creation. End the calling turn and
never retry failed or uncertain admission as fresh allocation.

For retained version-1 compatibility, the discoverable `implement-spec` skill
routes one exact operator-selected `.ralph/plans/future/<slug>` through
`implement_spec(location, host?)` and the project's customizable readiness
policies. It asks when the folder is missing or ambiguous; it never selects a
replacement. Fresh creation still
requires its exact location and frozen `SPECIFICATION.md` bytes to match the
explicit-upgrade grandfathered inventory; its execution plan remains living.
Markdown interprets operator authority, including an explicit conditional
plan-then-implement instruction within scope. Planning alone, entry invocation,
and stored or turn-scoped receipts supply no implementation authority.
Preparation carries the exact location, authority, scope, and optional stable
host through compaction. Final create independently checks current concrete
integrity, placement, ownership, and resources without any prior entry proof.
When the obsolete source folder is absent, exact already-active version-1
ownership is resolved before source lookup and its promoted frozen specification
is verified. Creation then returns only that same Episode with no new execute
assignment, not a new admission.

## US-14 — Create one isolated implementation Episode

**As an owning Conversation, I want approved work admitted into one isolated
Episode, so that implementation occurs against one exact durable authority
outside the canonical checkout.**

The primary `create_task_episode(taskId=..., host=...)` transaction (with optional
stable `id:<setup-id>` host) publishes the exact task's `In Progress` transition,
persists version-2 ownership, and creates one matching Episode only when that
Conversation has no non-terminal ownership and no other owner holds the same
task binding. Grandfathered branch-local Backlog uses a task-only code commit;
its short cross-process lock covers the status edit, exact commit, and
reservation before push/allocation. Independent Backlog and Beads publish through
their native task histories separately from the clean pushed code base. Public
admission replay fails closed rather than returning or duplicating an existing Episode; an
owner inspects or continues that exact Episode through its lifecycle surfaces. A
fresh task-native Episode receives:

- a feature worktree created from exact code `baseRef`: the task status commit
  for grandfathered Backlog, or the unchanged published code base for independent
  Backlog/Beads;
- a recorded `integrationBranch` separate from the isolated Episode `branch`;
  only omitted fields in old version-2 records fall back to `main`;
- no bundle copy or `.ralph/plans` promotion commit;
- a fresh durable Prime Agent session rooted at that worktree;
- a visible writable Orca Prime Agent tab when Orca placement is selected;
- exactly one fixed execute assignment bound to the task ID and carrying the
  originating Conversation's exact registry key; for independent Backlog, a
  clean published descendant refreshes factual task/revision evidence and adds
  complete exact previous/current native views to that same assignment rather
  than treating old raw JSON as approval; and
- durable ownership by that originating Conversation, which the Episode resolves
  by the supplied key rather than its own session ID.

For retained version-1 compatibility, `create_spec_episode(location, host?)`
creates a matching folder Episode only after rechecking the inventory's exact
specification digest. It reloads the current complete bundle and captures its
digest at the concrete create boundary as integrity evidence, not invocation
proof. A carried stable `id:<setup-id>` host is revalidated before mutation;
explicit placement never silently falls back. An already-owned exact Episode replays from persisted
ownership and its promoted frozen specification even when the obsolete future
source is absent; it does not require a task provider. Fresh admission promotes the approved
bundle into active `.ralph/plans` from its captured base and records its
promotion commit before the same fresh-session and one-assignment boundary.
Unrelated task-only main advancement does not invalidate that promotion while
the approved bundle digest and exact worktree binding remain unchanged. Neither schema inherits the
Conversation transcript or receives an initial handoff.

A separately reviewed migration may move that same live retained Episode to
version-2 authority through `transition_spec_episode_to_task`. This is not a
second admission. Before cutover, the owner explicitly authors and publishes
the selected provider-native `In Progress` task, preserves the retained content
and source marker in native fields, and prepares its existing workspace in the
retained Episode. After the bridge and exact native task are reviewed, the code
is merged, globally activated, restarted, and UAT-proven; the exact owner then
supplies reviewed pushed main/Episode heads and explicit confirmation.

The host proves exact reviewed main/upstream identity, no staged or tracked
canonical-main changes, no in-progress merge/rebase/cherry-pick/revert, genuine
code ancestry, the current published provider revision and complete native task
evidence, an idle exact durable session, and unchanged
worktree/branch/Orca resources. Branch-local Backlog retains its committed task
checks. Independent Backlog uses its disconnected published task-history
revision, and Beads uses its published Dolt revision; neither is manufactured
on the code DAG. The original legacy `baseRef` remains code/admission evidence
and need not be a Backlog task-only commit. A Beads target additionally requires
the preserved historical head to be an ancestor of the reviewed Episode head,
so its first normal handoff and cleanup remain usable. After the final provider
proof, the host re-proves exact clean code state immediately before replacement
or replay return. When restart changed only the
ephemeral route, the host additionally requires one sole matching idle durable
session and an absent old route, then binds the verified current route in the
same atomic ownership replacement. That write removes only legacy authority
fields, adds the selected provider's exact task binding and evidence, preserves
the operation and every durable resource, keeps the active pair, and creates no
task, workspace, assignment, provider/code commit, status change, handoff,
finalization, deletion, or cleanup. Only exact replay is idempotent; every
pre-switch failure leaves version-1 authority and recovery unchanged.

## US-15 — Select Episode placement explicitly

**As an operator with multiple Orca setups, I want to choose the exact local
execution setup, so that the plugin never silently runs work somewhere else.**

A sole ready setup may be selected automatically. Multiple setups require a
native picker or an exact stable ID. Cancellation, ambiguity, or remote
selection creates nothing. An explicit host request never silently falls back.

## US-16 — Recover safely from ambiguous Episode creation

**As an operator, I want partially created resources preserved and identified,
so that retries cannot create duplicate worktrees, sessions, or assignments.**

Primary task-native recovery distinguishes exact mutation boundaries. A proven
clean failure after the task status commit but before ownership or resource
mutation commits the exact task back to `In Planning`. Any recorded, partial, or
uncertain ownership/resource mutation instead publishes `Blocked` with exact
recovery evidence; public admission replay fails closed and never creates or
assigns a duplicate Episode.

For retained version-1 compatibility, this Conversation's project-registry ownership entry can be
`provisioning`, `active`, `uncertain`, or `inactive`. Partial provisioning or
allocation preserves exact evidence as `uncertain`; replay does not recreate or
reassign those resources. Direct local fallback exists only after definitive
pre-mutation Orca unavailability with no explicit host request.

## Primary task-native admission

Project reconciliation manages `implement-task-prep` and `implement-task` as
customizable internal policies for the active exact-task admission path. They
encode the `In Planning` structural and semantic readiness gates, the single
`create_task_episode` call boundary, provider-native `In Progress` publication,
a durable provisioning reservation before branch/worktree/session creation,
clean rollback to `In Planning`, and uncertain/partial `Blocked` outcome.

The deterministic admission helper now resolves placement before it
queues either compact-first workflow message. It accepts one exact ready local
Orca setup, selected automatically when sole, by stable ID, or by the native UI
picker. Zero ready setups, remote setup, noninteractive ambiguity, and picker
cancellation fail without task, Git, ownership, or resource mutation. Direct
local fallback exists only when the production Orca command is definitively
absent and never when an explicit setup was requested. Malformed JSON, a
negative inventory envelope, and other inventory failures propagate and fail
closed rather than selecting local execution.

The helper delivers the exact task and optional stable host as operation data,
not private approval. Both canonical messages carry
`<operator-implementation-host>id:<setup-id></operator-implementation-host>` for
selected Orca placement; local fallback is explicit and has no host ID.
The full ordinary oversight guide precedes `implement-task` semantic readiness.
The phase policy interprets actual operator authority, including an explicit
conditional plan-then-implement instruction within scope. Planning alone adds
no implementation authority. There is no task-native approval store, turn
receipt, or separate phase-history proof. Entry success means queued work, not
completed compaction, readiness, or Episode creation, and ends the caller's turn.

The ownership store now accepts either retained version-1 folder identity or
strict version-2 task identity, never a mixture. An internal reservation seam
re-resolves the exact `In Progress` task and meaningful plan, verifies the selected provider's publication, and persists
version-2 `provisioning` ownership before any resource identity exists.
Grandfathered Backlog verifies its exact task-only status commit; independent
Backlog/Beads keep provider revisions and complete native evidence separate from
code `baseRef`. Fresh reservations retain the captured integration branch.

An internal task-native allocator now consumes only that exact reservation. It
derives non-authoritative branch/worktree labels from the task ID, creates the
local or exact reserved Orca worktree from the exact bound code `baseRef`, skips
all bundle copy and promotion-commit behavior, binds one durable exact-CWD
session, and injects the exact task ID into one execute assignment. Internal
owned-resource recovery validates the active worktree plus durable session ID,
file, and CWD, and may reopen that same identity without replaying the
assignment; this is not public admission replay. Partial
`provisioning` or any failed allocation becomes `uncertain` and cannot replay
as fresh work.

The trusted-admission transaction requires the repository root of the primary
Git worktree on a valid named branch. A clean published feature/stack branch or
a default branch with a name other than `main` is valid. Linked worktrees,
detached/unsafe state, and branch drift remain blockers. Capture the current
branch, recheck it with code identity at publication/reservation boundaries, and
allocate from exact `baseRef`; never switch the checkout or substitute a default
branch HEAD. Keep exact task status/plan, owner, placement, and resource checks.
A proven clean pre-ownership/resource failure restores native `In Planning`;
durable or uncertain mutation publishes native `Blocked` with the exact recovery
condition and preserves all evidence. No uncertain admission is retried.

Continuation, blocked handling, review, merge, and terminal cleanup retain the
same integration branch. A switched owner checkout blocks rather than rebinding
or allocating again; normal advancement on the same target follows existing
ancestry/publication rules. Operator merge/abandonment authority and idle checks
remain unchanged. Cleanup removes only the Episode branch, not its target.
The [second-slice evidence](../evidence/primeclaw-48-target-aware-lifecycle-20261103.md)
records candidate validation separately from live UAT and whole-task completion.

The `implement-task` skill, `implement_task` entry tool, and
`create_task_episode` expose this task-native path. Final create is
self-contained: it re-resolves the current provider, exact canonical task/root/
Backlog path and valid native status/plan, then resolves placement before
mutation. An optional stable host is revalidated, never silently substituted;
without one, the existing sole-ready/picker/definitive-unavailability rules apply.
It accepts no arbitrary root, path, worktree, session, or engine identity and
requires no earlier entry invocation as approval proof. Concrete ownership and
resource checks still refuse duplicate admission. Retained version-1
compatibility folder Episode creation remains available through the retained
entry and self-contained creation boundary above, with its integrity and exact
active-replay checks preserved.

## Invocation cutover safety

The interface change does not migrate or retire retained workflows, change
ownership, delete plans, or recreate resources. Preserve stable customizable
phase IDs and supported old-layout handoff/execute fallback. Later live refresh
requires separately authorized accepted-main apply, one coordinated full
restart, and resumed owner/Episode plus ordinary-session UAT. Keep resources the
old generation may read until proof succeeds. Copy success, `/reload`, and a
fresh probe alone are not cutover proof; candidate validation is not activation.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/reviewed-plan.ts`
- `src/prime-agent-plugin/skills/implement-task/SKILL.md` (global task entry guidance)
- `src/prime-agent-plugin/skills/implement-spec/SKILL.md` (global retained-folder entry guidance)
- `src/prime-agent-plugin/extension-support/spec-episode.ts` (retained allocator plus public task-native admission transaction)
- `src/prime-agent-plugin/extension-support/episode-ownership.ts`
- `src/prime-agent-plugin/extension-support/task-episode-ownership.ts` (task-native reservation foundation)
- `src/prime-agent-plugin/workflows/implement-prep.md`
- `src/prime-agent-plugin/workflows/implement-spec.md`
- `src/prime-agent-plugin/workflows/implement-task-prep.md` (task-native policy)
- `src/prime-agent-plugin/workflows/implement-task.md` (task-native policy)

## Design references

- [`future-specification-bundles.md`](../future-specification-bundles.md)
- [`conversation-driven-episode-oversight.md`](../conversation-driven-episode-oversight.md)
- [`prep-chain.md`](../prep-chain.md)
