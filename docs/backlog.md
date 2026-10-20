# Backlog.md dependency and build

Prime Claw vendors its long-lived Backlog.md fork as the Git submodule at
`deps/backlog`. The fork is `SailorJoe6/Backlog.md`; its `upstream` lineage is
`MrLesk/Backlog.md`.

## Current bounded release

The migration snapshot resolved the latest stable upstream release as:

- release: `v1.53.0`
- commit: `fd20f71493fb4eda44b021aa89f257956f17fb71`
- fork: `https://github.com/SailorJoe6/Backlog.md`
- upstream: `https://github.com/MrLesk/Backlog.md`

The release and commit stay fixed through migration review and cutover. A later
stable release is adopted only through a separate fork sync and validated
submodule-pin update. Prereleases and branch heads are not dependency targets.

Clone this repository with `git clone --recurse-submodules`, or initialize an
existing checkout with `git submodule update --init --recursive`.

## Host artifact

Build and run upstream's compiled-binary smoke path:

```sh
scripts/build-backlog.sh
```

The script verifies the submodule tag and commit, runs
`bun install --frozen-lockfile`, compiles the version-stamped standalone binary,
and runs `scripts/smoke-compiled-build.ts`. The resulting candidate is
`deps/backlog/dist/backlog`. Bun is required to build and smoke-test it, but the
compiled artifact does not require Bun at runtime.

The operator-owned cutover later copies the accepted host artifact to
`~/.local/bin/backlog`. Do not activate a candidate globally from an Episode.

## Sandbox artifact

`bin/prime-claw build` supplies `deps/backlog` to `docker/runtime.Dockerfile` as
the named `backlog_source` context. The image build verifies required source
inputs, performs the same frozen install and upstream smoke path, and installs a
separately targeted Linux standalone binary at `/usr/local/bin/backlog`. Image
labels and the build stamp record the release and commit.

The sandbox build pins Bun `1.3.11`, matching the accepted build toolchain, so a
floating installer release cannot silently reuse or replace the compiled
artifact. The build uses the vendored source. It does not install an npm
package, download an upstream prebuilt binary, or require Bun to execute
`backlog`.

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

Specification authoring is task-native. `/design` and `/spec-it-out` create
exactly one task with explicit `In Design` status when no task was selected, or
revise only one exact operator-selected task already in `In Design`. They use
the supported Description, native Acceptance Criteria, References, and
Documentation fields, commit only the returned task path, and stop for operator
review. Later states reject without mutation; neither skill writes an
Implementation Plan or authorizes an Episode.

The `/plan TASK-ID` command and `plan_task({"taskId":"TASK-ID"})` tool admit one
exact task only when its current status is `In Design` or `In Planning`. They
preload the project-customizable `plan-task-prep` and `plan-task` workflows,
request focused compaction on a best-effort basis, queue the semantic planning
turn as the sole follow-up, and stop without authorizing implementation. The
semantic workflow writes a meaningful native Implementation Plan, changes or
retains `In Planning`, commits only the exact returned task path, and treats
push failure as transport evidence.

After separate operator approval, `/implement-task TASK-ID` is the primary
implementation path. It resolves the exact `In Planning` task and placement,
queues one compact-first readiness turn, and permits `create_task_episode` to
consume that bound approval once. Trusted admission commits only the task's
`In Progress` transition before version-2 ownership and resource allocation.
The resulting Episode uses the exact task as its sole durable authority, skips
bundle copy and promotion, and leaves every later lifecycle status transition
to the owning Conversation. Continuation uses `handoff_task_episode`. Review,
status changes, merge, and abandonment use prompt instructions, ordinary Git,
and the supported Backlog CLI. Cleanup alone uses `finalize_task_episode` as the
separately confirmed exact-resource boundary.

## Retained version-1 compatibility

The generic plugin keeps existing future folders available only through
`/plan-spec`, `plan_spec`, `/implement-spec`, and their folder ownership
mechanics for initialized projects still using version 1. Those procedures
remain operational and are documented in
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

`checkBacklogCapabilities` proves the pinned managed `backlog` executable
responds and the resolved configuration carries the exact ordered lifecycle
statuses before any task mutation. `checkBeadsCapabilities` proves the `bd`
executable responds and `bd statuses --json` maps every canonical lifecycle
state to an exact custom or built-in status with the required readiness
category (`in_design:active`, `in_planning:active`, built-in `in_progress` and
`blocked`, `ready_for_merge:wip`, `done:done`). The build pipeline pins and
smoke-checks the exact Backlog version; these runtime gates are behavioral
capability checks, not version assertions.

