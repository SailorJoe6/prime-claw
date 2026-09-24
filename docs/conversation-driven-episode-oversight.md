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
remains available under such a shadow. `/implement-spec` readiness, explicit
EPISODE state, active ownership, and recovery require exactly one intact canonical
managed block. A native depth-positive delegated/RLM child may instead rely on
Prime Agent's trusted bounded task prompt under an intentional shadow; it receives
zero CONVERSATION ownership and zero oversight packages. No prose heuristic is
used.

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
- `.ralph/skills/oversee-episode/SKILL.md` follows the deliberately bounded,
  closed frontmatter grammar: the raw file is validated before whole-file
  whitespace normalization, with exact unindented first/closing `---` lines and
  exactly one `name` line plus one `description` line between them, with no blank,
  comment, unknown, duplicate, nested, or sequence metadata lines. Each key has exactly
  one ASCII space after its colon; `name` must equal `oversee-episode`;
  `description` and the procedure body must be nonempty. Double-quoted values
  use a nonempty JSON-string subset;
  single-quoted values have no escapes; and unquoted values reject YAML reserved
  leading indicators, flow delimiters, quotes, mapping/comment forms, tabs, and
  C0/C1 control characters. Decoded quoted controls are rejected too.
  Indentation/nested maps, sequences, block scalars, malformed quotes/brackets,
  and duplicate keys are unsupported and rejected. This is not a general YAML
  parser; and
- the durable spec-episode state directory is writable; and
- CWD, state, and expected worktree bindings resolve from one canonical project
  root, accepting benign filesystem aliases/symlink roots while rejecting
  noncontained or unavailable roots before publication.

After `create_spec_episode` has durably established and delivered a strictly
parsed spec-episode identity, the same tool turn appends and verifies one full
active marker bound to every owner, location, episode, session, branch, worktree,
and stable bootstrap field. The daemon `episodeActiveSessionId` is mutable routing,
not stable ownership; exact session UUID/file ownership remains stable while a
verified reopen may refresh the durable route without invalidating oversight.
Activation sends no separate model message. On restart, a
valid bootstrap-ready exact-owner expectation with no marker is recovered to an
active marker with a visible durable recovery message. The known rejected v1
marker schema is recognized only after exact owner filtering and migrated by
appending a full v2 evidence marker; foreign copied v1 history is inert, and the
newer v2 marker supersedes its generation history. Only a positively identified,
nonempty foreign owner is ignored; missing, null, numeric, or empty owner fields
are unclassifiable corruption. Every exact-owner generation is reconciled before
selecting the current package or declaring ordinary mode, so orphan active markers
and old authorized/completing receipts cannot hide behind another active episode.
Inactive, corrupt, or disagreeing current-owner state blocks; a copied marker in
a different fork UUID remains inert.

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

### Owner-driven continuation

At a stable review boundary, the exact owner chooses `advance`, `revise`,
`consult`, or `pause`. `advance` requires owner acceptance of the exact candidate
and a next slice already inside the recorded specification and plan. `revise`
requires accepted findings recorded durably in the specification, plan, Bead,
code/tests, or linked immutable report and classified inside that approved scope.
Those two dispositions may call `handoff_spec_episode` without a new operator
transport request. They do not grant new scope or product authority.

The call retains the exact future-folder location. Optional guidance is either
operator focus or a bounded compaction-focus synthesis of those accepted recorded
findings. Arbitrary chat, unaccepted review findings, product decisions, scope
expansion, and `consult`, `pause`, or terminal dispositions cannot be routed this
way. Host ownership, identity, location, quiescence, canonical-prompt,
uncertainty, and replay checks remain unchanged. Admission proves neither
compaction nor work completion, an uncertain result is never retried, and the
owner starts one new 15-minute watch before yielding to each admitted generation.

After operator-authorized terminal finalization, episode-specific watches end and
the same session returns to ordinary CONVERSATION incubation. A later reviewed
folder requires a fresh native `/implement-spec` run. The first episode never
lifetime-locks that owner.

### Explicit EXPERT reviewer policy

The first project policy lives at
`.prime/agent/profiles/expert-reviewer.md`. Its closed frontmatter names
`expert-reviewer` and selects `openai-codex/gpt-6-astra` with reasoning level
`max`; the Markdown body defines the independent, read-only exact-commit role,
prohibits editing or steering the subject, requires returning findings to the
owner, and defines the actionable `BLOCK` contract. This is project/operator
configuration, not a portable claim that one model is always best.

For required review, the owner validates the raw closed profile before mapping
it, resolves one exact selector match, and uses the repository safe-spawn
sequence: admit a fresh RLM with only a harmless bootstrap and the explicit
selector/reasoning arguments, verify that the returned handle names the requested
model, then send the profile body plus real read-only packet together exactly
once. Successful spawn admission proves acceptance of the explicit reasoning
request; the handle is not claimed to echo it. Evidence records the reviewer
identity, exact reviewed commit, returned model, admitted reasoning, report
artifact, and disposition. The owner preserves and adjudicates a complete report
before stopping and deleting that exact reviewer.

