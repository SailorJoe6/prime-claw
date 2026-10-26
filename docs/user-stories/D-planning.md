# D. Produce and review an implementation plan

## US-11 — Plan one exact reviewed specification

**As an operator, I want one exact reviewed specification converted into an
implementation plan, so that I can review implementation slices before
authorizing implementation.**

`/plan TASK-ID` and `plan_task(taskId=...)`:

1. resolve the exact operator-selected task through the repository's one live
   provider and admit only canonical `In Design` or `In Planning`;
2. bind the exact provider and project root into both canonical task-planning
   messages (plus the exact task path only for Backlog);
3. request focused compaction on a best-effort basis;
4. use semantic planning judgment over Backlog's native specification fields or
   Beads' complete raw native view and living `design`;
5. publish the reviewable plan and native `In Planning` transition through that
   same provider; and
6. prove the exact native task/publication, then stop for operator review.

Backlog preserves its structured task view, native Implementation Plan, exact
returned path, task-only commit, and prompt push. Beads binds the entire exact
canonical ID and root, maps native `in_design`/`in_planning` to the canonical
states, performs one supported synchronization, writes only the raw `design`
and guarded `in_planning` transition, publishes once without force, and proves
the exact reread, provider revision, publication ref, and clean working set. It
has no task path, task-file commit, mirror, or normalized task projection.
Compatible owner-authored or outside same-task planning refinements become the
current LLM planning basis; genuine semantic, authority, or scope conflicts
stop without a second authorization protocol.

In initialized projects that still retain version-1 bundles, `/plan-spec
.ralph/plans/future/<slug>` and `plan_spec(location=...)` keep the established
folder workflow. They validate one exact folder, produce `EXECUTION_PLAN.md`
beside the specification, and stop for the same separate operator review. This
builder repository has completed its local task-native cutover and carries no
such folder.

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
