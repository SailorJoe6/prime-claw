#!/usr/bin/env bash
# Canonical source-builder entrypoint used by the tier-1 driver and fixture.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
exec python3 -m scripts.testing.source_builder "$@"
