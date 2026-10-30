# PRIMECLAW-44 Slice 1g: migration-only source inspection admission

## Bounded change

The two public migration entry points now refuse every destination other than
Backlog before project lookup or native commands. This is Beads-to-Backlog only.
Existing pair-specific helper implementations are retained, not redesigned.

Read-only migration inspection can identify the exact Beads source alongside
valid default `backlog/`, hidden `.backlog/`, or root-config-selected custom
Backlog evidence. It uses the existing explicit native provider read only when
ordinary discovery reports valid dual providers. Every other malformed-provider
refusal stays intact. A sole Backlog provider is not silently treated as Beads.
The complete accepted as-is Beads capture remains unchanged: native identity,
version/catalog, full inventory/export, task views/history/events/provenance,
used-status/archive preflight and stable `capture-sha256` confirmation token.

Ordinary provider discovery still refuses dual providers. Active Beads lifecycle
capability checks remain strict. `task-providers.ts` is unchanged.

## Inspection is not destination import permission

Confirmation keeps the existing exact source revision comparison and exact
same-destination retry gate. **Populated destination preservation/import is not
implemented by this slice.** Existing default/custom destinations still refuse
before preparation because the currently required exact `.backlog` retry store
is absent. Existing hidden destinations must still satisfy their publication
and exact same-migration contents. No destination guard was bypassed and no
second store, fresh defaults, task recreation or preservation approval was added.

Default-only normalization in both initialization/install and migration,
ordinary/code-tracked or populated-store adoption, disconnected history/native
cross-branch completeness, full active-workspace integration, populated import
baseline/allocation/provenance/relations/receipt work and later initialization
skill/non-mutating text comparison remain unfinished. No acceptance criterion
is checked. No live project/provider, global activation or lifecycle operation
is authorized or performed here.

## Disposable native coverage

New native cases cover default, hidden and custom-with-spaces destinations,
whole native configuration (including camelCase directory selection), existing
active/completed/archive records plus a distinct archive sharing an active ID,
existing native task views/IDs, two Git revisions, exact code HEAD/index/history,
unchanged source configuration/catalog, repeated stable complete source capture,
strict ordinary discovery and active Beads capability checks.

Matching confirmation tokens reach the unchanged destination guard. Wrong tokens
refuse earlier. Both leave existing records/configuration/history intact and
never call source deletion or a destination/Git write. Additional cases cover
no-command reverse refusal, malformed Backlog/Beads evidence and unavailable
required native history while both stores coexist.

Twelve historical reverse-only cases are explicitly retired with a named skip
reason because the public direction no longer exists. This is not a name filter
that hides forward regressions. Their private helper implementations are not
removed. The former two-way roundtrip is replaced with a native published Beads
fixture so forward retirement still proves outgoing Dolt history and operator
ignore preservation and ordinary Backlog replay. Forward exact-retry, ownership,
source drift, status/archive, receipt and publication tests remain executable.

## Validation

Production source SHA-256: `c2909e828f356e256f50e816ceb6b7185c55f7c530dee3044fa8089eef0d870e`.
No production bytes changed after the mandatory probe. Final Node and Python
bridge bytes did not change after the passing focused forward proof began.
Only documentation and native task prose changed afterward.

1. `scripts/test-tier1.sh --probe`: **exit 0**, run
   `20261030T063122Z-84121-d55a7640`.
2. Targeted corrected forward-retirement proof:

   ```sh
   python3 -m pytest tests/test_task_provider_migration.py::test_forward_beads_retirement_node_suite -q -m container
   ```

   **1 passed in 119.34s**, run `20261030T065915Z-68578-fe4241b5`.
   Native TAP: **1 passed, 0 failed/cancelled/skipped/todo**. This proves the
   rewritten fixture's actual forward migration, outgoing publication and
   exact surrounding ignore-byte preservation, not merely a mock adapter.
