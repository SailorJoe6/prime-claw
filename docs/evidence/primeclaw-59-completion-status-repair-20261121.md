# PRIMECLAW-59 — source completion status repair, 2026-11-21

## Candidate and boundary

One bounded revision of unaccepted configuration candidate
`5e88a37ce5980c1c2ce0a5490704b7dceb6be3fb`, based on accepted forward/replay
integration `4dcd1f3602cfe9c2be298d5adec0c95981d0c969` and its earlier accepted
source capture/owned Web/repaired helper partials. Not whole-task acceptance.
Task remains **In Progress, 0/9 AC, null Final Summary**. No live provider switch,
production source retirement, Episode resource change, merge, activation, upstream
edit or Episode cleanup. Successful control tests may retire only disposable sources.
All migration fixtures are synthetic, disposable Docker projects.

Native accepted-finding plan/notes checkpoint
`280c9fa3a651f2c30f5211e87b43540a8baa493f` was separately published before code.
Fixture/readback checkpoints `02064a40f769b5ccf8d2b0301063f97466e19428` and
`9bc004fc6781ac6f7e3a6854943619e3f940a607` retain intermediate limits.

## Accepted finding and minimal repair

The owner and independent expert initially identified this by **static inspection**,
not by running probes/migrations. An actual source closed issue maps to `Done`.
`beadsCurrentProjection` chooses the first configured spelling matching the
case/all-whitespace-insensitive key. Pinned Backlog 1.55.3 source
`0cf4fdbc70020327f4366a29d3f405f83d180301`, `utils/terminal-status.ts`, treats
only the final status as terminal, comparing trim + lowercase. It does not
remove internal whitespace. Its task-record/readiness helpers use that meaning.

The migration-only guard is conditioned on **actual source issues mapping to
Done**. It resolves that first spelling and requires native terminal equivalence.
It runs before bounded status preparation's no-missing return and before any
additive config write. It also runs against the **same ONE owned native server's
startup status JSON** for unsupported config and existing receipt/import reuse,
and in fresh dirty-layout complete-receipt replay before current reuse proof.
No status reorder, terminal/default replacement, closed-issue remapping, whole
config rewrite, repair-on-replay, second server/API, new journal or upstream change.
Receipt-only Done is not a universal Done-last rule. Existing full field/digest,
source/publication/continuity/original-baseline and no-resend guards remain.

## Honest old-candidate snapshots

Artifacts are under `.test-results/primeclaw59-completion-status-repair-20261121/`;
native TAP/manifests remain in each timestamped tier-1 directory. Input hash
snapshots distinguish each run. Production was exact published5e88 throughout
all red runs (migration module SHA256
`05073cac890ec7b74ccfe5aae60437ac9acc7efe7eca7fab33034d24e228cc70`).

| Run | Native result | Actual evidence and limit |
| --- | --- | --- |
| `20261121T172414Z-49530-604d4996` | 8 PASS / 7 FAIL, 15 checks | Seven prior configuration checks and receipt-only control pass. New bodies stop in setup: native Beads rejects redundant child-to-parent dependency. **Not product reproduction.** Pytest1FAIL12deselected352.06s. |
| `20261121T173051Z-79644-97c4dfbd` | 8 PASS / 7 FAIL, 15 checks | Separate C/D source is valid. Four bodies stop at a fixture assertion accepting only `depends_on_id`; pinned native also uses `id`. Two real replay attempts refuse at existing current-field/destination-digest checks, with zero retirement callbacks. **Not unsafe-cutover evidence.** Pytest1FAIL12deselected399.44s. |
| `20261121T173943Z-19658-09a6e38f` | 1 PASS / 7 FAIL, 8 checks | Final dependency assertion uses the same supported keys as accepted relationship capture. Four real forward cases each make **9 native POST/PUT writes**, read startup config once, and reach the fixture's source-retirement callback once. Missing-active-status case also changes config. Fixture deliberately throws there, so **no source is deleted**. Receipt-only control passes. Both replay cases still stop at existing later guards, not the new explicit completion guard. Pytest1FAIL13deselected339.81s. |

Thus the final red run demonstrates missing early semantic refusal in four forward
paths, not a synthetic source-deletion success claim. Replay reds demonstrate
missing explicit early semantics, **not** an existing unsafe replay cutover.
The first two snapshots remain separate setup/readback evidence, not relabeled
as successful reproduction.

