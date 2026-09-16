# Decisions — Phase 3a: Tracer Bullet (a brain-hosting claw)

Beads: `prime-claw-zwg` (P1). Index: [SPECIFICATION.md](SPECIFICATION.md). Requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

Each decision lists the requirement IDs it satisfies.

## D3a-A — Self-contained container; prime-agent is the mode-(a) harness-as-controller
**Decision:** The brain is cloned into the sandbox and indexed by the in-sandbox
gbrain+Postgres. prime-agent **is the mode-(a) harness-as-controller**: it drives the
gbrain CLI directly, manages/administers the in-sandbox brain database, and (in later
slices) manages the collection channels and signal sweep. It does **not** act as a thin
MCP client of an external brain for this phase. Mode (b) — prime-agent as a participant
MCP client of a gbrain — is supported as a secondary goal (we intend to add prime-agent as
a first-class upstream harness, which spans both modes), but is NOT the tracer bullet.
**Satisfies:** R3a-1, R3a-2.
**Rationale:** Operator direction — "prime-claw should evolve to completely replace
gbrain/zbrain's container; the brain lives in it." A self-contained container keeps
deny-by-default egress intact and makes the claw's knowledge local and fast. Thin-client
(MCP to an external brain) was considered and rejected for the hosting goal (it leaves the
brain outside the container and requires an egress hole).

## D3a-B — Brain enters via git clone WITH `.git`, push-capable through a custom L7 profile
**Decision:** The brain enters the sandbox by cloning the operator's brain repo
(`~/gitlab_local/brain`, GitHub `JLandersZen/brain`, branch `main`, private) **with `.git`**,
and the sandbox can **push back** (commit + push round-trip verified, Slice 1). Writes remain
in ralph-pva until the ingest/memorize skills port (3b+); 3a is read + one routed test write
into the sandbox clone only.
**Satisfies:** R3a-1, R3a-4, R3a-7.
**Resolved mechanism (Slice 1, was SPEC §7.1 open question):** in-sandbox HTTPS clone using the
placeholder token `${api_token}`, swapped to the real token at L7 by a **custom `github-push`
provider profile** (the builtin `github` profile is fetch-only — it allows `POST` only to
`/**/git-upload-pack`; `github-push` adds `POST /**/git-receive-pack` + read-write
`api.github.com`). Token read host-side via `gh auth token`; sandbox disk holds only the
placeholder (`openshell:resolve:env:..._api_token`); `.git/config` contains zero real token.
The host-dir `--upload` path was **removed** from `stage_sandbox` (it drops `.git`, defeating
push-back); `stage_sandbox` now attaches **both** providers at create (`--provider` repeatable).
**Policy consequence:** once a credentialed github provider is attached, OpenShell requires
EVERY `github.com` rule to be L7 (`protocol: rest`) — so `github.com`/`api.github.com` moved out
of the L4 `kernel_bootstrap` rule into a single credentialed `github_brain` rule keyed to
`/usr/bin/git` + `/usr/local/bin/uv` + `/usr/bin/curl` (uv/curl keep the kernel-bootstrap
python-build-standalone download reachable; they never send the placeholder, so the swap never
fires for them).

## D3a-C — prime-agent is the harness (the novel surface)
**Decision:** The brain is consumed by **prime-agent** running in the sandbox, using
prime-agent's own constructs (`.agents/skills/` discovery, the continual harness, daemon,
`rlm`, `schedule`). We do not wire gbrain's Claude/Codex/OpenClaw harness paths.
**Satisfies:** R3a-3, R3a-4, R3a-8.
**Rationale:** This is the genuinely novel, untested integration — gbrain ships harness
recipes for `claude-code | codex | opencode | openclaw` but not prime-agent. prime-claw's
purpose is to put prime-agent at the center; proving the prime-agent↔gbrain loop is the
point of the tracer bullet.

## D3a-D — Inference credential isolation unchanged; concrete provider follows host
**Decision:** The host OpenShell provider holds the real credential; only a placeholder
enters the sandbox; L7 swaps it at the boundary. The claw never possesses real LLM
credentials. The earlier concrete Kimi/AI-gateway target is superseded by D3a-K: acceptance
now follows the mirrored host default (`openai-codex/gpt-5.6-sol` until further notice).
**Satisfies:** R3a-7, R3a-13.
**Rationale:** This isolation is best practice and already proven in Phase 2. A literal
"copy auth.json into the container" approach and a dedicated claw inference identity remain
**rejected**. Mirroring user config means mirroring non-secret selection/config plus a
placeholder-only auth projection, not copying OAuth tokens.

