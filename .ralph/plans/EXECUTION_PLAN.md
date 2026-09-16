# Execution Plan — Phase 3a: Tracer Bullet (a brain-hosting claw)

**Status:** PREPARED — Slices 0–3 complete; Slice 4A home-embedding cutover is highest-priority next (do not execute until a later instruction)
**Beads:** `prime-claw-zwg` (P1)
**Spec:** [SPECIFICATION.md](SPECIFICATION.md) · **Requirements:** [REQUIREMENTS.md](REQUIREMENTS.md) · **Decisions:** [DECISIONS.md](DECISIONS.md)
**Date:** 2026-09-11

This plan implements the Phase 3a spec as **vertical slices** (Cockburn elephant-carpaccio):
each slice ends in a *working capability + passing tests + committed & pushed*, and retires a
named requirement set. Slices are dependency-ordered; **Slice 0 is a go/no-go gate** that may
pivot the gbrain choice (upstream vs. thin fork) before any real brain content is touched.

## Operating discipline (carried, binding)

- **Manual-first.** No automation loops; each slice is driven by hand and proven.
- **apply/check/validate/test.** Every capability gets a `bin/prime-claw` stage (idempotent),
  pytest coverage (offline, monkeypatched `pc.*`), a `validate` check where user-facing, and a
  `config/requirements-inventory.json` entry with a **real `proven_by` path** (integrity-gated).
- **Per-slice exit ritual.** Each slice ends: `pytest` green → `git commit` → `git pull --rebase`
  → `bd sync` → `git push` → `git status` clean & up-to-date. Bead notes updated.
- **Credential isolation (R-X-5/R2-X-1).** No real credential ever on sandbox disk.
  Inference rides the host-selected OpenShell provider (currently openai-codex OAuth); git
  push rides a **github provider** whose token stays host-side and is swapped at L7.
  Embeddings use only the unauthenticated home-network Qwen service (D3a-L); literal `dummy`
  is a non-secret compatibility value, not a credential. No corporate embedding fallback.
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
- **Q2 embeddings → SUPERSEDED by D3a-L: home Qwen only.** Slice 0–2 proved the former
  corporate AI-gateway path (`text-embedding-3-large`, 1536 dimensions), but monthly budget
  exhaustion makes it operationally unsuitable. The operator's home-network OpenAI-compatible
  `Qwen3-Embedding-8B` service is now the sole accepted configuration: native 4096 dimensions,
  1000-second timeout, unauthenticated (`dummy` only for clients requiring a nonempty value).
  Live probes: dimensions unset → HTTP 200 / 4096 values; explicit 1536 or 4096 → HTTP 400
  because the deployment does not support the `dimensions` parameter. A full re-embed is
  mandatory because the vector space changes. Build a parallel 4096-dimension database/index,
  validate, then cut over; never mutate the current 1536 database in place. The private base URL
  stays in ignored local config/env and must not appear in tracked artifacts.
- **Q3 brain content → FULL real brain** (`~/gitlab_local/brain`, GitHub `JLandersZen/brain`,
  branch `main`). A cited answer is only meaningful against real content.
- **Q4 validate surface → GATE =** brain present (with `.git`) + index page count > 0 +
  known-fact cited query green + one routed-write receipt + push-back proven + the complete
  Qwen index at 4096 dimensions. Embedding freshness is a **GATE**, not NICE.

## Slice map

| Slice | Capability delivered | Requirements | Gate? |
|---|---|---|---|
| **S0** | Upstream-gbrain spike: prime-agent-as-controller drives **upstream garrytan/gbrain** in-sandbox (+ models.json mirror) | R3a-0, R3a-13 | **GO/NO-GO** |
| **S1** | git+github push plumbing: image git, custom github push profile, clone brain w/ `.git` into sandbox | R3a-1, R3a-5(part), R3a-7 | — |
| **S2** | In-sandbox index serving (gbrain+PG over the clone, `brain` source); historical 1536 embedding proof later superseded | R3a-2 | — |
| **S3** | Cited read/query from the sandboxed prime-agent | R3a-3 | — |
| **S4A** | Non-destructive cutover to home `Qwen3-Embedding-8B`, native 4096 dimensions | R3a-2, R3a-5, R3a-7, R3a-9, R3a-12, R3a-14 | **NEXT / GATE** |
| **S4B** | One routed write + push-back round-trip | R3a-4 | blocked on S4A |
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
  placeholders. Current acceptance follows the host default `openai-codex/gpt-5.6-sol` rather
  than the now-unavailable Kimi/GLM fallback (D3a-K).

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
  Config keys: `brain_repo` (default `JLandersZen/brain`), `brain_branch` (default `main`),
  `sb_brain_dir` (default `/sandbox/brain`), all `PRIME_CLAW_*`-overridable.
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

## Slice 2 — In-sandbox index serving (R3a-2; historical embedding proof superseded)

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
page from in-sandbox PG; `validate` can read a page count > 0; embeddings populate (the then-current R3a-12, superseded by D3a-L).

