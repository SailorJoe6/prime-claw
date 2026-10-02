# Execution plan — project-wide isolation-first testing strategy

> **Status:** FUTURE plan, awaiting operator review; implementation readiness
> is blocked only on open prerequisite `prime-claw-blw.5`.
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md).
> **Selected future folder:**
> `.ralph/plans/future/project-wide-testing-strategy`.
> **Tracking:** parent `prime-claw-5v7`; implementation slices listed below.
> Planning does not authorize implementation. Only
> `/implement-spec .ralph/plans/future/project-wide-testing-strategy` may
> create an episode.

## 1. Outcome

At completion, `prime-claw` has one truthful test architecture:

- pure repository tests remain a no-Docker host gate;
- every environment-dependent behavior runs in a disposable unit or
  brain-stack container;
- exact Prime Agent, gbrain, image, fixture, and lifecycle identities are
  recorded in sanitized per-run evidence;
- source-mode Prime Agent tests cannot mutate the selected checkout;
- a real OpenShell lifecycle proof is explicit, workspace-scoped,
  credential-free, and proves target-only deletion without ever addressing the
  default workspace or an operator-owned sandbox; and
- the gbrain fixture can support Phase 3a provenance and property evidence
  without running or authorizing any live Phase 3a action.

The whole-suite driver remains a dumb sequencer. No framework, CI workflow,
product test mode, Docker socket mount, or upstream Prime Agent change is
introduced.

## 2. Planning audit and decisions

### 2.1 Baseline audited on 2026-10-02

Planning began at `main` commit `2f4fde2`. The reconciled baseline is
`ded4a8c`, which includes the accepted plugin-install guardrail repair
`672be3b`.

- The original `python3 -m pytest tests/ -q` baseline was **274 passed,
  144 skipped** in 37.89s across 418 cases.
- From a clean `ded4a8c` archive, pytest collects **422 cases**: 40
  `container`, 107 `sandbox`, and 275 neither. The full tier-0 run was **274
  passed, 147 skipped, 1 failed** in 34.70s because the known timing-sensitive
  `test_candidate_progress_watchdog_resets_and_signal_cleanup_reaps_group`
  tripped; its immediate isolated rerun passed. The landed repair evidence
  records the same unrelated flake. This is baseline disclosure, not permission
  for automatic retry or for weakening the assertion.
- The six `test_runtime_*` modules account for all 107 `sandbox` cases, but
  are offline/mocked. One case alone runs real host Node.
- Tier 1 is one session container driven by host pytest. The repository is
  mounted read-only and one run-owned share is mounted read/write.
- Current tier-1 source mode mutates the external Prime Agent checkout in two
  duplicate paths: `scripts/test-tier1.sh` and `_stage_fork_release` in
  `tests/conftest.py`.
- No exact provenance manifest, integration image, real lifecycle test, CI
  configuration, or real gbrain/PostgreSQL test fixture exists.
- Current skip logic is unsafe as a policy claim: any non-empty `-m` bypasses
  default tier skipping, and explicit container selection can green-skip when
  Docker is absent.
- Fixed image tags and the shared `tier1-session-setup.log` are not safe for
  concurrent runs. Test-time networking remains attached after installation.
- Existing product behavior in `bin/prime-claw` only accepts a GitHub
  `owner/repository` brain remote. The integration fixture's local bare repo
  therefore tests fixture/gbrain Git behavior only, not production L7 Git.
- `672be3b` repaired the plugin-install boundary before this plan completed.
  Bare apply/check now fail closed; Docker tier 1 explicitly targets
  `PRIME_AGENT_PLUGIN_ROOT=/root/.prime/agent` without inheriting host `HOME`;
  and `--user-global` is reserved for deliberate post-acceptance activation
  from the primary `main` checkout. Every slice must preserve that contract.

The untracked audit notes used during design are not execution inputs. This
plan and the revised specification contain every load-bearing finding.

### 2.2 Decisions resolved by planning

1. **Host result verification is allowed, host product behavior is not.**
   Existing host pytest bridges may verify exit status and run-owned exported
   artifacts. Subject processes, filesystem semantics, and environment-
   dependent behavior execute in the target container. Static tests enforce
   that bridges do not resolve host Node, Prime Agent, gbrain, Docker, or
   operator paths.
2. **New integration pytest runs inside its container.**
   `scripts/test-integration.sh` is only a launcher. Product assertions live
   under `tests/integration/` and execute with the container on
   `--network none`.
3. **No controller/target broker is built.** Launcher meta-tests use recording
   fakes in tier 1. No current body needs a real target container, so a broker
   would be an unjustified framework.
