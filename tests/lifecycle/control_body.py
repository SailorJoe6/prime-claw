"""Disposable tier-1 recording-fake matrix for lifecycle guardrails."""

from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from unit_env_entry import require_unit_env
require_unit_env()

import pytest

from lifecycle.support import (
    Capabilities,
    Inspection,
    LifecycleIdentity,
    LifecycleRefusal,
    LifecycleScope,
    ResourceRef,
)


RUN_ID = "0123456789abcdef0123456789abcdef"
POLICY = "a" * 64


class RecordingControl:
    def __init__(self):
        self.capability = Capabilities("client-1", "server-1", True, True)
        self.states = {}
        self.calls = []
        self.mutations = []
        self.raise_capabilities = False
        self.raise_inspect = set()
        self.malformed_slots = set()
        self.refuse_delete = set()
        self.unknown_after_delete = set()

    def capabilities(self, *, gateway_id, workspace):
        self.calls.append(("read", "capabilities", gateway_id, workspace))
        if self.raise_capabilities:
            raise OSError("offline")
        return self.capability

    def inspect(self, ref, *, gateway_id, workspace):
        self.calls.append(("read", f"inspect-{ref.slot}", gateway_id,
                           workspace, ref.identity))
        if ref.slot in self.raise_inspect:
            raise OSError("inspect failed")
        if ref.slot in self.malformed_slots:
            return {"state": "absent"}
        return self.states.get(ref.slot, Inspection(ref, "absent"))

    def create(self, ref, *, gateway_id, workspace, labels,
               policy_sha256, disable_auto_providers):
        call = ("mutate", f"create-{ref.slot}", gateway_id, workspace,
                ref.identity, dict(labels), policy_sha256,
                disable_auto_providers)
        self.calls.append(call)
        self.mutations.append(call)
        self.states[ref.slot] = Inspection(
            ref, "present", dict(labels),
            policy_sha256 if ref.kind == "sandbox" else None,
        )

    def delete(self, ref, *, gateway_id, workspace):
        call = ("mutate", f"delete-{ref.slot}", gateway_id, workspace,
                ref.identity)
        self.calls.append(call)
        self.mutations.append(call)
        if ref.slot in self.refuse_delete:
            raise OSError("refused")
        state = "unknown" if ref.slot in self.unknown_after_delete else "absent"
        self.states[ref.slot] = Inspection(ref, state)


def scope(tmp_path, **kwargs):
    return LifecycleScope.generate(
        evidence_dir=tmp_path,
        gateway_id=kwargs.pop("gateway_id", "test-gateway"),
        policy_sha256=POLICY,
        run_id=kwargs.pop("run_id", RUN_ID),
        **kwargs,
    )


def present(s, slot, *, labels=None, policy=None):
    ref = s.ref(slot)
    return Inspection(
        ref, "present", s.identity.labels() if labels is None else labels,
        POLICY if ref.kind == "sandbox" and policy is None else policy,
    )


def test_generated_scope_is_unique_nondefault_and_overlay_free(tmp_path):
    first = scope(tmp_path / "first")
    second = scope(tmp_path / "second", run_id="f" * 32)
    assert first.identity.workspace == "pct-0123456789ab"
    assert first.identity.target.endswith("-target")
    assert first.identity.sentinel.endswith("-sentinel")
    assert first.identity.image == "prime-claw-lifecycle:0123456789ab"
    assert first.identity.labels() == {"pc-test": "true", "pc-run": RUN_ID}
    assert first.identity.workspace != second.identity.workspace
    config = first.generated_config()
    assert config["auto_providers"] is False
    assert config["provider"] is None
    assert config["local_overlay"] is False
    assert "credential" not in json.dumps(config).lower()


def test_local_default_forbidden_and_malformed_identities_fail_before_calls(tmp_path):
    control = RecordingControl()
    bad = LifecycleIdentity(RUN_ID, "default", "pct-x-target",
                            "pct-x-sentinel", "prime-claw-lifecycle:x")
    with pytest.raises(LifecycleRefusal, match="derived from the run identity"):
        LifecycleScope(identity=bad, gateway_id="test-gateway",
                       policy_sha256=POLICY, evidence_path=tmp_path / "bad.jsonl")
    generated = LifecycleIdentity.generate(RUN_ID)
    bad_target = LifecycleIdentity(RUN_ID, generated.workspace, "default",
                                   generated.sentinel, generated.image)
    with pytest.raises(LifecycleRefusal, match="derived from the run identity"):
        LifecycleScope(identity=bad_target, gateway_id="test-gateway",
                       policy_sha256=POLICY,
                       evidence_path=tmp_path / "bad-target.jsonl")
    with pytest.raises(LifecycleRefusal, match="forbidden"):
        scope(tmp_path / "forbidden", forbidden_identities={"pct-0123456789ab"})
    with pytest.raises(LifecycleRefusal, match="gateway"):
        scope(tmp_path / "gateway", gateway_id="default")
    assert control.mutations == []


