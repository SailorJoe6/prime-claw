---
id: PRIMECLAW-20.9
title: >-
  Incident: source host tests may have contacted OpenShell and GitHub-provider
  stages
status: In Design
assignee: []
created_date: '2026-10-12 01:01'
updated_date: '2026-10-14 14:45'
labels:
  - credentials
  - incident
  - openshell
  - p0
  - test-isolation
  - testing-strategy
dependencies: []
references:
  - PRIMECLAW-20.7
parent_task_id: PRIMECLAW-20
priority: p0
type: bug
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
# Incident: pre-fix source tests may have contacted configured OpenShell and GitHub-provider stages

## Summary

During Slice 6 source validation on 2026-10-06, exact-candidate preparation exposed pre-existing gaps in `tests/test_runtime_converge.py`: orchestration-order tests did not stub `stage_brain_query` and `stage_github_provider`. An earlier source/plain host run therefore likely fell through to configured runtime stages. The brain-query stage may have installed or overwritten the existing helper/guidance in the configured prime-claw sandbox. The GitHub-provider stage may have interacted with provider state and obtains a host token with `gh auth token` before its first OpenShell call.

No Slice 6 lifecycle adapter was involved. No live lifecycle occupant ran. Once identified, the Episode stopped all live inspection/action, added both missing stubs and ordering assertions, and used blocking OpenShell/Docker/gh sentinels. The repaired module passed 29 tests with zero OpenShell-sentinel calls; a fresh owner-focused repair check passed 4 with zero OpenShell/Docker/gh sentinel calls. Exact clean candidate `fda41dcadbac15b2c957c866d9e22eafb5f6afca` test-all also recorded zero OpenShell-sentinel calls.

## Steps to Reproduce

Do not reproduce the historical live contact. The historical trigger was a source/plain run of the pre-fix `tests/test_runtime_converge.py` orchestration-order paths while configured host OpenShell/provider state was available; missing `stage_brain_query` and `stage_github_provider` stubs allowed fallthrough. Reproduce only the fixed guard with temporary HOME and blocking `OPENSHELL_BIN`, Docker, and `gh` sentinels, then run the four repaired ordering/dry-run/failure tests and assert all sentinels record zero calls. The owner review recorded 4 passed and zero calls.

## Known facts

- Affected accepted candidate: Slice 6 commit `fda41dcadbac15b2c957c866d9e22eafb5f6afca`, tree `a5e1245c29022092b5684be99c7220d0b6fc7d9a`.
- Root cause: incomplete stage stubs in pre-existing runtime-converge tests.
- Repair: both stage calls are stubbed and their ordering is asserted; exact acceptance is isolated.
- Candidate owner review: `/Users/jlanders/.prime/agent/session-artifacts/01a0fe2e-e0dd-7638-9b4c-0b118182c6e3/sub-8388dae4/slice6-fda41dc-practical-owner-review.md`, SHA256 `2aaae868e7b6403820af48464629ef9ae3f2df3c7eb306642be1d60718277785`, PASS with this follow-up required.
- Historical runtime impact is unknown. Current sandbox/provider state has not been inspected.
- Historical credential access cannot be ruled out: `stage_github_provider` calls `gh auth token` before its first OpenShell call. No credential material was read, printed, copied, or stored by the Episode or owner review.

## Safety boundary

This incident does not authorize live inspection, recovery, provider calls, token access, sandbox mutation, or credential retrieval. Any such work requires a separate explicit operator decision. Never use macOS Keychain or browser credential stores. Never print, copy, or persist credential material.

## Required disposition

Keep this incident open independently of Slice 6 acceptance. The fixed exact candidate may advance because no remaining candidate blocker was found, but this incident must not be closed as “no impact” based only on passing sentinels after the repair.

## Legacy design

Treat this as a historical test-isolation/control-plane incident, not a Slice-6 lifecycle-candidate defect. Preserve the fixed exact candidate and its zero-sentinel-call regressions. Separate candidate acceptance from operational impact assessment. Default to no live inspection or mutation. If the operator authorizes an investigation, use careful, read-only-first, narrowly scoped supported interfaces; never obtain credentials from macOS Keychain/browser stores, never expose token material, and recover only positively identified owned effects.

