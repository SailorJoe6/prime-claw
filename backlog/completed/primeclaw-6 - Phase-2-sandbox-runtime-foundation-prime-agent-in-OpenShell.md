---
id: PRIMECLAW-6
title: 'Phase 2: sandbox runtime foundation (prime-agent in OpenShell)'
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
updated_date: '2026-10-12 01:02'
labels: []
dependencies:
  - PRIMECLAW-1
  - PRIMECLAW-4
  - PRIMECLAW-5
priority: p1
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stand up the prime-claw container: OpenShell sandbox (deny-by-default egress, no host socket/home/net/PID/IPC), prime-agent daemon inside owning $HOME, L7 credential injection, apply/check/validate/test tooling + requirements-inventory traceability. Blueprint: nemo-setup/openclaw-setup. Done when a prime-agent daemon runs healthily, secured, reproducible.

## Legacy notes

2026-09-11 Slice 1 DONE: bin/prime-claw CLI (status live; create/converge/build/validate/recover/destroy stubbed). status = read-only actual-vs-expected via openshell --output json (gateway pins openshell/flags nemoclaw, sandbox phase+policy rev, provider attached, PG/gbrain/daemon probes; model deferred to validate; image recorded-at-create in config/runtime.json). docs/runbook.md stub. 18 new tests; suite 70/70. Next: Slice 2 image stage.
2026-09-11 Slice 2 DONE: bin/prime-claw build + docker/runtime.Dockerfile. Idempotent (input fingerprint + stamp, --force override), prefers real /templates (git-history fallback). Staging real-path smoke-verified on ~/zbrain; build offline-tested. Suite 80/80. Inventory R2-B-1 met, R2-X-5 in-progress. Next: Slice 3 create+converge (the core; splits 3a/3b if too big).
2026-09-11 Slice 3a DONE: bin/prime-claw create + idempotent runtime stages (policy/provider/sandbox-at-create/prime-agent/brain/spawn) migrated from apply-phase1-*.sh. Provider attached at CREATE; key read in-process only. Suite 93/93. Inventory R2-B-2..5 + R2-X-1 met. Next: Slice 3b = converge + policy consolidation (phase1-sandbox.yaml -> runtime.yaml).
2026-09-11 Slice 3b DONE: bin/prime-claw converge (re-run all stages on existing sandbox, no needless recreate; errors->create if absent; fail-fast). Policy consolidation phase1-sandbox.yaml->runtime.yaml DEFERRED to Slice 6 (Phase 1 tests reference old path). Suite 98/98. Slice 3 complete. Next: Slice 4 validate + version recording (the acceptance gate).
2026-09-11 Slice 4 DONE: bin/prime-claw validate (single green/red acceptance gate, consolidated from validate-phase1-*.py). Live PASS on all 15 checks (real model call via kimi-k3, deny-by-default egress, daemon, REPL, brain+embedding dims=1536, spawn/reap RPC). Version recording -> docs/evidence/validate-<utc>.json (openshell 0.0.116/prime-agent 0.9.3/gbrain 0.49.0/PG 16.15/pgvector 0.6). Two real fixes: deny-probe moved off pypi.org (now a DECLARED endpoint); credentialed call pinned --model (default claude-opus-4-7 disabled -> 404). Suite 105/105. Inventory R2-C-2/R2-C-3/R2-X-5 met. Next: Slice 5 recover + runbook (vpn-flap, gateway-flip, recreate-wipe, cold-daemon, drift).
2026-09-11 Slice 5 DONE: bin/prime-claw recover + docs/runbook.md. LIVE degrade-and-recover proven (cold-daemon -> detect -> recover -> validate PASS; docs/evidence/recover-*.json). Found+fixed 5 real bugs: provider idempotency (import only when provider absent), kernel-bootstrap via node-file, daemon-ensure + stale daemon.sock.lock cleanup, live-daemon detection, stage_prime_agent return 0. Suite 118/118. Inventory R2-C-3/4/5 met. Next: Slice 6 (destroy + retire *-phase1-* scripts + consolidate policy -> policies/runtime.yaml + close-out).
2026-09-11 Slice 6a DONE (commit 600600d): bin/prime-claw destroy (confirm-gated, idempotent, --image opt-in) + Phase 1 consolidation. Retired apply/check/validate-phase1-* + test_phase1_* + phase1-brain.Dockerfile to scripts/archive/phase1/; consolidated policies/phase1-sandbox.yaml -> policies/runtime.yaml; added tests/test_inventory_integrity.py (re-gates 72 proven_by paths); documented R2-X-6 host-PG constraint. Suite 75/75. Live status healthy. NEXT: Slice 6b close-out (archive Phase 2 plan set to .ralph/plans/archive/phase2-runtime/, update archive README, close this bead; unblocks prime-claw-zwg Phase 3).
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Phase 2 sandbox runtime foundation COMPLETE (2026-09-11). Built bin/prime-claw lifecycle (status/build/create/converge/validate/recover/destroy) over native OpenShell primitives; live degrade-and-recover proven (docs/evidence/recover-20260911T221546Z.json). Reference: docs/sandbox-runtime.md; operations: docs/runbook.md. Final commits: 600600d (Slice 6a destroy+consolidation), 1125694 (Slice 6b close-out). Plan set archived to .ralph/plans/archive/phase2-runtime/. Unblocks prime-claw-zwg (Phase 3).
<!-- SECTION:FINAL_SUMMARY:END -->
