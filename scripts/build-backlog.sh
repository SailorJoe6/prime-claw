#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SOURCE="$ROOT/deps/backlog"
VERSION=1.53.0
COMMIT=fd20f71493fb4eda44b021aa89f257956f17fb71

[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$COMMIT" ]
[ "$(git -C "$SOURCE" describe --tags --exact-match)" = "v$VERSION" ]
(
  cd "$SOURCE"
  HUSKY=0 bun install --frozen-lockfile
  BACKLOG_BUILD_VERSION="$VERSION" bun run build
  bun scripts/smoke-compiled-build.ts dist/backlog "$VERSION"
)
printf 'backlog host artifact: %s (v%s, %s)\n' "$SOURCE/dist/backlog" "$VERSION" "$COMMIT"
