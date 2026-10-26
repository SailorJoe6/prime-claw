# Compact-first planning and implementation chains

Prime Claw exposes task-native planning alongside the folder-compatible
planning and implementation surfaces:

```text
/plan TASK-ID
plan_task({"taskId":"TASK-ID"})
/plan-spec .ralph/plans/future/<slug>
plan_spec({"location":".ralph/plans/future/<slug>"})
/implement-spec .ralph/plans/future/<slug> [--host id:<project-host-setup-id>]
/implement-task TASK-ID [--host id:<project-host-setup-id>]
```

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

| Entry point | First message | Sole follow-up |
| --- | --- | --- |
| Native `/plan TASK-ID` | wrapped `plan-task-prep`, ordinary delivery | wrapped `plan-task` |
| `plan_task` | wrapped `plan-task-prep`, `steer` delivery | wrapped `plan-task` |
| Native `/plan-spec` | wrapped `plan-prep`, ordinary delivery | wrapped `plan-spec` |
| `plan_spec` | wrapped `plan-prep`, `steer` delivery | wrapped `plan-spec` |
| Native `/implement-spec` | wrapped `implement-prep`, ordinary delivery | full ordinary oversight guide followed by wrapped `implement-spec` |
| Native `/implement-task` | wrapped `implement-task-prep`, ordinary delivery | full ordinary oversight guide followed by wrapped `implement-task` |

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
planning updates only the selected future bundle. Both stop for operator review
and never authorize implementation.

Retained implementation admission records a minimal in-memory guard for the
current owner session, exact source location, and optional stable setup ID. For
fresh work it also binds the complete bundle digest. For source-absent replay it
binds the persisted digest of the exact active owner and can dispatch only to
the same idempotent Episode branch, which creates no resource and sends no
assignment. The guard survives the prep turn, is consumed by one exact
`create_spec_episode` call during the phase turn, and is cleared if that turn
ends without creation.

The task-native chain records the same kind of ephemeral authority only
after exact placement and both workflow messages succeed. It binds owner
session, canonical task ID, canonical task path and project root, plus the exact
`orca` setup or proven-unavailable `local` fallback. The guard is unavailable in
the prep turn, consumable once only for the same re-resolved task during the
semantic phase, and cleared on phase end, session start, or shutdown. Neither
guard is a durable approval or guide receipt.

`create_spec_episode` remains the retained folder promotion boundary or exact
active replay return, while `create_task_episode` consumes only the exact
matching task approval. Semantic
readiness stays in the corresponding phase workflow; deterministic code owns
placement, status publication, reservation, session binding, and one fixed
execute assignment. Missing or mismatched admission fails before lifecycle
mutation.


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
