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
2. Review `SPECIFICATION.md` in that exact folder. Request revisions in place
   until satisfied. Explicit specification approval permits **planning only**;
   it does not authorize implementation.
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
bundle. The default Prime Claw skills create one `SPECIFICATION.md` inside that
folder. Artifact conventions remain project policy rather than native command
requirements.

After writing the specification, the agent reports its exact relative path,
links it, and stops for operator specification review. Requested changes stay
in the same folder. Authoring does not create an execution plan, branch,
worktree, or episode.

A specification remains a living source of truth for as long as it is
incubating under `future/`. Durable clarifications and POC learnings are folded
into it when they emerge, before conversation history or compaction can lose
them. Update the relevant text and remove stale claims rather than using the
specification as an append-only activity log.

## Bounded contracts and proportionate review

Prime Claw biases toward **DONE over perfect**. A future specification must bound
its practical product contract before planning: desired outcome, required safety,
concise threat model, trusted assumptions, ordinary failure model, explicit
non-goals, manual-recovery boundary, and qualitative complexity budget. Required
acceptance behavior stays separate from optional hardening and implementation
suggestions. Diagnostic evidence is not a security attestation unless the
operator explicitly makes that the product.

Plans deliver the smallest safe vertical slice and prefer ordinary failure
handling, deletion, or topology simplification over bespoke transaction and
recovery systems. Plausible non-blocking risks can enter a lightweight hardening
backlog with four fields: scenario, likely impact, current assumption, and a
concrete promotion trigger. Observed failure, a near miss, a credible user
report, a changed deployment boundary, or a newly approved requirement can
trigger reconsideration. Review novelty alone cannot promote scope.

An EXPERT may block only on a concrete violation inside the approved contract
with realistic impact and proportionate remediation. Out-of-model findings are
advisory. A specification defect or new product invariant returns to the
operator; the reviewer cannot expand scope. PASS means no in-contract blocker or
required specification decision remains, not that no imaginable edge case
exists. Optional adversarial red-team review requires explicit operator
authorization and cannot redefine the baseline contract.

After two repair/review cycles for the same slice acceptance attempt across
successor candidate commits, automatic repair stops. The
owner reassesses threat model, architecture, and complexity. It consults the
operator if continuing changes scope, product behavior, architecture, or the
approved complexity budget. A separate simplification checkpoint fires when
support machinery or recovery states grow materially faster than user value.

## Reviewed planning entry paths

Planning is a separate reviewed gate with two explicit entry paths.

### Native `/plan`

Select the exact reviewed bundle with:

```text
/plan .ralph/plans/future/<slug>
```

The inert plugin entry-point source at
`src/prime-agent-plugin/extensions/reviewed-plan.ts` defines the deterministic
loader installed at global scope. It rejects missing input, absolute paths,
traversal, symlink escapes,
unsafe slugs, and folders that do not exist. Invalid input displays:

```text
Usage: /plan .ralph/plans/future/<slug>
```

A valid command preflights both current project policies:
`.prime-claw/workflows/plan-prep.md` and `.prime-claw/workflows/plan-spec.md`. It wraps
each with the same validated `<operator-plan-location>` block, admits
`plan-prep` as an ordinary message, and queues canonical `plan` exactly once as
the sole `followUp`. The native code does not define the readiness sniff,
compaction hint, or planning behavior. Those customizable decisions remain in
the canonical skill Markdown.

`plan-prep` performs a light specification-presence sniff and requests focused
compaction once with the project-owned standard hint. Compaction is best effort,
not the continuation trigger; `plan` was queued independently at admission. The
canonical plan policy then reads the specification bundle and writes
`EXECUTION_PLAN.md` back into the same future folder. If specification material
is missing or inadequate, it explains the gap and stops. Otherwise, it links
all planning output and stops for operator plan review. `/plan` never moves the
bundle, creates an implementation worktree, or authorizes implementation. See
[phase prep chain](prep-chain.md) for ordering and failure semantics.

### Conversational `ralph_plan`

A fresh project conversation also exposes the model-callable `ralph_plan` tool.
It accepts only one required `location` field containing the exact
`.ralph/plans/future/<slug>` folder selected by the operator. It has no search,
command, approval, implementation, or routing fields.

When the operator clearly requests planning for an exact folder, the tool calls
the same deterministic validation and two-skill preflight as native `/plan`.
Because the tool runs during an agent turn, it steers wrapped `plan-prep` first
and queues wrapped `plan` exactly once as the sole `followUp`. Its result reports
admission only: neither compaction nor planning is reported complete, and
implementation remains unauthorized.

