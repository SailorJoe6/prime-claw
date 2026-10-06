#!/usr/bin/env python3
"""Host launcher for the disposable gbrain/PostgreSQL integration tier."""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import sys
import tarfile
import time
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
    """Own only watched signals that the caller did not already block."""

    def __init__(self) -> None:
        self.watched = tuple(signal.Signals(value) for value in (
            signal.SIGTERM, signal.SIGINT, signal.SIGHUP))
        self.first: int | None = None
        self.sigmask = getattr(signal, "pthread_sigmask", None)
        self.sigpending = getattr(signal, "sigpending", None)
        self.sigwait = getattr(signal, "sigwait", None)
        if any(value is None for value in (
                self.sigmask, self.sigpending, self.sigwait)):
            raise DriverError("POSIX signal ownership is required")
        self.old_mask = self.sigmask(signal.SIG_BLOCK, self.watched)
        self.owned = tuple(sig for sig in self.watched if sig not in self.old_mask)
        self.previous = {sig: signal.getsignal(sig) for sig in self.owned}
        self.enabled = False
        self.restored = False
        self.ownership_open = True
        self.terminal_exit = False
        try:
            baseline = set(self.sigpending()).intersection(self.owned)
            if baseline:
                raise DriverError("unblocked caller signal was already pending")
            for sig in self.owned:
                signal.signal(sig, self._record)
        except BaseException:
            self._restore_after_init_failure()
            raise

    def _restore_after_init_failure(self) -> None:
        for sig, previous in self.previous.items():
            try:
                signal.signal(sig, previous)
            except BaseException:
                pass
        try:
            self.sigmask(signal.SIG_SETMASK, self.old_mask)
        except BaseException:
            pass
        self.ownership_open = False

    def _record(self, signum: int, frame: Any) -> None:
        sig = signal.Signals(signum)
        if self.ownership_open and sig in self.owned:
            if self.first is None:
                self.first = signum
            if self.terminal_exit:
                os._exit(128 + signum)
            return
        previous = self.previous.get(sig, signal.getsignal(sig))
        if previous == signal.SIG_IGN:
            return
        if previous == signal.SIG_DFL:
            signal.signal(signum, signal.SIG_DFL)
            signal.raise_signal(signum)
            return
        previous(signum, frame)

    def _capture_owned_pending(self) -> None:
        pending = set(self.sigpending()).intersection(self.owned)
        for sig in self.owned:
            if sig not in pending:
                continue
            info = self.sigwait({sig})
            if info is None:
                raise DriverError("run-owned pending signal could not be consumed")
            if self.first is None:
                self.first = int(sig)

    def enable(self) -> None:
        if self.restored:
            raise DriverError("signal owner was already restored")
        self.enabled = True
        self.sigmask(signal.SIG_SETMASK, self.old_mask)

    def checkpoint(self) -> None:
        current = self.sigmask(signal.SIG_BLOCK, self.owned)
        try:
            self._capture_owned_pending()
        finally:
            self.sigmask(signal.SIG_SETMASK, current)
        if self.first is not None:
            raise LifecycleInterrupted(self.first)

    def freeze(self) -> int | None:
        if self.restored:
            return self.first
        self.sigmask(signal.SIG_BLOCK, self.owned)
        self._capture_owned_pending()
        return self.first

    def retain_to_process_exit(self) -> None:
        """Keep owned handlers authoritative in the disposable supervised child."""
        if self.restored:
            raise DriverError("signal owner was already restored")
        self.freeze()
        self.terminal_exit = True
        self.sigmask(signal.SIG_SETMASK, self.old_mask)

    def restore(self) -> None:
        if self.restored:
            return
        first_error: BaseException | None = None
        try:
            self.freeze()
        except BaseException as exc:
            first_error = exc
        # Transfer the mask once while the owner handlers remain installed.
        # The outer supervisor still owns the whole child-restoration interval.
        try:
            self.sigmask(signal.SIG_SETMASK, self.old_mask)
        except BaseException as exc:
            if first_error is None:
                first_error = exc
        try:
            self.sigmask(signal.SIG_BLOCK, self.owned)
            self._capture_owned_pending()
        except BaseException as exc:
            if first_error is None:
                first_error = exc
        for sig, previous in self.previous.items():
            try:
                signal.signal(sig, previous)
            except BaseException as exc:
                if first_error is None:
                    first_error = exc
        try:
            self.sigmask(signal.SIG_SETMASK, self.old_mask)
        except BaseException as exc:
            if first_error is None:
                first_error = exc
        self.ownership_open = False
        self.restored = True
        if first_error is not None:
            raise first_error


_ACTIVE_SIGNALS: LifecycleSignals | None = None


