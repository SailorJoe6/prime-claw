# Execution Plan — Official lean session protocol

> **Status:** Draft for operator review
>
> **Specification:** [SPECIFICATION.md](SPECIFICATION.md)
>
> **Tracking:** `prime-claw-h6w.25`
>
> **Execution shape:** One isolated implementation episode, three pushed slices,
> and one operator-controlled full runtime restart before cleanup. The episode
> branch remains unmerged through the cutover so `main` continues to provide all
> compatibility files to old loaded sessions.

## Outcome

Promote the dogfooded lean session protocol to the supported default, prove it in
the tier-1 Docker boundary, install and restart into that transition generation,
then remove only the compatibility resources that the restarted generation no
longer uses. Finish with current documentation, a clean global plugin check, a
closed tracking bead, and a reviewable final branch.

## Baseline and invariants

Planning was performed from clean `main` at `44d83db`. Relevant history:

- `00ad366` — lean protocol POC;
- `535f584` — stale package assertions reconciled with the POC;
- `1442abb` — three-tier plugin test container merged; and
- `44d83db` — reviewed migration specification committed.

The active global plugin matches the current eight-file POC generation. The old
`.ralph/skills/oversee-episode/SKILL.md` is live compatibility state: old loaded
conversation hooks reread it on every turn. Its symlink and reviewer profile are
also retained until cutover.

The implementation must preserve these invariants throughout:

1. No Prime Agent source change or concurrent host daemon.
2. Plugin execution tests run through tier 1, not an unguarded host process.
3. `main` keeps the old skill, symlink, and profile until after accepted cutover.
4. The episode worktree keeps them through the transition commit and restart.
5. Historical archived plans, reviews, reports, and evidence are not rewritten.
6. Cleanup never begins from install success alone; it requires a full restart,
   resumed-session evidence, and explicit operator acceptance.
7. If the cutover fails, restore the `44d83db` plugin generation and retain all
   compatibility resources before trying anything else.

## Delivery topology

Use one episode branch and do not merge the transition commit by itself:

```text
main (old plugin source + compatibility files stay intact)
  \ episode worktree
       transition commit ── test ── review
       deployment-checkpoint commit ── apply candidate globally ── full restart
                                       │                           │
                                       └──── rollback to main ─────┘
       accepted resumed-session UAT
       cleanup commit ── test ── final review ── merge once
```

The transition commit is independently deployable because it is pushed and
applied from the isolated worktree. Keeping the branch unmerged prevents the
canonical checkout from losing compatibility files before the restart. After the
restart, the same saved owner and episode sessions resume on the new global
plugin generation. Cleanup then occurs only in the episode worktree. The final
merge is the first deletion of compatibility files from `main`.

If this topology cannot be followed exactly, stop and revise the plan. Do not
improvise a main-checkout deletion or assume the episode can continue after an
early merge.

## Slice 1 — Build the compatibility-safe transition generation

### Capability delivered

A pushed plugin generation implements the official lean runtime and installer
contract, passes all automated gates, and remains safe while old sessions are
still loaded because every live compatibility resource remains present.

### Implementation

#### Runtime simplification

Update
`src/prime-agent-plugin/extension-support/conversation-oversight.ts` to:

- remove `OVERSIGHT_PACKAGE_PATH`, `packageBody`, the package frontmatter/scalar
  parser, and every current package-validation call;
- remove imports used only by that parser;
- retain the historical custom-message filter, naming its constant as legacy
  behavior rather than a current package source;
- keep exact marker, expectation, owner, lifecycle, bounded-identity, recovery,
  handoff, and finalization behavior unchanged; and
- continue validating exactly one byte-current managed system block whenever
  promotion or trusted active state requires it.

Do not change the text of `src/prime-agent-plugin/APPEND_SYSTEM.md` unless a test
finds a real specification gap. Its normalized body must remain at or below 250
words and byte-match the TypeScript expected block.

#### Work-control and installer transition

- Remove the inert
  `src/prime-agent-plugin/extensions/goal-heartbeat-work-control.ts` entry point
  from source and the managed allowlists.
- Change apply/check from eight managed TypeScript files to seven.
- Treat a globally installed `extensions/goal-heartbeat-work-control.ts` as a
  retired managed file: apply removes it only after destination-type preflight;
  check reports it as stale.
- Remove installer/check dependence on the project oversight skill. The skill is
  still present for old loaded code, but it is no longer a current installer
  prerequisite.
- Preserve unrelated global files, symlink/type rejection, interrupted-install
  detection, managed APPEND_SYSTEM merging, and convergence behavior.

#### Tests

Update tests around the behavior boundary rather than mechanically deleting
coverage:

