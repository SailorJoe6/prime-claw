#!/usr/bin/env python3
"""Safely remove the one unshipped, retired Prime Claw EXPERT installation."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import stat

OLD_SKILL = Path("skills/prime-claw-official-expert-review")
OLD_FILES = {
    Path("SKILL.md"),
    Path("pyproject.toml"),
    Path("src/prime_claw_official_expert_review/__init__.py"),
    Path("src/prime_claw_official_expert_review/reviewer.md"),
}
OLD_DIRS = {
    Path("src"),
    Path("src/prime_claw_official_expert_review"),
}
CACHE_DIR = Path("src/prime_claw_official_expert_review/__pycache__")
STATE_RELATIVE = Path("prime-claw-private/expert-review-launches")


def _real_directory(path: Path, label: str) -> Path:
    info = path.lstat()
    if not stat.S_ISDIR(info.st_mode) or stat.S_ISLNK(info.st_mode):
        raise ValueError(f"{label} must be a real directory: {path}")
    return path.resolve(strict=True)


def _validate_old_skill(plugin_root: Path) -> Path | None:
    try:
        root = _real_directory(plugin_root, "plugin root")
    except FileNotFoundError:
        return None
    target = root / OLD_SKILL
    try:
        target = _real_directory(target, "retired EXPERT skill")
    except FileNotFoundError:
        return None
    if target.parent.parent.resolve(strict=True) != root:
        raise ValueError("retired EXPERT skill escapes the selected plugin root")
    actual_files: set[Path] = set()
    actual_dirs: set[Path] = set()
    for entry in target.rglob("*"):
        info = entry.lstat()
        relative = entry.relative_to(target)
        if stat.S_ISLNK(info.st_mode):
            raise ValueError(f"retired EXPERT skill contains a symlink: {entry}")
        if stat.S_ISREG(info.st_mode):
            actual_files.add(relative)
        elif stat.S_ISDIR(info.st_mode):
            actual_dirs.add(relative)
        else:
            raise ValueError(f"retired EXPERT skill contains an unsupported entry: {entry}")
    extra_files = actual_files - OLD_FILES
    extra_dirs = actual_dirs - OLD_DIRS
    cache_files_are_known = all(
        path.parent == CACHE_DIR
        and path.name.startswith("__init__.")
        and path.suffix == ".pyc"
        for path in extra_files
    )
    if not OLD_FILES.issubset(actual_files) or extra_dirs - {CACHE_DIR} or not cache_files_are_known:
        raise ValueError("retired EXPERT skill does not match the known plugin-managed layout")
    if CACHE_DIR in actual_dirs and not extra_files:
        raise ValueError("retired EXPERT skill contains an unexpected empty cache directory")
    return target


def _validate_state(coding_agent_root: Path | None) -> Path | None:
    if coding_agent_root is None:
        return None
    try:
        root = _real_directory(coding_agent_root, "coding-agent root")
    except FileNotFoundError:
        return None
    parent = root / STATE_RELATIVE.parent
    try:
        parent = _real_directory(parent, "Prime Claw private-state root")
    except FileNotFoundError:
        return None
    target = parent / STATE_RELATIVE.name
    try:
        target = _real_directory(target, "retired EXPERT private state")
    except FileNotFoundError:
        return None
    if target.parent != parent or parent.parent != root:
        raise ValueError("retired EXPERT private state escapes the coding-agent root")
    return target


def _targets(args: argparse.Namespace) -> list[Path]:
    plugin = _validate_old_skill(args.plugin_root)
    state = _validate_state(args.coding_agent_root)
    return [path for path in (plugin, state) if path is not None]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("validate", "remove", "check-absent"))
    parser.add_argument("--plugin-root", type=Path, required=True)
    parser.add_argument("--coding-agent-root", type=Path)
    args = parser.parse_args()
    try:
        targets = _targets(args)
        if args.command == "check-absent":
            if targets:
                raise ValueError("retired EXPERT installation or private state remains")
        elif args.command == "remove":
            for target in targets:
                shutil.rmtree(target)
                if os.path.lexists(target):
                    raise ValueError(f"failed to remove retired EXPERT path: {target}")
    except (OSError, ValueError) as exc:
        parser.error(str(exc))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