def _run(argv: list[str], *, timeout: float, check: bool = True,
         echo: bool = False, text: bool = True) -> bounded.BoundedResult:
    if _ACTIVE_SIGNALS is not None:
        _ACTIVE_SIGNALS.checkpoint()
    result = bounded.run_completed(
        [str(value) for value in argv], timeout=timeout,
        kill_grace=KILL_GRACE, reap_grace=KILL_GRACE,
        capture_output=True, text=text,
    )
    if result.outcome == "interrupted" and result.signal is not None:
        if _ACTIVE_SIGNALS is not None and _ACTIVE_SIGNALS.first is None:
            _ACTIVE_SIGNALS.first = result.signal
        raise LifecycleInterrupted(result.signal)
    if _ACTIVE_SIGNALS is not None:
        _ACTIVE_SIGNALS.checkpoint()
    if echo:
        if result.stdout:
            output = result.stdout if isinstance(result.stdout, str) else result.stdout.decode("utf-8", "replace")
            print(output, end="")
        if result.stderr:
            output = result.stderr if isinstance(result.stderr, str) else result.stderr.decode("utf-8", "replace")
            print(output, end="", file=sys.stderr)
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


def _verify_authorities(*roots: p.DirectoryAuthority) -> None:
    for root in roots:
        p.verify_directory_authority(root)


def _run_authorized(
    roots: tuple[p.DirectoryAuthority, ...],
    argv: list[str],
    *,
    timeout: float,
    check: bool = True,
    echo: bool = False,
    text: bool = True,
) -> bounded.BoundedResult:
    _verify_authorities(*roots)
    try:
        return _run(argv, timeout=timeout, check=check, echo=echo, text=text)
    finally:
        _verify_authorities(*roots)


def _remove_owned(root: p.DirectoryAuthority,
                  quarantine: p.DirectoryAuthority) -> dict[str, Any]:
    verified = p.utc_now()
    try:
        p.remove_directory_authority(root, quarantine=quarantine)
    except (OSError, p.ProvenanceError):
        return {"state": "unknown", "verified_at": verified,
                "remove_outcome": "ordinary_nonzero",
                "inspect_outcome": "not_run", "clean": False}
    try:
        if root.parent_fd is None or root.name is None:
            raise p.ProvenanceError("owned directory lacks a retained parent")
        os.stat(root.name, dir_fd=root.parent_fd, follow_symlinks=False)
    except FileNotFoundError:
        state = "absent"
    except (OSError, p.ProvenanceError):
        state = "unknown"
    else:
        state = "present"
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


def _create_owned_child(parent: p.DirectoryAuthority,
                        name: str) -> p.DirectoryAuthority:
    return p.create_directory_authority_child(parent, name, mode=0o700)


def _platform() -> str:
    result = _run(["docker", "info", "--format", "{{.OSType}}/{{.Architecture}}"], timeout=60)
    value = (result.stdout or "").strip()
    aliases = {"linux/aarch64": "linux/arm64", "linux/x86_64": "linux/amd64"}
    value = aliases.get(value, value)
    if value not in ip.SUPPORTED_PLATFORMS:
        raise DriverError("Docker server platform is unsupported")
    return value


def _read_snapshot_inputs(
    snapshot: p.DirectoryAuthority,
    records: tuple[dict[str, Any], ...],
) -> tuple[bytes, bytes, dict[str, Any]]:
    """Read capture-bound Dockerfile and lock bytes from retained authority."""
    p.verify_repository_snapshot(snapshot, records)
    dockerfile = p.read_captured_repository_file(
        snapshot, records, DOCKERFILE, max_bytes=1024 * 1024)
    lock_bytes = p.read_captured_repository_file(
        snapshot, records, LOCK_PATH, max_bytes=ip.LOCK_MAX_BYTES)
    lock = ip.load_lock_bytes(lock_bytes)
    p.verify_repository_snapshot(snapshot, records)
    return dockerfile, lock_bytes, lock


