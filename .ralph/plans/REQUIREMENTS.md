# Requirements — Phase 3a: Tracer Bullet (a brain-hosting claw)

Beads: `prime-claw-zwg` (P1). Index: [SPECIFICATION.md](SPECIFICATION.md). Decisions: [DECISIONS.md](DECISIONS.md).

Each requirement has an ID for traceability from [DECISIONS.md](DECISIONS.md). Prefix `R3a-`.
Priority: **GATE** = must hold for the slice to be accepted; **NICE** = desired, may slip.

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
  (e.g. a `projects/` page for prime-claw). Lands in the sandbox clone only; push-back to
  the real repo is out of scope.
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
- **R3a-9 (GATE) — Generic platform.** No operator-specific values hardcoded; the brain
  repo path/URL is configurable (`config/runtime.json` + `PRIME_CLAW_*`). The brain's
  entity taxonomy is NOT encoded in prime-claw (IA two-level split).
- **R3a-10 (GATE) — Single-gateway discipline.** `openshell` (17670) only.
- **R3a-11 (GATE) — Offline tests.** New pytest coverage monkeypatches sandbox/exec
  boundaries (no live sandbox needed for the unit suite).
- **R3a-12 (NICE) — Embedding freshness.** The in-sandbox index has working embeddings
  (not keyword-only). May be deferred if the embedding provider path is non-trivial
  (see open question 2).
- **R3a-13 (GATE) — prime-agent config mirrors the host, credentials remain isolated.**
  `stage_prime_agent` copies the operator's host `~/.prime/agent/models.json` **and**
  `~/.prime/agent/settings.json` verbatim into the sandbox (feature: the container uses
  whatever provider, model, thinking level, enabled-model set, and model metadata the user
  has configured locally). Host `auth.json` is read host-side only and is **never copied**.
  The selected provider's real credential is held by an OpenShell provider; sandbox
  `auth.json` may contain only a non-secret adapter value plus `openshell:resolve:`
  placeholders. Current acceptance target (operator direction, 2026-09-16, until further
  notice): host default `openai-codex/gpt-5.6-sol` (ChatGPT-5.6 Sol, thinking `high`) via
  the host's existing `openai-codex` OAuth. The Codex adapter uses a synthetic JWT for
  prime-agent's local account-id parser and rewrites outbound auth/account headers to L7
  placeholders; no real OAuth token or account credential reaches sandbox disk or process
  memory. **Fallback** when host model/settings files are absent remains configurable and
  must not be used by acceptance while the current host default is available. Override
  paths via `host_models_json` / `PRIME_CLAW_HOST_MODELS_JSON` and
  `host_settings_json` / `PRIME_CLAW_HOST_SETTINGS_JSON`.

## Out of scope (recorded for traceability)

- Porting the full memory/collect/triage/ingest skill set (3b).
- Browse proxy-shim recreation (3c). Channels (3d). Scheduling via `prime-agent schedule`
  (3e). `brain.cron` is not ported at all.
- Write-back (git push) from the sandbox clone to the real brain repo.
- The operator instance repo (`prime-pva`) — created at 3b.
- Episode loop, comms channels, orchestrator (Phases 4–6).