The existing exact task-resolution call sites (`/plan` admission, task
Episode creation and ownership reservation/transition) resolve through
`resolveProviderTask`, which returns a discriminated native result: the
Backlog branch is the existing `BacklogTaskSelection` plus provider identity,
and the Beads branch is the validated native `bd show --json` issue view
(id/title/status; no task file, plan, or references are invented — Beads
stores none). Detection plus the capability gate run first; none, dual,
malformed, or unavailable evidence fails closed, and Beads statuses map onto
the canonical lifecycle only at the use boundary with unmapped statuses
refused. These file-bound lifecycle paths narrow the result through
`requireBacklogTaskSelection` and reject a Beads-resolved task explicitly
until their sync, publication, and archive behavior lands in the later
workspace slices; a Backlog repository's behavior is unchanged.

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
store lifecycle-ready through the existing capability gate. A second reconcile
is a no-op. Existing Backlog or Beads evidence is preserved untouched; dual,
malformed, or uncertain evidence blocks with exact remediation; and a blocked
or failed provider setup counts as a reconcile conflict and surfaces its exact
detail/remediation in command, tool, and startup summaries without failing
asset reconciliation.

### Task-history workspace foundation (slice 2A)

`extension-support/task-history-workspace.ts` is the direct, Backlog-specific
ordinary-Git preparation seam for the provider-native workspace. The selected
repository **remote** is the task-history authority, and the canonical primary
checkout is never switched, staged, or written:

- **Remote selection** (`selectTaskHistoryRemote`): the canonical primary code
  branch's upstream wins; otherwise the sole repository remote. The selection
  carries the remote's transport URL. No remote or ambiguous remotes block with
  exact remediation; the seam never guesses.
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
  locally by tracking; a remote ahead blocks (`remote-advanced`, never force);
  shared code ancestry blocks. A new disconnected history is bootstrapped in a
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
  onto the published task branch, at the validated built-in task-store
  location. The default with no live provider evidence is `.backlog/` (never
  `backlog/`); an explicitly selected existing `backlog/` store is preserved.
  An existing nested clone is verified exactly — remote name AND canonical URL,
  branch, and head — never recreated. An existing non-empty store without
  `.git` blocks before mutation (adopting it is the deferred migration/cutover
  slice), leaving content untouched. The clone's cached diff against the
  published head is empty and its `git status` is clean — the published tree is
  materialized and tracked, never staged for deletion, with no uncommitted or
  unpublished config. No submodules, linked nested worktrees, alternate
  indexes, same-root custom Git work trees, separate hosted repo, or
  coordinator.
- **Containment before mutation**: the store target is proven directly inside
  the canonical primary root and no path component (target or ancestor) may be
  a symlink; a symlinked store or escape blocks before any branch or store
  mutation.
- **Ignore proven with native Git**: the store is ignored by appending a final
  anchored rule only when absent; an explicit negation (`!/.backlog/`) or any
  ineffective result blocks with exact remediation. `git check-ignore` must
  succeed so an ordinary `git add .` can never stage the nested repository as a
  forbidden gitlink.
- **Root-config layouts block before any native config write**: when discovery
  selects a root `backlog.config.yml`, preparation blocks
  (`config-not-preserved`) before any ignore/branch/clone/config mutation.
  Backlog's native config discovery walks UP from the nested store and resolves
  the root config, so any `backlog config` write from the nested clone would
  rewrite the PRIMARY root configuration while the published folder config
  stays unchanged; mere folder-config existence is not preservation. Relocating
  that authority is the deferred cutover (PRIMECLAW-43.1). A published folder
  config is used as-is and never modified or shadowed.
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
blocks with exact remediation). Episode-worktree preparation, the per-task
fetch/reconcile/commit/push mutation loop, Beads server/Dolt transport,
ownership and receipt fields, remaining lifecycle UX routing, and task-data
migration are later slices.

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

Use `/design` or `/spec-it-out` for specification authoring, `/plan TASK-ID` for
native planning, and `/implement-task TASK-ID` for approved admission. There is
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

- **Identity/containment (Git only):** the target must be a REGISTERED linked
  worktree of the SAME Git common repository as the canonical primary —
  proven by `git rev-parse --git-common-dir` equality plus
  `git worktree list --porcelain`. The primary itself, an arbitrary directory,
  or a foreign repository blocks (`not-linked-worktree` /
  `common-repo-mismatch`). No ownership fields or lifecycle wiring.
