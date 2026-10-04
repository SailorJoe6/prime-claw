#!/usr/bin/env bash
# Build and run the disposable PostgreSQL/gbrain integration tier.
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [ "${PRIME_CLAW_INTEGRATION_INNER:-0}" != 1 ]; then
  exec python3 "$REPO_ROOT/scripts/testing/integration_supervisor.py" "${BASH_SOURCE[0]}" "$@"
fi
cd "$REPO_ROOT"
exec python3 -m scripts.testing.integration_driver "$@"
