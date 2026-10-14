---
id: PRIMECLAW-41
title: 'Historical: Superseded incomplete Phase 3a brain-hosting BUFD'
status: Done
assignee: []
created_date: '2026-10-14 02:51'
updated_date: '2026-10-14 02:54'
labels: []
dependencies: []
references:
  - >-
    .ralph/plans/archive/phase3a-bufd-superseded-incomplete/DECISIONS.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase3a-bufd-superseded-incomplete/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase3a-bufd-superseded-incomplete/REQUIREMENTS.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase3a-bufd-superseded-incomplete/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - PRIMECLAW-7
priority: p2
type: epic
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Requirements imported from `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/REQUIREMENTS.md`

# Requirements — Phase 3a: Tracer Bullet (a brain-hosting claw)

Beads: `prime-claw-zwg` (P1). Index:
[SPECIFICATION.md](SPECIFICATION.md). Decisions: [DECISIONS.md](DECISIONS.md).

Each requirement has an ID for traceability from [DECISIONS.md](DECISIONS.md). Prefix `R3a-`.
Priority: **GATE** = must hold for the slice to be accepted; **CONDITIONAL GATE** = must
hold when that optional profile is selected; **NICE** = desired, may slip.

## Functional

- **R3a-1 (GATE) — Brain present in-sandbox.** The operator's brain repo is cloned into
  the sandbox at a known, configurable path (default `/sandbox/brain`), reachable by the
  in-sandbox prime-agent. Content only — no credentials carried in.
- **R3a-2 (GATE) — In-sandbox index serving.** The in-sandbox gbrain + Postgres + pgvector
  index the cloned brain as the `brain` source; `gbrain` queries run against in-sandbox PG
  (`localhost:5433`), no host dependency at query time.
- **R3a-3 (GATE) — Cited read/query.** From a conversation with the sandboxed prime-agent,
  an operator question is answered correctly **with a citation** to a brain page. Proves
  search + retrieval inside the container.
- **R3a-4 (GATE) — One routed write.** The agent writes one durable fact into the
  in-sandbox brain via `gbrain put <type/slug>` + `gbrain sync --source brain`, routed per
  `docs/information-architecture.md` (brain = canonical store). The write is a test
  artifact: either easily deleted (markdown is source-of-truth) or a keep-worthy stub
  (the operator-approved `projects/prime-claw` page). The agent commits
  and pushes the change from the sandbox clone to the real brain repo through the Slice 1
  GitHub L7 provider. Receipt = page slug + commit SHA + push result.
- **R3a-5 (GATE) — Lifecycle integration.** Brain clone + index are wired into
  `bin/prime-claw` (a stage and/or verb), idempotent and re-runnable, so a fresh
  `create`/`converge` yields a brain-hosting sandbox without manual steps.
- **R3a-6 (GATE) — Acceptance gate.** `bin/prime-claw validate` (or a dedicated check)
  proves R3a-1..4 green and records evidence (page count, the write receipt) under
  `docs/evidence/`.

