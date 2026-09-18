# Execution Plan — Phase 3a: Tracer Bullet (a brain-hosting claw)

**Status:** ACTIVE — Slices 4P and 4R complete; operator-required local-Qwen Slice 4A build is IN PROGRESS; Slice 4B is blocked on 4A by operator ordering
**Beads:** `prime-claw-zwg` (P1)
**Spec:** [SPECIFICATION.md](SPECIFICATION.md) · **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) · **Decisions:** [DECISIONS.md](DECISIONS.md)
**Date:** 2026-09-11 · **Slice 4A execution updated:** 2026-09-18

This plan implements the Phase 3a spec as **vertical slices** (Cockburn elephant-carpaccio):
each slice ends in a *working capability + passing tests + committed & pushed*, and retires a
named requirement set. Slices are dependency-ordered; **Slice 0 is a go/no-go gate** that may
pivot the gbrain choice (upstream vs. thin fork) before any real brain content is touched.

## Operating discipline (carried, binding)

- **Manual-first.** No automation loops; each slice is driven by hand and proven.
- **apply/check/validate/test.** Every capability gets a `bin/prime-claw` stage (idempotent),
  pytest coverage (offline, monkeypatched `pc.*`), a `validate` check where user-facing, and a
  `config/requirements-inventory.json` entry with a **real `proven_by` path** (integrity-gated).
- **Per-slice exit ritual.** Each slice ends: canonical `pytest -q tests` green →
  `git commit` → `git pull --rebase`
  → `bd sync` → `git push` → `git status` clean & up-to-date. Bead notes updated.
- **Credential isolation (R-X-5/R2-X-1).** No real credential ever on sandbox disk.
  Explicit user provider choices ride matching OpenShell providers; git push uses a **github
  provider** whose token stays host-side and is swapped at L7. With no preferred config,
  inference and embeddings both use the Zendesk AI Gateway: Kimi K3 inference and
  `text-embedding-3-large`/1536 embeddings (D3a-M). Home Qwen and Codex are independent local
  overrides. Literal `dummy` in the home profile is non-secret compatibility data.
- **Single-gateway:** `openshell` (17670) only; `nemoclaw` forbidden.
- **`--dry-run` is global** and precedes the verb.

## Resolved open questions (spec §7) — locked by operator

- **Q1 brain-clone mechanism → git clone WITH `.git`, push-capable, credential-safe.**
  The agent must be able to **push** brain updates to the repo from inside the container.
  Mechanism (operator-approved): a **custom OpenShell `github` provider profile** that adds
  `git-receive-pack` (push) + read-write on `github.com` (the builtin profile is fetch-only),
  keyed to the `git` binary; a github provider holds the token host-side; the policy declares
  `github.com:443` as a credentialed rest endpoint; git carries a placeholder auth header that
  OpenShell swaps to the real bearer at L7. **Requires:** add `git` to the image; clone with
  `.git`. No token on sandbox disk. In-sandbox `git clone` over SSH is rejected (private repo
  would need a token in-container).
- **Q2 embeddings → REVISED by D3a-L/M: portable gateway default, explicit overrides.**
  No-config installs use the previously proven Zendesk AI Gateway
  `openai:text-embedding-3-large` profile at 1536 dimensions. An operator may explicitly select
  another provider/model/dimension. Joe's home `Qwen3-Embedding-8B` profile remains an optional
  local 4096-dimensional override with a 1000-second timeout and parallel rebuild contract;
  its private endpoint never enters tracked config. Every selected profile must be one fresh
  vector space; changing profiles requires a full non-destructive re-embed.
- **Q3 brain content → each operator's explicitly configured FULL real brain.** Joe's historical
  proving instance is the private `JLandersZen/brain` repository on `main`; D3a-N forbids it as a
  tracked default or code fallback. There is no public starter/example brain.
- **Q4 validate surface → GATE =** brain present (with `.git`) + index page count > 0 +
  known-fact cited query green + one routed-write receipt + push-back proven + a complete,
  fresh index for the selected embedding profile. Embedding freshness is a **GATE**, not NICE.

## Slice map

