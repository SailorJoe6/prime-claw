---
id: PRIMECLAW-54
title: Enable operator choice and judgment-based implementation placement
status: In Progress
assignee: []
created_date: 2026-11-03 02:59
updated_date: '2026-11-22T04:42:00Z'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
  - src/prime-agent-plugin/skills/implement-task/SKILL.md
  - src/prime-agent-plugin/workflows/implement-task.md
  - src/prime-agent-plugin/workflows/plan-task.md
  - src/prime-agent-plugin/ROLE_KERNEL.md
  - src/prime-agent-plugin/skills/project-templates/execute.md
documentation:
  - docs/implementation-placement.md
modified_files:
  - docs/implementation-placement.md
  - tests/test_implementation_placement.py
  - .agents/skills/backlog/SKILL.md
  - .agents/skills/execute/SKILL.md
  - .prime-claw/templates.json
  - .prime-claw/workflows/implement-task-prep.md
  - .prime-claw/workflows/implement-task.md
  - .prime-claw/workflows/plan-task-prep.md
  - .prime-claw/workflows/plan-task.md
  - AGENTS.md
  - docs/README.md
  - src/prime-agent-plugin/ROLE_KERNEL.md
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
  - src/prime-agent-plugin/skills/implement-task/SKILL.md
  - src/prime-agent-plugin/skills/plan/SKILL.md
  - src/prime-agent-plugin/skills/project-templates/execute.md
  - src/prime-agent-plugin/workflows/implement-task-prep.md
  - src/prime-agent-plugin/workflows/implement-task.md
  - src/prime-agent-plugin/workflows/plan-task-prep.md
  - src/prime-agent-plugin/workflows/plan-task.md
  - tests/reviewed_plan_extension.test.mjs
  - tests/test_future_plan_skills.py
  - tests/test_role_kernel.py
  - README.md
  - docs/backlog.md
  - docs/future-specification-bundles.md
  - tests/test_backlog_workflow.py
  - tests/test_reviewed_plan_extension.py
priority: p1
type: feature
ordinal: 139000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Outcome
Enable operator choice between direct implementation in the current checkout and the existing isolated Episode workflow. Stop treating every task implementation request as a command to invoke implement_task or to enter formal planning. Joe explicitly approved the routing behavior below and requested implementation ("make it so"). This is separate from PRIMECLAW-52, which must remain untouched.

## Agreed routing behavior
An explicit operator placement choice wins. "Here", "in this checkout", or "on main" means direct work in that checkout without implement_task, Episode allocation, or an Episode-only execute workflow. An explicit Episode request uses the existing implementation-readiness and isolated Episode lifecycle.
When placement is unspecified, use semantic judgment: a task clearly already planned, evidenced by appropriate native ticket status and a meaningful plan/design, defaults to an Episode; an obvious quick bug fix or easy small unplanned change defaults to direct implementation; a substantial task still in design that would benefit from formal planning requires one focused operator question before starting that workflow. Ambiguous or conflicting evidence also calls for a focused question, not an always-ask rule. In Design alone must not block a clearly small authorized direct change. Do not implement a rigid size/status classifier.

## Direct task lifecycle (operator decisions from grill-me)
Before editing implementation files for any authorized direct tracked change, including a quick fix, publish the exact task's native `In Progress` state. First verify the selected task, placement, and absence of a same-task active Episode. After required checks pass and the approved change is committed and pushed (or committed locally in a project with no remote), publish the task as `Done` without a separate approval solely for status. Honor any explicit review hold; this does not grant merge, deployment, or activation authority.

## Scope
Update plugin-injected routing guidance, managed entry skills, relevant project workflow/template guidance, and role wording so these paths agree. Preserve explicit placement through any requested planning and conditional implementation continuation; do not force "plan then implement here" into an Episode. Scope owner-Conversation implementation prohibitions and Episode identity/plan checks to managed Episode work, rather than all ordinary implementation. Direct execution uses ordinary supported native task CLI, tests, and Git operations; it creates no Episode resources or ownership record and does not borrow another role's authority. Keep this task-native; do not redesign retained version-1 specification lifecycle.

