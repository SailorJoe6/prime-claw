---
id: PRIMECLAW-21
title: Guard user-global plugin install and enforce Docker-only development tests
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
updated_date: '2026-10-12 01:02'
labels: []
dependencies: []
references:
  - PRIMECLAW-10.30
priority: p1
type: bug
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prevent unmerged prime-claw plugin development from mutating the operator's shared ~/.prime/agent generation. Root cause confirmed 2026-10-02: AGENTS.md still mandated bare host apply/check while DEVELOPERS.md and the completed tier-1 design require all plugin/Prime Agent tests inside Docker. The zero-argument installer silently targets ~/.prime/agent, allowing a linked episode worktree to install mechanics globally while matching .ralph skills remain worktree-local. This blocked compaction-first Slice 1 after breaking /plan in a concurrent main session.

Implement repository-wide deployment/test guardrails separately from compaction behavior: align AGENTS/docs on Docker-only pre-merge testing; require an explicit isolated PRIME_AGENT_PLUGIN_ROOT or explicit --user-global activation; refuse user-global activation from linked worktrees; update tier-1 driver/fixture to pass an explicit container destination; add zero-mutation and incident-topology regression tests. Preserve project-local prompt ownership and fail-closed missing-skill behavior. Land on main before accepting prime-claw-h6w.26.

## Legacy notes

Independent audit details (2026-10-02) — sufficient handoff packet:

CONFIRMED ROOT CAUSE / FILE EVIDENCE
- AGENTS.md:49-58 mandates bare host `scripts/apply-prime-agent-plugin.sh` + `scripts/check-prime-agent-plugin.sh` and a builder-rooted probe after every plugin change.
- DEVELOPERS.md:57-66 requires anything needing Node/Prime Agent/plugin to run inside Docker tier 1 so tests can never touch host `~/.prime/agent`. AGENTS is stale and stronger, so the episode followed the unsafe instruction.
- scripts/apply-prime-agent-plugin.sh:4-6 silently defaults `destination_root` to `$HOME/.prime/agent`; apply copies there and invokes check. check has matching implicit-root semantics. No explicit shared-install flag, linked-worktree refusal, provenance check, or confirmation.
- scripts/test-tier1.sh applies/checks inside the ephemeral container; tests/conftest.py container fixture implements the same isolation. This is the required development path.
- Plain `pytest -q tests` intentionally skips container tests; the failed candidate recorded 275 passed / 144 skipped. It therefore did not run the migrated plugin acceptance gate.
- Existing install tests redirect PRIME_AGENT_PLUGIN_ROOT to scratch and do not test safety of the implicit user-global default.
- Candidate startup probe only checked get_commands registration. It could not detect project-local `plan-prep` skew; its behavioral probe ran from the episode cwd where the skill existed.
- Full read-only audit report: /Users/jlanders/.prime/agent/session-artifacts/01a0fdbc-eaa1-75cb-a44b-86787dfeb048/plugin-test-guardrail-investigation.md

REQUIRED DESIGN
1. Pre-merge/plugin-development tests run ONLY in Docker tier 1 (`scripts/test-tier1.sh --probe`, `pytest -m container`, unified test entry). Never host/user-global apply/check/probes.
2. Bare apply/check must not mutate or validate `~/.prime/agent`. Require either an explicit isolated `PRIME_AGENT_PLUGIN_ROOT` or a conspicuous explicit `--user-global` activation mode.
3. Reject `--user-global` from a linked Git worktree. User-global activation is deliberate post-acceptance/post-merge work from primary main after matching project-local `.ralph/skills` files land.
4. Tier 1 passes an explicit container destination and preserves true target behavior inside the ephemeral container. Apply forwards selected destination/mode to final check.
5. Preserve prompt ownership and fail-closed missing-skill behavior. Do not copy prompts globally and do not add a TypeScript fallback.

REQUIRED REGRESSIONS / ACCEPTANCE
- Bare apply and bare check fail clearly and cause zero destination mutation.
- Explicit isolated root applies/checks byte-identically.
- Synthetic linked worktree cannot target user-global and causes zero mutation.
- Explicit primary-main user-global path is exercised only inside Docker.
- Driver/fixture static tests prove explicit container destination and no host HOME inheritance.
- Incident topology test: candidate checkout has new local skill, sibling checkout lacks it; candidate shared activation is blocked, isolated/container activation works, sibling installed checksum stays unchanged.
- Container behavioral `/plan` probe from `/workspace` proves exactly one prep + one plan; missing-skill fixture still proves designed fail-closed warning.
- Run `pytest -q tests -m container` and `scripts/test-all.sh`; record before/after host managed-file checksums externally, without tests touching the real host root.

CURRENT STATE / DEPENDENCY
- Global plugin was restored from main and stale global prep-chain removed; apply/check passed. Loaded sessions need restart.
- Compaction episode 01a0fe1c-da17-7265-aee6-e6f82e8b5bf1 is paused at pushed candidate ef9c401; Slice 1 unaccepted, Slice 2 unstarted. This bead must land on main before rebasing/revalidating that candidate in Docker only.

Implemented on main as 672be3b (exact clean candidate validated before push).

Root cause fixed: zero-argument apply/check no longer select ~/.prime/agent; both share fail-closed target selection. Explicit isolated roots remain supported. --user-global is conspicuous, primary-main-only, rejects linked worktrees, and apply forwards identical target semantics to final check. Tier-1 driver/fixture explicitly pass /root/.prime/agent inside Docker. Prompt policy remains project-local and missing skills remain fail-closed; no compaction behavior changed.

Regression evidence:
- pre-fix tier-0 driver/fixture assertions: 2 failed as expected (no explicit container target)
- focused tier-0 driver/fixture: 85 passed
- focused Docker plugin install/topology: 20 passed, 1 deselected
- exact commit 672be3b, clean detached checkout: pytest tests/ -q -m container => 40 passed, 382 deselected, 11 warnings (156.83s)
- exact commit 672be3b: scripts/test-tier1.sh --probe => PASS; explicit-root apply/check and semantic handoff/plan/implement-spec discovery passed
- exact commit 672be3b: scripts/test-all.sh => tier0 PASS (29s), tier1 PASS (144s), tier2 intentionally skipped
- initial pinned 0.9.8 Docker attempt exposed separately tracked prime-claw-blw.5 PATH failure; all final Docker gates used the documented PRIME_AGENT_SOURCE selector. No host/user-global apply, check, probe, or ~/.prime/agent access occurred.

Operator-owned src/prime-agent-plugin/APPEND_SYSTEM.md and sibling-owned project-wide-testing plan edits were excluded and preserved. Temporary detached validation worktree was removed.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bare apply/check cannot mutate ~/.prime/agent; isolated explicit root succeeds; linked worktree cannot activate user-global; explicit primary-main user-global activation is tested only inside Docker; tier-1 driver and fixture pass explicit container destination; incident topology regression proves sibling checkout remains unchanged; AGENTS.md and DEVELOPERS.md agree; container gates pass.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Completed in 672be3b; clean Docker tier-1 and test-all gates passed.
<!-- SECTION:FINAL_SUMMARY:END -->
