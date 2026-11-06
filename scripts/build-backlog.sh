#!/usr/bin/env bash
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
SOURCE="$ROOT/deps/backlog"
VERSION=1.55.3
COMMIT=0cf4fdbc70020327f4366a29d3f405f83d180301
BUN_VERSION=1.4.4

[ "$(bun --version)" = "$BUN_VERSION" ]
[ "$(git -C "$SOURCE" rev-parse HEAD)" = "$COMMIT" ]
[ "$(git -C "$SOURCE" rev-parse "refs/tags/v$VERSION^{commit}")" = "$COMMIT" ]
git -C "$SOURCE" diff --quiet HEAD --
git -C "$SOURCE" merge-base --is-ancestor "refs/tags/v$VERSION" "$COMMIT"
(
  cd "$SOURCE"
  HUSKY=0 bun install --frozen-lockfile
  BACKLOG_BUILD_VERSION="$VERSION" bun run build
  bun scripts/smoke-compiled-build.ts dist/backlog "$VERSION"
)
printf 'backlog host artifact: %s (v%s, %s)\n' "$SOURCE/dist/backlog" "$VERSION" "$COMMIT"
