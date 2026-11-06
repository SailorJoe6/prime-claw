# Backlog.md dependency and build

Prime Claw pins Backlog.md as the Git submodule at `deps/backlog`. The
PRIMECLAW-45 implementation candidate uses the unmodified upstream release from
`MrLesk/Backlog.md`. The accepted host artifact remains v1.53.0 until a separate
reviewed cutover; a candidate source-pin update does not activate it.

Ordinary continuation likewise uses editable handoff/execute/oversight policy,
not status/design/code-clean/upstream/ancestry approval in code. Both prompts
receive complete native task/code/session facts. Coherent ticket edits commit
ASAP and publish promptly: literal selected-file Backlog commits in both
supported topologies, code separately; Beads consequence review BEFORE native
mutation/commit/push and actual task-history/publication inclusion checks.
See [handoff mechanics](handoff-chain.md) and the editable implementation/oversight
guidance for current continuation and terminal decisions. The bounded existing-
operation continuation is documented below. Old task-native capability,
cleanliness and rollback details below are historical, not instructions to restore removed code policy.

## Requested creation and failure decisions

Task-native create performs the caller-requested In Progress native operation,
then reserves and allocates the exact task resources. It does not independently
judge lifecycle status, plan/design, code-base suitability, whole-checkout dirt,
or compatible changing native views. Existing implementation Markdown owns those
decisions. Native failures and exact resource/identity mismatches still report
truthfully. On failure, native task state and existing ownership/resources remain;
code no longer chooses In Planning rollback versus Blocked publication. The owning
Conversation inspects current task/history/resource/session/assignment facts and
chooses any supported status/note publication through editable guidance. Backlog
remains selected-file-only; Beads retains approved multi-issue commit consequences
and actual push/local-versus-task-publication limits. The one initial execute and
both continuation observation channels remain unchanged.

Task-native creation, allocation and blocked-workflow selection do not approve
Conversation responsibility from RLM depth. Blocked selection does not approve
a literal `main` branch label either. The existing editable implementation and
blocked guidance decides role, code basis and lifecycle authority. Exact
persisted owner/session/task/provider/root and requested resource bindings still
apply; neither a child nor an Expert acquires another owner's authority. This
changes no retained version-1 role, transition, or cleanup behavior. Bounded
same-operation continuation for an allocated independent Backlog/Orca worktree is
supported through `create_task_episode` with its exact `operationId` and optional
selected `sessionId`; see the final section. Its disposable regression evidence
does not prove live recovery or historical assignment delivery. Broader partial
shapes and unavailable session routes remain explicit limits.

## Current bounded candidate release

- release: `v1.55.3`
- exact release-tag and source commit: `0cf4fdbc70020327f4366a29d3f405f83d180301`
- source: `https://github.com/MrLesk/Backlog.md`
- Backlog build/smoke tool: Bun `1.4.4`

The candidate is unmodified upstream. Do not replay the three v1.53.0 downstream
restore/dependency patches. Builds require exact HEAD and exact release-tag
resolution/ancestry; tracked source changes refuse before compilation. Image
labels and runtime build stamps bind the same version and commit.

PRIMECLAW-45 supersedes the prior fork-only dependency policy: native archived
and draft dependency targets are supported, archived IDs remain reserved, and
existing duplicate IDs must be resolved separately before migration. The old
fork source `431e95612d6167e418c507ec206d95df43c38c54` and its results remain
historical evidence in
[`primeclaw44-integration-20261030.md`](evidence/primeclaw44-integration-20261030.md).
They are not patches to port to this release.

**Slice boundary:** this source/build candidate is not an accepted integrated
upgrade. Provider migration, lifecycle guidance and the remaining compatibility
and validation work in PRIMECLAW-45 must finish before activation. The lifecycle
sections below have not yet all been converted from the accepted v1.53.0 flow.
Do not use them to operate a v1.55.3 candidate on live task history. No required
validation is waived by delivering a build-only slice. Source/build results and
limits are recorded in
[`primeclaw45-upstream-candidate-20261106.md`](evidence/primeclaw45-upstream-candidate-20261106.md).

Clone this repository with `git clone --recurse-submodules`, or initialize an
existing checkout with `git submodule update --init --recursive`.

## Host artifact

Build and run upstream's compiled-binary smoke path:

```sh
scripts/build-backlog.sh
```

The script requires Bun `1.4.4`, verifies the exact unmodified upstream commit
and release tag, runs `bun install --frozen-lockfile`, compiles the
version-stamped standalone binary, and runs `scripts/smoke-compiled-build.ts`. The resulting candidate is
`deps/backlog/dist/backlog`. Bun is required to build and smoke-test it, but the
compiled artifact does not require Bun at runtime.

The operator-owned cutover later copies the accepted host artifact to
`~/.local/bin/backlog`. Do not activate a candidate globally from an Episode.

## Sandbox artifact

`bin/prime-claw build` supplies `deps/backlog` to `docker/runtime.Dockerfile` as
the named `backlog_source` context. The image build verifies required source
inputs, performs the same frozen install and upstream smoke path, and installs a
native-platform Linux standalone binary at `/usr/local/bin/backlog`. Image
labels and the build stamp record the release and commit.

The Backlog builders pin Bun `1.4.4`, matching upstream's documented/CI-selected
toolchain. They use its native-platform standalone build, without the unchecked
cross-target runtime download rejected by upstream. The separate gbrain
integration-test toolchain in `config/test-artifacts.lock.json` is unchanged.
The build uses the vendored source. It does not install an npm package, download
an upstream prebuilt binary, or require Bun to execute
`backlog`. The Tier-1 image performs the same exact source/ancestry/smoke proof
in an isolated build stage and copies only the standalone binary into its slim
runtime stage; Bun is not retained in that image.

## Plugin task-resolution seam

Prime Claw plugin lifecycle code resolves an explicitly selected task through
the supported structured command:

```sh
backlog task view --json -- TASK-ID
```

The narrow resolver binds the canonical ID, current status, optional
Implementation Plan, and CLI-returned task path. It verifies that the path is a
contained regular file. It does not read or parse task Markdown and does not
introduce a second task model. The `--` boundary lets Backlog own supported task
ID normalization without allowing an ID to become a command option.

## Primary task-native lifecycle

Specification authoring is provider-native. `/skill:design` and `/skill:spec-it-out`
select only the repository's sole valid live provider, then create exactly one
native task with explicit `In Design` status or revise only one exact
operator-selected task already in `In Design`. Backlog uses Description, native
Acceptance Criteria, References, and Documentation and publishes an exact
task-only Git commit. Beads uses raw `description` and acceptance criteria,
preserves material reference/documentation meaning in ordinary specification
prose, and performs a guarded native update plus one Dolt publication with raw
reread, revision/ref, and clean-working-set proof. A successful Beads create
binds only its exact returned canonical ID; uncertain creation never permits a
second create. Both paths preserve every unrelated native field, reject later
states before mutation, keep a living specification, and stop for operator
review without writing a plan or authorizing an Episode.

### Independent Backlog publication and parent code

