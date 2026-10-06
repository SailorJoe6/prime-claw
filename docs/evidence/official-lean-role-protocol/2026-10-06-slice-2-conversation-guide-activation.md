# Slice 2 active-owner Conversation guide activation evidence

Date: 2026-10-06
Parent: `7107d1143330417333bfe6105b18832129d6439f`
Tracker: `prime-claw-h6w.30`

## Bounded capability

This candidate implements one complete trusted disclosure subject: the exact
active Conversation owner and its current Episode generation.

- `src/prime-agent-plugin/skills/prime-claw-oversee-episode/SKILL.md` is the sole
  356-word Conversation-judgment policy.
- Apply/check own and byte-check its exact global managed directory without
  changing the Slice 1 role-protocol manager or fixed three-file restore receipt.
- `prime_claw_activate_conversation_guide` returns the exact verified guide only
  in its tool result. A private in-memory receipt binds the session, active
  lifecycle generation, role-kernel generation, installed path/version/hash,
  tool-call ID, and exact result.
- The `context` seam consumes the issued receipt before the first continuation,
  permits that exact result once, and replaces it with a fixed omission marker
  on later calls while preserving the assistant/tool-result pair.
- `prime_claw_conversation_guide_status` is read-only. Handoff and first
  finalization fail before mutation unless the exact receipt is consumed.
  Already-inactive finalization replay remains idempotent.
- The project `oversee-episode` skill is a policy-free compatibility shim and its
  `.agents` discovery link remains valid.

Prospective future-location activation and the `create_spec_episode` guide gate
remain later Slice 2 work. This avoids blocking promotion with a receipt that has
no matching prospective identity subject. EXPERT admission, broad timing/race
matrices, cutover, landing, global mutation, restart, UAT, finalization, and
cleanup are also excluded.

## Focused proof

Commands:

```text
python3 -m pytest tests/test_oversee_episode_skill.py \
  tests/test_project_conversation_extension.py::test_canonical_managed_guide_replaces_project_policy_without_breaking_discovery \
  tests/test_project_conversation_extension.py::test_extension_uses_context_and_exact_state_without_rejected_flag_profile \
  tests/test_project_conversation_extension.py::test_current_documentation_describes_lean_default_and_transition_compatibility -q

TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest -q -m container \
  tests/test_reviewed_plan_extension.py::test_reviewed_plan_node_suite \
  tests/test_project_conversation_extension.py::test_project_conversation_node_suite \
  tests/test_conversation_oversight_native.py::test_native_managed_conversation_guide_is_disclosed_once_and_status_is_ready \
  tests/test_prime_agent_plugin_install.py::test_apply_copies_the_complete_allowlist_and_check_accepts_it \
  tests/test_prime_agent_plugin_install.py::test_apply_is_convergent_and_preserves_unrelated_files \
  tests/test_prime_agent_plugin_install.py::test_check_rejects_stale_managed_conversation_skill \
  tests/test_prime_agent_plugin_install.py::test_apply_and_check_reject_unexpected_managed_skill_entry
```

Current focused result: static contract **14 passed, 6 deselected**; Docker
capability **7 passed in 24.07s**. The final tool-error-semantics retry passed
**2 tests in 19.60s**.

## Complete validation

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-all.sh
```

Result: **PASS**.

- Tier 0: **287 passed, 172 skipped** in 45.51s.
- Docker Tier 1: **65 passed, 394 deselected** in 184.00s.
- Logs: `.test-results/20261005-231559-11158/`
- `tier0.log` SHA256: `40aad1c95915c49c4d218da2a0726150fe89befcaf6e9b7f80c4e285e9983c81`
- `tier1.log` SHA256: `268c8ac6ed2a687180010131867bbb11283934cd0c073bc690a0e9bc9e6f8b02`

The first two full-gate attempts exposed only stale test-contract fixtures added
by this candidate: the managed TypeScript inventory omitted the new metadata
module, and the new nested symlink case did not create its parent directory.
Both were corrected in tests; the unchanged production contract passed the
final complete gate.

## Pinned installed-runtime proof

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-tier1.sh --probe
```

Result: **PASS** against downloaded and checksum-verified Prime Agent **0.9.8**.
Apply/check accepted the isolated copy, and the native probe observed `handoff`,
`plan`, and `implement-spec` exactly once from the container-local extension
root. The ephemeral container was destroyed normally.

- Log: `.test-results/20261005-231559-11158/pinned-0.9.8-probe.log`
- SHA256: `5e8c52a0459737fe3b0cb18338307887cf8dc61742849ea9f5fc7fcddee1853f`

The exact-patch review will be appended before commit.

## Independent exact-patch review

Reviewer: isolated Prime Agent child `guide-candidate-reviewer`
(`sub-f9d2fd87`, `openai-codex/gpt-5.6-sol`).

