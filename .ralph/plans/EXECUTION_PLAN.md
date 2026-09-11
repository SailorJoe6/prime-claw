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

- `scripts/apply-phase1-brain.sh` — bring the brain repo folder in-sandbox
  (mount or equivalent — the spike determines and documents the mechanism);
  install Postgres 16 + pgvector and the gbrain CLI.
- `scripts/check-phase1-brain.sh` — Postgres up, pgvector loaded, gbrain
  connected.
- `scripts/validate-phase1-brain.py` — search/query return expected content;
  attempt host `localhost:5433` exposure (or OpenShell service-forwarding
  equivalent) and document the result either way (R-U2-5 is non-blocking).
- **`docs/derisk/U2.md`** — verdict. Note: the long-run goal (this sandbox
  replaces `brain-daemon-ralph-pva`) is context, not a Phase 1 deliverable.
- Update stale beads description on `prime-claw-6r8` (still describes the old
  isolation-semantics test).

**Proves:** R-U2-1..5 · **Verdict:** `docs/derisk/U2.md` ·
**Beads:** closes `prime-claw-6r8` on GO / GO-with-constraints.

## Slice 5 — Episode spawn/reap mechanics  → U3 VERDICT

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
