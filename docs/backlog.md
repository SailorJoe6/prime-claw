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

Specification authoring is provider-native. `/design` and `/spec-it-out`
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

The `/plan TASK-ID` command and `plan_task({"taskId":"TASK-ID"})` tool resolve
one exact task through the live native provider and admit it only in canonical
`In Design` or `In Planning`. They preload the project-customizable
`plan-task-prep` and `plan-task` workflows, bind the exact provider/project root
(and a task path only for Backlog) into both messages, request focused
compaction on a best-effort basis, queue the semantic planning turn as the sole
follow-up, and stop without authorizing implementation. Backlog preserves its
meaningful native Implementation Plan, exact task-only commit, and prompt push.
Beads uses the complete raw task view and raw `design` as the living plan,
publishes one guarded `in_planning` transition plus design update through the
supported native CLI, and proves the exact provider revision, publication ref,
raw reread, and clean working set without a task path or mirror. Compatible
same-task refinements are factual LLM context rather than an approval lock.

After separate operator approval, `/implement-task TASK-ID` is the primary
implementation path. It resolves one exact `In Planning` task through the live
provider and preselects placement before it queues the compact-first readiness
turn. Backlog retains its exact returned task path and native Implementation
Plan. Beads retains the exact canonical ID, project root, complete raw native
view, raw design, and native `in_planning` plus canonical `In Planning` status;
it never invents a task path or normalized task model. Semantic readiness stays
in the managed `implement-task` workflow. Backlog runs ordinary `prepare`;
Beads performs the same repository-orientation reads while skipping the
Backlog-only queue inventory so preparation cannot select or mix providers.

`create_task_episode` re-resolves the live provider, task identity, root,
provider-native status and plan/design, and preselected placement before it
consumes the owner/provider/task/root-bound approval once. Any provider,
identity, status, or placement drift fails before creation. Backlog retains its
existing exact task-only status commit and rollback transaction. Beads delegates
once to the accepted provider-native admission: one non-force native
`in_progress` publication, exact raw task/revision/ref proof, clean code
`baseRef`, provisioning ownership before resources, and one fixed execute
assignment. Clean pre-reservation failure publishes one native `in_planning`
rollback; durable or uncertain mutation publishes `blocked` with exact recovery
evidence. Neither path retries fresh admission.

The resulting Episode uses the exact task as its sole durable authority, skips
bundle copy and promotion, and leaves every later lifecycle status transition
to the owning Conversation. Continuation uses `handoff_task_episode`. Review,
status changes, merge, and abandonment remain provider-native prompt-guided
operations. Cleanup alone uses `finalize_task_episode` as the separately
confirmed exact-resource boundary.

## Retained version-1 compatibility

The generic plugin keeps only explicitly grandfathered future folders available
through `/plan-spec`, `plan_spec`, `/implement-spec`, and their folder ownership
mechanics. The first explicit initialization/upgrade records exact unfinished
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