def _prepare_context(context: p.DirectoryAuthority,
                     tier: p.DirectoryAuthority,
                     prep: p.DirectoryAuthority,
                     snapshot: p.DirectoryAuthority,
                     snapshot_records: tuple[dict[str, Any], ...],
                     run_id: str, platform: str,
                     lock: dict[str, Any], lock_bytes: bytes,
                     dockerfile_bytes: bytes, mirror: str | None,
                     teardown_state: dict[str, Any]) -> tuple[str, str]:
    teardown_state.clear()
    teardown_state.update(_unknown())
    clean_home = None
    git_dir = None
    gbrain_dir = None
    try:
        _verify_authorities(context, tier, prep, snapshot)
        p.verify_repository_snapshot(snapshot, snapshot_records)
        clean_home = _create_owned_child(prep, "home")
        git_dir = _create_owned_child(prep, "gbrain.git")
        env = _clean_env(clean_home.path)
        _run_authorized(
            (prep, clean_home, git_dir),
            [*env, "git", "init", "--bare", str(git_dir.path)], timeout=60)
        source = mirror or lock["gbrain"]["origin"]
        if mirror:
            candidate = Path(mirror)
            if not candidate.is_absolute() or not candidate.exists():
                raise DriverError("gbrain mirror must be an existing absolute path")
        _run_authorized(
            (prep, clean_home, git_dir),
            [*env, "git", "--git-dir", str(git_dir.path),
             "remote", "add", "origin", source], timeout=30)
        _run_authorized(
            (prep, clean_home, git_dir),
            [*env, "git", "--git-dir", str(git_dir.path), "fetch",
             "--depth=1", "origin", lock["gbrain"]["commit"]],
            timeout=600, echo=True)
        commit = _run_authorized(
            (prep, clean_home, git_dir),
            [*env, "git", "--git-dir", str(git_dir.path),
             "rev-parse", "FETCH_HEAD^{commit}"], timeout=30).stdout.strip()
        tree = _run_authorized(
            (prep, clean_home, git_dir),
            [*env, "git", "--git-dir", str(git_dir.path),
             "rev-parse", "FETCH_HEAD^{tree}"], timeout=30).stdout.strip()
        if commit != lock["gbrain"]["commit"] or tree != lock["gbrain"]["tree"]:
            raise DriverError("gbrain commit/tree mismatched artifact lock")
        archive_result = _run_authorized(
            (prep, clean_home, git_dir),
            [*env, "git", "--git-dir", str(git_dir.path),
             "archive", "--format=tar", commit], timeout=180, text=False)
        archive = archive_result.stdout or b""
        if not isinstance(archive, bytes):
            raise DriverError("gbrain archive output was not binary")
        if p.sha256_bytes(archive) != lock["gbrain"]["archive_sha256"]:
            raise DriverError("gbrain archive hash mismatched artifact lock")
        gbrain_dir = _create_owned_child(context, "gbrain")
        _verify_authorities(context, gbrain_dir)
        with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as handle:
            handle.extractall(gbrain_dir.path, filter="data")
        _verify_authorities(context, gbrain_dir)
        try:
            package = json.loads(p.read_owned_regular_text(
                gbrain_dir, "package.json", max_bytes=1024 * 1024))
        except (UnicodeError, json.JSONDecodeError, p.ProvenanceError) as exc:
            raise DriverError("gbrain package metadata is unavailable") from exc
        if package.get("version") != lock["gbrain"]["package_version"]:
            raise DriverError("gbrain package version mismatched artifact lock")
        bun = lock["bun"]["platforms"][platform]
        bun_url = ("https://github.com/oven-sh/bun/releases/download/"
                   f"bun-v{lock['bun']['version']}/{bun['artifact']}")
        bun_result = _run_authorized(
            (context, clean_home),
            [*_clean_env(clean_home.path), "curl", "--fail", "--location",
             "--silent", "--show-error", "--proto", "=https", "--tlsv1.2",
             bun_url], timeout=300, text=False)
        bun_bytes = bun_result.stdout or b""
        if not isinstance(bun_bytes, bytes):
            raise DriverError("Bun artifact output was not binary")
        if p.sha256_bytes(bun_bytes) != bun["sha256"]:
            raise DriverError("Bun artifact hash mismatched artifact lock")
        p.write_owned_regular_bytes(context, "bun-artifact.zip", bun_bytes)
        p.verify_directory_authority(snapshot)
        p.write_owned_regular_bytes(
            context, "Dockerfile", dockerfile_bytes, mode=0o644)
        p.write_owned_regular_bytes(
            context, "artifact-lock.json", lock_bytes, mode=0o644)
        p.verify_directory_authority(snapshot)
        p.write_owned_regular_bytes(
            context, "integration-run.json",
            (json.dumps({"run_id": run_id, "platform": platform},
                        sort_keys=True, separators=(",", ":")) + "\n").encode(),
            mode=0o644)
        _verify_authorities(context, snapshot)
        inputs = p.owned_regular_paths(context)
        input_hash = p.hash_declared_inputs_authority(context, inputs)
        dockerfile_hash = p.sha256_bytes(p.read_owned_regular_bytes(
            context, "Dockerfile", max_bytes=1024 * 1024))
        _verify_authorities(context, snapshot)
        p.verify_repository_snapshot(snapshot, snapshot_records)
    finally:
        prep_result = _remove_owned(prep, tier)
        teardown_state.clear()
        teardown_state.update(prep_result)
        for authority in (gbrain_dir, git_dir, clean_home):
            if authority is not None:
                authority.close()
        if not prep_result["clean"] and sys.exc_info()[0] is None:
            raise DriverError("run-owned source preparation could not be removed")
    return input_hash, dockerfile_hash


