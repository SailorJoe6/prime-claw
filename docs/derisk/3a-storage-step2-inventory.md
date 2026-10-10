# Phase 3a step 2: stopped v1 preservation inventory (read-only)

Date: 2026-10-10. Scope: Joe's **step-2-only** grant recorded at Episode
`494e0ea1c36d7af0d4f823a59fc2820d7e8f1e15` and Bead
`prime-claw-zwg.6`. The accepted *disposable* step-1 topology is documented
in [3a-storage-step1.md](3a-storage-step1.md). This inventory **does not**
approve backup, state copy, seed, v2 creation or migration. It did not start,
stop, exec into, delete or recreate v1. No private page or credential content
was opened, printed or retained. Docker API metadata requests did not save a
tar archive or copy state into a volume or host directory.

## Identity and method

1. `openshell sandbox get -g openshell prime-claw -o json` identified
   `default/prime-claw`, ID `c9066cee-a64f-4fae-95cd-2a9245b2dc66`, phase
   **Error**. `docker ps -a --no-trunc --filter name=prime-claw` matched **one**
   container ID `5aab359a43b0cafc94a7552e419736238578a786c9ddb6ee790fbadfa44a1316` whose name embeds that exact OpenShell ID.
   Targeted Docker `.State`, `.Mounts` and `.Image` inspect fields recorded
   `exited`, `Running=false`, `Pid=0`, exit `143`, `OOMKilled=false`, stopped
   `2026-10-06T14:06:17.633423503Z`; image ID prefix `0f705bb681dc`.
   The listed bind targets were OpenShell auth/TLS/supervisor paths, **not**
   persistent `/sandbox/pgdata`, `/sandbox/brain` or agent-state mounts.
   These identity/state checks still matched at the end.
2. Read-only `GET /v1.55/containers/<exact-id>/changes` on the Docker
   context Unix socket returned **59,981** filesystem change records (59,919
   adds, 62 changes). Two full API metadata reads yielded the exact same
   path/kind multiset. `docker container diff <exact-id>` output hit this
   agent's 2 MiB output cap (25,013 lines on one call) and must **not** be
   mistaken for a complete inventory. No changed-file contents were read.
3. `HEAD /v1.55/containers/<exact-id>/archive?path=<known-path>` supplied
   file type/mode/size/link metadata. Targeted `GET` on **known paths** read
   just the first 512-byte tar header for numeric uid/gid/mode/type and
   immediately closed the response, without consuming directory members or
   storing the archive. The only small file *contents* read were the public
   `pgdata/PG_VERSION` (`16\n`) and Git `.git/HEAD`, its selected ref, and
   `.git/packed-refs`; only structural results are reported below. Agent
   settings, auth, logs, brain pages and PostgreSQL relation contents were
   **not** read. Docker Engine API `1.55` was used.

## Observed state (not health or backup proof)

