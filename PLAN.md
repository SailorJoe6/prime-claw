# prime-claw — Long-Range Plan

> Status: DRAFT — founding plan, written at project initiation.
> Companion to [VISION.md](VISION.md). This is a higher-level initiation
> than a single ralph spec; it sequences the whole project.

## Guiding order

Manual first. Build the phase skills, drive them by hand across real work,
let the REPL-vs-living-doc lines emerge from felt friction, and codify the
automated loop last. This mirrors how Ralph itself was built: skills first,
manual driving, then the loop.

## Phase 0 — Builder repo skeleton (this initiation)

- [x] git repo, beads, directory scaffold
- [ ] VISION.md, PLAN.md, README.md, AGENTS.md, DEVELOPERS.md
- [ ] docs/lineage/ — distilled notes from nemo-setup, openclaw-setup,
      zbrain, ralph-pva
- [ ] gbrain source registration (`gbrain sources add prime-claw --path ...`)
- [ ] Remote (gitlab joeb1knoobie/prime-claw) — deferred until skeleton is
      reviewed

## Phase 1 — prime-agent-native phase skills

Adapt Ralph's four phase skills (design, plan, execute, handoff) into
prime-agent-native form. Same proven workflow structure; new substrate.

- Handoff triggers targeted compaction (`compact.run(focus_hint)`) instead
  of writing for an amnesiac successor.
- Skills are REPL-aware: they know state can persist through compaction and
  are deliberate about what earns living-doc status.
- Joe has already been hand-building prime-agent-flavored skills in other
  repos — pull those in as the starting point rather than inventing
  parallel versions.

Done when: the four skills exist and Joe has manually driven at least one
real feature through them in a real project conversation.

## Phase 2 — Episode mechanics

Define and validate the episode as a spawnable, reapable prime-agent child.

- Episode agent spawns with CWD = project root.
- Invocation-tier state lives in the episode's REPL.
- Living-doc updates flow back so the next episode is past-design-aware.
- The RLM automatic-preparation admission race (see openclaw-setup
  `docs/prime-agent-rlm-preparation-race.md` and the global
  `rlm-automatic-preparation-startup-race` prompt note) is handled via the
  safe two-message spawn protocol — no substantive work in the initial
  `rlm()` prompt.

Done when: an episode can be spawned, run a full design→plan→execute cycle,
update the project's living docs, and be reaped cleanly, all manually
driven.

## Phase 3 — Conversation → episode boundary

Make the `/spec-it-out` transition concrete and safe.

- The episode inherits the full conversation within the spec-it-out skill's
  confines.
- After spec + plan, the living docs constrain execution context.
- Learn (by driving) what context crosses the boundary: too little =
  past-design-blind; too much = rot recreated one level up.

Done when: a brainstorm conversation has transitioned into an episode via
spec-it-out, shipped a feature, and the context-crossing decision is
documented with evidence.

## Phase 4 — `upgrade-this-to-prime-agent` command

A command that converts a project previously managed by Ralph codex/claude
skills to prime-agent skills — eliminating the manual copy-paste Joe has
been doing. prime-claw dogfoods this on itself and on the ralph repo.

Done when: running the command in the ralph repo (and one other) replaces
manual skill copy-paste, verified by diff.

## Phase 5 — Orchestrator (the universal agent)

Stand up the always-on top-level agent — LAST, only after phases 1–4 are
validated by manual driving.

- Always-on, heartbeat-driven, checks incoming channels on a schedule.
- gbrain universal source; knows of every project source.
- Spawns project conversations (CWD-scoped sessions) and, within them,
  episodes.
- Plans and executes on extremely long-horizon tasks.
- Runs inside the OpenShell-sandboxed container (blueprint: nemo-setup,
  openclaw-setup).

Done when: the universal agent runs unattended, checks a channel on a
heartbeat, and can spawn a project conversation on demand.

## Cross-cutting: the sandbox builder

In parallel with the above, this repo grows the apply/check/validate/test
tooling to construct the prime-claw sandbox, following the openclaw-setup
pattern:

- `scripts/apply-*.sh` — mutations
- `scripts/check-*.sh` — readiness gates
- `scripts/validate-*.py` — acceptance
- `tests/test_*.py` — pytest coverage
- `docs/*.md` — design docs per capability
- `config/requirements-inventory.json` + traceability — every requirement
  covered by a regression test

## Explicit non-goals (for now)

- No automated loop until manual driving validates the phases.
- No channel plugin work until the orchestrator tier is ready.
- No claw-home interior design (folder layout inside the sandbox) until the
  builder repo and phase skills are proven.
