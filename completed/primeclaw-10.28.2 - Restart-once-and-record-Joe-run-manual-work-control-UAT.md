---
id: PRIMECLAW-10.28.2
title: Restart once and record Joe-run manual work-control UAT
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels:
  - episode-loop
  - phase4
  - ralph
dependencies:
  - PRIMECLAW-10.28.1
parent_task_id: PRIMECLAW-10.28
priority: p1
type: task
ordinal: 55000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Operator-controlled Checkpoint 2 after the accepted work-control generation was installed and checked. Quiesce work, restart the sole Prime Agent daemon once using Joe's normal service action, and record only the three visible manual-UAT outcomes. Do not start a concurrent process. Hidden capability gating and non-accumulation remain direct automated-test contracts, not manual steps.

## Legacy notes

Checkpoint 1 completed in evidence commit d5e8b77f5d979a9edea2518f315b28538f963ae1; installed source commit 4a6e07a5cf0752b20976c65b2108ae8acd338792. Daemon PID 22654 predates installation and is not claimed updated. Operator must perform the normal single-daemon restart before UAT. Exact installation paths, hashes, obsolete-file absence, and runtime identity are in .ralph/plans/EXECUTION_PLAN.md.

Post-restart manual UAT result and bounded repair: old-tool absence passed. Goal/wait transfer failed with goal 7f71dda7-9707-447a-963c-a7029eee8523 because the policy did not clearly treat goal completion as ending the current active-work epoch while the broader requested outcome remains unfinished. Operator correction is event-driven, not predictive: no precomputed next gate; after an actual long-running/background operation starts, establish and verify the exact heartbeat, recheck, then if still running complete the current goal and end the turn; human-only blockers complete the current goal with one resumable checkpoint and no person-polling heartbeat; later substantive work starts under a fresh goal. Repair candidate validation: focused Node 8/8; focused Python 21 passed plus 11 subtests; safe non-native Python 269 passed plus 11 subtests; all six mock Node suites 135/135; shell syntax, diff check, 2,828-byte policy bound, and unique sentinel passed. No native probes, apply/check, restart, or renewed UAT ran. Candidate commit will be recorded after push; owner review is the next boundary.

Repair candidate pushed: 486f4af62b7c1088a0ad10eb9ca05a2e0f735401. Exact scope: event-driven active-work epoch policy, direct semantic tests, canonical docs, active plan/spec, and Bead evidence only. Evidence: focused Node 8/8; focused Python 21 passed plus 11 subtests; explicit safe non-native Python 269 passed plus 11 subtests; six mock Node suites 135/135; shell syntax, git diff check, 2,828-byte policy bound, and unique sentinel passed. Test-wait heartbeats bf646472-9987-4ddc-ae80-d5b7729a4afb and 3b1c28da-e41b-4987-8f55-46eb47f4472c were each deleted and absence verified after exit 0. No native probe, managed apply/check, restart, or renewed UAT ran. Stop for owner review of this exact commit; user-global installation remains the prior failed-UAT generation.

Managed apply/check completed for exact owner-accepted event-driven repair 486f4af62b7c1088a0ad10eb9ca05a2e0f735401 on 2026-09-30 PDT. Commands: scripts/apply-prime-agent-plugin.sh exit 0 (0.64s, mandatory final check passed); scripts/check-prime-agent-plugin.sh exit 0 (0.23s); explicit APPEND_SYSTEM managed-block check exit 0 (0.19s). Independent lstat/byte/hash audit: all 8 installed TypeScript paths under /Users/jlanders/.prime/agent are mode-0644 regular non-symlink files byte-identical to inert source. Updated goal-heartbeat-work-control.ts is 4,878 bytes, SHA-256 8faa7537a1f177327177c796287d6d36ab50df624f8c5552906f50ca6437d595; complete path/hash table is in active EXECUTION_PLAN.md. Obsolete goal-blocker-control.ts, episode-finalization.ts, and project-conversation.ts are absent with no dangling symlink. Installed APPEND_SYSTEM.md managed block equals source (1,114 bytes, SHA-256 1edfae19b113187332c031ee7e0ac92943a1e9e08cd84fe34af1e980b3300a7a). No Prime Agent/native probe launched. Loaded daemon PID 14672, daemon-node 14714, conversation 38255 use build cwd-fix-v0.9.7-r1, version 0.9.7, commit c094b9eea32173d7c4dd0c0a444a332ebac8f5d8; daemon start 09:15:41 PDT predates installed policy write 10:12:30 PDT, so installation is not claimed active. Stop before restart/UAT. Next operator action: quiesce work; restart sole daemon once via normal service action without a concurrent daemon; open fresh builder-rooted session; run only visible Checkpoint 2 UAT.

