> Sanitized project copy of the independent read-only EXPERT `BLOCK` on exact pushed project commit `82dd37b2ee6513dc27aa2977a8c0c410b09ae22b` (parent `27671cce2363c80fb34844e521166d8b6187d3cf`). Original private reviewer report SHA-256: `34cf742145abac25abefb671ec7863b004e126725c8bccc66ff6e650144afce0`; reviewer `openai-codex/gpt-6-astra`/`max`, session `01a0f108-e20e-7148-b9f0-cef6b027f8d1`. Relative review-artifact names in the final section refer only to the **original private reviewer artifact directory**; scratch logs/probes are not published with this project copy.

# BLOCK — exact-commit B2-R1/R2 watchdog review

- **Candidate:** `82dd37b2ee6513dc27aa2977a8c0c410b09ae22b`
- **Parent:** `27671cce2363c80fb34844e521166d8b6187d3cf`
- **Reviewer:** `openai-codex/gpt-6-astra`, thinking `max`.
- **Scope:** Read-only B2 watchdog/runtime-test review. No B1, source-current, publication, build, cutover, or routed-write acceptance.
- **Verdict:** **BLOCK.** The reviewed descendant-escape and fast-status seams pass the independent checks below. However, the new fast-success path bypasses the enclosing build's mandatory post-sync validation. One P1 finding remains.

## Authority and exact evidence

Joe authorized a cause-proven **minimal** watchdog runtime/test-harness repair. The original 15-second test bound, assertions, test shell body, required three-module selection, and no-write boundary must remain intact. These are owner-supplied and approved-plan requirements. B2-R3 below is my diagnosis of a regression in those existing fail-closed guarantees, not a new product requirement.

I verified clean HEAD, direct parent, and upstream against the exact identities above. A read-only `git ls-remote` independently returned the candidate for `refs/heads/episode/phase3a-brain-hosting-completion`. The exact-commit diff has seven paths: the watchdog generator, additive tests, blocked plan/spec, two operational documents, and the sanitized revision receipt. Only `_candidate_progress_watchdog_script` changed among source function/class definitions. No unrelated source, plugin, or brain-source file changed in this diff. `git diff --check` passed.

The revision receipt independently hash-matches:
`888f0017e317b532c0e5f9c520cffc2dd28abb6f29c140bcfdfdff3f57af9f9c`.
Its two code hashes match the reviewed files:

- `bin/prime-claw`: `610c2d8db2b067937d86356c945e7e4b6634bec63376775b96d415223921bb13`
- `tests/test_embedding_candidate_build.py`: `1fe201e0d72f915b97db532da7333025bdf9154d249edf98c0001d7e250b41d2`

I read the prior independent BLOCK's sanitized project copy. Its actual file digest is `526105597abfb09e70e46c9a2a1711018c34f62d48a388a8104c63e8988e200e`; its preface identifies the original private report digest as `acf6cb1b0ad473005ac9b191d0f5a7b286d3698dad1501c4661b5e088399774b`. These are different artifacts, not a digest discrepancy. The original private report and implementer's new private logs were not supplied at exact paths for this review, so I did not independently rehash them or adopt their claims as my own test results.

The personal brain lookup returned no relevant project context. This review relies on the exact repository evidence and independent tests.

## Verified behavior and regression fidelity

The complete unchanged offline selection ran **once**, with a unique private basetemp, bytecode disabled, and pytest cache/plugin autoload disabled:

```text
PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -q -p no:cacheprovider --basetemp=<unique-private-scratch> tests/test_embedding_candidate_build.py tests/test_runtime_validate.py tests/test_runtime_converge.py
72 passed, 3 warnings in 23.11s
```

Native environment: Python **3.14.4**, Bash **3.2.57**, macOS. The warnings are the existing `SourceFileLoader.load_module()` deprecations. No installed native `setsid` executable exists on this host; executable test shims perform actual `os.setsid()` and then same-PID `exec`. I did not test a live Linux sandbox or claim live build proof.

All **28 pre-existing test-module function/class definitions** are byte-exact against the parent. This includes the original stalled-worker test, its `timeout=15`, original worker/shell body, cleanup assertions, delayed-setsid regression, and progress/signal test. Five added functions contribute eight new cases. `_candidate_build_script` is unchanged, including the literal production launch:

```text
setsid gbrain sync --source brain --full --no-pull --no-extract --workers 1 --yes 2>&1 &
```

Independent checks support these parts of the revision:

