# Prime Claw project initialization and template reconciliation

Prime Claw installs one global plugin generation and keeps project policy as
regular, tracked, customizable files. `/initialize-prime-claw` and the
model-callable `initialize_prime_claw` tool expose the same initialization and
upgrade UX. Template reconciliation never stages or commits files. An explicit,
confirmed task-provider switch is a separate maintenance operation described
below and uses each provider's native publication history.

## Asset inventory

`src/prime-agent-plugin/asset-inventory.json` is the schema-2 delivery
authority for every shipped plugin source. Each source appears once. Explicit
target classes distinguish exact plugin files, drift-managed global files, the
user-level goals skill, the selected-context role block, and customizable
project files.

Global discoverable skills are `goals-and-heartbeats`,
`prime-claw-expert-review`, and `prime-claw-oversee-episode`. `ROLE_KERNEL.md`
and the goal-continuation fragment are global internal assets. Project skill
sources remain under `src/prime-agent-plugin/skills/project-templates/` but use
plain `.md` filenames, so installing the plugin cannot expose them as global
`SKILL.md` candidates.

An initialized project contains these regular customizable files:

- `.agents/skills/{blocked,design,design-legacy,execute,prepare,spec-it-out,spec-it-out-legacy}/SKILL.md`
- `.prime-claw/workflows/conversation-after-handoff.md`
- `.prime-claw/workflows/handoff.md`
- `.prime-claw/workflows/implement-prep.md`
- `.prime-claw/workflows/implement-spec.md`
- `.prime-claw/workflows/implement-task-prep.md`
- `.prime-claw/workflows/implement-task.md`
- `.prime-claw/workflows/plan-prep.md`
- `.prime-claw/workflows/plan-spec.md`
- `.prime-claw/workflows/plan-task-prep.md`
- `.prime-claw/workflows/plan-task.md`

The workflows are lifecycle inputs, not slash-discoverable skills. Native
`/plan TASK-ID` and `plan_task` load `plan-task-prep` and `plan-task`. `/implement-task TASK-ID` now loads the reconciled `implement-task-prep` and
`implement-task` policies before one exact `create_task_episode` call. The
retained `implement-prep` and `implement-spec`
assets continue to serve existing future-folder bundles during the migration.
The legacy `.ralph/skills` tree and `.agents/skills` symlinks are migrated away.
`.ralph/plans` is never moved or interpreted as template content.

`conversation-after-handoff.md` is the one project-customizable policy read at
runtime rather than only at lifecycle admission. After a successful
`handoff_spec_episode` or `handoff_task_episode` admission, the plugin loads
this exact project file (never a plugin-template fallback) from the owning
Conversation's project, so reconciling it preserves the project's customized
policy and prompt. Its single configuration key, `threshold_percent`, is
normalized from equivalent forms: `.6`, `60`, and `60%` all mean 60%; bare
values at or below 1 are ratios, bare values above 1 are percentages, and a
percent suffix always divides by 100. Omitting the key defaults to 60. `0` or
`0%` disables the automatic post-handoff compaction; enabled values must fall
within 10-100% inclusive (normalized 0.1-1), and negatives, values above 100%,
and malformed entries are rejected. The trigger is a strict comparison:
utilization must exceed the threshold, and unknown utilization skips the
attempt. Configuration or delivery trouble produces only a bounded warning on
the otherwise successful handoff receipt; it never fails a handoff, retries,
or re-dispatches the Episode. Deployment and UAT of a refreshed generation
remain a later explicitly approved cutover (user-global refresh, coordinated
full restart, resumed owner/Episode proof), not something copying the file
into a project proves.

This builder repository intentionally records `prepare`, `design`, and
`spec-it-out` as project customizations. Its authoring copies state the
repository-local task-native default after data cutover, while the plugin-root
delivery sources stay generic for other initialized repositories. Reconciliation
preserves those bounded customizations; it does not use tracker choice to retire
the separately named legacy assets.

## Project selection and Orca registration

Initialization starts at the current directory and uses Git's nearest-worktree
root. Starting below that root needs no confirmation. A nested repository,
submodule, or linked worktree is its own target and is reported as such. If Git
would reach the user's HOME before a project root, initialization fails before
creating a lock, directory, or Orca registration.

Explicit initialization looks up Orca repositories by exact canonical path. It
reuses an existing registration without changing metadata. If none exists, it
adds that exact path once and then verifies the resulting identity. Orca failure
is visible; independently safe file reconciliation is not rolled back. Automatic
startup reconciliation is lookup-only and never auto-registers arbitrary Git
repositories.

