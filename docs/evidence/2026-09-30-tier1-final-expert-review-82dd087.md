# EXPERT review — FINAL gate #3, complete candidate 82dd087 — BLOCK (1 ownership-seam finding remains)

> Reviewer: expert-reviewer-final-82dd087 (rlm child sub-eeba16d4)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated)
> Exact commit: 82dd08736035ff3dd5c4bd3a71c1ea333ce27dcb (episode/plugin-test-container)
> Packet: agentmsg_12efb222 | Report arrived via agent_message reply; preserved verbatim below
> Prior gates: c53972f BLOCK, 8c44cd1 BLOCK (both at docs/evidence/)
> Note: preserved to docs/evidence/ (merge-clean path); fold into the archive bundle's reviews/ at merge time.
> Disposition (owner): BLOCK accepted — B2-R2 classified in-scope review-rework

---

BLOCK — 82dd08736035ff3dd5c4bd3a71c1ea333ce27dcb

One material replay defect remains. B1-R metadata handling is repaired. B2-R now correctly distinguishes unknown inspection from absence, but the failed-run share-preservation/no-inheritance contract still fails when a PID is reused. The normal pinned gate passes, and host isolation is intact. No product decision or scope expansion is needed.

I read the preserved 8c44cd1 BLOCK report first, then the approved archived specification, execution plan, all five archived EXPERT reports, the older final BLOCK, repair diff, complete candidate, and relevant test/helpers. This verdict covers the complete exact candidate. It grants no merge authority.

## B2-R2 — P2, confidence 10/10: A later session can inherit and delete a failed session's still-owned share

Evidence:
- tests/conftest.py:585–586 allocates RESULTS / f"share-{os.getpid()}" with exist_ok=True. There is no per-session identity or exclusive allocation for the share.
- The container name does include PID plus epoch (:616–624), so a later session can successfully create a different container while reusing the previous share.
- _finalize_session (:549–552) removes the entire share after proving only the CURRENT captured ID absent. It does not establish that an earlier container no longer owns that same path.
- The new behavioral test tests/test_tier1_fixture.py:923–969 changes BOTH PID and epoch (4242 → 4343). It passes but never exercises PID reuse. Its distinct-PID assumption hides the remaining ownership seam.

Independent reproduction through the ACTUAL tier1_container generator, with only Docker and the run identity controlled, outside both repositories:
1. Run 1 used PID 4242, epoch 1000000, name prime-claw-tier1-session-4242-1000000, captured cid-1, and wrote run1-recovery.log to share-4242.
2. rm and inspect returned daemon errors. The real fixture raised TEARDOWN FAILED/state=unknown and correctly retained the witness.
3. Run 2 used the SAME PID and epoch 1000061. It captured cid-2 under a different container name. Its setup reused share-4242 and could read run 1's witness.
4. Run 2's rm/inspect positively established cid-2 absent. Finalization succeeded and deleted share-4242, including run 1's witness. No run-2 Docker call targeted cid-1; that container's ownership remained unresolved.

The retained trace reports RUN2_INHERITS_RUN1_EVIDENCE=True, RUN2_SUCCEEDED=True, RUN1_WITNESS_AFTER_RUN2=False, SAME_SHARE=True, DISTINCT_IDS=True, and RUN2_NEVER_TARGETS_CID1=True. No real container was leaked. This models ordinary OS PID reuse, or multiple pytest sessions in one process; distinct container names do not prevent it.

Impact / violated invariant: a successful later gate can share writable test state with an unresolved earlier container and destroy the evidence retained for its recovery. This violates the accepted B2/B2-R replay requirement that a run after failed cleanup must not inherit or delete that run's still-owned state, and the finalizer's own ownership rule (:536–538). This is not merely a container-name collision.

Root cause: lifetime identity was strengthened for the container name but not for its bind-mounted share. A recyclable PID and mkdir(exist_ok=True) silently admit an old resource into a new session; current-container absence is then incorrectly sufficient to delete it.

