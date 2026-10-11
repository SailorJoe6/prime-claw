# B. Initialize and maintain a project

## US-03 — Make a Git project Prime-Claw-capable

**As a project operator, I want to initialize an existing Git project without
manually copying lifecycle files, so that it gains the standard Prime Claw
skills and workflows.**

`/initialize-prime-claw` and `initialize_prime_claw(action="reconcile")`
install or reconcile the project-owned `prepare`, `design`, `spec-it-out`,
`execute`, and `blocked` skills plus the `handoff`, planning, and implementation
workflows. Reconciliation never stages or commits project files.

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

If and only if the worktree asset is already dirty, Prime Claw must not
overwrite it. It instead falls back to a native Git comparison between the
dirty asset and the upstream version. That fallback must not explicitly disable
a custom Git diff experience configured by the user. A clean-file Orca failure
is restored and reported; it does not silently downgrade to the terminal
fallback.

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

**As a project agent, I want minimal progressive orientation, so that I load the
project policy, vision, plan, information architecture when relevant, and ready
work without flooding context.**

## Primary implementation surfaces

- `extensions/project-initialization.ts`
- `extension-support/project-initialization.ts`
- `extension-support/template-review.ts`
- `skills/project-templates/prepare.md`
- `asset-inventory.json`

All paths above are relative to `src/prime-agent-plugin/`.

## Design reference

- [`project-initialization.md`](../project-initialization.md)