- **R3a-0 (GATE) — Slice-0 upstream-gbrain spike.** Before the rest of the slice, prove in
  real code that **upstream `garrytan/gbrain`** runs correctly in the OpenShell sandbox with
  **prime-agent as the mode-(a) harness-as-controller** (drives the gbrain CLI + manages the
  in-sandbox DB). The spike also surfaces whether any prime-agent-vs-other-harness difference
  is too big to overcome elegantly (deciding D3a-H's fallback). Verdict GO = build on
  upstream (fork only to author the prime-agent-harness PR, then retire it); verdict NO-GO =
  documented thin-fork fallback. Mode (b) participant-MCP is secondary; not required for GO.

## Non-functional / constraints

- **R3a-7 (GATE) — Credential isolation.** Inference auth stays on the host L7 provider;
  no real LLM credentials on sandbox disk. The brain clone carries no secrets.
- **R3a-8 (GATE) — Reuse, don't re-test.** Do not re-test gbrain's CLI/sync/embedding or
  the browse shim — already proven upstream (zbrain ~1,626 tests). Tests cover only the
  prime-agent-harness integration and the clone/index/validate wiring.
- **R3a-9 (GATE) — Generic platform.** No operator-specific values are hardcoded. Brain
  repository identity is operator-owned configuration, never a tracked default or code fallback;
  the brain's entity taxonomy is NOT encoded in prime-claw (IA two-level split).
- **R3a-10 (GATE) — Single-gateway discipline.** `openshell` (17670) only.
- **R3a-11 (GATE) — Offline tests.** New pytest coverage monkeypatches sandbox/exec
  boundaries (no live sandbox needed for the unit suite).
- **R3a-12 (GATE) — Selected embedding-profile freshness.** The in-sandbox index uses one
  explicitly selected embedding profile and one vector space: no mixed-model vectors,
  NULL/stale embeddings, or keyword-only acceptance. The repository default is Zendesk AI
  Gateway `openai:text-embedding-3-large` at 1536 dimensions. An explicit operator override
  may select another provider/model/dimension (including home `Qwen3-Embedding-8B` at native
  4096), but changing vector spaces requires a full non-destructive re-embed before cutover.
- **R3a-13 (GATE) — prime-agent config mirrors explicit user choice; credentials remain
  isolated.** Explicit host `models.json` and `settings.json` are mirrored verbatim and take
  precedence, while host `auth.json` is never copied. The selected provider's real credential
  stays in OpenShell; sandbox auth contains only non-secret adapter data and placeholders. With
  no existing preferred host config, the portable inference default is Zendesk AI Gateway
  `anthropic.kimi-k3`; `anthropic.glm-5.2` remains a supported gateway alternative. The
  2026-09-16 cited-query proof used the operator's explicit `openai-codex/gpt-5.6-sol`
  override and remains valid evidence of override/credential isolation, not the repo default.
  Override paths remain available through `host_models_json` /
  `PRIME_CLAW_HOST_MODELS_JSON` and `host_settings_json` /
  `PRIME_CLAW_HOST_SETTINGS_JSON`.
- **R3a-14 (CONDITIONAL GATE) — Non-destructive local-Qwen override cutover.** When an
  operator explicitly selects the home-Qwen profile, build it in a parallel Postgres
  database/index from the canonical brain clone, validate page/chunk counts, 4096-dimensional
  vectors, freshness and semantic retrieval, then switch only that operator's runtime. Keep
  the default/previous 1536-dimension database untouched as rollback. The private endpoint
  enters only through ignored local config or `PRIME_CLAW_*`, never tracked defaults, logs, or
  evidence. Policy grants only its exact host/port. This optional profile must not remove or
  redefine the portable Zendesk AI-gateway default.
- **R3a-15 (GATE) — Portable tracked defaults with explicit override precedence.** A clone of
  prime-claw with no existing preferred provider configuration defaults both concerns to the
  Zendesk AI Gateway: inference `anthropic.kimi-k3` (GLM allowed as an explicit alternative)
  and embeddings `openai:text-embedding-3-large` at 1536 dimensions. Explicit host/local/env
  configuration overrides inference and embeddings independently. Tracked config must require
  neither a DGX/private endpoint nor Codex OAuth, and tests must prove this precedence.
- **R3a-16 (GATE) — Explicit per-operator brain repository is mandatory.** Prime-claw has
  no tracked, fallback, public starter, or example brain repository. Every operator must set
  `brain_repo` through ignored local configuration or `PRIME_CLAW_BRAIN_REPO` before any
  repository-dependent lifecycle, validation, recovery, embedding-build, write, or push action.
  Missing or malformed configuration fails before mutation with a clear error naming both setup
  paths. Joe's `JLandersZen/brain` is a proving-instance value only and must live in ignored local
  config; historical evidence may name it but active defaults, code fallbacks, and generic tests
  may not. `brain_branch` may retain the non-personal default `main`.

## Out of scope (recorded for traceability)

- Porting the full memory/collect/triage/ingest skill set (3b).
- Browse proxy-shim recreation (3c). Channels (3d). Scheduling via `prime-agent schedule`
  (3e). `brain.cron` is not ported at all.
- The operator instance repo (`prime-pva`) — created at 3b.
- Episode loop, comms channels, orchestrator (Phases 4–6).

## Specification imported from `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/SPECIFICATION.md`

# Specification — Phase 3a: Tracer Bullet (a brain-hosting claw)

**Status:** BLOCKED — fresh post-clearance host exact-model probe returned HTTP 502; no sandbox probe or restart; Slice 4B remains deferred
**Beads:** `prime-claw-zwg` (P1)
**Date:** 2026-09-11 · **Slice 4A execution updated:** 2026-09-18
**Supersedes / draws on:** zbrain parked spec `.ralph/plans/future/prime-agent-in-brain-container/` (bead `zbrain-t6m`) — its container-install mechanics informed Phase 2; its unresolved harness-mapping blocker is what prime-claw exists to solve.

> **Post-clearance preflight blocker (2026-09-18):** after Joe reported the service ready, the
> required single bounded host exact-model probe returned HTTP 502 with zero embedding values.
> Prime-claw did not retry, did not apply the candidate policy, did not run the sandbox probe, and
> did not start a build. Zero gbrain processes remain; canonical state is unchanged; the candidate
> remains preserved at 952 pages / 2,863 valid 4096d chunks without a bookmark. Do not probe or
> restart until the operator clears the HTTP 502 condition. No acceptance or cutover has started.

This document is the summary and index for the work. It is accompanied by:

- **[REQUIREMENTS.md](REQUIREMENTS.md)** — the specific requirements discovered during discussion.
- **[DECISIONS.md](DECISIONS.md)** — design decisions, each traced to the requirement(s) it satisfies.

This is a specification of *what* must change and *why*. It is not an execution plan; that comes later.

---

## 1. Background — the system as it is now

**Phase 2 (complete, archived)** delivered a reliable, repeatable OpenShell sandbox
lifecycle behind `bin/prime-claw` (verbs: status, build, create, converge, validate,
recover, destroy). The sandbox image (`docker/runtime.Dockerfile` →
`prime-claw-brain:0.1.0`) already bakes in:

- **prime-agent 0.9.3** (installed at `/sandbox/.npm-global`, daemon + persistent REPL).
- **gbrain 0.49.0** (Bun-compiled binary at `/usr/local/bin/gbrain`).
- **Postgres 16 + pgvector 0.6**, agent-owned `PGDATA=/sandbox/pgdata`, listening on
  `localhost:5433` inside the sandbox only (no host forward; deny-by-default egress).

Inference **credential isolation** remains settled: a host OpenShell provider holds the
real credential, only opaque placeholders enter the sandbox, and L7 swaps real values at
the boundary. Explicit user configuration controls provider/model when present. With no
preferred config, the portable repository defaults use the Zendesk AI Gateway for both
concerns: inference `anthropic.kimi-k3` (GLM supported as an alternative) and embeddings
`openai:text-embedding-3-large` at 1536 dimensions. The operator's Codex inference and
home-network `Qwen3-Embedding-8B`/4096 embedding profile are valid independent overrides,
not tracked prerequisites. The claw never possesses real LLM credentials
(R-X-5 / R2-X-1 / R3a-13/R3a-15).

Brain content has deliberately **no no-config default**. Every operator must explicitly configure
`brain_repo` through ignored local config or `PRIME_CLAW_BRAIN_REPO`; there is no public starter
or example brain. Repository-dependent commands must reject missing or malformed configuration
before mutation. Joe's private repository is only the historical proving instance, never a
tracked platform value (R3a-9/R3a-16; D3a-N).

**Execution state (2026-09-17):** Slices 0–3 now clone the real brain, serve its in-sandbox
index, and let a sandboxed Prime Agent answer with citations. Slice 4R removes repository identity
from tracked defaults and enforces explicit operator setup before repository-dependent actions.
That 1536-dimensional AI-gateway index is the implemented portable default profile under R3a-15. For this operator's explicit local override, Slice 4A.1
validates the home-Qwen endpoint contract and 4A.2 has a preserved partial 4096-dimensional
candidate. The 2026-09-18 resumed build advanced it to 439 pages / 1,459 current 4096d chunks,
then stopped safely after thermal containment denied sustained work. The operator fixed the latched
sleep retry, the 180-second snapshot window cleared, and an exact-model probe returned 200/4096.
Because this operator requires local Qwen, Slice 4A remains active; first land the full-sync
fail-fast fix, then resume exactly one isolated build; the routed write/push proof follows in Slice 4B.
Phase 2 proved the *container*; Phase 3a is finishing the *brain-hosting claw*.

## 2. The strategic frame (why this phase, this shape)

prime-claw is to gbrain as **zbrain was to ralph-pva**: the generic, reusable platform;
the operator's instance (their brain repo, channels, personal skills) sits on top. The
long-run goal is that prime-claw **fully replaces zbrain as the brain container**, with
**prime-agent at the center** (not gbrain's bash/Claude/Codex harness assumptions).

- **Platform vs instance.** prime-claw (platform) must be usable by *anyone* to host
  *their* brain. Joe's brain (`~/gitlab_local/brain`) is the proving instance. A separate
  instance repo (a future `prime-pva`, replacing `ralph-pva`) will hold Joe's brain config
  and personal skills. prime-claw itself must stay generic.
- **Novel surface.** Two distinct subsystems, held separate:
  - **gbrain (knowledge CLI) — TWO DISTINCT RELATIONSHIPS (do not conflate):**
    - **Mode (a) harness-as-controller** — the agent IS the claw. It owns and drives the
      gbrain: drives the **gbrain CLI** directly (`sync`, `extract`, `embed`, `agent run`,
      `autopilot`, `jobs work`, `maintain`, `dream`, `capture`), **manages/administers the
      brain's database** (init, engine, migrations, backups), manages the **collection
      channels** (gbrain `recipes/`) and launches the **signal sweep**. This is the
      zbrain/ralph-pva pattern and gbrain's `BOOTSTRAP_FOR_AGENTS.md` path.
    - **Mode (b) agent-as-participant** — an agent (mostly a coding agent) **connects to** an
      *existing* gbrain over **MCP** (`<harness> mcp add gbrain -- gbrain serve`, or hosted
      `gbrain serve --http` + OAuth) to be informed and participate. It does NOT own or
      administer the brain. This is `connect-coding-agent.md` / `INSTALL_FOR_AGENTS.md` /
      `gbrain connect`.
    - **OUR GOAL (the whole point of prime-claw):** prime-agent is the **mode-(a)
      harness-as-controller** — the core claw that drives, manages, and maintains the
      gbrain (CLI + DB + channels + sweep). Mode (a) is the priority. Because we are
      contemplating adding prime-agent as a first-class upstream harness, we should also
      support **mode (b)** (prime-agent as a participant client of a gbrain) — but (b) is
      secondary to (a).
    - gbrain's harness install path (NOT "recipes" — a *recipe* is a channel-connection
      guide) makes gbrain the core brain of a CLI agent via auto-loaded instructions
      (AGENTS.md/CLAUDE.md) + skill files + a stdio MCP server + a native scheduler.
      gbrain ships this for `claude-code | codex | opencode | openclaw | ...` but **not
      prime-agent**. prime-agent fits the harness model with no capability blockers
      (auto-loads AGENTS.md/CLAUDE.md, discovers `.agents/skills/`, has `schedule`,
      sessions, and stdio MCP) — so an upstream prime-agent harness adapter appears
      feasible; the Slice-0 spike proves it in real code.
  - **gstack browse (web scraping):** the container proxy-shim + host-bridge are
    **zbrain-local inventions, never upstreamed** (3c ports them). prime-claw does NOT
    re-test them; it ports + integrates them against stock upstream gstack browse.
- **Self-contained container (Decision D-A).** The brain lives *inside* the sandbox:
  cloned in, indexed by the in-sandbox gbrain+PG. Not a thin client to an external brain.

## 3. What Phase 3a is (the tracer bullet — thin but whole)

A single end-to-end slice proving prime-claw can host a brain, with prime-agent as the
harness:

1. **Brain in.** After an explicit per-operator `brain_repo` setup gate, `git clone` that
   repository into the sandbox at a known path. No shared/default/example brain is inferred.
2. **Index.** In-sandbox gbrain + Postgres index the cloned brain (sync the `brain`
   source), with embeddings.
3. **Read/query.** From a conversation with the sandboxed prime-agent, the operator asks a
   question and gets a correct, **cited** answer drawn from the brain — proving search +
   retrieval inside the container.
4. **One routed write.** The agent writes **one** durable fact into the in-sandbox brain,
   routed per `docs/information-architecture.md` (brain = canonical store for domain
   facts), via `gbrain put` + `gbrain sync --source brain`.

The sandboxed prime-agent **mirrors explicit operator config**: host `models.json` and
`settings.json` take precedence when present. Host `auth.json` is never copied; selected real
credentials remain in OpenShell and sandbox auth is placeholder-only. For a Codex override, a
non-secret synthetic JWT satisfies local parsing and the preload rewrites outbound headers to
OpenShell placeholders (R3a-13). When no preferred host config exists, the tracked portable
fallback must select Zendesk AI Gateway `anthropic.kimi-k3`; GLM remains available as an
alternative. The earlier Codex cited-query run is override evidence, not the repo default.

The write is a **test artifact**: a keep-worthy `projects/prime-claw` page describing
prime-claw itself (the operator confirmed exact slug `projects/prime-claw` on 2026-09-16). The agent
writes and re-indexes it in-sandbox, commits it in the clone, and pushes it to the real brain
repo through the Slice 1 GitHub L7 provider. Acceptance records page slug + commit SHA + push
result; no credential reaches sandbox disk (resolved Q4 / D3a-G).

## 4. Explicitly out of scope for 3a (later slices)

- **3b — whole-brain migration + generic memory skills**: port `memorize`, `gbrain-query`,
  `gbrain-ingest`, `gbrain-maintain`, `brain-commit`, `_brain-filing-rules` as
  prime-agent-native `.agents/skills/`; wire the IA routing layer; migrate the full brain.
- **3c — browse proxy-shim**: port zbrain's own `browse-proxy-shim` + `browse-host-bridge`
  + cookie-jar `companion/` into the sandbox path, consuming **stock upstream gstack browse**
  as the host-side plugin host. NOTE: the shim/bridge are **zbrain-local inventions, never
  upstreamed** (verified: untracked in `~/gstack`, which is upstream `garrytan/gstack`).
  zbrain's *core-browser* fork deltas were retired into gstack's plugin framework
  (2026-09-01), but the shim/bridge pair is ours to carry forward — this is a **port**, not
  an upstream reuse. The plugin-framework core-browser changes ARE upstream-consumed.
- **3d — channels**: collect → triage → ingest pipelines (Slack/Zoom/Google/Notion/Gmail/
  Workday/Cerebro/ZIG).
- **3e — scheduling**: `prime-agent schedule` replacing `brain.cron` (autopilot/dream/
  brief/collect sweeps). `brain.cron` is **not** ported — prime-agent scheduling obsoletes it.
- **The automated episode loop** (Phase 4), comms channels (Phase 5), orchestrator
  (Phase 6) — unchanged from LONG_RANGE_PLAN.
- **The instance repo** (`prime-pva`) — created at 3b, not 3a.

## 5. How it will be when the work is done

- `bin/prime-claw` gains a stage/verb (or `converge` stage) that clones the operator's
  brain into the sandbox and syncs the in-sandbox gbrain index — idempotent, offline-testable.
- A fresh `bin/prime-claw create && bin/prime-claw validate` (or a new acceptance check)
  proves: brain present, index serving, a cited query answered, one routed write landed.
- `validate` evidence records the brain page count and the write receipt.
- The complete brain index uses one fresh selected vector space with no mixed/stale/null
  vectors. The no-config default is Zendesk AI Gateway `openai:text-embedding-3-large` at
  1536 dimensions; home Qwen/4096 is an explicit local override.
- The prime-agent session in the sandbox can answer "what do we know about X?" from the
  brain and "remember Y" with a correct, cited, IA-routed write — **all inside the
  container**, credentials host-only.
- Everything is generic (no Joe-specific values hardcoded — R2-X-2/D14 hold): every operator
  must explicitly point `brain_repo` at *their* brain through ignored local config or environment;
  missing setup fails before mutation and there is no tracked/public fallback.

## 6. Hard rules (carried, binding)

- **Credential isolation (R-X-5/R2-X-1):** inference auth via host L7 provider only;
  no real credentials on sandbox disk; the brain clone carries content, not secrets.
- **Reuse proven capability:** do not re-test gbrain's CLI/sync/embeddings or the browse
  shim — they are proven upstream. Test only the prime-agent-harness delta and the
  integration wiring.
- **Generic platform:** no operator-specific taxonomy, values, or personal skills baked
  into prime-claw; the entity schema stays in the operator's brain (IA two-level split).
- **Single-gateway discipline:** `openshell` (17670) only; never `nemoclaw`.
- **apply/check/validate/test discipline:** the new brain-hosting capability gets a
  validate check, pytest coverage (offline), and a `requirements-inventory.json` entry.

## 7. Open questions (to resolve during planning)

1. **Brain-clone mechanism in the sandbox.** ~~open~~ **RESOLVED (Q1, Slice 1, D3a-B):**
   in-sandbox HTTPS `git clone` WITH `.git`, push-capable, via the custom `github-push` L7
   provider profile (placeholder `${api_token}` swapped at L7; no credential on disk).
   In-sandbox SSH clone was considered and rejected. See `docs/derisk/3a-slice1.md`.
2. **Embeddings provider for the in-sandbox index.** **REVISED (operator portability
   requirement 2026-09-17; D3a-L/M):** the no-config repository default is the previously
   proven Zendesk AI Gateway `openai:text-embedding-3-large` profile at 1536 dimensions.
   Explicit configuration may select another provider independently. The operator's home
   `Qwen3-Embedding-8B`/4096 profile remains an optional ignored-local override with its
   non-destructive parallel rebuild contract; it is not a tracked prerequisite.
3. **Which brain for the tracer read/query proof** ~~open~~ **RESOLVED (Q3):** the operator's
   explicitly configured full real brain. Joe's historical proving instance was the private
   `JLandersZen/brain` repository on `main`; that identity is not a tracked default (D3a-N).
4. **Exact validate surface** ~~open~~ **RESOLVED (Q4, D3a-G):** GATE = brain cloned with
   `.git` + pages>0 + cited query + one routed write receipt + push-back round-trip.
5. **Which prime-agent provider/model proves the conversational slices?** **REVISED
   (operator portability requirement 2026-09-17; D3a-K/M):** explicit host model/settings
   win. With none, default inference is Zendesk AI Gateway `anthropic.kimi-k3`; GLM is a
   supported alternative. The 2026-09-16 Codex run remains valid proof of an explicit
   `openai-codex/gpt-5.6-sol` override and OAuth isolation, not the checked-in default.
6. **gbrain: upstream-vs-fork (Slice-0 spike — the strategy is decided; the spike proves
   feasibility).** **Strategy (settled):** we WANT to use **upstream `garrytan/gbrain`** as
   prime-claw's driven brain (mode a) rather than maintain zbrain's stripped fork. Upstream
   is multi-harness + schema-pack; zbrain's walk-up-config delta is NOT needed in a
   single-brain container (GBRAIN_HOME/env suffices); zbrain's "strip" is unnecessary because
   unused claw skills can simply be omitted. **To add prime-agent as a first-class upstream
   harness we will fork gbrain solely to author the PR, then monitor upstream and RETIRE the
   fork once the PR is accepted/merged.** The Slice-0 spike's job is to PROVE (in real code,
   not analysis) that upstream gbrain + prime-agent-as-controller runs correctly in the
   OpenShell sandbox, and to surface any prime-agent-vs-other-harness differences too big to
   overcome elegantly. Preliminary investigation suggests there are none, but the spike
   decides. If the spike finds a hard blocker, the documented fallback is a maintained thin
   fork. (gbrain only — the browse shim/bridge are zbrain-local, ported at 3c.)