If the folder is missing or materially ambiguous, the model asks the operator
instead of searching, selecting, or inventing a slug. Invalid paths, missing
folders, symlink escapes, or missing canonical Markdown are visible and send
nothing. A first-message failure reports that prep was not admitted; a
second-message failure reports that prep was admitted but planning was not
queued and the transition is incomplete. Inline prose is not parsed by
extension substring matching.

These are two explicit admission surfaces for the same planning operation:
native `/plan` and conversational `ralph_plan`. The former
`.agents/skills/plan` exposure remains intentionally absent, so there is still
no duplicate skill slash command.

## Explicit implementation promotion

Implementation promotion remains native-only. A fresh project conversation does
not register `ralph_implement_spec`; the operator must use the explicit native
command below. This is a deliberate fail-closed result, not a missing adapter.

The installed Prime Agent RPC characterization confirmed that a model-called
confirmation tool would cross `agent_end` before a steered readiness turn. That
surface remains intentionally absent: rejection, cancellation, absent UI, and
non-UI modes have no conversational implementation path or episode side effect.
The explicit native command is the operator authority boundary and uses only a
bounded in-memory one-deep lifecycle flag for its own admitted prep chain. It
does not add durable approvals, leases, nonces, timers, or private runtime
patches. Conversational confirmation UX remains a separate deferred design.

Implementation remains unauthorized until the operator selects an approved,
planned bundle with:

```text
/implement-spec .ralph/plans/future/<slug>
```

The native handler applies the same relative-path, safe-slug, directory,
containment, and realpath checks as `/plan`. Invalid input displays concise
usage and never invokes the model. A valid command preflights both current
project policies, `.prime-claw/workflows/implement-prep.md` and
`.prime-claw/workflows/implement-spec.md`, plus the existing conversation identity
boundary before sending either message. It admits wrapped `implement-prep` as
an ordinary message and queues wrapped canonical `implement-spec` exactly once
as the sole `followUp`, with the same validated location envelope.

`implement-prep` performs only the project-owned light bundle-presence sniff
and one best-effort focused compaction request. It cannot cancel or reconstruct
the independently queued phase workflow. Canonical `implement-spec` runs
`prepare`, performs the authoritative semantic readiness review, and either
explains every deficiency without a tool call or activates and consumes the
managed prospective Conversation guide for that exact folder before calling
`create_spec_episode` exactly once. A read-only guide status check may prove
readiness; it cannot arm or replay readiness.

Approval is recorded only after both messages are admitted, bound to the exact
session and location, and carries one non-accumulating `agent_end` skip. The prep
turn consumes that skip; the approval is unusable before that boundary, and
the queued implementation turn can then use it. `create_spec_episode` consumes it before any later readiness check or
host mutation, even on failure. A second `agent_end`, `session_start`, or
`session_shutdown` clears an unused approval. A cancelled chain therefore dies
at the next `agent_end` after its one prep-turn skip. Missing skills, failed
preflight, or either transport failure never arm approval.

`create_spec_episode` accepts only that exact location. An unarmed, different,
late, or repeated tool call is rejected. The capability also runs only from a
persisted, daemon-backed, top-level project conversation. Trusted host code
derives all other values:

| Identity | Derived value |
|---|---|
| Branch | `episode/<slug>` |
| Worktree | sibling `<repository>-<slug>-episode` directory |
| Session name | `<slug>-episode` |
| Stable episode ID | the forked Prime Agent session UUID |
| Active routing ID | the daemon worker's current active-session ID |

