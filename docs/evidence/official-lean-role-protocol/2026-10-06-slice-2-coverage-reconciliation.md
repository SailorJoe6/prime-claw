# Slice 2 route coverage reconciliation — 2026-10-06

## Boundary and accepted base

Accepted base: `29b8932e3e576d0068194e44a5494af98474d8bf` / tree
`a5a16cacce0fad56f546a565475cefe519761b0a`.

This final Slice 2 pass changes tests and documentation only. Production code,
the managed Conversation guide, the canonical `execute` skill, installer, and
fixed Slice 1 receipt are unchanged. Routes are grouped by the common
`context` event in `conversation-oversight.ts`: that one seam filters historical
private messages, applies single-use guide disclosure/redaction, classifies
trusted role/lifecycle state, validates the final assembled system prompt, and
aborts managed defects before provider dispatch.

## Route-to-proof map

| Equivalence class | Section 7 routes | Representative proof |
|---|---|---|
| Fresh provider turns | normal direct, idle custom trigger, injected heartbeat, direct-idle agent message, busy queued agent message, queued follow-up, cancellation, tool loop | `test_native_run_paths_and_real_child_precedence` tags each route in provider captures, requires one kernel and clean channels on every parent call, proves a cleared queued message never dispatches, and observes the tool result continuation. |
| Retry and one-time guide disclosure | retry, activation tool loop, first continuation, later omission | `test_native_managed_conversation_guide_is_disclosed_once_and_status_is_ready` exposes the guide once, makes that provider call fail transiently, and proves the real retry and later status continuation see only the paired redacted result. It correlates assistant call/result ID `activate-guide`, asserts zero private receipt fields, and keeps system/user/custom channels clean. |
| Reconstructed continuation | compaction, resume, reload, recovered queue, restart | `test_native_auto_compaction_restores_first_real_active_call` covers post-compaction dispatch; `test_native_run_paths_and_real_child_precedence` snapshots, clears, restores, and dispatches one recovered queue action; `test_installed_discovery_real_implement_spec_activation_resume_and_absence` covers real session resume, marker recovery, legacy migration, `/reload`, and a later clean resumed call; `test_installed_inactive_generation_allows_later_cycle_and_is_inert` covers restart/inactive replay. |
| Prompt assembly | project SYSTEM/APPEND, global/project AGENTS/CLAUDE, CLI `--no-context-files`, SDK override | `test_native_selected_global_context_survives_project_prompt_and_context_shadows` uses lowest-priority global `CLAUDE.MD` plus project SYSTEM, APPEND, selected AGENTS, and unselected CLAUDE in one provider call and sees exactly one kernel. `test_role_protocol_manager_matrix` proves all four global filename priorities. Installed discovery proves malformed/token-only/duplicate project AGENTS, CLI no-context, and CLI append shadows abort before provider/mutation. `test_native_sdk_system_prompt_override_preserves_or_blocks_managed_kernel` proves a preserving SDK override dispatches cleanly and a replacing override with an active marker yields zero provider calls. |
| Managed negative authority | promotion, active owner, EPISODE, generic child, copied text, CWD/branch/depth claims | Node role/classifier tables use trusted marker, bounded identity, owner session, and stable binding only. Native unclassifiable/corrupt lifecycle tests produce zero provider rows and zero recovery/daemon mutation. Ordinary explicit no-context remains usable. |
| Guide/private channel filtering | historical package, bounded identity, guide body, receipt fields | Shared `assert_provider_context_clean` now rejects the role kernel or guide in user/custom channels, guide in system, legacy package, retired work-control overlay, and bounded identity in system/user/custom. The guide retry proof permits the exact guide only in its intended tool result, then checks redaction and zero private receipt keys. |
| Lifecycle readiness | prospective create, owner handoff, first finalize, inactive finalize replay | Node tests prove consumed exact subject before mutation, one-time create, active-owner handoff/finalize gates, and exact already-inactive idempotence. The native read-only status call reports ready without transport. |
| Discovery and compatibility | lean guide, project shim/link, selected install generation | Guide word/hash tests, shim/link discovery tests, and apply/check allowlist/generation tests cover the remaining Section 7 resources without another provider-route matrix. |

