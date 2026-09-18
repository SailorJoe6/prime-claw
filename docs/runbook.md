# prime-claw runtime runbook

One OpenShell sandbox lifecycle behind `bin/prime-claw` (Phase 2). This runbook
maps each **observed failure signature** to its recovery command. Recovery is
codified in `bin/prime-claw recover` (Slice 5), not tribal.

Verbs: `status` (read-only expected-vs-actual) · `build` (image) ·
`create` (fresh bring-up, destructive) · `converge` (idempotent repair of an
existing sandbox) · `validate` (green/red acceptance gate) · `recover` (this
file) · `destroy` (confirmed teardown).

The single entry point is `bin/prime-claw`. `--dry-run` is global and precedes
the verb.

## Golden rule

`bin/prime-claw converge` is the idempotent repair for almost everything:
it re-runs every stage in place and fixes drift (policy, provider env,
prime-agent install, brain, spawn target) **without** recreating the sandbox.
Reach for `recover` when you don't know *which* degradation you have, or for
the two failures converge alone can't fix (a down gateway, an active-gateway
flip). Exception: an unaccepted `home-qwen` selection fails ordinary lifecycle commands closed;
use the explicit canonical-profile recovery command in the Slice 4A section below.

## Required one-time brain repository setup

A fresh checkout has no brain repository by design. Add your GitHub `owner/repository` slug to
the ignored `.prime-claw/runtime.local.json` object:

```json
{
  "brain_repo": "owner/repository"
}
```

Keep the file at mode `0600`. If it already contains operator-local settings, merge this key
instead of replacing the file. For one-shot or managed environments, set
`PRIME_CLAW_BRAIN_REPO=owner/repository`; it has precedence over the local file. URLs, values
ending in `.git`, and multi-segment paths are rejected. Missing or malformed setup fails before
runtime mutation and names both supported configuration paths.

## Provider-profile selection

With no usable preference, inference is `anthropic.kimi-k3` and embeddings are
`openai:text-embedding-3-large`/1536 through Zendesk AI Gateway. The runtime resolves the two
concerns independently:

1. `PRIME_CLAW_MODEL` or an operator-local `model` overrides inference.
2. Otherwise, a valid host `models.json` + `settings.json` pair is mirrored atomically.
3. Otherwise, the portable Kimi/GLM gateway catalog is generated.
4. `PRIME_CLAW_EMBEDDING_PROFILE` or ignored local embedding config selects embeddings;
   `.prime-claw/runtime.local.json` containing only `embedding_base_url` selects `home-qwen`
   for backward compatibility.

The no-config provider set is AI gateway + GitHub. Codex OAuth and its policy routes are added
only for explicit Codex inference. `home-qwen` stays isolated and cannot become an automatic
fallback. Inspect the resolved choices without mutation with:

```text
bin/prime-claw --dry-run create
```

## Failure signatures -> recovery

