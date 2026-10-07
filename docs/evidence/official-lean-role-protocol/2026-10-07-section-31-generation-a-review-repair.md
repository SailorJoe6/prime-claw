# Section 31 Generation A owner-review repair evidence

Date: 2026-10-07

## Historical review boundary

Generation A candidate `f2f3fcd25dbe3d96f05193261020d26bf79f1213`
/ tree `8b4fef1936766c7383a577317ac6d2436f4e72e5` and its freeze remain
immutable history. The exact configured Astra/max review returned `BLOCK`; its
report SHA256 is
`4ed03385fc1d54cdecdbbacf5ea720d00b70a9af10b99b1466f7592df50d95e1`.
The owner accepted all five findings as in-scope ordinary-operation defects.
This repair does not reinterpret or overwrite that report.

## B1-B3 coordinator repair

The inert external coordinator now:

- accepts only an exact compiled `[launcher]` or Node
  `[interpreter, entrypoint]` CLI prefix, hashes both executable and entrypoint,
  invokes every version/status/shutdown operation through the full prefix, and
  binds the exact status-reported build/socket/entrypoint/PID;
- discovers only exact `prime-agent` process titles and performs targeted
  declared/discovered PID observation. It requires declared clients, TUIs,
  launchers, and wrappers absent while allowing only the approved old daemon and
  workers. It never parses an unrelated process listing;
- stops before shutdown, landing, apply, start, or scratch topology proof on
  failed, malformed, unknown, duplicate, or mismatched observations;
- starts once, then uses only an attempt- and deadline-bounded read-only
  status/child loop. Empty or expected-socket unreachable state may wait. Wrong
  identity, duplicates, child exit, malformed/failed status, and deadline stop
  without another start; and
- accepts topology rather than caller-supplied rollback shell text. The explicit
  newest-to-oldest linear commit list must be a complete first-parent chain into
  the exact integration merge. Parent order, mainline 2, prelanding commit/tree,
  and every object are resolved. Generated no-commit reversals run only in a
  temporary `git clone --no-local`; their resulting tree must equal the accepted
  baseline. Placeholder ranges, omitted/wrong commits, wrong mainline,
  reset/rebase/force, and automatic live compensation are rejected.

A synthetic real-Git regression creates the same merge shape, proves the exact
inverse in the isolated clone, preserves source status, and leaves no source
worktree registration.

## B4-B5 bundle repair

Before resolution, the bundle helper now `lstat`s the originally supplied
context inputs, destinations, bundle root, real fixed roots, and every existing
fixed managed parent/leaf component. Visible and dangling links and nonregular
leaves fail closed. The fixed inventory and the four supported macOS context
spellings remain unchanged; no descriptor-chain, ABA, inode-generation, or
hostile-race framework was added.

Restore classification remains all-or-refuse across the complete fixed set.
Preimage equality now requires bytes, size, mode, uid, and gid. Equal bytes with
metadata drift trigger metadata repair or failure. Content restoration verifies
bytes and metadata after mutation. `alreadyRestored` is true only when every
required byte and metadata value already matches. Focused tests cover normal
restore, mode-only drift, injected metadata failure, unknown-content refusal,
and replay for both context and installed surfaces.

## Focused proof

Command:

```text
PYTHONDONTWRITEBYTECODE=1 python3 -m pytest tests/test_prime_agent_role_cutover.py -q
```

Result before complete gates: **77 passed**.

The broader focused host selection passes **137 passed, 54 skipped**. Full Node
passes **165**, and affected Docker-native coverage passes **3**.

The exact matrix includes declared live TUI refusal, compiled and Node
entrypoints, same-version wrong artifact digest, failed process discovery,
malformed status, delayed readiness with one start, wrong identity, duplicate,
child exit, deadline, placeholder/wrong/missing rollback commits, wrong
mainline/baseline, actual isolated Git inverse, visible and dangling input/output/
bundle/fixed-component links, nonregular inputs, unchanged-byte mode drift,
metadata failures, unknown-state all-or-refuse, and replay.

## Private recovery evidence

The previous private bundle remains untouched. A replacement bundle was built
only from its preserved private preimages plus current inert source and isolated
candidate postimages; no user-global state was reread or changed.

- replacement private manifest SHA256:
  `527f88a8897f5f2abe92a5ad9745a17db869c5e3440c351f841908d01aebcce2`
- private isolated bundle-proof SHA256:
  `5eb527a2f2b77edca7033c856794b6f9c53466a9dc0b0545bcbf85c7b3f69983`
- inventory entries: **21**
- private directories/files: **0700/0600**

The private proof records normal context and installed restoration,
bytes-plus-metadata replay, mode-only repair, unknown-state all-or-refuse, visible
and dangling link refusal, sentinel preservation, and zero external mutation.
Opaque preimages remain outside Git.

## Complete-gate checkpoint

Preliminary complete gates on the repaired bytes passed:

- Tier 0: **404 passed, 185 skipped**; log SHA256
  `87ad0c92bedf02822c8b6f5371e3618f3a4d4879615d7dfcc10f668ef3281575`;
- selected Docker Tier 1: **78 passed, 511 deselected**; log SHA256
  `91b9a54bb4c4a6466132032ff450ddfb709bf8e87a2e93e905550cf72d387e59`.

After this evidence reconciliation, the exact staged bytes must repeat focused
host, Node, Docker-native, complete Tier 0, selected Docker Tier 1, and the pinned
Prime Agent 0.9.8 probe, followed by `git diff --check`, remote equality, and
teardown. Private prospective/exact topology and gate/freeze receipts bind those
results. This document intentionally contains no future replacement commit,
tree, or renewed review result.

No Gate A, landing to primary `main`, user-global apply, live shutdown/restart,
UAT, compatibility removal, finalization, bookkeeping close, or physical cleanup
occurred in this repair.
