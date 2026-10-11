# Prime Claw plugin user-story traceability

Status: acceptance baseline for `prime-claw-tqm.1` (2026-10-11).

This matrix binds the outcome-level stories in this directory to observable
acceptance and current evidence. It does not make implementation mechanisms
into new requirements.

## Evidence labels

- **B — behavioral:** executes product code against temporary files, Git
  repositories, or recording fakes and asserts externally visible results.
- **I — integration:** exercises a real Prime Agent, Docker, Git/worktree, or
  Orca boundary in an isolated fixture.
- **M — manual:** retained, reproducible human-observed acceptance evidence.
- **S — static proxy:** checks shipped policy, prose, source shape, or
  registration. It protects a contract but does not prove the full user flow.

A row marked **gap** still has a named acceptance path. The gap must be closed
or explicitly accepted during `prime-claw-tqm.10`; it is not permission to
weaken the story.

## Cross-cutting decision links

| Stories | Decision records |
|---|---|
| US-01–US-02, US-27 | [DD-003: exact supported Prime Agent line](../design-decisions/DD-003-prime-agent-v098-plugin-boundary.md); [DD-005: isolated candidate validation](../design-decisions/DD-005-docker-only-plugin-candidate-validation.md) |
| US-04–US-05 | [DD-001: tracked-item Orca template review](../design-decisions/DD-001-orca-template-review.md) |
| US-14–US-16, US-23–US-24 | [DD-002: retained visible Orca Episode tab](../design-decisions/DD-002-retained-orca-episode-tab.md); [DD-004: no blind replay](../design-decisions/DD-004-no-blind-replay-after-ambiguous-mutation.md) |

## Installation and project initialization

| Story | Observable acceptance | Current evidence | Classification and gap |
|---|---|---|---|
| US-01 | An explicit isolated, sandbox, or `--user-global` target receives one complete accepted generation; bare/linked-worktree activation fails; exact check detects mixed bytes; accepted live activation remains a separate coordinated restart followed by fresh-session proof. | `tests/test_prime_agent_plugin_install.py`; `tests/container/sandbox_plugin_install_probe.py`; staging/restart/fresh-session proof in `docs/evidence/prime-claw-v2r1013-plugin-activation-20261010.md` | **B/I/M.** File mechanics are automated; coordinated restart and loaded-generation proof remain deliberate manual acceptance. |
| US-02 | Unrelated global assets remain byte-identical; drift requires an explicit decision; unsafe roots, links, and collisions fail before mutation. | `tests/test_global_asset_drift.py`; `tests/test_prime_agent_plugin_install.py` | **B.** No story gap. |
| US-03 | Command, tool, and awaited startup reconcile the declared project assets without staging or committing; a fresh supported-runtime session discovers the skills. | `tests/project_initialization_extension.test.mjs`; `tests/test_project_initialization.py::test_first_native_v098_session_discovers_initialized_skills` | **B/I.** No story gap. |
| US-04 | Untouched assets advance, customized/unknown assets remain, known legacy locations migrate safely, and independent safe assets continue when one conflicts. | `tests/project_initialization_extension.test.mjs`; `tests/test_project_initialization.py` | **B.** No story gap. |
| US-05 | After an explicit ready gate, Orca shows the tracked customized asset and temporary upstream content in a focused side-by-side diff, holds it until explicit completion/cancel, and restores exact clean bytes; terminal `git diff --no-index` is fallback only. | `tests/template_review.test.mjs`; `tests/project_initialization_extension.test.mjs` (fallback adapter); probe matrix D1 and “Review UX constraint” in `docs/evidence/2026-10-09-orca-prime-agent-integration-probes.md` | **B/M. Gaps:** automated tests fake the Orca visual surface; rerun the retained real-Orca proof when the integration changes. Current fallback code uses tracked `git diff --no-ext-diff -- <path>`, not the accepted `--no-index` contract; later implementation must align it and assert the exact Orca/fallback arguments. |
| US-06 | Awaited startup quietly no-ops when current, reports changes/conflicts/degraded registration, and does not alter active or uncertain Episode snapshots. | `tests/project_initialization_extension.test.mjs` (“awaited startup”, owner-worktree, uncertainty); `tests/test_project_initialization.py` | **B/I.** No story gap. |
| US-07 | A fresh project agent is directed to the minimum ordered orientation set and loads information architecture only when relevant. | `tests/test_project_initialization.py::test_prepare_requires_the_user_level_goals_and_heartbeats_skill`; `src/prime-agent-plugin/skills/project-templates/prepare.md` | **S. Gap:** content and installation are checked, but no retained model-run acceptance proves minimal context loading. Close with a focused fresh-session observation, not prose snapshots. |

## Specification, planning, and promotion

