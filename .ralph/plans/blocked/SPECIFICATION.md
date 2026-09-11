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
