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
to the owning Conversation. Continuation uses `handoff_task_episode`; guarded
review, reversible outcomes, merge or abandonment, and separately confirmed
cleanup use `finalize_task_episode` without weakening operator authority.

## Retained version-1 compatibility

Existing future folders remain available only through `/plan-spec`, `plan_spec`,
`/implement-spec`, and their folder ownership mechanics during the ordered
migration. Those procedures remain operational and are documented in
[`future-specification-bundles.md`](future-specification-bundles.md); they are
not the authority for a task-native Episode.

The compatible statuses are staged in `backlog/config.yml`. `To Do` remains the
temporary default and remains selectable until the one-time task migration can
truthfully classify every existing item.

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
New ordinary work must pass `--status "In Design"` explicitly while the
transitional configuration still has its old default.

Use `/design` or `/spec-it-out` for specification authoring, `/plan TASK-ID` for
native planning, and `/implement-task TASK-ID` for approved admission. There is
no generic claim edit: implementation admission and later `Blocked`, resumed
`In Progress`, `Ready for Merge`, and terminal `Done` transitions remain under
the reviewed Conversation lifecycle. `backlog task complete` is reserved for
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
