# Project-wide testing strategy — isolation-first test architecture

> **Status:** FUTURE specification, awaiting operator review.
> **Origin:** operator charter, 2026-10-02 (independent planning-only
> conversation `01a0fe09-9641-73af-9889-b44e302490d1`).
> **Tracking:** `prime-claw-5v7`.
> **Authority:** this specification approves no implementation. Planning
> requires the separate `/plan` workflow; implementation requires
> `/implement-spec`.

## 1. Purpose and core invariant

prime-claw's tests grew around one developer machine. The plugin-tier work
(archived `plugin-test-container` spec) proved the value of physically
isolating the prime-agent under test from the harness doing the development,
but only solved it for the plugin suite. This specification extends that
proof into a **project-wide testing strategy** whose core invariant is:

> **A test body must not be able to observe, mutate, or depend on the
> operator's running Prime Agent harness, gbrain installation, PostgreSQL
> databases, Docker/OpenShell runtime state, credentials, or live source
> checkouts — unless that test is an explicitly justified, individually
> reviewed exception.**

The default realization of the invariant is that test bodies run inside
**disposable Docker environments**: containers created for a test run,
destroyed after it, with their own Prime Agent installs, their own gbrain
executable, their own fixture-owned PostgreSQL, and no credential material.
The invariant is about *effects and dependencies*, not about where a Python
assertion physically executes: a host-side launcher that only drives `docker`
and asserts over returned artifacts is compatible with the invariant, while
an in-container test that reaches the host daemon through a mounted socket is
not.

This is **not** a rigid ban on host processes. The strategy distinguishes
three honest categories and gives each a name, so a test's placement is a
reviewable claim rather than an accident:

- **Test body** — the code whose assertions constitute the test. Default:
  inside a disposable container.
- **Host launcher** — code that builds images, starts/stops containers, and
  collects results. Runs on the host by necessity; contains no product
  assertions. Its *own* tests run in containers against fakes.
- **Host acceptance observer** — a narrow, individually justified test that
  must observe real host behavior (e.g. real macOS Docker Desktop/virtiofs
  mount or teardown semantics). Requires the exception criteria in §8.

### 1.1 Decisions locked with the operator (2026-10-02)

1. **Binaries and databases are not the lifecycle-test risk.** Verified in
   code: the host prime-agent install is only ever *read* (models.json /
   settings.json mirrored hash-verified); the sandbox bakes its own gbrain
   compiled from a staged checkout; the sandbox PostgreSQL lives inside the
   sandbox (`/sandbox/pgdata`, own daemon, own socket) with no host volume,
   no host port, and deny-by-default egress. `bin/prime-claw destroy`
   deletes only the named sandbox container and optionally the image. The
   genuine risk of real lifecycle tests is **shared control-plane state**:
   sandbox names, attached OpenShell providers and egress policy, the
   credentialed L7 Git rule, and the real private brain Git remote. The
   lifecycle-test design (§6) therefore centers on *isolated control scope*,
   not on protecting binaries.
2. **No CI workflow.** The strategy defines the CI *interface* (one entry
   command, exit contract, evidence layout) so any future CI can adopt it;
   no GitHub Actions (or other) workflow is authored in this work.
3. **Tier-0 static tests stay host-executed.** They read repository files
   and touch nothing live; containerizing them buys no isolation. The
   disposable-Docker default applies to tests with environment dependencies,
   not to pure static checks.

### 1.2 Non-goals

- No implementation in this phase; this is a specification only.
- No production Phase 3a dry-run, probe, build, cutover, or routed write.
  Phase 3a remains blocked on its own owner/operator gates; this strategy
  only designs the testing *interface* that can later support them (§10).
- No general test-orchestration framework. Drivers stay dumb sequencers;
  fixtures stay boring. Any component that smells like a framework must be
  justified against this clause.
- No changes to plugin source behavior, `bin/prime-claw` behavior, or the
  OpenShell runtime image's behavior. Test infrastructure only.
- No Docker-in-Docker as a default mechanism. DinD was considered for
  lifecycle tests and rejected as unjustified: decision 1.1.1 establishes
  that binaries/DBs are not at risk, and DinD would not isolate the real
  risk (host control-plane identity) anyway. Recorded here so the question
  stays settled unless new evidence appears.
- No credential material in any test artifact, image, fixture, or evidence
  file. Private brain *content* stays out of tracked evidence; fixture
  corpora are synthetic or operator-approved excerpts.

