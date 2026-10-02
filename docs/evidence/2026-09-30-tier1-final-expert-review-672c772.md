# EXPERT review — FINAL gate #4, complete candidate 672c772 — PASS

> Reviewer: expert-reviewer-final-672c772 (rlm child sub-be358315)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated)
> Exact commit: 672c77213c26ae36400cec06ec253b4b1d84f80a (episode/plugin-test-container)
> Packet: agentmsg_2c6bbd91 | Report arrived via agent_message reply; preserved verbatim below
> Prior gates: c53972f BLOCK, 8c44cd1 BLOCK, 82dd087 BLOCK (all at docs/evidence/)
> Note: preserved to docs/evidence/ (merge-clean path); fold into the archive bundle's reviews/ at merge time.
> Disposition (owner): PASS accepted — the complete exact candidate is certified for the
> operator's merge review. This is evidence, never merge authority.

---

PASS — 672c77213c26ae36400cec06ec253b4b1d84f80a

No material finding remains in the complete plugin-test-container candidate. B2-R2 is repaired, and the earlier repairs remain intact. This certifies the exact candidate for the operator’s merge review. It does not authorize merge.

I read the preserved 82dd087 BLOCK report first, then the archived specification, execution plan, all five archived EXPERT reports, both earlier final BLOCK reports, the repair diff, and the complete candidate’s implementation, migration, tests, and evidence.

## B2-R2 resolved: each session owns fresh state

- tests/conftest.py:588–600 uses tempfile.mkdtemp with the PID/epoch prefix. Allocation creates a new directory rather than adopting an existing path. PID reuse and identical coarse epochs do not authorize reuse. The directory is normalized to 0755, and :607–608 preserves the same-absolute-path writable mount.
- The container name at :629–633 carries the same PID, epoch, and allocation token as its share. Cleanup at :533–563 remains restricted to the captured container ID and that session’s share. There is no legacy-share adoption/deletion, pruning, name-based cleanup, host-process killing, or added retry.
- The committed TestSessionFixtureEndToEnd class now has nine tests, up from five. Its _session_fixture_fn reaches the ACTUAL tier1_container generator through _fixture_function, with the documented compatibility fallback. These are behavioral fixture drives, not source-string assertions.
- The repaired same-PID/different-epoch test verifies distinct shares, no run-1 witness through run 2’s share, byte-identical retained evidence afterward, and run-2 Docker calls that neither target cid-1 nor mount share 1. The collision test runs two outstanding generators with identical PID/epoch plus legacy share-4242, and verifies distinct shares/names and preservation of the legacy witness.
- The setup-failure replay covers failure before publication at image build, failure after publication during container setup, and a later clean session. Only new resources are finalized. Already-absent replay and explicit KEEP_SHARE are also driven through the real generator.

Independent red/green control:

I wrote a separate control outside both repositories. It imports the shipped fixture through the native project interpreter, drives its actual generator, and substitutes only Docker and controlled identity/selection boundaries. The current candidate passed all 19 checks:

1. Run 1 retained a binary witness after rm and inspect both failed, leaving state UNKNOWN.
2. Run 2 used the SAME PID and a different epoch. Its share was distinct, the witness was not visible there, only cid-2/share 2 were targeted, and run 1’s bytes survived.
3. Identical-PID/identical-epoch outstanding sessions received distinct shares and container names. Share mode was 0755, name/share identity aligned, and the pre-existing legacy directory remained untouched.
4. A later image-build failure created no container and released only its new share. Post-publication setup plus UNKNOWN teardown preserved the setup error, teardown note, exact new ID, and prior retained state.
5. Already-absent replay, later clean replay, and KEEP_SHARE all preserved ownership boundaries.

The SAME PID-reuse control against the exact predecessor 82dd087 failed as expected: shared path, visible inherited witness, and deleted prior evidence. This independently demonstrates that the new allocation closes the reported defect. No real Docker failure or leaked container was used for these controls.

## Prior repairs and evidence remain valid

- B1-R: _remove_dist_tree and _stage_fork_release are byte-identical to 82dd087. Direct lstat distinguishes confirmed FileNotFoundError from metadata errors; file/symlink removal does not traverse targets; recursive deletion raises; special objects are rejected. The passing fixture tests cover absent trees, regular files, dangling/live symlinks, metadata PermissionError/EIO, inaccessible parents, FIFO, recursive removal denial, fresh A→B staging, deleted outputs, build/pack failure, and recovery replay. Full-fixture poisoned staging stops before publication. The driver’s inaccessible-parent test passed too.
- B2-R: _inspect_container, _remove_session_container, and _finalize_session are also byte-identical to 82dd087. PRESENT and UNKNOWN fail; absence needs positive missing-object evidence. One bounded rm then one inspect targets the captured ID. Timeout/launch errors, diagnostics, evidence retention, and KEEP_SHARE remain covered. My independent UNKNOWN/setup-failure controls exercised these paths through the actual generator. Generator throw-in coverage is not being represented as pytest’s ordinary test-body exception delivery.
- B3: the archive index keeps the honest split: source 34 passed/139s BEFORE reconciliation; pinned 37 passed/118s AFTER. It does not claim a post-reconciliation source gate. I did not rebuild the live fork or run source mode.
- The slice-3 round-3 section accurately describes this repair, the four added tests, and fake-Docker-only repair verification. The earlier round-2 no-inheritance proof is explicitly marked SUPERSEDED at :497–501.
- All five R-T1 plan references resolve to the archived specification. Archive/developer/bundle Markdown links resolve. Native-discovery EOF and both repair/complete diff whitespace checks are clean.

