# Populated hidden Backlog import — native blocker, Slice 1h

## Outcome: blocked, not a production increment

A bounded attempt to import into an already-published independent populated
`.backlog` clone exposed a native allocation constraint. No successful populated
migration is claimed. The production and workspace changes were rolled back to
accepted Slice 1g. Existing confirmation/preparation/import guards remain.
All ten task acceptance criteria remain unchecked; the Episode leaves task
status `In Progress` for the owning Conversation's lifecycle decision.
No live project/store, ownership or Episode resource was changed.

## Precise native constraint

The valid disposable destination contains:

- active `BASE-1`, with authored content, criterion, plan, notes and comment;
- completed `BASE-2`;
- archived `BASE-3`;
- a distinct historical archived prefix probe repeating `BASE-1`;
- complete non-default configuration and original multi-commit task history,
  already published on disconnected `refs/heads/prime-claw/tasks` and cloned
  independently into `.backlog`.

Native task creation allocates **`BASE-3` again**. A later native dependency
write refuses the ambiguous old archived `BASE-3` and new active `BASE-3`.
The ordinary native importer therefore cannot complete this valid destination
while retaining the existing archive and current native allocation behavior.
Changing fixture ordering to hide the collision would not resolve it.

Read-only audit of the dependency source confirms intentional behavior:

- `src/core/backlog.ts:1535–1548`: `generateNextId` uses existing native IDs.
- `:1552–1555` and `:1641–1653`: archived IDs are intentionally excluded and
  reusable; allocation uses active/completed occupancy.
- `src/utils/prefix-config.ts:305`: the native numeric allocator uses the
  highest occupied top-level ID plus one.
- The task-create CLI (`src/cli.ts:1878` onward), `TaskCreateInput` and
  configuration provide no literal ID override, ID reservation/start/offset,
  or include-archive allocation option. `--parent` changes hierarchy, not
  archive preservation. Duplicate repair rewrites IDs.

These are source-audit findings plus the runtime failures below, not permission
to patch a dependency, reserve fake tasks, renumber/move archives, change prefix
or configuration, remove validation, or redesign the importer/allocation policy.
The requested contract expressly forbids those policy changes.

## Bounded implementation attempt (not active)

The unvalidated four-file attempt is retained only as a historical evidence
patch: [populated-hidden-backlog-import-attempt-20261030.patch.gz](populated-hidden-backlog-import-attempt-20261030.patch.gz).
Decompressed patch SHA-256 `65864799e95206e6fa4980ed84e49c9780a27ba9504508131ad06c58c598e244`.
Gzip artifact SHA-256 `87d31aff6dff9da95311c2b88543f37710266f9c428714c0c819eda846cc35a4`. Use `gzip -dc` to inspect the
historical diff without applying it. Its exact base is task-only checkpoint
`a15d9c2a7d47dca8f3d290faeb5ac783d718bcb5`; reproduce only in a disposable
checkout of that base, not by applying it to a live or current task store.
The patch is **not installed production source**, approved implementation,
a second authority, or a migration/retry instruction.

The attempt reused native workspace/configuration and clone checks, native
allocation/import packages/comments/relations, exact same-migration markers and
the single receipt. It added invocation-local native/file/history/config/clone
preservation, physical record-path keys (including distinct same-ID archives),
baseline-inclusive counts and refresh checks before source retirement. No
baseline service/authority/controller/classifier/approval/retry protocol was
added. That approach did not overcome the supported native allocation limit.

Read-only review identified a whole-view comparison defect: Backlog derives
`dependencyGraph`, `readiness`, `isReady` and `subtasks` from the corpus, so
imports can change them without authored data loss. The attempt excluded only
those four fields, retaining every authored native field and exact original
file bytes/modes/history. This repair was source-reviewed, not proven by a
passing populated end-to-end result.

## Truthful failure chronology

1. Mandatory initial source probe passed:
   `20261030T074326Z-2982-3c6804be`. It precedes later source repairs and is not
   final-source or successful populated-import proof.
2. First focused native run `20261030T131414Z-66438-58786a3c`:
   **1 bridge failed in 124.69s**; native **3 cases, 1 pass, 2 failures,
   0 skipped/cancelled/todo**. Native configuration incompatibility refused
   before writes as intended. The archive prefix-probe read failed because
   native path globbing lowercases its ID prefix while the historical filename
   was uppercase. Only a disposable canonical lowercase read filename was
   introduced; original record bytes/path/ID remained unchanged. The graph
   fixture also tried native authoring of a missing dependency, which correctly
   refused. It was changed to committed historical fixture data only, not a
   native validation waiver.
3. Repaired-attempt mandatory source probe passed:
   `20261030T131726Z-77761-0db1e3bd`.
