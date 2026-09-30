> Sanitized project copy of the fresh read-only EXPERT report for exact pushed project commit `e4cfe1b79f293a34ccb3f15e46d1643813e54c9b` (parent `12520500af24c746f1caa4f2d64eee6ff1ab1ada`). Original private report SHA-256: `acf6cb1b0ad473005ac9b191d0f5a7b286d3698dad1501c4661b5e088399774b`; reviewer `openai-codex/gpt-6-astra`/`max`, session `01a0f0c1-2b41-71f7-84b5-92e143e8d722`. The relative review-artifact names in the final section refer only to the **original private reviewer artifact directory**. The raw logs and probes are not published with this project copy.

# BLOCK — exact-commit B2 watchdog review

- **Candidate:** `e4cfe1b79f293a34ccb3f15e46d1643813e54c9b`
- **Parent:** `12520500af24c746f1caa4f2d64eee6ff1ab1ada`
- **Reviewer:** `openai-codex/gpt-6-astra`, thinking `max`.
- **Scope:** Read-only review of this commit only. B2 watchdog repair, not B1/frontmatter, source-current acceptance, publication, indexing, build, cutover, or routed writes.
- **Verdict:** The original startup race is supported by independently checked evidence, and the new delayed-start regression detects it. However, the readiness loop introduces two related exit/cleanup defects. Repair both before B2 acceptance.

## Requirements and provenance

Joe authorized a root-cause-proven **minimal** watchdog runtime/test-harness repair. The original 15-second bound, assertions, required three-module selection, and no-write boundary must remain intact. These are requirements from the approved blocked bundle and owner task, not reviewer inventions. The additional lifecycle cases below are reviewer tests of those existing guarantees.

I verified the exact HEAD and parent. A read-only `git ls-remote` returned the candidate for `refs/heads/episode/phase3a-brain-hosting-completion`. The worktree was clean before and after review, and the exact-commit `git diff --check` passed. The diff has seven paths: the watchdog generator, one test addition, the blocked plan/spec, two operational documents, and the sanitized receipt. No source-brain or plugin files appear in this slice.

The receipt SHA-256 independently matches:
`bfb75c1548d0cf31d70adec74ee493dfb489044ec821fac1eeaf40341257d8b2`.
Its source and test hashes also match the reviewed files. I read only the four exact private evidence files supplied by the owner and verified their hashes against the receipt. No raw process samples, pipe identifiers, source-page names/content, or credential material are reproduced here.

## What the evidence proves

The private observer trace agrees with the sanitized receipt:

- At 0.301–3.522 seconds, the worker PID existed but still belonged to the parent's group.
- The watcher existed at 1.245 seconds and was absent at 1.587 seconds.
- The worker had its own group by 3.847 seconds, after the watcher had gone.
- At 7.171 and 14.629 seconds, the outer Bash, worker, and descendants shared captured-output writer endpoints. The outer Bash and worker still existed at 15.021 seconds.
- The failure log contains the original 15-second `TimeoutExpired`: **1 failed, 62 passed, 3 warnings in 22.14s**.

This ordering explains the original failure: group-only termination ran before the group existed, the watcher finished, and the worker later ran without it. It does not identify which host subsystem delayed Python initialization, and that explanation is not required to establish this ordering defect.

The new wait-before-watch design closes that particular delayed-launch path. Running the **unchanged new regression body** with the parent's watchdog generator produced its expected 12-second timeout. The current commit passed it in the full selection. The original stall test and every pre-existing function/helper in its test module are byte-for-byte unchanged; only the new test function was added. The protected 15-second test bound was not changed.

## Blocking findings

### B2-R1 — P1: readiness/exit race leaves an isolated descendant alive

**Evidence and impact — confidence 10/10.** `bin/prime-claw:1227-1232` first observes that the group does not exist, then checks the worker PID. If the worker creates its group, forks a child, and exits between those checks, the second check sees a dead PID. The branch discards `wait` status, deletes the state file, and exits 125 **without terminating the now-existing group**. The regular cleanup and EXIT trap are not installed until lines 1267-1270.