Durable managed-install evidence pushed in commit 3a526ec68a13783d11acb609b3d485a577b26a91 on branch episode/goal-heartbeat-work-control. This records exact commands/results, all installed paths/sizes/SHA-256 hashes, APPEND_SYSTEM parity, obsolete-path absence, loaded runtime identity, and the operator restart action. Final post-commit scripts/check-prime-agent-plugin.sh also exited 0. bd sync is unavailable in this bd build (unknown command); authoritative Bead changes were pushed with bd dolt push. No restart or renewed UAT occurred.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Joe records pass/fail after the restart for exactly: (1) pause_thread_goal and resume_thread_goal are visibly absent; (2) a compatible normal session visibly transfers active work from a bounded goal to an exact monitored wait and creates a fresh goal only if substantive work remains; (3) a human-only blocker produces one visible actionable checkpoint and no heartbeat that merely polls the person. Final exact-candidate EXPERT review remains mandatory after UAT and final artifact reconciliation.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
Checkpoint 2 manual UAT result: FAIL at visible wait-transfer setup after the operator-controlled restart. PASS: the reloaded compatible owner session contains the V1 goal/heartbeat policy and no longer exposes model-facing pause_thread_goal or resume_thread_goal tools. FAIL: before the observable-wait test, the model created active goal 7f71dda7-9707-447a-963c-a7029eee8523 with requested-outcome-wide objective `Run visible post-restart manual UAT for goal/heartbeat work control through an observable wait and a human-only blocker, then record the result`. That written objective spans both a future external wait and a later human boundary, so it cannot truthfully be completed at the required wait handoff. The first short wait completed during the create/verify/recheck setup; its exact heartbeat 92a860aa-66c8-4016-bd3d-019602eb90c3 was deleted and absence verified, its exact marker was removed, and the terminal result was handled immediately. No second wait was started. At the resulting human recovery blocker, the owner reported the exact blocker/checkpoint and created no heartbeat; the earlier request for native /goal clear is withdrawn because forcing recovery would hide the UAT failure. No process or heartbeat remains.

Root cause: the injected policy says `bounded active-work goal` and later says to complete it before yielding, but it does not explicitly require the written goal objective itself to end at, and be true by, the next known ownership boundary. The model therefore used the whole requested outcome as the goal epoch. Repair direction: add a concise semantic clause requiring the agent to identify the next expected external-wait or human boundary before goal creation, write the goal objective only for useful work before that boundary, and keep the broader requested outcome separate. The objective must be true when ownership transfers. If an existing goal spans a boundary, preserve and report it rather than falsely completing, clearing, pausing, resuming, or reinterpreting it. Update specification/plan/canonical docs and direct policy-content tests only; do not restore native probes or broad testing. Apply/check, restart once, and rerun the same visible UAT after exact owner review. The human-blocker scenario was not separately completed because UAT stopped on this first material failure.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Checkpoint 2 repair pause: exact episode 01a0f0a2-a3d5-706e-92e6-0448235e8127 (route 747da43b818c) is idle and not waiting on any background process, but its forked thread state preserves paused goal 62713d27-c927-4fa6-9977-16a09af8ca50 with the obsolete source-mode episode-admission objective. That incompatible goal predates successful admission and is already fulfilled outside this fork; the current repair must not complete, clear, resume, or reinterpret it autonomously to make room. The episode stopped with intentional uncommitted edits only to .ralph/plans/SPECIFICATION.md and .ralph/plans/EXECUTION_PLAN.md atop d5e8b77f5d979a9edea2518f315b28538f963ae1. No source/test/apply/restart work occurred. The repair-generation heartbeat is cancelled because only operator action remains. Required action: in the exact sibling session named goal-heartbeat-work-control-episode, Joe should run native `/goal clear` to disposition that stale fork-local goal, then return to the owner conversation and report `cleared`. Do not run the command in the owner conversation; its UAT and repair-preparation goals are already complete. After the episode goal is cleared, obtain fresh idle evidence and continue the recorded bounded repair through canonical handoff.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Operator correction superseding both the predictive-boundary repair and the reported stale-goal blocker. Native `/goal clear` in the exact session `goal-heartbeat-work-control-episode` returned that there was no goal; trust that result. The prior claim that paused goal 62713d27-c927-4fa6-9977-16a09af8ca50 blocked execution was false or stale and requires no further goal-control action. Preserve the episode's uncommitted active-plan/spec edits only as a checkpoint, then replace the incorrect predictive-boundary direction below.

