# Sandbox runtime lifecycle (Phase 2)

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
| `create` | Fresh bring-up. Destructive: deletes any existing sandbox, creates from the image with providers attached **at create**, then converges. | sandbox |
| `converge` | Idempotent repair of an existing sandbox: re-runs every stage in place (policy, provider env, prime-agent install, brain, spawn target) with **no** needless recreate. Fixes drift. | in place |
| `validate` | Green/red acceptance gate: daemon healthy, deny-by-default egress, credentialed model call, brain serving, spawn/reap. Records versions to `docs/evidence/validate-<utc>.json`. | evidence |
| `recover` | Maps a detected failure signature to its codified recovery, then re-validates. See [runbook.md](runbook.md). | per signature |
| `destroy` | Safe, confirm-gated teardown. Without `--yes` it prints the plan and exits 0 without mutating; `--yes` deletes the sandbox; `--image` also removes the recorded image + clears the build stamp. Idempotent. Never touches the gateway, providers, or `config/`. | sandbox (+image) |

## Stages

`create` and `converge` run the same idempotent stages, individually runnable
for targeted diagnosis:

- **policy** — apply `policies/runtime.yaml`.
- **provider** — attach the AI-gateway provider (create/update-first; import
  the profile only when the provider is absent).
- **sandbox** — create-if-absent (or delete+recreate with `force_fresh`).
- **prime-agent** — install/configure prime-agent + daemon + persistent REPL
  in-sandbox; ensures the daemon runs and cleans stale sockets.
- **brain** — bring up Postgres 16 + pgvector + gbrain in-sandbox
  (initdb-if-absent, agent-owned PGDATA).
- **spawn** — stage the non-secret runtime layout (`models.json`, npm-onload,
  spawn target).

## Operating guarantees (carried from Phase 1)

- **Credential isolation** — credentials enter the sandbox only via OpenShell
  providers at create; they never touch sandbox disk, logs, or the repo. The
  gateway key is read in-process from the host `auth.json` and never printed.
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