| Story | Observable acceptance | Current evidence | Classification and gap |
|---|---|---|---|
| US-08 | `/design` asks one material question at a time, maintains one new future `SPECIFICATION.md`, covers the bounded product contract, and stops for review without planning or implementation. | `tests/test_future_plan_skills.py` | **S. Gap:** policy structure is checked; retain one real authoring-session acceptance before final epic closure. |
| US-09 | `/spec-it-out` synthesizes existing discussion first, asks only material gaps, writes the same future specification contract, and stops without planning or implementation. | `tests/test_future_plan_skills.py` | **S. Gap:** same focused real-session acceptance need as US-08. |
| US-10 | A blocked workflow records the exact blocker/unblock condition, moves both plan artifacts together, and restores them after resolution without reconstructing state from chat. | `src/prime-agent-plugin/skills/project-templates/blocked.md`; asset coverage in `tests/test_project_initialization.py::test_asset_inventory_covers_every_shipped_markdown_source_once` | **S. Gap:** current evidence proves only that policy ships; no focused behavioral or retained manual acceptance drives block then restore. |
| US-11 | Command and tool validate one exact future folder and mechanically preflight/admit prep then exactly one planning follow-up; the workflow must then create `EXECUTION_PLAN.md` beside the specification and stop for review. | `tests/reviewed_plan_extension.test.mjs`; `tests/test_reviewed_plan_extension.py` (native RPC registration); policy checks in `tests/test_future_plan_skills.py` | **B/I/S. Gap:** mechanics and policy are covered, but no retained real-session acceptance proves produced-plan placement/content and the review stop. |
| US-12 | Missing or ambiguous folder selection is rejected mechanically; an inadequate specification must receive actionable deficiencies, create no implementation resources, and leave planning approval separate. | `tests/reviewed_plan_extension.test.mjs`; policy checks in `tests/test_future_plan_skills.py` | **B/S. Gap:** selection/approval mechanics are covered; semantic inadequacy diagnosis and the resulting no-resource stop need focused real-session acceptance. |
| US-13 | The exact bundle is reviewed immediately before promotion; approval binds session, folder, optional host, and complete digest, is consumed once, and incomplete or contradictory material creates no resources. | `tests/reviewed_plan_extension.test.mjs`; `tests/test_reviewed_plan_native_discovery.py`; readiness-policy checks in `tests/test_future_plan_skills.py` | **B/S. Gap:** binding/digest/consume-once mechanics are covered; semantic deficiency diagnosis and its no-resource stop need focused real-session acceptance. |
| US-14 | One matching Episode gets the isolated worktree, promoted/committed bundle, fresh durable exact-CWD session, retained visible writable Orca tab, one assignment, and Conversation ownership; replay returns rather than duplicates it. | `tests/spec_episode_extension.test.mjs`; `tests/test_reviewed_plan_extension.py`; probe matrix L13/S1 and “Startup, compaction, and fallback contract” in `docs/evidence/2026-10-09-orca-prime-agent-integration-probes.md` | **B/I/M. Gaps:** the real retained-tab proof is manual integration evidence; rerun it on Orca/provider-launch changes. Add negative second-inventory coverage for missing/disconnected/hidden/unwritable/identity-mismatched retention. Current post-removal code/tests do not re-read the provider-ready footer or independently re-establish terminal-to-durable-session binding, so final manual acceptance must confirm both or the contract must be narrowed explicitly. |
| US-15 | One ready local setup auto-selects; multiple require exact selection; cancel, remote, ambiguity, or failed explicit host selection creates nothing and never silently falls back. | `tests/spec_episode_extension.test.mjs`; probe matrix H1/H2 | **B/M.** No story gap while remote placement remains explicitly unsupported. |
| US-16 | Every post-mutation failure persists exact `uncertain` identities; replay does not recreate or reassign; local fallback occurs only after definitive pre-mutation local Orca unavailability. | `tests/spec_episode_extension.test.mjs`; `tests/test_reviewed_plan_native_discovery.py`; probe matrix F1 | **B/M.** No story gap. |

## Episode execution, oversight, and continuation

