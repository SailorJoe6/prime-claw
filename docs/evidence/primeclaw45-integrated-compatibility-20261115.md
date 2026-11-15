# PRIMECLAW-45 integrated compatibility validation

This note records the remaining approved v1.55.3 compatibility work in the same
Episode. It is not activation, owner acceptance, or a live migration receipt.
Accepted v1.53.0 remains authoritative until a separate operator cutover.

## Source and scope

- Exact unmodified Backlog upstream: `0cf4fdbc70020327f4366a29d3f405f83d180301`,
  release `1.55.3`. No Prime Agent or Backlog source patch.
- Existing Episode branch: `JLanders/prime-claw-primeclaw-45-episode-08450108`.
  Original code basis: `f5287c3647245a6a5e6d3baad64d9cecf1dab81b`.
- Accepted bounded source/build/Bun-isolation and migration/archived-draft slices
  remain in history. Ordinary published-main integration at `fd082830832abd31f6194efab7dbf157f5ef0f57`
  incorporated PRIMECLAW-56 mechanics before this remaining work.
- Remaining changes align normative requirements, current docs/user stories,
  repository skills, inert shipped Markdown and tests. Closed imports stay active
  Done. Merged Done stays active through finalization; optional archive follows.
  Archive preserves status, relations and reserved identity. Restore before edit;
  only explicit archived-only delete vacates identity. `completed/` is preserved
  legacy archive input, never a completion destination.
- Native archived-task/active-draft dependency eligibility, complete unwindowed
  JSON identity-set reads, collision refusal, noninteractive initialization and
  the exact archived non-Done abandonment summary remain supported. Archived
  drafts retain exact physical bytes/paths/history and collision protection;
  unavailable native archived-draft views alone do not block migration.
- No new framework/parser/index/allocator/reconciliation/classifier/approval
  store, removed-command shim, reverse migration, lifecycle broadening, activation,
  primary merge, live conversion, resource replacement or destructive Episode
  cleanup. PRIMECLAW-44 evidence remains historical, not current policy.

## Prior proof and its limits

[Source/build evidence](primeclaw45-upstream-candidate-20261106.md) records exact
source/tag, compiled smoke, isolated Backlog Bun1.4.4 versus general/gbrain
Bun1.3.11, Git trust/private loopback proxy and fresh native Nix installCheck
persistence/failed-write proof. Those unchanged surfaces are reused within their
stated limits, not relabeled as new execution or full real-gbrain/OpenShell proof.

[Migration evidence](primeclaw45-migration-lifecycle-slice2-20261106.md) retains
accepted bounded slices, the old CLI-limit observation, and the later explicit
operator archived-draft decision. That resolved decision is not reopened.

Before the capacity interruption, remaining-work evidence under
`.test-results/primeclaw45-integrated-08450108/` includes:

- Representative finalization/cleanup/merged/abandonment Node selection: 148 pass,
  zero fail/skip, 54 top-level cases in inspected image `2749bf9a…`.
- Existing upstream archive/read-only/restore/delete/dependency suites: 155 pass,
  698 assertions, exact source and isolated Bun1.4.4. New native lifecycle/allocation
  changed-seam selection: 3 pass, zero fail/skip. Native worker records all failed
  early fixture expectations before the final passing selection.
- Docker-isolated managed reconciliation: 17 source-matching assets, zero
  conflicts, plus a separate customized-baseline preservation fixture. The initial
  diagnostic wrongly expected zero conflicts despite known customizations and
  remains failed evidence. The actual unrelated customized bytes were preserved.
- Managed execute metadata changes only installed/available-upstream digests;
  historical baseline `cc0453ff3aad661c78e550997fd9ea6359fa7f76b1b87d552c69dfb5d9c52a6c`
  and other `.prime-claw/templates.json` bytes remain unchanged.

## Failed and resumed full runs