def _build_image(tier: p.DirectoryAuthority,
                 context: p.DirectoryAuthority,
                 run_id: str, platform: str,
                 lock: dict[str, Any], input_hash: str, tag: str,
                 dockerfile_hash: str, no_cache: bool) -> tuple[dict[str, Any], str]:
    iidfile = tier.path / "image.iid"
    bun = lock["bun"]["platforms"][platform]
    base_digest = lock["base_image"]["platforms"][platform]
    args = ["docker", "build", "--platform", platform, "--iidfile", str(iidfile),
            "-f", str(context.path / "Dockerfile"), "-t", tag]
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
    args.append(str(context.path))
    p.require_owned_entry_absent(tier, "image.iid")
    started = p.utc_now()
    _run_authorized((tier, context), args, timeout=900, echo=True)
    finished = p.utc_now()
    try:
        image_id = p.read_owned_regular_text(
            tier, "image.iid", max_bytes=256).strip()
    except (FileNotFoundError, p.ProvenanceError) as exc:
        raise DriverError("integration iidfile was not safely published") from exc
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
        raise DriverError("integration iidfile identity is invalid")
    inspected = _json_result(
        _run(["docker", "image", "inspect", image_id], timeout=60),
        "image inspect")
    if not isinstance(inspected, list) or len(inspected) != 1:
        raise DriverError("image inspect returned the wrong row count")
    safe = ip.safe_image_identity(
        inspected[0], expected_id=image_id, run_id=run_id, platform=platform,
        base_image_digest=lock["base_image"]["platforms"][platform],
        dockerfile_sha256=dockerfile_hash, input_sha256=input_hash, tag=tag,
        started_at=started, finished_at=finished)
    return safe, image_id


def _create_container(tier: p.DirectoryAuthority,
                      snapshot: p.DirectoryAuthority,
                      share: p.DirectoryAuthority,
                      run_id: str, image_id: str,
                      name: str) -> tuple[dict[str, Any], str, str]:
    cidfile = tier.path / "container.cid"
    args = ["docker", "create", "--cidfile", str(cidfile), "--name", name,
            "--label", f"org.prime-claw.test.contract={ip.CONTRACT}",
            "--label", f"org.prime-claw.test.run={run_id}",
            "--network", "none",
            "--mount", f"type=bind,src={snapshot.path},dst=/workspace,readonly",
            "--mount", f"type=bind,src={share.path},dst=/results",
            image_id]
    p.require_owned_entry_absent(tier, "container.cid")
    _run_authorized((tier, snapshot, share), args, timeout=60, echo=True)
    try:
        container_id = p.read_owned_regular_text(
            tier, "container.cid", max_bytes=256).strip()
    except (FileNotFoundError, p.ProvenanceError) as exc:
        raise DriverError("integration cidfile was not safely published") from exc
    if not re.fullmatch(r"[0-9a-f]{64}", container_id):
        raise DriverError("integration cidfile identity is invalid")
    started = _run_authorized(
        (tier, snapshot, share),
        ["docker", "start", container_id], timeout=60)
    if (started.stdout or "").strip() != container_id:
        raise DriverError("docker start identity mismatched captured container")
    rows = _json_result(
        _run_authorized(
            (tier, snapshot, share),
            ["docker", "inspect", container_id], timeout=60),
        "container inspect")
    if not isinstance(rows, list) or len(rows) != 1:
        raise DriverError("container inspect returned the wrong row count")
    safe = ip.safe_container_boundary(
        rows[0], expected_id=container_id, image_id=image_id, run_id=run_id,
        name=name, repository_authority=snapshot, result_authority=share)
    _verify_authorities(snapshot, share)
    return safe, container_id, name


def _verify_container(container_id: str, *, image_id: str, run_id: str,
                      name: str, snapshot: p.DirectoryAuthority,
                      share: p.DirectoryAuthority) -> dict[str, Any]:
    _verify_authorities(snapshot, share)
    rows = _json_result(
        _run_authorized(
            (snapshot, share),
            ["docker", "inspect", container_id], timeout=60),
        "container inspect")
    if not isinstance(rows, list) or len(rows) != 1:
        raise DriverError("container inspect returned the wrong row count")
    safe = ip.safe_container_boundary(
        rows[0], expected_id=container_id, image_id=image_id, run_id=run_id,
        name=name, repository_authority=snapshot, result_authority=share)
    _verify_authorities(snapshot, share)
    return safe


