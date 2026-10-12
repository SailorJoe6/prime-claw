---
id: PRIMECLAW-10.28.1
title: Build and apply the safety-first work-control candidate
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10.28
priority: p1
type: task
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Revise the rejected safety-first production candidate for plugin-global goal/heartbeat work control. Preserve removal-first migration and proportionate non-native tests. Repair only the five owner-accepted findings for 60a2d4b: compatibility silent-no-op before collision checks with incompatible-plus-marker tests; visible-only manual UAT; owner-only replacement review while retaining one mandatory final exact-candidate EXPERT; current Bead evidence; and lab-global documentation naming both obsolete managed files. Produce one clean pushed replacement candidate for owner review. Do not apply/check or launch Prime Agent in this replacement pass.

## Legacy notes

Rejected history is preserved: 3f2072e was the superseded native-carrier candidate; 60a2d4bb5f3a0e51620c62ae7bf0f640c0fc5ddb was the rejected first safety-first production candidate. Replacement 4a6e07a5cf0752b20976c65b2108ae8acd338792 is clean and pushed for owner review. Exact replacement evidence: focused Node 8/8; focused Python 20 plus 11 subtests; safe non-native Python 268 plus 11 subtests; all six mock Node suites 135; bash syntax and git diff checks passed. It implements only the five owner-accepted revisions and does not change installer/check implementation. No native Prime Agent process or managed apply/check ran. Historical comments remain authoritative for prior dispositions and exact scope.

Checkpoint 1 managed installation completed without activation. Owner-accepted source commit: 4a6e07a5cf0752b20976c65b2108ae8acd338792. Durable evidence commit: d5e8b77f5d979a9edea2518f315b28538f963ae1. scripts/apply-prime-agent-plugin.sh exited 0 and scripts/check-prime-agent-plugin.sh independently exited 0 against /Users/jlanders/.prime/agent. Independent verification found all eight managed TypeScript installs regular and byte-identical to source; extensions/goal-blocker-control.ts, extension-support/episode-finalization.ts, and extensions/project-conversation.ts are absent with no dangling symlink; managed APPEND_SYSTEM.md validation passed. No Prime Agent or native probe was launched. Existing daemon PID 22654 / node PID 22731 remains build cwd-fix-v0.9.7-r1, version 0.9.7, checkout c094b9eea32173d7c4dd0c0a444a332ebac8f5d8, started before installation; do not claim the installed generation is loaded. Exact hashes and paths are recorded in .ralph/plans/EXECUTION_PLAN.md. Stop before restart.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Old pause/resume tools, source, installer ownership, and autonomous transport are removed before the new transient policy; proportionate non-native tests and diff checks pass; docs/plan/Beads match; one clean candidate is pushed and freshly reviewed; managed apply/check passes; stop before restart.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
Owner disposition: REVISE exact pushed Slice 1 candidate 3f2072e3f6031f688a1dcb437da79f278df2f254. The commit is not accepted and Slice 2 remains blocked. Operator selected revise after the required EXPERT and sole replacement both failed technically without a usable disposition; those failures are already recorded separately and no third reviewer is authorized for this exact commit.

Accepted in-scope findings for the repair generation:

1. P1 machine/process safety. Evidence: tests/test_goal_work_control_native.py starts the first and resumed standalone Prime Agent RPC processes and calls _stop_rpc only on the success path. Any assertion, RPC error, or setup failure between start and the linear stop can leave a process alive. Violated invariant: every agent-created Prime Agent process must be deterministically terminated on success, failure, and replay, and Joe's machine must never gain a concurrent second instance. Root cause seam: process ownership is not enclosed by guaranteed cleanup. Repair direction: introduce one bounded ownership/cleanup structure that guarantees termination for both processes and preserves useful failure evidence. Do not weaken the active-process guard, swallow the original assertion, use broad kill patterns, or start a live probe while the daemon is active. Acceptance evidence must cover normal completion, injected failure before the first stop, failure in the resumed path, cleanup idempotence/replay, and zero surviving owned process.