## Legacy notes

Created from mandatory disposition in the Slice-6 owner PASS review. No live inspection, recovery, provider call, token access, sandbox mutation, or credential retrieval is authorized by this issue. Incident body SHA256 6c063634236d02abb54b4fcc92070bf5edaecbe4265a9334e2b6cad496bfd28a.
OPERATOR DECISION — 2026-10-06. Defer incident inspection and recovery for later follow-up; keep this P0 open. Finish the approved project-wide testing specification now. This authorizes the ordered Slice7 guarded real lifecycle acceptance only within PRIMECLAW-20.6: isolated generated test identities, read-only configured-production snapshot/observer, exact-owned test cleanup, and proof that configured production state is unchanged. It does NOT authorize incident-specific inspection, recovery, provider remediation, credential investigation, token retrieval, or cleanup of suspected historical effects. Revisit this incident after the specification is complete unless the remaining work discovers a new immediate safety blocker.
RECURRENCE DURING OFFICIAL EXPERT PREREQUISITE VALIDATION — 2026-10-07

A manually composed `python3 -m pytest -q -m "not container" tests` command incorrectly selected sandbox-marked `tests/test_runtime_converge.py` cases. The two known incomplete-stub paths reached `stage_brain_query` and returned `sandbox prime-claw is not ready (phase: Error)`. No candidate production path caused this. The run was stopped at its terminal failure; no live inspection, recovery, credential access, or sandbox mutation was attempted afterward. This confirms the existing incident remains open. Correct Tier 0 is the repository-maintained plain `python3 -m pytest tests/ -q`, whose conftest policy skips container and sandbox tiers unless explicitly selected.
2026-10-09 exact Phase3a episode offline test-boundary failure (NO claim of sandbox mutation): command PYTHONDONTWRITEBYTECODE=1 python3 -m pytest -q -p no:cacheprovider tests/test_portable_provider_defaults.py tests/test_runtime_converge.py tests/test_runtime_validate.py returned 66 passed/2 failed/3 warnings. Existing runtime_converge::test_create_runs_stages_in_order and ::test_converge_runs_all_stages_no_recreate did not stub stage_brain_query; test invoked real OpenShell and received sandbox prime-claw not ready (phase: Error) for brain-query. Stopped broader selection; no repeat, sandbox status/probe, credential, DB or state repair. Subsequent verification restricted to tests/test_portable_provider_defaults.py whose external boundaries are stubbed/short-circuited. Owner notified. Investigate/stub these host tests only under separately accepted incident scope before running that selection again.
2026-10-09 owner-approved TEST-ONLY isolation candidate for exact episode 01a0da00-3403-77ae-930a-919658d7d1f8: restored ONLY stage_brain_query stubs and order assertions in the two create/converge tests/test_runtime_converge.py paths, matching known main fe7023f repair; product guard 3ddf68b unchanged. Self-checked PATH shims for openshell/docker/gh and patched subprocess.Popen/os.system/os.popen blocked external processes; exact two order tests + isolated portable-profile file 33 passed/2 importlib warnings with ZERO external subprocess attempts DURING pytest. Earlier unsafe 66 pass/2 fail host selection NOT replayed; unknown real effects remain UNKNOWN, sandbox/provider/credentials not probed. docs/derisk/3a-slice4a.md records exact command; incident PRIMECLAW-20.9 remains OPEN pending owner impact disposition; .5/parent/.4 remain BLOCKED for live work. One test-only pushed candidate pending owner exact-branch review, NOT accepted slice or live proof.
2026-10-09 handoff of owner-bounded INCIDENT recovery, main 02c2263 / episode d3eecee49983c6fbdb4989f0f647eecb7e9a91df, OPEN incident PRIMECLAW-20.9 comment 01a11eb7-ed9c-7dda-af31-c2e17fef4243. Exact matching container stopped since 2026-10-06T14:06:17Z exit143/no OOM before 2026-10-09 not-ready calls; script execution not evidenced, cause/effects UNKNOWN. Next exact Episode: fresh /prepare, verify same identity/stopped state, ONE supported openshell sandbox start -g openshell prime-claw of SAME existing container only; no delete/recreate/converge/retry. On Ready read-only regular-file type/size/mtime/hash ONLY for /sandbox/.prime-claw/bin/brain-query and /sandbox/AGENTS.md, no content/symlink following; compare known source/baseline without inferring unknown history. Only positive incident damage gets minimal supported reversible repair with before/after; otherwise stop/report. Preserve source, credentials/provider isolation, canonical and Qwen DBs. No source registration/sync/index, routed write, re-embed, merge or unrelated live operation. Push concise verified candidate and stop owner review. Source .5, parent, .4 BLOCKED for distinct live gates; incident OPEN.
2026-10-09 exact-episode bounded incident attempt BLOCKED at OpenShell start prerequisite. Fresh read-only preflight: openshell sandbox get -g openshell prime-claw -o json gave default/prime-claw id c9066cee-a64f-4fae-95cd-2a9245b2dc66 phase Error; docker ps -a returned ONE matching name suffix ID, docker inspect only Name/State showed exited, exit143, OOM=false, finished 2026-10-06T14:06:17.633423503Z. ONE owner-authorized openshell sandbox start -g openshell prime-claw exited 1: sandbox must be Stopped to start (current phase: Error). No retry, alternate start, Ready, two-path metadata read, repair, source/index, routed write or other live action. Past test script effects UNKNOWN; do not infer no damage. docs/derisk/3a-slice4a.md + blocked spec/plan record command/result. Unblock: owner explicitly chooses a supported bounded same-container Error-to-start recovery path or stops. Prior authorization does NOT cover phase workaround/delete/recreate/converge. Keep incident OPEN and .5/parent/.4 BLOCKED; push this one failed-start candidate for owner review.
2026-10-09 exact-episode owner-approved stop-then-conditional-start attempt: fresh preflight matched OpenShell default/prime-claw ID c9066cee-a64f-4fae-95cd-2a9245b2dc66 phase Error to ONE same-ID Docker container exited 143/no OOM, finished 2026-10-06T14:06:17.633423503Z. ONE `openshell sandbox stop -g openshell prime-claw` returned exit 1: `sandbox must be Ready to stop (current phase: Error)`. Earlier ONE start required Stopped, so both supported transitions refuse Error. No after-stop status, conditional start, file metadata, repair, retry, alternate command or other live action; workspace preservation and past test effects UNKNOWN. docs/derisk/3a-slice4a.md and blocked plan/spec record result. STOP: owner must separately select supported bounded SAME-container Error-state recovery or halt, not infer authority for Docker start/delete/recreate/converge. Keep incident OPEN and source .5/parent/routed-write .4 BLOCKED.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The incident record preserves the exact pre-fix paths, likely OpenShell/provider actions, possible helper/guidance overwrite, potential host-token access before the first OpenShell call, repair commit, and owner-review evidence.
- [ ] #2 The repaired test paths and future default/test-all paths are covered by blocking OpenShell/Docker/gh sentinels and cannot silently call configured control stages.
- [ ] #3 Live sandbox/provider inspection or recovery occurs only after explicit operator authorization and uses supported interfaces without printing, copying, or storing credentials.
- [ ] #4 If authorized, inspection identifies only the relevant configured prime-claw sandbox/provider state and records privacy-safe evidence; recovery changes only positively owned incident effects with rollback/verification.
- [ ] #5 If the operator declines live inspection, that decision and the accepted residual uncertainty are recorded explicitly.
- [ ] #6 The incident is not closed merely because Slice 6 is accepted; closure requires the operator-approved impact/recovery disposition.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
author: Joe Landers
created: 2026-10-12 01:02
---
Owner exact-branch review 2026-10-09 of pushed Phase3a candidate 3ddf68b8d7ec5baedd652828082dedefa826e4dd: default gateway/1536 blank-profile code and 31 isolated profile tests are bounded/in-scope, but slice NOT accepted because broader host selection failed 66 pass/2 fail after real OpenShell contact. Root cause confirmed read-only: episode tests/test_runtime_converge.py lacks stage_brain_query stubs in create/converge order tests that main already has; stage_github_provider was stubbed in those paths. Sandbox exec returned phase Error, so actual helper/guidance effects remain UNKNOWN; no live inspection authorized. Accept one TEST-ONLY in-scope revision under this existing incident: restore only missing stubs/order assertions and verify with blocking OpenShell/Docker/gh sentinels in isolated tests. No production changes, full unsafe selection replay, live sandbox status/probe, credential access or new proof plan. Keep issue OPEN pending operator-approved impact disposition.
---

