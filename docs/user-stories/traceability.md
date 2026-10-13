# Prime Claw plugin user-story traceability

Status: acceptance baseline for `PRIMECLAW-33.1` (2026-10-11).

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

A row marked **gap** describes the limit of current evidence. It does not create
a new implementation or UAT requirement. Existing accepted dogfood may remain
the evidence for unchanged behavior; rerun acceptance only when related behavior
changes or the operator asks for it.

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
| US-05 | The operator receives an in-product focused Orca side-by-side comparison of the customized asset and new upstream version. A clean asset uses the temporary-overwrite Orca path and is restored exactly. An already-dirty asset remains untouched and uses native Git diff. If Orca fails on a clean asset, the original is restored before native Git diff. Neither fallback explicitly disables the user’s configured diff experience. | `tests/template_review.test.mjs`; `tests/project_initialization_extension.test.mjs`; probe matrix D1 and “Review UX constraint” in `docs/evidence/2026-10-09-orca-prime-agent-integration-probes.md`; [DD-001](../design-decisions/DD-001-orca-template-review.md) | **B/M. Implementation gap:** current code rejects dirty assets and its clean-file Orca-failure path passes `--no-ext-diff` before restoration. The retained real-Orca probe proves the required side-by-side UX; both graceful fallback paths must be aligned. |
| US-06 | Awaited startup quietly no-ops when current, reports changes/conflicts/degraded registration, and does not alter active or uncertain Episode snapshots. | `tests/project_initialization_extension.test.mjs` (“awaited startup”, owner-worktree, uncertainty); `tests/test_project_initialization.py` | **B/I.** No story gap. |
| US-07 | A fresh project agent progressively discovers the repository's applicable instructions, overview, development guidance, documentation map, and native tracker/build/test commands without requiring absent conventional files or bulk-loading context. | `tests/test_project_initialization.py::test_prepare_is_repository_generic_progressive_discovery`; `src/prime-agent-plugin/skills/project-templates/prepare.md` | **S. Gap:** generic content and installation are checked, but no retained model-run acceptance proves minimal context loading. |

## Specification, planning, and promotion