Task-only authoring and lifecycle status publication use the intended independent
clone, not the parent code index. Inspect current selected-task/history facts,
synchronize and reread that workspace before a write, and incorporate compatible
changes. Unrelated dirt or descendants are not whole-clone cleanliness or frozen
head prerequisites. Verify the intended selected-task delta; commit only its
literal path, push once without force, and inspect actual direct publication.
Preserve unrelated bytes, staging, history and parent code. Never stash, reset,
clean, absorb or sync another writer's work merely to publish the task.

Editable guidance decides code-basis suitability before admission and any failure
disposition afterward. Code supplies native effects and exact ownership/resource
facts, not automatic In Planning rollback or Blocked publication. A partial
operation retains its exact resources; uncertain delivery never permits another
assignment or fresh creation. Actual native conflicts and unavailable selected
history need factual recovery, not automatic reconciliation or a dependency patch.
Independent task-only failure reporting does not require clean or pushed parent
code. These source behaviors do not imply live activation.

The global `plan` skill and `plan_task({"taskId":"TASK-ID"})` tool resolve
one exact task through the live native provider and admit it only in canonical
`In Design` or `In Planning`. They preload the project-customizable
`plan-task-prep` and `plan-task` workflows, bind the exact provider/project root
(and a task path only for Backlog) into both messages, request focused
compaction on a best-effort basis, queue the semantic planning turn as the sole
follow-up. A planning-only request stops for review without authorizing
implementation. Explicit conditional plan-then-implement authority may continue
within scope after readiness, without fresh approval solely because planning
finished. Backlog preserves its
meaningful native Implementation Plan, exact task-only commit, and prompt push.
Beads uses the complete raw task view and raw `design` as the living plan,
publishes one guarded `in_planning` transition plus design update through the
supported native CLI, and proves the exact provider revision, publication ref,
raw reread, and clean working set without a task path or mirror. Compatible
same-task refinements are factual LLM context rather than an approval lock.

The global `implement-task` skill invokes `implement_task(taskId, host?)` for
authorized implementation. Explicit delegated selection stays within bounds and
binds an exact canonical ID before task-specific operations. Implementation
requires existing `In Planning` after design/planning, not dependency readiness
alone or a separate phase-history proof. It resolves one exact `In Planning` task through the live
provider and preselects placement before it queues the compact-first readiness
turn. Backlog retains its exact returned task path and native Implementation
Plan. Beads retains the exact canonical ID, project root, complete raw native
view, raw design, and native `in_planning` plus canonical `In Planning` status;
it never invents a task path or normalized task model. Semantic readiness stays
in the managed `implement-task` workflow. Backlog runs ordinary `prepare`;
Beads performs the same repository-orientation reads while skipping the
Backlog-only queue inventory so preparation cannot select or mix providers.

`create_task_episode` performs the caller-requested native In Progress mutation,
then reserves and allocates exact selected resources. Existing editable readiness
guidance owns lifecycle, plan/design, selected-ticket publication and code-basis
judgments; code does not repeat them. Backlog uses literal selected-file commits;
Beads returns actual native mutation/push/working-set facts, not fabricated task
publication proof. One fixed execute assignment carries the complete existing
native observations. Errors retain actual completed-operation and ownership facts;
no exception-selected In Planning rollback, Blocked publication, recovery commit,
push or evidence advancement occurs. The owner decides disposition. Explicit
initialization/migration and retained-folder behavior remain separate.

The resulting Episode uses the exact task as its sole durable authority, skips
bundle copy and promotion, and leaves every later lifecycle status transition
to the owning Conversation. Continuation uses `handoff_task_episode`. Review,
status changes, merge, and abandonment use prompt instructions, ordinary Git,
and the selected provider's supported native CLI. Before merge readiness the Conversation verifies
provider-reported idle completion of the exact Episode and explicitly proven
descendants; active or unprovably idle work refuses readiness. After the
operator-authorized terminal outcome is committed and pushed, the Conversation
automatically calls cleanup-only `finalize_task_episode` without separate
cleanup confirmation, retaining exact `taskId`, terminal `episodeHead`, and
truthful `outcome`. It interprets errors and re-reads current ownership,
provider, Git, and selected-provider evidence before any safe re-invocation. The tool
remains the exact-resource boundary, not a coordinator or retry loop.

## Retained version-1 compatibility

The generic plugin keeps only explicitly grandfathered future folders available
through the `plan-spec`/`implement-spec` skills, `plan_spec`/`implement_spec`
operations, and their existing folder ownership mechanics. The first explicit initialization/upgrade records exact unfinished
locations and SHA-256 digests of accepted specification bytes in
`.prime-claw/legacy-specifications.json`. Startup and repeated reconciliation
verify that one allowlist but never enroll a later folder or rebaseline a
changed specification. Archive-only and inactive history are not reminders.

Grandfathered specifications are frozen while their plans remain living. Fresh
planning/admission rejects new or revised legacy specifications and routes new
work to the selected provider. Existing version-1 Episodes remain entirely
provider-independent: their promoted active or blocked specification is checked
against the allowlist, the original future source may be absent, and handoff,
review, blocked recovery, and bookkeeping finalization preserve the same
ownership and resources. These procedures are documented in
[`future-specification-bundles.md`](future-specification-bundles.md); they are
not the authority for a task-native Episode, and this builder repository no
longer stores a local `.ralph/plans` tree.

This repository's ordered statuses are configured in `backlog/config.yml` as
`In Design`, `In Planning`, `In Progress`, `Blocked`, `Ready for Merge`, and
terminal `Done`. New ordinary tasks default to `In Design`. The completed
one-time migration removed active `To Do` only after every former item was
classified from its native Implementation Plan while preserving stronger
states, IDs, and parents.

## Provider discovery and capability seam

`extension-support/task-providers.ts` is the narrow deterministic seam for the
selectable task-provider contract (PRIMECLAW-43). It selects exactly one live
provider per repository from native store evidence; there is no
provider-selection file or shadow record:

- valid Backlog evidence follows native configuration discovery: a root
  `backlog.config.yml` with `project_name` takes precedence (and may select an
  existing custom directory), otherwise `backlog/config.yml|yaml` or
  `.backlog/config.yml|yaml` selects that built-in store;
- valid Beads evidence is a `.beads/` store with a coherent Dolt
  `metadata.json` and `config.yaml`; the effective `no-db` mode is read
  natively (`bd config get no-db`) once store evidence exists, and enabled or
  unreadable/uncertain mode blocks because `.beads/issues.jsonl` is export
  data, never live authority. Export-only residue (a `.beads/` directory
  without `config.yaml` and `metadata.json`) is ignored, not malformed;
- malformed or uncertain evidence blocks with exact remediation, simultaneous
  Backlog and Beads evidence blocks as an incomplete migration, and no live
  evidence returns `none` so initialization can default to `.backlog/` unless
  the operator explicitly selects a supported Beads store.

