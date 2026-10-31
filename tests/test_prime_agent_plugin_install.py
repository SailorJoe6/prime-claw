"""Regression coverage for inert plugin source and explicit safe target selection.

Tier policy: the layout test is tier 0. Everything that runs the
apply/check/manager install scripts is tier 1 and executes INSIDE the
session's tier-1 container (Linux — the scripts' real target platform)
via the `tier1_container` fixture (auto-marked `container`; see
tests/conftest.py). Host fixtures are mirrored to container-native `/tmp`
before script execution so Linux inode/uid semantics remain authoritative.
Two choreography-heavy scenarios (SIGTERM-orphan reconciliation and
concurrent-apply serialization) run as self-verifying in-container runners
(tests/container/) because their pipe/pass_fds/flock choreography cannot
cross a docker exec boundary; both runners operate on container-local
/tmp paths and print a JSON verdict.
"""

import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import time

import pytest


REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "src" / "prime-agent-plugin"
# Container paths (repo bind-mounted read-only at /workspace).
WS_APPLY = "/workspace/scripts/apply-prime-agent-plugin.sh"
WS_CHECK = "/workspace/scripts/check-prime-agent-plugin.sh"
# The image's default PATH (Ubuntu base); tests that shadow a tool prepend
# their fake bin dir to this.
CONTAINER_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
INVENTORY = json.loads((SOURCE / "asset-inventory.json").read_text())

def _targets(kind):
    return tuple(
        target["destination"]
        for asset in INVENTORY["assets"]
        for target in asset["targets"]
        if target["class"] == kind
    )

def _current_target_keys():
    prefixes = {"plugin-root-exact":"plugin-root", "plugin-root-managed":"plugin-root", "user-skill-exact":"user-skill"}
    return tuple(f"{prefixes[target['class']]}:{target['destination']}" for asset in INVENTORY["assets"] for target in asset["targets"] if target["class"] in prefixes)


EXACT_FILES = _targets("plugin-root-exact")
MANAGED_FILES = _targets("plugin-root-managed")
FILES = EXACT_FILES
SKILL_FILES = tuple(path for path in MANAGED_FILES if path.endswith("/SKILL.md"))
MANAGED_SKILL_FILES = MANAGED_FILES


def test_source_is_outside_project_extension_discovery() -> None:
    assert (SOURCE / "extensions").is_dir()
    assert not (REPO / ".prime" / "agent" / "extensions").exists()
    assert not (REPO / ".prime" / "agent" / "extensions-bak").exists()
    assert not (REPO / ".prime" / "agent" / "extension-support").exists()
    assert {str(path.relative_to(SOURCE)) for path in SOURCE.rglob("*.ts")} == {item for item in EXACT_FILES if item.endswith(".ts")}
    inventoried = {asset["source"] for asset in INVENTORY["assets"]}
    shipped = {str(path.relative_to(SOURCE)) for path in SOURCE.rglob("*") if path.is_file()}
    assert inventoried == shipped
    assert len(inventoried) == len(INVENTORY["assets"])


def test_sandbox_home_installs_fresh_final_plugin_in_exact_container_root(tier1_container) -> None:
    result = tier1_container.run(
        "python3", "/workspace/tests/container/sandbox_plugin_install_probe.py",
        workdir=None, timeout=240,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout.strip().splitlines()[-1]) == {
        "ok": True, "case": "sandbox-home-fresh-final",
    }


def _run_script(
    tier1_container, script: str, destination: Path, *, env=None,
    script_args=(),
):
    """Run an install script on native Linux storage, mirroring test state.

    Docker Desktop bind mounts can asynchronously remap inode and uid metadata
    and cannot represent all case-distinct candidate names. Mirror the fixture
    before and after the invocation so identity checks run on native storage
    while host assertions still inspect the resulting bytes and metadata.
    """
    key = hashlib.sha256(str(destination).encode()).hexdigest()[:20]
    native = f"/tmp/prime-claw-plugin-install/{key}"
    staged = tier1_container.run(
        "bash", "-lc",
        'set -euo pipefail; rm -rf -- "$1"; mkdir -p -- "$(dirname "$1")"; '
        'if [[ -e "$2" || -L "$2" ]]; then cp -a -- "$2" "$1"; fi',
        "plugin-stage", native, str(destination),
        workdir=None,
        timeout=60,
    )
    assert staged.returncode == 0, staged.stdout + staged.stderr
    script_env = {
        "PRIME_AGENT_PLUGIN_ROOT": native,
    }
    if env is not None:
        script_env.update(env)
    result = tier1_container.run(
        script, *script_args,
        env=script_env,
        workdir=None,
        timeout=60,
    )
    mirrored = tier1_container.run(
        "bash", "-lc",
        'set -euo pipefail; rm -rf -- "$2"; '
        'if [[ -e "$1" || -L "$1" ]]; then mkdir -p -- "$(dirname "$2")"; cp -a -- "$1" "$2"; fi; '
        'rm -rf -- "$1"',
        "plugin-mirror", native, str(destination),
        workdir=None,
        timeout=60,
    )
    assert mirrored.returncode == 0, mirrored.stdout + mirrored.stderr
    return result