| Story | Observable acceptance | Current evidence | Classification and gap |
|---|---|---|---|
| US-08 | `/design` asks one material question at a time, creates one explicit `In Design` task or revises one exact selected `In Design` task, stores the bounded contract in supported fields, commits only that task, and stops for review without planning or implementation. | CLI/Git substrate plus policy checks in `tests/test_future_plan_skills.py`; asset reconciliation coverage in `tests/test_project_initialization.py` | **B/S. Gap:** the disposable fixture proves supported create/revise fields, exact task-only commits, and non-gating push failure; no retained real authoring-session receipt proves semantic authoring and later-state rejection. |
| US-09 | `/spec-it-out` synthesizes existing discussion first, asks only material gaps, and uses the same exact-task Backlog specification contract and review stop. | `tests/test_future_plan_skills.py`; asset reconciliation coverage in `tests/test_project_initialization.py` | **S. Gap:** as with US-08, no retained real-session receipt is indexed here. |
| US-10 | A blocked workflow records the exact blocker/unblock condition, moves both plan artifacts together, and restores them after resolution without reconstructing state from chat. | `src/prime-agent-plugin/skills/project-templates/blocked.md`; asset coverage in `tests/test_project_initialization.py::test_asset_inventory_covers_every_shipped_markdown_source_once` | **S. Gap:** current evidence proves only that policy ships; no focused behavioral or retained manual acceptance drives block then restore. |
| US-11 | Task-native command and tool resolve one exact `In Design` or `In Planning` task, bind its canonical ID, and mechanically admit prep then exactly one planning follow-up; the workflow must write the native Implementation Plan, move or retain `In Planning`, commit only the task, and stop for review. The exact-folder surface remains live during migration. | `tests/reviewed_plan_extension.test.mjs`; `tests/test_reviewed_plan_extension.py` (native RPC registration); policy checks in `tests/test_future_plan_skills.py` | **B/I/S. Gap:** mechanics and policy are covered, but no retained real-session acceptance proves the task mutation, task-only commit/push handling, and review stop. |
| US-12 | Missing, unresolved, or disallowed-state task selection is rejected mechanically before admission; an inadequate specification must receive actionable deficiencies, create no implementation resources, and leave planning approval separate. Exact-folder rejection remains covered during migration. | `tests/reviewed_plan_extension.test.mjs`; policy checks in `tests/test_future_plan_skills.py` | **B/S. Gap:** selection/status/approval mechanics are covered; no focused real-session receipt for semantic inadequacy diagnosis is indexed here. |
| US-13 | Retained-folder approval binds session, folder, optional host, and digest. The staged task-native chain binds owner session, canonical task ID/path and project root, and preselected exact placement across compact-first preparation; both are single-use and phase-bounded, and full oversight guidance precedes semantic readiness. | `tests/reviewed_plan_extension.test.mjs`; `tests/test_reviewed_plan_native_discovery.py`; readiness-policy checks in `tests/test_future_plan_skills.py` | **B/S. Gap:** deterministic binding and consume/clear mechanics are covered; public task admission and a focused real-session semantic-deficiency receipt remain pending. |
| US-14 | One matching Episode gets the isolated worktree, promoted/committed bundle, fresh durable exact-CWD session, retained visible writable Orca tab, one assignment, and Conversation ownership; replay returns rather than duplicates it. | `tests/spec_episode_extension.test.mjs`; `tests/test_reviewed_plan_extension.py`; probe matrix L13/S1 and “Startup, compaction, and fallback contract” in `docs/evidence/2026-10-09-orca-prime-agent-integration-probes.md` | **B/I/M.** Current code checks that the same tab remains visible, connected, and writable after the temporary launcher is removed; the retained real-Orca probe confirms the user experience. Rerun it only if provider launch changes. |
| US-15 | One ready local setup auto-selects; multiple require exact selection; cancel, zero-ready, remote, ambiguity, or failed explicit host selection creates nothing and never silently falls back. Task-native placement is resolved before its compact-first workflow is queued. | `tests/spec_episode_extension.test.mjs`; `tests/task_episode_admission_extension.test.mjs`; probe matrix H1/H2 | **B/M.** Public task admission remains inactive; retained placement has no story gap while remote placement is unsupported. |
| US-16 | Every post-mutation failure persists exact `uncertain` identities; replay does not recreate or reassign; retained local fallback occurs only after definitive pre-mutation local Orca unavailability. The staged task chain is stricter: it selects fallback only for an absent production Orca command, rejects explicit-host fallback, and propagates malformed or negative inventory. | `tests/spec_episode_extension.test.mjs`; `tests/task_episode_admission_extension.test.mjs`; `tests/test_reviewed_plan_native_discovery.py`; probe matrix F1 | **B/M.** Public task admission remains inactive; retained recovery has no story gap. |

## Episode execution, oversight, and continuation

