# Conversation-driven episode oversight

Prime Claw gives every independent top-level project session a small default
CONVERSATION capability. No launch flag or unique project-owner session is
required. Ordinary discussion, design, specification, and planning remain native
Prime Agent behavior.

## Managed identity kernel

The inert builder resource `src/prime-agent-plugin/APPEND_SYSTEM.md` contains a
short managed block identified by `PRIME_CLAW_CONVERSATION_IDENTITY_V1`.
`scripts/apply-prime-agent-plugin.sh` merges that block into the user-global
`~/.prime/agent/APPEND_SYSTEM.md` while preserving unrelated user append content.
The check script verifies exactly one current managed block.

Prime Agent chooses a project `.prime/agent/APPEND_SYSTEM.md` before the global
file, and `--append-system-prompt` overrides file discovery. Those supported
configurations can shadow the kernel. A truly inactive ordinary conversation
remains available under such a shadow. `/implement-spec` readiness and every
bounded, active, or recovery state require exactly one intact canonical managed
block and fail visibly before provider dispatch when it is absent or truncated.

The kernel defines precedence rather than detailed procedure:

- an independent depth-zero project session has default CONVERSATION capability;
- an explicit EPISODE, EXPERT, or delegated/depth-positive child remains bounded;
- copied history never copies exact episode ownership; and
- oversight mode exists only while exact-session state agrees with a durable
  spec-episode ownership expectation.

Native automatic compaction remains unchanged; native compaction stays the default. Its internal summarizer uses its
own runtime prompt. The first real conversation call after compaction receives
the normal identity kernel and, when active, the current oversight package.
Reload and resume rebuild the kernel from current resources.

## Oversight activation and package

Native `/implement-spec` remains the only promotion authority boundary. Before
queuing its canonical readiness workflow, the extension verifies:

- exactly one effective identity kernel;
- the restoration extension is active for this session;
- `.ralph/skills/oversee-episode/SKILL.md` is readable and valid; and
- the durable spec-episode state directory is writable.

After `create_spec_episode` has durably established and delivered a strictly
parsed spec-episode identity, the same tool turn appends and verifies one full
active marker bound to every owner, location, episode, session, branch, worktree,
and bootstrap field. Activation sends no separate model message. On restart, a
valid bootstrap-ready exact-owner expectation with no marker is recovered to an
active marker with a visible durable recovery message. Inactive, corrupt, or
disagreeing current-owner state blocks; a copied marker in a different fork UUID
remains inert.

On every real provider context, the restoration extension:

1. validates the identity kernel;
2. finds the latest marker for the exact current session branch;
3. requires an exact match with `.prime/agent/state/spec-episodes/<slug>.json`;
4. removes older `prime-claw-oversee-episode-package` representations;
5. rereads the canonical `oversee-episode` skill; and
6. supplies exactly one fresh package.

This universal context path covers normal input, extension triggers, queues,
native follow-ups, heartbeats, agent messages, tool continuation, reload,
resume, and the first real post-compaction call. Missing or duplicate kernels,
corrupt markers, ownership disagreement, or missing/malformed packages call
`ctx.abort()` before provider dispatch and surface an exact error.

An ordinary fork still sees the identity kernel, but a copied owner marker is
inert because its session UUID differs. The implement-spec fork receives an
explicit EPISODE identity entry. EXPERT and delegated RLM children follow their
bounded task and runtime depth rather than assuming owner authority.

## Canonical oversight procedure

`.ralph/skills/oversee-episode/SKILL.md` is both the project-customizable skill
and the sole active package source. It requires:

- one direct owner-coordination message;
- exactly one non-steering 15-minute heartbeat per active bootstrap,
  continuation, repair, review-rework, or evidence generation;
- exact session/Git/commit/test/doc/plan/Bead/worktree reconciliation;
- independent exact-commit review and owner-ledger evidence;
- `advance`, `revise`, `consult`, or `pause` within approved scope;
- explicit operator authority for merge, abandonment, unresolved product scope,
  and destructive cleanup; and
- return to ordinary CONVERSATION mode after terminal finalization.

Reports are evidence, never approval or native-command dispatch. The heartbeat
is the missed-report safety net and is cancelled when its generation is
reconciled or waiting only for owner/operator action.

## Narrow terminal finalization receipt

`finalize_spec_episode` has two phases and never performs terminal work itself.

### Authorize

The owning conversation supplies the exact future-folder location and the closed
disposition `merged` or `abandoned`. The host verifies the exact owner and durable
episode identity, asks for one explicit UI confirmation, captures the episode
branch tip, and writes
`.prime/agent/state/spec-episodes/<slug>.finalization.json`.
A matching replay returns the existing receipt without another confirmation.
Authorize does not merge, abandon, stop a session, remove a worktree, delete a
branch, or decide semantic completion.

### Complete

After the canonical skill performs ordinary conservative terminal work (while
retaining the authorized episode ref until validation), complete requires the
matching receipt and validates that:

- the exact episode session is no longer active/addressable;
- the exact owned worktree is absent from disk and Git worktree state; and
- the authorized episode branch still resolves to the exact accepted commit;
- the exact target branch/ref still descends from its authorization-time commit;
- all referenced Git objects resolve as commits and ancestry is known; and
- the episode commit is an ancestor of the bound target for `merged`, or is not
  an ancestor for `abandoned`.

Only then does it advance the durable receipt monotonically from `authorized`
to `completing`, append inactive owner oversight, clear the matching expectation,
and write a durable `completed` tombstone with exact result evidence. It asks for
no second confirmation. An identical authorize or complete replay returns the
existing state/result without another confirmation. A crash or ambiguity at any
boundary remains visibly recoverable from the receipt, marker, and any surviving
expectation; it never silently becomes ordinary mode. Unrelated resources are
never removed.

## Installation boundaries

Builder sources remain inert under `src/prime-agent-plugin/`. The apply/check
workflow manages seven TypeScript files plus one APPEND_SYSTEM block. Oversight
registration is co-located with the normally discovered `reviewed-plan.ts` entry
point; there is no redundant production `project-conversation.ts` entry. The
`oversee-episode` skill remains project-local and is validated before apply; it
is not copied into the global agent directory. `.agents/skills/oversee-episode`
exposes that same canonical file through normal project skill discovery.

The extension registers no CONVERSATION launch flag and emits no startup turn.
It does not replace `/prepare`, `/design`, `/spec-it-out`, `/plan`,
`/implement-spec`, handoff transport, or ordinary tools. It grants no merge,
abandonment, cleanup, scope-expansion, or product-decision authority.
