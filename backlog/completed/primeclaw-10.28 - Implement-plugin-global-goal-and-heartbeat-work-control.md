---
id: PRIMECLAW-10.28
title: Implement plugin-global goal and heartbeat work control
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p1
type: feature
ordinal: 53000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the operator-approved two-checkpoint goal/heartbeat work-control plan in .ralph/plans/SPECIFICATION.md and EXECUTION_PLAN.md: one safety-first candidate with proportionate non-native evidence, then one operator-controlled restart and Joe-observed manual UAT. Prime Agent core remains unchanged.

## Legacy notes

Approved source: .ralph/plans/SPECIFICATION.md and .ralph/plans/EXECUTION_PLAN.md. Episode 01a0f0a2-a3d5-706e-92e6-0448235e8127.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Checkpoint 1 removes obsolete pause/resume tools and transport before adding the transient capability-gated policy; safe non-native tests pass; one clean candidate is pushed, reviewed, and applied/checked without claiming activation. Checkpoint 2 records Joe-observed manual UAT after one operator-controlled restart. Active docs are archived only after Checkpoint 2 passes.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
Operator decision (2026-09-30): simplify goal/heartbeat delivery and use operator-run manual user acceptance testing for model/runtime behavior instead of building the large native Prime Agent provider-capture and machine-readable evidence framework. Reorder risk reduction so the obsolete Prime Claw pause_thread_goal/resume_thread_goal tools, goal-blocker-control extension, installer entry, and autonomous pause/resume transport are removed first. Deleting files is not claimed active until the managed global copy is applied and the sole existing Prime Agent runtime is restarted; do not launch another instance. Build against the currently installed Prime Agent 0.9.7 downstream generation cwd-fix-v0.9.7-r1 at c094b9e; preserve 0.9.6 only as incident history and never roll back or modify Prime Agent source.

Keep only proportionate automated evidence: direct non-native unit tests for the before_agent_start contribution, capability gating, marker/collision behavior, no message/state persistence, and policy size/content; isolated installer/apply/check tests proving safe obsolete-file removal and unrelated-file preservation; static/source tests proving the two old tools and native pause/resume injection are absent; and the existing safe non-native suite/diff checks. Do not build or require the Slice 1 standalone RPC carrier framework, committed provider-capture artifacts, a broad version matrix, repeated full native suites, or any concurrent Prime Agent process.