@pytest.mark.parametrize(
    "configure,match",
    [
        (lambda c, s: setattr(c, "raise_capabilities", True), "capability"),
        (lambda c, s: setattr(c, "capability", Capabilities("client-1", "server-1", True, False)), "unreachable"),
        (lambda c, s: setattr(c, "capability", Capabilities("client-1", "server-1", False, True)), "incompatible"),
        (lambda c, s: setattr(c, "capability", {"compatible": True}), "malformed"),
        (lambda c, s: c.malformed_slots.add("workspace"), "malformed"),
        (lambda c, s: c.states.__setitem__("workspace", Inspection(s.ref("workspace"), "unknown")), "unknown"),
        (lambda c, s: c.states.__setitem__("workspace", present(s, "workspace")), "already exists"),
        (lambda c, s: c.states.__setitem__("target", present(s, "target", labels={"pc-test": "true", "pc-run": "f" * 32})), "already exists"),
    ],
)
def test_preflight_failures_make_zero_mutating_calls(tmp_path, configure, match):
    candidate = scope(tmp_path)
    control = RecordingControl()
    configure(control, candidate)
    with pytest.raises(LifecycleRefusal, match=match):
        candidate.preflight(control)
    assert control.mutations == []
    assert candidate.evidence.path.exists()


def test_credential_or_endpoint_shaped_capability_data_is_not_recorded(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    control.capability = Capabilities("token=should-not-record", "server-1", True, True)
    with pytest.raises(LifecycleRefusal, match="credential or endpoint"):
        candidate.preflight(control)
    assert control.mutations == []
    assert "should-not-record" not in candidate.evidence.path.read_text()


def test_valid_preflight_is_read_only_and_records_exact_absence(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    candidate.preflight(control)
    assert control.mutations == []
    inspected = [call[-1] for call in control.calls if call[1].startswith("inspect-")]
    assert inspected == [candidate.ref(slot).identity for slot in
                         ("workspace", "image", "target", "sentinel")]
    assert all(call[2] == "test-gateway" for call in control.calls)
    assert all(call[3] == candidate.identity.workspace for call in control.calls)


def test_creation_requires_preflight_and_exact_order(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    with pytest.raises(LifecycleRefusal, match="before successful preflight"):
        candidate.create_owned(control, "workspace")
    candidate.preflight(control)
    with pytest.raises(LifecycleRefusal, match="order"):
        candidate.create_owned(control, "target")
    assert control.mutations == []


def test_recorded_create_and_teardown_use_only_captured_exact_identities(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    candidate.preflight(control)
    for slot in ("workspace", "image", "target", "sentinel"):
        candidate.create_owned(control, slot)
    assert candidate.owned_slots == ("workspace", "image", "target", "sentinel")
    candidate.teardown(control)
    assert candidate.owned_slots == ()
    mutations = [(call[1], call[4]) for call in control.mutations]
    assert mutations == [
        ("create-workspace", candidate.identity.workspace),
        ("create-image", candidate.identity.image),
        ("create-target", candidate.identity.target),
        ("create-sentinel", candidate.identity.sentinel),
        ("delete-target", candidate.identity.target),
        ("delete-sentinel", candidate.identity.sentinel),
        ("delete-workspace", candidate.identity.workspace),
        ("delete-image", candidate.identity.image),
    ]
    serialized = json.dumps(control.calls)
    for forbidden in ("--all", "prune", "default", "operator"):
        assert forbidden not in serialized
    assert all(call[-1] is True for call in control.mutations[:4])


def test_unowned_or_mismatched_capture_cannot_authorize_delete(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    candidate.teardown(control)
    wrong_labels = {"pc-test": "true", "pc-run": "f" * 32}
    with pytest.raises(LifecycleRefusal, match="labels"):
        candidate.capture_owned(present(candidate, "target", labels=wrong_labels))
    with pytest.raises(LifecycleRefusal, match="policy"):
        candidate.capture_owned(present(candidate, "target", policy="b" * 64))
    assert control.mutations == []


def test_unknown_teardown_state_blocks_delete_and_retains_evidence(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    owned = present(candidate, "target")
    candidate.capture_owned(owned)
    control.states["target"] = Inspection(candidate.ref("target"), "unknown")
    with pytest.raises(LifecycleRefusal, match="unknown"):
        candidate.teardown(control)
    assert control.mutations == []
    assert candidate.evidence.path.exists()
    assert "teardown-inspect-target" in candidate.evidence.path.read_text()


def test_teardown_refusal_is_single_exact_attempt_and_retains_evidence(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    owned = present(candidate, "target")
    candidate.capture_owned(owned)
    control.states["target"] = owned
    control.refuse_delete.add("target")
    with pytest.raises(LifecycleRefusal, match="teardown failed"):
        candidate.teardown(control)
    assert len(control.mutations) == 1
    assert control.mutations[0][1:5] == (
        "delete-target", "test-gateway", candidate.identity.workspace,
        candidate.identity.target,
    )
    assert candidate.evidence.path.exists()
    assert "refused" in candidate.evidence.path.read_text()


def test_unknown_post_delete_verification_fails_without_retry(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    owned = present(candidate, "target")
    candidate.capture_owned(owned)
    control.states["target"] = owned
    control.unknown_after_delete.add("target")
    with pytest.raises(LifecycleRefusal, match="absence"):
        candidate.teardown(control)
    assert [c[1] for c in control.mutations] == ["delete-target"]
    assert candidate.owned_slots == ("target",)


def test_evidence_schema_has_required_normalized_fields(tmp_path):
    candidate = scope(tmp_path)
    control = RecordingControl()
    candidate.preflight(control)
    records = [json.loads(line) for line in candidate.evidence.path.read_text().splitlines()]
    assert records
    required = {
        "gateway_id", "workspace", "run_id", "deadline_seconds",
        "evidence_destination", "client_version", "server_version",
        "argv_class", "result",
    }
    assert all(required <= record.keys() for record in records)
    assert all(record["run_id"] == RUN_ID for record in records)
    serialized = json.dumps(records).lower()
    assert "authorization" not in serialized
    assert "bearer " not in serialized
    assert "https://" not in serialized
