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
| **3. Tracer bullet: end-to-end working claw** | Sandboxed prime-agent + gbrain + routing layer, persists a fact correctly | integration risk (highest) |
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

## Phase 3 — Tracer bullet: an end-to-end working claw  ⭐ highest-risk

The riskiest integration, done as early as possible and deliberately thin but
*whole*: a prime-agent session inside the sandbox, connected to gbrain, that
holds a conversation and persists a durable fact to the brain via the
information-architecture routing layer.

Done when: the operator talks to a sandboxed prime-agent and it remembers
something — routed to the correct store per docs/information-architecture.md.

## Phase 4 — The episode loop (the Ralph inheritance)

Now the Ralph-style workflow runs on the proven runtime. Manual-first:
build the phase skills, drive them by hand across real work, let the
REPL-vs-living-doc lines emerge from felt friction, codify the automated
loop last.

- **4a — phase skills.** The seven imported prime-agent-native skills
  (`.ralph/skills/`) are the starting point; refine them by manual driving.
  Handoff triggers targeted compaction (`compact.run(focus_hint)`).
- **4b — episode mechanics.** A spawnable, reapable episode child (CWD =
  project root); invocation-tier state in its REPL; living-doc updates flow
  back so the next episode is past-design-aware. (Note: the safe two-message
  spawn protocol may be unnecessary if we drive manually — a spawned episode
  may just start with "run prepare, then do X." Decide from evidence, not up
  front.)
- **4c — conversation → episode boundary.** `/spec-it-out` is the trigger.
  Learn what context crosses the boundary: too little = past-design-blind;
  too much = rot recreated one level up.
- **4d — `upgrade-this-to-prime-agent` command.** Convert a Ralph
  codex/claude-skills project to prime-agent skills without manual
  copy-paste; dogfood on the ralph repo.

Done when: a brainstorm conversation has transitioned via `/spec-it-out` into
an episode that shipped a real feature on the sandboxed runtime, with the
context-crossing decision documented — all manually driven.

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
- **Per-slice exit ritual** — each slice ends committed and pushed, with its
  verification gate green.

## Explicit non-goals (for now)

- No automated loop until manual driving validates the episode workflow
  (Phase 4).
- No claw-home interior design (folder layout inside the sandbox) until the
  runtime foundation exists.
- No Mnemosyne integration until it passes the canonical-niche test in
  docs/information-architecture.md.
