---
id: PRIMECLAW-51
title: Add agent-callable implement_task entry point for approved tasks
status: In Design
assignee: []
created_date: '2026-10-31 17:45'
labels: []
dependencies: []
references:
  - src/prime-agent-plugin/extensions/reviewed-plan.ts
documentation:
  - docs/user-stories/E-episode-promotion.md
  - docs/user-stories/traceability.md
priority: p2
type: feature
ordinal: 136000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context and outcome
Design and specification can be invoked by an agent, and `plan_task` exposes the same planning workflow as `/plan TASK-ID`. Implementation has no equivalent entry point: `/implement-task TASK-ID` starts the readiness workflow, while `create_task_episode` can only finish an already-admitted chain. An operator who asks in normal conversation to implement an exact task must currently issue a slash command as well.

Add an agent-callable `implement_task` tool so an explicit conversational implementation request can start the same task-native readiness and Episode admission workflow as `/implement-task TASK-ID`. Operator approval, not slash-command syntax, is the authorization boundary.

## Required behavior
The tool accepts one exact operator-selected provider-native task ID. It may be invoked only when the operator clearly authorizes implementation of that task. Missing or materially ambiguous task selection or implementation intent requires clarification before invocation; the agent must not choose a task from a queue or infer implementation approval from specification approval, planning approval, planning completion, or an automated continuation.

The tool and slash command must have equivalent task-native behavior: resolve the repository's selected live provider and canonical task, require `In Planning`, apply the existing semantic readiness workflow, and preserve Conversation ownership and Episode admission rules. Preserve the existing placement behavior, including explicit host selection where the slash command supports it, without allowing the tool to bypass placement decisions or silently choose a different destination.

Successful invocation admits the canonical implementation-preparation/readiness chain and its sole follow-up. It is a terminal routing action for the caller, not proof that readiness passed or an Episode was created. Episode allocation remains behind the existing readiness approval and `create_task_episode` boundary, which publishes `In Progress`, reserves ownership, and creates one isolated Episode with one fixed execute assignment. Direct calls to `create_task_episode` without matching readiness approval must remain rejected.

Rejected admission must report the reason without creating Episode resources or advancing lifecycle state. Failed or uncertain transport or partial creation is a blocker, not permission to retry automatically, start a second chain, or create a duplicate Episode. Preserve the existing command behavior for replays and already-owned work rather than inventing another recovery policy.

Expose clear agent-facing usage and authorization guidance, and update relevant user-facing workflow documentation to show that a natural-language request naming an exact task can invoke implementation without a second slash-command request.

## Scope boundaries
This work adds task-native entry-point parity only. It does not authorize autonomous implementation after planning, remove the separate specification/plan/implementation boundaries, change readiness standards, redesign placement or Episode lifecycle, add another task provider, add an `implement_spec` tool, or extend this new tool to retained folder-based specifications. Existing retained slash-command compatibility remains unchanged.

Prime Agent remains an upstream dependency. Changes belong in prime-claw's plugin, managed guidance, documentation, and tests. Plugin candidate validation must remain Docker-isolated; do not apply or probe the candidate in the host/user-global installation before acceptance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An explicit operator request to implement one exact provider-native task can invoke implement_task and start the same task-native readiness workflow as /implement-task TASK-ID, without requiring a second slash-command request.
- [ ] #2 Agent-facing guidance requires explicit implementation approval for the exact task, asks for clarification when material intent or identity is missing, and forbids inferring implementation authority from design/specification approval, planning approval or completion, queue selection, or automated continuation.
- [ ] #3 Tool admission preserves the slash command's selected-provider resolution, canonical task identity, In Planning requirement, readiness checks, ownership rules, and default or explicitly selected host placement; invalid task/status/provider/placement cases do not create Episode resources or advance lifecycle state.
- [ ] #4 Successful tool invocation reports readiness-chain admission rather than implementation or Episode completion, queues only the canonical follow-up, and instructs the caller to stop the current turn after admission.
- [ ] #5 After readiness approval, the existing create_task_episode boundary creates one Episode with one fixed execute assignment and the existing In Progress/ownership publication; calling create_task_episode without matching readiness approval remains rejected.
- [ ] #6 Failure and uncertain-result behavior does not automatically retry admission or partial creation, send a second execute assignment, or allocate a duplicate Episode; existing slash-command replay and recovery behavior is preserved.
- [ ] #7 Focused automated coverage proves task-native command/tool parity, authorization guidance, rejected admission, and the single-Episode boundary for the supported Backlog and Beads paths. Plugin-source changes pass the required Docker-isolated Tier-1 validation.
- [ ] #8 Relevant workflow documentation describes natural-language implementation entry and the unchanged explicit operator-approval boundary; existing /implement-task behavior and retained folder compatibility remain intact.
<!-- AC:END -->
