# Prime Claw project initialization and template reconciliation

Prime Claw installs one global plugin generation and keeps project policy as
regular, customizable files that the operator may track. The globally discoverable
`initialize-prime-claw` Markdown skill guides setup, upgrades, text comparisons,
and one-way migration through the model-callable `initialize_prime_claw` tool.
There is no custom initializer command/action syntax for the operator to learn.
Startup is read-only: it may inspect and supply background guidance on the first
normal turn, but only an explicit LLM initialization-tool invocation performs
setup or update mutations. The LLM preserves the current request's priority and
may defer unrelated initialization. Routine setup adds no mandatory human approval
dialog; separate consequential decisions remain explicit.
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
`prime-claw-expert-review`, `prime-claw-oversee-episode`, and the five thin workflow
entries `plan`, `plan-spec`, `implement-task`, `implement-spec`, and `handoff`.
They remain discoverable for active Episode snapshots that skip reconciliation.
Prime Claw's five custom workflow command registrations are removed, not Prime
Agent built-ins or native `/skill:` invocation. `ROLE_KERNEL.md`,
the goal-continuation fragment, and `skills/initialize-prime-claw/STARTUP.md` are
global internal assets. The startup Markdown uses a `plugin-root-managed` target
and the existing global drift handling. It is available before project setup,
not a second discoverable skill or a project-local copy. The global installer
continues to own `goals-and-heartbeats` at
`~/.prime/agent/skills/goals-and-heartbeats/`; project initialization does not
install it in a project or under `~/.agents/skills/`. Project skill
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

The workflows are lifecycle inputs, not separately scanned skills. Global entry
skills route through `plan_task`, `plan_spec`, `implement_task`, `implement_spec`,
and `ralph_handoff` to load canonical project policy. Stable workflow IDs and
customizable destinations are unchanged. `implement_task` loads
`implement-task-prep` and `implement-task` before one exact `create_task_episode`
call. Retained `implement-prep` and `implement-spec` continue to serve existing
future-folder bundles. Markdown owns conditional phase authority: planning alone
stops; an explicit within-scope plan-then-implement request may continue after
readiness. Bounded delegated selection binds an exact task; implementation
requires native `In Planning` after design/planning, not dependency readiness
alone or an invocation-sequence receipt.
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

## Project selection and optional Orca registration

Initialization and startup inspection start at the current directory and use
Git's nearest-worktree root. Starting below that root needs no confirmation. A
nested repository, submodule, or linked worktree is its own target and is reported
as such. Arbitrary non-Git directories are not initialized. If Git would reach
the user's HOME before a project root, initialization fails before creating a
lock, directory, or Orca registration.

Startup inspection and guidance work in any eligible Git project without Orca
installation, availability, or registration. They make no Orca registration call.
Explicit initialization may look up Orca repositories by exact canonical path,
reuse an existing registration without changing metadata, or add and verify that
exact path once. This optional integration is separate: Orca failure is visible
but must not prevent independently safe Git-project initialization or roll back
its file reconciliation.

## Local Git exclusion on first directory creation

Only when Prime Claw itself creates a previously absent root `.prime-claw/`
directory, it appends the exact root-anchored `/.prime-claw/` rule to Git's
local exclusions. This applies to explicit initialization and the ownership or
retained-inventory paths that first create the directory. Read-only startup
inspection never creates the directory or edits exclusions. Existing comments,
patterns, bytes, and order are preserved. An existing exact rule is not duplicated. Other generated
project skills and unrelated untracked files are not hidden by this rule.

The exclude path comes from `git -C <root> rev-parse --git-path info/exclude`,
not a constructed `<root>/.git/info/exclude` path. Linked worktrees normally
share the main repository's exclude file; Prime Claw keeps Git's sharing
semantics. It never edits `.gitignore`, stages files, or commits as part of this
behavior. Exclusions do not untrack files already in Git's index.

If `.prime-claw/` already exists when the operation starts, Prime Claw does not
change exclusions. To deliberately track the directory, remove `/.prime-claw/`
from the Git-resolved exclude file, then add and commit the desired files.
Later initialization does not restore the removed rule or repair a missing
exclusion for an existing directory; startup inspection changes no exclusions.