One bounded recovery applies when an exact reviewer is confirmed terminal after
a purely technical failure and produced no usable `PASS` or `BLOCK`. The owner
preserves the incomplete attempt and records its exact packet identity in the
owner ledger so context refresh cannot replenish the one-replacement allowance,
retires that exact reviewer, and may admit exactly one fresh replacement under
PROJECT_CONVERSATION authority with the same validated profile and exact review
packet, model, and reasoning. No new operator transport decision is required.
The exception is unavailable for a still-active reviewer, ambiguous delivery or
state, unavailable policy or access, or a substantive `BLOCK`. The failed task is
never resent, a `BLOCK` is never retried to seek a different disposition, and
replacement failure or uncertainty pauses for the operator with no further
replacement.

All other invalid configuration, unavailable or ambiguous resolution, rejected
reasoning, failed or mismatched spawn, uncertain delivery, or incomplete-report
cases pause for the operator. Uncertain delivery is never resent and a reviewer
with outstanding delivery/report work is never deleted. The owner never falls
back to its current/default model or a weaker policy.

Before the owner presents merge readiness, it obtains a fresh final EXPERT
review of the complete exact candidate, adjudicates every finding, and requires
`PASS` for that exact commit. An intermediate PASS cannot satisfy this gate; nor
can another commit's report, an incomplete review, or an unresolved `BLOCK`.
Any material repair invalidates the prior review and requires a renewed review
of the repaired exact commit. Pause or abandonment remains available without
claiming merge readiness. EXPERT PASS is evidence, not merge authority;
favorable EXPERT review never authorizes merge. Only the operator authorizes
merge or another terminal disposition.

## Narrow terminal finalization receipt

`finalize_spec_episode` has two phases and never performs terminal work itself.

### Authorize

The owning conversation supplies the exact future-folder location and the closed
disposition `merged` or `abandoned`. The target is the owner's currently checked
out project branch, as selected by project policy; it is not implicitly `main`.
The host verifies the exact owner and durable episode identity, asks for one
explicit UI confirmation that shows the target branch/ref, authorization-time
target commit, and exact episode tip, and writes
`.prime/agent/state/spec-episodes/<slug>.finalization.json`.
A matching replay returns the existing receipt without another confirmation.
The exact receipt lifecycle transaction is serialized by a crash-released native
lock. Lock startup validates the immediate parent and lock-object type, then uses
a Python/`fcntl.flock` helper handshake that distinguishes `ready`, actual
contention, and fatal path/runtime errors. Only contention is retried. Waiting is
bounded to 10 seconds by default, structured tool cancellation is propagated, and
startup recovery uses the same bound. Timeout, cancellation, helper failure, or
unexpected holder loss stops before later lifecycle mutation and preserves the
receipt, marker, and expectation evidence. Contenders never unlink the lock file
or signal a live holder. This first release requires a local Unix Python runtime
with `fcntl`; hostile ancestor-path replacement and Windows portability are not
claimed.

Authorization releases the lock while the UI waits, then reacquires and
revalidates every binding/state before writing; a delayed compatible call returns
the newer state/result and a conflict blocks, so completed evidence cannot rewind.
Receipts and markers are indexed by exact slug/episode generation: completed old
evidence remains replayable but never acts as the current ownership record, so a
proven terminal cycle does not prevent a later approved folder. Replay output is
scoped to that exact old episode; if another generation is active, the tool text
and structured details explicitly say that current oversight remains active.
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
expectation; it never silently becomes ordinary mode. On reload/resume, a strict
`completing` receipt is reconciled by the narrow native session-start path before
an ordinary provider call, without invoking the model tool or replaying bootstrap
admission. Recovery validates the effective managed kernel and canonical package
before any marker/receipt/expectation mutation; a project or CLI shadow blocks
with state unchanged and zero provider calls. Before selecting missing-marker
recovery, the read-only classifier also validates the expectation and receipt's
stable owner, generation, source, session file, branch, worktree, session name,
identity version, and admission bindings. The mutable active route is excluded.
Session-file and worktree comparison uses the same lexical `path.resolve()`
equivalence for expectation/receipt preflight, existing markers, and the exact
prospective recovery marker. It does not require either terminal path to exist.
The prospective marker is validated before it can be appended or announced, so
canonically equivalent spellings converge and cannot create evidence that a later
reader rejects. A genuine conflict appends no marker or success message and does
not invoke recovery or the provider, so correcting only the original receipt
remains sufficient.

The exact writer-produced `completing` + matching inactive marker + retained
expectation checkpoint is recoverable through the same transaction lock and
terminal-fact coordinator. Because the marker is already inactive, recovery does
not append it again. An inactive marker plus expectation without that exact
`completing` receipt remains invalid. Unrelated resources and generations are
never removed or changed.

## Native validation isolation

Checked-in native publication and session-start recovery tests never use the
operator's daemon route. Each runtime installs a Unix-socket fake transport at
module load, verifies the exact socket and guarded `net.Socket.connect` binding
before lifecycle events can mutate state, and rejects every other destination.
The subprocess harness removes inherited daemon-worker, recursive-agent, session
lease, and kernel-owner routing state before adding only the named fake route.
Publication evidence asserts the protocol-7 command envelope, unique ordered
command IDs, exact fake route, mutation acknowledgments, and the `steer` then
`followUp` delivery flags. Cleanup for the exact worktree, branch, socket/daemon,
session files, and lifecycle fixture state is registered before publication or
recovery. A deliberate post-creation assertion failure proves that cleanup still
removes every registered resource.

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
