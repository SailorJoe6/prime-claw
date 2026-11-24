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

The public migration entry points support **Beads to Backlog only**. Reverse
requests refuse before project lookup or native commands. The existing
`initialize_prime_claw(action="switch-request", targetProvider="backlog")`
interface is read-only. It
reports exact Beads identity/capture revision and digest, complete
open/closed/archived counts, active version-2 ownership count, the
semantic-placement prompt and explicit confirmation requirement. Inspection does
not create a destination, change ownership or write a receipt.

Migration commands capture complete stdout through private temporary files and
file descriptors, not a fixed pipe-output buffer. This applies to current source
export/inventory/long task views and destination history-preservation reads,
including recapture. Retiring Beads per-ticket history/events/provenance are not
read as migration prerequisites.
The existing parsers still read complete strings, so available memory, string
capacity and temporary storage remain real limits. A resource or capture failure
blocks the operation; partial output is never certified as complete. Each command
closes its descriptors and removes its own temporary files on handled success or
failure. Source authority and the existing cutover protections remain intact.

Command/capture failures report a bounded command label and available error code,
native exit status and signal. Ordinary command failures may include a short
stderr excerpt, but diagnostics never substitute captured stdout or echo native
JSON payloads. Empty stderr and a null native status do not hide `ENOBUFS`.
Transport/resource advice addresses capture or execution, not trimming required current content,
changing task status or repairing otherwise readable source data. Invalid native
JSON is reported separately without quoting its contents. Resolve the reported
failure before requesting another inspection; no transport retry or migration
confirmation is automatic.

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
confirms a switch. PRIMECLAW-59 corrects migration to current ticket state only;
managed prose chooses readable placement of non-equivalent current content,
not whether to import revision archives. Source capture omits historical reads.
The forward importer and complete-receipt replay now use the accepted readable
current-content projection and full native verification, not encoded packages
or chunk comments. Recovery and complete-task acceptance remain unfinished. This candidate is not permission to retry a live migration. See the
[source-capture evidence](evidence/primeclaw-59-current-state-capture-20261121.md)
and [integration evidence and limits](evidence/primeclaw-59-current-integration-20261121.md).

The migration-only native Web transport in
`extension-support/migration-backlog-web.ts` serves forward current-task authoring
and lossless configuration reads. Fresh complete-receipt replay and forward
import share one owned `backlog browser --no-open --port <selected>
--non-interactive` process. It pins `BACKLOG_CWD` and cwd to the prepared project,
uses only that child's actual loopback bind announcement, then checks native
`/api/status` for the exact canonical project and prepared Backlog directory.
An occupied port can cause native selection of a different free port; the
transport never attaches to the foreign listener.

Task POST/PUT bodies, HTTP results, browser logs and native CLI readback are
private file-backed transport data, not task archives. CLI readback uses the same
pinned project context. Migration-local synchronous Backlog commands also pin
BACKLOG_CWD for each call and immediately restore its previous value. The
pair-specific caller compares complete authored fields/comments/relationships.
Successful close removes ephemeral
transport files; failure keeps them in the error's private `artifactDirectory`
for bounded inspection. Public errors contain stage/outcome metadata, never
provider responses or payload-bearing stderr. A failed or uncertain write fences
further writes and shuts down only owned process groups, with bounded TERM/KILL
escalation and exit checks. There is no automatic resend, CLI fallback,
rollback, provider cleanup or source retirement. See the
[owned transport evidence and limits](evidence/primeclaw-59-owned-web-transport-20261121.md).

After successful import and native readback, `owned-process-stop-unproved`
is a warning: shutdown was not proved, and private transport files are
retained. The importer sends no more migration Web writes and still requires
the usual data publication, receipt verification, and cutover checks. The
warning does not override a migration error or a stop request. If work and
teardown both fail, the result reports the primary failure first.

