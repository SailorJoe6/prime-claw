# prime-claw runtime runbook

One OpenShell sandbox lifecycle behind `bin/prime-claw` (Phase 2). This runbook
maps each **observed failure signature** to its recovery command. Recovery is
codified in `bin/prime-claw recover` (Slice 5), not tribal.

Verbs: `status` (read-only expected-vs-actual) · `build` (image) ·
`create` (fresh bring-up, destructive) · `converge` (idempotent repair of an
existing sandbox) · `validate` (green/red acceptance gate) · `recover` (this
file) · `destroy` (Slice 6).

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

### Notes / hazards
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
