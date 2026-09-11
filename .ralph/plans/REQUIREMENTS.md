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

## Out of scope (recorded for traceability)

- Porting the full memory/collect/triage/ingest skill set (3b).
- Browse proxy-shim recreation (3c). Channels (3d). Scheduling via `prime-agent schedule`
  (3e). `brain.cron` is not ported at all.
- Write-back (git push) from the sandbox clone to the real brain repo.
- The operator instance repo (`prime-pva`) — created at 3b.
- Episode loop, comms channels, orchestrator (Phases 4–6).
