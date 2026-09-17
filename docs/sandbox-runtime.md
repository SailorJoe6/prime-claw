# Sandbox runtime lifecycle (Phase 2)

> **Provider-profile transition (revised 2026-09-17):** Zendesk AI Gateway is the required
> no-config default for both inference and embeddings: Kimi K3 inference and
> `text-embedding-3-large`/1536 embeddings. The current runtime already proves that embedding
> path, but tracked default/profile selection still needs correction under R3a-15. Slice 4A's
> home `Qwen3-Embedding-8B`/4096 machinery is retained as an explicit operator-local override;
> its live build is paused on the DGX Spark outage. See
> [home-embedding-runtime.md](home-embedding-runtime.md).


One reliable, repeatable OpenShell sandbox lifecycle behind a single operator
entry point, `bin/prime-claw` (Python 3, stdlib only). This page is the
**reference** for the runtime: what the verbs do, the repo layout, and the
operating guarantees. For observed-failure → recovery mapping, see
[runbook.md](runbook.md).

## Layout

| Path | Role |
|------|------|
| `bin/prime-claw` | The single operator entry point (all verbs below). |
| `policies/runtime.yaml` | The single runtime sandbox policy (deny-by-default egress). |
| `docker/runtime.Dockerfile` | The sandbox image (brain stack baked at build time). |
| `config/runtime.json` | Runtime config (sandbox/image/gateway/policy/provider). |
| `.prime-claw/runtime.local.json` | Ignored mode-0600 operator-local home embedding endpoint overlay. |
| `.prime-claw/runtime-policy.local.yaml` | Ignored mode-0600 candidate policy rendered by `embedding-preflight`. |
| `config/requirements-inventory.json` | Requirement → validator traceability. |
| `docs/runbook.md` | Operations: failure signature → recovery command. |
| `docs/evidence/` | Recorded validate/recover runs. |

## Global flags

`--dry-run` is **global** and precedes the verb:

    bin/prime-claw --dry-run create

`--config <path>` overrides `config/runtime.json`.

## Verbs

| Verb | What it does | Mutates |
|------|--------------|---------|
| `status` | Read-only actual-vs-expected report for every component (gateway, sandbox+image, policy rev, provider, Postgres, gbrain, prime-agent daemon, model reachability). | no |
| `build` | Builds `docker/runtime.Dockerfile` into the image. Idempotent via an input fingerprint + build stamp; `--force` rebuilds. | image |
| `embedding-preflight` | Validates the locked Qwen/4096/1000s parallel-database contract and renders a redacted, exact-host local policy. Makes no network, sandbox, or database call. | ignored local policy only |
| `embedding-build` | Temporarily applies the candidate policy, builds/resumes only `gbrain_qwen4096` through a separate `GBRAIN_HOME`, gates fresh 4096-dimensional Qwen chunks and canonical non-mutation, then restores the tracked gateway/default policy. Never cuts over canonical config. | candidate DB/config; temporary policy |
| `create` | Fresh bring-up. Destructive: deletes any existing sandbox, creates from the image with providers attached **at create**, then converges. | sandbox |
| `converge` | Idempotent repair of an existing sandbox: re-runs every stage in place (policy, provider env, prime-agent install, brain, spawn target) with **no** needless recreate. Fixes drift. | in place |
| `validate` | Green/red acceptance gate: daemon healthy, deny-by-default egress, credentialed model call, brain serving, spawn/reap. Records versions to `docs/evidence/validate-<utc>.json`. | evidence |
| `recover` | Maps a detected failure signature to its codified recovery, then re-validates. See [runbook.md](runbook.md). | per signature |
| `destroy` | Safe, confirm-gated teardown. Without `--yes` it prints the plan and exits 0 without mutating; `--yes` deletes the sandbox; `--image` also removes the recorded image + clears the build stamp. Idempotent. Never touches the gateway, providers, or `config/`. | sandbox (+image) |

## Stages

`create` and `converge` run the same idempotent stages, individually runnable
for targeted diagnosis:

- **embedding-preflight** *(standalone; not yet part of create/converge)* — merge ignored local
  endpoint config, validate the locked home-Qwen contract, and render the candidate policy.
- **embedding-build** *(standalone; not part of create/converge)* — apply the ignored candidate
  policy only for an isolated, pinned full sync into `gbrain_qwen4096`, gate vector/schema and
  canonical fingerprints, then restore the tracked gateway/default policy.