- `tests/project_conversation_extension.test.mjs`
  - promotion requires the managed block but no skill fixture;
  - active owner context filters a historical package without adding a new one;
  - all exact lifecycle and bounded-identity cases remain.
- `tests/reviewed_plan_extension.test.mjs`
  - episode creation and owner activation require no package file;
  - remove package-frontmatter rejection cases that no longer describe runtime.
- `tests/test_project_conversation_extension.py`,
  `tests/test_conversation_oversight_native.py`, and
  `tests/test_reviewed_plan_native_discovery.py`
  - stop copying the oversight skill into isolated native fixtures;
  - prove promotion, recovery, active turns, resume/reload, real-child precedence,
    and post-compaction behavior without it;
  - continue asserting zero current full-package provider messages.
- Replace the inert-extension tests with a managed-session-protocol contract test
  that checks the APPEND_SYSTEM goal/heartbeat rules, word bound, retired entry
  absence, and continued absence of old autonomous pause/resume tools.
- Update `tests/test_prime_agent_plugin_install.py` for the seven-file allowlist,
  stale retired entry removal/check, unsafe file/directory/symlink preflight,
  unrelated-file preservation, and repeatable convergence.
- Keep `.ralph/skills/oversee-episode/SKILL.md`, its discovery link,
  `.prime/agent/profiles/expert-reviewer.md`, and their compatibility tests in
  this slice. Adjust only current-documentation assertions that would otherwise
  mislabel them as the supported runtime policy. Their continued presence is a
  regression guard until the cutover gate.

Do not weaken lifecycle assertions or replace full gates with broad exclusions.
If a failure appears unrelated, reproduce it against untouched `44d83db` and
record or link a separate bead before deciding disposition.

#### Documentation

Update current normative surfaces to describe the transition state:

- `AGENTS.md` — make the loaded-generation rule explicit: resources read by the
  installed old generation survive until the coordinated restart proves the new
  generation;
- `docs/conversation-driven-episode-oversight.md` — lean protocol, lifecycle
  mechanics, historical-message filtering, and temporary compatibility files;
- `docs/goal-heartbeat-work-control.md` — APPEND_SYSTEM is the current policy;
  the removed extension is history, not activation guidance;
- `docs/lab-global-plugin.md` — seven-file layout, retired-entry migration,
  candidate apply, full restart requirement, and rollback;
- `docs/README.md` — current descriptions and links.

Audit `VISION.md` and `LONG_RANGE_PLAN.md`. Change them only if a current claim is
false after this slice. Leave archives and evidence untouched.

### Verification

Select exactly one tier-1 Prime Agent source through the worktree's gitignored
`.env` or an operator-approved `TIER1_ENV_FILE`. Do not copy credentials or host
harness state into the worktree or container.

Run from the episode worktree:

```bash
git diff --check
scripts/test-all.sh
```

The required result is tier 0 PASS and the complete tier 1 PASS, including owned
container teardown. Tier 2 is out of scope. Record the `.test-results/` run path,
summary, elapsed time, and any tracked unrelated failure in the bead and plan.

Also run a current-reference audit such as:

```bash
rg -n "oversee-episode|OVERSIGHT_PACKAGE|goal-heartbeat-work-control|PRIME_CLAW_GOAL_HEARTBEAT_WORK_CONTROL_V1|expert-reviewer"   AGENTS.md src scripts tests docs .ralph .agents .prime VISION.md LONG_RANGE_PLAN.md
```

Classify each hit as current runtime, temporary compatibility, current docs/test,
or immutable history. Do not edit history to make the search empty.

### Slice completion

- Update `prime-claw-h6w.25` with changed surfaces, exact test commands/results,
  the pushed commit, and the known-good rollback commit `44d83db`.
- Update this plan's progress section.
- Commit one transition generation and push the episode branch.
- Stop for owner review. Do not apply globally, restart, clean up, or merge in the
  same execute pass.

## Slice 2 — Deploy the accepted transition and checkpoint rollback

### Dependency

The owner has accepted the exact pushed Slice 1 commit and all in-scope revision
findings are already incorporated. This slice must not change runtime, installer,
managed-system-block, or test bytes.

### Capability delivered

The accepted seven-file transition generation is installed and byte-verified in
the single host environment, exact rollback inputs are durable, and the system
is ready for an operator-controlled full restart without having removed any
compatibility file.

### Execution

1. Confirm the episode worktree is clean and the current plugin, scripts, and
   tests are byte-identical to the accepted Slice 1 commit. A plan-progress edit
   is allowed; any product-code drift returns to owner review.
