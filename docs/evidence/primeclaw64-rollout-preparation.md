# PRIMECLAW-64 rollout preparation: steps 4–5

**Review only.** Primary dist and the user-installed executable still report
1.53.0. The accepted recovery-policy plugin maintenance and its read-only
post-restart consumer checks were separate from Backlog 1.55.3 activation.
No installer, initializer, provider switch, repair, restart, or lifecycle
change ran for this slice.

## Artifact and rollback

See the [reviewed off-global build](primeclaw64-off-global-build-20261121.md)
for source/tag, toolchain, exact paths and log/manifest evidence. The check
used the retained Episode’s `deps/backlog/dist/backlog`, 1.55.3, mode `0755`,
SHA-256 `169976d4a37230e4e650cac3dfa15a03436809fc97dfb7551354e63a9808c586`.
The two 1.53.0 originals are canonical primary `deps/backlog/dist/backlog`
and `~/.local/bin/backlog`. Their verified copies are respectively
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
- In the selected primary, the project-local `conversation-after-handoff.md`
  is actually loaded from the project. Its current managed bytes lack the
  current source’s phase-goal and no-repeat guidance (`8209305f` → `576cdab3`
  by SHA-256 prefix). Refresh that exact untouched managed destination during
  separately approved reconciliation if fresh evidence still agrees. Do not
  rewrite existing Episode snapshots to update this file.
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

**Disposition:** ready for owner review, not activation. Use the
[host cutover](../backlog.md#owner-only-v1553-host-cutover) and
[selected-project reconciliation and restart/UAT](../project-initialization.md#selected-project-boundary-for-backlog-1553)
runbooks only after separate authorization, fresh quiescence checks and consumer
owner dispositions. Do not advance the stable pointer on this evidence.
