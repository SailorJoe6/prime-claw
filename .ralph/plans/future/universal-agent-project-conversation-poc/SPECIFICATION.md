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
unless it is provisioned deliberately.

During this manual POC, the universal-agent emulator must check each
`PROJECT_CONTEXT` before launching a project conversation. If the prime-claw
plugin is absent, it installs the plugin project-locally in that repository and
verifies that the new session registers the expected commands. This local plugin
installation is POC-only scaffolding.

After the POC, the final design installs the prime-claw plugin by copying it from
the prime-claw builder project into Prime Agent's global plugin location inside
the sandbox home. Project conversations then discover the shared plugin without
copying it into every managed repository. Sandbox construction or convergence
must reproduce that global installation; it must not depend on host-global
state.

The workflow Markdown remains project-local in both stages. The
`UNIVERSAL_AGENT` must ensure every managed `PROJECT_CONTEXT` contains a local
`.ralph/` tree with the canonical `plans/` and `skills/` structure. If the tree,
a required subfolder, or any canonical Ralph skill is missing, the universal
agent installs the missing templates from prime-claw without overwriting
existing customized files, then prompts the operator to verify and customize
the templates for that project.

Provisioning is not complete merely because files were copied. Before launching
or routing work that depends on Ralph, the universal agent verifies the plugin
and the target project's required workflow skills are present and discoverable.
The POC should document the exact install and verification procedure and record
where project-specific customization is needed.

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