4. **Plain Docker is the integration path.** The Linux recipe is already
   proven by `docker/runtime.Dockerfile` and Phase 3a Slice 0. An OpenShell
   fallback is not pre-approved. If the pinned gbrain artifact cannot run in
   plain Docker, the slice stops with evidence and returns for specification
   revision.
5. **gbrain is pinned by a tracked artifact lock.** Online preparation
   fetches the exact public upstream commit into a run-owned temporary repo and
   materializes it with `git archive`; an optional local mirror is transport
   cache only and must match the lock. The generated context never reuses
   ignored `docker/runtime/gbrain/` or `_build_inputs_fingerprint`, which omits
   source content.
6. **Reconstructible inputs, not bit-identical images.** Provenance records
   base digest, package/tool versions, source archive and executable hashes,
   Dockerfile hash, image ID, and fixture hashes. Apt repositories make
   byte-for-byte image reproduction out of scope.
7. **No-write means logical equivalence.** PostgreSQL storage/WAL bytes are not
   compared. The dry-run test begins from a fully migrated baseline because
   gbrain connection startup may apply pending migrations; it compares
   normalized schema, migrations, rows, bookmarks, persistent locks,
   sessions, config, worktree, and bare refs.
8. **Lifecycle uses a host acceptance observer, not a controller container.**
   OpenShell is the host control plane. The launcher creates an isolated,
   labeled non-default workspace and pins every command to it. A container
   would still require a host broker and would add risk without isolation.
9. **The first live occupant is `destroy --yes`.** Full `create` requires real
   providers, `gh auth token`, and a production-shaped remote. The safe proof
   creates target + sentinel sandboxes through the test harness, runs product
   destroy only against the target, and verifies exact scope.
10. **`--with-sandbox` hard-errors.** It is not aliased to a newly mutating
    lifecycle action. `--with-lifecycle` requires both the sequencer flag and
    pytest `--run-lifecycle`.
11. **The deferred shared-base bead stays deferred.**
    `prime-claw-blw.4` is not required. Test Dockerfiles may duplicate small
    Ubuntu package layers rather than change the proven runtime image.
12. **Phase 3a remains separate.** The final slice produces an evidence packet
    and proposed owner note only. It does not modify, unblock, probe, hand off,
    or resume that episode.

## 3. Dependencies and delivery discipline

### 3.1 Bead chain

Strict order:

```text
✓ prime-claw-4mw  landed guardrail baseline (`672be3b` / `ded4a8c`)

prime-claw-blw.5  remaining external prerequisite
  ↓
S1  prime-claw-5v7.2  pinned provenance + source fail-close
  ↓
S2  prime-claw-5v7.1  source-build isolation
  ↓
S3  prime-claw-5v7.5  disposable integration tier
  ↓
S4  prime-claw-5v7.4  truthful taxonomy/collection/default entry
  ↓
S5  prime-claw-5v7.8  remaining environment-body moves
  ↓
S6  prime-claw-5v7.7  lifecycle fail-closed boundary
  ↓
S7  prime-claw-5v7.6  real destroy target/sentinel proof
  ↓
S8  prime-claw-5v7.3  gbrain no-write/source-coverage evidence
```

`prime-claw-4mw` is closed and included in the planning baseline.
`prime-claw-blw.5` must close before S1 begins. The episode rebases and preserves
both fixes; it does not reimplement them. `prime-claw-blw.4` is explicitly
non-blocking.

### 3.2 Per-slice operating rules

Every slice is one bounded implementation iteration and must:

1. claim only its child bead and rebase on current `main`;
2. prove new acceptance can fail before making it green;
3. implement only the slice's named capability;
4. run focused tests plus every already-existing tier affected by the change;
5. update `docs/testing-strategy.md`, `DEVELOPERS.md` where user-facing
   commands change, and `config/requirements-inventory.json` in the same
   commit;
6. write raw logs/manifests under `.test-results/<run-id>/` and a concise,
   sanitized durable summary at
   `docs/evidence/YYYY-MM-DD-testing-strategy-slice<N>-<slug>.md`;
7. run `tests/test_inventory_integrity.py` and verify no credential/private
   content appears in tracked or raw evidence;
8. commit one reviewable capability, `git pull --rebase`, `bd sync`, push, and
   verify `git status` is clean and up to date with origin;
9. update the child bead with commit, commands/results, evidence path,
   limitations, and pushed status; then stop for owning-conversation review.

Do not close a slice bead until that slice is accepted. Do not begin the next
slice in the same execution pass.

### 3.3 Evidence and performance budgets

- Tier-0 planning baseline: 37.89s. Its three-run warm median must remain at or
  below 60s and must not regress by more than 20% from the slice-entry median.
