# Section 25 public-interface audit — product constraint

## Verdict

**PRODUCT CONSTRAINT.** Prime Agent 0.9.8 at exact source commit
`a1faacd53ac4473a75de1d434afaf50945c2f647` does not expose a supported
receiver-side contract that binds trusted inbound sender/target metadata to the
actual child session/model before provider dispatch. Section 25 cannot be
implemented without trusting an internal message shape or changing upstream.
Both are forbidden by the approved plan.

## Supported facts that are available

- `packages/coding-agent/src/core/rlm-runtime.ts` publishes
  `RlmSpawnHandle { rlm_child_id, name, session_dir, model }`. The public Python
  runtime mirrors it as frozen `RLMSpawnHandle` and `rlm.spawn()` accepts exact
  `model` and `thinking` inputs.
- The host resolves the child model and returns its full selector. The public
  parent-side return can therefore verify the selected model, but not requested
  reasoning.
- `agent_message.send()` accepts only role/name routing and message text. The
  daemon resolves family reach and creates authoritative `from`,
  `fromRelationship`, and `target` endpoints. Its receipt returns those facts to
  the sender.
- A receiving extension has the supported `ExtensionContext.model` and
  read-only `sessionManager` getters for its own current model, session ID,
  session name, session directory, and session file.
- The supported `context` hook runs before provider dispatch and can replace
  messages; `ctx.abort()` can prevent dispatch. The neutral system prompt can be
  selected earlier through `before_agent_start`.

## Missing public trust link

The daemon persists its authoritative inbound endpoints in the built-in
`agent_message` custom message's `details`. However:

1. the specific `AgentSessionMessageDetails` contract is internal to
   `packages/coding-agent/src/core/agent-messages.ts` and is not exported from
   the public coding-agent package;
2. receiver-facing public message text contains only the sanitized
   `[agent-message from <relationship>:<name>]` header plus the body;
3. the initial spawn bootstrap contains parent metadata but no authoritative
   target/model binding;
4. `agent_observe` has no receiver model in its public family summary and its
   message previews omit private custom-message details; and
5. Python `rlm.host_request` can call only host handlers already registered by
   Prime Agent. Extensions have no public host-handler registration API, and an
   unknown request type fails.

Reading the internal `details` object structurally would work against this exact
implementation, but it is not a supported Prime Agent public interface. Packet
text supplied by the parent would be a caller claim rather than independent host
proof. Either approach violates the Section 25 acceptance boundary.

## Source evidence

- `packages/coding-agent/src/core/rlm-runtime.ts`: `RlmSpawnHandle` and exact
  model search/spawn host contracts.
- `packages/coding-agent/dist/prime-agent-runtime/src/rlm/__init__.py`:
  `RLMSpawnHandle`, `spawn`, `find_models`, and registered-only `host_request`.
- `packages/coding-agent/skills/agent-message/src/agent_message/__init__.py`:
  role/name-only lazy send API.
- `packages/coding-agent/src/core/agent-messages.ts`:
  internal endpoint/detail shapes and sanitized prompt construction.
- `packages/coding-agent/src/modes/daemon/daemon-mode.ts`:
  authoritative endpoint construction and one-send message acceptance.
- `packages/coding-agent/src/core/extensions/types.ts`: public
  `ExtensionContext`, `context`, and `before_agent_start` contracts.
- `packages/coding-agent/src/core/extensions/runner.ts`: context/provider hook
  execution.
- `packages/coding-agent/src/core/session-manager.ts`: public read-only current
  session getters.

An independent read-only source audit reached the same PRODUCT CONSTRAINT
verdict. The audit used no repository edits and proposed no upstream patch.

## Disposition and unblock condition

The accepted reservation foundation remains at
`5674219bc914682a7e28c96146a68ab1b3e80f5f` / tree
`930a7956545c6d3c9b8006e6cf59f5fa141f77d6`. Experimental implementation edits
were reverted. No feature reviewer was spawned, no packet was delivered, no
child admission occurred, and no review provider was called.

Resume only after a released, supported public Prime Agent interface exposes
unforgeable receiver sender/target identity plus sufficient current child/session
identity at or before the provider seam, or an equivalent supported admission
callback. Re-audit that release. Prime Agent remains an upstream dependency and
must not be patched or forked as the prime-claw solution.

## Product correction

The owner accepts this audit's narrow conclusion: inbound message metadata is
not a supported authority source. The terminal-block disposition is superseded,
not erased. A supported redesign avoids inbound messages entirely by binding an
owner-created private launch record to the actual public spawn return and the
child's public canonical session/model/parent lineage at its initial context
hook. Blocker commit `3586dcc0cb02f314e7c50f661d956f794637f17c` remains audit
history. Active authority is the restored spec and Execution Plan Section 26.