These are planning concerns, not spec blockers — the WHAT is settled above.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 R3a-1 (GATE) — Brain present in-sandbox. The operator's brain repo is cloned into the sandbox at a known, configurable path (default `/sandbox/brain`), reachable by the in-sandbox prime-agent. Content only — no credentials carried in.
- [x] #2 R3a-2 (GATE) — In-sandbox index serving. The in-sandbox gbrain + Postgres + pgvector index the cloned brain as the `brain` source; `gbrain` queries run against in-sandbox PG (`localhost:5433`), no host dependency at query time.
- [x] #3 R3a-3 (GATE) — Cited read/query. From a conversation with the sandboxed prime-agent, an operator question is answered correctly with a citation to a brain page. Proves search + retrieval inside the container.
- [ ] #4 R3a-4 (GATE) — One routed write. The agent writes one durable fact into the in-sandbox brain via `gbrain put <type/slug>` + `gbrain sync --source brain`, routed per `docs/information-architecture.md` (brain = canonical store). The write is a test artifact: either easily deleted (markdown is source-of-truth) or a keep-worthy stub (the operator-approved `projects/prime-claw` page). The agent commits and pushes the change from the sandbox clone to the real brain repo through the Slice 1 GitHub L7 provider. Receipt = page slug + commit SHA + push result.
- [x] #5 R3a-5 (GATE) — Lifecycle integration. Brain clone + index are wired into `bin/prime-claw` (a stage and/or verb), idempotent and re-runnable, so a fresh `create`/`converge` yields a brain-hosting sandbox without manual steps.
- [ ] #6 R3a-6 (GATE) — Acceptance gate. `bin/prime-claw validate` (or a dedicated check) proves R3a-1..4 green and records evidence (page count, the write receipt) under `docs/evidence/`.
- [ ] #7 R3a-0 (GATE) — Slice-0 upstream-gbrain spike. Before the rest of the slice, prove in real code that upstream `garrytan/gbrain` runs correctly in the OpenShell sandbox with prime-agent as the mode-(a) harness-as-controller (drives the gbrain CLI + manages the in-sandbox DB). The spike also surfaces whether any prime-agent-vs-other-harness difference is too big to overcome elegantly (deciding D3a-H's fallback). Verdict GO = build on upstream (fork only to author the prime-agent-harness PR, then retire it); verdict NO-GO = documented thin-fork fallback. Mode (b) participant-MCP is secondary; not required for GO.
- [x] #8 R3a-7 (GATE) — Credential isolation. Inference auth stays on the host L7 provider; no real LLM credentials on sandbox disk. The brain clone carries no secrets.
- [ ] #9 R3a-8 (GATE) — Reuse, don't re-test. Do not re-test gbrain's CLI/sync/embedding or the browse shim — already proven upstream (zbrain ~1,626 tests). Tests cover only the prime-agent-harness integration and the clone/index/validate wiring.
- [x] #10 R3a-9 (GATE) — Generic platform. No operator-specific values are hardcoded. Brain repository identity is operator-owned configuration, never a tracked default or code fallback; the brain's entity taxonomy is NOT encoded in prime-claw (IA two-level split).
- [ ] #11 R3a-10 (GATE) — Single-gateway discipline. `openshell` (17670) only.
- [ ] #12 R3a-11 (GATE) — Offline tests. New pytest coverage monkeypatches sandbox/exec boundaries (no live sandbox needed for the unit suite).
- [x] #13 R3a-12 (GATE) — Selected embedding-profile freshness. The in-sandbox index uses one explicitly selected embedding profile and one vector space: no mixed-model vectors, NULL/stale embeddings, or keyword-only acceptance. The repository default is Zendesk AI Gateway `openai:text-embedding-3-large` at 1536 dimensions. An explicit operator override may select another provider/model/dimension (including home `Qwen3-Embedding-8B` at native 4096), but changing vector spaces requires a full non-destructive re-embed before cutover.
- [x] #14 R3a-13 (GATE) — prime-agent config mirrors explicit user choice; credentials remain isolated. Explicit host `models.json` and `settings.json` are mirrored verbatim and take precedence, while host `auth.json` is never copied. The selected provider's real credential stays in OpenShell; sandbox auth contains only non-secret adapter data and placeholders. With no existing preferred host config, the portable inference default is Zendesk AI Gateway `anthropic.kimi-k3`; `anthropic.glm-5.2` remains a supported gateway alternative. The 2026-09-16 cited-query proof used the operator's explicit `openai-codex/gpt-5.6-sol` override and remains valid evidence of override/credential isolation, not the repo default. Override paths remain available through `host_models_json` / `PRIME_CLAW_HOST_MODELS_JSON` and `host_settings_json` / `PRIME_CLAW_HOST_SETTINGS_JSON`.
- [ ] #15 R3a-14 (CONDITIONAL GATE) — Non-destructive local-Qwen override cutover. When an operator explicitly selects the home-Qwen profile, build it in a parallel Postgres database/index from the canonical brain clone, validate page/chunk counts, 4096-dimensional vectors, freshness and semantic retrieval, then switch only that operator's runtime. Keep the default/previous 1536-dimension database untouched as rollback. The private endpoint enters only through ignored local config or `PRIME_CLAW_*`, never tracked defaults, logs, or evidence. Policy grants only its exact host/port. This optional profile must not remove or redefine the portable Zendesk AI-gateway default.
- [x] #16 R3a-15 (GATE) — Portable tracked defaults with explicit override precedence. A clone of prime-claw with no existing preferred provider configuration defaults both concerns to the Zendesk AI Gateway: inference `anthropic.kimi-k3` (GLM allowed as an explicit alternative) and embeddings `openai:text-embedding-3-large` at 1536 dimensions. Explicit host/local/env configuration overrides inference and embeddings independently. Tracked config must require neither a DGX/private endpoint nor Codex OAuth, and tests must prove this precedence.
- [x] #17 R3a-16 (GATE) — Explicit per-operator brain repository is mandatory. Prime-claw has no tracked, fallback, public starter, or example brain repository. Every operator must set `brain_repo` through ignored local configuration or `PRIME_CLAW_BRAIN_REPO` before any repository-dependent lifecycle, validation, recovery, embedding-build, write, or push action. Missing or malformed configuration fails before mutation with a clear error naming both setup paths. Joe's `JLandersZen/brain` is a proving-instance value only and must live in ignored local config; historical evidence may name it but active defaults, code fallbacks, and generic tests may not. `brain_branch` may retain the non-personal default `main`.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# Execution Plan — Phase 3a: Tracer Bullet (a brain-hosting claw)

