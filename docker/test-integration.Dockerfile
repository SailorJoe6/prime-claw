# Trusted-host disposable PostgreSQL/gbrain integration image.
# Source, assertion code, and synthetic fixtures are baked into the image.
ARG BASE_IMAGE=ubuntu:24.04
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
ARG TEST_RUN_ID
ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       bash ca-certificates git passwd python3 \
       postgresql-16 postgresql-16-pgvector \
    && (pg_dropcluster --stop 16 main 2>/dev/null || true) \
    && rm -rf /var/lib/apt/lists/*
COPY --from=builder /tmp/gbrain /usr/local/bin/gbrain
COPY artifact-lock.json /opt/prime-claw-test/artifact-lock.json
COPY integration-build.json /opt/prime-claw-test/integration-build.json
COPY assets/ /opt/prime-claw-test/assets/
RUN useradd --uid 10001 --home-dir /home/tester --shell /bin/bash tester \
    && mkdir -p /home/tester/results /home/tester/integration \
    && chown -R tester:tester /home/tester \
    && chmod -R a-w /opt/prime-claw-test/assets /opt/prime-claw-test/artifact-lock.json \
    && python3 -c 'import hashlib,json,pathlib; meta=pathlib.Path("/opt/prime-claw-test/integration-build.json"); row=json.loads(meta.read_text()); row["gbrain"]["executable_sha256"]=hashlib.sha256(pathlib.Path("/usr/local/bin/gbrain").read_bytes()).hexdigest(); meta.write_text(json.dumps(row,sort_keys=True,separators=(",",":"))+"\n")' \
    && test "$(gbrain --version | tr -d '\r')" = "gbrain $(python3 -c 'import json; print(json.load(open("/opt/prime-claw-test/artifact-lock.json"))["gbrain"]["package_version"])')"
ENV PATH="/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin" \
    HOME=/home/tester \
    LANG=C.UTF-8
LABEL org.prime-claw.test.contract="integration-v3"
ARG TEST_RUN_ID
LABEL org.prime-claw.test.run="$TEST_RUN_ID"
USER tester
WORKDIR /home/tester
CMD ["sleep", "infinity"]
