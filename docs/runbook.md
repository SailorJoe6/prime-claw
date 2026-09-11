# prime-claw runbook — failure signature → recovery command

> Phase 2 operability reference (R2-C-4). Full version lands in Slice 5; this
> stub captures the known Phase 1 signatures now that `bin/prime-claw status`
> exists. Single entry point: `bin/prime-claw <verb>`.

## How to diagnose

Run `bin/prime-claw status`. Each component reports OK / BAD / n/a (???).
A BAD line names the failing component; match it to a signature below.

| Status symptom | Likely signature | Recovery |
|---|---|---|
| `gateway ... FORBIDDEN 'nemoclaw'` or `!= expected 'openshell'` | active_gateway flipped to the stale nemoclaw registration | re-pin `openshell` (Slice 5: `prime-claw recover --signature gateway-flip`) |
| `gateway ... failed` / no active gateway | VPN flap killed the gateway daemon | `brew services start openshell`, then re-converge (Slice 5) |
| `sandbox ... not found` | sandbox absent (never created, or destroyed) | `prime-claw create` (Slice 3) |
| `provider ... NOT attached` | provider detached / fresh sandbox | providers attach at create → `prime-claw converge` (Slice 3) |
| `postgres ... down` / `gbrain ... missing` | recreate wiped /sandbox, or brain not started | `prime-claw converge` re-runs the brain stage (Slice 3) |
| `prime-agent daemon ... absent` | daemon not started (cold) or wiped | `prime-claw converge` (Slice 3); cold-daemon create retries (Slice 5) |

Phase 1 detail (versions, gotchas): docs/derisk/{U1,U2,U3}.md.