2. P1 evidence durability and provenance. Evidence: the approved plan requires sanitized machine-readable probe artifacts under docs/evidence/goal-heartbeat-work-control/, but the passing run wrote provider and hook records only beneath pytest tmp_path and retained no committed artifact. Violated invariant: a point-in-time native characterization must be independently reviewable without private transcripts or rerunning the process. Root cause seam: the harness asserts temporary captures but has no sanitized durable evidence output/manifest contract. Repair direction: define and validate a bounded machine-readable evidence artifact with exact runtime/build/commit, command, fixture/matrix rows, provider-call classifications, compatibility decisions, counts, and result provenance. Do not fabricate the deleted passing-run capture, copy private prompts/transcripts, or present expected fixtures as observed runtime output. If an actual artifact requires a maintenance-window rerun, prepare the deterministic command/schema now and report the remaining operator blocker explicitly.

3. P1 acceptance gate unresolved. Evidence: the plan requires pytest -q tests, while the candidate ran only an inventoried safe Python selection and leaves review open on whether a maintenance window is needed. Violated invariant: a slice cannot call its evidence complete while its own required gate remains an open review question. Root cause seam: the plan's generic full-suite command conflicts with the stricter machine-wide single-instance rule in an active daemon session. Repair direction: reconcile the active plan and Slice 1 evidence truthfully, inventory every native-process test excluded from the safe suite, preserve the safe suite result, and define the exact operator-controlled no-daemon maintenance gate needed for any remaining focused/full native evidence. Do not launch another Prime Agent process, silently convert skips into passes, or claim literal full-suite success.

4. P1 version and incident-baseline inconsistency. Evidence: specification and top-level plan language identify 0.9.6 as the initial compatibility/incident baseline, while only exact 0.9.7 build cwd-fix-v0.9.7-r1 commit c094b9eea32173d7c4dd0c0a444a332ebac8f5d8 was characterized. The candidate adds a 0.9.7 note without reconciling the authoritative active artifacts. Violated invariant: supported-generation claims must match exact evidence and preserve incident history. Root cause seam: point-in-time evidence was appended without updating baseline terminology consistently. Repair direction: preserve 0.9.6 as the historical incident/planning baseline, identify only that exact 0.9.7 build/commit as the characterized implementation baseline, and reconcile specification, plan, canonical doc, and Bead without asserting a broader version range or retroactive 0.9.6 probe.

5. P2 transparent safety provenance. Evidence: the 1/1 passing focused run occurred before the new guard and while the sole daemon was active; the committed text calls it isolated but does not state that configuration isolation did not satisfy Joe's machine-wide single-instance rule. Violated invariant: safety-relevant evidence limitations must be explicit. Root cause seam: 'isolated' conflates temporary config/session roots with process-level exclusivity. Repair direction: record the existing result as technically informative but policy-noncompliant provenance, and require any acceptance-quality rerun to occur only in an operator-controlled maintenance window. Do not erase the result, call it compliant, or rerun now.

6. P2 private test-plumbing boundary. Evidence: the harness sets PRIME_AGENT_INTERNAL_LEGACY_OWNED_WORKER_FRONTEND=1. The characterized production carrier is claimed to be the public before_agent_start hook, but this internal launch switch is not explained. Violated invariant: private test plumbing must not be mistaken for the selected production seam or a compatibility guarantee. Root cause seam: the launch dependency is implicit. Repair direction: characterize and document exactly what the switch controls, constrain it to the temporary native harness, and state why it does or does not affect the public-hook conclusion. Avoid production reliance, wider compatibility claims, or silent removal without equivalent safe evidence.