**Status:** BLOCKED — fresh post-clearance host exact-model probe returned HTTP 502; no sandbox probe or restart; Slice 4B remains blocked on 4A
**Beads:** `prime-claw-zwg` (P1)
**Spec:** [SPECIFICATION.md](SPECIFICATION.md) · **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) · **Decisions:** [DECISIONS.md](DECISIONS.md)
**Date:** 2026-09-11 · **Slice 4A execution updated:** 2026-09-18

This plan implements the Phase 3a spec as **vertical slices** (Cockburn elephant-carpaccio):
each slice ends in a *working capability + passing tests + committed & pushed*, and retires a
named requirement set. Slices are dependency-ordered; **Slice 0 is a go/no-go gate** that may
pivot the gbrain choice (upstream vs. thin fork) before any real brain content is touched.

## Operating discipline (carried, binding)

- **Manual-first.** No automation loops; each slice is driven by hand and proven.
- **apply/check/validate/test.** Every capability gets a `bin/prime-claw` stage (idempotent),
  pytest coverage (offline, monkeypatched `pc.*`), a `validate` check where user-facing, and a
  `config/requirements-inventory.json` entry with a **real `proven_by` path** (integrity-gated).
- **Per-slice exit ritual.** Each slice ends: canonical `pytest -q tests` green →
  `git commit` → `git pull --rebase`
  → `bd sync` → `git push` → `git status` clean & up-to-date. Bead notes updated.
- **Credential isolation (R-X-5/R2-X-1).** No real credential ever on sandbox disk.
  Explicit user provider choices ride matching OpenShell providers; git push uses a **github
  provider** whose token stays host-side and is swapped at L7. With no preferred config,
  inference and embeddings both use the Zendesk AI Gateway: Kimi K3 inference and
  `text-embedding-3-large`/1536 embeddings (D3a-M). Home Qwen and Codex are independent local
  overrides. Literal `dummy` in the home profile is non-secret compatibility data.
- **Single-gateway:** `openshell` (17670) only; `nemoclaw` forbidden.
- **`--dry-run` is global** and precedes the verb.

## Resolved open questions (spec §7) — locked by operator

- **Q1 brain-clone mechanism → git clone WITH `.git`, push-capable, credential-safe.**
  The agent must be able to **push** brain updates to the repo from inside the container.
  Mechanism (operator-approved): a **custom OpenShell `github` provider profile** that adds
  `git-receive-pack` (push) + read-write on `github.com` (the builtin profile is fetch-only),
  keyed to the `git` binary; a github provider holds the token host-side; the policy declares
  `github.com:443` as a credentialed rest endpoint; git carries a placeholder auth header that
  OpenShell swaps to the real bearer at L7. **Requires:** add `git` to the image; clone with
  `.git`. No token on sandbox disk. In-sandbox `git clone` over SSH is rejected (private repo
  would need a token in-container).
- **Q2 embeddings → REVISED by D3a-L/M: portable gateway default, explicit overrides.**
  No-config installs use the previously proven Zendesk AI Gateway
  `openai:text-embedding-3-large` profile at 1536 dimensions. An operator may explicitly select
  another provider/model/dimension. Joe's home `Qwen3-Embedding-8B` profile remains an optional
  local 4096-dimensional override with a 1000-second timeout and parallel rebuild contract;
  its private endpoint never enters tracked config. Every selected profile must be one fresh
  vector space; changing profiles requires a full non-destructive re-embed.
- **Q3 brain content → each operator's explicitly configured FULL real brain.** Joe's historical
  proving instance is the private `JLandersZen/brain` repository on `main`; D3a-N forbids it as a
  tracked default or code fallback. There is no public starter/example brain.
- **Q4 validate surface → GATE =** brain present (with `.git`) + index page count > 0 +
  known-fact cited query green + one routed-write receipt + push-back proven + a complete,
  fresh index for the selected embedding profile. Embedding freshness is a **GATE**, not NICE.

## Slice map

| Slice | Capability delivered | Requirements | Gate? |
|---|---|---|---|
| **S0** | Upstream-gbrain spike: prime-agent-as-controller drives **upstream garrytan/gbrain** in-sandbox (+ models.json mirror) | R3a-0, R3a-13 | **GO/NO-GO** |
| **S1** | git+github push plumbing: image git, custom github push profile, clone brain w/ `.git` into sandbox | R3a-1, R3a-5(part), R3a-7 | — |
| **S2** | In-sandbox index serving (gbrain+PG over the clone, `brain` source); AI-gateway/1536 embedding proof (portable-default basis) | R3a-2 | — |
| **S3** | Cited read/query from the sandboxed prime-agent | R3a-3 | — |
| **S4P** | Portable no-config provider defaults: Zendesk AI Gateway Kimi inference + OpenAI 1536 embeddings; explicit overrides win | R3a-5, R3a-7, R3a-12, R3a-13, R3a-15 | **COMPLETE** — 177 tests + hermetic provider-default dry-run PASS |
| **S4R** | Require explicit per-operator brain repository; remove personal tracked/fallback repo identity | R3a-1, R3a-5, R3a-9, R3a-16 | **COMPLETE** — 228 tests + operator-local dry-run PASS; bead `prime-claw-zwg.2` |
| **S4A** | Operator-required local `Qwen3-Embedding-8B`/4096 profile, non-destructive build and cutover | R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14 | **IN PROGRESS / P0** — bead `prime-claw-zwg.5`; service recovered; durable-progress watchdog fix precedes one resume |
| **S4B** | One routed write + push-back round-trip to the explicitly configured operator repo | R3a-4, R3a-16 | **BLOCKED ON S4A BY OPERATOR ORDERING** — bead `prime-claw-zwg.4`; generic gateway path remains technically independent |
| **S5** | Acceptance gate + evidence + inventory + housekeeping | R3a-6 | acceptance |

---

## Slice 0 — Upstream-gbrain spike (R3a-0, GO/NO-GO gate; D3a-H)

**Goal.** Prove in real code that **upstream `garrytan/gbrain`** (not zbrain's fork) runs
correctly in the OpenShell sandbox under **prime-agent as mode-(a) harness-as-controller**
(drives the gbrain CLI, manages the in-sandbox DB). Surface any prime-agent-vs-other-harness
difference too big to overcome elegantly.

**Approach.**

- Change the image's gbrain build source from the zbrain checkout (`PRIME_CLAW_ZBRAIN_SRC`,
  `stage_gbrain_context`) to a pinned **upstream garrytan/gbrain** ref (target the v0.50.x line;
  `master` currently v0.50.0.0). Keep the zbrain path as a documented fallback behind a config
  flag so a NO-GO can revert cleanly.
- In the sandbox (a tiny fixture brain, not the real one): `gbrain init` against in-sandbox PG
  → `gbrain put` a fixture page → `gbrain sync --source brain` → `gbrain search`/`get` returns it.
- Drive the above **from the sandboxed prime-agent** (the REPL/exec path), not just from a shell,
  to prove the controller relationship specifically.

**GO criteria (all must hold).**
1. Upstream gbrain binary builds and runs in the image (Bun compile succeeds for linux-arm64).
2. `gbrain init` + `sync` + `search` round-trip works against in-sandbox PG (`localhost:5433`).
3. prime-agent can invoke the gbrain CLI (exec/REPL) with no harness-capability blocker.
4. No upstream feature prime-claw depends on is absent or fork-only (walk-up config not needed —
   GBRAIN_HOME/env suffices; schema pack `gbrain-base-v2` present upstream).

**NO-GO triggers (any → documented thin-fork fallback).**
- Upstream binary fails to build/run in the sandbox and the cause is a hard, inelegant blocker.
- A required capability is fork-only in zbrain and cannot be satisfied by config/env upstream.

**Exit / artifacts.**
- Verdict recorded in `docs/derisk/3a-slice0.md` (or `docs/evidence/3a-slice0-*.json`).
- If GO: image pins upstream gbrain; `stage_gbrain_context` reads an upstream ref; config key
  `gbrain_source` (default upstream, fallback zbrain) added to `config/runtime.json`.
