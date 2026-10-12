---
id: PRIMECLAW-19
title: Test tier architecture + tier-1 plugin test container
status: Done
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies: []
priority: p1
type: epic
ordinal: 61000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement .ralph/plans/future/plugin-test-container: explicit test tiers (0 host static / 1 slim docker container for plugin tests / 2 OpenShell sandbox), slim tier-1 image, .env-selected prime-agent install (fork source pack or pinned npm), plugin applied inside container, one ephemeral container per suite run, dumb driver, unified test-all entry point.
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: episode bootstrap generation healthy. Slice 1 work verified in worktree (test.Dockerfile, test-tier1.sh, test_tier1_image.py, evidence note); episode waiting on host pytest suite (slow due to pre-migration host RPC probes). Shared-base extraction correctly deferred to blw.4 per spec escape hatch. agent_observe.recent_messages fails for sibling sessions (Unknown active session) — worktree evidence used as fallback.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight audit 2026-09-30 (operator asked whether host suite run needed correction): all 5 live-probe test files verified to use guarded isolation (--offline --no-session --no-extensions; 3 also redirect PRIME_AGENT_CODING_AGENT_DIR or use run-prime-agent-probe.sh). No settings/session mutation vectors present. Run is slow (~10min, repeated prime-agent spawns) but safe. Verdict: no mid-flight correction; slice 3 container migration is the durable fix. Operator offered optional standing instruction to skip live RPC probes in host gates for remainder of episode.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~23:20: operator delegated sibling management overnight ('The sibling is yours to manage'). Owner authority overnight: reconcile reports, EXPERT-gate each pushed candidate, advance slices 1->2->3 via handoff_spec_episode per accepted evidence, in-scope revise. WITHHELD pending operator: merge/abandon/cleanup/scope decisions; any consult/pause trigger (blocker, conflicting evidence, product question) parks the episode for morning. Standing instruction delivered to episode: skip live RPC probes in host-side gates for rest of episode (agentmsg_60dadfa6). Watch cb3edf77 armed.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-29 23:50: episode pytest gate DEADLOCKED ~30min. Root cause: test_reviewed_plan_extension.py::test_installed_rpc_characterizes_confirmed_steer_lifecycle_order spawned an RPC probe (node 47683, tsx --mode rpc --offline --provider probe) that went idle and orphaned (PPID 1); pytest blocked in read() on its stdout pipe. Owner killed ONLY the orphan -> pytest unblocked with a truthful test failure. Episode notified (agentmsg_6160029a): treat failure as infra hang, investigate, and per standing instruction skip live RPC probes in future host gates. This hang is exactly the host-coupling class tier 1 eliminates.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 00:05: slice-1 candidate 47d2830 reconciled (commit/push/blw.1-close/files all verified; owner re-ran 9/9 tier-0 green). EXPERT gate in flight: fresh expert-reviewer-blw1-47d2830 (sub-d5400031), model openai-codex/gpt-6-astra, thinking max, packet agentmsg_14120c94. Awaiting PASS/BLOCK. Host note for operator: global plugin install is a generation behind main (goal-heartbeat vs goal-blocker-control) — apply+restart needed at keyboard time, not overnight.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate disposition (slice-1 candidate 47d28309315133821d857c38fe6eb4bcd14a8643): BLOCK accepted. Reviewer expert-reviewer-blw1-47d2830 (sub-d5400031, session 01a0f11c-4e60-73b9-a5c9-6e6d9058a688), model openai-codex/gpt-6-astra, thinking max, packet agentmsg_14120c94. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-47d2830-expert-block.md (main commit b861dfd). Findings B1/B2/B3 all classified in-scope slice-1 review-rework; routing revise via handoff_spec_episode. Reviewer retired after report preservation. Fresh EXPERT gate required on the repaired candidate (47d2830 review invalidated by repair).
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~00:45: slice-1 REWORK candidate d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75 reconciled. Owner-verified: origin match; diff 47d2830..d8dbc5d scoped to exactly the 4 allowed artifacts; 17/17 test_tier1_image green WITH docker and WITH PATH stripped (B1 negative-env acceptance re-proven by owner); DEVELOPERS.md bounded tier-0 command present (B2); evidence note restructured Observations/Demonstrated/Hypotheses + 606MB-vs-5.17GB correction (B3); blw.1 rework comment present. Fresh EXPERT gate in flight: expert-reviewer-blw1-d8dbc5d (sub-9f31b642), openai-codex/gpt-6-astra @ max, packet agentmsg_ef3f8d51, watch ed787e3d armed. Rework watch eb48f8ca cancelled on reconciliation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~01:45: EXPERT gate #2 (candidate d8dbc5d) PARKED on ambiguous reviewer state. Reviewer expert-reviewer-blw1-d8dbc5d (sub-9f31b642, session 01a0f139-2bb4-762e-bba5-c3c03862cec3, openai-codex/gpt-6-astra @ max, packet agentmsg_ef3f8d51): verified real work (read BLOCK report, ran 17-test suite in both docker/no-docker envs, 11-13 tool calls), then entered a single model generation that has been open 46+ min with zero new persisted messages (session jsonl mtime 45.7min stale, messageCount flat at 26) while isStreaming=true. Cannot distinguish hung provider stream from very long max-thinking composition. Per protocol: NOT confirmed terminal -> no replacement, no nudge (steer-disruption risk), reviewer left intact; gate watch ed787e3d cancelled; pause-and-ask-operator. If the reviewer reply ever arrives it wakes the owner via fast path and the gate resumes. Checkpoint memory recorded. Operator morning options: (a) wait, (b) if reviewer confirmed dead by morning (session gone/stream closed), admit exactly one replacement per the exception, (c) any other instruction.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 morning: gate-2 stall root cause was a HUNG BASH COMMAND (~7h) in the reviewer session, not a model-generation hang. Operator nudged the reviewer session directly ('That bash command hung for like 7 hours'); reviewer resumed immediately (streaming, active). Owner did not double-nudge (steer-disruption risk on a live turn). Gate watch re-armed (expert-gate-watch:blw1-d8dbc5d-resumed). Lesson folded into child-liveness memory: check for hung child subprocesses; isStreaming cannot discriminate hang vs long generation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 morning (cont): reviewer stall reconciled as model/provider stream-layer hang (harness state isStreaming=true, activity=model, no persisted messages 46+min after last toolResult ~01:00 UTC), NOT a hung bash — reviewer verified all 7 command handles exited 0 (longest 4.4s). Operator nudge forced a new turn and unstuck the session. Owner sent harness-level clarification (agentmsg_2f69109f) resolving the reviewer's 'which command hung?' question; review resumed (streaming confirmed). Reviewer verification evidence intact and matches owner runs. Harness bug signal noted for operator: UI showed hung bash while child handles were clean; 7h stuck streaming turn with no watchdog.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #2 disposition (rework candidate d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75): BLOCK accepted. Reviewer expert-reviewer-blw1-d8dbc5d (sub-9f31b642, session 01a0f139-2bb4-762e-bba5-c3c03862cec3), openai-codex/gpt-6-astra @ max, packet agentmsg_ef3f8d51. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-d8dbc5d-expert-block.md (main commit 3d988e5). B1/B2 verified resolved; single remaining finding B3-R (evidence note: additive scope still presented as demonstrated causal exclusion; 'eliminates by construction' must become hypothesis). Classified in-scope documentation-only review-rework; routing revise via handoff_spec_episode. Reviewer retired after preservation. Fresh EXPERT gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: FULL STOP executed per operator instruction (host plugin update + harness restart). Final state: episode holding at 2666843 (pushed, origin-verified, worktree clean — confirmed by both owner reconciliation and episode state-confirmation). All watches cancelled (none remain); no subagents running (both EXPERT reviewers retired after report preservation). PENDING AFTER RESTART: fresh EXPERT gate on EXACT commit 2666843 (not d8dbc5d — stale); PASS -> slice-2 advance (blw.2) via handoff_spec_episode; BLOCK -> in-scope revise. Merge/abandon authority: operator only. Resume checkpoint memory updated (prime-claw-slice1-expert-block-47d2830-rework-in-flight).
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 post-restart resume: harness restarted for the operator plugin update; oversight state survived (skill package re-supplied, identity intact). Verified: episode present/holding, worktree unchanged at 2666843 (clean, origin in sync). EXPERT gate #3 opened on the complete slice-1 candidate 2666843: fresh reviewer expert-reviewer-blw1-2666843 (sub-e050b4f4), openai-codex/gpt-6-astra @ max, packet agentmsg_eda4e7f9 (delivered once), watch 002ff4ea armed with the updated stall policy (flatline detector + nudge-at-threshold). Awaiting PASS/BLOCK.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #3 disposition (slice-1 FINAL candidate 2666843426734a82147e5a8fe965b58754c96ac5): PASS accepted. Reviewer expert-reviewer-blw1-2666843 (sub-e050b4f4, session 01a0f31c-15b2-70ef-944b-f7469f9068f4), openai-codex/gpt-6-astra @ max, packet agentmsg_eda4e7f9. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-2666843-expert-pass.md (main commit 1a0836d). All prior findings (B1/B2/B3/B3-R) verified resolved; complete slice-1 acceptance met; independent verification 17/17 in three Docker environments. SLICE 1 ACCEPTED. Advancing to slice 2 (blw.2). Reviewer retired after preservation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: slice-2 candidate 470be987dd33a0a374ab33296499b6c4d89fc994 reconciled. Owner-verified: origin match; diff 9f68beb..470be98 scoped to exactly the expected files (.env.example, EXECUTION_PLAN.md npm-correction, DEVELOPERS.md, slice-2 evidence note, test-tier1.sh, test_tier1_driver.py, test_tier1_image.py); no plugin source, no slice-3 work; owner re-ran 30/30 tier-0 tests green; host-untouched claim spot-verified (live ~/.prime/agent/extensions/handoff-chain.ts sha256 debd42d4... matches the note exactly); .env gitignored; blw.2 closed. Noted: branch was rebased onto origin/main 1a0836d at slice-2 start (slice-1 PASSed commit 2666843 -> content-identical b2f6b86) — final gate must review the final exact commit, not 2666843. Fresh EXPERT gate in flight: expert-reviewer-blw2-470be98 (sub-e46c4fb5), openai-codex/gpt-6-astra @ max, packet agentmsg_cb1ff3ff, watch c2fd9d12.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate disposition (slice-2 candidate 470be987dd33a0a374ab33296499b6c4d89fc994): BLOCK accepted. Reviewer expert-reviewer-blw2-470be98 (sub-e46c4fb5, session 01a0f343-61fc-77d0-b361-307edcd3bc4b), openai-codex/gpt-6-astra @ max, packet agentmsg_cb1ff3ff. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md (main commit 0389d80). Three P2 findings, all classified in-scope slice-2 review-rework: B1 source mode can silently pack stale compiled dist dirs (existence used as freshness); B2 --probe checks process exit not RPC reply content (3 false-positive cases demonstrated); B3 probe deadline is TERM-only cooperative timeout (no -k escalation) — the slice-1 pipe-deadlock lesson resurfacing. Routing revise via handoff_spec_episode. Fresh EXPERT gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: SECOND FULL STOP executed per operator instruction (plugin update #2 + harness restart). Final state: episode holding at bc00cba08b108e61fac4b8c97c25795773b8b1c8 (pushed, origin-verified, owner-reconciled: B1/B2/B3 repairs verified in diff, 50/50 owner re-run green, host checksum unchanged). All watches cancelled; no subagents; hold note agentmsg_cbaa2f64 delivered. PENDING AFTER RESTART: fresh EXPERT gate on EXACT commit bc00cba; PASS -> slice-3 advance (blw.3); merge/abandon = operator only. Resume checkpoint memory updated.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 post-restart-#2 resume: oversight state survived (skill re-supplied, kernel state restored). Verified: episode present/idle (new activeSessionId c9cc6537a0e6), worktree unchanged at bc00cba (clean, origin in sync), no watches/subagents. EXPERT gate opened on the reworked slice-2 candidate bc00cba08b108e61fac4b8c97c25795773b8b1c8: fresh reviewer expert-reviewer-blw2-bc00cba (sub-0935580a), openai-codex/gpt-6-astra @ max, packet agentmsg_1e2f86e7 (delivered once), watch armed with stall policy. Awaiting PASS/BLOCK.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate disposition (slice-2 REWORKED candidate bc00cba08b108e61fac4b8c97c25795773b8b1c8): PASS accepted. Reviewer expert-reviewer-blw2-bc00cba (sub-0935580a), openai-codex/gpt-6-astra @ max, packet agentmsg_1e2f86e7. Report preserved at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice2-bc00cba-expert-pass.md (main commit a6a55bc). B1/B2/B3 all verified resolved with independent in-image replays (TERM-ignoring tree killed at deadline+grace, exit 137; validator negatives all fail; fresh-build replay packs current source). Reviewer independently reproduced 50/50 in three Docker environments. SLICE 2 ACCEPTED. Advancing to slice 3 (blw.3 — final slice). Reviewer retired after preservation.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~13:50: found and reaped a 16-hour-old LEAKED process from the recorded pre-existing flake: pid 34153, orphaned bash stall-target from test_candidate_progress_watchdog (pytest-tmp/.../test_candidate_progress_watchd2/signal-sync.pid, trap exit-143-on-TERM, sleep loop). Physical confirmation of the flake mechanism: the watchdog under test failed to reap its stall target within the test's 1s/2s windows, the test flaked, and the synthetic fixture leaked onto the host. Harmless (sleep loop) but exactly the host-pollution class tier-1 containers eliminate by construction. Killed with TERM (clean exit 143). Recorded for the slice-3 evidence trail.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~14:35 (slice-3 watch run#8): branch rebased a SECOND time onto current main tip 9b3edd2 (which merged episode/goal-heartbeat-work-control — the h6w.24 plugin work landed on main mid-slice-3). Verified: a6a55bc still an ancestor; tree diff 00feb56->9751447 = main's h6w.24 content (goal-heartbeat-work-control.ts plugin source + tests, incl. test_goal_heartbeat_work_control_extension.py replacing test_goal_blocker_control_extension.py). The episode is migrating the NEW goal-heartbeat test into the tier-1 suite — the plan's merge-reconciliation mechanism working as designed. Slice-3 commit d040c02 exists locally (markers + conftest fixture + migration + test-all.sh + evidence note, 10386B); NOT yet pushed (ahead 17/behind 7 vs origin). Container verification run in progress. FINAL-GATE NOTE: the goal-heartbeat plugin source comes from main via rebase, NOT authored by the episode; the final reviewer must be told the branch was twice-rebased and which content is main's.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Slices 1-3 complete: blw.1 (image+driver, EXPERT PASS 2666843≡b2f6b86), blw.2 (install selection + apply/check, EXPERT PASS bc00cba), blw.3 (markers + session fixture + migration + sequencer, awaiting EXPERT gate on d040c02..7118a44). blw.4 (shared-base extraction) remains deferred P2.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~15:00: slice-3 completion report (7118a44) reconciled — push verified, tier-0 gate owner re-run matches claim (223 passed/144 skipped), stale-assertion repair verified against 376bc2b contract (assert_creation_trace now asserts followUp+queueIfBusy on handoff+execute, matching the reviewed plugin change). TERMINAL-POLICY GAP: promoted bundle (.ralph/plans/SPECIFICATION.md + EXECUTION_PLAN.md) not archived — the execute skill requires archival to .ralph/plans/archive/<bundle>/ + README index update as the episode's readiness claim. Routing in-scope archival repair; final EXPERT gate follows on the archival-complete candidate. Epic stays in_progress until operator merge decision.
---