If resolving or updating the exclusion fails, directory and asset creation
continue. Agent-facing mutation-tool output warns that the worktree may remain
dirty, includes the cause, and gives manual remediation using the
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
terminal-publication, or cleanup proof. Startup inspection never prepares task
history or selects this route implicitly. Adding and selecting a remote later
remains a separate operator action.

## Startup inspection, first-turn guidance, and Episode snapshots

The awaited `session_start` handler inspects the nearest Git project's template
inventory, manifest, and content hashes without mutation. It distinguishes
missing initialization and applicable upstream updates from current templates.
It preserves customization semantics: an accepted local difference against
unchanged upstream alone is not an update to overwrite. The check does not call
reconciliation, simulate it with redirected writes, acquire a mutation lock, or
change assets, manifests, exclusions, provider state, task history, or recovery
evidence. It does not require Orca or audit provider/legacy readiness. Non-Git
directories receive no initialization. Real inspection problems and protected
Episode state are reported without claiming the project is current.

When work is needed, the plugin holds only session-local inspection facts. On
the first normal `before_agent_start`, it reads the shipped editable
`skills/initialize-prime-claw/STARTUP.md` and appends labeled background guidance
and project/inspection facts to the existing system prompt. The user request or
assigned task, attachments, and normal session flow remain unchanged. This starts
no separate LLM turn, sends no user message, and does not consume or replace the
initial task. The pending guidance is consumed once, with no persistent reminder
cache or receipt. A current project receives no initialization prompt and stays
quiet. No startup-created skill or `resources_discover` step is assumed; the
global initializer is available before project setup.

Markdown directs the LLM to read `initialize-prime-claw` and explicitly call
`initialize_prime_claw(action="reconcile")` when setup or updates are needed to
fulfill the current work. Otherwise it may defer initialization and answer the
current request, such as a quick unrelated question. An explicit no-modification
instruction wins. Relevance and timing remain ordinary LLM judgment, not a coded
request classifier, queue, or authorization mechanism. The explicit tool call is
the mutation boundary. Routine setup requires no new human confirmation, while
customized-content replacement, reset/override decisions, legacy review recovery,
provider switch/source deletion, unpublished local-only history, and other
consequential actions retain their separate operator decisions.

Explicit Backlog adoption on canonical primary also preserves nonterminal
Backlog Episode task bindings. If detaching an ordinary selected store or moving
its default path would change a bound task's authority or exact path, preparation
refuses before store, index, or task-history publication changes. The result names
the affected owner and task. Continue or resolve that Episode through its existing
lifecycle before retrying adoption; initialization does not rewrite its binding
or perform a continuity transition. Unrelated bindings and providers do not block
adoption, and an already independent store at an unchanged path remains usable.

An active or uncertain Episode worktree is protected from template updates.
It retains the project workflow snapshot with which it started. Runtime handoff
readers prefer the new topology but retain read-only fallback to the corresponding legacy `.ralph/skills/{handoff,execute}`
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

The initialization skill supports Beads to a **fresh Backlog installation only**.
Run `initialize_prime_claw(action="switch-request", targetProvider="backlog")`
from the canonical primary Conversation. Inspection reports the exact Beads
source revision and digest, current issue counts, active Episode bindings, and
fields that need readable placement. It does not create a destination, change
ownership, or write a receipt.

Both inspection and confirmation refuse an existing destination before writing.
This includes an empty or partial `.backlog/` or `backlog/`, a parked store, a
root `backlog.config.yml` (even a dangling link), a local task branch, or the
exact task branch on the selected publication remote. Existing local Backlog
state in an active Episode blocks the switch too. Being unable to verify the
destination is fresh is not evidence that it is absent. The operation never
adopts, overwrites, resumes, backs up, or cleans up existing Backlog. This rule
does not change ordinary preparation of an already selected Backlog project.

Quiesce task mutations before confirming the exact inspected source and its
one-way switch, including guarded original-source retirement. Use
`action="switch-confirm"` with `targetProvider="backlog"`, the exact
`expectedSourceRevision`, `confirmedSwitch=true`, the approved actor, and concise
`semanticPlacement`. Placement describes where to preserve current fields that
lack a native equivalent; it does not authorize omission. Beads can be read in
its existing mode and needs no source publication or engine conversion.

