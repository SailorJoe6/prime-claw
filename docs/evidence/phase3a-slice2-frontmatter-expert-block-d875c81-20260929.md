# EXPERT review — BLOCK

## Exact subject and reviewer

- Project: `d875c81deb8c6c0d640f9753fceab13c86296cf8`, branch `episode/phase3a-brain-hosting-completion`.
- Local brain candidate: `refs/heads/phase3a-slice2-b695-frontmatter-20-candidate` at `1c97c409f005366aca132f5ff68c1a8c23483cc3`, sole parent `b695658b8271f4541e47b87f62c5b14c19075528`.
- Reviewer session: `01a0ef11-140c-74ff-bd3e-45ed5813e1c2`. Model `openai-codex/gpt-6-astra`; admitted thinking `max`, confirmed from this session's admission records.

**BLOCK.** The byte-preserving repair and native syntax checks pass. One page still needs a bounded metadata decision, including a previously unreported **type** conflict. The required focused test gate also failed independently.

## Independent evidence that passed

1. Project HEAD, upstream/tracking and separate live remote reads matched the exact commit. The checkout stayed clean. Its four-file delta is documentation/evidence only. Both supplied receipt SHA-256 values match exactly: candidate `359a3e7b4e7d643237c9a9ce768e32d460ae7df019a1d956badd8513fa1e4277`; prior work-gbrain get receipt `d67499c5a7e348e02d0546b69df2a2b15a519bd9f2a9be85a21b0e6ec9b8d7e9`.
2. Compared complete sandbox Git trees and file bytes, not merely diff counts: baseline/candidate each contain 1,211 entries. Exactly the same 20 native-failure paths changed: 18 MISSING_OPEN, one MISSING_CLOSE, one YAML_PARSE. All 20 were already unchanged from accepted 5c47. No additions, deletions, mode changes or other content changes. Each candidate file has exactly a four-line `type`/`title` prefix and the complete original file as an exact byte suffix. All per-path receipt hashes and private get metadata values match. No ID was added. Both accepted repair blobs remain exact. All tracked scratch/worktree bytes and modes match the candidate tree. Both Git diff checks pass.
3. Independently reran native **gbrain 0.50.0.0** non-fixing frontmatter validation on the existing scratch candidate and isolated Git worktree. Each scanned **1,189 files**, exited 0 and reported zero errors. Both raw report digests exactly reproduce the retained reports; the Git-worktree report hash is `494bd2465b5c3d78be9ea4f6ef25f67e2508ac9db481d04dab9fa9e5df9d613c`. Raw results stayed inside the sandbox.
4. Nineteen matched titles equal their first source H1. Eighteen complete original files occur verbatim in their saved get content. The short MISSING_CLOSE page retains the documented 109/114 window overlap. The YAML_PARSE content has the documented two identical metadata/content copies; one belongs to the other 19 pages' source group. Their identical header values do not resolve the conflicting Git declarations.
5. Live brain remote main remains b695; no advertised remote ref points to the candidate. Active checkout remains clean accepted `5c47c067e93eb633da8a8dcb28221e23eea7685b`; tracking/inspection remain b695; local main/original-repair remain `5dde0012eadf1df7c3e9c83d228e2d0d31f36695`. Candidate worktree is clean. These identities stayed fixed during review.
6. Effective canonical policy hash remains `df716b2cd9d91d02417cc6a96f535be481e7768fe6a8b7df80b316f93489a321`. Read-only SQL reproduced canonical 1,059 pages/3,031 non-null 1536d chunks and old bookmark; candidate 1,057 pages/3,029 non-null 4096d chunks and no bookmark. Config identities and hashes, aggregate DB observations and policy were unchanged across review. No gbrain process was present. Parent/source/write Beads are blocked. Current docs expressly withhold source publication, candidate/Slice 2 acceptance and cutover.

## B1 — High: unresolved title AND type authority on the YAML_PARSE page

**Evidence / impact.** Locate this exact page privately through receipt path SHA-256 `4581a76586e2b3bdfd97ac2657e871c67eda6a8ca11945faeec09acfba0ed803`. Its old malformed header contains one explicit title and a simple, non-placeholder type scalar. The new prefix disagrees with **both**. The type difference survives case normalization and is not a quoting/comment artifact. The chosen title equals the filename-humanized fallback; the chosen type is the parser's generic fallback. This is consistent with earlier parse fallback, not independent proof that these are the desired replacements. I do not claim to have proved their historical origin.

The source has no H1 to settle the title. Its explicit title differs beyond case, spacing and punctuation. Prefixing valid metadata makes the selected values authoritative while moving the old declarations into ordinary body text. Keeping those bytes does not preserve their metadata role. Slug/path identity remains stable, but displayed title, classification, type-filtered retrieval and later serialization can change. The docs/receipt flag only the title conflict, not this type conflict.

**Violated invariant / seam.** Approved metadata-only repair must not silently accept a material page-identity/meaning change. The blocked plan, lines 179–189, and specification line 35 retain that stop condition. Content matching and source-group selection were promoted into metadata authority. Native SLUG_MISMATCH absence does not settle it: the staged gbrain 0.50 parser checks an explicit slug field against a path, not titles/types; this new header has no slug field.

