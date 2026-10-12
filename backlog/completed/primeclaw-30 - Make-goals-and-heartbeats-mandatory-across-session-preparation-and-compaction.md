---
id: PRIMECLAW-30
title: Make goals-and-heartbeats mandatory across session preparation and compaction
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p1
type: task
ordinal: 103000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prevent agents from missing the mandatory goals-and-heartbeats operating contract. Implement at user scope where appropriate: (1) make the prepare skill explicitly chain to /skill:goals-and-heartbeats by name and require reading it unless already present in the current context; (2) inject an immediate post-compaction reminder to read/apply that skill, using existing prime-claw compaction-hook plumbing without duplicating the full skill; (3) add a concise mandatory-reading/always-in-effect entry to the managed AGENTS.md role-kernel material, likely sourced from src/prime-agent-plugin/ROLE_KERNEL.md; (4) verify the goals-and-heartbeats skill is installed under ~/.agents by prime-claw installation and repair installer/check inventories if needed. Keep user-level policy and skills out of project-local runtime scope except for their managed source/install plumbing. Add tests for install/check, preparation chain, and post-compaction reminder behavior. This was found after repeated agents created whole-lifecycle goals, then could neither complete them honestly nor transition to heartbeats at waits.

## Legacy notes

Implemented and committed mandatory user-scope goals-and-heartbeats enforcement in commit 97ccb9f. Prepare explicitly requires /skill:goals-and-heartbeats unless already in context; ROLE_KERNEL marks it always in effect and mandatory reading; the existing goal-continuation extension injects its managed reminder immediately after session_compact without duplicating skill prose; apply/check install and byte-verify ~/.agents/skills/goals-and-heartbeats/SKILL.md in user-global mode and use an isolated contained .agents fixture for explicit-root validation. Added focused policy, compaction, install/check, unsafe-path, and documentation coverage. Validation: scripts/test-tier1.sh --probe PASS with verified teardown and evidence at .test-results/20261010T205144Z-20164-3d740cfd/tier1; focused tier-0 6 passed; Docker-focused run 4 passed and reached successful real --user-global apply plus exact ~/.agents skill cmp (the apply command's built-in user-global check passed) before exposing/fixing a pre-existing host-vs-container test-fixture bug. A later retry was blocked before plugin setup by an external pinned Prime Agent installer failure; no product assertion failed in that retry. bash -n, py_compile, and git diff --check passed. Bead intentionally remains in_progress per operator instruction; not closed, merged, or pushed.

Integrated into current main as 6638c12, preserving landed h6w.33.3 lifecycle documentation and corrected container fixture behavior. Independent GPT-6 Astra review found one P2 install-boundary bypass: the unused PRIME_CLAW_USER_AGENTS_ROOT override could redirect explicit-root writes into real ~/.agents or let --user-global verify elsewhere. Removed that authority in e5dd25f: user-global now derives exactly $HOME/.agents and explicit-root exactly <destination_root>/.agents. Added regressions proving both attempted redirects are ignored. Final exact-tree validation: Node 106/106; host 661 passed, 1 skipped, 75 subtests; Linux container 62 passed, 2 skipped; pinned Prime Agent 0.9.8 Tier-1 offline apply/check/RPC passed with network absent and clean teardown at `.test-results/20261010T213740Z-67454-3f04680a/tier1`; redirect tests 2/2; syntax and diff checks passed. Astra re-reviewed e5dd25f and returned PASS with no remaining in-contract blockers.
<!-- SECTION:DESCRIPTION:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Integrated mandatory goals-and-heartbeats enforcement; e5dd25f independently reviewed PASS and fully validated
<!-- SECTION:FINAL_SUMMARY:END -->