Before guarded cutover, use the ordinary Prime Agent stop (Escape in the
interactive UI, or `abort` in RPC). Progress notices show major phases and
elapsed time. Prime Agent may acknowledge the abort or show an idle turn before
migration has settled. Wait for the switch outcome notice: `pre-cutover-stopped`
means the importer did not proceed to cutover. If the outcome warns that owned
Web shutdown was not proved, do not treat it as confirmation that writers have
stopped. Beads stays
authoritative and any partial Backlog state and diagnostics stay in place. An
in-flight native write may already have committed; do not retry, roll back or
clean up on the strength of an abort alone.

Stop is cooperative. Synchronous source, layout, CLI, and Git work cannot be
preempted; a queued stop takes effect at the next cancellable phase boundary.
After the "Guarded cutover starting" notice, the existing verified ownership,
source retirement and code publication sequence runs to its guarded outcome.
An ordinary abort does not interrupt that sequence. Keep task mutation quiesced
until the actual outcome is known. See the
[public operator-stop evidence](evidence/primeclaw-59-operator-stop-20261122.md).

The pair-specific readable-content helper is integrated from
`extension-support/beads-backlog-current.ts`. It builds one current-ticket
projection for native Web authoring and complete native CLI verification. Native
fields carry equivalent content. Concise labeled current values retain meaningful
metadata and exact values that native formatting cannot represent directly.
Actual authored comments remain comments, with readable source author/time.
The initial native task write includes a small source-ID/reference binding;
that marker alone never proves complete content. Configured type/priority options
are inputs to this projection, not settings it replaces. Deferral-only fields
are dropped under the existing deferral mapping. Only Beads `blocks` edges
become Backlog dependencies; the parent hierarchy stays in the native parent
field. Once all destination IDs are known, other relationship types are written
as one labeled migration comment per affected task, separate from source
comments. Native readback and receipt replay verify the type, source endpoint,
and mapped destination ID using the receipt’s recorded placement.

A source comment heading named `Final Summary` is content, not task closure.
The pinned native Markdown reader can otherwise interpret it as a legacy task
section when no source summary exists. The projection uses its existing labeled
exact JSON string representation for that content. The complete body and heading
remain readable and recover exactly, with source author/time retained; no task
summary is invented and full native readback remains mandatory. Ordinary source
headings stay ordinary prose. See the comment-heading red/green evidence in the
same [readable-content dependency evidence](evidence/primeclaw-59-readable-current-projection-20261121.md).

Forward import allocates parent-first with initial source/current references and
only actual source comments. One native dependency batch per applicable task
sets mapped relationships after all IDs exist. Full CLI verification checks
current fields, AC, assignees, comments, supplemental metadata and relationships
before data publication, again after publication, and on refresh/replay. Native
archive placement remains separately checked. Equivalent configured type/priority
choices come losslessly from the owned native `/api/config` JSON response;
comma-bearing configured names are not split. Receipt and memory USER creation
use an actual configured type fallback without replacing configuration.

Initial references identify a partial allocation but never verify its content.
Imported source comments that resemble old migration/receipt markers remain
ordinary comments; the native source reference distinguishes them from migration
bookkeeping. Existing complete-receipt reuse verifies all imported current
content before any reauthoring; an incomplete or changed record stops without
automatic completion, duplicate allocation or cleanup. Legacy encoded import
evidence is preserved but is not silently promoted to current-content proof.
The initial retiring source identity is recorded once in the existing receipt;
whole source envelopes/catalogs/memory collections are not repeated in tickets.
Memory documents/index/USER remain a separate once-only treatment.

The one owned browser and readback descendants stop before publication/cutover.
Early replay failures also close only owned transport resources. Failed or
uncertain allocation/write/readback retains truthful partial state and private
transport evidence; no resend, fallback allocation, reconciliation, rollback or
record deletion is automatic. This does not add ordinary responsive-worker
cancellation, interrupted-import recovery, parked-configuration reconciliation,
progress, or 406-ticket performance acceptance. Existing baseline/publication,
source-drift, active-Episode continuity and guarded cutover checks remain. See
[helper evidence](evidence/primeclaw-59-readable-current-projection-20261121.md)
and [integration evidence and limits](evidence/primeclaw-59-current-integration-20261121.md).

### Selected-existing configuration compatibility (bounded increment)