One direct discovery branch supports a registered Git linked worktree whose
canonical primary checkout owns that Beads authority. From the linked cwd it
first reads native `bd context --json`, then independently proves the exact
linked root, real `.git` file, per-worktree gitdir, common directory, registered
worktree pair, and canonical primary root through ordinary Git metadata. The
context must identify schema 1, Dolt, the linked cwd, `is_worktree: true`, no
redirect, and the exact primary root/store/database/mode. The primary `.beads`
store must then pass the same real, readable, non-symlink, contained
`metadata.json`/`config.yaml` and native `no-db` checks used by primary-checkout
discovery. Capability status reads and the eventual exact `bd show` run from
the linked cwd against that proven primary store. Missing, forged, foreign,
redirected, stale, or ambiguous context blocks before any task read or mutation
with recovery instructions; Prime Claw never copies, links, initializes, or
persists a second workspace store. Primary-checkout Beads discovery and all
Backlog branches remain unchanged.

`checkBacklogCapabilities` proves the pinned managed `backlog` executable
responds and the resolved configuration carries the exact ordered lifecycle
statuses before any task mutation. `checkBeadsCapabilities` proves the `bd`
executable responds and `bd statuses --json` maps every canonical lifecycle
state to an exact custom or built-in status with the required readiness
category (`in_design:active`, `in_planning:active`, built-in `in_progress` and
`blocked`, `ready_for_merge:wip`, `done:done`). The build pipeline pins and
smoke-checks the exact Backlog version; these runtime gates are behavioral
capability checks, not version assertions.

The exact provider-aware task-resolution call sites (`plan_task` admission,
`implement_task`, task Episode creation, ownership reservation, and
transition) resolve through `resolveProviderTask`, which returns a
discriminated native result: the Backlog branch is the existing
`BacklogTaskSelection` plus provider identity, and the Beads branch is the
validated complete native `bd show --json --long --include-comments` issue
view (no task file, path, normalized plan, or references are invented).
Detection plus the capability gate run first; none, dual, malformed, or
unavailable evidence fails closed, and Beads statuses map onto the canonical
lifecycle only at the use boundary with unmapped statuses refused. Planning
uses that discriminated result directly and carries the exact provider/root
binding into both managed messages. Backlog-only compatibility call sites may
still narrow through `requireBacklogTaskSelection`; a Backlog repository's
behavior is unchanged.

The Conversation task-admission status transition mutates through
`mutateProviderTaskStatus`. It proves exact provider/task identity BEFORE any
write: the task is resolved natively first and the raw requested ID must equal
the provider's canonical ID exactly, so a Beads shorthand that resolves to a
longer canonical ID rejects with zero writes. Only then does the native
mutation run (`backlog task edit --status`; `bd update --status` with the
mapped status), followed by a native re-read proving the exact task reached
the exact target status.

Project initialization (`initialize_prime_claw` reconcile) guarantees exactly
one live provider: with no live evidence it runs the real pinned managed
`backlog init <repo-basename> --defaults --backlog-dir .backlog
--config-location folder --integration-mode none` once, then establishes the
exact ordered canonical lifecycle (`statuses:` + `default_status:`) in the
native folder configuration — upstream hardcodes generic statuses and
`backlog config set` exposes no `statuses` key, so the supported native
configuration-file update is the only non-interactive surface — and proves the
store lifecycle-ready through the existing capability gate. Explicit
reconciliation preserves existing Backlog tasks/configuration/history and can
normalize a default dedicated `backlog/` to `.backlog/`; native-selected custom
stores stay in place. Existing Beads is not reconfigured or migrated by setup.
Startup and ordinary preparation remain non-adopting. Dual, malformed, or
uncertain evidence blocks with exact remediation; only a separately confirmed
one-way migration may treat Beads/Backlog coexistence as source/destination.
A blocked or failed provider setup counts as a reconcile conflict and surfaces
its exact detail/remediation in tool and startup summaries without failing
asset reconciliation.

### Task-history workspace foundation (slice 2A)

`extension-support/task-history-workspace.ts` is the direct, Backlog-specific
ordinary-Git preparation seam for the provider-native workspace. The selected
repository **remote** is the task-history authority, and the canonical primary
checkout is never switched, staged, or written:

- **Remote selection** (`selectTaskHistoryRemote`): the canonical primary code
  branch's upstream wins; otherwise the sole repository remote. The selection
  carries the remote's transport URL. Ambiguous remotes block. With no remote,
  ordinary preparation blocks unless the operator explicitly selects
  `unpublishedLocalOnly`; that bounded route creates one clean independent
  nested repository with no remotes, labels it unpublished, and never treats it
  as admission, terminal-publication, or cleanup proof.
- **Direct remote evidence is authoritative** (`ensureTaskHistoryBranch`): the
  exact task ref is read with `git ls-remote --heads <transport>
  refs/heads/prime-claw/tasks` and parsed as either absent or one well-formed
  OID/ref line — a cached remote-tracking ref is never authority on its own.
  When the direct response says ABSENT, any stale cached ref is removed and a
  local branch is treated as unpublished (`local-ahead`, blocked). When present,
  the exact ref is fetched (result-checked) and the refreshed local ref must
  EQUAL the direct OID; a failed refresh or a direct/fetched mismatch blocks.
  An unreachable remote fails closed (`remote-unavailable`), never deciding on
  stale or absent evidence. An existing published branch is verified and adopted
  locally by tracking; a clean descendant may fast-forward the unused local task
  ref with compare-and-swap, while local-ahead or divergent history blocks
  (`remote-advanced`, never force); shared code ancestry blocks. A new disconnected history is bootstrapped in a
  disposable temporary ordinary-Git repository and published with an ordinary
  non-force push, then proven from a fresh fetch. The primary checkout's branch,
  index, worktree, and untracked files are byte-for-byte unchanged by bootstrap.
- **Lifecycle-ready bootstrap publication**: the bootstrap commits both
  `TASKS.md` and a full canonical `config.yml` (the exact six ordered lifecycle
  statuses, default `In Design`, `auto_commit: false`) to the task-history
  branch. The store is therefore lifecycle-ready from the first published
  commit; the seam never returns `prepared` with an untracked, unpublished, or
  non-lifecycle-ready local config write.
- **Nested clone from the remote URL** (`prepareTaskHistoryWorkspace`): the
  primary checkout's ignored, independent nested Backlog clone is cloned from
  the selected remote's transport URL — never the primary filesystem path —
  onto the published task branch, at the validated selected in-repository
  task-store location. The default with no live provider evidence is `.backlog/`
  (never `backlog/`); selected `backlog/`, `.backlog/`, and safe relative custom
  stores are preserved.
  An existing nested clone is verified exactly — remote name AND canonical URL,
  branch, and head — never recreated. In this ordinary non-adopting preparer,
  an existing non-empty store without `.git` blocks before mutation and leaves
  content untouched. Explicit preserving initialization now handles adoption;
  it is not deferred and is not triggered by ordinary preparation. The clone's cached diff against the
  published head is empty and its `git status` is clean — the published tree is
  materialized and tracked, never staged for deletion, with no uncommitted or
  unpublished config. No submodules, linked nested worktrees, alternate
  indexes, same-root custom Git work trees, separate hosted repo, or
  coordinator.
- **Containment before mutation**: the store target is proven at a safe relative
  path inside the canonical primary root and no path component (target or ancestor) may be
  a symlink; a symlinked store or escape blocks before any branch or store
  mutation.