The first full integrated Tier1 run, `20261112T160357Z-17549-d060d5ce`, failed
with ENOSPC and no trustworthy terminal manifest/teardown. Later EROFS/transport
errors in that run are resource-contaminated, not product diagnoses. Raw logs,
identity and hashes remain in its run directory and
`.test-results/primeclaw45-integrated-08450108/blocked-validation-receipt.json`.

The operator restored capacity. Fresh resume inspection on November15 showed
47GiB free and Docker29.9.3/linux/aarch64. Exact interrupted container
`5650767ad7cc023e716e8a42cc12cd93380817883ea1989663b484679acf04df`
remained exited255, network-empty, with its original image/mounts. It was only
inspected, not restarted, deleted or pruned. Owner comment11 corrects comment10's
provisional absence statement. No old failure/manifest was rewritten.

Fresh artifacts live under `.test-results/primeclaw45-resumed-08450108/`:

1. Complete Tier0 after the first fixture repairs: **736 passed, 140 subtests
   passed, 104 default-tier/environment skips, 13 warnings**, 86.23s. The default
   skips separate Docker/lifecycle environments; they do not prove Tier1.
2. Complete healthy Tier1: **98 passed, 4 failed, 1 inactive outer child-probe
   skip, 737 deselected, 12 warnings**, 2568.92s. Run
   `20261115T065058Z-14737-d879a874`, exact runtime image
   `sha256:e1f56f2241227b463c569c5f8048b7b6d303bbe6c23f8d9f3396ad5ed9302ddd`,
   declared Docker input `940e20e0de02c56394d4e8c80fd718b528e9cfa71512056af6b6a4b4ecb032af`.
   Distinct images with the same declared inputs are not claimed identical.
   Terminal manifest and every evidence hash verified through the supported
   provenance API. Builder/runtime teardown clean and absent; network absent;
   canonical unchanged Prime Agent source `94589ebb002679a028435759ce3bfffdc7ff6127`
   has equal complete checkout inventories before/after.

The healthy failed run proves the repaired layout13/13, history89/89, full
migration65 pass/0fail with12 explicitly retired reverse cases, and its dedicated
forward/admission/source-boundary/status/archive/populated/native lifecycle
wrappers. Wrapper selections overlap; do not sum them as unique tests.

Its four remaining failures were test setup/assertions:

- Two native task-only tests committed sparse config before native normalization.
  Native `ensureConfigMigrated` later added defaultPort/autoOpenBrowser, so exact
  status correctly reported changed config beside preserved unrelated MM work.
  Normalize with supported native config setup before the disposable baseline;
  retain every exact task-only/identity/status/working-byte/index assertion.
- Synthetic two-generation package omitted the compact Python package and install
  bootstrap now required by the shared fixture. Package one minimal editable
  compact marker and honor existing install env for uv/isolated venv, only inside
  the synthetic package. Keep production fixture and actual Prime Agent unchanged.
  Preserve full A/B changed behavior, stale-replay refusal, source inventories,
  release identities and terminal teardown proofs.
- Launcher meta-test expected an unwrapped Prime Agent command. Production uses
  `run-prime-agent-probe.sh` correctly. Assert the exact wrapper and reject the
  unwrapped form; no runtime change.

The lone outer source-generation probe skip means its child contract is inactive
outside the A/B test. The actual A/B nested body is required and failed in that
run; the skip does not satisfy it. Likewise, a prior handoff shorthand named
three inventory/native files inaccurately: the three task CLI bodies moved to
Docker are workflow merge, execute-content and atomic authoring. Global asset and
managed protocol tests update exact inventories and retain their original bodies.

## Required final verification

The focused repaired checks and fresh complete Tier0/Tier1 remain required after
settled edits. Exact commands, logs, JUnit, hashes and native source/runtime/
teardown receipts are retained alongside the resumed run artifacts. Passing
subsets do not replace complete suites; unavailable, skipped or failing required
bodies are not acceptance. Terminal results will be appended below only after
inspection. No final acceptance or code-publication claim is made in this section.

