---
id: PRIMECLAW-29
title: 'Incident: active prime-claw-v2 sandbox exited 255'
status: Done
assignee:
  - Joe Landers
created_date: '2026-10-12 01:01'
labels: []
dependencies: []
priority: p0
type: bug
ordinal: 101000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Incident
The active `prime-claw-v2` OpenShell sandbox `f38cb82b-140d-4cc0-b1b0-a4a6871c82aa` entered `Error`. Docker container `576a0158e98f7770e4a55e46edcd8cc6a740b152a40ffea398b00e725b3be6a4` exited 255 at 2026-10-10T18:38:28Z with `OOMKilled=false`. Cause is unknown. The prior v1 runtime remains Error/exited143 unchanged.

## Non-causal concurrent work
An isolated v0.9.8 candidate image build used only new tag `prime-claw-brain:pa098-5dfecec826a6` and an isolated worktree. It performed no create, converge, restart, cutover, or direct v2 action. Timed Docker events returned no records.

## Safety boundary
Preserve evidence. Perform read-only root-cause investigation first. Do not restart, converge, recreate, destroy, remove, prune, or otherwise mutate either runtime/container without explicit operator authorization and a recovery plan. Do not infer the candidate build caused the outage without evidence.

## Legacy notes

2026-10-10 candidate-builder evidence: v2 container 576a... exited 255/no OOM at 18:38:28.594Z. Isolated candidate build did not start until 19:06:35.743Z and completed ~19:07:34.622Z, ~28 minutes after outage. Unique candidate image `prime-claw-brain:pa098-5dfecec826a6` sha256:b2de8a9d... created 19:07:22Z with required-version=0.9.8; existing v2 image/tag retains sha256:0f705bb6.... Candidate-only smoke container 49e92c... started ~19:09:08 with 2 CPU/2GiB, no host mounts/credentials, and exited 127 due launcher PATH; now absent. No OpenShell create/converge, active runtime start/stop/rebuild, global action, or v2 mutation. Shared Docker daemon/cache/network only; no pressure metrics captured. Only v2/v1 operations were read-only inspect/list. Direct candidate causation ruled out temporally; incident cause remains unknown.

2026-10-10 runtime-owner correlation: six containers share effectively identical exit timestamp 18:38:28.5948Z (mostly exit255). Docker Desktop build server stopped 18:37:51Z; backend/VM launched 18:38:17–18Z. No known investigation/candidate command restarted Docker; candidate build began 19:06:35Z. Leading common-cause hypothesis is Docker Desktop backend/VM restart rather than Prime Claw process failure. Awaiting operator confirmation of any manual Docker Desktop restart/observed event and final read-only evidence report.

2026-10-10 read-only root-cause report: HIGH confidence common-mode Docker Desktop backend/VM shutdown/relaunch caused v2 and unrelated container exits; restart trigger unknown. Build server stopped 18:37:51.769Z; old backend termination observed 18:37:55.488Z; new backend 18:38:17.226Z; VM 18:38:18.466Z; five containers (v2 + four unrelated helpers) recorded exit255 at 18:38:28.5948xxZ, with VM error-unmount records and dockerd ping timeouts during startup. Exit255/synthesized timestamp do not prove a POSIX signal or exact guest death time. v2: phase Error rev1/resourceVersion974, Docker exited PID0/255/no OOM/no State.Error/restart policy no; no container log lines 18:30-18:50Z and no historical Docker events (absence not proof). Selected logs show no contemporaneous OOM/panic/thermal kill. Post-event load/swap high but non-causal. Persistent volume `pc-v2-20261010-state` and expected pgdata/brain/home-root mount metadata remain; payload/WAL integrity unverified because no mount/start/exec/fsck/PG recovery was authorized. Ranked: HIGH Docker Desktop restart common cause; POSSIBLE unproven resource pressure contribution; LOW v2-only crash/direct stop; UNKNOWN volume integrity. Raw host logs may contain private configuration and must not be published. Await Joe confirmation of manual Docker Desktop restart and explicit recovery authority.

ROOT CAUSE CONFIRMED BY OPERATOR (2026-10-10): host disk space was exhausted, Docker runtime froze, Joe cleaned disk space and manually restarted Docker Desktop around 11:37–11:38 PDT. This explains the common-mode backend/VM lifecycle and simultaneous container exits. Not a Prime Claw application crash and not caused by the later candidate build. Recovery and persistence integrity validation remain unperformed and require separate explicit approval.

