from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.53.0"
COMMIT = "fd20f71493fb4eda44b021aa89f257956f17fb71"


def test_backlog_submodule_pin_and_build_contract():
    gitmodules = (ROOT / ".gitmodules").read_text()
    assert "path = deps/backlog" in gitmodules
    assert "SailorJoe6/Backlog.md.git" in gitmodules

    script = (ROOT / "scripts/build-backlog.sh").read_text()
    assert f"VERSION={VERSION}" in script
    assert f"COMMIT={COMMIT}" in script
    assert "bun install --frozen-lockfile" in script
    assert 'BACKLOG_BUILD_VERSION="$VERSION" bun run build' in script
    assert 'bun scripts/smoke-compiled-build.ts dist/backlog "$VERSION"' in script
    assert "npm install" not in script


def test_backlog_runtime_build_is_source_compiled_and_smoke_checked():
    dockerfile = (ROOT / "docker/runtime.Dockerfile").read_text()
    assert f"ARG BACKLOG_VERSION={VERSION}" in dockerfile
    assert f"ARG BACKLOG_COMMIT={COMMIT}" in dockerfile
    assert "COPY --from=backlog_source . /opt/backlog" in dockerfile
    assert "rm -rf node_modules dist" in dockerfile
    assert "bun install --frozen-lockfile" in dockerfile
    assert "BACKLOG_BUILD_OUTFILE=/usr/local/bin/backlog bun run build" in dockerfile
    assert "bun scripts/smoke-compiled-build.ts /usr/local/bin/backlog" in dockerfile
    assert not re.search(r"npm (?:i|install).*backlog", dockerfile)
