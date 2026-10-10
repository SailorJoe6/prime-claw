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
import time

import pytest


REPO = Path(__file__).resolve().parents[1]
SOURCE = REPO / "src" / "prime-agent-plugin"
# Container paths (repo bind-mounted read-only at /workspace).
WS_APPLY = "/workspace/scripts/apply-prime-agent-plugin.sh"
WS_CHECK = "/workspace/scripts/check-prime-agent-plugin.sh"
WS_ROLE_MANAGER = "/workspace/scripts/manage-prime-agent-role-protocol.py"
WS_BRIDGE_CONFIG = "/workspace/tests/fixtures/role-protocol-bridge.json"
WS_ROLE_KERNEL = "/workspace/src/prime-agent-plugin/ROLE_KERNEL.md"
WS_LEGACY_FIXTURE = "/workspace/tests/fixtures/role-protocol-legacy-append.md"
# The image's default PATH (Ubuntu base); tests that shadow a tool prepend
# their fake bin dir to this.
CONTAINER_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
RETIRED = "extensions/goal-heartbeat-work-control.ts"
FILES = (
    "extensions/goal-continuation-nudge.ts",
    "extensions/handoff-chain.ts",
    "extensions/project-initialization.ts",
    "extensions/reviewed-plan.ts",
    "asset-inventory.json",
    "ROLE_KERNEL.md",
    "extension-support/project-initialization.ts",
    "extension-support/template-review.ts",
    "extension-support/episode-ownership.ts",
    "extension-support/conversation-oversight.ts",
    "extension-support/episode-close.ts",
    "skills/goals-and-heartbeats/SKILL.md",
    "skills/goals-and-heartbeats/CONTINUATION.md",
    "skills/project-templates/blocked.md",
    "skills/project-templates/design.md",
    "skills/project-templates/execute.md",
    "skills/project-templates/prepare.md",
    "skills/project-templates/spec-it-out.md",
    "workflows/handoff.md",
    "workflows/implement-prep.md",
    "workflows/implement-spec.md",
    "workflows/plan-prep.md",
    "workflows/plan-spec.md",
    "extension-support/handoff-prompts.ts",
    "extension-support/prep-chain.ts",
    "extension-support/reviewed-plan-support.ts",
    "extension-support/spec-episode.ts",
)
SKILL_FILES = (
    "skills/goals-and-heartbeats/SKILL.md",
    "skills/prime-claw-oversee-episode/SKILL.md",
    "skills/prime-claw-expert-review/SKILL.md",
)
MANAGED_SKILL_FILES = SKILL_FILES
RETIRED_EXPERT_FILES = (
    "SKILL.md",
    "pyproject.toml",
    "src/prime_claw_official_expert_review/__init__.py",
    "src/prime_claw_official_expert_review/reviewer.md",
)


def test_source_is_outside_project_extension_discovery() -> None:
    assert (SOURCE / "extensions").is_dir()
    assert not (REPO / ".prime" / "agent" / "extensions").exists()
    assert not (REPO / ".prime" / "agent" / "extensions-bak").exists()
    assert not (REPO / ".prime" / "agent" / "extension-support").exists()
    assert not (SOURCE / RETIRED).exists()
    assert {str(path.relative_to(SOURCE)) for path in SOURCE.rglob("*.ts")} == {item for item in FILES if item.endswith(".ts")}
    assert {str(path.relative_to(SOURCE)) for path in SOURCE.rglob("SKILL.md")} == set(SKILL_FILES)


