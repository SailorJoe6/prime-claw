# EXPERT review — FINAL gate #2, complete candidate 8c44cd1 — BLOCK (2 failure-path findings remain)

> Reviewer: expert-reviewer-final-8c44cd1 (rlm child sub-ee0f4ca6)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated)
> Exact commit: 8c44cd16fd2cc64ef4c2ebfd8bf8a6d86e2cc4c2 (episode/plugin-test-container)
> Packet: agentmsg_a1b94bf1 | Report arrived via agent_message reply; preserved verbatim below
> Prior gate: c53972f BLOCK (B1/B2/B3) at docs/evidence/2026-09-30-tier1-final-expert-review-c53972f.md
> Note: preserved to docs/evidence/ (merge-clean path); fold into the archive bundle's reviews/ at merge time.
> Disposition (owner): BLOCK accepted — B1-R/B2-R classified in-scope review-rework

---

BLOCK — 8c44cd16fd2cc64ef4c2ebfd8bf8a6d86e2cc4c2

Two material failure-path defects remain. B1 is repaired for errors raised during recursive deletion, but not for errors hidden by filesystem predicates. B2 now checks teardown, but its absence test accepts Docker failures as proof of removal. B3 and the requested archival hygiene are resolved. The normal pinned container gate passes, and host isolation is intact.

I read the preserved c53972f BLOCK first, then the archived specification, execution plan, all five prior EXPERT reports, repair diff, and complete candidate. This verdict is for this exact commit, not merge authority. No product decision is needed.

## B1-R — P2, confidence 10/10: Metadata errors are silently classified as an absent dist tree

Evidence: tests/conftest.py:142–147 uses Path.is_symlink(), is_file(), and is_dir(), then treats three false results as absence. On the actual project host interpreter, /opt/homebrew/bin/python3 3.14.4, these predicates suppress filesystem OSError exceptions. The outer except OSError at :148 cannot catch errors already converted into False. The new helper therefore does not satisfy its stated permission/I/O/type-error contract.

Independent reproductions, all outside the repositories:
- A real synthetic packages/agent parent with mode 000 contained dist/deleted-source.js. The actual _remove_dist_tree returned normally. The actual _stage_fork_release then invoked the recording npm build boundary; the stale file remained. The recording boundary deliberately stopped the build, so this case did not run a real fork build or claim a completed artifact.
- With an injected EIO from stat/lstat for one existing dist path, the actual _stage_fork_release ran the committed recording npm/node substitutes, returned v0.9.8, and left stale-output.js beside the newly built MARKER-A. This is a successful staging reproduction with a surviving obsolete output. The real fork packer recursively copies dist (scripts/pack-prime-agent-release.mjs:159–162, :221–223), explaining why that surviving output matters. The substitutes are not a real fork build.
- A FIFO at the dist path was neither removed nor rejected; the helper returned normally. False type predicates do not establish nonexistence.

Precision about the driver: an additional control found that this host's rm -rf also proceeds to npm build when the dist parent is unsearchable; npm then fails on permission denial. Do not use the shell command's spelling as proof that this stronger metadata-error contract is enforced. The prior nested-0555 deletion-denial case is repaired and passes in the fixture tests.

Impact / violated invariant: source staging can continue without establishing that all four pack-consumed output trees were removed. With a transient metadata error it can package surviving obsolete output while reporting fresh staging. This violates the accepted B1 rule that absence is harmless but permission/I/O/type errors stop before build/pack/image-build/container creation, and the source-selection freshness contract.

Root-cause seam: filesystem inspection collapses unknown/inaccessible/wrong-type into absent before the correctness-critical deletion boundary. The new tests cover failure inside rmtree, not failure while deciding whether to call it.

Recommended repair direction / rationale: distinguish confirmed absence from inspection failure and explicitly handle non-directory objects. Use error-preserving metadata/deletion semantics, not convenience predicates as absence proof. Enforce the same semantic freshness boundary in both documented source paths; the driver control above should be accounted for rather than repeating an unsupported equivalence claim. This remains small source-staging work, not a cache or orchestration redesign.

Constraints / avoid: keep deletion scoped to the four selected dist paths; never traverse a symlink target. Preserve the valid missing-tree case. Do not infer freshness from version, successful incremental build, directory predicates, or matching rm spelling. Do not rebuild/install the live harness fork to investigate this already-reproduced error path.

Concrete acceptance tests:
- Positive: truly absent trees, regular files, directories, and symlinks including dangling links; symlink targets remain untouched. Fresh staging and A→B source replay without a version change pack current output and omit deleted outputs.
- Negative: inaccessible parent and injected metadata PermissionError/EIO must fail before any npm, node, Docker image-build, or container-run call. An existing FIFO/special object must be handled explicitly or rejected before build, not treated as absent. Exercise the current Python 3.14 environment and the actual fixture staging boundary.
- Failure: retain the existing nested-0555 removal-denial and build/pack failure cases. Assert the whole fixture stops before publication, not only that one helper raises.
- Replay: after a denied/unknown cleanup attempt, restore access and stage again; the failed attempt must not have produced an accepted artifact, and the successful replay must remove obsolete output. Apply the source-path error test to the driver too.