Migration preparation uses the selected destination's real native settings, not
ordinary fresh-init lifecycle/default/auto-commit requirements. Ordinary
preparation and lifecycle policy are unchanged. Existing `default_status`,
`auto_commit` (including true), configured priority/type names, unknown keys,
comments and all non-status settings remain. USER memory bookkeeping still
explicitly requests `In Design`; a custom default is not substituted for it.
Native task auto-commits, hooks, author identity and failure effects are not
silently disabled.

Pinned Backlog 1.55.3 has no status-list setter. Its CLI explicitly supports
editing the project YAML list directly. Whole-config CLI/Web setters discard
unknown keys/comments and are not used. Even normal CLI reads can first rewrite
sparse/legacy config. A migration-only pre-native check refuses missing native
startup fields/task prefix or unproven legacy milestones before such reads;
there is no automatic normalization, rollback or alternate reader.

For an already safe selected config, add only missing mapped-current statuses,
receipt `In Progress`/`Done`, and memory USER `In Design` when needed. Native
matching ignores case and all whitespace; retain actual configured spelling and
never add a semantic duplicate. Missing active values go immediately before the
original last status, retaining old relative order and the final native terminal
(and the first value for multi-status lists). A required absent `Done` needs
separate placement resolution, not silent terminal change.

When an **actual source ticket** maps to `Done`, migration also requires that
its first canonical configured spelling is natively terminal. Authoring matches
case and all whitespace, but pinned native completion compares that spelling
with the final configured status using **trim + lowercase only**. Internal
whitespace therefore matters for completion. `Done` before `Cancelled`, or a
first `D o n e` before terminal `Done`, needs separate placement resolution.
Refuse before a bounded list's no-missing shortcut or any additive write. Repeat
the check against the one owned server's startup list for unsupported forms and
complete-receipt/import replay before allocation or reuse. Do not reorder the
list, replace its terminal/default, remap closed tickets or repair config. If no
actual source ticket maps to `Done`, receipt-only `Done` does **not** impose a
universal terminal-placement policy. See the separate
[completion repair evidence](evidence/primeclaw-59-completion-status-repair-20261121.md).

Bounded preparation handles JSON-compatible one-line flow (including a trailing
comma) and complete simple scalar block sequences. Raw old flow syntax stays;
block conversion refuses continuations, anchors, aliases, tags, dependent syntax
and implicit scalar guesses. Unsupported forms remain unchanged. They can
continue through native readback only if no required status additions are needed.

Prepare the list **before** starting the one owned native browser. Its startup
loads cached config; GET `/api/config` does not initialize lazy config watchers,
and watcher validation can reject otherwise valid inline comments. Hot reload
is therefore not the readback boundary. Do not remove comments, round-trip
config, start a second server or patch upstream to force it. Fresh native CLI
parsing and the **same owned server's startup** exact JSON list proof precede
allocation. Failed readback retains actual config and stops without another
write. Existing receipt/import replay never triggers automatic config repairs.

The existing in-memory original baseline permits exactly the computed list
addition and config-history entries containing it with the same native file
mode. Original history ancestry, other bytes/modes/paths/records, clone identity,
Git settings and placement stay protected. Existing receipt/import replay never
repairs configuration automatically. This does not consolidate parked configs, accept
ambiguous duplicate records, repair partial imports, or complete the remaining
cancellation/progress/scale work. Validation and limits are recorded in
[configuration evidence](evidence/primeclaw-59-config-preservation-20261121.md).

### Parked configuration and original history reconciliation (bounded increment)

This bounded candidate awaits independent review. Its focused parked/layout
checks and seven core migration/shared suites pass. An additional ownership test
still fails: its unchanged fixture writes a placeholder rather than the native
journal identity required by the unchanged handoff guard. No guard or fixture
was changed to hide the failure. See the linked evidence for exact results and
limits; the full project test selection is not all-green.

The confirmed migration path recognizes the inactive
`backlog/config.yml.pre-migration` without changing ordinary provider discovery
or fresh initialization. It keeps that original parked tree and its code index
unchanged and inactive. It copies original records, IDs, relative paths, bytes,
full permission modes and configuration into the exact native-selected hidden
or custom destination. With no selected destination it uses the normal
`.backlog/` target. An existing selected clone keeps its directory/`.git`
identity, branch, remote, transport and Git configuration; it is not replaced.

