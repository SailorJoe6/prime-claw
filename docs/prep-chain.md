# Compact-first planning and implementation chains

Prime Claw exposes globally discoverable Markdown entry skills and agent-callable
operations. The operator can ask conversationally or use native `/skill:`:

| Entry skill | Agent operation |
| --- | --- |
| `plan` | `plan_task({"taskId":"TASK-ID"})` |
| `plan-spec` | `plan_spec({"location":".ralph/plans/future/<slug>"})` |
| `implement-task` | `implement_task({"taskId":"TASK-ID","host":"id:<setup-id>"})` |
| `implement-spec` | `implement_spec({"location":".ralph/plans/future/<slug>","host":"id:<setup-id>"})` |
| `handoff` | `ralph_handoff({"guidance":"optional operator focus"})` |

`host` and handoff guidance are optional. The thin entries route to canonical
project phase policy; they do not duplicate it. Prime Claw registers no custom
`/plan`, `/plan-spec`, `/implement-task`, `/implement-spec`, or `/handoff`
commands. Prime Agent built-ins and native `/skill:` remain available.

Markdown owns phase authority. Planning alone stops for review and grants no
implementation permission. An explicit conditional request to plan then implement
when ready may remain valid within approved scope, without new approval solely
because planning finished. Material ambiguity or scope changes require
clarification. Explicitly delegated task selection stays within stated bounds
and binds an exact canonical task before invoking task-specific operations.
Implementation requires existing `In Planning` (Beads `in_planning`) after design
and planning, not dependency readiness alone. No separate phase-history or prior-
invocation proof supplements that state. Retained folder selection still requires
an exact operator-selected location; skills do not search for or invent one.
Both final create tools retain exact-resource mechanics, not approval stores.
Lower-level task lifecycle policy gates still await later PRIMECLAW-55 work;
this entry/prep-chain slice does not claim their removal.

Task planning resolves one exact task through the repository's selected native
provider without an entry-code status eligibility test. The editable `plan`
skill and queued planning workflows decide whether the current task is
`In Design` or `In Planning` (Beads `in_design` or `in_planning`) and has a useful
specification. They explain unexpected or unmapped statuses and inadequate
content without mutation. Backlog keeps its exact returned task path; Beads keeps
its exact project root, entire canonical ID, native status, and complete raw view
without inventing a path. Both planning messages carry the exact provider/root
binding selected by the same discriminated resolver used by implementation
entry, plus the complete `task.nativeView` JSON in
`<operator-plan-task-observation>`. Both implementation messages likewise carry
`<operator-implementation-task-observation>`, with the existing provider/root
and Backlog-only path tags. These observations retain the full provider-native
envelope, names, values, and absent fields. They are facts, not approval or
frozen revision locks. Workflows reread the exact native task before acting and
judge compatible refinements from current facts. Folder-compatible
admission validates one exact project-relative future folder. The sole
source-absent exception is implementation replay for the exact already-active
version-1 owner: deterministic admission verifies its source identity, promoted
active pair, and frozen digest before queueing the same workflows. Every path
preloads both project-owned workflow files before sending either message.
Planning, implementation preparation, ordinary handoff, and owned-Episode
handoff use one internal prompt loader and one two-message admission sequence.
Their public entry points, validation, authority, and delivery transports remain
separate.
Read-only legacy lookup is limited to `handoff` and `execute` so an active
old-layout Episode can finish from its unchanged snapshot.

| Agent entry | First message | Sole follow-up |
| --- | --- | --- |
| `plan_task` | wrapped `plan-task-prep`, `steer` delivery | wrapped `plan-task` |
| `plan_spec` | wrapped `plan-prep`, `steer` delivery | wrapped `plan-spec` |
| `implement_spec` | wrapped `implement-prep`, `steer` delivery | full ordinary oversight guide followed by wrapped `implement-spec` |
| `implement_task` | wrapped `implement-task-prep`, `steer` delivery | full ordinary oversight guide followed by wrapped `implement-task` |

