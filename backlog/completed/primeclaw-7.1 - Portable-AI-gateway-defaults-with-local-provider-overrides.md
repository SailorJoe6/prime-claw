---
id: PRIMECLAW-7.1
title: Portable AI-gateway defaults with local provider overrides
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-7
priority: p1
type: task
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Requirement change from operator (2026-09-17): repository defaults must work for an average user with no DGX Spark and no pre-existing preferred provider config. Default inference must use Zendesk AI Gateway with anthropic.kimi-k3 (GLM remains an allowed alternative). Default embeddings must use the previously proven Zendesk AI Gateway OpenAI path: openai:text-embedding-3-large at 1536 dimensions. Explicit user/host/local config may override inference and embeddings independently; Joe's DGX Qwen/4096 profile remains an optional local override, never a tracked default. Preserve credential isolation and single-vector-space freshness. Update runtime defaults, profile selection/precedence, policy/provider lifecycle, tests, docs, inventory, and migration behavior without exposing private endpoints.

## Legacy notes

2026-09-17 planning/design handoff prepared. Added D3a-M and R3a-15; revised R3a-12/13/14; added Slice 4P; updated blocked spec/plan, long-range plan, inventory, runtime/home-embedding/runbook/index docs. Chosen portable defaults are `anthropic.kimi-k3` inference and `openai:text-embedding-3-large`/1536 embeddings via Zendesk AI Gateway. `anthropic.glm-5.2` remains supported. Explicit user config must override inference/embeddings independently. Current `config/runtime.json` / `bin/prime-claw` implementation is intentionally not yet changed; this bead remains ready for that bounded implementation. Canonical suite: `pytest -q tests` => 150 passed. Bare `pytest` also collects retired `scripts/archive/phase1/tests` and fails on intentionally moved archive paths; not a product regression. No Spark work resumed.
2026-09-17 late independent-review corrections applied: active S4P plan/spec moved back to `.ralph/plans/`; parent Phase 3a set in_progress; generic S4B is explicitly unblocked after S4P on the gateway profile and no longer depends on optional DGX/Qwen; inventory credential/priority/path traceability corrected; historical Slice 2/3 proofs scoped to gateway-profile and explicit-Codex-override branches; runtime/runbook Codex provider wording marked pre-S4P/conditional. Optional Qwen validation alone remains blocked. Canonical suite remains 150 passed; inventory gate 2 passed; diff check clean.
Slice 4P COMPLETE in commit 5c60b65. Portable no-config defaults are Kimi (`anthropic.kimi-k3`) inference plus Zendesk AI-gateway `openai:text-embedding-3-large`/1536 embeddings. One resolver now drives independent env/local/valid-host precedence, provider lifecycle, attachments, Prime Agent config, least-privilege policy, index settings, status, and validate. Codex is explicit-only. Home-Qwen stays isolated and fail-closed until accepted. Populated embedding state must exactly match config/model/dims/freshness before config write/migrate/sync. Home candidate validation temporarily applies candidate egress, uses candidate GBRAIN_HOME/DB, and guarantees canonical policy restoration. Independent diff review found no unresolved high issue. Evidence: docs/derisk/3a-slice4p.md and docs/evidence/portable-defaults-20260917T184315Z.json. Tests: 27 focused; canonical pytest -q tests = 177 passed; inventory 2 passed; hermetic create dry-run PASS; diff check clean. No live sandbox/database/network/Qwen work occurred. Generic gateway-profile Slice 4B is next.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 With no operator-local or host-preferred config, dry-run/create/converge select Zendesk AI Gateway for both inference and embeddings, inference model anthropic.kimi-k3, embedding model openai:text-embedding-3-large at 1536 dimensions.
- [ ] #2 GLM remains a supported gateway inference alternative.
- [ ] #3 Explicit user config overrides each concern independently.
- [ ] #4 No private DGX endpoint or Codex OAuth is required by defaults.
- [ ] #5 Optional home-Qwen profile remains credential-safe and non-destructive.
- [ ] #6 Offline tests prove precedence and prevent Qwen/Codex from becoming tracked defaults.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Slice 4P portable defaults implemented, documented, independently reviewed, and proven by 177 offline tests plus hermetic create dry-run; commit 5c60b65.
<!-- SECTION:FINAL_SUMMARY:END -->
