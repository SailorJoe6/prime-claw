# Prime Claw project initialization and template reconciliation

Prime Claw installs one global plugin generation and keeps project policy as
regular, customizable files that the operator may track. The globally discoverable
`initialize-prime-claw` Markdown skill guides setup, upgrades, text comparisons,
and one-way migration through the model-callable `initialize_prime_claw` tool.
There is no custom initializer command/action syntax for the operator to learn.
Template reconciliation never stages or commits template assets. Explicit setup
may preserve an existing store in an independent task-history DAG, commit and
publish that history, and stage only original task-path deletions in the code
index. It leaves code branch HEAD unchanged; root-link and ignore bookkeeping
remain explicit code changes. An explicitly confirmed task-provider switch is a
separate maintenance operation described below and uses native publication history.

## Asset inventory

`src/prime-agent-plugin/asset-inventory.json` is the schema-2 delivery
authority for every shipped plugin source. Each source appears once. Explicit
target classes distinguish exact plugin files, drift-managed global files, the
user-level goals skill, the selected-context role block, and customizable
project files.

Global discoverable skills include `initialize-prime-claw`, `goals-and-heartbeats`,
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

## Local Git exclusion on first directory creation

Only when Prime Claw itself creates a previously absent root `.prime-claw/`
directory, it appends the exact root-anchored `/.prime-claw/` rule to Git's
local exclusions. This applies to explicit initialization, registered-project
`session_start` reconciliation, and the ownership or retained-inventory paths
that first create the directory. Existing comments, patterns, bytes, and order
are preserved. An existing exact rule is not duplicated. Other generated
project skills and unrelated untracked files are not hidden by this rule.

The exclude path comes from `git -C <root> rev-parse --git-path info/exclude`,
not a constructed `<root>/.git/info/exclude` path. Linked worktrees normally
share the main repository's exclude file; Prime Claw keeps Git's sharing
semantics. It never edits `.gitignore`, stages files, or commits as part of this
behavior. Exclusions do not untrack files already in Git's index.

If `.prime-claw/` already exists when the operation starts, Prime Claw does not
change exclusions. To deliberately track the directory, remove `/.prime-claw/`
from the Git-resolved exclude file, then add and commit the desired files.
Later initialization and startup reconciliation do not restore the removed
rule or repair a missing exclusion for an existing directory.

If resolving or updating the exclusion fails, directory and asset creation
continue. Agent-facing tool output and startup notifications warn that the worktree
may remain dirty, include the cause, and give manual remediation using the
resolved path when available. There is no later retry while the directory
exists. Skipped reconciliation and operations that do not create the directory
do not authorize an exclusion edit.

## Template manifest and reconciliation

Projects may track `.prime-claw/templates.json`. It stores hashes and provenance,
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
operator explicitly accepts unpublished local-only history, the agent uses tool
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

Explicit Backlog adoption on canonical primary also preserves nonterminal
Backlog Episode task bindings. If detaching an ordinary selected store or moving
its default path would change a bound task's authority or exact path, preparation
refuses before store, index, or task-history publication changes. The result names
the affected owner and task. Continue or resolve that Episode through its existing
lifecycle before retrying adoption; initialization does not rewrite its binding
or perform a continuity transition. Unrelated bindings and providers do not block
adoption, and an already independent store at an unchanged path remains usable.

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
Reset and override-acceptance mutations use the same protection. Text comparison
is read-only; interrupted legacy-review recovery is a separate explicit decision.

## Customized-template comparison and explicit decisions

The initialization skill requests an ordinary Git patch as text through
`initialize_prime_claw(action="review-request", assetId="...")`. The comparison
uses disposable inputs containing the actual current asset and upstream bytes.
It never overwrites, stages, restores, or foregrounds the real asset and leaves
its Git index unchanged, including clean, dirty, and staged assets. No special
viewer, Orca focus, ready/visibility confirmation, or new held-review state is
needed. A patch is information, not acceptance.

After reading it, the operator may explicitly accept the current customization
(`accept-override`) or reset that exact asset (`reset`). Neither decision is
inferred from silence or from requesting the patch. Existing legacy interrupted
review state is not discarded: reconciliation and destructive content decisions
remain protected until the operator explicitly chooses `review-restore` or
`review-keep` for that recorded comparison. This recovery path preserves its
existing evidence; new comparisons never create overwrite recovery state.

## Confirmed task-provider switch

The public migration entry points support **Beads to Backlog only**. Reverse
requests refuse before project lookup or native commands. The existing
`initialize_prime_claw(action="switch-request", targetProvider="backlog")`
interface is read-only. It
reports exact Beads identity/capture revision and digest, complete
open/closed/archived counts, active version-2 ownership count, the
semantic-placement prompt and explicit confirmation requirement. Inspection does
not create a destination, change ownership or write a receipt.

