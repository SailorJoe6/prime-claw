# Phase 3a Slice 4A — optional home-Qwen embedding override

**Status:** BLOCKED — 4A.1 complete; fresh post-clearance host probe returned HTTP 502; no sandbox probe or restart
**Decision:** D3a-L
**Requirements:** R3a-12, R3a-14
**Evidence:** [`docs/evidence/embedding-preflight-20260916T191526Z.json`](../evidence/embedding-preflight-20260916T191526Z.json)
**Interrupted-build evidence:** [`docs/evidence/embedding-build-interrupted-20260916T234215Z.json`](../evidence/embedding-build-interrupted-20260916T234215Z.json)
**Failed-resume evidence:** [`docs/evidence/embedding-build-service-unavailable-20260918T045000Z.json`](../evidence/embedding-build-service-unavailable-20260918T045000Z.json)

## Requirement revision (2026-09-17)

This Qwen/4096 path is now an explicit operator-local override, not the repository default.
D3a-M/R3a-15 require fresh installs with no preferred config to use Zendesk AI Gateway
`text-embedding-3-large`/1536 embeddings and Kimi K3 inference. This verdict continues to
track Joe's selected local profile and its non-destructive safety contract.

## 4A.1 result — configuration and policy preflight

The runtime now accepts the private embedding base URL only through the ignored operator-local
config overlay or `PRIME_CLAW_EMBEDDING_BASE_URL`. Tracked defaults lock the remaining contract
to `Qwen3-Embedding-8B`, native 4096 dimensions, a 1000-second timeout, literal non-secret
`dummy`, and a candidate database distinct from the legacy database.

`bin/prime-claw embedding-preflight` validates that contract and atomically renders a mode-0600,
Git-ignored candidate policy. Output is sanitized. The candidate policy grants the configured
host/port only to gbrain/Bun and removes those binaries from the corporate AI-gateway route.
The tracked pre-cutover policy is not applied or changed into the candidate, so existing
`converge` behavior remains safe for the canonical 1536 index.

## Acceptance evidence

- Focused offline tests: **14 passed**; full offline suite: **126 passed**.
- Real operator-local preflight: **PASS**; endpoint and host absent from output/evidence.
- Rendered policy: ignored, mode 0600, configured endpoint match, exact two-binary scope.
- Read-only post-preflight database snapshot: 1,059 pages; 3,031 chunks; 3,031 embeddings;
  minimum/maximum vector dimensions both 1536.
- Candidate `gbrain_qwen4096` database count: **0**.
- No network, OpenShell, sandbox, or database call occurs in the preflight implementation.

The two extra pages/chunks above the original Slice 2 count are the existing validation probes;
this objective created no page and performed no write.

## Next

4A.2 must create a separate candidate `GBRAIN_HOME` and Postgres database, export
`GBRAIN_AI_EMBED_TIMEOUT_MS=1000000` (and the query timeout), full-sync with the exact model ID,
gate parity/dimensions/freshness/retrieval/corporate non-use, and only then switch the canonical
config and policy atomically. The legacy database remains untouched for rollback.
## 4A.2a interrupted build — external hardware blocker recovered

The isolated candidate build was started from implementation commit `e92abf4`. The operator
reported that the DGX Spark hosting the embedding model crashed and stopped serving. The build
was stopped rather than waiting on the 1,000-second request timeout. No gbrain process remains.

Preserved candidate state is partial and **not accepted**: 350 `brain` pages, 1,140 chunks,
1,140 embeddings, all currently 4096-dimensional in a `vector(4096)` column, no unsupported
HNSW index, and no source bookmark. The missing bookmark correctly prevents the partial import
from passing the build gate.

The tracked historical policy was restored. A separate read-only fingerprint confirmed the
canonical config, schema, page/chunk/vector/model state, source bookmark, embedding config, and
migration version are unchanged. No canonical cutover occurred and the legacy database remains
intact.

**Recovery update (2026-09-17):** the operator confirms the DGX Spark is alive and ready.
No build has restarted. First rerun the operator-local compatibility/preflight probe for the
exact `Qwen3-Embedding-8B` service; if it passes, resume with
`bin/prime-claw embedding-build`. The isolated candidate database is intentionally preserved
for a safe full-sync resume. Do not drop or mutate the legacy database.

Sanitized machine evidence: [`embedding-build-interrupted-20260916T234215Z.json`](../evidence/embedding-build-interrupted-20260916T234215Z.json).


## 4A.2a resumed build — blocked again by external service

