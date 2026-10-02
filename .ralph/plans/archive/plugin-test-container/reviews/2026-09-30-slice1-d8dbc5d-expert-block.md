# EXPERT review — slice-1 rework candidate d8dbc5d — BLOCK (1 finding remains; B1/B2 resolved)

> Reviewer: expert-reviewer-blw1-d8dbc5d (rlm child sub-9f31b642, session 01a0f139-2bb4-762e-bba5-c3c03862cec3)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter re-validated)
> Exact commit: d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75 (episode/plugin-test-container)
> Packet: agentmsg_ef3f8d51 | Report arrived via agent_message reply; preserved verbatim below
> Operational note: review interrupted ~7h by a harness model-stream stall (operator-nudged; reviewer evidence verified intact). See prime-claw-blw ledger.
> Disposition (owner): BLOCK accepted — B3-R classified in-scope slice-1 documentation-only review-rework

---

BLOCK — d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75

One material finding remains: B3 is only partially repaired. B1 and B2 are resolved. This is a Slice-1 review; no Slice-2/3 implementation is required to address the finding.

## B3-R — P2, confidence 10/10: The evidence still presents additive scope as demonstrated causal exclusion

**Evidence:** docs/evidence/2026-09-29-tier1-slice1-image-driver.md:115–118 labels this “Demonstrated”: “The Slice-1 diff cannot be the cause of the 6 failures … (demonstrated by the additive-only git status above).” The accepted B3 report explicitly prohibited presenting additive-only scope as universal causal proof. The diff establishes no direct changes to the existing plugin/probe code; it does not establish the causes of six historical failures or experimentally exclude every indirect effect. No per-failure trace or comparison supporting that categorical conclusion appears in the note.

The separation into Observations / Demonstrated / Hypotheses is useful, and :134–138 correctly qualifies the host-generation explanation. However, that qualification does not cure the contradictory absolute under Demonstrated. The statement at :144–147 that both failures and hang belong to a class tier 1 “eliminates by construction” should also remain an explicitly unresolved hypothesis, not a promised outcome of moving the tests. Filesystem/process isolation does not itself repair the unbounded reads documented at :125–130.

**Impact / violated invariant:** The acceptance record still overstates what was proved. A later slice can treat an unresolved failure as already excluded or cured rather than compare its actual outcome. This violates the accepted B3 evidence contract: observations, source-scope facts, demonstrated causes, and hypotheses must remain distinct.

**Root-cause seam:** A valid source-diff observation is still promoted into a blanket causal conclusion during evidence summarization. Adding category headings did not narrow the underlying assertion.

**Recommended repair direction and rationale:** Make this a documentation-only correction. Preserve the strong, verified fact that neither Slice-1 commit changes the existing plugin/probe code, but bound the conclusion to that fact. Leave the six per-test causes unresolved unless already-retained failure traces establish them. Distinguish preventing host contamination from fixing test/runtime defects. That provides an honest baseline for Slice 3 without reopening host investigation.

**Constraints / approaches to avoid:** Do not rerun host probes, refresh the host plugin, change plugin behavior, repair existing probe code, or add migration machinery to justify the narrative. Do not erase the observed host mismatch, six failures, owner intervention, or genuine unbounded-read hazards. Do not infer default-host plugin loading from an installed/native test name: all six cited tests use explicit repo extensions or a temporary plugin installation (reviewed-plan-extension :215–218/:528–531; oversight-native :21–23/:44–46; native-discovery :278/:294/:350/:374).

**Concrete acceptance checks:**
- Positive: each demonstrated statement has evidence of the same scope; unchanged source is documented as unchanged source. Each asserted cause has a specific failure trace and tested load path, or is clearly unresolved/hypothetical.
- Negative: no “cannot be caused” conclusion rests solely on additive scope; no default-host-generation attribution contradicts explicit-source/temp-install paths; no claim that container placement itself cures unbounded reads.
- Failure: preserve 6 failed / 307 passed, the operator intervention, and unknown causes when diagnostic evidence is absent.
- Replay: when the authorized container migration runs later, record whether each inherited failure persists. Do not assume that isolation fixes it. No new host replay is needed for this documentation repair.

