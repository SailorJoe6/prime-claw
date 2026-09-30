# EXPERT review — FINAL gate, complete candidate c53972f — BLOCK (3 findings)

> Reviewer: expert-reviewer-final-c53972f (rlm child sub-37c638a0)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated)
> Exact commit: c53972ff35488d23efdbf975e67006b451281931 (episode/plugin-test-container)
> Packet: agentmsg_a3b164d1 | Report arrived via agent_message reply; preserved verbatim below
> Note: preserved to docs/evidence/ (merge-clean path); fold into the archive bundle's
> reviews/ at merge time.
> Disposition (owner): BLOCK accepted — all three findings classified in-scope review-rework

---

BLOCK — c53972ff35488d23efdbf975e67006b451281931

Three material findings remain: two new failure-path defects in the session fixture, and an inaccurate final acceptance claim in the archive index. The normal pinned run and host-isolation boundary work. No plugin behavior change or product decision is needed for these repairs. This is an exact-candidate review, not merge authority.

## B1 — P2, confidence 10/10: The new pytest source path suppresses failures to remove stale build output

Evidence: tests/conftest.py:133–164 claims to mirror the accepted fresh-build contract, but :143–144 calls shutil.rmtree(..., ignore_errors=True) for all four pack-consumed dist trees. It then builds and packs unconditionally. This differs from scripts/test-tier1.sh:258–265: its rm failure terminates the driver under set -e.

Independent native-environment reproduction used the existing recording npm/node fixtures and the actual _stage_fork_release function. A synthetic source tree contained dist/retired-module/deleted-source.js under a 0555 retired-module directory; the dist root remained 0755. Removal could not unlink the obsolete file. The function nevertheless ran build and pack, returned v0.9.8, and left the obsolete compiled file present. Its newly generated marker was CURRENT: a successful incremental rebuild does not establish that removed outputs are gone. The standalone driver, run against the same synthetic tree, returned 1 on Permission denied before any additional build or pack; its Docker trace contained only info.

I also inspected the real selected fork: its build is incremental, and scripts/pack-prime-agent-release.mjs:159–162/:217–223/:338 recursively copies existing dist into the release. The reproduction used substitutes, not a real fork build; the real packer inspection establishes why surviving obsolete files matter.

Impact / invariant: pytest -m container in source mode can test an artifact containing code removed from the selected checkout while claiming a fresh build. This violates the accepted Slice-2 B1 requirement and Slice-3 driver-equivalent setup contract. The standalone driver's earlier B1 repair remains intact; this is a regression in the newly duplicated fixture path.

Root-cause seam: best-effort cleanup semantics were used at a correctness-critical source-to-artifact boundary. Driver tests do not exercise the mirrored fixture implementation.

Repair direction: require successful removal of the pack-consumed old outputs, or fail before building/packing when freshness cannot be established. Keep the implementation small and align its failure semantics with the driver. Do not add a cache or rebuild the live harness checkout merely to investigate this already-reproduced defect.

Constraints / avoid: absence may be harmless; permission/I/O/type errors are not. Do not treat directory existence, version equality, a successful incremental build, or broad ignore_errors as freshness proof. Keep all negative fixtures outside the real fork, and do not install source artifacts into the host harness.

Acceptance tests: positive fresh staging with stale and removed/renamed outputs; negative cleanup denial with an otherwise buildable dist tree must stop before build, pack, image build, and container creation; build/pack failure must still fail closed; replay source A to B without a version change and verify that deleted outputs are absent. Test the actual fixture path as well as the driver. A missing dist tree should remain a valid positive case.

Regression risks: rejecting a clean checkout, incomplete handling of filesystem errors, deleting outside the four selected paths, and diverging source selection behavior. Dependencies: repair fixture cleanup and fixture-level behavioral tests together; coordinate with B2's fixture failure tests and B3's evidence refresh.

## B2 — P2, confidence 10/10: Container teardown failure is silently accepted

Evidence: tests/conftest.py:422–428 starts a detached container running sleep infinity, without --rm. At :458–463 the finalizer calls docker rm -f with capture_output=True but neither checks its return code nor uses its diagnostics. It then deletes the session share even if removal failed.

Independent controlled reproduction drove the actual tier1_container generator through successful mocked setup, then returned rc=42 / “synthetic Docker removal failed” from the exact owned-container removal command. The generator terminated normally. No exception or teardown failure reached its caller. This was a synthetic Docker boundary; I did not deliberately leave a real container behind. The ordinary pinned verification did remove its container successfully.