## D3a-E — Reuse proven gbrain capability; test only the delta
**Decision:** Do not author tests that re-prove gbrain CLI/sync/embedding (covered upstream).
prime-claw tests target: brain clone wiring, in-sandbox index integration, the
prime-agent-harness read/query/write loop, and the validate gate. **Correction:** the browse
proxy-shim/host-bridge are **zbrain-local, never upstreamed** — 3c ports them and tests the
port+integration (not as 'reuse of upstream-tested components'); the gbrain-vs-browse fork
questions are separate, and the gbrain fork-vs-upstream choice is deferred to a Slice-0 spike
(open question 5).
**Satisfies:** R3a-8, R3a-11.
**Rationale:** zbrain maintains ~1,626 CLI tests. Re-testing them adds cost with no
information. The information-bearing tests are the prime-agent integration and the lifecycle
wiring.

## D3a-F — Generic platform; instance concerns stay out
**Decision:** prime-claw carries no operator-specific taxonomy, values, or personal skills.
The brain repo path is configurable. Joe's personal skills and the `prime-pva` instance
repo are created at 3b, not here.
**Satisfies:** R3a-9.
**Rationale:** prime-claw = the zbrain role (generic platform). Baking one operator's
schema/config into it is the exact mistake the IA doc's two-level split forbids.

## D3a-G — Acceptance = read/query + one routed write
**Decision:** 3a is accepted when a fresh sandbox serves a cited answer from the brain
**and** lands one correctly-routed durable write as a keep-worthy prime-claw `projects/`
stub. The sandbox commits and pushes that page to the real brain repo through the GitHub L7
provider; the receipt records slug, commit SHA, push result, and credential isolation.
**Satisfies:** R3a-3, R3a-4, R3a-6.
**Rationale:** Operator's chosen bar — thin but whole, proving both directions of the
brain loop including durable source-of-truth push-back. The operator confirmed the exact
`projects/prime-claw` slug before Slice 4 execution on 2026-09-16.

## D3a-H — Prefer upstream gbrain; fork only to upstream a prime-agent harness PR, then retire
**Decision:** Build prime-claw against **upstream `garrytan/gbrain`** (not zbrain's stripped
fork). To add prime-agent as a first-class upstream harness (spanning mode a controller and
mode b participant), we will **fork gbrain solely to author the PR**, monitor upstream, and
**retire the fork once the PR is accepted/merged**. Walk-up project config (zbrain's delta)
is NOT needed in the single-brain container (GBRAIN_HOME/env suffices); zbrain's claw-skill
"strip" is unnecessary because unused skills are simply omitted. A Slice-0 spike must PROVE
upstream gbrain runs correctly under prime-agent-as-controller in the sandbox; if it reveals
a hard, inelegant blocker, the documented fallback is a maintained thin fork.
**Satisfies:** R3a-8, R3a-9, R3a-2.
**Rationale:** prime-claw's goal is prime-agent-as-controller of a gbrain; that capability
belongs upstream so anyone's prime-agent gets a brain. A permanent fork is a maintenance
burden whose original justifications (OpenClaw-only, hard-coded taxonomy, walk-up config) are
now obsolete upstream.

## D3a-I — Sandbox prime-agent non-secret config mirrors the host
**Decision:** `stage_prime_agent` copies the operator's host `models.json` **and**
`settings.json` verbatim into `/sandbox/.prime/agent/`. This carries model metadata plus the
user's current default provider/model/thinking level and enabled-model set. Host `auth.json`
is never copied. If host config is absent, a configurable built-in fallback remains, but it
is not the acceptance target while the host default is available. Source paths are
overridable via `host_{models,settings}_json` / `PRIME_CLAW_HOST_{MODELS,SETTINGS}_JSON`.
**Rationale:** The container must behave like the user's local Prime Agent rather than drift
to a stale project-pinned model. Slice 0 proved models.json was necessary; Slice 3 proved
settings.json is equally necessary when the user's selected provider changed. Satisfies
R3a-13.

## D3a-J — Conditional provider credential refresh (skip when unchanged)
**Decision:** `stage_provider` (ai-gateway), `stage_github_provider`, and `stage_codex_provider` refresh the stored
credential ONLY when it changed, tracked by a sha256 hash in
`.prime-claw-{ai-gateway-key,github-token,codex-oauth}.sha256` (gitignored; hash only, never the secret).
**Satisfies:** R3a-5, R3a-7.
**Rationale (Slice 1 finding):** every `openshell provider update` bumps a resource version
that re-keys the SANDBOX's placeholder set, and a running sandbox still holds the OLD
placeholders — so a needless update breaks the sandbox's credentialed endpoints (inference AND
git push) until recreate. Idempotent converge requires skipping no-op updates. Operational
corollary: if an operator rotates a token, re-sync provider + hash file together (the next
`create`/`converge` handles this automatically since the hash no longer matches).

