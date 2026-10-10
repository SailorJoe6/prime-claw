# v2 preserved-state recovery: TypeScript v0.9.8-r1

Captured 2026-10-10 UTC. This is a **historical partial trial**, not the
final model, restart, or routing acceptance. The later
[active acceptance](prime-agent-v098-v2-active-acceptance-20261010.md)
records the fresh provider-bound replacement and successful restart. No
source/index sync or routed write was performed in either trial.

## Preserved sources and controlled replacement

- Original `prime-claw-v2` OpenShell `f38cb82b-140d-4cc0-b1b0-a4a6871c82aa`
  remains `Error`; its Docker container `576a0158e98f7770e4a55e46edcd8cc6a740b152a40ffea398b00e725b3be6a4`
  remains exited (255), not deleted or directly restarted. Original Docker volume
  `pc-v2-20261010-state` remains mounted nowhere writable.
- Checkpoint `pc-v2-20261010-state-pre-recovery-20261010` stays separate.
  Fresh read-only comparison of the original and checkpoint **after PostgreSQL
  recovery on another volume** retained SHA-256 manifest
  `199080c6b6dd640a738adc50452a1ef42e8f40965c4690f4e7508a564b398453`:
  47,639 files, 5,627 directories, 2,194 symlinks, 1,339,262,898 regular
  bytes, content and metadata equal. The earlier xattr scan matched with zero
  attributes (`70254db7ef04c699d086d6dc14d25727277609b19a7b271de594e879e4b20c72`).
- The earlier `v2r1010` and `v2r1011` trial sandboxes are stopped. They failed
  safely before PostgreSQL boot because prewarmed image paths conflicted with
  preserved home links (`.prime`, then `.cache`). Their working copies remain
  separate; the first post-create copy still matched the checkpoint manifest.
- Retained v1 OpenShell `c9066cee-a64f-4fae-95cd-2a9245b2dc66` currently
  reports `Error` and its Docker container remains exited (143). Its writable
  layer is retained as historical fallback state; it is **not** a Ready service
  or a supported direct-start fallback.
- Final working volume `pc-v2-20261010-state-v098b-work-20261010` was copied
  from the checkpoint and matched the same manifest **before** application
  startup. Only this working copy received PostgreSQL WAL replay and later
  service activity. No volume or container was removed.

## Image, sandbox, and bounded policy

- Built image `prime-claw-brain:pa098-ts-v2root-a1faacd53ac4`, immutable ID
  `sha256:c98889ce82f12f75aa44a15ea9699d8303ec170856cba2b233c40ecb7c5bf4ce`.
  Verified fork origin `https://github.com/SailorJoe6/prime-agent.git`, annotated
  tag object `8ca4d5c39b7c738f71b5c86422ea46394c3d0558`, commit
  `a1faacd53ac4473a75de1d434afaf50945c2f647`, tree
  `5301c70d9c9d74e474ccaf258fdd3c8de982c52f`, lock SHA-256
  `3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74`,
  clean source checkout, and source launcher `0.9.8`. No Rust installer, npm
  registry release, host `node_modules`, or generated `dist` substitute.
- Image prewarms the Python kernel at `/sandbox/kernel-venv` and leaves
  `/sandbox/.prime` absent. The OpenShell sandbox explicitly carries non-secret
  `PRIME_AGENT_KERNEL_VENV` and `TSX_TSCONFIG_PATH`; its inherited policy adds
  only **read-only** `/opt/prime-agent`. Network rules and read-write paths match
  the preceding v2 policy. Three existing provider attachments remain present.
- Replacement `prime-claw-v2r1012`, OpenShell
  `f039649e-3391-4d77-bdf9-56415852ec3e`, Docker
  `faf241f9f2d299ef11a362a4a9eb258599f7abadf9ab43b0b9b0bc1b22b08180`,
  is `Ready`/running on that exact image. Its three read-write mounts are
  **only** working-volume subpaths `pgdata`, `brain`, and `home-root` at the
  corresponding `/sandbox/` paths. There is no writable mount of the original
  or checkpoint.
- The tested root-link script (SHA-256
  `3370b1b456d89ea2b43b480a17f34a8690c0c0770b0d1cc3be0f642500255f02`)
  linked nine preserved home entries, then an idempotent rerun created zero.
  Image-owned `.uv`, `.venv`, `.cache`, `.local`, and `kernel-venv` remain
  active; the former home copies of the first four remain retained inside the
  mounted volume. No preexisting root path was overwritten.

## Live checks on the replacement

- PostgreSQL 16.15 started **only** against the working `pgdata` at
  `/sandbox:5433`. Its new log records WAL redo and ready-for-connections;
  `pg_controldata` reports `in production`. The single new FATAL was the
  deliberately unauthenticated readiness probe's nonexistent `sandbox` role,
  not a failed application query. No PANIC occurred.
- Read-only SQL: `gbrain` = 1,059 pages, 3,031 `content_chunks`, all embedded
  at 1,536 dimensions; `gbrain_qwen4096` = 1,057 pages, 3,029 chunks, all
  embedded at 4,096 dimensions. These match recorded pre-incident counts and
  remain separate vector spaces.
- `/sandbox/brain` Git HEAD is
  `5c47c067e93eb633da8a8dcb28221e23eea7685b`. `git fsck --full
  --no-reflogs` exited 0 (one dangling tree, not a missing reachable object).
  `gbrain version` reports `0.50.0.0`, its engine resolves to PostgreSQL from
  the preserved config, and its read-only health dashboard reports 100% embed
  coverage and zero missing embeddings. The content-health score is 6/10 due
  to pre-existing stale-page metrics; it is not a service availability verdict.
- Source daemon socket is present. The TypeScript `DaemonClient` hello reports
  build ID `cwd-fix-v0.9.8-r1`, app version `0.9.8`, schema
  `protocol-7-schema-30-f908f493c9e1`. A no-model, no-session RPC create,
  state/cwd, kill, and absence-after-list probe passed. Its log has no
  error/fatal/uncaught markers from this startup.
- Restored `auth.json` is mode `0600`: Codex refresh/account identifiers are
  OpenShell placeholders, and access is exactly the deterministic synthetic
  projection, not copied OAuth. The three provider environment values tested
  are placeholders. No real credential value, browser store, or Keychain
  was read or recorded. VPN status was connected before the one model probe.
- Full host-safe candidate suite: **723 passed, 86 skipped, 75 subtests
  passed**. The updated source/policy/bootstrap focus suite passed 138 tests.

## Unaccepted and blocked gates

A single **bounded** `--no-tools --no-session` call with the restored default
`openai-codex/gpt-5.6-sol` returned `Provided authentication token is expired.
Please try signing in again. Run /login to update credentials.` It exited 1,
not a timeout. This message does **not** prove that Joe's Codex credentials
expired: this conversation works through Codex. The container's OpenShell
provider binding, synthetic adapter, and transport path must be traced before
a repair. Do not inspect OAuth material, rotate a provider, ask Joe to log in,
or silently switch models on this evidence alone. This result prevents
declaring the selected agent service healthy.

The replacement has **not** passed stop/start durability, active primary target
promotion, ordinary `bin/prime-claw status`/readiness, or a credentialed model
response. The primary ignored overlay still points to the original Error v2.
`converge` would rebuild/reconcile providers and perform brain clone/index,
query, and spawn stages; `validate` would change policy and write a validator
page. Neither was run as an unexplained repair. Source/index sync, routed
writes, Qwen cutover, and the separate provider-status bug retain their own
acceptance boundaries. Keep original v2, checkpoint, all working copies,
trial containers, and v1 retained until replacement and routing are accepted.