## Template manifest and reconciliation

Projects track `.prime-claw/templates.json`. It stores hashes and provenance,
not duplicate template bodies. Every project asset records:

- the current available upstream hash;
- the upstream baseline last installed or explicitly accepted against;
- the exact installed or observed project hash;
- an optional accepted-override hash;
- whether the asset is managed, customized, or an accepted override; and
- inventory provenance.

A missing asset is created. A managed file still matching its recorded installed
hash is safely updated when upstream changes. Unknown or customized files are
preserved. An accepted override remains settled against the same upstream; a
later upstream produces a new comparison instead of an overwrite. Safe assets
continue when another destination is blocked.

Reconciliation serializes through `.prime-claw/reconcile.lock`, reclaims only a
well-formed lock whose recorded local PID is proven dead, rejects symlink (including dangling symlink) or
special-file collisions at managed leaves and ancestor directories in assets and state, writes replacements and manifests atomically, and
never commits. A completed managed upstream file rename is healed if interruption left the
prior manifest. Explicit resets use a durable reset-intent record so the same
recovery is safe from customized or accepted-override state. Current manifest
bytes are not rewritten. Ambiguous lock or content state remains blocked. A current project is a silent no-op. An interrupted template
review blocks reconciliation until the operator chooses recovery.

Known legacy assets migrate only when an inventory entry declares an explicit
`migrateFrom` path. New assets with no predecessor omit that field. A recognized `.agents/skills` symlink
is removed only when it points to the corresponding legacy skill. Customized
legacy regular-file bytes move to the new regular destination and remain marked
customized. Unknown legacy entries remain in place and are reported; there is no
recursive delete.

## Task-history publication choice

Normal initialization selects the primary code branch upstream, or the sole
repository remote, as the Backlog task-history publication authority. Ambiguous
remotes block. A repository with no remote also blocks by default. If the
operator explicitly accepts unpublished local-only history, use
`/initialize-prime-claw --unpublished-local-only` or tool
`action="reconcile", unpublishedLocalOnly=true`. That route creates or reuses
one clean independent nested Backlog repository on `prime-claw/tasks` with no
remote, labels the result unpublished, and never treats it as admission,
terminal-publication, or cleanup proof. Startup reconciliation never selects
this route implicitly. Adding and selecting a remote later remains a separate
operator action.

## Startup ordering and Episode snapshots

The plugin's awaited `session_start` handler first verifies that the Git project
is already registered with Orca. It then awaits the complete deterministic
reconcile before Prime Agent accepts the initial prompt. Newly created, migrated, updated,
or recovered discoverable skill paths are returned through Prime Agent v0.9.8's
post-start `resources_discover` seam, so the same first session receives both their
slash commands and model-visible skill entries. It sends no user message and starts
no model turn. Changes, conflicts, or degraded state produce one
concise UI notice; a current project is silent.

An active Episode worktree is skipped. It retains the project workflow snapshot
with which it started. Runtime handoff readers prefer the new topology but retain
read-only fallback to the corresponding legacy `.ralph/skills/{handoff,execute}`
bytes, so an old-layout active Episode can finish without policy migration. The implementation has an injected activity seam for the one minimal ownership
record and a bounded reader that scans the current Git worktree set to find that
record in the canonical project checkout when startup occurs inside a linked
Episode worktree. Live version-1 activity also requires its readable active plan
pair. An older blocked-only pair is uncertain until the exact
operator-authorized restore revalidates that same recorded worktree; the
reconciler never restores it or selects another mode. Linked-worktree
enumeration or identity uncertainty fails closed and reports a degraded skip.
Reset, override acceptance, and review-start mutations use the same protection.

## Customized-template review

Reconciliation reports customization but never starts a visual review. Review is
a separate explicit lifecycle driven through `initialize_prime_claw` actions:

1. `review-request` explains that review will temporarily overwrite the tracked
   file and foreground its Orca worktree. It asks the operator for **ready** or
   **cancel**. Cancellation before readiness changes nothing.
2. `review-start` is legal only after explicit readiness. It requires a clean,
   tracked regular file, records recovery state, writes the upstream bytes, and
   runs `orca file diff <path> --worktree path:<exact-root> --focus --json`.
3. The overwrite remains held after the open command. `opened: true` is not
   visibility proof. The operator confirms that the comparison is visible and
   then explicitly completes or cancels.
