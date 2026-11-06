# PRIMECLAW-45 — slice 1 upstream build candidate

This is a build/source candidate, not full migration acceptance or activation.
The accepted v1.53.0 host artifact remains authoritative. The same Episode and
In Progress task continue; slices 2–5 remain on the approved task.

## Inputs and changed behavior

- Upstream: `https://github.com/MrLesk/Backlog.md.git`.
- Tag: `refs/tags/v1.55.3`.
- Exact tag/source commit: `0cf4fdbc70020327f4366a29d3f405f83d180301`.
- Backlog build/smoke: Bun `1.4.4`, as selected by upstream CI and flake.
- Prime Agent's Node 22 image setup and source identity are unchanged.
- The separate gbrain integration-test Bun artifact lock is unchanged.

The Git submodule URL/gitlink, host build script, runtime source identity,
Docker runtime and both Tier-1 ARG sets, source-identity fixtures, and current
dependency documentation select this same unmodified release. No old downstream
restore/dependency patch is replayed. Historical PRIMECLAW-44 evidence is intact.
Exact tag resolution and tracked-source checks now complement the existing
exact HEAD/ancestry checks. Existing runtime build stamps and labels continue
to bind version/commit; no new provenance store is introduced.

Upstream `scripts/build.ts` rejects a `BACKLOG_BUILD_TARGET` override without a
checksum-verified executable path. Both images now use the supported native-
platform standalone build with their installed pinned Bun. No upstream helper,
Node upgrade, unchecked cross-target download, or upstream patch is needed.

## Scope and acceptance limits

This slice does not adapt provider migration, archived-task reads, lifecycle
semantics/guidance, or the integration suites that exercise them. Those remain
required before the complete upgrade can be accepted. It does not activate a
host artifact, merge code, refresh/restart the plugin, migrate live data, or
change Episode resources. No acceptance criterion is marked complete solely
from this slice.

Validation results below will distinguish native build/smoke proof from broader
migration/Tier-0/Tier-1 acceptance. Nix access preflight alone is not acceptance.

## Completed native build checks (linux/arm64)

Commands and results:

1. `git ls-remote https://github.com/MrLesk/Backlog.md.git refs/tags/v1.55.3`
   returned the exact selected commit. The clean isolated submodule HEAD and
   `refs/tags/v1.55.3^{commit}` matched it.
2. `python3 -m pytest tests/test_backlog_build.py tests/test_runtime_image.py tests/test_tier1_image.py -q`:
   **48 passed**, one existing import-loader deprecation warning.
3. `docker build --progress plain --target backlog_builder -f docker/test.Dockerfile .`:
   **exit 0**. The frozen install, standalone compilation, exact version and
   upstream compiled smoke passed. Immutable image:
   `sha256:453a366de89900503aaa2c4a27659c824e71e117fd024434d5bb639160b4531c`.
4. From that image, with `--network none`, only the repository build script
   mounted read-only, and an ephemeral source/tree:
   `scripts/build-backlog.sh` **exit 0**. Its upstream compiled smoke passed.
   No host task store, plugin, accepted artifact, or credential path was mounted.
5. In the same container/source: `bun test --timeout=10000 src/test/git-certificate-trust.test.ts`:
   **1 pass, 0 fail, 4 assertions**. Upstream assertions require exactly one
   loopback TLS-proxy request, expected HTTP 502 and nonzero native Git exit.
   No external/private proxy or live credentials are used.