## 2. Current system (audited 2026-10-02, main @ eb77ca2)

Full evidence: `.test-results/testing-strategy-audit/python-tests.md` and
`mjs-scripts-infra.md` (untracked audit working notes; the load-bearing
facts are restated here).

### 2.1 Tier model today

| Tier | Marker | Meaning today | Runs where |
|---|---|---|---|
| 0 | (unmarked) | static checks, no environment | host pytest |
| 1 | `container` | needs Node / prime-agent / plugin | one session-scoped slim container (`docker/test.Dockerfile`, Ubuntu 24.04 + Node 22 + Python/pytest); host pytest drives via `docker exec` |
| 2 | `sandbox` | labelled "host-orchestrated OpenShell" | host pytest |

`tests/conftest.py` auto-marks `tier1_container`/`ctmp`/`croot` users as
`container` and skips tier-1/2 without an explicit `-m`. `scripts/test-all.sh`
sequences tier 0 → tier 1 (→ tier 2 with `--with-sandbox`), fail-fast.

### 2.2 Audited classification of all current tests

27 Python modules + 6 Node suites + drivers, each classified by execution
locus, host-state contact, and containerizability (audit files carry
file:line evidence per claim):

- **Already compliant (test body in disposable container):** all six
  `.test.mjs` Node suites via their four pytest bridges
  (`test_reviewed_plan_extension`, `test_handoff_chain_extension`,
  `test_project_conversation_extension`,
  `test_goal_heartbeat_work_control_extension`); the in-container halves of
  `test_prime_agent_plugin_install`, `test_conversation_oversight_native`,
  `test_reviewed_plan_native_discovery`. These are "host-launcher" shaped:
  host pytest asserts over in-container execution and shared artifacts.
- **Tier-0 static (stay host per 1.1.3):** `test_execute_skill`,
  `test_future_plan_skills`, `test_inventory_integrity`,
  `test_oversee_episode_skill`, `test_container_helpers_static`,
  `test_brain_query` (fully mocked), `test_brain_repo_config`,
  `test_embedding_preflight`, `test_portable_provider_defaults`,
  `test_prime_agent_probe_isolation` (python child, not real prime-agent),
  `test_runtime_destroy`, `test_runtime_image`, `test_runtime_recover`,
  `test_runtime_status`, `test_runtime_validate`.
  Note: none of these has *any* environment dependency; several carry the
  `sandbox` marker purely as an opt-in grouping label, not a live-sandbox
  requirement. No gbrain, Postgres, network, credentials, or Docker contact
  exists in any of them (endpoints are `.invalid`; SQL is asserted as
  generated strings).
- **Mis-tiered or locus-wrong under the invariant (move with work):**
  - `test_embedding_candidate_build` — spawns real host bash/setsid process
    groups and sends TERM/KILL to prove watchdog semantics. This is POSIX
    behavior that belongs *inside* the Linux container (the sandbox's real
    target), not on macOS.
  - `test_runtime_converge` — mostly in-process/mocked, but one test runs a
    real host `node -e` with the npm-onload preload and a stubbed fetch.
    Needs only Node; belongs in the tier-1 container.
  - `test_tier1_driver`, `test_tier1_fixture`, `test_tier1_image` — meta-
    tests of the driver/fixture/image. They need no real Docker (recording
    fakes on a controlled PATH), but on the host a PATH-override failure can
    reach the real daemon. Inside a container the failure domain collapses.
- **Genuinely host-bound (keep, justify, bound):**
  - `scripts/run-prime-agent-probe.sh` and its test — its purpose is probing
    the *native host* prime-agent through its real resolution paths with
    isolated config stores. Containerizing it defeats it. Kept under the
    existing AGENTS.md guard policy.
  - The launcher layer itself (§4): `scripts/test-all.sh`,
    `scripts/test-tier1.sh`, the conftest session fixture's Docker
    orchestration. Launchers are not test bodies.
  - `scripts/apply-prime-agent-plugin.sh` on the host — an *operator action*
    that intentionally mutates the live `~/.prime/agent`; never a test path
    (tests already exercise it in-container).
  - `bin/prime-claw` production verbs — the product under test is itself a
    host-side orchestrator; its current tests are in-process with mocked
    transport, which is correct.
