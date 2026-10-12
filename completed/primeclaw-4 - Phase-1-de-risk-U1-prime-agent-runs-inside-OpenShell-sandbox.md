---
id: PRIMECLAW-4
title: 'Phase 1 (de-risk) U1: prime-agent runs inside OpenShell sandbox'
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:00'
labels: []
dependencies: []
priority: p0
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prove prime-agent (daemon, CWD-aware spawn, persistent REPL) can run inside an OpenShell sandbox. If the daemon assumes host affordances the sandbox forbids, the whole plan pivots. Documented go/no-go. See LONG_RANGE_PLAN.md Phase 1.

## Legacy notes

2026-09-10: Spec'd and planned. Spec trio at .ralph/plans/ (SPECIFICATION.md, REQUIREMENTS.md R-U1-1..6, DECISIONS.md). EXECUTION_PLAN.md slices 1-3 deliver U1; slice 3 includes the credential proof using this host prime-agent instance's own credentials via OpenShell providers (D11, operator-authorized config copy). OpenShell already updated: checkout e61adb3b, CLI/gateway v0.0.116.
2026-09-10 Slice 1 DONE: sandbox 'prime-claw' live (Ready), deny-by-default egress proven both directions (example.com 200 allowed; api.anthropic.com + pypi.org proxy-403 denied). R-U1-1/-2/-5 proven. Evidence: docs/derisk/evidence/phase1-sandbox-20260910T231541Z.json. Commit e67588e. Next: Slice 2 (prime-agent daemon in-sandbox).
2026-09-11 Slice 2 DONE: prime-agent 0.9.3 + Python kernel in-sandbox. R-U1-3 (daemon up, persists across exec) + R-U1-4 (persistent REPL held state across 2 turns) proven. Evidence: docs/derisk/evidence/phase1-prime-agent-20260911T005848Z.json. Commit bf9323d. Key discovery: OpenShell L7 proxy socket-resets %2F URLs (npm scoped pkgs) -> scripts/lib/npm-onload.js workaround. Next: Slice 3 (credentialed model call via OpenShell providers -> U1 verdict).
2026-09-11 Slice 3 WIP: R-U1-6 mechanism CONFIRMED (codex placeholder resolved to real OAuth cred -> OpenAI token_expired). Anthropic leg BLOCKED: api_key placeholder not rewritten at L7 (401 invalid x-api-key), reproduces across claude-code + custom anthropic-api profiles, both header styles, fresh sandbox. Codex resolves on same sandbox/revision -> per-credential anomaly, root cause TBD. Bedrock withheld by design (endpointless profile). Also found: injection uses generic env names (api_key) not SDK names (ANTHROPIC_API_KEY) -> mapping bridge needed. Evidence: docs/derisk/evidence/phase1-credentials-20260911T155045Z.json
2026-09-11 CORRECTION (D12): Slice 3 was probing the WRONG endpoints. Host inference is gateway-fronted: models.json repoints all providers to https://ai-gateway.zende.sk (/anthropic, /v1, /bedrock) sharing ONE gateway API key; default model anthropic.kimi-k3 -> gateway /anthropic. openai-codex OAuth (real api.openai.com) is the separate exception. 'Same credentials as host' = ONE provider with the gateway key + endpoint profile for ai-gateway.zende.sk, plus carry models.json baseUrl overrides into the sandbox. The earlier api.anthropic.com/api.openai.com probes and claude-code/codex profiles targeted native hosts the host never uses — that explains the anthropic anomaly. REQUIREMENTS.md R-U1-6 + DECISIONS.md D12 + EXECUTION_PLAN.md Slice 3 updated.
2026-09-11 D13/D14: (1) AI Gateway track (shared key, ai-gateway.zende.sk) is the GATE; openai-codex OAuth track (real api.openai.com) is a separate OPTIONAL/nice track, not required for verdict. (2) End solution must be CONFIGURABLE (D14/R-X-7): any Zendesk operator points their sandbox at the AI Gateway with their own key; other auth shapes (codex etc.) configurable too — parameterized config, no hardcoding. (3) Non-secret gateway config (host/paths/model IDs) may be committed; credential VALUES never committed (D14/R-X-5).
2026-09-11 BLOCKED (R-X-4): AI Gateway (ai-gateway.zende.sk) is behind istio-envoy RBAC that 403-rejects ANY request via the OpenShell L7 MITM proxy — even a credentialess GET /. Host-direct succeeds (200) same key/URL/headers, both HTTP/1.1+HTTP/2, x-api-key or Bearer, explicit :443. No mTLS required. Only differentiator = the proxy's egress identity. OpenShell has no TLS-passthrough mode (only enforce/audit) and its injection model REQUIRES L7 MITM — direct conflict with the gateway's mesh RBAC. UNBLOCK CONDITION: Zendesk platform authorizes the proxy egress to the gateway, OR operator accepts an alternative that does not violate R-X-5. Evidence: docs/derisk/evidence/phase1-credentials-blocker-20260911T171531Z.json. See .ralph/plans/blocked/.
2026-09-11 R-U1-6 PASSES (GATE track). Earlier istio-RBAC blocker was a MISDIAGNOSIS: it was a GlobalProtect VPN flap (Joe confirmed). kubectl ai-gateway-nacl ALLOWs the path; plain docker from same Mac succeeds. After VPN recovery all 4 sub-conditions pass: (a) placeholders-only env, (b) sandboxed prime-agent made real anthropic.kimi-k3 call via ANTHROPIC_API_KEY=$api_key bridge + models.json baseUrl (no auth.json), (c) no zdai_ on disk, (d) fail-closed 500 on bogus placeholder. Consumption path: runtime>auth.json>env. Evidence: docs/derisk/evidence/phase1-credentials-PASS-20260911T173411Z.json. Remaining: codify scripts/apply-phase1-providers.sh + validate-phase1-credentials.py + tests, then close.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed
<!-- SECTION:FINAL_SUMMARY:END -->
