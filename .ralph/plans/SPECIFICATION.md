# Project-wide testing strategy — isolation-first test architecture

> **Status:** ACTIVE implementation episode created from the operator-approved
> bundle on 2026-10-02. Owner rejected Slice-1 candidate `fd1f2b7`; the
> accepted B1–B8/R-TEST-7 repairs are implemented, validated, and ready for a
> new owner-review candidate. Later slices remain unstarted.
> External prerequisites remain satisfied by `3bf9059` / `927b394`.
> **Origin:** operator charter, 2026-10-02 (independent planning-only
> conversation `01a0fe09-9641-73af-9889-b44e302490d1`).
> **Tracking:** planning bead `prime-claw-5v7`.
> **Execution plan:** [EXECUTION_PLAN.md](EXECUTION_PLAN.md).

## 1. Purpose and invariant

prime-claw's tests grew around one developer machine. The archived
`plugin-test-container` work proved that the Prime Agent under test can be
physically isolated from the harness doing development. This specification
extends that proof to every environment-dependent test.

**R-TEST-1 — isolation invariant.** A test assertion must not observe,
mutate, or depend on unrelated or operator-owned Prime Agent, gbrain,
PostgreSQL, Docker/OpenShell resources, credentials, or writable external
source checkouts unless it is an explicitly justified, individually reviewed
host acceptance observer (§8). A host launcher may check daemon readiness and
inspect only exact run-owned resources. The prime-claw repository under test is
an allowed read-only input; its exact commit and dirty state are recorded. An
operator-selected external source is allowed only as a read-only,
provenance-recorded input that is copied to an immutable run-owned snapshot.

The default realization is a disposable Docker environment created for one
test run and destroyed afterward. It owns its Prime Agent installation,
gbrain executable, synthetic fixtures, PostgreSQL data, Git remotes, home,
and configuration. It receives no credentials.

The invariant governs dependencies and effects, not the physical location of
every Python comparison. A host process may launch containers and verify a
bounded result envelope made only from the disposable environment's exit
status and exported artifacts. It may not make a product claim from host
behavior, inspect live operator state, or let the container reach such state.

### 1.1 Terms

- **Container-driven test** — the subject behavior executes in a disposable
  container. A host-side pytest bridge may verify its exit status and exported
  artifacts when those are the complete evidence surface. Existing tier-1
  bridges use this pattern.
- **Host launcher** — code that builds images, starts/stops uniquely owned
  resources, executes commands, collects artifacts, applies deadlines, and
  verifies teardown. It may test its own orchestration contract with fakes and
  may validate result-envelope integrity; it does not substitute host behavior
  for the product behavior being claimed.
- **Host acceptance observer** — a narrow, registered exception whose subject
  is the real host Docker/OpenShell/macOS stack and therefore cannot be proved
  in an ordinary Linux container. It must satisfy §8.
- **Test fixture** — synthetic or operator-approved non-private input owned by
  a test run. It never means a copy of the live brain, database, credential
  store, or configured production sandbox.

### 1.2 Operator-locked decisions

1. **Lifecycle risk is shared control-plane state.** The host Prime Agent
   install is read-only in production staging, the sandbox bakes its own
   gbrain, sandbox PostgreSQL is private to `/sandbox`, and destroy targets a
   named sandbox. The material lifecycle risk is collision with sandbox names,
   providers, egress policy, L7 rules, or the real brain remote. Tier 3 must
   isolate those identities and fail closed.
2. **No CI workflow is authored.** This work defines one stable command, exit
   contract, and evidence layout for a future CI system to consume.
3. **Tier-0 static tests stay on the host.** Pure repository checks have no
   environment dependency, so containerizing them adds cost without improving
   isolation.

### 1.3 Non-goals

- No production Phase 3a dry-run, model probe, build, cutover, routed write, or
  owner handoff. Phase 3a keeps its own operator gates.
- No general test-orchestration framework. Drivers remain dumb sequencers and
  fixtures remain explicit.
- No change to plugin behavior, `bin/prime-claw` production behavior, or the
  OpenShell runtime image's behavior.
- No Docker-in-Docker and no host Docker socket mounted into a test container.
- No credential material, private endpoints, or private brain content in an
  image, fixture, log, evidence file, or tracked artifact.
- No CI provider configuration.
- No shared Docker-base extraction in this work. `prime-claw-blw.4` remains a
  separate, non-blocking follow-up because changing the proven OpenShell base
  is not required for test isolation.

