---
id: PRIMECLAW-36
title: 'Historical: Phase 1 de-risk gate'
status: Done
assignee: []
created_date: '2026-10-14 02:51'
updated_date: '2026-10-14 02:53'
labels: []
dependencies: []
references:
  - >-
    .ralph/plans/archive/phase1-derisk-gate/DECISIONS.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase1-derisk-gate/EXECUTION_PLAN.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase1-derisk-gate/REQUIREMENTS.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - >-
    .ralph/plans/archive/phase1-derisk-gate/SPECIFICATION.md @
    6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - .ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530
  - PRIMECLAW-1
  - PRIMECLAW-4
  - PRIMECLAW-5
priority: p2
type: epic
ordinal: 123000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Migrated bundle authority

Imported from frozen pre-cutover tree `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Verbatim bytes remain available through the source references below; this task is the durable Backlog authority for the bundle's content and outcome.

## Requirements imported from `.ralph/plans/archive/phase1-derisk-gate/REQUIREMENTS.md`

# REQUIREMENTS — Phase 1: De-Risk Gate

> Indexed by [SPECIFICATION.md](SPECIFICATION.md). Traceability to decisions
> is in [DECISIONS.md](DECISIONS.md). Every requirement lands in
> `config/requirements-inventory.json` with its validator and verdict
> document. Priority: **GATE** = hard go/no-go criterion; **NICE** =
> nice-to-have, a NO is recorded as a documented constraint and does not fail
> the gate.

## U1 — prime-agent in a fresh OpenShell sandbox

| ID | Pri | Requirement |
|---|---|---|
| R-U1-1 | GATE | A fresh OpenShell sandbox, dedicated to prime-agent, is built directly on OpenShell. NemoClaw is used as reference architecture only; no NemoClaw recipe is a dependency. |
| R-U1-2 | GATE | The OpenShell checkout and installed binary are updated to the latest release as part of the spike, and the exact versions used are recorded in the spike evidence. |
| R-U1-3 | GATE | The prime-agent daemon installs and runs healthily inside the sandbox. |
| R-U1-4 | GATE | A prime-agent session starts in-sandbox with a working persistent Python REPL (state survives across turns). |
| R-U1-5 | GATE | Deny-by-default egress is proven: a disallowed egress attempt fails and a policy-allowed egress succeeds, both captured as evidence. |
| R-U1-6 | GATE | Credential injection is proven end-to-end via the OpenShell provider/placeholder model using **the same credentials as the operator's host prime-agent instance**. The host instance's inference is defined by THREE configs that must be studied together (`~/.prime/agent/`): `auth.json` (credentials), `models.json` (**baseUrl overrides**), `settings.json` (defaults). The host does NOT call provider-native endpoints — `models.json` repoints every provider at one internal gateway: openai→`https://ai-gateway.zende.sk/v1`, amazon-bedrock→`https://ai-gateway.zende.sk/bedrock`, anthropic→`https://ai-gateway.zende.sk/anthropic`. anthropic/openai/amazon-bedrock share ONE gateway API key (same value in `auth.json`); openai-codex is a *separate* OAuth credential against the real api.openai.com (the exception). Default model is `anthropic.kimi-k3` → routed to the gateway's `/anthropic` path. So "same credentials" = one provider carrying the gateway key + an endpoint profile for `ai-gateway.zende.sk`, and the sandbox needs the `models.json` baseUrl overrides so prime-agent targets the gateway (config copying is explicitly authorized). **Scope split (D13): the AI Gateway track is the GATE; the separate openai-codex OAuth track (real api.openai.com) is NICE, not required for the verdict.** Proof: (a) the sandboxed agent holds opaque placeholders only; (b) the sandboxed prime-agent makes a real model call (default `anthropic.kimi-k3` via the gateway) through the in-sandbox proxy; (c) no credential material exists on sandbox disk; (d) fail-closed behavior on unresolvable placeholders is demonstrated. The spike must document how prime-agent consumes the injected credential (env-var name mapping vs config-resolved placeholder) and how the baseUrl override is carried into the sandbox. |

**U1 NO-GO condition:** the daemon requires host affordances OpenShell forbids
(host socket/home/network/PID/IPC) in a way that cannot be mediated.

## U2 — the gbrain brain stack in the sandbox

| ID | Pri | Requirement |
|---|---|---|
| R-U2-1 | GATE | The gbrain CLI installs and operates inside the sandbox. |
| R-U2-2 | GATE | The brain repo folder is available inside the sandbox, via mount or an equivalent mechanism; the mechanism used is documented. |
| R-U2-3 | GATE | Postgres 16 with the **pgvector** extension runs inside the sandbox (matching the `brain-daemon-ralph-pva` extension set). |
| R-U2-4 | GATE | gbrain serves the brain from the in-sandbox Postgres + brain repo: search and query return expected content. |
| R-U2-5 | NICE | Postgres is reachable from the host at `localhost:5433` (or an OpenShell service-forwarding equivalent is documented). Non-blocking. |
| R-U2-6 | GATE | gbrain embeds content via the AI Gateway through OpenShell L7 placeholder substitution (the embedding key never touches sandbox disk); semantic/vector search runs in-sandbox. |

Long-run context (not a Phase 1 deliverable): this sandbox replaces
`brain-daemon-ralph-pva`. Out of scope: testing gbrain's source-isolation
semantics.

## U3 — episode spawn/reap mechanics

| ID | Pri | Requirement |
|---|---|---|
| R-U3-1 | GATE | A git project exists inside the sandbox as a committed folder, available as a spawn target. |
| R-U3-2 | GATE | A prime-agent session can be started via CLI with its working directory scoped to that project folder (the known-good manual path, verified and documented). |
| R-U3-3 | NICE | Agent-driven spawn: a main session spawns a child with CWD=project-root and reaps it cleanly. The RLM automatic-preparation admission race behavior is documented as observed; a workaround is tested only if the race manifests. Non-blocking. |

## Cross-cutting

