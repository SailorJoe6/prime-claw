# PRIMECLAW-64 off-global build and rollback evidence

Steps 2–3 only, 2026-11-21. The exact retained Episode built Backlog.md 1.55.3 on Darwin arm64 (macOS 26.7.3, build `25G342`). This is not activation or live rollout UAT.

## Inputs and procedure

- Episode code used `4601f334e32cdf17c812ad9adaed5f0eabaca63c`. The Episode and observed primary main `3f5fd0729db6918b6d2ac7a65d4892bd3cb9004c` both record gitlink `0cf4fdbc70020327f4366a29d3f405f83d180301`. Task history was independent; the fallback checkpoint `84e1fb06217572288f9725e9db66c1bd0e7273ac` was published before the build.
- The Episode's empty `deps/backlog` was initialized as a separate checkout with its own `.git`. A no-tags fetch from the existing primary source supplied only the pinned commit for detached checkout. Its `origin` matched `.gitmodules` (`https://github.com/MrLesk/Backlog.md.git`). The only upstream fetch was `git -C deps/backlog fetch --no-tags origin refs/tags/v1.55.3:refs/tags/v1.55.3`. The fetched tag and peeled commit both resolved to `0cf4fdbc70020327f4366a29d3f405f83d180301`; the upstream tree remained unmodified.
- The [official Darwin arm64 Bun archive](https://github.com/oven-sh/bun/releases/download/bun-v1.4.4/bun-darwin-aarch64.zip) matched the pinned `scripts/prepare-bun-runtime.cjs` before extraction: SHA-256 `c240d7f0ccb90c263a849fcdb09b7ee62630d921348ed6aafda86b9d577bc510`. The extracted executable reported `1.4.4+38afee6c8`. The pinned helper was not run; general Bun `1.3.11` and Node `25.6.0` stayed in place.
- `scripts/build-backlog.sh` ran in the Episode with the extracted Bun first on command-local `PATH` and isolated `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME`, and `TMPDIR`. `BACKLOG_BUILD_OUTDIR`, `BACKLOG_BUILD_OUTFILE`, `BACKLOG_BUILD_TARGET`, and `BACKLOG_BUILD_EXECUTABLE_PATH` were unset. The script ran `HUSKY=0 bun install --frozen-lockfile`, `BACKLOG_BUILD_VERSION=1.55.3 bun run build`, then `bun scripts/smoke-compiled-build.ts dist/backlog 1.55.3` from the pinned source directory. Lockfile SHA-256: `8efe4ce79d5526a4e65d974bbfdc8225d4d69b65e0db167a944c3a25e670d53b`.

## Result

The build exited 0 and reported `Compiled build smoke checks passed`. The upstream smoke used a disposable project for CLI behavior, browser assets, and MCP tool/resource discovery. One build attempt; no failed build attempt. No plugin source or project workflow was changed or tested in this slice.

Episode artifact: `deps/backlog/dist/backlog`. It is a Mach-O arm64 executable, reports `1.55.3`, is 106,150,754 bytes, and has mode `0755`. SHA-256: `169976d4a37230e4e650cac3dfa15a03436809fc97dfb7551354e63a9808c586`.

## Rollback and raw evidence

Both original 1.53.0 executables and both copies were identified by native `--version`, SHA-256, mode `0755`, and byte count before the build. The owner received the copy paths before any dist overwrite. The originals and copies still matched those hashes and modes after the build.

| Original | Copy relative to the run directory | SHA-256 |
| --- | --- | --- |
| Canonical primary `deps/backlog/dist/backlog` | `rollback/backlog-1.53.0-primary-dist` | `96044ce2319e84112b9490257f2b8a47a4458754a3c48472fb17452e511ffa00` |
| `$HOME/.local/bin/backlog` | `rollback/backlog-1.53.0-user-installed` | `0da86f0edf37e11955e600da94754add2ea75718a47dcd7ea7c2420aa7de8511` |

Run directory on the Episode host: `$HOME/.prime/agent/session-artifacts/01a20001-5a66-75c9-9899-a9f743e43903/primeclaw64-off-global-20261121T221527Z`. It contains the exact `build-commands.txt`, `build-attempt-01.log`, `build-attempt-01.exit`, `rollback/manifest.json`, and `build-manifest.json`. Manifest SHA-256: `c87964b18a7e500dbabde8003e425fc2afd20a1b8a013627c408139f9529f382`. The binaries are not in Git.

The primary dist and installed user binary remain at 1.53.0. This record does not establish consumer inventory, deployment, reconciliation, a restart, or live Backlog activation. PRIMECLAW-64 remains In Progress; the owning Conversation reviews this slice before consumer inventory or deployment.
