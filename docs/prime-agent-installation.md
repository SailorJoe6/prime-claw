# Supported Prime Agent installation

> Status: binding Prime Claw build and validation policy.

Prime Claw supports exactly one Prime Agent installation source: the maintained
TypeScript downstream release in Joe's public fork. Build it from source inside
an isolated Docker builder. Do not use Prime Agent's current public installer,
a native release selected by version number, a global npm package, Homebrew, or
locally generated `dist`/`node_modules` content.

## Authoritative source identity

| Field | Required value |
|---|---|
| Repository | `https://github.com/SailorJoe6/prime-agent.git` |
| Annotated tag | `cwd-fix-v0.9.8-r1` |
| Tag object | `8ca4d5c39b7c738f71b5c86422ea46394c3d0558` |
| Peeled commit | `a1faacd53ac4473a75de1d434afaf50945c2f647` |
| Commit tree | `5301c70d9c9d74e474ccaf258fdd3c8de982c52f` |
| Historical upstream base | `v0.9.8` / `7d442aafa985f9342134fac16c2ef41f03fb45c1` |
| `package-lock.json` SHA-256 | `3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74` |
| Prime Agent build ID | `cwd-fix-v0.9.8-r1` |

`prime-agent --version` prints only `0.9.8`. That string is not an artifact
identity: the current native installer can also install a different Rust product
that reports `0.9.8`. Accept a candidate only when the build ID, annotated tag,
peeled commit, tree, and lockfile all match.

The tag is annotated but unsigned. These are identity checks, not a claim of
cryptographic signature. Run the clone and all dependency installation **inside
an isolated Docker image build**, not on the host. Before `npm ci`, verify the
public HTTPS remote and the immutable identities:

```bash
git clone --filter=blob:none --depth 1 --single-branch \
  --branch cwd-fix-v0.9.8-r1 \
  https://github.com/SailorJoe6/prime-agent.git /opt/prime-agent
cd /opt/prime-agent
test "$(git remote get-url origin)" = 'https://github.com/SailorJoe6/prime-agent.git'
test "$(git cat-file -t refs/tags/cwd-fix-v0.9.8-r1)" = tag
test "$(git rev-parse refs/tags/cwd-fix-v0.9.8-r1)" = \
  8ca4d5c39b7c738f71b5c86422ea46394c3d0558
test "$(git rev-parse 'refs/tags/cwd-fix-v0.9.8-r1^{commit}')" = \
  a1faacd53ac4473a75de1d434afaf50945c2f647
test "$(git rev-parse HEAD)" = \
  a1faacd53ac4473a75de1d434afaf50945c2f647
test "$(git rev-parse 'HEAD^{tree}')" = \
  5301c70d9c9d74e474ccaf258fdd3c8de982c52f
printf '%s  %s\n' \
  3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74 \
  package-lock.json | sha256sum -c -
```

A shallow `git clone --branch cwd-fix-v0.9.8-r1 --depth 1` is acceptable only
when the same identity checks follow it. GitHub-generated source archives may be
recompressed and are not the primary identity. The release has no uploaded
binary or npm assets.

## Docker-only source build

Use Node 22.8 or later and run lockfile-driven `HUSKY=0 npm ci --no-audit
--no-fund` inside the isolated Docker build, only after identity checks. Keep
`/opt/prime-agent/.git` for build-ID derivation. Verify the lockfile again and
require a clean Git status after install. Do not copy host `node_modules`,
package `dist` folders, credentials, Prime state, Docker socket, or user-global
configuration into the builder or runtime. The isolated runtime-image candidate
uses an image-owned `/opt/prime-agent` checkout; this documentation does not
assert that this candidate has been merged or activated.

The TypeScript source launcher is the repository-root `prime-agent.sh`. It runs
`packages/coding-agent/src/cli.ts` through the workspace `tsx` binary. A
container-only `/usr/local/bin/prime-agent` wrapper must *execute* this launcher
rather than symlink it: the launcher resolves its source root from its own path.
Set `TSX_TSCONFIG_PATH=/opt/prime-agent/tsconfig.json` for the source launcher
and standalone `tsx` imports.

Do not depend on `packages/*/dist`; those outputs are absent from the source
release. The extension host lives under
`packages/coding-agent/src/core/extensions/` and loads TypeScript/JavaScript
extensions through `jiti`. Prewarm the Python kernel inside the Docker image
as the unprivileged sandbox user by importing `ensureKernelPython` from
`packages/coding-agent/src/core/kernel/bootstrap.ts` through the checkout's
`node_modules/.bin/tsx`. Set `PRIME_AGENT_KERNEL_VENV=/sandbox/kernel-venv`
**before** prewarming. A restored v2 home must link `/sandbox/.prime` to its
mounted historical state; the image must not create that path first. The
versioned root-link bootstrap retains image-owned `.uv`, `.venv`, `.cache`,
`.local`, and `kernel-venv` while linking the other historical home entries.
OpenShell does not carry image environment variables into every sandbox exec:
pass the non-secret kernel path and `TSX_TSCONFIG_PATH` through sandbox
`--env`, and grant only read-only `/opt/prime-agent` in the runtime policy.
The image build may use network to acquire source and locked dependencies;
disposable runtime validation must then run offline.

Install the Prime Claw candidate entry point in a container-only path and load
it explicitly with `--extension /candidate/bootstrap.js`, or place it under an
isolated container `PRIME_AGENT_CODING_AGENT_DIR/extensions`. Never install a
second project-local copy while the selected global candidate copy is active.

Use scratch runtime roots and a container-only daemon socket, for example:

```text
HOME=/state/home
PRIME_AGENT_CODING_AGENT_DIR=/state/agent
PRIME_AGENT_SESSION_DIR=/state/sessions
```

Use faux or scripted providers. Pass no host secrets. Disable runtime networking
after the source and locked dependencies have been acquired. Preserve the
verified source identity, lockfile hash, install log, SBOM when available, and
final image digest as candidate evidence.

## Unsupported installation paths

The following are not Prime Claw installation paths:

- `https://app.primeintellect.ai/prime-agent/install.sh`
- `install-rust.sh` or any native artifact selected only by `0.9.8`
- `npm install -g prime-agent@0.9.8` (the maintained root package was private
  and was not published there)
- Homebrew or another global package manager
- copied host `node_modules`, generated `dist`, or a maintainer worktree
- a candidate accepted only because `prime-agent --version` prints `0.9.8`

`PRIME_AGENT_PINNED` and the vendor-installer path remain historical test-fixture
surfaces until implementation removes them. They are not supported for a new
Prime Claw candidate. For legacy tier-1 source-mode testing, use
`PRIME_AGENT_SOURCE` with an independently verified checkout. The runtime-image
candidate clones the same exact fork tag inside its Docker build instead; it
does not take an untrusted host selector as its source.

## v0.10 and later

The supported Prime Claw target is the TypeScript `cwd-fix-v0.9.8-r1` line.
The offline candidate proof alone does **not** establish active recovery.
The original v2 Error sandbox remains preserved. A separate Ready sandbox on
a verified checkpoint copy has PostgreSQL and the pinned TypeScript daemon
running; routing, restart behavior, and live model acceptance are recorded
separately in [the v2 recovery evidence](evidence/prime-agent-v098-v2-recovery-20261010.md).
Prime Agent's separate downstream maintainer may develop maintenance-only Rust v0.10+ branches,
but Prime Claw must not install, activate, test-cut over to, or claim
compatibility with them. Installation requires new explicit operator
authorization after upstream Orca compatibility is independently validated.