- **policy** — apply `policies/runtime.yaml` (portable gateway/default policy; a selected local profile may use an ignored overlay).
- **provider** — attach the AI-gateway provider (create/update-first; import
  the profile only when the provider is absent). Refreshes the credential only
  when it changed (sha256 in `.prime-claw-ai-gateway-key.sha256`, gitignored) —
  every `provider update` re-keys sandbox placeholders, which breaks running
  sandboxes' credentialed endpoints until recreate (D3a-J).
- **github-provider** — attach the push-capable GitHub provider
  (`prime-claw-github`, custom `github-push` profile adding
  `POST /**/git-receive-pack`; the builtin `github` profile is fetch-only).
  Token read host-side via `gh auth token`; same conditional-refresh discipline
  (`.prime-claw-github-token.sha256`). The sandbox only ever holds the
  `openshell:resolve:env:..._api_token` placeholder (D3a-B/J).
- **codex-provider** — pre-S4P implementation mirrors the host's `openai-codex` OAuth bundle
  into OpenShell's builtin `codex` provider (host-side only), with conditional-refresh/hash
  discipline (`.prime-claw-codex-oauth.sha256`). Slice 4P makes this stage conditional on an
  explicit Codex override; it is not part of the no-config default.
- **sandbox** — create-if-absent (or delete+recreate with `force_fresh`). Before S4P, it
  attaches all three implemented providers: AI gateway, GitHub, and Codex. Slice 4P must attach
  only the credential providers required by the selected inference and embedding profiles;
  the no-config path needs AI gateway + GitHub, not Codex. An explicit local profile may
  temporarily replace gbrain/Bun egress during its isolated build. On in-place converge,
  attaches any missing selected provider without wiping `/sandbox`. The brain is NOT
  `--upload`ed.
- **prime-agent** — install/configure prime-agent + persistent REPL and restart the daemon so
  it inherits the selected provider placeholders. Before S4P, the stage mirrors host
  `models.json` + `settings.json` and writes a placeholder-only Codex auth projection. Slice
  4P must use portable Kimi/AI-gateway config when no preferred host setting exists and write
  the Codex projection only for an explicit Codex override. Real credentials always remain at
  OpenShell L7 (D3a-K/M).
- **brain-clone** — clone the operator's brain repo into the sandbox
  (default `/sandbox/brain`) WITH `.git` over HTTPS using the `${api_token}`
  placeholder; idempotent (fetch + fast-forward when already cloned). The URL
  is **double-quoted** in the stage script so bash expands `${api_token}` —
  single-quoting passes the literal string to git and every attempt 401s
  (Slice 1 root cause; regression-tested).
- **brain** — bring up Postgres 16 + pgvector + gbrain in-sandbox
  (initdb-if-absent, agent-owned PGDATA).
- **brain-index** — build + serve the gbrain index over the cloned brain:
  `init --migrate-only` (schema), `sources add brain` (idempotent), `sync
  --source brain` (import + embed via the ai-gateway L7 placeholder key),
  `sync --skip-failed` (advance past unparseable brain files), then a
  pages>0 gate. `set -o pipefail` on all piped gbrain calls. Config lives at
  `/sandbox/.gbrain/config.json` (the ONLY location gbrain reads).
- **brain-query** — install `/sandbox/.prime-claw/bin/brain-query` plus
  `/sandbox/AGENTS.md`. The read-only helper runs `gbrain search` then `gbrain get`,
  bounds the excerpt, and emits `CITE_AS: [Brain: <slug>]`; instructions require
  citations and treat retrieved content as untrusted data.
- **spawn** — stage the non-secret spawn target.

## Operating guarantees (carried from Phase 1)

- **Credential isolation** — real credentials enter only OpenShell providers;
  they never touch sandbox disk, logs, or the repo. Host `auth.json` is read
  in-process and never copied. Sandbox auth files contain only non-secret adapter
  values and `openshell:resolve:` placeholders. This applies to gateway keys,
  GitHub tokens, and openai-codex OAuth.
- **Configurable shape** — gateway endpoint / provider / baseUrl / credential
  are parameterized via `config/runtime.json` + `PRIME_CLAW_*` env overrides;
  another operator can re-point without code edits.
- **Single-gateway discipline** — the runtime pins the `openshell` gateway
  (17670); the stale `nemoclaw` registration is forbidden.
- **Recreate wipes `/sandbox`** — after any recreate, re-run `converge`. Never
  `docker restart`; delete + recreate.
- **In-sandbox Postgres** — Postgres listens on `localhost:5433` inside the
  sandbox only (no host forward; deny-by-default egress). Host access is via
  `bin/prime-claw` / `openshell sandbox exec`.

## Reproduce / verify

    bin/prime-claw status                 # expected-vs-actual
    bin/prime-claw validate               # green acceptance gate
    python3 -m pytest tests/ -q           # offline lifecycle tests