author: Joe Landers
created: 2026-10-12 01:02
---
TERMINAL-POLICY ARCHIVAL TASK (operator-directed, 2026-09-30; execute pass after this handoff): the plan is finished (slices 1-3 done, blw.1/blw.2/blw.3 closed) but the promoted bundle is still active. Archive it: (1) move .ralph/plans/SPECIFICATION.md + EXECUTION_PLAN.md into new .ralph/plans/archive/plugin-test-container/; (2) move the 5 review reports from .ralph/plans/future/plugin-test-container/reviews/ into the same archive subfolder and remove the emptied future/plugin-test-container/ folder — do NOT touch the other future bundles (phase3a-brain-hosting-completion, universal-agent-project-conversation-poc); (3) update .ralph/plans/archive/README.md with a coherent plugin-test-container index entry: what was delivered (three-tier test architecture + tier-1 container), acceptance-evidence pointers (docs/evidence/2026-09-29-tier1-slice1-image-driver.md, docs/evidence/2026-09-30-tier1-slice2-install-selection.md, docs/evidence/2026-09-30-tier1-slice3-migration-sequencer.md), and the EXPERT review trail (slice 1: BLOCK 47d2830 -> BLOCK d8dbc5d -> PASS 2666843; slice 2: BLOCK 470be98 -> PASS bc00cba); (4) repair relative links (bundle-internal cross-references + inbound links from docs/); (5) re-run the tier-0 gate (python3 -m pytest tests/ -q — must stay green; proves no test reads the moved .ralph/plans paths); (6) record in the slice-3 evidence note why DEVELOPERS.md satisfies the execute skill's docs-conversion step (the approved plan named DEVELOPERS.md as the doc home), or add a docs/ page if judged necessary. CONSTRAINTS: file moves + index + links + evidence-note record only; no test/code behavior changes; no plugin source changes. Commit+push; report the new exact commit hash to the owner sibling (01a0f0d6-b639-74be-ab78-a58b058236c7). After archival, the owner runs a fresh FINAL EXPERT gate on the complete exact candidate.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30 ~15:10: THIRD FULL STOP executed per operator directive (plugin reload). State: HEAD 7118a44 pushed and safe; episode had STAGED the archival plan-file moves (uncommitted, recoverable either way) when the stop landed; stop note agentmsg_3166554a queued (hold at 7118a44, confirm after reload); watch abdc185e cancelled; no subagents. Resume: complete-or-restore the staged archival -> final EXPERT gate on the complete exact candidate -> merge-readiness to operator. Epic stays in_progress until merge decision.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: terminal archival at c53972ff35488d23efdbf975e67006b451281931 RECONCILED. Owner-verified: push; diff = 7 pure renames + archive README index + DEVELOPERS/evidence link repoints ONLY (no test/code/plugin changes); archive bundle has spec+plan+all 5 EXPERT reports; future/plugin-test-container removed; links resolve; owner tier-0 re-run after moves 223 passed/144 skipped (flake did not recur). Terminal-policy requirement satisfied per oversee step 9. Next: FINAL EXPERT gate on the complete exact candidate c53972f.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: FINAL EXPERT gate opened on the complete candidate c53972ff35488d23efdbf975e67006b451281931. Reviewer expert-reviewer-final-c53972f (sub-37c638a0), openai-codex/gpt-6-astra @ max, packet agentmsg_a3b164d1, watch armed. OWNER VERIFICATION of the headline claim completed independently: pytest -m container in the worktree = 37 passed, 330 deselected, 119.74s (one ephemeral container, pinned 0.9.3 from the worktree .env) — the bundle's core purpose (plugin tests running inside the container, host untouched) is owner-proven. Awaiting the final PASS/BLOCK; then the merge-readiness presentation to the operator.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: final-gate reviewer asked about a source-mode evidence discrepancy (note records pre-reconciliation source mode at 34 passed/139s; completion report + archive index claimed 37 passed in both modes). Owner investigated: NO retained post-reconciliation source-mode log exists; retained post-reconciliation container logs are pinned-only (.test-results/20260930-144322-27210/tier1.log, 37 passed, 114.48s). The committed evidence NOTE is accurate (source 34/139s pre-reconciliation; pinned 37/118s post); the overstatement lives in the completion-report summary + archive index entry + owner packet. Answered the reviewer with the precise evidence state and authorized adjudication on the evidence as it stands (no live source rebuild). Likely finding: index-entry/report wording vs evidence (evidence hygiene, same class as slice-1 B3). Repair if BLOCKed: correct index wording or run+record a post-reconciliation source-mode gate — small and in-scope.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate disposition (FINAL candidate c53972ff35488d23efdbf975e67006b451281931): BLOCK accepted. Reviewer expert-reviewer-final-c53972f (sub-37c638a0, session 01a0f47f-27c8-7641-bd1f-a3f94da9d613), openai-codex/gpt-6-astra @ max, packet agentmsg_a3b164d1. Report preserved at docs/evidence/2026-09-30-tier1-final-expert-review-c53972f.md (main commit 8ecf426). Three P2 findings, all in-scope: B1 conftest fixture rmtree(ignore_errors=True) suppresses stale-output removal failures (driver fails closed); B2 session-fixture container teardown never verifies removal (green gate can leak a container); B3 archive index overstates post-reconciliation source-mode evidence (37/both-modes vs evidenced 34-pre/pinned-37-post). Minor hygiene: R-T1-* inventory plan refs point to the deleted active path; blank-line-at-EOF in test_reviewed_plan_native_discovery.py:419. CORRECTION to my earlier ledger note: the reviewer established the 16h leaked process belonged to the resets_and_signal_cleanup_reaps_group scenario (test_embedding_candidate_build.py:224-252), NOT terminates_stall — it corroborates an independent pre-existing watchdog cleanup problem, not exact causation for the named flake. Routing revise via handoff_spec_episode. Fresh FINAL gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
FINAL EXPERT GATE on c53972f: BLOCK (3 findings), owner accepted as in-scope review-rework (2026-09-30). Full report preserved at main-repo docs/evidence/2026-09-30-tier1-final-expert-review-c53972f.md (fold into archive reviews/ at merge time). REPAIR TASK for the next execute pass — scope limited to tests/conftest.py, its behavioral tests, the archive index, and inventory/doc hygiene: B1: _stage_fork_release (~conftest.py:143-144) must NOT use shutil.rmtree(ignore_errors=True) for the four pack-consumed dist trees — absence fine, permission/IO/type errors must stop the run BEFORE build/pack/image-build/container creation, matching driver scripts/test-tier1.sh:258-265 fail-closed semantics; add fixture-level behavioral tests (stale-and-removed outputs replay; cleanup-denial e.g. 0555 subdir stops before build/pack; build/pack failure fails closed; missing dist tree stays positive; dry-run-equivalent makes no build/pack/docker call) testing the ACTUAL fixture path. B2: session-fixture finalizer (~conftest.py:458-463) must verify the owned container removal/absence; on removal failure/timeout surface a teardown failure with exact container identity + diagnostics; do NOT silently delete session share evidence while a container still owns it; preserve original setup/test failure if cleanup also fails (surface both); bounded to the one captured container ID (no docker-wide pruning, no name-based guesses, no infinite retries); idempotent already-absent OK when absence is established. Acceptance: positive setup/body/teardown proves container absent; negative removal-nonzero/timeout fails gate + retains diagnostics; setup failure after publication still attempts cleanup of only the captured ID; body-failure + removal-failure preserves both errors; later run does not inherit failed run state; unrelated container never targeted. B3: correct archive index final-acceptance claim (.ralph/plans/archive/README.md plugin-test-container entry) to the verified split — source mode 34 passed/139s BEFORE reconciliation; pinned mode 37 passed/118s AFTER reconciliation; post-reconciliation source-mode gate NOT claimed; align summary lines; mirror the slice-3 evidence note's honest split; do NOT rebuild the live harness source checkout to preserve the inaccurate sentence. Minor hygiene: (a) repoint five R-T1-* plan references in config/requirements-inventory.json (~lines 1139/1161/1183/1204/1235) from deleted .ralph/plans/SPECIFICATION.md to .ralph/plans/archive/plugin-test-container/SPECIFICATION.md; (b) remove new blank line at EOF in tests/test_reviewed_plan_native_discovery.py (git diff --check flags :419); (c) note in slice-3 evidence note that historical checksum files naming the obsolete goal-blocker file are historical record and the current-generation hash check is the fresh evidence for the final review window. CONSTRAINTS: fixture/tests/index/inventory/evidence-note changes only; NO plugin source changes; NO driver behavior changes beyond fixture alignment; NO host probe reruns; host gates tier-0 subset only; NO new harness machinery. Refresh slice-3 evidence note after repair incl. fresh no-leftover-containers check proving the B2 fix. Commit+push; report new exact commit hash to owner sibling 01a0f0d6-b639-74be-ab78-a58b058236c7. This repair invalidates the c53972f review; fresh FINAL EXPERT gate follows on the repaired exact commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: final-candidate repair at 8c44cd16fd2cc64ef4c2ebfd8bf8a6d86e2cc4c2 RECONCILED. Owner-verified: push; diff scope exactly the 6 allowed files; B1 fail-closed _remove_dist_tree (remaining ignore_errors sites verified benign: share cleanup post-teardown-confirmation, ctmp scratch); B2 _remove_session_container bounded rm -f + inspect-absence with identity+diagnostics, share preserved while container may own it; B3 archive index honest split (source 34/139s pre, pinned 37/118s post, no post-reconciliation source claim); 5 R-T1-* refs repointed to archived spec; EOF fixed; diff --check clean; zero leftover containers; owner re-ran 27/27 fixture tests + 250/144 tier-0 green. Fresh FINAL EXPERT gate in flight: expert-reviewer-final-8c44cd1 (sub-ee0f4ca6), openai-codex/gpt-6-astra @ max, packet agentmsg_a1b94bf1, watch 18a241e2->(new) armed. Awaiting PASS/BLOCK.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #2 disposition (repaired final candidate 8c44cd16fd2cc64ef4c2ebfd8bf8a6d86e2cc4c2): BLOCK accepted. Reviewer expert-reviewer-final-8c44cd1 (sub-ee0f4ca6, session 01a0f4b4-bbf9-724d-82a0-d29ef8a9eef3), openai-codex/gpt-6-astra @ max, packet agentmsg_a1b94bf1. Report preserved at docs/evidence/2026-09-30-tier1-final-expert-review-8c44cd1.md (main commit dfbdbc6). B3 + archival hygiene VERIFIED RESOLVED. Two remaining failure-path defects, both in-scope: B1-R metadata errors silently classified as absent dist tree (Path.is_* predicates suppress OSError into False on Python 3.14 — inaccessible parent/EIO/FIFO treated as absent, staging proceeds); B2-R failed docker inspect accepted as verified absence (rc!=0 conflates daemon-error with absent; share evidence deleted on unknown state). Reviewer also noted the new 27-test file exercises helpers but NOT the full tier1_container session fixture (real-session negative coverage belongs with the repairs). Non-blocking: evidence-note arithmetic wording (222 vs 223). This run's flake was the SIBLING watchdog scenario (resets_and_signal_cleanup_reaps_group), consistent with the prior precision correction. Routing revise round 2 via handoff_spec_episode. Fresh FINAL gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
FINAL EXPERT GATE #2 on 8c44cd1: BLOCK (2 failure-path findings remain), owner accepted as in-scope review-rework (2026-09-30). B3 + archival hygiene RESOLVED (verified). Full report at main-repo docs/evidence/2026-09-30-tier1-final-expert-review-8c44cd1.md. ROUND-2 REPAIR TASK — scope limited to tests/conftest.py, its behavioral tests, the slice-3 evidence note (plus possibly scripts/test-tier1.sh OR its equivalence claim — see B1-R): B1-R: _remove_dist_tree (~conftest.py:142-147) uses Path.is_symlink()/is_file()/is_dir() which on host Python 3.14.4 SUPPRESS filesystem OSError into False — three False results get misclassified as absence. Repair with error-preserving metadata semantics (lstat directly is the natural seam): distinguish confirmed absence (FileNotFoundError -> OK) from inspection failure (PermissionError/EIO must RAISE before any build/pack/image-build/container call) and from non-directory special objects (FIFO at the dist path must be explicitly handled or rejected, not treated as absent). ALSO: reviewer found this hosts rm -rf proceeds to npm build when the dist parent is unsearchable (npm then fails on permission) — the driver has the analogous weaker edge, so EITHER align the driver OR correct the evidence notes mirrors-the-driver equivalence claim; do not assert unsupported equivalence. Acceptance: truly-absent/regular-file/directory/symlink (incl. dangling) handled with symlink targets untouched; A->B source replay without version change packs current output and omits deleted outputs; inaccessible parent + injected metadata PermissionError/EIO fail BEFORE any npm/node/docker call; existing FIFO/special object explicitly handled or rejected before build; the WHOLE FIXTURE stops before publication (not only one helper raising); after denied/unknown cleanup, restore access and stage again — failed attempt must not have produced an accepted artifact, successful replay must remove obsolete output. Exercise the actual Python 3.14 environment and the actual fixture staging boundary; apply the source-path error test to the driver too. B2-R: _container_absent (~conftest.py:398-409) returns out.returncode != 0, but docker inspect returns nonzero for more than missing object (daemon connection error is also rc=1). Repair: require a positive, error-distinguishable absence result for the exact captured container ID — distinguish present / absent (no such object) / unknown-error (connection, permission, API, CLI-launch failure, timeout); unknown must FAIL the gate and RETAIN the share; preserve inspect diagnostics; idempotent success only when actual absence is established. Cover: removal failure + inspect daemon/permission/API failure -> pytest nonzero + share preserved; successful rm + failed/unknown inspect -> no bypass; removal timeout, inspect timeout, CLI-launch failure, still-present -> all fail boundedly; setup failure after publication cleans only the captured ID; setup+cleanup and body+cleanup failures preserve both errors; a run following failed cleanup must not inherit or delete the failed runs still-owned state — PROVE THIS THROUGH THE SESSION FIXTURE (instantiate tier1_container in the negative tests; the current 27 tests exercise helpers but not the full session fixture, and the uniqueness check is a source-string assertion — replace with real-session coverage). Minor wording fix (non-blocking): slice-3 evidence note :371 arithmetic — prior post-reconciliation gate was 223 (not 222); the post-repair run had 250 executed (249 passed + 1 failed) — correct the wording. CONSTRAINTS: fixture/tests/evidence-note changes only (plus the driver OR the equivalence-claim correction for B1-R); NO plugin source changes; NO host probe reruns; host gates tier-0 subset only; NO new harness machinery; keep bounded timeouts and exact-ID scope; NO docker pruning/name-guesses/unbounded retries; NEVER traverse a symlink target; preserve the valid missing-tree case. Refresh slice-3 evidence note after repair (incl. fresh no-leftover-containers check). Commit+push; report new exact commit hash to owner sibling 01a0f0d6-b639-74be-ab78-a58b058236c7. This repair invalidates the 8c44cd1 review; fresh FINAL EXPERT gate follows on the repaired exact commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: final-candidate round-2 repair at 82dd08736035ff3dd5c4bd3a71c1ea333ce27dcb RECONCILED. Owner-verified: push; diff = exactly the 4 allowed files (conftest.py, test_tier1_fixture.py, test_tier1_driver.py, slice-3 evidence note); B1-R lstat-based _remove_dist_tree (FileNotFoundError=absence, other lstat OSError raises pre-build, symlinks unlinked without traversal, special objects rejected) — verified in code; B2-R three-state _inspect_container (PRESENT/ABSENT-with-positive-evidence/UNKNOWN-fails-gate-and-retains-share) — verified in code; real-session coverage added (TestSessionFixtureEndToEnd via _fixture_function); behavioral no-inheritance proof (replaces source-string assertion); arithmetic wording fixed (250=249+1=223+27); equivalence claim corrected (wording only, driver unchanged); owner re-ran 80/80 fixture+driver tests + 270/144 tier-0 green; zero leftover containers; diff --check clean. Fresh FINAL EXPERT gate #3 in flight: expert-reviewer-final-82dd087 (sub-eeba16d4), openai-codex/gpt-6-astra @ max, packet agentmsg_12efb222, watch armed. Awaiting PASS/BLOCK.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #3 disposition (repaired final candidate 82dd08736035ff3dd5c4bd3a71c1ea333ce27dcb): BLOCK accepted. Reviewer expert-reviewer-final-82dd087 (sub-eeba16d4, session 01a0f4eb-875e-7039-83be-41f8ef6d8b9d), openai-codex/gpt-6-astra @ max, packet agentmsg_12efb222. Report preserved at docs/evidence/2026-09-30-tier1-final-expert-review-82dd087.md (main commit b789466). B1-R, B2-R, B3, and all archival hygiene VERIFIED RESOLVED. ONE remaining in-scope finding: B2-R2 — the session share is keyed by recyclable PID (.test-results/share-<pid>, exist_ok=True) while the container name uses PID+epoch, so a PID-reused later session can inherit and delete a failed session's retained share (reproduced through the real fixture: run 1 leaks, run 2 same PID inherits and deletes the witness). Note: this run's flake was the named terminates_stall scenario (hit its 15s timeout; synthetic PIDs absent afterward — consistent with the pre-existing timing flake). Iteration count: 8 review rounds (slice-1 x3, slice-2 x2, final x3). Routing revise round 3 via handoff_spec_episode. OWNER BOUND: if the next final gate is not a clean PASS, I will pause and present the full state to the operator for a decision rather than looping further. Fresh FINAL gate required on the repaired commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
FINAL EXPERT GATE #3 on 82dd087: BLOCK (1 ownership-seam finding), owner accepted as in-scope review-rework (2026-09-30). B1-R, B2-R, B3, archival hygiene all verified RESOLVED. Full report at main-repo docs/evidence/2026-09-30-tier1-final-expert-review-82dd087.md. ROUND-3 REPAIR TASK — scope limited to tests/conftest.py, its behavioral tests, and the slice-3 evidence note: B2-R2 — a later session can inherit and delete a failed sessions still-owned share: the session share is allocated as .test-results/share-<pid> with exist_ok=True (no per-session identity) while the container name uses pid+epoch. On PID reuse (or multiple pytest sessions in one process), a later session reuses the earlier share; its finalizer then deletes the entire share after proving only its OWN captured container absent — destroying a retained failed sessions recovery evidence. REPAIR: give every session an independently unique, exclusively allocated share identity, retained with that sessions captured container; keep cleanup restricted to that exact owned share; never reuse a pre-existing share solely because the PID/path matches; allocation must choose fresh owned state or fail closed on collision WITHOUT using/removing an existing directory. Align share identity with the container identity (e.g. include the epoch/unique run id in the share path, or uniquely-allocated mkdtemp-style share). CONSTRAINTS: preserve same-absolute-path host/container mounts; exact-ID bounded rm->inspect; the three-state UNKNOWN behavior; diagnostics; TIER1_KEEP_SHARE; do NOT delete or adopt an existing share, prune containers, search by names, kill host processes, or add retries to make a later run green; do NOT weaken the B1-R fail-closed source-staging repair. ACCEPTANCE: (positive) ordinary setup/body/verified teardown removes only that sessions share; already-absent replay succeeds; KEEP_SHARE retains its own artifacts; (negative/replay) drive two real fixture sessions with the SAME PID and different epochs — fail run 1 teardown as UNKNOWN/PRESENT, plant a witness, complete run 2 — require DISTINCT shares, no run-1 evidence visible through run 2s share, byte-identical run-1 witness afterward, run-2 docker calls scoped only to cid-2; (collision) same PID + same coarse epoch, plus an already-existing legacy share-<pid> directory — allocation must choose fresh owned state or fail closed without using/removing the existing directory; (failure) after a retained run, make the next setup fail both before and after publication — the old share survives, only the newly captured ID/newly allocated share may be finalized; (replay) a later clean session still succeeds after these failures without touching any retained prior share/container. Then update the no-inheritance claims in the slice-3 evidence note (~:489-497). CONSTRAINTS: fixture/tests/evidence-note changes only; NO plugin source changes; NO driver changes; NO host probe reruns; host gates tier-0 subset only; NO new harness machinery. Refresh the slice-3 evidence note after repair (incl. fresh no-leftover-containers check). Commit+push; report new exact commit hash to owner sibling 01a0f0d6-b639-74be-ab78-a58b058236c7. This repair invalidates the 82dd087 review; fresh FINAL EXPERT gate follows on the repaired exact commit. NOTE for the execute pass: the round-2 test test_failed_run_leaves_no_inheritance_for_the_next_run used DIFFERENT pids (4242/4343) — round-3 acceptance wants SAME pid + different epochs proving distinct shares; adapt it. Existing fakes: _make_fake_session_docker/_begin/_session_fixture_fn in tests/test_tier1_fixture.py.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Oversight 2026-09-30: final-candidate round-3 repair at 672c77213c26ae36400cec06ec253b4b1d84f80a RECONCILED. Owner-verified: push; diff = exactly the 3 allowed files (conftest.py, test_tier1_fixture.py, slice-3 evidence note); B2-R2 repair verified in code (mkdtemp per-session share, fresh/exclusive/distinct even for identical pid+epoch, pre-existing dirs neither used nor removed, 0700->0755 normalization preserving the same-absolute-path mount, container name aligned with the share token); owner re-ran 84/84 fixture+driver tests + 274/144 tier-0 green; zero leftover containers; diff --check clean. Fresh FINAL EXPERT gate #4 in flight: expert-reviewer-final-672c772 (sub-be358315), openai-codex/gpt-6-astra @ max, packet agentmsg_2c6bbd91, watch armed. OWNER BOUND (recorded): if gate #4 is not a clean PASS, I will PAUSE and present the full state to the operator for a decision rather than looping further.
---

