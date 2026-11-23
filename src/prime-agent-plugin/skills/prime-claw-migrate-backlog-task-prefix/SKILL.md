---
name: prime-claw-migrate-backlog-task-prefix
description: >-
  Rehearse or carry out an operator-authorized task ID prefix change in an
  existing Backlog.md store without renumbering tasks or rewriting history.
---

# Migrate a Backlog task prefix

Use this manual maintenance guide only when Backlog is already the project's
selected task provider. It is not setup, a CLI, or an automatic migration. To
switch from Beads to Backlog, use `/skill:initialize-prime-claw` and its separate
provider-switch workflow. Do not use that workflow to rename Backlog IDs.
Read `/skill:goals-and-heartbeats` if it is not already in context.

## 1. Bind the exact change

- Identify the project, existing canonical store and Git layout, current
  `task_prefix`, Backlog binary/version, and exact task-history ref. If the
  store has independent Git history, work in that history, not product main.
  Record the base commit and, if published, the exact remote and ref. Confirm
  the base is the current published tip, not just a stale remote-tracking ref.
  For an already approved local-only store, use its authoritative local tip;
  do not create a remote or publish it.
- Confirm the operator's selected old and new prefixes against the observed
  config and the installed version's accepted format. Treat case as the
  provider does; reject a no-op or collision. Inspection or rehearsal is not
  live authority. Before cutover, require explicit operator authorization for
  this project/store, old → new, live scope, and publication target (or local
  only). An explicit conditional go-ahead is enough once its conditions pass.
- Require a clean, current task store. Before cutover, verify no open Prime
  Claw Episode is bound to a mapped old ID/path, including idle or blocked
  owners. Resolve uncertain ownership through the owning Conversation; do not
  rewrite ownership, reuse an old binding, or force terminal cleanup. Pause
  task writers and Episode admission across sessions, hosts, worktrees, UI and
  automation until verification or rollback is complete. If the store, ref,
  owner state, or writer pause cannot be verified, stop.

## 2. Rehearse on a disposable copy of the exact base

Use a separate checkout/store with no live write path or push destination.
Confirm the CLI resolves that copy before any scratch writes.

1. Inventory files as well as native views; a board/list can silently omit
   records. Include all statuses (including Done), drafts, `archive/tasks/`,
   archived drafts, legacy `completed/`, and any other native task locations
   used by this version. Capture each old ID, path, lifecycle bucket, native
   content and relationship, and its proposed new ID/path. Account for any
   branch/worktree records the native store reads or reserves for allocation;
   stop if their scope or identity is unclear. Check IDs and paths for
   collisions using native and filesystem case rules.
2. In one candidate change, set `task_prefix`, rename each native filename's
   ID portion, update the record's native `id`, and remap exact same-store
   targets in native relationship fields (for example parent, dependencies,
   and native related/reference fields where present). Keep native case
   conventions and preserve the entire suffix byte for byte, including dotted
   segments and leading zeros: `OLD-007.02` → `NEW-007.02`. Keep the directory,
   filename slug, lifecycle, metadata, content, and relationship meaning.
   Backlog 1.55.3 does not provide a supported native rename or prefix setter;
   make the narrowly scoped file changes in the copy. Do not delete/recreate,
   globally replace text, or convert the store layout. Review mutable task
   links individually, and list out-of-scope links that would need follow-up.
   Keep immutable commit-pinned URLs, historical text and external IDs as-is.
3. Compare the complete baseline and candidate native views (for example
   `backlog task view --json -- <id>` and equivalent draft/archive reads for
   the installed version). Every mapped identity must resolve in its native
   bucket, with the same fields and relationships except the planned ID/path
   changes. Where the binary does not expose a native view, compare physical
   records and all preserved fields, and verify identity/reservation by the
   available native behavior. Check the diff against the map and review
   missing views, unexpected changes or unresolved links before proceeding.
   A clean `backlog doctor` or matching list count does not prove completeness.
4. On scratch copies only, create a throwaway task on each side and verify
   that the next allocation preserves the expected suffix and uses the new
   prefix. Preserve other rules that affect allocation in the rehearsal, or
   stop if the result would not represent the live store. Commit only the
   migration candidate, not the probes. Rehearse reverting that one commit
   on a scratch copy and verify it restores the original tree and views.

## 3. Cut over and verify

Recheck the clean base, exact ref, writer pause, and lack of old-ID owners just
before applying the rehearsed change. If the base drifted, stop and re-establish
and rehearse the current base before a newly considered attempt. Commit the
config, filenames, and native IDs/relationships together as one normal Git
commit with no unrelated changes. Publish only to the authorized existing
remote/ref, without force. In an independent store, leave product main
unchanged. In a branch-local store, honor that branch’s normal publication
rules. Do not activate anything globally as part of this procedure.

Verify the actual published commit on that ref (or local commit for local-only
history), the complete mapped native views, and the next allocation on a fresh
disposable copy. Check that readers/writers will use the verified revision,
not a stale old-prefix store, before lifting the pause. Report the base and
migration commit, destination, counts, next allocation, immutable link and
follow-up treatment, and any blocker.

On failure or uncertain transport, keep writers paused and inspect the actual
local and remote state. Do not retry automatically or publish to a second ref.
If rollback is needed and authorized, before further task writes revert the
exact migration commit on the same ref, publish the revert only there if
applicable, and verify the restored tree and original native views. Do not
reset or rewrite history. If there have been subsequent writes or the revert
conflicts, stop for operator review rather than discarding or remapping data.

## Evidence from Prime Agent Pi

`PAPI-59` records the Backlog 1.55.3 `TASK` → `PAPI` rehearsal. Config-only and
mixed-prefix stores hid old records, including archived tasks, without a
`doctor` warning. The coordinated migration preserved all 59 native task views
except expected ID/path changes, allocated `PAPI-60` in a copy, and restored
all 59 old views on reversal. A separate fixture verified dotted IDs,
parent/dependency links, and archive lookup/restore. Published inventory links
pinned to old commits remained valid. The live migration was one commit on
`prime-claw/tasks` (`1747adddf6c286fd260c6f26952b9af2ebc5ffdf`), not product
main. These prefixes and results are evidence, not defaults or a substitute
for rehearsal with the current binary and store.