On 2026-09-18 the exact compatibility gate initially passed: an omitted `dimensions` request
returned 4096 values, and explicit 4096/1536 requests returned HTTP 400 as required. Both
sanitized configuration preflights and 35 focused offline tests passed. One isolated build was
resumed from the preserved candidate.

The service then failed during sustained work. The resumed run imported 89 more files before
recording 39 embedding errors and reaching the 12,000-second hard deadline. A fresh host-side
exact-model probe after the safe stop returned HTTP 503. The hard deadline sent SIGTERM, the
command restored the canonical gateway policy, and no gbrain process remained.

The candidate is still partial and unaccepted: 439 pages and 1,459 chunks/embeddings, all current
4096-dimensional rows with zero detected stale/null/mixed vectors, but no source bookmark. The
canonical database/config remain at 1,059 pages, 3,031 1536-dimensional chunks, the original
source bookmark, and `openai:text-embedding-3-large`; no cutover occurred.

The run also exposed a watchdog contract gap: `GBRAIN_SYNC_STALL_ABORT_SECONDS=1200` does not
interrupt upstream gbrain's `--full` `import.files` path. Only the 12,000-second hard deadline
bounded this run. Before another live resume, correct that fail-fast gap and require both host and
in-sandbox exact-model probes to return 200/4096. The external unblock condition is a stable exact
Qwen service. Sanitized evidence is linked above; the private endpoint is absent.


## External service recovery and safe resume gate

The operator traced the external failure to the DGX Spark thermal-control path. Sustained work
correctly crossed the 80°C admission threshold. The first graceful sleep timed out under active
requests; after cooling to about 60°C, containment remained latched as designed, but its retry
passed current healthy state instead of the latched sleep action. After that fix, the slower
resource snapshot retained `thermal_admission_denied` for up to 180 seconds. All immediate probes
inside that window returned `thermal_cooldown`/HTTP 503; a delayed probe returned HTTP 200 with
4096 values.

The external blocker is cleared. Before one live resume, prime-claw is adding its own durable
candidate-DB progress watchdog around upstream `gbrain sync --full`, because the upstream stall
knob does not interrupt `import.files`. Acceptance and cutover remain pending.


## Candidate full-sync watchdog — validated

The operator gave the restart cue after hardening the embedding service. Before any live probe or
resume, prime-claw closed the upstream `import.files` fail-fast gap. Candidate sync now runs in a
`setsid` process group. A candidate-only database watermark tracks page count, chunk count,
non-null embeddings, and `max(embedded_at)` with bounded PostgreSQL calls. A stall sends TERM to
the complete group, checks complete-group liveness, escalates to KILL, and records a parent-visible
sentinel so a leader that exits 0 on TERM still yields exit 124. HUP/INT/TERM also reap the group.

Executable regressions cover a TERM-ignoring descendant, false-success prevention, timer reset on
durable progress, normal completion, and parent-signal cleanup. The focused suite passed 24 tests;
the canonical suite passed 231. Independent review found no remaining high/medium issue. Evidence:
[`embedding-watchdog-20260918T135055Z.json`](../evidence/embedding-watchdog-20260918T135055Z.json).
No live probe, build, acceptance, or cutover was performed by this validation step.


## Safe-resume preflight — pass

After watchdog commit `5891bfe` was pushed, both the host and in-sandbox exact-model probes returned
HTTP 200 with exactly 4096 values while omitting `dimensions`. The ignored candidate policy was
applied only for the sandbox probe and the canonical gateway policy was restored. The final
read-only gate found zero gbrain processes, canonical state unchanged at 1,059 pages / 3,031
1536-dimensional chunks, and the candidate preserved at 439 pages / 1,459 valid 4096-dimensional
chunks without a bookmark. Evidence:
[`embedding-resume-preflight-20260918T135418Z.json`](../evidence/embedding-resume-preflight-20260918T135418Z.json).


## Thermal recovery cycle — operator-stopped safely

The safe-resume probes passed and one isolated build advanced the candidate to 952 pages / 2,863
valid 4096-dimensional chunks. The operator then reported the DGX engine transition remained in
thermal containment rather than reaching a clean recovery. Prime-claw immediately terminated the
candidate sync group and sent no further inference probes. Buffered output revealed one
`upstream_unavailable` failure and gbrain internal retry waits of approximately 71 and 47 seconds;
the prime-claw durable-progress watchdog did not fire.