Repair these findings together where their evidence contracts overlap. Keep Slice 1 bounded: no production plugin, installer, pause/resume removal, Prime Agent source, or Slice 2 work. Update active plan/spec/docs/tests and prime-claw-h6w.24.1 evidence. Produce one new clean pushed commit and report exact diff, commands/results, limitations, Bead, push, and worktree state. A new exact commit requires a fresh independent owner review and fresh required EXPERT; the failed reviewers for 3f2072e cannot be reused.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Operator-approved scope reduction supersedes the rejected 3f2072e Slice 1 native-probe repair. The next admitted execute generation must first reconcile active spec/plan/docs/Beads to two checkpoints, then produce one safety-first implementation candidate: remove pause_thread_goal, resume_thread_goal, goal-blocker-control.ts, installer/checker ownership, and autonomous pause/resume transport before adding the transient before_agent_start policy. Use only proportionate non-native unit, installer migration, static absence, safe-suite, and diff evidence. Do not build/run the standalone RPC/provider-capture framework, machine-readable native evidence matrix, concurrent Prime Agent process, broad version matrix, or repeated full native suite. Target only installed Prime Agent 0.9.7 cwd-fix-v0.9.7-r1 at c094b9e; 0.9.6 is incident history only and Prime Agent source is unchanged. After the clean pushed candidate and managed apply/check, stop before restart with exact operator action and concise Joe-run manual UAT checklist; do not claim the loaded generation changed. Preserve rejected 3f2072e in history and discard/replace only the reported episode-owned dirty repair paths, preserving unrelated work.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Checkpoint 1 candidate pushed: 60a2d4bb5f3a0e51620c62ae7bf0f640c0fc5ddb. It preserves rejected 3f2072e in history, removes the obsolete pause/resume tools and native carrier framework, adds the transient capability-gated before_agent_start policy, updates isolated migration safety, and reconciles plan/spec/docs/Beads to two checkpoints. Evidence: explicitly enumerated safe non-native Python suite 268 passed + 11 subtests (11 deprecation warnings); six mock-based Node suites 134 passed; bash -n and git diff --check passed. No native Prime Agent process or full native suite was run. Fresh owner and EXPERT review is now requested before managed apply/check.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Owner review disposition: REVISE exact pushed Checkpoint 1 commit 60a2d4bb5f3a0e51620c62ae7bf0f640c0fc5ddb. Branch/head/origin match and the episode worktree is clean. Independent checks passed: Node work-control suite 7/7; focused Python/plugin/install/execute suite 20 passed plus 11 subtests; commit diff check passed. No Prime Agent process was launched. The removal-first managed migration, source deletion, replacement extension, and proportional test direction are accepted, but the exact commit is not accepted because of the findings below. Do not run apply/check yet.

1. P1 silent-no-op precedence bug. Evidence: goal-heartbeat-work-control.ts calls rejectCollision(event.systemPrompt, ctx) before compatible(event). Therefore an unsupported run missing ipython/goal/rlm-heartbeat but containing any marker/sentinel emits an error, calls ctx.abort(), and throws. Violated invariant: if any required compatibility signal is absent, leave the prompt unchanged and emit no message, error, tool, or state mutation. Collision fail-closed behavior is relevant only when the run is otherwise compatible and would inject. Root-cause seam: collision validation precedes capability gating. Repair direction: make incompatibility return first, then enforce collisions on compatible runs. Add direct tests combining every marker/sentinel shape with an incompatible capability shape and require undefined return, zero notify/abort, and unchanged event; retain positive compatible collision-abort tests. Regression risks: silently accepting duplicate policy in a compatible run, or emitting on an unsupported run.

2. P2 manual-UAT boundary remains too technical. The checklist asks Joe to prove an incompatible configuration received no hidden policy and that hidden prompt content did not accumulate across resume. Those are not reliable user-visible acceptance observations and recreate the formal runtime framework Joe explicitly replaced. Keep capability/no-accumulation as direct unit contracts. Restrict manual UAT to visible outcomes: old tools absent, active work -> monitored wait -> fresh goal when work remains, and human blocker -> one checkpoint with no person-polling heartbeat.

3. P2 duplicate intermediate EXPERT gate. The reduced plan still requires an EXPERT review at Checkpoint 1 even though project oversight already requires one fresh final exact-candidate EXPERT after UAT/artifact reconciliation. Joe explicitly reduced unnecessary formality, and the earlier intermediate reviewer transport failed twice. Require owner review at Checkpoint 1; retain exactly the mandatory final EXPERT gate. Do not silently remove the final gate.

4. P2 Bead inconsistency. prime-claw-h6w.24.1 has the new title/acceptance criteria but its description still says to build the rejected native provider probe and make no production extension changes. Update it to the two-checkpoint safety-first candidate and append exact 60a2d4b review evidence without erasing history.