- The wrapper at `bin/prime-claw:1211-1214` enters the isolated group before the inner Bash writes `ready:<PID>`. The parent checks the matching marker and group at `1235-1236`. Independent synthetic records confirmed worker PID = PGID = SID and a matching marker under Bash 3.2 `set -euo pipefail`.
- The dead-leader branch now rereads that marker and invokes owned-group TERM/KILL before its explicit `wait` (`1217-1229`, `1237-1240`). The added failed-real-probe/leader-exit tests pass for exit 0 and 7 with a TERM-ignoring child, pipe EOF, and leader/descendant/group/state removal. This supports closure of the specific prior B2-R1 seam.
- Fast exit 0 and 7 now retain their worker status; never-ready and pre-group launch failure retain 125; early TERM and readiness-handler handoff retain 143; the original real-stall case retains 124. These all passed in the unchanged selection. The new finding concerns what happens **after successful worker completion**, not a recurrence of the old 0-to-125 mapping.
- The kill targets in the revised startup path are only the owned worker PID and negative worker PID group. The probes confirmed the worker group was distinct from the caller group. No caller-group or process-name kill was used.
- As negative controls, I ran the unchanged new fast-status and missed-probe-descendant test bodies against the exact parent generator. Both fast 0/7 cases failed their status assertions; both descendant cases hit their nine-second captured-output timeout. Their unchanged test finalizers cleaned the owned groups. This proves these new regressions detect the prior defects rather than merely assert the new code's shape.

These are bounded checks, not a proof of every possible signal interleaving or an endorsement of a different/forking `setsid` contract.

## Blocking finding

### B2-R3 — P1: fast success exits the build before its acceptance gates

**Evidence and impact — confidence 10/10.** At `bin/prime-claw:1240`, a matching readiness marker causes the early-dead-worker path to run `exit "$SYNC_RC"`. When that status is 0, it exits the **entire generated shell**, not just the watchdog fragment.

The fragment is embedded in the middle of `_candidate_build_script` at `1371-1384`. A normal successful completion must continue into `1385-1407`: clean/unchanged source verification, unacknowledged-failure check, page/path/chunk parity, vector freshness/schema/index checks, and exact source bookmark. The new `exit 0` skips all of them. `cmd_embedding_build` treats shell status 0 as success after its separate canonical-state/policy checks (`1466-1488`) and can print that the parallel database is complete without candidate validation.

I reproduced this with a deterministic, bounded native-shell probe. A wrapper around Bash's `kill` retained the actual failed group-probe result, released the shim, and waited until the attested worker had completed before returning that original result. It did not invent liveness results or edit the generated fragment.

| Probe | Actual result |
|---|---|
| Fast successful fragment followed by a sentinel and `exit 37` | **0; sentinel not reached** |
| Fast worker exit 7 followed by the same continuation | 7; continuation correctly not reached |
| Ordinary successful worker observed ready before exit | 37; continuation reached |
| Exact generated production sync suffix; synthetic unacknowledged failures = 1 | **0; failure check never called** |
| Same suffix; synthetic stale bookmark | **0; bookmark check never called** |
| Same suffix; synthetic changed source after sync | **0; post-source check never called** |
| Ordinary successful worker with synthetic unacknowledged failures = 1 | 1; post-source and failure checks ran |

The production-suffix probes used executable synthetic `git`, `gbrain`, and `psql` boundaries. They kept the literal production sync command and the generated post-sync checks intact, excluded configuration/database setup, and used short synthetic watchdog settings only to keep the probes bounded. No real Git source, database, provider, or sandbox was invoked. Fast-path command traces ended after pre-source checks, dry run, progress baseline, and sync. No candidate receipt was emitted. Every current probe reached output EOF and left no worker leader/group or watchdog state.

**Violated invariant.** A worker's successful exit must not bypass the build's mandatory completeness/freshness/source checks or manufacture a successful candidate result. This is the existing false-success protection in the approved execution plan's Slice 2 (`EXECUTION_PLAN.md:91-95`) and the binding specification, preserved by the narrow B2 repair contract (`:217-219`, `:268`).

**Root cause / lifecycle seam.** The repair correctly distinguishes an attested fast worker from never-ready launch failure, but conflates **worker completion** with **enclosing build completion**. The normal watchdog success path falls through (`1285-1290`); the early success path exits the caller. The tests at `tests/test_embedding_candidate_build.py:234-250` run the watchdog as the entire shell, so `exit 0` looks correct. The existing full-source gate test at `:611` tests extracted predicates, not reachability through this early-success path.