def _recovery_inspect_row(
    result: bounded.BoundedResult,
    selector: str,
    *,
    kind: str,
) -> tuple[str, dict[str, Any] | None, dict[str, Any] | None]:
    state = ip.exact_absence(result, selector, kind=kind)
    if state == "absent":
        return "absent", None, None
    if result.outcome != "exited" or result.returncode != 0:
        return "unknown", None, None
    try:
        rows = json.loads(result.stdout or "")
    except (TypeError, json.JSONDecodeError):
        return "unknown", None, None
    if (not isinstance(rows, list) or len(rows) != 1
            or not isinstance(rows[0], dict)):
        return "unknown", None, None
    row = rows[0]
    config = row.get("Config")
    if not isinstance(config, dict):
        return "unknown", None, None
    labels = config.get("Labels")
    if not isinstance(labels, dict):
        return "unknown", None, None
    return "present", row, labels


def _ownership_state(kind: str, identity: str, run_id: str,
                     *, expected_image: str = "") -> str:
    command = ["docker", "inspect", identity]
    if kind == "image":
        command = ["docker", "image", "inspect", identity]
    inspected = _run(command, timeout=30, check=False)
    state, row, labels = _recovery_inspect_row(
        inspected, identity, kind=kind)
    if state != "present" or row is None or labels is None:
        return state
    if (row.get("Id") != identity
            or labels.get("org.prime-claw.test.contract") != ip.CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id):
        return "unknown"
    if kind == "container":
        expected_name = "/prime-claw-integration-" + run_id.lower()
        if (row.get("Name") != expected_name
                or (expected_image and row.get("Image") != expected_image)):
            return "unknown"
    return "owned"


def _already_absent() -> dict[str, Any]:
    return {"state": "absent", "verified_at": p.utc_now(),
            "remove_outcome": "not_needed",
            "inspect_outcome": "ordinary_nonzero", "clean": True}


def _capture_file(tier: p.OwnedDirectory | p.DirectoryAuthority,
                  relative: str,
                  pattern: re.Pattern[str]) -> tuple[str, str]:
    try:
        value = p.read_owned_regular_text(tier, relative, max_bytes=256).strip()
    except FileNotFoundError:
        return "missing", ""
    except p.ProvenanceError:
        return "unknown", ""
    return ("valid", value) if pattern.fullmatch(value) else ("unknown", "")


def _inspect_owned_image(selector: str, run_id: str, tag: str,
                         *, expected_id: str = "") -> tuple[str, str]:
    inspected = _run(["docker", "image", "inspect", selector], timeout=30, check=False)
    state, row, labels = _recovery_inspect_row(
        inspected, selector, kind="image")
    if state == "absent":
        return "absent", expected_id
    if state != "present" or row is None or labels is None:
        return "unknown", expected_id
    identity = row.get("Id")
    try:
        ip.safe_local_image_references(row, tag)
    except p.ProvenanceError:
        return "unknown", expected_id
    if (not isinstance(identity, str)
            or not re.fullmatch(r"sha256:[0-9a-f]{64}", identity)
            or (expected_id and identity != expected_id)
            or labels.get("org.prime-claw.test.contract") != ip.CONTRACT
            or labels.get("org.prime-claw.test.run") != run_id):
        return "unknown", expected_id
    return "owned", identity


def _recover_image(tier: p.OwnedDirectory | p.DirectoryAuthority,
                   run_id: str, tag: str) -> tuple[str, str]:
    capture, identity = _capture_file(
        tier, "image.iid", re.compile(r"sha256:[0-9a-f]{64}"))
    if capture == "unknown":
        return "unknown", ""
    if capture == "valid":
        return _inspect_owned_image(identity, run_id, tag, expected_id=identity)
    return _inspect_owned_image(tag, run_id, tag)


