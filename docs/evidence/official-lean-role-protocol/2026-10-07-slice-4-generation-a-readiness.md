# Generation A bridge readiness and rollback evidence

Date: 2026-10-07
Scope: Slice 4 integration and immutable-freeze preparation only. This document
records pre-freeze inputs and isolated proof. It intentionally does not name a
future candidate commit/tree or claim independent review, landing, activation,
restart, UAT, acceptance, compatibility removal, finalization, or cleanup.

## Accepted dependency and main integration

- Slice 3 accepted commit: `6bceeea133f767d72739a8d88df2639ab75bba96`.
- Slice 3 accepted tree: `6421f9acc11a4c5e755e37dfa3060c2821bf5326`.
- Fetched `origin/main`: `c24ba6c1e76585193d4f34f0b0b0233846780442`.
- Normal integration merge: `46147ff887569101b7e64a8466cde5887c15cc31`, tree `12150bc9fef7b62248f60c000c79f71496d8ea18`.
- Parent order: first `6bceeea133f767d72739a8d88df2639ab75bba96` (accepted episode history), second
  `c24ba6c1e76585193d4f34f0b0b0233846780442` (exact fetched `origin/main`). No rebase occurred.
- The only merge conflicts were the future plan copies already promoted into
  active episode plans; the episode-side deletions were retained.

## Inert external coordinator

`scripts/coordinate-prime-agent-role-cutover.py` is preflight-only unless an
operator supplies `--execute`, the full accepted candidate commit as
`--authorization`, and an input with explicit execution authority. Recording
fakes prove:

- fixed resident client/launcher/process inventory and per-record
  executable/version/build/socket mapping;
- primary-main, clean/local/remote, candidate-tree, fast-forward, bundle, and
  history-preserving revert preflight;
- exact `shutdown --force --json`, zero-process/socket/status gates, fast-forward
  landing/push, apply with a fresh live role receipt, check, second zero-stale
  gate, one daemon start, real Prime Agent 0.9.8 status-array validation, and
  owner -> episode -> ordinary checklist order;
- intent checkpoints before shutdown, landing/push, apply, and start so failure
  never falsely claims the preceding generation still runs or a mutation did not
  begin; and
- no retry after uncertainty, exact-candidate authorization, input/checkpoint
  digest binding, and phase-specific practical recovery.

The coordinator was not executed against live processes, `main`, or user-global
state in this pass. Source SHA256: `1fdc54bd3565468cbee87e52fd0b6ee23f958a01e49ed93dbb52def2c1e0bb8a`.

## Private preactivation bundle

The private mode-0700 bundle is retained outside Git and session-visible reports.
Its canonical manifest SHA256 is
`394602e721d80f8f125d9dca15b51a5aef054e703d3382c1c3f8f5436cf61674`. The manifest records only:

- exact selected `AGENTS.md` and `APPEND_SYSTEM.md` preimages with byte digest,
  size, mode, uid, gid, newline style, and final-newline state;
- their isolated candidate postimages;
- the fixed 11-TypeScript plus five managed-skill candidate inventory, four
  retired/redundant paths, and ownership-manifest surface without traversing
  unrelated agent files;
- priority-ordered selected-file decision, current known-good generation
  `c24ba6c1e76585193d4f34f0b0b0233846780442`, integration topology and rollback
  shape; and
- exact recovery toolset hashes.

The fixed installed-inventory aggregate SHA256 is
`d7723a09148de0c4eda4d3838f8532299c5a368d954188fe670c082ba6100b0f`. The bundle rejects extra files, schema/path drift,
postimage or tool tampering, symlink/non-regular inputs, unsupported selected
names, and likely credential signatures in the two required opaque preimages.
Raw preimages, absolute private locations, and unrelated/private agent data are
not committed here.

Recovery-tool SHA256 values at bundle creation:

