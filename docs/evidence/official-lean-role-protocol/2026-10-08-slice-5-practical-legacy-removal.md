# Slice 5 practical legacy removal and restore

Date: 2026-10-08

## Authority and boundary

The owner accepted Gate A bridge UAT after the managed owner identity/guide,
exact episode resume, and ordinary saved-session read-only control all passed
without legacy-package injection or mutation. This slice implements only the
isolated final-mode legacy APPEND removal and known bridge restore path. It does
not change the checked-in bridge generation, remove compatibility resources,
apply final mode to the host, start Slice 6, run Gate B, finalize the episode,
or clean up retained resources.

## Delivered behavior

`scripts/manage-prime-agent-role-protocol.py` now accepts exact schema-1
`bridge` or `final` input while the checked-in `role-protocol.json` remains
`bridge`. Final mode:

- requires an owned bridge manifest and unchanged role-kernel/legacy source;
- removes only the recorded legacy block and Prime Claw-owned separators;
- preserves unrelated APPEND bytes and ordinary metadata;
- records a fixed three-file bridge-to-final receipt;
- restores only when every fixed path is an exact recorded preimage/postimage;
- refuses malformed, duplicate, unowned, tampered, or unknown state; and
- preserves an already-final absent APPEND file on replay.

Apply/check no longer reject unrelated names anywhere under the managed
Conversation or EXPERT skill directories. No replacement cache allowlist or
directory-integrity mechanism was added. Real-directory/no-symlink checks,
expected-file comparisons, managed EXPERT package hash/import validation, role
kernel generation and role-protocol locking/checks, obsolete-file checks, and
ordinary leaf safety remain.

## Evidence

All paths below are under
`.test-results/slice5-20261008T050947Z/` and use the isolated pinned
`PRIME_AGENT_PINNED=0.9.8` selector retained from Section 33.

- Final focused role-protocol matrix: `focused-role-protocol-r7.log` —
  11 passed; SHA256 `a82c2bb251c0425b15d3bc1353809f26955b0393acb2d9f6822b2dafd601195d`.
- Preliminary focused plugin installer matrix: `focused-plugin-install.log` —
  37 passed, 1 deselected; SHA256
  `0f35eb7c9f85bf0902c114675f3746a63c15d8beb45d568cfad5906013e2e578`.
- Final complete Tier 0: `tier0-final.log` — 447 passed, 182 skipped;
  SHA256 `fee608fb20a0915f35400397dd0338d5803013cca9c72ac5b7bad7f71b4600c7`.
- Complete Docker Tier 1: `tier1.log` — 75 passed, 554 deselected; SHA256
  `7bdb894011c18fb85558233a062d15491572ea738c84360e008bc89682305195`.
- Pinned Docker runtime probe: `tier1-probe.log` — apply/check and command
  registration probe passed; container destroyed; SHA256 `1c94d584518c8a2786be0c9fcfdbca7220cc1a0809d50d3de3bd05a371b076e4`.
- Independent read-only exact-diff review: PASS with no actionable blocking
  finding; reviewer session `01a119ec-bd73-71e9-8397-2f152aad8666`.

`git diff --check`, Python compilation, and shell syntax checks also pass. The
tracked final-mode configuration remains unapplied; no user-global apply/check or
live Prime Agent mutation was performed by this slice.
