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

The build uses the vendored source. It does not install an npm package, download
an upstream prebuilt binary, or require Bun to execute `backlog`.
