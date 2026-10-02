# test.Dockerfile — prime-claw tier-1 slim test image.
#
# The tier-1 environment (see .ralph/plans/SPECIFICATION.md "Test tiers"):
# anything needing Node + a prime-agent install + the plugin, but NOT the
# brain stack (no Postgres, no pgvector, no gbrain) and NOT OpenShell (plain
# Docker isolation only; no egress policy or credential mediation).
#
# First occupant: the prime-agent plugin test suite (node extension suites,
# apply/check install tests, live RPC probes) so the prime-agent under test
# is physically isolated from the host's working harness.
#
# Shared image lineage: the Phase 2 runtime image derives from the OpenShell
# sandbox base (ghcr.io/nvidia/openshell-community/sandboxes/base, Ubuntu
# 24.04) and installs no Node — there is no non-trivial base layer to extract
# without changing the runtime image's FROM and risking its behavior. Per the
# spec's escape hatch, Dockerfile-level shared-base extraction is DEFERRED
# (follow-up bead); lineage is the common Ubuntu 24.04 baseline only.

FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PATH="/root/.local/bin:${PATH}"

# --- Base tooling: curl for the NodeSource setup, Python 3 + pytest for the
# --- bridge/test layer, ca-certificates for TLS. Nothing else. ---
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        python3 \
        python3-pytest \
    && rm -rf /var/lib/apt/lists/*

# --- Node.js 22.x (prime-agent prerequisite: >= 22.8) via NodeSource. ---
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Build-time assertions: fail the build if the toolchain regresses below the
# prime-agent prerequisite or Python/pytest are missing.
RUN node --version | grep -E '^v(2[2-9]|[3-9][0-9])\.' \
    && python3 --version \
    && pytest --version

# Test work lands here (bind-mounted repo + container-owned HOME for the
# prime-agent under test). /root is HOME by default; the suite keeps all
# prime-agent state under it.
WORKDIR /work

# Default command is a smoke report; the driver (scripts/test-tier1.sh)
# overrides it for real suite runs.
CMD ["bash", "-lc", "node --version && python3 --version && pytest --version"]