The task-native implementation chain is registered alongside the retained folder path. Before
it admits either message, code resolves the exact task and selects one exact
ready local Orca setup. The entry skill and queued workflows, not this code,
require current `In Planning` (Beads `in_planning`), a meaningful native plan or
`design`, actual implementation authority, and semantic readiness. Unexpected
statuses and inadequate plans must be explained without mutation or creation;
a readable task and successful queue admission are not readiness. A sole setup
or explicit stable setup ID is accepted; UI cancellation, noninteractive ambiguity, no ready
setup, or remote placement fails without queueing a workflow. Direct local
fallback is selected only when the production Orca command is definitively
absent and no explicit setup was requested. Malformed or negative inventory
responses fail closed. Placement selection performs no task, Git,
ownership, worktree, or session mutation.

The deeper create/allocation path still contains policy pending extraction.
For independent Backlog it requests `In Progress` publication and reserves task
revision/native view separately from code. The lower publication operation now
uses one exact-task native edit, path-only commit and non-force push, without a
whole-clone cleanliness test or automatic reconciliation. Episode task workspace
preparation obtains the intended native clone without preparing the primary
clone again. Deeper reservation, code-base and reserved-task predicates still
exist; native preparation success does not claim their removal. The registered
code worktree and exact task are still addressed before session/execute delivery.

The prep workflow may request focused compaction. It does not wait for a compact
event, recreate the phase prompt, or control the already queued follow-up. The
phase workflow performs its own preparation and semantic readiness review after
the turn boundary.

Task-native planning updates only the selected provider-native task. Backlog
preserves the selected topology: grandfathered stores commit only the native
Implementation Plan task path in code history, while an independent nested store
commits only that path on `refs/heads/prime-claw/tasks`, pushes without force,
verifies the selected committed task's publication, and does not write code
HEAD, index, or files. Coherent selected-ticket edits are committed promptly and
published before an Episode needs them. Backlog preserves and excludes unrelated
bytes/staging from its selected-file commits. Both providers preserve native
fields and compatible history descendants without stashing, resetting, or
overwriting them to satisfy a cleanliness check. Beads has the accepted native
multi-issue commit scope described below, not Backlog's selected-file isolation.
Beads uses one native synchronization/read, LLM planning over the complete raw view, one
guarded raw `design` plus `in_planning` update, one non-force publication, and
exact native reread/publication proof; it never consults the Backlog-only queue,
creates a task path, or mirrors content. Compatible same-task refinements are
facts for the planning LLM rather than approval locks. Folder-compatible
planning updates only the selected future bundle. Planning alone stops for review
and never authorizes implementation. If the operator already explicitly authorized
planning then implementation within scope, the agent may invoke the implementation
entry after the plan is complete and readiness is satisfied. Planning admission
itself remains terminal routing: end that turn and let its sole follow-up run.

Retained implementation uses no legacy approval map, consumed guard, or turn
receipt. Both canonical messages carry the exact selected source location and
optional stable host as factual operation data. Preparation preserves actual
operator authority and approved scope through compaction. A planning-only
instruction remains planning-only. The project-customizable readiness policy
clarifies missing authority, ambiguity, or new scope before final creation.

`create_spec_episode(location, host?)` is self-contained. For fresh work it
reloads the current complete bundle and captures its digest at the concrete
create boundary for integrity checks, not proof of an earlier invocation. The
specification must still match the frozen grandfathered inventory; the execution
plan remains living and receives semantic review. Source-absent replay resolves
exact already-active version-1 ownership before source lookup, verifies the
promoted active pair and original identity, and returns only those same
resources with no new execute assignment. It is not a new admission.

