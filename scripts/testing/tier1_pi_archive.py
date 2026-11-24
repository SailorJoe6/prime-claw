"""Unpack the checksummed Pi release into the disposable Tier-1 container."""

import hashlib
import os
from pathlib import Path
import sys
import tarfile


def unpack(archive: Path, expected_sha256: str, target: Path) -> None:
    with archive.open("rb") as payload:
        if hashlib.file_digest(payload, "sha256").hexdigest() != expected_sha256:
            raise ValueError("Pi archive SHA-256 mismatch")
        payload.seek(0)
        with tarfile.open(fileobj=payload, mode="r:gz") as release:
            members = release.getmembers()
            if any(not (member.isfile() or member.isdir()) for member in members):
                raise ValueError("Pi archive must contain only regular files and directories")
            target.mkdir(mode=0o700)
            release.extractall(target, members=members, filter="data")
    launcher = target / "prime-agent"
    if not launcher.is_file() or not os.access(launcher, os.X_OK):
        raise ValueError("Pi archive requires an executable top-level prime-agent")


if __name__ == "__main__":
    unpack(Path("/tmp/tier1-pi.tar.gz"), sys.argv[1], Path("/opt/tier1-pi"))
