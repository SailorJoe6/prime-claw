# runtime.Dockerfile — prime-claw Phase 2 runtime image (migrated from
# docker/runtime.Dockerfile, Phase 1 Slice 4 / U2). Built by `bin/prime-claw build`.
#
# Derives from the proven prime-claw sandbox base (ghcr.io/nvidia/openshell-
# community/sandboxes/base:latest, Ubuntu 24.04, USER sandbox, workdir /sandbox)
# and bakes in the brain stack AT BUILD TIME (as root), per decision D15:
# the environment belongs to the image, not a runtime install.
#
#   * PostgreSQL 16 + postgresql-16-pgvector (Ubuntu noble repos; noble ships
#     PG16 and pgvector 0.6.0). Data dir is created under /sandbox (the only
#     read-write path in the OpenShell filesystem policy) and CHOWNed to the
#     `sandbox` user, so the agent OWNS its Postgres: it runs initdb / pg_ctl
#     start|stop|status / psql itself, no root or sudo required.
#   * gbrain CLI, compiled from the local zbrain checkout with Bun
#     (bun build --compile), matching the proven zbrain-brain Dockerfile recipe.
#
# Postgres runtime ownership model (R-U2-3 + user requirement "the agent owns
# its own postgres"):
#   * PGDATA = /sandbox/pgdata (sandbox-owned, chmod 700 by initdb)
#   * superuser role = POSTGRES_USER (default gbrain); the sandbox user connects
#     over localhost with trust auth and can createdb / CREATE EXTENSION vector.
#   * start: pg_ctl -D /sandbox/pgdata -l /sandbox/pg.log -w start
#   * start: pg_ctl -D /sandbox/pgdata -l /sandbox/pg.log -w start
#             -o "-c listen_addresses=localhost -c port=5433 \
#                 -c unix_socket_directories=/sandbox"
#     (the OpenShell filesystem policy makes /var read-only in the running
#     sandbox, so the default /var/run/postgresql socket dir is not writable;
#     the Unix socket is placed in /sandbox, which the sandbox user owns.)
#
# Build (from repo root):
#   docker build -f docker/runtime.Dockerfile -t prime-claw-brain:0.1.0 docker
FROM ghcr.io/nvidia/openshell-community/sandboxes/base:latest

# Prime Agent is built from the exact downstream TypeScript source tag below,
# not the mutable public installer (which now serves an incompatible Rust CLI).
# Keep .git for the source launcher BUILD_ID and verify identity again at runtime.
ARG PRIME_AGENT_REQUIRED_VERSION=0.9.8
ENV PRIME_AGENT_SOURCE_TAG=cwd-fix-v0.9.8-r1 \
    PRIME_AGENT_SOURCE_TAG_OBJECT=8ca4d5c39b7c738f71b5c86422ea46394c3d0558 \
    PRIME_AGENT_SOURCE_COMMIT=a1faacd53ac4473a75de1d434afaf50945c2f647 \
    PRIME_AGENT_SOURCE_TREE=5301c70d9c9d74e474ccaf258fdd3c8de982c52f \
    PRIME_AGENT_SOURCE_LOCK_SHA256=3e80422bb281cf9395937ef12bf43d038d92d92bf1f3f70596b63d5a3af2de74 \
    TSX_TSCONFIG_PATH=/opt/prime-agent/tsconfig.json
LABEL org.prime-claw.prime-agent-required-version="${PRIME_AGENT_REQUIRED_VERSION}" \
      org.prime-claw.prime-agent-source-tag="${PRIME_AGENT_SOURCE_TAG}" \
      org.prime-claw.prime-agent-source-tag-object="${PRIME_AGENT_SOURCE_TAG_OBJECT}" \
      org.prime-claw.prime-agent-source-commit="${PRIME_AGENT_SOURCE_COMMIT}" \
      org.prime-claw.prime-agent-source-tree="${PRIME_AGENT_SOURCE_TREE}" \
      org.prime-claw.prime-agent-source-lock-sha256="${PRIME_AGENT_SOURCE_LOCK_SHA256}"

ENV DEBIAN_FRONTEND=noninteractive