- Record the tier-1 warm median before S1. Test-body time may not regress by
  more than 20% per slice without operator approval. Online preparation/build
  time is reported separately.
- Prime Agent builder: cold preparation budget 10 minutes; warm preparation
  budget 3 minutes. Exceeding either is a review stop, not permission to mutate
  the host checkout.
- Integration tier: cold image build budget 15 minutes; warm image + fixture +
  tests budget 5 minutes.
- Lifecycle tier: 10-minute test deadline plus an independent 3-minute teardown
  budget. Timeout or unknown state fails and retains evidence.

Budgets are gates, not retry policies. No automatic retry is added.

## 4. Requirement traceability

| Requirement | Owning slice(s) | Planned proof |
|---|---|---|
| R-TEST-1 isolation invariant | S1–S8 | architecture statics, environment allow-lists, host-state guards |
| R-TEST-2 tier placement | S4, S5 | collection/marker tests and reconciled behavior inventory |
| R-TEST-3 disposable brain stack | S3, S8 | in-container environment and gbrain property suites |
| R-TEST-4 no implicit host control | S5, S6 | fake-only meta-tests; socket/raw-CLI architecture guards |
| R-TEST-5 narrow launchers | S1, S3, S6 | launcher contract and teardown failure tests |
| R-TEST-6 provenance | S1–S3, S7 | canonical manifest schema + runtime hash verification |
| R-TEST-7 container boundary | S1–S5 | mount/network/env inspection tests |
| R-TEST-8 source-build isolation | S1, S2 | fail-close guard then before/after checkout equality |
| R-TEST-9 lifecycle scope | S6, S7 | fake guard matrix then target/sentinel live proof |
| R-TEST-10 failure injection | every slice | claim→fault→expected state/evidence matrix in each evidence note |
| R-TEST-11 host observers | S6, S7 | DEVELOPERS registry, collection gates, live exception evidence |
| R-TEST-12 entry contract | S4, S6, S7 | CLI tests and full sequencer runs |
| R-TEST-13 Phase 3a interface | S8 | fixture evidence packet + owner-boundary note |

Each slice adds only the inventory entries it can prove. `proven_by` paths must
exist, and the final slice adds a completeness assertion that every normative
`R-TEST-*` ID appears exactly once with current status.

## 5. Slice 1 — pinned provenance and immediate source fail-close

**Bead:** `prime-claw-5v7.2`

**Blocker:** `prime-claw-blw.5` must close before pinned acceptance.

**Outcome:** pinned tier-1 runs have exact, concurrent-safe provenance, test
execution is offline, and the unsafe source selector fails before the external
checkout is inspected or mutated.

### Changes

- Add a small stdlib-only provenance module under `scripts/testing/` with
  canonical JSON serialization, SHA256 helpers, schema/version validation,
  redaction guards, atomic write, and evidence-file inventory hashing.
- Change `tests/conftest.py` and `scripts/test-tier1.sh` to allocate one run id
  and `.test-results/<run-id>/tier1/` tree. Remove the shared
  `.test-results/tier1-session-setup.log` surface.
- Build the tier-1 image with a build-input-hashed informational tag **and a
  run-owned `--iidfile`**. Launch the container by the captured immutable image
  ID, not by the tag. Record image ID/digest, Dockerfile hash, declared input
  hash, architecture/platform, and build timestamps.
- Record repository-under-test HEAD plus a sanitized dirty-state/content hash,
  then record pinned Prime Agent request, actual installed version, and
  installed package identity. Source provenance is added only after S2.
- Make `PRIME_AGENT_SOURCE` fail closed with guidance to S2 before any stat,
  build, cleanup, or pack operation touches the selected checkout. Pinned mode
  remains the only executable tier-1 mode during S1.
- Split online artifact installation from test setup. Immediately after the
  vendor install, disconnect every captured network and verify none remain;
  only then run plugin apply/check, probes, and tests. Apply/check use the
  landed guardrail's explicit
  `PRIME_AGENT_PLUGIN_ROOT=/root/.prime/agent` inside Docker and never inherit
  host `HOME`.
- Replace standalone `docker run --rm` reliance with captured-ID teardown and
  present/absent/unknown inspection. Unknown fails and preserves evidence.
- Add regression coverage for schema version, missing/both selectors,
  source-mode fail-close before checkout access, stale/tampered hashes,
  redaction, concurrent run directories, iid/tag mismatch, network still
  attached, and teardown unknown.
- Create `docs/testing-strategy.md` as the durable architecture document.

### Acceptance

- Red proof uses fakes and detects current shared log/no-manifest behavior; it
  never runs the current source pack path against a real checkout.
