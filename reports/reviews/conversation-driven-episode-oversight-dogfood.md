# Conversation-driven episode oversight dogfood

> **Status:** In progress as of 2026-09-24. This is a sanitized point-in-time evidence record, not canonical policy, final acceptance, merge approval, or a native-command instruction.

## Scope and current boundary

The isolated dogfood has completed setup, native promotion, and its first implementation generation. Generation two has **not** been admitted. The owner-accepted shared continuation repair is now incorporated into the outer episode branch through an ordinary two-parent integration candidate. It has not been installed into the user-global plugin, loaded by the fixture owner, or exercised for a fixture retry.

Open gates remain: a safe canonical continuation, generation two, fresh final EXPERT review of the complete fixture candidate, explicit operator disposition, conservative cleanup, and return to ordinary conversation without a stale episode lock.

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

This record reconciles durable Bead `prime-claw-h6w.22`, the fixture's durable episode state, exact Git objects for promotion and generation one, rejected historical repair candidates, owner-accepted shared main, and retained EXPERT reports. It intentionally excludes raw conversation transcripts, credentials, private data, and host-local absolute paths.

The fixture baseline, episode worktree and branch, local bare remote, durable owner state, and accepted generation-one commit remain preserved. No plugin installation, fixture retry, generation-two admission, final feature EXPERT review, terminal disposition, merge to main, abandonment, or cleanup is claimed here.

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
