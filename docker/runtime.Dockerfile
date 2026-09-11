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

# Postgres connection defaults (override at apply time if needed).
ENV POSTGRES_USER=gbrain \
    POSTGRES_PASSWORD=gbrain \
    POSTGRES_DB=gbrain \
    PGDATA=/sandbox/pgdata \
    PGPORT=5433