**Regression risks:** Overcorrecting could conceal the real host mismatch or pipe hazards. Preserve them as observations/mechanisms, not established common causes. **Dependencies:** Repair the Demonstrated conclusion and nearby container-cure language together in this evidence note. B1/B2 code and documentation need no further functional change. No product decision or scope expansion is needed.

## Verified repairs and complete Slice-1 scope

- **Exact candidate:** HEAD and remote refs/heads/episode/plugin-test-container both equal d8dbc5db96a6ddafbbaa61e2f450da7c6a62bf75. Tracked working tree is clean. I read git show for both commits. Repair diff 47d2830..d8dbc5d changes only scripts/test-tier1.sh, tests/test_tier1_image.py, DEVELOPERS.md, and the evidence note. The combined candidate adds docker/test.Dockerfile and changes no other implementation files.
- **B1 resolved:** Help exits at scripts/test-tier1.sh:34; dry-run exits at :60; Docker readiness starts only at :65–66. Real build/run remain under set -euo pipefail, and OK follows successful smoke. The new recording/failing-Docker tests prove zero informational invocations, failure-stage short-circuiting, nonzero failures, and no OK on missing CLI/daemon/build/smoke failure.
- **Independent test results:** tests/test_tier1_image.py passed 17/17 with normal PATH, 17/17 with PATH=/usr/bin:/bin and an absolute Python interpreter, and 17/17 with DOCKER_HOST set to a nonexistent socket. Bytecode and pytest cache writes were disabled. Bash syntax passed. Two no-Docker --dry-run --rebuild executions both exited 0 with identical output and the expected --no-cache command. No tests were rerun after the infrastructure interruption.
- **B2 resolved:** DEVELOPERS.md:40–59 warns that unfiltered pytest still includes host probes and supplies file-level exclusions. I inspected all 11 selected files: they are static checks, mocked-boundary tests, synthetic watchdog processes, the Python-only wrapper test, and the new driver tests. They do not launch host Node/Prime Agent/plugin installation. The note correctly limits smoke to toolchain versions (:78–80). No markers, conftest, .env selector, test-all driver, or test migration was added. I checked the claimed gate by inspection rather than running the full host suite.
- **Image/driver:** Ubuntu 24.04, NodeSource 22.x, Python/pytest, no installed Postgres/gbrain/OpenShell stack; one docker run --rm; no host mounts or Prime Agent execution. Read-only Docker history matches the Dockerfile. BuildKit history independently records the test.Dockerfile build completed on 2026-09-30 06:21:02Z with 9/9 steps and 0 cached steps (ref 0b6ilyiui75ai65strs6wciac). The evidence records node v22.23.3 and successful smoke; I did not launch a new container.
- **B3 size correction resolved:** Current read-only docker image ls confirms 606MB for prime-claw-test-tier1:latest versus 5.17GB for prime-claw-brain:0.1.0.
- **Shared-base escape hatch:** The unchanged runtime Dockerfile derives from the OpenShell sandbox base and installs no Node. Deferring extraction avoids changing runtime behavior. Read-only Beads inspection confirms follow-up prime-claw-blw.4 exists and slice bead .1 has the accepted rework recorded.
- **Watchdog flake plausibility:** Neither commit touches tests/test_embedding_candidate_build.py or its subject bin/prime-claw. The named test uses one-second stall/poll/grace intervals and a two-second process-disappearance check (:139–183); timing sensitivity is plausible. This supports “unchanged code / plausible timing flake,” not independent proof of the historical cause.
- **Boundary:** No Slice-2/3 implementation, plugin source change, runtime Dockerfile change, or run-prime-agent-probe.sh change is present. The evidence retains the historical, pre-restriction full-suite run; the repair records tier-0 checks only. Git alone cannot certify which commands were historically executed. This review ran no live Prime Agent probes, builds, containers, host-plugin apply/check, edits, lifecycle actions, or cleanup.
- Personal-brain keyword/hybrid lookup found no relevant test-container context. Findings rely on the approved bundle, exact source, accepted prior report, and the checks above.
