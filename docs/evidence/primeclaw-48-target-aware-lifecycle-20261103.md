# PRIMECLAW-48: target-aware task lifecycle candidate

Date: 2026-11-03. Disposable candidate evidence, not live activation, operator merge approval, or terminal lifecycle publication.

## Bound scope and basis

This follows the accepted ownership foundation `82a307079b9a5034303a8705337d3eb337791351` in the same PRIMECLAW-48 Episode. The candidate is the code commit that introduces this document; the native task notes record its exact pushed head after publication.

The three branch/code values remain distinct:

- `baseRef`: the exact code basis (the exact task-only status commit for grandfathered branch-local Backlog).
- `branch`: the isolated Episode branch.
- `integrationBranch`: the current named owning-primary branch captured at fresh admission and retained for integration/publication. An omitted field in old version-2 ownership means `main`; it is never inferred from a later checkout.

Independent Backlog task history and Beads native revision/evidence remain separate from code history. No live ownership was rewritten. Retained version-1 and primary-main user-global activation policies remain unchanged.

## Delivered behavior

- Backlog and Beads admission retain primary-root, top-level persisted-owner, placement, task/plan, unsafe-state and provider/publication checks while capturing the current valid named branch. Branch/code identity is rechecked at existing serialized, publication, reservation and allocation boundaries. No branch switch or default-branch substitution occurs.
- All fresh task reservation paths bind the integration target before resource allocation. Independent Backlog and Beads allocate from their exact published code base. Grandfathered Backlog retains its exact task-only admission commit and existing prompt-push behavior.
- Fresh allocation rejects branch or code drift before resource mutation. Active replay and handoff retain target/base/owner/task/resources while permitting normal advancement on that same integration branch. A switched owning checkout refuses continuation rather than rebinding or reallocating.
- Task-native blocked handling, review guidance and terminal verification use the recorded target. Merged and abandoned code ancestry is checked against that target; Beads also proves its exact configured direct-remote branch. A differently named ordinary upstream ref is supported without confusing it with the Episode branch or provider ref.
- Cleanup still removes only exact idle Episode resources and its own branch/upstream. It refuses a local Episode branch equal to the integration target and an Episode upstream that aliases the target's configured destination/ref. The real-Git disposable regression proves target refs remain present and unchanged.
- The implement-task **entry skill alone** tells the LLM to compare the current branch with the repository's actual default and ask the named stacking question when different. It shows branch/SHA during readiness. LLM noncompliance is explicitly acceptable. No code enforcement, confirmation argument/state/token/receipt, or stacking-compliance test was added.
- Managed readiness/execute/blocked/handoff/expert/oversight/tool descriptions and focused user stories use the same target. Version-1 bridge/restore and separately authorized primary-main global refresh/restart/UAT remain distinct. Existing static guidance expectations were updated to target wording; the guide's existing prose-size allowance changed from 1,800 to 2,000 words for the added target context.

## Focused acceptance evidence

| Contract | Existing disposable evidence extended in this slice |
|---|---|
| Non-main base and isolation | Independent Backlog and Beads real-Git fixtures create a feature commit beyond `main`, publish it, and prove one isolated worktree/session/execute assignment from that exact SHA with the retained target. Grandfathered Backlog accepts published default `master` and retains its exact task-only admission base. |
| Drift and unsafe-state refusal | Detached HEAD, same-SHA branch drift, code drift, linked-worktree/unsafe admission and wrong-target fresh allocation refuse before task/ownership/resource mutation. Existing rollback/Blocked/no-retry cases remain. |
| Continuation identity | Non-main handoff and active allocation replay retain the same owner/task/base/target/resources after same-target advancement; wrong-target handoff/blocked/replay refuse. Beads native evidence advancement preserves the target. |
| Terminal target/publication | Independent Backlog and Beads merged/abandoned fixtures verify target ancestry and separate provider evidence. Wrong target, wrong publication head and wrong ancestry refuse cleanup. Production cleanup preserves non-main local target and its differently named upstream, and rejects an upstream alias collision. |
| Compatibility and policy | Existing ownership/provider-switch, omitted-target `main`, version-1 retained creation/restore/close, local/Orca identity and RPC-loader cases run through the existing bridges. The stacking skill was reviewed as content only. |

## Validation and honest limitations

All candidate plugin execution ran inside Docker. The supported read-only source at `/Users/jlanders/code/prime-agent/.worktrees/cwd-fix-v0.9.8-r1-source` was independently checked before the runs:

