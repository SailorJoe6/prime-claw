# prime-claw — Long-Range Plan

> Status: DRAFT — founding plan, rewritten around risk-ordered capability
> slices (was a skills-focused task list; see git history for the original).
> Companion to [VISION.md](VISION.md). The slice shape follows the proven
> nemo-setup / openclaw-setup build order: each slice delivers a working,
> verifiable capability and retires named risk, in strict dependency order,
> with a de-risk gate first and the highest-risk integration as early as
> possible.

## How to read this plan

Each **slice** is a vertical increment that ends in a *working, verifiable
thing* — not a task list. Slices are strictly ordered: each depends on the
prior. Slice 1 is the only slice that may **halt or pivot** the whole plan.

The spine: **stand up somewhere to run, prove the riskiest integration
end-to-end, then build the episode loop on that proven foundation, then
channels, then the orchestrator.** The Ralph/skills work is one workstream
(Phase 4) that runs on the proven runtime — not the plan itself.

## Slice map (at a glance)

| Slice | Capability delivered | Retires |
|---|---|---|
| **0. Builder repo skeleton** | Repo, beads, docs scaffold, gbrain source, GitHub remote | — |
| **1. De-risk gate (spike)** | Documented go/no-go on the load-bearing unknowns | R-series |
| **2. Sandbox runtime foundation** | prime-agent daemon running secured inside an OpenShell sandbox | runtime risk |
| **3. Tracer bullet: end-to-end working claw** | Sandboxed prime-agent (gbrain mode-(a) controller) + routing layer, persists a fact correctly. Split into 3a–3e; 3a opens with an upstream-gbrain spike | integration risk (highest) |
| **4. The episode loop** | Ralph-style design→plan→execute→handoff, manually driven, on the proven runtime | workflow risk |
| **5. Communication channels** | Telegram/Slack as project contexts & conversation threads | adoption/UX risk |
| **6. The orchestrator** | Always-on universal agent, heartbeat-driven, spawns conversations & episodes | autonomy risk |

## Phase 0 — Builder repo skeleton

- [x] git repo, beads, directory scaffold
- [x] VISION.md, LONG_RANGE_PLAN.md, README.md, AGENTS.md, DEVELOPERS.md
- [x] docs/lineage/ — distilled notes from nemo-setup, openclaw-setup,
      zbrain, ralph-pva
- [x] docs/information-architecture.md — the multi-store routing layer
- [x] gbrain source registration (`prime-claw`)
- [x] Remote (github SailorJoe6/prime-claw) — created and pushed

## Phase 1 — De-risk gate (spike)  ⚠️ may halt the plan

Prove the load-bearing unknowns that could halt or pivot the whole project,
before building anything. Each unknown gets a documented go/no-go.

- **U1 — prime-agent in OpenShell.** Can prime-agent (daemon, CWD-aware
  spawn, persistent REPL) run inside an OpenShell sandbox at all? If the
  daemon assumes host affordances the sandbox forbids, everything downstream
  changes.
- **U2 — gbrain source isolation.** Does gbrain source-scoping actually
  isolate per-project context the way the hierarchy assumes (universal
  default source + per-project named sources, no bleed)? (beads
  `prime-claw-6r8`)
- **U3 — clean episode spawn/reap.** Can a parent session spawn a prime-agent
  child with CWD=project-root and reap it cleanly, around the known RLM
  automatic-preparation admission race (openclaw-setup
  `docs/prime-agent-rlm-preparation-race.md`)?

Done when: each unknown has a documented go/no-go with evidence. A hard
no-go on any forces a spec/decision revision before proceeding.

**✅ PHASE 1 COMPLETE (2026-09-11).** All three unknowns returned **GO** with
committed, re-runnable spikes and evidence. Verdicts: U1 → `docs/derisk/U1.md`
(prime-agent in sandbox), U2 → `docs/derisk/U2.md` (brain stack in sandbox,
image-baked, embedding gate), U3 → `docs/derisk/U3.md` (episode spawn/reap).
Traceability: `config/requirements-inventory.json` (R-U1-1..6, R-U2-1..6,
R-U3-1..3, R-X-1..7 all proven/met). No hard NO-GO occurred. Beads
`prime-claw-f7k` / `prime-claw-6r8` / `prime-claw-tcf` closed. Phase 2
(`prime-claw-qcd`) unblocked.

## Phase 2 — Sandbox runtime foundation

Stand up the prime-claw container: the place the claw runs and is free to
run amok without endangering the host. Blueprint: nemo-setup / openclaw-setup,
re-based on prime-agent.

- OpenShell sandbox (deny-by-default egress, no host socket/home/network/
  PID/IPC, mediated resource grants).
