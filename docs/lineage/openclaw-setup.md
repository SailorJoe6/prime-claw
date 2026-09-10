# Lineage: openclaw-setup

Source: `git@gitlab.com:joeb1knoobie/openclaw-setup.git`
(studied from a local clone at `~/code/_study/openclaw-setup`)

The furthest-developed builder repo and prime-claw's primary template for
engineering discipline.

## What it is

The control directory for Joe's local OpenClaw testbed. The preferred
runtime path is **NemoClaw/OpenShell** with OpenClaw running inside an
OpenShell-managed sandbox (`my-assistant`) on the DGX Spark.

## The engineering discipline prime-claw inherits

Every capability is delivered as a complete, verifiable unit:

1. **Design doc** in `docs/<capability>.md` — requirement + decision.
2. **`scripts/apply-<capability>.sh`** — performs the mutation.
3. **`scripts/check-<capability>.sh`** — non-mutating readiness gate.
4. **`scripts/validate-<capability>.py`** — live acceptance.
5. **`tests/test_<capability>.py`** — pytest regression coverage.
6. **`config/requirements-inventory.json`** +
   `docs/requirements-traceability.md` — every requirement traced to a
   coverage tier and test.

Scale at time of study: ~120 scripts across apply/check/validate/run/
rollback/install families, ~80 pytest files, and a regression workflow with
Tier 1 (fast non-mutating), Tier 2 (runtime), and Tier 3 (live-acceptance)
gates.

**This is the "durable record with decision lineage" pattern already built
and proven.** prime-claw generalizes it to the whole product lifetime (see
VISION.md three-horizon model).

## Architectural posture (load-bearing for prime-claw's runtime)

- **Standard-first.** Use NemoClaw/OpenShell/OpenClaw providers, sandbox
  policy, agents, nodes, and Gateway/Admin approvals before adding local
  wrappers. Custom host nodes/wrappers are exceptions needing an explicit
  design reason (the DGX GStack Browser Node is one — browser credentials
  and headed state require host-side handling).
- **The OpenShell sandbox is the accepted command-security boundary.**
  Exec approvals default to `full` *because* the sandbox is the boundary.
- **Approval allowlists are additive operator-managed state.** Repo scripts
  may add entries but must never replace/prune/restore-over the allowlist.
- **Non-destructive recovery by default.** `recover-nemoclaw-sandbox.sh` +
  `check-nemoclaw-full-readiness.sh` are the supported recovery path; ad
  hoc delete/recreate/force-rebuild requires an explicit plan.

## The prime-agent RLM admission race (critical for prime-claw)

`docs/prime-agent-rlm-preparation-race.md` + the AGENTS.md workaround:
affected prime-agent releases can **lose the initial RLM task** when a
`session_start` extension starts a child turn first. The workaround (also
encoded in prime-claw's AGENTS.md):

- Do not put substantive work in the initial `rlm()` prompt.
- Spawn with a harmless bootstrap; send the real task once via
  `agent_message.send`.
- A returned handle proves publication, not admission.

prime-claw's episode-spawning design (Phase 2) must respect this.

## Communication channel decision (already made)

`docs/private-communications-channel.md`: **Telegram is the primary private
channel** (Bot API: `getUpdates`/`sendMessage`/voice via `getFile`).
**Slack is the deferred fallback** (chat.postMessage + Socket Mode),
revisited only if Telegram phone/watch notifications prove unreliable. The
Telegram bridge must have a single active long-polling consumer per bot
token (the retired host bridge conflicted with the native provider).

This decision feeds prime-claw's channel layer: Telegram groups = projects,
threads = conversations; Slack channels = projects, top-level comments =
conversations. (See VISION.md.)

## Source dependency model

`deps/` tracks strategic source dependencies as **git submodules** —
Joe-owned long-running forks for source inspection, patch tracking, and
reproducible references. Notably includes `deps/gbrain`, `deps/gstack`,
`deps/nemoclaw`, `deps/openshell`, `deps/openclaw`, and — already present —
**`deps/prime-ralph`** plus **`templates/prime-agent/`**: the prime-agent
integration had already begun here. prime-claw completes that thread.

The prior-art forks live on **GitLab** (`joeb1knoobie/...`). prime-claw's
own remote is on **GitHub** (`SailorJoe6/prime-claw`).
