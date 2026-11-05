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
initializing, switching, or mutating a provider. Never mix provider commands, mirror content, or create a folder under
`.ralph/plans`. Search the provider's queue to select work only when the operator
explicitly delegates selection within stated bounds; bind one exact canonical
`In Design` task before any task-specific mutation. Clarify unclear bounds.
Delegated selection never skips design or planning.

## Bind or create exactly one task

If the operator explicitly selected an existing task, use only that entire exact
canonical ID. Do not infer or substitute another task. Explicit bounded
selection as described above may resolve an existing task before mutation.
Otherwise, if the request might mean either create new work or revise existing
work but no exact ID is given, ask the operator before mutation.

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
- **Beads:** before the auto-committing create, follow the Beads consequence
  review below, then run one supported `bd dolt pull` and capture
  `bd context --json`, native revision/publication and working-set facts.
  Use one supported `bd --dolt-auto-commit=on create`
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

Immediately before mutation, synchronize and reread the intended task workspace
through the supported CLI. Inspect the selected task diff and any pre-existing
edits; incorporate compatible authorized changes, and consult on a real conflict
or unclear ownership. Unrelated staged, unstaged, or untracked task/code changes
and compatible history descendants are not cleanliness prerequisites. Never
absorb, stash, revert, or delete them to make publication succeed.

After creation or revision, reload `backlog task view --json -- TASK-ID` and
verify canonical ID, returned regular path, parent, `In Design` status,
Description, Acceptance Criteria and the intended field changes. Preserve all
unrelated fields. Commit each coherent ticket update as soon as it is ready,
and publish promptly, not at handoff, compaction, session end or admission.
Inspect the selected diff; use literal pathspecs for both `git add -- PATH` and
`git commit --only -- PATH` (`git --literal-pathspecs ...`). Verify that the
commit contains only that task path and excludes unrelated index entries.

Preserve the selected store topology. In an ignored independent ordinary Git
clone, commit inside that clone and push `HEAD:refs/heads/prime-claw/tasks`
without force. Verify direct publication and the native reread. Task-only work
must not write the code checkout's HEAD, index or files; unrelated concurrent
code changes do not prove this operation changed code. In branch-local mode,
make the same exact-task-only commit in the code repository and publish normally
when a remote exists; commit code separately. A native conflict or rejected or
uncertain push is evidence to inspect, not permission to retry, force, create
another task, or begin planning. Workflow rules belong here and in the invoking
LLM's judgment, not a second code-level admission or publication policy.

### Beads

Before every create, update, native history commit or push, inspect native
pending/staged changes and review publication consequences. Beads v1.3.1 stages
touched tables and commits the staged set: other pending rows in those tables
and already-staged changes can enter history during an auto-committing mutation,
BEFORE push. This is the approved multi-issue history exception, not per-issue
isolation. Disclose relevant consequences and consult before committing or
publishing unauthorized or unclear pending work. Pending/concurrent native work
can prevent a safe operation; judge the facts, not a blanket cleanliness or
quiescence rule. Never add a store, branch, row filter or dependency workaround.

Immediately before an existing-task update, perform the supported pull and
complete raw reread. Incorporate compatible in-scope refinements; stop for a
genuine semantic conflict, authority change or scope expansion. Inequality is
not an approval gate or a deterministic classifier. After the one create or
update, reread `bd show TASK-ID --json --long --include-comments`, revision,
publication-ref and working-set facts. Verify exact ID, native `in_design`,
the intended Description/acceptance changes and preservation of every unrelated
raw field apart from provider-generated revision/timestamps.

Commit each coherent authorized ticket update through supported native history
as soon as ready and publish promptly with `bd dolt push --no-adopt`. Inspect
`bd --readonly history TASK-ID --json --limit 0` (native CommitHash and Issue
snapshots) and revision inclusion before claiming a commit, and native
publication-ref/history evidence before claiming the exact task is published.
An exit-zero update may only log a trailing history-commit failure; successful
push, local HEAD and a local task read alone are not that proof. Report command
results/warnings and remaining working-set qualifications honestly. Use the
native post-publication read to inspect current facts; compatible descendants
and same-task refinements remain LLM judgment, not frozen-view equality. A failed
or uncertain result is not permission to retry, force, adopt, reset, overwrite
or create again. No Backlog command or fabricated Git task-file commit is used.

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
to planning without operator authority; load the `plan` entry skill and use
`plan_task` with this exact canonical ID when planning is requested.
Specification approval authorizes planning only; it never authorizes
implementation. A separate explicit conditional instruction to plan, then
implement when ready may authorize that sequence within approved scope; preserve
it through planning and compaction rather than requesting duplicate approval.
Implementation still requires native `In Planning` after design and planning
plus semantic readiness, not dependency readiness alone or a phase-history receipt.