A bounded synthetic probe of the exact generated fragment reproduced this ordering. A wrapper around Bash's `kill` retained the actual builtin result and inserted one scheduling pause **after a failed group probe**. It did not invent a probe result or change the generated fragment. During the pause, the synthetic worker called `setsid`, forked a TERM-ignoring child, and exited 0. Results:

- Outer Bash exited **125**.
- The TERM-ignoring descendant was still alive.
- Captured-output EOF did not arrive within the probe's one-second EOF check.
- Test-owned group cleanup then removed the child and released the pipes.

This is a controlled interleaving proof, not a claim that the original required test naturally exercised this ordering. The initial scratch runner had a syntax error before any worker launched; the corrected runner produced the evidence above.

**Violated invariant.** An early exit/readiness failure must fail closed with bounded cleanup of the owned worker **and descendants**. An error code alone is not fail-closed cleanup. This can leave a sandbox sync descendant running after the caller reports failure, and can recreate the captured-pipe hang B2 must prevent.

**Root cause / seam.** Two separate liveness samples are treated as proof that a group never formed. The dead-PID branch bypasses group cleanup at exactly the launch-to-owned-group transition.

**Recommended repair direction.** Make launch completion/failure and teardown one coherent ownership lifecycle. A missed readiness sample must not bypass bounded cleanup of any group the launched worker could have formed. Preserve ownership across the failed-probe/leader-exit transition and handle descendant-only groups. This removes the lifecycle hole rather than merely changing the reported error.

**Constraints / avoid.** Do not signal the caller's process group, use broad process-name cleanup, rely only on the leader PID, or assume a dead leader means there are no descendants. Do not add unbounded waits, reduce cleanup assertions, or lengthen the protected test timeout. Keep changes inside the authorized watchdog/test surface.

**Concrete acceptance tests.**

1. Deterministically pause after a real failed group probe; let the worker form its own group, fork a TERM-ignoring child, then exit before the PID check. Assert bounded wrapper completion, no leader/descendant/group left, captured-output EOF, and no leftover watchdog state.
2. Cover both leader exit 0 and nonzero in that interleaving. Verify the status policy together with B2-R2.
3. Keep the positive delayed-start regression, original stalled-worker/TERM-ignoring-descendant test, and ordinary progress-reset success case.
4. Keep negative never-ready startup returning 125 with cleanup, actual launch failure, and signal abort during readiness/handler handoff. Verify cleanup on each failure path.
5. Replay the unchanged required three-module selection with unique scratch, disabled bytecode/cache, the original 15-second limit, and no skips. Do not retry selectively until green.

**Regression risks and dependencies.** Cleanup can race with group formation or leader exit; a leader-only fix can strand descendants, while an unscoped group fix can kill the caller. Status preservation and readiness ownership must be repaired and tested together with B2-R2. No B1/source repair is needed to fix this code seam.

### B2-R2 — P2: a completed healthy worker is reported as startup failure

**Evidence and impact — confidence 10/10.** The same early-exit branch at `bin/prime-claw:1227-1232` equates “no group exists at this sample” with “the isolated launch never became ready.” A short command can form its group and finish completely between polls. Its status is then discarded by `wait ... || true` and replaced with 125.

Independent native-shell comparisons used the same synthetic `setsid` interface as the project tests and `set -euo pipefail`:

| Worker | Parent commit | Candidate commit |
|---|---:|---:|
| Successful `/usr/bin/true` after `setsid` | 0 | **125** |
| `bash -c 'exit 7'` after `setsid` | 7 | **125** |
| Worker that waits 0.3s and exits 0 | — | 0 |

Both fast candidate cases reported `isolated sync exited before process group was ready`, although `os.setsid()` had succeeded before the command ran. A valid fast/no-work completion can now fail, and a real command error loses its useful status.

**Violated invariant.** Preserve successful sync behavior and truthful failure propagation while adding bounded startup safety. Existing final-status handling at lines 1279-1280 distinguishes stalled work from the worker's own result; the new branch bypasses it.

