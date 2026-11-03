---
id: PRIMECLAW-54
title: Enable operator choice and judgment-based implementation placement
status: In Design
assignee: []
created_date: '2026-11-03 02:59'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
  - src/prime-agent-plugin/skills/implement-task/SKILL.md
  - src/prime-agent-plugin/workflows/implement-task.md
  - src/prime-agent-plugin/workflows/plan-task.md
  - src/prime-agent-plugin/ROLE_KERNEL.md
  - src/prime-agent-plugin/skills/project-templates/execute.md
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

## Scope
Update plugin-injected routing guidance, managed entry skills, relevant project workflow/template guidance, and role wording so these paths agree. Preserve explicit placement through any requested planning and conditional implementation continuation; do not force "plan then implement here" into an Episode. Scope owner-Conversation implementation prohibitions and Episode identity/plan checks to managed Episode work, rather than all ordinary implementation. Direct execution uses ordinary supported native task CLI, tests, and Git operations; it creates no Episode resources or ownership record and does not borrow another role's authority. Keep this task-native; do not redesign retained version-1 specification lifecycle.

## Constraints and non-goals
Keep operator scope/implementation authority, exact task identity, provider-native task publication, existing Git/test safety, credential isolation, and all existing Episode ownership/terminal safeguards. Do not allow direct work to conflict with an active Episode bound to the same task or modify another owner's state; surface that conflict rather than adopting or bypassing it. Preserve EXPERT read-only boundaries. No new public tool, routing service, persisted mode state, ownership format, approval receipt, classifier framework, Prime Agent upstream change, or unrelated cleanup. Do not silently select another task. This implementation authorizes source changes and isolated candidate validation, not merge, user-global activation, restart, live migration, or cleanup of unrelated resources.

## Validation
Add proportional regression coverage for explicit direct/Episode choice, judgment-based defaults, substantial-unplanned/ambiguous ask-first cases, and placement surviving plan-then-implement. Show that direct instructions do not invoke Episode tools or require Episode identity/formal plan evidence, while existing Episode admission and ownership protections remain intact. Use Docker-only candidate validation and mandatory Tier 1 --probe after plugin source changes. Do not use host/user-global candidate apply/check/probes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Explicit current-checkout/main implementation requests take the direct path without implement_task, Episode allocation/ownership, or a mandatory design/planning phase; explicit Episode requests retain the existing readiness and isolated lifecycle.
- [ ] #2 Without explicit placement, guidance uses judgment: appropriate native planned status plus meaningful plan/design defaults to an Episode; obvious small unplanned work defaults to direct implementation; substantial work still in design or unclear/conflicting evidence gets a focused operator question.
- [ ] #3 In Design alone does not prohibit a clearly small authorized direct change, and routing is neither always-ask nor a rigid programmatic size/status classifier.
- [ ] #4 Plugin-injected routing, managed skills, relevant workflows/templates, and role guidance consistently distinguish direct work from Episode-specific authority; EXPERT and active Episode ownership safeguards are preserved.
- [ ] #5 Explicit placement survives requested planning and authorized plan-then-implement continuation; planning-only instructions still do not authorize implementation.
- [ ] #6 Direct work uses supported provider-native task operations and existing Git/test safety without adding a public tool, persisted execution-mode/ownership format, approval receipt, or orchestration framework; active same-task Episode conflicts stop for operator resolution.
- [ ] #7 Focused regression coverage exercises direct, Episode, judgment defaults, ask-first, and plan-continuation paths; required Docker-only validation including Tier 1 --probe passes or reports a concrete blocker truthfully.
- [ ] #8 PRIMECLAW-52, retained version-1 lifecycle, Prime Agent upstream, user-global activation/restart, live migrations, and unrelated ownership/resources remain outside this change.
<!-- AC:END -->