The task-native chain likewise has no invocation-proof approval store or turn
receipt. Both canonical messages carry the exact task ID and, for selected Orca
placement, `<operator-implementation-host>id:<setup-id></operator-implementation-host>`.
A selected local fallback is reported explicitly without inventing a host ID.
Preparation preserves the operator's actual instruction, approved scope,
conditional implementation authority, and optional stable host through
compaction. It cannot turn planning-only authority into implementation approval.
The project-customizable phase policy owns lifecycle eligibility, semantic
readiness, approval, and selected-ticket publication decisions; task status alone
is not readiness and is not supplemented by a phase-history receipt. These rules
live in editable entry skills and workflows, not tool prompt guidelines or
entry/prep-chain status gates.

`create_spec_episode` remains the retained folder promotion boundary or exact
active replay return. A selected stable `id:<setup-id>` host is carried unchanged
into final creation and revalidated, never stored privately as approval or
silently substituted. Exact active replay must keep its recorded placement and
resource identity. `create_task_episode(taskId, host?)` is also self-contained:
its tool wrapper resolves current native provider, canonical task/root/path,
and placement without requiring any prior entry invocation or repeating the
entry-level status/plan check. The deeper create path still checks `In Planning`
and plan evidence, alongside code-base/publication and lifecycle gates pending
later extraction on this same task. A carried stable host is revalidated before
mutation; absent host uses the same safe sole-ready/picker/definitive-unavailability
rules. Native
code retains identity, publication, ownership, reservation, session binding,
and one fixed execute assignment checks. Invalid concrete state fails before
lifecycle mutation; uncertainty never authorizes a duplicate admission. Successful
entry admission reports queued work, not completed compaction, readiness, or
creation, and the caller ends its turn.


## Requested creation and failure decisions

Task-native create performs the caller-requested In Progress native operation,
then reserves and allocates the exact task resources. It does not independently
judge lifecycle status, plan/design, code-base suitability, whole-checkout dirt,
or compatible changing native views. Existing implementation Markdown owns those
decisions. Native failures and exact resource/identity mismatches still report
truthfully. On failure, native task state and existing ownership/resources remain;
code no longer chooses In Planning rollback versus Blocked publication. The owning
Conversation inspects current task/history/resource/session/assignment facts and
chooses any supported status/note publication through editable guidance. Backlog
remains selected-file-only; Beads retains approved multi-issue commit consequences
and actual push/local-versus-task-publication limits. The one initial execute and
both continuation observation channels remain unchanged. This is not a claim
that the remaining terminal lifecycle or full guidance audit is complete.

## Observational task lookup (PRIMECLAW-55 first slice)

The default task resolver reads the selected local workspace without implicitly
preparing a missing Backlog clone or fetching/fast-forwarding an existing one.
It does not run provider lifecycle-capability checks before a native task read.
Backlog returns its complete native task-view envelope alongside the existing
selection fields. Beads retains its complete native view, native status and
field absence. Known Beads canonical aliases remain available to existing
callers; an unmapped status is returned as the raw status, not refused or mapped
to Done. Native command errors remain errors.

Planning and implementation workflows now explicitly own lookup interpretation,
needed workspace preparation/synchronization and selected-ticket durability.
Unrelated task/code dirt is not a reason to hide a readable task. A read observes
local facts, not proof of remote freshness or implementation authority. A native
CLI can perform its own documented migrations; this change removes Prime Claw's
implicit preparation, not native provider behavior.

## Entry and prep-chain policy extraction (PRIMECLAW-55 second slice)

For both Backlog and Beads, task planning and implementation entry/prep-chain
code now supplies factual native observations rather than enforcing lifecycle
eligibility. The duplicate implementation status/plan wrapper check is removed
from the final task-create tool as well. Authority, bounded selection, eligible
native statuses, meaningful specification/plan content, selected-ticket native
commit/publication, and terminal routing guidance live in editable Markdown.
Successful admission queues work; it is not completed compaction, readiness, or
creation. The caller stops after admission. Uncertainty calls for inspection of
current facts, never blind delivery retry or fresh duplicate allocation.

