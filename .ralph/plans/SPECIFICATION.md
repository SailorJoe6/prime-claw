# Specification — Phase 3a: Tracer Bullet (a brain-hosting claw)

**Status:** Specification (design interview complete; ready to plan)
**Beads:** `prime-claw-zwg` (P1)
**Date:** 2026-09-11
**Supersedes / draws on:** zbrain parked spec `.ralph/plans/future/prime-agent-in-brain-container/` (bead `zbrain-t6m`) — its container-install mechanics informed Phase 2; its unresolved harness-mapping blocker is what prime-claw exists to solve.

This document is the summary and index for the work. It is accompanied by:

- **[REQUIREMENTS.md](REQUIREMENTS.md)** — the specific requirements discovered during discussion.
- **[DECISIONS.md](DECISIONS.md)** — design decisions, each traced to the requirement(s) it satisfies.

This is a specification of *what* must change and *why*. It is not an execution plan; that comes later.

---

## 1. Background — the system as it is now

**Phase 2 (complete, archived)** delivered a reliable, repeatable OpenShell sandbox
lifecycle behind `bin/prime-claw` (verbs: status, build, create, converge, validate,
recover, destroy). The sandbox image (`docker/runtime.Dockerfile` →
`prime-claw-brain:0.1.0`) already bakes in:

- **prime-agent 0.9.3** (installed at `/sandbox/.npm-global`, daemon + persistent REPL).
- **gbrain 0.49.0** (Bun-compiled binary at `/usr/local/bin/gbrain`).
- **Postgres 16 + pgvector 0.6**, agent-owned `PGDATA=/sandbox/pgdata`, listening on
  `localhost:5433` inside the sandbox only (no host forward; deny-by-default egress).

Inference **credential isolation** remains settled: a host OpenShell provider holds the
real credential, only opaque placeholders enter the sandbox, and L7 swaps real values at
the boundary. The concrete provider/model is now host-config-driven, not fixed to the AI
Gateway. Per operator direction on 2026-09-16, the current acceptance target (until further
notice) is the verbatim host default `openai-codex/gpt-5.6-sol` (ChatGPT-5.6 Sol, thinking
`high`) using the host's OAuth. `prime-claw-ai-gateway` remains attached for gbrain
embeddings. The claw never possesses real LLM credentials (R-X-5 / R2-X-1 / R3a-13).

**What does not exist yet:** anything in the sandbox *uses* the brain. There is no brain
content in the container, no gbrain index over real content, no prime-agent skill that
reads/writes the brain, and no proof that a conversation with the sandboxed prime-agent
can draw on (or add to) a knowledge base. Phase 2 proved the *container*; Phase 3a proves
the *brain-hosting claw*.

## 2. The strategic frame (why this phase, this shape)

prime-claw is to gbrain as **zbrain was to ralph-pva**: the generic, reusable platform;
the operator's instance (their brain repo, channels, personal skills) sits on top. The
long-run goal is that prime-claw **fully replaces zbrain as the brain container**, with
**prime-agent at the center** (not gbrain's bash/Claude/Codex harness assumptions).

- **Platform vs instance.** prime-claw (platform) must be usable by *anyone* to host
  *their* brain. Joe's brain (`~/gitlab_local/brain`) is the proving instance. A separate
  instance repo (a future `prime-pva`, replacing `ralph-pva`) will hold Joe's brain config
  and personal skills. prime-claw itself must stay generic.
- **Novel surface.** Two distinct subsystems, held separate:
  - **gbrain (knowledge CLI) — TWO DISTINCT RELATIONSHIPS (do not conflate):**
    - **Mode (a) harness-as-controller** — the agent IS the claw. It owns and drives the
      gbrain: drives the **gbrain CLI** directly (`sync`, `extract`, `embed`, `agent run`,
      `autopilot`, `jobs work`, `maintain`, `dream`, `capture`), **manages/administers the
      brain's database** (init, engine, migrations, backups), manages the **collection
      channels** (gbrain `recipes/`) and launches the **signal sweep**. This is the
      zbrain/ralph-pva pattern and gbrain's `BOOTSTRAP_FOR_AGENTS.md` path.
    - **Mode (b) agent-as-participant** — an agent (mostly a coding agent) **connects to** an
      *existing* gbrain over **MCP** (`<harness> mcp add gbrain -- gbrain serve`, or hosted
      `gbrain serve --http` + OAuth) to be informed and participate. It does NOT own or
      administer the brain. This is `connect-coding-agent.md` / `INSTALL_FOR_AGENTS.md` /
      `gbrain connect`.
    - **OUR GOAL (the whole point of prime-claw):** prime-agent is the **mode-(a)
      harness-as-controller** — the core claw that drives, manages, and maintains the
      gbrain (CLI + DB + channels + sweep). Mode (a) is the priority. Because we are
      contemplating adding prime-agent as a first-class upstream harness, we should also
      support **mode (b)** (prime-agent as a participant client of a gbrain) — but (b) is
      secondary to (a).
    - gbrain's harness install path (NOT "recipes" — a *recipe* is a channel-connection
      guide) makes gbrain the core brain of a CLI agent via auto-loaded instructions
      (AGENTS.md/CLAUDE.md) + skill files + a stdio MCP server + a native scheduler.
      gbrain ships this for `claude-code | codex | opencode | openclaw | ...` but **not
      prime-agent**. prime-agent fits the harness model with no capability blockers
      (auto-loads AGENTS.md/CLAUDE.md, discovers `.agents/skills/`, has `schedule`,
      sessions, and stdio MCP) — so an upstream prime-agent harness adapter appears
      feasible; the Slice-0 spike proves it in real code.
  - **gstack browse (web scraping):** the container proxy-shim + host-bridge are
    **zbrain-local inventions, never upstreamed** (3c ports them). prime-claw does NOT
    re-test them; it ports + integrates them against stock upstream gstack browse.