The exact provider-aware task-resolution call sites (`/plan` admission,
`/implement-task`, task Episode creation, ownership reservation, and
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

`publishTaskHistoryMutation({ primaryRoot, targetWorktree, taskId, edits,
commitMessage? })` is the shared Backlog-specific write seam for either the
prepared primary nested clone or one prepared Episode clone.
`publishEpisodeTaskHistoryMutation` remains a compatibility alias. `edits` contains native `backlog task edit`
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

## Independent Backlog production lifecycle connection

Production initialization now supplies `prepareTaskHistoryWorkspace`. When no
provider exists it creates the new published independent store; when Backlog
already selects a valid nested ordinary-Git clone it verifies and cleanly
fast-forwards it. Existing populated non-Git, root-config, custom, or ordinary
branch-local Backlog layouts remain grandfathered. They are never adopted,
moved, normalized, or deleted by routine preparation.

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

Cleanup-only finalization preserves terminal Done/archive and code ancestry
checks. Independent Backlog first proves the clean primary nested clone equals
one stable direct remote head, reads the terminal task from that exact revision
(the committed archive file for abandonment), and binds that revision/evidence.
Native abandonment prepares the built-in `archive/tasks/` directory before the
archive command. The terminal workflow fast-forwards the Episode nested clone
to the published Done/archive revision before cleanup. Cleanup then runs a
separate read-only nested-history proof before deleting anything that contains
it. The directly published clone head must still descend from the
ownership-bound provider revision. Dirty, ignored-untracked, local-ahead, remote-ahead,
divergent, unavailable, foreign, or unreadable history refuses before runtime
or parent-worktree removal. Only the exact clean fully published nested clone is
removed; primary task history and unrelated ownership survive. Migration and
the real repository cutover remain PRIMECLAW-43.1.

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

Still out of scope for the workspace foundation: Beads per-task mutation,
Episode admission/finalization/cleanup wiring, ownership/receipt fields,
provider-neutral UX, managed semantic decisions, legacy transition,
migration/cutover, PRIMECLAW-43.1, and any coordinator, lock, checkpoint,
framework, or persistent state.

### Beads native status publication (first bounded mutation slice)

`mutateAndPublishBeadsTaskStatus` adds one deliberately small provider-native
write seam on top of the workspace foundation. It prepares the exact clean
workspace, reads the exact task through `bd show --json --long
--include-comments`, and performs one `bd dolt pull --remote <name>`. If that
pull advances the native revision, the seam stops before mutation and returns
the raw supported `bd --readonly diff <from> <to> --json`, both exact task
views, and revision facts for managed LLM review. TypeScript does not classify
the change as same-task or unrelated.

With no concurrent advance, the seam asks Beads to own the guarded atomic
write and commit through `bd --dolt-auto-commit=on update <exact-id> --status
<native-status> --if-status <prior-native-status> --json`. One supported
read-only native query then captures the exact `HEAD`, `HEAD~1`, and
`dolt_status` row count together. The update is eligible to publish only when
`HEAD~1` is the prepared revision and the working set is empty. A different
first parent returns raw `bd --readonly diff <prepared> <observed> --json` plus
exact before/after long-and-comments task views for managed review; deterministic
code does not classify the descendant.

The seam then makes one `bd dolt push --remote <name> --no-adopt`, never
force-pushes, and re-proves the same exact clean local revision before success.
One disposable read-only clone bracketed by stable direct ref reads retains the
raw remote revision, exact issue row, and comments. Success requires that remote
revision to equal the proved committed/live revision and the remote row to carry
the exact requested status; a remote descendant is review evidence, not exact
success. A guarded mutation failure or rejected push is preserved and returned
with raw command output, exact local and remote task/revision/ref facts, and raw
native diff evidence. There is no automatic second pull, retry, rollback, table
enumeration, normalized diff, or deterministic semantic compatibility decision.
A managed Episode or Conversation reviews the native evidence and may
deliberately continue on a later pass.

The focused publication contract uses five representative cases only: ordinary
clean direct-parent success, one post-update descendant, one dirty-state
refusal, one concurrent pull advance, and one rejected non-force push.

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

- `provider: "backlog"` carries the exact repository-relative `taskPath` and no
  Beads revision or task evidence.
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

The direct admission/allocation seam is now reached by provider-aware
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

One internal provider-specific primitive refreshes factual published Beads
observations on an existing active version-2 owner. It has no independent public
tool, semantic acceptance, status transition, or lifecycle authority; the
direct active-Beads handoff branch below is its sole managed caller. The exact
requesting Conversation owner is selected before provider or task
interpretation; provider-absent/Backlog and version-1 records reject unchanged.

The input binds the exact owner/task, prior persisted complete raw native task
view and Dolt revision, and the current pushed Episode code head. The prior
values must equal the selected ownership record. From the recorded linked
Episode worktree the boundary runs one supported `bd dolt pull` without force or
retry. A conflict or transport failure stops with no ownership write. Existing
native transport preparation then proves the selected Beads database, clean
published revision, remote publication ref, and supported provider authority.
Exact native `bd show --json --long --include-comments` reads the complete raw
target. A second fresh transport proof immediately after that read must match
the same database, branch, transport, clean published revision, and publication
ref. Movement, dirt, or proof drift during this pairing window is a real
transport-integrity failure and writes nothing.

The current target must retain the exact task ID, native `in_progress` and
canonical `In Progress` status, and meaningful raw `design`. One read-only
native Dolt merge-base query proves the prior recorded revision is an ancestor
of the current published revision. Raw inequality with the prior task
observation is not an approval boundary. Owner-authored living-plan changes,
compatible outside same-task edits, and unrelated-task descendants all become
current factual evidence; exact previous/current native objects and revisions
are returned for the existing Episode LLM.

The recorded Episode worktree must remain the exact repository root and branch,
with no Git operation, no tracked or untracked changes, and local, upstream, and
direct-remote heads all equal to the supplied head. Ordinary Git ancestry must
prove `baseRef` → prior recorded head → supplied head. The existing Episode
session transcript must remain a readable non-empty regular file.

After the first canonical handoff message is admitted, its admission callback
runs the atomic Conversation-keyed ownership mutation before the execute
follow-up is queued. A rejected or uncertain first send therefore preserves the
prior observation; a rejected follow-up retains the current observation because
the responsible LLM already received exact before/current context. The mutation
checks the exact retained owner and foreign active binding collisions beside its
sole write. Only factual `providerRevision`, current raw `taskEvidence`, code
`head`, and `updatedAt` change. Every operation, provider/task, base, engine/placement,
worktree/branch, Episode/session, creation, cleanup, and unrelated-owner field
is preserved. The primitive re-reads the exact persisted record. Owner drift,
collisions, unsafe/unpushed code, non-descendant provider history, publication
or identity failure, and uncertain writes fail closed without reservation,
recreation, retry, force, or provider/task mutation. The live project registry
is not used during development tests.

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
evidence refresh. The refresh performs the native pull/read/publication pairing and proves the
current code head clean and equal to ordinary upstream/direct remote. The
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

Accepted complete pushed Beads candidates now use the same native status helper
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
transaction. Beads abandonment and cleanup now use only existing native/Git boundaries. Successful merge stays custom native `done`. Explicit abandonment uses supported built-in `closed` plus an exact task/Episode-head `close_reason`, one non-force publication, and complete raw/history proof; `closed` is never mapped to canonical `Done`. Separately confirmed `finalize_task_episode` verifies the current published native outcome, code inclusion or exclusion, direct-remote heads, and ancestry before binding `cleanupHead`, removing only the idle Episode runtime/worktree/local branch, and marking ownership inactive last. The shared Beads store/server/history and unrelated owners survive. Migration/cutover and provider-independent task-history changes remain outside this slice.
