"""Regression coverage for inert plugin source and explicit safe target selection.

Tier policy: the layout test is tier 0. Everything that runs the
apply/check/manager install scripts is tier 1 and executes INSIDE the
session's tier-1 container (Linux — the scripts' real target platform)
via the `tier1_container` fixture (auto-marked `container`; see
tests/conftest.py). Scratch lives on the same-path session share (ctmp).
Two choreography-heavy scenarios (SIGTERM-orphan reconciliation and
concurrent-apply serialization) run as self-verifying in-container runners
(tests/container/) because their pipe/pass_fds/flock choreography cannot
cross a docker exec boundary; both runners operate on container-local
/tmp paths and print a JSON verdict.
"""

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
WS_MANAGER = "/workspace/scripts/manage-prime-agent-append-system.py"
WS_APPEND_SOURCE = "/workspace/src/prime-agent-plugin/APPEND_SYSTEM.md"
WS_SIGTERM_PROBE = "/workspace/tests/container/sigterm_orphan_probe.py"
WS_CONCURRENT_PROBE = "/workspace/tests/container/concurrent_apply_probe.py"
# The image's default PATH (Ubuntu base); tests that shadow a tool prepend
# their fake bin dir to this.
CONTAINER_PATH = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
RETIRED = "extensions/goal-heartbeat-work-control.ts"
FILES = (
    "extensions/handoff-chain.ts",
    "extensions/reviewed-plan.ts",
    "extension-support/conversation-oversight.ts",
    "extension-support/episode-close.ts",
    "extension-support/handoff-prompts.ts",
    "extension-support/reviewed-plan-support.ts",
    "extension-support/spec-episode.ts",
)


def test_source_is_outside_project_extension_discovery() -> None:
    assert (SOURCE / "extensions").is_dir()
    assert not (REPO / ".prime" / "agent" / "extensions").exists()
    assert not (REPO / ".prime" / "agent" / "extensions-bak").exists()
    assert not (REPO / ".prime" / "agent" / "extension-support").exists()
    assert not (SOURCE / RETIRED).exists()
    assert {str(path.relative_to(SOURCE)) for path in SOURCE.rglob("*.ts")} == set(FILES)


def _run_script(tier1_container, script: str, destination: Path):
    """Run an install script in-container with the plugin root redirected."""
    return tier1_container.run(
        script,
        env={"PRIME_AGENT_PLUGIN_ROOT": str(destination)},
        workdir=None,
        timeout=60,
    )