def _recover_container(tier: p.OwnedDirectory | p.DirectoryAuthority,
                       run_id: str, name: str,
                       expected_image: str) -> tuple[str, str, str]:
    capture, identity = _capture_file(
        tier, "container.cid", re.compile(r"[0-9a-f]{64}"))
    selector = identity if capture == "valid" else name
    if capture == "unknown":
        return "unknown", "", expected_image
    inspected = _run(["docker", "inspect", selector], timeout=30, check=False)
    state, row, labels = _recovery_inspect_row(
        inspected, selector, kind="container")
    if state == "absent":
        return "absent", identity, expected_image
    if state != "present" or row is None or labels is None:
        return "unknown", identity, expected_image
    observed_id = row.get("Id")
    observed_image = row.get("Image")
    if (not isinstance(observed_id, str)
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


def _await_supervisor_ack(
    status_root: p.DirectoryAuthority,
    nonce: str,
    *,
    timeout: float = 10.0,
) -> None:
    deadline = time.monotonic() + timeout
    while True:
        try:
            row = json.loads(p.read_owned_regular_text(
                status_root, "ack.json", max_bytes=1024))
        except FileNotFoundError:
            if time.monotonic() >= deadline:
                raise DriverError("integration supervisor acknowledgement timed out")
            time.sleep(0.01)
            continue
        except (UnicodeError, json.JSONDecodeError,
                p.ProvenanceError) as exc:
            raise DriverError(
                "integration supervisor acknowledgement is unsafe") from exc
        if (not isinstance(row, dict) or set(row) != {"nonce"}
                or row.get("nonce") != nonce):
            raise DriverError("integration supervisor acknowledgement mismatched")
        return


def _run_owned(args: argparse.Namespace, owner: LifecycleSignals | None) -> int:
    global _ACTIVE_SIGNALS
    lock: dict[str, Any] | None = None
    lock_bytes: bytes | None = None
    dockerfile_bytes: bytes | None = None
    snapshot_records: tuple[dict[str, Any], ...] = ()
    if args.dry_run:
        ip.load_lock(REPO / LOCK_PATH)
        print("integration driver: validate locked gbrain/Bun/base identities")
        print("integration driver: allocate run-owned snapshot/context/share/iid/cid")
        print("integration driver: build exact native-platform image; delete verified context")
        print("integration driver: create by image ID with repository:ro, results:rw, --network none")
        print("integration driver: inspect mounts/ports/env/labels; run explicit inner attestation")
        print("integration driver: exact container then image teardown; publish validated manifest")
        return 0
    if owner is None:
        raise DriverError("signal owner is required")

    platform = _platform()
    if owner.freeze() is not None:
        return 128 + int(owner.first or signal.SIGTERM)
    results_root = Path(os.path.abspath(args.results_root or DEFAULT_RESULTS))
    run_id, tier_dir, tier_binding = p.allocate_run_tree(results_root, "integration")
    tier = p.open_directory_authority(tier_dir, tier_binding)
    started = p.utc_now()
    print(f"integration driver: run={run_id} platform={platform} results={tier_dir}")

    repository: dict[str, Any] | None = None
    snapshot_path = results_root / ".workspaces" / run_id
    snapshot: p.DirectoryAuthority | None = None
    status_owned: p.DirectoryAuthority | None = None
    share: p.DirectoryAuthority | None = None
    context: p.DirectoryAuthority | None = None
    prep: p.DirectoryAuthority | None = None
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
    clean = False

    try:
        status_root = os.environ.get("PRIME_CLAW_INTEGRATION_STATUS_ROOT")
        status_binding = os.environ.get("PRIME_CLAW_INTEGRATION_STATUS_BINDING")
        if not status_root or not status_binding:
            raise DriverError("integration final-owner status authority is required")
        status_owned = p.open_directory_authority(status_root, status_binding)
        nonce = secrets.token_hex(32)
        p.write_owned_regular_bytes(
            status_owned, "status.json",
            p.canonical_json({
                "tier_dir": str(tier.path),
                "binding": tier.binding.encode(),
                "nonce": nonce,
            }).encode("utf-8"),
            mode=0o600)
        _await_supervisor_ack(status_owned, nonce)
        owner.enable()
        owner.checkpoint()
        repository = p.repository_identity(REPO)
        p.write_sanitized_json(tier, "repository.json", repository)

        snapshot_teardown = _unknown()
        p.verify_directory_authority(tier)
        snapshot_capture = p.capture_repository_snapshot(REPO, snapshot_path)
        snapshot = snapshot_capture.authority
        snapshot_repository = snapshot_capture.identity
        snapshot_records = snapshot_capture.records
        if snapshot_repository != repository:
            raise DriverError("repository changed while the run snapshot was staged")
        dockerfile_bytes, lock_bytes, lock = _read_snapshot_inputs(
            snapshot, snapshot_records)
        p.write_sanitized_json(tier, "artifact-lock.json", lock)

        share_teardown = _unknown()
        share = _create_owned_child(tier, "share")
        context_teardown = _unknown()
        context = _create_owned_child(tier, "build-context")
        prep = _create_owned_child(tier, "preparation")
        input_hash, dockerfile_hash = _prepare_context(
            context, tier, prep, snapshot, snapshot_records,
            run_id, platform, lock,
            lock_bytes, dockerfile_bytes, args.gbrain_mirror,
            preparation_teardown)
        image_tag = f"{IMAGE_REPO}:{input_hash[:12]}"
        image_safe, image_id = _build_image(
            tier, context, run_id, platform, lock, input_hash, image_tag,
            dockerfile_hash, args.rebuild)
        image_owned = True
        p.write_sanitized_json(tier, "image.json", image_safe)
        context_teardown = _remove_owned(context, tier)
        if not context_teardown["clean"]:
            raise DriverError("verified build context could not be removed")
        p.verify_repository_snapshot(snapshot, snapshot_records)
        container_safe, container_id, container_name = _create_container(
            tier, snapshot, share, run_id, image_id, container_name)
        p.verify_repository_snapshot(snapshot, snapshot_records)
        container_owned = True
        p.write_sanitized_json(tier, "boundary.json", container_safe)
        attestation = hashlib.sha256(
            f"{run_id}:{container_id}:{image_id}".encode()).hexdigest()
        p.require_owned_entry_absent(share, "body.json")
        p.verify_repository_snapshot(snapshot, snapshot_records)
        executed = _run_authorized((tier, snapshot, share), [
            "docker", "exec", "--env",
            f"PRIME_CLAW_INTEGRATION_ATTESTATION={attestation}",
            "--env", f"PRIME_CLAW_INTEGRATION_RUN_ID={run_id}", container_id,
            "python3", "/workspace/tests/integration/environment_body.py",
            "--attestation", attestation, "--run-id", run_id,
        ], timeout=300, echo=True)
        p.verify_repository_snapshot(snapshot, snapshot_records)
        if executed.outcome != "exited" or executed.returncode != 0:
            raise DriverError("integration body failed")
        try:
            body_raw = json.loads(p.read_owned_regular_text(
                share, "body.json", max_bytes=2 * 1024 * 1024))
        except (FileNotFoundError, UnicodeError, json.JSONDecodeError,
                p.ProvenanceError) as exc:
            raise DriverError("integration body receipt is unavailable") from exc
        body = ip.validate_body(body_raw, lock, run_id=run_id,
                                platform=platform, attestation=attestation)
        if body["base_image_digest"] != image_safe["base_image_digest"]:
            raise DriverError("embedded base-image identity mismatched host evidence")
        post_boundary = _verify_container(
            container_id, image_id=image_id, run_id=run_id,
            name=container_name, snapshot=snapshot, share=share)
        if post_boundary != container_safe:
            raise DriverError("container boundary drifted during assertion phase")
        p.write_sanitized_json(tier, "body.json", body)
        owner.checkpoint()
        primary_ok = True
    except LifecycleInterrupted as exc:
        owner.first = owner.first or exc.signum
        failure_codes.append("interrupted")
        print("integration driver: interrupted; closing exact owned resources",
              file=sys.stderr)
    except (DriverError, OSError, ValueError, p.ProvenanceError,
            tarfile.TarError, json.JSONDecodeError) as exc:
        failure_codes.append("primary-command-failed")
        print(f"integration driver: FAILED: {exc}", file=sys.stderr)
    finally:
        owner.freeze()
        _ACTIVE_SIGNALS = None
        if owner.first is not None and "interrupted" not in failure_codes:
            failure_codes.append("interrupted")
            primary_ok = False

        try:
            p.write_sanitized_json(tier, "preparation.json", preparation_teardown)
        except Exception as exc:
            print(f"integration driver: preparation evidence failed: {exc}",
                  file=sys.stderr)
            if "evidence-publication-failed" not in failure_codes:
                failure_codes.append("evidence-publication-failed")
            primary_ok = False

        container_state = "owned" if container_owned else ""
        if not container_owned:
            try:
                container_state, recovered_container, recovered_image = _recover_container(
                    tier, run_id, container_name, image_id)
                if recovered_container:
                    container_id = recovered_container
                if not image_id and recovered_image:
                    image_id = recovered_image
            except Exception as exc:
                print(f"integration driver: container recovery failed: {exc}",
                      file=sys.stderr)
                container_state = "unknown"

        image_state = "owned" if image_owned else ""
        if not image_owned:
            try:
                if image_id and image_tag:
                    image_state, image_id = _inspect_owned_image(
                        image_id, run_id, image_tag, expected_id=image_id)
                elif image_tag:
                    image_state, image_id = _recover_image(tier, run_id, image_tag)
                else:
                    capture, captured = _capture_file(
                        tier, "image.iid", re.compile(r"sha256:[0-9a-f]{64}"))
                    if capture == "valid":
                        image_id = captured
                        image_state = _ownership_state(
                            "image", image_id, run_id)
                    elif capture == "unknown":
                        image_state = "unknown"
                    else:
                        image_state = "absent"
            except Exception as exc:
                print(f"integration driver: image recovery failed: {exc}",
                      file=sys.stderr)
                image_state = "unknown"

        if container_state == "owned" and container_id:
            try:
                container_teardown = _cleanup_container(container_id)
            except Exception as exc:
                print(f"integration driver: container cleanup failed: {exc}",
                      file=sys.stderr)
                container_teardown = _unknown()
        elif container_state == "absent":
            container_teardown = _already_absent()
        elif container_state:
            container_teardown = _unknown()

        if image_state == "owned" and image_id:
            try:
                image_teardown = _cleanup_image(image_id)
            except Exception as exc:
                print(f"integration driver: image cleanup failed: {exc}",
                      file=sys.stderr)
                image_teardown = _unknown()
        elif image_state == "absent":
            image_teardown = _already_absent()
        elif image_state:
            image_teardown = _unknown()

        if context is not None and not context_teardown["clean"]:
            try:
                context_teardown = _remove_owned(context, tier)
            except Exception as exc:
                print(f"integration driver: context cleanup failed: {exc}",
                      file=sys.stderr)
                context_teardown = _unknown()
        if snapshot is None:
            try:
                os.lstat(snapshot_path)
            except FileNotFoundError:
                snapshot_teardown = _already_absent()
            except OSError:
                snapshot_teardown = _unknown()
        if container_teardown["clean"]:
            if snapshot is not None and not snapshot_teardown["clean"]:
                try:
                    snapshot_teardown = _remove_owned(snapshot, tier)
                except Exception as exc:
                    print(f"integration driver: snapshot cleanup failed: {exc}",
                          file=sys.stderr)
                    snapshot_teardown = _unknown()
            if share is not None and not share_teardown["clean"]:
                try:
                    share_teardown = _remove_owned(share, tier)
                except Exception as exc:
                    print(f"integration driver: share cleanup failed: {exc}",
                          file=sys.stderr)
                    share_teardown = _unknown()
        elif snapshot is not None or share is not None:
            print("integration driver: mounted state retained because container teardown is non-clean",
                  file=sys.stderr)

        teardown_rows = (preparation_teardown, container_teardown,
                         image_teardown, context_teardown,
                         snapshot_teardown, share_teardown)
        clean = all(row["clean"] for row in teardown_rows)
        if not clean and "cleanup-failed" not in failure_codes:
            failure_codes.append("cleanup-failed")
        status = "passed" if primary_ok and clean and not failure_codes else "failed"
        if status == "passed":
            failure_codes = []
        teardown = {
            "preparation": preparation_teardown,
            "container": container_teardown,
            "image": image_teardown,
            "context": context_teardown,
            "snapshot": snapshot_teardown,
            "share": share_teardown,
            "clean": clean,
        }
        if repository is not None:
            try:
                files = ip.evidence_inventory(tier)
                manifest = _manifest(
                    run_id=run_id, started=started, status=status,
                    failure_codes=failure_codes, repository=repository,
                    platform=platform,
                    artifact_lock_sha256=hashlib.sha256(
                        p.canonical_json(lock).encode()).hexdigest(),
                    body=body, image=image_safe, container=container_safe,
                    teardown=teardown, files=files)
                ip.verify_evidence(tier, manifest)
                if status_owned is None:
                    raise DriverError("integration final-owner status authority was lost")
                p.write_sanitized_json(
                    status_owned, "candidate.json", manifest)
                publication_ok = True
            except Exception as exc:
                print(f"integration driver: manifest publication failed: {exc}",
                      file=sys.stderr)

    _ACTIVE_SIGNALS = None
    interrupted = owner.freeze()
    result = (128 + interrupted if interrupted is not None
              else 0 if primary_ok and clean and publication_ok else 1)
    for authority in (prep, context, share, snapshot, tier, status_owned):
        if authority is not None:
            authority.close()
    return result


def run(args: argparse.Namespace) -> int:
    global _ACTIVE_SIGNALS
    if args.dry_run:
        return _run_owned(args, None)
    owner = LifecycleSignals()
    _ACTIVE_SIGNALS = owner
    supervised = os.environ.get("PRIME_CLAW_INTEGRATION_INNER") == "1"
    try:
        result = _run_owned(args, owner)
    except BaseException:
        _ACTIVE_SIGNALS = None
        owner.restore()
        raise
    _ACTIVE_SIGNALS = None
    if supervised:
        # This process is disposable. Do not restore a returning/ignored prior
        # handler and create an unobservable direct-child signal window. The
        # outer supervisor remains the final publisher while these handlers
        # stay active through interpreter exit.
        owner.retain_to_process_exit()
    else:
        owner.restore()
    if owner.first is not None:
        return 128 + owner.first
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rebuild", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--results-root")
    parser.add_argument("--gbrain-mirror", default=os.environ.get("INTEGRATION_GBRAIN_MIRROR"))
    return run(parser.parse_args(argv))


if __name__ == "__main__":
    raise SystemExit(main())
