---
id: PRIMECLAW-34
title: Investigate gstack skill integration with the Ralph workflow
status: To Do
assignee: []
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p2
type: task
ordinal: 117000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
prime-claw and Ralph have project-specific lifecycle skills, while gstack provides useful specialist skills such as office-hours, plan reviews, investigate, QA, and shipping. Imported gstack skills can contain Claude-specific assumptions (for example, writing routing rules to CLAUDE.md or invoking a Claude Skill tool) that do not directly apply to Prime Agent.

## Investigate
- Identify which gstack skills complement Ralph phases and which overlap or conflict.
- Define Prime Agent-native routing through AGENTS.md and the available skill-loading mechanism.
- Decide whether integrations should be phase gates, optional consultations, or independent tools.
- Preserve prime-claw's rule that LLM instructions remain customizable Markdown rather than hard-coded prompts.
- Propose safeguards for translating or rejecting harness-specific instructions.

## Deliverable
A reviewed integration proposal and bounded follow-up implementation issues. Do not change the current Ralph workflow as part of this investigation.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Candidate gstack skills are mapped to Ralph lifecycle phases.
- [ ] #2 Overlaps, conflicts, and harness-specific assumptions are documented.
- [ ] #3 The proposal preserves Markdown-configurable LLM instructions.
- [ ] #4 Any recommended implementation is split into separately approved follow-up work.
<!-- AC:END -->