Explicit inspection can read Beads alongside a valid default, hidden or
root-config-selected custom Backlog destination. Ordinary discovery still blocks
dual providers, and active Beads lifecycle readiness remains strict. This
explicit migration preserves existing selected task records, configuration,
history, and independent clone identity. It is not permission to replace or
recreate the destination or to reset configuration. Only default `backlog/` is
normalized to `.backlog/` plus the standard native root configuration symlink in
both explicit initialization/install and migration. Hidden and custom selected
stores stay in place; code-tracked history and original IDs remain preserved.
There is no separate preservation-approval gate. The root link retains the whole
native root configuration. If that authority differs from an inactive folder
`config.yml`, preserve both files: the selected store carries the authoritative
`backlog.config.yml`, and the code-root link names that exact safe relative
file. Identical existing root/folder configurations may retain the standard
`config.yml` or `config.yaml` target. Native readback must preserve effective
settings and the configured custom location; no defaults or pointer overlay
replace either configuration.

The agent calls `action="switch-confirm"`, `targetProvider="backlog"`,
`expectedSourceRevision`, `actor`, `semanticPlacement`, and `confirmedSwitch=true`
only after explicit operator confirmation of the exact inspected source and the
quiesced maintenance window. Viewing inspection output never
confirms a switch. The existing native Beads package importer keeps every raw
value/history; managed prose may choose human-facing placement but never permit
omission. The confirmed maintenance window is one linear operation:

1. capture every source task plus its provider-native bytes or rows, all open,
   closed, and archived states, relationships, comments, native history,
   provenance, actor, timestamp, and transition evidence;
2. preserve existing Backlog IDs, content, history and configuration, and reuse
   the existing Beads importer with native Backlog create operations and the
   exact returned source-to-destination ID mapping;
3. retain the existing field/status/history/relationship projections and record
   managed semantic-placement prose for non-equivalent fields without omitting
   raw values. There is no reverse-migration structured confirmation field or
   new mapping policy. Native readback proves counts, projections, relationships,
   complete histories, revisions and mappings;
4. publish and re-read the complete target, then write one final
   destination-native migration receipt containing the exact source and target
   revisions, digests, counts, mappings, actor, semantic-placement record, and
   cutover time;
5. atomically remap only active version-2 task bindings in
   `.prime-claw/ownership.json`, preserving every Episode, session, worktree,
   branch, operation, runtime route, resource, and provider-native task view;
6. re-prove the source is unchanged, activate and re-prove the sole target, and
   remove the source only after every check succeeds. Outgoing remote Beads
   history is retained; source publication is not a retirement prerequisite.

A preserved active Episode can still have code-tracked bytes for the old
provider at its historical head after cutover. Those bytes
remain part of the unchanged code snapshot, not a live provider store.
Linked-worktree detection ignores stale code-tracked Backlog bytes only after
canonical primary proves sole Beads authority, and ignores stale code-tracked
Beads metadata only after canonical primary proves sole Backlog authority.
Independent nested Backlog source clones are live replicas rather than code
snapshots, so guarded cutover removes the exact clean source clone from every
active Episode as well as canonical primary. While canonical primary still
contains both stores, ordinary task lifecycle mutation remains blocked as an
incomplete migration.

Existing Backlog physical records are preserved individually, including archives
that share an ID with a live task or another historical record. Archived native
views are read only in disposable exact-revision clones; the real records never
move merely to inspect them. Preservation checks cover authored native fields,
exact files/configuration, Git history and clone identity. Corpus-derived native
readiness, graphs and subtasks may change as imports add records; authored
content must not. Destination counts include preserved baseline records plus
all imports and the single receipt.

Archived means deleted/history. Only actual `tasks/` and `completed/` records
are eligible dependency targets. A reused live ID is not ambiguous because an
archive retains it; archive-only targets refuse as missing/deleted. Genuine
live/completed ambiguity, unknown/self references and direct/transitive cycles
still refuse. Archive enumeration/history and native ID allocation/reuse do not
change. A real source relationship to a deleted task is reported with exact IDs
before mutation, never omitted or automatically repaired. No allocation flag,
reservation, prefix change, archive renumber, or new importer mapping is used.

Before destination creation, every active Episode is re-proved as the exact
clean, directly published linked code worktree and branch. The ownership head is
preserved as historical identity; migration separately captures the actual
current code head, proves `baseRef → historical head → current head` ancestry,
keeps that current head stable, and uses it for the native Git and Orca
continuity proofs. Its branch-local Backlog task bytes or complete shared Beads
capture must equal the captured source. The migration also reuses the ordinary Episode
continuity checks: one exact idle durable session, current runtime route, and
exact Orca worktree/terminal resources when applicable. Those code, source, registry, and
runtime checks repeat beside the atomic ownership replacement and guarded
source-deletion boundary. The existing ownership lock refuses deletion if the
complete switched registry changes.