2. Reconfirm the compatibility skill, discovery link, and reviewer profile are
   present and byte-current.
3. Identify one exact saved ordinary project conversation for restart UAT and
   record its session ID, name, and canonical project CWD. It must complete a
   normal pre-restart turn on the current single daemon. If no suitable saved
   conversation exists, stop and ask the operator to create or approve one
   through the normal session flow on that same daemon; cutover stays blocked.
4. Record:
   - accepted transition commit and branch;
   - `44d83db` as the rollback source generation;
   - current installed managed-file hashes or exact check result;
   - active episode identity and resumable branch/worktree/session details;
   - exact ordinary-session identity and successful pre-restart turn; and
   - the successful Slice 1 tier-0/tier-1 evidence.
5. Re-run `git diff --check` and `scripts/test-all.sh` against the accepted tree.
6. From the episode worktree run the Docker-only candidate gates:

   ```bash
   python3 -m pytest tests/ -q -m container
   scripts/test-tier1.sh --probe
   ```

7. Verify the explicit container installation matches the accepted seven-file
   candidate, the retired goal/heartbeat entry is absent, the managed
   APPEND_SYSTEM block is current, and the old project compatibility resources
   are still present. Do not mutate the host user-global generation from the
   episode worktree.

A successful container apply does not prove the host loaded generation changed.

### Slice completion

- Record the exact commands, results, hashes, test log, and restart-ready
  checkpoint in `prime-claw-h6w.25` and this plan.
- Commit and push only the durable deployment-checkpoint/progress update.
- Stop for owner review and operator restart coordination. Do not use `/reload`,
  start cleanup, or attempt to restart the harness from the episode.

## Cutover gate — Restart and verify the transition

This is an owner/operator gate between implementation slices, not permission to
start cleanup automatically.

### Admission

The owner reviews and accepts the exact pushed Slice 2 deployment checkpoint.
The global check, installed hashes, rollback source, compatibility resources, and
resumable episode identity must still match that checkpoint. Any drift returns
to Slice 2 rather than being accepted informally.

### Coordinated restart

- Let active turns, child agents, tests, heartbeats, and other background work
  become idle or durably checkpointed.
- Complete active goals that would otherwise imply work is still running.
- The operator performs one full Prime Agent daemon/harness restart. Do not use
  `/reload`, start a second daemon, or delete saved sessions.
- Resume this owning conversation, the exact implementation episode, and the
  exact ordinary saved conversation recorded in Slice 2. The ordinary session
  must run from its recorded canonical project CWD and complete a real turn.

### Required UAT evidence

Collect evidence from the restarted single runtime plus the accepted container
capture:

- the owner conversation resumes with exact episode ownership intact;
- the episode resumes with its bounded role, branch, worktree, and task intact;
- an ordinary conversation completes a real turn without promotion or package
  errors;
- provider-context evidence contains one managed lean block, no newly injected
  `prime-claw-oversee-episode-package`, and no legacy detailed work-control
  overlay;
- exact lifecycle state remains fail-closed and handoff/finalize authority has
  not broadened;
- goal/heartbeat behavior follows the lean managed protocol during a naturally
  occurring work/wait boundary; and
- no session reports a missing oversight skill or requires `/reload` recovery.

Do not launch an extra host Prime Agent process merely to obtain a cleaner probe.
Use the running resumed sessions and the tier-1 provider capture. If evidence is
insufficient, pause rather than violate the single-instance boundary.

Record the restart and UAT evidence on `prime-claw-h6w.25`. The operator must
explicitly accept the cutover before the owner advances the episode to Slice 3.

### Rollback on failure

If any required UAT fails:

1. keep or restore all compatibility files;
2. from clean `main` at `44d83db`, run the normal apply/check scripts to restore
   the eight-file POC generation;
3. perform the same quiesce and full-restart discipline;
4. verify ordinary and owning sessions recover; and
5. record the failure, evidence, and resumable checkpoint.

Do not begin cleanup and do not retry uncertain lifecycle operations blindly.

## Slice 3 — Remove compatibility scaffolding and finish the official default

### Dependency

This slice is blocked until the operator's accepted cutover evidence is recorded
in the bead and delivered to the episode as an approved in-scope continuation.

### Capability delivered

The final branch contains only the supported lean architecture and current
policy. Compatibility files proven unnecessary are removed without affecting the
already-restarted runtime, all gates pass again, and the candidate is ready for
one final merge.

### Implementation

Start with a fresh nonhistorical reference audit. Expected removal candidates:

- `.ralph/skills/oversee-episode/SKILL.md`;
- `.agents/skills/oversee-episode`;
- `.prime/agent/profiles/expert-reviewer.md` when no independent current use is
  found;