**Bounded decision and recommendation.** Ask for one exact-page decision covering **both fields**. Alternatives: (A) preserve the explicit Git title/type in the new prefix as a narrow exception to the database-metadata rule; or (B) knowingly select the database title/type and expressly accept their precedence over the retained source declarations. **Recommend A**, because authoritative Git already supplies explicit values and the selected database values match fallback shapes. This requires owner/operator authorization; do not implement it under the current grant. No impossible proof of historical author intent is needed.

**Constraints.** Preserve the original complete byte suffix, paths/modes, other 19 prefixes, accepted repair blobs and all newer remote content. Do not strip old fragments, invent IDs, rewrite bodies, switch duplicate source groups as a purported semantic fix, or treat syntax success as approval.

**One-iteration tests.** Positive: assert the exact approved title/type pair on this page; prove other 19 prefixes unchanged and repeat all exact-20/suffix/tree/native checks. Negative: a different or unresolved pair must stop even when validation passes; duplicate-group selection must not choose different metadata silently. Failure: remote/ref movement, hash mismatch or native error must stop with no publication/DB action. Replay: regenerate from exact b695 with the recorded decision and obtain identical candidate bytes without double-prefixing. Regression risk: title/type search behavior and get/export round trips. Repair the decision, candidate and sanitized docs/evidence together; keep publication separately gated.

## B2 — Medium: focused offline safety gate is not reproducibly green

**Evidence / impact.** In the exact reviewed checkout, with bytecode/cache writes disabled and reviewer-owned temporary files, the specified three modules returned **62 passed, 1 failed, 3 warnings in 22.46s**. Failure: `tests/test_embedding_candidate_build.py:170`, `test_candidate_progress_watchdog_terminates_stall_and_returns_nonzero`, timed out after 15 seconds after logging the stall-termination message. A single-test pytest diagnostic reproduced the timeout. Calling that same unmodified test function directly passed. Environment: Python 3.14.4, Bash 3.2.57. This does **not** disprove the earlier recorded 63-pass run or prove a live sandbox failure.

**Invariant / failing seam.** The required focused no-write acceptance gate is not established by this review. The failing seam is watchdog process-group termination/parent completion under pytest around `bin/prime-claw:1195–1250`; the exact cause remains unproven. A direct-function pass cannot replace the required suite result. This is existing code, not a new frontmatter regression.

**Recommended repair direction.** Resolve this bounded offline validation discrepancy before presenting a new green gate. Instrument exact worker/descendant PIDs, PGIDs, signal returns and captured stderr under pytest, then correct the demonstrated harness/platform or teardown fault. If code work is required, seek the appropriate scope authorization rather than silently expanding this frontmatter pass. Do not increase timeouts, skip the test, weaken group-kill assertions or repeatedly rerun until green.

**Tests / risks / dependencies.** Positive: progressing worker exits normally; stalled worker returns 124 within its bounded deadline. Negative: a TERM-resistant descendant must also be gone. Failure: signal interruption and failed progress reads cannot strand workers or report success. Replay: repeat the isolated scenario and the full 63-test selection in the documented native environment, with no orphan processes. Preserve process-group isolation so unrelated processes cannot be killed. This gate is independent of B1; neither semantic approval nor a syntax pass resolves it. All test-owned PIDs were absent after my runs.

## Limits and authority

- No repository/source/ref, Bead, policy, provider, configuration or database mutation; no episode message/steer, fetch, push, Qwen request, sync/index/build, cutover, routed write, native Prime Agent probe or full maintained suite. Only reviewer-owned diagnostics/artifacts were written.
- Current refs, advertised remote state, DB aggregates and policy support the recorded no-action checkpoint; they cannot prove every historical command or exclude a transient unrecorded operation. DB checks are aggregate/profile observations, not whole-database equality proofs. Full-source indexing eligibility and retrieval remain unproven and separately gated.
- The saved private full-mapping artifact points to the other YAML copy; a same-group identical copy exists. Identical candidate values cannot prove which copy the implementation selected. This does not alter the byte proof, but should not be called independent source-provenance proof.
- Parser-source observations use the staged 0.50.0.0 source; I did not establish its exact build identity against the installed binary. Native validation itself was rerun on the installed binary.
- This BLOCK accepts no candidate or slice and authorizes no publication, merge, cleanup or implementation.

## Reviewer-owned evidence

- Sanitized independent checks: `/Users/jlanders/.prime/agent/session-artifacts/01a08d45-2530-7042-9b25-132a01919d01/sub-69f4e860/expert-review-d875c81/sanitized-review-evidence.json`
- SHA-256: `fde0f12c6d978de82a5466c21a474bf29bacb60e2cf603861a9b965f05498768`
- Focused failure log: `/Users/jlanders/.prime/agent/session-artifacts/01a08d45-2530-7042-9b25-132a01919d01/sub-69f4e860/expert-review-d875c81/focused-tests.log`
- SHA-256: `6b894a3bda2ffdc20335b1c15ccecfdd12b0df06c4d21cdd0b8fa7638f5539a7`
- Additional bounded test diagnostics are in the same reviewer directory.
