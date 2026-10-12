# Sandbox runtime lifecycle (Phase 2)

> **Provider profiles (implemented 2026-09-17):** Zendesk AI Gateway is the no-config default
> for both concerns: Kimi K3 inference and `text-embedding-3-large`/1536 embeddings. Valid host,
> operator-local, and environment choices override each concern independently. Slice 4A's home
> `Qwen3-Embedding-8B`/4096 machinery remains an explicit operator-local override; Spark recovery
> is confirmed, but its preserved candidate requires preflight before resume. See
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
| `.prime-claw/runtime.local.json` | Ignored mode-0600 operator-local brain repository and optional home-embedding overlay. |
| `.prime-claw/runtime-policy.local.yaml` | Ignored mode-0600 candidate policy rendered by `embedding-preflight`. |
| `.prime-claw/runtime-policy.active.yaml` | Ignored mode-0600 least-privilege policy rendered from the selected profiles. |
| `config/requirements-inventory.json` | Requirement → validator traceability. |
| `docs/runbook.md` | Operations: failure signature → recovery command. |
| `docs/evidence/` | Recorded validate/recover runs. |

## Global flags

`--dry-run` is **global** and precedes the verb:

    bin/prime-claw --dry-run create

`--config <path>` overrides `config/runtime.json`, but repository identity still must come
from the ignored local overlay or `PRIME_CLAW_BRAIN_REPO`.

## Required operator brain repository

Prime-claw intentionally ships with no brain repository. Before `status`, `create`, `converge`,
`validate`, `recover`, or `embedding-build`, configure the GitHub `owner/repository` slug by one
of these methods:

1. Add `"brain_repo": "owner/repository"` to the ignored
   `.prime-claw/runtime.local.json` object and keep the file mode `0600`.
2. Set `PRIME_CLAW_BRAIN_REPO=owner/repository`. The environment wins when both are present.

Do not include `https://`, credentials, or a trailing `.git`. There is no public starter or
example brain. A missing or malformed value fails before provider, sandbox, network, or database
work. `build`, `destroy`, and `embedding-preflight` remain available because they do not consume
brain repository content. `status` reports the missing setup as `brain-repository BAD` without
probing runtime components.

## Verbs

| Verb | What it does | Mutates |
|------|--------------|---------|
| `status` | Read-only actual-vs-expected report for every component, including the exact selected-vs-attached managed provider set. | no |
| `build` | Builds `docker/runtime.Dockerfile` into the image. Idempotent via an input fingerprint + build stamp; `--force` rebuilds. | image |
| `embedding-preflight` | Validates the locked Qwen/4096/1000s parallel-database contract and renders a redacted, exact-host local policy. Makes no network, sandbox, or database call. | ignored local policy only |
| `embedding-build` | Temporarily applies the candidate policy, builds/resumes only `gbrain_qwen4096` through a separate `GBRAIN_HOME`, gates fresh 4096-dimensional Qwen chunks and canonical non-mutation, then restores the tracked gateway/default policy. Never cuts over canonical config. | candidate DB/config; temporary policy |
| `create` | Fresh bring-up. Destructive: deletes any existing sandbox, creates from the image with providers attached **at create**, then converges. | sandbox |
| `converge` | Idempotent repair of an existing sandbox: re-runs every stage in place (policy, provider env, prime-agent install, brain, spawn target) with **no** needless recreate. Fixes drift. | in place |
| `validate` | Green/red acceptance gate: selected config/vector-space/bookmark exact before any gbrain mutation, daemon, egress, credentialed model, brain serving, and spawn/reap. Home validation temporarily applies candidate egress, uses candidate `GBRAIN_HOME`, and always restores canonical policy; restore failure fails the gate. | evidence |
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
- **policy** — render and apply `.prime-claw/runtime-policy.active.yaml` from the selected profiles. Unused gateway/Codex routes and binaries are omitted; the tracked policy remains the source template.
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
- **codex-provider** — for an explicit `openai-codex` selection only, mirror the host OAuth
  bundle into OpenShell's builtin `codex` provider (host-side only), with conditional-refresh/hash
  discipline (`.prime-claw-codex-oauth.sha256`). It is not read or staged on the no-config path.
- **sandbox** — create-if-absent (or delete+recreate with `force_fresh`). It attaches only the
  credential providers required by the selected inference and embedding profiles;
  the no-config path needs AI gateway + GitHub, not Codex. An explicit local profile may
  temporarily replace gbrain/Bun egress during its isolated build. On in-place converge,
  attaches missing selected providers and detaches only stale prime-claw-managed providers without
  wiping `/sandbox`; unrelated operator providers are untouched. The brain is NOT `--upload`ed.
- **prime-agent** — install/configure prime-agent + persistent REPL and restart the daemon so
  it inherits the selected provider placeholders. A valid host models/settings pair is mirrored
  atomically; otherwise the portable Kimi/GLM gateway catalog and Kimi settings are generated.
  Environment or operator-local model selection has higher precedence. A placeholder-only Codex
  auth projection is written only for explicit Codex, and stale projection state is removed when
  switching away. Real credentials always remain at
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
  pages>0 gate. Before config mutation or migration, a read-only guard requires any populated
  index to match the selected config, model, dimensions, vector column, text hashes, page
  signatures, and non-NULL embeddings. Any mismatch fails closed and requires a parallel
  rebuild/cutover; only an empty or exact-match space may proceed.
  `set -o pipefail` on all piped gbrain calls. Config lives at
  `/sandbox/.gbrain/config.json` (the ONLY location gbrain reads).
