#!/usr/bin/env python3
"""Shared offline PostgreSQL/gbrain property fixture for Slice 8."""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import time
from typing import Any
try:
    from gbrain_property_contract import digest as normalized_digest, dry_payload, source_payload
except ModuleNotFoundError:  # Direct host refusal path only.
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from scripts.testing.gbrain_property_contract import digest as normalized_digest, dry_payload, source_payload

ASSETS = Path("/opt/prime-claw-test/assets")
PROPERTY_FIXTURE = ASSETS / "fixtures/brain-properties"
RESULTS = Path("/home/tester/results")
RUN_RE = re.compile(r"^[0-9]{8}T[0-9]{6}Z-[0-9]+-[0-9a-f]{8}$")
PROPERTY_RE = re.compile(r"^(dry-run|source-coverage)-[ab]$")
SHA_RE = re.compile(r"^[0-9a-f]{64}$")


class PropertyError(RuntimeError):
    pass


def canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def config_shape(value: Any) -> Any:
    """Return deterministic config structure without fixture-specific values."""
    if isinstance(value, dict):
        return {key: config_shape(value[key]) for key in sorted(value)}
    if isinstance(value, list):
        return [config_shape(item) for item in value]
    if value is None:
        return "null"
    return type(value).__name__


def sha(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def run(argv: list[str], *, env: dict[str, str], cwd: Path | None = None,
        timeout: int = 180, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(argv, cwd=cwd, env=env, text=True,
                            capture_output=True, timeout=timeout, check=False)
    if check and result.returncode != 0:
        raise PropertyError(
            f"command failed ({result.returncode}): {argv[0]}: "
            f"{result.stderr.strip()[:300]}")
    return result


def verify_entry(attestation: str, run_id: str, property_id: str) -> None:
    if os.environ.get("PRIME_CLAW_INTEGRATION_CONTAINER") != "1":
        raise PropertyError("integration container entry marker is missing")
    if os.environ.get("PRIME_CLAW_INTEGRATION_ATTESTATION") != attestation:
        raise PropertyError("integration attestation mismatch")
    if os.environ.get("PRIME_CLAW_INTEGRATION_RUN_ID") != run_id:
        raise PropertyError("integration run identity mismatch")
    if not RUN_RE.fullmatch(run_id) or not SHA_RE.fullmatch(attestation):
        raise PropertyError("integration identity is malformed")
    if not PROPERTY_RE.fullmatch(property_id):
        raise PropertyError("property identity is malformed")
    if os.geteuid() == 0 or not PROPERTY_FIXTURE.is_dir():
        raise PropertyError("property body boundary is invalid")


def load_manifest() -> tuple[dict[str, Any], str]:
    path = PROPERTY_FIXTURE / "manifest.json"
    value = json.loads(path.read_text())
    if (not isinstance(value, dict) or value.get("schema_version") != 1
            or value.get("fixture") != "prime-claw-gbrain-properties-v1"):
        raise PropertyError("property fixture manifest identity is invalid")
    if set(value) != {"schema_version", "fixture", "initial", "delta", "accounting"}:
        raise PropertyError("property fixture manifest shape is invalid")
    assets: set[str] = set()
    for section in ("initial", "delta"):
        if not isinstance(value[section], list):
            raise PropertyError(f"property fixture {section} is invalid")
        for row in value[section]:
            if not isinstance(row, dict):
                raise PropertyError("property fixture row is invalid")
            asset = row.get("asset")
            digest = row.get("sha256")
            if asset is None:
                continue
            if (not isinstance(asset, str) or Path(asset).is_absolute()
                    or ".." in Path(asset).parts or asset in assets):
                raise PropertyError("property fixture asset is invalid")
            asset_path = PROPERTY_FIXTURE / asset
            if not asset_path.is_file() or sha(asset_path.read_bytes()) != digest:
                raise PropertyError("property fixture asset hash mismatched")
            assets.add(asset)
    observed = {p.relative_to(PROPERTY_FIXTURE).as_posix()
                for p in PROPERTY_FIXTURE.rglob("*.md")}
    if observed != assets:
        raise PropertyError("property fixture contains unmanifested markdown")
    accounting = value["accounting"]
    if not isinstance(accounting, list) or not accounting:
        raise PropertyError("property accounting manifest is invalid")
    pairs = {(r.get("path"), r.get("slug")) for r in accounting if isinstance(r, dict)}
    paths = {r.get("path") for r in accounting if isinstance(r, dict)}
    slugs = {r.get("slug") for r in accounting if isinstance(r, dict)}
    if len(pairs) != len(accounting) or len(paths) != len(accounting) or len(slugs) != len(accounting):
        raise PropertyError("property accounting path/slug identity is not unique")
    declared = {(r["path"], r["slug"]) for r in value["initial"]}
    for row in value["delta"]:
        declared.add((row["path"], row["slug"]))
        if row["operation"] == "rename":
            declared.add((row["from_path"], row["from_slug"]))
    if pairs != declared:
        raise PropertyError("property accounting does not cover every synthetic path/slug")
    operations = [row["operation"] for row in value["delta"]]
    if sorted(operations) != ["add", "delete", "malformed", "modify", "rename"]:
        raise PropertyError("property fixture operation inventory mismatched")
    return value, sha(path.read_bytes())


def _git_env(root: Path) -> dict[str, str]:
    return {
        "HOME": str(root / "git-home"), "LANG": "C.UTF-8",
        "PATH": "/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin",
        "GIT_AUTHOR_NAME": "Prime Claw Fixture", "GIT_AUTHOR_EMAIL": "fixture@invalid.example",
        "GIT_COMMITTER_NAME": "Prime Claw Fixture", "GIT_COMMITTER_EMAIL": "fixture@invalid.example",
    }


def create_git_fixture(root: Path, manifest: dict[str, Any]) -> tuple[Path, Path, dict[str, str]]:
    work, bare = root / "brain", root / "remote.git"
    env = _git_env(root)
    Path(env["HOME"]).mkdir()
    run(["git", "init", "--bare", str(bare)], env=env)
    run(["git", "init", "-b", "main", str(work)], env=env)
    for row in manifest["initial"]:
        target = work / row["path"]
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(PROPERTY_FIXTURE / row["asset"], target)
    run(["git", "add", "-A"], env=env, cwd=work)
    run(["git", "commit", "-m", "property fixture initial"], env=env, cwd=work)
    run(["git", "remote", "add", "origin", str(bare)], env=env, cwd=work)
    run(["git", "push", "-u", "origin", "main"], env=env, cwd=work)
    return work, bare, env


def apply_delta(work: Path, bare: Path, env: dict[str, str], manifest: dict[str, Any]) -> str:
    for row in manifest["delta"]:
        op = row["operation"]
        if op == "rename":
            source, target = work / row["from_path"], work / row["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            run(["git", "mv", str(source.relative_to(work)), str(target.relative_to(work))],
                env=env, cwd=work)
            shutil.copyfile(PROPERTY_FIXTURE / row["asset"], target)
        elif op in {"add", "modify"}:
            target = work / row["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(PROPERTY_FIXTURE / row["asset"], target)
        elif op == "delete":
            run(["git", "rm", row["path"]], env=env, cwd=work)
        elif op == "malformed":
            continue  # exercised as its own bookmark-preserving phase
        else:
            raise PropertyError("unknown property fixture operation")
    run(["git", "add", "-A"], env=env, cwd=work)
    run(["git", "commit", "-m", "property fixture delta"], env=env, cwd=work)
    run(["git", "push", "origin", "main"], env=env, cwd=work)
    return run(["git", "rev-parse", "HEAD"], env=env, cwd=work).stdout.strip()


def apply_malformed(work: Path, bare: Path, env: dict[str, str],
                    manifest: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    rows = [row for row in manifest["delta"] if row["operation"] == "malformed"]
    if len(rows) != 1:
        raise PropertyError("property fixture requires one malformed-frontmatter case")
    row = rows[0]
    target = work / row["path"]
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(PROPERTY_FIXTURE / row["asset"], target)
    run(["git", "add", "-A"], env=env, cwd=work)
    run(["git", "commit", "-m", "property fixture malformed frontmatter"], env=env, cwd=work)
    run(["git", "push", "origin", "main"], env=env, cwd=work)
    return run(["git", "rev-parse", "HEAD"], env=env, cwd=work).stdout.strip(), row


class Stack:
    def __init__(self, root: Path, property_run_id: str, work: Path, bare: Path,
                 git_env: dict[str, str]):
        self.root, self.property_run_id = root, property_run_id
        self.work, self.bare, self.git_env = work, bare, git_env
        self.pgdata, self.socket_dir = root / "pgdata", root / "socket"
        self.home, self.tmpdir = root / "home", root / "tmp"
        self.db_name = "gbrain_" + hashlib.sha256(property_run_id.encode()).hexdigest()[:16]
        for path in (self.socket_dir, self.home, self.tmpdir):
            path.mkdir()
        self.env = {
            "HOME": str(self.home), "GBRAIN_HOME": str(self.home),
            "GBRAIN_SYNC_FAILURES_DIR": str(self.home / ".gbrain"),
            "GBRAIN_SKIP_STARTUP_HOOKS": "1", "NODE_ENV": "test",
            "TMPDIR": str(self.tmpdir), "LANG": "C.UTF-8",
            "PATH": "/usr/lib/postgresql/16/bin:/usr/local/bin:/usr/bin:/bin",
        }
        self.psql = ["psql", "-X", "-A", "-t", "-h", "127.0.0.1", "-p", "5433",
                     "-U", "gbrain", "-d", self.db_name]
        self.started = False

    def __enter__(self) -> "Stack":
        run(["initdb", "--no-locale", "--encoding=UTF8", "-A", "trust",
             "-U", "gbrain", "-D", str(self.pgdata)], env=self.env)
        run(["pg_ctl", "-D", str(self.pgdata), "-l", str(self.root / "postgres.log"),
             "-w", "start", "-o", f"-c listen_addresses=127.0.0.1 -c port=5433 "
             f"-c unix_socket_directories={self.socket_dir}"], env=self.env)
        self.started = True
        run(["createdb", "-h", "127.0.0.1", "-p", "5433", "-U", "gbrain", self.db_name],
            env=self.env)
        run([*self.psql, "-c", "CREATE EXTENSION IF NOT EXISTS vector"], env=self.env)
        url = f"postgresql://gbrain@127.0.0.1:5433/{self.db_name}"
        run(["gbrain", "init", "--url", url, "--non-interactive", "--no-embedding",
             "--skip-embed-check", "--schema-pack", "gbrain-base-v2", "--json"],
            env=self.env, timeout=240)
        run(["gbrain", "init", "--migrate-only", "--json"], env=self.env, timeout=240)
        run(["gbrain", "init", "--migrate-only", "--json"], env=self.env, timeout=240)
        run(["gbrain", "sources", "add", "fixture", "--path", str(self.work),
             "--no-federated"], env=self.env)
        run(["gbrain", "sync", "--source", "fixture", "--no-pull", "--no-embed",
             "--no-extract", "--yes"], env=self.env, timeout=240)
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        if self.started:
            run(["pg_ctl", "-D", str(self.pgdata), "-m", "fast", "-w", "stop"],
                env=self.env, timeout=60)
            self.started = False

    def sql_lines(self, sql: str) -> list[str]:
        return [line for line in run([*self.psql, "-c", sql], env=self.env).stdout.splitlines()
                if line.strip()]

    def _schema_rows(self) -> list[dict[str, Any]]:
        queries = [
            "SELECT jsonb_build_object('kind','column','table',table_name,'ordinal',ordinal_position,'name',column_name,'type',data_type,'udt',udt_name,'nullable',is_nullable,'default',column_default)::text FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
            "SELECT jsonb_build_object('kind','index','name',indexname,'table',tablename,'def',indexdef)::text FROM pg_indexes WHERE schemaname='public' ORDER BY tablename,indexname",
            "SELECT jsonb_build_object('kind','constraint','name',c.conname,'table',c.conrelid::regclass::text,'def',pg_get_constraintdef(c.oid,true))::text FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' ORDER BY c.conrelid::regclass::text,c.conname",
            "SELECT jsonb_build_object('kind','trigger','name',t.tgname,'table',t.tgrelid::regclass::text,'def',pg_get_triggerdef(t.oid,true))::text FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY t.tgrelid::regclass::text,t.tgname",
            "SELECT jsonb_build_object('kind','function','name',p.oid::regprocedure::text,'def',pg_get_functiondef(p.oid))::text FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY p.oid::regprocedure::text",
        ]
        rows: list[dict[str, Any]] = []
        for query in queries:
            rows.extend(json.loads(line) for line in self.sql_lines(query))
        return rows

    def _table_rows(self) -> tuple[dict[str, str], dict[str, int]]:
        tables = self.sql_lines(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")
        hashes: dict[str, str] = {}
        counts: dict[str, int] = {}
        for table in tables:
            quoted = table.replace('"', '""')
            rows = [json.loads(line) for line in self.sql_lines(
                f'SELECT to_jsonb(t)::text FROM public."{quoted}" t ORDER BY to_jsonb(t)::text')]
            hashes[table] = sha(canonical(rows))
            counts[table] = len(rows)
        return hashes, counts

    def snapshot(self) -> dict[str, Any]:
        schema_rows = self._schema_rows()
        table_hashes, table_counts = self._table_rows()
        config_path = self.home / ".gbrain" / "config.json"
        config = json.loads(config_path.read_text())
        ledger = self.home / ".gbrain" / "sync-failures.jsonl"
        ledger_lock = self.home / ".gbrain" / "sync-failures.jsonl.lock"
        git_head = run(["git", "rev-parse", "HEAD"], env=self.git_env, cwd=self.work).stdout.strip()
        git_tree = run(["git", "ls-tree", "-r", "HEAD"], env=self.git_env, cwd=self.work).stdout.encode()
        git_status = run(["git", "status", "--porcelain=v1", "--untracked-files=all"],
                         env=self.git_env, cwd=self.work).stdout.encode()
        refs = run(["git", "for-each-ref", "--format=%(refname):%(objectname)"],
                   env=self.git_env, cwd=self.bare).stdout.encode()
        sessions = int(self.sql_lines(
            "SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid()")[-1])
        advisory = int(self.sql_lines(
            "SELECT count(*) FROM pg_locks WHERE locktype='advisory' AND granted")[-1])
        cycle_hash = table_hashes.get("gbrain_cycle_locks", sha(canonical([])))
        migration_version = self.sql_lines("SELECT value FROM config WHERE key='version'")[-1]
        source_rows = [json.loads(line) for line in self.sql_lines(
            "SELECT to_jsonb(s)::text FROM sources s WHERE id='fixture'")]
        if len(source_rows) != 1:
            raise PropertyError("fixture source bookmark row is unavailable")
        sequence_rows = [json.loads(line) for line in self.sql_lines(
            "SELECT jsonb_build_object('name',sequencename,'type',data_type,'start',start_value,'min',min_value,'max',max_value,'increment',increment_by,'cycle',cycle,'cache',cache_size,'last',last_value)::text FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")]
        return {
            "schema_sha256": sha(canonical(schema_rows)),
            "schema_object_count": len(schema_rows),
            "migration_version": migration_version,
            "source_bookmark": source_rows[0],
            "sequence_sha256": sha(canonical(sequence_rows)),
            "sequence_count": len(sequence_rows),
            "table_hashes": table_hashes,
            "table_row_counts": table_counts,
            "rows_sha256": sha(canonical(table_hashes)),
            "failure_ledger_sha256": sha(ledger.read_bytes() if ledger.exists() else b""),
            "failure_ledger_lock": {
                "exists": ledger_lock.exists(),
                "sha256": sha(ledger_lock.read_bytes()) if ledger_lock.exists() else sha(b""),
            },
            "persistent_locks": {"cycle_rows_sha256": cycle_hash,
                                 "advisory_lock_count": advisory},
            "post_exit_fixture_sessions": sessions,
            "config_sha256": sha(canonical(config)),
            "config_raw_sha256": sha(config_path.read_bytes()),
            "config_semantics_sha256": sha(canonical(config_shape(config))),
            "worktree": {"head": git_head, "status_sha256": sha(git_status),
                         "tree_sha256": sha(git_tree)},
            "bare_refs_sha256": sha(refs),
        }

    def stack_identity(self) -> dict[str, Any]:
        version = run(["gbrain", "--version"], env=self.env).stdout.strip()
        server = self.sql_lines("SHOW server_version")[-1]
        server_num = self.sql_lines("SHOW server_version_num")[-1]
        vector = self.sql_lines("SELECT extversion FROM pg_extension WHERE extname='vector'")[-1]
        return {
            "database_id": sha((self.property_run_id + ":" + self.db_name).encode()),
            "pgdata_id": sha((self.property_run_id + ":pgdata").encode()),
            "gbrain_home_id": sha((self.property_run_id + ":home").encode()),
            "database_name_sha256": sha(self.db_name.encode()),
            "gbrain_version": version,
            "postgres_version": server,
            "postgres_version_num": server_num,
            "pgvector_version": vector,
        }


def sanitized_output(text: str, *, root: Path, db_name: str, run_id: str) -> str:
    value = text.replace(str(root), "<fixture-root>").replace(db_name, "<fixture-db>")
    return value.replace(run_id, "<fixture-run>")


def _case_root(run_id: str, property_id: str) -> Path:
    root = Path("/home/tester/integration") / run_id / property_id
    root.mkdir(parents=True, mode=0o700)
    return root


def _write_receipt(property_id: str, value: dict[str, Any]) -> None:
    RESULTS.mkdir(parents=True, exist_ok=True)
    target = RESULTS / f"{property_id}.json"
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        os.write(fd, canonical(value)); os.fsync(fd)
    finally:
        os.close(fd)


def run_dry_property(attestation: str, run_id: str, property_id: str) -> dict[str, Any]:
    verify_entry(attestation, run_id, property_id)
    manifest, manifest_sha = load_manifest()
    root = _case_root(run_id, property_id)
    work, bare, git_env = create_git_fixture(root, manifest)
    with Stack(root, f"{run_id}:{property_id}", work, bare, git_env) as stack:
        delta_commit = apply_delta(work, bare, git_env, manifest)
        before = stack.snapshot()
        command = ["gbrain", "sync", "--source", "fixture", "--dry-run",
                   "--no-pull", "--no-embed", "--yes"]
        result = run(command, env=stack.env, timeout=240, check=False)
        after = stack.snapshot()
        if result.returncode != 0:
            raise PropertyError("gbrain dry-run did not exit zero")
        if before != after:
            changed = sorted(key for key in before if before[key] != after[key])
            raise PropertyError("gbrain dry-run mutated logical state: " + ",".join(changed))
        if "dry run" not in (result.stdout + result.stderr).lower():
            raise PropertyError("gbrain dry-run output lacked dry-run semantics")
        stack_identity = stack.stack_identity()
    normalized = dry_payload(command=command, exit_code=result.returncode,
                             logical_mutation=False, snapshot=before)
    receipt = {
        "schema_version": 1, "contract": "gbrain-dry-run-v1",
        "run_id": run_id, "property_run_id": property_id,
        "fixture_manifest_sha256": manifest_sha,
        "delta_commit": delta_commit,
        "command": command, "outcome": "exited", "exit_code": result.returncode,
        "stdout": sanitized_output(result.stdout, root=root, db_name=stack.db_name, run_id=run_id),
        "stderr": sanitized_output(result.stderr, root=root, db_name=stack.db_name, run_id=run_id),
        "stdout_sha256": sha(result.stdout.encode()),
        "stderr_sha256": sha(result.stderr.encode()),
        "snapshot_before": before, "snapshot_after": after,
        "logical_mutation": False,
        "normalized_result_sha256": normalized_digest(normalized),
        "stack": stack_identity, "postgres_stopped": not stack.started,
    }
    _write_receipt(property_id, receipt)
    return receipt


def _page_rows(stack: Stack) -> list[dict[str, Any]]:
    lines = stack.sql_lines(
        "SELECT jsonb_build_object('slug',slug,'path',source_path,'deleted',deleted_at IS NOT NULL,'title',title)::text FROM pages WHERE source_id='fixture' ORDER BY slug")
    return [json.loads(line) for line in lines]


def _account(manifest: dict[str, Any], pages: list[dict[str, Any]]) -> dict[str, Any]:
    by_slug = {row["slug"]: row for row in pages}
    by_path = {row["path"]: row for row in pages}
    if len(by_slug) != len(pages) or len(by_path) != len(pages):
        raise PropertyError("duplicate source path/slug row")
    records: list[dict[str, Any]] = []
    represented: set[str] = set()
    for expected in manifest["accounting"]:
        state, slug, path = expected["state"], expected["slug"], expected["path"]
        row = by_slug.get(slug)
        representation = "absent"
        if state == "live":
            ok = row is not None and row["path"] == path and row["deleted"] is False
            representation = "row"
            if ok: represented.add(slug)
        elif state == "deleted":
            ok = row is not None and row["path"] == path and row["deleted"] is True
            representation = "tombstone"
            if ok: represented.add(slug)
        elif state == "superseded":
            ok = (row is None or (row["path"] == path and row["deleted"] is True))                 and isinstance(expected.get("reason"), str)
            representation = "absent" if row is None else "tombstone"
            if ok and row is not None: represented.add(slug)
        elif state == "excluded":
            ok = row is None and isinstance(expected.get("reason"), str)
        else:
            raise PropertyError("unknown accounting state")
        if not ok:
            raise PropertyError(
                f"source accounting mismatch for {path} ({state}); observed={row!r}")
        records.append({"path": path, "slug": slug, "state": state,
                        "representation": representation,
                        **({"reason": expected["reason"]} if "reason" in expected else {})})
    unexpected = sorted(set(by_slug) - represented)
    if unexpected:
        raise PropertyError("unaccounted database slug(s): " + ",".join(unexpected))
    if len(records) != len({(r["path"], r["slug"]) for r in records}):
        raise PropertyError("duplicate manifest path/slug accounting")
    return {"records": records, "database_rows": pages,
            "path_count": len(records), "row_count": len(pages),
            "exclusion_count": sum(r["state"] in {"superseded", "excluded"} for r in records)}


def run_source_property(attestation: str, run_id: str, property_id: str) -> dict[str, Any]:
    verify_entry(attestation, run_id, property_id)
    manifest, manifest_sha = load_manifest()
    root = _case_root(run_id, property_id)
    work, bare, git_env = create_git_fixture(root, manifest)
    with Stack(root, f"{run_id}:{property_id}", work, bare, git_env) as stack:
        delta_commit = apply_delta(work, bare, git_env, manifest)
        command = ["gbrain", "sync", "--source", "fixture", "--no-pull",
                   "--no-embed", "--no-extract", "--yes"]
        result = run(command, env=stack.env, timeout=240, check=False)
        if result.returncode != 0:
            raise PropertyError("gbrain source-coverage sync did not exit zero")
        pages = _page_rows(stack)
        accounting = _account(manifest, pages)
        valid_bookmark = stack.sql_lines(
            "SELECT last_commit FROM sources WHERE id='fixture'")[-1]
        if valid_bookmark != delta_commit:
            raise PropertyError("source coverage bookmark did not reach valid delta")
        get_result = run(["gbrain", "get", "projects/meridian", "--source-id", "fixture", "--json"],
                         env=stack.env, timeout=60)
        search_result = run(["gbrain", "search", "cobalt-property-882", "--source-id", "fixture",
                             "--limit", "5", "--json"], env=stack.env, timeout=60)
        if "cobalt-property-882" not in get_result.stdout or "projects/meridian" not in search_result.stdout:
            raise PropertyError("source coverage read/search round trip failed")
        valid_snapshot = stack.snapshot()
        bookmark_before = valid_bookmark
        malformed_commit, malformed_row = apply_malformed(work, bare, git_env, manifest)
        malformed_result = run(command, env=stack.env, timeout=240, check=False)
        malformed_pages = _page_rows(stack)
        bookmark_after = stack.sql_lines(
            "SELECT last_commit FROM sources WHERE id='fixture'")[-1]
        ledger = stack.home / ".gbrain" / "sync-failures.jsonl"
        ledger_text = ledger.read_text() if ledger.exists() else ""
        if bookmark_after != bookmark_before or malformed_pages != pages:
            raise PropertyError("malformed frontmatter changed bookmark or page rows")
        if malformed_row["path"] not in ledger_text or "frontmatter" not in ledger_text.lower():
            raise PropertyError("malformed frontmatter lacked named failure-ledger exclusion")
        if any(row["slug"] == malformed_row["slug"] for row in malformed_pages):
            raise PropertyError("malformed frontmatter unexpectedly created a page row")
        malformed = {
            "path": malformed_row["path"], "slug": malformed_row["slug"],
            "reason": malformed_row["reason"], "commit": malformed_commit,
            "command": command, "outcome": "exited", "exit_code": malformed_result.returncode,
            "stdout": sanitized_output(malformed_result.stdout, root=root, db_name=stack.db_name, run_id=run_id),
            "stderr": sanitized_output(malformed_result.stderr, root=root, db_name=stack.db_name, run_id=run_id),
            "bookmark_before": bookmark_before, "bookmark_after": bookmark_after,
            "rows_before_sha256": sha(canonical(pages)),
            "rows_after_sha256": sha(canonical(malformed_pages)),
            "failure_ledger_sha256": sha(ledger_text.encode()),
            "stdout_sha256": sha(malformed_result.stdout.encode()),
            "stderr_sha256": sha(malformed_result.stderr.encode()),
        }
        stack_identity = stack.stack_identity()
    normalized = source_payload(command=command, accounting=accounting,
                                malformed=malformed)
    receipt = {
        "schema_version": 1, "contract": "gbrain-source-coverage-v1",
        "run_id": run_id, "property_run_id": property_id,
        "fixture_manifest_sha256": manifest_sha,
        "delta_commit": delta_commit,
        "command": command, "outcome": "exited", "exit_code": result.returncode,
        "stdout": sanitized_output(result.stdout, root=root, db_name=stack.db_name, run_id=run_id),
        "stderr": sanitized_output(result.stderr, root=root, db_name=stack.db_name, run_id=run_id),
        "stdout_sha256": sha(result.stdout.encode()),
        "stderr_sha256": sha(result.stderr.encode()),
        "accounting": accounting, "logical_snapshot": valid_snapshot,
        "malformed_frontmatter": malformed,
        "normalized_result_sha256": normalized_digest(normalized),
        "stack": stack_identity, "postgres_stopped": not stack.started,
    }
    _write_receipt(property_id, receipt)
    return receipt
