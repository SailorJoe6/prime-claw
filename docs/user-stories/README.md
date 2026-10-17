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
| [B](B-project-initialization.md) | Initialize and maintain a project | US-03–US-07 |
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
- **Operator** retains product, scope, merge, abandonment, destructive cleanup,
  placement, and other one-way decisions.

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

Likewise, command and tool variants are usually two interfaces to one story.
The primary task-native lifecycle uses `/plan` with `plan_task`,
`/implement-task` with `create_task_episode`, and `handoff_task_episode`.
Conversation review and outcomes use ordinary Git plus the supported Backlog CLI;
the cleanup-only `finalize_task_episode` remains the narrow resource boundary. Retained version-1 compatibility
keeps `/plan-spec` with `plan_spec`, `/implement-spec` with
`create_spec_episode`, exact blocked recovery with
`restore_blocked_spec_episode`, `handoff_spec_episode`, and
`finalize_spec_episode`.
Ordinary `/handoff` and `ralph_handoff` remain the non-Episode pair, while
`/initialize-prime-claw` and `initialize_prime_claw` remain the initialization
pair.

## Candidate simplification seams

These overlaps are places to investigate simplification without deleting the
underlying story:

1. `design` and `spec-it-out` share nearly the same artifact contract.
2. Primary task-native planning and implementation share exact-task prep,
   compaction, and sole-follow-up admission; retained version-1 compatibility
   preserves the corresponding exact-folder pattern.
3. Ordinary handoff and owned-Episode handoff share the handoff-to-execute
   semantic chain but use different transports.
4. Slash commands and tools duplicate adapter surfaces over shared operations.
5. Planning and implementation-readiness judgment is repeated across several
   Markdown assets and must remain proportional to the actual work.
6. Path, ownership, and Episode-state checks still overlap across admission,
   handoff, and cleanup and should remain proportional to each resource boundary.
7. Preferred Orca creation and narrow local fallback maintain parallel
   provisioning and recovery paths.
8. Template comparison uses a substantial state machine for a temporary diff.
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
