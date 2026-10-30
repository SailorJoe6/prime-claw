# Native Backlog destination layout de-risk proof — 2026-10-30

PRIMECLAW-44, bounded Slice 1e. This is **test-only native evidence**, not
production initialization, populated-destination migration or task-history
adoption. The native Docker proof and combined workspace/provider regressions
passed. Source-audit findings remain distinct from the bounded runtime evidence
below. This candidate is for separate Conversation review, not full-task
acceptance.

## Question and bounded scope

Can the pinned native Backlog read the same existing tasks and settings through
`backlog.config.yml -> <selected-store>/config.yml` after a same-repository
`backlog/` to `.backlog/` Git move, without task recreation or lost history?
Do already-hidden and custom selected stores stay in place? Does native
configuration, not built-in directory search order, select the live store?

The disposable matrix covers:

- Default `backlog/` with native folder config.
- Default `backlog/` selected by root config using `backlogDirectory`.
- Existing `.backlog/` selected by root config using `backlog_directory`.
- Custom `planning/task store/` selected by root config using `backlogDirectory`.

All contain native-created active/completed/archived tasks, a parent/dependency,
plan/notes/criterion/comment/final summary, and a distinct historical archive
prefix probe repeating the active task ID. Two native-content commits precede
the layout step. Raw files, ignored/untracked attachments, full native views,
selected configuration settings and Git ancestry/`--follow` history are checked.
Only default stores move. Whole native configuration travels through the root
symlink; only its selected-directory directive changes or is added. Other
configuration bytes remain exact. Hidden/custom settings and configured paths
are retained. Repeated native reads from the project, nested code directory and
selected store must not write configuration, advance HEAD or alter the index.
Hidden/custom cases include a conflicting built-in config to test root authority.

## Source audit (not runtime proof)

The pinned dependency source is `deps/backlog`, not Prime Agent. Two read-only
audits found:

- `src/utils/backlog-directory.ts` recognizes both directory-key spellings and
  gives a valid root configuration precedence. The root file is the **whole
  configuration**, not a small overlay/pointer. Without it, config-bearing
  `backlog/` wins over `.backlog/`.
- `src/cli.ts` refuses an existing project's `init --backlog-dir` and
  `init --config-location`; `config get/set` does not expose `backlogDirectory`.
  There is no native relocation CLI. Do not use re-initialization as migration.
- `src/utils/find-backlog-root.ts` walks upward from the calling directory.
  Native discovery follows file symlinks. Supported Git/filesystem operations,
  followed by native verification, are the seam to de-risk.
- Git rename history can preserve same-repository tracked history; a copy into a
  fresh independent repository does not automatically preserve it. Inventory
  untracked/ignored files separately, rather than inferring their preservation
  from a tracked diff.

## Current production gap and limits

`ensureProjectTaskProvider` in `project-initialization.ts` grandfathers ordinary
selected stores. `prepareTaskHistoryWorkspace` deliberately refuses populated
or code-tracked adoption, retains selected `backlog/`, and deletes built-in root
configuration in its old preparation flow. Migration destination preparation
still hardcodes `.backlog/`. This evidence slice changes **none** of those
production paths or protections.

Passing same-repository file/view/history evidence does not establish independent
DAG adoption, nested-clone relocation/publication identity, native historical or
cross-branch task visibility/allocation after a rename, linked-worktree rebasing,
or active-Episode integration. In particular, the dependency source uses literal
current store paths in cross-branch Git reads; Git `--follow` ancestry alone is
not proof of native cross-branch completeness. Those boundaries need separate
bounded integration evidence, not an upstream Prime Agent patch or a new
baseline/reconciliation framework.

One-way migration admission, explicit Beads source selection beside existing
Backlog, preserved populated-destination imports/allocation/provenance/relations/
receipt/publication-before-retirement and initialization/install/migration
normalization remain unfinished. Ordinary dual-provider discovery and active
Beads safety remain strict. Accepted source-as-is/status/archive/runtime/owner/
drift protections are unchanged. All ten Acceptance Criteria remain unchecked.
No live store, global apply/check/probe, settings/model/upstream, lifecycle,
ownership, merge or deployment mutation is authorized or performed.

## Reproduction and evidence

```sh
python3 -m pytest tests/test_backlog_destination_layout.py -q -m container
```

The Python bridge runs `node --test
/workspace/tests/backlog_destination_layout.test.mjs` only inside the existing
isolated/offline Tier 1 Docker fixture. No host native candidate probe is used.
All Git repositories, remotes and store writes are disposable.

First native proof: **1 Docker bridge passed in 131.47s**, run
`20261030T050940Z-36006-4bb0b5e7`. The bridge runs all five Node cases without
filtering or native-availability skips. Its final `tier1/manifest.json` records
`passed`, no failure codes, network verified absent and clean absent builder and
runtime teardown.

- Repository content SHA-256:
  `aa7f92c8524b1978112cb7ac9ca1214b77367dc45da7a9e1fedd120e0bc0ca30`.
- Runtime image: `sha256:69b57e0abc6ccf8791ae90fae21f8ec4b5c0906ddb725eafef6067bb1b5345ee`.
- Host-safe structural checks: **4 passed, 6 skipped** (the skipped bridges never
  invoke native candidate behavior on the host).

Final combined native proof/workspace/provider regressions:

```sh
python3 -m pytest tests/test_backlog_destination_layout.py tests/test_task_history_workspace.py tests/test_task_providers.py -q -m container
```

The final combined command passed **6 Docker bridges, 4 deselected in 344.78s**,
run `20261030T051230Z-44680-a2a057c3`. The deselected tests are the four
host-safe structural checks; no Node case was filtered out. This includes the
new native proof, unchanged task-history workspace suite and all four existing
provider/Backlog admission/ownership/Beads admission bridges.

- Final manifest: `.test-results/20261030T051230Z-44680-a2a057c3/tier1/manifest.json`.
- Final native TAP: `.test-results/20261030T051230Z-44680-a2a057c3/tier1/backlog-destination-layout-node.tap`.
  It records **5 tests, 5 passed, 0 failed/cancelled/skipped/todo**; the runtime
  native Backlog reports **1.53.0**. Four JSON diagnostic rows bind before/after
  fixture commits, original task commits, IDs, selected paths and seven preserved
  store files for each layout.
- TAP SHA-256: `9f57d32d61648ea65f743454c99f2c41be433f61b165b19e27c49a07c0e0d2d4`.
- Final repository content SHA-256:
  `8883396bce83b73e5297213e413d70b3033e30e3aec9daf26e871b2377caf249`.
- Runtime image: `sha256:261470453dd485377c3aea452e6c6df223aa922a6d71474bade42e6d46ea1026`.
- Both final run manifests (focused and combined) record `passed`, no failure
  codes, network verified absent and clean absent builder/runtime teardown.
- Final test bytes were unchanged after the combined run began; only native task
  and documentation prose were updated afterward.

No production plugin source changed, so the separate mandatory probe-after-plugin-
change condition was not triggered. All native behavior still ran in the existing
Docker Tier 1 fixture; no host/global candidate apply/check/probe was run. No
fixture or runtime failure was waived, and no full production normalization,
independent history adoption, populated migration or native cross-branch
completeness claim follows from these results.