- **Ignore proven with native Git**: the store is ignored by appending a final
  anchored rule only when absent; an explicit negation (`!/.backlog/`) or any
  ineffective result blocks with exact remediation. `git check-ignore` must
  succeed so an ordinary `git add .` can never stage the nested repository as a
  forbidden gitlink.
- **Root configuration is relocated without task-data cutover**: the exact root
  configuration is first validated natively in a disposable fixture so its
  source bytes cannot be normalized. A proven-empty native directory skeleton
  may then be replaced by the independent clone. Built-in layouts publish the
  equivalent folder `config.yml` without the root-only `backlog_directory` key
  and remove the old root file. An explicitly retained custom layout publishes
  the exact config in the selected custom store and replaces
  `backlog.config.yml` with one exact relative symlink into that clone. The
  result is reread natively, kept clean, and returned with a brittleness warning.
  In this ordinary preparer, live task content, conflicting published config,
  absolute/alternate symlinks, escapes or semantic drift block. Explicit
  initialization uses the separate existing-store preservation path described
  below; it does not require an extra preservation approval.
- **Effective native configuration proven on every path**: after the nested
  store is materialized or verified, its effective Backlog configuration is
  validated from the canonical primary root on every path — regardless of the
  pre-clone provider detection result and regardless of whether the branch was
  newly bootstrapped or pre-existing. The existing capability gate
  (`checkBacklogCapabilities`) proves the exact ordered canonical lifecycle;
  `backlog config get defaultStatus` proves the effective default is exactly
  `In Design`; and `backlog config get autoCommit` proves code-repository
  auto-commit is disabled. These are the managed native CLI reads, never
  `config set` or a custom byte parse. An incompatible published remote config
  (generic three-status/default-To-Do, or native-valid `auto_commit : true`)
  blocks with exact remediation and is never rewritten or silently repaired —
  remote mutation remains deferred.
- **Native reads precede the cleanliness proof**: native `backlog config get`
  can normalize a minimal `config.yml` in place, so the nested clone's clean
  `git status` and published-HEAD equality are proven AFTER those reads — any
  native normalization or write blocks instead of being certified clean. The
  canonical bootstrap publishes every default key so native reads never dirty
  it.

This foundation serves only the canonical primary checkout (a linked worktree
blocks with exact remediation). The later sections below connect Episode
preparation, exact mutation/publication, version-2 ownership, handoff, and
cleanup. Beads transport and task-data migration remain distinct work.

## Project task workflow

Backlog.md is the repository's sole active task tracker. Until the accepted host
artifact is activated, use the repository-built candidate at
`deps/backlog/dist/backlog`; after activation, the same commands use `backlog`
from `PATH`.

```sh
backlog task list --status "In Design" --status "In Planning" --ready --plain
backlog task view --json -- PRIMECLAW-35
backlog task create "Follow-up title" --status "In Design" --description "Outcome and context" --type task --priority P2 --plain
```

The explicit filters expose the current authoring and planning queues without
selecting the retained legacy migration state. `--ready` alone can include tasks
whose lifecycle status does not match the phase being entered.
New ordinary work should continue to pass `--status "In Design"` explicitly so
the intended authoring state is visible even though it is now the project default.

Use `/skill:design` or `/skill:spec-it-out` for specification authoring, the `plan`
skill with `plan_task` for native planning, and `implement-task` with
`implement_task` for authorized admission. The five custom workflow commands are
removed; Prime Agent built-ins and native `/skill:` remain. There is
no generic claim edit: implementation admission and later `Blocked`, resumed
`In Progress`, and terminal `Done` transitions remain explicit Conversation
work through the supported Backlog CLI. `backlog task complete` is reserved for
explicit one-time history cleanup, not ordinary Episode completion.

For an explicitly approved history migration, `backlog task restore TASK-ID`
moves that exact record from `backlog/completed/` back to active task storage
without changing its ID, parent, content, filename, or terminal status. It does
not reopen the task: apply intended changes through normal `task edit`, validate
them, and only then use `task complete` to return the record to completed
storage.

Use the CLI for every task mutation. Do not edit task Markdown directly. The
tracked `backlog/` directory is canonical task state, while normal repository
instructions retain Git commit, pull, and push authority. Durable repository
knowledge belongs in the existing tracked documentation rather than a
tracker-specific memory command.

## Slice 2B: Episode-worktree workspace preparation and guarded nested-store cleanup

Direct ordinary-Git/Backlog seams for one canonical primary checkout plus one
exact target linked Episode code worktree, added to
`src/prime-agent-plugin/extension-support/task-history-workspace.ts`. This is
Git identity/containment and ordinary clone/cleanup only — no ownership
fields, no lifecycle wiring, no per-task mutation loop.

### `prepareEpisodeTaskHistoryWorkspace({ primaryRoot, targetWorktree })`

This operation targets the exact registered linked Episode worktree and derives
the native store location and selected remote from primary metadata, without
preparing or synchronizing the primary task clone. A missing target store is
cloned from that remote. An existing target retains its own unrelated work;
explicit native fetch/fast-forward results are returned without requiring a
clean whole checkout, a stable paired remote head, or lifecycle/default-status
configuration approval.

The ordinary nested clone, configured store, exact remote/ref and containment
checks address the requested resource. Preparation does not overwrite a foreign
store or another provider. Native failures are returned as facts; the invoking
Agent decides publication readiness and any real conflict through editable
implementation guidance. Initialization and the separate cleanup seam below are
not changed by this extraction.

### `cleanupEpisodeTaskHistoryStore({ primaryRoot, targetWorktree })`

The exact nested-clone removal derives the selected location without preparing,
fetching or synchronizing the primary. It retains native target authority,
independent Git identity, exact sole remote/URL/branch, containment and protection
against discarding uncommitted/ordinary or ignored untracked bytes. It no longer
requires a live remote, equal local/remote heads, prior-revision ancestry, or a
local-ahead/remote-advanced classifier. The owner judges publication/history
compatibility before requesting removal. No primary bytes/index/ref are changed;
only the exact requested clone is removed. Native failures retain their facts,
including potentially partial directory removal. Explicit initialization and
retained/migration publication proofs remain separate.
### Boundary

Out of scope for 2B: the per-task fetch/reconcile/native-mutate/commit/push
loop, actual Episode admission/finalization/cleanup wiring, Beads server/Dolt
transport, provider-neutral framework, ownership/receipt fields, lifecycle UX
routing, migration/cutover, PRIMECLAW-43.1, and changes to the accepted
non-empty-folder-store ordering.


## Exact Backlog task mutation and direct publication

`publishTaskHistoryMutation({ primaryRoot, targetWorktree, taskId, edits,
commitMessage? })` performs a native exact-task read/edit/reread in the intended
independent primary or Episode clone. `publishEpisodeTaskHistoryMutation` remains
an alias. Native task ID/path and requested clone/ref are exact operation targets,
not a status, meaningful-plan, clean-checkout or frozen-content approval.

The operation uses an exact-path ordinary Git commit and one non-force
`HEAD:refs/heads/prime-claw/tasks` push. Unrelated staged entries, unstaged files
and untracked files are not included or reset. It returns complete native task
views, the exact task diff, observed heads and native Git results. It does not
fetch/merge/retry on rejection, classify same-task versus other-task remote
changes, or wait for matching whole-branch observations. A successful push and a
newer remote observation are both reported without treating inequality as a
semantic veto. Failed native commands preserve available local work/evidence.

