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
- **Remote-bound branch authority** (`ensureTaskHistoryBranch`): the exact
  `refs/heads/prime-claw/tasks` is probed and fetched from the selected remote
  before any decision — an unreachable remote fails closed, never deciding on
  stale or absent evidence. An existing published branch is verified and
  adopted locally by tracking; a local branch ahead of the remote blocks
  (`local-ahead`, never published implicitly or called verified); a remote
  ahead blocks (`remote-advanced`, never force); shared code ancestry blocks. A
  new disconnected history is bootstrapped in a disposable temporary
  ordinary-Git repository (an orphan commit of only `TASKS.md`), published with
  an ordinary non-force push, proven from a fresh fetch, then adopted by
  tracking. The primary checkout's branch, index, worktree, and untracked files
  are byte-for-byte unchanged by bootstrap.
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
  published head is empty — the published tree is materialized and tracked,
  never staged for deletion. No submodules, linked nested worktrees, alternate
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
- **Exact config preservation + auto-commit**: discovery's selected native
  configuration is used as-is. When the task-history branch carries no folder
  config but an existing root/folder config does, preparation blocks rather
  than shadow or rewrite it (publishing the store's config is part of the
  deferred cutover). With no prior evidence, the minimal valid folder config
  (the native default; upstream autoCommit already false) is established.
  Auto-commit is disabled natively (`backlog config set autoCommit false`)
  against the intended config and proven by `backlog config get autoCommit`.

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
