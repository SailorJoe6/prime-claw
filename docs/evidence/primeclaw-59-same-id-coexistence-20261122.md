# PRIMECLAW-59 — preserve an existing live/archive pair with a shared ID

This is the step-3/AC5 coexistence increment. It does not change ordinary
Backlog lifecycle policy or authorize another recovery, live switch, source
retirement, activation, merge, or task acceptance.

## Pinned native behavior

Offline disposable ARM64 Docker, image
`sha256:aa4ce558e37c3b437bcde7c023265fe5bd5eede800fe97101e01ed29f555ebec`,
ran Backlog.md 1.55.3 from `0cf4fdbc70020327f4366a29d3f405f83d180301`.
Two distinct `PAIR-12` files in `tasks/` and `archive/tasks/` cause native
`task view --json` to fail as ambiguous. Neither exact physical path works as
an alternate native selector. The CLI and, in a second fixture, the native
Web API each allocated `PAIR-13` and retained the original paths and exact
bytes. Neither probe touched private or live data.

## Migration boundary

The selected store can retain an already existing live/archive pair as two
physical originals. The migration pins their exact paths, bytes, modes, and
native history, and never manufactures a native view for either. Unrelated
unambiguous originals and all imports still require genuine native readback.
Native allocation reserves the shared ID; the importer does not rename or
choose either record. A pair that would hide an import or receipt is refused
before reuse or new allocation. Provenance markers are used only to refuse,
never to certify reuse. Preserve other collision refusals, and do not create
a new pair by combining previously separate singleton authorities.

## Disposable evidence

Run `python3.14 -m pytest -q -m container tests/test_task_provider_migration.py::test_same_id_coexistence_node_suite`
with the normal readonly tier-1 source selector. `same-id-coexistence-node.tap`
contains the per-case results. Probe commands, manifests, fixture variants,
and checked hashes are retained under `.test-results/primeclaw59-same-id-coexistence/`.

- `20261122T064708Z-4594-5a14038a`: old accepted code `e4878f1` plus the new fixture.
  Nine native checks passed; the valid selected and parked cases were refused
  before any native task write or synthetic retirement.
- `20261122T065203Z-10352-80fb1b53`: both candidate migrations completed, each with
  six Web task writes and one synthetic retirement after publication and physical
  preservation checks. The fixture's top-level-only numeric parser failed on
  native subtask IDs. This run was not green.
- `20261122T065632Z-17433-5026d075`: 11 native checks passed; pytest 1 passed
  (225.36 s). With no intervening product edits, the corrected fixture required
  native allocation of `BASE-13`, including the root IDs of dotted subtasks.
  Both stores retained exact originals and history, and the receipt-mapped
  ambiguity was refused without writes or retirement.

The original parked-store candidate separately reported ownership suite #83
as failing before delivery on its synthetic journal placeholder; this slice
is not a repair, passing runtime baseline, or full-project green claim.

Final-source validation used the same unchanged plugin and test inputs:

- Required `scripts/test-tier1.sh --probe` passed in run
  `20261122T070125Z-29792-dfe18848`.
- Docker run `20261122T070325Z-33358-7d5fa1a0`: 4 pytest passed in
  1479.79 s. There were 216 native passes: migration 97 (12 retired reverse
  skips), current helper 20, Web 10, and task-history workspace 89.
- Static migration checks: 2 passed. All 223 recorded source, test,
  driver and linked documentation inputs still match, as do all 78
  artifact hashes across the five retained tier-1 runs. These runs were
  offline, runtime and builder teardown were clean, and upstream source
  inventory was unchanged. This is not live maintenance or whole-task UAT.
