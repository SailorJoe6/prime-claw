# docs/derisk — Phase 1 de-risk verdicts and evidence

One verdict document per load-bearing unknown, plus the raw evidence the
verdicts stand on. Spec: [.ralph/plans/SPECIFICATION.md](../../.ralph/plans/archive/phase1-derisk-gate/SPECIFICATION.md)
· Requirements: [.ralph/plans/REQUIREMENTS.md](../../.ralph/plans/archive/phase1-derisk-gate/REQUIREMENTS.md)
· Traceability: [config/requirements-inventory.json](../../config/requirements-inventory.json)

## Verdict documents

| Unknown | Verdict doc | Status |
|---|---|---|
| U1 — prime-agent in a fresh OpenShell sandbox (HARD GATE) | [U1.md](U1.md) | in progress — R-U1-1/-2/-5 proven (Slice 1); verdict written in Slice 3 |
| U2 — gbrain brain stack in the sandbox | `U2.md` | pending (Slice 4) |
| U3 — episode spawn/reap mechanics | `U3.md` | pending (Slice 5) |

Verdict taxonomy: **GO** / **GO with documented constraints** / **NO-GO**.
A hard NO-GO stops all agentic execution and waits for the operator (R-X-4).

## Phase 3a slice verdicts

Phase 3a (tracer bullet) records one verdict doc per executed slice:

| Slice | Verdict doc | Status |
|---|---|---|
| S0 — upstream-gbrain spike (R3a-0, R3a-13) | [3a-slice0.md](3a-slice0.md) | GO |
| S1 — brain into the sandbox, push-capable (R3a-1, R3a-5 part, R3a-7) | [3a-slice1.md](3a-slice1.md) | COMPLETE — root-caused the fresh-create 401s to a shell-quoting bug (double-quote the `${api_token}` URL), not an OpenShell defect |
| S2 — in-sandbox index serving (R3a-2, R3a-12) | [3a-slice2.md](3a-slice2.md) | COMPLETE — brain-index stage; 1057 pages / 3029 embeddings; validate 16/16; validate false-pass fixed |
| S3 — cited read/query from sandboxed prime-agent (R3a-3, R3a-13 update) | [3a-slice3.md](3a-slice3.md) | COMPLETE — ChatGPT-5.6 Sol called brain-query and cited `resources/the-anatomy-of-an-agent-harness`; OAuth stayed placeholder-isolated |
| S4A — home-Qwen 4096 cutover (R3a-12, R3a-14) | [3a-slice4a.md](3a-slice4a.md) | BLOCKED — DGX Spark crashed during 4A.2a; partial candidate preserved, canonical unchanged, no cutover |

## Evidence

`evidence/` holds machine-generated JSON artifacts produced by
`scripts/validate-*.py` runs. They are committed so any verdict can be
re-tested later: re-run the matching `apply`/`check`/`validate` trio and
compare against the recorded artifact. Each artifact records the toolchain
versions it was captured with (R-U1-2).
