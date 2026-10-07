# Slice-7 test-only OpenShell fixture; no package install or runtime egress.
FROM ghcr.io/nvidia/openshell-community/sandboxes/base@sha256:aeef1c63f00e2913ea002ccb3aaf925f338b5c5d70e63576f0d95c16a138044e
USER sandbox
WORKDIR /sandbox
CMD ["/bin/sh", "-c", "exec sleep infinity"]