## Constraints and non-goals
Keep operator scope/implementation authority, exact task identity, provider-native task publication, existing Git/test safety, credential isolation, and all existing Episode ownership/terminal safeguards. Do not allow direct work to conflict with an active Episode bound to the same task or modify another owner's state; surface that conflict rather than adopting or bypassing it. Preserve EXPERT read-only boundaries. No new public tool, routing service, persisted mode state, ownership format, approval receipt, classifier framework, Prime Agent upstream change, or unrelated cleanup. Do not silently select another task. This implementation authorizes source changes and isolated candidate validation, not merge, user-global activation, restart, live migration, or cleanup of unrelated resources.

## Validation
Add proportional regression coverage for explicit direct/Episode choice, judgment-based defaults, substantial-unplanned/ambiguous ask-first cases, and placement surviving plan-then-implement. Show that direct instructions do not invoke Episode tools or require Episode identity/formal plan evidence, while existing Episode admission and ownership protections remain intact. Use Docker-only candidate validation and mandatory Tier 1 --probe after plugin source changes. Do not use host/user-global candidate apply/check/probes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Explicit current-checkout/main implementation requests take the direct path without implement_task, Episode allocation/ownership, or a mandatory design/planning phase; explicit Episode requests retain the existing readiness and isolated lifecycle.
- [x] #2 Without explicit placement, guidance uses judgment: appropriate native planned status plus meaningful plan/design defaults to an Episode; obvious small unplanned work defaults to direct implementation; substantial work still in design or unclear/conflicting evidence gets a focused operator question.
- [x] #3 In Design alone does not prohibit a clearly small authorized direct change, and routing is neither always-ask nor a rigid programmatic size/status classifier.
- [x] #4 Plugin-injected routing, managed skills, relevant workflows/templates, and role guidance consistently distinguish direct work from Episode-specific authority; EXPERT and active Episode ownership safeguards are preserved.
- [x] #5 Explicit placement survives requested planning and authorized plan-then-implement continuation; planning-only instructions still do not authorize implementation.
- [x] #6 Direct work uses supported provider-native task operations and existing Git/test safety without adding a public tool, persisted execution-mode/ownership format, approval receipt, or orchestration framework; active same-task Episode conflicts stop for operator resolution.
- [x] #7 Focused regression coverage exercises direct, Episode, judgment defaults, ask-first, and plan-continuation paths; required Docker-only validation including Tier 1 --probe passes or reports a concrete blocker truthfully.
- [x] #8 PRIMECLAW-52, retained version-1 lifecycle, Prime Agent upstream, user-global activation/restart, live migrations, and unrelated ownership/resources remain outside this change.
- [x] #9 For direct tracked work, publish native In Progress before implementation edits, even for a quick fix; publish Done after required checks and commit/publication are proven, without a separate closure approval unless the operator explicitly asked to stop for review. Existing merge, deployment, and activation authority remains unchanged.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update injected task-implementation routing and the managed entry guidance to honor explicit placement and Joe's judgment-based planned/small-unplanned/substantial-design defaults. Keep Episode tool admission scoped to Episode requests or the planned-work default, and retain ambiguity and same-task active-Episode safeguards.
2. Align the relevant role, task execution, planning-continuation, and project-template instructions. Add a lightweight ordinary direct-task execution path with supported native task updates and existing Git/test safety, no Episode identity or mandatory formal plan requirement, and no new runtime tool/state/protocol. Preserve existing Episode and retained version-1 behavior.
3. Add proportional routing/guidance regression cases for both explicit modes, judgment defaults, ask-first situations, and preserved placement after planning. Run the required Docker-only plugin validation, including Tier 1 --probe; update directly affected user-facing docs and report truthful results. Do not deploy user-globally or merge.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Execution slice: implement prompt-led placement end to end (routing, ordinary direct lifecycle, and planning continuation), keep Episode admission unchanged, then validate the candidate with focused Docker regressions and Tier 1 --probe. No merge or activation.

