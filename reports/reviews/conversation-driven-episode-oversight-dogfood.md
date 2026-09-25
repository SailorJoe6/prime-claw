# Conversation-driven episode oversight dogfood

> **Status:** Completed disposable dogfood; evidence-only closure pending exact outer owner review. This is a sanitized evidence record, not canonical policy, outer merge approval, or a native-command instruction.

## Scope and current boundary

The isolated dogfood completed two implementation generations. Generation two
exact `b8ddda43da88c897c2a844cca99d31a95f38c7fb` passed fresh final EXPERT review,
and the operator chose merge in ordinary conversation. The owning conversation
performed and verified the fixture's context-sensitive terminal work. The old
bookkeeping failure below is historical checkpoint evidence; accepted-generation
recovery and final clean fixture state are recorded at the end of this report.

The old design produced two distinct authorization attempts. The first
`finalize_spec_episode` authorization cancelled because its confirmation UI was
not attached to the supervising conversation; no terminal work was inferred from
that cancellation. The later owner interaction successfully authorized `merged`
for exact fixture tip `b8ddda43da88c897c2a844cca99d31a95f38c7fb`. After the
test CONVERSATION completed and verified the disposable terminal work, exactly
one completion call failed with
`Finalization is blocked with durable recovery evidence preserved: Daemon session row has an invalid session UUID`.
It was not retried. At that historical checkpoint, the receipt remained
`authorized`, and matching identity, oversight, and retained refs were frozen.
Dogfood showed that duplicate UI and two-phase generic terminal validation were
unnecessary and misplaced. The approved simplified terminal generation was later
applied globally and used in the controlled recovery documented below. The old
receipt remains inert; the matching identity and merged episode refs are now
removed. No further fixture action is authorized in this evidence-only generation.

## Isolated setup and native promotion

The disposable repository began at exact local and bare-remote baseline `b5904323dbdc3afc34e954818d97587f582879dd`. Its 21 copied candidate plugin, reviewer-profile, orientation, and canonical Ralph-skill blobs matched the accepted outer candidate `716646ceb0c946a34fcb89654511da00e1b6fc96`. The minimal reviewed bundle was `.ralph/plans/future/two-generation-oversight-dogfood`.

Two fresh default roots independently proved one managed identity kernel, distinct UUID-bound `CONVERSATION` identity, first-substantive-turn preparation, no extension-generated startup turn, ordinary discussion, phase-skill visibility, and a clean fixture:

| Role | Session UUID | Route at setup |
|---|---|---|
| Assigned owner A | `01a0d41a-5568-705d-8bdb-97130dd1ef16` | `9ed62e717dbd` |
| Unassigned control B | `01a0d41a-5578-70a8-837f-03c627752f37` | `157a516d2faf` |

The operator issued the native `/implement-spec` command in conversation A. Durable state binds that exact owner to:

- promotion commit `be1c27c072214ee393a66264008d7726c3e413b3`;
- episode UUID `01a0d43b-e71c-702f-8f94-d5d7e60c2247`;
- episode route `91480d611757` at creation;
- branch `episode/two-generation-oversight-dogfood`;
- worktree name `project-two-generation-oversight-dogfood-episode`; and
- bootstrap admission `delivered`.

Conversation B remained unowned. The canonical prime-claw checkout was not used as the fixture or episode worktree.

## Generation one

The episode pushed exact commit `98ffb066891064abc66e666bec6b9c24b8483a96` directly on promotion commit `be1c27c072214ee393a66264008d7726c3e413b3`. Its functional delta is limited to the active plan record, `dogfood/state.json`, and `tests/test_dogfood_state.py`. The state and focused assertion both contain exactly `generation-one`.

Recorded validation:

- `python3 -m unittest tests/test_dogfood_state.py` — **PASS**, 1 test;
- `git diff --check` — **PASS**;
- local branch and local bare remote — exact `98ffb066891064abc66e666bec6b9c24b8483a96`; and
- worktree — clean after push.

The episode reported completion directly to owner conversation A. A used exactly one bootstrap-generation watch, `90cd700a-15c0-4b7d-81f1-b68639258c8c`, as a missed-report safety net, then cancelled it at the completed boundary with run count 0. The owner reconciled and accepted this small exact candidate without an unnecessary intermediate EXPERT review.

## Continuation friction

