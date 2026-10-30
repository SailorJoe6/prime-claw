# B. Initialize and maintain a project

## US-03 — Make a Git project Prime-Claw-capable

**As a project operator, I want to initialize an existing Git project without
manually copying lifecycle files, so that it gains the standard Prime Claw
skills and workflows.**

The globally discoverable `initialize-prime-claw` Markdown skill guides the
agent through `initialize_prime_claw(action="reconcile")` to install or reconcile the project-owned `prepare`, `design`, `spec-it-out`,
`design-legacy`, `spec-it-out-legacy`, `execute`, and `blocked` skills plus the
`handoff`, task-native planning/implementation workflows, and the retained
`plan-prep`, `plan-spec`, `implement-prep`, and `implement-spec` runtime
workflows. Template assets are never staged or committed by reconciliation.
Explicit task-history preservation may commit/publish the separate task DAG and
stage only original task-path deletions in the code index. Code branch HEAD
stays unchanged; root-link and ignore bookkeeping remain explicit code changes.

The first explicit initialization or upgrade also records the exact unfinished
retained-legacy locations and accepted specification digests in one
`.prime-claw/legacy-specifications.json` allowlist. Startup is verification-only:
it does not create, extend, or rebaseline the inventory. Empty and archive-only
projects produce no unfinished-work warning.

## US-04 — Upgrade templates without destroying customization

**As a project operator, I want safe template reconciliation, so that untouched
assets receive improvements while locally customized assets remain under my
control.**

The reconciler tracks upstream and accepted hashes, updates managed content,
preserves customized or unknown files, migrates known legacy locations, and
reports per-asset conflicts without blocking independent safe updates.

## US-05 — Make explicit decisions about customized templates

**As a project operator, I want to compare my customized asset with the new
upstream version, so that I can deliberately preserve it, accept it, or reset
it.**

The comparison is an ordinary readable Git patch as text, made from disposable
copies of current asset bytes and upstream bytes. It does not overwrite, stage,
restore, or foreground the real skill or workflow. Clean, dirty, and staged
assets retain their exact bytes and Git index. No specialized viewer or
ready/visibility choreography is required.

Viewing a patch is not acceptance. `accept-override` and `reset` require separate
explicit operator decisions. Legacy interrupted overwrite evidence remains held
until the operator explicitly chooses restore or keep; comparison never clears
that evidence silently. This supersedes DD-001's old overwrite/viewer policy,
while retaining its historical probes.

## US-06 — Reconcile a registered project when a session starts

**As a user opening a registered project, I want safe project updates applied
before I begin work, so that newly installed skills are discoverable without
silently changing active Episode snapshots.**

Startup reconciliation is awaited. No-op starts remain quiet; changes,
conflicts, or degraded registration produce a concise notice. Active or
uncertain Episode worktrees retain their starting template snapshot.

## US-07 — Orient a fresh project agent

**As a project agent, I want minimal progressive orientation, so that I discover
this repository's applicable policy, overview, development guidance,
documentation map, and native work commands without flooding context or
requiring conventional files and tools that the project does not use.**

## US-28 — Switch the selected task provider without losing authority

**As a project operator, I want an explicit, verified task-provider switch in
the existing upgrade UX, so that every task and its native history survives and
active Episodes continue with the same identity.**

The same initialization Markdown skill guides **Beads to Backlog only**.
Inspection reports the exact source capture token, digest, complete counts,
active-owner count, and semantic-placement context without writes. A separate
explicit confirmation binds that token and the operator-approved actor. Reverse
migration is not supported. Startup never migrates automatically.

A valid existing default `backlog/`, hidden `.backlog/`, or native root-config
selected custom store is preserved, not treated as a collision. Normalize only
the default `backlog/` into `.backlog/` with the standard native root symlink in
both installation/initialization and migration; hidden/custom stores stay in
place. Existing IDs, physical records (including same-ID archives), configuration,
Git history, and clone/publication identity remain protected. Counts include
preserved records, imports, and the single destination-native receipt.

Native ID allocation and the existing importer mapping/provenance/relationships
are reused. Archives are deleted/history, never dependency targets or fallback;
only actual `tasks/` and `completed/` records are eligible. A reused live ID is
not ambiguous because history retains it. Archive-only targets refuse as
missing/deleted, as do true live/completed ambiguity, self references, and
cycles. A genuine source relationship to a deleted task is reported before any
destination mutation, not dropped or automatically repaired.

Read retiring Beads as-is, including embedded/local-only stores without custom
statuses or a Dolt remote. Complete native inventory/export, raw source version,
status catalog, views/comments/history/events/provenance and stable identity are
required; source setup, SQL, server conversion, or source publication are not.
Unused catalog values do not block. Unsupported used statuses and ambiguous
archive evidence report exact source IDs/statuses before writes. Legacy open
maps to In Design; ordinary closed maps to Done/completed. Archive needs exact
positive prior-archive/Prime Claw abandonment evidence, not keywords/categories.

Confirmation, quiescence, source recapture, code/runtime/ownership continuity,
verified destination content and publication all precede source retirement. The
same active Episode/session/worktree/branch/resources continue. Destination and
source proofs repeat beside ownership cutover and guarded deletion. A failed
pre-cutover proof preserves source authority. Failed deletion restores ownership
only after proving the complete source intact; partial retirement retains the
verified destination and reports `cutover-incomplete`. Dirty/foreign/divergent
active destination clones refuse; exact published clones may fast-forward only.
No automatic retry, duplicate destination, dual write, sidecar authority, or
persistent migration coordinator is introduced. Production migration remains a
separately confirmed operator action, not an implementation test.

## Primary implementation surfaces

- `extensions/project-initialization.ts`
- `extension-support/project-initialization.ts`
- `extension-support/template-review.ts`
- `extension-support/task-provider-migration.ts`
- `extension-support/episode-ownership.ts`
- `skills/project-templates/prepare.md`
- `asset-inventory.json`

All paths above are relative to `src/prime-agent-plugin/`.

## Design reference

- [`project-initialization.md`](../project-initialization.md)
