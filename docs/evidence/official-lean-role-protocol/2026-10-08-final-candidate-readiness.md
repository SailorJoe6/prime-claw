# Final candidate pre-freeze readiness and rollback summary

Date: 2026-10-08

This sanitized summary records inputs that exist before the immutable Generation B
freeze. It does **not** claim a future candidate commit/tree, final gate result,
official EXPERT verdict, merge, host activation, Gate B, restart, finalization,
or resource cleanup. Exact post-freeze receipts remain private and are linked
from `prime-claw-h6w.30`.

## Accepted lineage and current integration

- Accepted revised Slice 6: `64bbee26c363c87ef85446da707900439c869620`, tree `d9e9ba451cfcc2426ad200d8e05ed7e086f9abe1`.
- Integrated `origin/main` `7bbaebf959391bc8488fad4751c245f33f4e7f6c`
  without rebasing in merge `41b94b5bad3a4cc6a205ecac7e0527cce78cad3d`. Its parents are the accepted
  Slice 6 commit first and `origin/main` second.
- Focused Docker merge reconciliation: 63 passed, 31 skipped; log SHA256
  `67399ea2201871807b699225f6b8c3e5dea02d658569f8cc5831f4b652e73c60`.
- Focused Docker archive/review compatibility: 48 passed, 31 skipped; log
  SHA256 `bca0160d0630a3e509bf9c279583f0a08eca1c8f6576d7b0cf887ec48c786443`.
- The merge retains main's proportional review guardrails and the accepted
  concise repair-intent guidance. The sole managed reviewer SHA256 is
  `dcd02e81e7e0656a3d7eb89ccfa78bd8b24a8492de012122f82b17b7aec50a05` and managed package SHA256 is
  `99f33740c1d3a32670790deb91cca9073ce7bb4833109588dbd7565cdafeccdf`. The standalone project reviewer profile remains absent.

## Preserved pre-landing reconciliation and plan lifecycle

- `.agents/skills/goals-and-heartbeats/SKILL.md` now exactly matches approved
  source SHA256 `6c9daca98cf818a784334493190f2c4ea17218ffb61e52b52919105178a6aaa1`. Only the authorized no-goal-budget and
  unbounded-token intent differs from the accepted Slice 6 baseline.
- `.beads/interactions.jsonl` preserved all 100 post-main records byte-for-byte,
  then appended the exact six-record, 1,433-byte suffix SHA256
  `3f1935e989dfb08f7635a1ebc53afd2fd42ac5ec368646881350f5e64720a5ac`.
  The resulting 106-record file SHA256 is
  `86f65e44d6a12fc0e06c0c7fc3fabb17d0cf01e3bbbf88df7db6ea6d2e219fe7`.
- The finished active plan set moved together to
  `.ralph/plans/archive/official-lean-compatibility-cleanup/`; archived
  specification SHA256 `305f8b69fc881fa25fdcabdeace4688e13787651270f843799f6f8471d30c012` and execution-plan SHA256
  `33437aa648a0fc6b788db053edc216c543e3cdfa9d16944e978e5dbf21e6a325`. The archive index is current. The Bead remains open;
  archival is not episode finalization.

## Private Generation B rollback readiness

The private artifact root is `/Users/jlanders/.prime/agent/session-artifacts/01a10774-0155-7316-a329-50ee5f7d17be/20261008T065529Z-generation-b-preactivation/revision-2`. It is not committed.

- Live bridge baseline equals accepted bridge
  `f2e98e2d6e8bc51e9172b8b697735215917b6513` for all 16 managed files.
  Selected-context, APPEND, ownership/mode metadata, role receipt, installed
  inventory, and standalone-profile absence are recorded by bridge proof SHA256
  `a919c3a5d82bee3be203a85fbbb21a6da4f754aa1e60be25bde6a16e516777c3`.
- Isolated final apply/check passed without host-global mutation. Apply log
  SHA256 `183d04aa3930bded936b0fc73129973e2c42adef9153bc86a5d81291c46ebea8`; check log SHA256 `6b10723ca89a1a700c2480466a7d9b9ffbf2880ea8ffc867266298df5dde5053`.
- Generation B preactivation bundle manifest SHA256 `e1d5958f3833a9856c272691961b158973924783ab1122cbe0b511d51b00892a` contains
  bridge context/APPEND/installed preimages, final postimages, sanitized source
  topology, current restore-manager/tool hashes, and the privately retained
  legacy APPEND restore tool SHA256
  `b89d99c61fe4ebd86f4297a40539c9b4fc9de490ab6ba5bec3116dd6c67ec94d`.
- Isolated final-to-bridge restoration is metadata-exact across all 23 checked
  context/inventory entries, preserves the unrelated sentinel, and refuses an
  unknown destination without mutation. Proof SHA256 `841c3930d39ca4ea4cd437adbd1bdca3a13a9c3d3cf6773017508c627afa5881`.
- The source rollback shape reverts the future candidate, then merge
  `41b94b5bad3a4cc6a205ecac7e0527cce78cad3d` with mainline 1, then `64bbee26c363c87ef85446da707900439c869620`,
  `0e96838d430049980fa9ab2f6f8fc2762f2c127c`, and
  `98ed8d14e028622d07a120fbd4af730bd4171e38`, targeting the exact bridge tree.
  The exact commit-based proof is intentionally produced only after freeze.

## Foreign-consumer and scope audit

Git exposes primary `main`, this episode, phase3a, and project-wide-testing
worktrees. Both foreign episode worktrees are clean. Primary-main conversations
are idle on the verified accepted bridge installation; no active foreign episode
session or stale compatibility consumer was observed. The private sanitized audit
SHA256 is `f86e05145c1509a29ca0c18367a29756f2a63b9435def6e4271789e6edd2e3b3`. The primary checkout's retained future-plan
folder is expected owner state and was not modified.

The remaining authorized work is only immutable freeze, exact complete Tier 0,
selected Docker Tier 1, pinned Prime Agent 0.9.8 probe, focused retained-behavior
checks, exact source rollback proof, official bridge-owner EXPERT review, and
candidate reporting. No host apply or later lifecycle step is authorized.
