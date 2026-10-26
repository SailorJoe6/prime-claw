---
name: spec-it-out
description: Use when the conversation already contains most of a design and one reviewable provider-native task is needed.
---

Use the current conversation to specify the proposed work. Do not start
implementation. Ask only the remaining questions that need operator input, one at a time;
focus on material gaps. For small details that are already clear, use your best
judgment. Preserve the synthesis-first posture rather than restarting broad
discovery.

## Select the live provider

Work only from the repository's sole live task provider. Use native evidence,
not executable presence: a valid Backlog configuration selects Backlog, while a
valid `.beads/` Dolt store selects Beads. Run every provider command from the
exact project root. If provider evidence is absent, malformed, dual, redirected,
or unavailable, explain the exact remediation and stop without creating,
initializing, switching, or mutating a provider. Never search either provider's
queue to choose work, mix provider commands, mirror content, or create a folder
under `.ralph/plans`.

## Bind or create exactly one task

If the operator explicitly selected an existing task, use only that entire exact
canonical ID. Do not search for, infer, or substitute another task. If the
request might mean either create new work or revise existing work but no exact
ID is given, ask the operator before mutation.

Reload a selected task through only its provider:

- **Backlog:** run `backlog task view --json -- TASK-ID`. Require the returned
  canonical ID to match the selected ID, the project-relative task path to be a
  regular task path in this project, and status exactly `In Design`.
- **Beads:** run `bd context --json`, one supported `bd dolt pull`, then
  `bd show TASK-ID --json --long --include-comments`. Require the context to
  identify the exact project root and live Dolt store with no redirect, the
  returned canonical ID to equal the entire selected ID, and native status
  exactly `in_design`, mapped to canonical `In Design`. Keep the complete raw
  task view, including every present or absent provider-native field; do not
  translate it into a Backlog-shaped or provider-neutral model.

If lookup, provider/root identity, canonical task identity, Backlog path, or
status is wrong or uncertain, stop without mutation. Reject `In Planning`,
`In Progress`, `Blocked`, `Ready for Merge`, and `Done` (native `in_planning`,
`in_progress`, `blocked`, `ready_for_merge`, and `done`) because later states
already carry planning or execution history that this authoring phase may not
invalidate.

If the operator did not select an existing task, create exactly one task only
after the specification is ready to save. Choose a concise title and spell out
the native design status rather than relying on a configured default:

- **Backlog:** use one supported `backlog task create --plain` command with
  `--status "In Design"`, then bind the exact created task ID from its output.
- **Beads:** first run one supported `bd dolt pull` and capture
  `bd context --json`, native revision/publication evidence, and clean
  working-set state. Use one supported `bd --dolt-auto-commit=on create`
  command with the title, `--type task`, `--status in_design`, `--description`,
  `--acceptance`, and `--json`. Bind only the exact canonical ID returned by
  that one creation.

Creation is one mutation attempt. If the exit result, output, returned identity,
post-create reread, or publication state is uncertain, do not issue another
create and do not guess an ID. Preserve the exact evidence, report the native
identity-recovery condition, and stop until the native identity is resolved. This invocation never issues a
second create after uncertainty.

## Write the native specification

Make the specification clear enough to plan without guessing material product
decisions. Capture the current context, intended outcome, scope, required
behavior, material constraints, important non-goals, and proportional observable
acceptance. Be thorough without repetition. Include safety, failure handling,
or recovery only when they are materially relevant. Do not require boilerplate
sections, invent risks, prescribe implementation architecture, or turn reviewer
advice into scope. If a material product decision remains unresolved, ask the
operator rather than silently deciding it, one material question at a time.

Use only supported owner-authored native fields:

- **Backlog:** Description, native Acceptance Criteria, References, and
  Documentation. For a new task use `--description`, repeated `--ac`, and
  optional repeated `--ref` and `--doc`. For an existing task use one supported
  `backlog task edit` operation with `--description` and repeated
  `--acceptance-criteria`. Preserve existing references and documentation unless
  the reviewed specification intentionally changes them; if either list changes,
  pass its complete desired value from the reloaded task plus the approved
  revisions so unrelated entries are not dropped.
