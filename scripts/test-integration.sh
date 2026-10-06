#!/usr/bin/env bash
# Build and run the disposable PostgreSQL/gbrain integration tier.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
exec python3 -m scripts.testing.integration_driver "$@"
