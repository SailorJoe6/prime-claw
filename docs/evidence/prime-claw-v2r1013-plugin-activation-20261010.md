# v2r1013 container-local Prime Claw plugin activation — 2026-10-10

## Decision and preservation boundary

Joe approved installation and live activation in the accepted **working copy**
`prime-claw-v2r1013` only. The original v2 (`Error`), verified pre-recovery
checkpoint, separate working volume, and v1 fallback were retained. Immediately
before staging, OpenShell reported the exact replacement ID
`d692aa3e-86cf-4c7f-a461-71bed3b934b1` as `Ready`; the original ID
`f38cb82b-140d-4cc0-b1b0-a4a6871c82aa` remained `Error`. The original,
checkpoint, and working Docker volumes all existed. The accepted effective
policy matched canonical SHA-256 `d8f7b3b4ade2000aa060534c677fa7c754674372009f534727b1808a2ae9a0c6`. The immutable image ID
remained `sha256:c98889ce82f12f75aa44a15ea9699d8303ec170856cba2b233c40ecb7c5bf4ce`.

The primary `main` implementation commit `04d5a3cebeefd152f0a1f534e12ddc8dd74f84f4`
was pushed before staging. The guarded deployer checked the exact Ready ID,
image/tag, the three mounts from `pc-v2-20261010-state-codex-work-20261010`,
read-only Prime Agent source, full accepted policy digest, and mounted-home
links. It used no host-global apply/check, source rebuild, `recover`, `converge`,
`validate`, brain/index write, or credential copy. `/sandbox/.prime/agent`
was mounted; `/sandbox/.agents` remained image-owned, so this explicit step
must be repeated on any future replacement container.

## Tests and preimages

- Pinned TypeScript `cwd-fix-v0.9.8-r1` Docker tier 1 with offline RPC probe:
  passed. Host-safe suite: **727 passed, 1 skipped, 75 subtests passed**.
- Scoped Docker suite: **63 passed, 1 skipped**. One *separate* synthetic
  source-generation fixture fails before its test: its deliberately minimal
  package lacks the prep-kernel `compact` skill searched unconditionally by
  the tier-1 fixture. The isolated plugin install, bundle extraction, private
  fresh-final receipt, forged-receipt rejection, genuine restore, fresh
  reapply, and checker passed in Docker. Follow-up bead: `prime-claw-pai`.
- Independent read-only review accepted the sandbox-scope, full-policy-digest,
  role-ownership, and receipt boundaries after fixes.
- Before staging, the installed plugin `extensions/` and `skills/` directories,
  managed global context/role manifest, global assets manifest, and shared
  `goals-and-heartbeats` skill were absent. An ignored mode-0600 preimage
  inventory remains in `.test-results/plugin-v2r1013-ulcg1xss/` locally.
- Read-only PostgreSQL baselines: `gbrain` 1,059 pages/3,031 populated chunks,
  1,536 dimensions; `gbrain_qwen4096` 1,057 pages/3,029 populated chunks,
  4,096 dimensions.

## Staging, restart, and live acceptance

The committed, content-hashed plugin bundle was
`fb56687acc85a870ea68cc2812b7ab1355b053f6fd18b60e00148a6872960d1d`. The exact
container-local apply and subsequent check-only pass succeeded. The private
role recovery receipt was saved at
`/sandbox/home-root/.prime-claw/plugin-role-receipts/role-fb56687acc85a870-a63586253ff85080.json` (verified mode `0600`).

With zero active sessions, the old pinned daemon PID 173 received `SIGTERM`.
Its process and socket were absent before one supervised daemon launch; no
stale socket/lock was manually removed. The new daemon PID 1712 reported
version `0.9.8`, build ID `cwd-fix-v0.9.8-r1`, and the expected protocol
schema. A **fresh daemon-backed session** (`267959df1e55`) loaded exactly
four unique plugin extensions. It discovered `/handoff`, `/plan-spec`,
`/implement-spec`, `/initialize-prime-claw` and `ralph_handoff`, `plan_spec`,
`initialize_prime_claw`, `create_spec_episode`, `handoff_spec_episode`,
`finalize_spec_episode` exactly once. A post-restart container check still
matched the committed bundle. Both database baselines were unchanged.
Direct `openshell sandbox provider list prime-claw-v2r1013` exited 0 without
requesting JSON, and a bounded selected-model call returned `AGENT_OK`.

## Handoff and separate gates

The container is ready for **Joe's manual UAT**. Keep the accepted sandbox,
mounted state, receipt, original v2, checkpoint, and v1 fallback until he
reports a decision. This proves plugin activation and data preservation; it
is **not** approval for brain source/index refresh, routed writes, Qwen
cutover, a host-global plugin refresh, worktree cleanup, or any broad recovery.
`bin/prime-claw status` still has the separately tracked OpenShell 0.0.116
provider-probe false negative (`prime-claw-zwg.3`); use the direct positional
provider-list form above until that issue is fixed.
