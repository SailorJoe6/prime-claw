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

## D3a-D — Inference auth unchanged (host L7 provider)
**Decision:** No change to inference auth. The host OpenShell provider holds the real
credential; only a placeholder enters the sandbox; the L7 proxy swaps it at the boundary.
The claw never possesses LLM credentials.
**Satisfies:** R3a-7.
**Rationale:** This is best practice and already proven in Phase 2. A "copy auth.json into
the container" approach (the zbrain parked spec's D5) and a "dedicated claw inference
identity" were both explicitly **rejected** — the former breaks credential isolation, the
latter was never a requirement. Claw-unique identity applies only at *write* surfaces
(GitHub/Gmail/Slack/Telegram), not inference.

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
**and** lands one correctly-routed durable write (a test artifact: easily deleted, or a
keep-worthy prime-claw `projects/` stub). Write-back (git push) to the real repo is out of
scope.
**Satisfies:** R3a-3, R3a-4, R3a-6.
**Rationale:** Operator's chosen bar — thin but whole, proving both directions of the
brain loop without yet owning the full write/sync-back machinery.

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

## D3a-I — Sandbox prime-agent model config mirrors the host (verbatim copy + 2-model fallback)
**Decision:** `stage_prime_agent` copies the operator's host `~/.prime/agent/models.json`
**verbatim** into the sandbox (`/sandbox/.prime/agent/models.json`). This is a deliberate
**feature**: whatever the user has configured for prime-agent locally is what they get inside
the container. The host file contains **no secrets** (base URLs + model metadata only;
credentials live in `~/.prime/agent/auth.json`, which is never copied). **Fallback** when no
readable host config exists: a built-in default registering exactly the two current models —
`anthropic.kimi-k3` and `anthropic.glm-5.2` — against the configured AI gateway, so a fresh
operator still gets a working model. The source path is overridable via `host_models_json` /
`PRIME_CLAW_HOST_MODELS_JSON`. **Rationale:** Slice 0 showed the container failed model
resolution without this file (fell back to an unauthorized catalog default → "Connection
error"); copying the host file both fixes that and removes config drift between host and
sandbox. Satisfies R3a-13.

## D3a-J — Conditional provider credential refresh (skip when unchanged)
**Decision:** `stage_provider` (ai-gateway) and `stage_github_provider` refresh the stored
credential ONLY when it changed, tracked by a sha256 hash in
`.prime-claw-{ai-gateway-key,github-token}.sha256` (gitignored; hash only, never the secret).
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
| D3a-E | R3a-8, R3a-11 |
| D3a-F | R3a-9 |
| D3a-G | R3a-3, R3a-4, R3a-6 |
| D3a-H | R3a-2, R3a-8, R3a-9 |

GATE requirements R3a-1..7, R3a-9..11 are covered by at least one decision.
(R3a-5 lifecycle integration and R3a-6 acceptance gate are realized directly by the
slice's implementation; R3a-12 embedding freshness is NICE and may defer.)
