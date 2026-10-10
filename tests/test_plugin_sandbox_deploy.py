"""Host-safe preflight tests. No sandbox upload or apply is called."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "plugin_sandbox_deploy", ROOT / "scripts/deploy-prime-agent-plugin-sandbox.py")
DEPLOY = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(DEPLOY)


def fixture():
    sandbox_id = "d692aa3e-86cf-4c7f-a461-71bed3b934b1"
    image_id = "sha256:" + "a" * 64
    volume = "isolated-working-volume"
    args = argparse.Namespace(sandbox="prime-claw-v2r1013", sandbox_id=sandbox_id,
                              image_id=image_id, volume=volume)
    cfg = {"sandbox_name": args.sandbox, "image": "prime-claw-brain:pa098-ts-v2root-test",
           "gateway": {"name": "accepted-gateway"}, "workspace": "accepted-workspace"}
    record = {"id": sandbox_id, "phase": "Ready", "policy": {"filesystem_policy": {
        "read_only": ["/opt/prime-agent"], "read_write": ["/sandbox"]}}}
    args.policy_sha256 = hashlib.sha256(json.dumps(
        record["policy"], sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    docker = {"Image": image_id, "State": {"Running": True},
              "Config": {"Image": image_id, "Labels": {
                  "openshell.ai/sandbox-id": sandbox_id,
                  "openshell.ai/sandbox-name": args.sandbox}},
              "Mounts": ([{"Name": volume, "Destination": dest, "Type": "volume", "RW": True}
                          for dest in sorted(DEPLOY.DESTINATIONS)] +
                         [{"Destination": dest, "Type": "bind", "RW": False}
                          for dest in sorted(DEPLOY.OPEN_SHELL_BIND_DESTINATIONS)])}
    calls = []

    def run(argv, timeout):
        calls.append(argv)
        if argv[:2] == ["docker", "ps"]:
            return 0, "container-id\n"
        if argv[:2] == ["docker", "inspect"]:
            return 0, json.dumps([docker])
        if argv[:3] == ["docker", "image", "inspect"]:
            return 0, image_id + "\n"
        if argv[0] == "openshell":
            assert argv[1:5] == ["-g", "accepted-gateway", "--workspace", "accepted-workspace"]
            return (0, "source_identity=cwd-fix-v0.9.8-r1" if "source-gate" in argv[-1]
                    else "PLUGIN_HOME_READY")
        raise AssertionError("unexpected or mutating call: " + str(argv))

    runtime = {"probe_sandbox": lambda _cfg: (True, "Ready", record),
               "run": run, "OPENSHELL": "openshell",
               "openshell_scope": lambda _cfg: ["-g", "accepted-gateway", "--workspace", "accepted-workspace"],
               "_prime_agent_source_gate_script": lambda: "source-gate",
               "PRIME_AGENT_SOURCE_TAG": "cwd-fix-v0.9.8-r1"}
    return runtime, cfg, args, record, docker, calls


def test_bundle_is_deterministic_and_contains_only_plugin_assets():
    first, names = DEPLOY.bundle_bytes()
    second, same_names = DEPLOY.bundle_bytes()
    assert hashlib.sha256(first).digest() == hashlib.sha256(second).digest()
    assert names == same_names
    assert all(n.startswith(("src/prime-agent-plugin/", "scripts/")) for n in names)
    assert "src/prime-agent-plugin/role-protocol.json" in names


def test_preflight_requires_exact_ready_image_policy_volume_and_source():
    runtime, cfg, args, record, docker, calls = fixture()
    DEPLOY.preflight(runtime, cfg, args)
    assert len(calls) == 5
    for altered in (
        lambda: record.update(phase="Error"),
        lambda: docker.update(Image="sha256:wrong"),
        lambda: docker["Mounts"][0].update(Name="old-volume"),
        lambda: record["policy"]["filesystem_policy"].update(read_only=[]),
        lambda: record["policy"].update(network_policies={"new-egress": "not accepted"}),
    ):
        runtime, cfg, args, record, docker, calls = fixture()
        altered()
        with pytest.raises(ValueError):
            DEPLOY.preflight(runtime, cfg, args)
        assert not any("upload" in word for command in calls for word in command)


def test_scoped_exec_ignores_ambient_gateway_and_workspace(monkeypatch):
    runtime, cfg, _, _, _, calls = fixture()
    monkeypatch.setenv("OPENSHELL_GATEWAY", "wrong-gateway")
    monkeypatch.setenv("OPENSHELL_WORKSPACE", "wrong-workspace")
    code, out = DEPLOY.scoped_exec(runtime, cfg, "echo PLUGIN_HOME_READY", timeout=15)
    assert code == 0 and "PLUGIN_HOME_READY" in out
    assert calls[-1][:5] == ["openshell", "-g", "accepted-gateway",
                              "--workspace", "accepted-workspace"]
    assert calls[-1][5:9] == ["sandbox", "exec", "-n", cfg["sandbox_name"]]