5. P3 installation documentation drift. docs/lab-global-plugin.md says apply removes one obsolete episode-finalization file, while the code now safely manages two obsolete files including goal-blocker-control.ts. Correct the count/names and keep the safety wording consistent.

Keep revision narrow: no native probe, no apply/check, no Prime Agent process/source change, no extra framework, and no new scope. Produce one clean pushed replacement candidate with exact safe tests, docs/plan/spec/Bead evidence and clean worktree, then stop for owner review.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Replacement candidate pushed: 4a6e07a5cf0752b20976c65b2108ae8acd338792. It revises rejected 60a2d4b using only the five owner-accepted findings. Compatibility now returns before collision validation; direct Node coverage crosses five incompatible capability shapes with five marker/sentinel shapes and asserts unchanged undefined return plus zero notify/abort, while compatible collision abort tests remain. Manual UAT is visible-only; the duplicate intermediate EXPERT gate is removed while the mandatory final exact-candidate EXPERT remains; this Bead description/evidence is current; lab-global names both obsolete managed files. Evidence: focused Node 8/8; focused Python/plugin/install/execute 20 passed plus 11 subtests in 6.02s; safe non-native Python 268 passed plus 11 subtests in 18.13s with 11 existing deprecation warnings; six mock Node suites 135 passed in 27.6s; bash -n and git diff --check passed. No installer/check implementation change, managed apply/check, native probe/full suite, or new Prime Agent process occurred. Worktree is clean and up to date with origin. Send this exact commit for fresh owner review; do not run the duplicate intermediate EXPERT review.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Owner ACCEPTS exact pushed Checkpoint 1 replacement commit 4a6e07a5cf0752b20976c65b2108ae8acd338792 for the bounded managed apply/check step. Reconciled evidence: episode branch HEAD and origin match; worktree clean; diff check passes; replacement is limited to the five recorded findings; direct Node suite independently passed 8/8 including 25 incompatible-plus-marker unchanged/no-notify/no-abort cases and retained compatible collision aborts; focused Python plugin/install/execute suite independently passed 20 tests plus 11 subtests; episode reports full safe Python 268 plus 11 subtests and six mock Node suites 135; no native Prime Agent process, managed apply/check, installer implementation change, or Prime Agent source change occurred in the replacement. Manual UAT is now limited to visible outcomes, the duplicate intermediate EXPERT gate is removed while the mandatory final exact-candidate EXPERT remains, prime-claw-h6w.24.1 description/evidence is current, and lab-global docs name both obsolete files. No material finding remains for this exact candidate. Next approved work is managed apply/check only, verification that installed files match and the old file is absent, then stop before restart and report the exact operator action/manual checklist. Acceptance does not claim the loaded runtime is updated.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Checkpoint 1 managed installation completed without activation. Owner-accepted source commit: 4a6e07a5cf0752b20976c65b2108ae8acd338792. Durable evidence commit: d5e8b77f5d979a9edea2518f315b28538f963ae1. scripts/apply-prime-agent-plugin.sh exited 0 and scripts/check-prime-agent-plugin.sh independently exited 0 against /Users/jlanders/.prime/agent. Independent verification found all eight managed TypeScript installs regular and byte-identical to source; extensions/goal-blocker-control.ts, extension-support/episode-finalization.ts, and extensions/project-conversation.ts are absent with no dangling symlink; managed APPEND_SYSTEM.md validation passed. No Prime Agent or native probe was launched. Existing daemon PID 22654 / node PID 22731 remains build cwd-fix-v0.9.7-r1, version 0.9.7, checkout c094b9eea32173d7c4dd0c0a444a332ebac8f5d8, started before installation; do not claim the installed generation is loaded. Exact hashes and paths are recorded in .ralph/plans/EXECUTION_PLAN.md. Stop before restart.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Checkpoint 1 owner-accepted candidate applied and checked; installed parity and obsolete-file absence verified; stopped before restart.
<!-- SECTION:FINAL_SUMMARY:END -->
