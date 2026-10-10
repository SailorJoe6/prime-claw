# Phase 3a: versioned v2 state copy and restored-state candidate

Date: 2026-10-10. Joe directly authorized this bounded pass after the
[step-2 read-only inventory](3a-storage-step2-inventory.md). No independent
backup or extra approval was a prerequisite. This is **not** a source/index,
routed-write, Qwen cutover, production-route, merge or cleanup receipt.

## Identities and preservation boundary

- Preserved v1: OpenShell `default/prime-claw` ID
  `c9066cee-a64f-4fae-95cd-2a9245b2dc66`, Docker container
  `5aab359a43b0cafc94a7552e419736238578a786c9ddb6ee790fbadfa44a1316`, phase `Error`, stopped (exit 143, no OOM).
  The complete read-only Docker change-list multiset still matched its
  59,981-entry pre-copy inventory at the end. V1 was **never started, stopped,
  deleted, recreated or written** by this pass. It is the original fallback;
  there is no independent backup or volume-loss restore proof.
- New named volume: `pc-v2-20261010-state`, with pre-created `pgdata`, `brain`,
  `home-root` directories; *not* the separate disposable step-1 volume.
  The disposable volume, seed container and two Ready sandboxes remain intact.
  An isolated Alpine seed and two approved-image helpers were used; they are
  retained for owner disposition (one initial approved-image helper exited
  early because its default entrypoint was not overridden; its replacement
  did the successful extraction). No cleanup was performed.
- `prime-claw-v2`: OpenShell ID `f38cb82b-140d-4cc0-b1b0-a4a6871c82aa`, phase `Ready` at
  check time; Docker container `576a0158e98f7770e4a55e46edcd8cc6a740b152a40ffea398b00e725b3be6a4` running. Same cached approved
  image `prime-claw-brain:0.1.0` (ID prefix `0f705bb681dc`) as v1; its
  effective policy equals the live v1 policy, including its two extra
  read-only locations and narrower gateway-binary selection compared with
  the tracked base policy file. The policy was supplied from a temporary
  mode-0600 file, verified through OpenShell, then that temporary file was
  removed. Attached provider **names** match v1: `prime-claw-ai-gateway`,
  `prime-claw-github`, `prime-claw-codex`; no provider secret was printed.

## Copy and byte/metadata checks

With v1 stopped, each source path was streamed directly from `docker cp -a`
into a local Docker pipe and extracted as root by GNU tar 1.35 in an
isolated approved-image helper (`--network none`, mounted new volume):

```sh
# Pattern repeated for pgdata, brain and each retained root path; no tar saved
# to a host directory. The first Alpine/BusyBox copy preserved file bytes
# but not symlink owners and directory timestamps; the GNU pass fixed these.
set -o pipefail
docker cp -a <EXACT_STOPPED_V1_ID>:/sandbox/pgdata/. - | \
  docker exec -i <APPROVED_IMAGE_HELPER> tar -xpf - --numeric-owner \
    --same-owner --delay-directory-restore -C /seed/pgdata
# /sandbox/brain/. -> /seed/brain; individual root names -> /seed/home-root
```

The 13 selected root names were `.cache`, `.gbrain`, `.local`, `.npm`,
`.npm-global`, `.pc-ver.sh`, `.prime`, `.prime-claw`, `.uv`, `.venv`,
`AGENTS.md`, `episode-target`, `pg.log`. This includes inventoried
agent-state, Git-like root state, caches and environments without a guessed
"rebuildable" deletion. The old `/.s.PGSQL.5433` socket and its stale
lock path were **not** seeded into v2; both remain in the untouched v1.
No agent settings, credential, brain page or PostgreSQL relation content was
opened for display. Source bytes passed opaquely through local pipes;
no host archive was saved.