- public remote: `https://github.com/SailorJoe6/prime-agent.git`;
- annotated tag object: `8ca4d5c39b7c738f71b5c86422ea46394c3d0558`;
- peeled HEAD: `a1faacd53ac4473a75de1d434afaf50945c2f647`;
- tree: `5301c70d9c9d74e474ccaf258fdd3c8de982c52f`;
- lockfile SHA-256: `3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74`;
- source checkout clean. No source modification or host dependency installation occurred.

Use `TIER1_ENV_FILE=.test-results/primeclaw-48-binding-slice1/source.env` with the following commands from this worktree:

| Command | Actual outcome |
|---|---|
| `python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_extension.py::test_task_episode_ownership_node_suite tests/test_reviewed_plan_extension.py::test_spec_episode_node_suite tests/test_reviewed_plan_extension.py::test_episode_close_node_suite tests/test_reviewed_plan_extension.py::test_reviewed_plan_node_suite tests/test_reviewed_plan_extension.py::test_prime_agent_rpc_loads_tools_without_custom_commands_and_preserves_native_skill_discovery -q -m container` | **9 passed, 3 deselected in 355.97s**. Manifest `.test-results/20261103T191049Z-84683-1e0cceaf/tier1/manifest.json`. Offline runtime and clean teardown verified. |
| `scripts/test-tier1.sh --probe` (final frozen source) | **Passed (exit 0) in 128.65s**: offline apply/check plus RPC probe; network absent and teardown verified. Manifest `.test-results/20261103T191651Z-15619-8a9010c8/tier1/manifest.json`. |
| `python3 -m pytest tests/test_oversee_episode_skill.py tests/test_blocked_skill.py::test_blocked_skill_supports_disjoint_task_and_retained_folder_authority -q` | **10 passed in 0.17s**. Content/policy checks only; not a test of LLM stacking compliance. |
| `python3 -m pytest tests/test_task_providers.py tests/test_reviewed_plan_extension.py -q` | **NOT GREEN: 1 failed, 11 passed, 10 skipped**. Unchanged `test_repository_status_cutover_uses_task_native_order_without_to_do` reads absent `backlog/config.yml`; independent config is `.backlog/config.yml`. No topology repair or separate baseline execution is claimed. |
| `git diff --check` | Passed before validation; final staged check required before publication. |

The source and test bytes from the corrected green Docker run were retained unchanged through publication; this evidence file is completed afterward. The captured repository inventory includes the earlier draft of this evidence file, not its final prose.

Corrected Docker behavior manifest repository hash: `c2015f443f5e11ac5c08435f0f62f21604c31ef7742a12c9806d2cb44af6d99b`. Runtime image: `sha256:d01b3858c5484a2e9faa811c696a8184002fe0d86bb6dfb96f402b5293da3841`. Final probe repository hash: `c2015f443f5e11ac5c08435f0f62f21604c31ef7742a12c9806d2cb44af6d99b`; runtime image: `sha256:e26b9431b3b9b790e7be71e992e48e7cc98787f47fb79f47787381c04a323cef`. Full logs are under `.test-results/primeclaw-48-target-aware-slice2/`.

Earlier runs are retained rather than hidden:

1. The first probe stopped before plugin validation: its source-builder iidfile named an image Docker could not inspect. `source-build.json` records `builder-failed`, no builder image or launched container, and no final manifest was published. Evidence: `.test-results/20261103T190218Z-55996-85253f6e/tier1/`. Cause of that missing image was not established; concurrency is not asserted as fact. No shared cleanup or infrastructure repair was attempted.
2. The first focused Docker run completed **2 failed, 7 passed, 3 deselected** in 349.78s. The failures were two stale error-text assertions and a fake cleanup runner missing the newly read target-config keys. Three test-only corrections fixed those expectations; no runtime change was made in response. Its manifest `.test-results/20261103T190218Z-55808-0ca778a4/tier1/manifest.json` proves offline runtime and clean teardown.
3. An intermediate serial probe passed in 129.27s, manifest `.test-results/20261103T190834Z-77011-34b82652/tier1/manifest.json`. Two stale admission-tool prose/comment strings were then aligned to the target. The corrected green behavior run and final probe validate those final source bytes.

No host/user-global apply, check or plugin probe, live Episode reproduction, foreign TASK-2 change, lifecycle status transition, provider migration, merge, activation, restart, ownership rewrite or resource cleanup occurred. Installed project/global assets were not refreshed. Full live-generation UAT remains a separate post-acceptance operation.

## Publication and review boundary

Code and independent task content publish separately. The native task remains `In Progress`; acceptance evidence and any checked criteria refer to this review candidate, not production activation or terminal completion. The owning Conversation retains review, product, merge/abandonment, status and cleanup authority. Stop after this one coherent code slice is committed/pushed with native task evidence published and verified.
