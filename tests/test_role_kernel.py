"""Tier-0 parity and immutable-lineage tests for the neutral role kernel."""

import hashlib
import json
import subprocess
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

def test_delivery_manifest_selects_the_single_role_kernel() -> None:
    manifest = json.loads((REPO / "src/prime-agent-plugin/asset-inventory.json").read_text())
    selected = [asset for asset in manifest["assets"] if any(target["class"] == "selected-context-block" for target in asset["targets"])]
    assert [(asset["source"], asset["id"]) for asset in selected] == [("ROLE_KERNEL.md", "global-role-kernel")]


def _frozen_plan_bytes(relative_path: str) -> bytes:
    result = subprocess.run(
        [
            "git", "-C", REPO, "show",
            f"4a40a0832d561e380da32099f07d3ea2195e7e65:{relative_path}",
        ],
        check=True,
        capture_output=True,
    )
    return result.stdout


def test_predecessor_archive_matches_recorded_hashes() -> None:
    expected = {
        "SPECIFICATION.md": "09cce8ae0898da292fb34f843b3e99b3a5144898934c7e13408a29e76ae2802a",
        "EXECUTION_PLAN.md": "cf9a75e45d4ccabb42e3c36feed05ef9678227bc58d9e8514aea99145cabe888",
    }
    for name, sha256 in expected.items():
        predecessor = _frozen_plan_bytes(
            f".ralph/plans/archive/official-lean-session-protocol/{name}"
        )
        replacement = _frozen_plan_bytes(
            f".ralph/plans/archive/official-lean-compatibility-cleanup/{name}"
        )
        assert hashlib.sha256(predecessor).hexdigest() == sha256
        assert predecessor != replacement