- **Host-mutation residual to eliminate:** the source-mode fork rebuild —
  `_stage_fork_release` / driver B1 staging runs `rm -rf` of four dist dirs
  plus `npm run build` and `release:pack` **inside the operator's local
  prime-agent fork checkout on the host**. This is the largest remaining
  host-mutation surface in the test path.

### 2.3 Coverage gaps the audit surfaced

- **No real end-to-end lifecycle coverage exists.** Every `test_runtime_*`
  module is offline/mocked; no automated test has ever driven a real
  create/validate/destroy against OpenShell. The `sandbox` tier label
  advertises a capability the suite does not currently have.
- **No integration environment carries gbrain + PostgreSQL.** The slim
  tier-1 image deliberately excludes the brain stack; the runtime image
  bakes it but derives from the OpenShell base and is a *product* artifact,
  not a disposable test environment. Phase 3a's blocked gates (§10) have no
  fixture to run against.
- **No CI exists** (no `.github/`, no other CI config). Greenfield, and per
  1.1.2 this work defines the interface only.
- **Shared-base extraction is deferred** (`prime-claw-blw.4`): the two
  Dockerfiles share only Ubuntu 24.04 lineage. This strategy does not
  require resolving it, but the new integration image (§3.2) creates a
  third consumer that strengthens the case; planning may revisit `blw.4` as
  an option, not a prerequisite.

## 3. Required change: the environment architecture

### 3.1 Tier model, evolved

Four named tiers. Names and markers are chosen so existing muscle memory
survives; re-labeling happens in the migration (§9).

| Tier | Name | Environment | Marker | Default? |
|---|---|---|---|---|
| 0 | **static** | none (host) | unmarked | yes (default gate) |
| 1 | **unit-env** | slim disposable container (existing image) | `container` | yes, in `test-all.sh` |
| 2 | **integration** | disposable brain-stack container (new image, §3.2) | `integration` | yes, in `test-all.sh` |
| 3 | **lifecycle** | host launcher + isolated OpenShell control scope (§6) | `lifecycle` | explicit only |

Placement rule: a test lands in the *lowest* tier whose environment supplies
its real dependencies. Marker labels are never proof of placement; the audit
table (§2.2) is the initial placement record, and each moved test carries
its classification rationale in a short module docstring header.

### 3.2 New disposable environments

**Integration image (`docker/test-integration.Dockerfile`, name TBD in
planning).** A test-only image carrying the brain stack so that
gbrain/Postgres-dependent test bodies run disposably:

- Base: Ubuntu 24.04 lineage shared with the existing images (reuse the
  tier-1 toolchain layer; do **not** derive from the OpenShell base — no
  OpenShell policy layer, no egress mediation, plain Docker only).
- Contents: PostgreSQL 16 + pgvector, and an **exact gbrain executable**
  built from a pinned source (provenance per §5). prime-agent is *not*
  baked; when a test needs one it is installed per-run by the same selector
  contract the tier-1 fixture already uses (`.env`, exactly one of
  `PRIME_AGENT_PINNED` / `PRIME_AGENT_SOURCE`), keeping one install
  mechanism across tiers.
- PostgreSQL is **fixture-owned**: a fresh `initdb` data directory per
  session (per-test when a test declares mutation risk), owned by the
  container user, on container-local storage, destroyed with the container.
  No host port publishing, no host mounts for data.
- The git "remote" for any push/sync test is a **fixture-owned local bare
  repository** created inside the same disposable environment. No real
  remote, no L7 provider, no credentials — by construction there is nothing
  to leak.
- Network: build-time package install only; test-time offline by default.
  Tests needing controlled "remote" behavior use the fixture bare repo or
  in-process fakes.

**Controller / target separation.** Where a test's subject is itself a
container lifecycle (image build, run, teardown semantics — e.g. the tier-1
meta-tests), the test body runs in a **controller container** and the
objects it manages are **targets**. The controller must not receive the host
Docker socket (§7); targets are either real containers on the host daemon
driven by the *host launcher* on the controller's behalf (thin, bounded
command channel), or fakes. Planning chooses the minimal mechanism with
evidence; the specification's requirement is only that the *assertion
logic* runs in the disposable environment and the *irreversible operations*
are performed by the launcher against uniquely-named, test-labelled
resources.

### 3.3 Evidence-backed alternative statement

