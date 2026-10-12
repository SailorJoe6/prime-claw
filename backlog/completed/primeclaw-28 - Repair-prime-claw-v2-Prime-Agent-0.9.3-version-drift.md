---
id: PRIMECLAW-28
title: Repair prime-claw-v2 Prime Agent 0.9.3 version drift
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p1
type: bug
ordinal: 100000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why
Leadership decided Prime Claw must remain pinned to Prime Agent v0.9.8 and must not adopt v0.10 until full upstream Orca support exists. The newly approved prime-claw-v2 runtime target currently reports `prime-agent --version` 0.9.3 inside image `prime-claw-brain:0.1.0`, creating existing version drift from the required 0.9.8 pin.

## Evidence
Episode `01a0da00-3403-77ae-930a-919658d7d1f8`; sanitized receipt `docs/derisk/3a-storage-v2-copy-build.md` at commit `e35b0cadecb7835f43645eae8178abc264767f60`; v2 target binding at `70d8e8cd2b1efbd0306be7fb6236f1ff9d91f0f3`.

## Scope
Diagnose build/pin drift entirely within Prime Claw surfaces. Plan the normal apply/check/validate/test correction to v0.9.8. Do not mutate the installed user-global runtime, active sandbox, or completed activation pass without separate operator approval. Do not introduce v0.10 or patch/vendor Prime Agent.

## Legacy notes

2026-10-10 HARD BLOCKER: current public `https://app.primeintellect.ai/prime-agent/install.sh` is Rust `install-rust.sh`. In disposable Docker, `PRIME_AGENT_VERSION=0.9.8` installed a Rust launcher/payload under `/sandbox/.local/...`; no TypeScript `bootstrap.js` exists. Public `npm view prime-agent@0.9.8` returned 404. Prime Claw `bin/prime-claw:2019-2030` requires the TypeScript extension-host bootstrap path. Therefore version text `0.9.8` is not sufficient identity and the mutable vendor installer cannot build the pinned compatible candidate. Candidate is blocked; no active/user-global change. Await authoritative downstream TypeScript `cwd-fix-v0.9.8-r1` artifact/build/checksum contract from Prime Agent Expert. Do not cut over or claim compatibility until exact artifact provenance and plugin loading pass isolated Docker validation.

RESOLUTION (Joe + Prime Agent Expert, 2026-10-10): build the v0.9.8 candidate FROM OUR FORK SOURCE, not any installer. Authoritative tag `cwd-fix-v0.9.8-r1` in `https://github.com/SailorJoe6/prime-agent.git`; tag object 8ca4d5c39b7c738f71b5c86422ea46394c3d0558; peeled commit a1faacd53ac4473a75de1d434afaf50945c2f647; tree 5301c70d9c9d74e474ccaf258fdd3c8de982c52f; package-lock SHA256 3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74. Docker build must verify identities, run npm ci with Node>=22.8, launch via root prime-agent.sh + TSX_TSCONFIG_PATH, explicitly load isolated Prime Claw extension, and gate on build ID/tag+commit+tree rather than version text. Public installer/npm/native artifacts are prohibited for this candidate. No cutover until isolated proof passes.

OWNERSHIP (Joe, 2026-10-10): `prime-claw implementation` is primary owner for Prime Claw code/docs/build/container/runtime/incident/recovery work. This supervising conversation watches upstream threads and reports movement to Joe. `Prime Agent Expert` owns Prime Agent source/downstream fixes/releases/artifact contracts. Route implementation accordingly.
2026-10-10 isolated TypeScript 0.9.8-r1 image candidate PASS, NOT active/cut over. Candidate branch fix/prime-agent-v098-image-candidate now includes image commit abaac7a, P0 guard cherry-pick cabb273, fork-source docs cherry-pick 84e3058, integration safety e8ff40f. Unique image prime-claw-brain:pa098-ts-final-a1faacd53ac4 immutable ID sha256:67a5cfd584344c3a596cc93f9a52a2f895f9480e3591e5d458a7961fbbfd0114. Public fork annotated tag object/commit/tree/lock and exact remote verified; Docker-only no-host-mount network-disabled read-only source/kernel proof, four extension ESM load, default-socket daemon RPC exact build ID and no-model create/cwd/kill/absence, offline REPL value 42. Sanitized install log, npm CycloneDX SBOM (414 components) and evidence in docs/evidence/prime-agent-v098-ts-candidate-20261010.md. Independent reviewer found old recover install/process probes would trigger false converge; integrated remediation now Ready+exact-source+missing socket only, live daemon RPC hello exact; re-review PASS, focused 99 passed, combined full suite 718 passed/86 skipped/75 subtests. No active v2 OpenShell commands, install, credentialed model calls, merge/main promotion, source/index, routed write, user-global action, or cleanup. Bead remains open pending operator merge/cutover and active-v2 recovery gate.
2026-10-10 recovery accepted: pinned TypeScript fork source v0.9.8-r1 image sha256:c98889ce82f12f75aa44a15ea9699d8303ec170856cba2b233c40ecb7c5bf4ce; branch 6dd2ece merged to primary main c3938fe. Exact source/tag/commit/tree/lock, daemon build ID, selected-model AGENT_OK before/after restart and after primary target promotion. Operator-local mode-0600 overlay targets Ready prime-claw-v2r1013. Main host-safe suite 724 passed/65 skipped/75 subtests. Provider-list --output false-negative remains separate prime-claw-zwg.3; direct list has three providers. See docs/evidence/prime-agent-v098-v2-active-acceptance-20261010.md.
Correction: pre-push git pull --rebase linearized the candidate commits; primary main source recovery commit is a4850c0f8d090713acdc5ac909137f78e1d7ab8a, not the historical unpushed merge c3938fe. Final primary evidence commit 82aae26 was pushed; tracked tree and 724-pass test result were unchanged by rebase.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The source of the 0.9.3 drift is proven; builder/config requirements explicitly pin 0.9.8; an isolated candidate image reports exactly 0.9.8 and passes relevant sandbox validation; active-runtime convergence/cutover remains a separately approved operator action with rollback evidence.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Pinned TypeScript v0.9.8-r1 image/source verified and actively routed on preserved-state replacement; full restart/model/PG/security checks passed.
<!-- SECTION:FINAL_SUMMARY:END -->
