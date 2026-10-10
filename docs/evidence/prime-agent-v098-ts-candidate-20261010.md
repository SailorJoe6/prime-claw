# TypeScript Prime Agent v0.9.8-r1 isolated image candidate

Status: **isolated candidate PASS; not merged or active** for source provenance,
offline kernel, extension loading, no-model daemon/RPC smoke, host-safe tests,
and independent recovery-safety re-review. The two legacy recovery-detector
issues found in independent review were corrected in the isolated branch.
This is **not** an active-v2 recovery,
Prime Claw runtime cutover, merge, user-global refresh, or credentialed model
acceptance. `prime-claw-lph` stays open for the separately approved remaining
work. The earlier version-only/Rust candidate is rejected and remains documented
in [the blocked artifact record](prime-agent-v098-candidate-blocked-20261010.md).

## Source and build identity

- Public source: `https://github.com/SailorJoe6/prime-agent.git`, annotated tag
  `cwd-fix-v0.9.8-r1` (tag object
  `8ca4d5c39b7c738f71b5c86422ea46394c3d0558`), peeled commit
  `a1faacd53ac4473a75de1d434afaf50945c2f647`, tree
  `5301c70d9c9d74e474ccaf258fdd3c8de982c52f`, and
  `package-lock.json` SHA-256
  `3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74`.
- `docker/runtime.Dockerfile` cloned that public tag inside the isolated Docker
  build and checked exact remote URL, annotated object type, tag object, peeled
  commit, HEAD/tree, lock hash, and clean Git build ID before and after
  Node 22.22.1 / npm 11.11.0 `npm ci`. It kept `.git` and the source
  `prime-agent.sh` launcher. It prepared the source Python kernel under
  `/sandbox/.prime/agent/kernel-venv` during the image build. No local
  Prime Agent checkout, `node_modules`, `dist`, Docker socket, or host secret
  was a build input. The mutable public installer and Rust artifact were not used.
- Unique final tag `prime-claw-brain:pa098-ts-final-a1faacd53ac4`, immutable
  local image ID
  `sha256:67a5cfd584344c3a596cc93f9a52a2f895f9480e3591e5d458a7961fbbfd0114`.
  Build completed on 2026-10-10. Its labels record required version, source
  tag/object/commit/tree/lock SHA. [Sanitized Docker/npm build log](prime-agent-v098-ts-candidate-build-20261010.log)
  SHA-256 `5ca6c132cb1a28e08a9deba077c6506236a7f5ca421b4371de5717d2ffc5f252`.
  The private scratch raw log SHA-256 was
  `0354d00fc8fbdbdc836d01e2535bc949c8aca30f7fe66ac425a727052721007c`.
- [npm CycloneDX 1.5 dependency SBOM](prime-agent-v098-ts-candidate-npm-sbom-20261010.cdx.json):
  414 components, root `prime-agent` 0.9.8; SHA-256
  `8b3b2bed6bec0cff41199fd866fbb5b6bfd590d35d2a38dbc45241e244a240e9`.
  This is an npm dependency SBOM, **not** a full OS/Python image SBOM; the
  installed Docker CLI has no `sbom` command.

## Disposable Docker proof

All probes used separately tagged candidate images, no active OpenShell sandbox,
no host mounts or credentials, and `--network none` after construction.

1. A read-only-root container rechecked exact public origin, tag object,
   commit, tree, clean `git describe` build ID, lockfile SHA, and source
   launcher `--version`. It returned `source_identity=cwd-fix-v0.9.8-r1`
   and version `0.9.8`. With `PRIME_AGENT_INSTALL_UV=0`, it loaded the
   prewarmed Python kernel offline from
   `/sandbox/.prime/agent/kernel-venv/bin/python`.
2. A plugin-only test image copied the four unmodified Prime Claw extension
   source files and their support files into the container, not as a live host
   mount. The TypeScript source extension host loaded all four via its ESM
   loader: `EXT_LOADED=4 ERRORS=0`. Test-only image ID
   `sha256:8ced35a0ead0faa42796c79d61af4d41d8deed5bded8d85e33e2d1ad457890a3`.
3. A separate offline candidate container started the source daemon on an
   isolated container-only socket. `DaemonClient` hello reported build ID
   `cwd-fix-v0.9.8-r1`, app version `0.9.8`, and schema
   `protocol-7-schema-30-f908f493c9e1`; a read-only list succeeded.
   A no-model RPC created a session in `/sandbox`, confirmed its cwd, killed
   it, and confirmed it was absent. The disposable container was stopped and
   auto-removed. No model/provider network call was made.
4. Host-safe `python3 -m pytest tests/ -q`: **718 passed, 86 skipped,
   75 subtests passed** after integration of the fail-closed guard and
   fork-source docs, 11 existing `load_module()` deprecation warnings.
   `git diff --check` passed. No plugin source file was changed.

## Integrated recovery safety review

An independent read-only review found that the old `/sandbox/.npm-global`
installer test and `daemon-catalog-entry.js` process grep would misclassify a
healthy image-owned TypeScript runtime and trigger broad `converge`. The
isolated branch integrated the separately pushed P0 fail-closed guard: Error,
Stopped, unknown, and failed `sandbox get` block `recover` before sandbox
exec, gateway restart, recreation, or converge; dry-run returns nonzero with
no recovery-safety verdict. The remediation removed the old install/process
probes. `recover` now checks the **exact image-owned source identity** first
and recognizes only a missing socket on a verified Ready sandbox as automatic
`cold-daemon`. A present socket must pass a TypeScript `DaemonClient` hello
with the required build ID/version; stale or mismatched hello blocks.
`--signature` cannot override absence, source identity, or a live daemon.
The source itself cannot be reinstalled by `converge` after a wipe.

A separate Docker-only, network-disabled disposable default-socket daemon
probe ran the exact new helper against the final image and returned
`DAEMON_UP`. It was stopped and auto-removed. An independent read-only
follow-up review reported no remaining actionable in-scope BLOCK. The
focused recover/converge/validate tests passed (99 passed). No active-v2
repair was run.

## Remaining boundaries

The Docker base `base:latest`, Bun bootstrap URL, and registry-resolved locked
npm dependencies are not a fully immutable supply chain. The image digest and
source/object/lock proof identify this built candidate; never infer later
rebuild equivalence from a version label alone. A Docker-only smoke does not
prove OpenShell provider, policy, mount, credential, brain-index, or active-v2
behavior. Do not run `create`, `converge`, `validate`, or `recover` on active v2
as a version repair. Joe-confirmed host disk-full Docker Desktop restart and
v2 `Error` state are separately tracked as P0 `prime-claw-4lg`; exact v1/v2
resources are retained. A merge and any recovery/cutover each need operator
authority and their own guarded proof. No source/index sync, routed write,
Qwen cutover, user-global plugin apply, or cleanup was performed here.