- After `prime-claw-blw.5` closes, the pinned run produces a valid manifest and
  launches the exact iidfile image ID.
- A source selector exits nonzero before any read or write below the checkout;
  a recording fake proves zero source commands.
- Apply/check/probes execute only after network absence is verified.
- Existing tier-0 and pinned tier-1 suites plus standalone `--smoke`/`--probe`
  pass with exact teardown evidence.
- Durable evidence: `docs/evidence/...-slice1-pinned-provenance.md`.

### Rollback

Revert additive provenance/launcher changes only if source mode remains
fail-closed. Never restore the host-mutating source path as a rollback. If an
exact revert would restore it, land a minimal safety-forward disable commit
before removing S1.

## 6. Slice 2 — Prime Agent source-build isolation

**Bead:** `prime-claw-5v7.1`

**Outcome:** source mode can test clean or dirty Prime Agent work without
writing any byte, type, mode, or link in the selected checkout.

### Changes

- Add `docker/test-prime-agent-builder.Dockerfile` and one canonical
  `scripts/build-prime-agent-test-release.sh` used by both standalone and
  pytest launchers. Capture the builder image through a run-owned iidfile.
- Mount `PRIME_AGENT_SOURCE` read-only. Inside the builder, copy the selected
  source set to container-local storage, exclude generated dependency/build
  caches, install dependencies, clean only the local copy, build, and run
  `release:pack`. Export only hashed release artifacts and a manifest to the
  run-owned share.
- Include committed and relevant dirty/untracked source inputs in a canonical
  lstat/type/mode/content manifest. Record HEAD, dirty state, include/exclude
  rules, source-content hash, package version, pack command identity, tarball
  SHA, and output inventory. Never record the private checkout path.
- Compute a complete external-checkout inventory before and after, including
  ignored `dist` and `release/tier1`, symlinks, modes, and file hashes. Equality
  is mandatory on success and injected failure.
- Remove both host mutation implementations from `scripts/test-tier1.sh` and
  `tests/conftest.py`; both consume only builder outputs validated by S1's
  provenance schema. No stale-artifact or host-build fallback exists.
- All dirty edits, stale outputs, cleanup denials, build/pack failures, and the
  red proof use disposable fixture clones/source trees. A real
  operator-selected checkout is read-only smoke input only.

### Acceptance

- Fake/fixture red proof detects the old dist/release mutation without touching
  the operator checkout.
- Clean fixture, dirty fixture, stale-output, build-failure, pack-failure,
  tampered-tarball, and interrupted-builder cases leave the input inventory
  identical. A dirty fixture edit changes content identity and installed
  behavior; replay cannot reuse the earlier package.
- A real selected checkout may be mounted read-only for one smoke run; its
  complete before/after inventory is identical.
- Source and pinned tier-1 runs pass offline after preparation, with runtime
  identity matching provenance and within §3.3 budgets.
- Durable evidence: `docs/evidence/...-slice2-source-builder.md`.

### Rollback

Builder removal must leave source mode fail-closed. Never restore the prior
host mutation. Pinned mode remains available until a repaired builder lands.

## 7. Slice 3 — disposable brain-stack integration tier

**Bead:** `prime-claw-5v7.5`

**Outcome:** one command builds and runs a credential-free, offline, disposable
PostgreSQL/gbrain environment with exact provenance and fixture-owned Git.

### Changes

- Add `config/test-artifacts.lock.json`. Its initial gbrain pin is upstream
  `garrytan/gbrain` commit `a6be012a3bcfac42e279630aedec5cda4a450e29`,
  tree `68bed6c798259e641172b9c4b277fc524b06f3f2`, package version
  `0.50.0.0`, and `git archive` SHA256
  `78ef4b78fbe2cb1de32862c45a244c0f0b8c20ec468a21c5ecffbba50d53ca1e`.
- Support host-native `linux/arm64` and `linux/amd64` explicitly. The lock holds
  Bun `1.3.11` artifact checksum per platform plus resolved base digest; build,
  run, embedded manifest, and host evidence all record the selected platform.
  Cross-platform emulation is not implicit.
- During online preparation, clone/fetch the public locked commit into a
  run-owned temp repo, verify commit/tree/archive SHA, and create a generated
  context. An optional local mirror is only a transport cache and must match all
  locked identities; its working tree is never copied. Delete the context after
  verified build.
- Add `docker/test-integration.Dockerfile` as a two-stage plain-Ubuntu build:
  builder compiles the locked archive; unprivileged runtime contains PG16,
  pgvector, Python/pytest, Git, the standalone gbrain binary, and embedded
  provenance. It contains no OpenShell or Prime Agent.