After accepting generation one, conversation A made three canonical continuation attempts; the third came from a fresh turn. Each attempt pre-armed one intended-generation watch and cancelled it after the capability definitely returned `Owned episode is not quiescent`. No attempt admitted handoff or execute work. No generation-two work or watch remains.

After the second attempt, the exact episode state was independently observed as activity idle with no streaming, compaction, bash, tool, RLM-child, unfinished-action, or queued work. `taskState` was `needs_input`, but `isSessionActive` was `false`. A third attempt from a fresh turn produced the same definite rejection.

Read-only source investigation established that Prime Agent 0.9.5 uses `isSessionActive` as execution/work state rather than route publication. A resident idle session can retain a route while reporting `isSessionActive: false`; publishing or reopening a route does not itself start a model turn. The installed shared handoff code instead required `isSessionActive === true` in its idle predicate and reopened a valid resident route when that value was false. Those facts explain the observed false rejection.

## Rejected repair and contract correction

A separate main-checkout repair candidate, exact `e41f860ecad9835204386c306b52e4e7a5a99160` with parent `624f85612d3172ad559b369502ddbc5fae4d7be4`, corrected route/state handling but was **rejected** by exact-commit review. The admitted reviewer was `openai-codex/gpt-6-astra` at reasoning `max`; its retained report is `idle-session-handoff-review.md` in the owner's session artifacts.

The review recorded two blockers:

1. Prime Agent 0.9.5 ordinary `prompt` with `queueIfBusy: false` rejects an active streaming turn, but non-streaming bash, compaction, retry, or pending-action races can still admit queued work. The candidate's fake race test therefore did not prove its claimed atomic all-busy guarantee.
2. The reviewed-plan success text still said the remote handoff used `steer`, contradicting the returned `handoffDelivery: "prompt"` receipt.

The review's supporting checks passed 90 selected Node tests, 5 documentation/policy tests, and 24 in-memory guard cases. Its native admission characterization was source/control-flow evidence, not a full live runtime integration test. Exact `e41f860ecad9835204386c306b52e4e7a5a99160` remains rejected historical evidence and was not integrated, installed, or applied to this dogfood.

The operator then corrected the continuation contract. The EPISODE sibling and its completion report are trusted process participants: a direct completion report triggers exact owner review, and after acceptance plus reasonable observed quiescence the owner may issue canonical handoff. The heartbeat is a missed-report or off-track safety net, not a substitute scheduler. If the sibling has not reported but appears idle, the owner asks whether it is complete or waiting and trusts the answer before review or handoff. Residual non-streaming work may cause an ordinary prompt to wait until idle; that is acceptable after report and acceptance. A streaming rejection remains definite and may be retried later. No Prime Agent core change, compare-and-swap primitive, or lease is required by this corrected contract.

The first replacement, exact `dceb5ef1dbb29501a63d951790509c8852c8fc85`, preserved the route/state repair and corrected the receipt but remained blocked because its test language still overstated native proof and its documentation did not clearly distinguish bootstrap from later observed continuation. The bounded docs/tests repair exact `a9381ebb50e100ec85a77048ec35ce76d54d77ba` then removed the fake-native claims, stated the controlled publisher boundary, distinguished bootstrap's lack of a state read from later continuation's fresh snapshot, and corrected intended-retry watch lifecycle. Its final five-file delta contained no runtime-code change.

The owner accepted cumulative shared main exact `a9381ebb50e100ec85a77048ec35ce76d54d77ba` after exact lineage and scope checks, Node 90/90, implementer Python 260/260, a focused pass after one unrelated owner-suite watchdog timeout, link/diff checks, and a fresh exact `openai-codex/gpt-6-astra` reasoning-`max` **PASS**. The retained final review is `trusted-handoff-evidence-repair-review.md` in the owner's session artifacts. The accepted contract is the trusted completion report or status answer, independent owner review and acceptance, reasonable quiescence, an observed continuation snapshot, ordinary prompt admission that may be immediate or queued, definite streaming rejection, truthful receipt, and conservative uncertainty with no replay. Bootstrap performs no state read before publication. No atomic all-busy, Prime Agent core, compare-and-swap, or lease claim remains.

This outer branch now incorporates that accepted cumulative repair through an ordinary merge candidate with first parent `39e946ae32769b9bb767a86176c5ce32d6c3a832` and second parent `a9381ebb50e100ec85a77048ec35ce76d54d77ba`. Conflict resolution preserved the promoted future-folder deletion, the accepted trusted-sibling documentation, the episode finalization and oversight tests, and the accepted main admission tests. This integration is candidate evidence only until exact owner review. It was not installed or exercised against the fixture.

