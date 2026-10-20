# Pinned source-loader fixture. No package dist build or extension aliases.
# Build context contains only this Dockerfile; no host dependency/state inputs.
FROM node:22.14.0-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
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
RUN git config --system --add safe.directory /opt/prime-agent
USER node
WORKDIR /tmp