The migration export helper reads `bd --readonly export --all` and compares its
duplicate-free IDs with `bd --readonly list --all --limit 0 --include-infra
--include-templates --include-gates --include-ephemeral --json`. It does not
require SQL or clear source export filters. A filter that actually omits an
issue produces an inventory mismatch and leaves the source configuration
unchanged. Beads source packages retain the raw CLI version and complete raw
status-catalog response alongside issue views, unbounded issue history/events,
and provenance. Migration-only source reads bind the native `context` and
`dolt show` store/database/connection identity. The confirmation revision is a
`capture-sha256:` token over that identity, raw version/catalog, and complete
issue/history packages, not a required outgoing published Dolt commit. The same
capture is repeated from primary and active source workspaces through guarded
retirement; task, catalog, history or identity drift refuses cutover. No source
custom lifecycle setup, server conversion, remote, push or publication is
required. Ordinary active Beads lifecycle/write checks remain strict.

Before any Backlog destination preparation or write, the complete used-status
inventory is checked with the existing projections. All unsupported-used statuses
and genuinely contradictory archive evidence are reported together with exact
source IDs/statuses; unused catalog entries do not block. Legacy `open` maps to
`In Design`; ordinary `closed` maps to `Done` and native `completed/` placement.
A nonempty `close_reason`, keyword or status category does not mean archive.
Archive requires a coherent retained marked Backlog archive source package or
the exact task-specific Prime Claw abandonment reason. Ambiguous exact evidence
stops for agent/operator judgment without adding a mapping or approval framework.
Native Backlog refuses archiving `Done` tasks. Exact-positive archives retain
the existing importer archive operation and its created `In Progress` status;
ordinary completion uses `Done` plus `task complete`. The importer verifies the
native status and actual `tasks/`, `completed/` or `archive/tasks/` placement for
all records, including archives.
Raw catalog/category, reason and complete history remain in source provenance.

After destination publication and ownership/runtime/source rechecks, retirement
removes the exact local `.beads` store. Embedded mode makes no server-stop call;
a server-mode source must identify a non-shared server before the native stop.
Any outgoing remote history is retained untouched; it is not local live provider
authority. Backlog completion counts come
from exact native lifecycle status;
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
records the native read proof, bounded capture-data integration, and retiring-source
boundary work without source custom lifecycle setup, a Beads remote or server
mode. The accepted Slice 1c embedded fixture uses only supported
open/in-progress/blocked statuses and a fresh Backlog destination. The bounded
Slice 1d adds used-status preflight and ordinary closure versus exact-evidence
archive handling; its separate validation state is recorded in that evidence
file. Unsupported statuses still require semantic resolution, not a new guessed
projection. Populated-destination preservation, layout normalization and the
complete initialization task remain unproven by these fixtures.

[The separate native destination-layout de-risk proof](evidence/backlog-destination-layout-20261030.md)
tests whole-configuration root symlinks and same-repository Git moves for default,
hidden and custom selected stores. Its validation state and limits are recorded
there. It changes no production initialization/preparation/migration path and
proves neither populated-store adoption into independent history nor complete
native cross-branch visibility after relocation. Those remain separate unfinished
integration seams, not a reason to recreate existing tasks or relax safeguards.

[The bounded root-configuration preservation increment](evidence/backlog-root-config-preservation-20261030.md)
extends existing independent workspace preparation: built-in and custom selected
root configurations retain their whole bytes through exact relative root links,
with replay and native folder filename checks. Its validation state and limits
are recorded there. Default-folder relocation, ordinary-store adoption, full
initialization/migration layout integration and populated imports remain
unfinished; this increment does not replace their existing safeguards.

[The migration-only entry-admission increment](evidence/migration-entry-admission-20261030.md)
allows explicit read-only Beads capture alongside valid Backlog evidence and
refuses unsupported reverse requests before native commands. Confirmation
retains its existing exact-retry/destination guards; populated imports and layout
normalization remain unfinished, not bypassed by inspection permission.

[The populated hidden-store attempt](evidence/populated-hidden-backlog-import-20261030.md)
retains the failed historical runs and rolled-back patch. Joe explicitly resolved
the old blocker: archive/live same-ID dependency ambiguity was incorrect native
eligibility semantics, not an allocator defect or permission to alter IDs. The
managed Backlog correction uses tasks/completed-only dependency targets while
preserving archive history and ordinary allocation. Historical passing tests
prove their old bounded behavior only; current complete-candidate validation
must explicitly prove the superseding semantics and remaining requirements.

Plugin-source changes are validated only in Docker Tier 1. The deterministic
core is separate from the thin Prime Agent v0.9.8 adapter (`registerCommand`,
`registerTool`, and awaited `session_start`). Prime Claw remains pinned to v0.9.8
until a released upstream CWD fix and supported Orca lifecycle, identity, and
finality integration pass acceptance tests. This code adds no speculative v0.10
behavior or adapter. Any future runtime change must re-prove extension loading,
startup-before-prompt ordering, command/tool registration, skill discovery, and
notices before changing the adapter.