After apply/check and one operator-controlled restart, Joe will perform manual UAT in the fresh installed generation. The concise checklist must verify: old tools are absent; a compatible normal session follows active-work goal -> monitored observable wait -> fresh goal only when substantive work remains; a human-only blocker gets one actionable checkpoint with no person-polling heartbeat; incompatible capability configurations receive no work-control policy; and the policy does not visibly accumulate across ordinary turns/resume. Record Joe's observed pass/fail as the behavioral acceptance evidence. Update the active specification, execution plan, canonical docs, and Beads to replace the superseded six-slice/native-probe gates with this smaller safety-first sequence. Stop the current 3f2072e Slice 1 repair at a safe checkpoint; do not continue its evidence-framework work or begin the reordered implementation until the owner admits the revised generation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Managed apply/check completed for exact owner-accepted event-driven repair 486f4af62b7c1088a0ad10eb9ca05a2e0f735401 on 2026-09-30 PDT. Commands: scripts/apply-prime-agent-plugin.sh exit 0 (0.64s, mandatory final check passed); scripts/check-prime-agent-plugin.sh exit 0 (0.23s); explicit APPEND_SYSTEM managed-block check exit 0 (0.19s). Independent lstat/byte/hash audit: all 8 installed TypeScript paths under /Users/jlanders/.prime/agent are mode-0644 regular non-symlink files byte-identical to inert source. Updated goal-heartbeat-work-control.ts is 4,878 bytes, SHA-256 8faa7537a1f177327177c796287d6d36ab50df624f8c5552906f50ca6437d595; complete path/hash table is in active EXECUTION_PLAN.md. Obsolete goal-blocker-control.ts, episode-finalization.ts, and project-conversation.ts are absent with no dangling symlink. Installed APPEND_SYSTEM.md managed block equals source (1,114 bytes, SHA-256 1edfae19b113187332c031ee7e0ac92943a1e9e08cd84fe34af1e980b3300a7a). No Prime Agent/native probe launched. Loaded daemon PID 14672, daemon-node 14714, conversation 38255 use build cwd-fix-v0.9.7-r1, version 0.9.7, commit c094b9eea32173d7c4dd0c0a444a332ebac8f5d8; daemon start 09:15:41 PDT predates installed policy write 10:12:30 PDT, so installation is not claimed active. Stop before restart/UAT. Next operator action: quiesce work; restart sole daemon once via normal service action without a concurrent daemon; open fresh builder-rooted session; run only visible Checkpoint 2 UAT.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Durable managed-install evidence pushed in commit 3a526ec68a13783d11acb609b3d485a577b26a91 on branch episode/goal-heartbeat-work-control. This records exact commands/results, all installed paths/sizes/SHA-256 hashes, APPEND_SYSTEM parity, obsolete-path absence, loaded runtime identity, and the operator restart action. Final post-commit scripts/check-prime-agent-plugin.sh also exited 0. bd sync is unavailable in this bd build (unknown command); authoritative Bead changes were pushed with bd dolt push. No restart or renewed UAT occurred.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Terminal reconciliation prepared after passing visible Checkpoint 2 UAT. Canonical docs now record the exact UAT receipts without changing approved behavior. The completed active SPECIFICATION.md and EXECUTION_PLAN.md moved together to .ralph/plans/archive/goal-heartbeat-work-control/; the archive README links both files plus docs/goal-heartbeat-work-control.md, and all three relative targets resolve. Final post-archive non-native evidence: direct Node policy suite 8/8; focused Python plugin/install/execute suite 21 passed plus 11 subtests in 6.38s (combined 7.08s); shell syntax, managed plugin check, and git diff --check passed. src/, scripts/, and tests/ have no diff from accepted repair 486f4af62b7c1088a0ad10eb9ca05a2e0f735401. No Prime Agent/native probe, broad/native suite, final EXPERT review, merge, abandonment, cleanup, or episode bookkeeping close ran. The archived bundle is a readiness claim only; exact terminal Git commit will be appended after push. Next gate is owner reconciliation followed by the mandatory fresh exact-candidate EXPERT review.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Terminal candidate pushed: bdd7d8ba32e4c8bbe85f4b9110dd5f005f369a52 on episode/goal-heartbeat-work-control. Git detects exact active-to-archive renames: EXECUTION_PLAN.md R083 and SPECIFICATION.md R089 into .ralph/plans/archive/goal-heartbeat-work-control/. The commit also updates .ralph/plans/archive/README.md, docs/goal-heartbeat-work-control.md, and docs/lab-global-plugin.md. Archive index links resolve to both archived files and the canonical operating contract. Final gates: Node 8/8; focused Python 21 plus 11 subtests; shell syntax, installed plugin check, link check, and git diff check passed. All related Beads are closed. No final EXPERT review, merge, abandonment, resource cleanup, or episode bookkeeping finalization occurred. Stop for owner reconciliation and the mandatory fresh exact-candidate EXPERT gate.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Mandatory fresh final exact-candidate EXPERT gate PASSED for commit `bdd7d8ba32e4c8bbe85f4b9110dd5f005f369a52`.

Reviewer evidence: child `sub-cc0b042c`; reviewer session `01a0f3d5-4402-7741-9677-91b6201c91d5`; model `openai-codex/gpt-6-astra`; explicitly admitted reasoning `max`; exact profile `.prime/agent/profiles/expert-reviewer.md` passed strict raw-frontmatter validation; combined task was delivered exactly once. Full immutable report: `/Users/jlanders/.prime/agent/session-artifacts/01a0e8b6-669c-7334-863e-c451e9aee112/sub-cc0b042c/goal-heartbeat-final-expert-report.md`; SHA-256 `4ec5d66b597d7eae9fd28ec793ff64b87eb1bd575a615f5fe7211a1071758139`; 16,459 bytes. Disposition: PASS — no material finding remains for exact candidate. Independent reviewer checks included Node 8/8, focused Python 21 plus 11 subtests, 112 incompatible/collision pure-mock cases plus 7 compatible collisions/replay/resource change, shell syntax, both diff checks, exact remote HEAD, archive links/active-path absence, actual installed eight-file and APPEND byte/type/hash parity, and no src/scripts/tests diff from accepted repair `486f4af62b7c1088a0ad10eb9ca05a2e0f735401`. No Prime Agent/native probe or mutation ran.