Recommended repair direction / rationale: give every session an independently unique, exclusively allocated share identity, retained with that session's captured container. Keep cleanup restricted to that exact owned share. Do not reuse a pre-existing share solely because the PID/path matches. Align container/share identity and the replay test so both resources obey the same session boundary. This is a small correction to the existing fixture, not new cleanup machinery.

Constraints / avoid: preserve same-absolute-path host/container mounts, exact-ID bounded rm→inspect, UNKNOWN failure behavior, diagnostics, and TIER1_KEEP_SHARE. Do not delete or adopt an existing share, prune containers, search by names, kill host processes, or add retries to make a later run green. Do not weaken the new fail-closed source-staging repair.

Concrete acceptance tests:
- Positive: ordinary setup/body/verified teardown removes only that session's share; already-absent replay succeeds; explicit KEEP_SHARE still retains its own artifacts.
- Negative/replay: drive two real fixture sessions with the SAME PID and different epochs. Fail run 1 teardown as UNKNOWN or PRESENT, plant a witness, then complete run 2. Require distinct shares, no run-1 evidence visible through run 2's share, byte-identical run-1 witness afterward, and run-2 Docker calls scoped only to cid-2.
- Collision: exercise the same PID and same coarse epoch, plus an already-existing legacy share-PID directory. Allocation must choose fresh owned state or fail closed without using/removing the existing directory. No time assumption may authorize reuse.
- Failure: after a retained run, make the next setup fail both before and after publication. The old share must survive; only the newly captured ID/newly allocated share may be finalized. Preserve setup/body plus teardown diagnostics.
- Replay: a later clean session must still succeed after these failures without touching any retained prior share or container.

Regression risks: incorrect bind-mount paths, losing share paths in diagnostics, accidental removal of preserved evidence, changes to KEEP_SHARE behavior, and reintroducing container-name collisions. Dependencies: repair share allocation/ownership and the full-fixture replay coverage together, then update the no-inheritance claims in the slice-3 evidence note (:489–497). B1-R and the three-state inspect classifier need no redesign.

## Verified repairs and acceptance contracts

- B1-R: direct lstat now distinguishes FileNotFoundError from PermissionError/EIO; ordinary files and symlinks (including dangling links) are unlinked without following targets; directories use error-raising rmtree; special objects are explicitly rejected. Committed tests cover stale/deleted output removal, A→B staging without a version change, absent trees, inaccessible parents, injected metadata errors, FIFO rejection, nested-0555 denial, build/pack failure, and access-restored replay. The new driver test passed; the driver itself is unchanged. The docstrings accurately distinguish earlier fixture metadata detection from this host's rm/build behavior.
- I additionally registered the shipped tier1_container as a REAL pytest session fixture in an external control suite. Injected metadata PermissionError and EIO made setup fail; each Docker trace contained only info, neither npm/node substitute ran, and nothing was published. Thus the negative boundary is proven through pytest, not only helper calls.
- B2-R classification is repaired: unknown daemon/permission errors, unrecognized output, timeouts, and CLI-launch errors fail closed; verified absence permits idempotent success; calls remain one bounded rm and one inspect of the exact ID. Committed timeout/launch/present tests passed.
- Independent actual-pytest controls: ordinary teardown and already-absent each passed; rm failure + unknown inspect and rm success + unknown inspect each exited 1 with a teardown error and retained body evidence. Both rm and inspect diagnostics and the exact ID were present. A body failure plus unknown teardown produced 1 failed AND 1 error. Setup failure plus unknown teardown retained the original setup error and the teardown note. Real pytest preserves body and teardown failures as separate reports; generator.throw/add_note is not how ordinary pytest body failure is delivered.
- The new five generator-level tests exercise the actual fixture rather than only helpers. Poisoned staging, post-publication setup cleanup, and surfaced teardown failures are meaningful. Their no-inheritance proof remains limited to different PIDs, as explained above.
- B3/hygiene stay resolved: source acceptance is honestly 34/139s BEFORE reconciliation; pinned is 37/118s AFTER; no later source gate is claimed. The arithmetic is now 250 executed = 249 passed + 1 failed = 223 + 27. All five R-T1 plan references resolve to the archived spec; archive/developer/bundle links resolve; native-discovery EOF and both diff whitespace gates are clean.