Regression risks: rejecting an actually clean checkout; following links outside the selected trees; allowing OS/Python-version differences to change error handling; driver/fixture divergence. Dependencies: fix the source boundary and its behavioral tests together, including the driver edge now observed; align the B1 repair claims in the evidence note. Coordinate with B2's actual-session failure coverage.

## B2-R — P2, confidence 10/10: A failed Docker inspect is accepted as verified container absence

Evidence: tests/conftest.py:_container_absent (:398–409) returns out.returncode != 0. _remove_session_container (:443–449) then accepts any non-timeout removal result when this boolean is true, including removal failure. _finalize_session (:478–481) deletes the share on that alleged success.

Docker inspect returns nonzero for more than a missing object. A read-only real CLI check against an unavailable Docker endpoint returned rc=1 with a connection error, just as an inspect of a genuinely absent ID returns rc=1. No Docker daemon was stopped or modified for this check.

Controlled reproduction through the ACTUAL tier1_container fixture under pytest:
- Simulated successful info/build/run/setup published one captured synthetic ID.
- docker rm -f returned rc=1, “Cannot connect to the Docker daemon.”
- docker inspect returned rc=1 with the same connection error.
- The real fixture printed “container absence is verified — treating teardown as idempotent success”. Pytest exited 0: 1 passed in 0.04s. The share's evidence.log was deleted.
Only the Docker subprocess boundary was substituted; fixture registration, setup, yielding, and pytest teardown were real. No failing live cleanup or real leaked container was created.

Impact / violated invariant: a daemon/API/access failure during teardown can still produce a green gate while the long-lived container may remain, and deletes the evidence needed for recovery. This directly violates B2's verified-removal/confirmed-absence condition and its evidence-preservation requirement.

Root-cause seam: transport/inspection failure is conflated with resource absence. Inspection stderr and status are discarded, so teardown also cannot explain an unknown state accurately. The committed fake Docker always models nonzero inspect as absent, encoding the same assumption.

Recommended repair direction / rationale: require a positive, error-distinguishable absence result for the exact captured container ID. Preserve inspect diagnostics and distinguish present, absent, and unknown/error. Unknown must fail the gate and retain the share. Permit idempotent success only when actual absence is established. This closes the existing finalizer seam without broad cleanup machinery.

Constraints / avoid: retain bounded timeouts and exact-ID ownership. No pruning, name-based guesses, retries without a fixed bound, host process killing, or treating all nonzero/empty inspect output as absence. Do not swallow the original setup/test failure or clear its recovery evidence.

Concrete acceptance tests:
- Positive: actual pytest session setup/body/teardown proves the one published ID absent; explicit already-absent replay succeeds; an unrelated container is never targeted.
- Negative: removal failure plus inspect daemon/permission/API failure must make pytest nonzero and preserve the share. Also cover successful rm followed by failed/unknown inspect, so a false-success removal cannot bypass verification. Require the exact ID and useful rm AND inspect diagnostics.
- Failure: removal timeout, inspect timeout, CLI-launch failure, and still-present container all fail boundedly. Setup failure after publication still cleans only the captured ID. Setup+cleanup failure and test-body+cleanup failure preserve both errors.
- Replay: a good run after confirmed removal succeeds; a run following failed cleanup must not inherit or delete that failed run's still-owned state. Prove this through the session fixture, not a substring assertion about the generated name.

Regression risks: misclassifying already-absent as failure; masking the first error; deleting a share on unknown state; weakening exact-ID scope; increasing teardown latency. Dependencies: repair absence classification, diagnostics, share policy, and real-session negative coverage together; refresh the B2 evidence claims afterward.

## Requested repair and coverage adjudication

- B1's common paths are improved: no ignore_errors in dist removal; ordinary files/symlinks and missing directories are covered; the 0555 child-directory denial raises before build/pack. The remaining defect is the metadata/type decision before deletion.
- B2's bounded rm and inspect calls are scoped to the captured ID. Timeout/removal-with-still-present paths now raise. I independently ran an actual-pytest dual-failure control: it reported both ORIGINAL BODY FAILURE and a separate teardown error, and retained evidence. In real pytest, test-body exceptions are not thrown into a yield fixture; both errors are preserved by pytest's separate reports, not by add_note. add_note covers an exception in flight during fixture setup (or a direct generator throw).
- The new file has 27 tests and calls the actual _remove_dist_tree, _stage_fork_release, _remove_session_container, _finalize_session, and collection hook. It does NOT call/instantiate tier1_container. The claimed setup/body/teardown matrix is mostly finalizer-helper tests; the uniqueness check is a source-string assertion. The missing real-session/metadata-error coverage belongs with B1/B2, not in a separate product decision.
- Remaining ignore_errors sites: :596 is unique per-test scratch cleanup and is benign for the reviewed correctness boundaries. :481 is acceptable as best-effort scratch cleanup only AFTER real absence proof. Its current reachability on unknown container state is unsafe because of B2-R, not because ignore_errors must be banned everywhere.
- B3 is resolved: archive README :21–26 states source 34 passed/139s BEFORE reconciliation and pinned 37 passed/118s AFTER, and expressly does not claim a post-reconciliation source gate. I found no remaining affirmative “37 in both modes” claim in the current candidate's acceptance prose. The negated historical quotation in the repair note is not a new claim. I did not rebuild or rerun source mode.
- Hygiene resolved: all five R-T1 plan references point to the existing archived spec; linked archive/developer/evidence paths resolve; both diff --check ranges pass; the native-discovery EOF blank lines are removed. The evidence note marks old checksum captures as historical and records the current nine-file fingerprint. Minor nonblocking arithmetic wording: its :371 calls the prior post-reconciliation gate 222 tests, but that gate was 223; the failed post-repair run had 250 executed tests (249 passed + 1 failed).