Reconciliation first builds a disposable ordinary-Git candidate. For
code-owned originals, native `git subtree split` retains the task-only history;
the original code commits remain unchanged in the code DAG, not as task-branch
ancestors. A non-squashed merge retains both that native task ancestry and the
existing published task ancestry. A published bootstrap is reused, not replaced
by a second destination or rewritten history. Existing compatible non-bootstrap
data is not itself a conflict.

The parked configuration remains byte/mode exact at its original path and as
`config.yml.pre-migration` in the selected store. Activating a copy changes only
native directory placement, followed by the already documented missing-status
edits. An untouched generated bootstrap may yield to the parked customization
only after checking its whole one-commit history, exact two-file tree and
configuration/marker identity (including the selected placement). Otherwise the
two active configurations must already agree after placement adjustment; a
meaningful disagreement stops without choosing a winner. Missing native startup
fields still refuse before a read can normalize custom settings. The existing
actual-source-completion and one-owned-server checks remain in effect.

Concrete file, mode, configuration, placement, ancestry or publication
conflicts stop with both sides retained. An existing unrelated live/archive
pair with a shared ID is preserved by exact physical path, content, mode, and
native history; the importer does not choose either record or make a new pair.
Native allocation reserves the ID. A marker in a title is not an import
reference. On clean selected-store replay, the native receipt identifies the
memory USER task even if it carries no import references. If that target has a
live/archive pair, migration refuses before destination layout changes or
publication. See the [coexistence baseline](evidence/primeclaw-59-same-id-coexistence-20261122.md)
the [revision tests](evidence/primeclaw-59-coexistence-revision-20261122.md), and
[Backlog handle compatibility tests](evidence/primeclaw-59-frontmatter-compatibility-20261122.md).
Only a non-force published descendant is
materialized by an ordinary fast-forward or initial clone. A pre-reconciliation
in-memory preservation check continues through the existing original baseline,
receipt refresh and cutover checks. It does not replace those checks or add a
recovery journal. An uncertain native operation is not resent or rolled back.

This increment does not authorize live migration, original cleanup, partial
import recovery, disposability, responsive cancellation/progress, scale or
whole-task acceptance. The focused fixtures and evidence limits are recorded in
[parked-store evidence](evidence/primeclaw-59-parked-store-reconciliation-20261122.md).

The confirmed maintenance window is one linear operation:

1. capture every source task's current provider-native rows and long view,
   all open, closed and archived states, current relationships/metadata and
   actual authored comments; do not capture historical revisions/events;
2. preserve existing Backlog IDs, content, history and configuration, and reuse
   the existing Beads importer with native Backlog create operations and the
   exact returned source-to-destination ID mapping;
3. retain current field/status/relationship projections and record
   managed semantic-placement prose for non-equivalent fields without omitting
   raw values. There is no reverse-migration structured confirmation field or
   new mapping policy. Native readback proves counts, projections, relationships,
   current content, revisions and mappings, plus existing destination history;
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

Existing Backlog physical records are preserved individually. Both legacy
`completed/` and canonical `archive/tasks/` are archived history regardless of
status. Read archived tasks through native `backlog task view --json -- ID` at
their actual committed paths, without cloning or relocating them for an active
view. Preservation checks cover authored native fields, exact files/configuration,
Git history and clone identity. Existing archived drafts retain exact files,
bytes, paths and history plus physical identity/collision checks; their unavailable
native view alone is not a blocker. Do not delete, promote, restore, relocate or
fabricate an active view of them. Active drafts and active/archived tasks still
require native evidence. Corpus-derived native readiness, graphs and subtasks
may change as imports add records; authored content must not. Destination counts
include preserved baseline records plus all imports and the single receipt.