- prime-agent daemon running inside, owning its `$HOME`.
- L7 credential injection (credentials never touch sandbox disk) — preserves
  the credential-isolation boundary.
- The apply/check/validate/test tooling grows here: `scripts/apply-*.sh`,
  `check-*.sh`, `validate-*.py`, `tests/test_*.py`, plus
  `config/requirements-inventory.json` traceability.

Done when: a prime-agent daemon runs healthily inside the secured sandbox —
reachable, deny-by-default egress proven, reproducible from the runbook.

**✅ COMPLETE (2026-09-11).** Built `bin/prime-claw` (verbs: status, build,
create, converge, validate, recover, destroy) over native OpenShell primitives;
live degrade-and-recover proven. Reference: `docs/sandbox-runtime.md`;
operations: `docs/runbook.md`. Plan set archived to
`.ralph/plans/archive/phase2-runtime/`. Unblocks Phase 3 (`prime-claw-zwg`).

## Phase 3 — Tracer bullet: an end-to-end working claw  ⭐ highest-risk

**Current status (revised 2026-09-18): BLOCKED SAFELY.** Phase 3a Slices 0–3, portable-default
Slice 4P, and mandatory repository-setup Slice 4R are complete. One isolated Qwen build stopped
safely during incomplete DGX thermal recovery after advancing the candidate to 952 pages / 2,863
valid 4096-dimensional chunks. After the next operator clearance, the required single bounded
host exact-model probe returned HTTP 502. Prime-claw did not retry, apply candidate policy, run a
sandbox probe, or start another build. Zero gbrain processes remain, canonical gateway/1536 state
is unchanged, and no cutover occurred. Do not probe or restart until operator clearance. Slice 4B
remains deferred by operator order.

The riskiest integration, done as early as possible and deliberately thin but
*whole*: a prime-agent session inside the sandbox, connected to gbrain, that
holds a conversation and persists a durable fact to the brain via the
information-architecture routing layer.

**The goal:** prime-agent is the **mode-(a) harness-as-controller** — the core
claw that drives, manages, and maintains the gbrain (drives the gbrain CLI,
administers its database, manages collection channels + the signal sweep).
Mode (b) — prime-agent as a participant MCP client of an existing gbrain — is
supported as a secondary goal (we intend to add prime-agent as a first-class
upstream gbrain harness, spanning both modes), but (a) is the priority.

**gbrain strategy:** build on **upstream `garrytan/gbrain`**, not zbrain's
stripped fork. Fork gbrain only to author a prime-agent-harness PR, monitor
upstream, and retire the fork once it merges. (zbrain's walk-up-config and
claw-skill-strip deltas are not needed here.)

**Sub-phases** (split for risk isolation):

- **3a — tracer bullet.** Brain cloned in → in-sandbox gbrain+PG index → cited
  read/query → portable AI-gateway defaults + optional home-Qwen profile → one routed write + push-back. **Opened with a
  Slice-0 spike (a go/no-go gate):** prove in real code that upstream gbrain
  runs under prime-agent-as-controller in the OpenShell sandbox. GO = upstream
  path; NO-GO = documented thin-fork fallback. ⚠️ may pivot the gbrain choice.
- **3b — whole-brain migration + generic memory skills** (port memorize/query/
  ingest/maintain/brain-commit as prime-agent-native skills; wire the IA
  routing layer; create the operator instance repo `prime-pva`). This slice
  must also expose the minimum runtime capability boundary needed to distinguish
  skills shipped by prime-claw, operator-selected global skills, and skills that
  travel with a project. It should prove that the required capability reaches
  the sandbox without copying the host home or credential material, while
  leaving the general packaging and persistence design open until more manual
  evidence exists.
- **3c — browse proxy-shim** (port zbrain's local `browse-proxy-shim` +
  `browse-host-bridge` + cookie-jar companion against stock upstream gstack
  browse; credentials never enter the container).
- **3d — channels** (collect → triage → ingest pipelines).
- **3e — scheduling** (`prime-agent schedule` replaces `brain.cron`).

Done when: the operator talks to a sandboxed prime-agent and it remembers
something — routed to the correct store per docs/information-architecture.md.

## Phase 4 — The episode loop (the Ralph inheritance)

Now the Ralph-style workflow runs on the proven runtime. Manual-first: keep the
phase policy in project-customizable Markdown, drive it across real work, and
codify only transitions that repeated use proves deterministic.

