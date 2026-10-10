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

`bin/prime-claw converge` re-runs in-place stages for a verified `Ready`
sandbox and can fix policy, provider, brain, and spawn-target drift **without**
recreating it. The Prime Agent source is now image-owned: `converge` cannot
reinstall a missing or mismatched `/opt/prime-agent` checkout. It fails the
source identity gate before other Prime Agent stage writes.
Use `recover` only after confirming the existing sandbox is `Ready`. An `Error`,
other non-Ready, or unverified sandbox state is **not** a wipe or cold-daemon
signature: `recover` now stops before sandbox exec, gateway restart, recreation,
or converge, including with `--signature`. `sandbox get` errors do not prove
absence, so automatic vpn-flap/gateway-flip recovery is withheld until a safe
absence check exists. Inspect the sandbox state and get operator approval for
a specific repair; do not treat `--dry-run recover` as a safety check (it does
not probe, prints no recovery plan, and exits nonzero). Do not run `converge`
blindly on an Error sandbox. An unaccepted `home-qwen` selection also fails
ordinary lifecycle commands closed; use the explicit canonical-profile
recovery command in the Slice 4A section below.

## Preserved v2 replacement (2026-10-10)

The original `prime-claw-v2` OpenShell sandbox is `Error`; installed OpenShell
0.0.116 cannot transition that instance to `Ready` with `sandbox start`. Its
container and original volume remain retained. A verified checkpoint was
copied to a separate working volume. The accepted replacement is
`prime-claw-v2r1013` on the pinned TypeScript v0.9.8-r1 image, using a fresh
provider binding and its own checkpoint-derived working volume. See the
[initial trial](evidence/prime-agent-v098-v2-recovery-20261010.md) and
[active acceptance](evidence/prime-agent-v098-v2-active-acceptance-20261010.md)
for exact identities, volume manifests, data counts, and remaining gates.

Do not call `recover`, `converge`, `validate`, `destroy`, `docker start`, or
`docker restart` as an unexplained shortcut. `converge` includes provider
reconciliation, brain clone/index/query, and spawn stages; `validate` applies
a temporary policy and writes a validator page. Neither is a read-only
health check. The first replacement's Codex response said the token expired,
but Joe's host Codex still worked. The host auth fingerprint had changed since
the last OpenShell provider provisioning. The supported Prime Claw provider
refresh and a **new sandbox attachment** fixed the route; reprojection of the
old sandbox's synthetic auth alone did not. No host OAuth value was copied to
sandbox disk. Do not refresh a shared provider without accounting for old
sandbox placeholder bindings. Do not route writes, switch vector spaces, or
discard v1/original/checkpoint state merely because this runtime is healthy.

A restored home links nine state entries from `/sandbox/home-root`. The image
retains `.uv`, `.venv`, `.cache`, `.local`, and `kernel-venv` as active local
environments while preserving their historical copies under `home-root`.
`/opt/prime-agent` must be read-only in the effective OpenShell policy; the
non-secret kernel and tsconfig paths must be present in the sandbox environment.
A cold container retains the volume and links but not the manually started
PostgreSQL and daemon processes. Re-check exact image, three mount sources,
policy, provider binding, source identity, and absence of live database/daemon
owners before explicitly starting just those two services on the working copy.
After OpenShell restart the daemon socket file can exist without a listener:
the pinned source daemon's own lease logic recovered it on an isolated trial
and on the accepted replacement. Do not manually unlink the socket/lock or
infer a running daemon from `test -S`; require a successful RPC build-ID hello.
Never assume a `Ready` phase alone proves application health.

On this recovery the supervised cold start used PostgreSQL's
`/usr/lib/postgresql/16/bin/pg_ctl -D /sandbox/pgdata -l /sandbox/pg.log -w start
-o '-c listen_addresses=localhost -p 5433 -c unix_socket_directories=/sandbox'`
inside the accepted sandbox, after checking that the database was not already
serving. With source identity and zero live daemon owners checked, it launched
`/usr/local/bin/prime-agent --mode daemon --offline` using `HOME=/sandbox`,
`PRIME_AGENT_KERNEL_VENV=/sandbox/kernel-venv`,
`TSX_TSCONFIG_PATH=/opt/prime-agent/tsconfig.json`, and the existing
`npm-onload.js` preload. Require PostgreSQL counts and an RPC hello with
`cwd-fix-v0.9.8-r1` build ID afterward, not merely a socket file. The exact
checks and retained state are in the linked acceptance evidence.

