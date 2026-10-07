"""Pure/static tests for the Slice-7 live adapter. No external command runs."""

import json
from pathlib import Path
from types import SimpleNamespace

import pytest
import yaml

from lifecycle.live import (
    LiveControlPlane,
    ProductionSnapshot,
    policy_semantic_sha256,
    policy_sha256,
    require_unchanged_production,
    run_live_acceptance,
    run_recorded_cleanup,
)
from lifecycle.support import (
    Capabilities,
    Inspection,
    LifecycleRefusal,
    LifecycleScope,
    ResourceRef,
)


REPO = Path(__file__).resolve().parents[1]
POLICY = REPO / "policies" / "test-lifecycle.yaml"
DOCKERFILE = REPO / "docker" / "test-lifecycle.Dockerfile"


def scope(tmp_path):
    return LifecycleScope.generate(
        evidence_dir=tmp_path,
        gateway_id="openshell",
        policy_sha256=policy_sha256(POLICY),
        run_id="1" * 32,
        forbidden_identities={"default", "prime-claw", "prime-claw-brain:0.1.0"},
        deadline_seconds=900,
    )


def control(tmp_path, monkeypatch):
    monkeypatch.setattr("lifecycle.live.shutil.which", lambda name: f"/safe/{name}")
    return LiveControlPlane(
        scope=scope(tmp_path), policy_path=POLICY, dockerfile=DOCKERFILE,
        production_name="prime-claw")


def result(*, returncode=0, stdout="", stderr="", outcome="exited"):
    return SimpleNamespace(returncode=returncode, stdout=stdout,
                           stderr=stderr, outcome=outcome)