- **Self-contained container (Decision D-A).** The brain lives *inside* the sandbox:
  cloned in, indexed by the in-sandbox gbrain+PG. Not a thin client to an external brain.

## 3. What Phase 3a is (the tracer bullet — thin but whole)

A single end-to-end slice proving prime-claw can host a brain, with prime-agent as the
harness:

1. **Brain in.** `git clone` the operator's brain repo into the sandbox at a known path.
2. **Index.** In-sandbox gbrain + Postgres index the cloned brain (sync the `brain`
   source), with embeddings.
3. **Read/query.** From a conversation with the sandboxed prime-agent, the operator asks a
   question and gets a correct, **cited** answer drawn from the brain — proving search +
   retrieval inside the container.
4. **One routed write.** The agent writes **one** durable fact into the in-sandbox brain,
   routed per `docs/information-architecture.md` (brain = canonical store for domain
   facts), via `gbrain put` + `gbrain sync --source brain`.

The sandboxed prime-agent **mirrors the operator's local config**: `stage_prime_agent`
copies host `models.json` and `settings.json` verbatim, so provider/model/thinking defaults
follow the user (currently `openai-codex/gpt-5.6-sol`, thinking `high`). Host `auth.json` is
never copied: its selected credential is provisioned into OpenShell and sandbox auth is a
placeholder-only projection. For Codex, a non-secret synthetic JWT satisfies prime-agent's
local account-id parser; the preload rewrites outbound auth/account headers to OpenShell
placeholders before network I/O (R3a-13). The old Kimi/GLM catalog remains only a fallback
when host config is absent; it is not the current acceptance target.