# --- PostgreSQL 16 + pgvector, as root (Ubuntu noble ships both) ---
USER root
# Ubuntu noble uses deb822 (ubuntu.sources) with universe already enabled, so
# postgresql-16 + postgresql-16-pgvector install straight from the stock repos
# (no PGDG, no extra source lines needed). `unzip` is required by the Bun
# installer below.
RUN apt-get update && apt-get install -y --no-install-recommends \
      postgresql-16 postgresql-16-pgvector unzip \
    && rm -rf /var/lib/apt/lists/* \
    && pg_dropcluster --stop 16 main 2>/dev/null || true
ENV PATH="/usr/lib/postgresql/16/bin:$PATH"

# --- Bun (to compile gbrain) ---
ENV BUN_INSTALL=/usr/local/bun
RUN curl -fsSL https://bun.sh/install | bash \
    && ln -sf /usr/local/bun/bin/bun /usr/local/bin/bun \
    && ln -sf /usr/local/bun/bin/bunx /usr/local/bin/bunx

# --- Immutable downstream Prime Agent TypeScript source + lockfile deps ---
# This public clone is an upstream dependency input, not a source patch/vendor
# tree. Do not take code, node_modules, dist, or credentials from the host.
RUN git clone --filter=blob:none --depth 1 --single-branch \
      --branch "$PRIME_AGENT_SOURCE_TAG" \
      https://github.com/SailorJoe6/prime-agent.git /opt/prime-agent \
    && cd /opt/prime-agent \
    && test "$(git remote get-url origin)" = https://github.com/SailorJoe6/prime-agent.git \
    && test "$(git cat-file -t "refs/tags/$PRIME_AGENT_SOURCE_TAG")" = tag \
    && test "$(git rev-parse "refs/tags/$PRIME_AGENT_SOURCE_TAG")" = "$PRIME_AGENT_SOURCE_TAG_OBJECT" \
    && test "$(git rev-parse "refs/tags/$PRIME_AGENT_SOURCE_TAG^{commit}")" = "$PRIME_AGENT_SOURCE_COMMIT" \
    && test "$(git rev-parse HEAD)" = "$PRIME_AGENT_SOURCE_COMMIT" \
    && test "$(git rev-parse HEAD^{tree})" = "$PRIME_AGENT_SOURCE_TREE" \
    && printf '%s  %s\n' "$PRIME_AGENT_SOURCE_LOCK_SHA256" package-lock.json | sha256sum -c - \
    && node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if (major<22 || (major===22 && minor<8)) process.exit(1)' \
    && HUSKY=0 npm ci --no-audit --no-fund \
    && printf '%s  %s\n' "$PRIME_AGENT_SOURCE_LOCK_SHA256" package-lock.json | sha256sum -c - \
    && test -z "$(git status --porcelain)" \
    && test "$(git describe --tags --always --dirty)" = "$PRIME_AGENT_SOURCE_TAG" \
    && test -x prime-agent.sh
# The root source launcher must see its checkout, not a symlinked SCRIPT_DIR.
RUN printf '%s\n' '#!/usr/bin/env bash' 'exec /opt/prime-agent/prime-agent.sh "$@"' \
      > /usr/local/bin/prime-agent \
    && chmod 755 /usr/local/bin/prime-agent \
    && git config --system --add safe.directory /opt/prime-agent

# --- gbrain CLI: compile from the staged source, install the standalone binary ---
# Inputs staged into docker/runtime/gbrain/ by `bin/prime-claw build` from the
# operator's local zbrain checkout (PRIME_CLAW_ZBRAIN_SRC).
COPY runtime/gbrain /opt/gbrain
WORKDIR /opt/gbrain
RUN bun install --frozen-lockfile \
    && TARGET=$(case $(uname -m) in aarch64|arm64) echo "bun-linux-arm64";; *) echo "bun-linux-x64";; esac) \
    && bun build --compile --target=$TARGET --outfile /usr/local/bin/gbrain src/cli.ts \
    && rm -rf /opt/gbrain

# --- Postgres data dir + runtime dirs owned by the sandbox user ---
# /sandbox is the sandbox user's read-write home/workdir. Create the PGDATA and
# the runtime socket dir up front, owned by sandbox, so initdb/pg_ctl never
# need root. /var/run/postgresql is the default socket dir on Ubuntu.
RUN mkdir -p /sandbox/pgdata /var/run/postgresql \
    && chown -R sandbox:sandbox /sandbox /var/run/postgresql \
    && chmod 700 /sandbox/pgdata

# Back to the unprivileged runtime user the OpenShell base expects.
USER sandbox
WORKDIR /sandbox

# Prepare the source release's Python kernel under the same sandbox HOME used
# at runtime. The network is available during this image build, not required
# for the first disposable offline session. Keep the checked-out source and
# kernel runtime inside the image; do not use host packages or state.
RUN PRIME_AGENT_INSTALL_UV=1 /opt/prime-agent/node_modules/.bin/tsx -e \
    "import { ensureKernelPython } from '/opt/prime-agent/packages/coding-agent/src/core/kernel/bootstrap.ts'; ensureKernelPython().then((python) => console.log('kernel_python=' + python)).catch((error) => { console.error(error); process.exitCode = 1; })"

# Postgres connection defaults (override at apply time if needed).
ENV POSTGRES_USER=gbrain \
    POSTGRES_PASSWORD=gbrain \
    POSTGRES_DB=gbrain \
    PGDATA=/sandbox/pgdata \
    PGPORT=5433