Implemented the placement-routing candidate in the Episode: injected entry guidance, explicit/native-evidence defaults, direct tracked lifecycle, and preserved placement through requested planning. Episode entry handler, allocation and ownership checks are unchanged. Docker Tier 1 --probe passed (run 20261121T221507Z-93469-a0235dbe). Offline Docker policy tests: 46 passed, 3 skipped, 2 deselected (archived-history test needs Git metadata; retained implement-spec manifest checksum mismatch is present in the base). Offline Node snapshot comparison on the Tier 1 runtime image: candidate 152/154; base ac02ff1dd4033e3e30015d8876f483e4afc520d3 151/153. The same two failures reproduced on both: stale handoff tool guidance expectation and the registered Beads continuation fixture. New routing test passed; no live LLM UAT, merge or activation. Repro: official Tier 1 source selector, then node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs tests/task_episode_ownership_extension.test.mjs tests/managed_session_protocol.test.mjs on identical read-only snapshot layouts with network disabled.

Owner-authorized revision on published code 363f96b, limited to two placement findings. Replace duplicated injected lifecycle guidance with a short pointer to the editable implement-task skill (REQUIREMENTS.md G2) and update the stale Backlog workflow and reviewed-plan code assertions while preserving native eligibility protections. Scope planning and implement_task statements in README.md, docs/future-specification-bundles.md, and docs/backlog.md to Episode work and link docs/implementation-placement.md for direct work. Run affected checks in Docker with PyYAML and mandatory Tier 1 --probe after plugin source changes. Leave retained v1, unrelated failures, transport, lifecycle status, merge, activation and cleanup untouched.

Bounded owner revision on 363f96b completed: implement_task metadata points to the editable implement-task skill, with no handler, native eligibility-policy, or Episode mechanics change. Updated stale assertions and scoped docs in README.md, docs/future-specification-bundles.md, and docs/backlog.md to make the direct route clear. Docker Tier 1 --probe passed (20261121T234740Z-26762-2452bada). Offline PyYAML policy run (Backlog workflow, reviewed-plan and placement tests): revision 22 passed, 1 failed, 10 deselected; 363f96b 20 passed, 3 failed, 10 deselected. Both targeted Python regressions now pass; remaining failure test_operator_guidance_creates_new_work_explicitly_in_design (stale generic claim assertion against unchanged AGENTS.md) reproduced on 363f96b. Offline Node reviewed_plan_extension.test.mjs: 68/69 on both; existing tool guidance preserves operator authority and fixed fresh assignment failure unchanged. Matched read-only snapshots used committed Backlog config from 014208e237516015f73c23c2f9fff25480c0dfba for Python. No runtime/transport changes, live UAT, merge, or activation.

Owner-authorized integration checkpoint after verified coordinated restart and hold release: continue from published Episode head 938211797c7134b2827dcd65de1080297fa03ded. On canonical execute, fetch and verify latest origin/main (observed db19bb804091aa77c7828c0e23fb243cc0769a29); merge it into this exact Episode with ordinary Git, no rebase or force. Reconcile .prime-claw/templates.json against actual merged bytes, preserving unrelated entries and main customizations. Preserve both placement behavior and newer main Backlog/model-discovery guidance, especially in docs/backlog.md and ROLE_KERNEL.md; stop for a genuine scope/content decision. Validate in Docker with Tier 1 --probe and affected placement checks against appropriate baselines. Publish only the clean Episode branch and report exact main parent, candidate head, resolutions, and evidence or concrete blocker. Leave canonical main, other owners, lifecycle status, installed assets, runtime and cleanup untouched; no Episode-to-main merge, activation, restart, or assignment.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Candidate for owner review: explicit direct or Episode placement, judgment when unspecified, preserved placement through planning, and native status ordering for direct work. Placement and readiness policy stays in the editable skill; user docs distinguish direct quick fixes from Episode readiness. Docker Tier 1 probe and targeted regressions passed. Remaining broad-suite failures reproduced on the published pre-revision candidate. Live behavior still awaits separate review/UAT.
<!-- SECTION:FINAL_SUMMARY:END -->
