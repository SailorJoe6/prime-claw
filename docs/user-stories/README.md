# Prime Claw plugin user stories

This directory describes the user outcomes implemented by the current Prime
Claw plugin and its installed global and project assets. It is organized by
lifecycle area rather than by TypeScript module, command, or test suite.

The plugin itself is required. This inventory exists to separate the product
stories that must survive from implementation machinery that may still be
simplified.

## Product boundary

The current plugin is the manual Conversation-to-Episode lifecycle layer:

> install → initialize → specify → plan → approve → create Episode → execute →
> supervise and review → hand off → close

It is not the complete persistent virtual assistant described in
[`VISION.md`](../../VISION.md). The universal agent, full gbrain controller,
channel routing, browser proxy, autonomous scheduling, and orchestrator remain
outside the current plugin.

## Story map

| Group | Lifecycle area | Stories |
|---|---|---:|
| [A](A-installation.md) | Install and maintain the plugin | US-01–US-02 |
| [B](B-project-initialization.md) | Initialize and maintain a project | US-03–US-07, US-28 |
| [C](C-specification.md) | Develop a specification | US-08–US-10 |
| [D](D-planning.md) | Produce and review an implementation plan | US-11–US-12 |
| [E](E-episode-promotion.md) | Admit an approved task or retained version-1 bundle into an Episode | US-13–US-16 |
| [F](F-episode-execution.md) | Implement work inside an Episode | US-17–US-18 |
| [G](G-oversight-and-review.md) | Supervise and review implementation | US-19–US-21 |
| [H](H-handoff-and-continuation.md) | Continue work across iterations | US-22–US-23 |
| [I](I-episode-finalization.md) | Finish an Episode | US-24 |
| [J](J-work-control.md) | Control long-running agent work | US-25–US-26 |
| [K](K-developer-safety.md) | Develop Prime Claw safely | US-27 |

## Acceptance traceability

[`traceability.md`](traceability.md) maps every story to observable acceptance,
current behavioral/integration/manual evidence, static proxies, and explicit
gaps. Simplification work must use that matrix rather than infer coverage from
test names or implementation shape.

## Cross-cutting authority boundary

The plugin separates responsibilities:

- **Conversation** supervises an owned Episode.
- **Episode** implements approved scope.
- **Expert** provides independent read-only review.
- **Operator** retains product, scope, merge, abandonment, placement, and other
  one-way decisions. For task-native Episodes, an already authorized committed
  and pushed terminal outcome includes automatic prompt-led exact cleanup
  without separate cleanup confirmation. Retained version-1 destructive cleanup
  still requires separate operator authority.

No role borrows another role's authority. See
[`ROLE_KERNEL.md`](../../src/prime-agent-plugin/ROLE_KERNEL.md) and
[`conversation-driven-episode-oversight.md`](../conversation-driven-episode-oversight.md).

## Supporting mechanisms, not separate user stories

These mechanisms support the stories but are not user outcomes by themselves:

- bundle digests and ownership JSON schemas;
- atomic writes, locks, receipts, and marker formats;
- path-containment and symlink checks;
- Orca launch-automation creation and removal;
- daemon JSONL operations and message delivery modes;
- exact source-versus-installed byte comparisons;
- fake adapters and dependency-injection seams;
- Docker fixtures and isolated roots, which are mechanisms serving US-27 rather
  than separate outcomes.

Thin global entry skills route conversational requests to agent-callable
operations; native `/skill:` invocation remains available. The primary task-native
lifecycle uses `plan` with `plan_task`; `implement-task` uses `implement_task` before self-contained `create_task_episode`,
and owned task continuation uses `handoff_task_episode`. Retained version-1
compatibility uses `plan-spec` and `implement-spec` with `plan_spec` and `implement_spec` before self-contained
`create_spec_episode`; blocked recovery, continuation and bookkeeping remain
`restore_blocked_spec_episode`, `handoff_spec_episode`, and `finalize_spec_episode`.
Ordinary `handoff` uses `ralph_handoff`, not an owner lifecycle shortcut.
`initialize-prime-claw` uses `initialize_prime_claw` for setup and upgrades.
The five custom workflow commands are removed, not Prime Agent built-ins.

Markdown owns phase authority: planning alone stops, while explicit conditional
plan-then-implement authority may continue within scope after readiness. Bounded
delegated selection binds an exact task; implementation requires existing
`In Planning` after design/planning, not dependency readiness alone or a sequence
receipt. Review and terminal outcomes remain prompt-led through ordinary Git and
the native provider CLI. After an authorized committed/pushed terminal outcome,
the Conversation automatically invokes cleanup-only `finalize_task_episode`.
Error interpretation and safe re-invocation from current evidence remain
prompt-led. Retained version-1 resources and lifecycle remain supported; this
invocation change does not migrate, retire, or clean them up.

## Candidate simplification seams

These overlaps are places to investigate simplification without deleting the
underlying story:

1. `design` and `spec-it-out` share nearly the same artifact contract.
2. Primary task-native planning and implementation share exact-task prep,
   compaction, and sole-follow-up admission; retained version-1 compatibility
   preserves the corresponding exact-folder pattern.
3. Ordinary handoff and owned-Episode handoff share the handoff-to-execute
   semantic chain but use different transports.
4. Thin entry skills route to shared tools; detailed policy stays in canonical project workflows.
5. Planning and implementation-readiness judgment is repeated across several
   Markdown assets and must remain proportional to the actual work.
6. Path, ownership, and Episode-state checks still overlap across admission,
   handoff, and cleanup and should remain proportional to each resource boundary.
7. Preferred Orca creation and narrow local fallback maintain parallel
   provisioning and recovery paths.
8. Current template comparison uses an ordinary Git text patch without changing
   actual assets or the index. Legacy interrupted-review recovery stays separate.
9. Asset truth is spread across the inventory, apply/check allowlists, helper
   managers, and retired-file lists.
10. Oversight and goals/heartbeat policy is reinforced through role policy,
    skills, continuation fragments, hooks, and documentation.

These are implementation seams, not evidence that the plugin or stories are
unnecessary.

## Explicitly outside the current plugin

The current plugin does not implement:

- the always-on universal agent;
- complete gbrain controller behavior;
- Telegram or Slack routing;
- browser proxy integration;
- autonomous scheduling or orchestration;
- remote Episode bundle transport;
- a general skill-pack distribution system;
- the planned general upgrade command for arbitrary older Ralph projects.

The checked source generation also intentionally has no Conversation-guide
activation or readiness protocol tools. Oversight guidance is ordinary managed
Markdown loaded during implementation admission and reinjected after qualifying
compaction.
