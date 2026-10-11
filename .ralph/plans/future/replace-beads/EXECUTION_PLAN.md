# Execution plan — `prime-claw-rg2`

Execute bead `prime-claw-rg2` in an isolated Episode worktree. Reload it before
each implementation pass with `bd show prime-claw-rg2`. The bead remains the
sole product scope, requirements, non-goals, and acceptance contract; this file
only supplies the execution controls required to admit the Episode.

## Execution boundary

- **Threats:** data loss or mistranslation, source drift during migration,
  non-reproducible binaries, unintended dual-tracker operation, and changes to
  operator-owned contexts or worktrees.
- **Trusted assumptions:** Beads stays read-only, supported Backlog.md CLI
  behavior and ordinary Git history are available, and the operator controls
  merge, activation, and existing contexts.
- **Ordinary failure and recovery:** a failed command, count, graph comparison,
  build, or test stops the current slice with evidence. Leave the candidate
  unmerged and recover through the unchanged Beads source and ordinary Git
  rejection or revert; add no bespoke recovery system.
- **Complexity budget:** no shim, adapter, driver, manifest, dual-write system,
  or speculative safeguard. Stop for simplification if support or recovery
  machinery grows faster than the migration itself.

## Ordered slices

1. **Vendor and build.** Resolve the bounded latest stable release, pin the fork
   submodule, build both standalone artifacts, and record tag, commit, and smoke
   evidence.
2. **Initialize and migrate.** Initialize the accepted configuration; recreate
   all issues through the native CLI; then prove the required counts, content,
   comments, relationships, and transient reference translation.
3. **Convert callers.** Replace active repository Beads usage and navigational
   IDs, remove repository-specific Beads integration, and preserve only factual
   history or verbatim evidence.
4. **Validate the cutover candidate.** Prove lifecycle compatibility, source
   stability, builds, migration equivalence, repository audit results, and the
   required Docker-only plugin gates; commit and push the reviewable candidate.
5. **Finish only after operator-authorized merge and activation.** From primary
   `main`, use Backlog.md to add the migrated epic's final summary and mark it
   `Done`, then commit and push that first dogfood mutation.

Each slice depends on the prior slice and stops for owner review with its named
evidence. Only `prime-claw-rg2` acceptance behavior is required. Optional
hardening is recorded but not implemented unless a failing acceptance check or
real in-scope dogfood failure supplies concrete evidence and the operator
promotes it.

For one slice, stop after two repair/review cycles. Further scope, architecture,
or complexity changes require operator review. Reviewers cannot add product
requirements; only the operator may change scope, product behavior, merge or
activation decisions, or promote a newly discovered invariant.