| Slice | Capability delivered | Requirements | Gate? |
|---|---|---|---|
| **S0** | Upstream-gbrain spike: prime-agent-as-controller drives **upstream garrytan/gbrain** in-sandbox (+ models.json mirror) | R3a-0, R3a-13 | **GO/NO-GO** |
| **S1** | git+github push plumbing: image git, custom github push profile, clone brain w/ `.git` into sandbox | R3a-1, R3a-5(part), R3a-7 | — |
| **S2** | In-sandbox index serving (gbrain+PG over the clone, `brain` source); AI-gateway/1536 embedding proof (portable-default basis) | R3a-2 | — |
| **S3** | Cited read/query from the sandboxed prime-agent | R3a-3 | — |
| **S4P** | Portable no-config provider defaults: Zendesk AI Gateway Kimi inference + OpenAI 1536 embeddings; explicit overrides win | R3a-5, R3a-7, R3a-12, R3a-13, R3a-15 | **COMPLETE** — 177 tests + hermetic provider-default dry-run PASS |
| **S4R** | Require explicit per-operator brain repository; remove personal tracked/fallback repo identity | R3a-1, R3a-5, R3a-9, R3a-16 | **COMPLETE** — 228 tests + operator-local dry-run PASS; bead `prime-claw-zwg.2` |
| **S4A** | Operator-required local `Qwen3-Embedding-8B`/4096 profile, non-destructive build and cutover | R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14 | **IN PROGRESS / P0** — bead `prime-claw-zwg.5`; exact compatibility/preflight passed; isolated build resumed |
| **S4B** | One routed write + push-back round-trip to the explicitly configured operator repo | R3a-4, R3a-16 | **BLOCKED ON S4A BY OPERATOR ORDERING** — bead `prime-claw-zwg.4`; generic gateway path remains technically independent |
| **S5** | Acceptance gate + evidence + inventory + housekeeping | R3a-6 | acceptance |

---

## Slice 0 — Upstream-gbrain spike (R3a-0, GO/NO-GO gate; D3a-H)

**Goal.** Prove in real code that **upstream `garrytan/gbrain`** (not zbrain's fork) runs
correctly in the OpenShell sandbox under **prime-agent as mode-(a) harness-as-controller**
(drives the gbrain CLI, manages the in-sandbox DB). Surface any prime-agent-vs-other-harness
difference too big to overcome elegantly.

**Approach.**

- Change the image's gbrain build source from the zbrain checkout (`PRIME_CLAW_ZBRAIN_SRC`,
  `stage_gbrain_context`) to a pinned **upstream garrytan/gbrain** ref (target the v0.50.x line;
  `master` currently v0.50.0.0). Keep the zbrain path as a documented fallback behind a config
  flag so a NO-GO can revert cleanly.
- In the sandbox (a tiny fixture brain, not the real one): `gbrain init` against in-sandbox PG
  → `gbrain put` a fixture page → `gbrain sync --source brain` → `gbrain search`/`get` returns it.
- Drive the above **from the sandboxed prime-agent** (the REPL/exec path), not just from a shell,
  to prove the controller relationship specifically.

**GO criteria (all must hold).**
1. Upstream gbrain binary builds and runs in the image (Bun compile succeeds for linux-arm64).
2. `gbrain init` + `sync` + `search` round-trip works against in-sandbox PG (`localhost:5433`).
3. prime-agent can invoke the gbrain CLI (exec/REPL) with no harness-capability blocker.
4. No upstream feature prime-claw depends on is absent or fork-only (walk-up config not needed —
   GBRAIN_HOME/env suffices; schema pack `gbrain-base-v2` present upstream).

**NO-GO triggers (any → documented thin-fork fallback).**
- Upstream binary fails to build/run in the sandbox and the cause is a hard, inelegant blocker.
- A required capability is fork-only in zbrain and cannot be satisfied by config/env upstream.

**Exit / artifacts.**
- Verdict recorded in `docs/derisk/3a-slice0.md` (or `docs/evidence/3a-slice0-*.json`).
- If GO: image pins upstream gbrain; `stage_gbrain_context` reads an upstream ref; config key
  `gbrain_source` (default upstream, fallback zbrain) added to `config/runtime.json`.
