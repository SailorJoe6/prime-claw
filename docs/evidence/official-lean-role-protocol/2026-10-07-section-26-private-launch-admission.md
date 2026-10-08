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
  state, require the raw marker worktree to be absolute and byte-equal to its
  strict real path, require raw Git toplevel output to equal that same canonical
  string before normalization, prove the exact lowercase 40/64-hex HEAD, require
  one exact model discovery result, create mode-private untracked `PENDING`, and
  call public `rlm.spawn`
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

The review child made no edits. This remains the sole independent review cycle;
no second independent review was launched.

## Owner-review canonical-worktree repair

Owner review BLOCKED pushed candidate
`f15457d82c3c9e3760272e71600eefbaf4809b17` because the new Python launch path
resolved the marker worktree and Git toplevel before comparing them. That lost
the accepted Section 24 repository-subject contract at
`5674219bc914682a7e28c96146a68ab1b3e80f5f`: a dot-segment or symlink spelling
could alias the canonical worktree and pass.

The bounded repair validates the raw marker string before any launch mutation:
it must be absolute and exactly equal to its strict real path. Git's raw
toplevel line must then equal that same canonical string before any path
normalization. Existing lowercase 40/64-hex HEAD validation remains unchanged.
Focused regressions cover dot-segment, symlink, and nested/non-root marker paths;
each proves failure before model discovery, private-state creation, or spawn.
The private launch/admission architecture and accepted `[custom, user]` history
filtering are otherwise unchanged.

Final owner-revision evidence:

- Focused Node and Python command: **52 Node passed**; **19 Python passed, 10
  deselected**.
- Full Tier 0: **295 passed, 184 skipped** in 52.27 seconds. Log SHA256:
  `04e0042f23dda75db9ef52a7f5a555dfc6b86cb999e39d2d666cba4fa8eebc5a`.
- Full Docker Tier 1: **77 passed, 402 deselected** in 165.58 seconds. Log
  SHA256: `3e87db61ca4ef65dfd653d42c0b81e28a73a70468832e37d73067d3b90eb3687`.
- Pinned `scripts/test-tier1.sh --probe`: **OK** on Prime Agent **0.9.8**.
  It built the image, installed the exact release, applied and checked the
  plugin, passed unique RPC command publication, and destroyed the container.
  Log SHA256:
  `c82f10e16e19f5cec155f7403e0f7aae05317c23c57de9db6aefde7d5dad36d2`.

No additional independent review or broader repair was performed.

## Deferred boundaries

This candidate does not implement review report return/settlement, owner
PASS/BLOCK disposition, child deletion, cleanup, Slice 4, landing, user-global
apply/restart/UAT, or finalization. It makes no Prime Agent source change.