| Story | Observable acceptance | Current evidence | Classification and gap |
|---|---|---|---|
| US-17 | One execute pass completes one smallest end-to-end slice. A task-bound Episode edits only its exact Backlog task content in its own worktree and leaves lifecycle status to the Conversation; retained folder Episodes keep their plan workflow. | `tests/test_execute_skill.py` (task identity/status CLI fixture and static policy); repeated archived Episode deliveries in `.ralph/plans/archive/` | **S/M. Gap:** task-native policy and supported CLI semantics are proven, but public task admission and retained real-session execution evidence remain pending. |
| US-18 | Task-native blockers and candidate evidence remain in the exact task while status stays unchanged; retained folder mode preserves blocked/archive behavior. | `tests/test_execute_skill.py`; `src/prime-agent-plugin/skills/project-templates/blocked.md`; archived plans | **S/M. Gap:** task-native blocked/resume Conversation publication and real-session completion remain pending. |
| US-19 | The exact owner selects authority from ownership: version 2 binds one exact Backlog task ID/path and never consults or copies `.ralph/plans`, while version 1 retains its approved folder. It verifies branch/tree/diff/tests/docs/authority/push/worktree evidence and chooses advance, in-scope revision, pause, or consultation without implementing or taking operator authority. | `tests/test_oversee_episode_skill.py`; `docs/conversation-driven-episode-oversight.md` | **S. Gap:** no single task-native owner-supervision receipt is indexed here. |
| US-20 | A fresh independent model reviews an exact candidate read-only against the same disjoint task-or-folder authority, identifies itself, reports reproducible bounded findings, answers clarification, and is cleaned up without acquiring product authority. | `tests/test_expert_review_skill.py`; independent review records under `docs/evidence/` | **S/M. Gap:** existing reports prove independent reviews occurred, but do not retain one current task-native receipt for the full Markdown-native `rlm.spawn` → message → bounded clarification → `delete_subagent` workflow, especially cleanup. |
| US-21 | One actual qualifying compaction gives the exact active owner one full non-turn guide; ordinary, Episode, foreign, and inactive sessions receive none. | `tests/test_conversation_oversight_native.py::test_native_actual_compaction_reinjects_one_full_nonturn_guide`; companion static tests in `tests/test_oversee_episode_skill.py` | **I/S.** No story gap. |
| US-22 | Command/tool preflight both assets, admit handoff, and queue exactly one execute follow-up; first/second send failures are reported honestly and compaction alone cannot trigger execute. | `tests/handoff_chain_extension.test.mjs`; `tests/test_handoff_chain_extension.py` (native RPC); workflow-policy assertions | **B/I/S. Gap:** admission, ordering, failures, and registration are covered; no retained native acceptance proves the actual handoff-requested compaction followed by the sole execute continuation. |
| US-23 | Retained folder Episodes and the inactive version-2 task seam require the exact owner/authority/worktree/session for an idle active Episode; task continuation additionally proves canonical primary main, an exact main task path matching committed `HEAD` while unrelated main dirt remains allowed, exact task/path and meaningful plan in main and the Episode, clean worktree, `In Progress`, exact session CWD, and the same task binding in handoff plus execute. Stale routes may refresh, uncertain transport is not replayed, and other dispositions are rejected. | `tests/spec_episode_extension.test.mjs`; `tests/reviewed_plan_extension.test.mjs`; `tests/test_handoff_chain_extension.py` | **B. Gap:** public task handoff remains unregistered; Blocked/resume status publication, Ready-for-Merge integration, and retained native continuation receipts remain later acceptance work. |
| US-24 | Exact active ownership changes only to inactive; identical replay is idempotent; mismatch/provisioning/uncertain fails; no Git/session/worktree/cleanup operation occurs. | `tests/episode_close_extension.test.mjs`; `tests/test_reviewed_plan_extension.py` | **B/S.** No story gap. |

## Work control and developer safety

| Story | Observable acceptance | Current evidence | Classification and gap |
|---|---|---|---|
| US-25 | Active work has one goal; a non-human wait has no goal and one heartbeat; a human wait or terminal state has neither; resume removes the heartbeat before a new goal. | `src/prime-agent-plugin/skills/goals-and-heartbeats/SKILL.md`; `tests/test_goal_continuation_nudge_extension.py` (bundle ownership) | **S. Gap:** this is agent operating policy; reminder-extension tests do not prove the full operating lifecycle. |
| US-26 | Actual compaction injects one non-turn reminder; only the configured repeated-continuation pattern appends one reminder; repeats do not duplicate; unsafe/malformed config is a no-op. | `tests/goal_continuation_nudge_extension.test.mjs`; `tests/test_goal_continuation_nudge_extension.py` | **B/S. Gap:** context-hook behavior is covered with a recording host; rerun native observation only when the hook changes materially. |
| US-27 | Candidate source stays inert; apply/check/probes run in disposable Docker or explicit scratch roots with isolated settings/sessions, no credentials/live global mutation, exact provenance, bounded cleanup, and linked-worktree activation refusal. | `tests/test_prime_agent_plugin_install.py`; `tests/test_tier1_*`; `tests/conftest.py`; `docs/testing-strategy.md`; `docs/evidence/prime-agent-v098-ts-candidate-20261010.md` | **B/I/M.** No story gap. |

## Static-proxy and manual-evidence summary

The current suite is strongest at deterministic lifecycle mechanics. The
following outcomes rely partly on policy inspection or existing dogfood rather
than a dedicated automated test. This is an evidence inventory, not a demand for
new tests or repeated UAT when those behaviors are unchanged:

1. fresh-agent progressive orientation (US-07);
2. model-driven specification and blocked-flow behavior (US-08–US-10);
3. execute/blocked/completed workflow discipline (US-17–US-18);
4. owner supervision and native owned-Episode continuation (US-19, US-23);
5. goal/heartbeat operating discipline (US-25).

US-05 and US-14 already have retained real-Orca manual evidence, but their
visual claims are not automated. Their real acceptance should be rerun only
when the Orca diff/provider-launch boundary changes, rather than replaced with
brittle source-cardinality or prose-fragment assertions.