## 2. Required tier architecture

**R-TEST-2 — lowest sufficient tier.** Every test is assigned to the lowest
numbered tier that supplies its real dependencies. A marker is a selection
mechanism, not proof that placement is correct.

| Tier | Name | Environment | Pytest marker | Default whole-suite gate |
|---|---|---|---|---|
| 0 | **static** | host, repository-only | unmarked | yes |
| 1 | **unit-env** | existing slim disposable container | `container` | yes |
| 2 | **integration** | disposable gbrain + PostgreSQL container | `integration` | yes |
| 3 | **lifecycle** | real host Docker/OpenShell control plane, guarded by §6 and §8 | `lifecycle` | no; explicit only |

Plain `python3 -m pytest tests/ -q` remains tier 0 and must not require Docker,
Node, Prime Agent, gbrain, PostgreSQL, OpenShell, network, credentials, or a
local `.env` selector.

### 2.1 Tier 1 — unit-env

Tier 1 remains the slim Ubuntu 24.04 + Node + Python/pytest environment proven
by `docker/test.Dockerfile`. It supplies Prime Agent through the existing
exactly-one selector contract (`PRIME_AGENT_PINNED` or
`PRIME_AGENT_SOURCE`) and runs plugin, Node, POSIX-process, wrapper, and test-
infrastructure behavior without the brain stack.

Environment-dependent bodies that need only this toolchain belong here,
including the embedding watchdog process-group tests, the npm-onload Node
probe, and tests of launcher/fixture code against recording fakes.

Tier-1 setup installs and checks the plugin only inside the disposable
container with `PRIME_AGENT_PLUGIN_ROOT=/root/.prime/agent`. Containerized gates
must never require a prior host-global apply/check run, inherit the host `HOME`,
or use the operator's installed copy. Bare apply/check fail closed. The
user-global path requires deliberate `--user-global` activation from the primary
`main` checkout after acceptance; it is not a prerequisite for Docker testing.

### 2.2 Tier 2 — integration

**R-TEST-3 — disposable brain stack.** Tier 2 is a plain-Docker Ubuntu 24.04
image, not an OpenShell runtime image. It provides:

- PostgreSQL 16 and pgvector;
- an exact gbrain executable compiled from an explicitly selected Git source
  revision;
- a fresh fixture-owned database and data directory per session, or per test
  when mutation isolation requires it;
- a synthetic source corpus and a fixture-owned local bare Git remote;
- a deterministic local fake for any embedding response needed by an offline
  property test;
- a container-owned home and configuration; and
- optional per-run Prime Agent installation through the same selector contract
  as tier 1 when a future integration test actually needs Prime Agent.

No database port is published. No host data directory is mounted. Test-time
external network is disabled. Build-time package/source acquisition is the
only networked phase.

A local bare remote tests gbrain/Git fixture behavior only. It does not widen
`bin/prime-claw`'s production `owner/repository` interface and is not used to
fake a production lifecycle flow.

### 2.3 Controller/target boundary

**R-TEST-4 — no implicit host control.** A test container never receives the
host Docker socket. Launcher and fixture meta-tests use recording fakes inside
tier 1. If a future in-container assertion body must control a real target
container, a separately reviewed bounded launcher channel is required; that
mechanism is not needed or implemented by this plan. Real OpenShell behavior
uses the registered host-observer exception instead (§8).

## 3. Host launcher contract

**R-TEST-5 — narrow launcher.** A host launcher may only:

- build test images;
- create/start/stop/destroy uniquely identified test resources;
- execute bounded commands in them;
- export sanitized artifacts into a fresh `.test-results/<run-id>/` directory;
- enforce hard deadlines and TERM→KILL escalation; and
- verify absence with a three-state result: present, absent, or unknown.

Unknown is failure. Launchers never use global prune, broad name matching, or
operator-configured production identities. Their own behavioral tests run in
tier 1 against recording fakes so a broken PATH override cannot reach the real
Docker/OpenShell CLI.

## 4. Exact artifact provenance

**R-TEST-6 — provenance manifest.** Every run that installs or builds an
artifact emits a sanitized machine-readable manifest under `.test-results/`.
It records:

- **repository under test:** HEAD plus a sanitized dirty-state/content
  identity for the read-only prime-claw input;
