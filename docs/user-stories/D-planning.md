# D. Produce and review an implementation plan

## US-11 — Plan one exact reviewed specification

**As an operator, I want one exact future specification converted into an
execution plan, so that I can review implementation slices before authorizing
implementation.**

`/plan-spec .ralph/plans/future/<slug>` and `plan_spec(location=...)`:

1. validate the exact operator-selected folder;
2. load the canonical planning preparation and planning workflows;
3. request focused compaction on a best-effort basis;
4. produce `EXECUTION_PLAN.md` beside the specification;
5. stop for operator review.

The plan is concise and actionable at the level of detail the work needs. It
records relevant implementation steps or slices, tests, documentation,
dependencies, and project-state updates without adding template-driven process
or speculative hardening.

## US-12 — Keep planning separate from implementation approval

**As an operator, I want plan approval to remain distinct from implementation
approval, so that planning cannot accidentally create branches, worktrees,
sessions, or active work.**

The plugin does not search for, infer, or invent the selected future folder.
An inadequate specification produces actionable deficiencies rather than a
partial plan.

## Primary implementation surfaces

- `src/prime-agent-plugin/extensions/reviewed-plan.ts`
- `src/prime-agent-plugin/extension-support/prep-chain.ts`
- `src/prime-agent-plugin/workflows/plan-prep.md`
- `src/prime-agent-plugin/workflows/plan-spec.md`

## Design references

- [`prep-chain.md`](../prep-chain.md)
- [`future-specification-bundles.md`](../future-specification-bundles.md)