- Tests: offline coverage that the build-context staging selects upstream vs. fallback correctly.
- **Also delivered then extended (R3a-13):** Slice 0 copied host `models.json`; Slice 3
  extended the contract to copy host `settings.json` too and project auth through OpenShell
  placeholders. The 2026-09-16 acceptance run followed the explicit host
  `openai-codex/gpt-5.6-sol` override (D3a-K); D3a-M now requires Kimi K3 via the Zendesk AI
  Gateway when no preferred host config exists.

---

## Slice 1 — Brain into the sandbox, push-capable (R3a-1, R3a-5 partial, R3a-7)

**Goal.** The operator's brain repo is cloned into the sandbox at a configurable path
(default `/sandbox/brain`) **with `.git`**, and the agent can push — all without a credential
on sandbox disk.

**Approach.**

- **Image:** add `git` to `docker/runtime.Dockerfile` apt line.
- **Custom github push profile:** author `policies/github-push-profile.yaml` extending the
  builtin github profile to allow `POST /**/git-receive-pack` and read-write on `github.com`,
  keyed to `/usr/bin/git`. Import via `openshell provider profile import`. Create a github
  provider (token host-side) and attach it.
- **Policy:** add a credentialed `github.com:443` (rest, read-write) endpoint keyed to `git`,
  alongside the existing ai-gateway endpoint. (Push = `git-receive-pack`; fetch/clone =
  `git-upload-pack`; both flow through the provider swap.)
- **Clone stage:** new `stage_brain_clone(cfg, args)` in `bin/prime-claw` — in-sandbox
  `git clone <repo> <sb_brain_dir>` over HTTPS using a placeholder `http.extraHeader` that the
  L7 proxy swaps; idempotent (skip if already cloned, else `git fetch`/`pull --ff-only`).
  Config keys: `brain_repo`, `brain_branch` (neutral default `main`), and `sb_brain_dir`
  (default `/sandbox/brain`), all `PRIME_CLAW_*`-overridable. **Portability correction D3a-N:**
  Slice 1 originally tracked Joe's proving repository as `brain_repo`; Slice 4R must remove that
  tracked/code fallback and make repository identity mandatory operator-local configuration.
- Wire `stage_brain_clone` into `create`/`converge` before `stage_brain` (index needs content).

**Tests (offline).** stage dry-run text; config override resolution; idempotency branch
(clone vs. fetch); provider/profile staging mocked via `pc.run`/`pc.sandbox_exec`.

**Exit.** A fresh `create`+`converge` leaves `/sandbox/brain` cloned with `.git`; `git -C
/sandbox/brain remote -v` reachable through the credentialed endpoint; no token on disk.

**Status (2026-09-14): COMPLETE.** Fresh `create` lands `/sandbox/brain` cloned with `.git`
deterministically. The fresh-create blocker turned out to be a shell-quoting bug in
`stage_brain_clone` (single-quoted URL prevented `${api_token}` expansion), not an OpenShell
defect — full root cause in `docs/derisk/3a-slice1.md`. Push-capable github provider
(`github-push` profile), conditional credential refresh on both providers, single L7
credentialed `github_brain` policy rule, clone/fetch-ff idempotent, no token on disk.

---

## Slice 2 — In-sandbox index serving (R3a-2; portable gateway/1536 basis)

**Goal.** In-sandbox gbrain+PG+pgvector index the cloned brain as the `brain` source; queries
run against in-sandbox PG with **working embeddings** via the AI gateway.

**Approach.**

- Extend `stage_brain` (or add `stage_brain_index`): after PG is up and the brain is cloned,
  run `gbrain sync --source brain` (the source registered to `/sandbox/brain`) to build the
  index; then `gbrain embed` so embeddings populate via the AI-gateway L7 (config already wired
  in Slice 2's predecessor; ensure the placeholder `openai_api_key` is present in the in-sandbox
  gbrain config so the L7 swap applies).
- Confirm the policy keys `ai-gateway.zende.sk` to the binary gbrain actually invokes for
  embeddings (bun-compiled `gbrain`), so the credential swap applies to embed calls.

**Tests (offline).** stage dry-run; the sync/embed invocation strings; config wiring
(`provider_base_urls`, `embedding_model`, placeholder key) asserted.

**Exit.** `gbrain search "<known term>" --source brain` inside the sandbox returns a real brain
page from in-sandbox PG; `validate` can read a page count > 0; embeddings populate (the
AI-gateway/1536 branch of revised R3a-12; Slice 4P now selects it by default).