- **Prime Agent:** selector mode, requested version, installed version, and,
  for source mode, source HEAD, dirty-state/content identity, staged release
  SHA256, and installed package identity;
- **gbrain:** upstream/fork origin, source HEAD or release version, source
  archive/inventory SHA256, build tool version, executable version, and
  executable SHA256;
- **images:** immutable image ID/digest, Dockerfile path, and the declared
  build-input hash;
- **fixtures:** synthetic-corpus manifest hash, whole-source path/slug
  inventory hash, and local bare-remote identity; and
- **lifecycle scope:** OpenShell gateway/workspace identity, workspace and
  sandbox ownership labels, captured target/sentinel identities, and fixture
  image ID/labels when tier 3 runs; and
- **run metadata:** run id, tier, UTC timestamps, command contract version,
  and sanitized evidence-file hashes.

A source commit alone is not exact when the source tree is dirty. Source-mode
Prime Agent tests may exercise dirty work, but must stage it read-only into a
builder container and record a deterministic content hash. gbrain integration
builds use an explicit committed revision/archive so the image input is pinned.

No manifest contains source content, credentials, private endpoint values, or
private repository identity.

## 5. Isolation rules shared by all container tiers

**R-TEST-7 — container boundary.** Tier 1 and tier 2 enforce all of the
following:

- repository mount read-only;
- only a fresh run-owned share mounted read/write;
- no Docker/OpenShell socket, host `$HOME`, live config root, database volume,
  browser store, credential store, or arbitrary checkout mount;
- explicit environment allow-list rather than inherited host environment;
- container-owned `$HOME`, Prime Agent roots, gbrain home, PostgreSQL data,
  temp directories, and Git config;
- test-time offline by default; synthetic in-container services for controlled
  remote behavior; and
- bounded teardown with evidence preserved when ownership or absence is
  uncertain.

**R-TEST-8 — source-build isolation.** Prime Agent source mode may read an
operator-selected checkout only through a read-only mount. Build and pack occur
in a disposable builder container against a container-local copy. A test run
must leave the selected checkout byte-identical before/after.

The native `scripts/run-prime-agent-probe.sh` remains a guarded operator tool.
Tests of its isolation contract can run in tier 1; no automated suite invokes
the host's real Prime Agent through it.

## 6. Tier-3 lifecycle contract

**R-TEST-9 — isolated lifecycle scope.** Before any real lifecycle test may
mutate the host control plane, it must satisfy all of these:

1. Generate a unique run identity, a non-default OpenShell workspace, and
   test-prefixed sandbox/resource names. Workspace and sandbox labels carry the
   full run identity; provider ownership, if ever added, is workspace plus a
   unique name. It must never read a production `sandbox_name` or image tag as
   its target.
2. Pin every OpenShell call to the selected gateway and owned workspace. Query
   by exact identity/selector and fail before mutation on collision,
   ambiguous state, unreachable daemon, incompatible OpenShell CLI behavior,
   or an unowned pre-existing resource.
3. Use a test-owned config, tracked minimal lifecycle-only policy, image
   reference, provider set, and evidence directory. Sandbox creation disables
   automatic providers explicitly. The first lifecycle occupant uses no
   provider and no brain remote; future provider/L7 tests require a separate
   review.
4. Carry no real credentials. Credential-shaped values are non-resolving
   synthetic placeholders only.
5. Compare generated identities against a sanitized offline forbidden list,
   then audit the captured command transcript to prove no operator sandbox,
   image, provider, policy, or default workspace was ever addressed. The test
   does not query the production sandbox.
6. Remove only captured test-owned identities, then verify absence with the
   present/absent/unknown contract. Unknown or teardown failure is a failure,
   and evidence is retained.
7. Test every destructive guard with fakes before enabling the live path:
   default-name rejection, collision, selector ambiguity, daemon failure,
   teardown failure, and unknown inspect.

Lifecycle acceptance is explicit-only. A lifecycle test must carry the marker,
request the scoped fixture, and receive pytest's dedicated `--run-lifecycle`
option; `-m lifecycle` alone is insufficient. It never runs from plain pytest,
the default whole-suite command, or the future CI interface. `macos_host` has a
separate explicit opt-in.

## 7. Cleanup, failure injection, and no-write claims

**R-TEST-10 — prove safety can fail.** Each component claiming a safety
property has at least one negative test. The required failure set, applied
where relevant, is:

