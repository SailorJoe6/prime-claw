# D. Produce and review an implementation plan

## US-11 — Plan one exact reviewed specification

**As an operator, I want one exact reviewed specification converted into an
implementation plan, so that I can review implementation slices before
authorizing implementation.**

`/plan TASK-ID` and `plan_task(taskId=...)`:

1. resolve the exact operator-selected task through Backlog's structured CLI;
2. admit only a task in `In Design` or `In Planning`;
3. load the canonical task-planning preparation and planning workflows;
4. request focused compaction on a best-effort basis;
5. write a meaningful native Implementation Plan and leave the task in
   `In Planning`; and
6. commit only that exact task path, attempt a prompt push, and stop for
   operator review.

During the bounded migration, `/plan-spec .ralph/plans/future/<slug>` and
`plan_spec(location=...)` retain the established folder workflow. They validate
one exact folder, produce `EXECUTION_PLAN.md` beside the specification, and stop
for the same separate operator review.

The plan is concise and actionable at the level of detail the work needs. It
records relevant implementation steps or slices, tests, documentation,
dependencies, and project-state updates without adding template-driven process
or speculative hardening.

## US-12 — Keep planning separate from implementation approval

**As an operator, I want plan approval to remain distinct from implementation
approval, so that planning cannot accidentally create branches, worktrees,
sessions, or active work.**

The plugin does not search for, infer, or invent the selected task or retained
future folder. An inadequate specification produces actionable deficiencies
rather than a partial plan. Planning does not create Episode resources or grant
implementation approval.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/reviewed-plan.ts`
- `src/prime-agent-plugin/extension-support/prep-chain.ts`
- `src/prime-agent-plugin/workflows/plan-task-prep.md`
- `src/prime-agent-plugin/workflows/plan-task.md`
- `src/prime-agent-plugin/workflows/plan-prep.md` (migration compatibility)
- `src/prime-agent-plugin/workflows/plan-spec.md` (migration compatibility)

## Design references

- [`prep-chain.md`](../prep-chain.md)
- [`future-specification-bundles.md`](../future-specification-bundles.md)