def _tree_snapshot(root: Path) -> dict[str, bytes]:
    if not root.exists():
        return {}
    return {
        str(path.relative_to(root)): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def test_bare_apply_and_check_require_an_explicit_target_without_mutation(
    tier1_container, ctmp,
) -> None:
    for script in (WS_APPLY, WS_CHECK):
        home = ctmp / Path(script).stem
        destination = home / ".prime" / "agent"
        sentinel = destination / "extensions" / "reviewed-plan.ts"
        sentinel.parent.mkdir(parents=True)
        sentinel.write_bytes(b"operator generation must remain unchanged\n")
        before = _tree_snapshot(home)

        result = tier1_container.run(
            script,
            env={"HOME": str(home)},
            workdir=None,
            timeout=60,
        )

        assert result.returncode != 0
        assert "explicit PRIME_AGENT_PLUGIN_ROOT or --user-global required" in result.stderr
        assert _tree_snapshot(home) == before


def _create_primary_fixture(tier1_container, base: str):
    """Create a real primary-main fixture without using /workspace Git metadata.

    A validation checkout may itself be a host linked worktree whose .git file
    points outside the read-only Docker mount. Copy only the install surface,
    then initialize fresh container-local Git metadata so the tests exercise
    primary-vs-linked semantics rather than host mount topology.
    """
    return tier1_container.run(
        "bash", "-lc",
        "set -euo pipefail; "
        'mkdir -p "$1/primary"; '
        'cp -a /workspace/scripts "$1/primary/"; '
        'cp -a /workspace/src "$1/primary/"; '
        'git -C "$1/primary" init -q -b main; '
        'git -C "$1/primary" config user.name "Tier One"; '
        'git -C "$1/primary" config user.email tier1@example.invalid; '
        'git -C "$1/primary" add .; '
        'git -C "$1/primary" commit -qm "fixture source"',
        "primary-setup", base,
        workdir=None,
        timeout=120,
    )


def test_primary_main_user_global_mode_is_deliberate_and_container_only(
    tier1_container, croot,
) -> None:
    base = f"{croot}/primary-user-global"
    setup = _create_primary_fixture(tier1_container, base)
    assert setup.returncode == 0, setup.stdout + setup.stderr
    home = f"{base}/home"
    apply = f"{base}/primary/scripts/apply-prime-agent-plugin.sh"
    check = f"{base}/primary/scripts/check-prime-agent-plugin.sh"
    redirected_user_agents = f"{base}/redirected-user-agents"
    runtime_env = {
        "HOME": home,
        "PRIME_CLAW_USER_AGENTS_ROOT": redirected_user_agents,
    }
    applied = tier1_container.run(
        apply, "--user-global", env=runtime_env, workdir=None, timeout=60,
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert "target mode: user-global" in applied.stdout
    user_skill = tier1_container.run(
        "cmp", "-s",
        f"{home}/.agents/skills/goals-and-heartbeats/SKILL.md",
        f"{base}/primary/src/prime-agent-plugin/skills/goals-and-heartbeats/SKILL.md",
        workdir=None, timeout=10,
    )
    assert user_skill.returncode == 0, user_skill.stdout + user_skill.stderr
    redirected_absent = tier1_container.run("test", "!", "-e", redirected_user_agents, workdir=None, timeout=10)
    assert redirected_absent.returncode == 0, redirected_absent.stdout + redirected_absent.stderr
    checked = tier1_container.run(
        check, "--user-global", env=runtime_env, workdir=None, timeout=60,
    )
    assert checked.returncode == 0, checked.stdout + checked.stderr


def test_linked_worktree_cannot_activate_shared_generation_and_isolated_works(
    tier1_container, croot,
) -> None:
    base = f"{croot}/incident-topology"
    setup = _create_primary_fixture(tier1_container, base)
    assert setup.returncode == 0, setup.stdout + setup.stderr
    setup = tier1_container.run(
        "bash", "-lc",
        "set -euo pipefail; "
        'git -C "$1/primary" worktree add -q -b candidate "$1/candidate"; '
        'mkdir -p "$1/candidate/.prime-claw/workflows"; '
        'printf "candidate-only skill\n" > '
        '"$1/candidate/.prime-claw/workflows/plan-prep.md"; '
        'mkdir -p "$1/shared-home/.prime/agent/extensions"; '
        'printf "sibling installed generation\n" > '
        '"$1/shared-home/.prime/agent/extensions/reviewed-plan.ts"',
        "topology-setup", base,
        workdir=None,
        timeout=120,
    )
    assert setup.returncode == 0, setup.stdout + setup.stderr

    primary_skill = tier1_container.run(
        "test", "!", "-e", f"{base}/primary/.prime-claw/workflows/plan-prep.md",
        workdir=None,
    )
    assert primary_skill.returncode == 0
    before = tier1_container.run(
        "sha256sum", f"{base}/shared-home/.prime/agent/extensions/reviewed-plan.ts",
        workdir=None,
    )
    assert before.returncode == 0

    blocked = tier1_container.run(
        f"{base}/candidate/scripts/apply-prime-agent-plugin.sh",
        "--user-global",
        env={"HOME": f"{base}/shared-home"},
        workdir=None,
        timeout=60,
    )
    assert blocked.returncode != 0
    assert "linked Git worktree" in blocked.stderr
    after = tier1_container.run(
        "sha256sum", f"{base}/shared-home/.prime/agent/extensions/reviewed-plan.ts",
        workdir=None,
    )
    assert after.returncode == 0
    assert after.stdout == before.stdout

    isolated = f"{base}/isolated-agent"
    applied = tier1_container.run(
        f"{base}/candidate/scripts/apply-prime-agent-plugin.sh",
        env={
            "PRIME_AGENT_PLUGIN_ROOT": isolated,
            },
        workdir=None,
        timeout=60,
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    checked = tier1_container.run(
        f"{base}/candidate/scripts/check-prime-agent-plugin.sh",
        env={
            "PRIME_AGENT_PLUGIN_ROOT": isolated,
            },
        workdir=None,
        timeout=60,
    )
    assert checked.returncode == 0, checked.stdout + checked.stderr
    compared = tier1_container.run(
        "cmp", "-s",
        f"{base}/candidate/src/prime-agent-plugin/extensions/reviewed-plan.ts",
        f"{isolated}/extensions/reviewed-plan.ts",
        workdir=None,
    )
    assert compared.returncode == 0


def test_apply_copies_the_complete_allowlist_and_check_accepts_it(
    tier1_container, ctmp,
) -> None:
    destination = ctmp / "agent"
    destination.mkdir(parents=True)
    (destination / "operator-notes.txt").write_text("unrelated user notes\n")
    redirected_user_agents = ctmp / "redirected-user-agents"
    applied = _run_script(
        tier1_container, WS_APPLY, destination,
        env={"PRIME_CLAW_USER_AGENTS_ROOT": str(redirected_user_agents)},
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert not redirected_user_agents.exists()
    assert "selected copy is current" in applied.stdout
    for relative in (*FILES, *MANAGED_SKILL_FILES):
        expected = tier1_container.read_repo(f"src/prime-agent-plugin/{relative}")
        assert (destination / relative).read_text() == expected, relative
    runtime_inventory = json.loads((destination / "asset-inventory.json").read_text())
    assert all((destination / row["source"]).is_file() for row in runtime_inventory["assets"])
    assert (destination / "operator-notes.txt").read_text() == "unrelated user notes\n"
    context = (destination / "AGENTS.md").read_bytes()
    kernel = (SOURCE / "ROLE_KERNEL.md").read_bytes()
    assert context == kernel
    manifest = json.loads((destination / ".prime-claw/role-protocol-state.json").read_text())
    assert manifest["schemaVersion"] == 2
    assert manifest["selectedContext"] == "AGENTS.md"
    discovered = {path.parent.name for path in (destination / "skills").glob("*/SKILL.md")}
    assert discovered == {"goals-and-heartbeats", "prime-claw-oversee-episode", "prime-claw-expert-review", "initialize-prime-claw", "implement-task", "implement-spec"}
    assert not list((destination / "skills/project-templates").rglob("SKILL.md"))
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode == 0, checked.stdout + checked.stderr



def test_apply_is_convergent_and_preserves_unrelated_files(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    unrelated = destination / "extensions" / "unrelated.ts"
    unrelated.parent.mkdir(parents=True)
    unrelated.write_bytes(b"preserve me exactly\n")
    first = _run_script(tier1_container, WS_APPLY, destination)
    assert first.returncode == 0, first.stdout + first.stderr
    snapshot = {
        relative: (destination / relative).read_bytes()
        for relative in (
            *FILES,
            *MANAGED_SKILL_FILES,
            "AGENTS.md",
            ".prime-claw/role-protocol-state.json",
            "extensions/unrelated.ts",
        )
    }
    second = _run_script(tier1_container, WS_APPLY, destination)
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert second.returncode == 0, second.stdout + second.stderr
    assert checked.returncode == 0, checked.stdout + checked.stderr
    assert {
        relative: (destination / relative).read_bytes()
        for relative in snapshot
    } == snapshot


def test_backup_reset_preflight_blocks_before_role_exact_or_user_mutation(
    tier1_container, ctmp,
) -> None:
    fixture = ctmp / "repo"
    shutil.copytree(SOURCE, fixture / "src" / "prime-agent-plugin")
    scripts = fixture / "scripts"
    scripts.mkdir(parents=True)
    for name in (
        "apply-prime-agent-plugin.sh", "check-prime-agent-plugin.sh",
        "manage-prime-agent-role-protocol.py", "manage-prime-agent-delivery.py",
        "prime-agent-plugin-target.sh",
    ):
        shutil.copy2(REPO / "scripts" / name, scripts / name)
    destination = ctmp / "backup-preflight-agent"
    applied = _run_script(
        tier1_container, str(scripts / "apply-prime-agent-plugin.sh"), destination,
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    role = destination / "AGENTS.md"
    exact = destination / "extensions/handoff-chain.ts"
    user = destination / ".agents/skills/goals-and-heartbeats/SKILL.md"
    before = {path: path.read_bytes() for path in (role, exact, user)}
    (fixture / "src/prime-agent-plugin/ROLE_KERNEL.md").write_bytes(role.read_bytes().replace(b"Prime Claw", b"Prime Claw candidate", 1))
    exact_source = fixture / "src/prime-agent-plugin/extensions/handoff-chain.ts"
    exact_source.write_text(exact_source.read_text() + "\n// candidate exact bytes\n")
    managed_source = fixture / "src/prime-agent-plugin/skills/goals-and-heartbeats/SKILL.md"
    managed_source.write_text(managed_source.read_text() + "\nCandidate user policy.\n")
    managed_destination = destination / "skills/goals-and-heartbeats/SKILL.md"
    managed_destination.write_text("operator customization\n")
    backups = destination / ".prime-claw/backups"
    if backups.exists(): shutil.rmtree(backups)
    outside = ctmp / "outside-backups"
    outside.mkdir()
    backups.symlink_to(outside, target_is_directory=True)
    refused = _run_script(
        tier1_container, str(scripts / "apply-prime-agent-plugin.sh"), destination,
        script_args=("--global-drift-action", "backup-reset"),
    )
    assert refused.returncode != 0
    assert {path: path.read_bytes() for path in before} == before
    assert managed_destination.read_text() == "operator customization\n"
    assert not list(outside.iterdir())


def test_apply_and_check_do_not_require_the_compatibility_skill(tier1_container, ctmp) -> None:
    fixture = ctmp / "repo"
    shutil.copytree(SOURCE, fixture / "src" / "prime-agent-plugin")
    scripts = fixture / "scripts"
    scripts.mkdir(parents=True)
    for name in (
        "apply-prime-agent-plugin.sh",
        "check-prime-agent-plugin.sh",
        "manage-prime-agent-role-protocol.py",
        "manage-prime-agent-delivery.py",
        "prime-agent-plugin-target.sh",
    ):
        shutil.copy2(REPO / "scripts" / name, scripts / name)
    assert not (fixture / ".ralph/skills/oversee-episode/SKILL.md").exists()
    destination = ctmp / "agent-without-skill"
    applied = _run_script(
        tier1_container, str(scripts / "apply-prime-agent-plugin.sh"), destination,
    )
    checked = _run_script(tier1_container, str(scripts / "check-prime-agent-plugin.sh"), destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert checked.returncode == 0, checked.stdout + checked.stderr


def _schema1_inventory() -> bytes:
    commits = subprocess.check_output(["git","log","--format=%H","--","src/prime-agent-plugin/asset-inventory.json"],cwd=REPO,text=True).splitlines()
    for commit in commits:
        data=subprocess.check_output(["git","show",f"{commit}:src/prime-agent-plugin/asset-inventory.json"],cwd=REPO)
        if json.loads(data)["schemaVersion"]==1: return data
    raise AssertionError("schema-1 inventory history is missing")


def _retired_bytes(relative: str, expected_sha256: str) -> bytes:
    commits = subprocess.check_output(
        ["git", "log", "--all", "--format=%H", "--", f"src/prime-agent-plugin/{relative}"], cwd=REPO, text=True,
    ).splitlines()
    for commit in commits:
        result = subprocess.run(
            ["git", "show", f"{commit}:src/prime-agent-plugin/{relative}"], cwd=REPO, capture_output=True,
        )
        if result.returncode == 0 and hashlib.sha256(result.stdout).hexdigest() == expected_sha256:
            return result.stdout
    raise AssertionError(f"recorded predecessor bytes not found: {relative}")


def _seed_schema1(destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True); (destination / "asset-inventory.json").write_bytes(_schema1_inventory())


def _remove_delivery_asset(source: Path, relative: str) -> None:
    manifest_path = source / "asset-inventory.json"
    manifest = json.loads(manifest_path.read_text())
    row = next(asset for asset in manifest["assets"] if asset["source"] == relative)
    manifest["assets"].remove(row)
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    (source / relative).unlink()


def _run_delivery(tier1_container, mode: str, source: Path, destination: Path):
    return tier1_container.run(
        "/workspace/scripts/manage-prime-agent-delivery.py", mode,
        str(source), str(destination), "--user-root", str(destination / ".agents"),
        workdir=None, timeout=60,
    )


def _copy_delivery_source(ctmp: Path) -> Path:
    source = ctmp / "source"; shutil.copytree(SOURCE, source); return source


def _installed_delivery(tier1_container, ctmp) -> tuple[Path, Path]:
    source = _copy_delivery_source(ctmp); destination = ctmp / "agent"; destination.mkdir()
    applied = _run_delivery(tier1_container, "apply", source, destination); assert applied.returncode == 0, applied.stdout + applied.stderr
    return source, destination


def test_schema1_upgrade_prunes_hash_bound_retired_files_and_check_rejects_them_first(
    tier1_container, ctmp,
) -> None:
    source = _copy_delivery_source(ctmp)
    destination = ctmp / "agent"
    _seed_schema1(destination)
    retired = json.loads((source / "asset-inventory.json").read_text())["predecessorRetiredPluginFiles"]
    for row in retired:
        path = destination / row["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(_retired_bytes(row["path"], row["sha256"]))
    assert _run_delivery(tier1_container, "check", source, destination).returncode != 0
    applied = _run_delivery(tier1_container, "apply", source, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert all(not (destination / row["path"]).exists() for row in retired)
    assert _run_delivery(tier1_container, "check", source, destination).returncode == 0
    reappeared = retired[0]
    legacy = destination / reappeared["path"]
    legacy.parent.mkdir(parents=True, exist_ok=True)
    legacy.write_bytes(_retired_bytes(reappeared["path"], reappeared["sha256"]))
    assert _run_delivery(tier1_container, "check", source, destination).returncode != 0
    assert _run_delivery(tier1_container, "apply", source, destination).returncode == 0
    assert not legacy.exists()


@pytest.mark.parametrize("unsafe_kind", ["changed", "directory", "symlink"])
def test_schema1_upgrade_refuses_changed_or_unsafe_retired_files_before_mutation(
    tier1_container, ctmp, unsafe_kind,
) -> None:
    source = _copy_delivery_source(ctmp)
    destination = ctmp / "agent"
    _seed_schema1(destination)
    row = json.loads((source / "asset-inventory.json").read_text())["predecessorRetiredPluginFiles"][0]
    path = destination / row["path"]
    path.parent.mkdir(parents=True, exist_ok=True)
    if unsafe_kind == "changed":
        path.write_text("changed operator bytes\n")
    elif unsafe_kind == "directory":
        path.mkdir()
    else:
        outside = ctmp / "outside-retired.ts"
        outside.write_text("outside bytes\n")
        path.symlink_to(outside)
    sentinel = destination / "extensions/handoff-chain.ts"
    sentinel.parent.mkdir(parents=True, exist_ok=True)
    sentinel.write_text("existing generation\n")
    refused = _run_delivery(tier1_container, "apply", source, destination)
    assert refused.returncode != 0
    assert sentinel.read_text() == "existing generation\n"
    assert path.exists() or path.is_symlink()



def test_check_rejects_exact_installed_subtree_through_symlinked_ancestor(
    tier1_container, ctmp,
) -> None:
    source, destination = _installed_delivery(tier1_container, ctmp)
    installed = destination / "extensions"
    outside = ctmp / "outside-extensions"
    installed.rename(outside)
    snapshot = {path.name: path.read_bytes() for path in outside.iterdir()}
    installed.symlink_to(outside, target_is_directory=True)
    assert _run_delivery(tier1_container, "check", source, destination).returncode != 0
    assert {path.name: path.read_bytes() for path in outside.iterdir()} == snapshot


def test_future_retirement_refuses_symlinked_unique_ancestor_before_mutation(
    tier1_container, ctmp,
) -> None:
    source, destination = _installed_delivery(tier1_container, ctmp)
    historical = b"owned historical bytes\n"
    retired = destination / "future-retired/item.txt"
    retired.parent.mkdir()
    retired.write_bytes(historical)
    state_path = destination / ".prime-claw/delivery-state.json"
    state = json.loads(state_path.read_text())
    state["ownedFiles"]["plugin-root:future-retired/item.txt"] = hashlib.sha256(historical).hexdigest()
    state_path.write_text(json.dumps(state))
    shutil.rmtree(retired.parent)
    outside = ctmp / "outside-retirement"
    outside.mkdir()
    outside_leaf = outside / "item.txt"
    outside_leaf.write_bytes(historical)
    retired.parent.symlink_to(outside, target_is_directory=True)
    exact_source = source / "extensions/handoff-chain.ts"
    exact_source.write_text(exact_source.read_text() + "\n// next generation\n")
    exact_destination = destination / "extensions/handoff-chain.ts"
    before = exact_destination.read_bytes()
    assert _run_delivery(tier1_container, "check", source, destination).returncode != 0
    assert outside_leaf.read_bytes() == historical
    refused = _run_delivery(tier1_container, "apply", source, destination)
    assert refused.returncode != 0
    assert exact_destination.read_bytes() == before
    assert outside_leaf.read_bytes() == historical


def test_delivery_state_detects_and_prunes_a_removed_owned_file(tier1_container, ctmp) -> None:
    source, destination = _installed_delivery(tier1_container, ctmp)
    retired = "extensions/handoff-chain.ts"
    assert (destination / retired).is_file()
    _remove_delivery_asset(source, retired)
    assert _run_delivery(tier1_container, "check", source, destination).returncode != 0
    applied = _run_delivery(tier1_container, "apply", source, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert not (destination / retired).exists()
    assert _run_delivery(tier1_container, "check", source, destination).returncode == 0


@pytest.mark.parametrize("unsafe_kind", ["changed", "directory", "symlink"])
def test_delivery_retirement_refuses_unproven_or_unsafe_paths_before_mutation(
    tier1_container, ctmp, unsafe_kind,
) -> None:
    source, destination = _installed_delivery(tier1_container, ctmp)
    retired = "extensions/handoff-chain.ts"
    path = destination / retired
    _remove_delivery_asset(source, retired)
    path.unlink()
    if unsafe_kind == "changed":
        path.write_text("operator bytes\n")
    elif unsafe_kind == "directory":
        path.mkdir()
    else:
        outside = ctmp / "outside.ts"
        outside.write_text("outside bytes\n")
        path.symlink_to(outside)
    sentinel = destination / EXACT_FILES[0]
    before = sentinel.read_bytes()
    refused = _run_delivery(tier1_container, "apply", source, destination)
    assert refused.returncode != 0
    assert sentinel.read_bytes() == before
    assert path.exists() or path.is_symlink()


@pytest.mark.parametrize("managed_directory", [
    "root", "extensions", "extension-support", "skills",
    "skills/goals-and-heartbeats",
    "workflows",
    "skills/prime-claw-oversee-episode",
    "skills/prime-claw-expert-review",
    "skills/initialize-prime-claw",
    "skills/implement-task",
    "skills/implement-spec",
])
def test_apply_and_check_reject_symlinked_managed_directories_before_mutation(
    tier1_container, ctmp, managed_directory,
) -> None:
    destination = ctmp / "agent"
    outside = ctmp / f"outside-{managed_directory.replace('/', '-')}"
    outside.mkdir()
    (outside / "sentinel").write_bytes(b"outside remains untouched\n")
    if managed_directory == "root":
        destination.symlink_to(outside, target_is_directory=True)
    else:
        link = destination / managed_directory
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to(outside, target_is_directory=True)
    notes = destination / "operator-notes.txt"
    notes.write_bytes(b"unrelated append remains untouched\n")

    checked = _run_script(tier1_container, WS_CHECK, destination)
    applied = _run_script(tier1_container, WS_APPLY, destination)

    assert checked.returncode != 0
    assert applied.returncode != 0
    assert "unsafe managed" in applied.stderr
    assert notes.read_bytes() == b"unrelated append remains untouched\n"
    assert (outside / "sentinel").read_bytes() == b"outside remains untouched\n"
    assert not list(outside.glob("*.ts"))
    if managed_directory == "root":
        assert destination.is_symlink()
    else:
        assert (destination / managed_directory).is_symlink()



def test_check_rejects_stale_managed_conversation_skill(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    skill = destination / SKILL_FILES[0]
    skill.write_text("stale guide\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "plugin delivery drift requires explicit resolution" in checked.stderr


def test_check_rejects_a_stale_global_file(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    stale = destination / FILES[0]
    stale.write_text("stale generation\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "plugin delivery drift requires explicit resolution" in checked.stderr


def test_final_apply_preserves_an_existing_ordinary_context(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    destination.mkdir(parents=True)
    context = destination / "AGENTS.md"
    context.write_bytes(b"operator context without final newline")
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert context.read_bytes().startswith(b"operator context without final newline")
    assert _run_script(tier1_container, WS_CHECK, destination).returncode == 0


@pytest.mark.parametrize("unsafe_kind", ["directory", "symlink"])
def test_apply_preflights_all_managed_destinations_before_mutation(
    tier1_container, ctmp, unsafe_kind,
) -> None:
    destination = ctmp / "agent"
    (destination / "extensions").mkdir(parents=True)
    (destination / "extension-support").mkdir()
    first = destination / next(path for path in FILES if path.endswith(".ts"))
    sentinel = b"existing generation remains untouched\n"
    first.write_bytes(sentinel)
    unsafe = destination / FILES[-1]
    unsafe.parent.mkdir(parents=True, exist_ok=True)
    if unsafe_kind == "directory":
        unsafe.mkdir()
    else:
        target = ctmp / "outside.ts"
        target.write_bytes(b"outside remains untouched\n")
        unsafe.symlink_to(target)
    notes = destination / "operator-notes.txt"
    notes.write_bytes(b"unrelated append remains untouched\n")

    applied = _run_script(tier1_container, WS_APPLY, destination)

    assert applied.returncode != 0
    assert "unsafe managed plugin destination" in applied.stderr
    assert first.read_bytes() == sentinel
    assert notes.read_bytes() == b"unrelated append remains untouched\n"
    if unsafe_kind == "symlink":
        assert unsafe.is_symlink()
        assert unsafe.resolve().read_bytes() == b"outside remains untouched\n"


@pytest.mark.parametrize("skill_name", ["prime-claw-expert-review", "initialize-prime-claw", "implement-task", "implement-spec"])
def test_check_rejects_stale_managed_skill(tier1_container, ctmp, skill_name) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    skill = destination / f"skills/{skill_name}/SKILL.md"
    skill.write_text(skill.read_text() + "\n# stale installed skill\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "plugin delivery drift requires explicit resolution" in checked.stderr


def test_apply_refuses_global_project_template_skill_collision_before_mutation(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    sentinel = destination / FILES[0]
    before = sentinel.read_bytes()
    collision = destination / "skills/prepare/SKILL.md"
    collision.parent.mkdir(parents=True)
    collision.write_text("operator global skill\n")
    refused = _run_script(tier1_container, WS_APPLY, destination)
    assert refused.returncode != 0
    assert "unexpected global project-template skill collision" in refused.stderr
    assert sentinel.read_bytes() == before
    assert collision.read_text() == "operator global skill\n"
