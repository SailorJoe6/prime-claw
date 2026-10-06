"""Tier-0 architecture and collection guards for Slice 6 lifecycle support."""

import ast
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

import conftest


REPO = Path(__file__).resolve().parents[1]
LIFECYCLE = REPO / "tests" / "lifecycle"


class FakeItem:
    def __init__(self, fixtures=(), markers=()):
        self.fixturenames = list(fixtures)
        self.markers = [getattr(pytest.mark, name) for name in markers]
        self.name = "fake_lifecycle_item"

    def add_marker(self, marker):
        self.markers.append(marker)

    def get_closest_marker(self, name):
        return next((marker for marker in reversed(self.markers)
                     if getattr(marker, "name", None) == name), None)


def config(*, expression="", run_lifecycle=False):
    return SimpleNamespace(option=SimpleNamespace(
        markexpr=expression, run_lifecycle=run_lifecycle))


def marker_names(item):
    return [marker.name for marker in item.markers]


def test_lifecycle_marker_and_fixture_must_be_exactly_paired():
    for item, missing in (
        (FakeItem(markers=("lifecycle",)), "lifecycle_scope fixture"),
        (FakeItem(fixtures=("lifecycle_scope",)), "lifecycle marker"),
    ):
        with pytest.raises(pytest.UsageError, match=missing):
            conftest.pytest_collection_modifyitems(config(), [item])


def test_valid_pair_without_opt_in_skips_and_with_opt_in_is_admitted():
    skipped = FakeItem(fixtures=("lifecycle_scope",), markers=("lifecycle",))
    conftest.pytest_collection_modifyitems(config(expression="lifecycle"), [skipped])
    assert "skip" in marker_names(skipped)

    admitted = FakeItem(fixtures=("lifecycle_scope",), markers=("lifecycle",))
    conftest.pytest_collection_modifyitems(
        config(expression="anything", run_lifecycle=True), [admitted])
    assert "skip" not in marker_names(admitted)


def test_arbitrary_marker_expressions_do_not_replace_lifecycle_opt_in():
    for expression in ("lifecycle", "not sandbox", "lifecycle or foo",
                       "lifecycle and foo", "(lifecycle)"):
        item = FakeItem(fixtures=("lifecycle_scope",), markers=("lifecycle",))
        conftest.pytest_collection_modifyitems(config(expression=expression), [item])
        assert "skip" in marker_names(item), expression




def test_macos_host_registry_is_empty_and_fails_closed():
    unpaired = FakeItem(markers=("macos_host",))
    with pytest.raises(pytest.UsageError, match="requires lifecycle marker"):
        conftest.pytest_collection_modifyitems(config(run_lifecycle=True), [unpaired])
    paired = FakeItem(
        fixtures=("lifecycle_scope",), markers=("lifecycle", "macos_host"))
    conftest.pytest_collection_modifyitems(config(run_lifecycle=True), [paired])
    assert "skip" in marker_names(paired)

def test_lifecycle_fixture_is_inert_and_generates_only_scoped_identity(tmp_path):
    support = conftest._load_lifecycle_support()
    policy = LIFECYCLE / "minimal-policy.json"
    candidate = support.LifecycleScope.generate(
        evidence_dir=tmp_path,
        gateway_id="test-gateway",
        policy_sha256=__import__("hashlib").sha256(policy.read_bytes()).hexdigest(),
        run_id="1" * 32,
    )
    assert candidate.identity.workspace == "pct-111111111111"
    assert candidate.owned_slots == ()
    assert candidate.evidence.path.exists()
    assert candidate.evidence.path.read_text() == ""
    forged = support.LifecycleIdentity(
        "1" * 32, candidate.identity.workspace, "operator-sandbox",
        candidate.identity.sentinel, candidate.identity.image)
    with pytest.raises(support.LifecycleRefusal, match="derived"):
        support.LifecycleScope(
            identity=forged, gateway_id="test-gateway",
            policy_sha256="a" * 64, evidence_path=tmp_path / "forged.jsonl")


def test_lifecycle_support_has_no_live_process_socket_or_control_adapter():
    support_path = LIFECYCLE / "support.py"
    tree = ast.parse(support_path.read_text(), filename=str(support_path))
    forbidden_imports = {"subprocess", "socket", "shutil", "requests", "httpx"}
    imports = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imports.update(alias.name.split(".")[0] for alias in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imports.add(node.module.split(".")[0])
    assert not (imports & forbidden_imports)
    assert not any(path.name.startswith("test_") for path in LIFECYCLE.glob("*.py"))
    classes = {node.name: node for node in tree.body if isinstance(node, ast.ClassDef)}
    assert "ControlPlane" in classes
    assert "LifecycleScope" in classes
    assert "OpenShellAdapter" not in classes
    assert "DockerAdapter" not in classes


def test_recording_fake_body_is_noncollectable_guarded_and_tier1_bridged():
    body = LIFECYCLE / "control_body.py"
    bridge = (REPO / "tests" / "test_unit_env_bridges.py").read_text()
    text = body.read_text()
    assert not body.name.startswith("test_")
    assert "from unit_env_entry import require_unit_env" in text
    assert "require_unit_env()" in text
    assert "tests/lifecycle/control_body.py" in bridge
    assert '"lifecycle_fake"' in bridge
    tree = ast.parse(text, filename=str(body))
    tests = [node.name for node in ast.walk(tree)
             if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
             and node.name.startswith("test_")]
    assert len(tests) == 12


def test_minimal_policy_is_tracked_inert_and_credential_free():
    policy = json.loads((LIFECYCLE / "minimal-policy.json").read_text())
    assert policy == {
        "credentials": [],
        "network": "deny",
        "providers": [],
        "purpose": "prime-claw-lifecycle-test-only",
        "schema": 1,
    }


def test_lifecycle_sequencer_flags_remain_hard_errors():
    sequencer = (REPO / "scripts" / "test-all.sh").read_text()
    assert "--with-lifecycle" in sequencer
    assert "--with-sandbox" in sequencer
    assert "lifecycle execution is disabled" in sequencer
    assert "--run-lifecycle" not in sequencer