The Agent following editable implementation guidance inspects authorized task
changes and history before requesting mutation. It ensures the selected coherent
ticket is committed and published before an Episode needs it, commits promptly,
and decides a real conflict or compatible in-scope reconciliation. Command
success alone does not grant lifecycle authority or permission to absorb another
Conversation's work. No automatic retry, force, reset or replacement allocation
is supplied by this helper.

## Independent Backlog production lifecycle connection

Explicit production initialization supplies
`prepareExistingBacklogTaskHistoryWorkspace`. It preserves existing native
Backlog data and full configuration while establishing independent task history.
Only a default dedicated `backlog/` relocates to `.backlog/`; an existing hidden
store or native-selected custom store stays in place. It may commit/publish
the task-history DAG and stage exact original task-path deletions in the code
index, but does not commit the code branch or template assets. An explicitly
chosen unpublished local-only history is allowed only when there is no remote.
Startup and ordinary preparation still use non-adopting
`prepareTaskHistoryWorkspace`: they verify an existing independent clone or
create a new one when appropriate, and never silently adopt/move populated
branch-local layouts. Grandfathered task ownership is not automatically replaced.

Task admission selects the topology with Git evidence. A task path already
tracked by the code repository keeps the existing one-path code commit flow. An
untracked path in a prepared independent store publishes `In Progress` with
`publishTaskHistoryMutation` from the primary nested clone. Canonical code must
be operation-free, clean, and equal to upstream before and after that task-only
publication. Version-2 ownership then binds the clean code `baseRef` separately
from the published 40-hex `providerRevision` and complete native task view. The
older provider-absent and explicit Backlog shapes without revision/evidence
continue to parse and run unchanged.

After the registered Episode code worktree exists, allocation prepares its
independent nested clone before creating a session, Orca automation, or execute
delivery. It requires the exact reserved task ID/path, current `In Progress`
status, meaningful plan, clean published descendant history, and unchanged
resource identity. A prior/current raw-task difference is factual context, not
an approval gate: allocation refreshes the ownership revision/evidence and
appends the complete exact previous/current native views and revisions to the
initial canonical execute assignment through the same provider-observation
block used by handoff. Status, identity, removed-plan, ancestry, publication,
and cleanliness failures still stop before assignment. The handoff boundary
later applies the same factual-observation rule, proves descendant/directly
published history in both stores, refreshes any idle durable session route, and
records only current provider revision, native evidence, code head, and time
after the first handoff message is admitted.

Conversation and Episode workflow policy preserves two Backlog modes.
Grandfathered mode keeps task commits in the code DAG. Independent mode performs
supported native edits in the selected nested clone, commits only task paths,
and pushes `HEAD:refs/heads/prime-claw/tasks` without force; code and task heads
are reported separately. Lifecycle status stays Conversation-owned. No public
tracker/status API, normalized task model, sidecar, receipt, force update, or
raw task-file write is added.

Cleanup-only finalization returns full current native task/code/history/resource
observations for the owner; it does not approve terminal status/design, code
ancestry/publication, primary cleanliness or stable provider heads. The editable
oversight skill requires the operator-authorized merged/abandoned outcome and
native Done/archive or Beads done/closed history/publication evidence before the
call. Ordinary primary dirt and compatible descendants remain facts, not gates.
Backlog archives are returned as complete native Git command results, not a
reparsed normalized summary or exact-phrase classifier. Beads uses one native
transport/task observation, not paired publication/ancestry approval.

Independent Backlog clone removal retains exact resource targeting and byte
preservation, without synchronizing another writer or requiring matching remote
heads/old revisions. `observePrimaryTaskHistory` reports the existing clone's
native HEAD, status and direct-ref result without accepting or reconciling them.
The real registered tool returns these facts in text and details on success or
resource failure. Supported idle-runtime/explicit-descendant checks, exact owned
resource heads, remote expected-head lease, local compare-delete and atomic
unchanged-owner removal remain. No lifecycle edit, merge, archive, push or shared
provider deletion is performed by finalization. Retained-folder lifecycle and
its strict transition/migration proofs are unchanged.

### Beads workspace and transport observations

Beads v1.3.1 native touched-table/staged-set commits may include multiple issues;
no per-issue history isolation is promised. Before consequential native mutation,
commit, or push, inspect native pending/staged changes, disclose and review the
consequences, and consult if pending work is unauthorized or unclear. With
auto-commit on, a native update may commit touched-table/pre-staged pending work
before any push. Pending or concurrent native
database changes can prevent a safe operation. Judge actual facts without a
replacement code-level dirty gate or blanket quiescence rule. Do not add row
filtering, another store/branch, dependency patches, or a policy/facts framework
to imitate per-issue history. Backlog selected-file guarantees, unrelated Git
dirt, and compatible published descendants are unchanged. This native exception
does not complete the remaining both-provider lifecycle-policy extraction,
secondary durability audit, or bounded recovery work on PRIMECLAW-55.

`prepareBeadsWorkspaceTransport` reads the selected native context, server,
database, branch, revision, working set, configured remote and publication-ref
facts. These support exact workspace/operation targeting. The task-native path
no longer checks lifecycle capabilities, demands a clean working set, compares
live/remote revisions as approval, or repeatedly clones remote databases to
prove a stable snapshot. Raw observations and native failures reach the Agent;
unknown statuses and absent optional fields remain native facts.

The existing explicit preparation path for migration/retained ownership
transition preserves its separate compatibility behavior. It is not a task-native
eligibility substitute. Neither path creates a new task authority or mirror,
uses live raw Dolt writes, or grants migration/activation authority.

### Beads native status publication

`mutateAndPublishBeadsTaskStatus` reads the exact raw task, performs one supported
native pull, requests the intended native update, and makes one non-force native
push. Native `--if-status` is used only when explicitly requested, not generated
as a hidden transition rule. Current working-set, parent, status and revision
facts are not repeated code-level eligibility or content-approval tests.

Returned raw views, revisions, command outputs and publication observations let
the Agent inspect what happened. Native command success alone does not prove
the changed task reached history: a trailing native commit may fail or only log
failure. Inspect actual task history, revision and publication facts before
claiming durability. A successful push reports the submitted local revision and
the native command result, not an isolated remote-Dolt proof or a frozen
task-content approval. Rejected or uncertain operations retain factual
evidence and do not trigger automatic second pull, retry, rollback or replacement
allocation. Editable guidance owns selected-task durability, semantic decisions
and failure disposition. Deeper creation/reservation and later lifecycle policy
extraction remain on PRIMECLAW-55; this helper slice does not claim completion.

### Conversation status-publication integration boundary

`commitConversationTaskStatus` is the first and only lifecycle-adjacent caller
to select this publication seam. Its Backlog branch remains the existing
ordinary `backlog task edit`, exact task re-read, task-file-only Git commit,
commit-path proof, and post-commit cleanliness check. When the selected live
provider is Beads, the boundary calls `mutateAndPublishBeadsTaskStatus` instead
of the older unpublished `bd update` path and returns its discriminated result
unchanged. `published` therefore carries the exact native publication evidence;
`review-required` and `blocked` retain the provider's raw command, revision,
task, diff, ref, and remote snapshot evidence for managed review. The boundary
does not interpret compatibility, pull again, retry, or choose semantics.