The build exited 143. Canonical policy/config/database are restored unchanged, zero gbrain
processes remain, the heartbeat is cancelled, and no cutover occurred. Do not probe or restart
until explicit operator clearance. Evidence:
[`embedding-build-thermal-recovery-paused-20260918T141240Z.json`](../evidence/embedding-build-thermal-recovery-paused-20260918T141240Z.json).


## Operator clearance after thermal recovery

Joe explicitly confirmed the DGX service is ready again. No inference traffic occurred while the
slice was blocked. Resume remains gated on fresh bounded host and in-sandbox exact-model 200/4096
probes, canonical policy restoration, and zero preexisting sync processes. Only one isolated build
may resume from the preserved 952-page / 2,863-chunk candidate.


## Post-clearance resume preflight — HTTP 502

After the operator reported the service ready again, the required single bounded host exact-model
probe returned HTTP 502 with zero values. Prime-claw did not retry, did not apply candidate policy,
did not run the sandbox probe, and did not start another build. Both databases remain preserved
and no cutover occurred. Evidence:
[`embedding-resume-preflight-http502-20260918T152548Z.json`](../evidence/embedding-resume-preflight-http502-20260918T152548Z.json).

## 2026-09-25 Slice 1 source-transport checkpoint — still blocked

The later, validated two-file frontmatter repair is local sandbox brain commit
`5dde0012eadf1df7c3e9c83d228e2d0d31f36695`; the local `origin/main`
tracking ref is older and **not a remote receipt**. A fresh bounded sandbox
`git ls-remote` failed with a connection reset. In-sandbox GitHub and the
normally allowed `example.com` canary all returned curl exit 56 / HTTP 000,
while host GitHub HTTPS returned 200 and `zetup vpn status` reported
`not-connected`. This strongly suggests an authorized egress/VPN fault but
does not by itself prove the sole cause. No push, Qwen probe or build, database
mutation, credential access, or credential-boundary change occurred. See
[`phase3a-slice1-transport-20260925.json`](../evidence/phase3a-slice1-transport-20260925.json).

The clone stage has a fail-closed offline repair under test: a failed fetch
must no longer be hidden by `tail`, and local divergence must stop without an
`ff skipped` success or unsafe retry. This is **not** Slice 1 completion. The
operator restored the authorized VPN connection, but a fresh sandbox Git
probe still reset and the allowed canary still returned curl 56 / HTTP 000.
Gateway control plane reports healthy, policy effective, and the OpenShell
service running. Do not assume reconnection alone repaired the sandbox data
path. The owner/operator must arrange safe host/OpenShell egress repair that
preserves both databases and the credential boundary; no sandbox restart,
provider update, or policy change was attempted. Then recheck sandbox egress
and actual remote HEAD, reconcile the local source commit without force,
revalidate both repaired files, and verify the remote receipt before any
candidate build. Do not infer Git or embedding health
from this older snapshot.

A later owner-approved read-only P0 investigation narrowed allowed-canary failure
to `NET:OPEN ALLOWED` then `NET:FAIL` in about 198 ms, with no recorded
`HTTP:GET`; gateway logs lack a per-request reset reason. An overlapping
socket sample saw one brief outbound TCP/443 connection, but cannot attribute
the reset. Noninteractive host packet capture is unavailable and the sandbox
has no packet/trace tooling. Do not guess at a proxy or VPN fix: obtain an
approved metadata-only packet capture or per-request proxy trace first, with
explicit preservation of the unpublished local brain Git repair if any
instrumentation is destructive. See
[`phase3a-slice1-proxy-diagnostic-20260925.json`](../evidence/phase3a-slice1-proxy-diagnostic-20260925.json).

A 2026-09-27 documentation-first check reconstructed the first proven private
brain Git path (`docs/derisk/3a-slice1.md`) and compared it with the effective
OpenShell Git/canary rules. Those rules are present, but a fresh credential-free
sandbox canary still reset after `NET:OPEN ALLOWED` while the host returned 200.
Git-only placeholder or URL setup cannot explain that shared failure; the
upstream reset source remains unknown. See
[`phase3a-slice1-context-investigation-20260927.json`](../evidence/phase3a-slice1-context-investigation-20260927.json).
No brain-source remote receipt exists; do not begin Qwen work.

On 2026-09-27, a VPN-off sandbox remote read and fetch succeeded, but the
local two-file repair and 16 newer remote commits have one overlapping page.
A nonmutating merge preview reported a content conflict. The repair remains
local; no source push or receipt occurred. See the sanitized
[`phase3a-slice1-brain-git-conflict-20260927.json`](../evidence/phase3a-slice1-brain-git-conflict-20260927.json)
and the execution plan's historical owner-review stop checkpoint. This does not
explain the historical allowed Git/L7 reset.

