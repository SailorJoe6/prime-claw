# Future specification bundles

Prime Claw separates specification authoring from planning and implementation.
The project conversation owns specification review. No episode resources are
allocated during authoring.

## Authoring workflows

Use either project-customizable skill:

- `design` when requirements discovery is still needed;
- `spec-it-out` when the conversation already contains most of the design.

Both workflows create a new bundle at:

```text
.ralph/plans/future/<slug>/
```

The skills choose a safe, descriptive slug and refuse to overwrite an existing
bundle. All specification artifacts belong inside that folder. The default
Prime Claw skills create `SPECIFICATION.md`, `REQUIREMENTS.md`, and
`DECISIONS.md`, but those filenames are project policy rather than native
command requirements.

After writing the bundle, the agent reports its exact relative path, links every
artifact, and stops for operator specification review. Requested changes stay
in the same bundle. Authoring does not create an execution plan, branch,
worktree, or episode.

## Native reviewed planning

Planning is a separate reviewed gate. Select the exact reviewed bundle with:

```text
/plan .ralph/plans/future/<slug>
```

The native project extension at
`.prime/agent/extensions/reviewed-plan.ts` performs only deterministic loader
work. It rejects missing input, absolute paths, traversal, symlink escapes,
unsafe slugs, and folders that do not exist. Invalid input displays:

```text
Usage: /plan .ralph/plans/future/<slug>
```

A valid command loads the current project policy from
`.ralph/skills/plan/SKILL.md`, adds the validated path in an
`<operator-plan-location>` block, and sends that combined prompt exactly once.
The native code does not choose artifact names or define how planning works.
Those customizable decisions remain in the canonical skill Markdown.

The default policy reads the specification bundle and writes
`EXECUTION_PLAN.md` back into the same future folder. If specification material
is missing or inadequate, it explains the gap and stops. Otherwise, it links
all planning output and stops for operator plan review. `/plan` never moves the
bundle, creates an implementation worktree, or authorizes implementation.

There is only one slash-command surface: the native `/plan` command. The former
`.agents/skills/plan` exposure is intentionally absent. Implementation remains
unauthorized until the separate `/implement-spec` boundary is invoked.

## Focused verification

Run both layers of command coverage with:

```sh
node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs
pytest -q tests/test_reviewed_plan_extension.py
```

The Python bridge reruns the Node suite and asks the installed offline Prime
Agent RPC loader to confirm exactly one native `plan` registration.
