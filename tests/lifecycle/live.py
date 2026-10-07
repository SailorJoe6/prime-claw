"""Reviewed live adapter for the explicit Slice-7 host lifecycle observer.

Importing this module is inert. External commands run only when the one
registered lifecycle body calls ``run_live_acceptance`` after pytest's explicit
marker/fixture/--run-lifecycle admission.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import time
from typing import Any

from scripts.testing import bounded as bounded_command

from .support import (
    Capabilities,
    Inspection,
    LifecycleRefusal,
    LifecycleScope,
    MAX_SANDBOX_NAME_LEN,
    ResourceRef,
)


REPO = Path(__file__).resolve().parents[2]
OPENSHELL_VERSION = "0.0.116"
_SAFE_VERSION = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._ -]{0,63}$")
_SAFE_PHASE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,31}$")
_ABSENT = ("not found", "does not exist", "no such")


def _sha(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def _ownership_labels(value: object) -> dict[str, str]:
    if not isinstance(value, dict):
        return {}
    return {key: value[key] for key in ("pc-test", "pc-run")
            if isinstance(value.get(key), str)}


def policy_semantic_sha256(value: object) -> str:
    """Hash the v0.0.116 policy semantics across YAML and server JSON forms.

    OpenShell v0.0.116 omits an empty ``network_policies`` map when it
    serializes the typed policy returned by ``sandbox get --output json``.
    The tracked YAML spells that deny-by-default map explicitly. This is the
    only representation difference normalized here; every material value and
    every other key remains part of the fail-closed identity.
    """
    if not isinstance(value, dict):
        raise LifecycleRefusal("lifecycle policy representation must be an object")
    normalized = dict(value)
    normalized.setdefault("network_policies", {})
    return _sha(normalized)


def policy_sha256(path: Path) -> str:
    """Hash tracked policy semantics rather than YAML presentation."""
    import yaml
    value = yaml.safe_load(path.read_text())
    if not isinstance(value, dict):
        raise LifecycleRefusal("tracked lifecycle policy must be an object")
    return policy_semantic_sha256(value)


@dataclass(frozen=True)
class ProductionSnapshot:
    identity_sha256: str
    workspace_sha256: str
    state: str

    @property
    def canonical_sha256(self) -> str:
        return _sha(asdict(self))


def require_unchanged_production(before: ProductionSnapshot,
                                 after: ProductionSnapshot) -> None:
    if before != after:
        raise LifecycleRefusal("configured production snapshot changed")


class LiveControlPlane:
    """Exact OpenShell/Docker adapter with sanitized in-memory output handling."""

    def __init__(self, *, scope: LifecycleScope, policy_path: Path,
                 dockerfile: Path, production_name: str,
                 production_workspace: str = "default") -> None:
        self.scope = scope
        self.policy_path = policy_path.resolve()
        self.dockerfile = dockerfile.resolve()
        self.production_name = production_name
        self.production_workspace = production_workspace
        self.openshell = shutil.which(os.environ.get("OPENSHELL_BIN", "openshell"))
        self.docker = shutil.which("docker")
        self.python = sys.executable
        self.transcript: list[dict[str, object]] = []
        self._image_id: str | None = None
        self._image_verify_id: str | None = None
        self._deadline = time.monotonic() + scope.deadline_seconds
        if not self.openshell or not self.docker:
            raise LifecycleRefusal("lifecycle requires openshell and docker on PATH")
        if policy_sha256(self.policy_path) != scope.policy_sha256:
            raise LifecycleRefusal("tracked lifecycle policy identity changed")
        if not self.dockerfile.is_file():
            raise LifecycleRefusal("tracked lifecycle Dockerfile is missing")
        if production_workspace != "default":
            raise LifecycleRefusal("configured production snapshot must use explicit default workspace")
        if not production_name or production_name in {
                scope.identity.target, scope.identity.sentinel}:
            raise LifecycleRefusal("configured production identity is invalid")

    def _env_prefix(self, workspace: str,
                    openshell_bin: str | None = None) -> list[str]:
        path = os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin")
        return [
            "/usr/bin/env", "-i", f"HOME={Path.home()}", f"PATH={path}",
            "LC_ALL=C", f"OPENSHELL_GATEWAY={self.scope.gateway_id}",
            f"OPENSHELL_WORKSPACE={workspace}", "PRIME_CLAW_LOCAL_CONFIG=",
            f"OPENSHELL_BIN={openshell_bin or self.openshell}",
        ]

    def _run(self, argv: list[str], *, argv_class: str, resource: str,
             mutating: bool, timeout: int = 60, clean_env: bool = True,
             openshell_bin: str | None = None):
        self.transcript.append({
            "argv_class": argv_class,
            "resource": resource,
            "mutating": mutating,
        })
        remaining = self._deadline - time.monotonic()
        if remaining <= 0:
            raise LifecycleRefusal("lifecycle deadline expired")
        command = (self._env_prefix(
            self.scope.identity.workspace, openshell_bin) + argv
            if clean_env else argv)
        result = bounded_command.run_completed(
            command, timeout=min(timeout, remaining), kill_grace=5, reap_grace=5,
            capture_output=True, text=True)
        return result

    @staticmethod
    def _ok(result) -> bool:
        return result.outcome == "exited" and result.returncode == 0

    @staticmethod
    def _output(result) -> str:
        return (result.stdout or "") + (result.stderr or "")

    @staticmethod
    def _json(result, expected_type):
        if not LiveControlPlane._ok(result):
            raise LifecycleRefusal("structured lifecycle command failed")
        try:
            value = json.loads(result.stdout or "")
        except (json.JSONDecodeError, TypeError) as exc:
            raise LifecycleRefusal("structured lifecycle output was malformed") from exc
        if not isinstance(value, expected_type):
            raise LifecycleRefusal("structured lifecycle output had the wrong shape")
        return value

    def _openshell_argv(self, workspace: str, *args: str) -> list[str]:
        return [self.openshell, "-g", self.scope.gateway_id,
                "--workspace", workspace, *args]

    @staticmethod
    def _require_routable_sandbox_name(ref: ResourceRef) -> None:
        if ref.kind == "sandbox" and len(ref.identity) > MAX_SANDBOX_NAME_LEN:
            raise LifecycleRefusal(
                f"{ref.slot} identity exceeds OpenShell's "
                f"{MAX_SANDBOX_NAME_LEN}-character limit"
            )

    def capabilities(self, *, gateway_id: str, workspace: str) -> Capabilities:
        if gateway_id != self.scope.gateway_id or workspace != self.scope.identity.workspace:
            raise LifecycleRefusal("capability scope mismatch")
        version = self._run(
            [self.openshell, "--version"], argv_class="capabilities-client",
            resource="control", mutating=False, timeout=15)
        text = self._output(version).strip()
        match = re.fullmatch(r"openshell ([0-9]+\.[0-9]+\.[0-9]+)", text)
        client = match.group(1) if match else "unavailable"
        status = self._run(
            self._openshell_argv(workspace, "status", "--output", "json"),
            argv_class="capabilities-server", resource="control",
            mutating=False, timeout=30)
        reachable = False
        server = "unavailable"
        if self._ok(status):
            try:
                row = json.loads(status.stdout or "")
            except (json.JSONDecodeError, TypeError):
                row = None
            if isinstance(row, dict):
                observed = row.get("version")
                if (row.get("status") == "connected"
                        and isinstance(observed, str)
                        and _SAFE_VERSION.fullmatch(observed)):
                    reachable = True
                    server = observed
        compatible = client == OPENSHELL_VERSION and reachable
        return Capabilities(client, server, compatible, reachable)

    def inspect(self, ref: ResourceRef, *, gateway_id: str,
                workspace: str) -> Inspection:
        if gateway_id != self.scope.gateway_id or workspace != self.scope.identity.workspace:
            raise LifecycleRefusal("inspection scope mismatch")
        if ref == self.scope.ref("workspace"):
            return self._inspect_workspace(ref)
        if ref == self.scope.ref("image"):
            return self._inspect_image(ref)
        if ref in (self.scope.ref("target"), self.scope.ref("sentinel")):
            return self._inspect_sandbox(ref)
        raise LifecycleRefusal("inspection identity is outside generated scope")

    def _inspect_workspace(self, ref: ResourceRef) -> Inspection:
        matches: list[dict[str, object]] = []
        limit = 100
        for page in range(5):
            result = self._run(
                self._openshell_argv(
                    self.scope.identity.workspace, "workspace", "list",
                    "--limit", str(limit), "--offset", str(page * limit),
                    "--output", "json"),
                argv_class="inspect-workspace", resource=ref.identity,
                mutating=False)
            rows = self._json(result, list)
            if len(rows) > limit or any(not isinstance(row, dict) for row in rows):
                return Inspection(ref, "unknown")
            matches.extend(row for row in rows if row.get("name") == ref.identity)
            if len(rows) < limit:
                break
        else:
            return Inspection(ref, "unknown")
        if not matches:
            return Inspection(ref, "absent")
        if len(matches) != 1:
            return Inspection(ref, "unknown")
        labels = _ownership_labels(matches[0].get("labels", {}))
        return Inspection(ref, "present", labels)

    def bind_existing_image_iid(self, image_iid: str) -> None:
        """Pin recorded cleanup to one evidence-captured immutable image ID."""
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_iid):
            raise LifecycleRefusal("recorded image iid is malformed")
        if self._image_id not in (None, image_iid):
            raise LifecycleRefusal("recorded image iid conflicts with captured image")
        self._image_id = image_iid
        self._image_verify_id = image_iid

    def _inspect_image(self, ref: ResourceRef) -> Inspection:
        inspect_identity = self._image_verify_id or ref.identity
        result = self._run(
            [self.docker, "image", "inspect", inspect_identity],
            argv_class="inspect-image", resource=ref.identity,
            mutating=False, timeout=30, clean_env=False)
        if not self._ok(result):
            if any(word in self._output(result).lower() for word in _ABSENT):
                return Inspection(ref, "absent")
            return Inspection(ref, "unknown")
        rows = self._json(result, list)
        if len(rows) != 1 or not isinstance(rows[0], dict):
            return Inspection(ref, "unknown")
        row = rows[0]
        image_id = row.get("Id")
        labels = (row.get("Config") or {}).get("Labels")
        if not isinstance(image_id, str) or not re.fullmatch(r"sha256:[0-9a-f]{64}", image_id):
            return Inspection(ref, "unknown")
        if inspect_identity.startswith("sha256:") and image_id != inspect_identity:
            return Inspection(ref, "unknown")
        labels = _ownership_labels(labels)
        self._image_id = image_id
        return Inspection(ref, "present", labels)

    def _inspect_sandbox(self, ref: ResourceRef) -> Inspection:
        self._require_routable_sandbox_name(ref)
        result = self._run(
            self._openshell_argv(
                self.scope.identity.workspace, "sandbox", "get", ref.identity,
                "--output", "json"),
            argv_class=f"inspect-{ref.slot}", resource=ref.identity,
            mutating=False, timeout=45)
        if not self._ok(result):
            if any(word in self._output(result).lower() for word in _ABSENT):
                return Inspection(ref, "absent")
            return Inspection(ref, "unknown")
        row = self._json(result, dict)
        labels = row.get("labels")
        policy = row.get("policy")
        if (row.get("name") != ref.identity
                or row.get("workspace") != self.scope.identity.workspace
                or row.get("phase") != "Ready"
                or not isinstance(labels, dict)
                or not isinstance(policy, dict)):
            return Inspection(ref, "unknown")
        return Inspection(
            ref, "present", _ownership_labels(labels),
            policy_semantic_sha256(policy),
        )

    def create(self, ref: ResourceRef, *, gateway_id: str, workspace: str,
               labels, policy_sha256: str,
               disable_auto_providers: bool) -> None:
        if (gateway_id != self.scope.gateway_id
                or workspace != self.scope.identity.workspace
                or dict(labels) != self.scope.identity.labels()
                or policy_sha256 != self.scope.policy_sha256
                or disable_auto_providers is not True):
            raise LifecycleRefusal("creation contract mismatch")
        self._require_routable_sandbox_name(ref)
        if ref == self.scope.ref("workspace"):
            argv = self._openshell_argv(
                workspace, "workspace", "create", "--name", ref.identity,
                "--label", "pc-test=true", "--label", f"pc-run={self.scope.identity.run_id}")
            result = self._run(argv, argv_class="create-workspace",
                               resource=ref.identity, mutating=True)
        elif ref == self.scope.ref("image"):
            context = self.scope.evidence.path.parent / "build-context"
            context.mkdir(mode=0o700, parents=True, exist_ok=False)
            captured = context / "Dockerfile"
            captured.write_bytes(self.dockerfile.read_bytes())
            os.chmod(captured, 0o600)
            iidfile = self.scope.evidence.path.parent / "image.iid"
            argv = [
                self.docker, "build", "-q", "--iidfile", str(iidfile),
                "--label", "pc-test=true", "--label", f"pc-run={self.scope.identity.run_id}",
                "-t", ref.identity, "-f", str(captured), str(context),
            ]
            result = self._run(argv, argv_class="create-image",
                               resource=ref.identity, mutating=True,
                               timeout=600, clean_env=False)
            if self._ok(result):
                observed = iidfile.read_text().strip() if iidfile.exists() else ""
                if not re.fullmatch(r"sha256:[0-9a-f]{64}", observed):
                    raise LifecycleRefusal("image iidfile was malformed")
                self._image_id = observed
                os.chmod(iidfile, 0o600)
        elif ref in (self.scope.ref("target"), self.scope.ref("sentinel")):
            argv = self._openshell_argv(
                workspace, "sandbox", "create", "--name", ref.identity,
                "--from", self.scope.identity.image, "--policy", str(self.policy_path),
                "--no-tty", "--detach", "--no-auto-providers",
                "--label", "pc-test=true", "--label", f"pc-run={self.scope.identity.run_id}",
                "--output", "json")
            result = self._run(argv, argv_class=f"create-{ref.slot}",
                               resource=ref.identity, mutating=True, timeout=180)
        else:
            raise LifecycleRefusal("creation identity is outside generated scope")
        if not self._ok(result):
            raise LifecycleRefusal(f"exact {ref.slot} creation command failed")

    def delete(self, ref: ResourceRef, *, gateway_id: str,
               workspace: str) -> None:
        if gateway_id != self.scope.gateway_id or workspace != self.scope.identity.workspace:
            raise LifecycleRefusal("deletion scope mismatch")
        self._require_routable_sandbox_name(ref)
        if ref == self.scope.ref("workspace"):
            argv = self._openshell_argv(
                workspace, "workspace", "delete", ref.identity)
            clean_env = True
        elif ref == self.scope.ref("image"):
            if self._image_id is None:
                raise LifecycleRefusal("captured image ID is unavailable")
            argv = [self.docker, "image", "rm", self._image_id]
            clean_env = False
        elif ref in (self.scope.ref("target"), self.scope.ref("sentinel")):
            argv = self._openshell_argv(
                workspace, "sandbox", "delete", ref.identity)
            clean_env = True
        else:
            raise LifecycleRefusal("deletion identity is outside generated scope")
        result = self._run(argv, argv_class=f"delete-{ref.slot}",
                           resource=ref.identity, mutating=True,
                           timeout=180, clean_env=clean_env)
        if not self._ok(result):
            raise LifecycleRefusal(f"exact {ref.slot} delete command failed")
        if ref == self.scope.ref("image"):
            self._image_verify_id = self._image_id

    def provider_names(self, ref: ResourceRef, *, gateway_id: str,
                       workspace: str) -> tuple[str, ...]:
        if (ref not in (self.scope.ref("target"), self.scope.ref("sentinel"))
                or gateway_id != self.scope.gateway_id
                or workspace != self.scope.identity.workspace):
            raise LifecycleRefusal("provider inspection scope mismatch")
        self._require_routable_sandbox_name(ref)
        result = self._run(
            self._openshell_argv(
                workspace, "sandbox", "provider", "list", ref.identity),
            argv_class=f"providers-{ref.slot}", resource=ref.identity,
            mutating=False, timeout=30)
        if not self._ok(result):
            raise LifecycleRefusal("sandbox provider inspection failed")
        expected = f"No providers attached to sandbox {ref.identity}."
        return () if self._output(result).strip() == expected else ("<present>",)

    def production_snapshot(self) -> ProductionSnapshot:
        """Snapshot only configured-name presence; never retrieve policy/annotations."""
        matches = 0
        limit = 100
        for page in range(5):
            result = self._run(
                self._openshell_argv(
                    self.production_workspace, "sandbox", "list", "--names",
                    "--limit", str(limit), "--offset", str(page * limit)),
                argv_class="snapshot-production", resource="configured-production",
                mutating=False, timeout=45)
            if not self._ok(result):
                raise LifecycleRefusal("configured production snapshot failed")
            lines = [line.strip() for line in (result.stdout or "").splitlines()
                     if line.strip()]
            if len(lines) > limit or any(
                    re.fullmatch(r"[a-z0-9][a-z0-9._-]{0,95}", name) is None
                    for name in lines):
                raise LifecycleRefusal("configured production names snapshot was malformed")
            matches += sum(name == self.production_name for name in lines)
            if len(lines) < limit:
                break
        else:
            raise LifecycleRefusal("configured production names snapshot exceeded bound")
        if matches > 1:
            raise LifecycleRefusal("configured production identity was ambiguous")
        return ProductionSnapshot(
            identity_sha256=hashlib.sha256(self.production_name.encode()).hexdigest(),
            workspace_sha256=hashlib.sha256(
                self.production_workspace.encode()).hexdigest(),
            state="present" if matches == 1 else "absent",
        )

    def _product_proxy(self) -> tuple[Path, Path]:
        root = self.scope.evidence.path.parent
        proxy = root / "openshell-product-proxy.py"
        transcript = root / "product-transcript.txt"
        transcript.touch(mode=0o600, exist_ok=False)
        target = self.scope.identity.target
        gateway = self.scope.gateway_id
        workspace = self.scope.identity.workspace
        allowed_get = repr(("-g", gateway, "--workspace", workspace,
                            "sandbox", "get", target, "--output", "json"))
        allowed_delete = repr(("-g", gateway, "--workspace", workspace,
                               "sandbox", "delete", target))
        code = "\n".join([
            "#!" + self.python,
            "import os",
            "from pathlib import Path",
            "import sys",
            f"allowed = {{{allowed_get}: 'get-target', {allowed_delete}: 'delete-target'}}",
            "event = allowed.get(tuple(sys.argv[1:]))",
            "if event is None: raise SystemExit(64)",
            f"transcript = Path({str(transcript)!r})",
            "with transcript.open('a', encoding='utf-8') as stream: stream.write(event + '\\n')",
            f"os.execv({self.openshell!r}, [{self.openshell!r}, *sys.argv[1:]])",
            "",
        ])
        proxy.write_text(code)
        os.chmod(proxy, 0o700)
        return proxy, transcript

    def product_destroy(self, config_path: Path) -> None:
        proxy, product_transcript = self._product_proxy()
        result = self._run(
            [self.python, str(REPO / "bin" / "prime-claw"),
             "--config", str(config_path), "destroy", "--yes"],
            argv_class="product-destroy-target",
            resource=self.scope.identity.target, mutating=True, timeout=240,
            openshell_bin=str(proxy))
        events = product_transcript.read_text().splitlines()
        if events != ["get-target", "delete-target"]:
            raise LifecycleRefusal("product destroy internal transcript was refused")
        self.transcript.extend([
            {"argv_class": "product-get-target", "resource": self.scope.identity.target,
             "mutating": False},
            {"argv_class": "product-delete-target", "resource": self.scope.identity.target,
             "mutating": True},
        ])
        if not self._ok(result):
            raise LifecycleRefusal("product destroy command failed")
        expected = f"destroy: deleted sandbox {self.scope.identity.target}"
        if expected not in (result.stdout or "").splitlines():
            raise LifecycleRefusal("product destroy success transcript was malformed")

    def audit_mutations(self, *, require_mutation: bool = True) -> None:
        allowed = {
            self.scope.identity.workspace, self.scope.identity.image,
            self.scope.identity.target, self.scope.identity.sentinel,
        }
        approved_classes = {
            "create-workspace", "create-image", "create-target", "create-sentinel",
            "product-destroy-target", "product-delete-target",
            "delete-target", "delete-sentinel", "delete-workspace", "delete-image",
        }
        mutations = [event for event in self.transcript if event["mutating"]]
        resource_identities = [event.get("resource") for event in mutations]
        if ((require_mutation and not mutations)
                or any(not isinstance(identity, str)
                       or identity not in allowed
                       for identity in resource_identities)
                or any(event.get("argv_class") not in approved_classes
                       for event in mutations)):
            raise LifecycleRefusal("mutating transcript escaped generated test scope")
        forbidden_identities = {self.production_name, "default"}
        if forbidden_identities.intersection(resource_identities):
            raise LifecycleRefusal("mutating transcript contains a forbidden identity")

    def write_failure_summary(
            self, before: ProductionSnapshot, after: ProductionSnapshot | None,
            *, primary_failed: bool, cleanup_failed: bool,
            snapshot_failed: bool) -> Path:
        """Retain only sanitized configured-production hashes on failure."""
        summary = {
            "schema": 1,
            "run_id": self.scope.identity.run_id,
            "production_before_sha256": before.canonical_sha256,
            "production_after_sha256": (
                after.canonical_sha256 if after is not None else None),
            "production_unchanged": after is not None and before == after,
            "primary_failed": primary_failed,
            "cleanup_failed": cleanup_failed,
            "snapshot_failed": snapshot_failed,
            "status": "failed",
        }
        path = self.scope.evidence.path.parent / "failure.json"
        path.write_text(json.dumps(summary, sort_keys=True, indent=2) + "\n")
        os.chmod(path, 0o600)
        return path

    def write_summary(self, before: ProductionSnapshot,
                      after: ProductionSnapshot) -> Path:
        summary = {
            "schema": 1,
            "run_id": self.scope.identity.run_id,
            "gateway_id": self.scope.gateway_id,
            "workspace": self.scope.identity.workspace,
            "target": self.scope.identity.target,
            "sentinel": self.scope.identity.sentinel,
            "image": self.scope.identity.image,
            "production_before_sha256": before.canonical_sha256,
            "production_after_sha256": after.canonical_sha256,
            "production_unchanged": before == after,
            "target_absent": True,
            "sentinel_preserved_until_finalizer": True,
            "owned_resources_absent": self.scope.owned_slots == (),
            "mutation_classes": [event["argv_class"] for event in self.transcript
                                 if event["mutating"]],
            "status": "passed",
        }
        path = self.scope.evidence.path.parent / "summary.json"
        path.write_text(json.dumps(summary, sort_keys=True, indent=2) + "\n")
        os.chmod(path, 0o600)
        return path


def run_recorded_cleanup(
        *, run_id: str, image_iid: str, expected_production_sha256: str,
        evidence_dir: Path) -> Path:
    """Perform one fail-closed cleanup of an evidence-captured failed run.

    The caller supplies the immutable run and image identities from retained
    evidence. The routine performs all exact ownership reads before its first
    mutation, requires the known policy through ``policy_semantic_sha256``,
    deletes in the Slice-6 target/workspace/image order, and proves absence.
    """
    if not re.fullmatch(r"[0-9a-f]{32}", run_id):
        raise LifecycleRefusal("recorded cleanup run identity is malformed")
    if not re.fullmatch(r"sha256:[0-9a-f]{64}", image_iid):
        raise LifecycleRefusal("recorded cleanup image iid is malformed")
    if not re.fullmatch(r"[0-9a-f]{64}", expected_production_sha256):
        raise LifecycleRefusal("recorded production snapshot identity is malformed")
    evidence_dir = evidence_dir.resolve()
    if evidence_dir.exists():
        raise LifecycleRefusal("recorded cleanup evidence destination already exists")
    evidence_dir.mkdir(mode=0o700, parents=True)

    runtime = json.loads((REPO / "config" / "runtime.json").read_text())
    gateway = runtime.get("gateway")
    if (not isinstance(gateway, dict)
            or not isinstance(gateway.get("name"), str)
            or not isinstance(runtime.get("sandbox_name"), str)):
        raise LifecycleRefusal("tracked configured production identity is malformed")
    scope = LifecycleScope.generate(
        evidence_dir=evidence_dir,
        gateway_id=gateway["name"],
        policy_sha256=policy_sha256(REPO / "policies" / "test-lifecycle.yaml"),
        run_id=run_id,
        forbidden_identities={"default", runtime["sandbox_name"]},
        deadline_seconds=900,
    )
    control = LiveControlPlane(
        scope=scope,
        policy_path=REPO / "policies" / "test-lifecycle.yaml",
        dockerfile=REPO / "docker" / "test-lifecycle.Dockerfile",
        production_name=runtime["sandbox_name"],
        production_workspace=runtime.get("workspace", ""),
    )
    before: ProductionSnapshot | None = None
    try:
        scope.require_compatible(control)
        before = control.production_snapshot()
        if before.canonical_sha256 != expected_production_sha256:
            raise LifecycleRefusal(
                "configured production snapshot differs from retained evidence"
            )
        control.bind_existing_image_iid(image_iid)

        inspections: dict[str, Inspection] = {}
        for slot in ("target", "sentinel", "workspace", "image"):
            current = scope.inspect_exact(
                control, slot, f"cleanup-inspect-{slot}"
            )
            if current.state not in ("present", "absent"):
                raise LifecycleRefusal(f"recorded {slot} state is ambiguous")
            inspections[slot] = current

        if inspections["sentinel"].state != "absent":
            raise LifecycleRefusal("uncaptured recorded sentinel unexpectedly exists")
        for slot in ("target", "workspace", "image"):
            if inspections[slot].state == "present":
                scope.capture_owned(inspections[slot])

        scope.teardown(control)

        final_states: dict[str, str] = {}
        for slot in ("target", "sentinel", "workspace", "image"):
            current = scope.inspect_exact(
                control, slot, f"cleanup-verify-absent-{slot}"
            )
            final_states[slot] = current.state
            if current.state != "absent":
                raise LifecycleRefusal(
                    f"recorded {slot} absence could not be positively verified"
                )

        after = control.production_snapshot()
        require_unchanged_production(before, after)
        if after.canonical_sha256 != expected_production_sha256:
            raise LifecycleRefusal(
                "configured production snapshot no longer matches retained evidence"
            )
        control.audit_mutations(require_mutation=False)
        summary = {
            "schema": 1,
            "status": "passed",
            "cleanup_mode": "exact-recorded-run",
            "run_id": run_id,
            "workspace": scope.identity.workspace,
            "target": scope.identity.target,
            "sentinel": scope.identity.sentinel,
            "image": scope.identity.image,
            "image_iid": image_iid,
            "policy_sha256": scope.policy_sha256,
            "production_before_sha256": before.canonical_sha256,
            "production_after_sha256": after.canonical_sha256,
            "production_unchanged": True,
            "final_states": final_states,
            "mutation_classes": [
                event["argv_class"] for event in control.transcript
                if event["mutating"]
            ],
        }
        path = evidence_dir / "cleanup-summary.json"
        path.write_text(json.dumps(summary, sort_keys=True, indent=2) + "\n")
        os.chmod(path, 0o600)
        return path
    except BaseException:
        failure = {
            "schema": 1,
            "status": "failed",
            "cleanup_mode": "exact-recorded-run",
            "run_id": run_id,
            "image_iid": image_iid,
            "policy_sha256": scope.policy_sha256,
            "production_before_sha256": (
                before.canonical_sha256 if before is not None else None
            ),
            "expected_production_sha256": expected_production_sha256,
            "mutation_classes": [
                event["argv_class"] for event in control.transcript
                if event["mutating"]
            ],
        }
        path = evidence_dir / "cleanup-failure.json"
        path.write_text(json.dumps(failure, sort_keys=True, indent=2) + "\n")
        os.chmod(path, 0o600)
        raise


def run_live_acceptance(scope: LifecycleScope) -> Path:
    """Run the one explicit target/sentinel acceptance and always finalize owned scope."""
    runtime = json.loads((REPO / "config" / "runtime.json").read_text())
    gateway = runtime.get("gateway")
    if (not isinstance(gateway, dict)
            or gateway.get("name") != scope.gateway_id
            or not isinstance(runtime.get("sandbox_name"), str)):
        raise LifecycleRefusal("tracked configured production identity is malformed")
    control = LiveControlPlane(
        scope=scope,
        policy_path=REPO / "policies" / "test-lifecycle.yaml",
        dockerfile=REPO / "docker" / "test-lifecycle.Dockerfile",
        production_name=runtime["sandbox_name"],
        production_workspace=runtime.get("workspace", ""),
    )
    before = control.production_snapshot()
    primary: BaseException | None = None
    try:
        scope.preflight(control)
        for slot in ("workspace", "image", "target", "sentinel"):
            scope.create_owned(control, slot)
        scope.assert_empty_providers(control, "target")
        scope.assert_empty_providers(control, "sentinel")
        config_path = scope.evidence.path.parent / "runtime.json"
        config_path.write_text(
            json.dumps(scope.generated_product_config(), sort_keys=True, indent=2) + "\n")
        os.chmod(config_path, 0o600)
        control.product_destroy(config_path)
        scope.verify_product_destroy(control)
        scope.assert_empty_providers(control, "sentinel")
    except BaseException as exc:
        primary = exc
    cleanup: BaseException | None = None
    try:
        scope.teardown(control)
    except BaseException as exc:
        cleanup = exc
    snapshot_error: BaseException | None = None
    after: ProductionSnapshot | None = None
    try:
        after = control.production_snapshot()
        require_unchanged_production(before, after)
    except BaseException as exc:
        snapshot_error = exc
    if primary is not None or cleanup is not None or snapshot_error is not None or after is None:
        control.write_failure_summary(
            before, after,
            primary_failed=primary is not None,
            cleanup_failed=cleanup is not None,
            snapshot_failed=snapshot_error is not None or after is None,
        )
        message = (
            "lifecycle acceptance failed "
            f"(primary={primary is not None}, cleanup={cleanup is not None}, "
            f"snapshot={snapshot_error is not None or after is None})"
        )
        raise LifecycleRefusal(message) from (primary or cleanup or snapshot_error)
    control.audit_mutations()
    return control.write_summary(before, after)