The global spelling variants and the ingress methods are deliberately not crossed
with every role and lifecycle state. Once Prime Agent assembles a system prompt
or dispatches a turn, the plugin receives the same tested `context` contract.
Distinct tests remain only for different restoration, loader override, and
receipt-consumption boundaries.

## Section 7 acceptance result

- Every representative managed provider call contains exactly one canonical
  neutral kernel. Malformed/missing managed state aborts with zero provider call.
- Ordinary explicit no-context remains usable; promotion, active-owner, EPISODE,
  and prospective lifecycle actions fail before mutation when authority is absent.
- The exact guide is visible in one intended tool result only. A transient
  provider failure does not replay it; retry and later calls retain pairing with
  an omitted body and no details.
- Provider system/user/custom channels contain no guide, private bounded
  identity, receipt fields, historical oversight package, or retired overlay.
- Read-only readiness and the handoff/finalize/create gates are covered without
  invoking live owner transport.
- Generic child, EPISODE, copied prompt/body, CWD/branch/depth, foreign owner,
  and stable-binding mismatch cases cannot manufacture owner authority.
- The project `oversee-episode` entry remains a policy-free shim with a valid
  discovery link. The managed guide and canonical `execute` source are unchanged.

## Focused validation

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest -q -m container \
  -p no:cacheprovider tests/test_conversation_oversight_native.py
```

Result: **5 passed** in 96.51s.

- Log: `.test-results/20261006-081711-slice2-coverage/focused-native.log`
- SHA256: `48e96061c5e8ba4ee22d96d9d7ada016cdd24c39396a1ff20dbd26b5c85d2218`

```text
python3 -m pytest -q -m "not container" -p no:cacheprovider \
  tests/test_project_conversation_extension.py \
  tests/test_reviewed_plan_extension.py \
  tests/test_oversee_episode_skill.py \
  tests/test_managed_session_protocol.py \
  tests/test_prime_agent_role_protocol_install.py
```

Result: **27 passed, 25 deselected**.

- Log: `.test-results/20261006-081711-slice2-coverage/focused-static-node.log`
- SHA256: `c3ca4f18b67006fb88ccf7663e3782ae438a41e928e318e18845fccd785ead11`

Complete Tier 0, Docker Tier 1, and pinned-runtime evidence is appended only
after those gates pass. No independent exact-patch review is required because
this candidate contains no production-code change.


## Complete validation and Slice 2 disposition

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-all.sh
```

Result: **PASS**.

- Tier 0: **287 passed, 174 skipped** in 45.17s.
- Docker Tier 1: **67 passed, 394 deselected** in 255.36s.
- Logs: `.test-results/20261006-081818-53920/`
- `tier0.log` SHA256: `d86968ba8b9f6960562d65366dd5d02af37875b523a2f49a2238f981fb7e348c`
- `tier1.log` SHA256: `2f7ed32dfc1dbfc7718d19a829263b5d1b86aabeea5bbb2daa35b89273b62582`

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-tier1.sh --probe
```

Result: **PASS** against downloaded and checksum-verified Prime Agent **0.9.8**.
Apply/check accepted the isolated plugin copy; the native RPC probe observed
`handoff`, `plan`, and `implement-spec` exactly once from the container-local
extension root; the ephemeral container was removed.

- Log: `.test-results/20261006-081818-53920/pinned-0.9.8-probe.log`
- SHA256: `790a1581f0ddcb6fc8ec5a7c7729884557561c66a4cae74ed262de84d365cb2f`

`git diff --check` passed. The managed guide SHA256 remains
`23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563` and canonical `execute` SHA256 remains
`7c720c8c949775b3b705a0f879ad9c754792839967ca4df702825b780bb17e6d`. No production path changed. Under the owner-approved
coverage-pass rule, focused provider evidence plus complete gates are sufficient;
no independent exact-patch review was requested for this test/docs-only candidate.

All approved Section 7 routes and acceptance bullets are now mapped to direct or
representative evidence. **Slice 2 is complete.** Official EXPERT admission and
Slice 3 remain deferred. No landing, user-global apply, restart, UAT,
finalization, or cleanup occurred.
