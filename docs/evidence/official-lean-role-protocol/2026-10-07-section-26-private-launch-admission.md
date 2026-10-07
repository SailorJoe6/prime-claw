# Section 26 private launch and first-call admission

## Scope

This candidate supersedes only the terminal disposition of Section 25. Commit
`3586dcc0cb02f314e7c50f661d956f794637f17c` remains the accurate audit history
for the unsupported inbound-sender design. The replacement gives inbound
message text, headers, sender, target, and internal `agent_message` details zero
authority and never reads the internal details shape.

## Implemented vertical

- Retired the native caller-supplied reserve/bind/status/cancel tools.
- Extended `prime_claw_official_expert_review.launch(packet)` to derive the
  depth-0 owner and active episode generation from host-authored public session
  state, prove the exact marker worktree/HEAD, require one exact model discovery
  result, create mode-private untracked `PENDING`, and call public `rlm.spawn`
  with explicit selector/thinking and an unpredictable harmless bootstrap.
- Finalization uses only the actual returned child id/name/session directory/model;
  definite failures revoke pending state. Returned reasoning is not claimed.
- Added the narrow filesystem transitions `PENDING -> FINALIZED -> CLAIMED`
  with random nonce, fixed 15-minute TTL, owner/project/session/generation,
  candidate, canonical packet/digest, package, kernel, selector, and spawn-return
  bindings. No cross-session module cache, general database, journal, power-loss
  protocol, or hostile-extension defense was added.
- Added child `before_agent_start` and `context` admission. The extension locates
  state only through the actual unpredictable session name, waits boundedly for
  finalization, validates public canonical child session directory/id/name/file,
  current model, `header.parentSession`, canonical parent header ID, owner
  generation, candidate, packet, package, kernel, and expiry, then claims before
  provider dispatch.
- Provider-visible history is rebuilt as exactly one canonical rubric-plus-packet
  user turn plus response/tool continuation. Bootstrap, inbound/custom content,
  and private fields are excluded. Every continuation rechecks model/bindings.
  Refusal explicitly calls `ctx.abort()`; generic children remain ordinary.

## Focused evidence

- Node extension suite: **52 passed**. It covers successful claim/canonical
  provider context, generic-child pass-through, retired caller tools, timeout,
  stale state, wrong child/name/path/parent/generation/model/package/kernel/
  packet/candidate, duplicate claim, and replay. Every refusal asserts explicit
  abort and zero simulated provider calls.
- Python package/static suite plus reviewed-plan bridge: **16 passed, 8
  deselected**. It covers exact model discovery, pending-before-spawn ordering,
  actual-return finalization, private modes, ambiguous discovery before mutation,
  and definite-failure revocation.
- Exact-interpreter source preflight: `SYNC_PENDING` with expected package SHA256
  `fc7017fc002ed9cb21c1f7a374db55ca5440a3731f6a63699a8712c859db4600`.

## Full gates and review

The one allowed independent exact review returned **BLOCK** on one actionable
Prime Agent 0.9.8 compatibility defect: the initial public provider history is
`custom` harness digest plus one `user` bootstrap, while the candidate counted
every non-response origin and therefore denied every valid launch. The single
bounded repair now counts only public `user` turn boundaries and filters all
custom/control history without reading content or details. The repair's native
provider seam also showed that `ctx.getSystemPrompt()` exposes the session base,
not the effective per-turn `before_agent_start` override. Admission now binds
the record to the compiled kernel hash, while the native provider observation
proves the effective provider system prompt is the exact neutral kernel.

Post-repair evidence:

- Node extension suite: **52 passed**. The success case contains the real-shaped
  custom harness-digest plus one user bootstrap; the paired second-user replay
  explicitly aborts.
- Focused Python/static suite: **16 passed, 8 deselected**.
- Isolated native Prime Agent 0.9.8 provider seam: **1 passed**. It observes the
  real `[custom, user]` pre-admission history, exactly one canonical provider
  user turn and exact neutral kernel on success, a claimed private state, and
  zero provider calls for model mismatch and finalization timeout.
- Full Tier 0 raw run: **397 passed, 2 failed, 76 deselected**. Both failures are
  the pre-existing unrelated sandbox-converge cases
  `test_create_runs_stages_in_order` and
  `test_converge_runs_all_stages_no_recreate`, where the external `brain-query`
  stage reported the `prime-claw` sandbox in `Error` rather than `Ready`.
- Full Tier 0 with only those two known unrelated cases deselected: **397 passed,
  79 deselected**.
- Full Docker Tier 1: **77 passed, 399 deselected**.
- Pinned `scripts/test-tier1.sh --probe`: **OK** on Prime Agent **0.9.8**; the image built, the exact release installed, plugin apply/check completed, command publication was unique, the RPC probe passed, and the container was destroyed.

The review child made no edits. This is the sole review cycle and sole bounded
repair allowed by Section 26.

## Deferred boundaries

This candidate does not implement review report return/settlement, owner
PASS/BLOCK disposition, child deletion, cleanup, Slice 4, landing, user-global
apply/restart/UAT, or finalization. It makes no Prime Agent source change.
