# v2 replacement active-runtime acceptance (2026-10-10)

This follows the [preservation and initial trial](prime-agent-v098-v2-recovery-20261010.md).
The original v2 `Error` container and `pc-v2-20261010-state`, its separate
`pc-v2-20261010-state-pre-recovery-20261010` checkpoint, and the v1 historical
container remain retained. None was deleted, restarted, mounted writable, or
used for PostgreSQL recovery. At capture, the primary runtime target still
points at the original Error v2; target promotion is a separate last step.

## Why the first Codex call failed

The first restored sandbox (`prime-claw-v2r1012`) had a valid synthetic access
JWT, placeholder-only `auth.json`, and the exact runtime preload shim, yet its
bounded model call returned an expired-auth message. Joe's current host Codex
session worked. Reprojecting the two restored `auth.json` placeholder fields
onto that sandbox's current placeholder set did **not** fix the call.

Prime Claw's persisted record of the `prime-claw-codex` provider credential
last sent to OpenShell was dated 2026-09-16 and **did not match** the current
host Prime Agent OAuth bundle (last changed 2026-10-06). Both the host bundle's
recorded expiry and access JWT expiry were still in the future. The supported
`stage_codex_provider` path refreshed only that named OpenShell provider; its
mode-0600 ignored fingerprint then matched the host. No other OpenShell
sandbox was `Ready` besides the controlled replacement, and no real OAuth
value was printed, stored on sandbox disk, read from browser/Keychain, or
included in evidence. Updating the provider rekeys placeholders, so the old
sandbox was **not** treated as repaired: the new sandbox was created with a
fresh attachment. The same bounded default-model call returned `AGENT_OK`
before and after a full sandbox stop/start. These before/after probes identify
the stale OpenShell provider snapshot/binding, not Joe's login, as the cause.

## Accepted replacement and preserved state

- `prime-claw-v2r1013`, OpenShell ID
  `d692aa3e-86cf-4c7f-a461-71bed3b934b1`, Docker ID
  `512e0617b6a245267872114fcb5aad97689d94cf1b3b4de67868b952050179ef`,
  returned `Ready` on the same container ID after stop/start.
- Image tag `prime-claw-brain:pa098-ts-v2root-a1faacd53ac4`, immutable ID
  `sha256:c98889ce82f12f75aa44a15ea9699d8303ec170856cba2b233c40ecb7c5bf4ce`.
  The in-sandbox source identity gate verified annotated fork tag, commit
  `a1faacd53ac4473a75de1d434afaf50945c2f647`, tree, lockfile, clean
  checkout, source launcher version `0.9.8`, and kernel venv path. RPC daemon
  hello reported build ID `cwd-fix-v0.9.8-r1`, version `0.9.8`, and schema
  `protocol-7-schema-30-f908f493c9e1` after restart.
- Separate Docker volume `pc-v2-20261010-state-codex-work-20261010` was
  copied from the immutable checkpoint and verified **before** startup against
  the same SHA-256 manifest
  `199080c6b6dd640a738adc50452a1ef42e8f40965c4690f4e7508a564b398453`.
  Its three mounted subpaths `pgdata`, `brain`, `home-root` were exactly the
  three intended read-write mounts; neither original nor checkpoint was
  mounted writable. The original/checkpoint read-only full manifest was
  checked again after all replacement activity and remained identical.
- Nine preserved home entries linked idempotently; image-owned `.uv`, `.venv`,
  `.cache`, `.local`, and `kernel-venv` remained active and historical copies
  remained in the mounted home. The source path `/opt/prime-agent` was added
  **read-only** to the prior policy, with unchanged network/read-write rules.
  Non-secret kernel/tsconfig variables survived the sandbox restart. Three
  expected providers were attached. The Codex auth projection remained
  synthetic and mode `0600` after both model calls; refresh/account fields
  matched this sandbox's OpenShell placeholders.
- PostgreSQL 16.15 on `/sandbox:5433` replayed WAL from the working copy.
  A clean PostgreSQL stop/start and a subsequent full OpenShell stop/start
  both preserved `gbrain` (1,059 pages, 3,031 embedded chunks, 1,536 dims)
  and `gbrain_qwen4096` (1,057 pages, 3,029 embedded chunks, 4,096 dims).
  Cluster state returned `in production`. The brain Git fsck exited 0, with
  only one dangling tree; `gbrain` CLI reported PostgreSQL backend and 100%
  embed coverage with zero missing embeddings. Its overall health score was
  **6/10** because 1,057 pages were marked stale; this is a separate source
  freshness/index gate, not a permission to sync during recovery.
- A controlled earlier trial showed that OpenShell retains root links on
  restart, but can leave a daemon socket file with no listener. On the final
  replacement the same stale-socket condition was detected after restart,
  along with zero live source-daemon owners. Starting the exact pinned source
  daemon let its upstream socket lease safely recover the stale file/lock;
  nothing was manually unlinked. RPC hello and a no-model create/cwd/kill/list
  probe passed after restart. The selected
  `openai-codex/gpt-5.6-sol` `--no-tools --no-session` prompt returned
  `AGENT_OK` both before and after restart.
- Live egress check: the declared `example.com:443` curl canary returned
  HTTP 200; undeclared `example.org:443` was rejected by the proxy with 403
  (curl exit 56, HTTP 000). No credential-bearing endpoint was probed for this
  policy check.

## Candidate validation

After the private fingerprint-file mode correction, the full host-safe
`python3 -m pytest tests/ -q` suite passed: **729 passed, 86 skipped,
75 subtests passed**. This includes fail-closed `Error`/`Stopped`/`Pending`
regressions for direct `converge` and provider/policy attachment. An independent
read-only review found the non-Ready direct-`converge` gap and accepted that
correction before landing. The isolated image, source identity, runtime policy,
provider projection, root bootstrap, and restart probes above were separate
live acceptance checks, not inferred from the test suite. No plugin source was
installed on the host or changed in this candidate.

## Still separate

This proves a healthy replacement runtime, not authorization for brain source
sync, index rebuild, routed writes, Qwen cutover, or removal of the v1/v2
fallback/checkpoint. The primary ignored target and tracked runtime code must
be reconciled to this exact sandbox/image, then read-only status and final
preservation/security checks must pass. `converge` and `validate` were not run:
the former includes brain/index writes and the latter a validator page plus
temporary policy change. The separate provider-status defect remains tracked.