## Evidence sources and preservation

This record reconciles durable Bead `prime-claw-h6w.22`, the fixture's retained
durable owner evidence, exact Git objects, rejected historical repair candidates,
owner-accepted shared main, and retained EXPERT reports. It intentionally excludes
raw conversation transcripts, credentials, private data, and host-local absolute
paths.

### Historical pre-generation-two checkpoint

The following paragraph records an earlier checkpoint and does not describe the
fixture's latest resource state. At that checkpoint, the fixture baseline,
episode worktree and branch, local bare remote, durable owner state, and accepted
generation-one commit remained preserved. No plugin installation, fixture retry,
generation-two admission, final feature EXPERT review, terminal disposition,
merge to main, abandonment, or cleanup was claimed at that checkpoint.

## Evidence-slice validation

The outer evidence-only candidate passed the maintained repository gates:

- `node --test tests/*.test.mjs` — **PASS**, 157/157;
- `pytest -q tests` — **PASS**, 294 tests plus 7 subtests (11 deprecation warnings);
- `git diff --check` — **PASS**; and
- bounded relative-link validation for changed Markdown — **PASS**, 2/2 local links resolve.

These checks validate the evidence/docs candidate. They do not complete the open live-dogfood gates listed above.

## Accepted-main integration validation

The ordinary two-parent integration candidate passed the final serial gates:

- focused merged handoff/finalization Node coverage — **PASS**, 85/85;
- maintained Node — **PASS**, 175/175;
- maintained Python — **PASS**, 298 tests plus 7 subtests (11 deprecation warnings);
- plugin inventory/install-policy checks — **PASS**, 15 tests plus 7 subtests;
- changed-Markdown local links — **PASS**, 15/15;
- plugin-source integrity — **PASS**, all 8 managed source/kernel files are regular and nonempty, with no project-local plugin root; and
- `git diff --check` and conflict-marker checks — **PASS**.

The first parallel maintained run was not accepted as gate evidence. It exposed one existing finalization-lock timing timeout under concurrent load and seven integration assertions that still referenced the deleted future bundle or historical `steer` transport. The lock case passed focused serially; the integration assertions were corrected to the promoted active paths and accepted ordinary-prompt contract. Both complete maintained suites then passed serially as recorded above.

These checks validate outer branch integration only. They do not prove user-global installation, fixture retry, generation two, final feature EXPERT review, operator disposition, or cleanup.

## Post-install canonical-package coherence repair

After owner acceptance of integration exact
`a16f57fc29febdf6278b3d0afe71fb42060d9ea4`, the user-global apply/check and
fresh-process native probes remained valid. Inspection of the freshly injected
canonical `oversee-episode` package found two documentation-policy mismatches:
it paraphrased the trusted idle-without-report status question, and it cancelled
the intended-generation watch after definite first-send no-admission even though
the accepted specification retains that watch for a later retry.

This bounded source repair now:

- asks exactly `You seem done with your work. Are you complete or waiting for some process?`
  when apparent quiescence has no completion report, then trusts the answer before
  review or handoff;
- retains the already pre-armed intended-generation watch after definite first-send
  no-admission for a later fresh observed-idle owner retry;
- states that the watch never retries automatically and preserves the existing
  uncertainty/no-replay boundary; and
- adds focused regression assertions for both requirements.

The active specification already carried the accepted contract and did not need
semantic revision. Focused policy/injection validation passed 35/35 Python and
85/85 Node; maintained validation passed 175/175 Node and 299 Python tests plus
7 subtests. No fixture-owner reload, fixture handoff retry, generation-two
admission, final EXPERT decision, terminal disposition, or cleanup occurred in
this repair.
## Generation two, final review, and terminal-work evidence

A fresh-route continuation admitted generation two and produced exact pushed
candidate `b8ddda43da88c897c2a844cca99d31a95f38c7fb`, directly after accepted
generation one `98ffb066891064abc66e666bec6b9c24b8483a96`. Its three-file delta was the
fixture active plan, `dogfood/state.json`, and `tests/test_dogfood_state.py`.
Focused fixture validation passed 1/1 and the worktree was clean at review.