`bin/prime-claw status` currently reports the provider check as `BAD` because
OpenShell 0.0.116 rejects the provider-list `--output json` option used by that
read-only probe (tracked as `prime-claw-zwg.3`). A direct provider listing
showed all three attached providers, and separate source/daemon/model/data
checks passed. Do not mistake that status false negative for an expired login
or run `validate`/`converge` to make it green. Conversely, do not infer model
health from the CLI's socket-presence check alone.

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
| 1 | **vpn-flap** | GlobalProtect VPN drops -> the openshell gateway daemon (17670) dies and the sandbox container is killed. `status` may show the sandbox absent, but a failed get does not prove absence. | Diagnose gateway/network and sandbox state first; `recover` now blocks if sandbox get fails rather than automatically restarting and converging. Obtain approval for a specific repair. |
| 2 | **gateway-flip** | `active_gateway` in `~/.openshell/config.yaml` was flipped off `openshell` (e.g. by a NemoClaw tool). Sandbox get may fail under the wrong gateway. | Diagnose and re-pin `active_gateway: openshell` only with operator approval. `recover` blocks an unverified absence; it will not automatically recreate. **Never** point prime-claw at the `nemoclaw` gateway. |
| 3 | **recreate-wipe** (historical) | A recreate can wipe writable `/sandbox` state even if the image-owned Prime Agent checkout still exists. | Automatic `recreate-wipe` recovery is disabled. Preserve and inspect brain/Postgres/home state, and seek a separate operator-approved recovery; `converge` cannot reinstall image-owned source or restore wiped data. |
| 4 | **cold-daemon** | On a verified `Ready` sandbox with exact image-owned source, the daemon socket is absent. A stale socket or wrong daemon RPC build identity is **not** a verified cold daemon. | Only this verified signature can enter `recover` -> `converge`; `stage_prime_agent` starts the source daemon (`--mode daemon --offline`) and checks its RPC hello. Stale/mismatched socket or unverified source blocks before `converge`. |
| 5 | **drift** | Sandbox/policy/provider drifted from expected; `status` shows a mismatch. | `bin/prime-claw converge`. |
| 6 | **brain-clone-401** | `create`/`converge` fails at stage `brain-clone` with `remote: Invalid username or token` (exit 128). | First check the stage script class of bug: the clone URL must expand `${api_token}` in-sandbox (double-quoted — see `docs/derisk/3a-slice1.md` for the Slice-1 root cause). If the code is right, verify the provider token is current: `gh auth token` vs the provider (`openshell provider get prime-claw-github`); a rotated token re-syncs automatically on the next run via the conditional-refresh hash (`.prime-claw-github-token.sha256`). Worst case: `destroy` + `create` for a clean placeholder binding. |
| 7 | **credentialed-endpoints-dead-after-converge** | After a `converge`, the sandbox's credentialed calls (inference and/or git push) suddenly 401/403 even though nothing "changed". | Cause: a `provider update` bumped the provider's resource version, re-keying the placeholder set, while the running sandbox still holds the OLD placeholders. Recovery: `bin/prime-claw destroy` + `create` (binds fresh placeholders). Prevention is built in: only selected credential-provider stages run, and each skips no-op updates (D3a-J). If you rotate a credential by hand, run `converge` then recreate. |
| 8 | **vpn-down-rbac-403** | Sandbox credentialed calls (embed, inference, clone) fail with `403 RBAC: access denied` (body from istio-envoy, no rate-limit headers) while the SAME real key returns 200 from the host. | The host VPN (GlobalProtect) is down — corporate policy forces re-login ~daily. Check `zetup vpn status`; connect with `zetup vpn connect` (Okta push). No provider/sandbox changes needed; placeholders are unaffected. Diagnose this FIRST before touching providers ( bead prime-claw-z56 ports the ensure-vpn auto-check). |
| 9 | **daemon-no-provider-auth** | Daemon RPC can create a session, but `prompt_and_wait` fails preflight with `No API key found for <provider>`. | The daemon may predate the current provider placeholders/config. Do **not** assume `converge` restarts an existing daemon: the source stage deliberately does not kill or signal it. Preserve state and seek a separately supervised restart plan. Do not inspect `/proc/<pid>/environ` — OpenShell blocks it. |
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
- **cold-daemon nuance**: an unclean daemon kill may leave a stale
  `/tmp/prime-agent-*/daemon.sock` and a `daemon.sock.lock` directory. The
  supervisor can refuse to start (`ELOCKED`). `recover` does not delete them
  or signal a daemon: a present socket with a failed or wrong-build RPC hello
  blocks automatic recovery. A truly absent socket on an exact-source `Ready`
  sandbox is the only automatic cold-daemon path. Seek operator approval for
  any stale-lock or running-daemon repair.
