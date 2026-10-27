# B. Initialize and maintain a project

## US-03 — Make a Git project Prime-Claw-capable

**As a project operator, I want to initialize an existing Git project without
manually copying lifecycle files, so that it gains the standard Prime Claw
skills and workflows.**

`/initialize-prime-claw` and `initialize_prime_claw(action="reconcile")`
install or reconcile the project-owned `prepare`, `design`, `spec-it-out`,
`design-legacy`, `spec-it-out-legacy`, `execute`, and `blocked` skills plus the
`handoff`, task-native planning/implementation workflows, and the retained
`plan-prep`, `plan-spec`, `implement-prep`, and `implement-spec` runtime
workflows. Reconciliation never stages or commits project files.

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

The comparison is the primary user outcome. Preserve, accept, and reset are the
decisions that the comparison enables; the comparison is not an optional step
after one of those decisions.

The required UX is an in-product, focused Orca side-by-side comparison. Because
Orca cannot compare two arbitrary files, a clean tracked worktree asset may be
temporarily replaced with the upstream version so Orca can display its
source-control diff. The lifecycle explains the visible overwrite and focus
change, waits until the operator is ready, holds the comparison until the
operator confirms it is visible, and restores the exact original bytes when the
review completes or is cancelled.

Prime Claw falls back to a native Git comparison when the worktree asset is
already dirty or when Orca cannot display the comparison. A dirty asset must not
be overwritten. After an Orca failure on a clean asset, Prime Claw restores the
exact original bytes before falling back. In both cases, the Git comparison uses
the worktree asset and upstream version without explicitly disabling a custom
Git diff experience configured by the user.

The lifecycle supports `accept-override`, `reset`, `review-request`,
`review-start`, `review-complete`, `review-cancel`, and interrupted-review
`restore` or `keep`. It must restore exact original bytes unless the operator
explicitly chooses otherwise.

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

`switch-request` performs a read-only inventory and returns the exact source
revision, digest, open/closed/archived counts, active owner count, semantic
placement prompt, and confirmation text. `switch-confirm` requires that exact
revision plus an actor, managed semantic-placement prose, and literal operator
confirmation. When inspection finds a source value without one exact destination
equivalent, structured confirmation also carries the managed role's exact
provider-native literal; for ambiguous Backlog priority this is a task-specific
Beads `0..4` value in `beadsPriorityPlacements`. Prose remains audit evidence and
is never parsed into a value. The operation creates the target only through
supported native interfaces, preserves safe IDs or records immutable mappings,
publishes and verifies every field, absence, relationship, comment, complete Git
commit-message body and history, actor, timestamp, transition, applied native
value, and provenance record, and writes one final destination-native receipt.

The source remains intact, clean, read-only, and authoritative through complete
target proof. Beads export filters are rejected and a complete native export
must equal an independent issue inventory. Backlog active and archived drafts
are included with exact Markdown, native view, Git history, original kind, and
placement; completion counts use native status while archive placement retains
abandonment meaning. Every active Episode
must also be clean and directly published at its exact code branch. Its preserved
ownership head remains historical while migration captures the actual current
head, proves the base/historical/current ancestry chain, and keeps that head
stable through native Git and Orca checks. The same branch-local Backlog task
bytes or exact shared provider revision, one idle durable runtime route, and
matching Orca resources are required when applicable.
Active version-2 ownership changes atomically only after those proofs; Episode,
session, worktree, branch, code/runtime, and resource identity remain unchanged.
Repeated source, frozen-destination-remote, active-code/runtime, registry,
sole-target, and source-absence proofs guard deletion. A failed deletion restores
ownership only after a complete unchanged source proof. Partial retirement keeps
the verified destination binding and reports `cutover-incomplete`; directory
existence never establishes source authority. An intact pre-cutover failure keeps
source authority and reports exact cleanup or an explicit same-destination retry
that must re-prove all existing markers,
mappings, receipt, digest, and publication. A previously created clean active-
Episode Backlog clone may advance only by exact-remote fetch and fast-forward to
the verified receipt; unsafe or divergent clones block. There is no automatic retry,
duplicate destination, dual write,
mirror, provider-selection file, sidecar receipt, persistent coordinator, phase,
checkpoint, or resume state. Production cutover remains a separately confirmed
operator action and never occurs during startup reconciliation.

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