2026-10-10 prepared-only recovery review: documented `openshell sandbox start` supports Stopped, but v2 is Error; prior Error start/stop was rejected. No supported, preservation-proven same-v2 Error->Stopped/Ready transition is currently known. Existing `bin/prime-claw recover` calls broad converge; converge can reconcile/build/providers/policy, restart Prime Agent daemon, fetch brain, stage PG and sync index. `validate` writes probe facts, uses credentials/model/RPC. These are too broad for minimal recovery and are not authorized. `docker start`, delete/recreate, forced rebuild and helper cleanup are prohibited. Gate 0 read-only can recheck disk, Docker, exact sandbox/container/volume/mount identities and v1 unchanged, but must stop unless operator selects a supported Error remedy. Conditional later steps (same-instance start, root links, PG WAL replay, brain checks, daemon) each require separate gates; PG start is irreversible without snapshot. No recovery or integrity command executed.

OWNERSHIP (Joe, 2026-10-10): `prime-claw implementation` is primary owner for Prime Claw code/docs/build/container/runtime/incident/recovery work. This supervising conversation watches upstream threads and reports movement to Joe. `Prime Agent Expert` owns Prime Agent source/downstream fixes/releases/artifact contracts. Route implementation accordingly.
2026-10-10 Joe-confirmed root cause: host disk-space exhaustion froze Docker; Joe freed disk and manually restarted Docker Desktop. Read-only Episode evidence: build-service shutdown 18:37:51Z, backend exit 18:37:55Z, new backend/VM 18:38:17-18Z, FIVE synchronized container exit255 states at ~18:38:28Z; v2 OpenShell Error, Docker exit255/no OOM. No PG/WAL/brain integrity or process signal proven. Preserved exact v2 ID/container, original 3 writable pc-v2-20261010-state subpaths and v1 stopped fallback; NO recovery or integrity probe executed. Standard openshell sandbox start supports Stopped only; Error start/stop failed previously on v1. Existing recover/converge/validate are broad/mutating, not safe minimal recovery. As primary Prime Claw/container owner, sent Joe executive brief through supervising conversation requesting first decision: authorize read-only Gate0 metadata/disk/mount recheck and supported preservation-proven Error->Stopped/Ready path research ONLY, no lifecycle or PG writes. A second explicit recovery execution approval would follow a proven path; STOP if no supported Error remedy. Candidate version work is isolated; lph/4lg distinct.
2026-10-10 non-mutating code guard candidate prepared in isolated worktree /Users/jlanders/code/prime-claw-recover-failclosed-guard, branch fix/recover-nonready-failclosed, pushed commit 8a76017e9707cb7df0e951589cf3fc10e6fa54df. It blocks bin/prime-claw recover before sandbox exec/restart/recreate/converge when sandbox phase Error/Stopped/unknown or sandbox get cannot prove existence; forced signatures cannot bypass. Dry-run returns nonzero/no false safety verdict. 103 host-safe tests passed; no active actions, not merged. Auto absent-sandbox vpn-flap/gateway-flip recovery remains disabled until verified absence design; standalone converge/create are unchanged. Joe recovery Gate0 approval pending; no PG/WAL/volume lifecycle writes. Cross-branch note: source-pin candidate replaces old /sandbox/.npm-global binary path; reconcile that detection path before any combined merge.
2026-10-10 isolated P0 fail-closed guard 8a76017 cherry-picked as cabb273 into candidate branch; independent review flagged and accepted fixes for two legacy detector assumptions in e8ff40f. Recovery on candidate code now rejects non-Ready/get errors/unknown source and unsupported forced signatures before mutation; for Ready exact source only an absent socket is auto cold-daemon; present socket must return exact pinned TS DaemonClient hello build/version. Offline Docker default-socket hello PASS, focused 99 tests PASS, combined 718 PASS; docs/runbook updated. This code is not merged/main/active. v2 Error resources retained; Gate0 read-only incident review and all recovery writes still require separate Joe approval.
2026-10-10 approved preservation-first recovery accepted: host disk exhaustion/Docker Desktop restart preceded Error; installed OpenShell 0.0.116 could not resume original v2 Error instance. Original v2 container/volume, matching SHA-256 checkpoint (47,639 files, 1,339,262,898 regular bytes), and v1 fallback retained. Fresh checkpoint-derived v2r1013 Ready on pinned TypeScript v0.9.8-r1. PG16 counts/dimensions, Git fsck, source/daemon identity, synthetic OAuth projection, egress policy, model AGENT_OK, clean PG restart and full same-container stop/start all passed. Primary ignored overlay points exact replacement. Only known provider status --output false-negative is separately prime-claw-zwg.3. See docs/evidence/prime-agent-v098-v2-active-acceptance-20261010.md; no sync/index/routed writes or cleanup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Read-only evidence identifies or bounds the failure cause; logs/state/timestamps and concurrent host activity are preserved; recovery options and risks are presented to the operator; no mutation occurs before explicit approval; after approved recovery, sandbox health, persistence, version, and security invariants are revalidated.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preservation-first replacement recovered the active runtime; retained original/checkpoint/v1 and verified full restart, data, pinned version, policy, synthetic credentials, and model.
<!-- SECTION:FINAL_SUMMARY:END -->