author: Joe Landers
created: 2026-10-12 01:02
---
EXPERT gate #4 disposition (complete candidate 672c77213c26ae36400cec06ec253b4b1d84f80a): PASS accepted. Reviewer expert-reviewer-final-672c772 (sub-be358315, session 01a0f511-c13c-72b3-8885-0db15a809846), openai-codex/gpt-6-astra @ max, packet agentmsg_2c6bbd91. Report preserved at docs/evidence/2026-09-30-tier1-final-expert-review-672c772.md (main commit e2a0343). NO material finding remains. B2-R2 repaired (per-session mkdtemp share identity, container-name aligned; red/green control proves predecessor 82dd087 fails and the candidate passes). All prior repairs intact. Complete candidate scope verified (40 files, no episode-authored plugin source). COMPLETE CANDIDATE CERTIFIED for operator merge review. Owner bound satisfied (clean PASS). Presenting merge-readiness to the operator — merge/abandon/pause/revise is HIS explicit decision only.
---

author: Joe Landers
created: 2026-10-12 01:02
---
MERGED to main at 1442abb (operator-approved). Final candidate 672c772 passed EXPERT gate #4 (9 review rounds: 6 BLOCKs -> 3 PASSes); post-merge re-verification against main's lean-protocol plugin (00ad366) caught 3 stale package==1 assertions in test_reviewed_plan_native_discovery.py — reconciled to package==0 (commit 535f584, matches main's own sibling-file updates; the container suite caught what host-skipped tests missed). Container gate 37/37 + tier-0 host 274/144 green on the merged tree; main tree identical to verified branch tree. Worktree + branch cleaned up. blw.4 (shared-base extraction) remains as deferred P2 follow-up.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed
<!-- SECTION:FINAL_SUMMARY:END -->
