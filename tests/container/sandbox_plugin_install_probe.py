#!/usr/bin/env python3
"""Docker-only exact sandbox-home plugin install and fresh-final ownership probe."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path("/sandbox")
APPLY = "/workspace/scripts/apply-prime-agent-plugin.sh"
CHECK = "/workspace/scripts/check-prime-agent-plugin.sh"
SOURCE = Path("/workspace/src/prime-agent-plugin")


def run(command, *, home="/sandbox", extra=None):
    env = dict(os.environ, HOME=home)
    env.pop("PRIME_AGENT_PLUGIN_ROOT", None)
    if extra:
        env.update(extra)
    return subprocess.run(command, env=env, capture_output=True, text=True, timeout=120)


def main():
    # A dedicated ephemeral Tier-1 container owns this exact test path. Never
    # replace a pre-existing /sandbox from the base image or another fixture.
    if ROOT.exists() or ROOT.is_symlink():
        raise AssertionError("unexpected /sandbox fixture collision")
    (ROOT / "home-root/.prime/agent").mkdir(parents=True)
    (ROOT / ".agents/skills/github").mkdir(parents=True)
    (ROOT / ".agents/skills/github/SKILL.md").write_text("pre-existing image skill\n")
    (ROOT / ".prime").symlink_to("home-root/.prime", target_is_directory=True)
    agent = ROOT / ".prime/agent"
    original = (ROOT / ".agents/skills/github/SKILL.md").read_bytes()
    spec = importlib.util.spec_from_file_location(
        "plugin_deploy_fixture", "/workspace/scripts/deploy-prime-agent-plugin-sandbox.py")
    deploy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(deploy)
    archive, names = deploy.bundle_bytes()
    bundle = Path("/tmp/plugin-test-bundle.tar.gz")
    bundle.write_bytes(archive)
    digest = hashlib.sha256(archive).hexdigest()
    fresh = run([sys.executable, "-c", deploy.EXTRACT_AND_RUN,
                 str(bundle), digest, "apply", ",".join(names)])
    assert fresh.returncode == 0, fresh.stderr[-500:]
    receipts = list((ROOT / "home-root/.prime-claw/plugin-role-receipts").glob("role-*.json"))
    assert len(receipts) == 1 and (receipts[0].stat().st_mode & 0o777) == 0o600
    checked = run([sys.executable, "-c", deploy.EXTRACT_AND_RUN,
                   str(bundle), digest, "check", ",".join(names)])
    assert checked.returncode == 0, checked.stderr[-500:]
    assert (ROOT / ".agents/skills/github/SKILL.md").read_bytes() == original
    assert (ROOT / ".agents/skills/goals-and-heartbeats/SKILL.md").read_bytes() == (SOURCE / "skills/goals-and-heartbeats/SKILL.md").read_bytes()
    assert not (agent / ".agents").exists()
    manifest = json.loads((agent / ".prime-claw/role-protocol-state.json").read_text())
    assert manifest["generation"] == "final" and (agent / "AGENTS.md").is_file()
    assert not (agent / "APPEND_SYSTEM.md").exists()
    second = run([APPLY, "--sandbox-home"])
    assert second.returncode == 0, second.stderr[-500:]
    assert run([CHECK, "--sandbox-home"]).returncode == 0
    assert run([APPLY, "--sandbox-home"], home="/root").returncode != 0
    assert run([CHECK, "--sandbox-home"], extra={"PRIME_AGENT_PLUGIN_ROOT": str(agent)}).returncode != 0
    # A wrong link cannot be used to install into an unrelated root.
    (ROOT / ".prime").unlink()
    (ROOT / ".prime").symlink_to("/tmp/escaped-prime", target_is_directory=True)
    assert run([APPLY, "--sandbox-home"]).returncode != 0
    (ROOT / ".prime").unlink()
    (ROOT / ".prime").symlink_to("home-root/.prime", target_is_directory=True)
    assert run([CHECK, "--sandbox-home"]).returncode == 0
    # A forged receipt cannot erase a live role. The genuine receipt restores
    # only the three known role preimages, then a new fresh apply is possible.
    before_context = (agent / "AGENTS.md").read_bytes()
    before_manifest = (agent / ".prime-claw/role-protocol-state.json").read_bytes()
    tampered = Path("/tmp/tampered-fresh-final-receipt.json")
    value = json.loads(receipts[0].read_text())
    value["destinationRealpath"] = "/tmp/other-agent-root"
    tampered.write_text(json.dumps(value))
    tampered.chmod(0o600)
    manager = "/workspace/scripts/manage-prime-agent-role-protocol.py"
    bad_restore = run([sys.executable, manager, "restore", str(tampered), str(agent)])
    assert bad_restore.returncode != 0
    assert (agent / "AGENTS.md").read_bytes() == before_context
    assert (agent / ".prime-claw/role-protocol-state.json").read_bytes() == before_manifest
    restored = run([sys.executable, manager, "restore", str(receipts[0]), str(agent)])
    assert restored.returncode == 0, restored.stderr[-500:]
    assert not (agent / "AGENTS.md").exists()
    assert not (agent / ".prime-claw/role-protocol-state.json").exists()
    assert not (agent / "APPEND_SYSTEM.md").exists()
    assert run([APPLY, "--sandbox-home"]).returncode == 0
    assert run([CHECK, "--sandbox-home"]).returncode == 0
    print(json.dumps({"ok": True, "case": "sandbox-home-fresh-final"}))


if __name__ == "__main__":
    main()