Observed tools: Bun `1.4.4 (38afee6c8)`, Git `2.43.0`, Ubuntu `24.04`,
`linux/arm64`. Both independently compiled standalone outputs (`/out/backlog`
and the script's `dist/backlog`) have SHA-256:
`7b7392ce39def4fc96edc1903109ed9564dc25eb8bd79d3924378cb568ed590d`.
This is native Linux execution, not a macOS/amd64 build claim.

The Nix build uses the separately approved official image:
`nixos/nix@sha256:f159a58f390677f41e8e900a74b6e2f9c7f27b364122ae6acf7a652ce6c551c0`. It has no host mounts, credential inputs,
privileged flags, or caller trust-setting changes. Its final result and fresh
installCheck must be inspected separately; no result is inferred here.

A separate read-only RLM audit found no concrete defect in the bounded diff.
That inspection ran no tests and is not the owning Conversation's acceptance.

Completed raw local logs are retained under
`.test-results/primeclaw45-slice1-08450108/` (ignored); the committed note records
inputs and bounded results, not an ingestion of generated reports as knowledge.

| Log | SHA-256 |
| --- | --- |
| `builder.log` | `c1a5b9014dcbe441f95c24020a1c1946fb49e50997f4b88d0daa1d4dc261f758` |
| `focused-pytest.log` | `140e21136ad3221fb07c161098240bb6fb15771ecbd064d94bb1efc46f33c5bd` |
| `native-script-git-trust.log` | `ab776032f9e2ef602734ca2f4b95cc62d2bcfba1d6e594c43429422ee9f83be4` |

## Supported Tier-1 image smoke

`scripts/test-tier1.sh --smoke` exited **0**. Run
`20261106T144156Z-7333-76955d0a` is `passed`; its manifest proves immutable image
launch, absent networking before the checks, clean teardown and publication.
Image: `sha256:13b357723400a656eb48c8fb94712f252193f95f6412ca949a3d8e304e304ced` (`linux/arm64`).
Native manifest SHA-256:
`e8d19be144ead8ba78f5d399e604b0f2f783b16ffbc05c259b4e5112001a565b`.
Local evidence: `.test-results/20261106T144156Z-7333-76955d0a/tier1`.

This mode intentionally has `prime_agent: null`. It proves the image/toolchain
smoke, **not** the full plugin/container suite, RPC probe, migration/lifecycle
bridges or full Tier-0 acceptance. Those remain required for the integrated
upgrade. No plugin-source asset or live installation was changed in this slice.

## Fresh native Nix package/installCheck

In the disposable official image above, clone the same exact upstream tag into
`/tmp/backlog`, verify its HEAD, then run:

```sh
nix --extra-experimental-features "nix-command flakes" build .#backlog-md --print-build-logs
./result/bin/backlog --version
./result/bin/backlog --help
nix --extra-experimental-features "nix-command flakes" path-info --derivation .#backlog-md
nix --extra-experimental-features "nix-command flakes" log .#backlog-md
```

The complete command sequence exited **0** after a **fresh local package build**
(`aarch64-linux`, 634.5 seconds including dependency fetch/build). Version output
was exactly `1.55.3`; help printed `Backlog.md - Project management CLI`.

- Derivation: `/nix/store/bpk502glsl0y3bb585w0rgbi71w60ahj-backlog-1.55.3.drv`.
- Output: `/nix/store/gxz1m712a3b6rlw8dibmazcxpngv17k6-backlog-1.55.3`.
- The log shows `building '...backlog-1.55.3.drv'`, the actual package phases,
  `Running phase: installCheckPhase`, then
  `Compiled build smoke checks passed for .../bin/backlog.`
- `nix log` separately returned that local derivation's installCheck log. This
  is not cached-package success or the earlier access preflight.
- The unmodified flake uses `patchedDependenciesToOverrides` with the release's
  `gray-matter@4.0.3` patch. Native logs include that dependency derivation's
  patch/cache phases and the package build/installCheck; the unchanged native
  packaging path is used rather than substituting a Docker Bun-only smoke.

The exact release's flake installCheck invokes
`scripts/smoke-compiled-build.ts "$out/bin/backlog" "$version"`. That unchanged
smoke creates a temporary task, reads/lists it, edits/rereads persisted fields,
checks browser assets and MCP, and requires a failed filesystem write to exit
nonzero before reporting success. Its successful native installCheck therefore
covers the required persistence/failed-write behavior, not just version/help.

| Exact upstream input | SHA-256 |
| --- | --- |
| `flake.nix` | `76b42233845259282d4c2895fa3cd68fc883f1151853181cd2aa27d1d5642cfd` |
| `scripts/smoke-compiled-build.ts` | `b04f04cb9d1e2598b7d1cb4920a93d88bf734e7fc00141ad3b02ceef268c4d34` |
| `patches/gray-matter@4.0.3.patch` | `20fa152724c339b09a7bd939adb6d528282921eca6b564412b725d097ba731ce` |

Retained local `nix-build.log` SHA-256: `89a59234a446e230c682a33c94623c589a4abbb9d962e8e63790e0797c344a62`.
`nix-installcheck-excerpt.log` SHA-256: `cbed44ffeb3a65ffd535919eb8594cd6526651b36f70cbee2e7c60f4de6a702e`.
Both are under `.test-results/primeclaw45-slice1-08450108/`.

No `update-nix`, lock rewrite, full flake check, development-shell/trust changes,
new Nix harness, host mount/credential access, or privileged container was used.
These results satisfy this source/build slice's native smoke proof, not the
remaining integrated migration/lifecycle/full Tier-0/Tier-1 acceptance.

## Changed native-view fixture regressions

Using the immutable Tier-1 image above, `--network none`, explicit container-local
`PRIME_AGENT_PLUGIN_ROOT=/root/.prime/agent`, and only `src/` and `tests/` mounted
read-only, ran:

```sh
node --experimental-strip-types --test \
  tests/task_providers.test.mjs \
  tests/project_initialization_extension.test.mjs \
  tests/template_review.test.mjs
```

Result: **exit 0; 193 passed, 0 failed, 1 skipped** (194 cases total).
The skipped case was `production initialization prepares and reuses an independent
published .backlog workspace`: it expects `deps/backlog/dist/backlog`, not the
image's `/usr/local/bin/backlog`. It is not claimed as passed in this first run.
These three source-identity fixture suites are narrower than the full required
plugin/migration/lifecycle container acceptance.
Local `version-fixture-node-tests.log` SHA-256:
`b1170ff250dadf856ba13ff5005e76641ceca74e91770ca10e6af2793e6a445f`.

### Native artifact supplied at the expected fixture path

A second run used the same immutable image, flags, read-only mounts and test
command. Its disposable container first linked the real image candidate into
`/workspace/deps/backlog/dist/backlog`, the path expected by the existing test.
No test was changed or host artifact copied. Result: **194 passed, 0 failed,
0 skipped**. This includes real native independent-workspace initialization and
reuse with v1.55.3, without a network or live task store.

`version-fixture-with-artifact.log` SHA-256:
`d0257a3517895f8141133092c6e4e6a91b1cd0139e213d42c9e2713f5bda4ebe`.
Exact complete local commands are retained in `commands.json`, SHA-256:
`87112bab3a8f24f68b172e2582ffb4ad697f94b4e270cd656358e5234652efe2`.

## Review boundary

This is one reproducible upstream-candidate slice for owner review. Required
provider conversion/lifecycle tests, normative asset conversion, full Tier-0 and
full plugin Tier-1 validation remain for the integrated candidate. No skipped
or unavailable required test is being treated as acceptance. The task remains
In Progress with all full-upgrade ACs unchecked. Continue only the same approved
Episode after owner review; no merge/activation is authorized by these results.

## Accepted slice-1 review correction — Bun isolation

Owner review of published code `d4f8e79a4300ae03d0393f363eb463d114b2f76a`
accepted one concrete finding from independent Expert
`openai-codex/gpt-6-astra`: the runtime Dockerfile globally installed Bun 1.4.4,
so gbrain install/compilation and general sandbox `bun`/`bunx` also used it.
The approved plan limits that advance to Backlog build/tests and preserves
unrelated runtime/dependency versions. The unchanged gbrain test lock did not
isolate actual runtime tools. No gbrain crash was observed or alleged.
This finding supersedes the earlier read-only audit's no-defect conclusion;
the prior source/build, Git-trust, Nix and fixture results remain historical
proof of their stated checks, not proof of toolchain isolation. The owner also
independently corroborated the prior 48 focused pytest and 194 Docker fixture
passes, with no Docker skips.

The bounded repair restores general sandbox/gbrain Bun 1.3.11. Only the Backlog
`RUN` exports a temporary `/opt/backlog-bun` install and PATH for Bun 1.4.4,
including the nested `bun run build` command and upstream compiled smoke. It
removes that temporary tool afterward. Later gbrain install/compilation checks
and uses the unchanged global pin. No new image-wide PATH or BUN_INSTALL is
introduced for Backlog. Upstream source, host/Tier-1 builders, Prime Agent Node,
source identities, gbrain dependencies and test artifact lock are unchanged.

Narrow assertions in `tests/test_backlog_build.py` failed on the reported
candidate (2 failed, 2 passed), then all 49 focused build/runtime/Tier-1-image
pytest cases passed after the repair (one existing import-loader warning).
A disposable Docker fixture now executes the verbatim production Bun,
Backlog and gbrain build blocks, with exact Backlog source and a sentinel
stand-in for gbrain; final execution evidence is recorded below. This is not
a full OpenShell runtime image or real-gbrain integration acceptance claim.
The unmodified upstream Nix/Git-trust and standalone build evidence above is
reused; it is not rerun or represented as fresh repair evidence.

### Executed repair checks

The Docker fixture build passed on native `linux/arm64` (**exit 0**, 66.7s).
The fixture uses the three production blocks verbatim, not rewritten shell
commands. Its base tag `primeclaw45-backlog-builder:08450108` was inspected to
resolve to the prior immutable builder ID
`sha256:453a366de89900503aaa2c4a27659c824e71e117fd024434d5bb639160b4531c`. It supplies `deps/backlog` as the
named `backlog_source` context after exact HEAD/clean-source checks. Its only
other source is a tiny, dependency-free sentinel gbrain package. That sentinel
asserts `process.versions.bun === "1.3.11"` in its postinstall and compiled CLI.
It is not the real gbrain source or a substitute for its integration suite.

Observed build log:

- Global install: `/usr/local/bun/bin/bun`, Bun 1.3.11.
- Backlog-only install: `/opt/backlog-bun/bin/bun`, Bun 1.4.4; frozen install,
  native compilation and upstream compiled-binary smoke passed.
- Backlog's lock also resolves a Bun peer to 1.4.4; `bun run build` may select
  that source-local `.bin/bun`. Both possible build tools have the intended
  pin, and the production RUN removes the whole source/node_modules tree plus
  `/opt/backlog-bun`. No exact nested executable-path claim is made.
- Next production gbrain RUN: `bun install v1.3.11`,
  `gbrain_install_bun=1.3.11`, standalone compilation passed.
- Later layer: `gbrain_compiled_bun=1.3.11`, `general_bun=1.3.11`,
  `general_bunx=1.3.11`, `image_BUN_INSTALL=/usr/local/bun`, temporary tool absent.

Resulting disposable fixture image:
`sha256:dc4621d1da3a86a91eab16636ba9edc48f503b8077135e3c807935b177d49e39`.
A fresh container ran with `--rm --network none` and **no mounts**, and passed
version checks for `bun`, `bunx` and Backlog, the original global symlink targets,
unchanged image BUN_INSTALL, absent Backlog source/tool directories, the compiled
sentinel and Backlog help (**exit 0**). The new fixture's Backlog binary SHA-256
is `25fb5ca6a447331345407e4489b4153ffd7d7c722d62d0fd09ae3aaf934f9020`. This is its own build receipt,
not a claim of equality with the earlier `/tmp/backlog` outputs above.

Commands are in the retained local `commands.json`; the generated disposable
`docker-fixture/Dockerfile` and sentinel inputs remain alongside it under
`.test-results/primeclaw45-slice1-bun-isolation-08450108/`.
For reproduction: generate the same fixture from the shared Bun block through
`# --- Beads`, Backlog block through `# --- Immutable downstream`, and gbrain
block through `# --- Postgres data dir` in `docker/runtime.Dockerfile`; use the
recorded builder base and exact clean source context. Generate the sentinel's
empty lockfile with Bun 1.3.11 before executing the gbrain block, as recorded
in the fixture. No host task store, dependency tree, credentials or live plugin
is mounted or activated.

The initial fixture build failed before executing any build step: Docker treated
`FROM sha256:...` as an unresolvable registry repository. It is retained as a
failed fixture invocation, not a failed production build or passed check.
The successful run uses the inspected existing local tag for that exact base;
no dependency, credential, remote or production-code change addressed it.
A read-only RLM audit found no concrete repair defect; it ran no tests and is
not owner acceptance.

| Repair receipt | SHA-256 |
| --- | --- |
| `regression-red.log` | `7260cabcef41a5c1b788d3c0dc33eef56aa5e1d154e234651cb55817cdd67b20` |
| `focused-pytest.log` | `c3a38e69459bc6c88e3bc2982a901b92d4792740194e8b3471c866749556cb8d` |
| `docker-fixture-build.log` | `62b0978a1f75be04ad93751e97a547be1e53306f39c6ba0ba2467487ee8cc4c1` |
| `docker-fixture-build-with-local-tag.log` | `2d43f65d54ca0b39e5a325ced7e765edf1a9e40e4ceb287775a7f80ce007bdd2` |
| `offline-image-smoke.log` | `d68a20d29e33b76c6a774f97a42ffa9910c70244cbe867ba92c68b3f5ce64e9f` |
| `commands.json` | `d215494ace72e539cc52ae183ba513c2fd090e2af30f0f3479bb4d3ca213deb8` |
| `docker-fixture/Dockerfile` | `0694e6fda53a40be1464d7d0e0bad376fe019981fd97466299edf77ccf328914` |

Only this slice-1 repair is delivered for owner review. There is no slice-2
implementation, full real-gbrain/OpenShell image claim, merged/activated
upgrade, live migration, or cleanup. Unchanged native Nix/Git-trust and prior
194-case fixture evidence is reused within its stated limits. Full integrated
migration/lifecycle and Tier-0/Tier-1 acceptance remains required later; task
status stays In Progress with all full-upgrade criteria unchecked.