- teardown refusal;
- daemon loss mid-run;
- unknown inspect state;
- interrupted/partial write;
- stale artifact or pre-existing output;
- both/neither artifact selectors;
- resource-name collision; and
- unexpected host-state drift.

Every external wait has a hard deadline. Teardown has its own bounded budget,
independent of the test deadline.

A gbrain `--dry-run` no-write claim is proved with an exact **logical** before/
after snapshot: schema/migration identity, relevant row sets, source bookmark,
persistent lock ownership, and configuration/source hashes. Raw PostgreSQL
storage bytes and WAL are not compared because they can change without a
logical product mutation.

## 8. Host acceptance observer exceptions

**R-TEST-11 — reviewed host observer.** A host-executed assertion body is
allowed only when all of these hold:

1. The subject is a property of the real hosting stack (for example OpenShell
   control-plane lifecycle, Docker Desktop, virtiofs/gRPC-FUSE, or macOS
   process behavior) that a Linux container or recording fake cannot prove.
2. The exact seam and the inadequate container/fake alternative are recorded.
3. The test is individually listed in the DEVELOPERS.md exception registry,
   marked `lifecycle`, and excluded from default and CI-interface runs.
4. Reads are preferred. Any mutation uses unique, test-owned resources and
   satisfies §6 teardown.
5. The test cannot load live credentials, brain content, or production config
   as fixture input.

A specifically macOS-only observer additionally uses the `macos_host` marker.
At specification time no current test needs that marker.

The first justified host observer creates an owned workspace, fixture image,
tracked minimal policy, and two `--no-auto-providers` sandboxes: a target and a
sentinel. It runs the product's bounded `destroy --yes` path against the
generated target config, proves the target absent and sentinel present, then
removes the remaining owned scope. The captured transcript proves the operator
sandbox and default workspace were never addressed. Full production
`create`/`validate` is not part of this work because those paths structurally
require real providers and a production-shaped remote.

## 9. Developer and future-CI interface

**R-TEST-12 — stable entry contract.** The documented interfaces are:

```bash
python3 -m pytest tests/ -q              # tier 0 only; no Docker
scripts/test-all.sh                      # tiers 0 + 1 + 2, fail-fast
scripts/test-all.sh --with-lifecycle     # tiers 0 + 1 + 2 + explicit tier 3
```

`--with-sandbox` is not aliased to a newly mutating action. During migration it
hard-errors with guidance to use `--with-lifecycle`, whose separate preflight
and explicit pytest opt-in protect the live path.

A future Linux-Docker CI system runs exactly `scripts/test-all.sh`, consumes its
exit code, and archives `.test-results/`. This specification creates no CI
workflow and excludes lifecycle/host-observer tests from that contract.

Default-run performance budgets are execution-plan decisions measured from a
recorded baseline. A cold image build is reported separately from warm-cache
suite time.

## 10. Phase 3a dependency interface

**R-TEST-13 — evidence support, not authorization.** After tier 2 meets this
specification, the Phase 3a owner may review fixture-produced evidence for:

- exact installed gbrain binary provenance;
- logical no-write behavior of
  `gbrain sync --source fixture --dry-run --no-pull --no-embed --yes` on a
  fully migrated baseline, including migration identity, bookmark, row,
  and persistent-lock state; and
- whole-source path/slug accounting against the synthetic fixture manifest.

Fixture evidence supports but never replaces live owner-gated proof. It does
not authorize a production dry-run, exact-model probe, resumed build, policy
application, cutover, or routed write. The fixture's local bare Git remote is
not evidence that the production L7 Git path works.

The proposed owner-note wording is maintained in the execution plan. Applying
that wording to another episode remains that episode owner's decision.

## 11. Completion criteria

The strategy is complete when:

1. all `R-TEST-*` requirements are represented in
   `config/requirements-inventory.json` with executable coverage;
2. every environment-dependent body is container-driven or appears in the
   explicit host-observer registry;
3. tier 2 proves its exact artifact, fixture-owned database, offline synthetic
   corpus, and local bare-remote contracts;
4. source-mode Prime Agent builds leave the selected checkout byte-identical;
5. the lifecycle guardrails fail closed under injected failures and the first
   credential-free observer passes when explicitly invoked;
6. the three documented entry commands have stable exit/evidence contracts;
7. DEVELOPERS.md and test architecture documentation match the implementation;
   and
8. every implementation slice is reviewed, committed, pushed, and reflected in
   its bead.
