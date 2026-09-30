# EXPERT review — slice-2 candidate 470be98 — BLOCK (3 findings: stale-source replay, weak probe acceptance, soft probe deadline)

> Reviewer: expert-reviewer-blw2-470be98 (rlm child sub-e46c4fb5)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated)
> Exact commit: 470be987dd33a0a374ab33296499b6c4d89fc994 (episode/plugin-test-container)
> Packet: agentmsg_cb1ff3ff | Report arrived via agent_message reply; preserved verbatim below
> Disposition (owner): BLOCK accepted — all three findings classified in-scope slice-2 review-rework

---

BLOCK — 470be987dd33a0a374ab33296499b6c4d89fc994

Three material findings remain in Slice 2. The observed happy-path installs are corroborated, and the host isolation boundary is intact. The defects concern source replay correctness and the new probe's acceptance/termination behavior. No product decision or Slice-3 implementation is needed to repair them.

## B1 — P2, confidence 10/10: Source mode can silently test stale compiled code

Evidence: scripts/test-tier1.sh:162–170 runs `npm run build` only when at least one of four `dist` directories is absent. If all exist, :172–181 packs and installs them without checking whether they represent the selected checkout. `--rebuild` only disables the Docker image cache; it does not change this behavior.

I independently inspected the selected fork at a1faacd53ac4473a75de1d434afaf50945c2f647. Its scripts/pack-prime-agent-release.mjs:151–157 checks that dist exists, :217–223 copies existing dist, and :338–347 packs it. The staged package scripts retain only postinstall (:182–196), so npm pack does not secretly rebuild the source. A version match is not a freshness check; multiple changes can share version 0.9.8.

Bounded reproduction: an instrumented source-mode fixture supplied four existing dist directories, an old compiled marker, and recording Docker/node/npm substitutes. The pack substitute models the real packer's copy-existing-dist behavior. Run A returned 0/OK without invoking npm build. After changing the source marker to B, replay again returned 0/OK and packed the same old marker. Calls were info → Docker build → pack → Docker run, with no host npm build in either run. This proves the driver's selection branch; the real packer inspection establishes why it matters. It does not claim that the retained happy-path acceptance run used stale code.

Impact / violated invariant: PRIME_AGENT_SOURCE must exercise the chosen fork checkout. After a source edit or branch change, this driver can validate an older implementation while reporting success. That defeats the source-install path's central purpose.

Root cause: directory existence is used as a cache-validity test at the source-to-release boundary. Current tests exercise source dry-run, not a real source-mode replay through this branch.

Repair direction and rationale: ensure every real source run packs fresh artifacts representing the selected checkout, or fail closed when that cannot be established. A simple fresh build before packing fits the approved dumb-driver design better than a new caching system. Preserve host-side packing and container-side installation.

Constraints / avoid: do not use version equality, directory existence, or Docker --rebuild as proof of source freshness. Do not reuse macOS node_modules in Linux, install the fork into the host harness, introduce a general build cache, or migrate Slice-3 tests early.

Concrete acceptance tests:
- Positive: fresh checkout/build artifacts produce the expected package and container version.
- Negative/replay: with all dist directories present, change source without changing package version; the next run must package the changed implementation, not the previous marker. Cover removed/renamed source outputs too.
- Failure: compilation or packing failure must stop before container installation, return nonzero, and never report OK or fall back to previous artifacts.
- Informational replay: source --dry-run must still perform no build, pack, or Docker call.

Regression risks: build latency, assumptions about host build dependencies, stale outputs surviving an incremental build, and accidental execution on informational paths.

Dependencies: repair driver behavior and source-mode regression coverage together; refresh source acceptance evidence. The plan's "Fork pack reproducibility" contract also requires the exact pack command and output hash. The committed note lists filenames but omits artifact hashes. The retained primary tarball currently hashes to 4558b8220361a310a6ceebaab7c006047c5845cad3a782acd7a4efaa0347c5df, and the complete four-file SHA256SUMS exists in the fork's release/tier1/artifacts directory. Record the hashes of the newly accepted artifacts durably with the refreshed evidence.

## B2 — P2, confidence 10/10: --probe returns success without proving that the plugin loaded

Evidence: scripts/test-tier1.sh:187–195 only pipes get_commands into Prime Agent and checks process exit status. It never checks the matching RPC response's success, the required commands, or their installed paths. tests/test_tier1_driver.py:49–54 checks only text and the timeout spelling. The plan explicitly uses the existing live-loader pattern, whose tests/test_handoff_chain_extension.py asserts response success, command presence, and source provenance.