4. Corrected focused run `20261030T131914Z-84478-287c156c`:
   **1 bridge failed in 142.32s**; native **3 cases, 1 pass, 2 failures,
   0 skipped/cancelled/todo**. Both populated cases reached the genuine
   `BASE-3` archive allocation collision and native dependency ambiguity.
   The configuration pre-write refusal passed again. Neither source deletion
   callback was reached. No guard was bypassed and these failures are not waived.
5. The unvalidated functional attempt was rolled back to accepted Slice 1g.
   Source SHA-256 is restored to
   `c2909e828f356e256f50e816ceb6b7185c55f7c530dee3044fa8089eef0d870e`.
   The direct native constraint regression and rollback-source validation
   pass as recorded below; this does not make the attempted import successful.

Both failed native runs retain their TAP under their respective
`.test-results/<run>/tier1/populated-independent-hidden-backlog-migration-node.tap`.
Both manifests report only `tests-failed`, network verified absent, and clean
absent runtime/builder teardown. The candidate was never globally applied or
used against a live provider store.

## Direct native constraint proof

```sh
scripts/test-tier1.sh --probe
python3 -m pytest tests/test_task_provider_migration.py::test_task_provider_migration_node_suite -q -m container
# Reproduce only the new direct-native constraint case:
python3 -m pytest tests/test_task_provider_migration.py::test_native_populated_backlog_allocation_node_suite -q -m container
```

- Mandatory rollback-source Docker probe: **exit 0**, run
  `20261030T132723Z-14198-cd4be244`.
- Final full migration bridge: **1 passed in 503.74s**, run
  `20261030T132923Z-21146-89e8707a`. Native TAP: **45 tests,
  33 passed, 12 explicit retired reverse-direction skips,
  0 failed/cancelled/todo**. Every pre-existing native test and bridge byte is
  retained; all runnable forward/admission cases pass. The new evidence case
  runs in the full suite, not a filter hiding an implementation failure.
- Runtime Backlog version printed in TAP: **1.53.0**. Original occupied active/
  completed IDs are `BASE-1`, `BASE-2`; original archived IDs include `BASE-3`
  and the distinct `BASE-1` prefix probe. Native creation allocates `BASE-3`
  and child `BASE-3.1`; native dependency write exits **1** with exact archive/
  active `BASE-3` ambiguity. Unsupported `--id` refuses before any write.
- The test proves original record placement/bytes/history, whole configuration,
  original clone Git identity/configuration/branch, code and task-store HEADs/
  indexes, direct published refs and private excludes unchanged. Retiring Beads
  authority/inventory/export/history remain unchanged and present. Prospective
  imported records are created **only in the disposable fixture**, uncommitted
  and unpublished; the ambiguous native dependency writes nothing. No canonical
  migration or successful populated import is claimed by this evidence case.
- Both final manifests pass without failure codes, network verified absent,
  clean absent builder/runtime teardown. All **60** declared artifact hashes
  across the two final and two failed manifests were verified. The failure
  chronology remains evidence, not a waiver.
- Host-safe static checks: **5 passed, 10 container bridges skipped in 0.03s**.
  No final-source/test/bridge bytes changed after the final full proof started;
  only task and documentation prose changed afterward.

Final manifest: `.test-results/20261030T132923Z-21146-89e8707a/tier1/manifest.json`.
Final TAP: `.test-results/20261030T132923Z-21146-89e8707a/tier1/task-provider-migration-node.tap`.
TAP SHA-256: `c214ae441929c4e1c5f598490d105e1a311ea6a965a677fe0a76df2c2f52747f`.
Restored production source SHA-256: `c2909e828f356e256f50e816ceb6b7185c55f7c530dee3044fa8089eef0d870e`.
Final native test source SHA-256: `5da7c6bee3b21398c9ea4cde5e9ee5f74dedec3e11e6dcc97ea50d96d32c320d`.
Final Python bridge SHA-256: `092f6ab7ee419293231d87374c4db09eeb7a34badf538ca892dbbe2fd0fa455b`.
Final repository capture SHA-256:
`9cb27aa50fe957700bb9402f5018ed7b9b3f44ce5c8d7b15ce98d82793f0eb31`.
Runtime image: `sha256:d3fad525bd3a0952e50c6fa7c9dcc296554d5dd4daea1bf4e47a65ae7d5343f7`.

## Unblock condition

The owning Conversation/operator must resolve the native allocation constraint
through a supported capability that preserves the approved existing records,
IDs, configuration and importer behavior, or explicitly revise the product
constraint. Any candidate capability must first be demonstrated in disposable
native fixtures. No dependency upgrade/patch, allocation strategy, fake
reservation, archive move/renumber, live migration, merge or global activation
is authorized by this blocker checkpoint. Broader ordinary/code-tracked/
disconnected-history adoption, default-only normalization in both init/install
and migration, full active-workspace integration and skill/text-patch work also
remain unfinished.