| Category | Content-free observation | Boundary / unknown |
|---|---|---|
| PostgreSQL | `/sandbox/pgdata` is a directory owned `998:998`, mode `0700`; `PG_VERSION` is `16`, owned `998:998`, mode `0600`. `base`, `global`, `pg_wal` exist with `998:998/0700`. `pg_xact`, `pg_multixact`, `pg_logical`, `pg_tblspc`, `pg_replslot` and a `postmaster.pid` path appear. Five 24-hex-named WAL segment files each report 16 MiB (80 MiB total at this instant), plus `archive_status`. Five numeric `base` database directories are present: the standard system set (`1`,`4`,`5`) and **two additional** IDs (`16384`,`26257`). | The extra IDs are *not proof* of the names `gbrain` and `gbrain_qwen4096`, row counts, embedding dimensions, a valid checkpoint, WAL completeness or clean recovery. Neither database was opened; logical names and health require later separately approved recovery/validation. A stale pid/socket does not mean a writer is active. Entire `pgdata`, not just `base` or observed WAL files, is the proposed unit of retention. |
| Brain checkout | `/sandbox/brain` and `.git` are directories owned `998:998/0755`; `.git/HEAD` is symbolic to an existing loose branch ref containing a syntactically valid hex object ID. `.git/refs` and `objects`, `index`, `packed-refs` and `worktrees` exist. Change metadata includes 8 loose ref files and 2 packed ref records. | No page contents, checkout bytes or Git object integrity were inspected; no `git fetch`, checkout, sync or reset. Preserve the complete checkout, `.git` objects/refs/worktrees and sources until a later integrity decision. |
| Agent and local brain state | `/sandbox/.prime`, `.gbrain`, `.prime-claw` are directories (sampled owner `998:998`, mode `0755`). `.prime/agent` has settings (`998:998/0600`), auth file, models metadata, sessions, session-artifacts, logs, daemon-workers, session-leases and kernel environment. `.gbrain` has configuration, model-cache, audit/checkpoint/lock paths. `.prime-claw/qwen-candidate` and its `.gbrain` directory are `998:998/0700`; runtime helper paths exist. | Existence is **not** a completeness or credential-integrity claim. Auth/config contents were not read. The Qwen candidate stays unused and preserved. Classify required private agent paths with Joe before copying; do not disclose or transform credentials. |
| Root and other paths | 17 top-level names under `/sandbox` appeared in the complete change listing, including `AGENTS.md` (`998:998/0644`), `episode-target` (Git-like tree), `pg.log`, `.venv`, `.cache`, `.npm`, `.npm-global`, `.uv`, `.local`, and socket/lock paths. All 17 queried changed root names were files or directories, **not symlinks**. Sample Python executable paths inside `.venv` and `.prime/agent/kernel-venv` were `998:998/0777` symlinks with absolute targets (targets not disclosed). | Change listing does not enumerate unchanged image files or all nested symlinks. `episode-target` and root files may contain retained user state; do not discard based on names. Caches/venvs might be rebuildable but have not been approved for deletion. Socket/lock paths alone are not live-state proof. Root symlinks from the *disposable* smoke cannot be assumed present in v1. |

The numeric UID/GID samples cover representative roots and critical
subdirectories, **not every file**. Top-level file sizes and 80 MiB of
observed WAL must not be presented as total database or complete-state size.
The stopped container's prior effects and reason for OpenShell `Error` remain
unknown; this inventory did not establish that the source/index guard ever
ran or that an unintended external write occurred. Do not infer dimension or
embedding model from the unused candidate's name.

## Proposed retention / backup decision boundary (not executed)

1. Keep the **whole stopped v1 container and writable layer** unchanged as
   the first preservation boundary; also retain the disposable step-1 volume,
   exited seed container and two Ready sandboxes. Do not direct-start v1.
2. Before any future copy, ask Joe to approve the *exact* retained set:
   full `pgdata` including WAL, global catalog and transaction metadata;
   entire `brain` checkout including `.git`; required `.prime`, `.gbrain`,
   `.prime-claw` (including unused Qwen candidate), accepted root files and
   `episode-target`/logs if valuable. Account for numeric ownership and
   absolute/relative symlinks. Do **not** assume every cache or whole-home
   path belongs in `home-root` without review. Identify private credential
   paths safely without printing them.
3. In a **separately approved later step**, design a stopped-writer,
   ownership-preserving copy into the accepted named-volume subpaths and an
   independent host/volume-loss backup with restore proof. Verify PostgreSQL
   catalog names and both databases' real data/dimensions only after approved
   recovery in a separate v2. Volume persistence alone is not a backup.

**STOP for Joe's step-2 review.** No backup, copy, seed, state move, v2,
index/write, Qwen cutover, merge or cleanup. Incident `prime-claw-5v7.10`
remains OPEN; source/index `.5`, parent, routed-write `.4` remain BLOCKED.
