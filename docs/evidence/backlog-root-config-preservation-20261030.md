# PRIMECLAW-44 Slice 1f: published root configuration preservation

## Bounded production change

Existing independent Backlog workspace preparation now preserves the **whole
selected root configuration**, byte for byte, behind the same exact relative
`backlog.config.yml -> <store>/config.yml` (or native `config.yaml`) symlink for
built-in and custom layouts. It no longer strips a built-in directory directive
or deletes the built-in root configuration. Both supported directory-key
spellings retain their existing native meaning. No directive is required or
added: a root without one retains native built-in fallback semantics.

The existing published task branch and clone remain the authority. Root and
published folder bytes must agree. Existing publication, independent Git
identity, containment, dirty/ahead/divergent, populated ordinary-store and
code-tracked-store refusals remain. The source helper does not rewrite a
published configuration or recreate tasks.

Root-link replay uses the existing preparation/protection surfaces:

- A dangling **primary** link refuses before fallback, branch creation or clone.
  It never guesses a replacement path or creates a second store.
- Absolute or alternate relative primary links refuse before task publication.
- An exact relative **Episode** link into the derived store can be dangling
  before first clone and after cleanup. Provider detection still rejects Beads,
  dual providers and malformed evidence before any clone. A competing built-in
  Backlog config is only temporary fallback; post-materialization native
  discovery must select the exact derived published store.
- Native folder filename selection is shared with Episode and primary cleanup
  proofs, so accepted `config.yaml` does not become an unusable prepared result.

## Native disposable proof

The workspace suite retains its existing bootstrap case and adds six matrix
cases: `backlog/`, `.backlog/`, and `planning/task store/`, each with snake_case
and camelCase directory keys and native `.yml`/`.yaml` folder configurations.
Each matrix fixture starts with an **already independent published task history**
and real existing clone, two task commits, active/completed/archive records, a
distinct same-ID archived prefix probe, an ignored attachment and whole native
settings. No task record is adopted from the code DAG.

The assertions cover exact config/record bytes, IDs and native views/settings,
original task commits, clone Git identity, exact non-force-published task head,
unchanged code HEAD/index, explicit root selection against a conflicting built-in,
repeated primary/native reads, linked Episode prepare/reuse/cleanup/reprepare,
and refusal of invalid/dangling primary links. Separate absent-clone Episode
cases retain canonical dual/malformed-provider and malformed target-Backlog
refusals. A separate case retains canonical Backlog precedence over stale linked
Beads bytes; those bytes are not a second selected provider after cutover.

The initial review found an early dangling-target return that skipped provider
checks. It was corrected before publication: project identity and all existing
provider refusals run before the special expected-dangling allowance. The
regressions explicitly cover the mistake; no native proof is inferred from
source review.

## Validation

Final production source SHA-256:
`3dc1ceb830a0c351715fbfaa045d390904368a1a876455d48fec5bd1bb554344`. Source bytes did not change after the mandatory
final-source probe. Final native tests did not change after the corrected run
began; only documentation and task prose were updated afterward.

1. `scripts/test-tier1.sh --probe`: exit **0**, run
   `20261030T054806Z-53322-cf6e42fc`.
2. `python3 -m pytest tests/test_task_history_workspace.py -q -m container`:
   **1 passed, 1 deselected in 286.59s**, run
   `20261030T055527Z-75510-0b8aa5ce`. Full native Node suite:
   **76 passed, 0 failed/cancelled/skipped/todo**.
3. Final combined regression:

   ```sh
   python3 -m pytest tests/test_task_history_workspace.py tests/test_backlog_destination_layout.py tests/test_task_providers.py tests/test_project_initialization.py::test_project_initialization_node_suite -q -m container
   ```

   **7 passed, 4 deselected in 433.07s**, run
   `20261030T060104Z-92498-8e52ba8d`. The four deselected tests are
   host-safe checks, not filtered Node cases. This includes the complete
   76-case workspace suite, all five native layout cases, four existing
   provider/admission/ownership bridges and initialization/reconciliation.

All three final manifests passed with no failure codes, network verified absent
and builder/runtime teardown clean absent. Host-safe inventory/documentation
checks passed **6 tests, 6 container bridges skipped** in 0.04s. No host/global
candidate apply, check, plugin probe or live store operation was run.

