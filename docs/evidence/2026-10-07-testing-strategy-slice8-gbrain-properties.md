# Slice 8 — offline gbrain property evidence

Date: 2026-10-07
Bead: `prime-claw-5v7.3`
Accepted base: `e4cbc59e19fe823d598456dbf2185facf0621dee`

## Boundary

This slice extends the admitted disposable tier-2 fixture only. Assertion-time
Docker networking is `none`; the container has no host mounts, ports, privileged
or host namespaces, Docker/OpenShell socket, host HOME, credentials, providers,
private data, configured runtime, production brain, or external remote. All
PostgreSQL, gbrain HOME, Git, corpus, and result state is fixture-owned. The
accepted Slice-7 lifecycle observer was not rerun. P0 `prime-claw-5v7.10` and
Phase 3a were not inspected, executed, handed off, activated, or mutated.

## Locked inputs

- gbrain `0.50.0.0`: commit `a6be012a3bcfac42e279630aedec5cda4a450e29`, tree
  `68bed6c798259e641172b9c4b277fc524b06f3f2`, archive SHA-256
  `78ef4b78fbe2cb1de32862c45a244c0f0b8c20ec468a21c5ecffbba50d53ca1e`.
- Bun `1.3.11` artifact SHA-256
  `d13944da12a53ecc74bf6a720bd1d04c4555c038dfe422365356a7be47691fdf`.
- Platform: `linux/arm64`.
- Integration contract: `integration-v3` / `integration-body-v3`.
- Baked asset count: `15`. The validated receipt contains the
  exact SHA-256 for the coordinator, both property bodies, shared support, and
  both synthetic fixture trees.
- Property manifest SHA-256:
  `e376d22c619b461fc4efa8b68c0ddbda56a0292e36bbf10f72801fa798f90a5a`.

## First complete real fixture

Outer run `20261007T054503Z-95327-bb875b08` passed from
`2026-10-07T05:45:03Z` to `2026-10-07T05:49:12Z`.

- Manifest: `.test-results/slice8-property-try4/20261007T054503Z-95327-bb875b08/integration/manifest.json`
- Manifest SHA-256: `0b3f9e70b5659fa1479e39e61e6ffa17311a713de0df1916cd30a4ef2b7490dc`
- Copied body SHA-256: `2fbf02845d47d18cf1228d9fadb6304139607f5c7cfd4168563f2f97ec6c2b6d`
- Independent validator:
  `python3 -m scripts.testing.integration_provenance <manifest>` → PASS.
- Cleanup: container removed, image removed, context removed.
- Runtime boundary: nonroot, `network_mode=none`, zero host mounts, zero ports.

Three earlier fresh fixture identities were retained as red diagnostic evidence
and never retried: the initial run exposed a generic body failure, the second
localized source coverage, and the third proved the pinned rename behavior is a
soft-delete tombstone rather than physical absence. Each outer failure still
reported exact container/image/context cleanup. The accepted implementation
accounts that observed tombstone explicitly and continues to reject live rename
residue.

## Dry-run logical non-mutation

Both disjoint property identities ran exactly:

```text
gbrain sync --source fixture --dry-run --no-pull --no-embed --yes
```

| Property | Database identity | Normalized result |
|---|---|---|
| `dry-run-a` | `d1f66a067878112e2d457f79d50b012c1dd38fba03255194546c28d965223f62` | `1255c4768a918673fe97de3ad5729f8760bd916b27aea68adc07d2c8ac9d45e7` |
| `dry-run-b` | `c449e92407f4ba1b4e3fa7dac3fa85b4d812f41d81586a342ca47a96d5eee961` | `1255c4768a918673fe97de3ad5729f8760bd916b27aea68adc07d2c8ac9d45e7` |

The database identities are distinct and normalized results are identical.
Within each run, the exact before/after object is equal for schema, migration
`149`, sequence state, every public table's ordered row hash and count, explicit
fixture source/bookmark, failure ledger/lock, cycle and advisory locks,
post-exit sessions, parsed/raw config, worktree HEAD/status/tree, and bare refs.
The retained command outcome is `exited`/`0` with sanitized stdout/stderr. Raw
PGDATA/WAL bytes are outside the logical contract.

