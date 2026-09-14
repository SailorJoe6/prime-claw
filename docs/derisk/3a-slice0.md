# Slice 0 Spike — Upstream gbrain under prime-agent-as-controller (R3a-0)

**Date:** 2026-09-14 · **Bead:** prime-claw-zwg · **Verdict:** **GO (conditional)** — upstream
`garrytan/gbrain` runs correctly in the OpenShell sandbox; the only blocker is an
**environmental OpenShell/AI-gateway credential fault on this box**, not upstream gbrain.

## What was proven

| Capability | Result | Evidence |
|---|---|---|
| Upstream gbrain **builds** (Bun compile, linux-arm64) in the image | ✅ PASS | image `prime-claw-brain:0.1.0`, gbrain **v0.50.0.0**; required staging `scripts/postinstall.ts` |
| `gbrain init` against in-sandbox PG (postgres engine, `localhost:5433`) | ✅ PASS | engine=postgres, schema_pack=`gbrain-base-v2` (present upstream) |
| `gbrain sync --source brain` imports + **embeds** a fixture page | ✅ PASS | "1 file(s) imported, 1 chunks, **1 pages embedded**"; `vector_dims(embedding)=1536` |
| `gbrain get` retrieves the page | ✅ PASS | round-trip content returned |
| `gbrain search` (semantic, via AI-gateway embeddings) returns it | ✅ PASS | score 0.8778 on the known-fact token |
| prime-agent invokes gbrain CLI (mode-a controller) | ✅ PASS | ran `gbrain search`, returned cited answer "the mascot planet is Cobalt (`projects/prime-claw`)" |
| Walk-up config needed? | ✅ NO | `GBRAIN_HOME` env suffices (zbrain fork delta not needed) |

\* Resolved: the controller leg needed two non-obvious wirings (below), then passed.

## Two non-obvious wirings the controller leg needed (both fixed in `stage_prime_agent`/`stage_brain`)

1. **Model registration (`models.json`).** prime-agent in the container did not know the model id
   `anthropic.kimi-k3` nor the AI-gateway base URL, so it fell back to a catalog default
   (`claude-opus-4-7`) → the gateway rejected it → "Connection error". The host works because
   `~/.prime/agent/models.json` registers `anthropic.kimi-k3` against `…/anthropic`. Fix: 
   `stage_prime_agent` now writes `/sandbox/.prime/agent/models.json` (metadata + base URL only;
   no secrets) from `ai_gateway_host` + `model` config. After this, `prime-agent -p --model
   anthropic.kimi-k3 …` drives gbrain and returns a cited answer. **Validated green.**
2. **Credential stability (environmental, shelved).** The sandbox→gateway L7 path 403s when the
   host is **off the VPN** (the gateway does source-network RBAC); with the VPN up it is stable
   (50/50 consecutive 200s across both anthropic + embeddings routes, container and host alike).
   Joe: this is expected when the VPN is down; only revisit if it recurs while the VPN is up.

## Validator status after Slice 0

`bin/prime-claw validate`: **14/15 PASS** including `credentialed-model-call` (anthropic.kimi-k3)
and `brain-embedding-via-gateway` (dims=1536). The single remaining FAIL, `brain-search-roundtrip`,
is a **Slice-2** item: the probe does `cd /sandbox/brain` and expects a served brain initialised
there; Slice 0 used a separate fixture source (`/sandbox/brain-src`). S2 (index serving) makes
`/sandbox/brain` the real served brain and will turn this green.

## Code changes (Slice 0)

- `bin/prime-claw`: generalised gbrain build-source selection — `_gbrain_source()` /
  `_gbrain_src()` with `gbrain_source` config (default `upstream`, `zbrain` fallback),
  `PRIME_CLAW_GBRAIN_SOURCE` / `PRIME_CLAW_GBRAIN_UPSTREAM_SRC` overrides; `stage_gbrain_context`
  also stages `scripts/postinstall.ts` (upstream `bun install` runs it); build fingerprint keys on
  the selected source; `stage_prime_agent` writes `models.json` (gateway model + base URL).
- `config/runtime.json`: `gbrain_source=upstream`, `gbrain_upstream_src=~/gbrain`,
  `gbrain_zbrain_src=~/zbrain`.
- Tests: `tests/test_runtime_image.py` +10 (source selection, fingerprint invalidation,
  postinstall staging, models.json staging). Suite 75 → **85 green**.

**Image builds upstream gbrain v0.50.0.0 by default.** zbrain fallback retained via
`gbrain_source=zbrain` (the NO-GO revert path, unused). **Slice 0 verdict: GO** — upstream gbrain
under prime-agent-as-controller is proven end-to-end (build → init → sync → embed → search →
cited read by the sandboxed prime-agent).
