# Phase 3a Slice 4A — home-Qwen embedding cutover

**Status:** IN PROGRESS — 4A.1 complete; 4A.2 next  
**Decision:** D3a-L  
**Requirements:** R3a-12, R3a-14  
**Evidence:** [`docs/evidence/embedding-preflight-20260916T191526Z.json`](../evidence/embedding-preflight-20260916T191526Z.json)

## 4A.1 result — configuration and policy preflight

The runtime now accepts the private embedding base URL only through the ignored operator-local
config overlay or `PRIME_CLAW_EMBEDDING_BASE_URL`. Tracked defaults lock the remaining contract
to `Qwen3-Embedding-8B`, native 4096 dimensions, a 1000-second timeout, literal non-secret
`dummy`, and a candidate database distinct from the legacy database.

`bin/prime-claw embedding-preflight` validates that contract and atomically renders a mode-0600,
Git-ignored candidate policy. Output is sanitized. The candidate policy grants the configured
host/port only to gbrain/Bun and removes those binaries from the corporate AI-gateway route.
The tracked pre-cutover policy is not applied or changed into the candidate, so existing
`converge` behavior remains safe for the canonical 1536 index.

## Acceptance evidence

- Focused offline tests: **14 passed**; full offline suite: **126 passed**.
- Real operator-local preflight: **PASS**; endpoint and host absent from output/evidence.
- Rendered policy: ignored, mode 0600, configured endpoint match, exact two-binary scope.
- Read-only post-preflight database snapshot: 1,059 pages; 3,031 chunks; 3,031 embeddings;
  minimum/maximum vector dimensions both 1536.
- Candidate `gbrain_qwen4096` database count: **0**.
- No network, OpenShell, sandbox, or database call occurs in the preflight implementation.

The two extra pages/chunks above the original Slice 2 count are the existing validation probes;
this objective created no page and performed no write.

## Next

4A.2 must create a separate candidate `GBRAIN_HOME` and Postgres database, export
`GBRAIN_AI_EMBED_TIMEOUT_MS=1000000` (and the query timeout), full-sync with the exact model ID,
gate parity/dimensions/freshness/retrieval/corporate non-use, and only then switch the canonical
config and policy atomically. The legacy database remains untouched for rollback.
