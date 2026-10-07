#!/usr/bin/env python3
"""Create, verify, and narrowly restore a private Prime Agent cutover bundle.

The bundle is an operator-owned recovery input.  It copies only the two selected
context preimages plus their known candidate postimages, a metadata-only
installed inventory, a source-topology record, and the exact restore tool.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import shutil
import stat
import tempfile
from typing import Any

SCHEMA_VERSION = 1
MAX_PREIMAGE_BYTES = 8 * 1024 * 1024
MANAGED_FILES = (
    "extensions/handoff-chain.ts",
    "extensions/reviewed-plan.ts",
    "extension-support/conversation-guide-metadata.ts",
    "extension-support/conversation-oversight.ts",
    "extension-support/episode-close.ts",
    "extension-support/expert-review-reservation.ts",
    "extension-support/handoff-prompts.ts",
    "extension-support/prep-chain.ts",
    "extension-support/reviewed-plan-support.ts",
    "extension-support/role-kernel.generated.ts",
    "extension-support/spec-episode.ts",
    "skills/prime-claw-oversee-episode/SKILL.md",
    "skills/prime-claw-official-expert-review/SKILL.md",
    "skills/prime-claw-official-expert-review/pyproject.toml",
    "skills/prime-claw-official-expert-review/src/prime_claw_official_expert_review/__init__.py",
    "skills/prime-claw-official-expert-review/src/prime_claw_official_expert_review/reviewer.md",
)
EXPECTED_ABSENT = (
    "extensions/project-conversation.ts",
    "extensions/goal-heartbeat-work-control.ts",
    "extensions/goal-blocker-control.ts",
    "extension-support/episode-finalization.ts",
)
PROTOCOL_SURFACES = (
    ".prime-claw/role-protocol-state.json",
)
SECRET_PATTERNS = (
    re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(rb"\bsk-[A-Za-z0-9_-]{20,}\b"),
    re.compile(rb"\bxox[baprs]-[A-Za-z0-9-]{20,}\b"),
)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value: Any) -> bytes:
    return (json.dumps(value, sort_keys=True, separators=(",", ":")) + "\n").encode()


def regular(path: Path, *, limit: int | None = None) -> tuple[bytes, os.stat_result]:
    info = path.lstat()
    if not stat.S_ISREG(info.st_mode) or path.is_symlink():
        raise ValueError(f"expected regular non-symlink file: {path}")
    data = path.read_bytes()
    if limit is not None and len(data) > limit:
        raise ValueError(f"file exceeds {limit} bytes: {path}")
    return data, info


def newline_style(data: bytes) -> str:
    if b"\r\n" in data:
        return "crlf" if data.replace(b"\r\n", b"").find(b"\n") < 0 else "mixed"
    return "lf" if b"\n" in data else "none"


def snapshot(data: bytes, info: os.stat_result, copy: str, postimage: bytes, postimage_copy: str) -> dict[str, Any]:
    return {
        "copy": copy,
        "sha256": digest(data),
        "size": len(data),
        "mode": stat.S_IMODE(info.st_mode),
        "uid": info.st_uid,
        "gid": info.st_gid,
        "newlineStyle": newline_style(data),
        "finalNewline": data.endswith((b"\n", b"\r")),
        "postimageCopy": postimage_copy,
        "postimageSha256": digest(postimage),
        "postimageSize": len(postimage),
    }


def screen_required_blob(data: bytes, label: str) -> None:
    if any(pattern.search(data) for pattern in SECRET_PATTERNS):
        raise ValueError(f"likely credential in required exact preimage: {label}")


def installed_inventory(root: Path, source_root: Path, candidate_post_root: Path) -> list[dict[str, Any]]:
    if not root.is_dir() or root.is_symlink():
        raise ValueError(f"installed root must be a real directory: {root}")
    if not source_root.is_dir() or source_root.is_symlink():
        raise ValueError(f"source root must be a real directory: {source_root}")
    result: list[dict[str, Any]] = []
    for rel in MANAGED_FILES:
        installed_path = root / rel
        source_path = source_root / rel
        source_data, _ = regular(source_path, limit=MAX_PREIMAGE_BYTES)
        source_sha = digest(source_data)
        if installed_path.exists() or installed_path.is_symlink():
            installed_data, installed_info = regular(installed_path, limit=MAX_PREIMAGE_BYTES)
            installed_sha = digest(installed_data)
            result.append({
                "path": rel, "kind": "file", "observed": "present",
                "mode": stat.S_IMODE(installed_info.st_mode), "uid": installed_info.st_uid,
                "gid": installed_info.st_gid, "size": len(installed_data),
                "installedSha256": installed_sha, "candidateSourceSha256": source_sha,
                "candidateEqual": installed_sha == source_sha,
            })
        else:
            result.append({"path": rel, "kind": "absent", "observed": "absent", "candidateSourceSha256": source_sha, "candidateEqual": False})
    for rel in EXPECTED_ABSENT:
        path = root / rel
        if path.exists() or path.is_symlink():
            data, info = regular(path, limit=MAX_PREIMAGE_BYTES)
            result.append({"path": rel, "kind": "file", "observed": "present", "mode": stat.S_IMODE(info.st_mode), "uid": info.st_uid, "gid": info.st_gid, "size": len(data), "installedSha256": digest(data), "candidateExpected": "absent"})
        else:
            result.append({"path": rel, "kind": "absent", "observed": "absent", "candidateExpected": "absent"})
    for rel in PROTOCOL_SURFACES:
        path = root / rel
        candidate = candidate_post_root / rel
        candidate_data, _ = regular(candidate, limit=MAX_PREIMAGE_BYTES)
        if path.exists() or path.is_symlink():
            data, info = regular(path, limit=MAX_PREIMAGE_BYTES)
            result.append({"path": rel, "kind": "file", "observed": "present", "mode": stat.S_IMODE(info.st_mode), "uid": info.st_uid, "gid": info.st_gid, "size": len(data), "installedSha256": digest(data), "candidatePostimageSha256": digest(candidate_data), "candidatePostimageSize": len(candidate_data)})
        else:
            result.append({"path": rel, "kind": "absent", "observed": "absent", "candidatePostimageSha256": digest(candidate_data), "candidatePostimageSize": len(candidate_data)})
    return result


def atomic_write(path: Path, data: bytes, mode: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, raw = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    tmp = Path(raw)
    try:
        os.fchmod(fd, mode)
        with os.fdopen(fd, "wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp, path)
        os.chmod(path, mode)
    finally:
        if tmp.exists():
            tmp.unlink()


def create(args: argparse.Namespace) -> dict[str, Any]:
    bundle = args.bundle.resolve()
    if bundle.exists() or bundle.is_symlink():
        raise ValueError(f"bundle path must not exist: {bundle}")
    bundle.mkdir(parents=True, mode=0o700)
    os.chmod(bundle, 0o700)
    try:
        global_data, global_info = regular(args.global_context.resolve(), limit=MAX_PREIMAGE_BYTES)
        append_data, append_info = regular(args.append.resolve(), limit=MAX_PREIMAGE_BYTES)
        screen_required_blob(global_data, "selected global context")
        screen_required_blob(append_data, "APPEND_SYSTEM")
        global_post, _ = regular(args.global_postimage.resolve(), limit=MAX_PREIMAGE_BYTES)
        append_post, _ = regular(args.append_postimage.resolve(), limit=MAX_PREIMAGE_BYTES)
        topology_data, _ = regular(args.source_topology.resolve(), limit=MAX_PREIMAGE_BYTES)
        topology = json.loads(topology_data)
        if not isinstance(topology, dict):
            raise ValueError("source topology must be a JSON object")
        known_good = args.known_good_generation.strip()
        if not known_good or len(known_good) > 256:
            raise ValueError("known-good generation must be a short non-empty identifier")
        selected = args.selected_file.strip()
        if not selected or Path(selected).name != selected:
            raise ValueError("selected file decision must be a basename")
        preimages = bundle / "preimages"
        postimages = bundle / "postimages"
        tools = bundle / "tools"
        installed_preimages = bundle / "installed-preimages"
        installed_postimages = bundle / "installed-postimages"
        for directory in (preimages, postimages, tools, installed_preimages, installed_postimages):
            directory.mkdir(mode=0o700)
        atomic_write(preimages / "global-context.bin", global_data, 0o600)
        atomic_write(preimages / "append-system.bin", append_data, 0o600)
        atomic_write(postimages / "global-context.bin", global_post, 0o600)
        atomic_write(postimages / "append-system.bin", append_post, 0o600)
        toolset: list[dict[str, Any]] = []
        seen_names: set[str] = set()
        for tool_path in args.restore_tool:
            tool_path = tool_path.resolve()
            tool_data, _ = regular(tool_path, limit=MAX_PREIMAGE_BYTES)
            name = tool_path.name
            if name in seen_names:
                raise ValueError(f"duplicate restore tool basename: {name}")
            seen_names.add(name)
            copy = f"tools/{name}"
            atomic_write(bundle / copy, tool_data, 0o600)
            toolset.append({"name": name, "copy": copy, "sha256": digest(tool_data), "size": len(tool_data)})
        inventory = installed_inventory(args.installed_root.resolve(), args.source_root.resolve(), args.candidate_postimage_root.resolve())
        for entry in inventory:
            relative = entry["path"]
            if entry["observed"] == "present":
                source = args.installed_root.resolve() / relative
                data, _ = regular(source, limit=MAX_PREIMAGE_BYTES)
                copy = f"installed-preimages/{relative}"
                atomic_write(bundle / copy, data, 0o600)
                entry["preimageCopy"] = copy
            if relative in PROTOCOL_SURFACES:
                post_data, _ = regular(args.candidate_postimage_root.resolve() / relative, limit=MAX_PREIMAGE_BYTES)
                post_copy = f"installed-postimages/{relative}"
                atomic_write(bundle / post_copy, post_data, 0o600)
                entry["postimageCopy"] = post_copy
        manifest = {
            "schemaVersion": SCHEMA_VERSION,
            "kind": "prime-claw-preactivation",
            "generation": "bridge",
            "selectedFileDecision": selected,
            "currentKnownGoodGeneration": known_good,
            "preimages": {
                "globalContext": snapshot(global_data, global_info, "preimages/global-context.bin", global_post, "postimages/global-context.bin"),
                "appendSystem": snapshot(append_data, append_info, "preimages/append-system.bin", append_post, "postimages/append-system.bin"),
            },
            "installedInventory": inventory,
            "sourceTopology": topology,
            "restoreToolset": toolset,
        }
        manifest_bytes = canonical(manifest)
        atomic_write(bundle / "manifest.json", manifest_bytes, 0o600)
        manifest_sha = digest(manifest_bytes)
        atomic_write(bundle / "manifest.sha256", (manifest_sha + "\n").encode(), 0o600)
        for directory in bundle.rglob("*"):
            if directory.is_dir():
                os.chmod(directory, 0o700)
        return {"schemaVersion": SCHEMA_VERSION, "bundle": str(bundle), "manifestSha256": manifest_sha}
    except BaseException:
        shutil.rmtree(bundle, ignore_errors=True)
        raise


def bundled_file(bundle: Path, relative: str) -> Path:
    candidate = (bundle / relative).resolve()
    try:
        candidate.relative_to(bundle)
    except ValueError as exc:
        raise ValueError(f"bundle relative path escapes root: {relative}") from exc
    return candidate


def load_verified(bundle: Path) -> tuple[dict[str, Any], str]:
    bundle = bundle.resolve()
    if not bundle.is_dir() or bundle.is_symlink():
        raise ValueError(f"bundle must be a real directory: {bundle}")
    manifest_data, _ = regular(bundle / "manifest.json", limit=MAX_PREIMAGE_BYTES)
    recorded_data, _ = regular(bundle / "manifest.sha256", limit=256)
    recorded = recorded_data.decode().strip()
    actual = digest(manifest_data)
    if recorded != actual:
        raise ValueError("bundle manifest digest mismatch")
    manifest = json.loads(manifest_data)
    exact_keys = {"schemaVersion", "kind", "generation", "selectedFileDecision", "currentKnownGoodGeneration", "preimages", "installedInventory", "sourceTopology", "restoreToolset"}
    if set(manifest) != exact_keys or manifest.get("schemaVersion") != SCHEMA_VERSION or manifest.get("kind") != "prime-claw-preactivation" or manifest.get("generation") != "bridge":
        raise ValueError("unsupported or non-exact bundle schema")
    if manifest.get("selectedFileDecision") not in {"AGENTS.md", "AGENTS.MD", "CLAUDE.md", "CLAUDE.MD"}:
        raise ValueError("selected global context decision is unsupported")
    if set(manifest["preimages"]) != {"globalContext", "appendSystem"}:
        raise ValueError("bundle preimage labels are not exact")
    for entry in manifest["preimages"].values():
        copied, _ = regular(bundled_file(bundle, entry["copy"]), limit=MAX_PREIMAGE_BYTES)
        if len(copied) != entry["size"] or digest(copied) != entry["sha256"]:
            raise ValueError(f"bundle preimage mismatch: {entry['copy']}")
        postimage, _ = regular(bundled_file(bundle, entry["postimageCopy"]), limit=MAX_PREIMAGE_BYTES)
        if len(postimage) != entry["postimageSize"] or digest(postimage) != entry["postimageSha256"]:
            raise ValueError(f"bundle postimage mismatch: {entry['postimageCopy']}")
    for tool in manifest["restoreToolset"]:
        tool_data, _ = regular(bundled_file(bundle, tool["copy"]), limit=MAX_PREIMAGE_BYTES)
        if len(tool_data) != tool["size"] or digest(tool_data) != tool["sha256"]:
            raise ValueError(f"bundle restore tool mismatch: {tool['name']}")
    expected_inventory_paths = list(MANAGED_FILES) + list(EXPECTED_ABSENT) + list(PROTOCOL_SURFACES)
    if [entry.get("path") for entry in manifest["installedInventory"]] != expected_inventory_paths:
        raise ValueError("installed inventory is not the fixed managed surface")
    expected_files = {"manifest.json", "manifest.sha256"}
    for entry in manifest["preimages"].values():
        expected_files.update((entry["copy"], entry["postimageCopy"]))
    for entry in manifest["installedInventory"]:
        if entry.get("observed") == "present":
            copy = entry.get("preimageCopy")
            data, _ = regular(bundled_file(bundle, copy), limit=MAX_PREIMAGE_BYTES)
            if len(data) != entry["size"] or digest(data) != entry["installedSha256"]:
                raise ValueError(f"installed preimage mismatch: {entry['path']}")
            expected_files.add(copy)
        if entry.get("path") in PROTOCOL_SURFACES:
            post_copy = entry.get("postimageCopy")
            post_data, _ = regular(bundled_file(bundle, post_copy), limit=MAX_PREIMAGE_BYTES)
            if len(post_data) != entry["candidatePostimageSize"] or digest(post_data) != entry["candidatePostimageSha256"]:
                raise ValueError(f"installed postimage mismatch: {entry['path']}")
            expected_files.add(post_copy)
    expected_files.update(tool["copy"] for tool in manifest["restoreToolset"])
    actual_files = {path.relative_to(bundle).as_posix() for path in bundle.rglob("*") if path.is_file() or path.is_symlink()}
    if actual_files != expected_files:
        raise ValueError("bundle contains missing or unexpected files")
    for path in bundle.rglob("*"):
        mode = stat.S_IMODE(path.lstat().st_mode)
        if path.is_dir() and mode != 0o700:
            raise ValueError(f"bundle directory mode is not 0700: {path}")
        if path.is_file() and mode != 0o600:
            raise ValueError(f"bundle file mode is not 0600: {path}")
    return manifest, actual


def verify(args: argparse.Namespace) -> dict[str, Any]:
    manifest, actual = load_verified(args.bundle)
    return {"schemaVersion": SCHEMA_VERSION, "status": "VERIFIED", "manifestSha256": actual, "inventoryEntries": len(manifest["installedInventory"])}


def restore(args: argparse.Namespace) -> dict[str, Any]:
    bundle = args.bundle.resolve()
    manifest, actual = load_verified(bundle)
    destinations = {
        "globalContext": args.global_context_destination.resolve(),
        "appendSystem": args.append_destination.resolve(),
    }
    prepared: list[tuple[Path, bytes, dict[str, Any], str]] = []
    for key, destination in destinations.items():
        current, _ = regular(destination, limit=MAX_PREIMAGE_BYTES)
        entry = manifest["preimages"][key]
        current_sha = digest(current)
        if current_sha == entry["sha256"] and len(current) == entry["size"]:
            state = "preimage"
        elif current_sha == entry["postimageSha256"] and len(current) == entry["postimageSize"]:
            state = "postimage"
        else:
            raise ValueError(f"current destination is neither exact preimage nor known postimage: {key}")
        preimage, _ = regular(bundled_file(bundle, entry["copy"]), limit=MAX_PREIMAGE_BYTES)
        prepared.append((destination, preimage, entry, state))
    restored: list[str] = []
    for destination, preimage, entry, state in prepared:
        if state == "preimage":
            continue
        atomic_write(destination, preimage, int(entry["mode"]))
        try:
            os.chown(destination, int(entry["uid"]), int(entry["gid"]))
        except PermissionError:
            info = destination.stat()
            if info.st_uid != int(entry["uid"]) or info.st_gid != int(entry["gid"]):
                raise
        restored.append(str(destination))
    return {"schemaVersion": SCHEMA_VERSION, "status": "RESTORED", "alreadyRestored": not restored, "manifestSha256": actual, "restored": restored}


def restore_installed(args: argparse.Namespace) -> dict[str, Any]:
    bundle = args.bundle.resolve()
    root = args.installed_root.resolve()
    if not root.is_dir() or root.is_symlink():
        raise ValueError(f"installed root must be a real directory: {root}")
    manifest, actual = load_verified(bundle)
    classified: list[tuple[Path, dict[str, Any], str]] = []
    for entry in manifest["installedInventory"]:
        path = root / entry["path"]
        exists = path.exists() or path.is_symlink()
        pre_exists = entry["observed"] == "present"
        candidate_digest = entry.get("candidateSourceSha256", entry.get("candidatePostimageSha256"))
        candidate_exists = candidate_digest is not None
        if exists:
            current, _ = regular(path, limit=MAX_PREIMAGE_BYTES)
            current_sha = digest(current)
            if pre_exists and current_sha == entry["installedSha256"] and len(current) == entry["size"]:
                state = "preimage"
            elif candidate_exists and current_sha == candidate_digest:
                state = "postimage"
            else:
                raise ValueError(f"unknown installed state: {entry['path']}")
        elif not pre_exists:
            state = "preimage"
        elif not candidate_exists:
            state = "postimage"
        else:
            raise ValueError(f"missing installed state is not known: {entry['path']}")
        classified.append((path, entry, state))
    restored: list[str] = []
    for path, entry, state in classified:
        if state == "preimage":
            continue
        if entry["observed"] == "present":
            preimage, _ = regular(bundled_file(bundle, entry["preimageCopy"]), limit=MAX_PREIMAGE_BYTES)
            atomic_write(path, preimage, int(entry["mode"]))
            try:
                os.chown(path, int(entry["uid"]), int(entry["gid"]))
            except PermissionError:
                info = path.stat()
                if info.st_uid != int(entry["uid"]) or info.st_gid != int(entry["gid"]):
                    raise
        else:
            path.unlink()
        restored.append(entry["path"])
    return {"schemaVersion": SCHEMA_VERSION, "status": "INSTALLED_RESTORED", "alreadyRestored": not restored, "manifestSha256": actual, "restored": restored}


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="command", required=True)
    create_p = sub.add_parser("create")
    create_p.add_argument("--bundle", type=Path, required=True)
    create_p.add_argument("--global-context", type=Path, required=True)
    create_p.add_argument("--append", type=Path, required=True)
    create_p.add_argument("--global-postimage", type=Path, required=True)
    create_p.add_argument("--append-postimage", type=Path, required=True)
    create_p.add_argument("--installed-root", type=Path, required=True)
    create_p.add_argument("--source-root", type=Path, required=True)
    create_p.add_argument("--candidate-postimage-root", type=Path, required=True)
    create_p.add_argument("--selected-file", required=True)
    create_p.add_argument("--known-good-generation", required=True)
    create_p.add_argument("--source-topology", type=Path, required=True)
    create_p.add_argument("--restore-tool", type=Path, action="append", required=True)
    verify_p = sub.add_parser("verify")
    verify_p.add_argument("--bundle", type=Path, required=True)
    restore_p = sub.add_parser("restore")
    restore_p.add_argument("--bundle", type=Path, required=True)
    restore_p.add_argument("--global-context-destination", type=Path, required=True)
    restore_p.add_argument("--append-destination", type=Path, required=True)
    installed_p = sub.add_parser("restore-installed")
    installed_p.add_argument("--bundle", type=Path, required=True)
    installed_p.add_argument("--installed-root", type=Path, required=True)
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        output = create(args) if args.command == "create" else verify(args) if args.command == "verify" else restore_installed(args) if args.command == "restore-installed" else restore(args)
    except (OSError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(json.dumps({"schemaVersion": SCHEMA_VERSION, "status": "ERROR", "error": str(exc)}, sort_keys=True))
        return 1
    print(json.dumps(output, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