## 2026-09-28 Slice 1 personal brain source-publication candidate

Joe accepted the reviewed, lossless Page A remote / Page B local resolution.
The original sandbox repair remains available under its durable Git ref.
The published descendant `5c47c067e93eb633da8a8dcb28221e23eea7685b`
changes only Page B from the reviewed remote tip; Page A and all other remote
paths stay intact. Both page frontmatters passed the source validator, the
clone was clean, one non-force push succeeded, and an independent remote
read returned this exact SHA. See
[`phase3a-slice1-source-publication-20260928.json`](../evidence/phase3a-slice1-source-publication-20260928.json).
This later receipt supersedes the earlier *pending publication* status above,
not its transport/conflict evidence. The historical Git/L7 reset cause remains
unknown. At this candidate checkpoint, Slice 1 still required independent
owner acceptance before Qwen or Slice 2; no database, embedding, or
routed-write acceptance was claimed.

## 2026-09-28 owner acceptance of Slice 1 source publication

This owner independently verified live brain remote `5c47c067e93eb633da8a8dcb28221e23eea7685b`
and clean pushed project candidate `7265229207706a954e4c2d4c1489129ff0d9b3ec`, including
the approved one-page-only descendant, preserved original repair, and both
native frontmatter checks. A fresh exact-commit EXPERT returned PASS with no
material findings; its complete report is
[`phase3a-slice1-source-publication-expert-pass-7265229-20260928.md`](../evidence/phase3a-slice1-source-publication-expert-pass-7265229-20260928.md)
(pushed report-only checkpoint `ca5c1ca7f6f56edb0eb50317668bba83ec705c5b`).
**Slice 1 safe brain-source publication is accepted on those exact identities.**
No Qwen/4096d index, database cutover, routed write, historical reset cause,
or terminal EPISODE completion is accepted. Slice 2 remains conditional on
its approved private-service clearance and bounded preflight gates.

## 2026-09-28 Slice 2 exact-model preflight — stopped on source movement

After Joe confirmed the private service ready, one host and then one isolated
sandbox `Qwen3-Embedding-8B` request each returned HTTP 200 with 4096 values.
The temporary candidate policy was restored to the exact canonical gateway
policy, and neither index changed. A read-only full-source dry run counted
1,117 eligible files. The ordinary index path's old second-pass
`--skip-failed`/masked-exit behavior was removed in the project candidate and
exercised by offline failure-gate tests; the candidate script now gates
source/page/path coverage and zero unresolved failures before success.

Before live build, remote brain `main` moved from the accepted Slice 1 receipt
`5c47c067e93eb633da8a8dcb28221e23eea7685b` to
`b695658b8271f4541e47b87f62c5b14c19075528` while the sandbox clone
remained clean on the older SHA. This is an exact source-current stop, not a
Qwen failure or a reason to infer the historical Git/L7 reset cause. No
fetch/merge or candidate build was attempted, no canonical/candidate database
was changed, and no cutover or routed write occurred. See
[`phase3a-slice2-preflight-20260928.json`](../evidence/phase3a-slice2-preflight-20260928.json)
and
[`phase3a-slice2-source-movement-20260928.json`](../evidence/phase3a-slice2-source-movement-20260928.json).
Owner-coordinated lossless source reconciliation and fresh gates are required
before one preserved isolated build.

## 2026-09-28 inspection fetch — unexpected origin tracking advance

One owner-authorized source-history inspection passed fresh exact live remote,
clean checkout, preserved original repair ref, no-sync and unchanged policy/DB
gates. A single Git fetch obtained the exact moved commit in an isolated
`refs/inspection/` ref, but Git also advanced `origin/main` to that commit
under the existing wildcard remote fetch mapping. That violated the
no-tracking-update limit. The checked-out HEAD remained clean at the accepted
Slice 1 commit and local `main`/original repair ref remained intact. The
inspection stopped before ancestry, tree/mode/path and source validation. No
ref restoration, source merge/push, candidate build, cutover or routed write
followed. See the sanitized
[`phase3a-slice2-inspection-fetch-boundary-20260928.json`](../evidence/phase3a-slice2-inspection-fetch-boundary-20260928.json).
Further read-only assessment or ref-state repair requires a separate owner
decision; the historical Git/L7 reset cause is still unknown.