The capability rejects branch, worktree, or session-name collisions before it
creates resources. A matching repeated request validates durable session ID,
session file, branch, worktree, CWD, and name and may reactivate the exact saved
session to refresh its routing ID. A delivered identity is returned without
another admission. Any nonterminal version-2 bootstrap stage or legacy
version-1 `pending`/`uncertain` state then fails closed with an actionable
incomplete-bootstrap error and sends no message. A mismatch fails clearly and
does not delete the pre-existing resource.

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
The plugin takes the `SessionManager` class from the actual read-only
`ctx.sessionManager` instance that Prime Agent already supplied and verifies that
`forkFrom` is callable. It does not re-import the complete coding-agent package
from inside the extension loader, so source and bundled runtimes use the same
already-loaded class identity. The fork includes the successful
`create_spec_episode` tool result so it does
not begin with a dangling tool call. Prime Agent 0.9.5 has no public extension
API that publishes a fork as a separate sibling without replacing the owner,
so the narrowly scoped host adapter uses the daemon supervisor socket injected
into daemon workers. Fresh creation preflights both canonical workflows,
validates publication, and atomically stores a version-2 identity with
`bootstrapAdmission: handoff-pending`. It then sends canonical handoff as an
ordinary `prompt` with no `streamingBehavior`; after acknowledgement it records
`execute-pending`, queues canonical execute exactly once as the sole `followUp`,
and records `delivered` after execute acknowledgement. This focuses the inherited
planning conversation through the handoff compaction boundary before slice 1.
Fresh bootstrap does not read episode state, require a previous-slice completion
report, or obtain an observed-idle snapshot. The later owner-driven continuation
path retains its fresh exact state re-read and observed-quiescence check.

The bootstrap admission journal records transport stages, not workflow
completion:

| `bootstrapAdmission` | Meaning |
|---|---|
| `handoff-pending` | Durable guard exists; handoff may or may not have crossed a crash boundary |
| `handoff-uncertain` | The first daemon mutation returned an ambiguous outcome |
| `execute-pending` | Handoff was acknowledged; execute has not yet been durably confirmed |
| `execute-rejected` | Handoff was admitted but execute was definitely rejected |
| `execute-uncertain` | Handoff was admitted and execute may have been admitted |
| `delivered` | Both daemon admissions were acknowledged |

The host awaits a durable `execute-pending` checkpoint after handoff
acknowledgement and before issuing execute. A first definite rejection is the
only delivery failure that permits invocation-owned cleanup. Once handoff may
have been admitted, every rejection, timeout, disconnect, or checkpoint failure
preserves the session, worktree, branch, identity, and session file. A repeated
`/implement-spec` validates and may reopen the exact episode but never replays a
nonterminal bootstrap stage.

Version-1 identities retain their historical `executeAdmission` field. They are
truthful legacy records for episodes created through direct execute: `delivered`
remains eligible for later owner handoff, while `pending` and `uncertain` remain
inspection boundaries. They are not rewritten to claim an initial handoff that
never occurred.

Local identity state lives under ignored
`.prime/agent/state/spec-episodes/` and contains only owner, episode, branch,
worktree, session, source, and admission identifiers. Cleanup first confirms the
worker stop and then requires both worktree removal and branch deletion before
deleting invocation-created artifacts.

### Operator response to unresolved bootstrap admission

Every nonterminal version-2 stage and legacy version-1 `pending` or `uncertain`
stage is an at-most-once preservation boundary:

1. Do not send handoff or execute directly, edit the identity record, or remove
   episode resources merely because no confirmation arrived.
2. Inspect the named session messages, daemon state, Git branch, and worktree to
   determine which mutation crossed the boundary.
3. Treat repeated creation as validation/reopen only; it reports incomplete
   bootstrap and sends no message.
4. Continue, revise, or abandon only through explicit owner disposition after
   the evidence is reconciled.

There is intentionally no automatic recovery or retry protocol. Never
manufacture `delivered` state or infer non-admission from idle state or a missing
response.

Successful task admission is the boundary where the project conversation begins
its separately configured oversight workflow. `/implement-spec` does not embed
oversight policy, run implementation in the owner conversation, or invoke
`/handoff`.

## Owner-driven episode continuation

After an implementation slice, the EPISODE sibling's explicit completion report
is the coordination signal. The owning project conversation independently
reviews and accepts the exact slice, then can call `handoff_spec_episode` when
the session appears reasonably quiescent. The heartbeat is only a missed-report
safety net: if it observes apparent quiescence without a completion report, the
owner asks `You seem done with your work. Are you complete or waiting for some process?` and trusts the answer before review or handoff. The call uses the exact
future-folder location that created the episode and optional accepted in-scope
compaction guidance. It is not another implementation authorization surface.
The durable episode identity remains the authority: host code requires the same
top-level owner session and revalidates every derived branch, worktree, and
durable-session field before using the daemon's current active routing ID.

