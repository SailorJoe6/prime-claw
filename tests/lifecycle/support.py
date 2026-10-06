"""Inert lifecycle control boundary for explicit host-observer tests.

This module contains no subprocess, Docker, or OpenShell implementation.  A
future live observer must provide a reviewed adapter; Slice 6 exercises the
contract only with a recording fake inside the disposable tier-1 container.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
from typing import Mapping, Protocol
from uuid import uuid4


LABEL_TEST = "pc-test"
LABEL_RUN = "pc-run"
_ALLOWED_SLOTS = ("workspace", "image", "target", "sentinel")
_TEARDOWN_SLOTS = ("target", "sentinel", "workspace", "image")
_HEX_32 = re.compile(r"^[0-9a-f]{32}$")
_HEX_64 = re.compile(r"^[0-9a-f]{64}$")
_SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{0,95}$")
_SENSITIVE = re.compile(
    r"(?i)(authorization|bearer|cookie|password|secret|token|api[_-]?key|"
    r"https?://|(?:^|[^0-9])(?:10\.|192\.168\.|172\.(?:1[6-9]|2[0-9]|3[01])\.))"
)


class LifecycleRefusal(RuntimeError):
    """Fail-closed lifecycle boundary rejection."""


@dataclass(frozen=True)
class LifecycleIdentity:
    run_id: str
    workspace: str
    target: str
    sentinel: str
    image: str

    @classmethod
    def generate(cls, run_id: str | None = None) -> "LifecycleIdentity":
        full = run_id or uuid4().hex
        if not _HEX_32.fullmatch(full):
            raise LifecycleRefusal("run identity must be 32 lowercase hex characters")
        short = full[:12]
        return cls(
            run_id=full,
            workspace=f"pct-{short}",
            target=f"pct-{short}-target",
            sentinel=f"pct-{short}-sentinel",
            image=f"prime-claw-lifecycle:{short}",
        )

    def labels(self) -> dict[str, str]:
        return {LABEL_TEST: "true", LABEL_RUN: self.run_id}


@dataclass(frozen=True)
class ResourceRef:
    slot: str
    kind: str
    identity: str


@dataclass(frozen=True)
class Capabilities:
    client_version: str
    server_version: str
    compatible: bool
    daemon_reachable: bool


@dataclass(frozen=True)
class Inspection:
    ref: ResourceRef
    state: str  # present | absent | unknown
    labels: Mapping[str, str] = field(default_factory=dict)
    policy_sha256: str | None = None


class ControlPlane(Protocol):
    def capabilities(self, *, gateway_id: str, workspace: str) -> Capabilities: ...

    def inspect(self, ref: ResourceRef, *, gateway_id: str,
                workspace: str) -> Inspection: ...

    def create(self, ref: ResourceRef, *, gateway_id: str, workspace: str,
               labels: Mapping[str, str], policy_sha256: str,
               disable_auto_providers: bool) -> None: ...

    def delete(self, ref: ResourceRef, *, gateway_id: str,
               workspace: str) -> None: ...


class EvidenceRecorder:
    """Append normalized events without command output or endpoint material."""

    def __init__(self, path: Path) -> None:
        self.path = path.resolve()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.path.touch(mode=0o600)
        os.chmod(self.path, 0o600)

    @staticmethod
    def _safe(value: str, field_name: str) -> str:
        if _SENSITIVE.search(value):
            raise LifecycleRefusal(
                f"evidence field {field_name} contains credential or endpoint material"
            )
        return value

    def append(self, event: Mapping[str, object]) -> None:
        for key, value in event.items():
            if isinstance(value, str):
                self._safe(value, key)
        with self.path.open("a", encoding="utf-8") as stream:
            stream.write(json.dumps(dict(event), sort_keys=True, separators=(",", ":")))
            stream.write("\n")


class LifecycleScope:
    """Generated scope with exact ownership capture and bounded teardown."""

    def __init__(self, *, identity: LifecycleIdentity, gateway_id: str,
                 policy_sha256: str, evidence_path: Path,
                 forbidden_identities: set[str] | frozenset[str] = frozenset(),
                 deadline_seconds: int = 300) -> None:
        self.identity = identity
        self.gateway_id = gateway_id
        self.policy_sha256 = policy_sha256
        self.evidence = EvidenceRecorder(evidence_path)
        self.forbidden_identities = frozenset(forbidden_identities)
        self.deadline_seconds = deadline_seconds
        self._prepared = False
        self._owned: dict[str, Inspection] = {}
        self._client_version = "unavailable"
        self._server_version = "unavailable"
        self._validate_local_contract()

    @classmethod
    def generate(cls, *, evidence_dir: Path, gateway_id: str,
                 policy_sha256: str, run_id: str | None = None,
                 forbidden_identities: set[str] | frozenset[str] = frozenset(),
                 deadline_seconds: int = 300) -> "LifecycleScope":
        identity = LifecycleIdentity.generate(run_id)
        return cls(
            identity=identity,
            gateway_id=gateway_id,
            policy_sha256=policy_sha256,
            evidence_path=evidence_dir / f"{identity.run_id}.jsonl",
            forbidden_identities=forbidden_identities,
            deadline_seconds=deadline_seconds,
        )

    @property
    def owned_slots(self) -> tuple[str, ...]:
        return tuple(self._owned)

    def ref(self, slot: str) -> ResourceRef:
        if slot == "workspace":
            return ResourceRef(slot, "workspace", self.identity.workspace)
        if slot == "image":
            return ResourceRef(slot, "image", self.identity.image)
        if slot in ("target", "sentinel"):
            return ResourceRef(slot, "sandbox", getattr(self.identity, slot))
        raise LifecycleRefusal(f"unsupported lifecycle resource slot: {slot}")

    def _validate_local_contract(self) -> None:
        if not _SAFE_ID.fullmatch(self.gateway_id) or self.gateway_id == "default":
            raise LifecycleRefusal("gateway identity must be explicit and sanitized")
        if not _HEX_64.fullmatch(self.policy_sha256):
            raise LifecycleRefusal("policy identity must be a lowercase sha256")
        if not 1 <= self.deadline_seconds <= 900:
            raise LifecycleRefusal("lifecycle deadline must be between 1 and 900 seconds")
        if not _HEX_32.fullmatch(self.identity.run_id):
            raise LifecycleRefusal("run identity is malformed")
        expected = LifecycleIdentity.generate(self.identity.run_id)
        if self.identity != expected:
            raise LifecycleRefusal(
                "workspace and resource identities must be derived from the run identity"
            )
        values = [self.identity.workspace, self.identity.target,
                  self.identity.sentinel, self.identity.image]
        if len(values) != len(set(values)):
            raise LifecycleRefusal("lifecycle resource identities must be unique")
        if any(value == "default" for value in values):
            raise LifecycleRefusal("default lifecycle identities are forbidden")
        if any(value in self.forbidden_identities for value in values):
            raise LifecycleRefusal("generated identity matches the offline forbidden list")

    def _event(self, *, argv_class: str, result: str,
               resource: ResourceRef | None = None) -> None:
        self.evidence.append({
            "schema": 1,
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "run_id": self.identity.run_id,
            "gateway_id": self.gateway_id,
            "workspace": self.identity.workspace,
            "deadline_seconds": self.deadline_seconds,
            "evidence_destination": self.evidence.path.name,
            "client_version": self._client_version,
            "server_version": self._server_version,
            "argv_class": argv_class,
            "resource_kind": resource.kind if resource else "control",
            "resource_identity": resource.identity if resource else self.identity.workspace,
            "result": result,
        })

    def _inspect(self, control: ControlPlane, ref: ResourceRef,
                 argv_class: str) -> Inspection:
        try:
            inspection = control.inspect(
                ref, gateway_id=self.gateway_id, workspace=self.identity.workspace)
        except Exception as exc:
            self._event(argv_class=argv_class, result="inspect-failed", resource=ref)
            raise LifecycleRefusal(f"exact {ref.slot} inspection failed") from exc
        if not isinstance(inspection, Inspection) or inspection.ref != ref:
            self._event(argv_class=argv_class, result="malformed", resource=ref)
            raise LifecycleRefusal(f"exact {ref.slot} inspection was malformed")
        if inspection.state not in ("present", "absent", "unknown"):
            self._event(argv_class=argv_class, result="malformed", resource=ref)
            raise LifecycleRefusal(f"exact {ref.slot} inspection state was malformed")
        self._event(argv_class=argv_class, result=inspection.state, resource=ref)
        return inspection

    def preflight(self, control: ControlPlane) -> None:
        """Perform read-only compatibility and collision checks."""
        self._validate_local_contract()
        try:
            capabilities = control.capabilities(
                gateway_id=self.gateway_id, workspace=self.identity.workspace)
        except Exception as exc:
            self._event(argv_class="capabilities", result="failed")
            raise LifecycleRefusal("lifecycle capability preflight failed") from exc
        if not isinstance(capabilities, Capabilities):
            self._event(argv_class="capabilities", result="malformed")
            raise LifecycleRefusal("lifecycle capability response was malformed")
        self._client_version = EvidenceRecorder._safe(
            capabilities.client_version, "client_version")
        self._server_version = EvidenceRecorder._safe(
            capabilities.server_version, "server_version")
        if not capabilities.daemon_reachable:
            self._event(argv_class="capabilities", result="daemon-unreachable")
            raise LifecycleRefusal("lifecycle daemon is unreachable")
        if not capabilities.compatible:
            self._event(argv_class="capabilities", result="incompatible")
            raise LifecycleRefusal("lifecycle CLI/server capabilities are incompatible")
        self._event(argv_class="capabilities", result="compatible")
        for slot in _ALLOWED_SLOTS:
            inspection = self._inspect(control, self.ref(slot), f"inspect-{slot}")
            if inspection.state == "unknown":
                raise LifecycleRefusal(f"{slot} collision state is unknown")
            if inspection.state == "present":
                raise LifecycleRefusal(f"{slot} identity already exists")
        self._prepared = True
        self._event(argv_class="preflight", result="ready")

    def generated_config(self) -> dict[str, object]:
        """Return an isolated generated config; never merge operator config."""
        return {
            "schema": 1,
            "run_id": self.identity.run_id,
            "gateway_id": self.gateway_id,
            "workspace": self.identity.workspace,
            "target": self.identity.target,
            "sentinel": self.identity.sentinel,
            "image": self.identity.image,
            "policy_sha256": self.policy_sha256,
            "auto_providers": False,
            "provider": None,
            "local_overlay": False,
        }

    def capture_owned(self, inspection: Inspection) -> None:
        """Capture only an exact, re-read resource carrying this run's ownership."""
        ref = inspection.ref
        if ref != self.ref(ref.slot) or inspection.state != "present":
            raise LifecycleRefusal("ownership capture requires one exact present identity")
        if dict(inspection.labels) != self.identity.labels():
            raise LifecycleRefusal("ownership labels do not exactly match the generated run")
        if ref.kind == "sandbox" and inspection.policy_sha256 != self.policy_sha256:
            raise LifecycleRefusal("sandbox policy identity does not match the tracked policy")
        self._owned[ref.slot] = inspection
        self._event(argv_class=f"capture-{ref.slot}", result="owned", resource=ref)

    def create_owned(self, control: ControlPlane, slot: str) -> None:
        if not self._prepared:
            raise LifecycleRefusal("lifecycle creation refused before successful preflight")
        expected_index = len(self._owned)
        if expected_index >= len(_ALLOWED_SLOTS) or _ALLOWED_SLOTS[expected_index] != slot:
            raise LifecycleRefusal("lifecycle creation order or ownership state is invalid")
        ref = self.ref(slot)
        try:
            control.create(
                ref, gateway_id=self.gateway_id, workspace=self.identity.workspace,
                labels=self.identity.labels(), policy_sha256=self.policy_sha256,
                disable_auto_providers=True,
            )
        except Exception as exc:
            self._event(argv_class=f"create-{slot}", result="refused", resource=ref)
            raise LifecycleRefusal(f"exact {slot} creation failed") from exc
        self._event(argv_class=f"create-{slot}", result="created", resource=ref)
        inspection = self._inspect(control, ref, f"reread-{slot}")
        self.capture_owned(inspection)

    def teardown(self, control: ControlPlane) -> None:
        """Delete only captured identities after exact ownership revalidation."""
        for slot in _TEARDOWN_SLOTS:
            captured = self._owned.get(slot)
            if captured is None:
                continue
            ref = captured.ref
            current = self._inspect(control, ref, f"teardown-inspect-{slot}")
            if current.state == "unknown":
                raise LifecycleRefusal(f"{slot} teardown state is unknown")
            if current.state == "absent":
                self._owned.pop(slot, None)
                continue
            self.capture_owned(current)
            try:
                control.delete(
                    ref, gateway_id=self.gateway_id,
                    workspace=self.identity.workspace)
            except Exception as exc:
                self._event(argv_class=f"delete-{slot}", result="refused", resource=ref)
                raise LifecycleRefusal(f"exact {slot} teardown failed") from exc
            self._event(argv_class=f"delete-{slot}", result="deleted", resource=ref)
            after = self._inspect(control, ref, f"verify-absent-{slot}")
            if after.state != "absent":
                raise LifecycleRefusal(f"{slot} absence could not be verified")
            self._owned.pop(slot, None)