**Status (2026-09-15): COMPLETE.** New `brain-index` stage (init --migrate-only → sources add →
sync import+embed → skip-failed → pages>0 gate, pipefail throughout). gbrain config moved to the
canonical `/sandbox/.gbrain/config.json` with the L7 placeholder key — fixing a latent false-pass
in validate (no cwd walk-up exists upstream; the embedding check now gates on the probe's own row).
Fresh create: 1057 pages, 3029/3029 chunks embedded (dims 1536), semantic search + hybrid query
live. `validate` 16/16 PASS (evidence `docs/evidence/validate-20260915T170708Z.json`). Full verdict
+ operational findings (VPN-down RBAC 403 signature → bead prime-claw-z56; npm registry race;
4 malformed-frontmatter brain files) in `docs/derisk/3a-slice2.md`.
**Historical note (2026-09-16):** this proves index-serving mechanics, but its corporate
AI-gateway / OpenAI / 1536-dimension embedding result is now the basis of the portable default
profile under D3a-M. S4P restores that as the tracked no-config behavior and proves fresh
profile selection. D3a-L/S4A retain home-Qwen as an optional local override.

---

## Slice 3 — Cited read/query from the sandboxed prime-agent (R3a-3)

**Goal.** From a conversation with the sandboxed prime-agent, an operator question is answered
correctly **with a citation** to a brain page.

**Approach.**

- Provide a thin **brain-query capability** the sandboxed prime-agent calls (a small helper the
  agent invokes that runs `gbrain search`/`gbrain get` against in-sandbox PG and returns
  title/slug + excerpt, so the answer can cite the page). This is the minimal mode-(a) read
  surface; the full skill port is 3b.
- Prove it end-to-end: spawn a session, ask "what do we know about <X>?" (X = a known real brain
  fact), assert the answer is correct **and** cites the expected page slug.

**Tests (offline).** the helper's command construction + citation formatting, monkeypatched.

**Exit.** A validated cited answer against a known-fact fixture; evidence captured.

**Status (2026-09-16): COMPLETE.** `stage_brain_query` installs a read-only helper plus
`/sandbox/AGENTS.md`; the helper performs `gbrain search` → `gbrain get`, emits a bounded
excerpt and exact `[Brain: <slug>]` token, and treats page content as untrusted data. Per the
operator's updated requirement, `stage_prime_agent` now mirrors host `settings.json` +
`models.json`, projects openai-codex auth as synthetic/placeholder-only values, and runs
ChatGPT-5.6 Sol via the host OpenShell OAuth provider. End-to-end daemon session invoked the
helper twice and correctly answered with all expected harness components plus citation
`[Brain: resources/the-anatomy-of-an-agent-harness]`. Evidence: `docs/evidence/cited-query-20260916T164509Z.json`; full validate 16/16 PASS in
`docs/evidence/validate-20260916T165022Z.json`. Offline suite: 112 green before closeout.

---

## Slice 4P — Portable AI-gateway defaults (R3a-12, R3a-13, R3a-15) — COMPLETE

**Goal.** Make a fresh clone usable without personal hardware or developer-specific OAuth.
When no preferred config exists, select Zendesk AI Gateway `anthropic.kimi-k3` for inference
and `openai:text-embedding-3-large`/1536 for embeddings. Keep GLM as a supported inference
alternative. Explicit host/local/env choices override inference and embeddings independently.

**Status (2026-09-17): COMPLETE.** Tracked defaults now select Kimi plus gateway
OpenAI/1536. A single resolver applies independent env/local/valid-host precedence to lifecycle
stages, provider attachments, Prime Agent config, effective policy, brain index settings, status,
and validation. Codex credentials/routes are conditional. Home-Qwen selection remains explicit
and fails closed before ordinary lifecycle mutation until its parallel candidate is accepted.
Embedding config/vector-width mismatches stop before migration or sync.

**Exit evidence.** Hermetic create dry-run selected Kimi + gateway OpenAI/1536 and only gateway
+ GitHub providers. `tests/test_portable_provider_defaults.py` passed 27 tests; the canonical
suite passed 177. Verdict: [3a-slice4p.md](../../../../docs/derisk/3a-slice4p.md); machine evidence:
[portable-defaults-20260917T184315Z.json](../../../../docs/evidence/portable-defaults-20260917T184315Z.json).

---

## Slice 4R — Mandatory explicit operator brain repository (R3a-1, R3a-5, R3a-9, R3a-16)

**Status: COMPLETE (2026-09-17).** Bead `prime-claw-zwg.2` implemented the explicit
operator setup gate without mutating the live sandbox, providers, databases, or indexes.

**Goal.** Preserve the platform/instance boundary by requiring every operator to configure their
own brain repository. Prime-claw must never infer, ship, or fall back to Joe's private repository
or to a public starter/example brain.

**Approach.**

1. Remove `brain_repo` from tracked runtime defaults and remove every code fallback repository.
2. Accept repository identity only from ignored local runtime configuration or
   `PRIME_CLAW_BRAIN_REPO`; retain `main` only as a neutral branch default.
3. Add one pre-mutation setup gate used by repository-dependent lifecycle, recovery, candidate
   build, validation, write, and push paths. `status` reports the missing setup without mutation.
4. The error must say that `brain_repo` is required and name both supported setup paths. It must
   not suggest or synthesize a public/example repository.
5. Move Joe's `JLandersZen/brain` value to his ignored local configuration. Historical evidence
   may retain the proving-instance name; generic tests and active defaults may not.
6. Add offline tests proving absent/malformed values fail before provider, sandbox, network, or
   database calls, and that local/environment overrides reach clone/fetch/push correctly.

**Exit evidence.** A fresh checkout cannot run a repository-dependent command until the operator
supplies their own repository. Ignored-local and environment selections reach the existing clone
path; malformed settings fail before external boundaries. Proven by 50 focused tests, 228 canonical
tests, and an operator-local create dry-run. Verdict:
[3a-slice4r.md](../../../../docs/derisk/3a-slice4r.md). Inventory R3a-16 is proven; Slice 4A is the operator-priority gate before 4B.

---

## Slice 4A — Operator-local home-Qwen override (required for this operator; R3a-12, R3a-14)

**Execution status (revised 2026-09-18): IN PROGRESS / P0 (`prime-claw-zwg.5`).** The
failed resume remains safely preserved at 439 pages / 1,459 current 4096d chunks without a source
bookmark; canonical gateway/1536 state is unchanged. The operator found the external root cause:
thermal admission correctly tripped at 80°C, the first graceful sleep timed out under active
requests, and the retry incorrectly passed current healthy state instead of the latched sleep
action. After that fix, a slower resource snapshot retained `thermal_admission_denied` for up to
180 seconds. A delayed exact-model probe now returns HTTP 200 with 4096 values.

**Restart cue received.** Joe confirmed the hardened service is ready. The prime-claw watchdog
fix is validated: candidate sync runs in a dedicated process group; TERM grace and KILL use
whole-group liveness; durable progress includes `max(embedded_at)`; PostgreSQL progress probes are
bounded; and a parent-visible sentinel forces exit 124 even when a stalled leader exits 0 on TERM.
Executable tests cover a TERM-ignoring descendant, false-success prevention, progress reset,
normal completion, and parent-signal cleanup. Focused tests pass 24/24 and the canonical suite
passes 231/231. Independent review found no remaining high/medium issues. Evidence:
`docs/evidence/embedding-watchdog-20260918T135055Z.json`.

**Resume preflight PASS.** Watchdog commit `5891bfe` is pushed. Host and in-sandbox exact-model
probes both returned HTTP 200 with exactly 4096 values; the canonical gateway policy was restored.
The pre-start read-only gate found zero gbrain processes, unchanged canonical state, and the
preserved 439-page / 1,459-chunk candidate. Evidence:
`docs/evidence/embedding-resume-preflight-20260918T135418Z.json`.

**Post-clearance preflight failed safely.** The required single bounded host exact-model probe
returned HTTP 502 with zero values. Prime-claw did not retry, did not apply the candidate policy,
did not run the sandbox probe, and did not start a build. Zero gbrain processes remain; canonical
policy/config/database are unchanged; the 952-page / 2,863-chunk candidate remains preserved
without a bookmark. Evidence:
`docs/evidence/embedding-resume-preflight-http502-20260918T152548Z.json`.

**Unblock condition.** Do not send further host or sandbox inference probes and do not restart
embeddings until Joe explicitly clears the HTTP 502 condition. On that cue, begin with one bounded
host exact-model probe. Never drop either database or cut over early.

**Goal.** Support the operator's explicitly selected home-network OpenAI-compatible
`Qwen3-Embedding-8B` override without changing the portable default. Rebuild the full in-sandbox brain in a
parallel 4096-dimension database/index, validate it, then cut over without modifying the
current 1536-dimension database in place.

**Locked inputs.** Model `Qwen3-Embedding-8B`; native dimension 4096; timeout 1000 seconds;
endpoint unauthenticated; literal `dummy` permitted only as a non-secret client-compatibility
value. The private base URL is operator-local data and must enter through ignored local config
or `PRIME_CLAW_*` environment, never a tracked file, log, evidence artifact, or test fixture.

**Approach.**

1. **Configuration contract — 4A.1 COMPLETE.** Generic tracked keys + `PRIME_CLAW_*`
   overrides cover base URL, exact model, dimensions, timeout, non-secret compatibility value,
   candidate/legacy database names, and ignored local paths. The base URL has no tracked default.
   `embedding-preflight` reports only sanitized values. The gateway/1536 index stage explicitly
   ignores target settings, preventing an ordinary pre-cutover converge from mutating it.
2. **Deny-by-default egress — 4A.1 RENDER COMPLETE / APPLY PENDING.** The ignored mode-0600
   candidate policy grants only the configured host/port to gbrain/Bun and removes those
   binaries from the corporate route. The tracked policy stays pre-cutover-compatible until
   4A.2 applies the candidate with the new build. No OpenShell credential provider is required.
3. **Parallel build — 4A.2a IMPLEMENTED / LIVE SYNC PENDING.** `embedding-build` gates the
   upstream version that omits native-Qwen wire dimensions, applies the ignored candidate
   policy, creates/resumes only `gbrain_qwen4096`, and uses a separate `GBRAIN_HOME` parent at
   `/sandbox/.prime-claw/qwen-candidate`. It writes a mode-0600 Qwen config, exports
   `GBRAIN_AI_EMBED_TIMEOUT_MS=1000000` and `GBRAIN_QUERY_EMBED_TIMEOUT_MS=1000000`, sets the
   sync deadline/watchdog above the request timeout, and runs a pinned single-worker full sync with explicit non-interactive inline-embed consent
   with pull/extraction disabled. It never switches canonical config. It snapshots the canonical
   config/schema/content/bookmark/migration fingerprint and gates the candidate on a Git-HEAD-
   matching source bookmark plus current-text/signature 4096-dimensional Qwen chunks with exact
   scans (no unsupported HNSW). Success and failure both restore the tracked gateway/default
   policy;
   the legacy database is never dropped or altered.
4. **Acceptance before cutover — 4A.2b AFTER BUILD.** Require page count parity, chunk count parity, every chunk
   embedded at 4096 dimensions, zero mixed/null/stale vectors, exact-page retrieval, and
   semantic search over known fixtures. Prove no request reached the corporate AI gateway.
5. **Cutover and recovery.** Only after those checks pass, atomically switch the canonical
   sandbox gbrain config to the new database. Retain the old database until Slice 5 closes;
   recovery is a config switch back, not an in-place schema reversal.

**Tests (offline).** 4A.1 has 14 focused tests for local-config/env resolution, strict
Qwen/4096/1000s settings, endpoint validation/redaction, exact policy host/port and binary
scoping, 0600 output, dry-run, Git ignores, zero command/sandbox/DB calls, parallel DB naming,
and proof the gateway/1536 index ignores local-Qwen target settings. 4A.2a adds 21 offline tests for
candidate-home confinement, config/database isolation, Qwen/timeouts, no-extract sync, version
gating, sanitized dry-run/output, candidate policy application, failure restore, and CLI wiring.
4A.2b must add parity/freshness/retrieval, atomic cutover, and rollback tests. All
network/database boundaries remain monkeypatched.

**Evidence.** Record sanitized configuration (model/dimensions/timeout only), old/new database
identifiers, page/chunk parity, vector dimensions, semantic query proof, corporate-gateway
non-use, cutover result, and rollback readiness. Never record the private endpoint.

**Exit.** When the home-Qwen profile is explicitly selected, create/converge uses only its embeddings; the full brain is current at 4096
dimensions; semantic retrieval passes; the old 1536 database remains intact for rollback; no
corporate embedding credential/provider/path is used by that local profile. The tracked
Zendesk AI-gateway default remains available for operators who did not select the override.
The generic Slice 4B gateway path remains technically independent. For this operator, however,
local Qwen is required, so successful 4A acceptance and cutover now block starting 4B.

---

## Slice 4B — One routed write + push-back round-trip (R3a-4)

**Status: BLOCKED ON SLICE 4A BY OPERATOR ORDERING.** Bead `prime-claw-zwg.4` depends on
P0 bead `prime-claw-zwg.5`. This is not a generic platform dependency: the gateway profile could
run 4B, but this operator requires the local-Qwen profile to be accepted first.

**Goal.** The agent writes **one** durable fact into the in-sandbox brain, routed per
`docs/information-architecture.md` (brain = canonical store for domain facts), via
`gbrain put <type/slug>` + `gbrain sync --source brain`, and the change **pushes back** to the
real repo (credential-safe, Slice 1 plumbing).

**Approach.**

- After Slice 4A accepts and cuts over the operator's local-Qwen profile, run the routed-write
  acceptance on that selected profile. Preserve the portable gateway path as the generic default.
- The write is a **test artifact**: a keep-worthy `projects/` stub describing prime-claw itself
  (markdown is source-of-truth, so trivially deletable). The operator confirmed exact slug
  `projects/prime-claw` on 2026-09-16.
- The agent creates the page (`gbrain put projects/prime-claw` + body), syncs the index
  (`gbrain sync --source brain`), commits in the in-sandbox clone, and **pushes** via the
  Slice 1 credentialed endpoint. Receipt = page slug + commit sha + push result.

**Tests (offline).** the put/sync/commit/push command construction; IA routing decision recorded.

**Exit.** The `projects/prime-claw` page exists in the in-sandbox brain, is queryable (Slice 3
path), and the commit is pushed to the operator's explicitly configured brain repository — with no
credential on sandbox disk.

---

## Slice 5 — Acceptance gate + evidence + inventory (R3a-6)

**Goal.** `bin/prime-claw validate` (or a dedicated check) proves R3a-1..4 green and records
evidence; the requirements inventory is updated and integrity-gated.

**Approach.**

- Extend `cmd_validate` / `probe_in_sandbox` with brain checks: **brain present** (with `.git`),
  **index page count > 0**, **known-fact cited query green**, **write receipt present**,
  **push-back proven** (remote contains the write commit). Record to `docs/evidence/validate-<utc>.json`.
- Add `R3a-0..16` entries to `config/requirements-inventory.json` with real `proven_by` paths.
- **Housekeeping:** fix the stale `R2-A-3`/`R2-A-4` statuses (Phase 2 closed them; still marked
  `in-progress`).

**Tests (offline).** the new validate checks via monkeypatched `pc.probe_*`; inventory integrity
gate (`tests/test_inventory_integrity.py`) stays green.

**Exit.** `create` + `converge` + `validate` is green end-to-end on a fresh sandbox; evidence
committed; `bd` notes updated; Phase 3a bead ready to close.

---

## Cross-cutting / risks

- **Custom github profile is the main new mechanism** (push not in builtin). If profile import +
  provider swap proves unreliable, fallback: host-mediated push (agent stages commits; a host-side
  step pushes) — but that weakens the "agent pushes from inside" goal, so prefer the L7 profile.
- **Local-Qwen completion is active again.** The thermal containment retry is fixed and a delayed
  exact-model probe passes. Fix the full-sync durable-progress watchdog gap, then pass host plus
  in-sandbox exact-model probes before one isolated resume. Never auto-switch vector spaces or accept keyword-only
  retrieval; preserve each prior database until its replacement profile passes every gate.
- **Recreate wipes `/sandbox`** → re-run `converge`; the brain re-clones (idempotent) on converge.
- **Generic platform (R3a-9/R3a-16):** brain repository identity is mandatory ignored-local or
  environment configuration. No operator repository, taxonomy, or personal value is a tracked
  default or fallback, and there is deliberately no public/example brain.
- **Known status compatibility defect:** the installed OpenShell CLI does not accept `--output
  json` for `sandbox provider list`, so the current provider status probe fails despite a healthy
  sandbox. Track and fix this independently before final acceptance; do not conflate it with R3a-16.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/DECISIONS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/REQUIREMENTS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: `PRIMECLAW-7`.

### Shared archive-index outcome

## phase3a-bufd-superseded-incomplete/ — Phase 3a brain-hosting BUFD bundle ⚠️ INCOMPLETE / SUPERSEDED (2026-09-25)

These four files were moved together from `.ralph/plans/blocked/` to preserve
the earlier BUFD design and execution history. They are **not** a completed or
accepted Phase 3a implementation, and this archive does not resolve the blocked
Qwen migration or authorize Slice 4B. The private brain-source repair remains
unpublished due to sandbox Git transport failure; the candidate remains partial
and there has been no cutover. Backlog.md task `PRIMECLAW-7.5` tracks the live blocker.
The replacement, outcome-first specification is a draft for operator review at
`.ralph/plans/future/phase3a-brain-hosting-completion/SPECIFICATION.md`.
It has no execution plan or implementation approval yet.

## Decisions imported from `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/DECISIONS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`

# Decisions — Phase 3a: Tracer Bullet (a brain-hosting claw)

Beads: `prime-claw-zwg` (P1). Index: [SPECIFICATION.md](SPECIFICATION.md). Requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

Each decision lists the requirement IDs it satisfies.

## D3a-A — Self-contained container; prime-agent is the mode-(a) harness-as-controller
**Decision:** The brain is cloned into the sandbox and indexed by the in-sandbox
gbrain+Postgres. prime-agent **is the mode-(a) harness-as-controller**: it drives the
gbrain CLI directly, manages/administers the in-sandbox brain database, and (in later
slices) manages the collection channels and signal sweep. It does **not** act as a thin
MCP client of an external brain for this phase. Mode (b) — prime-agent as a participant
MCP client of a gbrain — is supported as a secondary goal (we intend to add prime-agent as
a first-class upstream harness, which spans both modes), but is NOT the tracer bullet.
**Satisfies:** R3a-1, R3a-2.
**Rationale:** Operator direction — "prime-claw should evolve to completely replace
gbrain/zbrain's container; the brain lives in it." A self-contained container keeps
deny-by-default egress intact and makes the claw's knowledge local and fast. Thin-client
(MCP to an external brain) was considered and rejected for the hosting goal (it leaves the
brain outside the container and requires an egress hole).

## D3a-B — Brain enters via git clone WITH `.git`, push-capable through a custom L7 profile
**Decision:** The brain enters the sandbox by cloning the operator's explicitly configured
brain repo **with `.git`**, and the sandbox can **push back**. Joe's private
`JLandersZen/brain` repository on `main` was the Slice 1 proving instance, not a platform default.
Writes remain
in ralph-pva until the ingest/memorize skills port (3b+); 3a is read + one routed test write
into the sandbox clone only.
**Satisfies:** R3a-1, R3a-4, R3a-7.
**Resolved mechanism (Slice 1, was SPEC §7.1 open question):** in-sandbox HTTPS clone using the
placeholder token `${api_token}`, swapped to the real token at L7 by a **custom `github-push`
provider profile** (the builtin `github` profile is fetch-only — it allows `POST` only to
`/**/git-upload-pack`; `github-push` adds `POST /**/git-receive-pack` + read-write
`api.github.com`). Token read host-side via `gh auth token`; sandbox disk holds only the
placeholder (`openshell:resolve:env:..._api_token`); `.git/config` contains zero real token.
The host-dir `--upload` path was **removed** from `stage_sandbox` (it drops `.git`, defeating
push-back); `stage_sandbox` now attaches **both** providers at create (`--provider` repeatable).
**Policy consequence:** once a credentialed github provider is attached, OpenShell requires
EVERY `github.com` rule to be L7 (`protocol: rest`) — so `github.com`/`api.github.com` moved out
of the L4 `kernel_bootstrap` rule into a single credentialed `github_brain` rule keyed to
`/usr/bin/git` + `/usr/local/bin/uv` + `/usr/bin/curl` (uv/curl keep the kernel-bootstrap
python-build-standalone download reachable; they never send the placeholder, so the swap never
fires for them).

## D3a-C — prime-agent is the harness (the novel surface)
**Decision:** The brain is consumed by **prime-agent** running in the sandbox, using
prime-agent's own constructs (`.agents/skills/` discovery, the continual harness, daemon,
`rlm`, `schedule`). We do not wire gbrain's Claude/Codex/OpenClaw harness paths.
**Satisfies:** R3a-3, R3a-4, R3a-8.
**Rationale:** This is the genuinely novel, untested integration — gbrain ships harness
recipes for `claude-code | codex | opencode | openclaw` but not prime-agent. prime-claw's
purpose is to put prime-agent at the center; proving the prime-agent↔gbrain loop is the
point of the tracer bullet.