Focused integration coverage is deliberately limited to three representative
contracts: Backlog behavior and return shape stay unchanged, Beads publication
returns the exact published evidence without task-file Git operations, and a
Beads concurrent advance propagates raw review evidence without mutation or
classification. Other mutation callers plus finalization, cleanup, migration,
cutover, and legacy routing remain deferred. Direct admission, handoff, and the
bounded blocker/resume route are described below. The one direct admission caller is
bounded separately below.
Provider-neutral mutation, PRIMECLAW-43.1, locks, mirrors, registries,
frameworks, persistent Prime Claw state, automatic retry, force, and raw
live-store writes also remain out of scope.

### Version-2 provider-native ownership identity

The existing version-2 ownership record now has one small discriminated
provider-native task identity; there is no version 3 or second receipt store.
Every newly written record names `provider`. Both provider branches retain the
canonical `taskId`, the existing exact Episode Git `baseRef`, and the existing
resource/lifecycle bindings:

- `provider: "backlog"` carries the exact repository-relative `taskPath`.
  Grandfathered branch-local ownership has no revision/evidence; independent
  Backlog binds the 40-hex task-history `providerRevision` and complete native
  `taskEvidence` separately from code.
- `provider: "beads"` carries no Backlog path. It requires the exact published
  32-character Dolt `providerRevision` and `taskEvidence`: the raw native task
  object whose exact `id` matches `taskId` and whose native title and status
  are present. This is the task-scoped evidence required to compare a later
  native view; it is not a normalized task model or semantic receipt.

Provider-absent version-2 records remain a read-only compatibility shape for
already-written Backlog ownership. They parse as Backlog only when their
existing canonical task ID and safe exact task path remain valid. Reads do not
rewrite those records, including unrelated owners in the Conversation-keyed
registry. New Backlog reservations include `provider: "backlog"`. The reviewed
retained-ownership transition writes the selected provider plus its native path
or published revision/evidence while preserving every existing resource and
legacy code-identity field.

The parser rejects unknown providers, provider/path/revision mixtures, missing
or mismatched native task evidence, and malformed Dolt revisions. Active
binding uniqueness preserves canonical task-ID uniqueness across providers and
exact Backlog path uniqueness; advancing a Beads revision does not change the owned
Episode identity. Backlog path-bound lifecycle entry points explicitly keep requiring a Backlog
ownership branch. Public creation, handoff, bounded blocker/resume, and the exceptional reviewed
retained-ownership transition are the Beads paths. That transition requires its
preserved historical code head to remain continuable by later handoff/cleanup
and re-proves clean reviewed code after the final provider read. Finalization,
cleanup, and provider-switch migration remain separate guarded slices and never
rewrite another owner.

### Direct Beads task Episode admission

The existing public `createTaskEpisode` path now dispatches only a selected live
Beads provider to one provider-specific admission branch. The Backlog branch and
its task-file transaction remain unchanged. Before native mutation, Beads
admission requires the exact requested canonical ID, canonical `In Planning`
and native `in_planning`, and a meaningful raw `nativeView.design` string under
the same placeholder guard used for Backlog implementation plans. Supported
Beads 1.3.1 was verified to preserve `design` through `bd create --design` and
`bd show <id> --json --long --include-comments`; no alternate plan mapping is
used.

The primary checkout must be canonical `main`, have no merge/rebase/sequencer
operation, have no staged or tracked changes, and have an exact code `HEAD`
equal to its upstream. Admission re-proves that code head, task/design, and
owner absence under the existing repository serialization lock. It then calls
`commitConversationTaskStatus` with an expected Beads-provider guard, accepts
only an exact `published` `In Progress`/`in_progress` result, re-proves the clean
code head, and requires the complete raw live target-task view to equal the
published `nativeView` immediately before reservation. Any same-task raw drift
surfaces both provider-native views without classification, reserves nothing,
and enters the single rollback path. Unrelated-task provider advances remain
allowed. The branch then reserves through
`reservePublishedBeadsTaskEpisodeOwnership` and reuses the existing placement
and allocation machinery. Final success requires the stored active Beads owner
to match the clean code `baseRef`, published provider revision and raw task
evidence, operation, task, worktree, branch, and Episode session identities.
The allocation-only ownership guard accepts Beads; later Backlog lifecycle
routes remain closed.

Recovery never retries admission. If `In Progress` published but no durable
owner or resource mutation exists, the same publication seam must prove one
`In Planning` rollback. With exact readable durable ownership and its captured
code base, failure publishes `Blocked` once, re-proves the unchanged owner, and
advances only that owner's `providerRevision`, raw `taskEvidence`, and timestamp.
Both recovery paths require the exact Beads provider, task, and native/canonical
status, but deliberately do not reapply the fresh-admission Git operation,
cleanliness, head, or upstream gate: tracked or head drift after publication can
be the failure being recovered, and recovery never mutates code, `baseRef`, or
resources. Provider review/block results, failed recovery publication,
ownership drift, or unreadable ownership fail closed with raw evidence preserved.

Historical provider-integration checkpoint (superseded invocation surface):
the following paragraph records the earlier single-use/expiry design, not the
current self-contained creation contract above. The direct admission/allocation
seam was reached by provider-aware
`/implement-task` prep/readiness and `create_task_episode` gating. The gate keeps
its existing compact-first two-message flow, expiry and single-use behavior, and
preselected placement. It binds the exact owner, provider, task, and project
root (plus the exact task path for Backlog), re-resolves live provider-native
status and plan/design evidence, rejects drift, and calls the accepted admission
once. `/plan` and `plan_task` now publish the selected provider's native living plan.
The later sections activate provider-aware execute, oversight, factual observation
advancement, unchanged-task handoff, and bounded blocker/resume handling;
finalization, cleanup, and the remaining lifecycle routes stay deferred.
No provider matrix, normalized task model, snapshot/digest protocol, sidecar
receipt, workspace-copy machinery, raw Dolt write, force, or automatic retry is
introduced.

The managed `execute` skill is now provider-aware without activating any new
lifecycle path. It still selects the exact Conversation-keyed owner before task
interpretation. Provider-absent and explicit Backlog version-2 owners retain the
same exact task path, structured `backlog task view`/`backlog task edit`, status,
plan, content, commit, and reporting contract. A Beads owner instead has no task
path and binds the exact task ID, provider revision, complete raw task evidence,
code base, worktree, branch, and Episode session identity.

Beads execution runs from the recorded linked worktree. It synchronizes and
reads the exact task natively with `bd show TASK-ID --json --long
--include-comments`, requires native `in_progress`/canonical `In Progress` and
meaningful raw `design`, and treats every raw task field as durable contract.
The LLM compares the persisted and synchronized raw views field-for-field. An
unrelated-task revision advance is allowed; every outside same-task difference
is shown exactly and reasoned about. Compatible in-scope changes may become the
working basis, while semantic, scope, or authority conflicts stop for
Conversation review. No normalized model or deterministic semantic classifier
is introduced.

