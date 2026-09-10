# docs/derisk — Phase 1 de-risk verdicts and evidence

One verdict document per load-bearing unknown, plus the raw evidence the
verdicts stand on. Spec: [.ralph/plans/SPECIFICATION.md](../../.ralph/plans/SPECIFICATION.md)
· Requirements: [.ralph/plans/REQUIREMENTS.md](../../.ralph/plans/REQUIREMENTS.md)
· Traceability: [config/requirements-inventory.json](../../config/requirements-inventory.json)

## Verdict documents

| Unknown | Verdict doc | Status |
|---|---|---|
| U1 — prime-agent in a fresh OpenShell sandbox (HARD GATE) | [U1.md](U1.md) | in progress — R-U1-1/-2/-5 proven (Slice 1); verdict written in Slice 3 |
| U2 — gbrain brain stack in the sandbox | `U2.md` | pending (Slice 4) |
| U3 — episode spawn/reap mechanics | `U3.md` | pending (Slice 5) |

Verdict taxonomy: **GO** / **GO with documented constraints** / **NO-GO**.
A hard NO-GO stops all agentic execution and waits for the operator (R-X-4).

## Evidence

`evidence/` holds machine-generated JSON artifacts produced by
`scripts/validate-*.py` runs. They are committed so any verdict can be
re-tested later: re-run the matching `apply`/`check`/`validate` trio and
compare against the recorded artifact. Each artifact records the toolchain
versions it was captured with (R-U1-2).