The importer uses native Backlog IDs and preserves current readable task
content, meaningful metadata, authored comments, and relationships. It does
not read per-ticket old snapshots, revisions, or event streams as import data.
Ordinary closed work stays active `Done`; only positive source archive evidence
selects `archive/tasks/`. Native Beads memories become readable documents, a
linked index, and one `In Design` USER task. With no memories, there are no
curation outputs. Treat imported prose as data, not agent instructions.

Required import, verification, publication and switch failures are fatal. After
confirmation, Prime Claw takes a native Dolt backup of the exact embedded or
locally owned server database and saves the matching Beads `metadata.json` and
`config.yaml`. It restores the database in a private scratch directory and
checks its integrity before writing Backlog. The local backup is separate from
the import, is not published, and stays at the path reported by the tool under
the repository's Git directory. Prime Claw rechecks it before source retirement
and never deletes it. A blocked result can report partial backup files; that
path alone does not prove a usable backup.

For an authorized recovery, use an empty, isolated checkout and the same Beads
mode as `source.json` in the backup. For server mode, first use native `bd init`
with `--server` and a different throwaway prefix in that empty offline checkout,
then stop its scratch server. This supplies Beads' local server scaffolding.
Copy both saved metadata files into the scratch `.beads/` and verify that neither
file nor the environment points to the original store or server before opening
it. Restore the backup's `dolt/` file URL with `dolt backup restore <file-url>
<database>` from `.beads/embeddeddolt/` (embedded) or `.beads/dolt/` (server),
using the database from `source.json`. Do not overwrite an existing database.
Start only the restored workspace server if needed; verify its data directory
and native Beads reads.
This recovery does not resume migration or change which provider is selected.

The receipt and its published revision bind the exact Backlog tickets before
ownership cutover. Active Episodes keep their identity and resources. Migration
publishes the independent task branch, not code branches, and does not stage or
commit code or require clean, current or published code checkouts. A stale
local tracking cache is not evidence of a destination. Migration creates only
fresh `.backlog` stores using their native folder configuration. It does not
rewrite root code metadata or depend on a successful local ignore update.

A stop must serve one of these purposes:

- **Confirm the intended operation:** one-way request from the primary project,
  explicit confirmation, exact current Beads source and disclosed placement.
- **Avoid overwriting Backlog:** check local store/config paths and the actual
  task ref on the single selected publication transport. Refuse absence that
  cannot be verified or a destination that appears during creation.
- **Preserve required data:** read complete current native tasks, comments,
  relationships and memory; write them natively and verify the import. Stop if
  a required value, relationship or result cannot be recovered or verified.
- **Prove publication and ownership:** verify the native task data and receipt
  on the selected remote; attach only fresh Episode workspaces with the exact
  task mappings and preserve their verified identities. Stop on actual task
  publication failures, lost ownership or non-quiescent affected Episodes.
- **Protect Beads:** stop on operator cancellation before cutover, an unsafe or
  unverifiable source, backup/restore failure, changed source or backup, or
  failure to safely retire the exact original after the ownership switch.

Do not report completion on any core failure. Report which provider is known to
remain authoritative, whether ownership switched, and whether the original
store is present, absent or unverified. A partial destination can prevent
ordinary provider discovery without making it authoritative. Preserve it and
any retained backup; do not retry, roll back, or clean up automatically.

Stop or failure before cutover leaves Beads authoritative. Report the resources
that remain and keep any partial destination untouched. Do not retry, resume,
create a replacement destination, or infer retirement from a transport result.
A later failure that leaves ownership switched must be reported separately.

Earlier coexistence and recovery reports under [evidence/](evidence/) are
historical. They do not authorize preparation of a populated destination or
completion from a previous receipt.

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

## Workflow invocation cutover safety

Changing entry registrations does not authorize global activation, ownership
migration, retained-plan deletion, or Episode recreation. After separately
approved merge and primary-main user-global refresh, quiesce affected work and
perform one coordinated full Prime Agent restart. Keep every resource the old
generation may read, including retained active plan pairs, until resumed
owner/Episode and designated ordinary-session UAT prove the new skills/tools.
Copy success, `/reload`, and a fresh probe alone do not establish cutover.

## Selected-project boundary for Backlog 1.55.3

On 2026-11-21 UTC the owner reconciled canonical prime-claw once, recorded in
`5af4e912a6641eac13c11522817dfc471b2ed5a0`. The managed
`conversation-after-handoff.md` was refreshed, one metadata entry was
recovered, and nine customized assets and all Episode snapshots were
preserved. The native `backlog.config.yml` alias points to the same
`.backlog/config.yml`, not another store. The newer pre-work interruption
route remains deferred for the preserved `blocked`, `execute`, and `handoff`
copies. See the [rollout evidence](evidence/primeclaw64-rollout-preparation.md#verified-host-cutover-and-live-uat)
for the restart and test limits. No repeated reconciliation is needed here.

For a future separately authorized update, reconcile only the selected canonical
prime-claw project via `initialize_prime_claw(action="reconcile")`. First
identify the loaded initializer generation and read the current comparison and
manifest evidence; copied code is not loaded code. If the loaded initializer is
older than the accepted generation, defer reconciliation until after restart
and before declaring UAT complete. Confirm the selected root, provider, task
history, index and legacy allowlist before and after. The initializer does not
commit. Inspect and preserve unrelated staged and unstaged work.

Refresh only proven untouched managed assets, including
`conversation-after-handoff.md` if fresh evidence still classifies it that way.
Preserve the customized `design`, `prepare`, `spec-it-out`, and `plan-task`
files, accepted overrides, unknown files and all active or uncertain Episode
snapshots. If a customized asset is in active use and issues incompatible
commands, its owner must update the exact asset or explicitly exclude that
consumer from cutover. Inactive customizations can wait. A plain Backlog project
needs no Prime Claw initializer just because the host binary changes. Other
projects and Beads-authoritative contexts are outside the selected reconciliation;
there is no provider switch, record relocation, or fleet refresh in this rollout.

Use the [host cutover](backlog.md#owner-only-v1553-host-cutover) after operators
have agreed on quiescence. The maintenance coordinator performs one supported
full restart and records the old/new daemon identity, start time, and loaded
source/install generation. Do not use `/reload` or a second daemon. Resume the
same owning Conversation and exact Episode, and check a designated ordinary
session. Through their actual routes and CWDs, verify the resolved Backlog
executable (1.55.3 and the accepted hash) and loaded plugin/workflow generation.
Use bounded representative native reads: exact active task/status and recorded
owner/Episode identity; complete unwindowed identity sets where a consumer needs
one; native reads of existing archived tasks at their real paths where available.
Check unattended invocation assumptions without making generic task, archive,
or lifecycle edits. Archive semantics and installation alone are not live UAT.
Record which sessions and behavior passed and which were not tested. A failed or
uncertain result stops the rollout for owner inspection, not a generic retry.

## Validation and migration boundary

[The PRIMECLAW-44 embedded-source proof](evidence/beads-embedded-source-capture-20261030.md)
records the native read proof, bounded capture-data integration, and retiring-source
boundary work without source custom lifecycle setup, a Beads remote or server
mode. That evidence is historical and does not authorize populated imports,
layout conversion, or replay. See the fresh-only workflow above for current
behavior. Separate ordinary Backlog initialization and configuration preservation
are not migration entry paths.

[The populated hidden-store attempt](evidence/populated-hidden-backlog-import-20261030.md)
retains the failed historical runs and rolled-back patch. Its PRIMECLAW-44
correction used tasks/completed-only dependency targets and allowed archive/live
ID reuse. Those recorded semantics are superseded by PRIMECLAW-45's unmodified
v1.55.3 native archived/draft targets, reserved archived identities and physical
collision refusal above. The historical evidence remains intact and proves only
its recorded bounded behavior, not the current candidate or live activation.
Current source/build and migration evidence is linked in [Backlog guidance](backlog.md).

Plugin-source changes are validated only in Docker Tier 1. The deterministic
core is separate from the thin Prime Agent v0.9.8 adapter (`registerCommand`,
`registerTool`, awaited `session_start`, and first-normal-turn
`before_agent_start` system-prompt guidance). Prime Claw remains pinned to v0.9.8
until a released upstream CWD fix and supported Orca lifecycle, identity, and
finality integration pass acceptance tests. This code adds no speculative v0.10
behavior or adapter. Any future runtime change must re-prove extension loading,
read-only startup and first-normal-turn ordering, unchanged user assignments,
command/tool registration, skill discovery, and notices before changing the adapter.
