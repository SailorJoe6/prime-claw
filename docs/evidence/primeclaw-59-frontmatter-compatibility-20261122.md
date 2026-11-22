# PRIMECLAW-59: Backlog handle compatibility in migration preflight

## Bounded correction

An unrelated live/archive pair can contain Backlog-supported unquoted `@`
handles. The published preflight parsed the whole frontmatter with generic
YAML and blocked on this metadata before it could inspect `references`.
Backlog 1.55.3's pinned reader (`0cf4fdbc70020327f4366a29d3f405f83d180301`,
`src/markdown/frontmatter.ts`, `preprocessFrontmatter`) and its native tests
(`src/test/markdown.test.ts:197–240`) establish the supported syntax.

The migration preflight still inspects the parsed `references` field. On a
YAML reserved-scalar-start error pointing to `@`, it retries on a read-only
copy with supported handle metadata quoted on `assignee` and `reporter`
lines. If no compatible normalization applies or parsing still fails, the
error propagates. The preflight neither rewrites the record nor treats a title
or handle as a reference. The vendored YAML bundle, marker/refusal checks,
receipt handling, and native allocation are unchanged.

The regression fixture adds an unquoted scalar assignee and reporter to the
live record and a mixed unquoted/quoted inline assignee list to its archive
counterpart. The corrected fixture verifies original paths, bytes, modes and
history, native singleton/import views, and allocation of the next free ID.
The focused suite also retains genuine-reference and receipt-bound memory USER
refusal before destination writes or retirement.

## Validation by source

| Stage | Tier-1 run | Result |
| --- | --- | --- |
| Published code `7cf8657` plus the extended fixture | `20261122T163034Z-23926-fd54ef3c` | 12 native passes; the selected-store case failed on the archive record's unquoted inline handle, with zero native writes or retirement calls in that case. |
| First unpublished guard | `20261122T163542Z-36806-617ecc6a` | 12 native passes; the selected-store case failed with `Right-hand side of 'instanceof' is not an object`. The vendored outer entrypoint exports `parse`, not its internal error constructor. The chained probe did not run. |
| Corrected focused source | `20261122T164036Z-59588-91a2e016` | 13 native passes, no failures or skips; one pytest pass in 281.63 s. The guard checks the thrown error's name, code, and source position rather than an unavailable export. |
| Corrected source probe | `20261122T164518Z-74575-99adf60c` | The required tier-1 probe passed. |

Both passing runs share repository digest
`8e772ad95d886e24cff667c188fe5f811eaaa7fb21e65959359c7f1d021c8897`.
Their manifests attest to offline execution, clean runtime and source-builder
teardown, and unchanged upstream checkout inventories. All 30 listed final
artifacts and all 223 recorded repository inputs matched after restart and
at publication. This evidence document was added after validation; the three
tested files were unchanged.

## Reproduction and evidence limits

The runs used the standard read-only source-mode `TIER1_ENV_FILE` (Prime Agent
source `a1faacd53ac4473a75de1d434afaf50945c2f647`; selector file SHA-256
`892c87ebc2050d9849e1571bce2bbb4abe766efde87793c650fc1b3e1d7ac2f1`). The Python bridge selects the Node tests matching
`same-ID coexistence|migration admission refuses contested Backlog IDs`.

```sh
python3.14 -m pytest -q -m container \
  tests/test_task_provider_migration.py::test_same_id_coexistence_node_suite
scripts/test-tier1.sh --probe
```

Run manifests, TAP, network and teardown records are under
`.test-results/<run>/tier1/`. The logs, `final-corrected-input-hashes.json`,
and `maintenance-PA-TASK5-20261122-MAC.json` are retained under
`.test-results/primeclaw59-frontmatter-compatibility/`.

The [previous revision's broader runs](primeclaw-59-coexistence-revision-20261122.md)
(218 passes, 12 skips) qualify the previous source only. The cause of its
incomplete `F` remains unknown. Ownership test #83 has static comparison only
and remains outside this correction. This evidence is not a full-project pass,
task acceptance, live migration, activation, or merge.
