# Joe-A exact-candidate EXPERT BLOCK — separate scratch validation

**Status (2026-09-30):** F1 owner-accepted as an in-scope **proof-only REVISE**. The source candidate is **not accepted or published**. Source and parent gates remain BLOCKED.

## Exact review identity

- Local-only brain candidate: `83eee06e4322b3264bb812959a2a5482bce13151`, parent `eb157c713b24bb0ec9315ae27617b16da5cbf71b`.
- Reviewed pushed project evidence: `aa124b8dc429800ff9f5e2b87fd0eaa0725a0ca7`; candidate receipt `phase3a-slice2-joe-a-eb157-local-candidate-20260930.json`, SHA-256 `88f5192f348c8c3f8c2bbea9bfb1f2fe33507859cf77644a20f59cf35fbde8d4`.
- Fresh independent EXPERT child `sub-50caca42`, session `01a0f470-311b-73ff-8064-87b55c1f9719`; returned model `openai-codex/gpt-6-astra`, admitted thinking `max`; validated expert-reviewer profile SHA-256 `d9f8b14954da36df3d9051b4e25f8a76b6d16a0a2c27f9b29cfab262b5efe6f6`, delivered exact packet SHA-256 `355594efabd4b7bb38f603ac9ca77dd7c24abb8f2cdcd01c7ee2f310c045baba`.
- Complete private BLOCK report is retained in reviewer and owner session artifacts, SHA-256 `3560beec3b46403fa0dcfcaeb00378f35a68dc880da453c87ec38812c6d6a154`. This sanitized summary does not publish private page paths, titles, IDs, endpoints, or raw logs.

## Verdict and independently reproduced evidence

**BLOCK, F1 only (P2/material acceptance gate).** The blocked specification requires both native full-source zero-error validations, and the blocked execution plan requires separate **non-Git scratch** and **isolated Git** views. The candidate receipt records only the isolated Git view. The EXPERT independently reproduced that native no-fix result over **1,202 Markdown files, zero errors**, with identical report SHA-256 `7ada1dd65ccf6033ebd25832429b1959d52d974e951ebaef13e9f004cb9fc9ab`. The exact EPISODE confirmed that no native scratch validation of this candidate was performed. The older source-base scratch result cannot substitute.

All other reviewed checks passed: exactly 20 changed candidate paths with byte-exact original suffixes and expected metadata; the one explicit original-Git title/type exception; preserved accepted Slice 1 blobs and 82 disjoint newer remote changes; clean no-sync checkout, exact live remote/ref and effective policy, unchanged both database aggregates, blocked Beads, and unchanged offline focused selection (**85 passed, three warnings**). These checks do not waive F1. The separate reviewer test log SHA-256 is `592eb0b824ce092ec4f747491e346ac52b88416adaa682d2818f1fc1710a98fb`; the candidate receipt's original focused log has another hash because it was a separate run.

## Owner decision and bounded proof-only revision

F1 is accepted inside the already-approved source-candidate proof boundary; **the candidate itself is not accepted**. The failed seam is evidence generation: the two-view requirement was not completed, not a new source-content defect. The exact owned EPISODE may only:

1. Before and after work, verify live source/ref, clean accepted checkout, no-sync, candidate identity, effective policy, and **both** database aggregate gates. Stop on movement, uncertainty, or disagreement; do not fetch, sync, edit, or publish the active source.
2. Safely materialize a **distinct non-Git scratch view** from immutable exact candidate `83eee06e4322b3264bb812959a2a5482bce13151`. Reject missing, extra, changed, unsafe, or wrong-mode paths; prove complete path/mode/content equality to the candidate tree, including the exact 20 original-byte suffixes, accepted Slice 1 blobs, and 82 retained disjoint paths. Do not change candidate/ref/active checkout, page bytes, policy, databases, or an existing source view.
3. Run native full-source frontmatter validation **without `--fix`** on that scratch view; require exit 0, the expected **1,202** native-eligible Markdown files, and **zero errors**. Record private report SHA-256 and sanitized evidence linking both exact source views to the same tree. Preserve the independently reproduced isolated-Git result; rerun it only if needed for a fresh state gate. Keep the unchanged focused no-write selection green if relevant.
4. Positive proof is tree equality plus both view results; negative proof rejects wrong/missing/changed tree/path/mode or missing/nonzero native result without destructive live-source tests. Any remote/ref/checkout/policy/database movement, unsafe extraction, validation failure, or tool/transport error stops the pass with preserved state. Replays must remain exact-candidate no-fix/no-sync and explicitly label later source movement. Do not adjust tests or auto-repair content.

After proof, require a **fresh complete independent EXPERT PASS** on the exact new project evidence and a **separate owner candidate decision**. No brain push, Qwen/index/build, cutover, routed write, or plugin overwrite is authorized by this revision or the earlier B2-only acceptance.