def _run_manager(tier1_container, mode: str, destination: Path):
    return tier1_container.run(
        "python3", WS_MANAGER, mode, WS_APPEND_SOURCE, str(destination),
        workdir=None,
        timeout=60,
    )


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
        'mkdir -p "$1/primary/.ralph/skills"; '
        'cp -a /workspace/scripts "$1/primary/"; '
        'cp -a /workspace/src "$1/primary/"; '
        'cp -a /workspace/.ralph/skills/oversee-episode '
        '"$1/primary/.ralph/skills/"; '
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
    applied = tier1_container.run(
        apply, "--user-global", env={"HOME": home}, workdir=None, timeout=60,
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert "target mode: user-global" in applied.stdout
    checked = tier1_container.run(
        check, "--user-global", env={"HOME": home}, workdir=None, timeout=60,
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
        'mkdir -p "$1/candidate/.ralph/skills/plan-prep"; '
        'printf "candidate-only skill\n" > '
        '"$1/candidate/.ralph/skills/plan-prep/SKILL.md"; '
        'mkdir -p "$1/shared-home/.prime/agent/extensions"; '
        'printf "sibling installed generation\n" > '
        '"$1/shared-home/.prime/agent/extensions/reviewed-plan.ts"',
        "topology-setup", base,
        workdir=None,
        timeout=120,
    )
    assert setup.returncode == 0, setup.stdout + setup.stderr

    primary_skill = tier1_container.run(
        "test", "!", "-e", f"{base}/primary/.ralph/skills/plan-prep/SKILL.md",
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
        env={"PRIME_AGENT_PLUGIN_ROOT": isolated},
        workdir=None,
        timeout=60,
    )
    assert applied.returncode == 0, applied.stdout + applied.stderr
    checked = tier1_container.run(
        f"{base}/candidate/scripts/check-prime-agent-plugin.sh",
        env={"PRIME_AGENT_PLUGIN_ROOT": isolated},
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
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    assert "selected copy is current" in applied.stdout
    for relative in FILES:
        expected = tier1_container.read_repo(f"src/prime-agent-plugin/{relative}")
        assert (destination / relative).read_text() == expected, relative
    append = (destination / "APPEND_SYSTEM.md").read_text()
    assert "unrelated user append" in append
    assert append.count("PRIME_CLAW_CONVERSATION_IDENTITY_V1") == 1
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
        for relative in (*FILES, "APPEND_SYSTEM.md", "extensions/unrelated.ts")
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
        "manage-prime-agent-append-system.py",
    ):
        shutil.copy2(REPO / "scripts" / name, scripts / name)
    assert not (fixture / ".ralph/skills/oversee-episode/SKILL.md").exists()
    destination = ctmp / "agent-without-skill"
    applied = _run_script(tier1_container, str(scripts / "apply-prime-agent-plugin.sh"), destination)
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
    applied = _run_script(tier1_container, WS_APPLY, destination)
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



@pytest.mark.parametrize("managed_directory", ["root", "extensions", "extension-support"])
def test_apply_and_check_reject_symlinked_managed_directories_before_mutation(
    tier1_container, ctmp, managed_directory,
) -> None:
    destination = ctmp / "agent"
    outside = ctmp / f"outside-{managed_directory}"
    outside.mkdir()
    (outside / "sentinel").write_bytes(b"outside remains untouched\n")
    if managed_directory == "root":
        destination.symlink_to(outside, target_is_directory=True)
    else:
        destination.mkdir()
        (destination / managed_directory).symlink_to(
            outside, target_is_directory=True,
        )
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


def test_check_rejects_a_stale_global_file(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    stale = destination / FILES[0]
    stale.write_text("stale generation\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "stale installed plugin file" in checked.stderr


def test_check_rejects_missing_or_stale_identity_block(tier1_container, ctmp) -> None:
    destination = ctmp / "agent"
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode == 0, applied.stdout + applied.stderr
    append = destination / "APPEND_SYSTEM.md"
    append.write_text("unrelated only\n")
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "missing managed identity block" in checked.stderr


def test_apply_rejects_duplicate_managed_blocks_before_copying(
    tier1_container, ctmp,
) -> None:
    destination = ctmp / "agent"
    destination.mkdir(parents=True)
    block = tier1_container.read_repo("src/prime-agent-plugin/APPEND_SYSTEM.md")
    (destination / "APPEND_SYSTEM.md").write_text(block + "\n" + block)
    applied = _run_script(tier1_container, WS_APPLY, destination)
    assert applied.returncode != 0
    assert "duplicate prime-claw identity blocks" in applied.stderr
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

    applied = tier1_container.run(
        WS_APPLY,
        env={
            "PRIME_AGENT_PLUGIN_ROOT": str(destination),
            "INSTALL_COUNTER": str(counter),
            "PATH": str(tools) + ":" + CONTAINER_PATH,
        },
        workdir=None,
        timeout=60,
    )

    assert applied.returncode == 23, applied.stdout + applied.stderr
    assert (destination / FILES[0]).is_file()
    assert (destination / FILES[1]).is_file()
    assert not (destination / FILES[2]).exists()
    checked = _run_script(tier1_container, WS_CHECK, destination)
    assert checked.returncode != 0
    assert "missing installed plugin file" in checked.stderr


def test_managed_append_is_byte_stable_and_preserves_unmanaged_bytes_and_mode(
    tier1_container, ctmp,
) -> None:
    destination = ctmp / "APPEND_SYSTEM.md"
    sentinel = b"prefix\x00\xff  \n"
    destination.write_bytes(sentinel)
    destination.chmod(0o640)
    first = _run_manager(tier1_container, "apply", destination)
    assert first.returncode == 0, first.stderr
    installed = destination.read_bytes()
    assert installed.startswith(sentinel)
    assert destination.stat().st_mode & 0o777 == 0o640
    second = _run_manager(tier1_container, "apply", destination)
    assert second.returncode == 0, second.stderr
    assert destination.read_bytes() == installed
    checked = _run_manager(tier1_container, "check", destination)
    assert checked.returncode == 0, checked.stderr
    assert list(destination.parent.glob(".*.tmp")) == []


def test_manager_rejects_every_malformed_marker_shape_without_mutation(
    tier1_container, ctmp,
) -> None:
    source_block = tier1_container.read_repo(
        "src/prime-agent-plugin/APPEND_SYSTEM.md"
    ).encode().strip()
    start = b"<!-- prime-claw:conversation-identity:start -->"
    end = b"<!-- prime-claw:conversation-identity:end -->"
    malformed = {
        "start-only": b"sentinel\n" + start,
        "end-only": b"sentinel\n" + end,
        "reversed": b"sentinel\n" + end + b"\n" + start,
        "duplicate": source_block + b"\n" + source_block,
        "overlap": start + b"\n" + start + b"\n" + end + b"\n" + end,
    }
    for label, original in malformed.items():
        case = ctmp / label
        case.mkdir()
        destination = case / "APPEND_SYSTEM.md"
        destination.write_bytes(original)
        applied = _run_manager(tier1_container, "apply", destination)
        assert applied.returncode != 0, label
        assert destination.read_bytes() == original, label


def test_manager_rejects_destination_symlink_without_mutating_target(
    tier1_container, ctmp,
) -> None:
    target = ctmp / "target.md"
    sentinel = b"do not modify\n"
    target.write_bytes(sentinel)
    destination = ctmp / "APPEND_SYSTEM.md"
    destination.symlink_to(target)
    applied = _run_manager(tier1_container, "apply", destination)
    assert applied.returncode != 0
    assert "destination symlink" in applied.stderr
    assert destination.is_symlink()
    assert target.read_bytes() == sentinel


def test_manager_rejects_symlink_parent_without_creating_destination(
    tier1_container, ctmp,
) -> None:
    real_parent = ctmp / "real-agent"
    real_parent.mkdir()
    linked_parent = ctmp / "linked-agent"
    linked_parent.symlink_to(real_parent, target_is_directory=True)
    destination = linked_parent / "APPEND_SYSTEM.md"
    applied = _run_manager(tier1_container, "apply", destination)
    assert applied.returncode != 0
    assert "parent symlink" in applied.stderr
    assert not (real_parent / "APPEND_SYSTEM.md").exists()


def test_sigterm_orphan_is_reconciled_on_retry_without_deleting_live_writer_temp(
    tier1_container,
) -> None:
    """Runs as a self-verifying in-container runner (see module docstring)."""
    workdir = f"/tmp/pc-sigterm-{time.time_ns()}"
    result = tier1_container.run(
        "python3", WS_SIGTERM_PROBE, WS_MANAGER, WS_APPEND_SOURCE, workdir,
        workdir=None, timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    verdict = json.loads(result.stdout.strip().splitlines()[-1])
    assert verdict == {"ok": True, "orphan_reconciled": True,
                       "decoys_preserved": True}


def test_concurrent_apply_serializes_before_read_and_preserves_sentinel(
    tier1_container,
) -> None:
    """Runs as a self-verifying in-container runner (see module docstring)."""
    workdir = f"/tmp/pc-concurrent-{time.time_ns()}"
    result = tier1_container.run(
        "python3", WS_CONCURRENT_PROBE, WS_MANAGER, WS_APPEND_SOURCE, workdir,
        workdir=None, timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    verdict = json.loads(result.stdout.strip().splitlines()[-1])
    assert verdict == {"ok": True, "contenders": 4}