## D3a-D — Inference credential isolation unchanged; concrete provider follows host
**Decision:** The host OpenShell provider holds the real credential; only a placeholder
enters the sandbox; L7 swaps it at the boundary. The claw never possesses real LLM
credentials. Provider selection follows explicit user configuration when present. D3a-M
defines the portable no-config defaults; D3a-K records the operator-specific Codex acceptance
proof and does not redefine repository defaults.
**Satisfies:** R3a-7, R3a-13, R3a-15.
**Rationale:** This isolation is best practice and already proven in Phase 2. A literal
"copy auth.json into the container" approach and a dedicated claw inference identity remain
**rejected**. Mirroring user config means mirroring non-secret selection/config plus a
placeholder-only auth projection, not copying OAuth tokens.

## D3a-E — Reuse proven gbrain capability; test only the delta
**Decision:** Do not author tests that re-prove gbrain CLI/sync/embedding (covered upstream).
prime-claw tests target: brain clone wiring, in-sandbox index integration, the
prime-agent-harness read/query/write loop, and the validate gate. **Correction:** the browse
proxy-shim/host-bridge are **zbrain-local, never upstreamed** — 3c ports them and tests the
port+integration (not as 'reuse of upstream-tested components'); the gbrain-vs-browse fork
questions are separate, and the gbrain fork-vs-upstream choice is deferred to a Slice-0 spike
(open question 5).
**Satisfies:** R3a-8, R3a-11.
**Rationale:** zbrain maintains ~1,626 CLI tests. Re-testing them adds cost with no
information. The information-bearing tests are the prime-agent integration and the lifecycle
wiring.

## D3a-F — Generic platform; instance concerns stay out
**Decision:** prime-claw carries no operator-specific taxonomy, values, repository identity,
or personal skills. Every operator must explicitly configure their brain repository outside
tracked defaults. Joe's personal skills and the `prime-pva` instance repo are created at 3b,
not here.
**Satisfies:** R3a-9, R3a-16.
**Rationale:** prime-claw = the zbrain role (generic platform). Baking one operator's
schema/config into it is the exact mistake the IA doc's two-level split forbids.

## D3a-G — Acceptance = read/query + one routed write
**Decision:** 3a is accepted when a fresh sandbox serves a cited answer from the brain
**and** lands one correctly-routed durable write as a keep-worthy prime-claw `projects/`
stub. The sandbox commits and pushes that page to the real brain repo through the GitHub L7
provider; the receipt records slug, commit SHA, push result, and credential isolation.
**Satisfies:** R3a-3, R3a-4, R3a-6.
**Rationale:** Operator's chosen bar — thin but whole, proving both directions of the
brain loop including durable source-of-truth push-back. The operator confirmed the exact
`projects/prime-claw` slug before Slice 4 execution on 2026-09-16.

