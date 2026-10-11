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
    (agent / "AGENTS.md").write_text("operator context\n")
    original_context = (agent / "AGENTS.md").read_bytes()
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
    checked = run([sys.executable, "-c", deploy.EXTRACT_AND_RUN,
                   str(bundle), digest, "check", ",".join(names)])
    assert checked.returncode == 0, checked.stderr[-500:]
    assert (ROOT / ".agents/skills/github/SKILL.md").read_bytes() == original
    assert (ROOT / ".agents/skills/goals-and-heartbeats/SKILL.md").read_bytes() == (SOURCE / "skills/goals-and-heartbeats/SKILL.md").read_bytes()
    assert not (agent / ".agents").exists()
    state = json.loads((agent / ".prime-claw/role-protocol-state.json").read_text())
    assert state["schemaVersion"] == 2 and state["selectedContext"] == "AGENTS.md"
    assert (agent / "AGENTS.md").read_bytes().startswith(original_context)
    before = (agent / "AGENTS.md").read_bytes()
    second = run([APPLY, "--sandbox-home"])
    assert second.returncode == 0, second.stderr[-500:]
    assert (agent / "AGENTS.md").read_bytes() == before
    assert run([CHECK, "--sandbox-home"]).returncode == 0
    assert run([APPLY, "--sandbox-home"], home="/root").returncode != 0
    assert run([CHECK, "--sandbox-home"], extra={"PRIME_AGENT_PLUGIN_ROOT": str(agent)}).returncode != 0
    (ROOT / ".prime").unlink()
    (ROOT / ".prime").symlink_to("/tmp/escaped-prime", target_is_directory=True)
    assert run([APPLY, "--sandbox-home"]).returncode != 0
    (ROOT / ".prime").unlink()
    (ROOT / ".prime").symlink_to("home-root/.prime", target_is_directory=True)
    assert run([CHECK, "--sandbox-home"]).returncode == 0
    print(json.dumps({"ok": True, "case": "sandbox-home-fresh-final"}))


if __name__ == "__main__":
    main()