PRIMECLAW-45 supersedes PRIMECLAW-44's dependency exclusions and archive-ID-reuse
policy. Archive is reversible, read-only history that preserves status and
relationships and reserves identity; restore before editing. Native archived
and draft dependency targets are supported. Physical ID conflicts across source
and destination live tasks, drafts and both archive layouts refuse before any
preparation/write, with exact diagnostics and unchanged original baselines.
Use the existing migration inventory and native identity/relationship checks,
not a parallel index, graph policy, allocator or automatic repair. Genuine
missing/ambiguous IDs and native relationship failures remain blockers; never
omit or repair a relationship to make migration pass. Native archived-only
`task delete` is the explicit permanent identity-vacating/relationship-cleanup
operation, not archive or a migration default. Identity-set reads remain complete,
unwindowed native JSON reads without assumptions about default row order.

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

The migration export helper reads `bd --readonly export --all` as a native
mixed export. Rows with `_type: "memory"` retain their original `key`, `value`
and export line; only issues participate in the duplicate-free ID comparison
with `bd --readonly list --all --limit 0 --include-infra --include-templates
--include-gates --include-ephemeral --json`. Memories are not issues and are
never sent to issue show/history/provenance commands or included in task counts.
Malformed memory rows, unsupported record types and genuine invalid, duplicate
or missing issues refuse inspection. The reader does not require SQL or clear
source export filters. A filter that actually omits an issue produces an
inventory mismatch and leaves the source configuration unchanged. The in-memory
Beads source capture retains the raw CLI version and complete status-catalog response
alongside current export rows, exact export lines and current native
`show --long --include-comments` views. They do not read per-ticket revision
history, database events or provenance logs. Migration-only source reads bind
the native `context` and `dolt show` store/database/connection identity. The
confirmation revision is a `capture-sha256:` token over that identity, raw
version/catalog, complete current issue content and memory packages, not a
required outgoing published Dolt commit or historical archive. A memory-only
change also changes this revision. The same capture repeats from primary and
active source workspaces through guarded retirement; current task content,
comments, relationships, memory, catalog or identity drift refuses cutover.
Older history-bound inspection revisions/receipts are not current-state proof;
this change does not automatically accept or repair an interrupted old import.
No source custom lifecycle setup, server conversion, remote, push or publication
is required. Ordinary active Beads lifecycle/write checks remain strict.

Confirmed migration creates one native Backlog document per memory, one
source/index document and exactly one USER curation task through the supported
Backlog CLI. Memory documents keep readable source text plus the complete escaped
native JSON record for exact key/value round-trip, including whitespace, Unicode
and control characters. The index records the source project/store and links to
the actual native document paths. The single task is explicitly `In Design` and
links to the index. The user, not the migration agent, reviews and integrates
useful material into project documentation or deletes unwanted imports.
Zero-memory input makes no native output commands and creates none of these
outputs. Native readback checks the actual document body and task evidence,
and verifies that every captured memory/index path still contains the same
native document. Native moves that leave stale index or USER task links refuse;
a successful missing-document CLI exit alone is not proof.

These outputs are part of the existing destination data commit and publication,
exact native readback, destination digest and single migration receipt. Source
issue counts/mappings stay issue-only; the optional USER task is counted
separately. Post-receipt and pre-retirement checks repeat the document/path/task
proofs and exact destination publication. A read-only Git blob check proves the
memory, index and USER paths contain the exact native bytes in the verified data
and receipt commits, including on replay. Ignored outputs refuse; migration never
force-adds files or changes ignore policy. Missing, changed or unpublished outputs
block source retirement. An exact-source same-destination replay reuses the native
identities in that receipt; it does not create duplicate imports, index or USER
work. An incomplete memory import without complete receipt-bound output evidence
remains a blocker, not permission for automatic retry, repair or a second destination.
If an explicit confirmed migration stopped after publishing both commits but
before cutover, the existing-store path can finish without reimporting or
republishing. It requires an independent `.backlog` clone with a directly
published receipt immediately after the bound data commit, an original baseline
that differs only by the expected additive statuses and receipt-bound outputs,
and the untracked generated `backlog.config.yml` link as the sole primary code
layout change. It verifies native task and memory content, original paths,
bytes and Git modes, the receipt-only delta, and the same Beads capture and
ownership mappings before using the normal guarded cutover. For unrelated
original live/archive pairs that share an ID, it verifies both physical paths,
bytes, modes and history against the receipt instead of inventing a native ID
view. Ambiguous import, receipt and memory targets still refuse. Partial
receipts, other history shapes and unrelated drift are not repaired or retried
by this path.

