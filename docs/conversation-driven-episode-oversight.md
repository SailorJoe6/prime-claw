# Conversation-driven episode oversight

Prime Claw provides an explicit `PROJECT_CONVERSATION` role for the long-lived,
operator-facing project thread. This page documents the delivered role boundary.
The temporary episode-oversight procedure and configured EXPERT review policy
are separate later slices; the role does not invent those mechanisms.

## Launch an assigned project conversation

Launch Prime Agent from the project root with the project extension enabled and
the explicit flag:

```bash
prime-agent --cwd /path/to/project --project-conversation
```

The flag is the assignment boundary only for a pristine top-level launch:
`rlmDepth` is zero and the session header has no `parentSession`. Merely running
in the project directory does not grant this role. Runtime children inherit
extension flags, so the extension explicitly ignores the flag for RLM children,
forks, implementation episodes, reviewers, and other derived identities.

On initial process startup the extension writes a versioned, session-local marker
containing only:

- `role: "PROJECT_CONVERSATION"`;
- the marker schema version; and
- the exact assigned Prime Agent session ID.

A resumed or reloaded session restores the role only when the marker's session
ID matches the current session ID. A fork can inherit the marker as session
history, but the different ID keeps the role inactive. A derived runtime cannot
mint a replacement marker from an inherited flag. Launching a separate pristine
top-level process with `--project-conversation` is a new explicit assignment.

## Startup orientation

The role profile requires the first substantive agent turn to inspect and follow
the existing project `prepare` skill before other project work. Preparation stays
inside that turn. The extension does not send a `session_start` message, create an
autonomous preparation turn, or duplicate project preparation policy.

This matters for RLM admission safety. A separate extension-generated startup
turn can race with a child's real task; the role therefore adds an invariant to
the effective system prompt instead of injecting model input.

## Effective system prompt

The extension source is inert at
`src/prime-agent-plugin/extensions/project-conversation.ts`. The normal
`scripts/apply-prime-agent-plugin.sh` workflow installs it once at user scope;
do not add a duplicate project-local extension entry point.

At the supported `input` admission gate for each assigned agent run, the
installed extension reads:

```text
.prime/agent/profiles/project-conversation.md
```

It appends the current file contents to the already chained system prompt. This
preserves overlays from other extensions and lets a supported extension reload
pick up profile changes without persisting stale prompt text.

If an assigned session cannot read a non-empty profile, the input hook reports
the profile path and returns `action: "handled"`. Prime Agent then skips skill and
prompt-template expansion, `before_agent_start`, and the complete provider/model
run. This fail-closed path applies to `interactive`, `rpc`, and extension-sourced
input. A validated profile is cached only for the corresponding run and appended
once to the previously chained system prompt. Prime Claw does not silently
continue without the role invariants.

## Compatibility and authority

The profile preserves ordinary project conversation and existing phase entry
paths. The extension:

- registers no slash command or model-callable tool;
- does not change the active tool set;
- does not intercept `/spec-it-out`, `/plan`, or `/implement-spec`;
- does not infer role assignment from CWD;
- does not bind the role to one episode or consume it after terminal work; and
- grants no merge, abandonment, cleanup, scope-expansion, or product-decision
  authority.

The role marker identifies the durable conversation only. After episode creation,
the assigned conversation sends a one-time owner coordination message and asks
for direct progress, blocker, and completion reports. While that sibling
work-generation is active, exactly one non-steering 15-minute heartbeat acts as
the missed-report safety net. Reports are evidence rather than approval. Material
context pressure requires a recorded P0, evidence-preserving stop, and context
refresh before more work; it does not expand scope or duplicate the watch.
Episode identity, review findings, and terminal state still belong to the
separate episode workflow and its existing trusted host capabilities.

## Resource boundaries

The files have distinct jobs:

- `.prime/agent/profiles/project-conversation.md` contains short invariants that
  apply to every assigned conversation turn.
- `src/prime-agent-plugin/extensions/project-conversation.ts` is the inert
  builder source and owns explicit flag admission,
  exact-session restoration, profile loading, and system-prompt chaining.
- Project phase skills continue to own specification, planning, implementation,
  handoff, and—when delivered—temporary episode-oversight procedure.
- Existing trusted extensions continue to own validated path, identity,
  quiescence, and at-most-once transport mechanics.

Do not move the role profile into `.prime/agent/prompts/`. Prompt templates are
ordinary user input and cannot establish a durable system-prompt role.