| Story | Observable acceptance | Current evidence | Classification and gap |
|---|---|---|---|
| US-17 | One execute pass completes one smallest end-to-end slice with code/docs/tests/Beads/plan updates, one pushed reviewable commit, exact evidence, and then stops. | `tests/test_execute_skill.py`; repeated archived Episode deliveries in `.ralph/plans/archive/` | **S/M. Gap:** policy is statically checked; final acceptance must cite one concrete completed Episode pass rather than treating prose as execution proof. |
| US-18 | A blocked pass records attempts and unblock condition and moves both artifacts; a completed pass archives both, updates indexes/Beads, and reports evidence. | `tests/test_execute_skill.py`; `src/prime-agent-plugin/skills/project-templates/blocked.md`; archived plans | **S/M. Gap:** no focused automated block/complete filesystem fixture. |
| US-19 | The exact owner verifies branch/tree/diff/tests/docs/plan/Beads/push/worktree evidence and chooses advance, recorded in-scope revision, pause, or consultation without implementing or taking operator authority. | `tests/test_oversee_episode_skill.py`; `docs/conversation-driven-episode-oversight.md` | **S. Gap:** retain one owner-supervision decision receipt during final acceptance. |
| US-20 | A fresh independent model reviews an exact candidate read-only, identifies itself, reports reproducible bounded findings, answers clarification, and is cleaned up without acquiring product authority. | `tests/test_expert_review_skill.py`; independent review records under `docs/evidence/` | **S/M. Gap:** existing reports prove independent reviews occurred, but do not retain one current receipt for the full Markdown-native `rlm.spawn` → message → bounded clarification → `delete_subagent` workflow, especially cleanup. |
| US-21 | One actual qualifying compaction gives the exact active owner one full non-turn guide; ordinary, Episode, foreign, and inactive sessions receive none. | `tests/test_conversation_oversight_native.py::test_native_actual_compaction_reinjects_one_full_nonturn_guide`; companion static tests in `tests/test_oversee_episode_skill.py` | **I/S.** No story gap. |
| US-22 | Command/tool preflight both assets, admit handoff, and queue exactly one execute follow-up; first/second send failures are reported honestly and compaction alone cannot trigger execute. | `tests/handoff_chain_extension.test.mjs`; `tests/test_handoff_chain_extension.py` (native RPC); workflow-policy assertions | **B/I/S. Gap:** admission, ordering, failures, and registration are covered; no retained native acceptance proves the actual handoff-requested compaction followed by the sole execute continuation. |
| US-23 | Only the exact owner/location/worktree/session for an idle active Episode receives one handoff then one execute; stale routes may refresh, uncertain transport is not replayed, and other dispositions are rejected. | `tests/spec_episode_extension.test.mjs`; `tests/reviewed_plan_extension.test.mjs` | **B. Gap:** transport is covered with recording fakes; cite one native owned-Episode continuation receipt at final acceptance. |
| US-24 | Exact active ownership changes only to inactive; identical replay is idempotent; mismatch/provisioning/uncertain fails; no Git/session/worktree/cleanup operation occurs. | `tests/episode_close_extension.test.mjs`; `tests/test_reviewed_plan_extension.py` | **B/S.** No story gap. |

## Work control and developer safety

| Story | Observable acceptance | Current evidence | Classification and gap |
|---|---|---|---|
| US-25 | Active work has one goal; a non-human wait has no goal and one heartbeat; a human wait or terminal state has neither; resume removes the heartbeat before a new goal. | `src/prime-agent-plugin/skills/goals-and-heartbeats/SKILL.md`; `tests/test_goal_continuation_nudge_extension.py` (bundle ownership) | **S. Gap:** this is agent operating policy; final acceptance must cite an observed active→wait→resume sequence, not infer behavior from the reminder extension. |
| US-26 | Actual compaction injects one non-turn reminder; only the configured repeated-continuation pattern appends one reminder; repeats do not duplicate; unsafe/malformed config is a no-op. | `tests/goal_continuation_nudge_extension.test.mjs`; `tests/test_goal_continuation_nudge_extension.py` | **B/S. Gap:** context-hook behavior is covered with a recording host; add or retain a native compaction observation when the hook changes materially. |
| US-27 | Candidate source stays inert; apply/check/probes run in disposable Docker or explicit scratch roots with isolated settings/sessions, no credentials/live global mutation, exact provenance, bounded cleanup, and linked-worktree activation refusal. | `tests/test_prime_agent_plugin_install.py`; `tests/test_tier1_*`; `tests/conftest.py`; `docs/testing-strategy.md`; `docs/evidence/prime-agent-v098-ts-candidate-20261010.md` | **B/I/M.** No story gap. |

## Static-proxy and manual-evidence summary

The current suite is strongest at deterministic lifecycle mechanics. The
following outcomes must not be “proved” only by source/prose assertions:

1. fresh-agent progressive orientation (US-07);
2. model-driven specification and blocked-flow behavior (US-08–US-10);
3. execute/blocked/completed workflow discipline (US-17–US-18);
4. owner supervision and native owned-Episode continuation (US-19, US-23);
5. goal/heartbeat operating discipline (US-25).

US-05 and US-14 already have retained real-Orca manual evidence, but their
visual claims are not automated. Their real acceptance should be rerun only
when the Orca diff/provider-launch boundary changes, rather than replaced with
brittle source-cardinality or prose-fragment assertions.