**Status (2026-09-15): COMPLETE.** New `brain-index` stage (init --migrate-only → sources add →
sync import+embed → skip-failed → pages>0 gate, pipefail throughout). gbrain config moved to the
canonical `/sandbox/.gbrain/config.json` with the L7 placeholder key — fixing a latent false-pass
in validate (no cwd walk-up exists upstream; the embedding check now gates on the probe's own row).
Fresh create: 1057 pages, 3029/3029 chunks embedded (dims 1536), semantic search + hybrid query
live. `validate` 16/16 PASS (evidence `docs/evidence/validate-20260915T170708Z.json`). Full verdict
+ operational findings (VPN-down RBAC 403 signature → bead prime-claw-z56; npm registry race;
4 malformed-frontmatter brain files) in `docs/derisk/3a-slice2.md`.
**Historical note (2026-09-16):** this proves index-serving mechanics, but its corporate
AI-gateway / OpenAI / 1536-dimension embedding result no longer satisfies R3a-12. D3a-L and
Slice 4A require a complete home-Qwen 4096-dimension rebuild before acceptance.

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

## Slice 4A — Home Qwen embedding cutover (R3a-12, R3a-14) — HIGHEST PRIORITY NEXT

**Preparation status (2026-09-16): READY, NOT STARTED.** The operator explicitly requested
that this plan/spec/docs update land now and implementation wait for a later instruction.
Do not mutate either brain database while preparing this slice.

**Goal.** Make the operator's home-network OpenAI-compatible
`Qwen3-Embedding-8B` service the only embedding path. Rebuild the full in-sandbox brain in a
parallel 4096-dimension database/index, validate it, then cut over without modifying the
current 1536-dimension database in place.

**Locked inputs.** Model `Qwen3-Embedding-8B`; native dimension 4096; timeout 1000 seconds;
endpoint unauthenticated; literal `dummy` permitted only as a non-secret client-compatibility
value. The private base URL is operator-local data and must enter through ignored local config
or `PRIME_CLAW_*` environment, never a tracked file, log, evidence artifact, or test fixture.

**Approach.**

1. **Configuration contract.** Add generic keys/env overrides for embedding base URL, model,
   dimensions, timeout, and non-secret compatibility value. Remove AI-gateway embeddings from
   create/converge/validate; inference remains independently host-selected through Codex.
2. **Deny-by-default egress.** Render or apply an operator-local policy fragment granting only
   the configured host/port to the gbrain/Bun runtime. Do not add the raw private endpoint to
   tracked `policies/runtime.yaml`. No OpenShell credential provider is required.
3. **Parallel build.** Create a new Postgres database/index (working name
   `gbrain_qwen4096`) with pgvector 4096-dimensional storage. Point a temporary gbrain config at
   it, register `/sandbox/brain` as source `brain`, and run a full sync/embed. Keep the existing
   1536-dimension database untouched and queryable as rollback.
4. **Acceptance before cutover.** Require page count parity, chunk count parity, every chunk
   embedded at 4096 dimensions, zero mixed/null/stale vectors, exact-page retrieval, and
   semantic search over known fixtures. Prove no request reached the corporate AI gateway.
5. **Cutover and recovery.** Only after those checks pass, atomically switch the canonical
   sandbox gbrain config to the new database. Retain the old database until Slice 5 closes;
   recovery is a config switch back, not an in-place schema reversal.

**Tests (offline).** Local-config/env resolution without a committed private endpoint; policy
fragment rendering and binary scoping; 4096-dimension configuration; parallel DB naming and
no in-place mutation; full-rebuild command construction; acceptance count/dimension gates;
AI-gateway embedding absence; rollback config switch. All network/database boundaries are
monkeypatched.

**Evidence.** Record sanitized configuration (model/dimensions/timeout only), old/new database
identifiers, page/chunk parity, vector dimensions, semantic query proof, corporate-gateway
non-use, cutover result, and rollback readiness. Never record the private endpoint.

**Exit.** Fresh create/converge uses only Qwen embeddings; the full brain is current at 4096
dimensions; semantic retrieval passes; the old 1536 database remains intact for rollback; no
corporate embedding credential/provider/path is required. Only then unblock Slice 4B.

---

## Slice 4B — One routed write + push-back round-trip (R3a-4)

**Goal.** The agent writes **one** durable fact into the in-sandbox brain, routed per
`docs/information-architecture.md` (brain = canonical store for domain facts), via
`gbrain put <type/slug>` + `gbrain sync --source brain`, and the change **pushes back** to the
real repo (credential-safe, Slice 1 plumbing).

**Approach.**

- The write is a **test artifact**: a keep-worthy `projects/` stub describing prime-claw itself
  (markdown is source-of-truth, so trivially deletable). The operator confirmed exact slug
  `projects/prime-claw` on 2026-09-16.
- The agent creates the page (`gbrain put projects/prime-claw` + body), syncs the index
  (`gbrain sync --source brain`), commits in the in-sandbox clone, and **pushes** via the
  Slice 1 credentialed endpoint. Receipt = page slug + commit sha + push result.

**Tests (offline).** the put/sync/commit/push command construction; IA routing decision recorded.

**Exit.** The `projects/prime-claw` page exists in the in-sandbox brain, is queryable (Slice 3
path), and the commit is pushed to `JLandersZen/brain` — with no credential on sandbox disk.

---

## Slice 5 — Acceptance gate + evidence + inventory (R3a-6)

**Goal.** `bin/prime-claw validate` (or a dedicated check) proves R3a-1..4 green and records
evidence; the requirements inventory is updated and integrity-gated.

**Approach.**

- Extend `cmd_validate` / `probe_in_sandbox` with brain checks: **brain present** (with `.git`),
  **index page count > 0**, **known-fact cited query green**, **write receipt present**,
  **push-back proven** (remote contains the write commit). Record to `docs/evidence/validate-<utc>.json`.
- Add `R3a-0..14` entries to `config/requirements-inventory.json` with real `proven_by` paths.
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
- **Home embedding reachability and 4096-dimension rebuild are the next risk.** The endpoint
  is proven from the host, but sandbox policy/reachability and a complete parallel re-index are
  not yet proven. Do not fall back to the corporate gateway or keyword-only acceptance. Preserve
  the old 1536 database until the new index passes every gate.
- **Recreate wipes `/sandbox`** → re-run `converge`; the brain re-clones (idempotent) on converge.
- **Generic platform (R3a-9):** all brain repo/branch/path/model values are config-driven; no
  operator-specific taxonomy or values hardcoded.
