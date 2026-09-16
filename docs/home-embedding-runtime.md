# Home-network embedding runtime

> **Status:** Slice 4A.1 preflight complete; parallel build/cutover not started.
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

The operator-local endpoint config and rendered candidate policy now pass preflight. No
OpenShell policy was applied, no database migration/re-index was started, and the canonical
1536-dimension database remains untouched. The candidate database is only named in config;
it does not exist yet.

The attempted `projects/prime-claw` write stopped on corporate gateway rate limiting and
rolled back cleanly: the page is absent, the brain Git clone is clean, and no commit or push
occurred. Slice 4A.2 (parallel build and acceptance gates) is next. Slice 4B remains blocked
until the full Slice 4A cutover passes.