## Focused fixture-repair verification

The combined four-check run retained `fixture-repairs-command.txt`, log and JUnit:
3 passed and 1 failed at final public-summary publication, after both A/B native
installs and every original A/B assertion had passed. The existing sanitizer
correctly refused an absolute uv interpreter path. The one-line repair records
only `Path(sys.executable).name`; sanitizer and proof assertions remain unchanged.
The targeted `generation-receipt-repair-command.txt` then passed 1/1, zero skips,
34.49s. These runs together prove each of the four repaired checks, not full-suite
acceptance. All earlier failed logs remain unchanged.

The successful synthetic summary is
`.test-results/20261115T074437Z-24765-3a6ceced/source-generations/two-generation-summary.json`.
Its child runs are `20261115T074439Z-24795-2c865b04` and
`20261115T074455Z-25942-85aa6775`. A reports `A|none`; B reports `B|extra-B`;
source, release inventory, artifact and installed-executable digests differ;
full source inventories remain equal before/after each run. Both native manifests
are passed with absent/clean builder/runtime teardown and absent network. Full
source-selected Tier1 must execute that A/B body again in the final run.

The coherent local candidate may be committed to preserve its exact pending
bytes before ordinary published-main integration. This intermediate local commit
is not a pushed or fully validated delivery. Final complete suites run after
integration and settled edits; their inspected terminal receipts follow below.

## Complete-run coverage correction and required initialization proof

After ordinary conflict-free integration of published main
`5ab4eb6e8a3c718fd850c73501e765f37b08639d`, the local tested basis was
`fd5e8e99c407776a58145e443a77b5ef745bc963`. Complete Tier0 passed736 tests and
140 subtests,104 expected tier/environment skips,13 warnings,84.23s. Complete
source Tier1 returned102 passed,1 inactive outer child-probe skip,737 deselected,
12 warnings,2545.03s. Artifacts/commands/JUnit/hashes are under
`.test-results/primeclaw45-final-08450108/`.

That Tier1 runner passed, but required coverage was incomplete. Its initializer
TAP case71, `production initialization prepares and reuses an independent
published .backlog workspace`, skipped because it looked only for a repository
`deps/backlog/dist/backlog` binary absent in the Docker snapshot. The managed
binary is available on native PATH; the adjacent native initialization case used
that fallback and passed. Any earlier checkpoint shorthand calling the
initializer's single skip retired reverse migration was wrong. Only the twelve
explicitly named migration reverse cases are retired. The old manifests/logs stay
unchanged; `tier1-coverage-incomplete-receipt.json` records this qualification.

The bounded test-only repair uses the existing dist-or-native-PATH lookup and
requires the binary instead of skipping. All original initialization, direct
remote publication, reuse, unchanged code HEAD and no-gitlink assertions remain.
No production or upstream source changed. Focused required initialization now
passes **88/88, zero skipped**, through the existing Docker driver. Raw command,
log, JUnit and `focused-terminal-verification.txt` are under
`.test-results/primeclaw45-final-native-init-08450108/`; run
`20261115T083104Z-1758-f4b836bc`. Native manifest and every evidence hash verify;
source inventories equal, network absent, builder/runtime clean and absent.

The earlier complete runner's required synthetic A/B body did execute and pass:
summary `.test-results/20261115T075611Z-32660-1ab564d9/source-generations/two-generation-summary.json`,
children `20261115T075613Z-71262-74c01139` and
`20261115T075631Z-72452-a2ea4359`. Both manifests/hashes/source inventories/
network/teardown verified. It does not waive another required body.

Fresh complete Tier0/Tier1 after the final initialization fixture edit remain
required. The next subsection records their terminal results only after native
coverage and artifact verification. The preceding partial-coverage success is
not acceptance, activation, or a reason to publish an incomplete candidate.