- **Beads:** raw `description` and raw acceptance criteria through
  `--description` and `--acceptance`. Preserve material references and
  documentation losslessly as ordinary human-readable `## References` and
  `## Documentation` sections in the description when no dedicated native
  field can hold their meaning. Do not invent metadata, relations, paths, or a
  conversion format. For an existing task, change only `description` and
  acceptance criteria with one guarded command equivalent to
  `bd --dolt-auto-commit=on update TASK-ID ... --if-status in_design --json`.

Keep real newlines in Markdown values. Do not change title, type, priority,
assignee, parent, dependencies, labels, comments, metadata, identity, or any
lifecycle field on an existing task. Do not write a Beads `design` plan during
specification. Do not write a Backlog Implementation Plan, Implementation Notes,
or Final Summary. Never edit provider storage directly, use raw Dolt writes,
force, retry, adopt a remote, reset, or create a sidecar, digest, receipt, task
path, or content mirror.

## Verify and publish exactly once

### Backlog

Before mutation, record Git status and require the selected existing task path
and Git index to be clean. After creation or revision, reload the exact task
through `backlog task view --json -- TASK-ID` and verify its canonical ID,
`In Design` status, meaningful Description, native Acceptance Criteria, and
returned regular task path. Verify no path other than that exact returned task
path was newly changed and do not stage unrelated pre-existing changes.

Preserve the selected store topology. If the selected built-in store is an
ignored independent ordinary-Git clone, require canonical code HEAD clean and
upstream-equal, require the nested clone clean at the direct remote
`refs/heads/prime-claw/tasks` head, commit only the returned task path inside
that clone, push `HEAD:refs/heads/prime-claw/tasks` without force, and prove the
direct remote head while code HEAD stays unchanged. Otherwise keep the
existing branch-local flow: commit only the returned task path in the code
repository, prove the commit contains no other path, and attempt one prompt
push when a remote is available. A push failure is transport evidence to
report, not permission to undo the valid local specification, create another
task, or begin planning.

### Beads

For an existing task, immediately before the single guarded update perform one
more supported native pull and complete raw reread. Compare it field for field
with the synchronized view. Incorporate a compatible in-scope clarification as
the current living specification. Stop without a write for a genuine semantic
conflict, authority change, or scope expansion. Do not replace this judgment
with a byte-equality approval gate or semantic classifier.

After the one create or update, reread with
`bd show TASK-ID --json --long --include-comments` and capture native
revision, publication-ref, and clean working-set evidence. Require exact
canonical identity, native `in_design` status, and the intended meaningful
`description` and acceptance criteria. A create establishes that complete raw
view as the exact baseline. An update must leave every unrelated raw field
unchanged apart from provider-generated revision/timestamp data caused by the
write.

Publish exactly once with `bd dolt push --no-adopt`. Then perform one native
post-publication pull/read cycle and exact revision/ref proof. Require the final
published raw task to equal the verified post-write view and the working set to
remain clean. An unrelated-task descendant revision is compatible only when the
exact target-task view is unchanged. Any failed or uncertain pull, create,
update, push, or proof is evidence to report, not permission to retry, force,
adopt, reset, overwrite, or create another task. Beads authoring performs no
Backlog command or Git task-file commit.

## Keep the specification alive

The selected provider-native task is the living source of truth. Update its
supported specification fields promptly whenever discussion, review, or manual
POC work produces a durable clarification, correction, constraint, or learning.
Replace stale content rather than accumulating a chronological journal. Do not
defer updates until the end of a long conversation or rely on chat history,
memory, a later compaction summary, a provider mirror, or a parallel plan file.

## Stop for operator review

After verified publication:

- report the selected provider, canonical task ID, exact project root, and
  native `In Design` status;
- for Backlog, link the exact task path and report the task-only commit and push
  evidence separately;
- for Beads, report the exact raw pre-write (when revising), post-write, and
  final published task views plus provider revision/publication-ref evidence,
  without dumping unrelated provider data;
- explicitly ask the operator to review the saved specification; and
- stop without planning, writing an implementation plan, creating a branch or
  worktree, creating ownership state, or starting an Episode.

Apply requested specification revisions to the same exact native `In Design`
task with these identity, mutation, publication, and proof rules. Do not advance
to planning unless the operator later invokes the separate `/plan TASK-ID`
workflow. Specification approval authorizes planning only; it never authorizes
implementation.
