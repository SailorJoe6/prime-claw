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
