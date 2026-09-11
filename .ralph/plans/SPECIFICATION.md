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

Inference auth is settled and **unchanged** by this phase: the host OpenShell provider
(`prime-claw-ai-gateway` → `ai-gateway.zende.sk`, model `anthropic.kimi-k3`) holds the
real credential host-side; only a placeholder enters the sandbox and the L7 proxy swaps
the real key at the boundary. The claw never possesses LLM credentials (R-X-5 / R2-X-1).
Per operator direction, this is best practice and is **not** a design variable here.

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
- **Novel surface.** gbrain's CLI, sync, embeddings, sources, links — and its browse
  proxy-shim/host-bridge — are already exhaustively tested (zbrain: ~1,626 tests; browse
  shim/bridge have dedicated tests). prime-claw must **reuse** that proven capability, not
  re-test it. The genuinely new, untested surface is the **prime-agent harness
  integration**: gbrain ships wiring for `claude-code | codex | opencode | openclaw` but
  **not** prime-agent. That is what this phase proves.
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

The write is a **test artifact**. Two acceptable forms (operator's call at execution):
(a) an easily-deleted page (markdown is source-of-truth, so deletion is trivial), or
(b) a keep-worthy stub such as a `projects/` page describing prime-claw itself. The write
round-trips only into the **in-sandbox clone**; pushing back to the real brain repo is a
git operation **out of scope for 3a** (lands with the full skill port in 3b).

## 4. Explicitly out of scope for 3a (later slices)

- **3b — whole-brain migration + generic memory skills**: port `memorize`, `gbrain-query`,
  `gbrain-ingest`, `gbrain-maintain`, `brain-commit`, `_brain-filing-rules` as
  prime-agent-native `.agents/skills/`; wire the IA routing layer; migrate the full brain.
- **3c — browse proxy-shim**: recreate container `$B` → `browse-proxy-shim` → host
  `browse-host-bridge` → token-injected host daemon (reuse zbrain's tested components).
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

1. **Brain-clone mechanism in the sandbox.** `git clone` needs the repo reachable from the
   sandbox: a read-only bind-mount of the host clone, an in-sandbox `git clone` over SSH
   (needs git+SSH but no credential on disk if the host's ssh-agent/HTTPS is mediated), or a
   `git archive`/copy staged in. Decide the credential-safe clone path. (Browse-style host
   mediation is the precedent for "capability without credentials in the container.")
2. **Embeddings provider for the in-sandbox index.** gbrain defaults to ZeroEntropy/OpenAI
   for embeddings; inside the sandbox, does embedding ride the same AI-gateway L7 provider,
   or a local model, or is the tracer index keyword-only (`--no-embed`) for 3a?
3. **Which brain for the tracer read/query proof** — the full real brain, or a small
   curated slice? (Affects clone time, index size, and what a "correct cited answer" can be
   validated against.)
4. **Exact validate surface** — which checks are gate vs. nice (page count > 0, a known-fact
   query, the write receipt, embedding freshness).

These are planning concerns, not spec blockers — the WHAT is settled above.
