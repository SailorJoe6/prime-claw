# Prime Claw project initialization and template reconciliation

Prime Claw installs one global plugin generation and keeps project policy as
regular, tracked, customizable files. `/initialize-prime-claw` and the
model-callable `initialize_prime_claw` tool call the same deterministic
reconciler. They never stage or commit files.

## Asset inventory

`src/prime-agent-plugin/asset-inventory.json` is the authoritative inventory for
all 15 shipped Markdown assets. Each row records its stable identity, one source
path, global or project scope, discoverable or internal exposure, customization
policy, destination, and lifecycle trigger.

Global discoverable skills are `goals-and-heartbeats`,
`prime-claw-expert-review`, and `prime-claw-oversee-episode`. `ROLE_KERNEL.md`
and the goal-continuation fragment are global internal assets. Project skill
sources remain under `src/prime-agent-plugin/skills/project-templates/` but use
plain `.md` filenames, so installing the plugin cannot expose them as global
`SKILL.md` candidates.

An initialized project contains these regular customizable files:

- `.agents/skills/{blocked,design,execute,prepare,spec-it-out}/SKILL.md`
- `.prime-claw/workflows/{handoff,implement-prep,implement-spec,plan-prep,plan-spec}.md`

The workflows are lifecycle inputs, not slash-discoverable skills. The legacy
`.ralph/skills` tree and `.agents/skills` symlinks are migrated away.
`.ralph/plans` is never moved or interpreted as template content.

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

Known legacy assets migrate by allowlist. A recognized `.agents/skills` symlink
is removed only when it points to the corresponding legacy skill. Customized
legacy regular-file bytes move to the new regular destination and remain marked
customized. Unknown legacy entries remain in place and are reported; there is no
recursive delete.

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
bytes, so an old-layout active Episode can finish without policy migration. The implementation has an injected activity seam for the
minimal ownership record introduced by the lifecycle work and a bounded reader
that scans the current Git worktree set for the current project-level legacy
Episode identity during migration. Linked-worktree enumeration or identity
uncertainty fails closed and reports a degraded skip. Reset, override acceptance,
and review-start mutations use the same protection.

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

A terminal tracked-file `git diff --no-ext-diff -- <path>` result is the fallback
when Orca cannot open the comparison. The restored comparison is returned directly
in both slash-command and model-callable tool output. Prime Claw does not invoke Orca Computer Use, macOS Accessibility,
an OS permission prompt, or another GUI-control API for this workflow.

## Global drift

`scripts/manage-prime-agent-global-assets.py` protects the global Markdown
assets during plugin apply/check. Managed bytes update safely. Unknown or changed
bytes are preserved by default and make readiness fail visibly. Exact current
upstream bytes safely repair stale managed/customized provenance after an interrupted
managed update or a manual restoration. An operator may
choose `--global-drift-action accept-override` to accept the current bytes
against this upstream or `--global-drift-action backup-reset` to create and
verify a timestamped backup before reset. A later upstream change reopens an
accepted override comparison.

The global role kernel remains under the separate role-protocol manager because
`AGENTS.md` can contain independently owned surrounding content. Project
`templates.json` and plugin-global drift state are distinct authorities.

## Validation and migration boundary

Plugin-source changes are validated only in Docker Tier 1. The deterministic
core is separate from the thin Prime Agent v0.9.8 adapter (`registerCommand`,
`registerTool`, and awaited `session_start`). Prime Claw remains pinned to v0.9.8
until a released upstream CWD fix and supported Orca lifecycle, identity, and
finality integration pass acceptance tests. This code adds no speculative v0.10
behavior or adapter. Any future runtime change must re-prove extension loading,
startup-before-prompt ordering, command/tool registration, skill discovery, and
notices before changing the adapter.
