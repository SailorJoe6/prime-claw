# Native session observation and continuation proof (PRIMECLAW-62)

This records the original public-interface feasibility proof (slice 1), its
production-helper extension (slice 2), and the SDK-adapted native Episode
continuation proof (slice 4). The original feasibility run did not adopt an
architecture. Later sections identify their added evidence and limits.
The native task remains authority; a captured observation is only factual context.

## Reproduce

```bash
uv run --with pytest python -m pytest tests/test_reviewed_plan_source_loader.py -q -m container
```

The existing source-loader fixture builds and verifies the supported annotated
`cwd-fix-v0.9.8-r1` source release. See
[the source identity](../prime-agent-installation.md#authoritative-source-identity).
It prewarms the release's own native Python kernel during the image build.
Runtime uses `--network none`, a read-only image/source snapshot, scratch HOME,
settings and session roots through `run-prime-agent-probe.sh`, and an image-owned
kernel outside the scratch roots. No host Prime state or credentials are mounted.
Only synthetic observations are used.

## What the fixture checks

`tests/container/native_observation_entry.mts` uses the public native SDK and a
fixture extension. The extension writes only with `pi.appendEntry` and targets
the result immediately through `ctx.sessionManager.getLeafEntry`, then
`getEntry(id)`, `getSessionId` and `getSessionFile`. `appendEntry` returns `void`;
it does not return a persistence receipt or request another model turn.

The controlled initial session demonstrates that a pre-assistant custom entry
can be readable in memory but absent from disk. After a genuine scripted
assistant response, the main observation is appended to that same durable
session. The fixture verifies its exact session header, custom-entry ID, parent,
type and complete data in the existing JSONL **before** starting the reader.
A later same-type entry does not change exact-ID selection.

A second native session lives in an actual linked Git worktree. Its scripted
provider calls the real `ipython` tool. Python verifies its working directory,
reads only the supplied absolute journal path, verifies the session header,
selects the exact entry, and holds the full parsed object in its REPL. It checks:

- More than 1.7 million characters of synthetic previous/current Backlog
  evidence, with full native view fields, nested unknown keys, explicit nulls,
  absent keys and early/middle/late Unicode sentinels in huge comments.
- A small raw Beads array that retains native keys and shape.
- Complete-object digest equality and complete structural traversal, including
  exact reconstruction of individual strings in pieces of at most 4096
  characters. The tool prints bounded check results, not the payload.
- Missing exact entry and missing journal failures, without an inline fallback.

The writer is disposed and reopened using its exact native session file. One
real native **SDK** compaction of the writer completes. The reader then reads
the original exact entry again. Provider contexts, including the writer's
compaction summarizer request, must not contain the payload sentinels. Ordinary
custom entries are not automatically model messages.

## Placement and persistence limits

A successful append, in-memory `getEntry`, a nonempty session path or an existing
file alone does **not** establish that a custom row reached disk. The public
extension interface has no flush method. A future implementation must inspect
actual exact-entry persistence before dispatch and stop truthfully when it
cannot establish it; this proof does not authorize forcing a flush through
private APIs or starting an extra model turn.

The supported case is two same-user sessions with access to the same absolute
native session file. A worktree CWD is not a filesystem security boundary.
Cross-host, remote, container-isolated, unreadable or otherwise inaccessible
journals are **not** proven. Do not infer access from a host label, copy the
journal to a parallel store, or replace unavailable evidence with a huge prompt.
The proof checks a missing path/entry; it does not simulate every access failure.
Native writes here are ordinary supported journal writes, not an fsync or
cross-process transaction guarantee.

## Original feasibility proof limits (slices 1–2)

- No production handoff/execute prompt or owner-output boundedness fix.
- No first-admission/callback/follow-up delivery repair or transport diagnostics.
- No canonical handoff or execute dispatch, no `compact.run`, and no proof that
  the Episode's REPL survives its **own** compaction. Those are later slices.
- No real-model semantic inspection: the provider and assertions are scripted.
  Bounded traversal proves access mechanics, not semantic completeness.
- No historical delivery recovery, exact-once guarantee, activation, merge,
  host apply/check/probe, daemon restart or live UAT.

A passing run is evidence for considering a same-filesystem native reference
mechanism. It is not permission to omit native evidence or treat the observation
as an approval gate or new task authority.

## Recorded slice-1 run

The two source-loader/native-entry tests passed on 2026-11-19: **2 passed in
157.34s**. The verified runtime image was
`sha256:a62a3171bb31bc9d70770f3bd4332c0de72a152a4bda343c6b906a5060f6d5d2`.
The native result reported 1,803,056 payload characters, one exact selected
custom entry, two successful reader `ipython` calls, one completed writer SDK
compaction, no payload sentinel in captured model contexts, and exact entry
readback after reopen. Pre-assistant deferral and `void` append return were
observed, not inferred from an API signature.

Local pytest evidence lives under the run-owned
`primeclaw62-proof-9cyw9_8f/pytest/test_native_observation_entry_0/` temporary
folder (`identity.json`, `loader.stdout`, `native-entry-result.json` and Docker
status files). These temporary paths are not durable runtime stores. This
tracked account and the committed fixture supply the reproducible shared record.

A disposable negative-control snapshot changed the selected reference ID to
`missing-negative-control`, without changing the working candidate. The same
verified image rejected it at the exact-entry disk assertion (zero matches
instead of one): **1 failed in 13.21s**, as intended. The snapshot lacked the
repo's marker registration and emitted two nonfunctional pytest marker warnings.
No production or live journal was used.

## Slice-2 production-helper extension

The same offline native fixture now also calls the candidate
`retainTaskHandoffObservation` through a real extension command, using public
`pi.appendEntry` and the invoking native read-only session manager. It seeds an
actual selected reader journal, then checks the production helper's exact
persisted row and bindings before any reference is sent to the reader. The
reader's two real `ipython` calls also load that exact production reference,
verify SHA-256 over its original UTF-8 row (not reserialized JSON), compare the
full provider object, and reconstruct a separate 900,000-character queued-prompt
body in bounded pieces. The production row is read again after writer reopen
and the same one writer SDK compaction.

Recorded on the same pinned image above: **2 passed in 20.19s**. The result adds
`productionHelperExactRead: true` and `queuedPromptCharacters: 900000`. Temporary
evidence is under `primeclaw62-slice2-quhqxrfx/native/`. This extends the public
helper/readability evidence; it is not the full production handoff chain, a
reader-side `compact.run` test, live activation or real-model semantic proof.
The separate deterministic handoff suite checks prompt/owner-result size and
pre-dispatch failure behavior. Its results are recorded in the native task.

## Slice-4 native Episode compaction and canonical follow-up

The same fixture adds one SDK-adapted native execution path. It invokes the
actual candidate's registered `handoff_task_episode` tool from the scripted
owner model. Candidate `handoffTaskEpisode` loads the actual editable handoff
and execute files, captures the complete native observation with the production
helper, and calls the unchanged `PrimeSessionPublisher`. Its ordered first
admission, factual callback and sole execute follow-up remain under test.

Only the publisher's request boundary is adapted. Synthetic list/state and
provider/history facts identify the fixture's two actual native sessions and
linked Git worktrees. The adapter forwards the two candidate-generated prompt
requests to public `AgentSession.promptUntilAccepted`, using the same
`PromptOptions` mapping as the pinned daemon. A scripted provider barrier keeps
the handoff turn active until public native queue inspection sees exactly the
one generated execute follow-up. It then releases the provider. No separate
execute assignment, manual queue drain, hook dispatch, `continue()` or driver
Episode `compact()` is used. This tests native execution mechanics, **not** a
real daemon/socket or real provider-publication boundary.

The real bundled `compact` Python skill is explicitly loaded and installed into
the image-owned kernel at image build time. Runtime stays network-disconnected
and read-only; it must not bootstrap dependencies into the read-only image.
The Episode's handoff model emits one real `ipython` cell that:

1. Loads the exact candidate-generated observation reference, checks its row
   digest/bindings, and traverses the full native provider data in bounded pieces.
2. Prints the small synthetic current description, plan and acceptance contract
   plus bounded structure/size facts, not its incident-scale comments.
3. Builds a small useful work object from the native contract, retaining its
   Python object identity, kernel PID and CWD.
4. Calls real `await compact.run(focus)` exactly once and records `scheduled:true`
   as a **request**, not completion.

Independent native evidence must then show one successful `compaction_end` with
`reason:"requested"`, a real result and no abort/error, plus one durable Episode
compaction entry. The actual single queued canonical execute input must start
after that completion. Its real `ipython` tool checks the same kernel, CWD and
object identity; reloads the exact full candidate observation, original large
Backlog/raw Beads observation and large queued-body observation; and performs
the synthetic contract's sum work. The concrete post-compaction result is
`50` for inputs `[17,25,8]`, not another acknowledgement or compliance loop.

The driver settles through public `waitForHeadlessIdle`, then requires the native
queue to be empty, two and only two candidate prompt requests, one handoff input,
one execute input, one compact request/completion and one substantive marker.
Original owner/task/operation/Episode/session-file/route/worktree/branch/base/
integration bindings remain unchanged. Normal owner output and native tool
results stay bounded, and no large raw payload leaks into captured provider
contexts, including compaction summarization. The separate original writer SDK
compaction remains its earlier proof; it is not counted as Episode compaction.

### Scope of this proof

The provider and semantic actions are scripted. Complete-object checks and the
substantive marker prove access, continuity and queue mechanics, not that a real
model understood or followed the full contract. The task-history preparation
and native task view are synthetic dependency inputs, not real remote task
publication. The request adapter does not test JSONL transport or a live daemon;
the separate real-client/fake-socket regressions cover that bounded transport
contract. None of this is live activation, UAT, historical delivery recovery,
global exactly-once execution, remote placement or fsync/transaction proof.
No upstream or production plugin behavior is changed by this fixture slice.

### Recorded slice-4 run

Final existing source-loader/native-entry Docker suite: **2 passed in 12.17s**
(12.66s outer client), using verified image
`sha256:f46245c9b1cc69e4de32843f625d325ad31bb32cd23434131d963c41b7ee59de`
and unchanged supported source `a1faacd53ac4473a75de1d434afaf50945c2f647`.
The native fixture, build Dockerfile and complete inert candidate-plugin input
bytes match the saved final snapshot. Both exact run-owned Docker containers
were removed; no host candidate execution or activation occurred.

`native-chain-result.json` reports one actual registered task-handoff tool call,
two canonical prompt requests, ordered admitted/callback/admitted phases, one
real Episode compact request, one requested completion with a result/no error
or abort, one persisted Episode compaction entry, and one substantive result
with total `50`. Native execute starts after compaction completion; the queue
ends empty. Both new native tools report `kernelRestarted:false` and successful
bounded outputs. Full 1,803,056-character original Backlog/raw Beads evidence,
the actual new candidate observation and the separate 900,000-character queued
body remain exactly readable after Episode compaction; no payload leak was
observed in captured provider contexts. The original writer-SDK evidence still
passes separately.

Evidence is under the run-owned temporary
`primeclaw62-slice4-rhi9nvgg/pytest-final/test_native_observation_entry_0/`: verified
`identity.json`, `loader.stdout`, `native-entry-result.json`,
`native-chain-result.json`, snapshots and Docker status/cleanup files. These are
ordinary disposable test artifacts, not new runtime evidence stores.

An initial run stopped before the new chain because loading the real compact
skill required installation into the read-only prewarmed kernel. The fixture
image now installs that pinned bundled skill during its existing image-build
bootstrap; no runtime guard or test was relaxed. The rebuilt-image run passed
2 tests in 50.72s; the final run above also includes stronger input-count/order
and delivery-result assertions. No production plugin source changed, so this
existing isolated container suite is the slice's proportional native Tier 1
validation. Prior accepted provider/socket/retained-v1/Tier1-probe evidence is
separate cumulative evidence, not a claimed rerun of those suites.
