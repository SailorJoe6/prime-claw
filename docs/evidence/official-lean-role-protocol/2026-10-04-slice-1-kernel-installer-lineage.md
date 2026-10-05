# Official lean role protocol — Slice 1 evidence

Date: 2026-10-04

Owner Conversation: `01a0f51d-d51b-7649-a28a-844879e42aec`

Episode: `01a10774-0155-7316-a329-50ee5f7d17be`

Branch: `episode/official-lean-compatibility-cleanup`

## Immutable promotion and predecessor lineage

- Promotion commit and initial episode HEAD:
  `6fcc4bf03b2beb09802ea9fed66a3c956be1d687`.
- Sole promotion parent: `001cd228f6fca8ddd708bfde06823b0641bcfdf0`.
- Promotion topology: local `main` and `origin/main` both resolved to that sole
  parent; the episode was the linked worktree/branch above.
- Promoted future-bundle tree:
  `555332b151255dfa95a7438a8862b56992feecaf`.
- Promoted specification SHA256:
  `632c848c820b8979b634e33d13b741eefc8cb4cf505c91caf74096c1a63b2f6d`.
- Promoted execution-plan SHA256:
  `46b9076facbc02afd285a68b2fd0cc1487b976b867ef619a43cc82dbd8aeb4ed`.
- Exact predecessor `SPECIFICATION.md` SHA256:
  `09cce8ae0898da292fb34f843b3e99b3a5144898934c7e13408a29e76ae2802a`.
- Exact predecessor `EXECUTION_PLAN.md` SHA256:
  `cf9a75e45d4ccabb42e3c36feed05ef9678227bc58d9e8514aea99145cabe888`.

The predecessor files were extracted as raw Git blobs from the promotion parent,
validated before the destination existed, and written unchanged under
`.ralph/plans/archive/official-lean-session-protocol/`. Their internal historical
status text was not repaired or normalized.

## Delivered bridge capability

- Canonical authored neutral kernel:
  `src/prime-agent-plugin/ROLE_KERNEL.md`.
- Kernel SHA256:
  `fd370726c28097b4201f538958e32ddc0af8abdb7c72d675412df0c698bb328e`.
- Generated runtime constants:
  `src/prime-agent-plugin/extension-support/role-kernel.generated.ts`.
- Source generation selector:
  `src/prime-agent-plugin/role-protocol.json` (`bridge`).
- Guarded manager:
  `scripts/manage-prime-agent-role-protocol.py`.
- Retained legacy APPEND marker-region SHA256:
  `06b393005ba260a934c31a19c2fd6c56dbf318dacd499aa4d1d0d86c85207d6a`.

The manager selects `AGENTS.md`, `AGENTS.MD`, `CLAUDE.md`, or `CLAUDE.MD` in
Prime Agent order; creates `AGENTS.md` only when none exists; blocks selection
drift and latent/unowned/malformed markers; preserves unrelated bytes,
newline/final-newline state, mode, uid, and gid; writes atomically under one
agent-root lock; records a mode-0600 ownership manifest; retains the accepted
legacy APPEND block; and restores exact preimages only from a destination-bound
applied receipt whose current postimages still match.

## Reproducible validation

Tier 0:

```bash
python3 -m pytest tests/ -q
```

Result: **291 passed, 164 skipped**, 11 deprecation warnings, 44.31 seconds.

Focused Linux role-manager matrix:

```bash
TIER1_ENV_FILE=<mode-0600 file containing PRIME_AGENT_PINNED=0.9.8> \
  python3 -m pytest tests/test_prime_agent_role_protocol_install.py -q -m container
```

Result: **7 passed** in 15.73 seconds. Covered selected-file priority/case,
LF/CRLF and final-newline preservation, mode/uid/gid, no-op convergence,
malformed/unowned markers, selection drift, receipt restore and mismatch,
unsafe paths, serialized contenders, and dead-writer temp reconciliation.

Full Docker-authoritative gate:

```bash
TIER1_ENV_FILE=<mode-0600 file containing PRIME_AGENT_PINNED=0.9.8> \
  python3 -m pytest tests/ -q -m container
```

Result: **57 passed, 398 deselected**, 11 deprecation warnings, 92.12 seconds.

Installed-runtime probe:

```bash
TIER1_ENV_FILE=<mode-0600 file containing PRIME_AGENT_PINNED=0.9.8> \
  scripts/test-tier1.sh --probe
```

