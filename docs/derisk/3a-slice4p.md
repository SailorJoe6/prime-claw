# Phase 3a Slice 4P — portable provider defaults

**Verdict: COMPLETE (offline implementation gate)**  
**Captured:** 2026-09-17  
**Requirements:** R3a-5, R3a-7, R3a-12, R3a-13, R3a-15

## Capability delivered

A fresh clone with no usable host/operator preference now resolves:

- inference to Zendesk AI Gateway `anthropic.kimi-k3`;
- embeddings to Zendesk AI Gateway `openai:text-embedding-3-large` at 1536 dimensions;
- required OpenShell providers to AI gateway + GitHub, with no Codex OAuth dependency.

GLM remains available as `anthropic.glm-5.2`. Valid host settings/models, operator-local
configuration, and environment configuration override inference and embeddings independently.
Joe's home-Qwen profile remains an explicit, isolated option and is never an automatic fallback.

## Safety and lifecycle result

`bin/prime-claw` uses one profile resolver for lifecycle stages, provider attachments,
Prime Agent config, effective policy, index settings, status, and validation.

- Codex OAuth is read, staged, and permitted only when Codex inference is explicitly selected.
- Effective policies remove unused credentialed routes and scope gateway binaries to the selected
  concern.
- A selected home-Qwen profile fails closed before ordinary `create`/`converge` can touch the
  canonical vector space until Slice 4A acceptance/cutover completes.
- Existing embedding-config or populated vector-width mismatches stop before config mutation,
  schema migration, or sync and require the documented parallel rebuild/cutover.
- Validation checks the selected model/database/dimensions and rejects NULL, mixed, stale, or
  out-of-bookmark vectors across the complete `brain` source. Home validation temporarily applies
  candidate egress, uses candidate `GBRAIN_HOME`, and always restores canonical policy.

## Evidence

Machine-readable evidence:
[`portable-defaults-20260917T184315Z.json`](../evidence/portable-defaults-20260917T184315Z.json).

Acceptance commands:

```text
pytest -q tests/test_portable_provider_defaults.py
# 27 passed

pytest -q tests
# 177 passed

bin/prime-claw --config <temporary-hermetic-runtime.json> --dry-run create
# exit 0; Kimi + gateway OpenAI/1536; gateway + GitHub providers; no Codex stage
```

No network, live sandbox, database mutation, credential read, or Qwen build occurred in this
slice. Generic live routed-write/push acceptance remains Slice 4B.
