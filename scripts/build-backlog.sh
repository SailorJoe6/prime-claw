#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SOURCE="$ROOT/deps/backlog"
VERSION=1.53.0
COMMIT=5d556c1954f7724abd180f6211cf528e9253ad4c

[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$COMMIT" ]
git -C "$SOURCE" merge-base --is-ancestor "refs/tags/v$VERSION" "$COMMIT"
(
  cd "$SOURCE"
  HUSKY=0 bun install --frozen-lockfile
  BACKLOG_BUILD_VERSION="$VERSION" bun run build
  bun scripts/smoke-compiled-build.ts dist/backlog "$VERSION"
)
printf 'backlog host artifact: %s (v%s, %s)\n' "$SOURCE/dist/backlog" "$VERSION" "$COMMIT"