**Root cause / seam.** Readiness is inferred from an ephemeral group-liveness sample instead of being distinguished from completed launch. Fast completion is misclassified as launch failure.

**Recommended repair direction.** Distinguish a genuinely unready/failed launch from a successfully launched worker that already completed. Retain and propagate the real worker outcome after all owned descendants are cleaned. Reserve 125 for the documented launch-readiness failure, not a missed observation of a completed group. Choose the smallest mechanism consistent with the deployed `setsid` contract; do not simply turn every missing group into success.

**Constraints / avoid.** Do not force healthy workers to sleep, stretch readiness deadlines to make polling pass, mask nonzero results, or weaken `set -euo pipefail`. Do not “fix” status propagation without the teardown guarantees in B2-R1.

**Concrete acceptance tests.** Add deterministic fast successful and fast nonzero completion cases where group creation and exit occur between polls. Require 0 and the original nonzero status respectively, plus EOF and state/group cleanup. Retain a genuinely never-ready case returning 125 and an explicit launch-failure case. Replay these alongside the delayed-start, progress-reset, stalled-descendant and signal cases, then the unchanged full focused selection.

**Regression risks and dependencies.** Treating every vanished PID as success would weaken fail-closed launch behavior; preserving only a status can still leave descendants. Repair together with B2-R1.

## Independent checks and limits

The complete required offline selection ran once from the reviewed worktree:

```text
PYTHONDONTWRITEBYTECODE=1 PYTEST_DISABLE_PLUGIN_AUTOLOAD=1 python3 -m pytest -q -p no:cacheprovider --basetemp=<unique-scratch> tests/test_embedding_candidate_build.py tests/test_runtime_validate.py tests/test_runtime_converge.py
64 passed, 3 warnings in 13.69s
```

Native environment: Python **3.14.4**, Bash **3.2.57**. The three warnings are the existing `SourceFileLoader.load_module()` deprecations. The private post-fix logs independently hash-match and contain **64 passed / 3 warnings** in **13.30s** and **13.67s**. These results are real; they do not cover the two defects above.

Additional candidate probes passed the sampled paths: never-ready TERM-ignoring shim returned 125 in about 4.95s with no shim/state remaining; an explicit pre-group launch failure returned 125; TERM during delayed readiness and around readiness handoff returned 143 with cleanup. Normal delayed successful work returned 0. Static inspection found the tested readiness checks compatible with `set -euo pipefail`: guarded liveness/wait failures do not abort those tested paths, and `WATCHDOG_PID` is initialized before the startup handler uses it. This is not an exhaustive proof for every signal ordering or command failure.

The published receipt is sanitized: process roles/timing and hashes, not raw PIDs, pipe identifiers, private page names/content, or credentials. I performed no source-brain, database, policy, plugin, Beads, Git-ref, or episode lifecycle mutation. Only review artifacts and synthetic test scratch were written. Historical unchanged source/policy/DB assertions remain the implementer's receipt evidence; I did not re-probe those live systems or claim source-current acceptance.

No true product decision is needed for these findings. They concern the already-required watchdog lifecycle. **B1 remains unresolved and outside this slice.** Neither this review nor local green tests authorize a new source candidate, source publication, Qwen activity, or Slice 2 acceptance.

## Review artifacts

All paths below are relative to this report's directory:

- `sanitized-verification.json`: normalized hash, timeline, test and probe results. SHA-256 `ae373afcc08ad267fd423477dba3e3a6eecf082e11a227b45418d2ac7c7318bc`.
- `focused-selection.log`: independent required selection.
- `watchdog-lifecycle-probes.py` / `lifecycle-probes.log`: bounded parent/current status, readiness-failure, and signal comparisons.
- `readiness-exit-race-probe.py` / `readiness-exit-race.log`: controlled interleaving and descendant/pipe retention proof.
- `parent-regression-check.py` / `parent-regression.log`: unchanged added regression run against the parent watchdog.
- `parent-watchdog.py`: exact parent watchdog function, extracted for isolated comparison; no repository checkout or ref change.
