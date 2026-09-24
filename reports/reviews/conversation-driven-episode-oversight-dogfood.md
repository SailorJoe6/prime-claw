# Conversation-driven episode oversight dogfood

> **Status:** In progress as of 2026-09-24. This is a sanitized point-in-time evidence record, not canonical policy, final acceptance, merge approval, or a native-command instruction.

## Scope and current boundary

The isolated dogfood has completed setup, native promotion, and its first implementation generation. Generation two has **not** been admitted. The shared continuation repair is being developed and reviewed separately; this report does not integrate, install, or exercise that work.

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

A replacement shared repair must preserve the valid state/route fixes, correct the misleading success receipt, remove false atomic claims and tests, and document that immediate-or-queued admission is not completion. That replacement is outside this evidence-only slice.

## Evidence sources and preservation

This record reconciles durable Bead `prime-claw-h6w.22`, the fixture's durable episode state, exact Git objects for promotion and generation one, the rejected exact main candidate, and the retained EXPERT report. It intentionally excludes raw conversation transcripts, credentials, private data, and host-local absolute paths.

The fixture baseline, episode worktree and branch, local bare remote, durable owner state, and accepted generation-one commit remain preserved. No fixture retry, generation-two admission, final EXPERT review, terminal disposition, merge, abandonment, or cleanup is claimed here.

## Evidence-slice validation

The outer evidence-only candidate passed the maintained repository gates:

- `node --test tests/*.test.mjs` — **PASS**, 157/157;
- `pytest -q tests` — **PASS**, 294 tests plus 7 subtests (11 deprecation warnings);
- `git diff --check` — **PASS**; and
- bounded relative-link validation for changed Markdown — **PASS**, 2/2 local links resolve.

These checks validate the evidence/docs candidate. They do not complete the open live-dogfood gates listed above.
