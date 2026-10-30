# PRIMECLAW-44 integration evidence — work in progress

This is not a full-candidate pass or acceptance report. The sole approved
contract is the exact native PRIMECLAW-44 task. All ten full acceptance criteria
remain unchecked. No live migration, global apply/restart, or merge occurred.

## Superseding operator semantics

Archived means deleted/history. Actual tasks/completed alone are dependency
targets. Archive-only targets refuse; archive/live same-ID reuse is valid.
Archive bytes/paths/IDs/config/history and native allocation remain unchanged.
The old BACK-658 expectations and Slice 1h blocker interpretation are historical,
not current policy. Their failed runs and rolled-back patch remain retained.

## Native dependency subcandidate — independent review pending

Isolated source: `/tmp/primeclaw-backlog-dependency-znh_2m8d/Backlog.md`.
Exact clean source-only commit: `2b6b4b283d6381a9ccbffe7728ec356457568962`.
Base: `5d556c1954f7724abd180f6211cf528e9253ad4c`.
Stable ancestor: `v1.53.0` / `fd20f71493fb4eda44b021aa89f257956f17fb71`.
No fork push, builder pin, or Docker integration proof yet.

Reported native results: 113 focused tests and 102 compatibility tests passed;
build/compiled smoke, type checking and Biome passed. Initial four obsolete-policy
failures were explicitly revised under the approved semantics; initial formatting
failure was repaired. Full native suite is still running. It reported one MCP
search `getRepositoryRoot` tripwire failure (expected zero calls, observed one);
search-content assertions passed. Exact test and full MCP module reruns passed
on both candidate and unchanged base (module: 39 tests, 232 assertions each).
This does not make the original full run green or establish a root cause.
No unrelated watcher/test source was patched.

## Builder integration — uncommitted and not yet Docker-validated

Parallel source work covers global skill/text patch review, history-preserving
layout normalization, populated import/baseline/receipt/counts, invalid source
graph preflight, and exact active-Episode projection/bookkeeping. Source syntax
or static checks are not native end-to-end proof. Mandatory Docker Tier1 and
all affected native container suites remain required on coherent final source
with the exact reviewed native fork pin.

## Initial host-safe static checks — retained failures

Command:
`python3 -m pytest tests/test_backlog_build.py tests/test_backlog_workflow.py tests/test_global_asset_drift.py tests/test_project_initialization.py tests/test_prime_agent_plugin_install.py -q -m "not container"`

Result: 25 passed, 3 failed, 39 deselected (6.09s).
Log: `/tmp/primeclaw44-integration-static.log`.

- Historical live-data test incorrectly required archive IDs to be unique with
  live IDs. Current eligible records and every physical historical record are
  now kept separately; receipt lineage remains checked across physical history.
  No task/store data was removed or renumbered.
- A fixture-native lifecycle test could not find this linked worktree's
  `deps/backlog/dist/backlog`; its submodule is not initialized yet. Do not
  treat this as integration success or substitute a global binary. The exact
  reviewed source pin and documented local candidate build remain required.
- The project-asset test assumed only three customized assets. Unchanged HEAD's
  manifest also records customized retained implement-prep/implement-spec
  workflows. Preserve their actual bytes/manifest; update only precise test
  expectations after verifying that historical evidence.

No failed run or assertion is silently discarded. Final results, artifact
hashes, native source review/publication, complete-candidate checks and remaining
limits must be added before this document can support a completion claim.

## Native full-suite failure comparison — still in flight

The full run later reported Core non-finite ordinal append and TUI mover
failures. Exact affected mover-module reruns fail on both candidate and unchanged
pinned base with the same eight TUI persistence/preview tests: each 36 passed,
8 failed, 1 error. Logs: `/tmp/backlog-movers-candidate.log` and
`/tmp/backlog-movers-baseline.log`. The non-finite ordinal case passes in those
module reruns; its full-run stack included web fetch/jsdom Event errors. This
is failure context, not an established root-cause diagnosis. No unrelated
implementation changes were made; the original full failure remains visible.

## First Docker checkpoint — not the final native-pin integration

- `scripts/test-tier1.sh --probe`: exit 0, run
  `20261030T172451Z-59770-85a7cafc`; loading/discovery/checks passed, network
  absence and clean absent runtime teardown recorded. This snapshot still uses
  old native pin `5d556c1` and predates final layout edits. It is not proof of
  new native dependency semantics or the complete final candidate.
