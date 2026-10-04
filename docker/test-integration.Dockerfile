# Disposable prime-claw tier-2 brain-stack image.
# Every mutable input is staged from config/test-artifacts.lock.json by
# scripts/test-integration.sh; runtime assertions execute with --network none.
ARG BASE_IMAGE=ubuntu:24.04@sha256:534baea6a22c03a63003dbc8dbe78fe34bc0d7e595d9a9dc9834884ff530eb55
FROM ${BASE_IMAGE} AS builder
ARG BUN_ARCHIVE_DIRECTORY
ARG BUN_COMPILE_TARGET
ARG BUN_VERSION
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/*
COPY bun-artifact.zip /tmp/bun-artifact.zip
RUN unzip -q /tmp/bun-artifact.zip -d /opt/bun-artifact \
    && install -m 0755 "/opt/bun-artifact/${BUN_ARCHIVE_DIRECTORY}/bun" /usr/local/bin/bun \
    && test "$(bun --version)" = "$BUN_VERSION"
COPY gbrain/ /opt/gbrain/
WORKDIR /opt/gbrain
RUN bun install --frozen-lockfile \
    && bun build --compile --target="$BUN_COMPILE_TARGET" \
       --outfile /tmp/gbrain src/cli.ts \
    && /tmp/gbrain --version

FROM ${BASE_IMAGE} AS runtime
ARG TARGET_PLATFORM
ARG BASE_IMAGE_DIGEST
ARG BUN_VERSION
ARG BUN_ARTIFACT_SHA256
ARG GBRAIN_ORIGIN
ARG GBRAIN_COMMIT
ARG GBRAIN_TREE
ARG GBRAIN_ARCHIVE_SHA256
ARG GBRAIN_PACKAGE_VERSION
ARG TEST_RUN_ID
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       bash ca-certificates git passwd python3 python3-pytest \
       postgresql-16 postgresql-16-pgvector \
    && (pg_dropcluster --stop 16 main 2>/dev/null || true) \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /tmp/gbrain /usr/local/bin/gbrain
COPY artifact-lock.json /opt/prime-claw-test/artifact-lock.json
RUN mkdir -p /opt/prime-claw-test /home/tester \
    && useradd --uid 10001 --home-dir /home/tester --shell /bin/bash tester \
    && chown -R tester:tester /home/tester \
    && python3 -c 'import hashlib,json,pathlib,sys; p=pathlib.Path("/usr/local/bin/gbrain"); row={"schema_version":1,"platform":sys.argv[1],"base_image_digest":sys.argv[2],"bun":{"version":sys.argv[3],"artifact_sha256":sys.argv[4]},"gbrain":{"origin":sys.argv[5],"commit":sys.argv[6],"tree":sys.argv[7],"archive_sha256":sys.argv[8],"package_version":sys.argv[9],"executable_sha256":hashlib.sha256(p.read_bytes()).hexdigest()},"run_id":sys.argv[10]}; pathlib.Path("/opt/prime-claw-test/integration-build.json").write_text(json.dumps(row,sort_keys=True,separators=(",",":"))+"\n")' "$TARGET_PLATFORM" "$BASE_IMAGE_DIGEST" "$BUN_VERSION" "$BUN_ARTIFACT_SHA256" "$GBRAIN_ORIGIN" "$GBRAIN_COMMIT" "$GBRAIN_TREE" "$GBRAIN_ARCHIVE_SHA256" "$GBRAIN_PACKAGE_VERSION" "$TEST_RUN_ID" \
    && test "$(gbrain --version | tr -d '\r')" = "gbrain $GBRAIN_PACKAGE_VERSION"
ENV PATH="/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin" \
    HOME=/home/tester \
    LANG=C.UTF-8
LABEL org.prime-claw.test.contract="integration-v1"
ARG TEST_RUN_ID
LABEL org.prime-claw.test.run="$TEST_RUN_ID"
USER tester
WORKDIR /home/tester
CMD ["sleep", "infinity"]