- **Single-gateway discipline**: prime-claw runs ONLY on the `openshell`
  gateway (17670, homebrew v0.0.116). `active_gateway` stays pinned to
  `openshell`. The `nemoclaw` gateway registration is stale and FORBIDDEN.
- **If a 403 istio-envoy RBAC recurs** against `ai-gateway.zende.sk`, FIRST
  check VPN/network health (GlobalProtect) before suspecting the policy.
- **Recreate can wipe writable `/sandbox` state** — preserve and inspect the
  retained data before any approved lifecycle repair. Image-owned Prime Agent
  source does not restore PostgreSQL, brain, or home state. Do not use
  `docker restart`, delete/recreate, or broad `converge` as an unapproved fix.
- **Credentials** enter only via OpenShell providers (L7). No real key is ever
  on sandbox disk. `validate` proves this on every run.

## Demonstrated degrade-and-recover

Slice 5's historical acceptance evidence is a live degrade-and-recover cycle
(see `docs/evidence/recover-<utc>.json`): a known degradation was induced,
`bin/prime-claw recover` ran, and `bin/prime-claw validate` returned green.
That older test does not prove a later image-owned source install, a stale
source-daemon repair, or recovery of the active v2 `Error` sandbox.


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
3. Classify the sanitized gbrain failure. HTTP 503 with `thermal_cooldown` is an external service
   blocker. After the fast latch clears, the resource snapshot may retain
   `thermal_admission_denied` for up to 180 seconds; wait for that window and probe again rather
   than starting a build during false denial.
4. Before a new live resume, verify the prime-claw durable-progress watchdog tests pass, then
   verify both host and in-sandbox probes return HTTP 200 with exactly 4096 values when
   `dimensions` is omitted. A watchdog stall exits 124 and must leave no process-group descendant.
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

## Prime Agent Generation A role cutover preparation

Generation A is prepared but not activated by normal development. Use
`docs/lab-global-plugin.md#Generation-A-coordinator-and-preactivation-bundle`
for the exact coordinator, private-bundle, checkpoint, and recovery contracts.
During Slice 4, use recording fakes, bounded temporary subprocess emitters, the
supported wrapper's read-only `--version` interface, and isolated-copy
apply/restore proofs. Do not run `--execute`, `--user-global`, `shutdown`, a
daemon start, landing, or UAT.

A future explicitly authorized Gate A starts from a separate non-Orca terminal
with a reviewed coordinator input, private bundle manifest digest, and private
checkpoint directory. The external coordinator first binds the exact compiled or
Node CLI prefix, both interpreter/entrypoint artifact digests, the declared old
daemon's status/build/socket/PID, the approved worker set, and confirmed absence
of clients, TUIs, launchers, and wrappers. Observation uses only exact Prime
Agent process-title discovery plus targeted declared/discovered PIDs. Version
admission uses a version-only lossless subprocess capture and requires return
code zero, exactly one raw stream equal to the configured version encoded as
UTF-8 plus one LF byte, and the other raw stream equal to `b""`. CRLF, bare CR,
no LF, non-UTF-8 bytes, ambiguity, whitespace, extra or multiple lines,
mismatch, nonzero status, and timeout fail before status or any live work. The
general text-mode runner for Git, status, process, and bundle commands remains
unchanged.

The input also contains the explicit newest-to-oldest linear revert commits, the
integration merge and ordered parents, mainline 2, and accepted prelanding
commit/tree. The coordinator proves that recipe only in a temporary no-local
clone. Its sole mutating sequence remains shutdown, exact fast-forward
landing/push, apply with a fresh external role receipt, check, and one runtime
start. After that single start it performs only bounded read-only readiness
observations; wrong identity, duplicate runtime, child exit, malformed status,
or deadline stops without retry. Only exact readiness prints the owner -> episode
-> ordinary checklist. Stop at the first uncertain boundary and follow the
phase-specific recovery table. Never blindly retry a push, apply, or runtime
start, and never use reset/rebase/force or automatic live compensation.