- Mandatory manifest: `.test-results/20261030T054806Z-53322-cf6e42fc/tier1/manifest.json`.
- Corrected native manifest: `.test-results/20261030T055527Z-75510-0b8aa5ce/tier1/manifest.json`.
- Final combined manifest: `.test-results/20261030T060104Z-92498-8e52ba8d/tier1/manifest.json`.
- Final workspace TAP: `.test-results/20261030T060104Z-92498-8e52ba8d/tier1/task-history-workspace-node.tap`.
  SHA-256 `ee4b0a9d9d5467b471fb4bd1fc0b28ebb8a4a990d6e40ffb07e63eda0b78156d`.
- Final layout TAP: `.test-results/20261030T060104Z-92498-8e52ba8d/tier1/backlog-destination-layout-node.tap`.
  SHA-256 `fd42492093b75b7bfe0621833298df89a781b53c0bf1912728e2f59751c38932`.
- Final repository content SHA-256:
  `407fc6089cd5a3c1177e1bd7a7044c39d37fc45830727e4fd8120590ad58c3ec`.
- Final runtime image: `sha256:db4ec7c45288a1db95fa386f8e8e94c98be7a06dd8fa562d37b290c04255469c`.

### Earlier failures and superseded evidence

The first bridge, run `20261030T054509Z-43868-3f0f11a9`, failed during disposable
source-builder setup, before Node, plugin or runtime. Its final manifest records
`setup-or-body-failed`, `builder-teardown-command-failed`,
`builder-teardown-not-absent` and `builder-receipt-invalid`; the separate
`source-build.json` records `builder-failed`, null release/image and
absent/clean/not-needed builder teardown. Runtime teardown was absent/clean,
but builder evidence was contradictory and network absence was **not proven**.
The fixture preserved its share instead of claiming safe ownership cleanup.
Cause is not established. No driver/configuration/upstream repair or failure
waiver was made. Later isolated runs supplied valid complete proof.

The first actual full workspace run `20261030T054940Z-58305-18177064`
returned **66 passed, 9 failed, no skipped Node tests** (one Python bridge failed
in 270.24s). Its final receipt records `tests-failed`, offline network absent and
clean absent builder/runtime teardown. Exact failed TAP:
`.test-results/20261030T054940Z-58305-18177064/tier1/task-history-workspace-node.tap`.

Six fixtures expected repeated cleanup to return a nonexistent `absent` result;
the supported API returns `cleaned` for its idempotent absent-store no-op. Three
fixtures incorrectly treated stale linked Beads metadata as selected authority
under a canonical sole Backlog provider. `detectTaskProvider` intentionally
ignores historical linked Beads after cutover. The dual fixture correctly
refused the conflicting target Backlog store for a different reason than the
fixture expected. Tests now prove canonical dual/malformed-provider and malformed
target-Backlog refusal before clone, plus unchanged canonical Backlog precedence
over stale linked bytes. Only tests changed; no production guard, source code or
provider policy changed to make these cases pass. Both corrected full runs are
unfiltered and retain every case.

Earlier mandatory probes `20261030T054041Z-30482-6cd1b268` and
`20261030T054509Z-44034-5ebad13c` passed against superseded source. They are not
certification of the final provider-order fix; the final-source mandatory probe
above supplies that evidence.

## Limits and unfinished work

This is root-config preservation through **existing independent workspace
preparation**, not complete initialization or migration normalization.
`backlog/` stays at its current path in this slice. The full task still requires
default-only relocation to `.backlog/` plus root symlink in both initialization/
installation (including Backlog-only) and migration. Ordinary/grandfathered
stores and fresh no-evidence bootstrap behavior are unchanged.

Populated/code-tracked adoption, disconnected-DAG history preservation, native
cross-branch completeness after relocation, full active-owner integration,
one-way migration admission, explicit Beads source beside Backlog, populated
imports/allocation/provenance/relations/receipt and verified publication before
retirement remain unfinished. Later initialization skill/text-patch work also
remains unfinished. Accepted retiring-source/status/archive/runtime/ownership/
drift and strict ordinary active-Beads/dual-provider protections remain in force.
No full-task AC, merge, deploy, global/live-store/config/model/upstream/lifecycle
or new Episode authority follows from this candidate.
