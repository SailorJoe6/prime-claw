# Disposable Prime Agent source-release builder for tier-1 tests.
# Source is never copied into the image. The host orchestrator mounts one
# selected checkout read-only, a sanitized source manifest read-only, and one
# fresh run-owned output directory read/write.
FROM node:22-bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive \
    HOME=/tmp/prime-claw-builder-home \
    HUSKY=0 \
    CI=1 \
    npm_config_update_notifier=false \
    npm_config_audit=false \
    npm_config_fund=false

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates python3 \
    && rm -rf /var/lib/apt/lists/* \
    && node --version | grep -E '^v(2[2-9]|[3-9][0-9])\.' \
    && python3 --version

COPY source_builder_payload.py /usr/local/lib/prime-claw/source_builder_payload.py
WORKDIR /work
ENTRYPOINT ["python3", "/usr/local/lib/prime-claw/source_builder_payload.py"]
