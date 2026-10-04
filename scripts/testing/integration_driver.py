#!/usr/bin/env python3
"""Host launcher for the disposable gbrain/PostgreSQL integration tier."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import signal
import sys
import tarfile
from typing import Any

from scripts.testing import bounded
from scripts.testing import integration_provenance as ip
from scripts.testing import provenance as p

REPO = Path(__file__).resolve().parents[2]
DOCKERFILE = "docker/test-integration.Dockerfile"
LOCK_PATH = "config/test-artifacts.lock.json"
IMAGE_REPO = "prime-claw-test-integration"
DEFAULT_RESULTS = REPO / ".test-results"
KILL_GRACE = 10.0


class DriverError(RuntimeError):
    pass


class LifecycleInterrupted(BaseException):
    def __init__(self, signum: int):
        super().__init__(signum)
        self.signum = signum


class LifecycleSignals:
    """Defer watched signals so exact cleanup and terminal evidence always run."""

    def __init__(self) -> None:
        self.watched = tuple(signal.Signals(value) for value in (
            signal.SIGTERM, signal.SIGINT, signal.SIGHUP))
        self.first: int | None = None
        self.previous = {sig: signal.getsignal(sig) for sig in self.watched}
        self.sigmask = getattr(signal, "pthread_sigmask", None)
        if self.sigmask is None:
            raise DriverError("POSIX signal masking is required")
        self.old_mask = self.sigmask(signal.SIG_BLOCK, self.watched)
        try:
            for sig in self.watched:
                signal.signal(sig, self._record)
        except BaseException:
            for sig, previous in self.previous.items():
                try:
                    signal.signal(sig, previous)
                except BaseException:
                    pass
            self.sigmask(signal.SIG_SETMASK, self.old_mask)
            raise
        self.enabled = False

    def _record(self, signum: int, _frame: Any) -> None:
        if self.first is None:
            self.first = signum

    def enable(self) -> None:
        self.enabled = True
        self.sigmask(signal.SIG_SETMASK, self.old_mask)

    def checkpoint(self) -> None:
        if self.first is not None:
            raise LifecycleInterrupted(self.first)

    def freeze(self) -> int | None:
        self.sigmask(signal.SIG_BLOCK, self.watched)
        pending = set(signal.sigpending())
        if self.first is None:
            for sig in self.watched:
                if sig in pending:
                    self.first = int(sig)
                    break
        return self.first

    def restore_normal(self) -> None:
        if self.first is not None:
            return
        for sig, previous in self.previous.items():
            signal.signal(sig, previous)
        self.sigmask(signal.SIG_SETMASK, self.old_mask)


_ACTIVE_SIGNALS: LifecycleSignals | None = None


def _run(argv: list[str], *, timeout: float, check: bool = True,
         echo: bool = False) -> bounded.BoundedResult:
    if _ACTIVE_SIGNALS is not None:
        _ACTIVE_SIGNALS.checkpoint()
    result = bounded.run_completed(
        [str(value) for value in argv], timeout=timeout,
        kill_grace=KILL_GRACE, reap_grace=KILL_GRACE,
        capture_output=True, text=True,
    )
    if result.outcome == "interrupted" and result.signal is not None:
        if _ACTIVE_SIGNALS is not None and _ACTIVE_SIGNALS.first is None:
            _ACTIVE_SIGNALS.first = result.signal
        raise LifecycleInterrupted(result.signal)
    if _ACTIVE_SIGNALS is not None:
        _ACTIVE_SIGNALS.checkpoint()
    if echo:
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)
    if check and (result.outcome != "exited" or result.returncode != 0):
        raise DriverError(
            f"bounded command failed (outcome={result.outcome}, rc={result.returncode})")
    return result


def _json_result(result: bounded.BoundedResult, label: str) -> Any:
    try:
        return json.loads(result.stdout or "")
    except (TypeError, json.JSONDecodeError) as exc:
        raise DriverError(f"{label} returned invalid JSON") from exc


def _clean_env(home: Path) -> list[str]:
    path = os.environ.get("PATH") or "/usr/local/bin:/usr/bin:/bin"
    return ["env", "-i", f"HOME={home}", f"PATH={path}",
            "LANG=C.UTF-8", "GIT_CONFIG_NOSYSTEM=1", "GIT_TERMINAL_PROMPT=0"]


def _remove_owned(path: Path, binding: str, tier_dir: Path) -> dict[str, Any]:
    verified = p.utc_now()
    try:
        p.remove_owned_directory(path, binding, quarantine_parent=tier_dir)
    except (OSError, p.ProvenanceError):
        return {"state": "unknown", "verified_at": verified,
                "remove_outcome": "ordinary_nonzero",
                "inspect_outcome": "not_run", "clean": False}
    state = "absent" if not path.exists() else "present"
    return {"state": state, "verified_at": verified,
            "remove_outcome": "clean", "inspect_outcome": "ordinary_nonzero",
            "clean": state == "absent"}


def _not_needed() -> dict[str, Any]:
    return {"state": "absent", "verified_at": p.utc_now(),
            "remove_outcome": "not_needed", "inspect_outcome": "not_needed",
            "clean": True}


def _unknown() -> dict[str, Any]:
    return {"state": "unknown", "verified_at": p.utc_now(),
            "remove_outcome": "identity_refused", "inspect_outcome": "not_run",
            "clean": False}


def _create_owned_child(tier_dir: Path, tier_binding: str,
                        name: str) -> tuple[Path, str]:
    with p.open_owned_directory(tier_dir, tier_binding) as parent:
        child = p._create_owned_directory_child(parent, name, mode=0o700)
        try:
            return child.path, child.binding.encode()
        finally:
            child.close()


def _platform() -> str:
    result = _run(["docker", "info", "--format", "{{.OSType}}/{{.Architecture}}"], timeout=60)
    value = (result.stdout or "").strip()
    aliases = {"linux/aarch64": "linux/arm64", "linux/x86_64": "linux/amd64"}
    value = aliases.get(value, value)
    if value not in ip.SUPPORTED_PLATFORMS:
        raise DriverError("Docker server platform is unsupported")
    return value


def _prepare_context(context: Path, tier_dir: Path, prep: Path,
                     prep_binding: str, run_id: str, platform: str,
                     lock: dict[str, Any], mirror: str | None,
                     teardown_state: dict[str, Any]) -> tuple[str, str]:
    teardown_state.clear()
    teardown_state.update(_unknown())
    try:
        clean_home = prep / "home"; clean_home.mkdir(mode=0o700)
        git_dir = prep / "gbrain.git"
        env = _clean_env(clean_home)
        _run([*env, "git", "init", "--bare", str(git_dir)], timeout=60)
        source = mirror or lock["gbrain"]["origin"]
        if mirror:
            candidate = Path(mirror)
            if not candidate.is_absolute() or not candidate.exists():
                raise DriverError("gbrain mirror must be an existing absolute path")
        _run([*env, "git", "--git-dir", str(git_dir), "remote", "add", "origin", source], timeout=30)
        _run([*env, "git", "--git-dir", str(git_dir), "fetch", "--depth=1", "origin", lock["gbrain"]["commit"]], timeout=600, echo=True)
        commit = _run([*env, "git", "--git-dir", str(git_dir), "rev-parse", "FETCH_HEAD^{commit}"], timeout=30).stdout.strip()
        tree = _run([*env, "git", "--git-dir", str(git_dir), "rev-parse", "FETCH_HEAD^{tree}"], timeout=30).stdout.strip()
        if commit != lock["gbrain"]["commit"] or tree != lock["gbrain"]["tree"]:
            raise DriverError("gbrain commit/tree mismatched artifact lock")
        archive = prep / "gbrain.tar"
        _run([*env, "git", "--git-dir", str(git_dir), "archive", "--format=tar", "--output", str(archive), commit], timeout=180)
        if p.sha256_file(archive) != lock["gbrain"]["archive_sha256"]:
            raise DriverError("gbrain archive hash mismatched artifact lock")
        gbrain_dir = context / "gbrain"; gbrain_dir.mkdir()
        with tarfile.open(archive, "r:") as handle:
            handle.extractall(gbrain_dir, filter="data")
        package = json.loads((gbrain_dir / "package.json").read_text())
        if package.get("version") != lock["gbrain"]["package_version"]:
            raise DriverError("gbrain package version mismatched artifact lock")
        bun = lock["bun"]["platforms"][platform]
        bun_url = f"https://github.com/oven-sh/bun/releases/download/bun-v{lock['bun']['version']}/{bun['artifact']}"
        _run([*_clean_env(clean_home), "curl", "--fail", "--location", "--silent", "--show-error",
              "--proto", "=https", "--tlsv1.2", "--output", str(context / "bun-artifact.zip"), bun_url], timeout=300, echo=True)
        if p.sha256_file(context / "bun-artifact.zip") != bun["sha256"]:
            raise DriverError("Bun artifact hash mismatched artifact lock")
        shutil.copy2(REPO / DOCKERFILE, context / "Dockerfile")
        shutil.copy2(REPO / LOCK_PATH, context / "artifact-lock.json")
        (context / "integration-run.json").write_text(
            json.dumps({"run_id": run_id, "platform": platform}, sort_keys=True,
                       separators=(",", ":")) + "\n")
        inputs = sorted(str(path.relative_to(context)) for path in context.rglob("*") if path.is_file())
        input_hash = p.hash_declared_inputs(context, inputs)
        dockerfile_hash = p.sha256_file(context / "Dockerfile")
    finally:
        prep_result = _remove_owned(prep, prep_binding, tier_dir)
        teardown_state.clear()
        teardown_state.update(prep_result)
        if not prep_result["clean"] and sys.exc_info()[0] is None:
            raise DriverError("run-owned source preparation could not be removed")
    return input_hash, dockerfile_hash


def _build_image(context: Path, run_id: str, platform: str,
                 lock: dict[str, Any], input_hash: str, tag: str,
                 dockerfile_hash: str, no_cache: bool) -> tuple[dict[str, Any], str]:
    iidfile = context.parent / "image.iid"
    bun = lock["bun"]["platforms"][platform]
    base_digest = lock["base_image"]["platforms"][platform]
    args = ["docker", "build", "--platform", platform, "--iidfile", str(iidfile),
            "-f", str(context / "Dockerfile"), "-t", tag]
    if no_cache:
        args.append("--no-cache")
    build_args = {
        "BASE_IMAGE": f"{lock['base_image']['reference']}@{base_digest}",
        "TARGET_PLATFORM": platform, "BASE_IMAGE_DIGEST": base_digest,
        "BUN_ARCHIVE_DIRECTORY": bun["archive_directory"],
        "BUN_COMPILE_TARGET": bun["compile_target"],
        "BUN_VERSION": lock["bun"]["version"],
        "BUN_ARTIFACT_SHA256": bun["sha256"],
        "GBRAIN_ORIGIN": lock["gbrain"]["origin"],
        "GBRAIN_COMMIT": lock["gbrain"]["commit"],
        "GBRAIN_TREE": lock["gbrain"]["tree"],
        "GBRAIN_ARCHIVE_SHA256": lock["gbrain"]["archive_sha256"],
        "GBRAIN_PACKAGE_VERSION": lock["gbrain"]["package_version"],
        "TEST_RUN_ID": run_id,
    }
    for key, value in build_args.items():
        args += ["--build-arg", f"{key}={value}"]
    args.append(str(context))
    started = p.utc_now()
    _run(args, timeout=900, echo=True)
    finished = p.utc_now()
    try:
        image_id = iidfile.read_text().strip()
    except OSError as exc:
        raise DriverError("integration iidfile was not published") from exc
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        raise DriverError("integration iidfile identity is invalid")
    inspected = _json_result(_run(["docker", "image", "inspect", image_id], timeout=60), "image inspect")
    if not isinstance(inspected, list) or len(inspected) != 1:
        raise DriverError("image inspect returned the wrong row count")
    safe = ip.safe_image_identity(
        inspected[0], expected_id=image_id, run_id=run_id, platform=platform,
        base_image_digest=lock["base_image"]["platforms"][platform],
        dockerfile_sha256=dockerfile_hash, input_sha256=input_hash, tag=tag,
        started_at=started, finished_at=finished)
    return safe, image_id


def _create_container(tier_dir: Path, snapshot: Path, share: Path,
                      run_id: str, image_id: str,
                      name: str) -> tuple[dict[str, Any], str, str]:
    cidfile = tier_dir / "container.cid"
    args = ["docker", "create", "--cidfile", str(cidfile), "--name", name,
            "--label", f"org.prime-claw.test.contract={ip.CONTRACT}",
            "--label", f"org.prime-claw.test.run={run_id}",
            "--network", "none",
            "--mount", f"type=bind,src={snapshot},dst=/workspace,readonly",
            "--mount", f"type=bind,src={share},dst=/results",
            image_id]
    _run(args, timeout=60, echo=True)
    try:
        container_id = cidfile.read_text().strip()
    except OSError as exc:
        raise DriverError("integration cidfile was not published") from exc
    if not re.fullmatch(r"[0-9a-f]{64}", container_id):
        raise DriverError("integration cidfile identity is invalid")
    started = _run(["docker", "start", container_id], timeout=60)
    if (started.stdout or "").strip() != container_id:
        raise DriverError("docker start identity mismatched captured container")
    rows = _json_result(_run(["docker", "inspect", container_id], timeout=60), "container inspect")
    if not isinstance(rows, list) or len(rows) != 1:
        raise DriverError("container inspect returned the wrong row count")
    safe = ip.safe_container_boundary(
        rows[0], expected_id=container_id, image_id=image_id, run_id=run_id,
        name=name, repository_source=snapshot, result_source=share)
    return safe, container_id, name


def _verify_container(container_id: str, *, image_id: str, run_id: str,
                      name: str, snapshot: Path, share: Path) -> dict[str, Any]:
    rows = _json_result(_run(["docker", "inspect", container_id], timeout=60), "container inspect")
    if not isinstance(rows, list) or len(rows) != 1:
        raise DriverError("container inspect returned the wrong row count")
    return ip.safe_container_boundary(
        rows[0], expected_id=container_id, image_id=image_id, run_id=run_id,
        name=name, repository_source=snapshot, result_source=share)


def _captured_identity(path: Path, pattern: re.Pattern[str]) -> str:
    try:
        value = path.read_text().strip()
    except OSError:
        return ""
    return value if pattern.fullmatch(value) else ""


def _ownership_state(kind: str, identity: str, run_id: str,
                     *, expected_image: str = "") -> str:
    command = ["docker", "inspect", identity]
    if kind == "image":
        command = ["docker", "image", "inspect", identity]
    inspected = _run(command, timeout=30, check=False)
    state = ip.exact_absence(inspected, identity, kind=kind)
    if state != "present":
        return state
    try:
        rows = json.loads(inspected.stdout or "")
        row = rows[0]
        config = row["Config"]
        labels = config["Labels"]
    except (json.JSONDecodeError, IndexError, KeyError, TypeError):
        return "unknown"
    if (row.get("Id") != identity
            or labels.get("org.prime-claw.test.contract") != ip.CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id):
        return "unknown"
    if kind == "container":
        expected_name = "/prime-claw-integration-" + run_id.lower()
        if row.get("Name") != expected_name or (expected_image and row.get("Image") != expected_image):
            return "unknown"
    return "owned"


def _already_absent() -> dict[str, Any]:
    return {"state": "absent", "verified_at": p.utc_now(),
            "remove_outcome": "not_needed",
            "inspect_outcome": "ordinary_nonzero", "clean": True}


def _capture_file(path: Path, pattern: re.Pattern[str]) -> tuple[str, str]:
    try:
        value = path.read_text().strip()
    except FileNotFoundError:
        return "missing", ""
    except OSError:
        return "unknown", ""
    return ("valid", value) if pattern.fullmatch(value) else ("unknown", "")


def _inspect_owned_image(selector: str, run_id: str, tag: str,
                         *, expected_id: str = "") -> tuple[str, str]:
    inspected = _run(["docker", "image", "inspect", selector], timeout=30, check=False)
    if ip.exact_absence(inspected, selector, kind="image") == "absent":
        return "absent", expected_id
    if inspected.outcome != "exited" or inspected.returncode != 0:
        return "unknown", expected_id
    try:
        rows = json.loads(inspected.stdout or "")
        row = rows[0]
        labels = row["Config"]["Labels"]
        identity = row["Id"]
        ip.safe_local_image_references(row, tag)
    except (json.JSONDecodeError, IndexError, KeyError, TypeError, p.ProvenanceError):
        return "unknown", expected_id
    if (len(rows) != 1 or not isinstance(identity, str)
            or not re.fullmatch(r"sha256:[0-9a-f]{64}", identity)
            or (expected_id and identity != expected_id)
            or labels.get("org.prime-claw.test.contract") != ip.CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id):
        return "unknown", expected_id
    return "owned", identity


def _recover_image(tier_dir: Path, run_id: str, tag: str) -> tuple[str, str]:
    capture, identity = _capture_file(
        tier_dir / "image.iid", re.compile(r"sha256:[0-9a-f]{64}"))
    if capture == "unknown":
        return "unknown", ""
    if capture == "valid":
        return _inspect_owned_image(identity, run_id, tag, expected_id=identity)
    return _inspect_owned_image(tag, run_id, tag)


def _recover_container(tier_dir: Path, run_id: str, name: str,
                       expected_image: str) -> tuple[str, str, str]:
    capture, identity = _capture_file(
        tier_dir / "container.cid", re.compile(r"[0-9a-f]{64}"))
    selector = identity if capture == "valid" else name
    if capture == "unknown":
        return "unknown", "", expected_image
    inspected = _run(["docker", "inspect", selector], timeout=30, check=False)
    if ip.exact_absence(inspected, selector, kind="container") == "absent":
        return "absent", identity, expected_image
    if inspected.outcome != "exited" or inspected.returncode != 0:
        return "unknown", identity, expected_image
    try:
        rows = json.loads(inspected.stdout or "")
        row = rows[0]
        labels = row["Config"]["Labels"]
        observed_id = row["Id"]
        observed_image = row["Image"]
    except (json.JSONDecodeError, IndexError, KeyError, TypeError):
        return "unknown", identity, expected_image
    if (len(rows) != 1 or not isinstance(observed_id, str)
            or not re.fullmatch(r"[0-9a-f]{64}", observed_id)
            or row.get("Name") != "/" + name
            or labels.get("org.prime-claw.test.contract") != ip.CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id
            or not isinstance(observed_image, str)
            or not re.fullmatch(r"sha256:[0-9a-f]{64}", observed_image)
            or (expected_image and observed_image != expected_image)
            or (identity and observed_id != identity)):
        return "unknown", identity, expected_image
    return "owned", observed_id, observed_image


def _cleanup_container(identity: str) -> dict[str, Any]:
    removed = _run(["docker", "rm", "-f", identity], timeout=60, check=False)
    inspected = _run(["docker", "inspect", identity], timeout=30, check=False)
    return ip.teardown_record(removed, inspected, identity, kind="container", verified_at=p.utc_now())


def _cleanup_image(identity: str) -> dict[str, Any]:
    removed = _run(["docker", "image", "rm", "-f", identity], timeout=120, check=False)
    inspected = _run(["docker", "image", "inspect", identity], timeout=30, check=False)
    return ip.teardown_record(removed, inspected, identity, kind="image", verified_at=p.utc_now())


def _manifest(*, run_id: str, started: str, status: str,
              failure_codes: list[str], repository: dict[str, Any],
              platform: str | None, artifact_lock_sha256: str,
              body: dict[str, Any] | None,
              image: dict[str, Any] | None, container: dict[str, Any] | None,
              teardown: dict[str, Any], files: list[dict[str, str]]) -> dict[str, Any]:
    network = None
    if container is not None and body is not None:
        network = {"mode": "none", "verified_absent": True,
                   "verified_at": body["finished_at"],
                   "external_tcp_refused": body["external_tcp_refused"]}
    return {
        "schema_version": p.SCHEMA_VERSION,
        "command_contract_version": ip.CONTRACT,
        "status": status,
        "run": {"id": run_id, "tier": "integration", "mode": "gbrain-postgres",
                "started_at": started, "finished_at": p.utc_now(),
                "status": status, "failure_codes": failure_codes},
        "repository": repository, "platform": platform,
        "artifact_lock_sha256": artifact_lock_sha256,
        "gbrain": body.get("gbrain") if body else None,
        "image": image, "container": container, "network": network,
        "fixtures": body.get("fixtures") if body else None,
        "postgresql": body.get("postgresql") if body else None,
        "teardown": teardown, "evidence": {"files": files},
    }


def run(args: argparse.Namespace) -> int:
    global _ACTIVE_SIGNALS
    lock = ip.load_lock(REPO / LOCK_PATH)
    if args.dry_run:
        print("integration driver: validate locked gbrain/Bun/base identities")
        print("integration driver: allocate run-owned snapshot/context/share/iid/cid")
        print("integration driver: build exact native-platform image; delete verified context")
        print("integration driver: create by image ID with repository:ro, results:rw, --network none")
        print("integration driver: inspect mounts/ports/env/labels; run explicit inner attestation")
        print("integration driver: exact container then image teardown; publish validated manifest")
        return 0

    owner = LifecycleSignals()
    _ACTIVE_SIGNALS = owner
    platform = _platform()
    if owner.freeze() is not None:
        return 128 + int(owner.first or signal.SIGTERM)
    results_root = Path(args.results_root or DEFAULT_RESULTS).resolve()
    run_id, tier_dir, tier_binding = p.allocate_run_tree(results_root, "integration")
    started = p.utc_now()
    print(f"integration driver: run={run_id} platform={platform} results={tier_dir}")

    repository: dict[str, Any] | None = None
    snapshot = results_root / ".workspaces" / run_id
    snapshot_binding = ""
    share: Path | None = None; share_binding = ""
    context: Path | None = None; context_binding = ""
    prep: Path | None = None; prep_binding = ""
    image_id = ""; image_tag = ""; image_safe = None; image_owned = False
    container_id = ""; container_name = "prime-claw-integration-" + run_id.lower()
    container_safe = None; container_owned = False
    body = None; primary_ok = False; publication_ok = False
    manifest: dict[str, Any] | None = None
    manifest_binding: p.ObjectBinding | None = None
    failure_codes: list[str] = []
    preparation_teardown = _not_needed()
    context_teardown = _not_needed()
    snapshot_teardown = _not_needed()
    share_teardown = _not_needed()
    container_teardown = _not_needed()
    image_teardown = _not_needed()

    try:
        if status_file := os.environ.get("PRIME_CLAW_INTEGRATION_STATUS"):
            temp = Path(status_file + f".inner.{os.getpid()}")
            temp.write_text(json.dumps({"tier_dir": str(tier_dir), "binding": tier_binding},
                                       sort_keys=True, separators=(",", ":")))
            os.replace(temp, status_file)
        owner.enable()
        owner.checkpoint()
        repository = p.repository_identity(REPO)
        with p.open_owned_directory(tier_dir, tier_binding) as owned:
            p.write_sanitized_json(owned, "repository.json", repository)
            p.write_sanitized_json(owned, "artifact-lock.json", lock)

        snapshot_teardown = _unknown()
        snapshot_repository = p.stage_repository_snapshot(REPO, snapshot)
        snapshot_binding = p.owned_directory_binding(snapshot)
        if snapshot_repository != repository:
            raise DriverError("repository changed while the run snapshot was staged")

        share_teardown = _unknown()
        share, share_binding = _create_owned_child(tier_dir, tier_binding, "share")
        context_teardown = _unknown()
        context, context_binding = _create_owned_child(
            tier_dir, tier_binding, "build-context")
        prep, prep_binding = _create_owned_child(tier_dir, tier_binding, "preparation")
        input_hash, dockerfile_hash = _prepare_context(
            context, tier_dir, prep, prep_binding, run_id, platform, lock,
            args.gbrain_mirror, preparation_teardown)
        image_tag = f"{IMAGE_REPO}:{input_hash[:12]}"
        image_safe, image_id = _build_image(
            context, run_id, platform, lock, input_hash, image_tag,
            dockerfile_hash, args.rebuild)
        image_owned = True
        with p.open_owned_directory(tier_dir, tier_binding) as owned:
            p.write_sanitized_json(owned, "image.json", image_safe)
        context_teardown = _remove_owned(context, context_binding, tier_dir)
        if not context_teardown["clean"]:
            raise DriverError("verified build context could not be removed")
        container_safe, container_id, container_name = _create_container(
            tier_dir, snapshot, share, run_id, image_id, container_name)
        container_owned = True
        with p.open_owned_directory(tier_dir, tier_binding) as owned:
            p.write_sanitized_json(owned, "boundary.json", container_safe)
        attestation = hashlib.sha256(
            f"{run_id}:{container_id}:{image_id}".encode()).hexdigest()
        executed = _run([
            "docker", "exec", "--env", f"PRIME_CLAW_INTEGRATION_ATTESTATION={attestation}",
            "--env", f"PRIME_CLAW_INTEGRATION_RUN_ID={run_id}", container_id,
            "python3", "/workspace/tests/integration/environment_body.py",
            "--attestation", attestation, "--run-id", run_id,
        ], timeout=300, echo=True)
        if executed.outcome != "exited" or executed.returncode != 0:
            raise DriverError("integration body failed")
        try:
            body_raw = json.loads((share / "body.json").read_text())
        except (OSError, UnicodeError, json.JSONDecodeError) as exc:
            raise DriverError("integration body receipt is unavailable") from exc
        body = ip.validate_body(body_raw, lock, run_id=run_id,
                                platform=platform, attestation=attestation)
        if body["base_image_digest"] != image_safe["base_image_digest"]:
            raise DriverError("embedded base-image identity mismatched host evidence")
        post_boundary = _verify_container(
            container_id, image_id=image_id, run_id=run_id, name=container_name,
            snapshot=snapshot, share=share)
        if post_boundary != container_safe:
            raise DriverError("container boundary drifted during assertion phase")
        with p.open_owned_directory(tier_dir, tier_binding) as owned:
            p.write_sanitized_json(owned, "body.json", body)
        owner.checkpoint()
        primary_ok = True
    except LifecycleInterrupted as exc:
        owner.first = owner.first or exc.signum
        failure_codes.append("interrupted")
        print("integration driver: interrupted; closing exact owned resources", file=sys.stderr)
    except (DriverError, OSError, ValueError, p.ProvenanceError,
            tarfile.TarError, json.JSONDecodeError) as exc:
        failure_codes.append("primary-command-failed")
        print(f"integration driver: FAILED: {exc}", file=sys.stderr)
    finally:
        owner.freeze()
        # Cleanup owns a signal-blocked epoch. Disable ordinary-phase
        # checkpoints before any recovery/removal command so the first typed
        # interruption cannot re-raise from inside the only finalizer.
        _ACTIVE_SIGNALS = None
        if owner.first is not None and "interrupted" not in failure_codes:
            failure_codes.append("interrupted")
            primary_ok = False

        try:
            with p.open_owned_directory(tier_dir, tier_binding) as owned:
                p.write_sanitized_json(owned, "preparation.json", preparation_teardown)
        except (OSError, ValueError, p.ProvenanceError):
            if "evidence-publication-failed" not in failure_codes:
                failure_codes.append("evidence-publication-failed")
            primary_ok = False

        # Recover exact captured identities first. If iid/cid publication was
        # lost, inspect only the exact run-owned tag/name and adopt only after
        # immutable ID plus run/contract labels match.
        container_state = "owned" if container_owned else ""
        if not container_owned:
            container_state, recovered_container, recovered_image = _recover_container(
                tier_dir, run_id, container_name, image_id)
            if recovered_container:
                container_id = recovered_container
            if not image_id and recovered_image:
                image_id = recovered_image
        image_state = "owned" if image_owned else ""
        if not image_owned:
            if image_id and image_tag:
                image_state, image_id = _inspect_owned_image(
                    image_id, run_id, image_tag, expected_id=image_id)
            elif image_tag:
                image_state, image_id = _recover_image(tier_dir, run_id, image_tag)
            else:
                capture, captured = _capture_file(
                    tier_dir / "image.iid", re.compile(r"sha256:[0-9a-f]{64}"))
                if capture == "valid":
                    image_id = captured
                    image_state = _ownership_state("image", image_id, run_id)
                elif capture == "unknown":
                    image_state = "unknown"
                else:
                    image_state = "absent"

        if container_state == "owned" and container_id:
            container_teardown = _cleanup_container(container_id)
        elif container_state == "absent":
            container_teardown = _already_absent()
        elif container_state:
            container_teardown = _unknown()

        if image_state == "owned" and image_id:
            image_teardown = _cleanup_image(image_id)
        elif image_state == "absent":
            image_teardown = _already_absent()
        elif image_state:
            image_teardown = _unknown()

        if context is not None and not context_teardown["clean"]:
            context_teardown = _remove_owned(context, context_binding, tier_dir)
        if not snapshot_binding:
            try:
                os.lstat(snapshot)
            except FileNotFoundError:
                snapshot_teardown = _already_absent()
            except OSError:
                snapshot_teardown = _unknown()
        if container_teardown["clean"]:
            if snapshot_binding and not snapshot_teardown["clean"]:
                snapshot_teardown = _remove_owned(snapshot, snapshot_binding, tier_dir)
            if share is not None and not share_teardown["clean"]:
                share_teardown = _remove_owned(share, share_binding, tier_dir)
        elif snapshot_binding or share is not None:
            print("integration driver: mounted state retained because container teardown is non-clean", file=sys.stderr)

        teardown_rows = (preparation_teardown, container_teardown, image_teardown,
                         context_teardown, snapshot_teardown, share_teardown)
        clean = all(row["clean"] for row in teardown_rows)
        if not clean and "cleanup-failed" not in failure_codes:
            failure_codes.append("cleanup-failed")
        status = "passed" if primary_ok and clean and not failure_codes else "failed"
        if status == "passed":
            failure_codes = []
        teardown = {"preparation": preparation_teardown,
                    "container": container_teardown, "image": image_teardown,
                    "context": context_teardown, "snapshot": snapshot_teardown,
                    "share": share_teardown, "clean": clean}
        if repository is not None:
            try:
                with p.open_owned_directory(tier_dir, tier_binding) as owned:
                    files = ip.evidence_inventory(owned)
                    manifest = _manifest(
                        run_id=run_id, started=started, status=status,
                        failure_codes=failure_codes, repository=repository,
                        platform=platform,
                        artifact_lock_sha256=hashlib.sha256(
                            p.canonical_json(lock).encode()).hexdigest(),
                        body=body, image=image_safe,
                        container=container_safe, teardown=teardown, files=files)
                    manifest_binding = ip.publish_manifest(owned, manifest)
                    ip.verify_evidence(owned, manifest)
                    publication_ok = True
            except (OSError, p.ProvenanceError) as exc:
                print(f"integration driver: manifest publication failed: {exc}", file=sys.stderr)

    _ACTIVE_SIGNALS = None
    interrupted = owner.freeze()
    if (interrupted is not None and publication_ok and manifest is not None
            and manifest_binding is not None and manifest["status"] == "passed"):
        failed = json.loads(p.canonical_json(manifest))
        failed["status"] = "failed"
        failed["run"]["status"] = "failed"
        failed["run"]["failure_codes"] = ["interrupted"]
        try:
            with p.open_owned_directory(tier_dir, tier_binding) as owned:
                ip.publish_manifest(owned, failed, expected_existing=manifest_binding)
        except (OSError, p.ProvenanceError):
            # Replacement closes the green window before verification. If it
            # cannot start, the supervisor still owns the same signal and
            # performs its independent terminal closure.
            pass
    if interrupted is not None:
        return 128 + interrupted
    owner.restore_normal()
    if primary_ok and clean and publication_ok:
        print("integration driver: PASS — offline brain stack and exact teardown verified")
        return 0
    return 1


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--results-root")
    parser.add_argument("--gbrain-mirror", default=os.environ.get("INTEGRATION_GBRAIN_MIRROR"))
    return run(parser.parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main())
