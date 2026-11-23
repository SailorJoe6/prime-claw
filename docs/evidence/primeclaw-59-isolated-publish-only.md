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