Impact / invariant: a passing test body can produce a green pytest gate while its long-lived container remains running, with teardown diagnostics discarded and shared evidence removed. This violates the one-ephemeral-container/destroy-at-session-end contract and the fixture's claimed driver-equivalent lifecycle. The standalone --rm driver does not have this unchecked explicit-removal seam.

Root-cause seam: cleanup is attempted, but successful cleanup is not part of the fixture's acceptance outcome.

Repair direction: make the owned-container terminal outcome observable and part of the gate. If removal/absence cannot be established, surface a teardown failure with the exact container identity and useful diagnostics; preserve needed recovery evidence rather than silently deleting it. Keep cleanup bounded and scoped to that one container.

Constraints / avoid: no Docker-wide pruning, name-based guesses, host process killing, infinite retries, or swallowing cleanup failure to keep the suite green. Preserve the original setup/test failure if cleanup also fails. An already-absent owned container can be handled idempotently when absence is actually established. Merely adding --rm does not terminate sleep infinity after a removal failure.

Acceptance tests: positive setup/body/teardown uses one container and proves it absent; negative removal nonzero and timeout cannot yield a successful gate and retain diagnostics/identity; setup failure after publication still attempts cleanup of only the captured ID; test-body failure plus removal failure preserves both errors; replay after successful cleanup or confirmed prior removal is safe. Verify an unrelated container is never targeted and a later run does not inherit the failed run's state.

Regression risks: masking the original failure, misclassifying already-absent as a leak, extending shutdown indefinitely, or destroying useful scratch while a container still owns it. Dependencies: implement with fixture-level behavioral coverage; refresh the no-leftovers evidence after B1/B2 repair.

## B3 — P2, confidence 10/10: Archive index claims an unverified post-reconciliation source result

Evidence: .ralph/plans/archive/README.md:21–25 says the full suite passes “for both install modes (37 passed).” The committed evidence note instead records source mode as 34 passed / 139s before reconciliation (:151–162); its post-reconciliation section records only pinned mode at 37 passed / 118s (:213–220). Retained .test-results/20260930-144322-27210/tier1.log corroborates the 37-test pinned sequencer leg. The owner explicitly confirmed that no retained post-reconciliation source-mode log exists and that the archive index, completion report, and initial review packet overstate this result.

Impact / invariant: the terminal archive presents historical coverage as evidence for the complete reconciled candidate. This violates the requested accurate archival/acceptance record. It does not demonstrate that source mode fails; it means the claimed final 37-test source result is unverified.

Root-cause seam: pre-reconciliation source evidence and post-reconciliation pinned evidence were merged into one final-result summary without preserving candidate/mode/count provenance.

Repair direction / recommendation: correct the index and final summaries to state the verified split: source 34 before reconciliation, pinned 37 after reconciliation, with the later source gate not claimed. This is the smallest honest repair. Alternatively, run and retain a safely selected post-reconciliation source gate and cite its actual result. Do not rebuild the live harness source checkout just to preserve an inaccurate sentence. The existing committed source-mode evidence note is already honest on this point.

Constraints / avoid: do not infer an executed result from mode-independent code, matching version, a prior PASS, or the small size of the reconciliation delta. Do not erase the prior source success or describe the missing run as a demonstrated runtime failure.

Acceptance checks: every final count names its mode and pre/post-reconciliation scope; no unsupported “37 in both modes” remains; links resolve; if a new source run is chosen, record selected checkout/artifact provenance, all 37 results, one-container teardown, and a complete current host-plugin fingerprint window. Failure or inability to run must remain visible rather than be converted to a PASS. Replaying the documented commands must select the stated tier and install mode.

Regression risks: accidentally rewriting historical evidence as a new run, losing the valid 34-test source result, or mutating the working harness during evidence collection. Dependencies: align archive, evidence summary, and owner completion summary together; a new run should follow the fixture repairs, not precede them.

## Independently verified contracts