Cycle 1: **BLOCK**. The reviewer verified frozen patch SHA256
`f40bb0b1e1f5ccbf88c9cbe3896171391e0fcbf9b15dfbcca20e34952c42591c`
but found that the artifact was generated with `git diff` while the metadata,
guide, and this evidence receipt were untracked. The artifact therefore omitted
three required add-file diffs even though the validated worktree contained their
correct bytes. No implementation defect or file edit was reported.

Disposition: **accepted**. Rebuild the review artifact from the same accepted
parent with explicit add-file diffs for exactly those three paths. Recompute the
guide and patch hashes, verify clean application to the parent, and use the
second/final bounded review cycle. No production bytes changed for this repair.

Cycle 2: **BLOCK**. The reviewer verified repaired patch SHA256
`3d994cd7ede7a045549f08e92e45f66420640146e8bcc0cf282e3e00d6de0a14`,
confirmed it is self-contained, reconstructed all three new files byte-for-byte,
and changed nothing. The reviewer then found a concrete disclosure-boundary
defect: validation counts only activation-named results, while later filtering
authorizes every guide-bearing result sharing the allowed tool-call ID. A valid
bound result plus a same-ID/different-name duplicate result can therefore expose
the guide twice instead of aborting.

The violated invariant, root-cause seam, and bounded repair are clear: before
consumption, require the issued ID to occur exactly once across all assistant
calls and all tool results, and authorize the one exact validated result record
rather than every record sharing the ID. Required focused tests cover
same-ID/different-name result and assistant-call aliases, invalidation before
dispatch, retained valid one-time disclosure, later omission, and pairing.

Disposition: **implementation paused without repair**. This is the second
repair/review cycle. The specification and execution plan forbid a third
automatic repair and require operator scope/architecture consultation. The
candidate remains uncommitted and unpushed at the accepted parent.

## Owner-authorized duplicate-ID repair

After the two-cycle stop, the owner independently accepted the cycle-2 finding
and authorized one exact in-contract repair without a third independent review.
The repaired disclosure seam now counts the issued ID across every assistant
`toolCall` item and every `toolResult` message before consumption, regardless of
claimed tool name. It accepts only one call and one result, requires both to name
`prime_claw_activate_conversation_guide`, requires the exact bound result text
and exact two-field version/hash details, and authorizes only that validated
result object. Any same-ID alias deletes the issued receipt and aborts provider
dispatch.

Focused regressions cover a same-ID/different-name assistant call and a
same-ID/different-name tool result containing the copied guide. Both abort and
leave readiness false. Existing proof retains the valid paired continuation,
one-time disclosure, later omission, guide-copy filtering, and malformed-details
failure.

### Post-repair validation

Focused Docker command:

```text
TIER1_ENV_FILE=<pinned-0.9.8-env> python3 -m pytest \
  tests/test_reviewed_plan_extension.py \
  tests/test_project_conversation_extension.py \
  tests/test_conversation_oversight_native.py \
  -q -m container -p no:cacheprovider
```

Result: **17 passed, 17 deselected** in 103.77s.

- Log: `.test-results/20261006-070101-29790/focused-duplicate-id.log`
- SHA256: `f8c8669bc74938aaa26fd263605de8266d9e299ede51e5d899a0fc5f877db9e2`

Complete command: `TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-all.sh`.
Result: **PASS**.

- Tier 0: **287 passed, 172 skipped** in 43.90s.
- Docker Tier 1: **65 passed, 394 deselected** in 187.68s.
- Logs: `.test-results/20261006-070101-29790/`
- `tier0.log` SHA256: `d9d5246c10e3ef326907f7e637f515eeb619e19516fb486c09f1d0cea98cdd44`
- `tier1.log` SHA256: `57d76a5e8b6a8e31b3d405250c9dfe63fe10d406f3f92d2210d2e84218587bb0`

Pinned command: `TIER1_ENV_FILE=<pinned-0.9.8-env> scripts/test-tier1.sh --probe`.
Result: **PASS** against downloaded and checksum-verified Prime Agent **0.9.8**;
apply/check and the container RPC probe completed and the container was removed.

- Log: `.test-results/20261006-070101-29790/pinned-0.9.8-probe.log`
- SHA256: `51b2e08fb4c99c733f25998f5c0cdb2e7dd6ad412b8eb13fd5be9b62ccaebeb1`

The managed guide remains unchanged at SHA256
`23ada4c2dff653dda3f6291c293f09dcc9c83d409f75404a665186e1dacfb563`. The accepted duplicate-ID finding is resolved. Per the owner's
explicit disposition, no third independent/adversarial review ran and no other
finding was accepted. Prospective activation/create gating, EXPERT admission,
later Slice 2 work, Slice 3, landing, user-global mutation, restart, UAT,
finalization, and cleanup remain deferred.