## Decision → Requirement traceability matrix

| Decision | Requirements |
|----------|--------------|
| D3a-A | R3a-1, R3a-2 |
| D3a-B | R3a-1, R3a-4, R3a-7 |
| D3a-C | R3a-3, R3a-4, R3a-8 |
| D3a-D | R3a-7 |
| D3a-I | R3a-13 |
| D3a-J | R3a-5, R3a-7 |
| D3a-L | R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14 |
| D3a-E | R3a-8, R3a-11 |
| D3a-F | R3a-9 |
| D3a-G | R3a-3, R3a-4, R3a-6 |
| D3a-H | R3a-2, R3a-8, R3a-9 |

GATE requirements R3a-1..14 are covered by at least one decision or the slice's direct
implementation. R3a-12 and R3a-14 are mandatory before the routed write resumes; embedding
freshness may not defer or fall back to keyword-only acceptance.

## D3a-K — Current acceptance model is host-default ChatGPT-5.6 Sol via isolated Codex OAuth (2026-09-16)
**Decision:** Until further notice, conversational acceptance runs use the operator's
mirrored host default: `openai-codex/gpt-5.6-sol` (ChatGPT-5.6 Sol, thinking `high`). Kimi
and GLM are currently unavailable to the operator and must not be used for acceptance.
Embedding configuration is independent and governed by D3a-L.

Host openai-codex `auth.json` values are provisioned into OpenShell's builtin `codex`
provider (`access_token`, `refresh_token`, `account_id`). Sandbox `auth.json` contains a
non-secret JWT-shaped adapter value plus `openshell:resolve:` placeholders only. The
synthetic JWT lets prime-agent locally derive a non-secret placeholder account id;
`npm-onload.js` rewrites outbound Codex Authorization and account headers to OpenShell
placeholders for both fetch/SSE and WebSocket paths, then L7 swaps real values at the
boundary. Expiry is pinned far-future in the projection so prime-agent never refreshes OAuth
inside the sandbox (which could otherwise write a real returned token to disk). Provider
refresh remains host-side in lifecycle stages.

**Satisfies:** R3a-3, R3a-7, R3a-13.
**Evidence:** `docs/evidence/cited-query-20260916T164509Z.json`; offline header-rewrite and
config-projection tests in `tests/test_runtime_converge.py`.

## D3a-L — Home-network Qwen embeddings are the sole embedding configuration (2026-09-16)
**Decision:** Replace the corporate AI-gateway embedding path with the operator's
home-network OpenAI-compatible `Qwen3-Embedding-8B` service as the **only** supported
embedding configuration. Use the model's native 4096-dimensional output and a 1000-second
request timeout. Do not retain the corporate gateway as an embedding fallback.

The live compatibility probe established that requests with `dimensions: 1536` and
`dimensions: 4096` both return HTTP 400 because this deployment does not support the
OpenAI `dimensions` parameter; omitting it returns HTTP 200 with 4096 values. Even a
same-width output would still require full re-embedding because Qwen and OpenAI vectors
belong to different vector spaces.

The cutover is non-destructive: create a parallel 4096-dimension Postgres database/index,
fully sync and embed the canonical brain clone, validate counts and semantic retrieval, and
only then point the sandbox at it. Keep the current 1536-dimension database intact as rollback
until Phase 3a acceptance. The private endpoint address belongs in ignored operator-local
configuration or environment, not tracked files. The endpoint is unauthenticated; a client
may send literal `dummy` only when a nonempty API-key field is required. No OpenShell
credential provider is needed, but deny-by-default policy must allow only the configured
host/port for the gbrain runtime.

**Satisfies:** R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14.
**Supersedes:** Q2's AI-gateway / `text-embedding-3-large` / 1536-dimension runtime choice.
Slice 0–2 evidence remains valid historical proof, not the accepted final configuration.