- Add `scripts/test-integration.sh`. It builds with a run-owned iidfile,
  launches by captured immutable image ID, creates one unique labelled
  container, mounts repository read-only plus one result share, publishes no
  ports, mounts no socket/data/home, supplies an allow-listed env, runs the
  assertion phase with `--network none`, propagates status, and performs
  three-state teardown.
- Register `integration` now and place the in-container body in a non-default
  filename such as `tests/integration/environment_body.py`. The launcher
  invokes it explicitly with an inner-container attestation. Plain host pytest
  cannot collect it; direct host invocation fails before side effects with
  guidance.
- The in-container fixture owns temp PGDATA/socket, PostgreSQL + vector,
  synthetic gbrain home/config, a fully migrated baseline, local bare Git
  remote/worktree, and bounded Postgres finalization. Mutating tests get fresh
  databases; migration/postmaster tests get fresh clusters.
- Add a synthetic corpus/manifest under `tests/fixtures/brain-source/` with no
  private content.
- In-container assertions prove process env/routes/filesystem, non-root
  execution, PG/vector/gbrain readiness, embedded/runtime hashes, and local Git.
  Host launcher assertions alone verify Docker inspect mounts, ports, network,
  image ID, and teardown. Their behavior is tested with recording fakes.

### Acceptance

- Wrong/missing lock, unsupported platform, tampered binary/manifest, iid/tag
  mismatch, external TCP attempt, mount/port/env drift, and teardown unknown
  turn the gate red.
- `scripts/test-integration.sh` passes twice with disjoint DB, Git, container,
  image-result, and evidence identities and no inherited state.
- Host inspect proves network-none assertion phase, no ports/socket/credential
  env, and approved mounts only. In-container smoke proves exact PG16,
  pgvector, gbrain version/hash, migrated schema, and local Git round trip.
- `python3 -m pytest tests/ -q` remains Docker-free and neither collects nor
  executes the integration body.
- If plain Docker cannot run the locked artifact, stop for spec revision; do
  not switch to OpenShell or patch gbrain.
- Durable evidence: `docs/evidence/...-slice3-integration-environment.md`.

### Rollback

Delete only captured labelled containers/images and generated contexts after
positive ownership checks. PGDATA/bare repos die with the container. Unknown
preserves evidence and blocks completion.

## 8. Slice 4 — truthful taxonomy, collection safety, and default entry

**Bead:** `prime-claw-5v7.4`

**Outcome:** markers and collection gates describe real dependencies, plain
pytest is reliably Docker-free, and the default sequencer runs static →
unit-env → integration without exposing lifecycle.

### Changes

- Register `container`, `integration`, `lifecycle`, and `macos_host`; retire
  `sandbox`. Remove `sandbox` from all six mocked `test_runtime_*` modules and
  add tier-0 rationale headers. Split the one Node-dependent runtime case into
  a non-host body to be moved by S5.
- Repair collection policy: arbitrary `-m` never disables guards; valid
  environment bodies without their dedicated inner attestation are skipped or
  fail before side effects; explicit environment-tier selection fails instead
  of green-skipping when the launcher/dependency is unavailable.
- Preserve non-default integration-body naming/attestation from S3. Define
  deterministic lifecycle collection semantics for S6: marker/fixture
  structural mismatch is collection error; a valid marked+fixture test without
  `--run-lifecycle` is skip/no mutation.
- Make `scripts/test-all.sh` sequence tier 0, pinned/source-ready tier 1, then
  `scripts/test-integration.sh`, fail-fast, under one run root/summary.
  `--with-sandbox` hard-errors exit 64. `--with-lifecycle` also hard-errors
  with “guardrails/occupant not installed” until S7 enables it atomically.
- Preserve the landed AGENTS.md/apply-check guardrail: container commands use
  `PRIME_AGENT_PLUGIN_ROOT=/root/.prime/agent`, never inherit host `HOME`, and
  never instruct/invoke host-global apply/check. Deliberate post-acceptance
  activation alone uses `--user-global` from the primary `main` checkout.
- Add the DEVELOPERS.md host-observer registry; `macos_host` is empty and the
  planned lifecycle observer is documented as not yet enabled.
- Add collection/inventory tests that enumerate every current body and its
  execution locus. S5 performs the remaining moves; this slice makes the
  existing exceptions explicit rather than claiming they are already moved.

### Acceptance

- Red proofs cover arbitrary-marker bypass, explicit-tier green skip, accidental
  host collection of integration bodies, and accidental lifecycle enablement.
- Plain pytest runs truthful tier 0, including mocked runtime modules, with no
  Docker/env selector. Direct integration-body host invocation is non-mutating
  failure; default test-all passes tiers 0+1+2.