I captured the exact generated --probe command through a recording Docker substitute, then executed its unchanged probe fragment in the actual test image with a synthetic prime-agent executable and networking disabled. All three cases exited 0: (1) no response, (2) a matching get_commands response with success:false, and (3) success:true with commands:[]. No real Prime Agent process ran. The selected fork's rpc-mode.ts also confirms RPC errors are returned as JSON independently of normal process shutdown (:475–489), while get_commands returns its command list (:426–433).

Impact / violated invariant: a loader/API compatibility failure can look green. Copy/check proves installed bytes, not that Prime Agent registered handoff, plan, and implement-spec. The Slice-2 native-command acceptance contract is therefore not enforced by the advertised probe.

Root cause: transport/process completion is treated as semantic RPC success at the install-to-runtime-validation boundary.

Repair direction and rationale: validate the matching get_commands reply and the required native command registrations/provenance before declaring the probe successful. Keep this a small container-side check, not a new test harness. The normal acceptance log already shows the exact expected command names and /root/.prime/agent/extensions paths.

Constraints / avoid: do not grep arbitrary stdout for command names, accept unrelated asynchronous events as the reply, infer load success from apply/check, touch the host plugin, or change plugin behavior merely to make the probe green.

Concrete acceptance tests:
- Positive: one matching success response contains handoff, plan, and implement-spec, each once and from the container's installed extension paths.
- Negative: missing reply, malformed JSON, success:false, empty/partial/duplicate command lists, or wrong source paths must fail nonzero with no final OK.
- Failure: preserve diagnostics and fail on process error or timeout; handle unrelated JSONL events without falsely accepting them.
- Replay: the same valid installed generation passes repeatedly; a fixture that stops registering a command fails the next run.

Regression risks: confusing asynchronous events with the requested response, brittle assumptions about response ordering/version metadata, and introducing unbounded output reads.

Dependencies: repair with new behavioral coverage and refreshed probe evidence. Coordinate with B3 so semantic validation does not introduce another blocking read. The retained successful source probe is valid evidence; this finding concerns the missing negative acceptance behavior, not a claim that that run failed.

## B3 — P2, confidence 10/10: The claimed hard probe deadline is only a cooperative TERM timeout

Evidence: scripts/test-tier1.sh:190–191 calls `timeout 60` with no forced-kill escalation. GNU timeout sends TERM at the deadline and then waits if the child does not terminate. I verified this in the actual test image, networkless and without mounts or Prime Agent: a synthetic process ignored SIGTERM and completed after 1 second; `timeout 0.1` returned only after 1.018 seconds (exit 124), not at its 0.1-second deadline. An indefinitely stuck process with the same signal behavior has no hard bound.

This is relevant to the selected runtime, not just a shell curiosity: fork rpc-mode.ts:185–205 handles SIGTERM through asynchronous shutdown and awaits connection disposal. Container placement does not guarantee that shutdown completes. The existing accepted slice-1 evidence expressly warns that moving a probe does not itself cure hangs.

Impact / violated invariant: --probe can leave the driver and its one ephemeral container waiting indefinitely after the stated 60-second deadline. This violates the new probe's hard-deadline contract and the recorded slice-1 liveness lesson.

Root cause: the probe timeout controls the first termination signal but not the terminal process/container outcome.

Repair direction and rationale: retain a bounded normal deadline and add a finite forced-termination escalation for the owned probe process tree, ensuring the container command exits nonzero and --rm can complete. Use the existing container boundary and standard timeout facilities rather than a new supervisor framework.

Constraints / avoid: do not merely lengthen the timeout, rely on cooperative shutdown, kill host Prime Agent processes, add multiple suite containers, or repair/migrate the unrelated historical host probes in this slice.

Concrete acceptance tests:
- Positive: a normal probe finishes and preserves its successful result.
- Negative/failure: a silent or partial-output child that ignores TERM, plus a descendant holding output open, must terminate within deadline plus a small fixed grace; return nonzero and no OK.
- Replay: repeat that failure and then a good run; no owned container or probe process remains after each run. Scale test deadlines down rather than waiting 60 seconds for each case.

