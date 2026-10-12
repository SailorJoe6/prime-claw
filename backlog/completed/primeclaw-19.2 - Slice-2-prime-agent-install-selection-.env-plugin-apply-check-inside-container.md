---
id: PRIMECLAW-19.2
title: >-
  Slice 2: prime-agent install selection (.env) + plugin apply/check inside
  container
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-19
priority: p1
type: task
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
.env.example + ignored .env selecting pinned npm release vs fork source checkout (packed on host, tarball installed in container). Container start installs prime-agent, bind-mounts src/prime-agent-plugin read-only, runs apply + check scripts against container-global ~/.prime/agent. Acceptance: check green inside container; RPC probe loads plugin commands from container prime-agent.
<!-- SECTION:DESCRIPTION:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
SLICE 2 SCOPE (operator-approved 2026-09-30 after slice-1 EXPERT PASS on 2666843; report at .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice1-2666843-expert-pass.md in the main repo).

BEFORE STARTING: check whether main has advanced past the branch point (the goal/heartbeat plugin work, beads h6w.24 area, landed on main while slice 1 was in flight). If so, rebase the episode branch onto current main FIRST and re-run the slice-1 tier-0 gate to confirm green after the rebase. Record the rebase in the evidence note.

DELIVER per .ralph/plans/EXECUTION_PLAN.md:
- .env.example (committed) + ignored .env selecting EXACTLY ONE of PRIME_AGENT_PINNED=<version> (npm registry install) or PRIME_AGENT_SOURCE=<abs path to fork checkout> (host runs the fork's release:pack to produce a tarball; tarball staged into container and installed). Driver FAILS FAST on neither/both selectors.
- Extend scripts/test-tier1.sh so container start installs prime-agent per .env, bind-mounts src/prime-agent-plugin/ READ-ONLY, and runs scripts/apply-prime-agent-plugin.sh then check-prime-agent-plugin.sh INSIDE the container against the container's real ~/.prime/agent/.

ACCEPTANCE EVIDENCE per the plan:
- container prime-agent --version matches the fork in source mode
- apply/check green inside the container
- a container-side RPC probe loading the plugin's native commands (proving the previously host-dangerous probe is safe in-container)
- host $HOME/.prime/agent untouched (before/after checksum recorded in the evidence note)
- tier-0 regression tests for the new driver behavior (tests/test_tier1_driver.py per the plan)

CONSTRAINTS: no slice-3 work (no pytest markers/conftest/test migration/test-all sequencer); no plugin source changes; host gates run the tier-0 subset only per the standing instruction (skip live RPC probes); network only at image build and the container's prime-agent install step.

Close blw.2 with evidence when done; commit+push; report the new exact commit hash(es) to owner sibling 01a0f0d6-b639-74be-ab78-a58b058236c7.
---

author: Joe Landers
created: 2026-10-12 01:02
---
COMPLETE at commit 470be98 (pushed, on the rebased branch — slice-1 reviewed 2666843 is now content-identical b2f6b86 atop main 1a0836d). All acceptance evidence in docs/evidence/2026-09-30-tier1-slice2-install-selection.md: source mode (fork a1faacd53 v0.9.8): release:pack 4 tarballs, container npm install via file: URLs, prime-agent --version 0.9.8, apply+check green in-container, RPC get_commands probe loaded handoff/plan/implement-spec from /root/.prime/agent/extensions/ (previously host-dangerous probe safe in-container, under timeout 60). Pinned mode (0.9.3): vendor install.sh fetched+verified from R2, --version 0.9.3, apply+check green. Host ~/.prime/agent managed-file checksums identical before/after both runs. Tier-0 gate 174 passed. Plan correction recorded: prime-agent is not on the public npm registry (E404); pinned mode uses the vendor installer like bin/prime-claw.
---

author: Joe Landers
created: 2026-10-12 01:02
---
REWORK (EXPERT BLOCK on 470be98 accepted 2026-09-30). Full report: .ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice2-470be98-expert-block.md (main repo). Repair exactly three findings against slice-2 artifacts ONLY (scripts/test-tier1.sh, tests/test_tier1_driver.py, docs/evidence/2026-09-30-tier1-slice2-install-selection.md):

B1 — source mode must not silently test stale compiled code: every real source-mode run must pack FRESH artifacts representing the selected checkout (a plain fresh build before packing fits the dumb-driver design; or fail closed when freshness cannot be established). Do NOT use version equality, directory existence, or --rebuild as freshness proof. Acceptance: source changed without version change -> next run packages the changed implementation (cover removed/renamed outputs); compilation/pack failure stops before container install, nonzero, never OK, never falls back to previous artifacts; source --dry-run still performs no build/pack/docker call. Also record the accepted artifacts SHA256 hashes durably with the refreshed evidence (fork release/tier1/artifacts/SHA256SUMS exists; plan "Fork pack reproducibility" contract requires the exact pack command + output hash).

B2 — --probe must PROVE the plugin loaded: validate the matching get_commands RPC reply (success true AND handoff, plan, implement-spec each present exactly once AND sourced from the container's installed extension paths) before declaring success. Negative cases (missing reply, malformed JSON, success:false, empty/partial/duplicate command lists, wrong source paths) fail nonzero with no final OK; unrelated async JSONL events must not be accepted as the reply. Small container-side check, no new harness; do not grep arbitrary stdout or infer load success from apply/check.

B3 — probe deadline must be HARD: finite forced-kill escalation (e.g. timeout --kill-after) so a TERM-ignoring probe process tree terminates within deadline + small fixed grace, container command exits nonzero, --rm completes. Coordinate with B2 so semantic validation adds no blocking read (slice-1 pipe-deadlock lesson). Acceptance: TERM-ignoring child + descendant holding output open terminates within deadline+grace, nonzero, no OK; no owned container or probe process remains after each run; scale test deadlines down in tests (not 60s).

Also sweep plan wording debt: remaining "pinned-registry path"/"registry install" phrases in EXECUTION_PLAN.md follow the vendor-installer correction.

Constraints: slice-2 artifacts only; no slice-3 work; no plugin source changes; no host probe reruns; host gates tier-0 subset only; no new supervisor framework; do not repair/migrate the unrelated historical host probes. Refresh the slice-2 evidence note after repair (incl. artifact hashes). Commit+push; report new exact commit hash to owner. The 470be98 review is invalidated; fresh EXPERT gate follows on the new commit.
---

author: Joe Landers
created: 2026-10-12 01:02
---
REWORK COMPLETE at bc00cba (pushed). B1: unconditional fresh fork build after removing the four pack-consumed dist dirs; fail-fast ladder reordered (staging before image build); replay acceptance covered by tier-0 tests (same-version source change -> changed artifacts packed; stale outputs removed; build/pack failures stop at the readiness probe, no OK, no fallback). B2: probe reply validated semantically in-container by an embedded stdlib Python validator (13-case fixture matrix on the host runs the exact shipped heredoc). B3: timeout --kill-after group-KILL deadline (60s+5s defaults, env-scalable); demonstrated in the real networkless image with the exact generated probe step: TERM-ignoring tree + descendant holding output open KILLed (exit 137) within deadline+grace, rc=1, no OK, no leftover containers; positive control rc=0. Artifact SHA256SUMS + exact pack command recorded in the refreshed evidence note. Host untouched across all rework runs. Tier-0 gate 194 passed. Fresh EXPERT gate applies to bc00cba.
---

author: Joe Landers
created: 2026-10-12 01:02
---
ACCEPTED 2026-09-30: fresh EXPERT gate PASS on exact commit bc00cba (rework). Report: /Users/jlanders/code/prime-claw/.ralph/plans/future/plugin-test-container/reviews/2026-09-30-slice2-bc00cba-expert-pass.md. Slice 2 final.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Closed
<!-- SECTION:FINAL_SUMMARY:END -->