- Both old/new lifecycle flags are deterministic hard errors with no mutation.
- Container gate succeeds from plugin source without refreshing the operator
  global install; before/after managed-global hashes are identical.
- Durable evidence: `docs/evidence/...-slice4-taxonomy-entry.md`.

### Rollback

One exact revert restores the previous taxonomy/entry only if S3 integration
bodies remain uncollectable and source mode remains safe. Never recover by
running an environment body directly on the host.

## 9. Slice 5 — remaining environment-body moves

**Bead:** `prime-claw-5v7.8`

**Outcome:** every audited non-static behavior outside integration/lifecycle is
container-driven; named coverage is reconciled without a generic framework.

### Changes

Move/split these groups into explicit tier-1 body modules or direct bridges:

1. embedding watchdog process-group/signal cases;
2. npm-onload Node behavior split from the mocked runtime module;
3. `test_tier1_driver`, `test_tier1_fixture`, and `test_tier1_image` behavior
   against recording fakes;
4. host git/worktree/Unix-socket cleanup behavior from
   `test_reviewed_plan_native_discovery.py`; and
5. wrapper behavior from `test_prime_agent_probe_isolation.py`.

- Use non-default body filenames invoked explicitly in tier 1. Host collection
  cannot execute them. No Docker socket/real target channel is added.
- Retain existing host result-verification bridges only where all subject
  behavior occurs in tier 1 and assertions consume owned result artifacts.
- Extend static architecture checks to reject host Node/Prime Agent/gbrain,
  operator-home paths, raw Docker/OpenShell from body code, and unowned paths;
  exempt only the narrow launchers.
- Reconcile all 418 original baseline named behaviors plus the four
  guardrail-repair additions present in the 422-case `ded4a8c` baseline. Outer
  pytest count may change because inner cases move behind bridges; inner +
  outer named counts and mapping are recorded and must have no
  omissions/duplicates.

### Acceptance

- Each group has red-before-green proof that host execution is rejected and
  tier-1 execution passes with Docker socket absent and fakes active.
- Plain pytest remains Docker-free; explicit tier 1 fails non-green when Docker
  or selector setup is unavailable.
- The named behavior manifest accounts for all 422 reconciled baseline cases
  plus later additions exactly once.
- `scripts/test-all.sh` passes all three default tiers within budgets.
- Durable evidence: `docs/evidence/...-slice5-body-moves.md`.

### Rollback

Revert only this move commit. S4 collection guards must remain; reverted bodies
stay non-executable on the host until remigrated.

## 10. Slice 6 — lifecycle fail-closed control boundary

**Bead:** `prime-claw-5v7.7`

**Outcome:** before any live lifecycle mutation is enabled, tier-1
recording-fake tests prove exact OpenShell workspace ownership, explicit opt-in,
safe inspection, and bounded teardown.

### Changes

- Add a narrow host lifecycle support layer under `tests/lifecycle/` with a
  `LifecycleScope` fixture. Live bodies cannot call raw `openshell`/`docker`;
  a static architecture test enforces the boundary.
- Add pytest `--run-lifecycle` but keep
  `scripts/test-all.sh --with-lifecycle` as the deterministic hard error until
  S7. Marker/fixture
  mismatch is collection error; valid marked+fixture without the option is a
  skip with zero mutation.
- Generate full run id, DNS-safe workspace `pct-<12hex>`, target/sentinel
  names, unique image tag, and labels `pc-test=true`, `pc-run=<full-id>`.
  Pin selected gateway + `OPENSHELL_WORKSPACE`; never use default workspace.
- Preflight OpenShell CLI version/capabilities, gateway/server version when
  available, daemon reachability, sanitized offline forbidden identities,
  exact not-found collision state, tracked minimal lifecycle-only policy, and
  a generated config with no local overlay. Scrub credentials/auth redirects.
- Capture ownership only after exact label/policy re-read. Sandbox creation in
  S7 must use `--no-auto-providers`; provider ownership if ever added is
  workspace + unique name.
- Teardown order is sandbox, provider if any, workspace, image. Each uses one
  captured owned identity and present/absent/unknown inspection. Unknown blocks
  and retains evidence.
- Run every launcher/fake/PATH test through tier 1. Cover default workspace/name,
  forbidden collision, existing workspace, label/policy mismatch, malformed
  JSON, incompatible CLI, daemon failure, credential leakage, teardown refusal,
  unknown inspect, evidence retention, and unowned-delete attempt.
- Every recorded mutation event contains gateway/workspace/run identity,
  deadline, evidence destination, OpenShell/client/server version, argv class,
  and result; raw secrets/private endpoints are prohibited.

### Acceptance