Owner adjudication: ACCEPT PASS. The sole P3 note is non-blocking measurement-label precision in the archived plan: the full ASCII policy block is 2,975 characters/bytes; the test-defined marker/sentinel-stripped body is 2,830 including retained newlines, while the archive's `2,828 characters / 2,975 bytes` wording conflates boundary conventions. Both spans are below the 4,000-byte ceiling; behavior, acceptance, and safety are unaffected. Do not churn the already reviewed exact candidate for this wording-only clarification; preserve this ledger note for future documentation cleanup. Any material candidate change would invalidate this PASS.

Terminal review heartbeat `35e6b393-ac08-4e87-a3cc-f74208153188` was cancelled after preserving the report, absence was verified, and the exact reviewer was retired. This PASS is review evidence only. Candidate is now ready for Joe's explicit merge, revise, pause, or abandon decision. No merge, cleanup, or episode-bookkeeping finalization has occurred.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Operator terminal decision: MERGE AND INSTALL exact accepted episode candidate `bdd7d8ba32e4c8bbe85f4b9110dd5f005f369a52`.

Git integration and validation: merged the episode into current `main` with conflict-free merge commit `9b3edd27e86d4a25a629e9ea8956ef51791ec3ac` (parents `a6a55bc9cd2129d6c6a8aecbd0e6f2a58856e43c` and `bdd7d8ba32e4c8bbe85f4b9110dd5f005f369a52`). Pushed normally to `origin/main`; root `main` and `origin/main` both resolve to `9b3edd2`. Merged-tree gate passed: all six non-native Node suites `136/136`; documented 18-file safe non-native Python suite `269 passed`, `11 subtests passed`, 11 existing warnings; shell syntax and both-parent diff checks passed.

Managed installation: `scripts/apply-prime-agent-plugin.sh` exited 0 and explicitly requires restart before treating the merged generation as newly loaded; independent `scripts/check-prime-agent-plugin.sh` exited 0, including final post-cleanup replay. All eight installed managed TypeScript files are byte-identical to merged `main`; goal policy SHA-256 remains `8faa7537a1f177327177c796287d6d36ab50df624f8c5552906f50ca6437d595`; merged `spec-episode.ts` SHA-256 is `071fad769058b82e92e2615d6092bf73e052e74025141ad48e149057577296d4`. All three obsolete paths remain absent.

Terminal resources: exact episode session `01a0f0a2-a3d5-706e-92e6-0448235e8127` / active route `8d74bc098e97` was idle, queue-free, and attachment-free after documented `prime-agent stop`; it is now archived with zero attached clients and its saved session retained as audit evidence. Episode and temporary merge worktrees were clean then removed. Local episode and integration branches were deleted; remote `episode/goal-heartbeat-work-control` was deleted; worktree inventory and refs were verified. The retained root future bundle was byte-identical to promotion commit `e4f5899`, backed up at `/Users/jlanders/.prime/agent/session-artifacts/01a0e8b6-669c-7334-863e-c451e9aee112/goal-heartbeat-terminal-backup`, then removed; final archived specification/plan remain tracked under `.ralph/plans/archive/goal-heartbeat-work-control/`. No episode heartbeat remains.

Unrelated pre-existing root `.beads/interactions.jsonl` dirt was preserved byte-for-byte as a Git binary patch (SHA-256 `06a6eec6bfcca7cfb6b9769744dfad07c458d38c76d3eb2643106ad2416cd1ef`) and was not included in the merge. Terminal Git/session/worktree/branch/install work is verified. The only remaining lifecycle action is the exact no-UI `finalize_spec_episode(.ralph/plans/future/goal-heartbeat-work-control)` bookkeeping close; no Git or resource work will be replayed.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Exact no-UI bookkeeping close completed successfully for `.ralph/plans/future/goal-heartbeat-work-control`. The tool confirmed oversight inactive while ordinary CONVERSATION capability remains. This call performed no Git, merge, abandonment, session, worktree, branch, or cleanup action; all such terminal work was completed and verified before the call. Exact replay is not needed.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implementation, managed installation, visible UAT, canonical docs, direct tests, and required plan archival are complete. Terminal candidate is ready for owner reconciliation; fresh final EXPERT and operator merge decision remain separate.
<!-- SECTION:FINAL_SUMMARY:END -->