- Parallel initialization/install container batch: exit 1, 39 setup errors
  from one pre-runtime source-builder failure, run
  `20261030T172832Z-71159-875b9b64`. No behavioral tests executed. The source
  receipt records `builder-failed`, no builder image/container ID, unchanged
  readonly source checkout inventory, and clean absent builder. The fixture
  also records secondary builder-receipt/teardown validation failures and
  preserves share evidence; runtime teardown reports absent. Do not claim
  offline runtime proof for a runtime that was never installed/launched.
  Cause is unestablished. No Prime Agent, harness, or plugin patch is inferred.

All declared artifact hashes in both manifests were checked. The failed manifest,
source receipt and share remain retained. A later fresh serial run is separate
validation, not permission to erase or relabel this failure.

## Independent native review — required bounded repair

Review of exact native `2b6b4b283d6381a9ccbffe7728ec356457568962` found the local
validator/cycle/doctor change consistent with the approved corpus, but one
interactive draft-list reporting consumer still resolves relationships from
displayed drafts instead of actual tasks/completed. A legacy DRAFT-2→DRAFT-1
edge incorrectly resolves/traverses; an actual TASK-1 target incorrectly appears
missing. Parent accepted this concrete in-scope finding and requested a narrow
separate reporting corpus plus focused regression. No unrelated TUI mover fix
or new reporting framework is authorized. Revised exact-commit review and
builder pin integration remain pending.

## First native layout run — concrete failures retained

Run `20261030T172832Z-71145-f48ec432` executed the native suites and failed
both Python bridges (393.71s). Layout TAP: 13 cases, 5 passed and 8 failed.
Every new ordinary adoption/active projection/root-override path reached an
unsupported Git invocation: `check-ignore -z` without `--stdin` (Git refuses
with "-z only makes sense with --stdin"). The workspace TAP had one failure:
conflicting target root authority still refused before mutation, but returned
`config-not-preserved` instead of expected `unsafe-store-location`. The worker
is investigating the exact classification/order rather than blindly rewriting
the expectation. All failed TAPs/manifests remain retained; runtime network
absence and clean absent teardown are recorded, and every declared artifact
hash was checked. No source safety check or original task data was waived.

## Revised native candidate — bounded review complete, not final integration

Exact native source `431e95612d6167e418c507ec206d95df43c38c54` closes the
accepted interactive draft reporting finding. Independent follow-up found no
concrete introduced material defect. CLI/unified/viewer retain draft display
while loading actual tasks/completed separately for dependency reporting.
Ordinary task-viewer merge behavior remains unchanged. New focused cases: 19
passed; combined focused: 148 passed (579 assertions, 9 files); compatibility:
102 passed. Type, Biome and versioned build/compiled smoke passed. Original
full-suite failures remain recorded; the revised full suite was not rerun.
Fork branch publication and exact builder pin are now authorized under the
operator's existing narrow correction direction, not merge/global activation
or full PRIMECLAW-44 approval. Docker native integration still remains required.

## Published exact native pin and local build

Native fork commit `431e95612d6167e418c507ec206d95df43c38c54` is published
at `https://github.com/SailorJoe6/Backlog.md`,
`refs/heads/fix/primeclaw-44-dependency-eligibility`. The initial HTTPS push
failed with permission denial and a fresh direct ref remained absent. One
separately authorized push through this Episode's existing configured SSH
transport succeeded; fresh direct reads by worker and parent proved the exact
hash/ref. No authentication/configuration writes or credential-store access
were used. Neither merge nor global activation occurred.

All six commit literals in five builder files and the Episode gitlink now point
to that exact reviewed commit. The Episode dependency Git directory is distinct
from the canonical primary dependency. `scripts/build-backlog.sh` passed
(exit 0), with frozen-lockfile install, stable `v1.53.0` ancestry, compiled
versioned build and smoke checks. Local candidate artifact is under the Episode
`deps/backlog/dist/`; the canonical primary/global artifact is untouched.
Log: `/tmp/primeclaw44-pinned-native-build.log`. Native task reread by that
candidate preserved all authored fields, path/status/ten unchecked AC exactly.

