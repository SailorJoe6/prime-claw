# EXPERT review — slice-1 candidate 47d2830 — BLOCK

> Reviewer: expert-reviewer-blw1-47d2830 (rlm child sub-d5400031, session 01a0f11c-4e60-73b9-a5c9-6e6d9058a688)
> Model: openai-codex/gpt-6-astra, thinking: max (admitted at spawn, handle-verified)
> Profile: .prime/agent/profiles/expert-reviewer.md (frontmatter validated)
> Exact commit: 47d28309315133821d857c38fe6eb4bcd14a8643 (episode/plugin-test-container)
> Packet: agentmsg_14120c94 | Report arrived via agent_message reply; preserved verbatim below
> Disposition (owner): BLOCK accepted — all three findings classified in-scope review-rework for slice 1

---

BLOCK — 47d28309315133821d857c38fe6eb4bcd14a8643

Three material findings. This is a Slice-1 review, not a request to implement Slices 2–3 early.

## B1 — P2, confidence 10/10: Tier-0 regression test requires a live Docker daemon

Evidence: scripts/test-tier1.sh:41–42 checks Docker and executes `docker info` before the dry-run branch at :56. tests/test_tier1_image.py:68–74 calls that branch without isolating the environment. This contradicts the file’s “no Docker required” contract and the plan’s tier-0 classification.

Read-only reproduction on this host:
`env PATH=/usr/bin:/bin PYTHONDONTWRITEBYTECODE=1 /opt/homebrew/bin/python3 -B -m pytest -p no:cacheprovider tests/test_tier1_image.py -q`
Result: **1 failed / 8 passed**; failure at :72, `error: docker not found on PATH`. With normal PATH and the running daemon: **9 passed**. With Docker available but DOCKER_HOST pointing to a nonexistent socket, `--dry-run` exits 1 with `docker daemon is not reachable`.

Impact / violated invariant: the newly added static host gate fails on the exact no-Docker environment tier 0 promises. Even the advertised print-only operation contacts Docker. This is a new regression independent of the six pre-existing probe failures.

Root-cause seam: execution-only readiness checks run before the informational command exits; the regression test inherits the reviewer/developer’s live environment, concealing this dependency.

Repair direction: keep help/dry-run independent of Docker and add negative-environment coverage that proves they make no Docker calls. Retain readiness and error propagation for real execution. This fixes the dependency without adding a harness.

Constraints / avoid: do not install/start Docker for tier 0, skip the test when Docker is missing, or remove readiness checks from actual runs.

Acceptance tests: (positive) help, dry-run, and dry-run+rebuild print the expected commands without Docker; (negative) put a recording/failing Docker substitute on PATH and prove these informational paths never invoke it; (failure) ordinary execution still fails for a missing CLI, unreachable daemon, failed build, or failed smoke and never prints OK; (replay) repeat dry-run twice with identical output and no external calls. Run the whole new test file with Docker absent and with an unreachable daemon.

Regression risk: accidentally bypassing real-run preflight, swallowing build/run failures, or changing rebuild argument handling. Dependencies: repair driver and regression coverage together; refresh the evidence results afterward.

## B2 — P2, confidence 10/10: Developer guide presents future isolation as current behavior

Evidence: DEVELOPERS.md:52–56 calls plain `pytest tests/ -q` tier 0 with no Node/prime-agent/Docker, and says plugin-dependent tests run in the container and cannot touch host state. At this commit there is no pytest tier configuration or conftest fixture. Existing tests/test_reviewed_plan_extension.py:144–167 still executes host Node; :181–226 executes the host prime-agent. scripts/test-tier1.sh:50–67 only runs toolchain version commands. The committed evidence itself records the full host suite and its hang.

Impact / violated invariant: a developer can follow a newly asserted “safe static” command and launch the same host-coupled probes this project is trying to isolate, or mistake a green smoke run for plugin-suite validation. Documentation must describe the delivered slice and preserve the approved host-probe safety boundary. Slice 3, not Slice 1, owns migration/default selection.

Root-cause seam: the intended end-state tier model was documented in the present tense before the selection and execution boundary exists. “Being rolled out” on tier 1 does not correct the explicit claim about the default command.

Repair direction: distinguish current Slice-1 smoke capability from the planned architecture. Give a clearly bounded, reviewed tier-0-only command for now, and state that unfiltered pytest still includes host-coupled tests until migration. This is a documentation repair, not permission to advance scope.

