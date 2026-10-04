#!/usr/bin/env python3
"""Container payload for an isolated Prime Agent source release build."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import sys
from typing import Any

DIST_DIRS = (
    "packages/coding-agent/dist",
    "packages/agent/dist",
    "packages/ai/dist",
    "packages/tui/dist",
)
SEMVER = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?")
SHA256 = re.compile(r"[0-9a-f]{64}")


class BuildError(RuntimeError):
    pass


def _canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":"),
                       ensure_ascii=True) + "\n").encode("utf-8")


def _framed_hash(records: list[dict[str, Any]], domain: str) -> str:
    digest = hashlib.sha256()
    digest.update(("prime-claw:" + domain + "\0").encode("ascii"))
    for record in records:
        payload = _canonical(record)
        digest.update(len(payload).to_bytes(8, "big"))
        digest.update(payload)
    return digest.hexdigest()


def _safe_relative(raw: Any) -> PurePosixPath:
    if not isinstance(raw, str) or not raw or "\0" in raw:
        raise BuildError("invalid source record path")
    path = PurePosixPath(raw)
    if path.is_absolute() or any(part in {"", ".", ".."} for part in path.parts):
        raise BuildError("unsafe source record path")
    return path


def _hash_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def _validate_manifest(value: Any) -> dict[str, Any]:
    if not isinstance(value, dict) or set(value) != {
        "schema_version", "identity", "include_rule", "exclude_rule", "records"
    }:
        raise BuildError("invalid source manifest shape")
    if value["schema_version"] != 1:
        raise BuildError("unsupported source manifest schema")
    identity = value["identity"]
    records = value["records"]
    if not isinstance(identity, dict) or not isinstance(records, list):
        raise BuildError("invalid source manifest identity")
    expected_identity = {
        "head", "dirty", "status_sha256", "content_sha256", "entry_count",
        "content_hash_contract",
    }
    if set(identity) != expected_identity:
        raise BuildError("invalid source identity shape")
    if (not re.fullmatch(r"[0-9a-f]{40,64}", str(identity["head"]))
            or not isinstance(identity["dirty"], bool)
            or not SHA256.fullmatch(str(identity["status_sha256"]))
            or not SHA256.fullmatch(str(identity["content_sha256"]))
            or identity["entry_count"] != len(records)
            or identity["content_hash_contract"] != "framed-sha256-v2"):
        raise BuildError("invalid source identity")
    if value["include_rule"] != "git-cached-plus-nonignored-untracked-v1":
        raise BuildError("unsupported source include rule")
    if value["exclude_rule"] != "git-standard-ignored-and-dotgit-v1":
        raise BuildError("unsupported source exclude rule")
    previous = None
    for record in records:
        if not isinstance(record, dict):
            raise BuildError("invalid source record")
        path = _safe_relative(record.get("path"))
        if previous is not None and str(path) <= previous:
            raise BuildError("source records are not strictly ordered")
        previous = str(path)
        kind = record.get("kind")
        mode = record.get("mode")
        if (kind not in {"file", "symlink", "missing"}
                or isinstance(mode, bool) or not isinstance(mode, int)
                or mode < 0 or mode > 0o7777):
            raise BuildError("invalid source record metadata")
        if kind == "file" and not SHA256.fullmatch(str(record.get("content_sha256"))):
            raise BuildError("invalid source file digest")
        if kind == "symlink":
            target = record.get("target")
            if not isinstance(target, str) or not target or os.path.isabs(target):
                raise BuildError("invalid source link target")
        if kind == "missing" and record.get("content_sha256") is not None:
            raise BuildError("invalid missing source record")
    if _framed_hash(records, "repository-v2") != identity["content_sha256"]:
        raise BuildError("source identity does not match records")
    return value


def _copy_source(source: Path, destination: Path,
                 records: list[dict[str, Any]]) -> None:
    destination.mkdir(mode=0o700)
    source_root = source.resolve(strict=True)
    for record in records:
        relative = _safe_relative(record["path"])
        src = source_root.joinpath(*relative.parts)
        dst = destination.joinpath(*relative.parts)
        kind = record["kind"]
        if kind == "missing":
            if src.exists() or src.is_symlink():
                raise BuildError("missing source record appeared")
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        observed = src.lstat()
        mode = stat.S_IMODE(observed.st_mode)
        if mode != record["mode"]:
            raise BuildError("source mode changed during builder copy")
        if kind == "symlink":
            if not stat.S_ISLNK(observed.st_mode):
                raise BuildError("source link changed type")
            target = os.readlink(src)
            if target != record["target"]:
                raise BuildError("source link target changed")
            os.symlink(target, dst)
            continue
        if not stat.S_ISREG(observed.st_mode):
            raise BuildError("source file changed type")
        flags = os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0)
        fd = os.open(src, flags)
        try:
            opened = os.fstat(fd)
            if (opened.st_dev, opened.st_ino, opened.st_mode) != (
                    observed.st_dev, observed.st_ino, observed.st_mode):
                raise BuildError("source file changed while opened")
            digest = hashlib.sha256()
            with dst.open("xb") as output:
                while chunk := os.read(fd, 1024 * 1024):
                    digest.update(chunk)
                    output.write(chunk)
            after = os.fstat(fd)
            stable = (opened.st_dev, opened.st_ino, opened.st_mode,
                      opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns)
            final = (after.st_dev, after.st_ino, after.st_mode,
                     after.st_size, after.st_mtime_ns, after.st_ctime_ns)
            if stable != final or digest.hexdigest() != record["content_sha256"]:
                raise BuildError("source file changed while copied")
            dst.chmod(mode)
        finally:
            os.close(fd)


def _remove_local_output(path: Path) -> None:
    try:
        mode = path.lstat().st_mode
    except FileNotFoundError:
        return
    if stat.S_ISDIR(mode) and not stat.S_ISLNK(mode):
        shutil.rmtree(path)
    else:
        path.unlink()


def _run(argv: list[str], cwd: Path, env: dict[str, str]) -> None:
    try:
        result = subprocess.run(argv, cwd=cwd, env=env,
                                stdin=subprocess.DEVNULL,
                                stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL, timeout=540)
    except (OSError, subprocess.SubprocessError) as exc:
        raise BuildError("isolated build command failed") from exc
    if result.returncode != 0:
        raise BuildError("isolated build command returned nonzero")


def _collect_outputs(release: Path, output: Path,
                     version: str) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    artifacts = release / "artifacts"
    if not artifacts.is_dir() or artifacts.is_symlink():
        raise BuildError("release pack did not produce artifacts")
    output_artifacts = output / "artifacts"
    output_artifacts.mkdir(mode=0o755)
    records: list[dict[str, Any]] = []
    for source_file in sorted(artifacts.rglob("*"), key=lambda p: p.as_posix()):
        relative = source_file.relative_to(artifacts)
        if source_file.is_symlink():
            raise BuildError("release output contains a symlink")
        if source_file.is_dir():
            continue
        observed = source_file.stat()
        if not stat.S_ISREG(observed.st_mode):
            raise BuildError("release output contains a special file")
        destination = output_artifacts / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source_file, destination)
        destination.chmod(0o644)
        records.append({
            "path": (PurePosixPath("artifacts") / PurePosixPath(relative.as_posix())).as_posix(),
            "kind": "file", "mode": 0o644,
            "size": destination.stat().st_size,
            "content_sha256": _hash_file(destination),
        })
    main_name = f"prime-agent-{version}.tgz"
    mains = [record for record in records if record["path"] == f"artifacts/{main_name}"]
    if len(mains) != 1:
        raise BuildError("release pack did not produce one main tarball")
    if not records:
        raise BuildError("release output inventory is empty")
    return records, dict(mains[0])


def build(source: Path, manifest_path: Path, output: Path, work: Path) -> dict[str, Any]:
    manifest = _validate_manifest(json.loads(manifest_path.read_text(encoding="utf-8")))
    work.mkdir(parents=True, exist_ok=True)
    local = work / "source"
    _copy_source(source, local, manifest["records"])
    package = json.loads((local / "package.json").read_text(encoding="utf-8"))
    version = package.get("version") if isinstance(package, dict) else None
    if not isinstance(version, str) or not SEMVER.fullmatch(version):
        raise BuildError("source package version is invalid")
    for relative in (*DIST_DIRS, "packages/coding-agent/release/tier1"):
        _remove_local_output(local / relative)
    env = {
        "HOME": "/tmp/prime-claw-builder-home",
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HUSKY": "0", "CI": "1", "npm_config_update_notifier": "false",
        "npm_config_audit": "false", "npm_config_fund": "false",
    }
    Path(env["HOME"]).mkdir(mode=0o700, exist_ok=True)
    _run(["npm", "ci"], local, env)
    for relative in DIST_DIRS:
        _remove_local_output(local / relative)
    _run(["npm", "run", "build"], local, env)
    pack_command = [
        "node", "scripts/pack-prime-agent-release.mjs", "--base-url",
        "file:///stage", "--out-dir", "packages/coding-agent/release/tier1",
    ]
    _run(pack_command, local, env)
    records, main = _collect_outputs(
        local / "packages/coding-agent/release/tier1", output, version)
    return {
        "schema_version": 1,
        "source": manifest["identity"],
        "source_rules": {"include": manifest["include_rule"],
                         "exclude": manifest["exclude_rule"]},
        "package_version": version,
        "pack_command_sha256": hashlib.sha256(_canonical(pack_command)).hexdigest(),
        "artifact": main,
        "output_inventory": records,
        "output_inventory_sha256": _framed_hash(records, "source-builder-output-v1"),
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="/source")
    parser.add_argument("--manifest", default="/input/source-manifest.json")
    parser.add_argument("--output", default="/output")
    parser.add_argument("--work", default="/work")
    args = parser.parse_args(argv)
    stage = "initialization"
    try:
        output = Path(args.output)
        if output.exists():
            if output.is_symlink() or any(output.iterdir()):
                raise BuildError("builder output must be an empty directory")
        else:
            output.mkdir(mode=0o700)
        stage = "build-and-pack"
        result = build(Path(args.source), Path(args.manifest), output, Path(args.work))
        stage = "publication"
        target = output / "builder-output.json"
        temporary = output / ".builder-output.tmp"
        with temporary.open("x", encoding="utf-8") as handle:
            json.dump(result, handle, sort_keys=True, separators=(",", ":"))
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, target)
        return 0
    except (BuildError, OSError, ValueError, json.JSONDecodeError):
        print(f"source builder failed during {stage}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