Do not require an agent to predict the next wait or human gate when creating a goal. Restore the known-good event-driven semantics formerly carried by the execute skill, generalized plugin-globally:

1. A goal owns the current active-work epoch toward the broader requested outcome. Ending that epoch is not a claim that the requested outcome is complete.
2. When the agent actually starts any long-running/background operation—examples include one or more subagents, a build/test job, download, deployment, container startup, or another process that will continue without agent action—it MUST transfer ownership even if requested work remains. Retain an inspectable handle/status location; create and verify one exact heartbeat first (the safer ordering retained from the current design); recheck terminal state; if still running, complete the current active-work goal and end the turn. Do not keep a goal active merely to avoid admitting that more work remains.
3. The heartbeat reports only meaningful state changes and never restarts work. At terminal state it deletes/verifies its own removal and creates a fresh goal only if additional agent work remains; if the operation completes all requested work, report completion without a new goal.
4. When the agent is blocked or waiting for user input, credential, permission, physical action, or product decision, complete the current active-work goal even if the requested outcome remains unfinished, report one exact resumable checkpoint, and create NO heartbeat because there is no useful machine-observable wait. After the user unblocks work, create a fresh goal before substantive action.
5. Never inject or use autonomous pause/resume. Preserve incompatible unrelated goals and narrower identity/security boundaries.

Repair the policy text, active specification/plan, canonical operational docs, and direct semantic-content tests. Remove the uncommitted requirement to identify or predict the next ownership boundary before goal creation. Keep the already-accepted plugin mechanism, capability gating, migration, and proportionate non-native test boundary unchanged. Do not restore native probes, broaden scope, apply/check, or restart in this repair generation. Produce one clean pushed candidate for owner review. After acceptance, apply/check, restart once, and rerun the visible wait-transfer plus human-blocker UAT.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Post-restart manual UAT result and bounded repair: old-tool absence passed. Goal/wait transfer failed with goal 7f71dda7-9707-447a-963c-a7029eee8523 because the policy did not clearly treat goal completion as ending the current active-work epoch while the broader requested outcome remains unfinished. Operator correction is event-driven, not predictive: no precomputed next gate; after an actual long-running/background operation starts, establish and verify the exact heartbeat, recheck, then if still running complete the current goal and end the turn; human-only blockers complete the current goal with one resumable checkpoint and no person-polling heartbeat; later substantive work starts under a fresh goal. Repair candidate validation: focused Node 8/8; focused Python 21 passed plus 11 subtests; safe non-native Python 269 passed plus 11 subtests; all six mock Node suites 135/135; shell syntax, diff check, 2,828-byte policy bound, and unique sentinel passed. No native probes, apply/check, restart, or renewed UAT ran. Candidate commit will be recorded after push; owner review is the next boundary.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Repair candidate pushed: 486f4af62b7c1088a0ad10eb9ca05a2e0f735401. Exact scope: event-driven active-work epoch policy, direct semantic tests, canonical docs, active plan/spec, and Bead evidence only. Evidence: focused Node 8/8; focused Python 21 passed plus 11 subtests; explicit safe non-native Python 269 passed plus 11 subtests; six mock Node suites 135/135; shell syntax, git diff check, 2,828-byte policy bound, and unique sentinel passed. Test-wait heartbeats bf646472-9987-4ddc-ae80-d5b7729a4afb and 3b1c28da-e41b-4987-8f55-46eb47f4472c were each deleted and absence verified after exit 0. No native probe, managed apply/check, restart, or renewed UAT ran. Stop for owner review of this exact commit; user-global installation remains the prior failed-UAT generation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Owner ACCEPTS exact pushed event-driven repair commit 486f4af62b7c1088a0ad10eb9ca05a2e0f735401 for the bounded managed apply/check step. Branch HEAD/origin match and worktree is clean. Independent owner checks passed: direct Node policy suite 8/8; focused Python plugin/install/execute suite 21 passed plus 11 subtests; commit diff check passed. Episode evidence reports the full safe non-native Python boundary 269 plus 11 subtests, six mock Node suites 135/135, shell syntax, unique sentinel, 2,828-byte policy bound, and clean deletion of both test-wait heartbeats after exit 0. No native probe, apply/check, restart, renewed UAT, or final EXPERT ran.