The operation retains an exact resident route even when `isSessionActive` is
false, and publishes the durable session again only when no route exists. It
then re-reads live daemon state and fails closed on an observed busy snapshot.
It loads the current canonical handoff and execute Markdown from the episode
worktree before either send. Handoff is sent first as an ordinary `prompt` with
`queueIfBusy: false` and no `streamingBehavior`; execute is then queued exactly
once as the sole `followUp`. Measured Prime Agent 0.9.5 behavior is not an atomic all-busy guard: a streaming race definitely rejects the ordinary prompt, while
residual non-streaming runtime work can make it queue until idle. That queue is
acceptable after trusted completion and owner acceptance. `steer` remains
unsuitable because it can queue while streaming even with `queueIfBusy: false`.
The synchronous result proves immediate-or-queued admission only, never
completion. The episode's handoff `Status / Evidence / Next Step` output records
whether focused compaction was requested before the queued execute turn
continues.

Definite first-send failure queues no continuation and leaves the owner watch
available for a later retry after trusted completion and a new reasonably
quiescent observation. Definite second-send failure reports the irreversible
partial transition. An uncertain response at either stage is an inspection
boundary, not permission to retry. The operation never
kills the session, removes resources, or adds nonces, leases, durable approvals,
or generalized remote routing state.

Initial episode creation keeps the same handoff-first ordering but uses a
bootstrap-only queued transport. A newly published resident session may already
be running automatic preparation, so canonical handoff is admitted as
`streamingBehavior: "followUp"` with `queueIfBusy: true`; canonical execute is
then queued as the sole next `followUp`. Later owner-driven handoffs retain the
ordinary fail-closed prompt above. The version-2 bootstrap journal supplies the
durable partial-state and cleanup rules around both daemon mutations. The first
execute slice therefore starts only after automatic preparation and canonical
handoff have completed in order, with handoff requesting focused compaction of
the inherited planning context.

## Automated and integration validation

Run the command loader and episode-mechanics coverage only through Docker
tier 1:

```sh
python3 -m pytest tests/test_reviewed_plan_extension.py -q -m container
scripts/test-tier1.sh --probe
scripts/test-all.sh
```

The Node suites, executed by the container-marked Python bridge, cover native
and conversational planning registration, native implementation prep ordering,
fail-closed dual-skill loading, exactly-one-`agent_end` approval survival,
cancellation, lifecycle clearing, consume-on-use, validation, canonical Markdown
loading, controlled publisher acknowledgements and
rejections, failure isolation, opaque temporary-Git promotion,
lifecycle-directory preservation, promotion commits, inherited context,
protocol-7 daemon envelopes, durable handoff-first bootstrap admission,
version-1 compatibility, per-mutation crash-window and uncertain-delivery replay
suppression, allowed-empty promotion commits, partial cleanup observability,
active and inactive replay, collision safety, confirmed invocation-owned cleanup,
exact-owner remote handoff, quiescent-state checks, ordered prompt/follow-up
delivery, and visible partial or uncertain failures. These maintained plugin tests
exercise production request and control-flow code. Their controlled client
responses are not native-runtime admission proof.

The Python bridge reruns both suites inside tier 1 and uses the
container-installed Prime Agent RPC plus startup probes to check one native
`plan`, one native `implement-spec`,
explicit `ralph_plan`, `create_spec_episode`, and `handoff_spec_episode` tools, no
`ralph_implement_spec` tool, a valid inherited Prime Agent context, and bounded
daemon create/state/messages/kill behavior at the episode worktree CWD. Previously
measured Prime Agent 0.9.5 streaming, residual-work queueing, and steer behavior is
retained review evidence rather than a claim manufactured by the plugin tests.

Together these checks prove deterministic command loading and bounded episode
mechanics within their stated test boundaries.
They use disposable repositories, offline RPC, and controlled daemon probes.
They do **not** prove that a human completed both review gates, observed a live
production episode through execute/handoff, made a terminal merge or abandonment
decision, and reaped that episode safely.

## Live end-to-end dogfood status

The conversational-routing proof of concept completed the full reviewed
conversation → isolated episode → bounded execute/handoff slices → owner Expert
review → explicit merge → safe cleanup lifecycle. Its accepted implementation is
archived under
[`.ralph/plans/archive/conversational-ralph-command-routing/`](../.ralph/plans/archive/conversational-ralph-command-routing/).
That run also established why this owner-driven operation is necessary: every
between-slice transition still required the operator to type native `/handoff`
in the episode TUI because ordinary cross-session messages do not invoke the
slash-command dispatcher.

The automated coverage here proves the new exact-owner host mechanics and wire
ordering. A later episode can dogfood `handoff_spec_episode` itself and record
its live compaction-request transcript without changing this capability's
bounded authority or failure contract.
