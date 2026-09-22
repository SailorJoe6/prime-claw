# Future specification bundles

Prime Claw separates specification authoring from planning and implementation.
The project conversation owns specification review. No episode resources are
allocated during authoring.

The reviewed design and implementation provenance is archived with this
capability:

- [specification](../.ralph/plans/archive/worktree-isolated-specification-episodes/SPECIFICATION.md)
- [execution plan](../.ralph/plans/archive/worktree-isolated-specification-episodes/EXECUTION_PLAN.md)

## End-to-end operator walkthrough

1. In the project conversation, invoke `/skill:design` while requirements still
   need discovery, or `/skill:spec-it-out` when the conversation already
   contains the design. The workflow writes a named
   `.ralph/plans/future/<slug>/` bundle and
   stops. Confirm that no branch, worktree, or episode was created.
2. Review every linked specification artifact in that exact folder. Request
   revisions in place until satisfied. Explicit specification approval permits
   **planning only**; it does not authorize implementation.
3. Invoke `/plan .ralph/plans/future/<slug>`. Review the plan written back into
   the same folder. Confirm again that planning created no branch, worktree, or
   episode.
4. Request plan revisions until satisfied. Explicit plan approval still does
   not allocate resources. The next command is a separate implementation gate.
5. Invoke `/implement-spec .ralph/plans/future/<slug>` only after approving the
   whole bundle. The customizable readiness policy either reports gaps without
   mutation or calls the trusted episode capability once.
6. Record the returned stable episode ID, active routing ID, branch, worktree,
   session name, and execute-admission state. The host identity record binds
   these resources to the current owner conversation. `delivered` permits that
   conversation to begin its project-specific oversight.
   Handle `pending` and `uncertain` as described below; neither authorizes a
   duplicate execute delivery.

Only a successful episode-capability call in step 5 crosses the implementation
boundary. Authoring, both human review gates, and planning remain in the
canonical project conversation.

## Authoring workflows

Use either project-customizable skill:

- `/skill:design` when requirements discovery is still needed;
- `/skill:spec-it-out` when the conversation already contains most of the design.

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

## Reviewed planning entry paths

Planning is a separate reviewed gate with two explicit entry paths.

### Native `/plan`

Select the exact reviewed bundle with:

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

### Conversational `ralph_plan`

A fresh project conversation also exposes the model-callable `ralph_plan` tool.
It accepts only one required `location` field containing the exact
`.ralph/plans/future/<slug>` folder selected by the operator. It has no search,
command, approval, implementation, or routing fields.

When the operator clearly requests planning for an exact folder, the tool calls
the same deterministic validation and canonical skill-loading helper as native
`/plan`. Because the tool runs during an agent turn, it queues the wrapped
planning workflow exactly once with `deliverAs: "followUp"`. Its result reports
admission only: planning has not completed, and implementation remains
unauthorized.

If the folder is missing or materially ambiguous, the model asks the operator
instead of searching, selecting, or inventing a slug. Invalid paths, missing
folders, symlink escapes, missing canonical Markdown, and queue failures are
visible and admit no partial workflow. Inline prose is not parsed by extension
substring matching.

These are two explicit admission surfaces for the same planning operation:
native `/plan` and conversational `ralph_plan`. The former
`.agents/skills/plan` exposure remains intentionally absent, so there is still
no duplicate skill slash command.

## Explicit implementation promotion

Implementation promotion remains native-only. A fresh project conversation does
not register `ralph_implement_spec`; the operator must use the explicit native
command below. This is a deliberate fail-closed result, not a missing adapter.

The installed Prime Agent 0.9.5 RPC characterization confirmed host approval,
`steer`, and matching `input` with `event.source === "extension"`. It also
showed `agent_end` after that matching input and before the readiness agent turn.
The approved conversational design clears pending and active authority on
`agent_end`, so its one-use arm cannot safely reach `create_spec_episode` without
adding forbidden cross-run lifecycle state. Rejection, cancellation, absent UI,
and non-UI modes consequently have no conversational implementation path or
episode side effect. Confirmation UX can be reconsidered only with a simpler
public runtime ordering; it must not be emulated with durable approvals, leases,
nonces, timers, or private runtime patches.

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
refreshes the routing ID. A stored `pending` or `uncertain` admission is also
returned without another delivery attempt. A mismatch fails clearly and does
not delete the pre-existing resource.

On first creation, the capability creates the branch and worktree, verifies the
new checkout is clean, overlays the validated canonical folder so approved
changes need not already be committed, replaces only the worktree's active plan
files with the complete bundle contents, preserves `future/`, `archive/`, and
`blocked/`, removes the selected source folder only on the episode branch, and
creates the promotion marker commit. The marker uses an allowed empty commit
when the promoted tree already matches `HEAD`. Artifact names inside the bundle
are opaque to native code. The canonical checkout and its future bundle remain
unchanged.