The candidate faithfully implements the operator correction: no prediction of future gates; goals own active-work epochs toward the broader requested outcome; an actually started background operation gets an exact verified heartbeat first, then if still running the current goal completes even when requested work remains; terminal monitoring creates a fresh goal only if more agent work remains; user/human blocking completes the current goal with one resumable checkpoint and no person-polling heartbeat, followed by a fresh goal only after unblocking. The accepted migration, capability gating, and collision behavior remain unchanged. The false/stale episode-goal blocker is superseded by Joe's authoritative native result that no goal existed. No material finding remains for this exact commit.

Next approved work is managed global apply/check of this accepted source, installed parity verification, and obsolete-file absence, then stop before another operator-controlled restart and renewed visible UAT. Acceptance does not claim the current loaded process contains 486f4af. The mandatory final exact-candidate EXPERT remains after passing UAT and artifact reconciliation.
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
Renewed visible Checkpoint 2 UAT PASSED after Joe restarted the sole daemon and resumed this exact owner conversation with the repaired installed generation.

Visible outcome 1 — obsolete tool absence: `pause_thread_goal` and `resume_thread_goal` are absent from the current model-visible tool surface.

Visible outcome 2 — event-driven monitored wait: fresh active-work goal 1cac0599-adbd-4ed1-9e84-24d854a277e5 was created for the broader UAT. Observable process PID 46498 was retained with marker /tmp/prime-claw-visible-uat-10f860bf98bd445f9da83b5051facea1.txt. Exact heartbeat 6c244df4-97ab-4c95-8e8d-0521215322e6 was created and verified before recheck. Recheck showed the process still running; the goal was then completed after 20 seconds even though broader UAT work remained, and the turn ended. A nonterminal heartbeat observation reported marker `running` without creating a goal or restarting work. The process later exited 0 and marker reached `success`. First terminal handling inspected the retained result, deleted the exact heartbeat and verified no heartbeat remained, removed the marker, and did not duplicate the process.

Visible outcome 3 — human-only blocker: after terminal cleanup, fresh goal 4c5fcf18-3f69-4f8c-99de-d68bbef7f721 was created for the human-input checkpoint. Heartbeat inventory was empty. That goal was completed while broader UAT remained unfinished, and Joe was asked for exact external action `human-blocker-uat-cleared` with one resumable checkpoint and explicitly no polling heartbeat. Joe supplied that exact response. After unblocking, this fresh active-work goal was created before substantive reconciliation. No test process, marker, or heartbeat remains.

This satisfies the three Joe-observed visible-UAT outcomes in prime-claw-h6w.24.2. Hidden capability gating/non-accumulation remain direct-test evidence only. Checkpoint 2 and parent remain open until final artifact reconciliation and the mandatory fresh exact-candidate EXPERT PASS. Next approved step is to prepare one complete pushed terminal candidate: reconcile/finish the exact active specification and execution-plan artifacts per project archival policy, update archive index and links, align docs/tests/Beads, and stop for owner reconciliation before final EXPERT review. No merge, abandonment, cleanup, or final bookkeeping authority is implied.
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
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Renewed visible UAT passed all three required outcomes; terminal docs/archive/link/test reconciliation is complete and ready for owner review. Final EXPERT and merge authority remain separate.
<!-- SECTION:FINAL_SUMMARY:END -->
