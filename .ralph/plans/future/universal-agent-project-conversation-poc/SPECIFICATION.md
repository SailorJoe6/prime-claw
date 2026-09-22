# Future Specification — Universal-agent and project-conversation manual POC

> **Status:** incubated future specification; manual proof of concept only.
> **Related work:** [Conversation-driven episode oversight](../conversation-driven-episode-oversight/SPECIFICATION.md)

## Purpose

Use the current Prime Agent session to emulate the future `UNIVERSAL_AGENT` and
manually launch and work with genuine project-rooted `PROJECT_CONVERSATION`
sessions across repositories under `~/Code`.

The POC is both a technical experiment and a UX design exercise. It should
reveal how the operator wants to discover projects, start and resume
conversations, communicate directly or through the universal agent, and
coordinate work. It should also expose the mechanics that the final sandboxed
prime-claw will eventually need.

This work is manual-first. It uses Prime Agent's existing sibling-session
capabilities and documents what is learned. It does not implement a new launcher
or orchestrator.

## Relationship to episode oversight

This specification remains separate from
[conversation-driven episode oversight](../conversation-driven-episode-oversight/SPECIFICATION.md).

This POC concerns:

```text
UNIVERSAL_AGENT emulator
  → managed project clone
  → durable PROJECT_CONVERSATION sibling
```

The oversight specification concerns:

```text
PROJECT_CONVERSATION
  → approved implementation EPISODE
  → review, disposition, and cleanup
```

A project conversation created here may exercise the oversight workflow.
Findings should improve the specification they actually concern rather than
merging the two designs.

## Emulated environment

The current session is rooted in the `prime-claw` builder repository. It is not
inside the final sandbox and must describe itself as an emulation of the future
`UNIVERSAL_AGENT`.

For this POC:

- `~/Code` represents the final sandbox-owned home containing managed project
  clones;
- all repositories under `~/Code` are authorized managed projects, without a
  separate allowlist;
- dirty checkouts are normal and must be understood and preserved rather than
  treated as blockers; and
- host-only behavior should be distinguished from final sandbox behavior when
  the difference matters.

The current session may continue incubating this specification and the related
episode-oversight specification as the operator supplies direction and the POC
produces evidence. That does not itself authorize implementation work in a
managed project.

## Project conversations

A `PROJECT_CONVERSATION` is an independent, durable daemon sibling/root session
created with the selected repository as its spawn-time working directory. It is
not an RLM child, and changing this session's process directory is not an
equivalent substitute.

Runtime sibling topology and product ownership are different concepts. The
universal agent logically manages project conversations even though they are
siblings in the Prime Agent daemon. A project can have more than one
conversation, so a repository path does not uniquely identify a conversation.

A project conversation should orient from its own repository's instructions,
skills, Git state, worktrees, and task tracking. It should preserve existing
work and retain its identity across pauses and resumes. The universal-agent
emulator may give it a focused role prompt and exact references when needed; it
should not make the conversation bulk-load the builder repository.

## Capability provisioning

Prime-claw's current Ralph plugin is installed project-locally in the builder
repository. Prime Agent discovers project-local extensions from the new
session's own CWD hierarchy, not from a sibling repository. A project
conversation rooted in another repository therefore cannot use the plugin
unless it is also available globally or installed into that project.

For this manual POC, the plugin is installed once into Prime Agent's global
plugin location on this personal lab machine. The global installation is copied
from the prime-claw builder project and refreshed there whenever the builder's
plugin changes. The universal-agent emulator verifies that the global copy is
present and current before launching project conversations. It does not install
a separate plugin copy into every managed repository.

This lab-global installation is POC scaffolding, not a requirement that
prime-claw modify an operator's ordinary host environment. The final sandbox
uses the same placement model inside its isolated home: sandbox construction or
convergence copies the plugin from the builder project into Prime Agent's global
plugin location so every project conversation can discover one shared version.

If a managed project already contains a project-local copy of the plugin, the
universal agent surfaces the possible duplicate or stale override and reconciles
it deliberately. It does not silently maintain competing global and local
copies. The first read-only startup probe in `openclaw-setup` confirmed why: its
older project-local handoff extension and the global handoff extension both
loaded as `handoff:1` and `handoff:2`, leaving no unambiguous canonical
`/handoff`. After the operator removed the local copy and restarted Prime Agent,
a fresh probe registered exactly one `/handoff`, `/plan`, and `/implement-spec`,
all from the global installation.

The workflow Markdown remains project-local in both stages. The
`UNIVERSAL_AGENT` must ensure every managed `PROJECT_CONTEXT` contains a local
`.ralph/` tree with the canonical `plans/` and `skills/` structure. If the tree,
a required subfolder, or any canonical Ralph skill is missing, the universal
agent installs the missing templates from prime-claw without overwriting
existing customized files, then prompts the operator to verify and customize
the templates for that project.

