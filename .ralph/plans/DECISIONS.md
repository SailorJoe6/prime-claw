# Decisions — Phase 3a: Tracer Bullet (a brain-hosting claw)

Beads: `prime-claw-zwg` (P1). Index: [SPECIFICATION.md](SPECIFICATION.md). Requirements: [REQUIREMENTS.md](REQUIREMENTS.md).

Each decision lists the requirement IDs it satisfies.

## D3a-A — Self-contained container (brain lives inside the sandbox)
**Decision:** The brain is cloned into the sandbox and indexed by the in-sandbox
gbrain+Postgres. The claw does **not** act as a thin client to an external brain over
MCP/HTTP for this phase.
**Satisfies:** R3a-1, R3a-2.
**Rationale:** Operator direction — "prime-claw should evolve to completely replace
gbrain/zbrain's container; the brain lives in it." A self-contained container keeps
deny-by-default egress intact and makes the claw's knowledge local and fast. Thin-client
(MCP to an external brain) was considered and rejected for the hosting goal (it leaves the
brain outside the container and requires an egress hole).

## D3a-B — Brain enters via git clone (read-mostly)
**Decision:** The brain enters the sandbox by cloning the operator's brain repo
(`~/gitlab_local/brain`, the `brain` gbrain source). Writes remain in ralph-pva until the
ingest/memorize skills port (3b+); 3a is read + one routed test write into the sandbox
clone only.
**Satisfies:** R3a-1, R3a-4.
**Rationale:** Markdown is the source of truth; the gbrain DB is a derived, rebuildable
index. Cloning the repo gives searchable content with no credential carriage. The exact
credential-safe clone mechanism (bind-mount vs in-sandbox clone vs staged copy) is an
open planning question (SPEC §7.1), not a spec-level commitment.

## D3a-C — prime-agent is the harness (the novel surface)
**Decision:** The brain is consumed by **prime-agent** running in the sandbox, using
prime-agent's own constructs (`.agents/skills/` discovery, the continual harness, daemon,
`rlm`, `schedule`). We do not wire gbrain's Claude/Codex/OpenClaw harness paths.
**Satisfies:** R3a-3, R3a-4, R3a-8.
**Rationale:** This is the genuinely novel, untested integration — gbrain ships harness
recipes for `claude-code | codex | opencode | openclaw` but not prime-agent. prime-claw's
purpose is to put prime-agent at the center; proving the prime-agent↔gbrain loop is the
point of the tracer bullet.

## D3a-D — Inference auth unchanged (host L7 provider)
**Decision:** No change to inference auth. The host OpenShell provider holds the real
credential; only a placeholder enters the sandbox; the L7 proxy swaps it at the boundary.
The claw never possesses LLM credentials.
**Satisfies:** R3a-7.
**Rationale:** This is best practice and already proven in Phase 2. A "copy auth.json into
the container" approach (the zbrain parked spec's D5) and a "dedicated claw inference
identity" were both explicitly **rejected** — the former breaks credential isolation, the
latter was never a requirement. Claw-unique identity applies only at *write* surfaces
(GitHub/Gmail/Slack/Telegram), not inference.

## D3a-E — Reuse proven gbrain capability; test only the delta
**Decision:** Do not author tests that re-prove gbrain CLI/sync/embedding or the browse
shim (already covered upstream). prime-claw tests target: brain clone wiring, in-sandbox
index integration, the prime-agent-harness read/query/write loop, and the validate gate.
**Satisfies:** R3a-8, R3a-11.
**Rationale:** zbrain maintains ~1,626 CLI tests plus dedicated browse-shim/bridge tests.
Re-testing them adds cost with no information. The information-bearing tests are the
prime-agent integration and the lifecycle wiring.

## D3a-F — Generic platform; instance concerns stay out
**Decision:** prime-claw carries no operator-specific taxonomy, values, or personal skills.
The brain repo path is configurable. Joe's personal skills and the `prime-pva` instance
repo are created at 3b, not here.
**Satisfies:** R3a-9.
**Rationale:** prime-claw = the zbrain role (generic platform). Baking one operator's
schema/config into it is the exact mistake the IA doc's two-level split forbids.

## D3a-G — Acceptance = read/query + one routed write
**Decision:** 3a is accepted when a fresh sandbox serves a cited answer from the brain
**and** lands one correctly-routed durable write (a test artifact: easily deleted, or a
keep-worthy prime-claw `projects/` stub). Write-back (git push) to the real repo is out of
scope.
**Satisfies:** R3a-3, R3a-4, R3a-6.
**Rationale:** Operator's chosen bar — thin but whole, proving both directions of the
brain loop without yet owning the full write/sync-back machinery.

## Decision → Requirement traceability matrix

| Decision | Requirements |
|----------|--------------|
| D3a-A | R3a-1, R3a-2 |
| D3a-B | R3a-1, R3a-4 |
| D3a-C | R3a-3, R3a-4, R3a-8 |
| D3a-D | R3a-7 |
| D3a-E | R3a-8, R3a-11 |
| D3a-F | R3a-9 |
| D3a-G | R3a-3, R3a-4, R3a-6 |

GATE requirements R3a-1..7, R3a-9..11 are covered by at least one decision.
(R3a-5 lifecycle integration and R3a-6 acceptance gate are realized directly by the
slice's implementation; R3a-12 embedding freshness is NICE and may defer.)
