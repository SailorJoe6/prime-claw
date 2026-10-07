# Section 24 official EXPERT repository-subject repair — 2026-10-07

## Disposition

Candidate `038d1cbaeb5f00614c4b4f40784cdb9119e72862` was pushed but not accepted.
The reservation derived `repositoryPath` and HEAD from owning Conversation
`ctx.cwd`. That is not the official review subject. This repair changes only
that seam.

## Repaired contract

`prime_claw_reserve_expert_review` now obtains `marker.worktree` from the exact
active-owner result. Before any reservation mutation it:

1. resolves the trusted marker value and requires its real path to exist;
2. rejects when the marker path is not already the canonical real path;
3. runs `git -C <canonical-marker-worktree> rev-parse --show-toplevel` and
   requires that top-level's real path to equal the same canonical worktree;
4. resolves HEAD only with `git -C <canonical-marker-worktree> rev-parse HEAD`;
5. requires HEAD to be exact lowercase 40- or 64-hex; and
6. requires HEAD to equal the caller's requested exact candidate OID.

The record stores only that canonical episode worktree path and exact OID. The
tool schema accepts no repository path. Owner `ctx.cwd`, branch, session name,
and prompt text are not repository-subject inputs.

The exact owner-generation digest, consumed Conversation-guide gate, fresh
package `AVAILABLE` gate, random nonce, fixed TTL, one `bound-pending`
caller-supplied-unverified/`authority: false` tuple transition, read-only status,
idempotent cancellation/expiry/session boundaries, and same-session episode
A-to-B isolation are unchanged. No live spawn, delivery, child admission,
review/report workflow, Slice 4, host activation, finalization, or cleanup was
added.

## Topology regression

The Node regression creates two distinct real Git repositories: the owner
Conversation CWD and the active marker episode worktree. Their HEADs differ. It
proves:

- owner-CWD HEAD is refused;
- a stale/wrong marker-worktree HEAD is refused;
- the exact marker-worktree HEAD reserves and stores that canonical worktree;
- a missing marker worktree is refused;
- a raw marker worktree containing a lexical dot segment is refused;
- a marker worktree path that is a symlink/noncanonical path is refused;
- a canonical directory below another Git top-level is refused; and
- every refusal occurs before nonce generation or reservation state mutation.

The existing same-session A-to-B test continues to prove generation isolation.

## Validation

Focused host command:

```text
node --test tests/reviewed_plan_extension.test.mjs
python3 -m pytest -q -p no:cacheprovider \
  tests/test_official_expert_review_skill.py \
  tests/test_prime_agent_plugin_install.py \
  tests/test_reviewed_plan_extension.py \
  tests/test_official_expert_review_runtime.py
```

Result: **46 Node passed**; **17 Python passed, 49 skipped**.
Log SHA256: `193b86dceb800ef53c7befb0e987a300173fd7c19b211f62d44b555108d5faf5`.

Focused Docker result: **43 passed, 1 deselected**.
Log SHA256: `98c29db507f12059054b6ee75393a3068d28ffaabe131566bbdabb95bdd18e98`.

Complete Tier 0 result: **292 passed, 183 skipped**.
Log SHA256: `02854fba6e6b3e99c4131c07ad5ad3762711febf672e2e5bff0cab85c04e10cb`.

Complete Docker Tier 1 result: **76 passed, 399 deselected**.
Log SHA256: `ae7bbb98d6351becd2775116a626324feef785b61dfe3fe1113fd9a8c1b5e435`.

Pinned `scripts/test-tier1.sh --probe` result: **PASS** against the
downloaded/checksum-verified Prime Agent **0.9.8**. The expected inert package
remained `SYNC_PENDING`, native RPC found `handoff`, `plan`, and
`implement-spec` exactly once, and the container was destroyed.
Log SHA256: `4acef9ec21e7305d50d7d34869d9cecc4e11a0954b53be429b430a4bcb5da0a2`.

The first bounded independent review found that `resolve(marker.worktree)`
erased lexical dot/relative/trailing syntax before comparison. The repair now
requires the raw marker worktree string to be absolute and byte-equal to its
real path, requires raw Git top-level output to equal that canonical string,
and includes the dot-segment no-mutation regression above. Every focused,
complete, Docker, and pinned gate was rerun after this repair.

The exact frozen Git patch must receive bounded independent `PASS` before it is
committed unchanged. The review artifact, frozen patch SHA256, commit, and push
verification are recorded durably on `prime-claw-h6w.30`; they do not alter this
validated implementation.
