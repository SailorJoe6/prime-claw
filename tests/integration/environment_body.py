#!/usr/bin/env python3
"""Explicit in-container assertions for the disposable brain-stack tier.

The filename is intentionally not pytest-collectable. The host launcher invokes
it only after Docker inspect proves the container boundary.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import socket
import subprocess
import sys
import time

try:
    import pytest
    pytestmark = pytest.mark.integration
except ImportError:  # pragma: no cover - image installs pytest; import is inert
    pytestmark = None

ASSETS = Path("/opt/prime-claw-test/assets")
RESULTS = Path("/home/tester/results")
FIXTURE = ASSETS / "fixtures/brain-source"
BUILD_META = Path("/opt/prime-claw-test/integration-build.json")
LOCK_COPY = Path("/opt/prime-claw-test/artifact-lock.json")
_ALLOWED_ENV = {
    "HOME", "HOSTNAME", "LANG", "PATH", "PWD", "SHLVL", "_",
    "PRIME_CLAW_INTEGRATION_ATTESTATION", "PRIME_CLAW_INTEGRATION_RUN_ID",
}
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_RUN_ID = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[0-9]+-[0-9a-f]{8}$")


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _canonical(value: object) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def _run(argv: list[str], *, env: dict[str, str], timeout: int = 120,
         cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        argv, cwd=cwd, env=env, text=True, capture_output=True,
        timeout=timeout, check=True,
    )


def _verify_entry_boundary(attestation: str, run_id: str) -> list[str]:
    if os.environ.get("PRIME_CLAW_INTEGRATION_ATTESTATION") != attestation:
        raise RuntimeError("integration attestation mismatch")
    if os.environ.get("PRIME_CLAW_INTEGRATION_RUN_ID") != run_id:
        raise RuntimeError("integration run identity mismatch")
    if not _RUN_ID.fullmatch(run_id) or not _SHA256.fullmatch(attestation):
        raise RuntimeError("integration attestation is malformed")
    if os.geteuid() == 0:
        raise RuntimeError("integration body must run unprivileged")
    if not ASSETS.is_dir() or not FIXTURE.is_dir():
        raise RuntimeError("baked integration assets are unavailable")
    asset_probe = ASSETS / ".write-probe"
    try:
        asset_probe.write_text("unexpected\n")
    except OSError:
        pass
    else:
        asset_probe.unlink(missing_ok=True)
        raise RuntimeError("baked integration assets are unexpectedly writable")
    if Path.home() != Path("/home/tester"):
        raise RuntimeError("integration HOME is not container-local tester home")
    RESULTS.mkdir(parents=True, exist_ok=True)
    probe = RESULTS / ".write-probe"
    probe.write_text("ok\n")
    probe.unlink()
    unexpected = sorted(set(os.environ) - _ALLOWED_ENV)
    if unexpected:
        raise RuntimeError("integration process environment is not allow-listed")
    return sorted(os.environ)


def _external_tcp_refused() -> bool:
    try:
        with socket.create_connection(("198.51.100.1", 9), timeout=1):
            return False
    except OSError:
        return True


def _fixture_inventory() -> tuple[dict, str, str]:
    manifest_path = FIXTURE / "manifest.json"
    manifest = json.loads(manifest_path.read_text())
    if not isinstance(manifest, dict) or set(manifest) != {
            "schema_version", "fixture", "pages"}:
        raise RuntimeError("fixture manifest shape is invalid")
    if manifest["schema_version"] != 1 or manifest["fixture"] != "prime-claw-synthetic-brain-v1":
        raise RuntimeError("fixture manifest identity is invalid")
    rows = manifest["pages"]
    if not isinstance(rows, list) or not rows:
        raise RuntimeError("fixture manifest has no pages")
    observed = []
    for row in rows:
        if not isinstance(row, dict) or set(row) != {"path", "slug", "sha256"}:
            raise RuntimeError("fixture page record is invalid")
        rel = row["path"]
        if (not isinstance(rel, str) or Path(rel).is_absolute()
                or ".." in Path(rel).parts or not rel.endswith(".md")):
            raise RuntimeError("fixture page path is invalid")
        page = FIXTURE / rel
        digest = _sha(page.read_bytes())
        if digest != row["sha256"] or not _SHA256.fullmatch(digest):
            raise RuntimeError("fixture page hash mismatched")
        text = page.read_text()
        match = re.search(r"(?m)^slug: ([a-z0-9][a-z0-9/-]*)$", text)
        if match is None or match.group(1) != row["slug"]:
            raise RuntimeError("fixture page slug mismatched")
        observed.append({"path": rel, "slug": row["slug"], "sha256": digest})
    if sorted(str(p.relative_to(FIXTURE)) for p in FIXTURE.rglob("*.md")) != sorted(
            row["path"] for row in rows):
        raise RuntimeError("fixture contains an unmanifested page")
    return manifest, _sha(manifest_path.read_bytes()), _sha(_canonical(observed))


def _git_fixture(root: Path, run_id: str, base_env: dict[str, str],
                 manifest: dict) -> tuple[str, str, str]:
    bare = root / "remote.git"
    work = root / "brain"
    verify = root / "roundtrip"
    _run(["git", "init", "--bare", str(bare)], env=base_env)
    _run(["git", "init", "-b", "main", str(work)], env=base_env)
    for row in manifest["pages"]:
        target = work / row["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(FIXTURE / row["path"], target)
    shutil.copyfile(FIXTURE / "manifest.json", work / "manifest.json")
    (work / ".fixture-run").write_text(run_id + "\n")
    git = ["git", "-c", "user.name=Prime Claw Fixture",
           "-c", "user.email=fixture@invalid.example"]
    _run([*git, "add", "."], env=base_env, cwd=work)
    _run([*git, "commit", "-m", f"fixture {run_id}"], env=base_env, cwd=work)
    commit = _run(["git", "rev-parse", "HEAD"], env=base_env, cwd=work).stdout.strip()
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise RuntimeError("fixture commit identity is invalid")
    _run(["git", "remote", "add", "origin", str(bare)], env=base_env, cwd=work)
    _run(["git", "push", "-u", "origin", "main"], env=base_env, cwd=work)
    _run(["git", "clone", "--branch", "main", str(bare), str(verify)], env=base_env)
    roundtrip = []
    for row in manifest["pages"]:
        digest = _sha((verify / row["path"]).read_bytes())
        if digest != row["sha256"]:
            raise RuntimeError("local Git round trip changed fixture content")
        roundtrip.append({"path": row["path"], "slug": row["slug"], "sha256": digest})
    refs = _run(["git", "for-each-ref", "--format=%(refname):%(objectname)"],
                env=base_env, cwd=bare).stdout.encode()
    return commit, _sha(refs), _sha(_canonical(roundtrip))


def _postgres_and_gbrain(root: Path, run_id: str, work: Path,
                         base_env: dict[str, str]) -> dict:
    suffix = hashlib.sha256(run_id.encode()).hexdigest()[:12]
    pgdata = root / "pgdata"
    socket_dir = root / "socket"
    home = root / "home"
    socket_dir.mkdir()
    home.mkdir()
    db_name = "gbrain_" + suffix
    tmpdir = root / "tmp"
    tmpdir.mkdir()
    env = dict(base_env)
    env.update({
        "HOME": str(home), "GBRAIN_HOME": str(home),
        "GBRAIN_SKIP_STARTUP_HOOKS": "1", "NODE_ENV": "test",
        "TMPDIR": str(tmpdir),
    })
    _run(["initdb", "--no-locale", "--encoding=UTF8", "-A", "trust",
          "-U", "gbrain", "-D", str(pgdata)], env=env)
    started = False
    try:
        _run(["pg_ctl", "-D", str(pgdata), "-l", str(root / "postgres.log"),
              "-w", "start", "-o",
              f"-c listen_addresses=127.0.0.1 -c port=5433 "
              f"-c unix_socket_directories={socket_dir}"], env=env)
        started = True
        _run(["createdb", "-h", "127.0.0.1", "-p", "5433", "-U", "gbrain", db_name], env=env)
        psql = ["psql", "-X", "-A", "-t", "-h", "127.0.0.1", "-p", "5433",
                "-U", "gbrain", "-d", db_name]
        _run([*psql, "-c", "CREATE EXTENSION IF NOT EXISTS vector"], env=env)
        database_url = f"postgresql://gbrain@127.0.0.1:5433/{db_name}"
        _run(["gbrain", "init", "--url", database_url, "--non-interactive",
              "--no-embedding", "--skip-embed-check", "--schema-pack",
              "gbrain-base-v2", "--json"], env=env, timeout=180)
        # The public schema-only path must be idempotent on a fully migrated baseline.
        _run(["gbrain", "init", "--migrate-only", "--json"], env=env, timeout=180)
        _run(["gbrain", "init", "--migrate-only", "--json"], env=env, timeout=180)
        version = _run(["gbrain", "--version"], env=env).stdout.strip()
        if version != "gbrain 0.50.0.0":
            raise RuntimeError("gbrain version mismatched")
        _run(["gbrain", "sources", "add", "fixture", "--path", str(work),
              "--no-federated"], env=env, timeout=120)
        _run(["gbrain", "sync", "--source", "fixture", "--no-pull",
              "--no-embed", "--no-extract", "--yes"], env=env, timeout=180)
        _run(["gbrain", "config", "set", "search.mcp_keyword_only", "true"],
             env=env, timeout=60)
        get_result = _run(["gbrain", "get", "projects/meridian", "--source-id",
                           "fixture", "--json"], env=env, timeout=60)
        search_result = _run(["gbrain", "search", "cobalt-orbit-731",
                              "--source-id", "fixture", "--limit", "5", "--json"],
                             env=env, timeout=60)
        if "cobalt-orbit-731" not in get_result.stdout or "projects/meridian" not in search_result.stdout:
            raise RuntimeError("gbrain fixture read/search round trip failed")
        server_num = _run([*psql, "-c", "SHOW server_version_num"], env=env).stdout.strip()
        if not re.fullmatch(r"16[0-9]{4}", server_num):
            raise RuntimeError("PostgreSQL major version mismatched")
        server_version = _run([*psql, "-c", "SHOW server_version"], env=env).stdout.strip()
        extension_rows = _run([*psql, "-c", "SELECT extname||'='||extversion FROM pg_extension WHERE extname IN ('vector','pg_trgm','pgcrypto') ORDER BY extname"], env=env).stdout.splitlines()
        extension_map = dict(row.split("=", 1) for row in extension_rows if "=" in row)
        vector_version = extension_map.get("vector", "")
        if set(extension_map) != {"vector", "pg_trgm", "pgcrypto"} or not re.fullmatch(r"[0-9]+\.[0-9]+(?:\.[0-9]+)?", vector_version):
            raise RuntimeError("required PostgreSQL extensions are unavailable")
        migration_version = _run([*psql, "-c", "SELECT value FROM config WHERE key='version'"], env=env).stdout.strip()
        if migration_version != "149":
            raise RuntimeError("gbrain migration version mismatched")
        table_rows = _run([*psql, "-c", "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename"], env=env).stdout.splitlines()
        tables = [row for row in table_rows if row]
        if len(tables) < 10 or "pages" not in tables:
            raise RuntimeError("gbrain schema is incomplete")
        migration_rows = _run([*psql, "-c", "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%migration%' ORDER BY table_name"], env=env).stdout.splitlines()
        config_path = home / ".gbrain" / "config.json"
        config = json.loads(config_path.read_text())
        if config.get("engine") != "postgres" or config.get("schema_pack") != "gbrain-base-v2":
            raise RuntimeError("gbrain config identity is invalid")
        return {
            "database_id": _sha((run_id + ":database:" + db_name).encode()),
            "pgdata_id": _sha((run_id + ":pgdata").encode()),
            "gbrain_home_id": _sha((run_id + ":gbrain-home").encode()),
            "postgres_version": server_version,
            "postgres_version_num": server_num,
            "pgvector_version": vector_version,
            "extension_inventory_sha256": _sha(_canonical(extension_rows)),
            "migration_version": migration_version,
            "schema_inventory_sha256": _sha(_canonical(tables)),
            "schema_table_count": len(tables),
            "migration_inventory_sha256": _sha(_canonical(migration_rows)),
            "config_sha256": _sha(config_path.read_bytes()),
        }
    finally:
        if started:
            _run(["pg_ctl", "-D", str(pgdata), "-m", "fast", "-w", "stop"],
                 env=env, timeout=60)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--attestation", required=True)
    parser.add_argument("--run-id", required=True)
    args = parser.parse_args(argv)
    started = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    env_names = _verify_entry_boundary(args.attestation, args.run_id)
    if not _external_tcp_refused():
        raise RuntimeError("external TCP unexpectedly succeeded")
    manifest, manifest_sha, inventory_sha = _fixture_inventory()
    build = json.loads(BUILD_META.read_text())
    lock = json.loads(LOCK_COPY.read_text())
    if (build.get("run_id") != args.run_id
            or build.get("gbrain", {}).get("commit") != lock.get("gbrain", {}).get("commit")
            or build.get("base_image_digest") != lock.get("base_image", {}).get(
                "platforms", {}).get(build.get("platform"))):
        raise RuntimeError("embedded build provenance mismatched")
    binary_sha = _sha(Path("/usr/local/bin/gbrain").read_bytes())
    if binary_sha != build.get("gbrain", {}).get("executable_sha256"):
        raise RuntimeError("gbrain executable hash mismatched")
    root = Path("/home/tester/integration") / args.run_id
    root.mkdir(parents=True, mode=0o700)
    base_env = {
        "HOME": "/home/tester", "LANG": "C.UTF-8",
        "PATH": "/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin",
    }
    commit, refs_sha, roundtrip_sha = _git_fixture(
        root, args.run_id, base_env, manifest)
    stack = _postgres_and_gbrain(root, args.run_id, root / "brain", base_env)
    receipt = {
        "schema_version": 1,
        "contract": "integration-body-v2",
        "run_id": args.run_id,
        "started_at": started,
        "finished_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "attestation_sha256": _sha(args.attestation.encode()),
        "platform": build["platform"],
        "non_root": True,
        "uid": os.geteuid(),
        "source_baked": True,
        "repository": build["repository"],
        "external_tcp_refused": True,
        "environment_names_sha256": _sha(_canonical(env_names)),
        "artifact_lock_sha256": _sha(_canonical(lock)),
        "base_image_digest": build["base_image_digest"],
        "gbrain": {
            **build["gbrain"],
            "executable_version": "0.50.0.0",
            "executable_sha256": binary_sha,
        },
        "bun": build["bun"],
        "fixtures": {
            "corpus_manifest_sha256": manifest_sha,
            "whole_source_inventory_sha256": inventory_sha,
            "database_id": stack.pop("database_id"),
            "pgdata_id": stack.pop("pgdata_id"),
            "gbrain_home_id": stack.pop("gbrain_home_id"),
            "bare_remote_id": _sha((args.run_id + ":bare-remote").encode()),
            "worktree_commit": commit,
            "bare_refs_sha256": refs_sha,
            "roundtrip_inventory_sha256": roundtrip_sha,
        },
        "postgresql": stack,
    }
    payload = _canonical(receipt)
    target = RESULTS / "body.json"
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(fd, payload)
        os.fsync(fd)
    finally:
        os.close(fd)
    print("integration body PASS")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        print(f"integration body FAILED: {exc}; run only through scripts/test-integration.sh",
              file=sys.stderr)
        raise SystemExit(1)
