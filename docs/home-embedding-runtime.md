# Home-network embedding runtime

> **Status:** BLOCKED — DGX Spark outage paused Slice 4A.2a; partial candidate preserved; no cutover.
> **Decision:** D3a-L · **Requirements:** R3a-12, R3a-14 · **Plan:** Phase 3a Slice 4A

## Required state

prime-claw uses the operator's home-network OpenAI-compatible embedding service as its
**only** embedding provider:

- model: `Qwen3-Embedding-8B`
- output: native 4096 dimensions
- request timeout: 1000 seconds
- authentication: none; literal `dummy` is permitted only for OpenAI clients that require a
  nonempty API-key field and is not a credential

The corporate AI gateway is not an embedding fallback. Prime Agent inference remains a
separate, host-selected concern (currently isolated OpenAI Codex OAuth).

The private endpoint address is operator-local configuration. It must enter through an
ignored local file or `PRIME_CLAW_*` environment and must never be committed, printed in
evidence, or copied into a generic policy fixture.

## Why this is a rebuild, not a config flip

The current sandbox index is historical Slice 2 state: 3,029 chunks embedded with an OpenAI
model at 1536 dimensions. The home service returns 4096-dimensional Qwen vectors.

Compatibility probes established:

| Request | Result |
|---|---|
| dimensions omitted | HTTP 200; 4096 values |
| `dimensions: 1536` | HTTP 400; deployment does not support Matryoshka dimensions |
| `dimensions: 4096` | HTTP 400; `dimensions` must be omitted |

Vector spaces from different models cannot be mixed, even at equal width. Every chunk must
therefore be re-embedded. The dimension change also requires a new pgvector schema/index.

## Configuration and policy preflight

Slice 4A.1 adds a non-mutating preflight. It validates the locked Qwen contract and renders
the exact home endpoint into an ignored, mode-0600 local policy. It does not call OpenShell,
enter the sandbox, or touch Postgres.

Put the endpoint in `.prime-claw/runtime.local.json` (ignored by Git):

```json
{
  "embedding_base_url": "http://<home-embedding-host>:<port>/v1"
}
```

Then restrict the file and run the preflight:

```bash
chmod 600 .prime-claw/runtime.local.json
bin/prime-claw --dry-run embedding-preflight
bin/prime-claw embedding-preflight
```

The command reports only the model, dimensions, timeout, candidate/legacy database names,
and `endpoint=operator-local (redacted)`. It writes
`.prime-claw/runtime-policy.local.yaml`, also mode 0600 and ignored. That candidate policy:

- grants the configured host/port only to `/usr/local/bin/gbrain` and
  `/usr/local/bin/bun`;
- removes gbrain/Bun from the corporate AI-gateway rule;
- leaves inference and GitHub routes unchanged.

The tracked policy deliberately retains historical gbrain/Bun corporate access until the
actual cutover. This keeps ordinary pre-cutover `converge` safe for the still-canonical 1536
index. The rendered candidate policy removes it, and a later Slice 4A step applies that policy
only with the parallel Qwen build.


## Parallel candidate build

Slice 4A.2a adds `embedding-build`. It is intentionally separate from `create` and
`converge`:

```bash
bin/prime-claw --dry-run embedding-build
bin/prime-claw embedding-build
```

The command gates upstream gbrain at `0.48.5.0` or newer, then applies the ignored candidate
policy and builds only `gbrain_qwen4096`. It sets `GBRAIN_HOME` to the parent
`/sandbox/.prime-claw/qwen-candidate` (upstream appends `.gbrain`), writes the candidate config
mode 0600, exports both embedding and query-embedding timeouts as `1000000` ms, registers the
canonical `/sandbox/brain` clone, and performs a pinned single-worker full sync with explicit non-interactive inline-embed consent with pull and
extraction disabled. It exports the upstream 12,000-second sync hard deadline and a
1,200-second no-progress watchdog; the outer build timeout is 14,400 seconds.

The build gate requires `vector(4096)`, a source bookmark equal to the pinned brain Git HEAD,
every candidate chunk stamped with the current text hash/signature and exact Qwen model, and no
unsupported HNSW index. A separate read-only fingerprint covers the canonical config hash,
schema, page/chunk/vector/model counts, source bookmark, embedding config, and migration version
before and after every normal build exit. It does **not** switch `/sandbox/.gbrain/config.json`. It restores the
tracked historical policy after both success and reported failure so the legacy runtime stays
queryable between build and validation; after an externally interrupted process, run
`bin/prime-claw converge` to restore that policy. A partial candidate database is isolated and
may be resumed by rerunning `embedding-build`; never drop or alter the legacy `gbrain`
database.

## Non-destructive cutover

Slice 4A must:

1. Leave the current 1536-dimension database untouched.
2. Create a parallel 4096-dimension Postgres database/index.
3. Full-sync the canonical `/sandbox/brain` clone using only the home Qwen service.
4. Gate on page/chunk parity, 4096 dimensions for every chunk, zero stale/null/mixed vectors,
   exact retrieval, and semantic search.
5. Switch the canonical gbrain config only after validation.
6. Retain the old database as rollback until Phase 3a acceptance closes.

Deny-by-default network policy must allow only the locally configured embedding host/port to
the gbrain/Bun runtime. It must not provision an embedding credential provider.

## Current operational status

The operator-local endpoint config and rendered candidate policy pass preflight. The isolated
candidate-build path is implemented and offline-tested. A live build reached 350 source pages
and 1,140 fully embedded 4096-dimensional chunks before the DGX Spark crashed. That partial
candidate has no source bookmark and is not accepted. The process is stopped, the historical
policy is restored, the canonical fingerprint is unchanged, and no cutover occurred. Resume
only after the operator confirms the exact home model is serving again.

The attempted `projects/prime-claw` write stopped on corporate gateway rate limiting and
rolled back cleanly: the page is absent, the brain Git clone is clean, and no commit or push
occurred. Slice 4A.2 (parallel build and acceptance gates) is next. Slice 4B remains blocked
until the full Slice 4A cutover passes.