def test_policy_identity_is_semantic_and_pinned():
    value = yaml.safe_load(POLICY.read_text())
    assert value["network_policies"] == {}
    assert policy_sha256(POLICY) == __import__("hashlib").sha256(
        json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def test_v0116_server_policy_omission_is_the_only_normalized_difference():
    tracked = yaml.safe_load(POLICY.read_text())
    server = dict(tracked)
    assert server.pop("network_policies") == {}
    raw_server_sha = __import__("hashlib").sha256(
        json.dumps(server, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    assert raw_server_sha == (
        "99d5d41a240fbfd4da6049f101ca47bcd8af436cba33b1e361283e9e4fd2cf68"
    )
    assert policy_semantic_sha256(server) == policy_sha256(POLICY)


@pytest.mark.parametrize(
    "mutate",
    [
        lambda value: value.update(version=2),
        lambda value: value["filesystem_policy"]["read_only"].append("/material-drift"),
        lambda value: value["landlock"].update(compatibility="hard_requirement"),
        lambda value: value.update(network_policies={"egress": {}}),
        lambda value: value.update(unexpected={}),
    ],
)
def test_policy_equivalence_rejects_material_drift(mutate):
    tracked = yaml.safe_load(POLICY.read_text())
    candidate = json.loads(json.dumps(tracked))
    candidate.pop("network_policies")
    mutate(candidate)
    assert policy_semantic_sha256(candidate) != policy_sha256(POLICY)


def test_policy_equivalence_rejects_malformed_representation():
    with pytest.raises(LifecycleRefusal, match="must be an object"):
        policy_semantic_sha256([])


def test_snapshot_drift_fails_closed_without_exposing_identity():
    before = ProductionSnapshot("a" * 64, "b" * 64, "present")
    require_unchanged_production(before, before)
    after = ProductionSnapshot("a" * 64, "b" * 64, "absent")
    with pytest.raises(LifecycleRefusal, match="snapshot changed"):
        require_unchanged_production(before, after)
    assert before.canonical_sha256 != after.canonical_sha256


def test_mutation_audit_allows_only_generated_exact_scope(tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    generated = candidate.scope.identity
    candidate.transcript = [
        {"argv_class": "create-workspace", "resource": generated.workspace,
         "mutating": True},
        {"argv_class": "product-destroy-target", "resource": generated.target,
         "mutating": True},
    ]
    candidate.audit_mutations()
    candidate.transcript.append(
        {"argv_class": "bad", "resource": "prime-claw", "mutating": True})
    with pytest.raises(LifecycleRefusal, match="escaped generated"):
        candidate.audit_mutations()
    candidate.transcript = [
        {"argv_class": "provider-create", "resource": generated.target,
         "mutating": True}
    ]
    with pytest.raises(LifecycleRefusal, match="escaped generated"):
        candidate.audit_mutations()


def test_mutation_audit_accepts_authorized_image_containing_production_substring(
        tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    generated = candidate.scope.identity
    assert candidate.production_name in generated.image
    candidate.transcript = [
        {"argv_class": "delete-image", "resource": generated.image,
         "mutating": True},
    ]
    candidate.audit_mutations()


def test_mutation_audit_rejects_exact_configured_identity(
        tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    generated = candidate.scope.identity
    candidate.production_name = generated.image
    candidate.transcript = [
        {"argv_class": "delete-image", "resource": generated.image,
         "mutating": True},
    ]
    with pytest.raises(LifecycleRefusal, match="forbidden identity"):
        candidate.audit_mutations()


def test_mutation_audit_rejects_malformed_structured_identity(
        tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    candidate.transcript = [
        {"argv_class": "delete-image", "resource": [candidate.scope.identity.image],
         "mutating": True},
    ]
    with pytest.raises(LifecycleRefusal, match="escaped generated"):
        candidate.audit_mutations()


def test_sandbox_inspection_requires_exact_name_workspace_labels_policy_and_ready(
        tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    ref = candidate.scope.ref("target")
    policy = yaml.safe_load(POLICY.read_text())
    row = {
        "name": ref.identity,
        "workspace": candidate.scope.identity.workspace,
        "phase": "Ready",
        "labels": candidate.scope.identity.labels(),
        "policy": policy,
    }
    monkeypatch.setattr(candidate, "_run", lambda *args, **kwargs: result(
        stdout=json.dumps(row)))
    inspected = candidate._inspect_sandbox(ref)
    assert inspected.state == "present"
    assert inspected.policy_sha256 == candidate.scope.policy_sha256
    row["workspace"] = "default"
    assert candidate._inspect_sandbox(ref).state == "unknown"


def test_provider_parser_accepts_only_exact_empty_message(tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    ref = candidate.scope.ref("target")
    empty = f"No providers attached to sandbox {ref.identity}.\n"
    monkeypatch.setattr(candidate, "_run", lambda *args, **kwargs: result(stdout=empty))
    assert candidate.provider_names(
        ref, gateway_id="openshell",
        workspace=candidate.scope.identity.workspace) == ()
    monkeypatch.setattr(candidate, "_run", lambda *args, **kwargs: result(
        stdout="NAME  TYPE\nsomething  custom\n"))
    assert candidate.provider_names(
        ref, gateway_id="openshell",
        workspace=candidate.scope.identity.workspace) == ("<present>",)


def test_names_only_production_snapshot_discards_other_names(tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    monkeypatch.setattr(candidate, "_run", lambda *args, **kwargs: result(
        stdout="other-sandbox\nprime-claw\n"))
    snap = candidate.production_snapshot()
    assert snap.state == "present"
    assert "prime-claw" not in json.dumps(snap.__dict__)
    monkeypatch.setattr(candidate, "_run", lambda *args, **kwargs: result(stdout=""))
    assert candidate.production_snapshot().state == "absent"


def test_product_proxy_allows_only_explicit_target_get_delete(tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    proxy, transcript = candidate._product_proxy()
    text = proxy.read_text()
    assert candidate.scope.identity.target in text
    assert candidate.scope.identity.workspace in text
    assert "--workspace" in text and "-g" in text
    assert "prime-claw" not in text
    assert transcript.stat().st_mode & 0o777 == 0o600
    assert proxy.stat().st_mode & 0o777 == 0o700


def test_overlength_sandbox_name_is_refused_before_adapter_call(tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    monkeypatch.setattr(
        candidate, "_run",
        lambda *args, **kwargs: pytest.fail("overlength name reached command adapter"),
    )
    with pytest.raises(LifecycleRefusal, match="19-character limit"):
        candidate._inspect_sandbox(ResourceRef("target", "sandbox", "x" * 20))


def test_live_failure_retains_production_snapshot_hashes(tmp_path, monkeypatch):
    candidate = control(tmp_path, monkeypatch)
    snapshot = ProductionSnapshot("a" * 64, "b" * 64, "present")
    snapshots = iter((snapshot, snapshot))
    monkeypatch.setattr(candidate, "production_snapshot", lambda: next(snapshots))

    def fail_preflight(_control):
        raise LifecycleRefusal("synthetic primary failure")

    monkeypatch.setattr(candidate.scope, "preflight", fail_preflight)
    monkeypatch.setattr(candidate.scope, "teardown", lambda _control: None)
    monkeypatch.setattr("lifecycle.live.LiveControlPlane", lambda **kwargs: candidate)

    with pytest.raises(LifecycleRefusal, match="primary=True"):
        run_live_acceptance(candidate.scope)

    failure = json.loads((tmp_path / "failure.json").read_text())
    assert failure == {
        "cleanup_failed": False,
        "primary_failed": True,
        "production_after_sha256": snapshot.canonical_sha256,
        "production_before_sha256": snapshot.canonical_sha256,
        "production_unchanged": True,
        "run_id": "1" * 32,
        "schema": 1,
        "snapshot_failed": False,
        "status": "failed",
    }
    assert (tmp_path / "failure.json").stat().st_mode & 0o777 == 0o600


class FakeRecordedCleanupControl:
    instances = []
    policy_drift = False

    def __init__(self, *, scope, **_kwargs):
        self.scope = scope
        self.transcript = []
        self.image_iid = None
        snapshot = ProductionSnapshot("a" * 64, "b" * 64, "present")
        self.snapshots = [snapshot, snapshot]
        self.states = {
            "target": Inspection(
                scope.ref("target"), "present", scope.identity.labels(),
                "b" * 64 if self.policy_drift else scope.policy_sha256,
            ),
            "sentinel": Inspection(scope.ref("sentinel"), "absent"),
            "workspace": Inspection(
                scope.ref("workspace"), "present", scope.identity.labels()
            ),
            "image": Inspection(
                scope.ref("image"), "present", scope.identity.labels()
            ),
        }
        self.mutations = []
        self.audit_require_mutation = None
        type(self).instances.append(self)

    def capabilities(self, *, gateway_id, workspace):
        assert gateway_id == self.scope.gateway_id
        assert workspace == self.scope.identity.workspace
        return Capabilities("0.0.116", "0.0.116", True, True)

    def production_snapshot(self):
        return self.snapshots.pop(0)

    def bind_existing_image_iid(self, image_iid):
        self.image_iid = image_iid

    def inspect(self, ref, *, gateway_id, workspace):
        assert gateway_id == self.scope.gateway_id
        assert workspace == self.scope.identity.workspace
        return self.states[ref.slot]

    def delete(self, ref, *, gateway_id, workspace):
        assert gateway_id == self.scope.gateway_id
        assert workspace == self.scope.identity.workspace
        self.mutations.append(ref.slot)
        self.transcript.append({
            "argv_class": f"delete-{ref.slot}",
            "resource": ref.identity,
            "mutating": True,
        })
        self.states[ref.slot] = Inspection(ref, "absent")

    def audit_mutations(self, *, require_mutation=True):
        self.audit_require_mutation = require_mutation


def test_recorded_cleanup_deletes_only_exact_owned_run_in_order(
        tmp_path, monkeypatch):
    FakeRecordedCleanupControl.instances.clear()
    FakeRecordedCleanupControl.policy_drift = False
    monkeypatch.setattr(
        "lifecycle.live.LiveControlPlane", FakeRecordedCleanupControl
    )
    snapshot = ProductionSnapshot("a" * 64, "b" * 64, "present")
    evidence = tmp_path / "one-cleanup"
    summary_path = run_recorded_cleanup(
        run_id="6ffc582724e84015a4986dbfd8077be0",
        image_iid="sha256:" + "7" * 64,
        expected_production_sha256=snapshot.canonical_sha256,
        evidence_dir=evidence,
    )
    candidate = FakeRecordedCleanupControl.instances[-1]
    assert candidate.mutations == ["target", "workspace", "image"]
    assert candidate.image_iid == "sha256:" + "7" * 64
    assert candidate.audit_require_mutation is False
    summary = json.loads(summary_path.read_text())
    assert summary["final_states"] == {
        "image": "absent",
        "sentinel": "absent",
        "target": "absent",
        "workspace": "absent",
    }
    assert summary["production_unchanged"] is True
    assert summary["mutation_classes"] == [
        "delete-target", "delete-workspace", "delete-image"
    ]
    assert summary_path.stat().st_mode & 0o777 == 0o600


def test_recorded_cleanup_policy_drift_fails_before_mutation(
        tmp_path, monkeypatch):
    FakeRecordedCleanupControl.instances.clear()
    FakeRecordedCleanupControl.policy_drift = True
    monkeypatch.setattr(
        "lifecycle.live.LiveControlPlane", FakeRecordedCleanupControl
    )
    snapshot = ProductionSnapshot("a" * 64, "b" * 64, "present")
    evidence = tmp_path / "drift-cleanup"
    with pytest.raises(LifecycleRefusal, match="policy identity"):
        run_recorded_cleanup(
            run_id="6ffc582724e84015a4986dbfd8077be0",
            image_iid="sha256:" + "7" * 64,
            expected_production_sha256=snapshot.canonical_sha256,
            evidence_dir=evidence,
        )
    candidate = FakeRecordedCleanupControl.instances[-1]
    assert candidate.mutations == []
    failure = json.loads((evidence / "cleanup-failure.json").read_text())
    assert failure["status"] == "failed"
    assert failure["mutation_classes"] == []


def test_recorded_cleanup_production_drift_fails_before_resource_reads(
        tmp_path, monkeypatch):
    FakeRecordedCleanupControl.instances.clear()
    FakeRecordedCleanupControl.policy_drift = False
    monkeypatch.setattr(
        "lifecycle.live.LiveControlPlane", FakeRecordedCleanupControl
    )
    evidence = tmp_path / "production-drift-cleanup"
    with pytest.raises(LifecycleRefusal, match="snapshot differs"):
        run_recorded_cleanup(
            run_id="6ffc582724e84015a4986dbfd8077be0",
            image_iid="sha256:" + "7" * 64,
            expected_production_sha256="f" * 64,
            evidence_dir=evidence,
        )
    candidate = FakeRecordedCleanupControl.instances[-1]
    assert candidate.mutations == []
    assert candidate.image_iid is None