author: Joe Landers
created: 2026-10-12 01:02
---
2026-10-09 operator-authorized bounded sandbox investigation/repair for Phase3a: read-only openshell sandbox get -g openshell reports prime-claw phase Error. Docker inspect of the exact matching sandbox ID shows the existing container exited 2026-10-06T14:06:17Z with exit 143, no OOM, and has not started since; the 2026-10-09 unintended stage_brain_query calls returned not-ready, not evidence of code execution inside the stopped container. Immediate Error cause is stopped container; why it stopped is not yet known. Joe explicitly directs investigation and repair if damaged, without repeated permission requests, to finish the spec. Accepted next bounded action for the exact owned Episode: one supported openshell sandbox start of this SAME stopped container only (no delete/recreate/converge), then read-only status and regular-file metadata/hashes for /sandbox/.prime-claw/bin/brain-query and /sandbox/AGENTS.md. Compare to known source/baseline; repair only positively identified incident damage via supported path if needed, preserving data, provider isolation, both DBs and unused Qwen. Stop on uncertain effects/start failure; no credentials, source pointer/index/sync, routed write, or unrelated recovery. Keep incident OPEN until impact is verified.
---

author: Joe Landers
created: 2026-10-12 01:02
---
2026-10-09 owner in-scope recovery revision after exact Episode f81755d: first supported openshell sandbox start -g openshell prime-claw returned sandbox must be Stopped (current phase Error); no container change or file inspection. Joe previously directed investigation and repair if damaged without repeated permission, to finish spec. OpenShell sandbox stop --help documents stopping while preserving workspace. Accept ONE supported stop of the exact same-ID Error sandbox to obtain Stopped phase, verify matching id/container identity and preservation, then ONE supported start of that SAME container. If Ready, read-only type/mtime/hash only for brain-query helper and /sandbox/AGENTS.md; repair only verified damage, preserve evidence and both DBs. Any refusal, identity change, or uncertain effect STOPS, with no direct Docker start, delete/recreate, converge, blind retry, credentials, index/sync or routed write. Incident remains OPEN and live Phase3a gates BLOCKED.
---