Regression risks: premature termination of normal shutdown, losing useful diagnostics, or incomplete descendant cleanup. Dependencies: coordinate with B2 and test the generated container-side command, not only its textual spelling.

## Verified contracts and evidence

- Exact identity: worktree HEAD, tracking ref, and live `git ls-remote origin refs/heads/episode/plugin-test-container` all equal 470be987dd33a0a374ab33296499b6c4d89fc994. Worktree remained clean. `git diff --check main...HEAD` passed.
- Total scope is correct: .env.example, promoted/corrected .ralph plan/spec, DEVELOPERS.md, docker/test.Dockerfile, scripts/test-tier1.sh, the two new tier-1 infrastructure test files, and the two evidence notes only. No plugin source, runtime Dockerfile, or run-prime-agent-probe.sh changes. pytest.ini, pyproject.toml, tests/conftest.py, and scripts/test-all.sh are absent. No test migration occurred.
- Rebase claim verified: 2666843 is resolvable. The requested `git diff 2666843 b2f6b86 -- docker/ scripts/ tests/ DEVELOPERS.md docs/evidence/2026-09-29-tier1-slice1-image-driver.md` is empty. d0a9883..1a0836d consists of the three stated review-report commits.
- Selection/isolation: .env.example is tracked; .env is ignored and untracked. Validation precedes Docker. Exactly-one selection, missing file, absolute/existing source directory, and pack-script presence checks are present. One mutually exclusive docker run --rm path executes. The install path mounts the repo read-only at /workspace, plus source artifacts read-only when selected. It passes no host home or plugin-root override. Unchanged apply/check therefore operate on /root/.prime/agent inside the container. --smoke preserves toolchain-only behavior.
- Vendor correction is substantively correct and recorded in the Slice-2 deliverable paragraph. bin/prime-claw uses the same installer URL and relevant environment controls. Read-only HTTP checks returned 404 for the public npm package and 200 for install.sh; the installer honors the version and verifies checksums. Minor wording debt remains in the plan's earlier "pinned-registry path" and later "registry install" phrases; these should follow the recorded correction.
- Retained /tmp/tier1-source-run.log and /tmp/tier1-source-run2.log corroborate the initial build, rejected external staging path, corrected file: staging, four artifacts, 273-package container install, version 0.9.8, in-container apply/check, and successful get_commands registrations sourced from /root/.prime/agent/extensions. The current fork hash is a1faacd53 and version 0.9.8. I inspected all four retained tarballs: their versions and internal file:///stage/releases/v0.9.8 dependencies match the note, and their actual SHA256 values match SHA256SUMS.
- /tmp/tier1-pinned-run.log corroborates the vendor download/checksum verification, 190-package install, version 0.9.3, and in-container apply/check success. I did not repeat either networked installation.
- All three retained host checksum captures are byte-identical. All nine managed files still match them, including handoff-chain.ts = debd42d40ba1c9a9ba23607c0e2f25e8505e6ef640cedfb62d8bffbe8d61ceb6. Fresh before/after hashes during this review also match.
- Focused pytest, with bytecode/cache writes disabled: 30 passed normally (4.00s); 30 passed with PATH=/usr/bin:/bin and Docker absent (4.20s); 30 passed with an unreachable DOCKER_HOST (4.41s). Bash 3.2 syntax passed. No-Docker help, smoke dry-run+rebuild, and missing-env fail-fast behaved correctly. Recording/failing-Docker tests meaningfully enforce B1's zero informational Docker calls and real-run failure propagation.
- The documented tier-0 selection collects exactly 174 tests. I did not rerun the full gate or the full host suite, so the historical 174-pass outcome remains recorded evidence, not my own fresh result. Neither slice changes tests/test_embedding_candidate_build.py or its subject bin/prime-claw. The watchdog's one-second intervals support timing sensitivity; unchanged scope alone does not prove a historical failure's cause.
- The image remains 606MB versus the runtime image's 5.17GB. The unchanged slim Dockerfile and permitted shared-base deferral remain consistent with accepted Slice 1.

Review boundaries: no repository edits, Git mutations, host Prime Agent/RPC probes, host plugin changes, episode/lifecycle actions, or external cleanup. Additional checks used temporary synthetic fixtures and two automatically removed, networkless test-image containers, not real Prime Agent sessions. No test container remains. Personal-brain access failed; conclusions use the exact approved packet, repository/runtime source, retained logs/artifacts, and the checks above. This report is not merge authority.