Prime Agent's public `SessionManager.forkFrom` API copies the complete owner
conversation into a new durable session with the episode worktree as its CWD.
The fork includes the successful `create_spec_episode` tool result so it does
not begin with a dangling tool call. Prime Agent 0.9.5 has no public extension
API that publishes a fork as a separate sibling without replacing the owner,
so the narrowly scoped host adapter uses the daemon supervisor socket injected
into daemon workers. Before task delivery it atomically stores the complete
minimal identity with `executeAdmission: pending`. Confirmed admission changes
that field to `delivered`; a lost response changes it to `uncertain` when
possible. `pending` and `uncertain` both prevent replay from sending execute
again, including the crash window after daemon admission but before the final
identity update.

Local identity state lives under ignored
`.prime/agent/state/spec-episodes/` and contains only owner, episode, branch,
worktree, session, source, and admission identifiers. A definite failure cleans
up only resources created by that invocation. Cleanup first confirms the worker
stop and then requires both worktree removal and branch deletion to succeed
before deleting identity/session artifacts. Any timeout, lost mutation
response, unconfirmed worker stop, or partial Git cleanup preserves remaining
artifacts and reports an actionable uncertain state instead of risking deletion
under a live worker.

### Operator response to unresolved execute admission

`pending` and `uncertain` are preservation states, not failure confirmations:

- `pending` means the durable identity was written before delivery, but the
  final `delivered` mark was not durably recorded. A crash may have happened
  before or after the daemon accepted execute.
- `uncertain` means the delivery operation reported an ambiguous outcome, such
  as a lost mutation response. Execute may already be queued or running.

For either state:

1. Do not send execute directly, do not delete or edit the identity record, and
   do not kill the session or remove its branch/worktree merely because no
   confirmation arrived.
2. Preserve the returned identities and inspect the named session, its messages,
   daemon state, Git branch, and worktree before making an owner decision.
3. Treat a repeated `/implement-spec` as an identity lookup only. It returns the
   matching unresolved identity and intentionally does not redeliver execute.
4. Escalate to the operator with the observed evidence. Continue, revise, or
   abandon only through the project's explicit owner policy. Before any manual
   cleanup, independently confirm that the worker is terminated and that the
   remaining resources are safe to remove.

There is intentionally no automatic recovery or retry protocol in this
capability. Never manufacture `delivered` state or infer non-admission from an
idle, missing-response, or transport status alone.

Successful task admission is the boundary where the project conversation begins
its separately configured oversight workflow. `/implement-spec` does not embed
oversight policy, run implementation in the owner conversation, or invoke
`/handoff`.

## Automated and integration validation

Run the command loader and host-mechanics coverage with:

```sh
node --experimental-strip-types --test tests/reviewed_plan_extension.test.mjs
node --experimental-strip-types --test tests/spec_episode_extension.test.mjs
pytest -q tests/test_reviewed_plan_extension.py
```

The Node suites cover native and conversational planning registration,
validation, canonical Markdown loading, follow-up admission, failure isolation,
opaque temporary-Git promotion, lifecycle-directory preservation, promotion
commits, inherited context, protocol-7 daemon envelopes, durable pre-delivery
admission, crash-window and
uncertain-delivery replay suppression, allowed-empty promotion commits, partial
cleanup observability, active and inactive replay, collision safety, and
confirmed invocation-owned cleanup. The Python bridge reruns both suites and uses
installed offline Prime Agent RPC plus startup probes to prove one native
`plan`, one native `implement-spec`, explicit `ralph_plan` and
`create_spec_episode` tools, no `ralph_implement_spec` tool, the confirmed
`steer` lifecycle ordering described above, and a valid inherited
Prime Agent context, and bounded real daemon create/state/messages/kill behavior
at the episode worktree CWD.

These checks prove deterministic command loading and bounded episode mechanics.
They use disposable repositories, offline RPC, and controlled daemon probes.
They do **not** prove that a human completed both review gates, observed a live
production episode through execute/handoff, made a terminal merge or abandonment
decision, and reaped that episode safely.

## Live end-to-end dogfood status

The owner explicitly deferred the live end-to-end dogfood to a separate future
episode. The closing implementation episode delivered and owner-accepted the
three mechanical slices, then archived its plans without planning, modifying,
or promoting the `conversation-driven-episode-oversight` bundle. No nested
branch, worktree, or episode was created for dogfood.

Until that separate run is complete, report automated and integration evidence
as such. Do not describe the full authoring → two reviews → planning → promotion
→ execute/handoff → terminal cleanup workflow as manually proven. The deferred
disposition and test evidence are recorded in the
[archived execution plan](../.ralph/plans/archive/worktree-isolated-specification-episodes/EXECUTION_PLAN.md).