def _run_script(
    tier1_container, script: str, destination: Path, *, env=None, seed_bridge=False
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
    if seed_bridge:
        seeded = tier1_container.run(
            "python3", WS_ROLE_MANAGER, "apply", WS_BRIDGE_CONFIG,
            WS_ROLE_KERNEL, WS_LEGACY_FIXTURE, native,
            workdir=None, timeout=60,
        )
        assert seeded.returncode == 0, seeded.stdout + seeded.stderr
    script_env = {
        "PRIME_AGENT_PLUGIN_ROOT": native,
    }
    if env is not None:
        script_env.update(env)
    result = tier1_container.run(
        script,
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
    runtime_env = {
        "HOME": home,
    }
    seeded = tier1_container.run(
        "python3", WS_ROLE_MANAGER, "apply", WS_BRIDGE_CONFIG,
        WS_ROLE_KERNEL, WS_LEGACY_FIXTURE, f"{home}/.prime/agent",
        workdir=None, timeout=60,
    )
    assert seeded.returncode == 0, seeded.stdout + seeded.stderr
    old_skill = f"{home}/.prime/agent/skills/prime-claw-official-expert-review"
    old_state = f"{home}/.prime/agent/prime-claw-private/expert-review-launches"
    seed_code = (
        "import pathlib; root=pathlib.Path(" + repr(old_skill) + "); files=" + repr(RETIRED_EXPERT_FILES) + "; "
        "[(root/rel).parent.mkdir(parents=True,exist_ok=True) or (root/rel).write_text(rel) for rel in files]; "
        "state=pathlib.Path(" + repr(old_state) + "); state.mkdir(parents=True); (state/'old.closed.json').write_text('{}')"
    )
    seed_retired = tier1_container.run("python3", "-c", seed_code, workdir=None)
    assert seed_retired.returncode == 0, seed_retired.stderr
    applied = tier1_container.run(
        apply, "--user-global", env=runtime_env, workdir=None, timeout=60,
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert "target mode: user-global" in applied.stdout
    absent = tier1_container.run("test", "!", "-e", old_skill, workdir=None, wrap=False)
    assert absent.returncode == 0, absent.stderr
    state_absent = tier1_container.run("test", "!", "-e", old_state, workdir=None, wrap=False)
    assert state_absent.returncode == 0, state_absent.stderr
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
    seeded = tier1_container.run(
        "python3", WS_ROLE_MANAGER, "apply", WS_BRIDGE_CONFIG,
        WS_ROLE_KERNEL, WS_LEGACY_FIXTURE, isolated,
        workdir=None, timeout=60,
    )
    assert seeded.returncode == 0, seeded.stdout + seeded.stderr
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
    (destination / "APPEND_SYSTEM.md").write_text("unrelated user append\n")
    applied = _run_script(tier1_container, WS_APPLY, destination, seed_bridge=True)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert "selected copy is current" in applied.stdout
    for relative in (*FILES, *MANAGED_SKILL_FILES):
        expected = tier1_container.read_repo(f"src/prime-agent-plugin/{relative}")
        assert (destination / relative).read_text() == expected, relative
    runtime_inventory = json.loads((destination / "asset-inventory.json").read_text())
    assert all((destination / row["source"]).is_file() for row in runtime_inventory["assets"])
    append = (destination / "APPEND_SYSTEM.md").read_text()
    assert append == "unrelated user append\n"
    assert "PRIME_CLAW_CONVERSATION_IDENTITY_V1" not in append
    context = (destination / "AGENTS.md").read_bytes()
    kernel = (SOURCE / "ROLE_KERNEL.md").read_bytes()
    assert context == kernel
    manifest = json.loads((destination / ".prime-claw/role-protocol-state.json").read_text())
    assert manifest["generation"] == "final"
    assert manifest["selectedContext"]["path"] == "AGENTS.md"
    discovered = {path.parent.name for path in (destination / "skills").glob("*/SKILL.md")}
    assert discovered == {"goals-and-heartbeats", "prime-claw-oversee-episode", "prime-claw-expert-review"}
    assert not list((destination / "skills/project-templates").rglob("SKILL.md"))
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode == 0, checked.stdout + checked.stderr



def test_apply_can_write_an_external_role_receipt_for_cutover_recovery(tier1_container) -> None:
    base = f"/tmp/prime-claw-role-receipt-{time.time_ns()}"
    root = f"{base}/agent"
    receipt = f"{base}/private/live-role-receipt.json"
    prepared = tier1_container.run("bash", "-lc", 'mkdir -p -- "$1"; chmod 700 "$1"', "prepare", f"{base}/private", workdir=None)
    assert prepared.returncode == 0, prepared.stdout + prepared.stderr
    seeded = tier1_container.run(
        "python3", WS_ROLE_MANAGER, "apply", WS_BRIDGE_CONFIG,
        WS_ROLE_KERNEL, WS_LEGACY_FIXTURE, root, workdir=None, timeout=60,
    )
    assert seeded.returncode == 0, seeded.stdout + seeded.stderr
    applied = tier1_container.run(
        WS_APPLY, "--role-receipt", receipt,
        env={"PRIME_AGENT_PLUGIN_ROOT": root},
        workdir=None, timeout=120,
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    verified = tier1_container.run(
        "python3", "-c",
        "import json,os,stat,sys; p,r=sys.argv[1:]; v=json.load(open(p)); assert v['transaction']=='applied'; assert v['destinationRealpath']==os.path.realpath(r); assert stat.S_IMODE(os.stat(p).st_mode)==0o600; print(json.dumps({'ok':True,'transaction':v['transaction']},sort_keys=True))",
        receipt, root, workdir=None,
    )
    cleaned = tier1_container.run("rm", "-rf", "--", base, workdir=None)
    assert cleaned.returncode == 0, cleaned.stdout + cleaned.stderr
    assert verified.returncode == 0, verified.stdout + verified.stderr
    assert json.loads(verified.stdout.strip()) == {"ok": True, "transaction": "applied"}


def test_apply_is_convergent_and_preserves_unrelated_files(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    unrelated = destination / "extensions" / "unrelated.ts"
    unrelated.parent.mkdir(parents=True)
    unrelated.write_bytes(b"preserve me exactly\n")
    first = _run_script(tier1_container, WS_APPLY, destination, seed_bridge=True)
    assert first.returncode == 0, first.stdout + first.stderr
    snapshot = {
        relative: (destination / relative).read_bytes()
        for relative in (
            *FILES,
            *MANAGED_SKILL_FILES,
            "AGENTS.md",
            "APPEND_SYSTEM.md",
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
    assert not (destination / RETIRED).exists()


def test_apply_and_check_do_not_require_the_compatibility_skill(tier1_container, ctmp) -> None:
    fixture = ctmp / "repo"
    shutil.copytree(SOURCE, fixture / "src" / "prime-agent-plugin")
    scripts = fixture / "scripts"
    scripts.mkdir(parents=True)
    for name in (
        "apply-prime-agent-plugin.sh",
        "check-prime-agent-plugin.sh",
        "cleanup-retired-prime-agent-expert-review.py",
        "manage-prime-agent-role-protocol.py",
        "manage-prime-agent-global-assets.py",
        "prime-agent-plugin-target.sh",
    ):
        shutil.copy2(REPO / "scripts" / name, scripts / name)
    assert not (fixture / ".ralph/skills/oversee-episode/SKILL.md").exists()
    destination = ctmp / "agent-without-skill"
    applied = _run_script(
        tier1_container, str(scripts / "apply-prime-agent-plugin.sh"), destination,
        seed_bridge=True,
    )
    checked = _run_script(tier1_container, str(scripts / "check-prime-agent-plugin.sh"), destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert checked.returncode == 0, checked.stdout + checked.stderr



@pytest.mark.parametrize(
    "relative,diagnostic",
    [
        (RETIRED,
         "stale retired goal heartbeat work-control extension"),
        ("extensions/goal-blocker-control.ts",
         "stale obsolete goal blocker control extension"),
        ("extension-support/episode-finalization.ts",
         "stale obsolete episode finalization support file"),
    ],
)
def test_apply_removes_and_check_rejects_obsolete_managed_files(
    tier1_container, ctmp, relative, diagnostic,
) -> None:
    destination = ctmp / "agent"
    obsolete = destination / relative
    obsolete.parent.mkdir(parents=True)
    obsolete.write_text("legacy machinery\n")
    unrelated = destination / "extensions" / "unrelated.ts"
    unrelated.parent.mkdir(parents=True, exist_ok=True)
    unrelated.write_text("preserve me\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert diagnostic in checked.stderr
    applied = _run_script(tier1_container, WS_APPLY, destination, seed_bridge=True)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert not obsolete.exists()
    assert unrelated.read_text() == "preserve me\n"


@pytest.mark.parametrize("relative", [RETIRED, "extensions/goal-blocker-control.ts"])
@pytest.mark.parametrize("unsafe_kind", ["directory", "symlink"])
def test_apply_rejects_unsafe_retired_destination_before_mutation(
    tier1_container, ctmp, relative, unsafe_kind,
) -> None:
    destination = ctmp / "agent"
    unsafe = destination / relative
    unsafe.parent.mkdir(parents=True)
    first = destination / FILES[0]
    first.write_bytes(b"existing generation remains untouched\n")
    append = destination / "APPEND_SYSTEM.md"
    append.write_bytes(b"unrelated append remains untouched\n")
    unrelated = destination / "extensions" / "unrelated.ts"
    unrelated.write_text("preserve me\n")
    if unsafe_kind == "directory":
        unsafe.mkdir()
    else:
        target = ctmp / "outside.ts"
        target.write_text("outside remains untouched\n")
        unsafe.symlink_to(target)

    checked = _run_script(tier1_container, WS_CHECK, destination)
    applied = _run_script(tier1_container, WS_APPLY, destination)

    assert checked.returncode != 0
    assert "unsafe managed plugin destination" in checked.stderr
    assert applied.returncode != 0
    assert "unsafe managed plugin destination" in applied.stderr
    assert first.read_bytes() == b"existing generation remains untouched\n"
    assert append.read_bytes() == b"unrelated append remains untouched\n"
    assert unrelated.read_text() == "preserve me\n"
    if unsafe_kind == "symlink":
        assert unsafe.is_symlink()
        assert target.read_text() == "outside remains untouched\n"



@pytest.mark.parametrize("managed_directory", [
    "root", "extensions", "extension-support", "skills",
    "skills/goals-and-heartbeats",
    "workflows",
    "skills/prime-claw-oversee-episode",
    "skills/prime-claw-expert-review",
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
    append = destination / "APPEND_SYSTEM.md"
    append.write_bytes(b"unrelated append remains untouched\n")

    checked = _run_script(tier1_container, WS_CHECK, destination)
    applied = _run_script(tier1_container, WS_APPLY, destination)

    assert checked.returncode != 0
    assert "unsafe managed plugin directory" in checked.stderr
    assert applied.returncode != 0
    assert "unsafe managed plugin directory" in applied.stderr
    assert append.read_bytes() == b"unrelated append remains untouched\n"
    assert (outside / "sentinel").read_bytes() == b"outside remains untouched\n"
    assert not list(outside.glob("*.ts"))
    if managed_directory == "root":
        assert destination.is_symlink()
    else:
        assert (destination / managed_directory).is_symlink()



def test_check_rejects_stale_managed_conversation_skill(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination, seed_bridge=True)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    skill = destination / SKILL_FILES[0]
    skill.write_text("stale guide\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "global managed asset drift requires explicit resolution" in checked.stderr


def test_check_rejects_a_stale_global_file(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination, seed_bridge=True)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    stale = destination / FILES[0]
    stale.write_text("stale generation\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "stale installed plugin file" in checked.stderr


def test_check_rejects_reappeared_legacy_identity_block(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(
        tier1_container, WS_APPLY, destination, seed_bridge=True
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    append = destination / "APPEND_SYSTEM.md"
    append.write_text(tier1_container.read_repo(
        "tests/fixtures/role-protocol-legacy-append.md"
    ))
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "managed legacy APPEND block remains" in checked.stderr



def test_final_apply_rejects_an_unowned_destination_before_copying(
    tier1_container, ctmp,
) -> None:
    destination = ctmp / "agent"
    destination.mkdir(parents=True)
    (destination / "APPEND_SYSTEM.md").write_text("unrelated operator append\n")
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode != 0
    assert "owned bridge manifest" in applied.stderr
    assert not (destination / FILES[0]).exists()



@pytest.mark.parametrize("unsafe_kind", ["directory", "symlink"])
def test_apply_preflights_all_managed_destinations_before_mutation(
    tier1_container, ctmp, unsafe_kind,
) -> None:
    destination = ctmp / "agent"
    (destination / "extensions").mkdir(parents=True)
    (destination / "extension-support").mkdir()
    first = destination / FILES[0]
    sentinel = b"existing generation remains untouched\n"
    first.write_bytes(sentinel)
    unsafe = destination / FILES[-1]
    if unsafe_kind == "directory":
        unsafe.mkdir()
    else:
        target = ctmp / "outside.ts"
        target.write_bytes(b"outside remains untouched\n")
        unsafe.symlink_to(target)
    append = destination / "APPEND_SYSTEM.md"
    append.write_bytes(b"unrelated append remains untouched\n")

    applied = _run_script(tier1_container, WS_APPLY, destination)

    assert applied.returncode != 0
    assert "unsafe managed plugin destination" in applied.stderr
    assert first.read_bytes() == sentinel
    assert append.read_bytes() == b"unrelated append remains untouched\n"
    if unsafe_kind == "symlink":
        assert unsafe.is_symlink()
        assert unsafe.resolve().read_bytes() == b"outside remains untouched\n"


def test_interrupted_sequential_install_is_not_atomic_and_check_detects_generation(
    tier1_container, ctmp,
) -> None:
    root = ctmp
    destination = root / "agent"
    tools = root / "tools"
    tools.mkdir()
    counter = root / "install-count"
    fake_install = tools / "install"
    fake_install.write_text(
        "#!/usr/bin/env python3\n"
        "import os, pathlib, shutil, sys\n"
        "counter = pathlib.Path(os.environ['INSTALL_COUNTER'])\n"
        "count = int(counter.read_text()) + 1 if counter.exists() else 1\n"
        "counter.write_text(str(count))\n"
        "if count == 3: raise SystemExit(23)\n"
        "source, destination = pathlib.Path(sys.argv[-2]), pathlib.Path(sys.argv[-1])\n"
        "shutil.copyfile(source, destination)\n"
        "destination.chmod(0o644)\n"
    )
    fake_install.chmod(0o755)

    applied = _run_script(
        tier1_container,
        WS_APPLY,
        destination,
        seed_bridge=True,
        env={
            "INSTALL_COUNTER": str(counter),
            "PATH": str(tools) + ":" + CONTAINER_PATH,
        },
    )

    assert applied.returncode == 23, applied.stdout + applied.stderr
    assert (destination / FILES[0]).is_file()
    assert (destination / FILES[1]).is_file()
    assert not (destination / FILES[2]).exists()
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "missing installed plugin file" in checked.stderr


def test_check_rejects_stale_managed_expert_skill(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination, seed_bridge=True)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    skill = destination / "skills/prime-claw-expert-review/SKILL.md"
    skill.write_text(skill.read_text() + "\n# stale installed skill\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "global managed asset drift requires explicit resolution" in checked.stderr


def test_apply_refuses_global_project_template_skill_collision_before_mutation(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination, seed_bridge=True)
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