- `scripts/coordinate-prime-agent-role-cutover.py`: `1fdc54bd3565468cbee87e52fd0b6ee23f958a01e49ed93dbb52def2c1e0bb8a`
- `scripts/manage-prime-agent-cutover-bundle.py`: `b1f66c7418c97f80be3f478f9eb697f3a936c7f747aa0f9f8d8781b9cca247b8`
- `scripts/apply-prime-agent-plugin.sh`: `ccbf15f16083a1beaa4c5bb58a532b3e255a555251f3f11b2588fff9e4f3fb01`
- `scripts/manage-prime-agent-role-protocol.py`: `1449e83e82a74cd6bddea7074653ab86e2af6d4cfd615c0a452ff70ea71253bd`
- `scripts/check-prime-agent-plugin.sh`: `2354199d2b336efd6acb329ff89661382e50c9024edad57512269beb3516186b`
- `scripts/prime-agent-plugin-target.sh`: `4d8e3fba994910e57231c158d0cdaf41d7c4537b88fc46fb21c5d9c86fda11a9`

## Isolated apply and rollback proof

A scratch explicit plugin root was seeded with only the selected contexts, fixed
managed preactivation inventory, and an unrelated sentinel. Candidate apply/check
used a fresh external destination-bound role receipt whose transaction reached
`applied`. No host-global apply/check or Prime Agent process probe ran.

The proof then:

1. verified the bundle manifest;
2. refused an unknown APPEND third state before changing the other selected file;
3. exported exact known-good source `c24ba6c1e76585193d4f34f0b0b0233846780442`
   and applied it only to the isolated root;
4. restored the fixed installed preimages/absences and ownership-manifest absence
   only from exact known candidate postimages;
5. restored selected-context and APPEND bytes and ordinary metadata;
6. passed the known-good check;
7. proved every fixed surface equal to its captured preactivation state and the
   unrelated sentinel unchanged;
8. replayed both restores with `alreadyRestored: true`; and
9. removed all isolated, drift, and exported-source scratch roots.

Private proof-summary SHA256: `434ecdc8efa8949a1b21bdbaaa8fff9884d1d3e41c1e299c41349311755d7ae1`. All pass/fail
claims above are represented as booleans plus hashed logs in that private
summary; raw private bytes are not reproduced here.

## Generation A bridge inventory

Retained source contains:

- canonical `ROLE_KERNEL.md`, generated TypeScript parity, and bridge
  `role-protocol.json`;
- both managed global skills and all reservation/admission/report/settlement/
  disposition/close/cancel/purge gates;
- legacy `APPEND_SYSTEM.md` and predecessor APPEND manager;
- project compatibility shim `.ralph/skills/oversee-episode/SKILL.md` SHA256
  `f24cda3b6bfa47ed4df5cdff03475bb0e773914cae6b35d66c69560e98e06652` and its `.agents` discovery link;
- standalone profile and managed reviewer, byte-identical at SHA256
  `49e2f48421902721b25751380a2173cd8a44ad1c6c4655e7a9a4a8e583983ce6`; and
- historical oversight/private-identity filtering plus shared provider-channel
  assertions.

Current docs now describe 11 TypeScript files, nine support files, both managed
skills, completed Slice 3 EXPERT lifecycle, the coordinator/bundle contract, and
phase-specific recovery. Central traceability covers exact `ORP-001` through
`ORP-023`; later Gate A/B and compatibility-removal requirements remain pending.

## Pre-freeze validation

Focused host reconciliation passes: **76 passed, 54 skipped** across the
coordinator/bundle, inventory, kernel, managed-guide, EXPERT,
Conversation/EPISODE, plugin-install, and provider suites. Node extension
coverage passes: **76 passed**. Focused Docker-native coverage passes: **3
passed**. The real 0.9.8 provider capture proves exactly one neutral system
kernel, exactly one EXPERT rubric and packet in the one user task, zero
private-state sentinel, and zero provider calls for rejected phases. The same
Docker run proves the supported apply wrapper creates a fresh external
mode-0600 destination-bound role receipt whose transaction is `applied`.

Focused log SHA256 values:

- host: `ada9d4d1af54290b0963305f7c4c699f8cb20a9c6afbb22fd4579c8006c9a08c`;
- Node: `b551b4354723c656fb4a2ed8c14781559f3a51785c75e73359e2a443df734737`;
- Docker-native: `5f3ca41944b6602c30cc64d8c8bb3d2821cf36237a781bd6eb676571d4465928`.

Complete Tier 0, selected Docker Tier 1, the pinned Prime Agent 0.9.8 probe,
diff check, teardown, exact freeze identity, and remote equality are post-document
gates. Their immutable-commit results belong in private receipts and
`prime-claw-h6w.30`, not in a self-referential candidate file.
