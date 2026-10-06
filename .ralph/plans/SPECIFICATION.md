# Project-wide testing strategy — Slice 3 reduced specification

## Status

Slice 1 and Slice 2 are owner-accepted. Slice 3 is active on
`prime-claw-5v7.5`. The operator replaced the prior adversarial-security contract
with this trusted-host ordinary-failure contract on 2026-10-06.

## Trust model

Trusted during a test run:

- the local host and Docker daemon;
- the selected checkout and launcher process;
- the same-UID operator;
- the temporary build context before it is removed.

Untrusted and excluded:

- credentials, provider environment, private/operator data, host homes;
- production gbrain/PostgreSQL/Prime Agent services;
- Docker/OpenShell sockets inside the assertion container;
- network access during assertion execution.

Hostile same-UID races and corrupted local namespaces are outside the acceptance
boundary. Ordinary failures must still be truthful and nonzero.

## Required behavior

### Build

- Select only native `linux/arm64` or `linux/amd64`; no emulation fallback.
- Verify locked public gbrain commit/tree/archive/package, Bun artifact, and base
  image identities.
- Build an image containing the exact gbrain executable, assertion body, artifact
  lock, and synthetic fixture corpus.
- Record the tested Git HEAD, clean/dirty state, and a deterministic content hash
  for the selected assertion inputs.

### Run

- Use one nonroot container.
- Use no host bind mounts and publish no ports.
- Pass no provider credentials or arbitrary host environment.
- Use `--network none` for the assertion runtime.
- Keep HOME, PostgreSQL data/socket, synthetic Git repositories, scratch, and
  results inside the container.
- Bound build, start, assertion, stop, copy, and cleanup commands.

### Result and cleanup

- The body writes one JSON receipt under its container-local results directory.
- After the assertion finishes, the host stops the container and copies that
  receipt with `docker cp`.
- The host validates required identities and functional results, then writes one
  readable manifest.
- Cleanup targets only the captured immutable IDs or exact run labels. Removal is
  best-effort and its outcome is recorded. A passed functional receipt cannot hide
  an ordinary assertion failure or interrupted launcher.

## Acceptance checks

The integration run proves real locked gbrain + PostgreSQL 16 + pgvector,
synthetic source sync/get/search, and local Git round trip. Unit tests cover the
normal launcher, receipt validation, no-mount/no-port/network-none create command,
timeout and ordinary signal failure, and best-effort labelled cleanup.

Run focused tests, the full host suite, and one native Docker acceptance run in
that order. A normal review checks only this specification and blocks only real
functional failure, retained isolation violations, unsafe deletion of unowned
resources, ordinary false-green behavior, or missing real-stack coverage.

## Excluded hardening

Descriptor chains, inode binding sidecars, ABA/symlink/FIFO adversaries,
micro-signal matrices, exhaustive malformed-Docker payloads, terminal publication
transactions, and permanent two-run comparison are not required and must not block
completion.

## Boundary

Preserve owner-accepted Slice 1 and Slice 2. Do not implement Slice 4 or modify
Prime Agent. Publish one replacement and stop for owner review.