Before PostgreSQL startup, streaming source/target tar manifests hashed each
regular file's bytes and compared names, types, numeric UID/GID, mode, size,
mtime to whole-second precision and symlink target. Every tree matched exactly: `pgdata` **2,634**
entries / SHA-256 `a55cbb5b46df01912bef838e0164c57eaf1e1f0870e0d943a426fb7445ad663a`; brain **1,502**
entries / SHA-256 `b67fe0e7d562039f467389df77d93e1e721713f3ea429d89b6890bbc89969219`; all **13** root trees matched
their source manifests. Combined: **56,749 entries,
1,451,152,345 regular-file bytes and 2,198 symlinks**.
The tar transport did not prove ACL/xattr or host-volume-loss recovery.
Postgres and Prime Agent subsequently wrote to the *v2* volume, as expected;
post-start v2 bytes should not be compared to the original stopped snapshot.

## v2 mount, bootstrap and restored-state checks

Docker `HostConfig.Mounts` and runtime `Mounts` independently reported the
same new named volume, `rw`, with exact `pgdata`, `brain`, `home-root`
**subpaths** at `/sandbox/pgdata`, `/sandbox/brain`, `/sandbox/home-root`.
The mounted roots showed UID:GID `998:998`; `pgdata` mode `0700`, brain
and home-root `0755`. Nothing was mounted over `/sandbox` itself.

The checked, tested [root-link bootstrap](../../scripts/bootstrap-v2-root-links.py)
preflights all targets and refuses wrong links or collisions. Its first
OpenShell execution created **11** links into `home-root`; its second
created **0**, confirming idempotence. All root links resolve. A new
OpenShell startup wrote into the image-provided `/sandbox/.uv` and `.venv`
**before bootstrap**; those active image directories diverged from a fresh
image, so replacing or renaming them would have discarded new v2 state.
Their exact v1 copies remain preserved in `home-root/.uv` and `.venv`, but
are **not active**. They are explicitly not counted among the 11 links.
The required `.prime` agent settings (`998:998/0600`), session paths,
`.gbrain` state and root `AGENTS.md` are present through the links.
No private auth/config contents were opened; future choice to activate an
old environment needs a separate decision if the retained copies matter.

PostgreSQL 16 was started **without** `initdb`, `createdb`, extension creation,
migration or sync, using `pg_ctl -D /sandbox/pgdata -l /sandbox/pg.log -w
start -o '-c listen_addresses=localhost -p 5433 -c
unix_socket_directories=/sandbox'`. It recovered despite a stale pid
file; `pg_isready` reported accepting connections. Read-only catalog and
aggregate queries confirmed:

| Database | OID | Pages | Chunks | Non-null embeddings | Observed min/max dims | Column type |
|---|---:|---:|---:|---:|---|---|
| `gbrain` | 16384 | 1059 | 3031 | 3031 | 1536/1536 | `vector(1536)` |
| `gbrain_qwen4096` | 26257 | 1057 | 3029 | 3029 | 4096/4096 | `vector(4096)` |

The Qwen database is preserved, **not selected**. These are snapshot
aggregates, not a source-current/index freshness or model-validity proof.
The brain HEAD equals the inventoried v1 ref, and read-only `git fsck
--no-reflogs --full` returned 0. `prime-agent --version` returned 0.9.3;
a v2 offline daemon reported a socket. One basic daemon RPC session was
created with `cwd=/sandbox/brain`, its state reported the same cwd, it was
killed, and a list confirmed absence; all four checks passed. This probe
used `noSession:true` and **did not** request an external model response,
write a brain fact, sync, index, or route a write.

The bootstrap's offline unit command `python3
tests/test_bootstrap_v2_root_links.py` passed **5 tests**: idempotent
links, preserved active image dirs, wrong-link rejection, collision
rejection and missing-state rejection. No broad validation command was run;
`bin/prime-claw validate` would write probe facts and is outside this pass.

## Review stop

The versioned **restored-state candidate** exists and passed the bounded
checks above, with the explicit inactive-environment caveat. It is not
routed active for product traffic. Leave v1, v2, all helpers and all
step-1 resources intact. Joe must review this evidence and separately
choose any further migration, backup, routing, cleanup or cutover.
Incident `prime-claw-5v7.10` stays OPEN; source/index `.5`, parent and
routed-write `.4` remain BLOCKED. Do not infer their acceptance from the
v2 storage recovery.
