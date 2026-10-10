#!/usr/bin/env python3
"""Fail-closed links from a versioned sandbox root into mounted home-root.

The image-provided .uv/.venv remain active: OpenShell startup writes into
these directories. Exact v1 copies are retained in home-root, not discarded or
silently overlaid on the new environment.
"""
import argparse
import os
from pathlib import Path
import sys

STATE_NAMES = (
    ".cache", ".gbrain", ".local", ".npm", ".npm-global", ".pc-ver.sh",
    ".prime", ".prime-claw", "AGENTS.md", "episode-target", "pg.log",
)
RETAINED_IMAGE_DIRS = (".uv", ".venv")


def bootstrap(root, require_mounted_home=False):
    root = Path(root)
    home = root / "home-root"
    if not home.is_dir() or (require_mounted_home and not os.path.ismount(home)):
        raise ValueError("home-root mount missing")
    # Do not replace image-provided environments once OpenShell has begun
    # writing into them. Verify both v1 copies remain in the mounted volume.
    for name in RETAINED_IMAGE_DIRS:
        if not (home / name).is_dir() or not (root / name).is_dir() or (root / name).is_symlink():
            raise ValueError("image environment or retained copy missing: " + name)
    actions = []
    # Complete preflight before the first mutation. Unexpected root collisions
    # must never be overwritten or renamed.
    for name in STATE_NAMES:
        source = home / name
        if not os.path.lexists(source):
            raise ValueError("required mounted state missing: " + name)
        dest = root / name
        expected = "home-root/" + name
        if dest.is_symlink():
            if os.readlink(dest) != expected:
                raise ValueError("wrong existing link: " + name)
        elif os.path.lexists(dest):
            raise ValueError("unexpected root collision: " + name)
        else:
            actions.append(name)
    for name in actions:
        os.symlink("home-root/" + name, root / name)
    if any(not (root / name).is_symlink() or
           os.readlink(root / name) != "home-root/" + name
           for name in STATE_NAMES):
        raise ValueError("link postcheck failed")
    return len(actions)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", default="/sandbox")
    parser.add_argument("--require-mounted-home", action="store_true")
    args = parser.parse_args()
    try:
        changed = bootstrap(args.root, args.require_mounted_home)
    except (OSError, ValueError) as exc:
        print("bootstrap refused: " + str(exc), file=sys.stderr)
        return 1
    print("bootstrap verified: %d links, %d new; image environments retained" %
          (len(STATE_NAMES), changed))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