## Complete scope and independent verification

- HEAD, tracking ref, and live origin/episode/plugin-test-container equal the exact reviewed hash. Tracked worktree remained clean. Merge base with current main is 9b3edd2.
- 8c44cd1..82dd087 changes exactly the four authorized files: tests/conftest.py, tests/test_tier1_fixture.py, tests/test_tier1_driver.py, and the slice-3 evidence note (804 insertions/48 deletions). Complete main...82dd087: 40 files, 5,503 insertions/853 deletions.
- No episode-authored plugin-source change; runtime.Dockerfile, run-prime-agent-probe.sh, bin/prime-claw, and test_embedding_candidate_build.py remain unchanged. The standalone driver and image are unchanged from the accepted Slice-2 commit. Image sizes remain 606MB test / 5.17GB runtime; shared-base deferral follows the approved escape hatch.
- All seven migrated Python test files route Node/Prime Agent/install execution through the container. No original test-function name was removed versus 9b3edd2; two previously missing bridges were added. All six .test.mjs suites have bridges; the goal-heartbeat/install-generation reconciliation is present; all six runtime files are sandbox-marked. The changed initial-handoff trace assertion matches the existing queued-bootstrap contract, not a plugin behavior change. The sequencer stays a simple fail-fast 0→1→optional-2 runner.
- Native host environment: /opt/homebrew/bin/python3 3.14.4, pytest 9.0.3. Automatic bytecode/cache writes disabled; explicit compiled-cache output redirected outside the repository.
- Focused fixture + driver + image + static guards + inventory: 105 passed in 26.27s, including 46 fixture and 34 driver tests.
- First default gate: 269 passed, 144 skipped, 1 failed in 48.05s. The unchanged test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero hit its 15-second timeout. Its recorded synthetic leader/descendant PIDs were absent afterward. I did no manual process cleanup and do not claim the historical cause is independently proved.
- Fresh full gate with PATH=/usr/bin:/bin (Docker absent): 270 passed, 144 skipped in 32.86s. This independently verifies the advertised count without hiding the first failed run.
- Pinned 0.9.3 container gate: 37 passed, 377 deselected in 109.38s. One session container: prime-claw-tier1-session-31242-1790816045, ID prefix b30f509fd5a2. Final docker ps -a --filter name=prime-claw-tier1-session was empty; inspect of that captured prefix reported no such object.
- Bash syntax and both repair/complete diff --check ranges passed. Fresh pre/post fingerprints match for all nine managed host files, including goal-heartbeat-work-control.ts and APPEND_SYSTEM.md; the three checked obsolete/redundant paths are absent. No post-reconciliation source rebuild was performed.

Reproductions, actual-pytest control suite/logs, full migration diff, test-name inventory, verification summaries, and host fingerprints are retained outside both repositories:
/var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/tier1-final-review-82dd087-i2yrhabd
Key blocker files: pid-reuse-repro.py and pid-reuse-repro.log. The script takes <repo> <fresh-output-directory> and drives the shipped fixture with recording substitutes; it needs no live Docker or source build.

Review boundaries: no repository edits, Git mutations, subject steering, host Prime Agent/RPC probes, host-plugin changes, source-fork builds, episode/lifecycle actions, or external resource cleanup. Normal tests performed their own scratch/container teardown. All reviewer wait monitors were deleted and absence verified. Personal-brain access failed; conclusions rely on the approved bundle, preserved reports, exact source, and checks above.