Beads stays authoritative until all destination, source, runtime and ownership
proofs succeed. Imported text is data, not instructions to execute.

Before any Backlog destination preparation or write, the complete used-status
inventory is checked with the existing projections. All unsupported-used statuses
and genuinely contradictory archive evidence are reported together with exact
source IDs/statuses; unused catalog entries do not block. Legacy `open` and
native `deferred` map to ordinary `In Design` tasks. Past, future or absent
`defer_until` does not change that projection. Migration drops active deferral
state, not ordinary text: titles (including `DEFERRED:`), descriptions, notes
(including reasons appended by `bd defer`) and comments are preserved. Old
deferral revisions are not captured or imported. No active deferral fields,
extra annotations or scheduling behavior are created,
and migration never normalizes the retiring source. Ordinary `closed` maps to
active `Done` in `tasks/`, without a completion move.
A nonempty `close_reason`, keyword or status category does not mean archive.
Archive requires a coherent retained marked Backlog archive source package or
the exact task-specific Prime Claw abandonment reason. Ambiguous exact evidence
stops for agent/operator judgment without adding a mapping or approval framework.
Explicitly archived imports receive their normally mapped status before native
archive, including `closed` → `Done`; do not force `In Progress` or infer a lost
pre-close status. Preserve raw status, closure reason and abandonment provenance.
The importer verifies native status and actual active or archive placement;
legacy `completed/` remains preserved archive input, while new archives use
`archive/tasks/`. No removed completion command or automatic permanent delete
is used.
Current raw catalog/category and closure reason remain bound by the source capture;
complete revision history is not migration content.

After destination publication and ownership/runtime/source rechecks, retirement
removes the exact local `.beads` store. Embedded mode makes no server-stop call;
a server-mode source must identify a non-shared server before the native stop.
Any outgoing remote history is retained untouched; it is not local live provider
authority. Backlog closed counts come only from active tasks in final status
`Done`; every record in either archive layout counts as archived regardless of
status. Archive placement is not by itself proof of abandonment or deletion.
A Backlog destination is repeatedly proved against the originally selected remote URL and
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

### PRIMECLAW-49 bounded-slice regressions

The focused Docker bridge covers a public synthetic 33-issue/19-memory export,
native typed issues and legacy untagged issues, malformed/incomplete inventories,
and a small native memory fixture with Unicode, whitespace and frontmatter-like
text. It checks memory-only value and raw-line digest changes, issue-only counts,
no memory keys in issue reads, and refusal before destination writes/deletion.
The existing populated Backlog bridge retains issue-only migration coverage.

Reproduce with the verified supported Prime Agent source selector described in
[`prime-agent-installation.md`](prime-agent-installation.md):

```bash
python3 -m pytest tests/test_task_provider_migration.py -q -m container -k "retiring_beads_source_boundary or populated_backlog_migration"
scripts/test-tier1.sh --probe
```

The native-output slice also exercises real CLI document create/update/view,
working index links, exactly one USER task, complete record round-trip, changed
or missing native output refusal, and zero-memory no-op. A focused native-move
regression also checks refusal for stale memory and index paths. Public controls use
supported native Beads writes; a synthetic NUL-bearing package passes through the
same native Backlog writer because NUL cannot be passed in process argv.

The final combined focused run passed both selectors (`2 passed, 7 deselected`).
Two earlier runs failed on fixture assumptions before exercising the importer:
a leading `---` value required the native `--` argument separator, and a fixture
SQL update did not change exported memory content. Those were corrected without
weakening source/refusal checks. The capture candidate's earlier intermediate
failures remain recorded in the task. This is not proof of migration-wide memory
publication, receipt/replay behavior, a live Nemo migration or host activation.
Those remain later work under the existing operator boundaries.

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