Placement inventory resolution is unchanged. Carry the exact selected optional
stable host through readiness and final creation; do not silently substitute it.
Fresh Episode creation has one initial execute assignment, not an initial
handoff or a second prompt. The owner retains lifecycle/disposition decisions;
the Episode maintains implementation and native task content, plan, and evidence.

This entry/prep-chain change is not complete lifecycle extraction. The lower
preparation/publication operations described below are a separate third slice.
Deeper `createTaskEpisode`, allocation/reservation, automatic failure disposition,
handoff, oversight, block/resume, merge/abandonment, and finalization/cleanup still
contain policy gates pending later work on the same PRIMECLAW-55 task. Their failures
remain truthful native/code evidence, not permission to bypass them. Retained
folder workflows and existing workflow loading are unchanged. No new protocol,
approval receipt, live activation, or same-operation resource recovery is claimed.

## Native preparation and direct publication (PRIMECLAW-55 third slice)

The lower Backlog Episode preparation path no longer prepares the primary clone
again or treats unrelated task/code work as a global-cleanliness prerequisite.
It targets the existing native store layout and selected remote. Explicit native
clone/fetch/fast-forward operations report their own failures; they do not wait
for a stable whole-branch revision or decide semantic compatibility.

The Backlog publication helper performs one native exact-task read/edit/reread,
a path-limited ordinary Git commit and one non-force push. It preserves unrelated
index entries and working files. It does not fetch/merge/retry a rejected push,
classify other-task changes, require a meaningful plan/status, or count the
whole checkout's changed paths. It returns before/after native views and factual
Git results/heads for the Agent. A later remote head is an observation, not a
frozen-revision approval failure.

Beads transport preparation supplies native workspace/database/branch/remote and
revision facts without requiring lifecycle capability, a clean whole working
set or equality between live and remote revisions. Native status publication
uses supported operations once, returning complete raw task views and operation
results instead of a paired stable-revision, parent or content approval. It does
not fabricate a Backlog path or use repeated isolated whole-store clones as an
approval pipeline. A rejected native command remains a failure; success is not
semantic acceptance or proof the changed task reached history. A trailing native
commit may fail or only log failure; inspect actual history/revision/publication
facts before claiming durability.

Beads v1.3.1 native touched-table/staged-set commits may include multiple issues;
no per-issue history isolation is promised. Before consequential native mutation,
commit, or push, the Agent inspects pending/staged native changes, discloses and
reviews the consequences, and consults if pending work is unauthorized or unclear.
With auto-commit on, a native update may commit touched-table/pre-staged pending
work before any push. Pending or
concurrent native database changes can prevent a safe operation; judge actual
facts without a replacement code-level dirty gate or blanket quiescence rule.
Do not add row filtering, another store/branch, dependency patches, or a
policy/facts framework to imitate per-issue history. Backlog's selected-file
guarantees, unrelated Git dirt and compatible descendants are unchanged.

The editable implementation workflow tells the invoking Agent to inspect the
selected task/diff and current history, ensure authorized ticket durability,
interpret native conflicts, and preserve unrelated work. Neither dirty state
nor successful transport grants authority to commit or publish unauthorized work.
Reconciliation and failure disposition are LLM decisions from current facts,
not automatic retry, rollback or a replacement allocation. Deeper creation,
ownership and lifecycle callers may still apply policy awaiting later slices;
this bounded helper extraction is not full initiation or task completion. Full
both-provider lifecycle-policy extraction, the secondary durability audit, and
bounded recovery remain in scope on PRIMECLAW-55.

## Validation policy

Plugin candidates are validated only in isolated Docker Tier 1. Never apply,
check, or probe an unaccepted candidate against the host user-global plugin.
Useful gates are:

```bash
python3 -m pytest tests/ -q -m container
scripts/test-tier1.sh --probe
scripts/test-all.sh
```

The container suite includes the reviewed-plan Node behavior bridge and native
Prime Agent lifecycle probes. Host-safe Tier 0 covers static policy and pure
logic only.
