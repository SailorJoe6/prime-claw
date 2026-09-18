# Home-network embedding runtime

> **Status:** OPERATOR-REQUIRED PROFILE BLOCKED — resumed candidate preserved; exact Qwen service unavailable again; no cutover.
> **Decision:** D3a-L/M · **Requirements:** R3a-12, R3a-14, R3a-15 · **Plan:** Phase 3a Slices 4P/4A

## Portable default versus this optional profile

The checked-in no-config default uses Zendesk AI Gateway
`openai:text-embedding-3-large` at 1536 dimensions. That portable profile is implemented and
remains available to other operators. An operator may explicitly override the default with
the home-network OpenAI-compatible profile documented here:

- model: `Qwen3-Embedding-8B`
- output: native 4096 dimensions
- request timeout: 1000 seconds
- authentication: none; literal `dummy` is permitted only for OpenAI clients that require a
  nonempty API-key field and is not a credential

The gateway is the portable default, not a fallback from this profile. Embedding and inference
are selected independently. With no preferred inference config, the portable inference default
is Zendesk AI Gateway `anthropic.kimi-k3` (GLM supported); explicit host config may choose
another model such as Codex.

The private endpoint address is operator-local configuration. It must enter through an
ignored local file or `PRIME_CLAW_*` environment and must never be committed, printed in
evidence, or copied into a generic policy fixture.

## Why this is a rebuild, not a config flip

The current canonical sandbox index is the previously proven AI-gateway/OpenAI 1536-dimensional
state and is the basis of the portable default. The optional home service returns
4096-dimensional Qwen vectors.

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

The tracked policy retains gbrain/Bun AI-gateway access because that is the portable default.
The rendered local candidate policy removes it only while building or validating the explicitly
selected home profile. A later cutover must change only that operator's selected runtime; it
must not erase the tracked gateway default.


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
before and after every normal build exit. It does **not** switch
`/sandbox/.gbrain/config.json`. It restores the tracked gateway/default policy after both success and reported failure so the legacy runtime stays
queryable between build and validation; after an externally interrupted process, run
`PRIME_CLAW_EMBEDDING_PROFILE=gateway bin/prime-claw converge` to restore that policy. A partial candidate database is isolated and
may be resumed by rerunning `embedding-build`; never drop or alter the legacy `gbrain`
database.

## Non-destructive optional-profile cutover

When the operator selects the home profile, Slice 4A must:

1. Leave the current 1536-dimension database untouched.
2. Create a parallel 4096-dimension Postgres database/index.
3. Full-sync the canonical `/sandbox/brain` clone using only the home Qwen service.
4. Gate on page/chunk parity, 4096 dimensions for every chunk, zero stale/null/mixed vectors,
   exact retrieval, and semantic search.
5. Switch the canonical gbrain config only after validation.
6. Retain the old database as rollback until Phase 3a acceptance closes.

While `home-qwen` is selected but not cut over, ordinary `create`/`converge` fail closed before
mutation. Profile-aware validation temporarily applies the candidate policy, uses the candidate
`GBRAIN_HOME` and candidate database (never canonical gbrain with candidate SQL), and restores
the canonical gateway policy in a guaranteed cleanup path. Restore failure is a gate failure.

Deny-by-default network policy must allow only the locally configured embedding host/port to
the gbrain/Bun runtime. It must not provision an embedding credential provider.

## Current operational status

The operator-required local profile is blocked on the exact Qwen service. A 2026-09-18
compatibility probe initially passed and one isolated build resumed. It advanced the preserved
candidate to 439 pages and 1,459 fully embedded 4096-dimensional chunks, then sustained embedding
requests failed. The 12,000-second hard deadline stopped the run safely; a post-failure exact-model
host probe returned HTTP 503.

The candidate has zero detected stale/null/mixed stored vectors but no source bookmark and is not
accepted. The canonical `gbrain` database/config remain unchanged at 1,059 pages and 3,031
1536-dimensional chunks, the gateway policy was restored, and no cutover occurred.

Before resuming again:

1. Restore and confirm the exact Qwen service is stable.
2. Correct the discovered fail-fast gap: the upstream `--full` `import.files` path did not honor
   the configured 1,200-second no-progress watchdog, although the hard deadline worked.
3. Require both host and in-sandbox exact-model probes to return HTTP 200 with 4096 values.
4. Resume exactly one isolated build; never drop or modify either database.

Evidence: [`embedding-build-service-unavailable-20260918T045000Z.json`](evidence/embedding-build-service-unavailable-20260918T045000Z.json).
