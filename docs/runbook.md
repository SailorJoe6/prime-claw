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
flip).

## Failure signatures -> recovery

| # | Signature | How you notice | Recovery |
|---|-----------|----------------|----------|
| 1 | **vpn-flap** | GlobalProtect VPN drops -> the openshell gateway daemon (17670) dies and the sandbox container is killed. `status` shows the sandbox absent; `openshell gateway list` fails. | `brew services start openshell`, then `bin/prime-claw converge`. `recover` does both. |
| 2 | **gateway-flip** | `active_gateway` in `~/.openshell/config.yaml` was flipped off `openshell` (e.g. by a NemoClaw tool). The sandbox is absent under the active gateway. | Re-pin `active_gateway: openshell`, then `bin/prime-claw recover` (recreates on the active gateway + converge). **Never** point prime-claw at the `nemoclaw` gateway. |
| 3 | **recreate-wipe** | A sandbox recreate wipes `/sandbox` -> prime-agent and the brain are gone even though the sandbox shows Ready. | `bin/prime-claw converge` (re-installs both). `recover` detects the missing install and converges. |
| 4 | **cold-daemon** | The prime-agent daemon isn't running (no `/tmp/prime-agent-*/daemon.sock`) -> spawn times out. | `bin/prime-claw converge` — `stage_prime_agent` auto-starts the daemon (`--mode daemon --offline`) with a socket-wait. |
| 5 | **drift** | Sandbox/policy/provider drifted from expected; `status` shows a mismatch. | `bin/prime-claw converge`. |

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