- Exact identity: HEAD, tracking ref, and live remote refs/heads/episode/plugin-test-container equal c53972ff35488d23efdbf975e67006b451281931. Tracked worktree stayed clean.
- Complete diff: 39 files, all within the approved infrastructure, migration, documentation, inventory, and plan-move scope. No episode-authored src/prime-agent-plugin change; no runtime.Dockerfile, run-prime-agent-probe.sh, bin/prime-claw, or test_embedding_candidate_build.py change. Only this future bundle was moved. Main is 9b3edd2.
- Archive: seven content-preserving moves in c53972f (spec, plan, all five reports); no active SPECIFICATION.md/EXECUTION_PLAN.md or future/plugin-test-container remains. Checked Markdown links and the repointed developer/evidence paths resolve. The archive explicitly says Slice 3 had no EXPERT PASS yet; I did not treat it as already reviewed.
- Earlier repairs: scripts/test-tier1.sh, docker/test.Dockerfile, and tests/test_tier1_driver.py are unchanged from bc00cba. Docker-free informational paths, source rebuilding, semantic get_commands acceptance, and the driver's kill escalation remain covered. All four retained source tarball hashes match the Slice-2 table. Current image sizes remain 606MB vs 5.17GB; shared-base deferral follows the approved escape hatch.
- Migration/reconciliation: all seven current tier-1 files use the container fixture for Node/Prime Agent/plugin execution. No pre-existing test function was dropped. The goal-heartbeat bridge and main's install-generation cases are present. All six .test.mjs suites have actual in-container bridges, including episode_close and project_conversation. The static guards pass. The six runtime files are sandbox-marked; R-T1-1..5 exist and inventory integrity passes.
- assert_creation_trace repair is correct. Main commit 376bc2b changed only initial handoff admission to followUp + queueIfBusy=true and preserved fail-closed ordinary prompts for owner continuations. Current assertions match that split. The pre-migration documented gate explicitly excluded test_reviewed_plan_native_discovery.py, which supports the recorded explanation for missing that stale pytest assertion.
- Environment findings: a fresh networkless container could not connect to my fixture's host-bound Unix socket (ENOTSUP). The native suite now uses in-container fake daemons and container-local croot for Git/promotion, and those tests passed. I did not independently reproduce the historical gRPC-FUSE EACCES matrix: simple fresh-copy controls on a separate /tmp bind mount passed, including the plugin's copy options. That different-mount result does not disprove the historical investigation; the note's detailed EACCES attribution remains historical evidence, not a fresh result of this review.
- Flakes: both recorded watchdog runs concern unchanged test/subject code. The named stall test uses 1s stall/poll/grace and 2s disappearance windows, so timing sensitivity is supported. Read-only Beads inspection confirms the owner's 16-hour leak/reap record. One precision limit: its signal-sync.pid belongs to the sibling resets_and_signal_cleanup_reaps_group scenario (:224–252), not the named terminates_stall scenario. It corroborates an independent pre-existing watchdog cleanup problem, not exact causation for both reported failures. These host-only watchdog tests remain tier 0; this migration does not itself cure their leaks.

## Fresh bounded verification

Host interpreter: /opt/homebrew/bin/python3, bytecode/cache writes redirected/disabled; no host Prime Agent/RPC execution.

- Default pytest tests/ -q: 223 passed, 144 skipped (21.50s).
- Same full gate with PATH=/usr/bin:/bin and no Docker: 223 passed, 144 skipped (24.05s).
- Driver/image/static-guard files with unreachable DOCKER_HOST: 56 passed (13.20s).
- Pinned 0.9.3 container gate: 37 passed, 330 deselected (125.09s), one fixture container d66166d2d711; normal teardown removed it.
- Sequencer controls using the byte-identical script and recording substitutes: default runs 0→1 only; --with-sandbox adds 2; failure at each tier prevents later tiers and returns nonzero.
- Networkless in-image TERM-ignoring parent/descendant control: expected probe exit 137 and container rc=1, no OK; 4s+2s deadline, 9.37s total including container startup. No real Prime Agent ran in this control.
- Bash syntax passed. No tier-1 image containers remained at final inspection. Fresh before/after SHA256s match for all nine current managed host plugin files, including goal-heartbeat-work-control.ts, plus the obsolete-file absence check.

Minor non-blocking archival hygiene to fold into the documentation repair: all five new R-T1 plan fields still point to the deleted active .ralph/plans/SPECIFICATION.md (inventory lines 1139/1161/1183/1204/1235). Also git diff --check reports one new blank line at EOF in tests/test_reviewed_plan_native_discovery.py:419; I did not modify it. The historical slice-3 checksum files still name the obsolete goal-blocker file and omit the new goal-heartbeat file; the complete current-generation hash check above is fresh evidence only for this review window.

Synthetic reproductions and verification logs are retained outside the repositories at:
/var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/tier1-final-review-c53972f-xifhxbml
Key reproductions: stage-obsolete-subdir-failure.py, driver-cleanup-control.py, fixture-teardown-failure.py; corresponding result logs are beside them. They use repository code through the native host interpreter and controlled substitutes, not a real source build or failing live Docker cleanup.

Review boundaries: no repository edits, Git mutations, host plugin refresh, real source rebuild, subject steering, episode/lifecycle action, or external cleanup. Normal test fixtures and ephemeral containers performed their own cleanup. Personal-brain access failed; conclusions use the exact approved archive, all five prior reports, repository/fork source, retained evidence, owner clarification, read-only Beads records, and checks above.