# PRIMECLAW-64 Backlog 1.55.3 rollout evidence

**Selected host activated and verified on 2026-11-21 UTC.** PATH resolves to
`~/.local/bin/backlog` at 1.55.3; primary dist remains the distinct 1.53.0
fallback. This record includes the pre-cutover inventory and the later owner
installation and live UAT. The earlier recovery-policy plugin maintenance and
restart did not activate Backlog 1.55.3.

## Artifact and rollback

See the [reviewed off-global build](primeclaw64-off-global-build-20261121.md)
for source/tag, toolchain, exact paths and log/manifest evidence. The check
used the retained Episode’s `deps/backlog/dist/backlog`, 1.55.3, mode `0755`,
SHA-256 `169976d4a37230e4e650cac3dfa15a03436809fc97dfb7551354e63a9808c586`.
The two pre-cutover 1.53.0 originals were canonical primary
`deps/backlog/dist/backlog` and `~/.local/bin/backlog`. The latter now holds
1.55.3. The verified 1.53.0 copies are respectively
`rollback/backlog-1.53.0-primary-dist` and
`rollback/backlog-1.53.0-user-installed` under the retained Episode’s
`primeclaw64-off-global-20261121T221527Z` session-artifact directory.
Restore only the copy for the affected destination after verifying its digest.

## Bounded local inventory and native health

The inventory joins the native Orca repository, setup and local-worktree lists,
reachable session observations, and recorded active ownership. The view is
local, not a fleet census; a paired runtime exposed nine paths as metadata
only, and its session listing returned `incompatible_runtime`. No deleted
finished sessions were investigated. Store markers show 14 Backlog roots
(eight project roots and six linked snapshots), eight with Beads markers only,
and 12 with neither marker. Markers and manifests are evidence of presence,
not proof that a session uses a store or that a copied manifest is current.

| Context | Result and owner action |
| --- | --- |
| Selected canonical prime-claw | Managed Backlog. Plain `doctor` would create missing `archive/tasks/`; not run. The owner can evaluate native health during an approved maintenance window, allowing only the expected layout creation if authorized, or retain this explicit limit. Do not move legacy records to get a clean result. |
| Selected and other owned or uncertain linked snapshots | Preserve in place. Six Backlog snapshots (five active ownership records, one uncertain) lacked one or more directories that `doctor` would create. No diagnostic runs there. Account for running/queued work with actual owners before changing the shared binary; neither a detached session nor an idle snapshot proves abandonment. |
| Other registered Backlog projects | Six project roots outside the selected project and the checked project were skipped: five had missing startup directories, and all six permit remote ref refresh. Each owner can make its own maintenance decision; no cross-project config or store writes were made to enable checks. |
| One other registered Backlog project, with a managed manifest | All required directories already existed and config disabled remote refresh and branch scanning. Plain `doctor` from the exact project CWD returned 0 and reported no duplicate IDs, self-references or dependency cycles. Store path/mode/content fingerprints and captured Git status, index entries, HEAD and refs matched before and after. This is scoped observation, not proof that exit 0 implies no effects or that all other projects are healthy. |
| Plain Backlog, no-provider or uncertain contexts | Do not infer managed initialization or a conversion from a store marker. No manifest-free primary Backlog root was established in the registered local set; a manifest-free linked store remained an uncertain snapshot. No doctor against a missing or unknown store. |
| Beads-authoritative contexts including Ralph-PVA; unrelated and non-local | Outside Backlog conversion or reconciliation. Preserve PVA and its snapshots. Do not treat omitted runtime or unproven session command resolution as a pass. |

In the pinned source, `src/cli.ts` invokes the native preview before any
explicit repair. `ContentStore.loadInitialData()` in `src/core/content-store.ts`
calls `ensureBacklogStructure()` (`src/file-system/operations.ts`) which uses
recursive `mkdir`. Task corpus loading can also refresh remote refs unless
existing config precludes it (`src/core/backlog.ts`). Git status alone misses
empty-directory creation. For authorized inspection, select the exact project
by process CWD and remove an inherited `BACKLOG_CWD` override; use the reviewed
absolute executable and plain `doctor` with no repair or output flags. Record
raw stdout, stderr and exit, and the before/after facts or precise limit.
Neither a nonzero finding nor an exit-zero preview authorizes repair.