The new-pin combined-source mandatory Docker loading/probe run is now running;
no result is claimed yet. After it settles, run the affected suites in one
serial Docker fixture session. Earlier failed logs/TAPs and full-native-suite
failures remain evidence, not waived or relabelled.

## First exact-pin Docker attempt — ancestry fetch defect, retained

`20261030T174822Z-30175-014bd10d` failed before runtime launch. The readonly
Prime Agent source builder passed. Setup stopped at `image-build-started`;
manifest records `primary-command-failed`, runtime absent/clean, no offline
runtime proof. Declared artifact hashes were verified.

The tier-1 Dockerfile still fetched the exact Backlog commit with depth two.
The exact reviewed chain is `431e956` → `2b6b4b2` → `5d556c1` → stable
`fd20f71` (`v1.53.0`). A disposable native Git reproduction using the exact
Dockerfile fetch/checkout/tag commands proved depth-two `merge-base
--is-ancestor` exits 1 (missing middle ancestry), whereas depth four exits 0
for the SAME published pin and stable tag. Corrected only the tier-1 fetch
depth to four; exact HEAD equality, stable-tag gate, frozen lockfile and
compiled smoke checks remain. Added the static pin/fetch regression. The
runtime Dockerfile copies the exact preflighted local vendor source and has
no corresponding fetch to change. No pin, tag, task semantics or acceptance
check was relaxed. Original failed manifest and readonly source receipts
remain retained; the corrected Docker run will be separate evidence.

## Corrected exact-pin mandatory Docker probe — PASS

Run `20261030T175251Z-41813-809b316f` passed
`scripts/test-tier1.sh --probe`. Exact source pin remains `431e95612d6167e418c507ec206d95df43c38c54`.
Immutable image: `sha256:f161843fca962ddf3b3f354e685b38692b6ff97ce7b1b1e4ccfe4795bfa99fd1`. Offline
loading/discovery/apply/check/RPC probe passed; network absence and clean
absent teardown verified. Every declared evidence artifact hash was checked.
The first depth-two failure stays retained. Host-safe affected regression
passed: 24 tests, 17 container tests deselected, 4.81s
(`/tmp/primeclaw44-final-static.log`).

Next is one serial fixture session with 47 selected Python container tests
(11 non-container tests deselected), including the full migration Node suite
once rather than repeating its focused subset wrappers. It covers workspace,
layout, textual comparison/recovery, skill delivery, retiring-source capture,
provider/admission/ownership protection, all seven populated classes and active
code-tracked owner continuity. Collection is not behavioral acceptance; results
remain pending.

## First combined container run — replay defect, retained

Run `20261030T175752Z-55087-35b0867a`: one Python bridge passed, one failed,
11 non-container tests deselected, 381.09s. `-x` stopped at the first failed
Python bridge; remaining text/install/source/provider/migration suites did NOT
execute and are not acceptance evidence. Workspace TAP: all 79 cases passed.
Layout TAP: 10/13 passed, three failed only on explicit replay after successful
initial preservation (already-hidden root authority, custom root authority, and
custom root authority differing from inactive folder config). Initial native
IDs/configuration/history/index assertions passed before those replay calls.
The replay calls return `blocked` instead of `prepared`; assertions currently
omit the returned reason. A concrete in-scope replay investigation is assigned;
no expectation, source integrity, publication, or cleanup check is waived.
All declared artifact hashes, offline network proof and clean absent teardown
were verified. Original TAPs/manifests stay retained.

## Bounded replay correction — implemented, native rerun pending

Root cause: in-place hidden/custom adoption removes original selected-store
entries from the code index. Replay's unconditional `diff HEAD` then mistakes
those expected staged deletions for uncommitted task edits. Default relocation
did not hit that branch because its new `.backlog` path differs from old
`backlog` history. The correction recognizes only a real independent `.git`,
an already-proven exact relative native root link, zero remaining code-tracked
store entries, no worktree-vs-index store edits, and no staged non-deletion
changes. Existing clone/config/remote/ancestry/publication/clean-state proofs
still execute. Dirty ordinary stores and unsafe root authorities stay refused.
No baseline service, persistent projection authority or blanket dirty bypass
was introduced. Replay expectations remain `prepared`; assertions now include
JSON diagnostics and verify unchanged code HEAD/all index entries, exact same
task-history head, and complete native path/byte maps.