## D3a-H — Prefer upstream gbrain; fork only to upstream a prime-agent harness PR, then retire
**Decision:** Build prime-claw against **upstream `garrytan/gbrain`** (not zbrain's stripped
fork). To add prime-agent as a first-class upstream harness (spanning mode a controller and
mode b participant), we will **fork gbrain solely to author the PR**, monitor upstream, and
**retire the fork once the PR is accepted/merged**. Walk-up project config (zbrain's delta)
is NOT needed in the single-brain container (GBRAIN_HOME/env suffices); zbrain's claw-skill
"strip" is unnecessary because unused skills are simply omitted. A Slice-0 spike must PROVE
upstream gbrain runs correctly under prime-agent-as-controller in the sandbox; if it reveals
a hard, inelegant blocker, the documented fallback is a maintained thin fork.
**Satisfies:** R3a-8, R3a-9, R3a-2.
**Rationale:** prime-claw's goal is prime-agent-as-controller of a gbrain; that capability
belongs upstream so anyone's prime-agent gets a brain. A permanent fork is a maintenance
burden whose original justifications (OpenClaw-only, hard-coded taxonomy, walk-up config) are
now obsolete upstream.

## D3a-I — Sandbox prime-agent non-secret config mirrors an existing user preference
**Decision:** When the operator already has valid host `models.json` and `settings.json` with
an explicit default provider/model, `stage_prime_agent` copies them verbatim into
`/sandbox/.prime/agent/`. That existing preference takes precedence and carries its model
metadata, thinking level, and enabled-model set. Host `auth.json` is never copied. When the
host files are absent or do not name a usable preferred model, D3a-M's portable Kimi/AI-gateway
default is the acceptance target. Source paths are overridable via
`host_{models,settings}_json` / `PRIME_CLAW_HOST_{MODELS,SETTINGS}_JSON`.
**Rationale:** The container must respect a user's existing Prime Agent choice without making
one developer's configuration the repository default. Slice 0 proved models.json was
necessary; Slice 3 proved settings.json is equally necessary when the user's selected provider
changed. D3a-M supersedes the old rule that any available host default automatically defined
portable acceptance. Satisfies R3a-13 and R3a-15.

## D3a-J — Conditional provider credential refresh (skip when unchanged)
**Decision:** `stage_provider` (ai-gateway), `stage_github_provider`, and `stage_codex_provider` refresh the stored
credential ONLY when it changed, tracked by a sha256 hash in
`.prime-claw-{ai-gateway-key,github-token,codex-oauth}.sha256` (gitignored; hash only, never the secret).
Under D3a-M, only credential stages required by the selected profiles run; Codex is
conditional on an explicit override and is not part of the no-config default.
**Satisfies:** R3a-5, R3a-7.
**Rationale (Slice 1 finding):** every `openshell provider update` bumps a resource version
that re-keys the SANDBOX's placeholder set, and a running sandbox still holds the OLD
placeholders — so a needless update breaks the sandbox's credentialed endpoints (inference AND
git push) until recreate. Idempotent converge requires skipping no-op updates. Operational
corollary: if an operator rotates a token, re-sync provider + hash file together (the next
`create`/`converge` handles this automatically since the hash no longer matches).

## Decision → Requirement traceability matrix

| Decision | Requirements |
|----------|--------------|
| D3a-A | R3a-1, R3a-2 |
| D3a-B | R3a-1, R3a-4, R3a-7 |
| D3a-C | R3a-3, R3a-4, R3a-8 |
| D3a-D | R3a-7, R3a-13, R3a-15 |
| D3a-I | R3a-13, R3a-15 |
| D3a-K | R3a-3, R3a-7, R3a-13 |
| D3a-M | R3a-5, R3a-7, R3a-12, R3a-13, R3a-15 |
| D3a-J | R3a-5, R3a-7 |
| D3a-L | R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14 |
| D3a-E | R3a-8, R3a-11 |
| D3a-F | R3a-9, R3a-16 |
| D3a-G | R3a-3, R3a-4, R3a-6 |
| D3a-H | R3a-2, R3a-8, R3a-9 |
| D3a-N | R3a-1, R3a-5, R3a-9, R3a-16 |

GATE requirements R3a-1..16 are covered by at least one decision or the slice's direct
implementation. R3a-12 freshness is mandatory for whichever embedding profile is selected;
R3a-14 is conditional on selecting the local-Qwen override. Keyword-only acceptance remains
forbidden.

## D3a-K — Operator override acceptance used ChatGPT-5.6 Sol via isolated Codex OAuth (2026-09-16)
**Decision:** The 2026-09-16 conversational acceptance run follows the operator's explicit
mirrored host choice: `openai-codex/gpt-5.6-sol` (ChatGPT-5.6 Sol, thinking `high`). This is
proof that explicit provider/model overrides and credential isolation work; it is not the
portable repository default. D3a-M defines no-config defaults. Embedding selection is
independent and governed by D3a-L/M.

Host openai-codex `auth.json` values are provisioned into OpenShell's builtin `codex`
provider (`access_token`, `refresh_token`, `account_id`). Sandbox `auth.json` contains a
non-secret JWT-shaped adapter value plus `openshell:resolve:` placeholders only. The
synthetic JWT lets prime-agent locally derive a non-secret placeholder account id;
`npm-onload.js` rewrites outbound Codex Authorization and account headers to OpenShell
placeholders for both fetch/SSE and WebSocket paths, then L7 swaps real values at the
boundary. Expiry is pinned far-future in the projection so prime-agent never refreshes OAuth
inside the sandbox (which could otherwise write a real returned token to disk). Provider
refresh remains host-side in lifecycle stages.

**Satisfies:** R3a-3, R3a-7, R3a-13.
**Evidence:** `docs/evidence/cited-query-20260916T164509Z.json`; offline header-rewrite and
config-projection tests in `tests/test_runtime_converge.py`.

## D3a-L — Home-network Qwen is an optional operator embedding override (revised 2026-09-17)
**Decision:** Preserve the operator's home-network OpenAI-compatible
`Qwen3-Embedding-8B` service as an explicit local override, not the repository default. The
profile uses native 4096-dimensional output and a 1000-second request timeout. Selecting it
requires a full non-destructive parallel rebuild because Qwen and the default OpenAI model use
different vector spaces.

Compatibility evidence remains unchanged: this deployment returns HTTP 400 when either 1536
or 4096 is sent in the OpenAI `dimensions` field and returns 4096 values when the field is
omitted. Build and validate a parallel database before switching an operator who selected the
profile. Keep the default/previous 1536-dimensional database for rollback. The private
endpoint remains ignored operator-local data; literal `dummy` is non-secret compatibility
data. Policy grants only the exact configured host/port.

**Satisfies:** R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14.
**Superseded aspect:** The 2026-09-16 wording made home Qwen the sole supported configuration.
D3a-M restores portable AI-gateway defaults while retaining this profile as an override.

## D3a-M — Portable Zendesk AI-gateway defaults; explicit user config wins (2026-09-17)
**Decision:** A fresh clone with no preferred provider configuration defaults both model
concerns to the Zendesk AI Gateway:

- inference: `anthropic.kimi-k3` (default); `anthropic.glm-5.2` is a supported alternative;
- embeddings: `openai:text-embedding-3-large`, 1536 dimensions (the proven pre-Spark path).

Explicit host/local/environment configuration overrides inference and embeddings independently.
Joe's DGX/Qwen profile and Codex OAuth model are valid operator overrides, but neither may be a
tracked prerequisite or no-config default. Credential isolation remains unchanged: real gateway
or OAuth credentials stay in OpenShell and only placeholders enter the sandbox. Each selected
embedding profile must remain internally fresh and single-vector-space; profile changes rebuild
in parallel rather than mixing vectors.

**Satisfies:** R3a-5, R3a-7, R3a-12, R3a-13, R3a-15.
**Rationale:** prime-claw is a reusable builder project. Requiring uncommon personal hardware
or a developer's private OAuth setup would make the checked-in defaults unusable for the
average operator. The gateway path was already proven in Slices 0–2; the remaining work is to
restore it as the tracked default and make local overrides explicit and independently testable.

## D3a-N — Brain repository identity is mandatory operator configuration (2026-09-17)
**Decision:** prime-claw ships with no tracked brain repository, no code fallback repository,
and no public starter/example brain. Every operator must set `brain_repo` through the ignored
operator-local runtime file or `PRIME_CLAW_BRAIN_REPO`. Repository-dependent commands fail
before mutation when the value is absent or malformed, and the error names both supported setup
paths. A neutral branch default such as `main` is allowed; repository identity is not.

Joe's `JLandersZen/brain` remains valid historical acceptance evidence and his personal ignored
configuration value, but it must be removed from active tracked config, fallback code, and generic
test defaults. This correction is Slice 4R / bead `prime-claw-zwg.2` and gates Slice 4B.

**Satisfies:** R3a-1, R3a-5, R3a-9, R3a-16.
**Rationale:** A reusable brain-hosting platform cannot silently clone or write to one operator's
private repository. Unlike model providers, brain content has no meaningful shared default.
Mandatory explicit setup prevents accidental access, makes ownership clear, and preserves the
platform/instance boundary.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed as a historical-record migration, not as a successful Phase 3a implementation. The BUFD bundle remains explicitly incomplete and superseded; checked criteria record only source-supported completed slices. Replacement epic `PRIMECLAW-7` remains the sole live Blocked owner.

## phase3a-bufd-superseded-incomplete/ — Phase 3a brain-hosting BUFD bundle ⚠️ INCOMPLETE / SUPERSEDED (2026-09-25)

These four files were moved together from `.ralph/plans/blocked/` to preserve
the earlier BUFD design and execution history. They are **not** a completed or
accepted Phase 3a implementation, and this archive does not resolve the blocked
Qwen migration or authorize Slice 4B. The private brain-source repair remains
unpublished due to sandbox Git transport failure; the candidate remains partial
and there has been no cutover. Backlog.md task `PRIMECLAW-7.5` tracks the live blocker.
The replacement, outcome-first specification is a draft for operator review at
`.ralph/plans/future/phase3a-brain-hosting-completion/SPECIFICATION.md`.
It has no execution plan or implementation approval yet.
<!-- SECTION:FINAL_SUMMARY:END -->