## Complete candidate and scope

- HEAD, tracking ref, and live remote refs/heads/episode/plugin-test-container matched the exact reviewed hash. HEAD stayed there; tracked worktree was clean before and after checks.
- Repair diff c53972f..8c44cd1 contains exactly the six authorized files: tests/conftest.py, tests/test_tier1_fixture.py, archive README, requirements inventory, slice-3 evidence note, and native-discovery EOF (810 insertions/28 deletions).
- Complete main...8c44cd1 diff: 40 files, 4,747 insertions/853 deletions. Local main is now 8ecf426, the preserved prior BLOCK report; the merge base remains 9b3edd2. No episode-authored src/prime-agent-plugin change. runtime.Dockerfile, run-prime-agent-probe.sh, bin/prime-claw, and test_embedding_candidate_build.py are unchanged.
- The Slice-2 accepted driver/image/driver-test files are unchanged from bc00cba. Earlier semantic probe acceptance and kill escalation remain covered by the passing focused tests. The slim image remains 606MB versus 5.17GB for the runtime image; shared-base deferral follows the approved escape hatch.
- All seven current plugin test files route Node/Prime Agent/install execution into the session container. Comparing test-function names with 9b3edd2 found no removed test function; episode_close and project_conversation bridges were added. All six .test.mjs suites have bridges, main's goal-heartbeat/install-generation cases are present, and the six runtime files are sandbox-marked. The stale creation-trace assertion now matches the queued initial handoff contract without changing plugin behavior.

## Fresh bounded verification

Interpreter: /opt/homebrew/bin/python3 3.14.4. Pytest cache/automatic bytecode writes disabled; later checks also redirected explicit compiled-cache output outside the repo. No host Prime Agent or host RPC probe executed.

- Focused fixture + driver + image + static guards + inventory: 85 passed in 18.95s, including all 27 new fixture tests.
- First default gate: 249 passed, 144 skipped, 1 failed in 25.36s. The failed case was test_candidate_progress_watchdog_resets_and_signal_cleanup_reaps_group (:221, expected 0, got watchdog rc124), not the named terminates_stall case in the repair note. Its test and subject are unchanged; short timing windows support flakiness, but this review does not claim a newly proven historical cause.
- Fresh full default gate with PATH=/usr/bin:/bin, Docker absent: 250 passed, 144 skipped in 26.06s. Thus the current tier-0 gate did independently pass, without concealing the earlier failure.
- Pinned 0.9.3 container gate: 37 passed, 357 deselected in 116.35s. One session container, prime-claw-tier1-session-67535-1790812265 / 1f06e14830b7. Final live docker ps -a --filter name=prime-claw-tier1-session was empty; inspect of that exact ID reported no such object.
- Bash syntax and both repair/complete diff whitespace checks passed.
- Fresh before/after/final SHA256s match for all nine managed host files, including goal-heartbeat-work-control.ts and APPEND_SYSTEM.md; goal-blocker-control.ts, episode-finalization.ts, and redundant project-conversation.ts are absent. Hashes also match the repair note's current-generation table.

Reproductions, scripts, logs, full diff, and fingerprints are retained outside both repositories at:
/var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/tier1-final-review-8c44cd1-a2vay5_6
Key files: boundary-reproductions.py/.log; b1-metadata-and-driver-controls.py/.log; test_actual_session_control.py; actual-fixture-unknown.log (incorrect green gate); actual-fixture-dual.log (both failures preserved); tier0.log; tier0-no-docker.log; fixture-static.log; container-pinned.log; container-setup.log; host-before.json/host-after.json/host-final.json.

Review boundaries: no repository source edits, Git mutations, host-plugin changes, real source rebuild, subject steering, episode/lifecycle actions, or external resource cleanup. Normal tests performed their own scratch/container teardown. Reviewer wait monitors were removed and verified absent. Personal-brain access failed; conclusions rely on the exact approved bundle, preserved reviews, repository/fork source, and independent checks above.