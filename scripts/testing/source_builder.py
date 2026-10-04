#!/usr/bin/env python3
"""Host orchestrator for the disposable read-only Prime Agent source builder."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import signal
import stat
import sys
from typing import Any

from scripts.testing import bounded
from scripts.testing import provenance

SHA256 = re.compile(r"[0-9a-f]{64}")
IMAGE_ID = re.compile(r"sha256:[0-9a-f]{64}")
CONTAINER_ID = re.compile(r"[0-9a-f]{64}")
SEMVER = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?")


class BuilderError(RuntimeError):
    pass


class BuilderInterrupted(BaseException):
    def __init__(self, signum: int) -> None:
        self.signum = signum
        super().__init__("source builder interrupted")


def _safe_mount_source(path: Path) -> str:
    raw = os.fspath(path)
    if not path.is_absolute() or any(ch in raw for ch in (",", "\n", "\r", "\0")):
        raise BuilderError("source selector is not a safe absolute mount path")
    return raw


def _run(argv: list[str], *, timeout: float, policy: str = "capture"):
    result = bounded.run_completed(
        argv, timeout=timeout, kill_grace=5.0, reap_grace=5.0,
        capture_output=True, text=True,
    )
    if result.outcome == "interrupted" and result.signal is not None:
        raise BuilderInterrupted(result.signal)
    return result


def _require_success(result, stage: str) -> None:
    if result.outcome != "exited" or result.returncode != 0:
        raise BuilderError(f"{stage} failed")


def _read_regular(path: Path, *, maximum: int = 1024 * 1024) -> bytes:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode) or before.st_size > maximum:
        raise BuilderError("builder output is not a bounded regular file")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        opened = os.fstat(fd)
        if (opened.st_dev, opened.st_ino, opened.st_mode) != (
                before.st_dev, before.st_ino, before.st_mode):
            raise BuilderError("builder output changed while opened")
        chunks = []
        size = 0
        while chunk := os.read(fd, 1024 * 1024):
            size += len(chunk)
            if size > maximum:
                raise BuilderError("builder output exceeds size limit")
            chunks.append(chunk)
        after = os.fstat(fd)
        stable = (opened.st_dev, opened.st_ino, opened.st_mode,
                  opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns)
        observed = (after.st_dev, after.st_ino, after.st_mode,
                    after.st_size, after.st_mtime_ns, after.st_ctime_ns)
        if stable != observed:
            raise BuilderError("builder output changed while read")
        return b"".join(chunks)
    finally:
        os.close(fd)


def _hash_regular(path: Path) -> tuple[str, int, int]:
    before = path.lstat()
    if not stat.S_ISREG(before.st_mode):
        raise BuilderError("release output is not a regular file")
    fd = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
    try:
        opened = os.fstat(fd)
        if (opened.st_dev, opened.st_ino, opened.st_mode) != (
                before.st_dev, before.st_ino, before.st_mode):
            raise BuilderError("release output changed while opened")
        digest = hashlib.sha256()
        while chunk := os.read(fd, 1024 * 1024):
            digest.update(chunk)
        after = os.fstat(fd)
        stable = (opened.st_dev, opened.st_ino, opened.st_mode,
                  opened.st_size, opened.st_mtime_ns, opened.st_ctime_ns)
        observed = (after.st_dev, after.st_ino, after.st_mode,
                    after.st_size, after.st_mtime_ns, after.st_ctime_ns)
        if stable != observed:
            raise BuilderError("release output changed while hashed")
        return digest.hexdigest(), stat.S_IMODE(opened.st_mode), opened.st_size
    finally:
        os.close(fd)


def _validate_release(output: Path, manifest: Any) -> dict[str, Any]:
    required = {
        "schema_version", "source", "source_rules", "package_version",
        "pack_command_sha256", "artifact", "output_inventory",
        "output_inventory_sha256",
    }
    if not isinstance(manifest, dict) or set(manifest) != required:
        raise BuilderError("invalid builder output manifest shape")
    if manifest["schema_version"] != 1:
        raise BuilderError("unsupported builder output schema")
    version = manifest["package_version"]
    if not isinstance(version, str) or not SEMVER.fullmatch(version):
        raise BuilderError("invalid builder package version")
    if not SHA256.fullmatch(str(manifest["pack_command_sha256"])):
        raise BuilderError("invalid pack command identity")
    records = manifest["output_inventory"]
    if not isinstance(records, list) or not records:
        raise BuilderError("empty builder output inventory")
    observed_paths = {"builder-output.json"}
    previous = None
    for record in records:
        if not isinstance(record, dict) or set(record) != {
            "path", "kind", "mode", "size", "content_sha256"
        }:
            raise BuilderError("invalid release output record")
        raw = record["path"]
        rel = PurePosixPath(raw) if isinstance(raw, str) else PurePosixPath("/")
        if (rel.is_absolute() or not rel.parts or rel.parts[0] != "artifacts"
                or any(part in {"", ".", ".."} for part in rel.parts)):
            raise BuilderError("unsafe release output path")
        if previous is not None and raw <= previous:
            raise BuilderError("release output records are not strictly ordered")
        previous = raw
        if (record["kind"] != "file" or record["mode"] != 0o644
                or isinstance(record["size"], bool)
                or not isinstance(record["size"], int) or record["size"] < 0
                or not SHA256.fullmatch(str(record["content_sha256"]))):
            raise BuilderError("invalid release output metadata")
        target = output.joinpath(*rel.parts)
        digest, mode, size = _hash_regular(target)
        if (digest != record["content_sha256"] or mode != record["mode"]
                or size != record["size"]):
            raise BuilderError("release output identity mismatch")
        observed_paths.add(rel.as_posix())
    actual_paths = set()
    for entry in output.rglob("*"):
        relative = entry.relative_to(output).as_posix()
        if entry.is_symlink():
            raise BuilderError("release output contains a symlink")
        mode = entry.lstat().st_mode
        if stat.S_ISDIR(mode):
            continue
        if not stat.S_ISREG(mode):
            raise BuilderError("release output contains a special file")
        actual_paths.add(relative)
    if actual_paths != observed_paths:
        raise BuilderError("release output contains missing or extra files")
    calculated = provenance._framed_hash(records, domain="source-builder-output-v1")
    if calculated != manifest["output_inventory_sha256"]:
        raise BuilderError("release output inventory hash mismatch")
    main = manifest["artifact"]
    expected_main = f"artifacts/prime-agent-{version}.tgz"
    matches = [record for record in records if record["path"] == expected_main]
    if not isinstance(main, dict) or len(matches) != 1 or main != matches[0]:
        raise BuilderError("main release artifact identity mismatch")
    sums = output / "artifacts" / "SHA256SUMS"
    sum_bytes = _read_regular(sums).decode("utf-8", "strict")
    declared = {}
    for line in sum_bytes.splitlines():
        parts = line.split()
        if len(parts) != 2 or not SHA256.fullmatch(parts[0]):
            raise BuilderError("invalid SHA256SUMS")
        name = parts[1].lstrip("*")
        if "/" in name or name in declared:
            raise BuilderError("invalid SHA256SUMS filename")
        declared[name] = parts[0]
    tarballs = {PurePosixPath(record["path"]).name: record["content_sha256"]
                for record in records if record["path"].endswith(".tgz")}
    expected_tarballs = {
        f"prime-agent-{version}.tgz",
        f"prime-agent-ai-{version}.tgz",
        f"prime-agent-core-{version}.tgz",
        f"prime-agent-tui-{version}.tgz",
    }
    expected_outputs = {
        *(f"artifacts/{name}" for name in expected_tarballs),
        "artifacts/SHA256SUMS", "artifacts/stable", "artifacts/latest.json",
    }
    output_paths = {record["path"] for record in records}
    if set(tarballs) != expected_tarballs or output_paths != expected_outputs:
        raise BuilderError("release output set is incomplete or contains extras")
    if declared != tarballs:
        raise BuilderError("SHA256SUMS does not match release tarballs")
    return manifest


def _image_identity(tier: provenance.OwnedDirectory, tier_dir: Path,
                    context: Path, iidfile: Path, started: str,
                    finished: str) -> dict[str, Any]:
    try:
        image_id = _read_regular(iidfile, maximum=256).decode("ascii").strip()
    except (UnicodeDecodeError, OSError) as exc:
        raise BuilderError("builder iidfile is invalid") from exc
    if not IMAGE_ID.fullmatch(image_id):
        raise BuilderError("builder iidfile identity is invalid")
    inspected = _run(["docker", "image", "inspect", image_id], timeout=60)
    _require_success(inspected, "builder image inspection")
    try:
        rows = json.loads(inspected.stdout)
        row = rows[0]
    except (json.JSONDecodeError, IndexError, TypeError) as exc:
        raise BuilderError("builder image inspection was invalid") from exc
    dockerfile_hash = provenance.sha256_file(context / "Dockerfile")
    input_hash = provenance.hash_declared_inputs(
        context, ["Dockerfile", "source_builder_payload.py"])
    safe = provenance.image_identity(
        row, expected_id=image_id,
        dockerfile="docker/test-prime-agent-builder.Dockerfile",
        dockerfile_sha256=dockerfile_hash,
        declared_input_sha256=input_hash,
        informational_tag=f"prime-claw-test-prime-agent-builder:{input_hash[:12]}",
        build_started_at=started, build_finished_at=finished,
    )
    provenance.write_sanitized_json(tier, "source-builder-image.json", safe)
    return safe


def _attest_builder_mounts(container_id: str) -> None:
    inspected = _run([
        "docker", "inspect", "--format", "{{json .Mounts}}", container_id,
    ], timeout=30)
    _require_success(inspected, "builder mount inspection")
    try:
        rows = json.loads(inspected.stdout)
    except (json.JSONDecodeError, TypeError) as exc:
        raise BuilderError("builder mount inspection was invalid") from exc
    if not isinstance(rows, list) or len(rows) != 3:
        raise BuilderError("builder mount set is invalid")
    expected = {
        "/source": False,
        "/input/source-manifest.json": False,
        "/output": True,
    }
    observed = {}
    for row in rows:
        if not isinstance(row, dict) or row.get("Type") != "bind":
            raise BuilderError("builder mount type is invalid")
        destination = row.get("Destination")
        writable = row.get("RW")
        if destination in observed or not isinstance(writable, bool):
            raise BuilderError("builder mount identity is invalid")
        observed[destination] = writable
    if observed != expected:
        raise BuilderError("builder mount isolation contract is not satisfied")


def _remove_container(container_id: str) -> dict[str, Any]:
    removed = _run(["docker", "rm", "-f", container_id], timeout=60)
    remove_outcome = ("clean" if removed.outcome == "exited"
                      and removed.returncode == 0 else
                      "ordinary_nonzero" if removed.outcome == "exited" else
                      removed.outcome)
    inspected = _run(["docker", "inspect", container_id], timeout=30)
    if inspected.outcome == "exited" and inspected.returncode != 0:
        state = "absent"
        inspect_outcome = "ordinary_nonzero"
    elif inspected.outcome == "exited" and inspected.returncode == 0:
        state = "present"
        inspect_outcome = "clean"
    else:
        state = "unknown"
        inspect_outcome = inspected.outcome
    clean = (state == "absent" and remove_outcome in {"clean", "ordinary_nonzero"})
    return {"container_id": container_id, "state": state,
            "remove_outcome": remove_outcome,
            "inspect_outcome": inspect_outcome, "clean": clean,
            "verified_at": provenance.utc_now()}


def execute(args: argparse.Namespace) -> int:
    source = Path(args.source)
    workspace = Path(args.workspace)
    tier_dir = Path(args.tier_dir)
    share = Path(args.share)
    source_mount = _safe_mount_source(source)
    context_cap = None
    output_cap = None
    container_id = None
    container_attempted = False
    image = None
    teardown = {"container_id": None, "state": "absent",
                "remove_outcome": "not_needed", "inspect_outcome": "not_needed",
                "clean": True, "verified_at": provenance.utc_now()}
    before = None
    after = None
    source_manifest = None
    release = None
    failure_codes: list[str] = []
    started = provenance.utc_now()
    pending_signal = None
    finalizing = False
    watched = tuple(sig for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP)
                    if sig is not None)
    terminal_sigmask = getattr(signal, "pthread_sigmask", None)
    terminal_sigpending = getattr(signal, "sigpending", None)
    if terminal_sigmask is None or terminal_sigpending is None:
        raise BuilderError("source builder requires POSIX signal-mask support")
    caller_mask = terminal_sigmask(signal.SIG_BLOCK, [])
    caller_owned_pending = set(terminal_sigpending())
    previous = {sig: signal.getsignal(sig) for sig in watched}

    def on_signal(signum, _frame):
        nonlocal pending_signal
        pending_signal = pending_signal or signum
        if not finalizing:
            raise BuilderInterrupted(signum)

    installed_handlers = []
    terminal_sigmask(signal.SIG_BLOCK, watched)
    try:
        for sig in watched:
            signal.signal(sig, on_signal)
            installed_handlers.append(sig)
    except BaseException:
        for sig in installed_handlers:
            signal.signal(sig, previous[sig])
        raise
    finally:
        terminal_sigmask(signal.SIG_SETMASK, caller_mask)

    tier = provenance.open_owned_directory(tier_dir, args.tier_binding)
    share_cap = provenance.open_owned_directory(share, args.share_binding)
    try:
        before = provenance.checkout_inventory(source)
        source_manifest = provenance.repository_source_manifest(source)
        provenance.write_sanitized_json(
            tier, "source-manifest.json", source_manifest)
        context_cap = provenance._create_owned_directory_child(
            tier, "source-builder-context", mode=0o700)
        output_cap = provenance._create_owned_directory_child(
            share_cap, "source-release", mode=0o700)
        for relative, target in (
            ("docker/test-prime-agent-builder.Dockerfile", "Dockerfile"),
            ("scripts/testing/source_builder_payload.py", "source_builder_payload.py"),
        ):
            payload = _read_regular(workspace / relative, maximum=2 * 1024 * 1024)
            provenance._publish_owned_bytes(context_cap, target, payload)
        context = tier_dir / "source-builder-context"
        output = share / "source-release"
        iidfile = tier_dir / "source-builder.iid"
        cidfile = tier_dir / "source-builder.cid"
        input_hash = provenance.hash_declared_inputs(
            context, ["Dockerfile", "source_builder_payload.py"])
        tag = f"prime-claw-test-prime-agent-builder:{input_hash[:12]}"
        image_started = provenance.utc_now()
        built = _run([
            "docker", "build", "--iidfile", str(iidfile), "-f",
            str(context / "Dockerfile"), "-t", tag, str(context),
        ], timeout=args.image_timeout)
        _require_success(built, "builder image build")
        image_finished = provenance.utc_now()
        image = _image_identity(
            tier, tier_dir, context, iidfile, image_started, image_finished)
        mount_manifest = tier_dir / "source-manifest.json"
        for raw in (str(mount_manifest), str(output)):
            if any(ch in raw for ch in (",", "\n", "\r", "\0")):
                raise BuilderError("run-owned mount path is unsafe")
        container_attempted = True
        launched = _run([
            "docker", "run", "-d", "--cidfile", str(cidfile),
            "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
            "--tmpfs", "/work:rw,exec,nosuid,nodev,size=3g",
            "--tmpfs", "/tmp:rw,nosuid,nodev,size=1g",
            "--mount", f"type=bind,src={source_mount},dst=/source,readonly",
            "--mount", f"type=bind,src={mount_manifest},dst=/input/source-manifest.json,readonly",
            "--mount", f"type=bind,src={output},dst=/output",
            image["id"],
        ], timeout=60)
        try:
            raw_cid = _read_regular(cidfile, maximum=256).decode("ascii").strip()
        except (UnicodeDecodeError, OSError) as exc:
            raise BuilderError("builder cidfile is invalid") from exc
        if not CONTAINER_ID.fullmatch(raw_cid):
            raise BuilderError("builder cidfile identity is invalid")
        container_id = raw_cid
        _require_success(launched, "builder container launch")
        _attest_builder_mounts(container_id)
        waited = _run(["docker", "wait", container_id], timeout=args.build_timeout)
        _require_success(waited, "builder container wait")
        try:
            exit_code = int((waited.stdout or "").strip())
        except ValueError as exc:
            raise BuilderError("builder wait result is invalid") from exc
        if exit_code != 0:
            raise BuilderError("isolated source build failed")
    except BuilderInterrupted as exc:
        pending_signal = exc.signum
        failure_codes.append("interrupted")
    except (BuilderError, provenance.ProvenanceError, OSError, ValueError):
        failure_codes.append("builder-failed")
    finally:
        finalizing = True
        terminal_sigmask(signal.SIG_BLOCK, watched)

        def observe_terminal_signal() -> None:
            nonlocal pending_signal
            waiting = set(terminal_sigpending())
            for candidate in watched:
                if (candidate in waiting and candidate not in caller_mask
                        and candidate not in caller_owned_pending):
                    pending_signal = pending_signal or candidate
                    return

        observe_terminal_signal()
        if container_id is None and container_attempted:
            try:
                raw = _read_regular(tier_dir / "source-builder.cid", maximum=256)
                candidate = raw.decode("ascii").strip()
                if CONTAINER_ID.fullmatch(candidate):
                    container_id = candidate
            except (BuilderError, OSError, UnicodeDecodeError):
                pass
            if container_id is None:
                teardown = {"container_id": None, "state": "unknown",
                            "remove_outcome": "identity_refused",
                            "inspect_outcome": "not_run", "clean": False,
                            "verified_at": provenance.utc_now()}
        if container_id is not None:
            try:
                teardown = _remove_container(container_id)
            except (BuilderInterrupted, BuilderError, OSError):
                teardown = {"container_id": container_id, "state": "unknown",
                            "remove_outcome": "cleanup_failed",
                            "inspect_outcome": "cleanup_failed", "clean": False,
                            "verified_at": provenance.utc_now()}
        if not teardown["clean"]:
            failure_codes.append("teardown-failed")
        try:
            after = provenance.checkout_inventory(source)
            if before is None or after != before:
                failure_codes.append("source-inventory-changed")
        except (provenance.ProvenanceError, OSError):
            failure_codes.append("source-inventory-unknown")
        if not failure_codes and output_cap is not None:
            try:
                output_manifest = provenance.read_sanitized_json(
                    output_cap, "builder-output.json")
                release = _validate_release(
                    share / "source-release", output_manifest)
                if (source_manifest is None
                        or release["source"] != source_manifest["identity"]):
                    raise BuilderError("release source identity mismatch")
            except (BuilderError, provenance.ProvenanceError, OSError,
                    UnicodeDecodeError, json.JSONDecodeError):
                failure_codes.append("output-validation-failed")

        observe_terminal_signal()
        if pending_signal is not None:
            failure_codes.append("interrupted")
        failure_codes = list(dict.fromkeys(failure_codes))
        record = {
            "schema_version": 1,
            "status": "passed" if not failure_codes else "failed",
            "started_at": started, "finished_at": provenance.utc_now(),
            "failure_codes": list(failure_codes),
            "source": source_manifest["identity"] if source_manifest else None,
            "source_rules": ({"include": source_manifest["include_rule"],
                              "exclude": source_manifest["exclude_rule"]}
                             if source_manifest else None),
            "checkout_inventory_before": before,
            "checkout_inventory_after": after,
            "builder_image": image,
            "builder_teardown": teardown,
            "release": release,
        }
        published_binding = None
        try:
            published_binding = provenance.write_sanitized_json(
                tier, "source-build.json", record)
        except (provenance.ProvenanceError, OSError):
            failure_codes.append("publication-failed")
            # Publication can fail after its atomic rename. Immediately
            # exchange any public entry for a minimal failed record; absence is
            # safe, while any post-exchange error can no longer leave green.
            try:
                published_binding = provenance.invalidate_sanitized_json(
                    tier, "source-build.json",
                    reason="publication-failed")
            except (provenance.ProvenanceError, OSError):
                failure_codes.append("publication-invalidation-failed")

        # Keep watched signals blocked through publication and restoration.
        # Any signal accepted before this terminal boundary converts public
        # green evidence to a failed record by exact-object exchange.
        observe_terminal_signal()
        if pending_signal is not None:
            failure_codes.append("interrupted")
        for sig, handler in previous.items():
            try:
                signal.signal(sig, handler)
            except BaseException:
                failure_codes.append("handler-restoration-failed")
        observe_terminal_signal()
        if pending_signal is not None:
            failure_codes.append("interrupted")
        failure_codes = list(dict.fromkeys(failure_codes))
        if (published_binding is not None
                and failure_codes != record["failure_codes"]):
            record = dict(record)
            record["status"] = "failed"
            record["failure_codes"] = list(failure_codes)
            record["finished_at"] = provenance.utc_now()
            try:
                published_binding = provenance.replace_sanitized_json(
                    tier, "source-build.json", record,
                    expected_existing=published_binding)
            except (provenance.ProvenanceError, OSError):
                failure_codes.append("publication-failed")
                # A replacement may fail before its exchange, leaving the
                # earlier passed object public. Close that path with the same
                # unconditional failed-entry exchange used for initial
                # publication errors.
                try:
                    published_binding = provenance.invalidate_sanitized_json(
                        tier, "source-build.json",
                        reason="publication-failed")
                except (provenance.ProvenanceError, OSError):
                    failure_codes.append("publication-invalidation-failed")

        if output_cap is not None:
            output_cap.close()
        if context_cap is not None:
            context_cap.close()
        share_cap.close()
        # Terminal evidence and handler state are now committed. Signals that
        # arrive after this point belong to the restored caller boundary.
        tier.close()
        terminal_sigmask(signal.SIG_SETMASK, caller_mask)
    if pending_signal is not None:
        return 128 + pending_signal
    if failure_codes:
        print("source builder: failed; sanitized evidence recorded", file=sys.stderr)
        return 1
    print("source builder: completed")
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(
        description="build a Prime Agent source release without mutating its checkout")
    result.add_argument("--source", required=True)
    result.add_argument("--workspace", required=True)
    result.add_argument("--tier-dir", required=True)
    result.add_argument("--tier-binding", required=True)
    result.add_argument("--share", required=True)
    result.add_argument("--share-binding", required=True)
    result.add_argument("--image-timeout", type=float, default=600)
    result.add_argument("--build-timeout", type=float, default=600)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    if (not (0 < args.image_timeout <= 1200)
            or not (0 < args.build_timeout <= 600)):
        print("source builder: invalid bounded timeout", file=sys.stderr)
        return 2
    return execute(args)


if __name__ == "__main__":
    raise SystemExit(main())