Fresh final reviewer session `01a0d584-83d4-7335-bc8b-995b36e675f8` used exact
`openai-codex/gpt-6-astra` with admitted `max` reasoning and returned
`PASS — no material findings` for that exact commit. The retained sanitized
report has SHA-256
`a1ad1f509efef53c9a1123a89b03b83309ea079fbcd70a75857897f1da7e1d16`.

The operator then selected merge conversationally. In exact test CONVERSATION
`01a0d41a-5568-705d-8bdb-97130dd1ef16`, the first old-design native
authorization call returned `Episode finalization authorization was cancelled`;
no UI receipt or terminal mutation resulted. During a later owner interaction, a
second old-design authorization succeeded for disposition `merged` and exact
fixture tip `b8ddda43da88c897c2a844cca99d31a95f38c7fb`.

That test CONVERSATION then fast-forwarded and pushed disposable `main`, stopped
EPISODE `01a0d43b-e71c-702f-8f94-d5d7e60c2247` through supported
`prime-agent stop`, removed its clean worktree, and verified that only the main
worktree remained. The matching local and remote episode refs were retained. It
then made exactly one old-design `complete` call, which returned:

```text
Finalization is blocked with durable recovery evidence preserved: Daemon session row has an invalid session UUID
```

The call was not retried. The finalization receipt remains `authorized`, and the
matching retained identity/oversight evidence and refs remain frozen. This is the
actual old-finalizer blocker; it is distinct from the earlier cancelled
confirmation and does not claim that bookkeeping completion succeeded.

This friction led to the approved outer correction: readiness and the sole
operator decision stay conversational; the owning CONVERSATION performs and
verifies context-sensitive terminal work; and the plugin retains only an exact,
location-only, no-UI, idempotent bookkeeping close. Authorization receipts,
locks, completion recovery, generic Git validation, and global daemon inventory
are removed. This evidence does not claim the corrected generation was installed
or exercised against the frozen fixture.

## Simplified terminal-workflow candidate validation

The bounded outer correction removed 684 lines of obsolete finalization support
and replaced them with a small exact bookkeeping close plus focused interruption
and generation-isolation tests. Final maintained validation passed:

- Node: **119/119**;
- Python: **297 tests plus 7 subtests**, with only the known unrelated
  candidate-watchdog full-run timeout; its exact isolated rerun passed in 2.22
  seconds (11 existing deprecation warnings);
- isolated native oversight/discovery probes: **6/6**;
- plugin install/inventory and focused policy coverage: **36 tests plus 7 subtests**;
- changed-Markdown relative links: **9/9**; and
- `git diff --check`: **PASS**.

A pre-review full Python run passed all 298 tests plus seven subtests. On the
exact final diff, all 297 other tests and seven subtests passed, while the known
candidate-progress watchdog again hit its 15-second full-run timeout; its exact
isolated rerun passed in 2.22 seconds. No global plugin apply/reload or
disposable-fixture mutation occurred.

## B1/B2 repair candidate validation

The bounded repair separates exact historical replay from current ownership and
corrects the frozen chronology above. It does not alter the simplified terminal
policy, reintroduce removed finalization machinery, or claim installation against
the disposable fixture.

Repair validation passed:

- focused lifecycle and registered-tool Node coverage: **41/41**;
- exact native sequential/restart replay probe: **1/1**;
- focused Python policy/install coverage: **34 tests plus 7 subtests**;
- maintained Node: **120/120**;
- maintained `python3 -m pytest -q tests`: **299 tests plus 7 subtests** in
  90.75 seconds, with 11 existing deprecation warnings;
- changed-Markdown relative links: **9/9**; and
- source inventory, shell syntax, `git diff --check`, and worktree-scope checks:
  **PASS**.

The earlier `d50380d` watchdog timeout and isolated rerun remain recorded in the
preceding section as historical evidence. No global plugin apply/reload and no
disposable-fixture inspection, mutation, retry, finalization, or cleanup occurred
in this repair.

## Accepted generation installation and fresh-process proof

The owner accepted exact simplified-terminal repair
`e17891c771206808bec7400a8ea67a09bdfb6f32` after a fresh exact
`openai-codex/gpt-6-astra` reasoning-`max` **PASS** with no material findings.
The report SHA-256 is
`0d5109244aa6e74955a8addefd0b28d8c1008b46a0ac36612362e051a45f8891`.
This acceptance authorized controlled installation and dogfood recovery, not an
outer merge.