Result: PASS. The ephemeral container installed Prime Agent 0.9.8, applied and
checked the bridge generation at `/root/.prime/agent`, selected `AGENTS.md`,
verified both kernel hashes and the ownership manifest, and registered
`handoff`, `plan`, and `implement-spec` exactly once from installed extensions.
The container was destroyed.

Raw ignored logs:
`.test-results/official-lean-role-protocol/20261004T195535Z-slice1/`

Raw manifest SHA256: `c8df1543224dd0b29497d6a1af77d18140b1780374e7a9ff8beb0face804c62d`.

## Superseded failures retained in raw evidence

- The first Docker admission failed before collection because this linked
  worktree had no ignored `.env`; the rerun used an explicit temporary pinned
  selector.
- The first real focused run found four fixture/diagnostic gaps. The manager now
  rejects unowned markers before lock/state creation, reports selection drift
  before latent-block diagnostics, reconciles exact dead-writer temps on no-op
  apply, and the unsafe-path fixture creates its external target first.
- Tier 0 then found one stale eight-file assertion; it was updated to the
  bridge generation's nine-file allowlist before the clean full rerun.

No user-global apply, restart, provider call, landing, or compatibility removal
occurred in Slice 1.


## Repaired Slice 1 candidate after rejected `1eba414`

The owning Conversation rejected candidate
`1eba414c2157740afb45dba4661a95d9a6d63785`. Its commit, tree, review report,
and raw evidence remain immutable. This repair implements only the five accepted
findings recorded on `prime-claw-h6w.30`:

1. descriptor-bound, no-follow authority for every managed parent and leaf;
2. a phase-aware, fsync-backed apply/restore journal that preserves uncertainty;
3. complete receipt schema, inventory, destination, selection, preimage,
   postimage, identity, metadata, and ownership validation before mutation;
4. exact commit/final-success revalidation of bytes, metadata, candidate
   priority, parent identity, lock binding, and receipt state; and
5. adoption of only the byte-exact predecessor APPEND marker region.

The repaired manager also binds recovery to the exact staged receipt recorded in
the journal. Old valid receipts, same-byte new-inode receipts, metadata drift,
lock-path replacement, and unjournaled external receipt temps fail closed or are
reconciled only by the next canonical lock holder. Prepared and applied receipt
publication both cover synchronous journal errors and hard exits.

### Repair validation

Native-Linux manager matrix (container-local `/tmp`, not a Docker Desktop bind
mount): **12 passed**. The scenarios were `priority`, `preserve`, `malformed`,
`drift`, `receipt`, `unsafe`, `concurrent`, `descriptor-safety`,
`receipt-validation`, `legacy-adoption`, `concurrency-races`, and
`fault-recovery`. They include positive, negative, fault-injection,
concurrency, durability, restore, and replay proofs.

Focused plugin integration on mirrored native-Linux storage:
**28 passed, 1 deselected** in 100.84 seconds. Docker Desktop bind mounts are
not used as the inode/uid/case authority; host fixtures are mirrored so their
byte and metadata assertions remain observable.

Exact final Tier 0:

```bash
python3 -m pytest tests/ -q
```

Result: **291 passed, 169 skipped**, 11 deprecation warnings, 55.57 seconds.

Exact final Docker-authoritative gate and pinned runtime probe:

```bash
python3 -m pytest tests/ -q -m container && scripts/test-tier1.sh --probe
```

Result: **62 passed, 398 deselected**, 11 deprecation warnings, 457.85 seconds,
followed by PASS from the Prime Agent 0.9.8 installed-runtime probe. The
probe installed the pinned release, applied and checked the bridge generation,
verified `handoff`, `plan`, and `implement-spec` exactly once, and destroyed its
ephemeral container.

The independent repair rereview returned PASS after verifying exact
journal/receipt binding, lock guarding across mutation seams, and symmetric
prepared/applied staged-temp cleanup across error and exit replay. It made no
repository edits.

Raw ignored repair logs:
`.test-results/official-lean-role-protocol/20261005T034700Z-slice1-repair/`
Raw manifest SHA256: `0f8092175c9bb83bbf0ebe223f7d8be0312e8e37ac2bfef336247f902ea66d24`.

No user-global apply, Prime Agent restart, provider call, landing,
compatibility removal, finalization, or cleanup occurred in this repair pass.