- Tests: offline coverage that the build-context staging selects upstream vs. fallback correctly.
- **Also delivered then extended (R3a-13):** Slice 0 copied host `models.json`; Slice 3
  extended the contract to copy host `settings.json` too and project auth through OpenShell
  placeholders. The 2026-09-16 acceptance run followed the explicit host
  `openai-codex/gpt-5.6-sol` override (D3a-K); D3a-M now requires Kimi K3 via the Zendesk AI
  Gateway when no preferred host config exists.

---

## Slice 1 — Brain into the sandbox, push-capable (R3a-1, R3a-5 partial, R3a-7)

**Goal.** The operator's brain repo is cloned into the sandbox at a configurable path
(default `/sandbox/brain`) **with `.git`**, and the agent can push — all without a credential
on sandbox disk.

**Approach.**

- **Image:** add `git` to `docker/runtime.Dockerfile` apt line.
- **Custom github push profile:** author `policies/github-push-profile.yaml` extending the
  builtin github profile to allow `POST /**/git-receive-pack` and read-write on `github.com`,
  keyed to `/usr/bin/git`. Import via `openshell provider profile import`. Create a github
  provider (token host-side) and attach it.
- **Policy:** add a credentialed `github.com:443` (rest, read-write) endpoint keyed to `git`,
  alongside the existing ai-gateway endpoint. (Push = `git-receive-pack`; fetch/clone =
  `git-upload-pack`; both flow through the provider swap.)
- **Clone stage:** new `stage_brain_clone(cfg, args)` in `bin/prime-claw` — in-sandbox
  `git clone <repo> <sb_brain_dir>` over HTTPS using a placeholder `http.extraHeader` that the
  L7 proxy swaps; idempotent (skip if already cloned, else `git fetch`/`pull --ff-only`).
  Config keys: `brain_repo`, `brain_branch` (neutral default `main`), and `sb_brain_dir`
  (default `/sandbox/brain`), all `PRIME_CLAW_*`-overridable. **Portability correction D3a-N:**
  Slice 1 originally tracked Joe's proving repository as `brain_repo`; Slice 4R must remove that
  tracked/code fallback and make repository identity mandatory operator-local configuration.
- Wire `stage_brain_clone` into `create`/`converge` before `stage_brain` (index needs content).

**Tests (offline).** stage dry-run text; config override resolution; idempotency branch
(clone vs. fetch); provider/profile staging mocked via `pc.run`/`pc.sandbox_exec`.

**Exit.** A fresh `create`+`converge` leaves `/sandbox/brain` cloned with `.git`; `git -C
/sandbox/brain remote -v` reachable through the credentialed endpoint; no token on disk.

**Status (2026-09-14): COMPLETE.** Fresh `create` lands `/sandbox/brain` cloned with `.git`
deterministically. The fresh-create blocker turned out to be a shell-quoting bug in
`stage_brain_clone` (single-quoted URL prevented `${api_token}` expansion), not an OpenShell
defect — full root cause in `docs/derisk/3a-slice1.md`. Push-capable github provider
(`github-push` profile), conditional credential refresh on both providers, single L7
credentialed `github_brain` policy rule, clone/fetch-ff idempotent, no token on disk.

---

## Slice 2 — In-sandbox index serving (R3a-2; portable gateway/1536 basis)

**Goal.** In-sandbox gbrain+PG+pgvector index the cloned brain as the `brain` source; queries
run against in-sandbox PG with **working embeddings** via the AI gateway.

**Approach.**

- Extend `stage_brain` (or add `stage_brain_index`): after PG is up and the brain is cloned,
  run `gbrain sync --source brain` (the source registered to `/sandbox/brain`) to build the
  index; then `gbrain embed` so embeddings populate via the AI-gateway L7 (config already wired
  in Slice 2's predecessor; ensure the placeholder `openai_api_key` is present in the in-sandbox
  gbrain config so the L7 swap applies).