`.ralph/skills/` is the canonical policy location but is not itself a Prime
Agent skill-discovery directory. The builder currently exposes directly invoked
phases through `.agents/skills` symlinks while native plugin commands load other
phase Markdown from `.ralph/skills/`. Project-context preparation must reproduce
or deliberately replace that exposure and verify that the intended skills and
native commands are actually available in the new session. File presence alone
is insufficient: existing customized skills must also match the native command
contract and reviewed future-folder lifecycle. The continuing `openclaw-setup` audit demonstrated this distinction. The
operator first aligned its design, specification, planning, and handoff
policies, then authorized the universal-agent POC to finish the remaining
project preparation. The POC added `implement-spec`, replaced the blocked and
execute policies that depended on parked Prime Ralph, removed direct `plan` and
`handoff` skill exposure, and exposed `blocked`. A fresh offline Prime Agent
startup then found exactly one global `/handoff`, `/plan`, and `/implement-spec`
and only the intended project-local direct skills. The project's full Tier 1
run still had three stale Prime Ralph/future-package assertions; those are
tracked separately for removal under `openclaw-fa9n` and do not indicate a
plugin or skill-discovery collision.

Provisioning is not complete merely because files were copied. Before launching
or routing work that depends on Ralph, the universal agent verifies the global
plugin and the target project's required workflow skills are present and
discoverable. The POC should document the exact global install, refresh, and
verification procedure and record where project-specific customization is
needed. A global refresh is not active merely because `/reload` was invoked:
observed plugin generations can remain resident past reload, so affected work
must quiesce and the Prime Agent process or session must restart before fresh
verification.

The first lab-global installation is complete. The five managed files matched
the builder sources byte for byte, and a disposable offline Prime Agent RPC
session outside the builder repository registered `/handoff`, `/plan`, and
`/implement-spec` from the global paths plus all four expected structured tools.
The manual refresh and verification procedure is recorded in
[the lab-global plugin runbook](../../../../docs/lab-global-plugin.md).

## Manual launch and lifecycle work

Sibling launching is already a proven Prime Agent capability. This POC should
learn and document how the installed runtime exposes it in practice, including
how this session launches a project-rooted sibling, supplies and verifies the
required prime-claw capabilities, records its identity, communicates with it,
and later finds, resumes, or stops it.

The POC should use supported Prime Agent interfaces rather than disguise an RLM
child as a project conversation or build a new abstraction in advance. A launch
or message acknowledgement should not be confused with evidence that a
substantive task was admitted.

If several supported interaction paths exist, they may be tried. Choosing a
permanent product interface can wait until actual use makes the tradeoffs clear.

## Operator interaction

The operator may work directly with a project conversation and may also ask the
universal-agent emulator to route messages, request status, coordinate work, or
continue a thread. Both modes are intentional parts of the POC.

Neither mode is presumed to be the final answer. Trying both should reveal when
direct interaction feels natural, when a universal entry point helps, and what
continuity the operator expects when moving between them.

Relayed communication must preserve its target and authority. Launching,
observing, or messaging a project conversation does not silently authorize
implementation, scope expansion, merge, abandonment, or destructive cleanup.

## Observation and steering

The universal-agent emulator may inspect, message, and steer project
conversations when there is a useful operational or learning reason. This can
include routing intent, correcting role confusion, coordinating related work,
recovering blocked state, requesting evidence, or testing a UX hypothesis.

There is no blanket restriction against steering or deeper observation. The
emulator should act deliberately rather than micromanage by default, and should
capture useful lessons without turning transient activity into speculative
infrastructure.

## Learning boundary

The POC may teach us about conversation naming and recall, direct versus
mediated interaction, role prompting, monitoring and steering, restart
behavior, and the practical details of plugin and `.ralph/` provisioning.

Those are questions to explore within the provisioning model chosen above, not
reasons to design unrelated infrastructure in advance. Use lightweight working
state and existing interfaces until repeated experience shows that more
automation or durable infrastructure is needed.

This specification does not authorize a native project-conversation launcher,
a universal-agent orchestrator, a conversation registry, fixed monitoring
policy, a general capability-packaging system beyond the chosen prime-claw
plugin placement, or automated lifecycle authority.

## Living specification discipline

This specification is durable working memory for a POC that may span many long
conversations and context compactions. It must be updated as soon as durable
operator intent, corrections, runtime observations, or design learnings emerge.
Do not wait for an end-of-run retrospective: information that remains only in a
transcript or model context may be lost at the next compaction.

Keep the document current rather than append-only. Integrate new truth into the
relevant section, replace stale claims, and distinguish observed behavior from
ideas that still need testing. The same discipline applies to the related
conversation-driven episode-oversight specification. Neither document may rely
on this session remembering unrecorded design state later.

## Acceptance

The POC is accepted when the operator explicitly accepts it. There are no
substitute metrics, required numbers of repositories or conversations,
mandatory scenario lists, or agent-defined completion gates.
