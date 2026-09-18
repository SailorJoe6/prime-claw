# Specification episodes

Prime Claw turns a mature project conversation into one of two explicit
outcomes:

- **future** keeps a named specification bundle for later; and
- **episode** allocates isolated production work on its own branch, Git
  worktree, and durable Prime Agent session.

The complete target contract is in
[the active specification](../.ralph/plans/SPECIFICATION.md). This document
tracks the behavior that has actually shipped. It must not be read as evidence
that later lifecycle slices already exist.

## Slice 1: native interviews and trusted preflight

The project-local extension
`.prime/agent/extensions/specification-episodes.ts` registers two native
commands:

| Command | Starting point |
|---|---|
| `/design` | Material requirements and design discovery are still needed. |
| `/spec-it-out` | The conversation already contains most design context and needs formalization. |

Both commands load their fixed canonical workflow from
`.ralph/skills/<command>/SKILL.md`. The extension does not copy the workflow
prose and command arguments cannot select a file. Optional trailing text is
included only as operator-provided specification context.

The workflows ask necessary questions one at a time. They do not ask for a
disposition until all material questions are resolved and the exact
`SPECIFICATION.md`, `REQUIREMENTS.md`, and `DECISIONS.md` content is ready. The
operator must explicitly choose `future` or `episode`; cancellation performs no
action.

After that choice, the model calls `spec_disposition` exactly once. It does not
construct Git, filesystem, daemon, or session commands from workflow prose.
The tool accepts a closed structured object:

```json
{
  "request_id": "spec-example-0001",
  "confirmed_by_operator": true,
  "decision": {
    "kind": "future",
    "slug": "example"
  },
  "documents": {
    "specification_markdown": "# Specification\n...",
    "requirements_markdown": "# Requirements\n...",
    "decisions_markdown": "# Decisions\n..."
  }
}
```

An `episode` decision additionally requires `decision.branch_name` beginning
with `feature/`, `spec/`, or `poc/`. The schema uses a provider-compatible enum
and trusted runtime cross-field validation rather than a TypeBox union, because
Prime Agent 0.9.5 documents `Type.Union`/`Type.Literal` as incompatible with
Google tool schemas.

### What preflight validates

- explicit operator confirmation;
- exact allowed fields and variant-specific fields;
- safe request ID, lowercase slug, and optional branch name;
- complete non-empty document strings with bounded size;
- a real persisted Prime Agent source session whose header ID and CWD match
  the trusted runtime context;
- the primary canonical checkout rather than a linked worktree;
- a current branch/upstream equal to that upstream remote's configured default;
- Git repository root, common directory, current branch, and checkout status;
- Git branch syntax for an episode request.

All Git inspection uses `pi.exec("git", [arg, ...])`. No shell command string is
constructed.

### Durable receipt and retries

Preflight fingerprints the exact normalized decision and document bundle. It
stores content-free control metadata beneath the repository's local Git common
directory:

```text
<GIT_COMMON_DIR>/prime-claw/
├── disposition-requests/<owner-and-request-hash>.json
└── dispositions/<semantic-disposition-id>.json
```

Receipt creation uses an exclusive same-filesystem link after flushing a private
temporary file. Existing files are never replaced. Exact semantic replay,
including after extension restart or an ordinary dirty/clean checkout-state
change, returns the original receipt snapshot as deduplicated after current
canonical-source checks pass. Reusing one caller request ID with changed input
fails closed. Stable session ID is part of both identities, so separate project
conversations do not share receipts. Corrupt or conflicting immutable evidence
is preserved and reported rather than overwritten.

The registered tool also requests Prime Agent's `sequential` execution mode.
Atomic exclusive creation remains the durable concurrency boundary if calls race
outside that runner contract.

## Current safety boundary

Slice 1 is intentionally **preflight only**. A successful receipt says:

```text
status: preflight-ready
phase: validated
product_resource_mutation_performed: false
control_state_kind: local-git-common-dir-receipt
control_state_writes_performed: [<files created by this invocation>]
implementation_boundary: slice-1-preflight-only
```

The filesystem changes are explicit local control-state request/receipt files
under Git's common directory. Slice 1 does **not** change project checkout
files, Git refs, branches, worktrees, sessions, daemon state, or remotes. It
does not yet incubate the future bundle or create the episode. Those mutation
paths begin in Slices 2 and 3.

The legacy `.agents/skills/design` and `.agents/skills/spec-it-out` aliases also
remain temporarily. The approved plan removes them only after both real
disposition paths are proven in Slice 4.

## Failure and recovery

Validation, repository inspection, cancellation, or Git errors before receipt
creation produce no control state. If a request pointer was durably created but
a later receipt write is interrupted, retrying the same request may safely
complete the missing receipt. A changed request cannot reuse that pointer.
Never delete a conflicting or corrupt receipt as generic recovery; preserve it
for explicit diagnosis.

## Verification

Run the focused acceptance suite:

```bash
node --experimental-strip-types --test tests/specification_episodes_extension.test.mjs
pytest -q tests/test_specification_episodes_extension.py
```

The Node suite uses temporary repositories and proves registration, canonical
loading, structured validation, both disposition variants, canonical/default-
branch source checks, argument-array Git, product-resource non-mutation, durable
replay across checkout-state change, changed-input collision, session
isolation, concurrent convergence, cancellation, and corrupt-evidence handling.
The pytest bridge loads the real extension through the installed Prime Agent
RPC loader and checks the two native command surfaces. Prime Agent 0.9.5 RPC has
no public tool-list or direct tool-invocation command, so schema/execution tests
capture the registered tool through the extension API harness. A real model-
mediated bridge call remains part of the final dogfood acceptance rather than
being claimed by Slice 1.
