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
selecting the current package or declaring ordinary mode, so an orphan active marker cannot hide behind another
active episode. Historical inactive markers are inert when no matching identity
exists. An inactive marker with its exact identity still present is a visible,
retryable bookkeeping-close boundary. Corrupt or disagreeing current-owner state
blocks; a copied marker in a different fork UUID remains inert.

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
- return to ordinary CONVERSATION mode after exact bookkeeping close.

Reports are evidence, never approval or native-command dispatch. The heartbeat
is the missed-report safety net and is cancelled when its generation is
reconciled or waiting only for owner/operator action.

### Completed dogfood evidence

The sanitized [conversation-driven oversight dogfood record](../reports/reviews/conversation-driven-episode-oversight-dogfood.md)
tracks the isolated live run through setup, two accepted generations, final EXPERT
review, the operator's conversational merge decision, completed terminal work,
and recovery from the old finalizer. It preserves both old-design authorization attempts,
including the later successful `merged` authorization, followed by the
single unretried failure `Finalization is blocked with durable recovery evidence
preserved: Daemon session row has an invalid session UUID` and the old
still-`authorized` receipt.

After the simplified generation was accepted, global apply/check and two isolated
fresh-process native probes passed. The loaded outer owner was not hot-reloaded and
truthfully retained its old package. A temporary accepted-skill overlay was limited
to the disposable project and restored byte-for-byte after one location-only,
no-UI bookkeeping close. A wrong-CWD resume was detected and stopped before
mutation; the successful foreground resume used the explicit fixture CWD and exact
test CONVERSATION session.

The final retained evidence has no episode identity, two matching markers with the
latest inactive, an ordinary inactive/resumable test CONVERSATION, an inert old
receipt and zero-byte lock, clean matching local/remote `main` at
`b8ddda43da88c897c2a844cca99d31a95f38c7fb`, no episode refs, only the main
worktree, an inactive EPISODE, and no remaining watches. The fixture is frozen at
that completed evidence state.

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
way. The EPISODE sibling's explicit completion report is the normal coordination
signal. If a heartbeat instead observes apparent quiescence without a report,
the owner asks exactly: `You seem done with your work. Are you complete or waiting for some process?`
and trusts that status answer before review or handoff.

After trusted completion, exact owner review and acceptance, and a reasonably
quiescent observation, the owner cancels the completed-generation watch and
pre-arms exactly one watch for the intended continuation immediately before the
terminal call. Host code preserves a valid resident route even when
`isSessionActive` is false, republishes only when no route exists, then obtains a
fresh exact state snapshot and rejects an observed busy state. Bootstrap remains
distinct: it has no pre-existing state snapshot to read before publication.

Canonical handoff is sent as an ordinary `prompt` with `queueIfBusy: false` and
no `streamingBehavior`, followed by exactly one execute `followUp`. This is not an
atomic all-busy guard. A streaming race definitely rejects the prompt; residual
non-streaming work can make it wait until idle, which is acceptable after trusted
completion and owner acceptance. A definite first-send rejection admits no
execute and leaves the intended-generation watch available for a later fresh
observed-idle retry; the watch never retries automatically. Before that bounded
owner retry, a fresh exact state snapshot must show the exact owned episode idle
again. Success proves only immediate-or-queued admission, never workflow
completion. Partial or uncertain admission is an inspection boundary and is
never blindly replayed. No Prime Agent core change, compare-and-swap primitive,
or lease is claimed or required.

After the operator's conversational terminal decision, verified terminal work,
and exact bookkeeping close, episode-specific watches end and the same session
returns to ordinary CONVERSATION incubation. A later reviewed
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

When an EPISODE claims completion, the owner first reconciles the exact
promoted plan-artifact bundle with the project-customizable terminal policy.
This is a final-readiness gate, not an ordinary in-progress `advance` gate.
For the default `/execute` policy, the episode must archive its required active
specification and plan, update the archive index, and preserve resolvable links.
The owner identifies required paths from that project's execute skill and
approved bundle; the example filenames in `/execute` are not a universal
schema. It traces the promoted paths to their archived counterparts with the
candidate's Git diff/history, then checks the files, archive index entry, and
relative links at the exact pushed candidate. An unrelated archive directory
is not proof. The optional `scripts/verify-completed-plan.py` checks explicitly
supplied active/archive path pairs, index presence/entry, and local Markdown
links; it neither discovers required files nor establishes provenance or
approves merge. A documented project policy may instead define another
terminal state with equally reviewable artifact/link evidence. Missing or
uncertain evidence blocks a completion/merge-readiness claim and calls for
in-scope repair or pause before final review.

After this reconciliation, the owner obtains a fresh final EXPERT review of
the complete exact candidate, adjudicates every finding, and requires
`PASS` for that exact commit. An intermediate PASS cannot satisfy this gate; nor
can another commit's report, an incomplete review, or an unresolved `BLOCK`.
Any material repair invalidates the prior review and requires a renewed review
of the repaired exact commit. Pause or abandonment remains available without
claiming merge readiness. EXPERT PASS is evidence, not merge authority;
favorable EXPERT review never authorizes merge. Only the operator authorizes
merge or another terminal disposition.

## Exact bookkeeping close

After a fresh final EXPERT `PASS`, the owning CONVERSATION presents readiness in
ordinary conversation. The operator's merge, revise, pause, or abandon response
is the sole terminal decision. Revision and pause retain the episode. For merge
or abandonment, the owner inspects live state, performs the applicable Git,
session, worktree, branch-retention, and cleanup actions with ordinary tools, and
verifies their outcome. Ambiguity blocks destructive cleanup.

Only after terminal work is verified does the owner call
`finalize_spec_episode(location)`. Despite its compatibility name, this is a
location-only, no-UI bookkeeping close. It validates the exact owner, retained
future-folder location, episode identity, and oversight marker; appends inactive
evidence once; and removes only the matching identity file. It performs no Git,
merge, abandonment, session, worktree, branch, daemon-inventory, or cleanup work.

The close has no authorize phase, disposition parameter, confirmation dialog,
authorization receipt, terminal-fact validator, lock, two-phase state machine, or
startup completion coordinator. If inactive evidence was appended but identity
removal failed, exact replay validates the same bindings, removes the identity,
and does not duplicate the marker. If identity removal completed and the result
was lost, inactive evidence plus an absent identity returns idempotent success.
A closed future-folder location is one-generation-only. Promotion rejects its
reuse, and duplicate generations at one location block close lookup, so a delayed
old call cannot clear newer work. Legacy `.finalization.json` files are inert
preserved artifacts; the classifier neither uses nor deletes them.

## Native validation isolation

Checked-in native publication and oversight tests never use the operator's
daemon route. Each runtime installs a Unix-socket fake transport at
module load, verifies the exact socket and guarded `net.Socket.connect` binding
before lifecycle events can mutate state, and rejects every other destination.
The subprocess harness removes inherited daemon-worker, recursive-agent, session
lease, and kernel-owner routing state before adding only the named fake route.
Publication evidence asserts the protocol-7 command envelope, unique ordered
command IDs, exact fake route, mutation acknowledgments, and the `steer` then
`followUp` delivery flags. Cleanup for the exact worktree, branch, socket/daemon,
session files, and lifecycle fixture state is registered before publication. A deliberate post-creation assertion failure proves that cleanup still
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
