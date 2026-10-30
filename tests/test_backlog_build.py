from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
VERSION = "1.53.0"
COMMIT = "431e95612d6167e418c507ec206d95df43c38c54"
BUN_VERSION = "1.3.11"
BEADS_VERSION = "1.3.1"
DOLT_VERSION = "2.5.0"


def test_backlog_submodule_pin_and_build_contract():
    gitmodules = (ROOT / ".gitmodules").read_text()
    assert "path = deps/backlog" in gitmodules
    assert "SailorJoe6/Backlog.md.git" in gitmodules

    script = (ROOT / "scripts/build-backlog.sh").read_text()
    assert f"VERSION={VERSION}" in script
    assert f"COMMIT={COMMIT}" in script
    assert 'merge-base --is-ancestor "refs/tags/v$VERSION" "$COMMIT"' in script
    assert "describe --tags --exact-match" not in script
    assert "bun install --frozen-lockfile" in script
    assert 'BACKLOG_BUILD_VERSION="$VERSION" bun run build' in script
    assert 'bun scripts/smoke-compiled-build.ts dist/backlog "$VERSION"' in script
    assert "npm install" not in script


def test_backlog_runtime_build_is_source_compiled_and_smoke_checked():
    dockerfile = (ROOT / "docker/runtime.Dockerfile").read_text()
    assert f"ARG BACKLOG_VERSION={VERSION}" in dockerfile
    assert f"ARG BACKLOG_COMMIT={COMMIT}" in dockerfile
    assert f"ARG BUN_VERSION={BUN_VERSION}" in dockerfile
    assert 'bash -s "bun-v${BUN_VERSION}"' in dockerfile
    assert 'test "$(bun --version)" = "$BUN_VERSION"' in dockerfile
    assert "COPY --from=backlog_source . /opt/backlog" in dockerfile
    assert "rm -rf node_modules dist" in dockerfile
    assert "bun install --frozen-lockfile" in dockerfile
    assert "BACKLOG_BUILD_OUTFILE=/usr/local/bin/backlog bun run build" in dockerfile
    assert "bun scripts/smoke-compiled-build.ts /usr/local/bin/backlog" in dockerfile
    assert not re.search(r"npm (?:i|install).*backlog", dockerfile)

def test_runtime_and_tier1_images_deliver_pinned_provider_native_tools():
    for relative in ("docker/runtime.Dockerfile", "docker/test.Dockerfile"):
        dockerfile = (ROOT / relative).read_text()
        assert f"ARG BACKLOG_VERSION={VERSION}" in dockerfile
        assert f"ARG BACKLOG_COMMIT={COMMIT}" in dockerfile
        assert f"ARG BEADS_VERSION={BEADS_VERSION}" in dockerfile
        assert f"ARG DOLT_VERSION={DOLT_VERSION}" in dockerfile
        assert "beads_${BEADS_VERSION}_linux_${ARCH}.tar.gz" in dockerfile
        assert "dolt-linux-${ARCH}.tar.gz" in dockerfile
        assert 'bd --version | grep -F "bd version ${BEADS_VERSION}"' in dockerfile
        assert 'dolt version | grep -F "dolt version ${DOLT_VERSION}"' in dockerfile
        assert "sha256sum -c -" in dockerfile
    tier1 = (ROOT / "docker/test.Dockerfile").read_text()
    assert "https://github.com/SailorJoe6/Backlog.md.git" in tier1
    # The exact reviewed pin is three commits above v1.53.0; retain that path.
    assert 'fetch -q --depth 4 origin "$BACKLOG_COMMIT"' in tier1
    assert 'git -C /tmp/backlog merge-base --is-ancestor "refs/tags/v${BACKLOG_VERSION}" "$BACKLOG_COMMIT"' in tier1
    assert "BACKLOG_BUILD_OUTFILE=/out/backlog bun run build" in tier1
    assert 'bun scripts/smoke-compiled-build.ts /out/backlog "$BACKLOG_VERSION"' in tier1
    assert "COPY --from=backlog_builder /out/backlog /usr/local/bin/backlog" in tier1