The Episode may update only owner-authored description, design, acceptance, or
notes through supported `bd update` fields and never changes status or other
provider/lifecycle metadata. It synchronizes and rereads immediately before the
single intended write, proves the exact owner fields, expected provider-generated
revision/timestamp changes, every other raw field, and clean native revision/ref
state, then publishes once with `bd dolt push --no-adopt`. It does
not retry, force, reset, adopt, overwrite, write raw Dolt SQL, or mutate the
ownership registry. Candidate and blocker reports carry the exact prior,
pre-write, post-write, and published raw views plus the published revision/ref
and code head so the owning Conversation can record current factual
provider/task/code observations. Admission activation, other lifecycle prompts,
provider-aware allocation, and migration remain deferred.

### Internal same-owner Beads factual observation advancement

The existing internal primitive refreshes native observations on one exact
active version-2 owner. It selects the requesting Conversation before task
interpretation and retains exact provider/task/worktree/session/database and
foreign-owner targeting. It creates no resource and grants no lifecycle authority.

Previous revision/raw-task observations are context, not frozen acceptance. One
supported native pull runs from the recorded Episode worktree, followed by native
transport facts and the complete raw task. The helper no longer pairs repeated
stable publication proofs, compares previous content as approval, enforces
status/design eligibility, or tests provider-history ancestry. Current
local revision and complete raw task reach the responsible LLM along with the
native pull result and transport observations (warnings, working set and
publication-ref result). Both continuation prompts retain those facts;
`currentProviderRevision` is local HEAD, not exact-task publication proof. The
LLM judges compatibility under editable owner guidance. Unknown fields and
absence remain native facts. Initial creation returns its existing native
mutation/push result to the invoking tool and includes it with fresh local
observations in the one initial execute assignment; no persistent mirror or
second assignment is added. The production process runner preserves stderr on
exit zero, including native trailing-history-commit warnings.

The existing atomic callback still runs only after first-message admission and
updates only provider revision, raw task evidence, code head and timestamp on
the exact owner. Operation, placement, branch/worktree/session and other-owner
resources remain unchanged. Native failures, identity/collision failures and
uncertain writes are reported without retry or fresh allocation. The separate
code-head/publication and later handoff/terminal policy paths remain pending
extraction on this task; this supporting helper change is not full continuation
or lifecycle completion.

### Direct active-Beads task handoff continuation

The existing public `handoff_task_episode(taskId, guidance?)` has one direct
provider-specific branch for an exact active version-2 Beads owner. The public
signature and retained provider-absent/Backlog and version-1 paths are
unchanged. The exact Conversation-keyed owner is selected before provider/task
interpretation. Guidance is forwarded only into the canonical handoff prompt;
it never supplies raw task evidence or provider revision authority.

The branch requires canonical-primary `main` Conversation context and preserves
the exact operation, code base, worktree, branch, Episode/session, and Orca
resource binding. It requires prior raw evidence with a meaningful `design`, a
clean owned worktree, an exact durable-session CWD,
and the existing complete idle/quiescent transport proof before factual
evidence refresh. The refresh returns native pull/read/transport observations,
not a paired publication proof. The surrounding wrapper still proves the current
code head clean and equal to ordinary upstream/direct remote; that remaining
code-policy extraction is separate work on this same task. The
current raw task/revision/code observation is committed only by the first
handoff message's admission callback, before its execute follow-up.

Exact previous/current raw task views and revisions are appended to both the
canonical handoff and execute prompts as factual provider observations, not a
new authority or semantic approval. The existing Episode LLM incorporates
compatible owner-authored or outside same-task changes and escalates genuine
semantic, authority, or scope conflicts. Unrelated published descendants remain
nonblocking. Publication pairing, identity, lifecycle status, code, resource,
or transport failure stops with zero delivery and no retry. After a valid
refresh, the branch repeats the existing resource and quiescence proof, then
uses the existing canonical delivery once: one handoff prompt plus its sole
execute follow-up, bound to the exact same task and resources.

This slice removes the prior raw-equality gate, `review-required` handoff result,
accepted/current review payload, and wrapper receipt response. It introduces no
new public parameter/tool, approval phase, classifier, normalized diff, digest,
persistent packet, sidecar, retry, force, raw Dolt write,
terminal/finalization/cleanup, migration, or version-3 state.

### Beads blocker publication and same-Episode resume

The discoverable `blocked` skill and ordinary Conversation oversight now cover
one bounded Beads lifecycle pair without adding a status tool or receipt. The
exact owning top-level canonical-primary Conversation selects the persisted
version-2 Beads owner before prompt task text and binds its provider, canonical
task ID, prior published revision/raw task observation, code base, worktree,
branch, and Episode session. The Beads branch has no task path. Backlog keeps its
existing exact-path native edit plus task-only Git commit, and version-1 blocked
pair recovery is unchanged.

Current synchronized native state governs Beads, not a stale ownership status.
After one context/pull/complete raw-read and clean revision/ref proof, an accepted
pushed blocker may make one guarded `in_progress` to `blocked` status-and-note
update. The note truthfully records the accepted blocker evidence and exact
unblock condition. The Conversation publishes once without force and proves the
exact raw task, revision, `refs/dolt/data`, and clean working set. Already-blocked
state is observed without another write; later state, a foreign owner, or any
uncertain native operation stops without retry.

After the operator or accepted evidence clears that actual condition, one fresh
proof cycle may make one guarded `blocked` to `in_progress` update with truthful
clearance evidence and one non-force publication. `handoff_task_episode` then
continues the same idle Episode and its existing callback advances only factual
provider revision, raw task evidence, code head, and timestamp after first-message
admission. Previous raw evidence may truthfully be `blocked`; the freshly
synchronized current task must be exact `in_progress` with meaningful design.
No artificial snapshot, equality gate, semantic classifier, alternate acceptance
interface, state machine, sidecar, raw live-store write, replacement resource, or
parallel workflow is introduced.

### Beads merge readiness and merge status

Before merge readiness, the Conversation verifies provider-reported idle completion of the exact Episode and explicitly proven descendants; active or unprovably idle work refuses readiness. Accepted complete pushed Beads candidates use the same native status helper
and ordinary Git surfaces without a public status tool or task-file mirror. The
Conversation treats `mainHead` as the current clean pushed canonical code head,
ordinarily integrates it into the idle Episode when needed, pushes and proves an
exact descendant `candidateHead`, then makes one guarded
`in_progress`→`ready_for_merge` status-plus-note publication. One native pull,
complete raw read, source-status guard, non-force push, and exact local/isolated
remote task/revision/ref/note/clean proof apply. The operator sees the unchanged
`(taskId, mainHead, candidateHead)` authority tuple plus factual native evidence;
provider revision and raw equality remain observations for LLM judgment.

