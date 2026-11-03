---
name: plan
description: Plan or revise one provider-native task through plan_task, including selection explicitly delegated within the operator's bounds.
---
# Plan one task

Use `plan_task(taskId)` when the operator asks to plan a task. No custom slash
command is required. The tool loads the project's canonical customizable
`.prime-claw/workflows/plan-task-prep.md` and `plan-task.md` policy; keep detailed
planning and publication procedures there. Read `/skill:goals-and-heartbeats`
unless it is already in context.

Bind one exact canonical task ID before calling. Keep an operator-selected ID.
If selection was explicitly delegated, inspect only the selected provider's
native tasks within the stated bounds and choose an `In Design` or `In Planning`
task (Beads `in_design` or `in_planning`). Delegation does not skip design or
planning. If no exact task or clear delegated bounds exist, ask rather than
searching for, substituting, or inventing work.

Read the exact task through that provider before calling. Apply the same status
rule to an operator-selected task: planning accepts only `In Design` or
`In Planning` (Beads `in_design` or `in_planning`). If the native status is
unexpected or unmapped, or the specification is empty, placeholder-only, or too
unclear to plan, explain the observed gap and stop without mutation or admission.
These are your decisions under editable guidance, not an entry-tool eligibility
check. A readable task or a queued workflow is not approval or readiness.

Preserve the operator's actual instruction, exact task, and approved scope
through preparation and compaction. Explicit conditional authority such as
“plan this task, then implement it when ready” may authorize that sequence;
fresh approval is not needed solely because planning ended. Planning alone
does not authorize implementation. Implementation still requires native
`In Planning` after design and planning plus semantic readiness, not dependency
readiness alone or a separate phase-history receipt. Clarify material ambiguity,
missing authority, or new scope.

Call `plan_task` once with the exact `taskId`. Successful admission queues
preparation and one canonical planning follow-up; it does not prove compaction,
plan completion, or implementation readiness. End the turn after admission so
the queued policy can run. Report failure or uncertainty without automatic retry
or another admission. Inspect current delivery and native task facts before
choosing any safe next step; never infer that an uncertain operation did nothing.
Commit coherent selected-ticket edits promptly and publish through the selected
provider before an Episode needs them. Preserve unrelated bytes, staging, fields,
and history; do not include or reset another Conversation's work to make a
publication check pass. This entry creates no Episode and grants no merge,
abandonment, activation, restart, or cleanup authority.
