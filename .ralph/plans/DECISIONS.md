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
credentials. Provider selection follows explicit user configuration when present. D3a-M
defines the portable no-config defaults; D3a-K records the operator-specific Codex acceptance
proof and does not redefine repository defaults.
**Satisfies:** R3a-7, R3a-13, R3a-15.
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

## D3a-I — Sandbox prime-agent non-secret config mirrors an existing user preference
**Decision:** When the operator already has valid host `models.json` and `settings.json` with
an explicit default provider/model, `stage_prime_agent` copies them verbatim into
`/sandbox/.prime/agent/`. That existing preference takes precedence and carries its model
metadata, thinking level, and enabled-model set. Host `auth.json` is never copied. When the
host files are absent or do not name a usable preferred model, D3a-M's portable Kimi/AI-gateway
default is the acceptance target. Source paths are overridable via
`host_{models,settings}_json` / `PRIME_CLAW_HOST_{MODELS,SETTINGS}_JSON`.
**Rationale:** The container must respect a user's existing Prime Agent choice without making
one developer's configuration the repository default. Slice 0 proved models.json was
necessary; Slice 3 proved settings.json is equally necessary when the user's selected provider
changed. D3a-M supersedes the old rule that any available host default automatically defined
portable acceptance. Satisfies R3a-13 and R3a-15.

## D3a-J — Conditional provider credential refresh (skip when unchanged)
**Decision:** `stage_provider` (ai-gateway), `stage_github_provider`, and `stage_codex_provider` refresh the stored
credential ONLY when it changed, tracked by a sha256 hash in
`.prime-claw-{ai-gateway-key,github-token,codex-oauth}.sha256` (gitignored; hash only, never the secret).
Under D3a-M, only credential stages required by the selected profiles run; Codex is
conditional on an explicit override and is not part of the no-config default.
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
| D3a-D | R3a-7, R3a-13, R3a-15 |
| D3a-I | R3a-13, R3a-15 |
| D3a-K | R3a-3, R3a-7, R3a-13 |
| D3a-M | R3a-5, R3a-7, R3a-12, R3a-13, R3a-15 |
| D3a-J | R3a-5, R3a-7 |
| D3a-L | R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14 |
| D3a-E | R3a-8, R3a-11 |
| D3a-F | R3a-9 |
| D3a-G | R3a-3, R3a-4, R3a-6 |
| D3a-H | R3a-2, R3a-8, R3a-9 |

GATE requirements R3a-1..15 are covered by at least one decision or the slice's direct
implementation. R3a-12 freshness is mandatory for whichever embedding profile is selected;
R3a-14 is conditional on selecting the local-Qwen override. Keyword-only acceptance remains
forbidden.

## D3a-K — Operator override acceptance used ChatGPT-5.6 Sol via isolated Codex OAuth (2026-09-16)
**Decision:** The 2026-09-16 conversational acceptance run follows the operator's explicit
mirrored host choice: `openai-codex/gpt-5.6-sol` (ChatGPT-5.6 Sol, thinking `high`). This is
proof that explicit provider/model overrides and credential isolation work; it is not the
portable repository default. D3a-M defines no-config defaults. Embedding selection is
independent and governed by D3a-L/M.

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

## D3a-L — Home-network Qwen is an optional operator embedding override (revised 2026-09-17)
**Decision:** Preserve the operator's home-network OpenAI-compatible
`Qwen3-Embedding-8B` service as an explicit local override, not the repository default. The
profile uses native 4096-dimensional output and a 1000-second request timeout. Selecting it
requires a full non-destructive parallel rebuild because Qwen and the default OpenAI model use
different vector spaces.

Compatibility evidence remains unchanged: this deployment returns HTTP 400 when either 1536
or 4096 is sent in the OpenAI `dimensions` field and returns 4096 values when the field is
omitted. Build and validate a parallel database before switching an operator who selected the
profile. Keep the default/previous 1536-dimensional database for rollback. The private
endpoint remains ignored operator-local data; literal `dummy` is non-secret compatibility
data. Policy grants only the exact configured host/port.

**Satisfies:** R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14.
**Superseded aspect:** The 2026-09-16 wording made home Qwen the sole supported configuration.
D3a-M restores portable AI-gateway defaults while retaining this profile as an override.

## D3a-M — Portable Zendesk AI-gateway defaults; explicit user config wins (2026-09-17)
**Decision:** A fresh clone with no preferred provider configuration defaults both model
concerns to the Zendesk AI Gateway:

- inference: `anthropic.kimi-k3` (default); `anthropic.glm-5.2` is a supported alternative;
- embeddings: `openai:text-embedding-3-large`, 1536 dimensions (the proven pre-Spark path).

Explicit host/local/environment configuration overrides inference and embeddings independently.
Joe's DGX/Qwen profile and Codex OAuth model are valid operator overrides, but neither may be a
tracked prerequisite or no-config default. Credential isolation remains unchanged: real gateway
or OAuth credentials stay in OpenShell and only placeholders enter the sandbox. Each selected
embedding profile must remain internally fresh and single-vector-space; profile changes rebuild
in parallel rather than mixing vectors.

**Satisfies:** R3a-5, R3a-7, R3a-12, R3a-13, R3a-15.
**Rationale:** prime-claw is a reusable builder project. Requiring uncommon personal hardware
or a developer's private OAuth setup would make the checked-in defaults unusable for the
average operator. The gateway path was already proven in Slices 0–2; the remaining work is to
restore it as the tracked default and make local overrides explicit and independently testable.
