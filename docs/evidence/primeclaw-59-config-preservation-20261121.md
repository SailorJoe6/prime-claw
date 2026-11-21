# PRIMECLAW-59: selected-existing configuration increment (2026-11-21)

## Scope and authority

ONE bounded step-3 dependency on accepted current forward/replay code
`4dcd1f3602cfe9c2be298d5adec0c95981d0c969`. Native sizing plan
`abe259f77f2bde191e3854f25cb7ba941fc6ec29`; native audit/implementation checkpoint
`f8b016e065ec9ef16c755444bcf95f5935f8cc4a`. Status stays In Progress, all nine
AC unchecked, Final Summary null. No live provider data, migration/retry/switch,
private incident access, cleanup, merge, activation, restart, resources or
upstream Prime Agent/Backlog changes are authorized or performed.

## Native contract and implemented boundary

Pinned Backlog source `0cf4fdbc70020327f4366a29d3f405f83d180301`, version
1.55.3, audited read-only. `config set statuses` explicitly directs project YAML
list editing; no public append/set list API exists. CLI scalar setters and Web
whole-object PUT reserialize known fields, losing unknown keys/comments. Startup
runs config/prefix/legacy-milestone migration before nominal config/task reads;
no supported read-only bypass exists. Native case/all-whitespace-insensitive
status identity selects the first configured spelling. Final configured status
is terminal. Native auto_commit=true creates real per-operation Git commits;
there is no task CLI no-commit override, and it is not disabled here.

Only migration-specific workspace/retry/active-layout/final-target checks accept
actual config rather than ordinary fresh-init lifecycle/default/autoCommit
settings. A pre-native guard stops unproven legacy startup cases intact. Add only
mapped-current/bookkeeping status misses, preserve original order/spelling and
terminal, and never normalize unrelated settings or Beads config. Explicit
memory USER In Design is retained, not changed to the selected default.
Supported bounded preparation: JSON-compatible one-line flow (including trailing
comma) or complete simple scalar block list, native-supported YAML list editing
only. Flow retains raw old syntax; block conversion rejects dependent/ambiguous
forms and implicit scalar guesses. No whole-config serializer or invalid UTF-8
rewrite. Prepare BEFORE the single owned server starts, then require its exact
JSON startup status list proof before task allocation. Native cached GET/lazy
watcher behavior makes hot reload unreliable; comments are not removed to force
it, no second server starts, and upstream/accepted transport remain unchanged.
Unsupported native forms can continue untouched only when no addition is needed.
Existing receipt/import replay never automatically repairs config. Failures
retain actual partial state/config with no write resend, fallback, rollback,
provider cleanup or source retirement.

The old in-memory baseline allows ONLY computed status bytes and config-history
entries holding that exact delta and unchanged native mode. All other original
files/records/IDs/bytes/modes/paths/history, clone identity/Git config and placement
stay strict. Original ancestry remains. No journal, reset/rebaseline-all,
coordinator or API was added.

## Validation — final source passed; intermediate failures retained

Initial selected-existing snapshot: **0 PASS / 5 FAIL**, all during fixture setup
because its ignore-file replacement exposed `.beads.gate.lock`. The fixture now
appends its ignore to existing bytes. Original cleanliness checks are unchanged.
Saved run `20261121T152241Z-24263-0e301a3a`, `focused-native.log`; pytest 1 FAIL,
12 deselected, 209.51s. Required initial probe **PASS**, run
`20261121T152241Z-24521-4cd4add7`, 171.64s; this predates final source repairs and
is NOT final-source evidence.

The native read-only audit identified two concrete BLOCKs, both repaired before
final validation: pre-native guard missing on dirty-layout replay; and incomplete
block-node recognition that could leave multiline YAML dangling or erase an
anchor used by an unknown setting. Replay now guards before first destination
native read. Conversion now proves the entire simple scalar sequence before
writing; two native refusal fixtures preserve complex config exactly. The audit
also identified first-value semantics: additions now insert before the last old
status, preserving first value on multi-status lists, old relative order and
terminal. Flow splice retains raw old syntax, quoted commas and trailing commas.
These are bounded repairs, not a general YAML parser or new policy.

First full/shared snapshot `20261121T152856Z-51046-c058dddc`:
**60 migration PASS / 18 FAIL / 12 retired-reverse SKIP** (90 checks);
**232 shared PASS**: current20, Web10, workspace89, initialization88,
activeBacklog12, destination-layout13. Pytest **1 FAIL / 6 PASS / 21 deselected**,
1067.48s. Most migration failures share a concrete candidate regression: the new
config guard tried Git/provider discovery inside the existing disposable
config-only root-config check. There is intentionally no Git repository there.
Repaired by separating a private exact-known-path native config check from the
live-store selection wrapper; only that existing scratch path uses it. Live
selection/pre-native/original-preservation rules are not relaxed. Two complex
block tests now require the actual simple-sequence refusal, not a generic config
error that could falsely pass an earlier failure.

Candidate probe **PASS**, `20261121T152856Z-51125-3941cf1a`, 128.54s, but it
predates this final source repair and is not final-source evidence. Scratch-repaired focused run
`20261121T154653Z-25796-279ae724`: **8 current/replay PASS**, **5 config PASS / 2
FAIL** (15 checks); pytest **1 FAIL / 1 PASS / 11 deselected**, 331.93s.
Both missing-status cases stopped safely because the owned server never observed
the config change. Startup caches config; GET config does not initialize lazy
watchers (`server/index.ts:385–393,1523–1529,277–327`). The watcher also rejects
valid inline config comments (`utils/config-watcher.ts:49–69`). Waiting longer,
dropping comments or a whole-config setter is not a correct fix.