The write is a **test artifact**. Two acceptable forms (operator's call at execution):
(a) an easily-deleted page (markdown is source-of-truth, so deletion is trivial), or
(b) a keep-worthy stub such as a `projects/` page describing prime-claw itself. The write
round-trips only into the **in-sandbox clone**; pushing back to the real brain repo is a
git operation **out of scope for 3a** (lands with the full skill port in 3b).

## 4. Explicitly out of scope for 3a (later slices)

- **3b — whole-brain migration + generic memory skills**: port `memorize`, `gbrain-query`,
  `gbrain-ingest`, `gbrain-maintain`, `brain-commit`, `_brain-filing-rules` as
  prime-agent-native `.agents/skills/`; wire the IA routing layer; migrate the full brain.
- **3c — browse proxy-shim**: port zbrain's own `browse-proxy-shim` + `browse-host-bridge`
  + cookie-jar `companion/` into the sandbox path, consuming **stock upstream gstack browse**
  as the host-side plugin host. NOTE: the shim/bridge are **zbrain-local inventions, never
  upstreamed** (verified: untracked in `~/gstack`, which is upstream `garrytan/gstack`).
  zbrain's *core-browser* fork deltas were retired into gstack's plugin framework
  (2026-09-01), but the shim/bridge pair is ours to carry forward — this is a **port**, not
  an upstream reuse. The plugin-framework core-browser changes ARE upstream-consumed.
- **3d — channels**: collect → triage → ingest pipelines (Slack/Zoom/Google/Notion/Gmail/
  Workday/Cerebro/ZIG).
- **3e — scheduling**: `prime-agent schedule` replacing `brain.cron` (autopilot/dream/
  brief/collect sweeps). `brain.cron` is **not** ported — prime-agent scheduling obsoletes it.
- **The automated episode loop** (Phase 4), comms channels (Phase 5), orchestrator
  (Phase 6) — unchanged from LONG_RANGE_PLAN.
- **Write-back to the real brain repo** (git push from the sandbox) — 3a writes are
  sandbox-local only.
- **The instance repo** (`prime-pva`) — created at 3b, not 3a.

## 5. How it will be when the work is done

- `bin/prime-claw` gains a stage/verb (or `converge` stage) that clones the operator's
  brain into the sandbox and syncs the in-sandbox gbrain index — idempotent, offline-testable.
- A fresh `bin/prime-claw create && bin/prime-claw validate` (or a new acceptance check)
  proves: brain present, index serving, a cited query answered, one routed write landed.
- `validate` evidence records the brain page count and the write receipt.
- The prime-agent session in the sandbox can answer "what do we know about X?" from the
  brain and "remember Y" with a correct, cited, IA-routed write — **all inside the
  container**, credentials host-only.
- Everything is generic (no Joe-specific values hardcoded — R2-X-2/D14 hold): the brain
  repo URL/path is configurable, so any operator points it at *their* brain.

## 6. Hard rules (carried, binding)

- **Credential isolation (R-X-5/R2-X-1):** inference auth via host L7 provider only;
  no real credentials on sandbox disk; the brain clone carries content, not secrets.
- **Reuse proven capability:** do not re-test gbrain's CLI/sync/embeddings or the browse
  shim — they are proven upstream. Test only the prime-agent-harness delta and the
  integration wiring.
- **Generic platform:** no operator-specific taxonomy, values, or personal skills baked
  into prime-claw; the entity schema stays in the operator's brain (IA two-level split).
- **Single-gateway discipline:** `openshell` (17670) only; never `nemoclaw`.
- **apply/check/validate/test discipline:** the new brain-hosting capability gets a
  validate check, pytest coverage (offline), and a `requirements-inventory.json` entry.

## 7. Open questions (to resolve during planning)

1. **Brain-clone mechanism in the sandbox.** ~~open~~ **RESOLVED (Q1, Slice 1, D3a-B):**
   in-sandbox HTTPS `git clone` WITH `.git`, push-capable, via the custom `github-push` L7
   provider profile (placeholder `${api_token}` swapped at L7; no credential on disk).
   In-sandbox SSH clone was considered and rejected. See `docs/derisk/3a-slice1.md`.
2. **Embeddings provider for the in-sandbox index.** ~~open~~ **RESOLVED (Q2):** embeddings
   ride the same AI-gateway L7 provider — `provider_base_urls.openai=https://ai-gateway.zende.sk/v1`,
   `embedding_model=openai:text-embedding-3-large`, dims 1536 (Slice 0 proven; R3a-12).
3. **Which brain for the tracer read/query proof** ~~open~~ **RESOLVED (Q3):** the FULL real
   brain (`~/gitlab_local/brain`, GitHub `JLandersZen/brain`, branch `main`, private).
4. **Exact validate surface** ~~open~~ **RESOLVED (Q4, D3a-G):** GATE = brain cloned with
   `.git` + pages>0 + cited query + one routed write receipt + push-back round-trip.
5. **Which prime-agent provider/model proves the conversational slices?** ~~open~~
   **RESOLVED (Q5, operator direction 2026-09-16, D3a-K):** mirror the host
   `models.json` + `settings.json` and use its current default:
   `openai-codex/gpt-5.6-sol` (ChatGPT-5.6 Sol, thinking `high`). Host OAuth remains in
   the OpenShell `codex` provider; sandbox auth is placeholder-only. Kimi/GLM are not
   available to the operator now and must not be used by acceptance until further notice.
6. **gbrain: upstream-vs-fork (Slice-0 spike — the strategy is decided; the spike proves
   feasibility).** **Strategy (settled):** we WANT to use **upstream `garrytan/gbrain`** as
   prime-claw's driven brain (mode a) rather than maintain zbrain's stripped fork. Upstream
   is multi-harness + schema-pack; zbrain's walk-up-config delta is NOT needed in a
   single-brain container (GBRAIN_HOME/env suffices); zbrain's "strip" is unnecessary because
   unused claw skills can simply be omitted. **To add prime-agent as a first-class upstream
   harness we will fork gbrain solely to author the PR, then monitor upstream and RETIRE the
   fork once the PR is accepted/merged.** The Slice-0 spike's job is to PROVE (in real code,
   not analysis) that upstream gbrain + prime-agent-as-controller runs correctly in the
   OpenShell sandbox, and to surface any prime-agent-vs-other-harness differences too big to
   overcome elegantly. Preliminary investigation suggests there are none, but the spike
   decides. If the spike finds a hard blocker, the documented fallback is a maintained thin
   fork. (gbrain only — the browse shim/bridge are zbrain-local, ported at 3c.)

These are planning concerns, not spec blockers — the WHAT is settled above.