4. Completion, cancellation, and open errors restore with
   `git restore --worktree -- <path>` and verify both index and worktree clean.
5. If held bytes change, cleanup is uncertain, or the process that owned a held
   comparison exits, current bytes remain preserved until explicit `review-restore`
   or `review-keep`. A still-live held-review owner must complete or cancel normally.

A terminal tracked-file `git diff -- <path>` result is the fallback
when Orca cannot open the comparison. The restored comparison is returned directly
in both slash-command and model-callable tool output. Prime Claw does not invoke Orca Computer Use, macOS Accessibility,
an OS permission prompt, or another GUI-control API for this workflow.

## Confirmed task-provider switch

An initialized project can inspect and then explicitly confirm a one-time switch
between Backlog and Beads without a second tracker command or durable migration
coordinator. `/initialize-prime-claw --switch-request <backlog|beads>` is
read-only. It reports the selected source provider, exact source revision and
digest, complete open/closed/archived counts, active version-2 ownership count,
the semantic-placement prompt, and the exact confirmation requirement. It does
not create a destination, change ownership, or write a receipt.

`/initialize-prime-claw --switch-confirm <provider> <revision> <actor> <semantic-placement-prose>` is itself the explicit confirmation and requires the
reported source revision, a non-empty actor, and the managed semantic-placement
prose. The tool equivalent uses `action="switch-confirm"`, `targetProvider`,
`expectedSourceRevision`, `actor`, `semanticPlacement`, and
`confirmedSwitch=true`. When inspection lists a Backlog field that cannot
project to one Beads value without a decision, the structured tool also requires
one task-specific `beadsNativePlacements` entry with the actual
destination-native field. Priority
is a Beads integer `0..4`; a multi-assignee Backlog source requires one non-empty
native `assignee` string. One entry can carry both fields. The slash form remains
available when no structured native value is required. Managed prose is retained
for audit and is never parsed into a provider value. The literal value is applied
and read back from the native destination before guarded source deletion. The
confirmed maintenance window is one linear operation:

1. capture every source task plus its provider-native bytes or rows, all open,
   closed, and archived states, relationships, comments, native history,
   provenance, actor, timestamp, and transition evidence;
2. create the target through its supported native initialization and create
   APIs, preserving source IDs when the target accepts them and otherwise
   recording an immutable source-to-destination mapping;
3. let the managed model decide only fields that have no exact native equivalent,
   pass any indispensable provider-native literal through the pair-specific
   structured confirmation field, and prove the applied value by native readback;
   prose remains audit evidence while deterministic code proves counts,
   projections, relationships, complete commit messages/histories, revisions,
   and mappings;
4. publish and re-read the complete target, then write one final
   destination-native migration receipt containing the exact source and target
   revisions, digests, counts, mappings, actor, semantic-placement record, and
   cutover time;
5. atomically remap only active version-2 task bindings in
   `.prime-claw/ownership.json`, preserving every Episode, session, worktree,
   branch, operation, runtime route, resource, and provider-native task view;
6. re-prove the source is unchanged, activate and re-prove the sole target, and
   remove the source only after every check succeeds. Backlog-to-Beads cutover
   then publishes Beads' native `.gitignore`, `config.yaml`, `metadata.json`,
   and `README.md` so the provider choice survives a fresh code checkout; the
   live Dolt database and runtime files remain provider-managed and ignored.

A preserved active Episode can still have code-tracked bytes for the old
provider at its historical head after either cutover direction. Those bytes
remain part of the unchanged code snapshot, not a live provider store.
Linked-worktree detection ignores stale code-tracked Backlog bytes only after
canonical primary proves sole Beads authority, and ignores stale code-tracked
Beads metadata only after canonical primary proves sole Backlog authority.
Independent nested Backlog source clones are live replicas rather than code
snapshots, so guarded cutover removes the exact clean source clone from every
active Episode as well as canonical primary. While canonical primary still
contains both stores, ordinary task lifecycle mutation remains blocked as an
incomplete migration.

Backlog archived records are interpreted only in a disposable exact-revision
clone: their unchanged Markdown is temporarily placed in that clone's active
corpus so the repository-built Backlog native reader supplies the structured
view. Native active and archived drafts are part of the same complete inventory.
Their exact Markdown, Git history, native draft view, original kind, and
active-or-archived placement are preserved in Beads-native metadata and notes;
drafts count as open work while archived drafts retain abandonment placement.
The live source store remains untouched and authoritative. Beads reads use
published clean Dolt revision proof, `bd show --long --include-comments`, native
history, provenance, and relationship queries. Backlog-to-Beads uses an
untracked (`--stealth`) target store so `bd init` cannot change the still-live
Backlog code revision.

