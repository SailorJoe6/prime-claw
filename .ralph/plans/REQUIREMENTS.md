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