If investigation during planning shows the integration image cannot support
a required gbrain behavior (e.g. a Bun-compiled binary assumption that fails
on the test base), the documented fallback is a **session-scoped disposable
OpenShell sandbox** as the integration environment — still disposable, still
credential-free, still fixture-owned Postgres — with the added cost recorded
explicitly. "We couldn't make it work" without evidence is not an accepted
alternative.

## 4. Host launcher vs host-executed test

The boundary rule:

- A **host launcher** may: build images; create/start/stop/destroy uniquely
  test-labelled containers; exec into them; read result artifacts from the
  session share; enforce timeouts and teardown. It contains **no product
  assertions**.
- A **host-executed test** is permitted only when it is tier-0 static
  (1.1.3) or a §8 exception. Everything else runs in a disposable
  environment.
- Launcher code gets its own tests (as `test_tier1_*` do today with
  recording fakes) — and those tests move into containers per §2.2.
- The whole-suite entry stays a dumb sequencer (`scripts/test-all.sh`):
  tier 0 → tier 1 → tier 2, fail-fast, tier 3 only on explicit request. No
  growth into a framework (§1.2).

## 5. Exact artifact provenance

Every test run that touches an installed or built artifact must record, in
the gitignored evidence directory (`.test-results/`), a provenance record
containing:

- **Prime Agent:** install mode (pinned release version / source checkout),
  exact version string, and for source mode the fork's HEAD commit SHA plus
  the tarball SHA256 staged into the container. This directly supports
  Phase 3a's B2 finding (installed-binary provenance) by making "which
  binary produced this evidence" a recorded fact, not an assumption.
- **gbrain:** source origin (upstream/fork), exact commit or version, build
  tool version, and executable SHA256, recorded at image build and re-
  recorded (hash only) at session start.
- **Images:** Docker image ID/digest of every test image used, plus the
  Dockerfile path and build-context hash inputs that produced it.
- **Fixtures:** for any brain-source fixture, the source snapshot identity
  (commit or synthetic-corpus manifest hash) and the whole-source file
  inventory hash, so "what the index saw" is exactly reconstructible
  (supports B3, whole-source path/slug coverage).
- Evidence files keep the project's existing convention: sanitized,
  SHA256-recorded, no private endpoints or brain content.

## 6. Isolated Docker/OpenShell control for real lifecycle tests

This tier does not exist yet; this section is the **contract any future
real lifecycle test must satisfy before it may run**. It exists because
decision 1.1.1 identifies the real risk as control-plane state, and because
Phase 3a's remaining acceptance gates will eventually need bounded live
proof.

A tier-3 lifecycle test must:

1. **Never address the operator's configured instance.** It may not use the
   `sandbox_name` or image tag from `config/runtime.json` (currently
   `prime-claw`). It must use its own unique, label-carried identity (e.g.
   `prime-claw-test-<run-id>`) and fail fast if that identity collides with
   an existing sandbox it did not create.
2. **Own its control-plane scope.** Providers, egress policy, and any L7
   rules it creates are test-scoped and removed at teardown. It must not
   modify providers or policies attached to any non-test sandbox.
3. **Use fake or fixture remotes.** No push to the real brain remote; Git
   push targets are fixture bare repositories.
4. **Carry no real credentials.** If a credential-shaped value is needed,
   it is a synthetic placeholder that never resolves.
5. **Verify teardown like the tier-1 fixture does**: bounded removal
   scoped to the captured identity, three-state inspect (present/absent/
   unknown), unknown fails the gate, evidence preserved on failure.
6. **Fail closed on environment ambiguity**: unreachable daemon, unexpected
   pre-existing resources, or a dirty host state stops the run before any
   mutation.

The host launcher performs the irreversible verbs; assertion logic lives in
the test body. Planning decides whether tier-3 bodies run in a controller
container driving the launcher through the bounded channel (§3.2) or remain
carefully scoped host-executed tests; either is acceptable *if* the six
requirements above hold, and the choice must be justified with evidence in
the plan.

## 7. Isolation boundary rules (all tiers)

- **No host Docker socket in any test container.** The socket makes the
  container a host launcher with none of the review surface; forbidden as a
  shortcut. Controller/target separation (§3.2) is the sanctioned pattern.
- **No live mounts.** Test containers mount the repository read-only and a
  fresh per-session share; nothing else from the host filesystem. The
  existing same-absolute-path share technique (conftest) is retained.