Capability placement follows the manual proof boundary. The builder keeps
plugin source inert under `src/prime-agent-plugin/`; explicit apply/check tooling
installs one global copy for the personal lab POC and refreshes it after every
source change. Neither the builder nor a managed project keeps a project-local
copy while that global installation is active. The final sandbox uses the same
environment-global placement inside its isolated home. In both stages the
universal agent ensures
every managed project has a local `.ralph/plans/` tree and a complete
project-customizable `.ralph/skills/` set, installing missing templates and
asking the operator to verify them.

- **4a — phase skills and proven transitions.** The canonical skills under
  `.ralph/skills/` remain editable per operator and project. Native commands
  load that Markdown rather than duplicating workflow policy. Dogfooding
  established one stable transition, implemented and regression-tested as
  native `/handoff` → focused compaction → execute; see
  [docs/handoff-chain.md](docs/handoff-chain.md). Add native
  `/plan <future-folder>` with the same loader pattern, while keeping artifact
  interpretation and planning behavior in the customizable plan skill.
- **4b — episode mechanics.** Implement `/implement-spec <future-folder>` as
  the explicit promotion boundary: customizable Markdown decides whether the
  approved folder contains the project-required specification and plan; trusted
  mechanics create the feature branch, worktree, durable sibling session, active
  plan placement, and owner/episode identity. The episode starts the
  customizable execute workflow and stays resumable through implementation, PR
  review, updates, and rebasing. Its owner reaps the session and worktree only
  after merge or explicit abandonment.
- **4c — reviewed conversation → episode workflow.** `/design` and
  `/spec-it-out` retain different customizable starting assumptions, but both
  write to a named `.ralph/plans/future/<slug>/` folder and stop for operator
  review. The operator explicitly invokes `/plan <future-folder>`; the plan is
  written to that same folder and receives a second operator review. Only
  `/implement-spec <future-folder>` authorizes implementation and creates the
  worktree-rooted episode. Manually prove that the owning conversation retains
  the returned identity, coordinates execute/handoff iterations and any required
  EXPERT reviews, recognizes archived plans as a readiness claim, decides
  whether to merge, and cleans up safely.
- **4d — `upgrade-this-to-prime-agent` command.** Convert a Ralph
  codex/claude-skills project to prime-agent skills without manual copy-paste;
  dogfood on the ralph repo.

Done when: a project conversation has created a future specification through
`/design` or `/spec-it-out`, received operator specification approval, created a
future-folder execution plan through `/plan`, received operator plan approval,
and promoted it through `/implement-spec` into a worktree-rooted episode that
shipped a real feature through bounded execute/handoff iterations, merge, and
safe cleanup. The customizable-policy versus deterministic-mechanics boundary,
context crossing, ownership, and review gates must be documented and proven by
manual dogfood before wider orchestration.


## Phase 5 — Communication channels

Wire the comms layer onto the proven runtime + routing layer. Telegram groups
= project contexts, threads = conversations; Slack channels = projects,
top-level comments = conversations. These are confirmations of the hierarchy
using familiar UX primitives, not load-bearing details.

Done when: an operator can start and continue a project conversation through
a channel, and it routes to the correct project context.

## Phase 6 — The orchestrator (universal agent)

Stand up the always-on top-level agent — LAST, only after the slices below
are validated.

- Always-on, heartbeat-driven, checks incoming channels on a schedule.
- gbrain universal source; knows of every project source.
- Spawns project conversations (CWD-scoped sessions) and, within them,
  episodes.
- Plans and executes on extremely long-horizon tasks.

Done when: the universal agent runs unattended, checks a channel on a
heartbeat, and can spawn a project conversation on demand.

## Cross-cutting disciplines (every slice)

- **apply/check/validate/test** — every capability: a design doc, an
  `apply-*.sh`, a `check-*.sh`, a `validate-*.py`, pytest coverage, and a
  `requirements-inventory.json` entry.
- **Information architecture** — every durable write routes per
  docs/information-architecture.md; reports never become knowledge.
- **Progressive disclosure** — minimal starting context, follow links, no
  bulk-loading.
- **Capability provenance** — runtime skills and other executable agent
  capabilities have an explicit source and scope; sandbox construction never
  assumes access to the operator's host-global state or copies credential
  material along with capabilities.
- **Per-slice exit ritual** — each slice ends committed and pushed, with its
  verification gate green.

## Explicit non-goals (for now)

- No automated loop until manual driving validates the episode workflow
  (Phase 4).
- No premature general skill-pack or claw-home interior design. Preserve the
  required distribution/operator/project capability boundaries now, but choose
  concrete packaging, collision, synchronization, and persistence mechanisms
  only when the relevant phase has enough manual evidence.
- No Mnemosyne integration until it passes the canonical-niche test in
  docs/information-architecture.md.