**Recommended repair direction and rationale.** Keep fast-worker cleanup and status capture, then make successful early completion reach the same caller continuation as ordinary success. Only error/stall/signal outcomes should abort the enclosing script. Converge the two completion paths within the authorized watchdog lifecycle so cleanup and status semantics stay consistent. Add a caller-continuation regression and an offline generated-sync integration case. This fixes the introduced seam without changing source policy, acceptance criteria, or unrelated build code.

**Constraints and approaches to avoid.** Do not remove or weaken the post-sync gates, declare a matching readiness marker sufficient build evidence, suppress nonzero statuses, force healthy workers to sleep, lengthen the 15-second protected timeout, skip cases, or signal the caller group. Do not rely on merely asserting that validation text appears in a generated string. Do not reintroduce the B2-R1 descendant leak while making success fall through. Preserve the literal production launch and no-write boundaries.

**Concrete acceptance tests.**

1. **Positive:** Force the real missed-probe/attested-fast-exit-0 ordering. Append a continuation sentinel and a distinct final status to the unmodified generated watchdog. Require the sentinel and final caller status, with no leader/descendant/group/state remaining and captured-output EOF. Repeat with the TERM-ignoring descendant ordering already covered by B2-R1.
2. **Integration success:** Execute the generated sync section with synthetic command boundaries and a fast successful worker. Require all post-source/failure/parity/vector/bookmark checks to run and the candidate receipt only when all pass.
3. **Negative:** With that same fast worker, independently supply changed/dirty source, unresolved failures, missing page/path coverage, stale/invalid vectors or schema, and stale bookmark. Each relevant gate must be reached and reject the result. Keep assertions independent of message text alone.
4. **Failure:** Preserve fast exit 7 without running success continuation; preserve never-ready/pre-group launch 125, signal 143 across readiness/handoff, and real stall 124. Assert EOF and owned cleanup on all failure paths.
5. **Replay:** Keep the original delayed-start/progress/stalled-descendant tests intact. Run the unchanged required three-module selection with unique scratch, disabled bytecode/cache, no skips, and the original 15-second test limit. Demonstrate that the new continuation/integration test fails on this exact commit and passes after the repair. Do not obtain acceptance by selective retry.

**Regression risks and linked dependencies.** Sharing completion paths can accidentally wait twice, lose the captured nonzero status, use an unset watcher PID, leave startup traps/state installed, or remove group cleanup before the caller continues. Repair and test those transitions together with the already-linked B2-R1/B2-R2 cases. No B1/source repair is needed for this watchdog change. No true product decision or broader authorization is needed to preserve these existing gates.

## Boundaries, cleanup, and artifacts

The reviewed worktree and code hashes remained unchanged. The independent pytest scratch check found **13 recorded test PIDs, zero live; eight state references, zero remaining**. Only that uniquely owned temporary test directory was removed. Synthetic probe scratch and test-owned process groups were cleaned by their scoped finalizers. Review artifacts remain available. No repository, Beads, brain source/policy/database, plugin, Git ref, or episode/session lifecycle state was changed. Published candidate evidence is sanitized; it contains aggregate descriptions and hashes, not private raw process logs, page names/content, endpoints, or credentials. My probe artifacts contain synthetic data only.

Historical claims that source remote `eb157`, accepted checkout `5c47`, and old candidate `1c97` remain unchanged are receipt evidence, not fresh live-system attestations from this review. **B1 remains unresolved. This BLOCK does not authorize source publication, a new candidate, indexing, build, cutover, or Slice 2 acceptance.**

Artifacts relative to this report:

- `sanitized-verification.json` — normalized checks/results; SHA-256 `d7c26a8395c261779f58c73394710f70a626303a4633aecf764feab9a230a976`.
- `focused-selection.log` — independent 72-test result; SHA-256 `22d168a7ad3463684f4b175c4832b846fda0ed9d588e1088e542554f71c69778`.
- `review-probes.py` — read-only synthetic reproduction and exact-parent negative controls; SHA-256 `ff6e3dd966e7d840e7108195329ee5262ef7aa51f48b9de3be11a3715fb563e4`.
- `review-probes.json` — normalized probe results; SHA-256 `109198ad6f7c55c77483ec8f647913e9c3f70f9bca38153ee4b88fe97dbbd402`.
- `parent-watchdog.py` — exact parent generator extraction; SHA-256 `58cb41e0169fc03de51d5f96e56c9cc6b8beceb84dae9a1b5244653e29f18f09`.
- `review-probes.stderr` — empty.

An initial orchestration-cell quoting error occurred before the probe file or any worker launched. The corrected native runner exited 0 and produced the evidence above. It is not a subject-code failure.
