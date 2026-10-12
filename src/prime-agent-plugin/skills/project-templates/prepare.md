---
name: prepare
description: Use at the start of work in any repository to discover the minimum project context and native workflow needed for the task.
---

# Prepare — repository orientation

Orient by progressive discovery. Load only enough context to work safely, then
follow links when the task needs more detail. Do not bulk-read the repository or
its documentation.

## Required first step

Read and apply **`/skill:goals-and-heartbeats`** unless that exact skill is
already present in the current context. It is the only file or tool this skill
requires. It remains mandatory while working toward any goal.

## Discover the project conditionally

Start from the working directory and identify the repository root when one is
available. Use a bounded root listing and already-visible context before opening
files. Missing files, directories, commands, and tools are valid; skip them
without inventing replacements.

Discover and read, in this order, only what exists and is relevant:

1. **Agent instructions and local policy.** Find repository or directory-scoped
   instruction files exposed by the agent host or visible near the task. Apply
   the most specific instructions for each file you may touch.
2. **Project overview.** If a README, overview, manifest, or equivalent entry
   point exists, read the smallest source that explains the project and the
   component involved in the task.
3. **Contribution and development guidance.** If present, consult the relevant
   contributing, development, architecture, or setup guide before changing or
   validating code.
4. **Documentation map.** Prefer a documentation index. If none exists, inspect
   one bounded listing of the documentation directory and open only the files
   whose names or links match the task. Never recursively load all docs.
5. **Native work commands.** Derive tracker, build, lint, and test commands from
   discovered instructions, manifests, task-runner files, CI configuration, or
   tool help. Use only the commands and tracker the project actually provides;
   a project may provide none.

## Continue only as needed

Follow references from the material above when they answer a concrete question
about scope, design rationale, implementation, or validation. Prefer the
narrowest useful file or command. Re-check more specific local instructions
when work moves into another directory.

Before substantive work, summarize the project purpose, applicable policy,
likely work surface, and native validation path from the evidence found. State
unknowns plainly instead of treating absent conventional files or tools as an
error.
