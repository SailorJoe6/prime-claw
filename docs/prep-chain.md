# Compact-first planning and implementation chains

Prime Claw exposes two native project workflows and one planning tool:

```text
/plan-spec .ralph/plans/future/<slug>
plan_spec({"location":".ralph/plans/future/<slug>"})
/implement-spec .ralph/plans/future/<slug> [--host id:<project-host-setup-id>]
```

Each admission validates one exact project-relative future folder and preloads
both project-owned workflow files before sending either message.

| Entry point | First message | Sole follow-up |
| --- | --- | --- |
| Native `/plan-spec` | wrapped `plan-prep`, ordinary delivery | wrapped `plan-spec` |
| `plan_spec` | wrapped `plan-prep`, `steer` delivery | wrapped `plan-spec` |
| Native `/implement-spec` | wrapped `implement-prep`, ordinary delivery | full ordinary oversight guide followed by wrapped `implement-spec` |

The prep workflow may request focused compaction. It does not wait for a compact
event, recreate the phase prompt, or control the already queued follow-up. The
phase workflow performs its own preparation and semantic readiness review after
the turn boundary.

Planning creates or updates only the selected future bundle and stops for
operator review. It never authorizes implementation.

Implementation admission records a minimal in-memory guard for the current
owner session, exact folder, and optional stable setup ID. The guard survives
the prep turn, is consumed by one exact `create_spec_episode` call during the
phase turn, and is cleared if that turn ends without creation. It is not a
durable approval or guide receipt.

`create_spec_episode` remains the only mechanical promotion boundary. Semantic
readiness stays in `implement-spec`; deterministic code owns placement,
promotion, session binding, and one fixed execute assignment. Missing or
mismatched admission fails before lifecycle mutation.


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