- Confirm the policy keys `ai-gateway.zende.sk` to the binary gbrain actually invokes for
  embeddings (bun-compiled `gbrain`), so the credential swap applies to embed calls.

**Tests (offline).** stage dry-run; the sync/embed invocation strings; config wiring
(`provider_base_urls`, `embedding_model`, placeholder key) asserted.

**Exit.** `gbrain search "<known term>" --source brain` inside the sandbox returns a real brain
page from in-sandbox PG; `validate` can read a page count > 0; embeddings populate (the
AI-gateway/1536 branch of revised R3a-12; Slice 4P now selects it by default).

**Status (2026-09-15): COMPLETE.** New `brain-index` stage (init --migrate-only → sources add →
sync import+embed → skip-failed → pages>0 gate, pipefail throughout). gbrain config moved to the
canonical `/sandbox/.gbrain/config.json` with the L7 placeholder key — fixing a latent false-pass
in validate (no cwd walk-up exists upstream; the embedding check now gates on the probe's own row).
Fresh create: 1057 pages, 3029/3029 chunks embedded (dims 1536), semantic search + hybrid query
live. `validate` 16/16 PASS (evidence `docs/evidence/validate-20260915T170708Z.json`). Full verdict
+ operational findings (VPN-down RBAC 403 signature → bead prime-claw-z56; npm registry race;
4 malformed-frontmatter brain files) in `docs/derisk/3a-slice2.md`.
**Historical note (2026-09-16):** this proves index-serving mechanics, but its corporate
AI-gateway / OpenAI / 1536-dimension embedding result is now the basis of the portable default
profile under D3a-M. S4P restores that as the tracked no-config behavior and proves fresh
profile selection. D3a-L/S4A retain home-Qwen as an optional local override.

---

## Slice 3 — Cited read/query from the sandboxed prime-agent (R3a-3)

**Goal.** From a conversation with the sandboxed prime-agent, an operator question is answered
correctly **with a citation** to a brain page.

**Approach.**

- Provide a thin **brain-query capability** the sandboxed prime-agent calls (a small helper the
  agent invokes that runs `gbrain search`/`gbrain get` against in-sandbox PG and returns
  title/slug + excerpt, so the answer can cite the page). This is the minimal mode-(a) read
  surface; the full skill port is 3b.
- Prove it end-to-end: spawn a session, ask "what do we know about <X>?" (X = a known real brain
  fact), assert the answer is correct **and** cites the expected page slug.

**Tests (offline).** the helper's command construction + citation formatting, monkeypatched.

**Exit.** A validated cited answer against a known-fact fixture; evidence captured.

**Status (2026-09-16): COMPLETE.** `stage_brain_query` installs a read-only helper plus
`/sandbox/AGENTS.md`; the helper performs `gbrain search` → `gbrain get`, emits a bounded
excerpt and exact `[Brain: <slug>]` token, and treats page content as untrusted data. Per the
operator's updated requirement, `stage_prime_agent` now mirrors host `settings.json` +
`models.json`, projects openai-codex auth as synthetic/placeholder-only values, and runs
ChatGPT-5.6 Sol via the host OpenShell OAuth provider. End-to-end daemon session invoked the
helper twice and correctly answered with all expected harness components plus citation
`[Brain: resources/the-anatomy-of-an-agent-harness]`. Evidence: `docs/evidence/cited-query-20260916T164509Z.json`; full validate 16/16 PASS in
`docs/evidence/validate-20260916T165022Z.json`. Offline suite: 112 green before closeout.

---

## Slice 4P — Portable AI-gateway defaults (R3a-12, R3a-13, R3a-15) — COMPLETE

**Goal.** Make a fresh clone usable without personal hardware or developer-specific OAuth.
When no preferred config exists, select Zendesk AI Gateway `anthropic.kimi-k3` for inference
and `openai:text-embedding-3-large`/1536 for embeddings. Keep GLM as a supported inference
alternative. Explicit host/local/env choices override inference and embeddings independently.

**Status (2026-09-17): COMPLETE.** Tracked defaults now select Kimi plus gateway
OpenAI/1536. A single resolver applies independent env/local/valid-host precedence to lifecycle
stages, provider attachments, Prime Agent config, effective policy, brain index settings, status,
and validation. Codex credentials/routes are conditional. Home-Qwen selection remains explicit
and fails closed before ordinary lifecycle mutation until its parallel candidate is accepted.
Embedding config/vector-width mismatches stop before migration or sync.

**Exit evidence.** Hermetic create dry-run selected Kimi + gateway OpenAI/1536 and only gateway
+ GitHub providers. `tests/test_portable_provider_defaults.py` passed 27 tests; the canonical
suite passed 177. Verdict: [3a-slice4p.md](../../docs/derisk/3a-slice4p.md); machine evidence:
[portable-defaults-20260917T184315Z.json](../../docs/evidence/portable-defaults-20260917T184315Z.json).

---

## Slice 4R — Mandatory explicit operator brain repository (R3a-1, R3a-5, R3a-9, R3a-16)

**Status: COMPLETE (2026-09-17).** Bead `prime-claw-zwg.2` implemented the explicit
operator setup gate without mutating the live sandbox, providers, databases, or indexes.

**Goal.** Preserve the platform/instance boundary by requiring every operator to configure their
own brain repository. Prime-claw must never infer, ship, or fall back to Joe's private repository
or to a public starter/example brain.

**Approach.**

1. Remove `brain_repo` from tracked runtime defaults and remove every code fallback repository.
2. Accept repository identity only from ignored local runtime configuration or
   `PRIME_CLAW_BRAIN_REPO`; retain `main` only as a neutral branch default.
3. Add one pre-mutation setup gate used by repository-dependent lifecycle, recovery, candidate
   build, validation, write, and push paths. `status` reports the missing setup without mutation.
4. The error must say that `brain_repo` is required and name both supported setup paths. It must
   not suggest or synthesize a public/example repository.
5. Move Joe's `JLandersZen/brain` value to his ignored local configuration. Historical evidence
   may retain the proving-instance name; generic tests and active defaults may not.
6. Add offline tests proving absent/malformed values fail before provider, sandbox, network, or
   database calls, and that local/environment overrides reach clone/fetch/push correctly.

**Exit evidence.** A fresh checkout cannot run a repository-dependent command until the operator
supplies their own repository. Ignored-local and environment selections reach the existing clone
path; malformed settings fail before external boundaries. Proven by 50 focused tests, 228 canonical
tests, and an operator-local create dry-run. Verdict:
[3a-slice4r.md](../../docs/derisk/3a-slice4r.md). Inventory R3a-16 is proven; Slice 4A is the operator-priority gate before 4B.

---

## Slice 4A — Operator-local home-Qwen override (required for this operator; R3a-12, R3a-14)

**Execution status (revised 2026-09-18): IN PROGRESS / P0 (`prime-claw-zwg.5`).** Bounded
objective 4A.1 is complete. On 2026-09-18 the exact-model compatibility gate passed: an omitted
`dimensions` request returned 4096 values, while explicit 4096 and 1536 requests both returned
HTTP 400 as required. Dry-run and live sanitized `embedding-preflight` passed; 35 focused offline
tests passed. The isolated `embedding-build` then resumed under a monitored background process.
Acceptance and cutover have not started. Because this operator requires local Qwen, finish and
accept 4A before starting 4B.

**Build resumed; acceptance still pending.** Immediately before resume, the tracked gateway/default
policy was restored and the partial `gbrain_qwen4096` database remained at 350 source pages /
1,140 embedded chunks, all 4096d, with no source bookmark. The canonical fingerprint is
unchanged and no cutover occurred. The resumed build is monitored by an agent-owned heartbeat;
do not start a second build, drop either database, or treat partial counts as acceptance. Baseline
evidence: `docs/evidence/embedding-build-interrupted-20260916T234215Z.json`.

**Goal.** Support the operator's explicitly selected home-network OpenAI-compatible
`Qwen3-Embedding-8B` override without changing the portable default. Rebuild the full in-sandbox brain in a
parallel 4096-dimension database/index, validate it, then cut over without modifying the
current 1536-dimension database in place.

**Locked inputs.** Model `Qwen3-Embedding-8B`; native dimension 4096; timeout 1000 seconds;
endpoint unauthenticated; literal `dummy` permitted only as a non-secret client-compatibility
value. The private base URL is operator-local data and must enter through ignored local config
or `PRIME_CLAW_*` environment, never a tracked file, log, evidence artifact, or test fixture.

**Approach.**

1. **Configuration contract — 4A.1 COMPLETE.** Generic tracked keys + `PRIME_CLAW_*`
   overrides cover base URL, exact model, dimensions, timeout, non-secret compatibility value,
   candidate/legacy database names, and ignored local paths. The base URL has no tracked default.
   `embedding-preflight` reports only sanitized values. The gateway/1536 index stage explicitly
   ignores target settings, preventing an ordinary pre-cutover converge from mutating it.
2. **Deny-by-default egress — 4A.1 RENDER COMPLETE / APPLY PENDING.** The ignored mode-0600
   candidate policy grants only the configured host/port to gbrain/Bun and removes those
   binaries from the corporate route. The tracked policy stays pre-cutover-compatible until
   4A.2 applies the candidate with the new build. No OpenShell credential provider is required.
3. **Parallel build — 4A.2a IMPLEMENTED / LIVE SYNC PENDING.** `embedding-build` gates the
   upstream version that omits native-Qwen wire dimensions, applies the ignored candidate
   policy, creates/resumes only `gbrain_qwen4096`, and uses a separate `GBRAIN_HOME` parent at
   `/sandbox/.prime-claw/qwen-candidate`. It writes a mode-0600 Qwen config, exports
   `GBRAIN_AI_EMBED_TIMEOUT_MS=1000000` and `GBRAIN_QUERY_EMBED_TIMEOUT_MS=1000000`, sets the
   sync deadline/watchdog above the request timeout, and runs a pinned single-worker full sync with explicit non-interactive inline-embed consent
   with pull/extraction disabled. It never switches canonical config. It snapshots the canonical
   config/schema/content/bookmark/migration fingerprint and gates the candidate on a Git-HEAD-
   matching source bookmark plus current-text/signature 4096-dimensional Qwen chunks with exact
   scans (no unsupported HNSW). Success and failure both restore the tracked gateway/default
   policy;
   the legacy database is never dropped or altered.
4. **Acceptance before cutover — 4A.2b AFTER BUILD.** Require page count parity, chunk count parity, every chunk
   embedded at 4096 dimensions, zero mixed/null/stale vectors, exact-page retrieval, and
   semantic search over known fixtures. Prove no request reached the corporate AI gateway.
5. **Cutover and recovery.** Only after those checks pass, atomically switch the canonical
   sandbox gbrain config to the new database. Retain the old database until Slice 5 closes;
   recovery is a config switch back, not an in-place schema reversal.

**Tests (offline).** 4A.1 has 14 focused tests for local-config/env resolution, strict
Qwen/4096/1000s settings, endpoint validation/redaction, exact policy host/port and binary
scoping, 0600 output, dry-run, Git ignores, zero command/sandbox/DB calls, parallel DB naming,
and proof the gateway/1536 index ignores local-Qwen target settings. 4A.2a adds 21 offline tests for
candidate-home confinement, config/database isolation, Qwen/timeouts, no-extract sync, version
gating, sanitized dry-run/output, candidate policy application, failure restore, and CLI wiring.
4A.2b must add parity/freshness/retrieval, atomic cutover, and rollback tests. All
network/database boundaries remain monkeypatched.

**Evidence.** Record sanitized configuration (model/dimensions/timeout only), old/new database
identifiers, page/chunk parity, vector dimensions, semantic query proof, corporate-gateway
non-use, cutover result, and rollback readiness. Never record the private endpoint.

**Exit.** When the home-Qwen profile is explicitly selected, create/converge uses only its embeddings; the full brain is current at 4096
dimensions; semantic retrieval passes; the old 1536 database remains intact for rollback; no
corporate embedding credential/provider/path is used by that local profile. The tracked
Zendesk AI-gateway default remains available for operators who did not select the override.
The generic Slice 4B gateway path remains technically independent. For this operator, however,
local Qwen is required, so successful 4A acceptance and cutover now block starting 4B.

---

## Slice 4B — One routed write + push-back round-trip (R3a-4)

**Status: BLOCKED ON SLICE 4A BY OPERATOR ORDERING.** Bead `prime-claw-zwg.4` depends on
P0 bead `prime-claw-zwg.5`. This is not a generic platform dependency: the gateway profile could
run 4B, but this operator requires the local-Qwen profile to be accepted first.

**Goal.** The agent writes **one** durable fact into the in-sandbox brain, routed per
`docs/information-architecture.md` (brain = canonical store for domain facts), via
`gbrain put <type/slug>` + `gbrain sync --source brain`, and the change **pushes back** to the
real repo (credential-safe, Slice 1 plumbing).

**Approach.**

- After Slice 4A accepts and cuts over the operator's local-Qwen profile, run the routed-write
  acceptance on that selected profile. Preserve the portable gateway path as the generic default.
- The write is a **test artifact**: a keep-worthy `projects/` stub describing prime-claw itself
  (markdown is source-of-truth, so trivially deletable). The operator confirmed exact slug
  `projects/prime-claw` on 2026-09-16.
- The agent creates the page (`gbrain put projects/prime-claw` + body), syncs the index
  (`gbrain sync --source brain`), commits in the in-sandbox clone, and **pushes** via the
  Slice 1 credentialed endpoint. Receipt = page slug + commit sha + push result.

**Tests (offline).** the put/sync/commit/push command construction; IA routing decision recorded.

**Exit.** The `projects/prime-claw` page exists in the in-sandbox brain, is queryable (Slice 3
path), and the commit is pushed to the operator's explicitly configured brain repository — with no
credential on sandbox disk.

---

## Slice 5 — Acceptance gate + evidence + inventory (R3a-6)

**Goal.** `bin/prime-claw validate` (or a dedicated check) proves R3a-1..4 green and records
evidence; the requirements inventory is updated and integrity-gated.

**Approach.**

- Extend `cmd_validate` / `probe_in_sandbox` with brain checks: **brain present** (with `.git`),
  **index page count > 0**, **known-fact cited query green**, **write receipt present**,
  **push-back proven** (remote contains the write commit). Record to `docs/evidence/validate-<utc>.json`.
- Add `R3a-0..16` entries to `config/requirements-inventory.json` with real `proven_by` paths.
- **Housekeeping:** fix the stale `R2-A-3`/`R2-A-4` statuses (Phase 2 closed them; still marked
  `in-progress`).

**Tests (offline).** the new validate checks via monkeypatched `pc.probe_*`; inventory integrity
gate (`tests/test_inventory_integrity.py`) stays green.

**Exit.** `create` + `converge` + `validate` is green end-to-end on a fresh sandbox; evidence
committed; `bd` notes updated; Phase 3a bead ready to close.

---

## Cross-cutting / risks

- **Custom github profile is the main new mechanism** (push not in builtin). If profile import +
  provider swap proves unreliable, fallback: host-mediated push (agent stages commits; a host-side
  step pushes) — but that weakens the "agent pushes from inside" goal, so prefer the L7 profile.
- **Local-Qwen completion is the next operator-priority risk.** Provider defaults and explicit
  brain-repository setup are proven. The exact service is operator-confirmed healthy, but resume
  only after exact-model preflight. Never auto-switch vector spaces or accept keyword-only
  retrieval; preserve each prior database until its replacement profile passes every gate.
- **Recreate wipes `/sandbox`** → re-run `converge`; the brain re-clones (idempotent) on converge.
- **Generic platform (R3a-9/R3a-16):** brain repository identity is mandatory ignored-local or
  environment configuration. No operator repository, taxonomy, or personal value is a tracked
  default or fallback, and there is deliberately no public/example brain.
- **Known status compatibility defect:** the installed OpenShell CLI does not accept `--output
  json` for `sandbox provider list`, so the current provider status probe fails despite a healthy
  sandbox. Track and fix this independently before final acceptance; do not conflate it with R3a-16.