- All preflight and ownership failures produce zero mutating calls.
  Post-ownership teardown faults may operate only on captured owned identities
  and must fail while retaining evidence.
- No `--all`, prune, retry loop, broad selector, name guess, default workspace,
  or operator identity appears in allowed commands.
- Default pytest/test-all and arbitrary markers never select lifecycle or
  `macos_host`; lifecycle sequencer flag remains an intentional hard error.
- DEVELOPERS.md records the exact host-observer seam and why a controller
  container is inadequate; `macos_host` registry remains empty.
- Durable evidence: `docs/evidence/...-slice6-lifecycle-guardrails.md`.

### Rollback

This slice performs no live mutation. Revert its commit while keeping
`--with-lifecycle` disabled.

## 11. Slice 7 — real target/sentinel lifecycle proof

**Bead:** `prime-claw-5v7.6`

**Outcome:** an explicitly invoked host observer proves `bin/prime-claw destroy
--yes` deletes exactly one generated test sandbox and nothing else.

### Changes

- Atomically enable `scripts/test-all.sh --with-lifecycle`; after tiers 0–2 it
  invokes only the registered body with pytest `--run-lifecycle`.
- Add `docker/test-lifecycle.Dockerfile` from
  `ghcr.io/nvidia/openshell-community/sandboxes/base@sha256:aeef1c63f00e2913ea002ccb3aaf925f338b5c5d70e63576f0d95c16a138044e`
  and tracked `policies/test-lifecycle.yaml`, a minimal no-egress policy.
  Build via iidfile under unique labels; create target and sentinel with the
  exact owned workspace/policy, `--no-auto-providers --no-tty`, and no
  remote/credential/provider.
- Generate minimal `--config` under run evidence with target sandbox/image and
  no local overlay. Pin gateway/workspace in the process environment.
- Run `bin/prime-claw --config <generated> destroy --yes` without `--image`.
  Require target explicit-absent, sentinel present, both initial provider lists
  empty, sentinel policy identity unchanged, and transcript free of default
  workspace and sanitized forbidden operator identities.
- Do **not** query or snapshot the production sandbox. Separation is proved by
  offline forbidden-identity comparison, workspace isolation, sentinel, and
  command transcript.
- Always enter S6 finalizer and remove sentinel, workspace, and fixture image in
  order with positive absence verification.

### Acceptance

- Wrong-target, sentinel-deletion, and target-preservation red proofs run only
  against recording fakes/inert fixtures. The first real OpenShell run is never
  deliberately mis-targeted or fault-injected.
- Explicit lifecycle run passes within budget and leaves all captured resources
  absent. Target disappears; sentinel remains until finalizer; provider lists
  stay empty; policy/workspace labels match; no operator identity is addressed.
- Simulated teardown/unknown paths fail and preserve evidence; the real run is
  not automatically retried.
- Durable evidence: `docs/evidence/...-slice7-lifecycle-destroy.md`.

### Rollback

Before reverting, tear down only captured scope and prove absence. Unknown
preserves evidence and blocks rollback; never prune or query operator resources.

## 12. Slice 8 — gbrain no-write and whole-source property evidence

**Bead:** `prime-claw-5v7.3`

**Outcome:** the integration fixture proves Phase 3a-supporting properties on
exact synthetic inputs and publishes a bounded consumer packet without acting
on Phase 3a.

### Changes

- Add explicitly invoked non-default in-container bodies
  `gbrain_dry_run_body.py` and `gbrain_source_coverage_body.py`; plain host
  pytest neither collects nor executes them.
- Against a fully migrated seeded database, commit the synthetic delta **before**
  the baseline snapshot, then run exactly:
  `gbrain sync --source fixture --dry-run --no-pull --no-embed --yes`.
  Record stdout
  and exit semantics. Require exact logical equivalence of schema/migration
  identity, rows, failure ledger, bookmark, persistent locks, post-exit fixture
  sessions, config, worktree HEAD/status/tree, and bare refs.
- Run source coverage with exactly
  `gbrain sync --source fixture --no-pull --no-embed --no-extract --yes`.
  Compare every fixture manifest path/slug to DB rows and require
  each exclusion explicit. Add/rename/delete cases must converge; malformed
  frontmatter must either fail without bookmark advance or appear as a named
  accounted exclusion.
- Negative proofs cover stale/incomplete manifest, unexpected bookmark/row/
  lock/ref drift, and unaccounted path/slug. Do not require interrupted-sync
  injection without an upstream-supported deterministic seam.
- If the locked gbrain revision cannot expose these properties under the exact
  flags, stop with evidence. Do not patch or fork upstream gbrain from this repo.