The bounded repair prepares the supported YAML list BEFORE starting the one
owned server, then proves its exact native JSON startup list before allocation.
It needs no accepted transport/upstream change, second process or serializer.
Required scratch probe `20261121T154653Z-26055-a2c4f58c` **PASS**, 136.03s, but
predates this preparation-order source repair. Final startup-preparation focused run
`20261121T155822Z-73271-eca77be7`: **7 config PASS / 0 FAIL**;
pytest **1 PASS / 12 deselected**, 251.73s. Required final-source probe
`20261121T155822Z-73518-5495b5ba` **PASS**, 136.16s. Static **2 PASS / 11 SKIP**,
0.02s. All four candidate input hashes match
`startup-preparation-input-hashes.json`. No plugin/test source changed afterward.

Final full/shared run `20261121T160317Z-94203-94a68ac5` **PASS** on unchanged
plugin/test source. Pytest **7 PASS / 21 deselected**, 1250.26s:

| Native suite | PASS | FAIL | SKIP |
| --- | ---: | ---: | ---: |
| Full provider migration | 78 | 0 | 12 retired reverse |
| Current readable projection | 20 | 0 | 0 |
| Owned Web transport | 10 | 0 | 0 |
| Task-history workspace | 89 | 0 | 0 |
| Project initialization | 88 | 0 | 0 |
| Active Backlog initialization | 12 | 0 | 0 |
| Destination layout | 13 | 0 | 0 |

These are **310 native checks PASS / 12 SKIP**, not 310 migrations or all-task
acceptance. The separate focused7 run repeats coverage; it is not added to the
unique final full/shared count. Large meaningful 2,610,950-byte current input,
complete receipt/current replay, current/source drift, original preservation,
active continuity, publication and guarded cutover remain in the passing suites.
The same-owned-server startup status proof passes actual missing flow/block
imports, including preserved true auto_commit/native commits, unknown config,
comments, custom default, comma-bearing status/type/priority and exact originals.

All **148 artifact SHA-256s across nine retained runs** match their manifests.
Every runtime was offline; runtime and builder teardown are clean; the upstream
builder checkout inventory is unchanged. The four candidate input hashes below
match before focused/probe, after final regression and before publication.
`source-manifest.json` describes the upstream runtime build source, not this
four-file plugin/test hash list. No upstream source was edited.

Evidence: `.test-results/primeclaw59-config-preservation-20261121/`, especially
`final-full-native-shared.log`, `startup-preparation-focused.log`,
`startup-preparation-probe.log`, `candidate-static.log`,
`startup-preparation-input-hashes.json`, `final-manifest-verification.json`.
Each run's `tier1/` retains TAP, build/runtime metadata and manifest. Intermediate
failures above are retained honestly and are not replaced by the final pass.
No independent owner/Expert acceptance of this increment is claimed.

Reproduction (existing explicit source-build `TIER1_ENV_FILE` selector;
`BUILDX_NO_DEFAULT_ATTESTATIONS=1`; disposable Docker only):

```sh
python3.14 -m pytest tests/test_task_provider_migration.py tests/test_task_history_workspace.py tests/test_project_initialization.py tests/test_backlog_destination_layout.py -q -m container -k "task_provider_migration_node_suite or beads_backlog_current_node_suite or migration_backlog_web_node_suite or task_history_workspace_node_suite or project_initialization_node_suite or project_initialization_active_backlog_node_suite or backlog_destination_layout_node_suite"
python3.14 -m pytest tests/test_task_provider_migration.py -q -m container -k selected_existing_configuration_node_suite
scripts/test-tier1.sh --probe
python3.14 -m pytest tests/test_task_provider_migration.py -q
```

### Candidate input SHA-256

- `src/prime-agent-plugin/extension-support/task-provider-migration.ts`: `05073cac890ec7b74ccfe5aae60437ac9acc7efe7eca7fab33034d24e228cc70`
- `src/prime-agent-plugin/extension-support/task-history-workspace.ts`: `2a4076f5c292759cc22c6a048f9d1574bb451864a2b2799bff70dbb7931d9599`
- `tests/task_provider_migration.test.mjs`: `e2ecc4f1ac4f9437d30e00ac0571919977de3a9c87ce7d9e260706e48eea69d4`
- `tests/test_task_provider_migration.py`: `f2f712aa0d271b1a62d04af22eb047f0368015991836ef12858ba257ee293cb2`


## Limits

This is not universal YAML compatibility. Unsupported edit forms, unsafe native
startup schemas/legacy milestones, or an absent required Done needing native
terminal placement resolution stop without automatic normalization. No parked
legacy-config/original-store consolidation, harmless same-ID archive/live
coexistence, interrupted reset/recovery, responsive ordinary cancellation,
progress, 406-ticket scale or full-task acceptance is claimed. Existing
uncertainty, source/current drift, publication, ownership/active continuity,
full current verification and guarded cutover boundaries remain required.

## Review boundary

Publish this one code slice separately from native task progress, then stop for
independent owner review. Passing fixtures do not authorize a live migration,
next slice, lifecycle finalization, merge, global activation or restart.
