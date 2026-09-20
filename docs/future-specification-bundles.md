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

Planning is a separate reviewed gate. The operator later selects the exact
future folder with `/plan .ralph/plans/future/<slug>`. Implementation remains
unauthorized until the separate `/implement-spec` boundary is invoked.
