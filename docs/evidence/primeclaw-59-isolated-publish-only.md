# PRIMECLAW-59: isolated publish-only rehearsal

`publishIsolatedBeadsImport` is an internal rehearsal entry, not an initialization
or provider-switch tool. It operates on a disposable offline Linux workspace
using a local bare Git remote, a published independent Backlog baseline, and an
embedded Beads source. No path invokes workspace preparation, provider cutover,
ownership transition, source retirement, or replay of the import writer. This
is not an admission procedure for protected copies from live projects.

The supported start is narrow: all mapped tickets are already fully authored
and are still untracked, preserved destination files are in the published
baseline, and no receipt or migrated memory output exists. An incomplete,
ambiguous, differently mapped, or already published import is not supported.
The verifier does not repair any existing ticket or select a replacement.
Automatic Backlog commits and remote operations must be disabled. Source and
destination drift refusal leaves evidence in place; a failure during a write
or a transport failure is not permission to retry or roll back.

The rehearsal verifies the source revision before any data write; reads the mapped
native content, comments, hard dependencies, parent and typed references; and
checks destination paths, original bytes, modes, configuration and ancestry.
It uses native writes for absent memory bookkeeping only, then checks the exact
added file set, stages those paths, and proves a non-force data publication and
readback. Only then does it reserve and complete the native migration receipt,
publish a receipt-only descendant and verify the receipt and the data again.
The source remains present and no authority changes. The isolated test also
reads each revision from separate clones of the disposable remote.

## Evidence

The Docker fixture ran with a read-only workspace, `--network=none`, no host
store, and file-only Git transport. Beads 1.3.1, Backlog 1.55.3, Node 22.23.5.
The real Web importer stopped after native task readback and before receipt
reservation. At the stop, all three mapped tasks were untracked, the original
baseline was still published, and the source held one native memory. A genuine
older source capture was refused before any native task write, Git stage,
commit or push, with the destination index and refs left unchanged.

- Source revision: `capture-sha256:374ebf49a73de80f4dd03534690d14a4195913a9ee4ed83c39e69106ae3ee3c0`
- Original task ref: `1717aa47eaebc9cf2b1ea4a9a47d2b88ceefc2ce`
- Data: `bda7adf18c471789653a1d2f9b10c30e18622b45`; digest `a0f6a3ba6cf01713272094f6fc219d10f0a896e6647b408ee244b1565aeb2fae`
- Receipt: `5823152665bc69c481c9808c24c2a9d6a6a3a016`
- Focused TAP SHA-256: `b5d241d2b7bc11fcc2b8a5a930ea176c162d50cfec3e60f77e3661561ba08850` (one pass, no skips)

The test is opt-in (`PRIME_CLAW_ISOLATED_PUBLICATION_TEST=1`) and requires an
offline container with a private tmpfs workspace and the pinned native tools.
Select `^isolated publish-only` in `tests/task_provider_migration.test.mjs`.
This does not establish live capture safety, scale performance, or behavior on
already-present memory outputs or an existing receipt. No live migration was
run or authorized.

## Two-fix review revision

The publish-only entry now uses the existing file-backed migration adapter by
default. The regression calls the default entry without supplying a runner.
Its observer forwards the actual commands and output unchanged. A real native
Beads current view with authored comments was 1,370,039 bytes on all five reads,
above the earlier 1 MiB pipe limit. The same three-ticket no-receipt boundary,
pre-write refusal, exact memory and mapped-file checks, and separate local
publication/readback passed on the corrected code. This was not a scale test.

- Source: `capture-sha256:15a5c3b3f40a011982ca62b7a31d0e2df4e72051975cac37a55e0b33c9b320d3`
- Original baseline: `d2306fd695b066b1672771b3df77ef71fe90e1bd`
- Data: `1a28b740071f82d9e780ef07adcc250baaf707a0`; digest `58df60ea92d29360fdc51f69fbff3a26dc87b706866e19a09a95582130a884dd`
- Receipt: `65027acc4cc4936c6b3ea7c9f2e10684cf14e4c4`
- Default-runner TAP SHA-256: `268fb7be1d27bde9878e29c80ce8556d2cb1aa7d44b4bfc9d43c2e501df2b923` (one pass, no skips)
- Parked-store TAP SHA-256: `d882851552d752b0b9c902ce0ce8cecc7c3d0b410d2c35eebf00355191e65300` (one pass, no skips)

