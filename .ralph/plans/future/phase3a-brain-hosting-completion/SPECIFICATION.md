# Specification — Finish the Phase 3a brain-hosting tracer bullet

> **Status:** Operator-approved specification (2026-09-25), ready for separate planning review. Approval does not authorize implementation or create an episode.
> **Tracking:** `prime-claw-zwg`; operator-local embedding prerequisite `prime-claw-zwg.5`; routed write `prime-claw-zwg.4`.
> **History:** `.ralph/plans/archive/phase3a-bufd-superseded-incomplete/` preserves the incomplete, superseded four-document BUFD bundle. It records prior reasoning, not a second active implementation plan.

## Desired outcome

An explicitly configured operator brain lives in the prime-claw OpenShell sandbox. A sandboxed Prime Agent can answer from it with a citation and make one correctly routed, durable brain write that reaches the operator's repository. The completed system remains usable with portable Zendesk AI Gateway defaults and independent operator overrides.

For Joe's selected installation, finish and accept the local `Qwen3-Embedding-8B` embedding profile **before** the routed-write proof. This is Joe's operator-ordered prerequisite, not a requirement that every installation use his hardware or endpoint.

## What already works

The sandbox runtime, explicit brain-repository configuration, clone with `.git`, in-sandbox PostgreSQL/gbrain indexing, and a cited conversational read have been proven. Fresh `create`/`converge` must continue to produce a brain-hosting sandbox, and re-runs remain idempotent. Portable no-config inference uses Zendesk AI Gateway `anthropic.kimi-k3`, and portable embeddings use `openai:text-embedding-3-large`/1536. Explicit host model/settings choices are mirrored without auth files; host, ignored-local, and environment overrides retain their reviewed precedence for inference and embeddings independently. Preserve these working capabilities rather than rebuilding them.

The operator's 4096-dimensional Qwen candidate is partial, not accepted. The last verified snapshot was 1,057 pages / 3,029 valid 4096d chunks, with no source bookmark or cutover. Canonical `gbrain` remained at 1,059 pages / 3,031 valid 1536d chunks with its prior bookmark and gateway configuration. A two-file brain-source frontmatter repair passed validation and was committed locally in the sandbox as `5dde001`, but authorized GitHub fetch/pull from that sandbox failed with a connection reset, so the repair was **not pushed**. The missing third source path is absent from the checked-out tree; upstream full sync clears resolved missing-path failure records without `--skip-failed`. Bead `prime-claw-zwg.5` owns the latest operational checkpoint. Do not infer current service, remote, or database health from these historical counts.

## Remaining observable behavior

1. **Push-capable brain source.** The in-sandbox clone can safely reconcile with its configured private remote and push the validated source repair using the existing OpenShell credential boundary. Conflicts or unavailable transport fail visibly without force-push, credential copying, or a false claim of remote success. The repaired source is available at the remote commit used by the index.
2. **Complete selected Qwen profile.** The isolated candidate indexes the complete current brain source at native 4096 dimensions. Its source bookmark matches the selected source commit; page and chunk coverage are reconciled against that source; stored embeddings have no null, stale, or mixed-model vectors. Known exact-page and semantic queries work. Evidence distinguishes this profile's local embedding traffic from corporate AI-gateway embeddings. An unavailable provider or invalid source stops safely rather than skipping content or treating partial progress as success.
3. **Safe operator-local cutover.** Only after those checks pass, Joe's selected runtime switches atomically to the accepted candidate. The working gateway/1536 database remains intact and usable for rollback. The tracked portable defaults remain unchanged for operators who have not selected Qwen.
4. **One routed write and push-back.** A sandboxed Prime Agent creates or updates the operator-approved `projects/prime-claw` brain page as a keep-worthy fact via the supported gbrain write and sync path, indexes it, commits it in the configured brain clone, and pushes it through the authorized Git path. A receipt identifies the page, commit, remote result, and credential-isolation proof. This work follows the accepted Qwen migration for Joe, although the generic gateway write path is technically independent.
5. **End-to-end acceptance.** A repeatable `bin/prime-claw validate` (or dedicated acceptance check) record shows the configured brain is present and indexed, a cited answer is correct, the selected vector space is complete and fresh rather than keyword-only, and the routed write is present at the remote. Evidence records page coverage and the write receipt without private data. Offline integration tests cover prime-claw wiring with sandbox/exec boundaries mocked; they do not re-test upstream gbrain's own CLI, sync, or embeddings. Documentation describes the behavior actually shipped.

## Binding boundaries

- Brain repository identity is always supplied explicitly through ignored operator-local configuration or `PRIME_CLAW_BRAIN_REPO`. There is no tracked, public, example, or fallback brain repository and no operator taxonomy baked into prime-claw. A missing or invalid repository choice must fail before repository-dependent mutation and name the setup paths.
- Real inference and Git credentials stay in host-side OpenShell providers; the sandbox carries only placeholders. Never copy host `auth.json`, inspect credential stores, or write secrets into the brain clone. Use the OpenShell gateway, not NemoClaw.
- The private Qwen endpoint exists only in ignored local configuration and must not appear in tracked code, evidence, logs, or this specification. Candidate egress policy permits only that configured host/port and restores canonical policy afterward. The candidate and canonical databases remain isolated; no in-place vector migration or premature cutover is acceptable. Keep the single established OpenShell gateway (17670).
- Do not use `--skip-failed` or silently drop source files to reach a bookmark. Preserve both databases when provider, source, transport, or validation checks fail. Do not issue a second build while one is running.
- Implementation must respect the operator's approval boundaries: this draft permits neither new episode resources nor a change to product scope, cutover criteria, or rollback contract.

## Outside this specification

Full memory/ingest skill migration, browse bridging, channels, scheduling, the universal-agent orchestrator, and the operator's future instance repository are later work. Fixing unrelated runtime-status compatibility or replacing the established credential architecture is not required to prove this tracer bullet.

The archived BUFD requirements and decisions remain provenance for past choices. Any proposed reduction of an approved safety or acceptance condition must return to the operator; they are not a standing instruction to recreate already completed implementation.
