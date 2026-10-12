---
id: PRIMECLAW-28.1
title: Document fork-source-only Prime Agent installation
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
parent_task_id: PRIMECLAW-28
priority: p1
type: task
ordinal: 102000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Leadership established that Prime Claw's only supported Prime Agent installation path is a Docker-only source build from the maintained `SailorJoe6/prime-agent` fork at `cwd-fix-v0.9.8-r1`. Existing documentation must not suggest the mutable public installer, native artifacts, global npm, or version-only identity checks.

## Scope
Update tracked Prime Claw documentation, examples, and operator guidance with the exact fork/tag/commit/tree/lockfile provenance contract; TypeScript source-launch requirements; explicit unsupported paths; Docker-only isolation; and the v0.10+ maintenance-only/no-install boundary. Reconcile all contradictory references. Do not change runtime, build implementation, user-global state, or active sandbox.

## Legacy notes

OWNERSHIP (Joe, 2026-10-10): `prime-claw implementation` is primary owner for Prime Claw code/docs/build/container/runtime/incident/recovery work. This supervising conversation watches upstream threads and reports movement to Joe. `Prime Agent Expert` owns Prime Agent source/downstream fixes/releases/artifact contracts. Route implementation accordingly.
2026-10-10 docs/fork-source-install isolated worktree /Users/jlanders/code/prime-claw-docs-fork-source-install committed/pushed d7d682f10e62b1585c02fbd704ac8944c3bcd211; new docs/prime-agent-installation.md plus README, DEVELOPERS, .env.example, docs/README, docs/testing-strategy, docs/lab-global-plugin, config/requirements-inventory. Records authoritative downstream TS tag/object/commit/tree/lock/source launcher/TSX/kernel prewarm, Docker-only supported path, Rust/public installer/npm/dist unsupported, v0.10 not adopted; no active v2 claim. 4 inventory tests pass, 39 markdown links resolved, 72 requirements JSON parsed, diff check clean. Branch not merged; parent will reconcile with final implementation, request operator merge decision, and close only after landed verified docs.
2026-10-10 fork-source installation docs commit d7d682f cherry-picked as 84e3058 into integrated isolated candidate branch fix/prime-agent-v098-image-candidate. Docs are not in primary main yet, and parent lph remains pending active-v2 recovery/cutover. Combined suite initially exposed .env.example loss of the tier-1 static “exactly one” phrase; isolated integration fix restores that constraint without allowing PRIME_AGENT_PINNED as supported candidate, and final 718 tests passed. This Bead remains open until operator-authorized landing and verified docs on main.
2026-10-10: fork-source-only install/build docs are merged on primary main c3938fe and pushed candidate branch 6dd2ece. Exact annotated tag object, commit, tree, lockfile, TypeScript source launcher and immutable image identity; Rust/native/npm mutable installers and v0.10+ remain unsupported. See docs/prime-agent-installation.md, docs/runbook.md and docs/evidence/prime-agent-v098-v2-active-acceptance-20261010.md. Merged-tree full host-safe suite 724 passed/65 skipped/75 subtests; git diff --check passed.
Correction: pre-push git pull --rebase linearized the candidate commits; primary main source recovery commit is a4850c0f8d090713acdc5ac909137f78e1d7ab8a, not the historical unpushed merge c3938fe. Final primary evidence commit 82aae26 was pushed; tracked tree and 724-pass test result were unchanged by rebase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All operator-facing install/build docs consistently name the fork-source route as the only supported path; exact provenance and verification commands are documented; unsupported installer/native/npm routes and version collision are explicit; v0.10+ no-install policy is explicit; links and `git diff --check` pass; changes are committed and pushed under repository policy.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fork-source-only documentation and provenance contract committed, tested, and pushed on primary main; active v2 recovery evidence linked.
<!-- SECTION:FINAL_SUMMARY:END -->