Representative dry-run-A hashes:

- schema: `8b9e1b33c7fff5d3a97991ea164372f785951373d31abc636e0683aafd3e9e26`
- sequences: `91a0284802334b70d4fd610bc9e92e29c8aa7d867d3266759738b3b26eda7ee5`
- all-table rows: `1b4e16863510d9c920f4ab627cdda93273aad76baddd3a60973d1e8a8a48fb64`
- failure ledger: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`
- config parsed/raw: `657f2971918d3544813e4e9e36a2601b463ab68e1d3169cb5b31e8e16fed5a6d` /
  `08b81df6b925cb2743077b7a7c71294f5c2059bc14bb1ac5835d29e80652f35f`
- worktree status/tree: `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` /
  `8c4858c32892bec1d81d2237acf750278c2a8256da989075fe34603c16c55f7c`
- bare refs: `ffbfa74d5ca853cdc304c9ca253d8fe30747bef2a24fce3194e9cb826384767b`
- advisory locks: `0`; post-exit fixture sessions: `0`.

## Whole-source accounting

Both disjoint property identities ran exactly:

```text
gbrain sync --source fixture --no-pull --no-embed --no-extract --yes
```

| Property | Database identity | Normalized result |
|---|---|---|
| `source-coverage-a` | `376d983aaf5a2edd38b3511afbcd6f2a0a44f39e694b60830f18e9700a66b8c9` | `a7bd43db280867483b9fcf0e6a702a08d7767c4f75fdb660fc939ef57451cb1c` |
| `source-coverage-b` | `cfeb12de6052c51bda153fecf56cf94ca162ebdc89137c7eeb1309fe830546ef` | `a7bd43db280867483b9fcf0e6a702a08d7767c4f75fdb660fc939ef57451cb1c` |

The database identities are distinct and normalized results are identical. All
six synthetic path/slug identities are accounted exactly once:

| Path | Slug | State | Representation |
|---|---|---|---|
| `people/ada-example.md` | `people/ada-example` | `superseded` | `tombstone` |
| `people/ada-renamed.md` | `people/ada-renamed` | `live` | `row` |
| `projects/meridian.md` | `projects/meridian` | `live` | `row` |
| `concepts/quartz.md` | `concepts/quartz` | `live` | `row` |
| `archive/retired.md` | `archive/retired` | `deleted` | `tombstone` |
| `broken/frontmatter.md` | `broken/frontmatter` | `excluded` | `absent` |

The valid bookmark equals delta commit `b4852e3d241dd70f608f8a78eacd2283112de38f`. The three live
rows, delete tombstone, rename tombstone, and malformed exclusion leave no
missing, duplicate, stale, or unexpected path/slug.

Malformed YAML frontmatter is a separate committed phase. The pinned CLI
truthfully exits `0` while reporting `blocked_by_failures`; acceptance therefore
uses state, not return code alone. `broken/frontmatter.md` appears in the
fixture-owned failure ledger, page-row hash remains
`9a71dbe4c85b8c8f6e344433ae3c1d1ad0be05c34b58f28cbbd3396b0913a799`, and bookmark remains
`b4852e3d241dd70f608f8a78eacd2283112de38f` rather than advancing to
malformed commit `c11a8c1d1e2fa4eae22cb331721f2d681d12d61b`.

## Negative proofs

Host tests reject every named dry-run drift dimension; wrong command/outcome/
exit; stale/incomplete accounting; duplicate path; duplicate slug; missing or
unexpected rows; malformed bookmark/row/reason drift; reused database identity;
A/B normalized mismatch; incomplete asset inventory; and direct host execution
of either property body. Focused integration/inventory validation currently
passes 50 tests.

## Phase 3a proposal only

> When the project-wide tier-2 integration fixture is admitted under
> R-TEST-3/R-TEST-6/R-TEST-13, Phase 3a may cite fixture evidence for exact
> installed-binary provenance, fully migrated
> `gbrain sync --dry-run --no-pull --no-embed --yes` logical non-mutation, and
> synthetic whole-source path/slug accounting. This supports and never replaces
> authorized host/in-sandbox exact-model probes, operator clearance, the single
> bounded resumed build, production Git/L7 proof, or cutover. No production
> dry-run or Phase 3a handoff is authorized.

This proposal was documented only. No Phase 3a action occurred.

## Final matrix

- Focused integration/inventory/static gate: **69 passed**; log SHA-256
  `482a5822a135d127820a2abe7b0fd66adba389bd83f883fce9582bd4a12a8f1d`.
- Poisoned-sentinel host gate: **513 passed, 49 skipped, 75 subtests**;
  `docker`, `openshell`, and `gh` call count zero; log SHA-256 `4f58878b11a471dc5cc2d869339e2448e3e285654f2eb12d330f4e6bc40d469d`.
- Exact pinned tier 1: **46 passed, 2 skipped, 514 deselected**; receipt
  `.test-results/20261007T055534Z-29013-d508e15c/tier1/manifest.json`; receipt SHA-256 `81bd00bcf8ecd796344a01aeca85385078534b1402e1b7d5e9a1bb45f2354a6d`; teardown clean and absent.
- Final `scripts/test-all.sh`: tier 0 PASS (46s), tier 1 PASS (191s), tier 2
  PASS (127s); outer log SHA-256 `c0518867162e71cb7a0074b7285e463e3273704e757bd7b9b86a7feabb22f023`.
- Final tier-1 receipt: `.test-results/20261007T055958Z-44483-a8bf8134/tier1/manifest.json`; SHA-256 `d05a05edac587b7c002012cab037ccfffd1cfdf02a44cc4d9358543ac992721f`; status passed,
  network verified absent, teardown clean and absent.
- Final tier-2 receipt: `.test-results/20261007T060308Z-53755-93bf178e/integration/manifest.json`; SHA-256 `c9628831310ceddafd79c8679e118909989c6e1c3cc8c09df2cfc8ac41f023d5`; independent
  integration-v3 validator PASS; container/image/context cleanup all true.
- Final tier-2 run `20261007T060308Z-53755-93bf178e` retained two disjoint dry-run and two
  disjoint source-coverage database identities with equal normalized A/B hashes.
- Lifecycle remains consumed accepted Slice-7 evidence and was not rerun.

## Review

The one bounded practical review initially returned BLOCK and was retained at
`.test-results/slice8-final-review.md`. It identified three false-green or
traceability gaps. The repair:

1. makes `load_manifest` validate the canonical artifact lock and the complete
   copied body for passed manifests;
2. recomputes both property normalized hashes from shared canonical payload
   builders, binds exact accounting to the canonical fixture manifest, and adds
   stable schema/migration/sequence/table-count/ledger/lock/session/config-shape/
   worktree semantics to dry-run repetition;
3. restores historical R-TEST-1/3/6 wording and gives R-TEST-13 the Slice-8 plan.

Deterministic red tests cover command, asset, identity, snapshot, accounting,
stale digest, substituted path/slug, stale fixture manifest, and hidden A/B
logical drift. The repaired focused suite passes 60 tests. The final expanded offline gate passes 79 tests plus `py_compile` and `git diff --check`.

Fresh repaired-contract tier-2 run `20261007T062606Z-18000-6c78f6ce` passed and its
retained manifest passed the repaired CLI validator. Receipt:
`.test-results/slice8-review-repair2/20261007T062606Z-18000-6c78f6ce/integration/manifest.json`; manifest SHA-256 `6b3467d0f23e608e74baaa0ebe1da4abc84fbd084b3778eba601596fbb914bf6`; outer log SHA-256
`844e97182bb1203cd42fb3e1b5eb5d03bc914e3373dfb3cc6419b50b0834c6a2`. Container, image, and context cleanup are all true.
