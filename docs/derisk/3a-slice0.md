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
| prime-agent invokes gbrain CLI (mode-a controller) | ⚠️ BLOCKED* | "Connection error" — prime-agent's model call, not gbrain |
| Walk-up config needed? | ✅ NO | `GBRAIN_HOME` env suffices (zbrain fork delta not needed) |

\* Blocked by the environmental credential fault below, NOT by any gbrain/harness capability gap.

## Environmental blocker (owner action / infra, NOT a NO-GO for gbrain)

The OpenShell L7 credential injection into the sandbox is **unstable on this box**:

- The **host** AI-gateway key works directly for both routes (anthropic `/anthropic/v1/messages`
  and embeddings `/v1/embeddings` → HTTP 200), confirmed repeatedly.
- The **sandbox** (through the OpenShell L7 proxy) flaps between **200 and 403 "RBAC: access denied"**.
- Mechanism (diagnosed): the sandbox's injected placeholder embeds a **credential version**
  (`openshell:resolve:env:v<N>_api_key`); every `openshell provider update` bumps the provider
  resource version, **orphaning the running sandbox's placeholder**. A gateway restart
  (`brew services restart openshell`) clears a stale cached credential, but the fresh key then
  takes **~80s to propagate** to the sandbox (stale 403s during that window, then 200).
- Net: with a freshly-restarted gateway + a fresh sandbox created against a known-good key +
  a short settle wait, both credentialed routes work; but the window is fragile and the
  credential appears to be re-rotated/reverted by some host-side process afterward.

**Impact on the spike:** the gbrain **round-trip is fully proven** (init/sync/embed/get/search all
green when the credential is live). The **prime-agent controller leg** could not be held green
end-to-end because prime-agent's own anthropic model call needs the same gateway credential that
keeps flapping. This is a Phase-2 credential-wiring/infra concern, not an upstream-gbrain concern.

## Follow-ups (not blockers for the GO)

1. **Stabilize the AI-gateway credential for the sandbox** (OpenShell provider refresh semantics;
   why the placeholder orphans on update; whether a host process re-rotates the key). This is
   required for S1–S4 regardless of gbrain choice.
2. Re-run the prime-agent controller leg once the credential is stable; no code change to gbrain
   is anticipated.

## Code changes (Slice 0)

- `bin/prime-claw`: generalised gbrain build-source selection — `_gbrain_source()` /
  `_gbrain_src()` with `gbrain_source` config (default `upstream`, `zbrain` fallback),
  `PRIME_CLAW_GBRAIN_SOURCE` / `PRIME_CLAW_GBRAIN_UPSTREAM_SRC` overrides; `stage_gbrain_context`
  now also stages `scripts/postinstall.ts` (upstream `bun install` runs it); build fingerprint
  keys on the selected source so switching invalidates the idempotency skip.
- `config/runtime.json`: `gbrain_source=upstream`, `gbrain_upstream_src=~/gbrain`,
  `gbrain_zbrain_src=~/zbrain`.
- Tests: `tests/test_runtime_image.py` +9 (source selection, fingerprint invalidation,
  postinstall staging). Suite 75 → **84 green**.

**Image now builds upstream gbrain v0.50.0.0 by default.** zbrain fallback retained via
`gbrain_source=zbrain` (the NO-GO revert path, unused).