Constraints / avoid: do not implement markers or migrate probes just to make this paragraph true; do not recommend the unfiltered host suite as a safe gate; do not imply smoke validates plugins.

Acceptance checks: (positive) each current command maps to existing code; (negative) no current-command description claims default pytest is static-only or plugin tests already run in Docker; (failure) smoke failures are not described as suite results; (replay) the documented safe subset remains safe to repeat without host prime-agent. Check command selection by inspection or tier-0-only checks, not a new full host run.

Regression risk: stale transitional instructions after Slice 3. Dependencies: align this correction with B1 and the evidence’s standing host-test restriction; update the text again when migration actually lands.

## B3 — P2, confidence 9/10: Recorded failure analysis does not establish the claimed common root cause

Evidence: docs/evidence/2026-09-29-tier1-slice1-image-driver.md:49–76 labels the host plugin mismatch a “smoking gun”; the commit message says all six failures were root-caused to it and the pipe deadlock. But:
- tests/test_reviewed_plan_extension.py:215–218 and :528–531 disable automatic extensions and explicitly load this checkout’s source.
- tests/test_conversation_oversight_native.py:21–23 and :44–46 use explicit source extensions with automatic extensions disabled.
- tests/test_reviewed_plan_native_discovery.py:278/:294 and :350/:374 install this checkout into a temporary agent root and point PRIME_AGENT_CODING_AGENT_DIR there.
- The steer-lifecycle probe with the unbounded reads (:371, :393) is not among the six reported failed tests.
The host check proves a host-install mismatch exists. It does not connect that mismatch to these six failures. No per-failure assertion/error trace is recorded to establish the missing causal link.

Impact / violated invariant: the acceptance record can wrongly close investigation and suggest container placement alone will fix an installed-runtime/API or other test defect. Evidence must distinguish observation, demonstrated cause, and hypothesis.

Root-cause seam: a separate environment diagnostic and source-level hang hazards were promoted into a blanket explanation without tracing each test’s actual load path.

Repair direction: preserve the reported counts and intervention, but qualify the six causes as unresolved unless existing logs establish them. Separate the confirmed unchanged-source/additive scope fact, the observed host mismatch, and the possible pipe-blocking mechanisms. This correction is actionable from the cited source; it does not require another host investigation.

Constraints / avoid: do not rerun unsafe host probes, refresh the working host plugin, change plugin behavior, or repair existing tests in Slice 1 to support the narrative. Do not present additive-only as universal causal proof.

Acceptance checks: (positive) each asserted root cause has a specific failure trace plus the tested binary/plugin path, or is explicitly a hypothesis; (negative) temp-installed/explicit-source tests are not attributed to default host plugin files without evidence of that path; (failure) unknown causes and the operator intervention remain visible; (replay) later container runs record whether each inherited failure persists rather than assuming the boundary fixes it.

Regression risk: an overcorrection could hide the real, independently observed host mismatch or the genuine unbounded reads. Keep both observations. Dependencies: repair with B2’s current-state documentation; substantive probe repairs remain Slice 3.

## Verified scope and remaining evidence

- `git ls-remote` confirms origin/episode/plugin-test-container points to the exact reviewed commit; the tracked working tree matches it.
- Exact diff: five files, +347/-0. No plugin source, runtime Dockerfile, or run-prime-agent-probe.sh change. The new tests only run help/dry-run/invalid-argument paths, not prime-agent. This supports “no direct plugin/probe code regression”; it does not prove the six historical causes.
- Ubuntu 24.04, NodeSource 22.x, Python/pytest, no brain/OpenShell stack, single `docker run --rm`, and fail-fast shell execution match Slice 1. Shared-base deferral is consistent with the runtime’s OpenShell base and the approved escape hatch.
- Read-only Docker history corroborates the test image’s build instructions. Current `docker image ls` reports **606MB test image versus 5.17GB prime-claw-brain:0.1.0**. This supplies the omitted size comparison; the evidence’s “no runtime image built locally” statement should be updated/qualified rather than repeated. I did not rebuild or execute a container, so I did not independently re-prove clean-cache build or runtime smoke.
- Bash syntax check passed. I ran only the new nonmutating regression file with bytecode and pytest cache disabled. No live Prime Agent probes, file edits, Git mutations, lifecycle actions, or cleanup were performed.
- Personal-brain lookup returned no relevant test-container context. Findings rely on the exact approved bundle, reviewed source, and the read-only checks above.
