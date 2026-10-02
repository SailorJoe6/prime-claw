# Phase 3a Slice 2 — source-current method review: owner BLOCK

Date: 2026-10-02. This decision concerns **proof admission only**, not the already accepted repair publication. The repaired pages remain published. Source-current, sync/index/build, cutover and routed write remain **BLOCKED**.

## Evidence and review boundary

- Independent read-only method review: **BLOCK**, complete UTF-8 report SHA-256 `870bc53ad91a1eff5b74d35200dd8fd675866af7f929d4c004fc1de7f95f1f49`. The reviewer verified the original proposed method SHA-256 `a8216bde8de0a01d6663df9288fca624f36f59c15ba1428c9579993f29023e20` and both read-only receipts, inspected gbrain 0.50.0.0 source, merged project test tooling, and the blocked episode plan/spec. The complete report was reconstructed from the exact reviewer session log after delivery exceeded the message limit; it is retained privately, not copied into tracked evidence. No review result was inferred from a partial message.
- Clean/pushed episode checkpoint: `c26ed924bbdec398950367a7c8db8ee49ed69bbb`. Project remote `main`: `27da6a5df6a944a9a10789c73c3d5a50e24c16a5`; the commit after the plugin-test-container merge `1442abb1a9cd5968aad5c101c922425942448517` changed only Beads bookkeeping. Latest observed brain remote `main`: `6ccd9dfb918ade34b870de72e5b25a0f998389c1`. The registered source remains on an older clean checkout; this is not source-current acceptance.
- The original proposal's `tier1_no_Postgres=false` was a mistaken case-sensitive phrase check, not an architecture finding. Verified merged `docker/test.Dockerfile` excludes Postgres/gbrain/OpenShell; `docker/runtime.Dockerfile` still derives from the OpenShell base, and shared-base extraction was deferred. Immutable private correction SHA-256 `7c579a87fd88f690fd19e25ad26e33e9dd8cc3b68959bf9b88f83ed53f0deb38`; the proposal and review hashes remain unchanged.

## Owner decision

I accept the review's **B1–B3 blockers for admitting a proof run**. I authorize only read-only revision of a bounded proof plan. I do **not** authorize creating a fixture, running a live dry-run, switching a registered source, changing either database, indexing, building, merging, or resuming the episode.

1. **B1 — fixture scope and isolation.** The merged slim test container safely hosts plugin tests, but has no gbrain/Postgres integration fixture. A standalone disposable full-runtime-image container is a plausible narrower option, not yet specified or approved. Ordinary runtime create/converge and shared image/config defaults must not be used as fixture constructors.
2. **B2 — exact executable and effects.** Version equality cannot bind the installed executable. A production `gbrain sync --dry-run` can enter DB locks and migrations and is not no-write proof. Any fixture plan must pin the executable/invocation and audit allowed disposable lock writes, without testing in the live runtime.
3. **B3 — complete source eligibility.** Zero repaired-path overlap and zero frontmatter errors do not prove every intended path and slug is selected. The next plan must define exact whole-tree byte/mode, Git/non-Git validation coverage, exclusions, path/slug set, and separate indexed-data diagnostics; it must preserve all later remote work.

A later `sources set-path` pointer operation is a separate approval gate. It needs both-DB snapshots, a maintained writer freeze, provenance and ownership checks, a two-step rollback state table, and explicit failure stops. Pointer reversal cannot undo sync/import/write-through.

## Next decision

Recommend first reviewing a **one-off, credential-free, network-isolated plain-Docker integration fixture** based on a pinned full-runtime image, with fixture-only Postgres and source data. This would test gbrain/Postgres behavior, not OpenShell enforcement. It needs Joe's separate scope/proof decision before creation. A full OpenShell fixture is a larger alternative; deferral keeps every downstream gate blocked. No option is treated as approved by this report.
