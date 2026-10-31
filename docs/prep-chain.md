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
Both final create tools retain concrete integrity checks, not approval stores.

Task planning resolves one exact task through the repository's selected native
provider and admits only canonical `In Design` or `In Planning`. Backlog keeps
its exact returned task path; Beads keeps its exact project root, entire
canonical ID, native status, and complete raw view without inventing a path.
Both planning messages carry the exact provider/root binding selected by the
same discriminated resolver used by implementation admission. Folder-compatible
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
it admits either message, deterministic code resolves the exact `In Planning`
task and selects one exact ready local Orca setup. A sole setup or explicit
stable setup ID is accepted; UI cancellation, noninteractive ambiguity, no ready
setup, or remote placement fails without queueing a workflow. Direct local
fallback is selected only when the production Orca command is definitively
absent and no explicit setup was requested. Malformed or negative inventory
responses fail closed. Placement selection performs no task, Git,
ownership, worktree, or session mutation.

For independent Backlog, implementation admission publishes `In Progress` from
the clean primary nested clone and reserves the published task revision/native
view separately from the unchanged clean code base. Only then is the registered
code worktree created. Its nested task clone is prepared and the exact reserved
task is reread before any session, automation, or execute delivery.

The prep workflow may request focused compaction. It does not wait for a compact
event, recreate the phase prompt, or control the already queued follow-up. The
phase workflow performs its own preparation and semantic readiness review after
the turn boundary.

Task-native planning updates only the selected provider-native task. Backlog
preserves the selected topology: grandfathered stores commit only the native
Implementation Plan task path in code history, while an independent nested store
commits only that path on `refs/heads/prime-claw/tasks`, pushes without force,
proves direct publication, and leaves code HEAD unchanged. Beads uses one
native synchronization/read, LLM planning over the complete raw view, one
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
The project-customizable phase policy owns semantic readiness and approval
judgment; task lifecycle state is not supplemented by a phase-history receipt.

`create_spec_episode` remains the retained folder promotion boundary or exact
active replay return. A selected stable `id:<setup-id>` host is carried unchanged
into final creation and revalidated, never stored privately as approval or
silently substituted. Exact active replay must keep its recorded placement and
resource identity. `create_task_episode(taskId, host?)` is also self-contained:
it resolves current native provider, canonical task/root/path, `In Planning`
state, meaningful plan, and placement without requiring any prior entry
invocation. A carried stable host is revalidated before mutation; absent host
uses the same safe sole-ready/picker/definitive-unavailability rules. Native
code retains identity, publication, ownership, reservation, session binding,
and one fixed execute assignment checks. Invalid concrete state fails before
lifecycle mutation; uncertainty never authorizes a duplicate admission. Successful
entry admission reports queued work, not completed compaction, readiness, or
creation, and the caller ends its turn.


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
