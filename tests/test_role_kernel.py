"""Tier-0 parity and immutable-lineage tests for the neutral role kernel."""

import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "src" / "prime-agent-plugin" / "ROLE_KERNEL.md"
GENERATED = REPO / "src" / "prime-agent-plugin" / "extension-support" / "role-kernel.generated.ts"
GENERATOR = REPO / "scripts" / "generate-prime-agent-role-kernel.py"
START = b"<!-- prime-claw:role-kernel:start -->"
END = b"<!-- prime-claw:role-kernel:end -->"


def _generated_string(name: str) -> str:
    match = re.search(
        rf"^export const {re.escape(name)} = (.+);$",
        GENERATED.read_text(),
        re.MULTILINE,
    )
    assert match, name
    return json.loads(match.group(1))


def test_role_kernel_generated_bytes_and_digest_are_exact(tmp_path: Path) -> None:
    source = SOURCE.read_bytes()
    assert source.count(START) == source.count(END) == 1
    assert source.startswith(START) and source.endswith(END)
    assert not source.endswith((b"\n", b"\r"))
    assert _generated_string("PRIME_CLAW_ROLE_KERNEL_TEXT").encode() == source
    assert _generated_string("PRIME_CLAW_ROLE_KERNEL_SHA256") == hashlib.sha256(source).hexdigest()
    assert _generated_string("PRIME_CLAW_ROLE_KERNEL_START").encode() == START
    assert _generated_string("PRIME_CLAW_ROLE_KERNEL_END").encode() == END

    checked = subprocess.run(
        [sys.executable, GENERATOR, "check", SOURCE, GENERATED],
        text=True,
        capture_output=True,
    )
    assert checked.returncode == 0, checked.stderr
    stale = tmp_path / "role-kernel.generated.ts"
    stale.write_bytes(GENERATED.read_bytes() + b"// stale\n")
    rejected = subprocess.run(
        [sys.executable, GENERATOR, "check", SOURCE, stale],
        text=True,
        capture_output=True,
    )
    assert rejected.returncode != 0
    assert "stale generated role kernel" in rejected.stderr


def test_final_protocol_config_declares_one_generation() -> None:
    manifest = json.loads((REPO / "src/prime-agent-plugin/role-protocol.json").read_text())
    assert manifest == {"schemaVersion": 1, "generation": "final"}


def test_predecessor_archive_matches_recorded_hashes() -> None:
    archive = REPO / ".ralph/plans/archive/official-lean-session-protocol"
    expected = {
        "SPECIFICATION.md": "09cce8ae0898da292fb34f843b3e99b3a5144898934c7e13408a29e76ae2802a",
        "EXECUTION_PLAN.md": "cf9a75e45d4ccabb42e3c36feed05ef9678227bc58d9e8514aea99145cabe888",
    }
    assert {path.name for path in archive.iterdir()} == set(expected)
    for name, sha256 in expected.items():
        assert hashlib.sha256((archive / name).read_bytes()).hexdigest() == sha256
        assert (archive / name).read_bytes() != (REPO / ".ralph/plans" / name).read_bytes()
