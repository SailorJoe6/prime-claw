---
id: PRIMECLAW-10.21
title: Refine conversational Ralph confirmation UX after dogfood
status: To Do
assignee: []
created_date: '2026-10-12 01:00'
labels:
  - conversational-routing
  - episode-loop
  - follow-up
  - phase4
  - ralph
dependencies: []
parent_task_id: PRIMECLAW-10
priority: p3
type: task
ordinal: 40000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
After the first conversational Ralph command adapters ship with trusted host confirmation for implementation, use real dogfood evidence to refine when natural-language intent should proceed directly versus ask a clarification. Cover readiness statements such as “I think <folder> is ready for planning” and explicit imperatives such as “plan <folder> now” or “start implementing <folder> now”. This follow-up must not block or expand the current conversational-routing delivery.

## Legacy design

Ship the current conservative behavior first: handoff and planning follow existing command-specific rules, while conversational implementation retains trusted host confirmation. Revisit only with observed UX evidence.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Observed dogfood cases are recorded; clear handoff, plan, and implementation intent is distinguished from discussion or ambiguous intent; any revised confirmation rules avoid redundant prompts without weakening exact-folder implementation authority; relevant tool guidance, documentation, and focused tests are updated; no brittle prose parser or generalized authorization system is introduced.
<!-- AC:END -->