The selected primary and Episode had 88 physical legacy `completed/` records
apiece. No physical archived-draft Markdown was present in those two stores
and none appears in their captured current Git indexes. This is not an
all-ref absence or a collision clearance: no native collision test ran there.
If archived drafts exist, preserve the exact bytes, path, mode, history and
identity/collision evidence without synthesizing a native archived-draft view.
Private inventories, installed-file receipts and raw diagnostics are retained
with the Episode session artifacts, not in Git.

## Guidance findings and concrete actions

- The bounded user-global manifest audit verified 11 installed skill assets and
  55 owned backing files. Canonical prime-claw and its selected Episode agreed
  on the project manifest and 17 destination files, not necessarily on current
  upstream template content. No affirmative `task complete` or `task_complete`
  recipe was found in the audited guidance; other project matches were
  prohibitions. This was a bounded manifest and entrypoint audit, not a proof
  about every automation or a running process. Before cutover, affected owners
  must update or explicitly exclude any actual active consumer still calling a
  removed command or assuming records move on completion.
- After an approved merge the owner sets `Done` by native `task edit`; the
  task stays active through finalization. Optional archive is read-only, reserves
  the ID and preserves status/relationships. Canonical archives are under
  `archive/tasks/`; legacy `completed/` is readable archived input, not a
  completion destination. Only a separately authorized archived delete vacates
  the ID. Dependencies can refer to native archived tasks and drafts.
- For an exhaustive identity read, use complete unwindowed native JSON with
  the necessary archive visibility. The customized `prepare` ready/status
  command is a filtered work queue, not that read. Do not use display ordering
  or pagination as identity or allocation evidence. Prefer explicit native
  inputs and closed stdin for unattended invocations; `--plain`/`--json` are
  output formats, not prompt controls. The inspected plugin runner closes
  stdin; other invocations were not exercised.
- Preserve customized `design` and `spec-it-out` (local authoring and concurrent
  publication guidance), `prepare` (orientation), and `plan-task` (shared
  checkout and selected-store preservation). No cutover-driven reset is
  justified. Leave inactive customizations for their owners.
- The project loader reads `conversation-after-handoff.md` from the selected
  root. The owner’s one reconciliation updated this untouched managed file
  (`8209305f` → `576cdab3` by SHA-256 prefix) with phase-goal and no-repeat
  guidance. Existing Episode snapshots were not rewritten.
- The current comparator is expected to preserve/reclassify `blocked`,
  `execute`, and `handoff`, not refresh them automatically: recorded baseline
  differs from installed and upstream has advanced. Those project bytes lack
  the newer verified pre-work interruption guidance, although global oversight
  has it. For an active consumer that needs the interruption route, the owner
  should review the exact diffs, align the selected project through the
  supported content decision or explicitly defer that route for preserved
  snapshots. Do not claim reconciliation alone will install the correction.
  `implement-task`, `implement-spec` and `implement-prep` bytes already match
  current source; different manifest metadata is not stale behavior. No plugin
  source change is needed to deliver the proven untouched managed update.

## Verified host cutover and live UAT

- **Build and install.** Unmodified upstream `v1.55.3` resolved to
  `0cf4fdbc70020327f4366a29d3f405f83d180301`. The standalone build and smoke
  used checksum-verified official Bun 1.4.4 on command-local PATH. The owner
  installed the reviewed 106,150,754-byte Mach-O arm64 artifact at
  `~/.local/bin/backlog` with mode `0755` and the SHA-256 above. Both distinct
  1.53.0 rollback copies were verified and retained outside the worktree.