The next single fixture rerun puts layout first, then the full migration Node
bridge, followed by workspace and remaining text/install/source/provider
suites, retaining all 47 selected tests without duplicate focused wrappers.
`pytest -m container` also supplies mandatory Tier1 validation for the changed
plugin source. No new result is claimed before completion.

## Replay-corrected combined run — migration failures retained

Run `20261030T180920Z-84761-57f722e2`: layout all 13 passed, including
strengthened replay invariants. Full migration TAP: 53 cases, 30 passed,
11 failed, 12 explicit retired reverse-direction skips, 525.26s. Python
stopped at that bridge: one passed/one failed, 11 deselected, 709.83s;
remaining workspace/text/install/source/provider bridges did not execute.
Every declared artifact hash, offline network proof and clean absent teardown
was verified. No full-suite-green or full-task acceptance claim.

All four independent populated classes passed (hidden/default/custom/custom
root override), including preservation/import/receipt checks. Code-default
failed trying to clone the retired pre-normalization `repo/backlog` path for
archived reads. Code-hidden/custom fixture setup read nonexistent folder
`config.yml` before migration. Native archive-only refusal was correct but
its diagnostic uses "do not exist", absent from the test's singular regex.
Four ordinary closed-import completion cases failed; receipt/publication hooks
and deletion-refusal retry checks also failed before expected milestones.
Those causes remain under concrete investigation, not automatically attributed
to the native fork or dismissed as fixture errors. Migration worker owns
bounded production/fixture repairs; native worker independently checks exact
completion behavior versus base with disposable native-only fixtures. No
semantic mapping, ID allocation, capture, publication or safety waiver is
authorized by these failures. All failed TAPs/manifests remain retained.

## Concrete migration repairs — native diagnosis and chronology correction

Native-only diagnostics compared exact `431e956` and unchanged `5d556c1`,
both reporting version 1.53.0. Four valid parent/Done-child/ordinary-Done
candidate/base cases show the same result: native initialization creates an
empty `completed/`; Git cloning drops that empty directory; task completion
then fails, and the SAME command succeeds after only recreating that directory.
Native-initialized controls succeed. `completeTask` bodies are byte-identical.
Evidence: `/tmp/backlog-completion-diag-nyxtwyeo/REPORT.md` and `commands.json`.
An invalid exploratory init remains logged but is excluded from those controls.
This identifies a builder preparation regression, not an eligibility-fork
regression. Migration again creates only its previous `tasks`, `completed`,
and `archive/tasks` directories. Native source/pin/CLI/lifecycle are unchanged.

**Correction to the earlier path hypothesis:** the code-default archive read
failed BEFORE adoption because an ordinary selected-store subdirectory was
treated as a Git repository. A post-rename stale source was not established.
Archive reads now use native `rev-parse --show-toplevel`, refusing unless its
realpath equals exactly the primary root or selected store. The original failed
TAP is untouched. Hidden/custom fixtures now use the native detector's selected
config evidence and capture inactive folder config only when present. The
archive-refusal regex accepts the observed native plural "do not exist"; exit
refusal, exact target and unchanged-source checks remain.

A possible failed-deletion explicit-replay problem remains only a hypothesis.
No speculative retry change, early normalization publication or persistent
state was implemented. The next full run will exercise that existing case
with concrete completion fixed, retaining its expectations and final-publication
order. This run will not stop at the first Python failure, so previously
unexecuted text/install/source/provider suites also produce actual results.

## Full affected regression actually executed — 45 passed / 2 failed

Run `20261030T183340Z-60782-635fda38`: all 47 selected Python container
tests executed (11 non-container tests deselected), 45 passed and 2 failed,
1236.87s. Native source capture, provider/admission/ownership, global skill
installation, project initialization, workspace and layout bridges passed.
The failed bridges are full migration and template review. All declared
evidence hashes, offline network proof and clean absent teardown were checked.

