# EXPERT review — slice-2 reworked candidate bc00cba — PASS

> Reviewer: expert-reviewer-blw2-bc00cba (rlm child sub-0935580a)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated post-restart)
> Exact commit: bc00cba08b108e61fac4b8c97c25795773b8b1c8 (episode/plugin-test-container)
> Packet: agentmsg_1e2f86e7 | Report arrived via agent_message reply; preserved verbatim below
> Prior rounds: 47d2830 BLOCK, d8dbc5d BLOCK, 2666843 PASS (slice 1); 470be98 BLOCK (slice 2)
> Disposition (owner): PASS accepted — slice-2 candidate accepted; advancing to slice 3

---

PASS — bc00cba08b108e61fac4b8c97c25795773b8b1c8

No material finding remains in this Slice-2 reworked candidate. I read the preserved 470be98 BLOCK report first, then independently checked the approved bundle, complete repair diff, implementation, tests, selected fork's packer/runtime source, and retained evidence. This verdict covers Slices 1–2 only. It is not merge authority or approval of Slice 3.

## Exact identity and scope

- HEAD, the tracking ref, and live `git ls-remote origin refs/heads/episode/plugin-test-container` all equal bc00cba08b108e61fac4b8c97c25795773b8b1c8. The worktree remained clean.
- `git diff 470be98..bc00cba --stat` changes exactly the four authorized files: scripts/test-tier1.sh, tests/test_tier1_driver.py, the Slice-2 evidence note, and .ralph/plans/EXECUTION_PLAN.md. The plan change is only the two sanctioned vendor-installer wording corrections.
- No plugin-source behavior, runtime Dockerfile, host probe wrapper, tier markers, conftest, test migration, or unified test driver changes were added. `git diff --check 470be98..bc00cba` passed.

## B1 resolved — fresh source staging

- scripts/test-tier1.sh:245–283 executes readiness → source staging → image build. Every real source run removes all four pack-consumed dist directories and unconditionally builds before packing. Container execution comes afterward. Build/pack failure exits before image build or installation; there is no fallback or reachable final OK.
- I inspected the actual fork packer: it consumes those four dist trees, wipes its release output directory, and packs the resulting staged content. The selected fork remains clean at a1faacd53ac4473a75de1d434afaf50945c2f647, version 0.9.8.
- The behavioral tests passed for existing stale dist, removed-output cleanup, marker A → B without a version change, and build/pack failures. Source dry-run records zero npm/node/Docker calls. I also ran the real selected-checkout dry-run with Docker absent from PATH; it performed no build or pack.

## B2 resolved — semantic RPC acceptance

- The shipped validator requires one matching id=loader/type=response/command=get_commands reply, success exactly true, and handoff/plan/implement-spec each exactly once with container extension-path provenance.
- The tests execute the exact embedded validator, not a separate imitation. Valid responses and valid responses surrounded by unrelated events pass. Missing replies, malformed JSON, false success, empty/partial/duplicate required commands, host-style source paths, duplicate replies, wrong reply IDs, and events without a matching reply fail. Unknown additional commands do not incorrectly fail a valid result.
- The generated command writes probe stdout/stderr to regular files, waits for the timeout-controlled process to exit, checks its status, then invokes the validator on the captured file. No new probe-output pipe read was introduced. The small base64 transport carries validator source, not live probe output.

## B3 resolved — forced deadline and replay

- The generated command contains GNU timeout with `--kill-after`, defaults 60s + 5s, and supports the documented test scaling. I captured its full argv and confirmed that the 4s + 2s probe step is byte-identical to the retained demonstration.
- I independently replayed the networkless in-image TERM-ignoring parent plus TERM-ignoring descendant fixture twice. Both produced probe exit 137, container rc=1, and no OK. End-to-end wall times were 7.75s and 8.54s including container startup; the latter ran alongside other synthetic controls. A subsequent good replay passed in 1.30s.
- Additional full generated-command controls used synthetic install/version/apply/check/Prime Agent executables inside networkless containers. The positive passed; each prerequisite failure returned nonzero with no final OK.
- Every review container used --rm and no host mounts. Final Docker inspection showed no tier-1 image containers remaining. No real Prime Agent process or session was started by this review.

## Evidence-note verification

- Retained rework source/pinned logs corroborate fresh compilation and packing, versions 0.9.8/0.9.3, in-container apply/check, semantic validator OK, and final driver OK. I did not repeat the networked installations or mutate the source checkout.
- The recorded exact pack command matches the driver. All four current tarball SHA256 values match both the committed table and SHA256SUMS. The primary is 4558b8220361a310a6ceebaab7c006047c5845cad3a782acd7a4efaa0347c5df, also matching the prior review's pre-rework fingerprint. These checks corroborate the retained reproducibility evidence; this review did not itself rebuild the fork.
- The two rework-window host checksum captures are byte-identical. Current managed-file hashes and absence state still match them. Fresh before/after hashes during my review also match.
- The earlier-baseline delta is exactly the removed goal-blocker-control.ts and changed spec-episode.ts. The note honestly separates that earlier delta from the unchanged rework window and attributes it to the operator's announced plugin update/restart. The hashes prove the bounded window, not independent causation of the earlier update.
- The documented tier-0 selection collects exactly 194 tests. Its historical 194-passed/18.52s result remains recorded acceptance evidence, not a fresh full-gate result from this review. I independently reproduced the focused 50-test result below.

## Independent bounded checks

Using the documented host Python with bytecode/cache writes disabled:
- Focused driver + image tests: 50 passed, normal PATH (10.95s).
- Same tests with PATH=/usr/bin:/bin: 50 passed (10.76s), no skips.
- Same tests with an unreachable DOCKER_HOST: 50 passed (9.73s).
- Bash 3.2 syntax check passed.
- No-Docker help, smoke dry-run/rebuild, pinned dry-run/probe, and source dry-run/probe passed. The recording/failing-Docker tests still enforce zero informational calls and real-run failure propagation.

Review boundaries: no repository edits, Git mutations, host RPC probes, full host suite, host-plugin changes, lifecycle actions, or external cleanup. Synthetic fixtures/results were retained outside the repositories at /var/folders/4_/twy0wz3s1mq650wnqzn1b8rr0000gq/T/tier1-review-bc00cba-xowpl1k5. The personal brain was unavailable; conclusions use the exact packet, repository/runtime source, retained artifacts, and checks above.