- **Derived from the prepared primary:** the selected remote name, exact
  transport URL, published `refs/heads/prime-claw/tasks` authority, and exact
  one-segment built-in store location come from
  `prepareTaskHistoryWorkspace(primaryRoot)`. A prepared `backlog/` primary
  therefore maps only to target `backlog/`; `.backlog` is never hardcoded.
  Root/custom-layout blocks from accepted slice 2A are preserved.
- **Pre-existing effective ignore required:** the store path must be directly
  contained and non-symlinked, and native `git check-ignore` must prove it is
  already ignored BEFORE anything is created. The target code worktree is
  never edited or staged to establish ignore; an unsafe ignore blocks
  (`not-ignored`). The ignore lives on the target branch's own committed
  `.gitignore` (a worktree-creation/operator responsibility, not this seam's).
- **Exact target-native authority:** before the clone write, target provider
  discovery may be absent or may select only the exact derived Backlog store;
  another provider or store blocks. Any target root configuration blocks even
  when it selects that same derived store: root-authority relocation remains
  deferred to PRIMECLAW-43.1, and no native reads may normalize the tracked
  code-worktree file. After creation or reuse, discovery must select the exact
  folder-configured store before native lifecycle/default/autoCommit reads are
  trusted.
- **Independent nested clone:** an ordinary-Git clone uses both the selected
  remote name (`--origin <selected>`) and exact URL on `prime-claw/tasks` at
  the exact remote head — never a nested linked worktree, submodule,
  alternate index, same-root custom work tree, local-filesystem authority
  clone, or force update. Fresh and reused clones must have a real,
  non-symlink `.git` directory; canonical top level equal to the store; and
  Git/common directories equal to the contained `<store>/.git`. Reuse also
  verifies the exact sole remote name+URL, branch/head, native
  lifecycle/default/autoCommit, and no unpublished commits or files. Its
  result-checked clean-status proofs include ordinary and ignored untracked
  entries, so an ignored local sentinel is still unpublished content.

### `cleanupEpisodeTaskHistoryStore({ primaryRoot, targetWorktree })`

One guarded cleanup seam for that exact derived nested clone. Cleanup never
calls primary preparation: it non-mutatingly derives primary store authority,
selects the exact remote name+URL, and reads the fresh direct task ref with
`git ls-remote`. It then proves target-native authority, strict independent
clone identity, exact sole remote/URL/branch, successful read-only clean
status (including ordinary and ignored untracked entries), and HEAD equal to
the authoritative remote head. Every Git inspection must exit zero before its
output is interpreted; an empty stdout from a failed status/read is never
accepted. Dirty, ordinary-untracked, ignored-untracked, clean local-ahead,
remote-advanced/diverged, unavailable remote, wrong identity, a dangling
store symlink, symlinked `.git`, and external nested or primary
`core.worktree` cases refuse unchanged. No primary store, ignore rule, fetch,
or ref is created or changed; the first mutation is final removal of ONLY the
proven target store. If that final removal fails, cleanup reports that state
may be partial rather than claiming unchanged content. This is the plan's
clean/published cleanup GUARD, not operator-facing lifecycle cleanup authority.

### Boundary

Out of scope for 2B: the per-task fetch/reconcile/native-mutate/commit/push
loop, actual Episode admission/finalization/cleanup wiring, Beads server/Dolt
transport, provider-neutral framework, ownership/receipt fields, lifecycle UX
routing, migration/cutover, PRIMECLAW-43.1, and changes to the accepted
non-empty-folder-store ordering.


## Backlog sub-slice 2C: exact task mutation and publication

`publishEpisodeTaskHistoryMutation({ primaryRoot, targetWorktree, taskId,
edits, commitMessage? })` is the direct Backlog-specific write seam for one
already-prepared Episode clone. `edits` contains native `backlog task edit`
option/value pairs; the seam supplies the sole positional task ID itself.
It does not expose a normalized task model or implement lifecycle routing.

Before the native read and write, the seam re-proves the linked-worktree,
folder-native authority, independent clone, one exact remote name/URL, task
branch, ignored store, and strict clean/no-unpublished state. It directly reads
and ordinarily fetches `refs/heads/prime-claw/tasks`; a clean stale clone moves
only by `git merge --ff-only`, followed by another direct-head and cleanliness
proof. Before native task discovery, every tracked `tasks/` entry must have a
real regular-file Git mode and a real non-symlink parent chain contained in the
exact independent store. Native Backlog must then resolve the exact requested
canonical ID and the same tracked real regular non-symlink path before and
after the edit, with effective `autoCommit` exactly `false`. Unsafe task-file
identity blocks without returning a possibly external native view. Only that
exact task path may change. The seam then makes one ordinary Git commit and
pushes `HEAD:refs/heads/prime-claw/tasks` without a force option or force
refspec. A successful result is returned only after a fresh `git ls-remote`
proves the direct remote head equals the published commit. It includes
base/published heads, exact ID/path, unmodified safe native JSON views, and the
exact task-path Git diff.

A non-force rejection triggers fresh direct-read/fetch evidence. Automatic
retry requires a complete status-aware ordinary-Git remote path set containing
only added or modified files. In one disposable clone, native Backlog indexes
safe task identities at both the prior integrated remote head and the candidate
remote head. Every modified path must resolve to the same exact canonical ID
and native path at both heads, and that identity must differ from the owner.
Every added path must be absent at the prior head and resolve to exactly one
safe different-task identity at the candidate head. This rejects an in-place
canonical-ID rewrite even when its file path is unchanged. Shared
configuration/authority, non-task, malformed, deleted/renamed/type-changed,
same-task, non-descendant, unreadable, or otherwise ambiguous advances block
with exact prior/new remote heads, safe native identity views, the retained
local task diff, and the full remote Git diff for managed judgment. A proven
other-task-file-only A/M advance is preserved by an ordinary merge. Before
another non-force push, the seam re-proves target authority, independent-clone
identity, native capabilities, effective `autoCommit=false`, strict
cleanliness, and the same exact canonical ID plus safe task path. The seam
never decides semantic compatibility or forces/rewrites remote history. Native
mutation, commit, fetch, merge, push, or direct-proof failure leaves
recoverable local work in the nested clone and never calls it published.

### Beads workspace and transport foundation (slice 2D)

`prepareBeadsWorkspaceTransport` is the direct Beads-specific readiness seam.
It prepares no shadow state and performs no task mutation or publication. It
uses supported native reads in one fail-closed sequence:

- before any native Beads capability, server, or remote proof, filesystem
  identity checks require the selected `.beads` path to be a real non-symlink
  directory at the canonical project root and require `metadata.json` plus
  `config.yaml` to be readable real regular non-symlink files at their exact
  canonical paths inside that store. Unsafe, external, unreadable, incomplete,
  or ambiguous authority blocks without reading external content or making a
  native Beads/Dolt call;
- provider discovery and the existing `bd` capability/status gate select the
  sole live Beads authority;
- `bd context --json` must bind the exact repository, `.beads` store, installed
  `bd` version, Dolt database, and native `server` mode;
- `bd config get dolt.auto-start --json`, `bd dolt show --json`, and
  `bd dolt status --json` distinguish a running bd-managed per-project server
  from an explicitly operator-managed external server. A bd-managed server's
  reported data directory must be the selected store's exact real `.beads/dolt`
  directory; foreign, symlinked, unreadable, or ambiguous path identity blocks.
  Embedded, proxied, machine-global shared, unreachable, or ambiguous server
  evidence also blocks;
- read-only SQL through `bd` proves the exact database, active branch, 32-character
  Dolt revision, installed/server Dolt version parity, and an empty
  `dolt_status` working set. A dirty working set has no complete revision
  authority and blocks with native commit remediation;
- `bd config get sync.remote --json` and `bd dolt remote list --json` must select
  one healthy Git-backed Dolt remote matching one repository Git remote.
  Before exact comparison, supported ordinary HTTPS, SSH, and file URLs plus
  safe absolute filesystem paths normalize to the same `git+...` transport
  identity emitted by native Beads; normalization does not relax either native
  or repository-remote cardinality. Direct `git ls-remote --refs` must expose
  exactly one `refs/dolt/data` ref;
  then a disposable isolated `dolt clone --ref refs/dolt/data` must report the
  same native branch and revision as the live server. After that isolated proof,
  the live native database, branch, revision, Dolt version, and clean
  `dolt_status` working set are read again and must exactly match the initial
  evidence. A final direct ref read must equal the initial Git object ID so
  neither a concurrent live advance nor a concurrent publication can be called
  ready. The Git object ID for the ref and the Dolt revision are retained as
  different evidence; neither is mistaken for the other.

The only direct `dolt` operations are executable version discovery and
read-only inspection of the disposable remote clone. They never point at the
live `.beads` data directory or race the server. `.beads/issues.jsonl` never
participates. Missing capabilities, lifecycle evidence, clean revision,
remote, credentials, ref, or exact published revision returns bounded native
remediation; no force push, daemon, sidecar, mirror, registry, lock, protocol,
or persistent Prime Claw state is introduced.

### First native Beads task mutation and publication seam

`mutateAndPublishBeadsTaskStatus` adds one direct Beads status transition without
wiring it into Episode lifecycle commands. It first runs the full workspace and
transport proof, reads the exact canonical task, and performs a supported
`bd dolt pull`. A clean synchronized advance is compared through native task and
target-filtered diff evidence: an unrelated advance becomes the new mutation
base, while a target-task change returns reconciliation evidence. The same
classification handles a clean unrelated revision that appears at the final
pre-mutation check or while the guarded mutation is running.

The seam maps the requested canonical status and uses
`bd --dolt-auto-commit=batch update` with the exact prior native status as
`--if-status`. The task and native working set are read again before a supported
`bd dolt commit`. If another supported writer already committed the exact
requested target delta plus unrelated work, that clean commit is reused instead
of creating an empty commit. A same-task delta beyond the requested lifecycle
fields is preserved and returned for managed reconciliation.

Read-only native `dolt_diff_summary` plus task-filtered `dolt_diff` evidence
proves that the `issues` row contains the exact requested status transition and
no non-lifecycle target-field change. The same evidence aggregates every changed
Beads table linked by `issue_id` (and both sides of dependencies), including
comments, labels, dependencies, events, snapshots, interactions, leases,
provenance, journal, compaction, ordinary/wisp child counters keyed by parent,
and wisp-related rows. Any such target-linked
row is a same-task change. Rows and tables linked only to other tasks remain
compatible. A clean descendant that appears before push is compared from the
local commit. If its complete task-scoped diff is empty, the ordinary
`bd dolt push --remote <name> --no-adopt` proceeds. The command never uses
`--force`.

A non-force push rejection triggers an immediate direct-ref and isolated remote
snapshot from the clean mutation base. If its target-task diff is non-empty, the
local commit and remote descendant are preserved and returned for managed
reconciliation. If the target diff is empty, the remote advance is proven
unrelated; one supported `bd dolt pull` integrates it, the committed-to-integrated
task-scoped diff must remain empty, and one ordinary non-force push retry
publishes the combined descendant. If that bounded retry races again, a second
stable remote snapshot returns same-task reconciliation evidence or a blocked
result containing exact unrelated remote revision/head/task/diff evidence; it
never falls back to stderr-only reporting. No conflict strategy or semantic
side is selected.

Immediately after a successful push, native and repository remote identity are
re-proved without requiring the live server HEAD to equal the independently
published HEAD. A stable direct `refs/dolt/data` read brackets a disposable clone
that reads the actual published revision, full issue row, and current comments,
labels, and both dependency sides. That complete isolated view is retained in
successful publication evidence, not reduced to ID/title/status. The clone then
compares the local committed revision to
the published revision with provider-native table summary and complete
task-scoped diffs. The live clean revision,
task, and committed-to-live diff are proved separately and re-read after the
remote comparison. Thus an independent remote-only descendant, a live descendant,
or a descendant already present at the push boundary can be classified without
conflating live and remote authority.

A descendant with no target rows is a compatible unrelated advance and returns
successful exact live and publication evidence. Any target row returns
`reconciliation-required` with exact prior and observed revisions, native task
views, table summary, target-row diff, and publication evidence when publication
occurred. Every descendant is preserved. Prime Claw never rolls it back, forces,
overwrites, or calls a same-task mismatch exact success. An unproved later race
blocks without a stale success claim.

Synchronization, mutation, commit, push, revision, or isolated-comparison
failure retains the exact observed phase and recoverable clean state, working
set, or local commit. Direct `dolt` remains limited to executable discovery and
read-only disposable-clone inspection; the live store is accessed only through
supported `bd` commands.

Still out of scope: automatic semantic reconciliation, Episode
admission/finalization/cleanup wiring, ownership/receipt fields,
provider-neutral UX, maintenance locking, exact-revision publication emulation,
legacy transition, migration/cutover, PRIMECLAW-43.1, and any coordinator,
mirror, registry, framework, or persistent state.