The separate existing-`clone: true` case used the selector
`^parked-store reconciliation preserves originals and both ancestries: existing hidden bootstrap clone$`.
It exercised the restored ordinary clone command in a disposable synthetic
fixture, including its synthetic source-retirement callback. The isolated
publication fixture still uses `--no-hardlinks` and does not retire its source.
Both runs used Node 22.23.5, Beads 1.3.1 and Backlog 1.55.3 in an offline,
read-only Docker container with private tmpfs; both containers were removed.
Neither run had access to a live source or destination.

## Synthetic capture identity, without publication

The shipping capture matched at the same absolute path after an independent
synthetic embedded-store copy took that path in private Linux `/tmp`. This
control yielded `capture-sha256:668e7fee715fb0f37370a2ce57ced31066f65a264a48c1d2e5fd1d8464d60251` both times.
It does not establish the host layout. The existing publish-only path predicate
requires `dirname(dirname(projectRoot)) === "/tmp"`. A `/Users/...` checkout and
an equivalent hierarchy nested under `/tmp` cannot satisfy that predicate. It
was checked without invoking the publication entry or changing its guard.

The opt-in test then fixed the original native capture and stopped Backlog
mapping before relocating an independent copy. The stopped fixture was authored
using native Backlog Web on loopback only; it did not call switch. On the copy,
the shipping inspector read an embedded Beads store. The test reconciled the
complete native export (including raw lines and memory), long native task views,
status catalog, version and non-path connection fields. It verified only the
repository, `.beads`, and embedded data-directory relocation, then recomputed
the original digest from that fixed identity and the newly read data. No
caller-supplied digest or identity was accepted as proof.

| Evidence | Exact result |
| --- | --- |
| Native capture at relocated path | `capture-sha256:c6472bfcd0769bd2f41428d68c67348ac191b07d69c240c22b4615f82ba5d34a` |
| Independently captured original and recomputed result | `capture-sha256:68b65505568802146c57eb00f560bd84246f3e64ee821266c7c185f50b2c50b5` |
| Existing synthetic task-history baseline | `2ee022ea3559b3a5617210a02c6f4f0498d2e13a` |
| Backlog records | 3 mapped untracked records; 6 original tracked paths |
| Refusals | Independent copy substituted at the same path; real Beads comment drift |

The verifier matched native Backlog views, reference pairs, and physical mapped
paths, bytes and modes. It also matched original bytes, modes, and Git history,
and found the baseline ref, code ref and destination index unchanged. It did
not edit mappings, create a receipt, or stage or publish migration data. This
is a test-only verifier, not a production provenance format, import gate,
protected-copy procedure or APFS transaction-consistency proof. No live data or
retained transport was read, mounted or copied.

To exercise the two tests, use the pinned Tier 1 image
`sha256:4033b1194e72eea0dcfb87e784b65bb301b03f349a692bc4e05c727c27d3b049` with a read-only workspace, read-only root, no Docker network,
private tmpfs `/tmp`, a private home for Beads and XDG, and file-only Git with
system/global Git configuration disabled. Set
`PRIME_CLAW_ISOLATED_IDENTITY_TEST=1` and run:

```sh
node --experimental-strip-types --test --test-concurrency=1 \
  --test-name-pattern '^isolated capture identity (?:same-path control|verifies a relocated synthetic stopped mapping)$' \
  tests/task_provider_migration.test.mjs
```

Node 22.23.5, Beads 1.3.1, Backlog 1.55.3: **2 pass, 0 skips**; addressed
interfaces limited to loopback, no route, and container removal verified.
Focused TAP SHA-256: `a0651d34811b710c6cc95531b167a2eee87345a3709a3730298bf74e39af2329`.
Test input SHA-256: `f1c940a024813e53350f58354b8c0ed38037a23abf5d19add11e294cd7794c60`.