author: Joe Landers
created: 2026-10-12 01:02
---
Owner read-only product-constraint finding 2026-10-09: exact pushed Episode 514888407639ec25dc5a46ddbe9c77a14e3d141f verified clean and remote-equal; one supported stop failed phase Error/needs Ready, after earlier one supported start failed phase Error/needs Stopped. Official NVIDIA/OpenShell v0.0.116 source crates/openshell-server/src/compute/mod.rs lines 1081-1092 permits stop only Ready/Stopping and 1236-1243 permits start only Stopped/Starting; proto/openshell.proto exposes no Error recovery/reset RPC. Source explicitly keeps Error terminal in reconciliation (around 3772). Exact Docker container exited Oct6 (143/no OOM) before Oct9 test contact; no 2026-10-09 script execution inside it shown. No supported public same-container Error-to-Ready recovery found. Direct Docker start bypasses gateway phase; delete/recreate risks /sandbox writable data (no /sandbox volume in Docker mounts), so neither is authorized by prior bounded repair. No file checks or repair; preserve both DBs, source and Qwen candidate. Incident OPEN, Phase3a live gates BLOCKED pending operator decision on a preservation-first exceptional recovery or stop.
---

author: Joe Landers
created: 2026-10-12 01:02
---
2026-10-09 storage-recovery cross-reference: Joe accepted disposable one-volume subpath topology in prime-claw-zwg.6 (Episode 2e6a85a; docs/derisk/3a-storage-step1.md). This does not repair Error-state v1 or settle possible test contact/effects. Incident stays OPEN; preserve stopped v1 and use only preservation-first versioned recovery after read-only inventory.
---
<!-- COMMENTS:END -->