- **brain-query** — install `/sandbox/.prime-claw/bin/brain-query` plus
  `/sandbox/AGENTS.md`. The read-only helper runs `gbrain search` then `gbrain get`,
  bounds the excerpt, and emits `CITE_AS: [Brain: <slug>]`; instructions require
  citations and treat retrieved content as untrusted data.
- **spawn** — stage the non-secret spawn target.

## Operating guarantees (carried from Phase 1)

- **User credential isolation (default)** — the operator's real credentials
  enter only OpenShell providers; they never touch sandbox disk, logs, or the
  repo. Host `auth.json` is read in-process and never copied. Sandbox auth files
  contain only non-secret adapter values and `openshell:resolve:` placeholders.
  This applies to gateway keys, GitHub tokens, and openai-codex OAuth. A distinct
  sandbox-owned SSH identity is an explicit, narrower-trust opt-in described
  below; it is **not** a way to keep that SSH credential from the sandbox.
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

## Git authentication: HTTPS default, SSH opt-in (operator decision, 2026-10-12)

The network policy permits GitHub and GitLab HTTPS and SSH egress from all
sandbox executables. **Egress is not authentication.** OpenShell's inspected
provider path substitutes gateway-held credentials in HTTP/Smart-HTTP traffic;
SSH is opaque TCP. In the pinned OpenShell `v0.0.116` and the checked newer
`v0.1.3`, there is no documented, supported outbound Git-SSH signer that lets
sandbox processes authenticate while withholding both a private key **and the
ability to use that identity** from those processes. `openshell ssh-proxy` is
for connecting *into* a sandbox. An `ssh-agent` socket could hide key bytes,
but any sandbox process that can reach it can ask it to sign; do not present
agent forwarding as the original credential-isolation guarantee. Experimental
provider files in `v0.1.3` are workload-visible non-secret configuration, not
an SSH signer. See the [pinned GitHub provider profile](https://github.com/NVIDIA/OpenShell/blob/v0.0.116/providers/github.yaml),
[newer provider transport boundary](https://github.com/NVIDIA/OpenShell/blob/v0.1.3/docs/how-it-works/providers/overview.mdx#L365-L406),
and [SSH proxy's inbound modes](https://github.com/NVIDIA/OpenShell/blob/v0.1.3/crates/openshell-cli/src/main.rs#L658-L668).

| Operator choice | Identity and custody | Result |
| --- | --- | --- |
| **Default: act on behalf of a user** | HTTPS Git with that user's appropriately scoped OpenShell-managed provider credential. The real token stays outside the sandbox; no personal SSH key or host agent socket is mounted. | Per-user attribution and Git Smart-HTTP fetch/push where the provider and policy authorize them. This is the default, not an SSH workaround. |
| **Opt-in: act as an agent** | A separate, limited [GitHub machine user](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys#machine-users) / [GitLab service account](https://docs.gitlab.com/user/profile/service_accounts/) for multiple repos, or a repo-scoped deploy key (enable write only when push is required). Use a new identity, **never the operator's personal SSH key**. Its key or callable signing authority is available to the sandbox. | SSH Git is possible after an approved identity, trusted host keys, and the outbound proxy path are configured. A compromised sandbox can use or steal a sandbox-held key until provider-side revocation; this is a different, explicitly accepted trust model, not credential isolation. |
| **Strict isolation** | Refuse any sandbox-accessible SSH signing authority. | Authenticated Git-over-SSH is a hard limit; use HTTPS with OpenShell-managed credentials. |

A user may choose the hybrid per claw or repository: HTTPS for user-attributed
work and a deliberately scoped agent SSH identity for work attributed to the
agent. Do not silently switch a remote from HTTPS to SSH, forward the user's
host agent, or change the declared identity based on a failed authentication.
For an opt-in SSH identity, record its owner, repository/organization access,
write and protected-branch scope, creation and rotation/revocation procedure,
and how its trusted host keys and proxy route will be supplied. Keep any
sandbox-owned private key out of the repo and logs; deleting a sandbox alone
does not revoke it at GitHub or GitLab. A [GitHub deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
is one-repository and read-only by default; [GitLab deploy keys](https://docs.gitlab.com/user/project/deploy_keys/)
can be read/write and have project/owner authorization nuances. Neither is a
non-extractable OpenShell credential.

**Current v2r1014 proof:** the GitHub HTTPS provider is attached and public
HTTPS Git reads passed. GitLab has network access but no attached GitLab
credential. SSH port 22 accepted proxy CONNECT for both hosts; an SSH protocol
probe reached `Permission denied (publickey)` because the sandbox has no SSH
agent or key. Authenticated SSH pull/push has **not** been proven. The
[runbook](runbook.md) contains the operational checks. No dedicated account,
deploy key, host-agent mount, or SSH-auth setup is implied by this decision.

## Reproduce / verify

    bin/prime-claw status                 # expected-vs-actual
    bin/prime-claw validate               # green acceptance gate
    python3 -m pytest tests/ -q           # offline lifecycle tests