Delay performs no write. Explicit Request Changes freshly proves current
`ready_for_merge`, publishes one guarded transition back to `in_progress` with a
truthful accepted-finding note, and resumes the same Episode through existing
handoff. Explicit Merge requires a fresh exact tuple, code, owner/resource, and
native `ready_for_merge` preflight. Canonical main uses ordinary
`git merge --ff-only` and a normal push first. Only after direct-remote code proof
may one guarded native transition publish `done` with a truthful final note
naming the authorized tuple and code outcome. Failure preserves exact evidence;
there is no retry, force, replay, custom publisher, receipt, snapshot, or new
transaction. Beads abandonment and cleanup now use only existing native/Git boundaries. Successful merge stays custom native `done`. Explicit abandonment uses supported built-in `closed` plus an exact task/Episode-head `close_reason`, one non-force publication, and complete raw/history proof; `closed` is never mapped to canonical `Done`. After the operator-authorized terminal outcome is committed, pushed, and verified, the Conversation automatically invokes cleanup-only `finalize_task_episode` without separate cleanup confirmation, passing exact `taskId`, terminal `episodeHead`, and truthful `outcome`. The Conversation judges native outcome, code inclusion/exclusion, direct refs and ancestry through editable guidance; the tool returns native facts and verifies exact idle resource targeting; removes only the bound runtime, upstream ref, worktree, and any remaining local branch; and removes only the unchanged owner entry after verified absence. It stores no cleanup head, progress state, inactive record, or successful-close replay result. The Conversation interprets errors and re-reads current ownership, provider, Git, and selected-provider evidence before any safe re-invocation; no retry loop drives cleanup. The shared Beads store/server/history and unrelated owners survive. Migration/cutover and provider-independent task-history changes remain outside this slice.

### Explicit selected-provider migration (AC18/19)

> **Historical and superseded; not current operating instructions.** The text
> below records the earlier bidirectional design, including its retired reverse
> fields and outgoing-source publication/filter requirements. Current migration
> is **Beads to Backlog only**. It preserves existing destinations and reads the
> retiring Beads source as-is, including embedded/local-only data without a Dolt
> remote, source publication or engine conversion. Use the
> [current confirmed-switch guidance](project-initialization.md#confirmed-task-provider-switch)
> and the `initialize-prime-claw` skill. Active Beads execution safety elsewhere
> in this document is unchanged.

The existing initialization/upgrade adapter now exposes a read-only
`switch-request` and an explicit `switch-confirm`; migration is not a general
tracker command. Inspection captures the selected Backlog or Beads source's
exact native revision, canonical digest, complete open/closed/archived counts,
active version-2 ownership count, semantic-placement prompt, and literal
confirmation text. It performs no destination initialization, receipt write,
ownership update, or source mutation.

Confirmation binds that exact revision, a named actor, non-empty managed
semantic-placement prose, literal operator approval, and any exact provider-native
values listed by inspection. For any Backlog field that cannot project to one
Beads-native value without a decision, structured confirmation carries the
actual literal destination value in one task-specific `beadsNativePlacements`
entry. This includes Beads priority integers `0..4` for ambiguous priority
spellings and one native assignee string for a multi-assignee Backlog source.
Prose remains audit evidence and is never parsed as a value; code applies and
reads back the literal before source deletion. Backlog source capture retains
each committed Markdown
file, full Git history with complete commit-message bodies, actor/timestamp,
binary changes, and the native structured view. Archived Markdown is moved only
inside a disposable clone of the exact revision so the native Backlog reader can
interpret it; live source bytes never move. Active and archived native drafts
are also inventoried. Their exact Markdown, Git history, native draft view,
original kind, and placement are retained in Beads-native metadata and notes.
Native status, rather than physical folder alone, classifies Backlog completion
while archive placement remains abandonment evidence. Beads source capture uses the clean, directly published
Dolt revision, rejects effective export-owner filters, and requires a complete
`--all` export to equal an independent read-only issue inventory before it
retains long/comment views, native history, provenance, and relationship rows.
Pair-specific native create
paths project exact equivalent fields, apply any explicitly selected literal
provider-native value through supported native import/create inputs, and retain
the supplied managed prose as audit evidence for non-equivalent placement. Safe
source IDs are reused; every generated ID is recorded by an immutable mapping.
Deterministic native re-reads prove every applied value, destination task, count,
relationship, mapping, raw source package, and published revision before deletion.

The final target-native decision/provenance record (Beads) or receipt task and
history commit (Backlog) is the only durable migration artifact. It binds source
and target providers, revisions, digests, complete counts and mappings, actor,
semantic-placement prose, and cutover timestamp. Only after destination proof
does one atomic registry mutation remap active version-2 records. It preserves
the exact owner, operation, code base/head, worktree, branch, Episode/session,
runtime route, resource, and creation identity while replacing only
provider-native task binding/evidence using the verified mapping. The preserved
ownership `head` remains historical; migration separately captures the clean,
directly published current Episode head, proves `baseRef → historical head →
current head` ancestry and stability, and gives that current head to Orca
continuity checks without rewriting ownership history. Exact idle
durable-session/current-route proof and Orca worktree/terminal proof apply before
and after that replacement. Missing mappings, foreign/provider drift,
collisions, runtime loss, or concurrent registry changes refuse without a
partial write; exact rollback is attempted before cutover if a later pre-cutover
proof fails.

Repeated source revision/digest/count proof and fresh target publication proof
precede deletion. Backlog destinations stay bound to the originally selected
remote URL and task-history ref. The existing ownership lock encloses the final
registry comparison, active-code proof, and destructive boundary. A failed
source deletion rolls ownership back only after the complete exact source and all
active source workspaces are re-read unchanged. Partial retirement keeps the
verified destination binding and reports `cutover-incomplete`; directory
existence alone never restores source authority.
Backlog-to-Beads initializes an excluded `--stealth` store so Beads setup cannot
advance the still-authoritative code-backed Backlog revision. Deletion uses
provider-native stop/removal plus the provider's existing history publication
surface, then proves source absence and sole target selection. Any pre-cutover
error keeps source authority and reports exact source-preserving cleanup or
same-destination retry conditions. A reconfirmed retry can cross the otherwise
blocked dual-store window only after exact source and existing target markers,
mappings, receipt, digest, and publication prove the same destination. A clean
active-Episode Backlog destination clone is reconciled only by exact-remote
fetch and fast-forward to that verified receipt revision; foreign, dirty, ahead,
or divergent clones block. Ordinary lifecycle mutation remains blocked. There is no duplicate target,
automatic retry, dual write, mirror, universal task model, provider-selection
file, sidecar receipt, persistent lock, coordinator, phase file, checkpoint, or
resume state. The real `PRIMECLAW-43.1` repository migration remains separately
operator-confirmed; this candidate and its tests use only disposable stores.

### Allocated pre-session continuation

For the recorded independent Backlog/Orca pre-session shape, the existing
`create_task_episode` surface accepts `operationId` to address the original
allocated operation, not to create another reservation or worktree. The editable
implementation workflow requires actual session/message/action and Orca launch
history inspection first. Missing ownership session identity is not proof of
no assignment. The post-worktree preparation and launch mechanics are shared
with fresh allocation. Supplying an exact existing `sessionId` binds that
session without any new prompt or launch and returns its native state/messages.
The request retains the persisted provider/setup/base/worktree/branch and exact
owner. Collisions and unavailable routes remain factual errors. This narrow
support is not general failed-allocation recovery or live Task45 authorization.
