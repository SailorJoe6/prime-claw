# test.Dockerfile — prime-claw tier-1 slim test image.
#
# The tier-1 environment (see docs/testing-strategy.md):
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

FROM ubuntu:24.04 AS backlog_builder

ARG BUN_VERSION=1.3.11
ARG BACKLOG_VERSION=1.53.0
ARG BACKLOG_COMMIT=5d556c1954f7724abd180f6211cf528e9253ad4c
ENV DEBIAN_FRONTEND=noninteractive
ENV BUN_INSTALL=/usr/local/bun
ENV PATH="/usr/local/bun/bin:${PATH}"
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git unzip \
    && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}" \
    && test "$(bun --version)" = "$BUN_VERSION"
RUN set -eux; \
    git init -q /tmp/backlog; \
    git -C /tmp/backlog remote add origin https://github.com/SailorJoe6/Backlog.md.git; \
    git -C /tmp/backlog fetch -q --depth 2 origin "$BACKLOG_COMMIT"; \
    git -C /tmp/backlog checkout -q --detach FETCH_HEAD; \
    git -C /tmp/backlog fetch -q --depth 1 origin "refs/tags/v${BACKLOG_VERSION}:refs/tags/v${BACKLOG_VERSION}"; \
    test "$(git -C /tmp/backlog rev-parse HEAD)" = "$BACKLOG_COMMIT"; \
    git -C /tmp/backlog merge-base --is-ancestor "refs/tags/v${BACKLOG_VERSION}" "$BACKLOG_COMMIT"; \
    cd /tmp/backlog; \
    HUSKY=0 bun install --frozen-lockfile; \
    TARGET=$(case "$(uname -m)" in aarch64|arm64) echo bun-linux-arm64 ;; *) echo bun-linux-x64 ;; esac); \
    BACKLOG_BUILD_VERSION="$BACKLOG_VERSION" BACKLOG_BUILD_TARGET="$TARGET" BACKLOG_BUILD_OUTFILE=/out/backlog bun run build; \
    bun scripts/smoke-compiled-build.ts /out/backlog "$BACKLOG_VERSION"

FROM ubuntu:24.04 AS tier1_runtime

ENV DEBIAN_FRONTEND=noninteractive

# --- Base tooling: curl for NodeSource, Python 3 + pytest for bridges,
# --- procps for bounded POSIX process/reaping assertions, and TLS roots. ---
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        bash \
        ca-certificates \
        curl \
        git \
        python3 \
        python3-pytest \
        procps \
    && rm -rf /var/lib/apt/lists/*

# --- Node.js 22.x (prime-agent prerequisite: >= 22.8) via NodeSource. ---
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# --- Exact provider-native task tools used by Docker-only plugin validation ---
ARG BACKLOG_VERSION=1.53.0
ARG BACKLOG_COMMIT=5d556c1954f7724abd180f6211cf528e9253ad4c
ARG BEADS_VERSION=1.3.1
ARG DOLT_VERSION=2.5.0
LABEL org.prime-claw.backlog-version="${BACKLOG_VERSION}" \
      org.prime-claw.backlog-commit="${BACKLOG_COMMIT}" \
      org.prime-claw.beads-version="${BEADS_VERSION}" \
      org.prime-claw.dolt-version="${DOLT_VERSION}"
COPY --from=backlog_builder /out/backlog /usr/local/bin/backlog
RUN set -eux; \
    test "$(backlog --version)" = "$BACKLOG_VERSION"; \
    ARCH=$(case "$(uname -m)" in x86_64|amd64) echo amd64 ;; aarch64|arm64) echo arm64 ;; *) exit 1 ;; esac); \
    case "$ARCH" in \
      amd64) BEADS_SHA=3219443a9734b89b93fb16ee8d65844759fa1b3cd3cf139c606b7353cfb0715c; DOLT_SHA=639b8042d1ea46ebf6b645a002fc787134dbe1dc02888cc51a51d1d3eb557c93 ;; \
      arm64) BEADS_SHA=c3b32c71a6c0cd6358a12c28272b17e6818db991da192f87df52339c222e423a; DOLT_SHA=ede33a0ea8fea7c6bd72246f68bf2df7d1334806c802d52b7822f912e3ca0fcf ;; \
      *) exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/gastownhall/beads/releases/download/v${BEADS_VERSION}/beads_${BEADS_VERSION}_linux_${ARCH}.tar.gz" -o /tmp/beads.tar.gz; \
    echo "$BEADS_SHA  /tmp/beads.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/beads.tar.gz -C /tmp bd; \
    install -m 0755 /tmp/bd /usr/local/bin/bd; \
    curl -fsSL "https://github.com/dolthub/dolt/releases/download/v${DOLT_VERSION}/dolt-linux-${ARCH}.tar.gz" -o /tmp/dolt.tar.gz; \
    echo "$DOLT_SHA  /tmp/dolt.tar.gz" | sha256sum -c -; \
    tar -xzf /tmp/dolt.tar.gz -C /tmp "dolt-linux-${ARCH}/bin/dolt"; \
    install -m 0755 "/tmp/dolt-linux-${ARCH}/bin/dolt" /usr/local/bin/dolt; \
    bd --version | grep -F "bd version ${BEADS_VERSION}"; \
    dolt version | grep -F "dolt version ${DOLT_VERSION}"; \
    rm -rf /tmp/beads.tar.gz /tmp/dolt.tar.gz /tmp/bd "/tmp/dolt-linux-${ARCH}"

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