Before destination creation, every active Episode is re-proved as the exact
clean, directly published linked code worktree and branch. The ownership head is
preserved as historical identity; migration separately captures the actual
current code head, proves `baseRef → historical head → current head` ancestry,
keeps that current head stable, and uses it for the native Git and Orca
continuity proofs. Its branch-local Backlog task bytes or shared provider revision
must equal the captured source. The migration also reuses the ordinary Episode
continuity checks: one exact idle durable session, current runtime route, and
exact Orca worktree/terminal resources when applicable. Those code, source, registry, and
runtime checks repeat beside the atomic ownership replacement and guarded
source-deletion boundary. The existing ownership lock refuses deletion if the
complete switched registry changes.

Beads capture rejects any effective `export.exclude_owners` filter, exports all
native issue records, and requires its duplicate-free IDs to equal an
independent read-only `issues` inventory before either counts or deletion can be
certified. Backlog completion counts come from exact native lifecycle status;
physical archive placement remains separate abandonment evidence. A Backlog
destination is repeatedly proved against the originally selected remote URL and
`refs/heads/prime-claw/tasks`, not a mutable local upstream alias.

A pre-cutover failure restores an ownership change only after a complete native
re-read proves that the exact source and every active source workspace remain
intact and unchanged. It then leaves the source authoritative and reports exact
cleanup or same-destination retry guidance. If deletion partially retired the
source, ownership stays on the verified destination and the result is truthfully
`cutover-incomplete`; an existing directory alone is never treated as source
authority. An
explicitly reconfirmed retry is admitted through the otherwise blocked dual-store
window only after the source revision and every existing destination marker,
mapping, receipt, publication, and source digest prove that it is the same
migration. When an active Episode already has the clean exact Backlog destination
clone from the failed attempt, ordinary exact-remote fetch and fast-forward-only
reconciliation advances that same clone to the newly verified receipt revision;
dirty, foreign, ahead, or divergent clones remain blocked. Ordinary lifecycle
discovery remains blocked. The operation never
creates a second destination or retries automatically. Source deletion is
refused on source drift, destination drift, incomplete proof, ownership drift,
or ambiguous provider selection. There is no dual write, mirror, provider
selection file, sidecar receipt, persistent lock, phase record, checkpoint, or
resume state. The final destination-native receipt is the only durable
migration artifact. Actual migration of a production repository remains an
operator-authorized upgrade action; initialization and ordinary startup never
perform it automatically.

## Global drift

`scripts/manage-prime-agent-delivery.py` drives plugin apply/check from that
same manifest and protects drift-managed global Markdown assets. Managed bytes update safely. Unknown or changed
bytes are preserved by default and make readiness fail visibly. Exact current
upstream bytes safely repair stale managed/customized provenance after an interrupted
managed update or a manual restoration. An operator may
choose `--global-drift-action accept-override` to accept the current bytes
against this upstream or `--global-drift-action backup-reset` to create and
verify a timestamped backup before reset. A later upstream change reopens an
accepted override comparison.

The selected role block remains under the final-only role reconciler
because `AGENTS.md` can contain independently owned surrounding content. Its
source and generation come from the delivery manifest. Project `templates.json`
and plugin delivery state retain their distinct ownership records.

## Validation and migration boundary

[The PRIMECLAW-44 embedded-source proof](evidence/beads-embedded-source-capture-20261030.md)
records a disposable native read path without custom statuses, a Beads remote,
or server mode. It is evidence for the planned retiring-source repair, not a
claim that the current migration supports that source or that destination
publication and source retirement have been proven.

Plugin-source changes are validated only in Docker Tier 1. The deterministic
core is separate from the thin Prime Agent v0.9.8 adapter (`registerCommand`,
`registerTool`, and awaited `session_start`). Prime Claw remains pinned to v0.9.8
until a released upstream CWD fix and supported Orca lifecycle, identity, and
finality integration pass acceptance tests. This code adds no speculative v0.10
behavior or adapter. Any future runtime change must re-prove extension loading,
startup-before-prompt ordering, command/tool registration, skill discovery, and
notices before changing the adapter.