Transparent HTTP observation counts real native requests only; it does not change
responses/persistence. The accepted retirement callback is overridden only in
these disposable negative fixtures to retain the source if the old path reaches
it. Separate independent source C is closed natively; open D depends only on C.

## Final-source validation — complete

A single 16-line plugin delta adds one conditioned guard and three call sites.
Final-source plugin/test/bridge bytes match saved `green-input-hashes.json`.

- Focused completion run `20261121T174605Z-49056-56605db4`: **8 native
  PASS, 0 FAIL**; pytest1PASS13deselected382.23s. All four forward refusals have
  **zero native writes, zero retirement callbacks, unchanged config**. Complete,
  missing-active and first-internal-whitespace cases refuse before browser startup;
  unsupported single-quoted flow reads the ONE owned startup config once. Both
  complete-receipt replay variants read it once, refuse with the explicit semantic
  guard, write/reallocate nothing and retain all destination/source/code evidence.
  Receipt-only nonterminalDone control succeeds with true native auto-commit.
- Required final-source `scripts/test-tier1.sh --probe` run
  `20261121T174606Z-49146-096ecc6b`: **PASS**, 186.13s, actual isolated
  offline plugin RPC probe, immutable image, verified teardown/manifest publication.
- Static inventoried-source/pair-specific contract checks: **2 PASS**, 0.02s.
- Full/shared run `20261121T175911Z-7874-fc580241`: **7 pytest PASS,
  22 deselected, 1456.95s**. Migration **86 PASS / 0 FAIL / 12 retired-reverse SKIP**
  from98 checks. Shared current20, Web10, workspace89, initialization88,
  active-backlog12 and layout13 all PASS. Total **318 native PASS, 12 SKIP**,
  not318 migrations. The full run includes all eight new completion checks and
  all seven prior selected-existing configuration checks alongside complete
  current-content, publication, uncertainty/no-resend and continuity guards.

All **117 artifact hashes across seven retained runs** match. Every runtime is
offline; runtime and disposable builder teardown are clean; upstream builder
inventories are unchanged. The three explicit current plugin/test/bridge hashes
still match. `final-manifest-verification.json` records the final audit. No plugin,
test or bridge edit occurred after these runs started. Passing validation does
not imply owner acceptance or completion of the whole task.

The focused suite requires zero allocations/updates/retirement, unchanged config
bytes/modes, original records/history/remote publication/clone placement and
source/code identity for refusals. It covers complete/missing-active lists,
unsupported single-quoted native flow, first `D o n e` versus last `Done`, selected
and fresh-layout complete-receipt replay, plus receipt-only nonterminal Done
success with true native auto-commit. Original configuration and full current
2,610,950-byte input/transport/publication/continuity regressions remain retained.


### Interrupted full/shared attempt — infrastructure, not green

Run `20261121T174630Z-50962-654a5051` ended with seven pytest failures,
22deselected673.25s. Migration TAP reaches top-level test29 without `not ok`,
then loses its Docker exec; there is no complete native TAP summary. The six
remaining bridges cannot run because that same container is stopped. This is
**not** a successful full suite, nor an identified plugin assertion regression.
Docker Desktop's existing VM engine-control log records `POST /shutdown` at
17:57:24Z and `shutdown complete` at17:57:28Z. This matches the stopped-container
failure; the later events buffer contains only fixture cleanup after restart.
The shutdown initiator is not inferred. The agent did not restart/configure Docker.
Curated control evidence is saved in
`interrupted-full-engine-restart-evidence.json`; no arbitrary settings dump is retained.

The interrupted run's 21manifest artifact hashes match, offline runtime and clean
runtime/builder teardown are verified, and upstream builder inventory is unchanged.
All three final plugin/test/bridge hashes still match. Only the unchanged full
validation command was restarted in fresh disposable fixtures, with output
`final-full-native-shared-after-engine-restart.log`; it completed PASS as recorded
above. This was not a retry of a live migration or an uncertain provider write.
Focused8PASS/probePASS/static2PASS remain exact-final-source results.

## Deferred work and stop

Parked original-store/config consolidation, harmless same-ID archive/live
coexistence, interrupted recovery/disposability, responsive cancellation/progress,
406-ticket scale and full acceptance remain later. Publish task/code separately
and stop after this one tested repair for independent owner review. No next
slice, lifecycle close, live migration, merge or user-global apply/check/restart.
