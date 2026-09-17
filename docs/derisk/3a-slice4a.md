# Phase 3a Slice 4A — optional home-Qwen embedding override

**Status:** READY TO RESUME AFTER PREFLIGHT — 4A.1 complete; 4A.2a partial candidate preserved; Spark recovery confirmed
**Decision:** D3a-L
**Requirements:** R3a-12, R3a-14
**Evidence:** [`docs/evidence/embedding-preflight-20260916T191526Z.json`](../evidence/embedding-preflight-20260916T191526Z.json)
**Interrupted-build evidence:** [`docs/evidence/embedding-build-interrupted-20260916T234215Z.json`](../evidence/embedding-build-interrupted-20260916T234215Z.json)

## Requirement revision (2026-09-17)

This Qwen/4096 path is now an explicit operator-local override, not the repository default.
D3a-M/R3a-15 require fresh installs with no preferred config to use Zendesk AI Gateway
`text-embedding-3-large`/1536 embeddings and Kimi K3 inference. This verdict continues to
track Joe's selected local profile and its non-destructive safety contract.

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
## 4A.2a interrupted build — external hardware blocker recovered

The isolated candidate build was started from implementation commit `e92abf4`. The operator
reported that the DGX Spark hosting the embedding model crashed and stopped serving. The build
was stopped rather than waiting on the 1,000-second request timeout. No gbrain process remains.

Preserved candidate state is partial and **not accepted**: 350 `brain` pages, 1,140 chunks,
1,140 embeddings, all currently 4096-dimensional in a `vector(4096)` column, no unsupported
HNSW index, and no source bookmark. The missing bookmark correctly prevents the partial import
from passing the build gate.

The tracked historical policy was restored. A separate read-only fingerprint confirmed the
canonical config, schema, page/chunk/vector/model state, source bookmark, embedding config, and
migration version are unchanged. No canonical cutover occurred and the legacy database remains
intact.

**Recovery update (2026-09-17):** the operator confirms the DGX Spark is alive and ready.
No build has restarted. First rerun the operator-local compatibility/preflight probe for the
exact `Qwen3-Embedding-8B` service; if it passes, resume with
`bin/prime-claw embedding-build`. The isolated candidate database is intentionally preserved
for a safe full-sync resume. Do not drop or mutate the legacy database.

Sanitized machine evidence: [`embedding-build-interrupted-20260916T234215Z.json`](../evidence/embedding-build-interrupted-20260916T234215Z.json).