- **Temporary homes and config.** Any Prime Agent under test gets a
  container-owned `$HOME` and config roots; any host-side probe keeps using
  the `run-prime-agent-probe.sh` temp-root wrapper. No test may set
  `PRIME_AGENT_*` redirects at a live operator path.
- **No real credentials, live brain, or live sandbox contact.** Credential
  isolation stays exactly as the runtime defines it (OpenShell L7, never on
  disk); tests carry only synthetic placeholders. The production work-life
  brain (local CLI/DB) and personal brain (remote MCP) are out of scope for
  all test tiers; gbrain tests use fixture-owned Postgres only.
- **The source-mode fork rebuild moves off the host** (§2.2 residual):
  planning must provide a builder-container or build-inside-target
  mechanism so the operator's fork checkout is never mutated by a test run.
  Until that lands, source mode remains an operator-acknowledged exception,
  documented in DEVELOPERS.md.

## 8. macOS-specific acceptance exception criteria

Today **zero** tests require the real macOS host (audit-verified). A future
test may claim the exception only when *all* of the following hold:

1. The behavior under test is a property of the macOS hosting stack itself
   (Docker Desktop, virtiofs/gRPC-FUSE mount semantics, macOS process/
   signal behavior) that cannot be faithfully reproduced in a Linux
   container.
