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

This seam is foundational only. The plugin also ships inert, project-customizable
`plan-task-prep` and `plan-task` workflow assets that define the future
compact-first task planning policy. They resolve the exact task through the
structured CLI, admit only `In Design` or `In Planning`, write a meaningful
native Implementation Plan, make an exact task-only commit, and treat push
failure as transport evidence. They are deliberately not loaded by a public
command yet. Public task-native planning is activated in a later slice together
with compatible lifecycle statuses; the existing folder command and workflows
remain unchanged until that coherent activation.

## Project task workflow

Backlog.md is the repository's sole active task tracker. Until the accepted host
artifact is activated, use the repository-built candidate at
`deps/backlog/dist/backlog`; after activation, the same commands use `backlog`
from `PATH`.

```sh
backlog task list --status "To Do" --ready --plain
backlog task view PRIMECLAW-35 --plain
backlog task edit PRIMECLAW-35 --status "In Progress" --assignee <name>
backlog task create "Follow-up title" --description "Outcome and context" --type task --priority P2
backlog task edit PRIMECLAW-35 --status "Done" --final-summary "Verified result"
backlog task complete PRIMECLAW-35
```

The `To Do` filter is required with `--ready`; readiness alone can include work
already `In Progress` or explicitly `Blocked`. Claiming is one supported edit
that sets status and assignee together. Backlog.md v1.53.0 has no separate claim
command or automatic current-identity shortcut.

Use the CLI for every task mutation. Do not edit task Markdown directly. The
tracked `backlog/` directory is canonical task state, while normal repository
instructions retain Git commit, pull, and push authority. Durable repository
knowledge belongs in the existing tracked documentation rather than a
tracker-specific memory command.