- `tests/test_oversee_episode_skill.py` and remaining compatibility-only package
  assertions; and
- transition-only wording or guards in current docs/tests.

Do not remove an item with a real independent current use. Record the use and
retain or replace it with an explicit current contract. Do not alter archived
plans, historical reviews, dogfood reports, or evidence references.

Finalize current docs so they describe the supported lean default rather than an
active migration. Preserve a concise migration/rollback note where operationally
useful. Confirm the plugin layout is seven TypeScript files plus the managed
APPEND_SYSTEM block.

Slice 3 should not change installed plugin bytes. If implementation discovers a
necessary plugin-code or managed-system-block change, stop: that creates a new
runtime generation and requires a revised plan plus another restart gate before
cleanup can be considered safe.

### Verification

Run again from the episode worktree:

```bash
git diff --check
scripts/test-all.sh
scripts/test-tier1.sh --probe
```

Required results:

- tier 0 and complete tier 1 pass;
- no owned container or scratch artifact remains;
- explicit container-root apply/check passes without the old skill or inert
  extension source;
- the container-installed managed TypeScript and APPEND_SYSTEM bytes are
  unchanged from the accepted transition generation; and
- the reference audit contains only intentional current legacy-filter names and
  immutable historical mentions.

If global managed bytes changed, the no-second-restart assumption is false. Stop
and return to the owner before merge.

### Slice completion

- Update normative docs and this plan's progress/evidence.
- Update `prime-claw-h6w.25` with cleanup evidence and leave it open pending the
  operator's terminal decision, post-merge main/global verification, and owner
  closure. Use a follow-up bead for any independently scoped defect.
- Commit one cleanup/finalization change and push the episode branch.
- Stop for owner review. Do not merge from the episode.

## Owner final review and landing

The owner reviews the exact final commit, diff, tests, docs, bead state, global
byte-parity evidence, and cutover record. A fresh independent expert review is
optional under the lean protocol and should be used if the owner judges that the
migration risk or evidence warrants it.

Only the operator decides to merge. After that merge is carried out, do not
resume the episode for more work. The owning conversation completes landing from
clean `main` in this order:

1. `git pull --rebase` and verify the expected final commit is present.
2. From the primary `main` checkout, deliberately activate and check the accepted
   generation with `scripts/apply-prime-agent-plugin.sh --user-global` followed
   by `scripts/check-prime-agent-plugin.sh --user-global`.
3. Verify Slice 3 changed no managed plugin or system-prompt bytes from the
   accepted transition. If it did, stop: another restart gate is required.
4. Add the post-merge check and terminal disposition to `prime-claw-h6w.25`, then
   close that bead.
5. Run `bd sync`, commit and push any resulting tracked change if required, run
   `git push`, and verify `git status` is clean and up to date with the remote.
6. Only then call `finalize_spec_episode` for the exact retained future-folder
   location and perform only the operator-approved session/worktree cleanup.

An abandonment or failed merge follows the operator's explicit disposition and
must not be reported as completed work or close the bead as successful.

## Progress and evidence

Update this section during execution; do not rely on chat history.

- [ ] Slice 1 transition commit pushed; tier 0 and complete tier 1 pass.
- [ ] Owner accepted the exact transition commit.
- [ ] Exact ordinary saved session identified and proved before restart.
- [ ] Candidate applied globally; seven-file check passed; rollback recorded.
- [ ] Slice 2 deployment-checkpoint commit pushed.
- [ ] Owner accepted the exact Slice 2 commit and installed-generation evidence.
- [ ] Active work quiesced and one coordinated full restart completed.
- [ ] Resumed owner, episode, and exact ordinary-session UAT passed.
- [ ] Operator accepted cutover and authorized cleanup continuation.
- [ ] Slice 3 cleanup commit pushed; repeated gates and global byte parity pass.
- [ ] Owner final review complete.
- [ ] Operator terminal merge decision carried out.
- [ ] Post-merge main/global check passed and `prime-claw-h6w.25` closed.
- [ ] Beads and Git are synchronized; `main` is clean and up to date.
- [ ] Exact episode bookkeeping finalized; approved cleanup completed.

## Explicit non-goals

- Prime Agent source changes or upstream contribution work.
- A new oversight procedure, owner ledger, mandatory expert model, or fixed
  heartbeat interval.
- Changes to episode promotion, handoff, merge, abandonment, or finalization
  authority.
- New orchestrator or channel behavior.
- Tier-1 container redesign or tier-2 sandbox work.
- Historical artifact rewrites.
- Session deletion, concurrent daemons, or `/reload` as migration shortcuts.
