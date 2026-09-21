# Future specification bundles

Prime Claw separates specification authoring from planning and implementation.
The project conversation owns specification review. No episode resources are
allocated during authoring.

## Authoring workflows

Use either project-customizable skill:

- `design` when requirements discovery is still needed;
- `spec-it-out` when the conversation already contains most of the design.

Both workflows create a new bundle at:

```text
.ralph/plans/future/<slug>/
```

The skills choose a safe, descriptive slug and refuse to overwrite an existing
bundle. All specification artifacts belong inside that folder. The default
Prime Claw skills create `SPECIFICATION.md`, `REQUIREMENTS.md`, and
`DECISIONS.md`, but those filenames are project policy rather than native
command requirements.

After writing the bundle, the agent reports its exact relative path, links every
artifact, and stops for operator specification review. Requested changes stay
in the same bundle. Authoring does not create an execution plan, branch,
worktree, or episode.

## Native reviewed planning

Planning is a separate reviewed gate. Select the exact reviewed bundle with:

```text
/plan .ralph/plans/future/<slug>
```

The native project extension at
`.prime/agent/extensions/reviewed-plan.ts` performs only deterministic loader
work. It rejects missing input, absolute paths, traversal, symlink escapes,
unsafe slugs, and folders that do not exist. Invalid input displays:

```text
Usage: /plan .ralph/plans/future/<slug>
```

A valid command loads the current project policy from
`.ralph/skills/plan/SKILL.md`, adds the validated path in an
`<operator-plan-location>` block, and sends that combined prompt exactly once.
The native code does not choose artifact names or define how planning works.
Those customizable decisions remain in the canonical skill Markdown.

The default policy reads the specification bundle and writes
`EXECUTION_PLAN.md` back into the same future folder. If specification material
is missing or inadequate, it explains the gap and stops. Otherwise, it links
all planning output and stops for operator plan review. `/plan` never moves the
bundle, creates an implementation worktree, or authorizes implementation.

There is only one slash-command surface: the native `/plan` command. The former
`.agents/skills/plan` exposure is intentionally absent.

## Explicit implementation promotion

Implementation remains unauthorized until the operator selects an approved,
planned bundle with:

```text
/implement-spec .ralph/plans/future/<slug>
```

The native handler applies the same relative-path, safe-slug, directory,
containment, and realpath checks as `/plan`. Invalid input displays concise
usage and never invokes the model. Valid input loads the current customizable
readiness policy from `.ralph/skills/implement-spec/SKILL.md` and supplies only
the validated location. The policy either explains every readiness deficiency
and stops without calling a tool, or calls `create_spec_episode` exactly once.

`create_spec_episode` accepts only that location. The native command arms that
exact location for one model turn; an unarmed, different, late, or repeated tool
call is rejected. The capability also runs only from a persisted, daemon-backed,
top-level project conversation. Trusted host code derives all other values:

| Identity | Derived value |
|---|---|
| Branch | `episode/<slug>` |
| Worktree | sibling `<repository>-<slug>-episode` directory |
| Session name | `<slug>-episode` |
| Stable episode ID | the forked Prime Agent session UUID |
| Active routing ID | the daemon worker's current active-session ID |

The capability rejects branch, worktree, or session-name collisions before it
creates resources. A matching repeated request validates durable session ID,
session file, branch, worktree, CWD, and name. It returns an active match or
reactivates an inactive saved session without sending execute again, then
refreshes the routing ID. A mismatch fails clearly and does not delete the
pre-existing resource.

On first creation, the capability creates the branch and worktree, overlays the
validated canonical folder so approved changes need not already be committed,
replaces only the worktree's active plan files with the complete bundle
contents, preserves `future/`, `archive/`, and `blocked/`, removes the selected
source folder only on the episode branch, and commits the promotion. Artifact
names inside the bundle are opaque to native code. The canonical checkout and
its future bundle remain unchanged.

Prime Agent's public `SessionManager.forkFrom` API copies the complete owner
conversation into a new durable session with the episode worktree as its CWD.
The fork includes the successful `create_spec_episode` tool result so it does
not begin with a dangling tool call. Prime Agent 0.9.5 has no public extension
API that publishes a fork as a separate sibling without replacing the owner,
so the narrowly scoped host adapter uses the daemon supervisor socket injected
into daemon workers. It publishes the fork as a resident sibling and admits the
worktree's canonical execute skill exactly once. Local identity state is stored
under ignored `.prime/agent/state/spec-episodes/` and contains only owner,
episode, branch, worktree, session, source, and delivery identifiers. A definite
failure cleans up only resources created by that invocation. A timeout, lost
mutation response, or unconfirmed worker stop preserves the branch, worktree,
and session artifacts and reports an actionable uncertain state instead of
risking deletion under a live worker.

Successful task admission is the boundary where the project conversation begins
its separately configured oversight workflow. `/implement-spec` does not embed
oversight policy, run implementation in the owner conversation, or invoke
`/handoff`.

## Focused verification

Run the command loader and end-to-end host-mechanics coverage with:

```sh
node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs
node --experimental-strip-types --test tests/spec_episode_extension.test.mjs
pytest -q tests/test_reviewed_plan_extension.py
```

The Node suites cover command validation, opaque temporary-Git promotion,
lifecycle-directory preservation, promotion commits, inherited context,
protocol-7 daemon envelopes, uncertain mutation preservation, exactly-once
execute delivery, active and inactive replay, collision safety, and confirmed
invocation-owned cleanup. The Python bridge reruns both suites and uses
installed offline Prime Agent RPC plus startup probes to prove one native
`plan`, one native `implement-spec`, the structured tool, a valid inherited
Prime Agent context, and bounded real daemon create/state/messages/kill behavior
at the episode worktree CWD.