2. The claim is written down with the specific seam (e.g. "guest-created
   file `cpSync` EACCES through gRPC-FUSE" — conftest's `croot` rationale)
   and the failed container-based attempt or equivalent evidence.
3. The test is marked `macos-host` (new marker), excluded from all default
   and CI-interface runs, and listed in a registry section of
   DEVELOPERS.md with its justification.
4. The test is read-only against host state wherever physically possible;
   any mutation is scoped to test-owned, uniquely named resources with
   verified teardown.

Conversely, the spec records explicitly: **all** current host-boundary
claims (plugin apply/check correctness, RPC behavior, watchdog semantics,
daemon protocol exchange, brain indexing/query, embedding build) are
provable in containers. The only claims requiring a real host observer are
claims *about* the host Docker/OpenShell/macOS stack itself.

## 9. Migration order, acceptance, rollback, and developer entry

Intended slice order (planning owns the details):

1. **Foundations:** provenance recording (§5) in the existing tier-1
   fixture/driver; integration image skeleton with fixture-owned Postgres
   and exact gbrain; no test moves yet. Acceptance: image builds
   reproducibly, provenance records emitted, existing suites unchanged and
   green.
2. **House moves:** relocate the mis-tiered tests (§2.2):
   `test_embedding_candidate_build` watchdog tests, the npm-onload
   `node -e`, and the `test_tier1_*` meta-tests into containers; re-mark
   the offline `test_runtime_*` modules out of the misleading `sandbox`
   tier (they are tier-0-shaped mocked tests; exact marker scheme in
   planning). Acceptance: per-test red-green proof (prove each moved test
   can fail in its new home before trusting it), same total count, plain
   `pytest tests/ -q` unchanged as the no-Docker default.
3. **Fork-build isolation:** move the source-mode staging build into a
   builder container (§7). Acceptance: source-mode tier-1 run leaves the
   operator fork checkout byte-identical (recorded tree hash before/after).
4. **Lifecycle contract + first occupant:** implement §6 guardrails and, if
   planning finds a justified candidate, one bounded real lifecycle test
   behind the `lifecycle` marker. Acceptance: the guardrails themselves are
   tested (fail-closed on default config, on collision, on dirty state)
   before any real sandbox is touched.
5. **Phase 3a interface admission:** the integration environment is offered
   to the Phase 3a owner as the fixture for B1/B2/B3 support (§10) — as a
   proposal, not a handoff.

**Rollback** is structural at every slice: each slice lands behind markers
and new files; reverting a slice restores the previous tier assignments
without touching other slices. No slice may make an existing default run
slower by more than a planning-set budget or require Docker where it
previously did not.

**Developer entry (CLI/CI interface):** one documented command per
audience, unchanged in spirit from today:

- `python3 -m pytest tests/ -q` — tier 0, zero dependencies (unchanged).
- `scripts/test-all.sh` — tiers 0+1, adding tier 2 when its image exists
  (fail-fast, logs under `.test-results/`).
- `scripts/test-all.sh --with-lifecycle` — explicit tier 3 (replaces
  `--with-sandbox`; planning owns the compat shim/renaming).
- CI interface contract (no workflow per 1.1.2): any future CI runs exactly
  `scripts/test-all.sh` on a Linux Docker host and consumes its exit code
  and `.test-results/` evidence layout. That contract is the whole CI
  deliverable.

Every migration step updates `config/requirements-inventory.json`
traceability per the project's apply/check/validate/test discipline.

## 10. Phase 3a dependency interface (proposal, not handoff)

Phase 3a is a **dependent consumer**, blocked on its own owner/operator
gates; nothing in this strategy unblocks, runs, or handoffs any of it. The
independent method review found three testing-relevant gaps in its evidence
base. This strategy designs the interface that can later support them:

- **B1 — no admitted isolated integration fixture.** The tier-2 integration
  environment (§3.2) *is* that fixture: disposable, gbrain + fixture-owned
  Postgres, exact-executable provenance, fixture git remote, offline at
  test time. Admission criteria for Phase 3a use: the fixture builds
  reproducibly, its provenance record is emitted, and its no-write claims
  are self-tested (failure injection, §11).
- **B2 — installed-binary provenance and dry-run lock/migration effects.**
  The provenance contract (§5) records exactly which gbrain binary produced
  any evidence. Dry-run safety claims (e.g. `gbrain sync --dry-run` truly
  writing nothing — no locks retained, no migration applied, no bookmark
  movement) become *testable properties* in the fixture: snapshot the
  fixture DB (schema + data + lock state) before/after a dry-run and assert
  byte-level equivalence. A green count never proves source eligibility;
  only the named property tests do.
- **B3 — whole-source path/slug coverage.** The fixture's source corpus
  supports arbitrary snapshots (real brain *structure* with synthetic or
  operator-approved content), and the whole-source inventory hash (§5)
  makes coverage claims exact: every path/slug in the corpus is either
  indexed or explicitly accounted for.

**Proposed narrow amendment for the Phase 3a owner to review** (text for
`prime-claw-zwg.5` / the owner note; this conversation does not modify that
episode's plan):

> "When prime-claw's tier-2 integration fixture is admitted (per
> `project-wide-testing-strategy` §3.2/§5/§10), Phase 3a Slice 2/5
> acceptance may cite fixture-produced evidence for: (a) installed-binary
> provenance (B2a), (b) dry-run no-write property including lock and
> migration state (B2b), and (c) whole-source path/slug coverage parity
> (B3). Fixture evidence supports — and never replaces — the separately
> authorized live gates: host/in-sandbox exact-model probes, operator
> clearance, and the single bounded resumed build remain owner-gated. No
> production dry-run runs under this amendment; eligibility of a source
> tree is never inferred from fixture test counts."

## 11. Bounded cleanup and failure injection

- **Cleanup** everywhere follows the tier-1 fixture's proven contract:
  uniquely identified resources, bounded single removal, three-state
  presence verification (present/absent/unknown — unknown fails), evidence
  share preserved while ownership is uncertain, no global prunes, no
  name-based guesses. The integration environment adds: Postgres data-dir
  lifecycle bounded by the container's own; fixture bare repos destroyed
  with the session.
- **Failure injection** is a first-class requirement for any component that
  claims a safety property. Minimum injected-failure set per such
  component: teardown failure (container/sandbox refuses to die), daemon
  unreachable mid-run, unknown-state inspect, partial write (interrupted
  sync), stale artifact (pre-existing dist/output), and selector ambiguity
  (both/neither install selectors). Each safety claim in §5–§7 ships with
  at least one test that makes it fail. This mirrors the existing
  prove-it-can-fail discipline in DEVELOPERS.md.
- **Timeout policy:** every external wait has a hard deadline with kill
  escalation (the existing `timeout --kill-after` pattern); teardown paths
  carry their own bounded budgets independent of test timeouts.

## 12. Boundaries and review gates

- Planning-only until the operator approves this specification; execution
  planning via `/plan`; implementation only via `/implement-spec`.
- The plan must not grow a general orchestration framework; any component
  beyond dumb sequencer + boring fixtures requires explicit justification
  against §1.2.
- Open questions explicitly left to planning (with evidence requirements):
  the exact controller/target channel mechanism (§3.2); whether tier-3
  bodies run in-container or scoped-host (§6); marker renaming details and
  `--with-sandbox` compat (§9); whether `prime-claw-blw.4` shared-base
  extraction is revisited (§2.3).
- Private brain content, private endpoints, and credential material never
  enter tracked files, images, fixtures, or evidence.