| # | Signature | How you notice | Recovery |
|---|-----------|----------------|----------|
| 0 | **brain-repository-not-configured** | `status` reports `brain-repository BAD`, or a repository-dependent command exits before any provider/sandbox action and names `PRIME_CLAW_BRAIN_REPO` plus `.prime-claw/runtime.local.json`. | Configure your own GitHub `owner/repository` slug using one of the two setup paths above. Do not add a tracked fallback or public/example brain. |
| 1 | **vpn-flap** | GlobalProtect VPN drops -> the openshell gateway daemon (17670) dies and the sandbox container is killed. `status` shows the sandbox absent; `openshell gateway list` fails. | `brew services start openshell`, then `bin/prime-claw converge`. `recover` does both. |
| 2 | **gateway-flip** | `active_gateway` in `~/.openshell/config.yaml` was flipped off `openshell` (e.g. by a NemoClaw tool). The sandbox is absent under the active gateway. | Re-pin `active_gateway: openshell`, then `bin/prime-claw recover` (recreates on the active gateway + converge). **Never** point prime-claw at the `nemoclaw` gateway. |
| 3 | **recreate-wipe** | A sandbox recreate wipes `/sandbox` -> prime-agent and the brain are gone even though the sandbox shows Ready. | `bin/prime-claw converge` (re-installs both). `recover` detects the missing install and converges. |
| 4 | **cold-daemon** | The prime-agent daemon isn't running (no `/tmp/prime-agent-*/daemon.sock`) -> spawn times out. | `bin/prime-claw converge` — `stage_prime_agent` auto-starts the daemon (`--mode daemon --offline`) with a socket-wait. |
| 5 | **drift** | Sandbox/policy/provider drifted from expected; `status` shows a mismatch. | `bin/prime-claw converge`. |
| 6 | **brain-clone-401** | `create`/`converge` fails at stage `brain-clone` with `remote: Invalid username or token` (exit 128). | First check the stage script class of bug: the clone URL must expand `${api_token}` in-sandbox (double-quoted — see `docs/derisk/3a-slice1.md` for the Slice-1 root cause). If the code is right, verify the provider token is current: `gh auth token` vs the provider (`openshell provider get prime-claw-github`); a rotated token re-syncs automatically on the next run via the conditional-refresh hash (`.prime-claw-github-token.sha256`). Worst case: `destroy` + `create` for a clean placeholder binding. |
| 7 | **credentialed-endpoints-dead-after-converge** | After a `converge`, the sandbox's credentialed calls (inference and/or git push) suddenly 401/403 even though nothing "changed". | Cause: a `provider update` bumped the provider's resource version, re-keying the placeholder set, while the running sandbox still holds the OLD placeholders. Recovery: `bin/prime-claw destroy` + `create` (binds fresh placeholders). Prevention is built in: only selected credential-provider stages run, and each skips no-op updates (D3a-J). If you rotate a credential by hand, run `converge` then recreate. |
| 8 | **vpn-down-rbac-403** | Sandbox credentialed calls (embed, inference, clone) fail with `403 RBAC: access denied` (body from istio-envoy, no rate-limit headers) while the SAME real key returns 200 from the host. | The host VPN (GlobalProtect) is down — corporate policy forces re-login ~daily. Check `zetup vpn status`; connect with `zetup vpn connect` (Okta push). No provider/sandbox changes needed; placeholders are unaffected. Diagnose this FIRST before touching providers ( bead prime-claw-z56 ports the ensure-vpn auto-check). |
| 9 | **daemon-no-provider-auth** | Daemon RPC can create a session, but `prompt_and_wait` fails preflight with `No API key found for <provider>`. | The daemon was started before the current provider placeholders/config were staged. Run `bin/prime-claw converge`; `stage_prime_agent` now deliberately restarts the daemon so it inherits the current placeholder environment. Do not inspect `/proc/<pid>/environ` — OpenShell blocks it. |
| 10 | **codex-placeholder-adapter-failure** | An explicitly selected `openai-codex` model fails locally with `Failed to extract accountId from token`, or remote calls 401 despite valid host OAuth. | Run `converge` and verify: host `settings.json` selects the intended `openai-codex` model; sandbox `settings.json` hash matches host; sandbox auth access is synthetic and refresh/accountId begin `openshell:resolve:`; `prime-claw-codex` is attached; `npm-onload.js` is staged. Never copy the real host auth file to the sandbox. |

## Teardown

`bin/prime-claw destroy` is the safe, confirm-gated teardown (Slice 6):

- **Non-destructive by default**: without `--yes` it prints what it *would*
  delete and exits 0 without mutating. `--dry-run destroy` is read-only.
- **`bin/prime-claw destroy --yes`**: deletes the OpenShell sandbox container.
- **`bin/prime-claw destroy --yes --image`**: also removes the recorded
  container image (`config/runtime.json: image`) via `docker rmi` and clears the
  build stamp so a later `create` rebuilds cleanly.
- **Idempotent**: an already-absent sandbox/image is a no-op.
- **Scope**: only the sandbox container (and, with `--image`, the local image).
  It never touches the gateway, the providers, or `config/`.

Rebuild from scratch afterwards with `bin/prime-claw create` (fresh bring-up).

### Notes / hazards
- **Host Postgres exposure (R2-X-6, NICE — documented constraint)**: the
  in-sandbox Postgres listens on `localhost:5433` **inside the sandbox only**
  (`listen_addresses=localhost`, `unix_socket_directories=/sandbox`,
  `PGDATA=/sandbox/pgdata`). It is **not** forwarded to the host. This is
  intentional: the brain is reachable from the agent/processes inside the
  sandbox (gbrain over the `/sandbox` socket or `localhost:5433`), and the
  OpenShell network policy is deny-by-default egress, so there is no host-side
  port to expose. Host access, when needed, is via `bin/prime-claw` / `openshell
  sandbox exec`, not a forwarded port.
- **cold-daemon nuance**: an unclean daemon kill leaves a stale
  `/tmp/prime-agent-*/daemon.sock` **and** a `daemon.sock.lock` directory;
  the supervisor refuses to start (`ELOCKED`) until both are removed. The
  daemon also auto-exits when it holds no session, so a truly idle sandbox may
  have no daemon — `converge` (stage_prime_agent) cleans the lock and restarts
  it. `recover` handles all of this.
