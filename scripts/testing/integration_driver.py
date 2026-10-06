#!/usr/bin/env python3
"""Trusted-host launcher for the disposable gbrain/PostgreSQL integration tier."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import stat
import sys
import tarfile
import tempfile
import time
from typing import Any

from scripts.testing import bounded
from scripts.testing import integration_provenance as ip

REPO = Path(__file__).resolve().parents[2]
DOCKERFILE = REPO / "docker/test-integration.Dockerfile"
LOCK_PATH = REPO / "config/test-artifacts.lock.json"
BODY_PATH = REPO / "tests/integration/environment_body.py"
FIXTURE_PATH = REPO / "tests/fixtures/brain-source"
IMAGE_REPO = "prime-claw-test-integration"
DEFAULT_RESULTS = REPO / ".test-results"


class IntegrationError(RuntimeError):
    def __init__(self, message: str, *, code: str = "command-failed"):
        super().__init__(message)
        self.code = code


def _run(argv: list[str], *, timeout: float, text: bool = True) -> bounded.BoundedResult:
    return bounded.run_completed(
        argv, timeout=timeout, kill_grace=5, reap_grace=5,
        capture_output=True, text=text)


def _command(argv: list[str], *, timeout: float = 60,
             text: bool = True) -> bounded.BoundedResult:
    result = _run(argv, timeout=timeout, text=text)
    if result.outcome != "exited" or result.returncode != 0:
        raise IntegrationError(
            f"command did not exit cleanly: {argv[0]} ({result.outcome})",
            code=result.outcome if result.outcome != "exited" else "command-failed")
    return result


def _json_command(argv: list[str], *, timeout: float = 60) -> Any:
    result = _command(argv, timeout=timeout)
    try:
        return json.loads(result.stdout or "")
    except json.JSONDecodeError as exc:
        raise IntegrationError(f"command returned invalid JSON: {argv[0]}") from exc


def _sha(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()


def _canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def _utc() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _run_id() -> str:
    return time.strftime("%Y%m%dT%H%M%SZ", time.gmtime()) + f"-{os.getpid()}-{secrets.token_hex(4)}"


def _selected_repository_files() -> list[Path]:
    fixed = [
        DOCKERFILE, LOCK_PATH, BODY_PATH,
        REPO / "scripts/test-integration.sh",
        REPO / "scripts/testing/integration_driver.py",
        REPO / "scripts/testing/integration_provenance.py",
    ]
    fixtures = sorted(path for path in FIXTURE_PATH.rglob("*") if path.is_file())
    return fixed + fixtures


def repository_identity(repo: Path = REPO) -> dict[str, Any]:
    head = (_command(["git", "-C", str(repo), "rev-parse", "HEAD"]).stdout or "").strip()
    if not re.fullmatch(r"[0-9a-f]{40,64}", head):
        raise IntegrationError("repository HEAD is invalid")
    status_payload = (_command([
        "git", "-C", str(repo), "status", "--porcelain=v1",
        "--untracked-files=all"]).stdout or "").encode()
    rows = []
    for path in _selected_repository_files():
        relative = path.relative_to(repo).as_posix()
        payload = path.read_bytes()
        rows.append({
            "path": relative,
            "mode": stat.S_IMODE(path.stat().st_mode),
            "sha256": _sha(payload),
        })
    return {
        "head": head,
        "dirty": bool(status_payload),
        "content_sha256": _sha(_canonical(rows)),
        "selected_file_count": len(rows),
    }


def _platform() -> str:
    raw = (_command([
        "docker", "info", "--format", "{{.OSType}}/{{.Architecture}}"
    ]).stdout or "").strip()
    aliases = {"linux/aarch64": "linux/arm64", "linux/x86_64": "linux/amd64"}
    value = aliases.get(raw, raw)
    if value not in ip.SUPPORTED_PLATFORMS:
        raise IntegrationError("Docker server platform is unsupported")
    return value


def _gbrain_archive(lock: dict[str, Any], mirror: str | None,
                    scratch: Path) -> bytes:
    gbrain = lock["gbrain"]
    if mirror:
        source = Path(mirror)
        if not source.is_absolute() or not source.exists():
            raise IntegrationError("gbrain mirror must be an existing absolute path")
        commit = (_command([
            "git", "-C", str(source), "rev-parse", gbrain["commit"] + "^{commit}"
        ]).stdout or "").strip()
        tree = (_command([
            "git", "-C", str(source), "rev-parse", gbrain["commit"] + "^{tree}"
        ]).stdout or "").strip()
        archive = _command([
            "git", "-C", str(source), "archive", "--format=tar", gbrain["commit"]
        ], timeout=180, text=False).stdout or b""
    else:
        bare = scratch / "gbrain.git"
        _command(["git", "init", "--bare", str(bare)])
        _command(["git", "--git-dir", str(bare), "fetch", "--depth=1",
                  gbrain["origin"], gbrain["commit"]], timeout=600)
        commit = (_command([
            "git", "--git-dir", str(bare), "rev-parse", "FETCH_HEAD^{commit}"
        ]).stdout or "").strip()
        tree = (_command([
            "git", "--git-dir", str(bare), "rev-parse", "FETCH_HEAD^{tree}"
        ]).stdout or "").strip()
        archive = _command([
            "git", "--git-dir", str(bare), "archive", "--format=tar", commit
        ], timeout=180, text=False).stdout or b""
    if commit != gbrain["commit"] or tree != gbrain["tree"]:
        raise IntegrationError("gbrain commit/tree mismatched artifact lock")
    if not isinstance(archive, bytes) or _sha(archive) != gbrain["archive_sha256"]:
        raise IntegrationError("gbrain archive mismatched artifact lock")
    return archive


def _bun_archive(lock: dict[str, Any], platform: str) -> bytes:
    bun = lock["bun"]
    row = bun["platforms"][platform]
    url = ("https://github.com/oven-sh/bun/releases/download/"
           f"bun-v{bun['version']}/{row['artifact']}")
    payload = _command([
        "curl", "--fail", "--location", "--silent", "--show-error",
        "--proto", "=https", "--tlsv1.2", url,
    ], timeout=300, text=False).stdout or b""
    if not isinstance(payload, bytes) or _sha(payload) != row["sha256"]:
        raise IntegrationError("Bun artifact mismatched artifact lock")
    return payload


def prepare_build_context(context: Path, scratch: Path, *,
                          lock: dict[str, Any], platform: str,
                          run_id: str, repository: dict[str, Any],
                          mirror: str | None) -> str:
    context.mkdir(mode=0o700)
    archive = _gbrain_archive(lock, mirror, scratch)
    gbrain_dir = context / "gbrain"
    gbrain_dir.mkdir()
    try:
        with tarfile.open(fileobj=__import__("io").BytesIO(archive), mode="r:") as handle:
            handle.extractall(gbrain_dir, filter="data")
    except tarfile.TarError as exc:
        raise IntegrationError("gbrain archive extraction failed") from exc
    package = json.loads((gbrain_dir / "package.json").read_text())
    if package.get("version") != lock["gbrain"]["package_version"]:
        raise IntegrationError("gbrain package version mismatched artifact lock")
    (context / "bun-artifact.zip").write_bytes(_bun_archive(lock, platform))
    shutil.copy2(DOCKERFILE, context / "Dockerfile")
    (context / "artifact-lock.json").write_bytes(_canonical(lock))
    assets = context / "assets"
    assets.mkdir()
    shutil.copy2(BODY_PATH, assets / "environment_body.py")
    shutil.copytree(FIXTURE_PATH, assets / "fixtures" / "brain-source")
    build = {
        "schema_version": 1,
        "run_id": run_id,
        "platform": platform,
        "repository": repository,
        "base_image_digest": lock["base_image"]["platforms"][platform],
        "bun": {
            "version": lock["bun"]["version"],
            "artifact_sha256": lock["bun"]["platforms"][platform]["sha256"],
        },
        "gbrain": dict(lock["gbrain"]),
    }
    (context / "integration-build.json").write_bytes(_canonical(build))
    rows = []
    for path in sorted(value for value in context.rglob("*") if value.is_file()):
        rows.append({"path": path.relative_to(context).as_posix(),
                     "sha256": _sha(path.read_bytes())})
    return _sha(_canonical(rows))


def _build_image(run_dir: Path, context: Path, *, run_id: str,
                 platform: str, lock: dict[str, Any], tag: str,
                 rebuild: bool) -> tuple[dict[str, Any], str]:
    iidfile = run_dir / "image.iid"
    bun = lock["bun"]["platforms"][platform]
    base = lock["base_image"]
    command = [
        "docker", "build", "--platform", platform,
        "--iidfile", str(iidfile), "-t", tag,
        "--build-arg", f"BASE_IMAGE={base['reference']}@{base['platforms'][platform]}",
        "--build-arg", f"BUN_ARCHIVE_DIRECTORY={bun['archive_directory']}",
        "--build-arg", f"BUN_COMPILE_TARGET={bun['compile_target']}",
        "--build-arg", f"BUN_VERSION={lock['bun']['version']}",
        "--build-arg", f"TEST_RUN_ID={run_id}",
    ]
    if rebuild:
        command.append("--no-cache")
    command.append(str(context))
    _command(command, timeout=900)
    try:
        image_id = iidfile.read_text().strip()
    except OSError as exc:
        raise IntegrationError("Docker did not publish an iidfile") from exc
    rows = _json_command(["docker", "image", "inspect", image_id])
    if not isinstance(rows, list) or len(rows) != 1:
        raise IntegrationError("image inspect returned the wrong row count")
    image = ip.validate_image(rows[0], image_id=image_id, run_id=run_id,
                              platform=platform, tag=tag)
    return image, image_id


def _create_container(run_dir: Path, *, run_id: str, image_id: str,
                      name: str) -> tuple[dict[str, Any], str]:
    cidfile = run_dir / "container.cid"
    attestation = _sha(f"{run_id}:{image_id}".encode())
    _command([
        "docker", "create", "--cidfile", str(cidfile), "--name", name,
        "--label", f"org.prime-claw.test.contract={ip.CONTRACT}",
        "--label", f"org.prime-claw.test.run={run_id}",
        "--network", "none",
        "--env", f"PRIME_CLAW_INTEGRATION_ATTESTATION={attestation}",
        "--env", f"PRIME_CLAW_INTEGRATION_RUN_ID={run_id}",
        image_id,
    ])
    try:
        container_id = cidfile.read_text().strip()
    except OSError as exc:
        raise IntegrationError("Docker did not publish a cidfile") from exc
    if not re.fullmatch(r"[0-9a-f]{64}", container_id):
        raise IntegrationError("Docker published an invalid container ID")
    _command(["docker", "start", container_id])
    rows = _json_command(["docker", "inspect", container_id])
    if not isinstance(rows, list) or len(rows) != 1:
        raise IntegrationError("container inspect returned the wrong row count")
    boundary = ip.validate_container(
        rows[0], container_id=container_id, image_id=image_id,
        run_id=run_id, name=name)
    boundary["attestation_sha256"] = attestation
    return boundary, container_id


def _run_body(container_id: str, *, run_id: str, attestation: str) -> None:
    _command([
        "docker", "exec", container_id, "python3",
        "/opt/prime-claw-test/assets/environment_body.py",
        "--attestation", attestation, "--run-id", run_id,
    ], timeout=300)


def _stop_and_copy(container_id: str, destination: Path) -> dict[str, Any]:
    _command(["docker", "stop", "--time", "10", container_id], timeout=30)
    _command([
        "docker", "cp",
        f"{container_id}:/home/tester/results/body.json",
        str(destination),
    ], timeout=60)
    try:
        return json.loads(destination.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise IntegrationError("copied body receipt is unavailable or invalid") from exc


def _labels(kind: str, identity: str) -> dict[str, Any] | None:
    command = (["docker", "inspect", identity] if kind == "container"
               else ["docker", "image", "inspect", identity])
    result = _run(command, timeout=30)
    if result.outcome != "exited" or result.returncode != 0:
        return None
    try:
        rows = json.loads(result.stdout or "")
    except json.JSONDecodeError:
        return None
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        return None
    config = rows[0].get("Config")
    labels = config.get("Labels") if isinstance(config, dict) else None
    return labels if isinstance(labels, dict) else None


def _remove_owned(kind: str, identity: str, run_id: str) -> bool:
    labels = _labels(kind, identity)
    if labels is None:
        return False  # never claim clean or delete without verified ownership
    if (labels.get("org.prime-claw.test.contract") != ip.CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id):
        return False
    command = (["docker", "rm", "-f", identity] if kind == "container"
               else ["docker", "image", "rm", identity])
    result = _run(command, timeout=60)
    return result.outcome == "exited" and result.returncode == 0


def _recover_owned(kind: str, reference: str, run_id: str) -> str:
    command = (["docker", "inspect", reference] if kind == "container"
               else ["docker", "image", "inspect", reference])
    result = _run(command, timeout=30)
    if result.outcome != "exited" or result.returncode != 0:
        return ""
    try:
        rows = json.loads(result.stdout or "")
    except json.JSONDecodeError:
        return ""
    if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
        return ""
    identity = rows[0].get("Id")
    labels = rows[0].get("Config", {}).get("Labels") if isinstance(rows[0].get("Config"), dict) else None
    valid = (re.fullmatch(r"[0-9a-f]{64}", identity or "") if kind == "container"
             else re.fullmatch(r"sha256:[0-9a-f]{64}", identity or ""))
    if (not valid or not isinstance(labels, dict)
            or labels.get("org.prime-claw.test.contract") != ip.CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id):
        return ""
    return identity


def _write_manifest(path: Path, value: dict[str, Any]) -> None:
    path.write_bytes(_canonical(value))


def run(args: argparse.Namespace) -> int:
    run_id = _run_id()
    results_root = Path(args.results_root).expanduser().resolve() if args.results_root else DEFAULT_RESULTS
    run_dir = results_root / run_id / "integration"
    run_dir.mkdir(parents=True, mode=0o700)
    started = _utc()
    repository = repository_identity()
    lock = ip.load_lock(LOCK_PATH)
    if args.dry_run:
        print(json.dumps({
            "contract": ip.CONTRACT, "run_id": run_id,
            "repository": repository,
            "runtime": {"network": "none", "mounts": [], "non_root": True,
                        "result_transport": "docker cp"},
        }, sort_keys=True))
        return 0

    platform = "unknown"
    image: dict[str, Any] | None = None
    boundary: dict[str, Any] | None = None
    body: dict[str, Any] | None = None
    image_id = ""
    image_tag = ""
    container_id = ""
    container_name = "prime-claw-integration-" + run_id.lower()
    failure_codes: list[str] = []
    context_removed = False
    context_parent = Path(tempfile.mkdtemp(prefix="prime-claw-integration-", dir=run_dir))
    context = context_parent / "context"
    scratch = context_parent / "scratch"
    scratch.mkdir()
    try:
        platform = _platform()
        input_sha = prepare_build_context(
            context, scratch, lock=lock, platform=platform, run_id=run_id,
            repository=repository, mirror=args.gbrain_mirror)
        image_tag = f"{IMAGE_REPO}:{input_sha[:12]}"
        image, image_id = _build_image(
            run_dir, context, run_id=run_id, platform=platform,
            lock=lock, tag=image_tag, rebuild=args.rebuild)
        boundary, container_id = _create_container(
            run_dir, run_id=run_id, image_id=image_id, name=container_name)
        _run_body(container_id, run_id=run_id,
                  attestation=boundary["attestation_sha256"])
        raw_body = _stop_and_copy(container_id, run_dir / "body.json")
        body = ip.validate_body(
            raw_body, lock, run_id=run_id, platform=platform,
            repository=repository)
    except IntegrationError as exc:
        failure_codes.append(exc.code)
        print(f"integration test FAILED: {exc}", file=sys.stderr)
    except (OSError, ValueError, tarfile.TarError, json.JSONDecodeError) as exc:
        failure_codes.append("unexpected-failure")
        print(f"integration test FAILED: {type(exc).__name__}", file=sys.stderr)
    finally:
        if not container_id:
            container_id = _recover_owned("container", container_name, run_id)
        if not image_id and image_tag:
            image_id = _recover_owned("image", image_tag, run_id)
        container_removed = (not container_id) or _remove_owned(
            "container", container_id, run_id)
        image_removed = (not image_id) or _remove_owned("image", image_id, run_id)
        try:
            shutil.rmtree(context_parent)
            context_removed = not context_parent.exists()
        except OSError:
            context_removed = False

    if not (container_removed and image_removed and context_removed):
        failure_codes.append("cleanup-failed")
    status = "passed" if body is not None and not failure_codes else "failed"
    manifest = {
        "schema_version": 1,
        "contract": ip.CONTRACT,
        "status": status,
        "run": {
            "id": run_id, "started_at": started, "finished_at": _utc(),
            "failure_codes": failure_codes,
        },
        "repository": repository,
        "platform": platform,
        "artifact_lock_sha256": _sha(_canonical(lock)),
        "image": image,
        "container": boundary,
        "body": body,
        "cleanup": {
            "container_removed": container_removed,
            "image_removed": image_removed,
            "context_removed": context_removed,
        },
    }
    _write_manifest(run_dir / "manifest.json", manifest)
    if status == "passed":
        print(f"integration manifest: {run_dir / 'manifest.json'}")
        print("integration PASS")
        return 0
    return 1


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--results-root")
    parser.add_argument("--gbrain-mirror", default=os.environ.get("INTEGRATION_GBRAIN_MIRROR"))
    return parser


def main(argv: list[str] | None = None) -> int:
    return run(_parser().parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main())