## Complete candidate and scope

- HEAD, tracking ref, and live origin/episode/plugin-test-container matched the exact reviewed hash. Final tracked worktree status is clean. Merge base with main remains 9b3edd2.
- 82dd087..672c772 changes ONLY tests/conftest.py, tests/test_tier1_fixture.py, and docs/evidence/2026-09-30-tier1-slice3-migration-sequencer.md: three files, 335 insertions/27 deletions.
- Complete main...672c772: 40 files, 5,811 insertions/853 deletions. No episode-authored plugin-source changes; runtime.Dockerfile, run-prime-agent-probe.sh, bin/prime-claw, and test_embedding_candidate_build.py are unchanged. The standalone driver and image are unchanged from accepted bc00cba.
- The seven migrated Python files route Node, Prime Agent, and plugin installation through the container. AST comparison with 9b3edd2 found no removed test-function names; the two missing bridges were added. All six .test.mjs suites have in-container bridges, including the reconciled goal-heartbeat generation. All six runtime files are sandbox-marked.
- The new helpers preserve in-container fake-daemon and install-choreography coverage. The initial-handoff trace assertion matches the existing queued-bootstrap contract; plugin behavior was not changed. The whole-suite script remains a simple fail-fast 0→1→optional-2 sequencer.
- Read-only image listing still shows 606MB test image versus 5.17GB runtime image. Shared-base deferral follows the approved escape hatch.

## Fresh independent verification

Native host environment: /opt/homebrew/bin/python3 3.14.4, pytest 9.0.3. Automatic bytecode/cache writes were disabled; explicit compiled-cache output was redirected outside the repository.

- Fixture + driver: 84 passed in 28.57s. Counts independently confirmed: fixture 46→50, end-to-end class 5→9, driver 34.
- Default pytest tests/ -q: 274 passed, 144 skipped in 39.47s. No failures on the first run.
- Same full gate with PATH=/usr/bin:/bin and Docker absent: 274 passed, 144 skipped in 39.91s.
- Pinned 0.9.3 container gate: 37 passed, 381 deselected in 137.66s. (This corrects my earlier progress-note typo of 145s.)
- Both shell scripts passed bash -n. Static guards and inventory checks passed within the full tier-0 gates. Both git diff --check ranges passed.

One live suite container was observed:
prime-claw-tier1-session-42437-1790818559-d3y9li2m
ID: 3d59f496473e2bfe8de4f2b9af29ed848a44d8c4911f6bab34d80e3310275319

Read-only Docker inspection showed only the read-only repository mount and its exact writable session share. After pytest’s normal teardown, docker ps -a --filter name=prime-claw-tier1-session was empty; inspecting the exact captured ID reported no such object; its owned share was absent. Fresh before/after/final checks match for all nine managed host files, including goal-heartbeat-work-control.ts and APPEND_SYSTEM.md; all three checked obsolete/redundant paths remain absent.

The full gates emitted only existing importlib.load_module deprecation warnings. No new source-mode gate, clean-cache image rebuild, or tier-2 run is claimed; their earlier acceptance remains historical evidence, not a fresh exact-candidate execution.

## Evidence and boundaries

Independent controls, predecessor/current results, traces, full diff, inventory audit, gate logs, exact-container inspection, and host fingerprints are retained outside both repositories:
/var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/tier1-final-review-672c772-o_hynjin

Key files: replay-control.py; old-replay/pid-replay-summary.json; fixed-replay/summary.json and trace.json; verification-summary.json; focused.log; tier0.log; tier0-no-docker.log; container-pinned.log; container-setup.log; container-mounts.json; container-post-inspect.txt; host-before.json; host-after.json; final-git.txt.

No repository edits, Git mutations, subject steering, host Prime Agent/RPC probes, host-plugin changes, source-fork builds, episode/lifecycle actions, or manual external cleanup were performed. Normal tests owned their scratch/container teardown. All reviewer wait monitors were deleted and absence verified. Personal-brain access failed; conclusions rely on the approved bundle, preserved reports, exact source, and independent checks above.