The canonical global apply/check workflow then passed and reported the
user-global copy current. A fresh isolated Prime Agent process rooted in the
accepted feature worktree passed **2/2** native probes in 13.68 seconds: real
implement-spec activation/resume/absence, and historical inactive-generation
close replay beside a later cycle. The probe did not use the persistent user
configuration or session stores and did not touch the disposable fixture.

The project-local skill copies remained deliberately distinct:

- accepted feature package:
  `b4d49566f02d4eb5584df4b2222382f08e0b3744c5948e11b4dc36e2db79b20e`;
- then-current dirty main checkout's old package:
  `ee82bde79b1e371a03b2aa28863372821a6d73e92bed61ea5554106fd6a5ef6a`;
- disposable fixture's old package:
  `6f25411efab75fecb9cf45dc5d2772b2620e79b614426ef4553e1b5ecedbf071`.

Project skill discovery is not a hot-reload mechanism. This currently loaded
outer owner therefore truthfully retained its old package even after global
apply/check; only fresh processes proved the accepted generation.

## Simplified close recovery and final fixture state

For the controlled recovery, the accepted skill bytes were temporarily overlaid
only in the disposable project. An initial `prime-agent send` reopened the
archived test CONVERSATION from the wrong CWD. The owner detected the mistake
before any mutation, stopped that route, cancelled its watch, and verified that
identity, receipt, markers, refs, and worktree were unchanged.

The successful foreground resume used the explicit fixture CWD and exact test
CONVERSATION session file. It verified the new conversational terminal step and
location-only no-UI tool, then called `finalize_spec_episode` exactly once with
the sole argument
`.ralph/plans/future/two-generation-oversight-dogfood`. The bookkeeping close
succeeded without performing Git, session, worktree, ref, or skill mutation:

- the exact episode identity file was removed;
- two matching oversight markers remained, with the latest marker `inactive`;
- the test session returned to ordinary CONVERSATION capability; and
- the old `.finalization.json` remained inert with `state=authorized`,
  `disposition=merged`, and exact `episodeCommit=b8ddda43da88c897c2a844cca99d31a95f38c7fb`,
  alongside its preserved zero-byte transaction lock.

The owner restored the disposable project's original skill bytes exactly to
`6f25411efab75fecb9cf45dc5d2772b2620e79b614426ef4553e1b5ecedbf071`,
returning its worktree to clean state. A second correctly rooted ordinary
CONVERSATION turn verified terminal facts and removed only the merged local and
remote `episode/two-generation-oversight-dogfood` refs.

Final retained state is:

- clean matching local and remote `main` at
  `b8ddda43da88c897c2a844cca99d31a95f38c7fb`;
- both merged episode refs absent and no unrelated ref deletion;
- only the main worktree;
- inactive EPISODE;
- inactive/resumable ordinary test CONVERSATION;
- exact restored project-local skill bytes;
- inert old receipt and lock preserved; and
- all watches cancelled.

This is the completed dogfood evidence boundary. The disposable fixture must not
be inspected, mutated, retried, finalized, cleaned, or deleted further.
## Evidence-only closure validation

This final outer diff changes only the active plan, this report, and the living
oversight documentation. No runtime, skill, plugin, test, or specification
semantics were changed; no installation, reload, or fixture action was repeated.

- `node --test --experimental-strip-types tests/*.test.mjs` — **PASS**, 120/120.
- `python3 -m pytest -q tests` — **NOT GREEN**: 298 tests and 7 subtests passed,
  but `test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero`
  timed out after 15 seconds following its expected stall message (11 existing
  deprecation warnings). This known unrelated watchdog test also timed out after
  15 seconds in its exact isolated rerun, so this run does not claim an isolated
  pass.
- `python3 -m pytest -q tests -k 'not test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero'`
  — **PASS**, 298 tests and 7 subtests, 1 deselected (11 existing warnings).
- Focused dogfood chronology and canonical oversight skill policy tests —
  **PASS**, 1/1 and 10/10 respectively.
- Changed-Markdown relative links — **PASS**, 2/2.
- `git diff --check` — **PASS**.

The watchdog failure is kept visible for exact owner review and is not repaired or
interpreted as a dogfood result. Earlier accepted-repair serial Python 299 + 7
subtests remained valid for its own commit; it does not turn this later
non-green full run into a pass.