| ID | Pri | Requirement |
|---|---|---|
| R-X-1 | GATE | Every spike produces committed, re-runnable artifacts following the repo conventions: `scripts/apply-*.sh` (mutate), `scripts/check-*.sh` (readiness), `scripts/validate-*.py` (acceptance), `tests/test_*.py` (coverage). Repeatability is the point: future sessions must be able to re-run any spike to re-test a verdict after substrate changes. |
| R-X-2 | GATE | `config/requirements-inventory.json` traces every requirement above to its validator(s) and verdict document. |
| R-X-3 | GATE | `docs/derisk/` holds one verdict document per unknown (U1, U2, U3): what was proven, evidence, recorded versions, verdict (GO / GO-with-constraints / NO-GO), and constraint list. |
| R-X-4 | GATE | Hard NO-GO protocol: stop all agentic execution, alert the operator, wait for the operator's decision. No autonomous pivoting. |
| R-X-5 | GATE | Credential isolation is preserved throughout: no macOS Keychain or browser credential-store access; no credential material in the repo, logs, or session artifacts. The operator's non-secret AI Gateway *configuration* (host, paths, model IDs) may be committed; credential *values* (gateway key, OAuth tokens) must never be committed (D14). |
| R-X-7 | NICE | The inference/credential setup is **configurable**, not hardcoded to the operator (D14): provider/endpoint/baseUrl/credential shape is parameterized so another operator can point their sandbox at the Zendesk AI Gateway with their own key, or configure a different auth shape (e.g. openai-codex OAuth), without editing code. |
| R-X-6 | GATE | All work lands per repo conventions: committed, `bd sync`ed, pushed; beads issues `prime-claw-f7k`, `prime-claw-6r8`, `prime-claw-tcf` closed with links to verdict documents (and `prime-claw-6r8`'s stale description updated). |

## Specification imported from `.ralph/plans/archive/phase1-derisk-gate/SPECIFICATION.md`

# SPECIFICATION — Phase 1: De-Risk Gate

> Status: DRAFT — produced by the design skill, 2026-09-10 design interview.
> Indexes: [REQUIREMENTS.md](REQUIREMENTS.md) · [DECISIONS.md](DECISIONS.md)
> Governs: LONG_RANGE_PLAN.md Phase 1 (beads `prime-claw-f7k`, `prime-claw-6r8`,
> `prime-claw-tcf`). This phase may halt or pivot the whole plan.

## What this phase is

Phase 1 proves the load-bearing unknowns that could halt or pivot prime-claw,
before anything is built. Each unknown gets a spike that produces committed,
re-runnable evidence and a documented verdict. **The spec defines *what* must
be proven and the verdict criteria; it deliberately does not sequence the
spikes or slice the experiments — that is the planning phase's job.**

The three unknowns, re-scoped by the design interview (see DECISIONS.md):

- **U1 — prime-agent in a fresh OpenShell sandbox.** The only true hard gate.
- **U2 — the gbrain brain stack runs inside the sandbox.** Re-scoped: this is
  *not* a test of gbrain's source-isolation semantics (already known); it is
  the de-risking of porting the brain into the prime-claw runtime.
- **U3 — episode spawn/reap mechanics.** Evidence-gathering with a known
  CLI-driven baseline; the agent-driven spawn path is documented nice-to-have.

## Current state (what is true today)

- OpenShell is on this box: checkout at
  `~/code/nemo-setup/third_party/OpenShell` (updated to main `e61adb3b`) and
  Homebrew-installed CLI/gateway **v0.0.116**, connected and authenticated.
- NemoClaw is checked out locally and serves as **reference architecture
  only** — it has recipes for OpenClaw and Hermes, not prime-agent. The
  sandbox built here is fresh and dedicated to prime-agent.
- The brain today runs as `brain-daemon-ralph-pva`: a Docker container built
  from the zbrain repo (image `zbrain-brain`), Postgres 16 **with pgvector**,
  published to the host as `localhost:5433`, with the operator's entire host
  `$HOME` mounted rw and credential files mounted ro. Brain workdir:
  `~/gitlab_local/ralph-pva`. This host coupling is exactly what OpenShell
  eliminates; long-run, the prime-claw sandbox **replaces** this container.
- OpenShell's credential model (verified against latest docs): the gateway
  holds real credential values in **providers**; the agent's environment
  receives opaque **placeholders**; the in-sandbox proxy resolves placeholders
  at request time behind two gates (network policy + credential binding),
  fail-closed. Real values never touch sandbox disk.
- Known-good baseline for U3: an operator can log into an OpenShell sandbox,
  `cd` to a folder under the sandbox home, and run `prime-agent` there; the
  session is scoped to that folder. U3 verifies and documents this rather than
  discovering it.
- The RLM automatic-preparation admission race is documented in openclaw-setup
  (`docs/prime-agent-rlm-preparation-race.md`); the safe two-message spawn
  protocol exists but **may be unnecessary** — decide from evidence, not up
  front (founding decisions).

## What must change / be proven

### U1 — prime-agent runs inside a fresh OpenShell sandbox (HARD GATE)

Build a fresh, dedicated OpenShell sandbox for prime-agent (no NemoClaw
recipe) and prove, with committed re-runnable validators:

1. The prime-agent daemon installs and runs healthily in-sandbox.
2. A prime-agent session starts in-sandbox with a working persistent Python
   REPL.
3. Deny-by-default egress holds: disallowed egress fails, policy-allowed
   egress succeeds.
4. Credential injection works end-to-end via the OpenShell provider model: the
   agent environment holds placeholders only, a real credentialed service call
   succeeds through the proxy, no credential material exists on sandbox disk,
   and unresolvable-placeholder fail-closed behavior is demonstrated.
5. All of the above at a recorded OpenShell version, updatable and re-runnable
   later.

**NO-GO condition:** the prime-agent daemon requires host affordances that
OpenShell forbids (sockets, home, network, PID/IPC) in a way that cannot be
mediated. Annoying-but-workable findings are documented constraints, not
no-gos.

### U2 — the gbrain brain stack runs inside the sandbox

Prove, in the same sandbox line (fresh OpenShell, dedicated to prime-claw):

1. The gbrain CLI installs and operates in-sandbox.
2. The brain repo folder is available in-sandbox (mount or an equivalent
   mechanism — the spike determines which and documents it).
3. Postgres 16 **with the pgvector extension** (matching
   `brain-daemon-ralph-pva`) runs in-sandbox.
4. gbrain serves the brain from the in-sandbox Postgres + brain repo: search
   and query return expected content.
5. *(Nice-to-have, non-blocking)* Postgres is reachable from the host on
   `localhost:5433` the way `brain-daemon-ralph-pva` exposes it, or an
   OpenShell service-forwarding equivalent is documented. A NO here is a
   documented constraint, not a failed gate.

Explicitly **out of scope**: testing gbrain's source-isolation semantics
(isolated vs. federated source registration is already understood and is
gbrain's own behavior, not prime-claw risk).

### U3 — episode spawn/reap mechanics

Verify and document the episode-spawn mechanics the hierarchy depends on:

1. A git project exists inside the sandbox as a committed folder.
2. *(Baseline, hard requirement)* A prime-agent session can be started via CLI
   with its working directory scoped to that project folder — the known-good
   manual path, verified and documented.
3. *(Nice-to-have, non-blocking)* Agent-driven spawn: a main prime-agent
   session spawns a child with CWD=project-root and reaps it cleanly. The RLM
   automatic-preparation admission race behavior is documented as observed in
   this environment; a workaround (two-message protocol, or a manual "run
   prepare, then do X" instruction) is tested **only if the race actually
   manifests**. A NO here is a documented constraint — the CLI baseline keeps
   the gate green.

## When the work is done (end state)

- `docs/derisk/` holds one verdict document per unknown (U1, U2, U3), each
  with: what was proven, the evidence, recorded versions (OpenShell,
  prime-agent, Postgres/pgvector, gbrain), the verdict — **GO**,
  **GO with documented constraints**, or **NO-GO** — and the constraint list.
- Every requirement in REQUIREMENTS.md has a committed, re-runnable validator
  (`scripts/apply-*.sh` / `scripts/check-*.sh` / `scripts/validate-*.py`),
  pytest coverage (`tests/test_*.py`), and a `config/requirements-inventory.json`
  entry tracing requirement → validator → verdict document.
- The spikes are repeatable: any verdict can be re-tested months or years
  later to decide whether a design decision still holds after the substrate
  changes.
- Beads issues `prime-claw-f7k`, `prime-claw-6r8`, `prime-claw-tcf` are closed
  with links to their verdict documents. (`prime-claw-6r8`'s description
  predates the U2 re-scope and must be updated.)
- On any **hard NO-GO**: all agentic execution stops, the operator is
  alerted, and work waits for the operator's decision. No autonomous pivoting.

## Explicit non-goals

- No NemoClaw dependency — reference architecture only.
- No testing of gbrain itself (source-isolation semantics, query quality).
- No spike sequencing — the execution plan decides order and slicing.
- No Phase 2 runtime-foundation construction beyond what the spikes naturally
  leave behind as committed artifacts.
- No automated loops; manual driving throughout.
- No host exposure of sandboxed services as a gate criterion (nice-to-have
  only, per U2-5/U3-3).

## Hard rules (carried from AGENTS.md, binding on every spike)

- Credential isolation: never access macOS Keychain or browser credential
  stores. Credentials enter sandboxes only through the OpenShell provider
  model and never touch sandbox disk.
- No credential material in the repo, in logs, or in session artifacts.
- Non-interactive shell flags everywhere (`-y`, `-f`, `BatchMode=yes`, ...).
- Landing the plane: work is not done until committed, `bd sync`ed, and
  pushed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 R-U1-1: A fresh OpenShell sandbox, dedicated to prime-agent, is built directly on OpenShell. NemoClaw is used as reference architecture only; no NemoClaw recipe is a dependency.
- [x] #2 R-U1-2: The OpenShell checkout and installed binary are updated to the latest release as part of the spike, and the exact versions used are recorded in the spike evidence.
- [x] #3 R-U1-3: The prime-agent daemon installs and runs healthily inside the sandbox.
- [x] #4 R-U1-4: A prime-agent session starts in-sandbox with a working persistent Python REPL (state survives across turns).
- [x] #5 R-U1-5: Deny-by-default egress is proven: a disallowed egress attempt fails and a policy-allowed egress succeeds, both captured as evidence.
- [x] #6 R-U1-6: Credential injection is proven end-to-end via the OpenShell provider/placeholder model using **the same credentials as the operator's host prime-agent instance**. The host instance's inference is defined by THREE configs that must be studied together (`~/.prime/agent/`): `auth.json` (credentials), `models.json` (**baseUrl overrides**), `settings.json` (defaults). The host does NOT call provider-native endpoints — `models.json` repoints every provider at one internal gateway: openai→`https://ai-gateway.zende.sk/v1`, amazon-bedrock→`https://ai-gateway.zende.sk/bedrock`, anthropic→`https://ai-gateway.zende.sk/anthropic`. anthropic/openai/amazon-bedrock share ONE gateway API key (same value in `auth.json`); openai-codex is a *separate* OAuth credential against the real api.openai.com (the exception). Default model is `anthropic.kimi-k3` → routed to the gateway's `/anthropic` path. So "same credentials" = one provider carrying the gateway key + an endpoint profile for `ai-gateway.zende.sk`, and the sandbox needs the `models.json` baseUrl overrides so prime-agent targets the gateway (config copying is explicitly authorized). **Scope split (D13): the AI Gateway track is the GATE; the separate openai-codex OAuth track (real api.openai.com) is NICE, not required for the verdict.** Proof: (a) the sandboxed agent holds opaque placeholders only; (b) the sandboxed prime-agent makes a real model call (default `anthropic.kimi-k3` via the gateway) through the in-sandbox proxy; (c) no credential material exists on sandbox disk; (d) fail-closed behavior on unresolvable placeholders is demonstrated. The spike must document how prime-agent consumes the injected credential (env-var name mapping vs config-resolved placeholder) and how the baseUrl override is carried into the sandbox.
- [x] #7 R-U2-1: The gbrain CLI installs and operates inside the sandbox.
- [x] #8 R-U2-2: The brain repo folder is available inside the sandbox, via mount or an equivalent mechanism; the mechanism used is documented.
- [x] #9 R-U2-3: Postgres 16 with the **pgvector** extension runs inside the sandbox (matching the `brain-daemon-ralph-pva` extension set).
- [x] #10 R-U2-4: gbrain serves the brain from the in-sandbox Postgres + brain repo: search and query return expected content.
- [x] #11 R-U2-5: Postgres is reachable from the host at `localhost:5433` (or an OpenShell service-forwarding equivalent is documented). Non-blocking.
- [x] #12 R-U2-6: gbrain embeds content via the AI Gateway through OpenShell L7 placeholder substitution (the embedding key never touches sandbox disk); semantic/vector search runs in-sandbox.
- [x] #13 R-U3-1: A git project exists inside the sandbox as a committed folder, available as a spawn target.
- [x] #14 R-U3-2: A prime-agent session can be started via CLI with its working directory scoped to that project folder (the known-good manual path, verified and documented).
- [x] #15 R-U3-3: Agent-driven spawn: a main session spawns a child with CWD=project-root and reaps it cleanly. The RLM automatic-preparation admission race behavior is documented as observed; a workaround is tested only if the race manifests. Non-blocking.
- [x] #16 R-X-1: Every spike produces committed, re-runnable artifacts following the repo conventions: `scripts/apply-*.sh` (mutate), `scripts/check-*.sh` (readiness), `scripts/validate-*.py` (acceptance), `tests/test_*.py` (coverage). Repeatability is the point: future sessions must be able to re-run any spike to re-test a verdict after substrate changes.
- [x] #17 R-X-2: `config/requirements-inventory.json` traces every requirement above to its validator(s) and verdict document.
- [x] #18 R-X-3: `docs/derisk/` holds one verdict document per unknown (U1, U2, U3): what was proven, evidence, recorded versions, verdict (GO / GO-with-constraints / NO-GO), and constraint list.
- [x] #19 R-X-4: Hard NO-GO protocol: stop all agentic execution, alert the operator, wait for the operator's decision. No autonomous pivoting.
- [x] #20 R-X-5: Credential isolation is preserved throughout: no macOS Keychain or browser credential-store access; no credential material in the repo, logs, or session artifacts. The operator's non-secret AI Gateway *configuration* (host, paths, model IDs) may be committed; credential *values* (gateway key, OAuth tokens) must never be committed (D14).
- [x] #21 R-X-7: The inference/credential setup is **configurable**, not hardcoded to the operator (D14): provider/endpoint/baseUrl/credential shape is parameterized so another operator can point their sandbox at the Zendesk AI Gateway with their own key, or configure a different auth shape (e.g. openai-codex OAuth), without editing code.
- [x] #22 R-X-6: All work lands per repo conventions: committed, `bd sync`ed, pushed; beads issues `prime-claw-f7k`, `prime-claw-6r8`, `prime-claw-tcf` closed with links to verdict documents (and `prime-claw-6r8`'s stale description updated).
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Imported from `.ralph/plans/archive/phase1-derisk-gate/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`. Historical/current status statements are preserved literally; the task status and Final Summary state the migrated outcome.

# EXECUTION PLAN — Phase 1: De-Risk Gate

> Implements [.ralph/plans/SPECIFICATION.md](SPECIFICATION.md) +
> [REQUIREMENTS.md](REQUIREMENTS.md) + [DECISIONS.md](DECISIONS.md).
> Six vertical slices. Each slice ends with: working capability, green tests,
> committed and pushed. Slices are dependency-ordered; each builds on the
> prior. The spec is order-agnostic — the ordering below is this plan's
> choice, justified per slice.

## Operating rules for every slice

- **NO-GO stop rule (R-X-4):** a hard NO-GO finding at any point stops all
  agentic execution, alerts the operator, and waits for the operator's
  decision.
- **Artifact conventions (R-X-1, R-X-2, D8):** every capability ships with
  `scripts/apply-*.sh` (mutate), `scripts/check-*.sh` (readiness),
  `scripts/validate-*.py` (acceptance), `tests/test_*.py` (coverage), and
  `config/requirements-inventory.json` entries tracing requirement →
  validator → verdict doc.
- **Credential isolation (R-X-5):** no Keychain/browser access; credentials
  enter the sandbox only via OpenShell providers; no credential material in
  the repo, logs, or artifacts. Config *files* are copied only as authorized
  in D11, and real values never land on sandbox disk.
- **Landing (R-X-6):** each slice ends committed, pushed, `bd` current.

---

## Slice 1 — Sandbox skeleton + evidence harness

**Capability delivered:** a fresh, dedicated OpenShell sandbox for prime-agent
exists, is reachable, and its deny-by-default egress posture is proven. The
evidence harness (inventory, derisk docs, test layout) is born.

Justification: everything else needs the sandbox; egress posture is a property
of the sandbox itself, so it is proven at birth.

- `scripts/apply-phase1-sandbox.sh` — create the fresh sandbox directly on
  OpenShell (no NemoClaw recipe; NemoClaw checkout pulled latest for
  reference only).
- `scripts/check-phase1-sandbox.sh` — sandbox exists, gateway connected,
  supervisor healthy.
- `scripts/validate-phase1-sandbox.py` — egress proof: a disallowed
  destination fails and a policy-allowed destination succeeds, captured as
  evidence; records exact versions (OpenShell 0.0.116 / checkout `e61adb3b`,
  prime-agent, and everything later slices add).
- `tests/test_phase1_sandbox.py`, `config/requirements-inventory.json`
  scaffold, `docs/derisk/` created.

**Proves:** R-U1-1, R-U1-2, R-U1-5 · **Beads:** starts `prime-claw-f7k`.

## Slice 2 — prime-agent lives in the sandbox

**Capability delivered:** the prime-agent daemon installs and runs healthily
inside the sandbox; a session starts with a working persistent Python REPL.

- **Prerequisite (discovered in Slice 1):** the deny-by-default policy blocks
  all installs. First add an explicit `network_policies` entry to
  `policies/phase1-sandbox.yaml` for prime-agent's install channel (e.g. the
  npm registry or the prime-agent distribution endpoint), bound to the exact
  installing binary path in-sandbox.
- `scripts/apply-phase1-prime-agent.sh` — install prime-agent in-sandbox.
- `scripts/check-phase1-prime-agent.sh` — daemon health.
- `scripts/validate-phase1-prime-agent.py` — session start; REPL state
  survives across turns.

**Proves:** R-U1-3, R-U1-4.

## Slice 3 — Credentialed prime-agent through the proxy  → U1 VERDICT

**Capability delivered:** the sandboxed prime-agent runs on the operator's own
host-instance credentials (D11, corrected by D12), delivered exclusively
through OpenShell providers; real model calls succeed; no credential material
touches sandbox disk.

**Corrected target (D12):** the host instance is gateway-fronted — all
providers route to `https://ai-gateway.zende.sk` (`/anthropic`, `/v1`,
`/bedrock`), sharing ONE gateway API key; the default model `anthropic.kimi-k3`
hits the gateway's `/anthropic` path. openai-codex (OAuth → real
api.openai.com) is the separate exception. Slice 3 targets the **gateway
endpoint**, not provider-native hosts.

- Carry the `models.json` baseUrl overrides into the sandbox (config copying
  is operator-authorized) so prime-agent targets `ai-gateway.zende.sk`.
- Determine and document the consumption path: how prime-agent combines the
  `models.json` baseUrl with the credential, and how the OpenShell-injected
  placeholder (generic env name, e.g. `api_key`) maps to what prime-agent
  reads (env-var bridge vs config-resolved placeholder).
- `scripts/apply-phase1-providers.sh` — create ONE OpenShell provider carrying
  the gateway key, with an endpoint profile for `ai-gateway.zende.sk`; attach
  to the sandbox with the minimum endpoint policy (the gateway host only).
  **Configurable (D14 / R-X-7):** the script reads a parameterized config
  (gateway host, paths, model IDs, credential reference) rather than embedding
  the operator's values, so another operator can point at the gateway with
  their own key or a different auth shape. **No secrets in the repo (D14 /
  R-X-5):** the gateway host/paths/model IDs may be committed; the key/OAuth
  values are read from the operator's host config at apply time and never
  written to any tracked file.
  *(Optional, D13: a second provider for the openai-codex OAuth track → real
  api.openai.com. NICE, not required for the verdict.)*
- `scripts/validate-phase1-credentials.py` — (a) agent env holds placeholders
  only; (b) a real model call from the sandboxed prime-agent succeeds (default
  `anthropic.kimi-k3` via the gateway); (c) sandbox-disk scan finds no
  credential material; (d) fail-closed on an unresolvable placeholder.
- **`docs/derisk/U1.md`** — the hard-gate verdict: GO / GO-with-constraints /
  NO-GO. A NO-GO triggers the stop rule.

**Proves:** R-U1-6, R-X-5 · **Verdict:** `docs/derisk/U1.md` (R-X-3) ·
**Beads:** closes `prime-claw-f7k` on GO / GO-with-constraints.

## Slice 4 — Brain stack in the sandbox  → U2 VERDICT

**Capability delivered:** gbrain serves the operator's brain from inside the
sandbox: brain repo folder present, Postgres 16 + pgvector running in-sandbox,
gbrain CLI answering search/query with expected content.

**Approach (D15):** build the brain stack into a **custom sandbox image**, not a
runtime install. The sandbox runs as uid 998 with no root, so installing
Postgres/pgvector into the live container is the wrong pattern; the environment
belongs to the image build. `openshell sandbox create --from` does not build a
Dockerfile itself in v0.0.116 — we `docker build` with the gateway's engine,
then `--from <image>`.

- `docker/phase1-brain.Dockerfile` — `FROM
  ghcr.io/nvidia/openshell-community/sandboxes/base:latest`; `apt-get install`
  `postgresql-16` + `postgresql-16-pgvector` (PGDG) and the gbrain CLI, as root.
- `scripts/apply-phase1-brain.sh` — `docker build -t prime-claw-brain:<ver>` +
  recreate the sandbox `--from` that image, `--upload` the brain repo folder to
  `/sandbox/brain` (R-U2-2 mechanism), start Postgres 16 in-sandbox as the
  `sandbox` user.
- `scripts/check-phase1-brain.sh` — Postgres up, pgvector loaded, brain folder
  present, gbrain connected.
- `scripts/validate-phase1-brain.py` — search/query return expected content;
  attempt host `localhost:5433` exposure (or OpenShell `--forward` equivalent)
  and document the result either way (R-U2-5 is non-blocking).
- **`docs/derisk/U2.md`** — verdict. Note: the long-run goal (this sandbox
  replaces `brain-daemon-ralph-pva`) is context, not a Phase 1 deliverable.
- Update stale beads description on `prime-claw-6r8` (still describes the old
  isolation-semantics test).

**Proves:** R-U2-1..5 · **Verdict:** `docs/derisk/U2.md` ·
**Beads:** closes `prime-claw-6r8` on GO / GO-with-constraints.

## Slice 5 — Episode spawn/reap mechanics  → U3 VERDICT ✅ GO

**Capability delivered:** the episode-spawn mechanics are verified and
documented, with the CLI-driven baseline proven and the agent-driven path
documented as observed.

- A git project exists in-sandbox as a committed folder (spawn target).
- `scripts/validate-phase1-spawn.py` — CLI baseline: a prime-agent session
  started in that folder is CWD-scoped to it. Agent-driven path: a main
  session spawns a child with CWD=project-root and reaps it; the RLM
  automatic-preparation race behavior is documented as observed, and a
  workaround (two-message protocol or manual "run prepare, then do X") is
  tested **only if the race manifests** (D6). R-U3-3 is non-blocking.
- **`docs/derisk/U3.md`** — verdict.

**Proves:** R-U3-1..3 · **Verdict:** `docs/derisk/U3.md` ·
**Beads:** closes `prime-claw-tcf`.

## Slice 6 — Gate close-out

**Capability delivered:** Phase 1 is formally complete and the record is
auditable.

- `config/requirements-inventory.json` complete: every requirement →
  validator → verdict doc.
- All three verdict docs final; constraint lists consolidated.
- LONG_RANGE_PLAN.md Phase 1 checkboxes updated.
- Beads: `prime-claw-f7k`, `prime-claw-6r8`, `prime-claw-tcf` closed with
  links to verdict docs; `prime-claw-qcd` (Phase 2) unblocked.
- Final commit + push.

**Proves:** R-X-2, R-X-6.

---

## Requirement coverage check

| Requirement | Slice |
|---|---|
| R-U1-1, R-U1-2, R-U1-5 | 1 |
| R-U1-3, R-U1-4 | 2 |
| R-U1-6, R-X-5 | 3 |
| R-U2-1..5 | 4 |
| R-U3-1..3 | 5 |
| R-X-1 | all (per-slice artifacts) |
| R-X-3 | 3, 4, 5 (verdict docs) |
| R-X-4 | all (operating rule) |
| R-X-2, R-X-6 | 6 |

---

## ✅ BLOCKER RESOLVED (2026-09-11) — Slice 3 / R-U1-6 GATE track PASSES

The "istio RBAC rejects OpenShell proxy" blocker above was a **misdiagnosis**:
the 403s were caused by a GlobalProtect VPN disconnect/reconnect on the
operator's Mac (confirmed by the operator), not by the gateway's mesh policy.
kubectl inspection of `authorizationpolicy/ai-gateway-nacl` shows an ALLOW for
the path, and a plain Docker container from the same Mac also succeeds — so
source-IP/proxy-identity is not the gate.

After VPN recovery, R-U1-6 passed all four sub-conditions:
(a) sandbox env holds opaque placeholders only; (b) the sandboxed prime-agent
made a real `anthropic.kimi-k3` model call through the proxy (via the
`ANTHROPIC_API_KEY=$api_key` env bridge + `models.json` baseUrl; no auth.json
in-sandbox); (c) no credential material on sandbox disk; (d) fail-closed on an
unresolvable placeholder (HTTP 500). Evidence:
`docs/derisk/evidence/phase1-credentials-PASS-*.json`. See `docs/derisk/U1.md`.

---

## 📌 Handoff note (2026-09-11) — zbrain templates/ being fixed upstream

During Slice 4 the spike hit an upstream break: zbrain deleted `templates/`
(commit `a68893077`) while `src/core/bootstrap/assets.ts` still imports
`templates/bootstrap/*`, so a fresh zbrain checkout could not compile gbrain.
The spike worked around it by restoring `templates/` from git history
(`d337920c1`) into the staged build context only (the zbrain working tree was
untouched). **Joe is fixing this in the zbrain repo directly.** Once fixed,
`scripts/apply-phase1-brain.sh` can drop the git-history restore and just copy
`$ZBRAIN_SRC/templates` (it already prefers a real `templates/` when present).

Slice status: Slices 1–4 done — U1 GO (f7k), U2 GO (6r8). Slices 1–5 done — U1 GO (f7k), U2 GO (6r8), U3 GO (tcf). Next: Slice 6 gate close-out.

---

## 📌 Handoff note (2026-09-11) — Slice 5 (U3) DONE → Slice 6 next

Slice 5 (U3 episode spawn/reap) completed 2026-09-11, commit `a18756c`, pushed.
Validator `scripts/validate-phase1-spawn.py` exit 0, two consecutive GO runs.
Bead `prime-claw-tcf` CLOSED. **All three Phase 1 unknowns are GO** (U1 f7k, U2
6r8, U3 tcf). 52/52 suite green. `prime-claw-qcd` (Phase 2) is now unblocked.

**Next: Slice 6 (gate close-out)** — no new spike; it finalizes the record:
`config/requirements-inventory.json` complete, all three verdict docs final,
LONG_RANGE_PLAN.md Phase 1 checkboxes updated, beads closed with verdict links,
final commit + push. Then Phase 1 is formally done.

Key gotchas for re-runs / Phase 2+ (full detail in `docs/derisk/U3.md`):
`prime-agent daemon create/kill` are NOT public CLI commands — clean spawn/reap
uses the daemon client RPC (`DaemonClient` over `/tmp/prime-agent-*/daemon.sock`);
`prime-agent create <name>` is interactive (positional = first message); session
names are unique per parent (validator uses a timestamp suffix + finally-reap);
cold-daemon create can transiently fail (validator retries with a socket-wait);
model auth reuses the Slice-3 bridge (`ANTHROPIC_API_KEY=$api_key` placeholder +
`models.json` baseUrl → AI Gateway, re-staged after the recreate), default model
`anthropic.kimi-k3` (host default `claude-opus-4-7` is disabled on the gateway).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## One-time Backlog migration record

Frozen pre-cutover provenance tree: `6d11d9c2797cea54ecd07171e8a5b2019d6ee530`.

Tracked source paths:
- `.ralph/plans/archive/phase1-derisk-gate/DECISIONS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase1-derisk-gate/EXECUTION_PLAN.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase1-derisk-gate/REQUIREMENTS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/phase1-derisk-gate/SPECIFICATION.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`
- `.ralph/plans/archive/README.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530` (shared terminal/status evidence)

Every listed source remains tracked in this bounded migration slice. Git history preserves verbatim bytes. This task imports the bundle's specification/requirements into Description and native criteria, execution plan into Implementation Plan, durable history into these notes, and terminal outcome into Final Summary. Existing task ID and `parent_task_id` are preserved. No bundle is placed under `backlog/archive/`.

Related durable Backlog tasks: `PRIMECLAW-1`, `PRIMECLAW-4`, `PRIMECLAW-5`.

### Shared archive-index outcome

## phase1-derisk-gate/ — Phase 1: De-Risk Gate ✅ COMPLETE (2026-09-11)

Proved the three load-bearing unknowns before building anything; all returned
**GO** with committed, re-runnable spikes and evidence. No hard NO-GO occurred.

- **U1** prime-agent in a fresh OpenShell sandbox → `docs/derisk/U1.md`
  (Backlog.md task `PRIMECLAW-4`)
- **U2** gbrain brain stack in-sandbox (image-baked, PG16+pgvector, embedding
  gate) → `docs/derisk/U2.md` (Backlog.md task `PRIMECLAW-1`)
- **U3** episode spawn/reap mechanics → `docs/derisk/U3.md` (Backlog.md task `PRIMECLAW-5`)

Traceability: `config/requirements-inventory.json` (R-U1-1..6, R-U2-1..6,
R-U3-1..3, R-X-1..7 all proven/met). All three beads closed with verdict links.
Phase 2 (`PRIMECLAW-6`) unblocked.

Note: EXECUTION_PLAN.md contains a stale pointer reading REQUIREMENTS.md /
SPECIFICATION.md etc. at `.ralph/plans/`; those files now live beside it in this
subfolder.

## Decisions imported from `.ralph/plans/archive/phase1-derisk-gate/DECISIONS.md @ 6d11d9c2797cea54ecd07171e8a5b2019d6ee530`

# DECISIONS — Phase 1: De-Risk Gate

> Indexed by [SPECIFICATION.md](SPECIFICATION.md). Each decision traces to the
> requirement(s) it implements. Source: 2026-09-10 design interview.

## D1 — Fresh, dedicated OpenShell sandbox; NemoClaw is reference-only

The sandbox is built directly on OpenShell from scratch, not from a NemoClaw
recipe (NemoClaw has OpenClaw/Hermes recipes, none for prime-agent). NemoClaw
and the nemo-setup / openclaw-setup repos are reference architecture; their
local checkouts are pulled latest for reference.
**Implements:** R-U1-1.

## D2 — Toolchain freshness is part of the spike, and versions are evidence

The OpenShell checkout and binary are updated to the latest release *as part
of the work* (done at design time: checkout `e61adb3b`, CLI/gateway v0.0.116),
and every verdict document records the exact versions it proved against, so a
later re-run can detect substrate drift.
**Implements:** R-U1-2, R-X-3.

## D3 — Credential proof uses OpenShell's provider/placeholder model

OpenShell's model (verified against latest docs): the gateway stores real
credential values in *providers*; the agent environment receives opaque
*placeholders*; the in-sandbox proxy resolves placeholders at request time
behind two gates (network policy + credential binding) and fails closed on
unresolvable placeholders. U1 must prove this end-to-end with a real
credentialed call — "prime-agent runs in OpenShell" includes "its credentialed
work runs in OpenShell." Note: this was verified only after updating OpenShell
— referencing the stale installed version (0.0.72) would have missed
providers-v2, profile-backed policy, and body/WebSocket rewrite.
**Implements:** R-U1-6, R-X-5.

## D4 — U2 re-scoped: port the brain stack, don't test gbrain

The original U2 (test gbrain source-isolation semantics) was rejected:
isolation behavior is already known (isolated vs. federated source
registration) and testing gbrain itself is not prime-claw's job. U2 now
de-risks *prime-claw's setup*: can the gbrain stack — CLI, brain repo folder,
Postgres 16 **with pgvector** — run inside the sandbox and serve the brain.
Long-run, this sandbox replaces `brain-daemon-ralph-pva` (a zbrain-built
container with the host `$HOME` mounted rw — the coupling OpenShell
eliminates).
**Implements:** R-U2-1, R-U2-2, R-U2-3, R-U2-4.

## D5 — Host exposure and agent-driven spawn are nice-to-haves, not gates

Two capabilities are valuable but non-blocking, demoted during the interview:
(a) exposing in-sandbox Postgres to the host on `localhost:5433`
(`brain-daemon-ralph-pva` parity) — OpenShell's service-forwarding model may
offer an equivalent; (b) agent-driven episode spawn — a CLI-driven session
start inside a sandbox folder is already known to work and is the proven
baseline. NOs here become documented constraints.
**Implements:** R-U2-5, R-U3-2, R-U3-3.

## D6 — U3 tests a race workaround only if the race manifests

Per the founding decisions, the safe two-message spawn protocol "may be
unnecessary if episodes are driven manually — decide from evidence, not up
front." U3 therefore documents the RLM automatic-preparation race *as observed
in this environment* and tests a workaround (two-message protocol, or a manual
"run prepare, then do X" instruction) only on evidence of the race.
**Implements:** R-U3-3.

## D7 — Disciplined, repeatable spikes with committed artifacts

Every spike is built to be re-run: committed apply/check/validate scripts and
pytest coverage, so that months or years later a re-run can decide whether a
design decision still holds after the substrate (OpenShell, prime-agent,
gbrain, Postgres) changes. Throwaway proofs are explicitly rejected.
**Implements:** R-X-1.

## D8 — openclaw-setup conventions adopted, extended as needed

Artifact layout adopts the openclaw-setup discipline verbatim:
`scripts/apply-*.sh`, `scripts/check-*.sh`, `scripts/validate-*.py`,
`tests/test_*.py`, `config/requirements-inventory.json`; plus `docs/derisk/`
for the per-unknown verdict documents. The Phase 0 scaffold already created
the empty `config/`, `scripts/`, `tests/`, `templates/` dirs in anticipation.
**Implements:** R-X-1, R-X-2, R-X-3.

## D9 — Verdict taxonomy: GO / GO-with-constraints / NO-GO, with a stop rule

Each unknown gets one of three verdicts. Documented constraints are acceptable
and recorded. A hard **NO-GO stops all agentic execution, alerts the operator,
and waits for the operator's decision** — the agent never pivots the plan
autonomously.
**Implements:** R-X-3, R-X-4; gates R-U1-*.

## D10 — The spec is order-agnostic; sequencing belongs to the plan

Although U1's no-go pivots everything, the spec deliberately does not mandate
spike order or slice boundaries. Spec says *what*; the planning phase
(EXECUTION_PLAN.md) decides *how* and in what order, including how the
individual proofs bundle into vertical slices.
**Implements:** SPECIFICATION scope discipline; REQUIREMENTS grouping only.

## D11 — The credential proof uses this prime-agent instance's own credentials

The credentialed service in U1 is not a throwaway API: the sandboxed
prime-agent must run on **the same credentials as the operator's host
prime-agent instance** (anthropic [default], openai, openai-codex,
amazon-bedrock, from `~/.prime/agent/auth.json` + `models.json` +
`settings.json`), delivered exclusively through the OpenShell provider model.
Copying those configs for this purpose is operator-authorized. Because
prime-agent natively reads credentials from `auth.json` on disk while
OpenShell injects placeholders through the environment, the spike must
determine and document the consumption path (env-var auth vs. placeholder
values in config); the finding is itself part of the evidence. Real values
still never touch sandbox disk.
**Implements:** R-U1-6, R-X-5.

## D12 — Host inference is gateway-fronted; "same credentials" = one gateway key, not provider-native endpoints (2026-09-11)

**Decision.** Corrects the working assumption behind early Slice 3 probing.
Studying all three host configs together (`auth.json` + `models.json` +
`settings.json`) shows the host prime-agent instance does NOT call
provider-native endpoints. `models.json` overrides every provider's `baseUrl`
to a single internal gateway:

| provider | host baseUrl |
|---|---|
| openai | `https://ai-gateway.zende.sk/v1` |
| amazon-bedrock | `https://ai-gateway.zende.sk/bedrock` |
| anthropic (default) | `https://ai-gateway.zende.sk/anthropic` |

anthropic / openai / amazon-bedrock share **one** gateway API key (identical
value in `auth.json`). `openai-codex` is a **separate** OAuth credential
against the real `api.openai.com` — the exception, not the rule. Default model
`anthropic.kimi-k3` routes to the gateway's `/anthropic` path.

**Consequence for R-U1-6.** "Same credentials" means: one OpenShell provider
carrying the gateway key + an endpoint profile for `ai-gateway.zende.sk`
(`/anthropic`, `/v1`, `/bedrock`), plus carrying the `models.json` baseUrl
overrides into the sandbox so prime-agent targets the gateway. The earlier
Slice 3 work that probed `api.anthropic.com` / `api.openai.com` and used the
`claude-code` / `codex` provider profiles (whose endpoint bindings are pinned
to the native hosts) tested the wrong endpoints — that is why the "anthropic
resolution anomaly" was unexplainable. The codex leg resolving was the
genuinely-host-bound exception, not the rule.

**Implements:** R-U1-6 (corrected), supersedes the implicit native-endpoint
assumption in D11. Config copying of `models.json`/`settings.json` remains
operator-authorized per D11.

## D13 — Credential scope: AI Gateway is primary; openai-codex is a separate, optional track (2026-09-11)

**Decision.** The operator's host has TWO distinct credential tracks, and they
are not interchangeable:

1. **AI Gateway track (PRIMARY).** openai / amazon-bedrock / anthropic all
   route through `https://ai-gateway.zende.sk` sharing ONE gateway API key
   (D12). This is the credential set Slice 3 must prove end-to-end. The
   default model (`anthropic.kimi-k3`) is on this track.
2. **openai-codex track (SECONDARY / optional).** A separate OAuth credential
   against the real `api.openai.com`. It does NOT use the shared gateway key
   or the AI Gateway. Nice-to-have for parity, but NOT required for the R-U1-6
   verdict.

**Implements:** refines R-U1-6 / D12. The GATE is the AI Gateway track; the
codex track is recorded as NICE and may land as a documented constraint.

## D14 — Configurable inference + no secrets in the repo (2026-09-11)

**Decision.** The end solution must be **configurable**, not hardcoded to the
operator's setup:

- Anyone at Zendesk repeating this work must be able to point their sandbox at
  the Zendesk AI Gateway via config (baseUrl + their own gateway key), not by
  editing code.
- Anyone with a different auth shape (openai-codex OAuth, provider-native
  keys, another gateway, etc.) must be able to configure theirs the same way.
- Concretely: provider/endpoint/baseUrl/credential *shape* lives in
  parameterized config (a template + per-operator values supplied at apply
  time); the apply scripts read that config rather than embedding one
  operator's values.

**Hard rule (restating R-X-5).** The operator's specific AI Gateway
*configuration* (host, paths, model IDs) MAY live in this repo — it is not
secret. The operator's *credential values* (the gateway key, OAuth tokens)
MUST NEVER be committed — they live only in the OpenShell provider store /
gateway, are read from the operator's host config at apply time, and are
never written to any tracked file, log, or transcript.

**Implements:** R-X-5; shapes the Slice 3 apply script and the eventual
productized config surface.

## D15 — Brain stack goes into the container IMAGE, not a runtime install (2026-09-11)

**Decision.** Slice 4 builds the brain stack into a **custom OpenShell sandbox
image** (`docker build` as root, then `openshell sandbox create --from
<image>`), rather than installing Postgres/pgvector/gbrain into the running
container at spike time.

**Why (user direction, correcting an earlier wrong turn).** An attempt to
rootless-install Postgres + pgvector into the live `base` container (via
conda-forge / micromamba, because the sandbox runs as uid 998 with no root/sudo
so `apt` is unusable) was the wrong pattern: it puts the environment definition
*inside* the runtime instead of in the container definition. The environment a
sandbox needs belongs to the image build, not to the running container.

**How (v0.0.116 reality).** `openshell sandbox create --from` no longer builds a
local Dockerfile itself (run.rs `resolve_from`): you `docker build -t <image>`
with the gateway's container engine, then pass the image reference. So Slice 4:
1. `Dockerfile` `FROM ghcr.io/nvidia/openshell-community/sandboxes/base:latest`
   (the proven base that already runs the prime-agent daemon) that
   `apt-get install`s `postgresql-16` + `postgresql-16-pgvector` (PGDG) and the
   gbrain CLI, **as root**, at build time.
2. `docker build -t prime-claw-brain:<ver>` locally (same Docker daemon the
   gateway uses).
3. `openshell sandbox create --from prime-claw-brain:<ver> --upload
   <brain-repo>:/sandbox/brain` for the brain repo folder (R-U2-2 mechanism:
   `--upload`, not a runtime copy).

**Consequence.** The apt/conda egress channel added to
`policies/phase1-sandbox.yaml` for the abandoned runtime-install approach is
removed — package downloads happen on the host during `docker build`, not from
inside the sandbox. R-U2-3 wording "runs inside the sandbox" is satisfied by
the image containing Postgres 16 + pgvector; versions still recorded in
evidence.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## phase1-derisk-gate/ — Phase 1: De-Risk Gate ✅ COMPLETE (2026-09-11)

Proved the three load-bearing unknowns before building anything; all returned
**GO** with committed, re-runnable spikes and evidence. No hard NO-GO occurred.

- **U1** prime-agent in a fresh OpenShell sandbox → `docs/derisk/U1.md`
  (Backlog.md task `PRIMECLAW-4`)
- **U2** gbrain brain stack in-sandbox (image-baked, PG16+pgvector, embedding
  gate) → `docs/derisk/U2.md` (Backlog.md task `PRIMECLAW-1`)
- **U3** episode spawn/reap mechanics → `docs/derisk/U3.md` (Backlog.md task `PRIMECLAW-5`)

Traceability: `config/requirements-inventory.json` (R-U1-1..6, R-U2-1..6,
R-U3-1..3, R-X-1..7 all proven/met). All three beads closed with verdict links.
Phase 2 (`PRIMECLAW-6`) unblocked.

Note: EXECUTION_PLAN.md contains a stale pointer reading REQUIREMENTS.md /
SPECIFICATION.md etc. at `.ralph/plans/`; those files now live beside it in this
subfolder.
<!-- SECTION:FINAL_SUMMARY:END -->