- **Single-gateway discipline**: prime-claw runs ONLY on the `openshell`
  gateway (17670, homebrew v0.0.116). `active_gateway` stays pinned to
  `openshell`. The `nemoclaw` gateway registration is stale and FORBIDDEN.
- **If a 403 istio-envoy RBAC recurs** against `ai-gateway.zende.sk`, FIRST
  check VPN/network health (GlobalProtect) before suspecting the policy.
- **Recreate wipes `/sandbox`** — after any recreate, re-run `converge`. Never
  `docker restart`; delete + recreate.
- **Credentials** enter only via OpenShell providers (L7). No real key is ever
  on sandbox disk. `validate` proves this on every run.

## Demonstrated degrade-and-recover

Slice 5's acceptance evidence is a live degrade-and-recover cycle (see
`docs/evidence/recover-<utc>.json`): a known degradation is induced,
`bin/prime-claw recover` runs, and `bin/prime-claw validate` returns green.


## Home embedding preflight fails (Slice 4A)

**Signature:** `error: embedding preflight:` followed by a missing endpoint, locked setting,
policy drift, or non-ignored output-path error.

1. Put only `embedding_base_url` in `.prime-claw/runtime.local.json`, then `chmod 600` it.
2. Keep model `Qwen3-Embedding-8B`, dimensions `4096`, timeout `1000`, compatibility value
   `dummy`, and different candidate/legacy database names.
3. Run `bin/prime-claw --dry-run embedding-preflight`, then
   `bin/prime-claw embedding-preflight`.
4. Do not paste the private endpoint into logs, issues, evidence, tracked config, or policy.

Preflight failure is non-destructive. Do not work around it by re-enabling corporate
embeddings or changing the canonical 1536 database.

## Home candidate embedding build fails or is interrupted (Slice 4A.2a)

**Signature:** `error: candidate embedding build failed`, a host-side timeout, or an
interrupted `embedding-build` process.

A reported build failure restores the tracked gateway/default policy automatically. The candidate
`gbrain_qwen4096` database may contain partial progress but is isolated from canonical
`gbrain`. Do not drop either database and do not use `--skip-failed` to acknowledge provider
errors.

1. If the process was externally interrupted, force the canonical profile for recovery:
   `PRIME_CLAW_EMBEDDING_PROFILE=gateway bin/prime-claw converge`. Ordinary lifecycle commands
   fail closed while `home-qwen` is selected but not accepted/cut over.
2. Confirm the canonical config and `vector(1536)` database remain intact with direct read-only
   `psql`; do not use an ordinary doctor command that may auto-migrate.
3. Classify the sanitized gbrain failure. HTTP 503 from a fresh exact-model probe is an external
   service blocker; do not retry until the operator restores stable service.
4. Before a new live resume, verify both host and in-sandbox probes return HTTP 200 with exactly
   4096 values when `dimensions` is omitted.
5. Keep `GBRAIN_AI_EMBED_TIMEOUT_MS` and `GBRAIN_QUERY_EMBED_TIMEOUT_MS` at `1000000`, and keep
   the outer timeout above the sync deadline.

The 2026-09-18 resume exposed a fail-fast gap: upstream gbrain's `--full` `import.files` path did
not honor `GBRAIN_SYNC_STALL_ABORT_SECONDS=1200`; only the 12,000-second hard deadline stopped the
run. Correct and test that gap before another live resume. Do not mistake retry log activity for
successful embedding progress.

The build always restores the tracked gateway/default policy on normal exit, including success. Slice
4A.2b must explicitly reapply the candidate policy for semantic validation/cutover.

## Default AI-gateway embedding budget exhausted / HTTP 429

**Signature:** Zendesk AI-gateway embedding requests retry and end with `Too Many Requests`.

**Do not:** repeatedly retry, accept keyword-only mode, mutate an existing index in place, or
silently switch providers/vector spaces. The gateway remains the portable no-config default;
an outage or quota error must be visible.

**Recovery:** stop the write and restore provider capacity/quota. An operator who has explicitly
configured another embedding profile may use its documented non-destructive parallel rebuild,
but prime-claw must never auto-select personal hardware as fallback. Joe's home-Qwen override
is ready to resume after the exact-model preflight; no build has restarted. See [home-embedding-runtime.md](home-embedding-runtime.md).