Migration: 53 native cases, 34 passed / 7 failed / 12 explicit retired reverse
skips, 633.14s. Closed completion now works; receipt-drift protection reaches
its hook. Concrete production defects: final staging re-adds already-staged
selected-store deletions (absent path or ignored independent clone), and an
explicit failed-deletion retry rejects its own pending rootlink/ignore layout.
Three other assertions are older expectations: actual Episode HEAD may now
advance only by approved final metadata while historical owner head is fixed;
operator ignore bytes remain plus one required selected-store wrapper; native
non-fast-forward push rejection is a valid refusal before source deletion.
Repairs retain strong scope/business-byte/branch/publication checks rather
than simply accepting changed values. Code review confirms final staging is
AFTER source absence outside the deletion rollback catch: it reports
`cutover-incomplete` and retains destination ownership, never revives a deleted
Beads authority. No actual post-failure fixture-state observation is claimed
from that code-ordering evidence.

Template review: 17 cases, 14 passed / 3 failed, 2.60s. All current text-patch
preservation cases passed. Legacy prepared/held/interrupted restore cases
fail an exact index-buffer comparison (stat/checksum differences). Explicit
legacy keep, changed-index refusal and linked-directory safety passed. The
actual production-versus-fixture cause is being investigated, not waived.

After the fixture completed, source editing was released only for bounded
repairs: migration staging/exact fresh-store receipt-bound explicit replay,
the minimal internal workspace verifier callback, and actual legacy index
recovery cause. No outgoing-source code-publication prerequisite, early
normalization publication, persisted baseline/marker/controller, automatic
retry, new ID/semantic policy, force-add, or broad dirty bypass is authorized.
All failed logs/TAPs stay retained. No full-task completion claim.

## Repaired full affected regression — all 47 passed

Run `20261030T191459Z-87636-9505c5ef`, command retained in
`/tmp/primeclaw44-repaired-full-regression.log`: 47 passed, 11 non-container
tests deselected, 1250.94s. Full migration TAP: 53 cases, 41 passed, zero
failed, 12 explicit retired reverse skips, 669.26s. All seven populated
classes and the retained failed-deletion explicit retry passed, including
unauthorized README/ignore delta refusal checks. Workspace 79/79 and layout
13/13 passed. Project initialization, legacy text recovery, installation,
source capture and provider/admission/ownership bridges all passed.
All declared evidence hashes, offline network proof, clean absent teardown,
and frozen source/test hashes were checked after completion. This is a
green affected-container generation, not a claim that the retained full
native Backlog suite is green. Earlier failures remain preserved above.

The read-only final contract audit found two bounded remaining items: an
existing explicit local-only/no-remote independent store with distinct full
root and inactive folder configurations is incorrectly rejected by a later
publication-only branch; current guidance also misstates explicit adoption
and includes retired review/reverse-field/custom-command instructions.
After this fixture ended, only existing strict local-only proof reuse plus
one disposable regression, and current guidance/diagnostic corrections,
were released. Published migration destinations remain mandatory. Final
source-correlated focused Docker validation still follows these last edits.

## Final changed-generation acceptance — 44 container and 24 static passed

Final run `20261030T194400Z-59072-da32319d`: **44 passed**, 8 non-container
tests deselected, 666.25s. This includes workspace **80/80** (the explicit
local-only/root-override case and negative refusal checks), layout **13/13**,
admission **8/8**, project initialization/text recovery, plugin install, native
pre-project skill discovery, native renamed command/tool loading, and the
retiring-source boundary. Static: **24 passed**, 18 container cases deselected,
5.11s (`/tmp/primeclaw44-final-audit-static2.log`).

All declared artifact hashes, offline isolation, clean absent teardown and the
frozen source/test/current-guidance hashes were verified. The earlier full47
run remains the complete migration proof: between its green source and final
source, migration code changes only one obsolete custom-command diagnostic.
The final layout change reuses the existing local-only proof and does not alter
selected-remote migration/publication behavior. The final focused batch covers
that changed path and runtime loading; it is not presented as another full53
migration rerun. Both audit findings are closed: F1 by source review plus the
new executed regression; F2 by the internal read-only focused closure. This
internal audit is not owning-Conversation independent acceptance.

Reproduction commands:

- `full47`: `python3 -m pytest tests/test_task_provider_migration.py::test_task_provider_migration_node_suite tests/test_project_initialization.py tests/test_prime_agent_plugin_install.py tests/test_beads_retiring_source_capture.py tests/test_task_providers.py tests/test_task_history_workspace.py tests/test_backlog_destination_layout.py -q -m container`

