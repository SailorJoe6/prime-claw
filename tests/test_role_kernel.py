"""Tier-0 parity and immutable-lineage tests for the neutral role kernel."""

import hashlib
import json
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "src" / "prime-agent-plugin" / "ROLE_KERNEL.md"
START = b"<!-- prime-claw:role-kernel:start -->"
END = b"<!-- prime-claw:role-kernel:end -->"


def test_role_kernel_is_the_single_advisory_policy_source() -> None:
    source = SOURCE.read_bytes()
    assert source.count(START) == source.count(END) == 1
    assert source.startswith(START) and source.endswith(END)
    assert not source.endswith((b"\n", b"\r"))
    text = source.decode()
    for phrase in (
        "Roles are skill-based responsibilities, not authenticated identities.",
        "CONVERSATION supervises. EPISODE implements. EXPERT reviews.",
        "The plugin helps invoke those skills at the appropriate lifecycle boundaries.",
        "The user-level `/skill:goals-and-heartbeats` operating contract is always in effect and is mandatory reading",
    ):
        assert phrase in text
    for retired in ("trusted plugin state", "trusted identity", "Deterministic plugin gates"):
        assert retired not in text
    assert not (REPO / "src/prime-agent-plugin/extension-support/role-kernel.generated.ts").exists()
    assert not (REPO / "scripts/generate-prime-agent-role-kernel.py").exists()

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
        assert (archive / name).read_bytes() != (
            REPO / ".ralph/plans/archive/official-lean-compatibility-cleanup" / name
        ).read_bytes()