3. Final complete forward migration/source/provider regression:

   ```sh
   python3 -m pytest tests/test_task_provider_migration.py::test_task_provider_migration_node_suite tests/test_beads_retiring_source_capture.py tests/test_task_providers.py -q -m container
   ```

   **6 passed, 3 deselected in 652.02s**, run
   `20261030T070132Z-75700-4ae72459`. This includes the full migration
   suite, independent native retiring-source capture, and all four existing
   provider/admission/ownership bridges. Three deselections are host-safe tests,
   not a filter hiding migration cases.

   Full migration TAP: **44 tests, 32 passed, 0 failed/cancelled/todo,
   12 explicit retired reverse-direction skips**. Every skip names the retired
   direction; all forward and new admission cases run and pass. The rewritten
   forward publication/ignore/Backlog replay case is runnable, not skipped.
4. Host-safe static checks: **5 passed, 9 container bridges skipped in 0.03s**.

All three final mandatory/focused/combined manifests passed with no failure
codes, network verified absent and builder/runtime teardown clean absent.
No host/global candidate apply, check or plugin probe, live migration, lifecycle,
ownership or upstream change was run.

- Mandatory manifest: `.test-results/20261030T063122Z-84121-d55a7640/tier1/manifest.json`.
- Corrected forward manifest: `.test-results/20261030T065915Z-68578-fe4241b5/tier1/manifest.json`.
- Final combined manifest: `.test-results/20261030T070132Z-75700-4ae72459/tier1/manifest.json`.
- Final migration TAP: `.test-results/20261030T070132Z-75700-4ae72459/tier1/task-provider-migration-node.tap`.
  SHA-256 `45f80010d917a0c5837ae49fddaaf3fe6125a1a23a5ad334142aad03cbb3d9c8`.
- Corrected forward TAP: `.test-results/20261030T065915Z-68578-fe4241b5/tier1/forward-beads-retirement-node.tap`.
  SHA-256 `1c86c9ae75c65c004f51108ff1b007615eaa6b8858e18e2765623b11c8710ca0`.
- Final repository content SHA-256:
  `57608005a5eeed9aebc0f200e475ac41e248ab370988c113de70ef47d36d6870`.
- Final runtime image: `sha256:48c053266c6cedbf2cc9ff88b14e42be8bf6b3e8979d6311fa429a4b92eb2362`.
- Final Node test source SHA-256: `4da87a7428fbaf8efd615c003b48ce2b35cf96571a94477b31c5c6e7db463652`.
- Final Python bridge SHA-256: `adfda7a49e780b8a8aa0ab795a0e53bade1083cdd3e26a141e31cc1381335395`.

### Superseded proof and truthful failure chronology

Initial focused admission run `20261030T063308Z-90133-a5996fce` passed
**1 bridge in 156.74s**, native **5 passed, no failed/cancelled/skipped/todo**.
Later tests added final complete recapture, private excludes/remote refs and
missing-Beads refusals. That earlier pass is not proof of those stronger bytes;
the final full run above supplies it.

First full run `20261030T063628Z-1150-5435bfe2` returned **1 failed,
5 passed, 3 deselected in 629.90s**. Migration TAP: **44 tests, 31 passed,
1 failed, 12 explicit retired reverse skips, 0 cancelled/todo**. Every new
admission case passed, including stronger complete final capture and unchanged
private-exclude/ref assertions. The five other native bridges passed.

The rewritten forward fixture replaced native `bd init` root ignore rules
with operator-only bytes. A native read created `.beads.gate.lock` as untracked,
so the existing clean-source check correctly refused. Only the fixture changed:
retain the original native block and append the operator rule.

Second full run `20261030T064811Z-35586-72c291a8` returned **1 failed,
5 passed, 3 deselected in 638.86s**, with the same **31 passed / 1 failed /
12 explicit reverse skips**. The forward migration completed; only final
ignore-byte equality failed. Actual bytes were `\noperator-cache/\n`, while
the fixture expected `operator-cache/\n`. Production correctly preserved a
newline outside the exact removable native block. The fixture now expects
original native input minus only that exact block plus operator bytes,
preserving all surrounding whitespace. No trimming, production change,
clean-source waiver or retirement-guard change was made.

Both failed manifests record only `tests-failed`, offline network absent and
clean absent builder/runtime teardown. Their failed TAP is retained:

- `.test-results/20261030T063628Z-1150-5435bfe2/tier1/task-provider-migration-node.tap`.
- `.test-results/20261030T064811Z-35586-72c291a8/tier1/task-provider-migration-node.tap`.

Neither failure is waived. The corrected targeted proof and complete final
regression pass with unchanged production source.