- Reconcile all current tests, prove every `R-TEST-*` inventory entry, run the
  full matrix, and update final docs/evidence schema.
- Produce, but do not apply, this Phase 3a owner note:

  > When the project-wide tier-2 integration fixture is admitted under
  > R-TEST-3/R-TEST-6/R-TEST-13, Phase 3a may cite fixture evidence for exact
  > installed-binary provenance, fully migrated
  > `gbrain sync --dry-run --no-pull --no-embed --yes` logical non-mutation,
  > and
  > synthetic whole-source path/slug accounting. This supports and never
  > replaces authorized host/in-sandbox exact-model probes, operator clearance,
  > the single bounded resumed build, production Git/L7 proof, or cutover. No
  > production dry-run or Phase 3a handoff is authorized.

### Acceptance

- Both properties pass twice with disjoint databases/run identities and
  identical logical results. Injected drift turns each named claim red.
- Tier 0, tier 1, integration, and default test-all are green within budgets;
  lifecycle is reported separately and remains explicit-only.
- Every `R-TEST-*` appears exactly once in inventory with valid proof paths; no
  stale `sandbox` taxonomy remains. Current-main reconciliation finds no
  environment-dependent body outside a container/registered observer.
- Phase 3a packet is offered for owner review; no Phase 3a state is mutated.
- Durable evidence: `docs/evidence/...-slice8-gbrain-properties.md`.

### Rollback

Revert the property/evidence commit and remove only fixture-owned raw results
after verified ownership. Do not alter Phase 3a.

## 13. Final validation matrix

The terminal review requires all of the following:

| Gate | Command / evidence |
|---|---|
| Tier 0 | `python3 -m pytest tests/ -q` |
| Tier 1 | pinned and source selectors through the explicit Docker gate; Docker and selector failure is non-green |
| Integration | `scripts/test-integration.sh` |
| Default complete gate | `scripts/test-all.sh` (tiers 0+1+2) |
| Lifecycle | `scripts/test-all.sh --with-lifecycle` (separate explicit operator run) |
| Inventory | `python3 -m pytest tests/test_inventory_integrity.py -q` plus R-TEST completeness test |
| Safety | no credentials/private endpoints/private brain content; mounts/network/ports/socket inspected |
| Provenance | manifests validate and runtime hashes match for PA, gbrain, images, fixtures, lifecycle scope |
| Git/beads | all accepted slice commits pushed; beads current; branch clean/up to date |
| Consumer boundary | Phase 3a packet reviewed as a proposal only; no live action occurred |

The final default CI interface is exactly `scripts/test-all.sh` on a Linux
Docker host, with `.test-results/` archived. No CI workflow is created.

## 14. Plan-wide rollback and stop conditions

Rollback proceeds in reverse slice order by reverting exact slice commits,
except that S1/S2 may not restore the known host-mutating Prime Agent source
path. Their rollback must leave source mode fail-closed through a minimal
safety-forward commit. Rollback is never a second orchestration system.
Operational cleanup targets captured identities only; no global
Docker/OpenShell prune is permitted.

Stop and return to the owning conversation when:

- a selected source/artifact cannot be identified exactly;
- plain Docker cannot run the pinned gbrain artifact, or the locked revision
  lacks the exact no-pull/no-embed/no-extract property surface;
- test-time network or credential isolation cannot be proved;
- teardown or inspection is unknown;
- a slice would require plugin, `bin/prime-claw`, runtime-image, or upstream
  Prime Agent product-behavior changes;
- a performance budget is exceeded without approved revision;
- a live lifecycle preflight detects collision, label mismatch, daemon/CLI
  ambiguity, or operator-identity overlap; or
- Phase 3a evidence would require a live production action.

## 15. Explicit non-goals

- No GitHub Actions or other CI workflow.
- No production Phase 3a probe, build, policy change, dry-run, cutover, write,
  continuation, or handoff.
- No plugin or runtime product-behavior change.
- No Prime Agent source patch or unsolicited upstream contribution.
- No general orchestration framework, Docker-in-Docker, mounted host Docker
  socket, or controller broker without an occupant.
- No real credentials, private brain content, private endpoint, or production
  remote in fixtures/evidence.
- No default host/macOS acceptance run.
- No shared-base extraction or `prime-claw-blw.4` work.
- No Docker dependency for plain pytest.
- No claim that local bare Git proves production GitHub/L7 transport.
- No semantic embedding-quality test.

## 16. Operator review gate

Review this plan and the refactored specification together. Planning changes
may be made only in this selected future folder. Approval of this plan still
does not authorize implementation; use the separate explicit
`/implement-spec .ralph/plans/future/project-wide-testing-strategy` command
only after the bundle is accepted.