- **Plugin delivery.** Accepted canonical source
  `30bd6c53a349113944bda48a69f8a0f2c5963bb5` passed Docker Tier 1 `--probe`,
  run `20261121T225811Z-75113-41d80e86` (15 declared digests verified, offline
  probe, clean teardown; manifest SHA-256
  `7436a78ed2790928f7b22876303411bec5e8653f136586290cb97072bcf65be1`). The earlier
  `2fe5f75` source run has narrower scope. Canonical-primary user-global
  apply and check both exited 0 with zero conflicts and default drift protection.
- **Selected reconciliation.** The owner ran the initializer once. The changes
  published on main at `5af4e912a6641eac13c11522817dfc471b2ed5a0` updated one
  managed workflow and recovered one metadata entry; six entries were
  unchanged and nine customizations were preserved with explicit conflicts.
  Native `backlog.config.yml` points to the same `.backlog/config.yml`.
  Ownership, config bytes, legacy allowlist and every Episode snapshot were
  preserved. The newer pre-work interruption route in old `blocked`, `execute`
  and `handoff` copies is deferred by affected owners, not reconciled or tested.
- **Restart and UAT.** After affected owners and their explicit descendants
  reached safe checkpoints, the coordinator performed one full cutover restart
  (daemon `65235` → `88168`, Prime Agent `0.9.8`, protocol `7`, build
  `cwd-fix-v0.9.8-r1-14-g6cd28f90e`). An unrelated Docker job finished naturally
  with its own retained fixture failure; no force-idle, cancellation or cleanup
  qualified the restart. All three live contexts resolved the actual installed
  1.55.3 binary and verified its digest and visible Prime Claw tool context:

  | Context | Representative native evidence |
  | --- | --- |
  | Resumed owner (`cd7d65ecc4c3`) | `backlog task view --json -- PRIMECLAW-64`: schema 1, In Progress, `archived: false`. |
  | Same PRIMECLAW-64 Episode (`c0acb7c94e46`) | Same active task read; PRIMECLAW-1 was Done and `archived: true` at its real legacy `completed/` path. Native history and selected fingerprints were unchanged. |
  | Designated ordinary GStack (`e288de7b357e`) | Native Beads context, task view and history passed. PVA stayed frozen and Beads-authoritative; no Backlog task calls, writes or conversion there. |

- **Installed binary checks.** Compiled CLI/browser/MCP smoke exited 0. In a
  disposable Backlog fixture, a new To Do task stayed active when edited to
  Done. Explicit archive kept Done and returned `archived: true` at
  `archive/tasks/`. An archived edit exited 1 with unchanged bytes; the next
  native allocation produced `UATC-2`, preserving archived `UATC-1`’s identity.
  Two initial caller-input refusals are retained separately: incompatible init
  flags refused before writes, and a plain fixture rejected repository-specific
  `P2` before a task write. Corrected native inputs passed; neither refusal was
  a binary regression or a transport retry. No production lifecycle test writes.
- **Later interruption.** After successful cutover UAT and hold release, the
  daemon changed `88168` → `511` for an unknown reason. That interrupted the
  subsequent handoff turn boundary; its durable checkpoint survived. A report
  from the same Episode on the recovered route still verified the installed
  binary. Historical execute start remains unknown. This was not a planned
  second cutover restart, replacement UAT, or evidence of recovery dispatch.

Owner session artifacts under `actual-backlog155-cutover/` retain the
installation, post-restart UAT, compiled smoke, lifecycle fixture and later
interruption receipts. The Episode separately retained raw native view and Git
receipts; no private corpus is checked in. Live schema visibility does not
prove a public registry count/hash, the absence of every startup warning, or
end-to-end lifecycle dispatch or historical recovery. The 13 doctor limits,
paired remote exclusion, PVA freeze, and unrelated TASK2 name collision remain
outside the proven host behavior.

**Disposition:** verified host cutover; this documentation candidate awaits
independent review and owner-controlled integration. The maintenance hold is
released. No repeat install, reconcile, restart, or UAT is called for. Only the
Backlog.md Expert decides whether to advance its separate latest-stable pointer;
message queue admission alone does not establish receipt.