- `final44`: `python3 -m pytest tests/test_task_history_workspace.py tests/test_backlog_destination_layout.py tests/test_project_initialization.py tests/test_prime_agent_plugin_install.py tests/test_task_provider_migration.py::test_migration_entry_admission_node_suite tests/test_task_provider_migration.py::test_retiring_beads_source_boundary_node_suite tests/test_reviewed_plan_extension.py::test_prime_agent_rpc_loads_renamed_commands_and_simplified_tools -q -m container`

- `static24`: `python3 -m pytest tests/test_backlog_build.py tests/test_backlog_workflow.py tests/test_project_initialization.py tests/test_task_history_workspace.py tests/test_task_provider_migration.py tests/test_task_providers.py tests/test_beads_retiring_source_capture.py tests/test_backlog_destination_layout.py -q -m 'not container'`

Retained native TAP paths and SHA-256:

- `.test-results/20261030T191459Z-87636-9505c5ef/tier1/task-provider-migration-node.tap` — `be6ef4718c1410edb350a9444357e642b5aa9f46124b82d87d2a03123c56aed2`

- `.test-results/20261030T194400Z-59072-da32319d/tier1/task-history-workspace-node.tap` — `6c9a6cbb78a3c778bc3ac4c6f45704cb5dd82a0f167aeed1a85b7f7e81dc6861`

- `.test-results/20261030T194400Z-59072-da32319d/tier1/backlog-destination-layout-node.tap` — `b30c384293896a40b5e72b7706e6e98d6021a3529391982e594d48e2eb4c011e`

- `.test-results/20261030T194400Z-59072-da32319d/tier1/migration-entry-admission-node.tap` — `8127694ac2d77af53163ccb2387aaa2f31156050de441cb478523c86855e0bff`

Acceptance mapping (implementation evidence; lifecycle remains In Progress):

| AC | Evidence |
|---|---|
| 1 | One global Markdown skill; custom initializer command removed; install and native pre-project discovery passed in full47 and final44. |
| 2 | Current Git text patches preserve asset/index bytes and mtime across clean/dirty/staged/mixed states; final44 text suite passed, including legacy restore/keep/refusal/symlink safety. |
| 3 | One-way admission and all seven independent/code-tracked default/hidden/custom populated destination classes passed full migration (41 passed, 12 retired reverse skips). |
| 4 | Full migration verifies original IDs, physical-path-keyed archive/live records, contents, configuration, histories and preserved baseline + import + receipt counts; all seven classes passed. |
| 5 | Workspace80/layout13 cover Backlog-only initialization, default-only normalization, custom in-place/root overrides, inactive configuration retention, historical Episode projections and local-only explicit setup. |
| 6 | Ordinary closed completion, exact positive archive evidence, raw status/catalog/reason/history, native allocation, provenance/relations/reuse all passed full migration; no new importer ID policy. |
| 7 | Embedded/local-only built-in/partial catalogs, source-as-is identity/version/catalog/history capture and unreadable/incomplete/drift refusals passed full47 and final retiring-source boundary. |
| 8 | Confirmation/quiescence/publication/ownership/runtime/source rechecks and guarded retirement passed full migration; explicit failed-deletion retry and unauthorized delta refusals passed. No source-push requirement. |
| 9 | Full47 and final44 are actual Docker executions. Native workspace80/layout13/admission8 have retained TAP; install/discovery/loading/text/source/provider checks passed. Native fork focused/compatibility/type/build proofs are separate from its retained red full run. |
| 10 | Current skill, initialization/provider guidance, stories/traceability and DD-001 supersession updated. Old bidirectional policy is marked historical. No live project migration, global activation, merge or cleanup performed. |

### Explicit validation limits and review boundary

The reviewed/published Backlog fork is exactly
`431e95612d6167e418c507ec206d95df43c38c54`; all six literal pins, the gitlink
and the versioned local build use it. Focused/compatibility/type/Biome/build
proofs passed. The older full native test execution remains **2901 passed,
8 skipped, 9 failed, 1 error**; the revised draft-view follow-up did not receive
another full native run. Candidate/base MCP/mover comparisons are attribution
evidence, not a waiver or a full-native-green result. All failed logs and
superseded attempts remain retained.

Implementation acceptance does not authorize merge, deployment, global apply,
restart, live ralph-pva/nemo/builder migration, provider lifecycle status edits
or Episode cleanup. The same owning Conversation independently reviews the
complete committed/pushed candidate and decides the later lifecycle.
