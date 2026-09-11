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
