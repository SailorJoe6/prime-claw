# Execution Plan — Phase 3a: Tracer Bullet (a brain-hosting claw)

**Status:** Execution plan (ready to execute)
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
- **Credential isolation (R-X-5/R2-X-1).** No real credential ever on sandbox disk. Inference +
  embeddings ride the host OpenShell L7 provider; git push rides a **github provider** whose
  token stays host-side and is swapped at L7. The sandbox holds only placeholders.
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
- **Q2 embeddings → AI gateway (this box), NOT local/Ollama.** Joe clarified: this box embeds
  via the **AI gateway** (`openai:text-embedding-3-large`, `OPENAI_BASE_URL=https://ai-gateway
  .zende.sk/v1`), matching the existing brain-daemon. (His *other* box uses local models; not
  relevant here.) So in-sandbox embeddings ride the **same AI-gateway L7 provider** as inference.
  `stage_brain` already wires `provider_base_urls.openai = ai-gateway.zende.sk/v1`; the policy
  already keys that endpoint to the `gbrain`/`bun` binaries. Remaining work: ensure the placeholder
  key is present and a real `gbrain sync`/`embed` round-trips. **R3a-12 (embedding freshness)
  stays in-scope** (not deferred) since the path already exists.
- **Q3 brain content → FULL real brain** (`~/gitlab_local/brain`, GitHub `JLandersZen/brain`,
  branch `main`). A cited answer is only meaningful against real content.
- **Q4 validate surface → GATE =** brain present (with `.git`) + index page count > 0 +
  known-fact cited query green + one routed-write receipt + push-back proven. **NICE =**
  embedding freshness metric.

## Slice map

| Slice | Capability delivered | Requirements | Gate? |
|---|---|---|---|
| **S0** | Upstream-gbrain spike: prime-agent-as-controller drives **upstream garrytan/gbrain** in-sandbox (+ models.json mirror) | R3a-0, R3a-13 | **GO/NO-GO** |
| **S1** | git+github push plumbing: image git, custom github push profile, clone brain w/ `.git` into sandbox | R3a-1, R3a-5(part), R3a-7 | — |
| **S2** | In-sandbox index serving (gbrain+PG over the clone, `brain` source) | R3a-2, R3a-12 | — |
| **S3** | Cited read/query from the sandboxed prime-agent | R3a-3 | — |
| **S4** | One routed write + push-back round-trip | R3a-4 | — |
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
- **Also delivered (R3a-13):** `stage_prime_agent` copies the host `~/.prime/agent/models.json`
  verbatim into the sandbox (fallback: built-in Kimi-K3 + GLM default) so the sandboxed agent
  resolves `anthropic.kimi-k3` against the AI gateway. This was the fix that made the controller
  leg pass.

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

## Slice 2 — In-sandbox index serving (R3a-2, R3a-12)

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
page from in-sandbox PG; `validate` can read a page count > 0; embeddings populate (R3a-12).

**Status (2026-09-15): COMPLETE.** New `brain-index` stage (init --migrate-only → sources add →
sync import+embed → skip-failed → pages>0 gate, pipefail throughout). gbrain config moved to the
canonical `/sandbox/.gbrain/config.json` with the L7 placeholder key — fixing a latent false-pass
in validate (no cwd walk-up exists upstream; the embedding check now gates on the probe's own row).
Fresh create: 1057 pages, 3029/3029 chunks embedded (dims 1536), semantic search + hybrid query
live. `validate` 16/16 PASS (evidence `docs/evidence/validate-20260915T170708Z.json`). Full verdict
+ operational findings (VPN-down RBAC 403 signature → bead prime-claw-z56; npm registry race;
4 malformed-frontmatter brain files) in `docs/derisk/3a-slice2.md`.

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

---

## Slice 4 — One routed write + push-back round-trip (R3a-4)

**Goal.** The agent writes **one** durable fact into the in-sandbox brain, routed per
`docs/information-architecture.md` (brain = canonical store for domain facts), via
`gbrain put <type/slug>` + `gbrain sync --source brain`, and the change **pushes back** to the
real repo (credential-safe, Slice 1 plumbing).

**Approach.**

- The write is a **test artifact**: a keep-worthy `projects/` stub describing prime-claw itself
  (markdown is source-of-truth, so trivially deletable). Operator confirms the exact slug at
  execution.
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
- Add `R3a-0..12` entries to `config/requirements-inventory.json` with real `proven_by` paths.
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
- **AI-gateway embeddings for gbrain** depend on the gateway exposing `text-embedding-3-large`;
  it already does for the host brain-daemon, so this is reuse, not new surface. If the gateway
  ever lacks an embeddings route, the NICE fallback is keyword-only (`--no-embed`) — but that is
  not expected.
- **Recreate wipes `/sandbox`** → re-run `converge`; the brain re-clones (idempotent) on converge.
- **Generic platform (R3a-9):** all brain repo/branch/path/model values are config-driven; no
  operator-specific taxonomy or values hardcoded.
